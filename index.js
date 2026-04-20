require('dotenv').config();
const fs = require("fs");
const path = require("path");
const { Client, GatewayIntentBits, EmbedBuilder, Collection } = require("discord.js");
const axios = require("axios");

// LUAVALINK
const { LavalinkManager } = require('lavalink-client');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMembers
    ],
});

client.commands = new Collection();
client.radioStatus = null;
let radioplay = 0;

module.exports = {
    getStatus: function() { return radioplay; },
    setStatus: function(newStatus) { radioplay = newStatus; }
};

const IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const idleTimers = new Map();

// LAVALINK
client.lavalink = new LavalinkManager({
    nodes: [
        {
            id: "localnode",
            host: process.env.LAVALINK_HOST || "localhost",
            port: parseInt(process.env.LAVALINK_PORT),
                                      authorization: process.env.LAVALINK_PASSWORD,
                                      secure: process.env.LAVALINK_SECURE === "true",
        }
    ],
    // FIX 1: Updated sendToShard for newer lavalink-client versions
    sendToShard: (guildId, payload) => {
        const guild = client.guilds.cache.get(guildId);
        if (guild) guild.shard.send(payload);
    },
    playerOptions: { defaultVolume: 70 },
    queueOptions: { maxPreviousTracks: 25 },
});

client.once("ready", async () => {
    console.log("Bot is ready");

    // FIX 2: Pass the full client info object
    await client.lavalink.init({ id: client.user.id, username: client.user.username });
    console.log("Lavalink initialized!");

    client.guilds.cache.forEach(guild => {
        const commands = [
            {
                name: "play",
                description: "biisi yt/soundcloud",
                options: [
                    {
                        name: "query",
                        type: 3,
                        description: "linkki tai hakusana",
                        required: true
                    }
                ]
            },
            { name: "stopradio", description: "Pysäytä radio" },
            { name: "typerace", description: "Start a typeracer" },
            { name: "join", description: "Join to typeracer" },
            { name: "meme", description: "nauraa" },
            {
                name: "sää",
                description: "Get the current weather for a specific city.",
                options: [{ name: "city", type: 3, description: "The city", required: true }]
            },
            {
                name: "toggleban",
                description: "Toggle the League of Legends ban system on or off",
                options: [
                    {
                        name: "status",
                        type: 3,
                        description: "on/off",
                        required: true,
                        choices: [{ name: "On", value: "on" }, { name: "Off", value: "off" }]
                    }
                ]
            },
            { name: "skip", description: "Skippaa nykyisen biisin ja siirtyy seuraavaan" },
            {
                name: "radio",
                description: "Play a radio station",
                options: [
                    {
                        name: "station",
                        type: 3,
                        description: "The radio station to play",
                        required: true,
                        choices: [
                            { name: "Järviradio(eitoimi)", value: "jarviradio" },
                            { name: "Sandels Radio(eitoimi)", value: "sandelsradio" },
                            { name: "UpTempo", value: "uptempo" }
                        ]
                    }
                ]
            }
        ];

        guild.commands.set(commands)
        .then(() => console.log(`Slash commands registered in ${guild.name}`))
        .catch(console.error);
    });
});

const commandFiles = fs.readdirSync(path.join(__dirname, "commands")).filter(file => file.endsWith(".js"));
for (const file of commandFiles) {
    const commandName = file.replace(".js", "");
    const command = require(path.join(__dirname, "commands", file));
    client.commands.set(commandName, command);
    console.log(`Loaded command: ${commandName}`);
}

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand()) return;

    const { commandName, options } = interaction;

    if (client.commands.has(commandName)) {
        try {
            const command = client.commands.get(commandName);
            await command(interaction, options, client);
        } catch (error) {
            console.error(`Error executing command ${commandName}:`, error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: "Virhe komennon suorittamisessa!", ephemeral: true });
            }
        }
    }
});
client.on("voiceStateUpdate", async (oldState, newState) => {
    console.log("Voice state update:", newState.guild.id, newState.channelId);

    const player = client.lavalink.players.get(oldState.guild.id);
    if (!player) return;

    // Get the voice channel the bot is in
    const botChannel = oldState.guild.channels.cache.get(player.voiceChannelId);
    if (!botChannel) return;

    // Count non-bot members in the channel
    const nonBotMembers = botChannel.members.filter(m => !m.user.bot);
    if (nonBotMembers.size > 0) return;

    // Channel is empty — wait 30 seconds then leave if still empty
    setTimeout(async () => {
        const p = client.lavalink.players.get(oldState.guild.id);
        if (!p) return;

        const channel = oldState.guild.channels.cache.get(p.voiceChannelId);
        if (!channel) return;

        const stillEmpty = channel.members.filter(m => !m.user.bot).size === 0;
        if (!stillEmpty) return;

        const textChannel = client.channels.cache.get(p.textChannelId);
        if (textChannel) textChannel.send("👋 Kaikki lähti — lähdin myös!").catch(() => {});

        // Clear radio state so retry listener doesn't kick in
        p.isRadio = false;
        p.radioStation = null;
        p.radioRetried = false;
        p._resumeRadioStation = null;

        await p.destroy();
    }, 30 * 1000);
});
client.lavalink.on("trackError", (player, track, error) => {
    console.error("Track error:", error);
});

client.lavalink.on("trackStuck", (player, track, threshold) => {
    console.warn("Track stuck:", track.info.title, threshold);
});

client.lavalink.on("trackEnd", async (player, track, reason) => {
    console.log("Track ended, reason:", reason);

    // Don't resume radio if track was replaced or stopped intentionally
    if (reason === "replaced" || reason === "stopped") return;
    if (player.isRadio) return;
    if (!player._resumeRadioStation) return;

    // Only resume radio if queue is now empty
    if (player.queue.tracks.length > 0) return;

    const stationKey = player._resumeRadioStation;
    player._resumeRadioStation = null;

    const channel = client.channels.cache.get(player.textChannelId);
    if (channel) channel.send(`📻 Jono loppui! Jatketaan radiota...`).catch(() => {});

    const radioCommand = require("./commands/radio");
    await radioCommand.resumeRadio(player, stationKey, client);
});

// FIX 3: Add node connection logging to catch Lavalink connection issues
client.lavalink.on("nodeConnect", (node) => {
    console.log(`Lavalink node connected: ${node.id}`);
});

client.lavalink.on("nodeError", (node, error) => {
    console.error(`Lavalink node error on ${node.id}:`, error);
});

client.lavalink.on("nodeDisconnect", (node, reason) => {
    console.warn(`Lavalink node disconnected: ${node.id}`, reason);
});
client.on('shardDisconnect', (event, shardId) => {
    console.log('Shard disconnected:', shardId, 'code:', event.code, 'reason:', event.reason);
});

client.on('shardError', (error, shardId) => {
    console.error('Shard error:', shardId, error);
});
client.on("raw", (packet) => {
    if (packet.t === "VOICE_SERVER_UPDATE") {
        console.log("VOICE_SERVER_UPDATE:", JSON.stringify(packet.d));
    }
    if (packet.t === "VOICE_STATE_UPDATE" && packet.d.user_id === client.user.id) {
        console.log("BOT VOICE_STATE_UPDATE:", JSON.stringify(packet.d));
    }
    client.lavalink?.sendRawData(packet);
});
// Track start
client.lavalink.on("trackEnd", async (player, track, reason) => {
    console.log("Track ended, reason:", reason, "isRadio:", player.isRadio, "resumeStation:", player._resumeRadioStation, "queueLength:", player.queue.tracks.length);

    const guildId = player.guildId;

    if (idleTimers.has(guildId)) {
        clearTimeout(idleTimers.get(guildId));
        idleTimers.delete(guildId);
    }

    const channel = client.channels.cache.get(player.textChannelId);
    if (!channel) return;

    const embed = new EmbedBuilder()
    .setColor("#00ff00")
    .setTitle("soipi tämmä 🎶")
    .setDescription(`**${track.info.title}**\n${track.info.author || "Tuntematon"}`)
    .setThumbnail(track.info.artworkUrl || null);

    channel.send({ embeds: [embed] }).catch(() => {});
    console.log(track.info.title, " ", track.info.author);
});

// Queue end
client.lavalink.on("queueEnd", async (player) => {
    const channel = client.channels.cache.get(player.textChannelId);
    const guildId = player.guildId;
    if (player._radioStopInProgress) return;


    if (player._resumeRadioStation) {
        const stationKey = player._resumeRadioStation;
        player._resumeRadioStation = null;
        if (channel) channel.send(`📻 Jono loppui! Jatketaan radiota...`).catch(() => {});
        const radioCommand = require("./commands/radio");
        await radioCommand.resumeRadio(player, stationKey, client);
        return;
    }

    if (channel) channel.send("📭 Jono loppui! Lisää lisää biisejä komennolla /play");

    if (idleTimers.has(guildId)) return;
    idleTimers.set(guildId, setTimeout(() => {
        const p = client.lavalink.players.get(guildId);
        if (!p || p.queue.tracks.length > 0) return;
        p.destroy();
        idleTimers.delete(guildId);
        console.log(`Left VC in ${guildId} due to inactivity`);
    }, IDLE_TIMEOUT));
});
client.login(process.env.DISCORD_TOKEN);
