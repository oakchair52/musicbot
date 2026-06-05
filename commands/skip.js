const { EmbedBuilder } = require('discord.js');

module.exports = async (interaction, options, client) => {
    const player = client.lavalink.players.get(interaction.guild.id);

    if (!player) {
        return interaction.reply({ content: "❌ Nothing playing rn", ephemeral: true });
    }

    if (!player.playing && !player.paused) {
        return interaction.reply({ content: "❌ Nothing playing rn", ephemeral: true });
    }

    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel || voiceChannel.id !== player.voiceChannelId) {
        return interaction.reply({ content: "❌ You gotta be in the same vc as the bot!", ephemeral: true });
    }

    if (player.queue.tracks.length === 0) {
        if (player._resumeRadioStation) {
            const stationKey = player._resumeRadioStation;
            player._resumeRadioStation = null;

            await player.stopPlaying(true, false);

            const radioCommand = require("./radio");
            await radioCommand.resumeRadio(player, stationKey, client);

            return interaction.reply(`Queue's done! Back to radio...`);
        }

        if (client._radioCleanup) client._radioCleanup();
        await player.destroy();
        return interaction.reply("No more songs in queue – dipped out of vc.");
    }

    try {
        const currentTrack = player.queue.current;
        await player.skip();

        const embed = new EmbedBuilder()
            .setColor("#ff9900")
            .setTitle("Song skipped!")
            .setDescription(`**${currentTrack.info.title}** got skipped.`)
            .setFooter({ text: `Skipped by ${interaction.user.username}` });

        await interaction.reply({ embeds: [embed] });
    } catch (error) {
        console.error("Skip command error:", error);
        await interaction.reply({ content: "❌ Skip failed. Try again!", ephemeral: true });
    }
};