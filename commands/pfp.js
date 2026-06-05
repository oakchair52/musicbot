const { EmbedBuilder } = require('discord.js');

module.exports = async (interaction, options, client) => {
    const user = options.getUser("user") || interaction.user;
    const avatar = user.displayAvatarURL({ size: 1024, extension: "png" });

    const embed = new EmbedBuilder()
        .setColor(0x111111)
        .setTitle(`${user.username}'s profile pic`)
        .setImage(avatar);

    return interaction.reply({ embeds: [embed] });
};
