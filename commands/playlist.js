const { EmbedBuilder } = require('discord.js');
const db = require('../db');

module.exports = async (interaction, options, client) => {
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const embed = new EmbedBuilder().setColor("#0099ff");

    if (sub === 'create') {
        const name = options.getString('name').trim();
        if (!name || name.length > 32) {
            return interaction.reply({ content: "❌ Name's gotta be 1-32 chars", ephemeral: true });
        }

        const count = db.prepare('SELECT COUNT(*) AS c FROM playlists WHERE user_id = ?').get(userId).c;
        if (count >= 5) {
            return interaction.reply({ content: "❌ Capped at 5 playlists, delete one first", ephemeral: true });
        }

        try {
            db.prepare('INSERT INTO playlists (user_id, name) VALUES (?, ?)').run(userId, name);
            return interaction.reply({ content: `Created **${name}**`, ephemeral: true });
        } catch (e) {
            if (e.message.includes('UNIQUE')) {
                return interaction.reply({ content: "❌ You already got a playlist with that name", ephemeral: true });
            }
            throw e;
        }
    }

    if (sub === 'delete') {
        const name = options.getString('name').trim();
        const pl = db.prepare('SELECT id FROM playlists WHERE user_id = ? AND name = ?').get(userId, name);
        if (!pl) {
            return interaction.reply({ content: "❌ No playlist with that name", ephemeral: true });
        }

        db.prepare('DELETE FROM playlists WHERE id = ?').run(pl.id);
        return interaction.reply({ content: `Torched **${name}**`, ephemeral: true });
    }

    if (sub === 'list') {
        const rows = db.prepare('SELECT name, (SELECT COUNT(*) FROM playlist_tracks WHERE playlist_id = p.id) AS count FROM playlists p WHERE user_id = ? ORDER BY created_at DESC').all(userId);
        if (rows.length === 0) {
            return interaction.reply({ content: "No playlists. Cop one with `/playlist create`", ephemeral: true });
        }

        embed.setTitle("Ur playlists");
        embed.setDescription(rows.map(r => `**${r.name}** — ${r.count} tracks`).join('\n'));
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'add') {
        const name = options.getString('name').trim();
        const pl = db.prepare('SELECT id FROM playlists WHERE user_id = ? AND name = ?').get(userId, name);
        if (!pl) {
            return interaction.reply({ content: "❌ No playlist with that name", ephemeral: true });
        }

        const player = client.lavalink.players.get(interaction.guild.id);
        if (!player || !player.queue.current) {
            return interaction.reply({ content: "❌ Nothing's playing rn", ephemeral: true });
        }

        const trackCount = db.prepare('SELECT COUNT(*) AS c FROM playlist_tracks WHERE playlist_id = ?').get(pl.id).c;
        if (trackCount >= 100) {
            return interaction.reply({ content: "❌ Playlist's full (100 track cap)", ephemeral: true });
        }

        const track = player.queue.current;
        const dup = db.prepare('SELECT id FROM playlist_tracks WHERE playlist_id = ? AND uri = ?').get(pl.id, track.info.uri);
        if (dup) {
            return interaction.reply({ content: "❌ That song's already in this playlist", ephemeral: true });
        }

        db.prepare('INSERT INTO playlist_tracks (playlist_id, title, author, uri, artwork_url, encoded) VALUES (?, ?, ?, ?, ?, ?)').run(
            pl.id, track.info.title, track.info.author || '', track.info.uri || '', track.info.artworkUrl || '', track.encoded || ''
        );

        return interaction.reply({ content: `Added **${track.info.title}** to **${name}**`, ephemeral: true });
    }

    if (sub === 'addsearch') {
        const name = options.getString('name').trim();
        const query = options.getString('query');

        const pl = db.prepare('SELECT id FROM playlists WHERE user_id = ? AND name = ?').get(userId, name);
        if (!pl) {
            return interaction.reply({ content: "❌ No playlist with that name", ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const trackCount = db.prepare('SELECT COUNT(*) AS c FROM playlist_tracks WHERE playlist_id = ?').get(pl.id).c;
        if (trackCount >= 100) {
            return interaction.editReply("❌ Playlist full (max 100 tracks)");
        }

        const searchQuery = query.includes("http") ? query : `ytsearch:${query}`;

        const node = client.lavalink.nodeManager?.nodes?.get("localnode");
        if (!node) return interaction.editReply("❌ Lavalink's down, kek");

        let searchResult;
        try {
            searchResult = await node.search({ query: searchQuery }, interaction.user);
        } catch {
            return interaction.editReply("❌ Search shat itself");
        }

        if (searchResult.loadType === "empty" || searchResult.tracks.length === 0) {
            return interaction.editReply("❌ Found jack shit");
        }

        const track = searchResult.tracks[0];

        const dup = db.prepare('SELECT id FROM playlist_tracks WHERE playlist_id = ? AND uri = ?').get(pl.id, track.info.uri);
        if (dup) {
            return interaction.editReply("❌ That song's already in this playlist");
        }

        db.prepare('INSERT INTO playlist_tracks (playlist_id, title, author, uri, artwork_url, encoded) VALUES (?, ?, ?, ?, ?, ?)').run(
            pl.id, track.info.title, track.info.author || '', track.info.uri || '', track.info.artworkUrl || '', track.encoded || ''
        );

        const embed2 = new EmbedBuilder()
            .setColor("#0099ff")
            .setTitle("Added")
            .setDescription(`**${track.info.title}**\nAdded to **${name}**`)
            .setThumbnail(track.info.artworkUrl || null);

        return interaction.editReply({ embeds: [embed2] });
    }

    if (sub === 'remove') {
        const name = options.getString('name').trim();
        const position = options.getInteger('position');

        const pl = db.prepare('SELECT id FROM playlists WHERE user_id = ? AND name = ?').get(userId, name);
        if (!pl) {
            return interaction.reply({ content: "❌ No playlist with that name", ephemeral: true });
        }

        const track = db.prepare('SELECT id, title FROM playlist_tracks WHERE playlist_id = ? ORDER BY id LIMIT 1 OFFSET ?').get(pl.id, position - 1);
        if (!track) {
            return interaction.reply({ content: "❌ That track number doesn't exist", ephemeral: true });
        }

        db.prepare('DELETE FROM playlist_tracks WHERE id = ?').run(track.id);
        return interaction.reply({ content: `Yeeted **${track.title}** from **${name}**`, ephemeral: true });
    }

    if (sub === 'view') {
        const name = options.getString('name').trim();
        const pl = db.prepare('SELECT id FROM playlists WHERE user_id = ? AND name = ?').get(userId, name);
        if (!pl) {
            return interaction.reply({ content: "❌ No playlist with that name", ephemeral: true });
        }

        const rows = db.prepare('SELECT title, author, uri FROM playlist_tracks WHERE playlist_id = ? ORDER BY id').all(pl.id);
        if (rows.length === 0) {
            return interaction.reply({ content: `**${name}** is empty. Cop some songs with \`/playlist addsearch\``, ephemeral: true });
        }

        embed.setTitle(name);
        const lines = rows.map((r, i) => `\`${i + 1}.\` [${r.title}](${r.uri}) — ${r.author}`);
        embed.setDescription(lines.join('\n'));
        embed.setFooter({ text: `${rows.length} tracks` });

        if (embed.data.description.length > 4096) {
            embed.setDescription(lines.slice(0, 15).join('\n') + `\n\n... and ${rows.length - 15} more`);
        }

        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'play') {
        const name = options.getString('name').trim();
        const pl = db.prepare('SELECT id FROM playlists WHERE user_id = ? AND name = ?').get(userId, name);
        if (!pl) {
            return interaction.reply({ content: "❌ No playlist with that name", ephemeral: true });
        }

        const rows = db.prepare('SELECT uri, title, author, encoded FROM playlist_tracks WHERE playlist_id = ? ORDER BY id').all(pl.id);
        if (rows.length === 0) {
            return interaction.reply({ content: `**${name}** is empty.`, ephemeral: true });
        }

        if (!interaction.member.voice.channel) {
            return interaction.reply({ content: "❌ get in a vc first dumbass", ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        let player = client.lavalink.players.get(interaction.guild.id);
        if (!player) {
            player = client.lavalink.createPlayer({
                guildId: interaction.guild.id,
                voiceChannelId: interaction.member.voice.channel.id,
                textChannelId: interaction.channel.id,
                selfDeaf: true,
            });
            await player.connect();
        }

        if (player.isRadio) {
            player._resumeRadioStation = player.radioStation;
            player._radioStopInProgress = true;
            player.isRadio = false;
            player.radioStation = null;
            player.radioRetried = false;
            await player.stopPlaying(true, false);
            player.queue.tracks.splice(0);
            player._radioStopInProgress = false;
        }

        const loadEmbed = new EmbedBuilder()
            .setColor("#0099ff")
            .setTitle("Loading ur shit")
            .setDescription(`Pulling **${rows.length}** tracks from **${name}**...`);

        await interaction.editReply({ embeds: [loadEmbed] });

        const resolved = [];
        for (const row of rows) {
            try {
                const result = await player.search({ query: row.uri }, interaction.user);
                if (result.loadType !== "empty" && result.tracks.length > 0) {
                    resolved.push(result.tracks[0]);
                }
            } catch {
                // skip failed tracks
            }
        }

        if (resolved.length === 0) {
            return interaction.editReply({ content: "❌ None of those tracks loaded", embeds: [] });
        }

        const wasEmpty = !player.playing && !player.paused;

        player.queue.add(resolved);

        if (wasEmpty) {
            await player.play();
        }

        const doneEmbed = new EmbedBuilder()
            .setColor("#0099ff")
            .setTitle("Queued")
            .setDescription(`**${name}**\n${resolved.length}/${rows.length} tracks queued`);

        return interaction.editReply({ embeds: [doneEmbed], content: '' });
    }
};
