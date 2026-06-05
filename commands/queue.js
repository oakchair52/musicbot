const { EmbedBuilder } = require('discord.js');

module.exports = async (interaction, options, client) => {
    const player = client.lavalink.players.get(interaction.guild.id);

    if (!player) {
        return interaction.reply({ content: "❌ Nothing's playing rn", ephemeral: true });
    }

    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel || voiceChannel.id !== player.voiceChannelId) {
        return interaction.reply({ content: "❌ You gotta be in the same vc as the bot!", ephemeral: true });
    }

    const queue = player.queue.tracks;
    const current = player.queue.current;

    if (!current && queue.length === 0) {
        return interaction.reply("Queue's empty. Cop some songs with /play");
    }

    const embed = new EmbedBuilder()
        .setColor("#0099ff")
        .setTitle("Queue")
        .setFooter({ text: `Total: ${queue.length} tracks` });

    if (current) {
        embed.setDescription(`**Now Playing:** [${current.info.title}](${current.info.uri}) - ${current.info.author}`);
    }

    if (queue.length === 0) {
        embed.addFields({ name: "Up Next", value: "Nothing. Queue's clean." });
    } else {
        const tracksPerPage = 10;
        const pages = Math.ceil(queue.length / tracksPerPage);

        for (let page = 0; page < Math.min(pages, 1); page++) {
            const start = page * tracksPerPage;
            const end = Math.min(start + tracksPerPage, queue.length);
            let list = '';

            for (let i = start; i < end; i++) {
                const t = queue[i];
                list += `\`${i + 1}.\` [${t.info.title}](${t.info.uri}) - ${t.info.author}\n`;
            }

            embed.addFields({ name: `Up Next (1-${Math.min(queue.length, tracksPerPage)})`, value: list || "Nothing." });
        }

        if (pages > 1) {
            embed.setFooter({ text: `Total: ${queue.length} tracks (showing first ${tracksPerPage})` });
        }
    }

    return interaction.reply({ embeds: [embed] });
};
