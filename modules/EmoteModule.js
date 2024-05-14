// Importing necessary modules
const fs = require('fs');
const path = require('path');
const Emote = require('./EmoteModule/Emote');

// Emote module
const EmoteModule = {
    EMOTES_PATH: path.join(__dirname, '../system', 'emotes.json'),
    name: "Emote",
    emotesList: new Map(),
    init: function (mudServer) {
        global.EmoteModule = this;
        this.mudServer = mudServer;
        this.registerEvents();
    },

    addEmote(player, args) {
        const [emoteName, ...data] = args;

        if (emoteName !== undefined) {
            if (!EmoteModule.emotesList.has(emoteName.toLowerCase())) {
                const emoteAction = new Emote(data.join(' '));
                EmoteModule.emotesList.set(emoteName.toLowerCase(), emoteAction);
                player.send(`Emote ${emoteName} added successfully.`);
            } else {
                player.send(`Emote ${emoteName} already exist!`);
            }
        } else {
            player.send(`Usage: addemote emote solodescription`);
        }
    },

    async deleteEmote(player, args) {
        const [emoteName, ...data] = args;

        if (emoteName !== undefined) {
            if (EmoteModule.emotesList.has(emoteName.toLowerCase())) {
                const deleteForSure = await player.textEditor.showPrompt(`Delete emote ${emoteName}? y/n`)

                if (deleteForSure.toLowerCase() == 'y' || deleteForSure.toLowerCase() == 'yes') {
                    EmoteModule.emotesList.delete(emoteName.toLowerCase());
                    player.send(`Emote ${emoteName} removed successfully.`);
                } else {
                    player.send(`Emote ${emoteName} wasn't deleted!`);
                }
            } else {
                player.send(`Emote ${emoteName} doesn't exist!`);
            }
        } else {
            player.send(`Usage: deleteemote emote`);
        }
    },

    editEmote(player, args) {
        const [emoteName, emoteProperty, ...data] = args;

        if (emoteName !== undefined) {
            if (EmoteModule.emotesList.has(emoteName.toLowerCase())) {
                const emoteAction = EmoteModule.emotesList.get(emoteName.toLowerCase());

                if(emoteProperty.toLowerCase() == 'name') {
                    const oldName = emoteName;
                    const newName = data.join(' ');
                    EmoteModule.emotesList.delete(emoteName.toLowerCase());
                    EmoteModule.emotesList.set(newName.toLowerCase(), emoteAction);
                    player.send(`Renamed emote ${oldName} to ${newName}.`);
                } else if (emoteAction[emoteProperty] !== undefined) {
                    emoteAction[emoteProperty] = data.join(' ');
                } else {
                    player.send(`Property ${emoteProperty} doesn't exist!`);
                }
            } else {
                player.send(`Emote ${emoteName} doesn't exist!`);
            }
        } else {
            player.send(`Usage: editemote emote <others | othersSolo | solo | target | you>`);
        }
    },

    formatEmote(player, target, string) {
        return string?.replace('%p', player?.username)
            .replace('%t', target?.username);
    },

    handleEmote(player, emote, eventObj) {
        if (emote == undefined || emote == "") return;

        // Split string by spaces, leaving spaces inside quotes alone
        const commandParts = emote.match(/(?:[^\s"]+|"[^"]*")+/g);
        // Remove quotes from each part
        const cleanedParts = commandParts.map(part => part.replace(/^"|"$/g, ''));
        const [emoteName, ...args] = cleanedParts;
        const emoteAction = EmoteModule.emotesList.get(emoteName);

        if (emoteAction) {
            const [target] = args;
            const targetPlayer = EmoteModule.mudServer.findPlayerByUsername(target);
            if (targetPlayer && targetPlayer.sameRoomAs(player)) {
                player.send(EmoteModule.formatEmote(player, targetPlayer, emoteAction.you));
                targetPlayer.send(EmoteModule.formatEmote(player, targetPlayer, emoteAction.target));
                EmoteModule.mudServer.emit('sendToRoom', player, EmoteModule.formatEmote(player, targetPlayer, emoteAction.others), [player?.username, targetPlayer?.username]);
            } else {
                player.send(EmoteModule.formatEmote(player, null, emoteAction.solo));
                EmoteModule.mudServer.emit('sendToRoom', player, EmoteModule.formatEmote(player, targetPlayer, emoteAction.othersSolo), [player?.username, targetPlayer?.username]);
            }
            EmoteModule.mudServer.emit('sendToRoomEmote', player, emoteAction);
            eventObj.handled = true;
        }
    },

    load(player) {
        try {
            // Reading the JSON file
            const data = fs.readFileSync(EmoteModule.EMOTES_PATH, 'utf8');
            // Parse the JSON data
            const emotes = JSON.parse(data);
            // Using Object.keys to get an array of emotes and then iterate
            Object.keys(emotes).forEach(emoteType => {
                const [solo, you, target, others, othersSolo] = emotes[emoteType];
                EmoteModule.emotesList.set(emoteType.toLowerCase(), new Emote(emoteType.toLowerCase(), solo, you, target, others, othersSolo));
                console.log(`Emote ${emoteType} loaded successfully.`);
            });
            if (player) player.send(`Emotes loaded successfully.`);
        } catch (err) {
            console.error('Error reading or parsing JSON file:', err);
        }
    },

    onHotBootBefore() {
        EmoteModule.removeEvents();
    },

    registerEvents() {
        EmoteModule.mudServer.on('handleEmote', EmoteModule.handleEmote);
        EmoteModule.mudServer.on('hotBootBefore', EmoteModule.onHotBootBefore);
    },

    removeEvents() {
        EmoteModule.mudServer.removeListener('handleEmote', EmoteModule.handleEmote);
        EmoteModule.mudServer.removeListener('hotBootBefore', EmoteModule.onHotBootBefore);
    },

    save(player, args) {
        try {
            const emotesToSave = {};
            EmoteModule.emotesList.forEach((value, key) => {
                emotesToSave[key] = [value.solo, value.you, value.target, value.others, value.othersSolo];
            });
            fs.writeFileSync(EmoteModule.EMOTES_PATH, JSON.stringify(emotesToSave, null, 2));
            player.send(`Emotes saved successfully.`);
        } catch (error) {
            player.send(`Failed to save emotes:`);
            player.send(`${error}`);
        }
    },
}

module.exports = EmoteModule;