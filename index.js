require('dotenv').config();
const fs = require("fs");
const path = require("path");
const { Client, GatewayIntentBits, EmbedBuilder, Collection } = require("discord.js");

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

const IDLE_TIMEOUT = 5 * 60 * 1000; 
const idleTimers = new Map();
const voiceLeaveTimers = new Map();

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
    sendToShard: (guildId, payload) => {
        const guild = client.guilds.cache.get(guildId);
        if (guild) guild.shard.send(payload);
    },
    playerOptions: { defaultVolume: 70 },
    queueOptions: { maxPreviousTracks: 25 },
});

client.once("ready", async () => {
    console.log("Bot is ready");

    await client.lavalink.init({ id: client.user.id, username: client.user.username });
    console.log("Lavalink initialized!");

    client.guilds.cache.forEach(guild => {
        const commands = [
            {
                name: "play",
                description: "song from yt/soundcloud",
                options: [
                    {
                        name: "query",
                        type: 3,
                        description: "link or search query",
                        required: true
                    }
                ]
            },
            { name: "stopradio", description: "Stop the radio" },
            { name: "typerace", description: "Start a typeracer" },
            { name: "join", description: "Join the typerace" },
            { name: "meme", description: "generates a meme, kek" },
            {
                name: "sää",
                description: "Check the weather, nerd.",
                options: [{ name: "city", type: 3, description: "City name", required: true }]
            },
            { name: "skip", description: "Skips the current song" },
            { name: "queue", description: "Shows the queue" },
            {
                name: "pfp",
                description: "Grab someone's profile pic",
                options: [
                    {
                        name: "user",
                        type: 6,
                        description: "User to peek at (leave empty for your own)",
                        required: false
                    }
                ]
            },
            {
                name: "radio",
                description: "Play a radio station",
                options: [
                    {
                        name: "station",
                        type: 3,
                        description: "Station name",
                        required: true,
                        choices: [
                            { name: "Järviradio", value: "jarviradio" },
                            { name: "Sandels Radio", value: "sandelsradio" },
                            { name: "UpTempo", value: "uptempo" }
                        ]
                    }
                ]
            },
            {
                name: "playlist",
                description: "Manage your playlists",
                options: [
                    {
                        name: "create",
                        type: 1,
                        description: "Create a new playlist",
                        options: [
                            { name: "name", type: 3, description: "Playlist name", required: true }
                        ]
                    },
                    {
                        name: "delete",
                        type: 1,
                        description: "Delete a playlist",
                        options: [
                            { name: "name", type: 3, description: "Playlist name", required: true }
                        ]
                    },
                    {
                        name: "add",
                        type: 1,
                        description: "Add current song to a playlist",
                        options: [
                            { name: "name", type: 3, description: "Playlist name", required: true }
                        ]
                    },
                    {
                        name: "addsearch",
                        type: 1,
                        description: "Search and add a song without playing it",
                        options: [
                            { name: "name", type: 3, description: "Playlist name", required: true },
                            { name: "query", type: 3, description: "Song name or link", required: true }
                        ]
                    },
                    {
                        name: "remove",
                        type: 1,
                        description: "Remove a track from a playlist",
                        options: [
                            { name: "name", type: 3, description: "Playlist name", required: true },
                            { name: "position", type: 4, description: "Track number to remove", required: true }
                        ]
                    },
                    {
                        name: "view",
                        type: 1,
                        description: "View songs in a playlist",
                        options: [
                            { name: "name", type: 3, description: "Playlist name", required: true }
                        ]
                    },
                    {
                        name: "play",
                        type: 1,
                        description: "Play all songs from a playlist",
                        options: [
                            { name: "name", type: 3, description: "Playlist name", required: true }
                        ]
                    },
                    {
                        name: "list",
                        type: 1,
                        description: "List all your playlists"
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
                await interaction.reply({ content: "Command execution failed, kek", ephemeral: true });
            }
        }
    }
});

client.on("voiceStateUpdate", async (oldState, newState) => {
    console.log("Voice state update:", newState.guild.id, newState.channelId);

    const player = client.lavalink.players.get(oldState.guild.id);
    if (!player) return;

    const botChannel = oldState.guild.channels.cache.get(player.voiceChannelId);
    if (!botChannel) return;

    const nonBotMembers = botChannel.members.filter(m => !m.user.bot);
    if (nonBotMembers.size > 0) return;

    if (voiceLeaveTimers.has(oldState.guild.id)) {
        clearTimeout(voiceLeaveTimers.get(oldState.guild.id));
    }

    voiceLeaveTimers.set(oldState.guild.id, setTimeout(async () => {
        const p = client.lavalink.players.get(oldState.guild.id);
        if (!p) return;

        const channel = oldState.guild.channels.cache.get(p.voiceChannelId);
        if (!channel) return;

        const stillEmpty = channel.members.filter(m => !m.user.bot).size === 0;
        if (!stillEmpty) return;

        const textChannel = client.channels.cache.get(p.textChannelId);
        if (textChannel) textChannel.send("Everyone left — I'm out too").catch(() => {});

        if (idleTimers.has(oldState.guild.id)) {
            clearTimeout(idleTimers.get(oldState.guild.id));
            idleTimers.delete(oldState.guild.id);
        }

        p.isRadio = false;
        p.radioStation = null;
        p.radioRetried = false;
        p._resumeRadioStation = null;

        if (client._radioCleanup) client._radioCleanup();

        voiceLeaveTimers.delete(oldState.guild.id);

        await p.destroy();
    }, 30 * 1000));
});

client.lavalink.on("trackError", (player, track, error) => {
    console.error("Track error:", error);
});

client.lavalink.on("trackStuck", (player, track, threshold) => {
    console.warn("Track stuck:", track.info.title, threshold);
});

client.lavalink.on("trackStart", async (player, track) => {
    if (player.isRadio) return;

    const guildId = player.guildId;
    if (idleTimers.has(guildId)) {
        clearTimeout(idleTimers.get(guildId));
        idleTimers.delete(guildId);
    }
    if (voiceLeaveTimers.has(guildId)) {
        clearTimeout(voiceLeaveTimers.get(guildId));
        voiceLeaveTimers.delete(guildId);
    }

    const channel = client.channels.cache.get(player.textChannelId);
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setColor("#00ff00")
        .setTitle("Now playing")
        .setDescription(`**${track.info.title}**\n${track.info.author || "Unknown"}`)
        .setThumbnail(track.info.artworkUrl || null);

    channel.send({ embeds: [embed] }).catch(() => {});
    console.log(track.info.title, " ", track.info.author);
});

client.lavalink.on("trackEnd", async (player, track, reason) => {
    console.log(`Track ended, reason: ${reason}, isRadio: ${player.isRadio}, queueLength: ${player.queue.tracks.length}`);

    if (reason === "replaced" || reason === "stopped") return;
    if (player.isRadio) return;
    if (!player._resumeRadioStation) return;
    if (player.queue.tracks.length > 0) return;

    const stationKey = player._resumeRadioStation;
    player._resumeRadioStation = null;

    const channel = client.channels.cache.get(player.textChannelId);
    if (channel) channel.send(`Queue ended! Going back to radio...`).catch(() => {});

    const radioCommand = require("./commands/radio");
    await radioCommand.resumeRadio(player, stationKey, client);
});

client.lavalink.on("queueEnd", async (player) => {
    const channel = client.channels.cache.get(player.textChannelId);
    const guildId = player.guildId;
    
    if (player._radioStopInProgress) return;

    if (player._resumeRadioStation) {
        const stationKey = player._resumeRadioStation;
        player._resumeRadioStation = null;
        if (channel) channel.send(`Queue ended! Going back to radio...`).catch(() => {});
        const radioCommand = require("./commands/radio");
        await radioCommand.resumeRadio(player, stationKey, client);
        return;
    }

    if (channel) channel.send("Queue's empty! Cop more songs with /play");

    if (idleTimers.has(guildId)) return;
    idleTimers.set(guildId, setTimeout(() => {
        const p = client.lavalink.players.get(guildId);
        if (!p || p.queue.tracks.length > 0) return;
        p.destroy();
        idleTimers.delete(guildId);
        voiceLeaveTimers.delete(guildId);
        console.log(`Left VC in ${guildId} due to inactivity`);
    }, IDLE_TIMEOUT));
});

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
    client.lavalink?.sendRawData(packet);
});

process.on("SIGINT", async () => {
    console.log("\nShutting down gracefully...");
    for (const timer of idleTimers.values()) clearTimeout(timer);
    for (const timer of voiceLeaveTimers.values()) clearTimeout(timer);
    idleTimers.clear();
    voiceLeaveTimers.clear();
    for (const player of client.lavalink.players.values()) {
        if (client._radioCleanup) client._radioCleanup();
        await player.destroy();
    }
    await client.lavalink.destroy();
    await client.destroy();
    process.exit(0);
});

process.on("SIGTERM", async () => {
    console.log("\nSIGTERM received, shutting down...");
    for (const timer of idleTimers.values()) clearTimeout(timer);
    for (const timer of voiceLeaveTimers.values()) clearTimeout(timer);
    idleTimers.clear();
    voiceLeaveTimers.clear();
    for (const player of client.lavalink.players.values()) {
        if (client._radioCleanup) client._radioCleanup();
        await player.destroy();
    }
    await client.lavalink.destroy();
    await client.destroy();
    process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);