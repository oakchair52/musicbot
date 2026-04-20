//Not currently in use. uses old libraries

const { createAudioResource } = require('@discordjs/voice');
const { CustomPlugin } = require('distube');

class RadioPlugin extends CustomPlugin {
    constructor() {
        super();
    }

    // Validate if the URL is a radio stream
    validate(url) {
        return url.startsWith('http');
    }

    async resolve(url, options) {
        return {
            url,
            name: `Radio Stream: ${url}`,
            isLive: true, // Mark as a live stream
            duration: 0, // Duration is unknown for live streams
        };
    }

    async play(voiceChannel, song) {
        const resource = createAudioResource(song.url, {
            inputType: 'arbitrary'
        });
        
        // Return the audio resource for DisTube to play
        return resource;
    }
}

module.exports = RadioPlugin;
