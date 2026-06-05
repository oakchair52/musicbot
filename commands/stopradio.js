module.exports = async function stopradio(interaction, options, client) {
    await interaction.deferReply();

    const player = client.lavalink.players.get(interaction.guildId);

    if (!player) {
        return interaction.editReply({ content: "❌ Nothing's playing rn" });
    }

    if (!player.isRadio) {
        return interaction.editReply({ content: "❌ Radio ain't on" });
    }

    player.isRadio = false;
    player.radioStation = null;
    player.radioRetried = false;
    player._resumeRadioStation = null;

    await player.stopPlaying(true, false);
    player.queue.tracks.splice(0);

    if (client._radioCleanup) client._radioCleanup();

    return interaction.editReply({ content: `radio stopped.` });
};