const { AttachmentBuilder } = require("discord.js");
const { createCanvas, loadImage } = require("canvas");
const fs = require("fs");

const generateRandomString = () => {
  const strings = ["Perusperjantai petosella", "Aram moment"];
  const randomIndex = Math.floor(Math.random() * strings.length);
  return strings[randomIndex];
};

const memeCommand = async (interaction) => {
  const memeFolderPath = "./Images";

  try {
    if (!fs.existsSync(memeFolderPath)) {
      fs.mkdirSync(memeFolderPath, { recursive: true });
      return interaction.reply("Created `Images/` folder. Cop some pics in there and try again.");
    }

    const imageFiles = fs.readdirSync(memeFolderPath).filter((file) => {
      const ext = file.split(".").pop().toLowerCase();
      return ["png", "jpg", "jpeg"].includes(ext);
    });

    if (imageFiles.length === 0) {
      throw new Error("No meme images found in the folder.");
    }

    const randomIndex = Math.floor(Math.random() * imageFiles.length);
    const randomImagePath = `${memeFolderPath}/${imageFiles[randomIndex]}`;

    const randomString = generateRandomString();

    const memeImage = await loadImage(randomImagePath);

    const canvas = createCanvas(memeImage.width, memeImage.height);
    const ctx = canvas.getContext("2d");

    ctx.drawImage(memeImage, 0, 0, memeImage.width, memeImage.height);

    const text = randomString.toUpperCase();
    ctx.font = "bold 50px Impact";
    ctx.fillStyle = "white";
    ctx.textAlign = "center";

    const textX = canvas.width / 2;
    const textY = 60;
    const textWidth = ctx.measureText(text).width;
    const textHeight = 50;

    ctx.fillRect(textX - textWidth / 2 - 10, textY - textHeight / 2, textWidth + 20, textHeight + 10);

    ctx.fillStyle = "black";
    ctx.fillText(text, textX, textY + textHeight / 2 - 10);

    const memeBuffer = canvas.toBuffer("image/png");

    const interactionReply = {
      content: "Here's your low effort content!",
      files: [new AttachmentBuilder(memeBuffer, { name: "meme.png" })],
    };

    await interaction.reply(interactionReply);

  } catch (error) {
    console.error("Error sending meme command:", error);
    await interaction.reply(
      "An error occurred while sending the meme. Check logs or cope."
    );
  }
};

module.exports = memeCommand;
