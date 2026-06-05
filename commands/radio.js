const { EmbedBuilder } = require("discord.js");
const STATIONS = require("../radioConfig.json");

const RETRY_DELAY = 5000;

async function playRadioStream(player, station, requester, client) {
    const user = requester || player._radioRequester || null;

    const result = await player.search(
        { query: station.url, source: "http" },
        user
    );

    if (!result || result.loadType === "error" || result.loadType === "empty" || !result.tracks[0]) {
        return false;
    }

    await player.play({ track: result.tracks[0] });
    player.isRadio = true;
    player.radioStation = Object.keys(STATIONS).find(k => STATIONS[k].name === station.name);
    player.radioRetried = false; 
    return true;
}

function registerRadioListeners(client) {
    if (client._radioListenersRegistered) return;
    client._radioListenersRegistered = true;

    const onTrackEnd = async (player, track, reason) => {
        if (!player.isRadio || !player.radioStation) return;
        if (reason === "replaced" || reason === "stopped") return;

        const station = STATIONS[player.radioStation];
        if (!station) return;

        const textChannel = client.channels.cache.get(player.textChannelId);

        if (player.radioRetried) {
            console.log(`[radio] Stream failed twice for ${station.name} in ${player.guildId}, disconnecting.`);
            if (textChannel) {
                textChannel.send(`**${station.name}** kept disconnecting, we out`).catch(() => {});
            }
            player.isRadio = false;
            player.radioStation = null;
            player.radioRetried = false;
            await player.destroy();
            return;
        }

        console.log(`[radio] Stream ended unexpectedly for ${station.name}, retrying in ${RETRY_DELAY / 1000}s...`);
        if (textChannel) {
            textChannel.send(`**${station.name}** dropped, retrying in ${RETRY_DELAY / 1000}s...`).catch(() => {});
        }

        player.radioRetried = true;

        setTimeout(async () => {
            const p = client.lavalink.players.get(player.guildId);
            if (!p || !p.isRadio || p.radioStation !== player.radioStation) return;

            const success = await playRadioStream(p, station, null, client);
            if (!success) {
                console.log(`[radio] Retry failed for ${station.name} in ${p.guildId}, disconnecting.`);
                if (textChannel) {
                    textChannel.send(`**${station.name}** retry failed, leaving`).catch(() => {});
                }
                p.isRadio = false;
                p.radioStation = null;
                p.radioRetried = false;
                await p.destroy();
            } else {
                if (textChannel) {
                    textChannel.send(`**${station.name}** we're back!`).catch(() => {});
                }
            }
        }, RETRY_DELAY);
    };

    const onTrackError = async (player, track, error) => {
        if (!player.isRadio || !player.radioStation) return;

        const station = STATIONS[player.radioStation];
        if (!station) return;

        console.error(`[radio] trackError for ${station.name}:`, error);
    };

    client.lavalink.on("trackEnd", onTrackEnd);
    client.lavalink.on("trackError", onTrackError);

    client._radioCleanup = () => {
        client.lavalink.removeListener("trackEnd", onTrackEnd);
        client.lavalink.removeListener("trackError", onTrackError);
        client._radioListenersRegistered = false;
        client._radioCleanup = null;
    };
}

async function radio(interaction, options, client) {
    await interaction.deferReply();
    registerRadioListeners(client);

    const stationKey = options.getString("station");
    const station = STATIONS[stationKey];

    if (!station) {
        return interaction.editReply({ content: "❌ The fuck is that station?", ephemeral: true });
    }

    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel) {
        return interaction.editReply({
            content: "❌ Get in a voice channel first",
            ephemeral: true,
        });
    }

    const permissions = voiceChannel.permissionsFor(interaction.guild.members.me);
    if (!permissions.has("Connect") || !permissions.has("Speak")) {
        return interaction.editReply({
            content: "❌ I don't have perms to join or speak in your channel",
            ephemeral: true,
        });
    }

    try {
        let player = client.lavalink.players.get(interaction.guildId);

        if (!player) {
            player = await client.lavalink.createPlayer({
                guildId: interaction.guildId,
                voiceChannelId: voiceChannel.id,
                textChannelId: interaction.channelId,
                selfDeaf: true,
                selfMute: false,
            });
        } else {
            if (player.voiceChannelId !== voiceChannel.id) {
                await player.setVoiceChannel(voiceChannel.id);
            }
            player.textChannelId = interaction.channelId;
        }

        if (!player.connected) {
            await player.connect();
        }

        await player.stopPlaying(true, false);
        player.queue.tracks.splice(0);

        player.isRadio = false;
        player.radioStation = null;
        player.radioRetried = false;

        player._radioRequester = interaction.user;
        const success = await playRadioStream(player, station, interaction.user, client);

        if (!success) {
            return interaction.editReply({
                content: `❌ Couldn't load **${station.name}**. Stream URL might be cucked.`,
            });
        }

        const embed = new EmbedBuilder()
            .setColor(station.color)
            .setTitle(`Radio is live`)
            .setDescription(`Tuned into **${station.name}**`)
            .addFields({ name: "Channel", value: voiceChannel.name, inline: true })
            .setFooter({ text: "Stop the radio with /stop or /skip" })
            .setTimestamp();

        if (station.thumbnail) {
            embed.setThumbnail(station.thumbnail);
        }

        return interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error("[radio] Error:", error);
        return interaction.editReply({
            content: `❌ Couldn't start radio: ${error.message}`,
        });
    }
}

module.exports = radio;
module.exports.resumeRadio = async function(player, stationKey, client) {
    const station = STATIONS[stationKey];
    if (!station) return;
    player.isRadio = false;
    player.radioStation = null;
    player.radioRetried = false;
    await playRadioStream(player, station, player._radioRequester, client);
};