const { EmbedBuilder } = require('discord.js');

module.exports = async (interaction, options, client) => {
    if (!interaction.member.voice.channel) {
        return interaction.reply({ content: "❌ get in a vc first dumbass", ephemeral: true });
    }

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

    const query = options.getString("query");
    if (!query) return interaction.reply({ content: "❌ u gotta give me a song or link", ephemeral: true });

    const searchQuery = query.includes("http") ? query : `ytsearch:${query}`;
    await interaction.deferReply();

    try {
        const result = await player.search({ query: searchQuery }, interaction.user);
        if (result.loadType === "empty" || result.tracks.length === 0) {
            return interaction.editReply("❌ THE FUCK IS THIS??");
        }

        const tracks = result.loadType === "playlist" ? result.tracks : [result.tracks[0]];

        const embed = new EmbedBuilder()
            .setColor("#0099ff")
            .setTitle(result.loadType === "playlist" ? "Playlist added" : "Song queued")
            .setDescription(
                result.loadType === "playlist"
                ? `**${result.playlist?.name || "??? some playlist"}**\n${tracks.length} tracks added`
                : `**${tracks[0].info.title}**\n${tracks[0].info.author}`
            )
            .setThumbnail(tracks[0].info.artworkUrl || null)
            .setFooter({ text: `Requested by: ${interaction.user.username}` });

 if (player.isRadio) {
    player._resumeRadioStation = player.radioStation;
    player._radioStopInProgress = true;
    player.isRadio = false;
    player.radioStation = null;
    player.radioRetried = false;

    await player.stopPlaying(true, false);
    player.queue.tracks.splice(0);

    player._radioStopInProgress = false;

    await player.play({ track: tracks[0] });

    if (tracks.length > 1) {
        player.queue.add(tracks.slice(1));
    }

    return interaction.editReply({ embeds: [embed] });
}
        player.queue.add(tracks);
        await interaction.editReply({ embeds: [embed] });

        if (!player.playing && !player.paused) {
            await player.play();
        }

    } catch (error) {
        console.error("Play command error:", error);
        await interaction.editReply("❌ shit's fucked");
    }
};