const { EmbedBuilder } = require("discord.js");
const equipmentPools = require("../data/equipment.json");

module.exports = async (interaction) => {

const rolledItems = {};

const rollResult = Object.entries(equipmentPools)
  .map(([slot, items]) => {
    const item = items[Math.floor(Math.random() * items.length)];
    rolledItems[slot] = item;
    const itemName = typeof item === "string" ? item : item.name;
    return `${slot.padEnd(15)}: ${itemName}`;
  })
  .join("\n");

const rolledWeapon = rolledItems["Right hand"];
const weaponImage = typeof rolledWeapon === "string" ? null : rolledWeapon.image;

const embed = new EmbedBuilder()
  .setAuthor({
    name: interaction.user.username,
    iconURL: interaction.user.displayAvatarURL(),
  })
  .setColor(0x111111)
  .setThumbnail("https://media.tenor.com/Vz6hNcYp6kEAAAAM/black-guy-poggers-poggers.gif")
  .setDescription(`\`\`\`\n${rollResult}\n\`\`\``);

if (weaponImage) {
  embed.setImage(weaponImage);
}

await interaction.reply({ embeds: [embed] });
};

