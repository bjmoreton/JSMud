// Importing necessary modules
const fs = require('fs');
const path = require('path');
const Emote = require('./EmoteModule/Emote');

/**
 * Emote module for MUD server.
 * Handles emotes, including adding, editing, deleting, formatting, and handling emote actions.
 * 
 * @module EmoteModule
 */
const EmoteModule = {
    EMOTES_PATH: path.join(__dirname, '../system', 'emotes.json'),
    name: "Emote",
    emotesList: new Map(),

    /**
     * Initializes the EmoteModule.
     * 
     * @param {Object} mudServer - The MUD server instance.
     */
    init: function (mudServer) {
        global.EmoteModule = this;
        this.mudServer = mudServer;
        this.registerEvents();
    },

    /**
     * Adds a new emote to the emote list.
     * 
     * @param {Player} player - The player adding the emote.
     * @param {Array<string>} args - Emote arguments (name, description).
     */
    addEmote(player, args) {
        const [emoteName, ...data] = args;

        if (emoteName !== undefined) {
            if (!EmoteModule.emotesList.has(emoteName.toLowerCase())) {
                const emoteAction = new Emote(data.join(' '));
                EmoteModule.emotesList.set(emoteName.toLowerCase(), emoteAction);
                player.send(`Emote ${emoteName} added successfully.`);
            } else {
                player.send(`Emote ${emoteName} already exists!`);
            }
        } else {
            player.send(`Usage: addemote emote solodescription`);
        }
    },

    /**
     * Deletes an emote from the emote list.
     * 
     * @param {Player} player - The player deleting the emote.
     * @param {Array<string>} args - Emote arguments (name).
     */
    async deleteEmote(player, args) {
        const [emoteName, ...data] = args;

        if (emoteName !== undefined) {
            if (EmoteModule.emotesList.has(emoteName.toLowerCase())) {
                const deleteForSure = await player.textEditor.showPrompt(`Delete emote ${emoteName}? y/n`);

                if (deleteForSure.toLowerCase() === 'y' || deleteForSure.toLowerCase() === 'yes') {
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

    /**
     * Edits an existing emote.
     * 
     * @param {Player} player - The player editing the emote.
     * @param {Array<string>} args - Emote arguments (name, property, data).
     */
    editEmote(player, args) {
        const [emoteName, emoteProperty, ...data] = args;

        if (emoteName !== undefined) {
            if (EmoteModule.emotesList.has(emoteName.toLowerCase())) {
                const emoteAction = EmoteModule.emotesList.get(emoteName.toLowerCase());

                if (emoteProperty.toLowerCase() === 'name') {
                    const oldName = emoteName;
                    const newName = data.join(' ');
                    EmoteModule.emotesList.delete(emoteName.toLowerCase());
                    EmoteModule.emotesList.set(newName.toLowerCase(), emoteAction);
                    player.send(`Renamed emote ${oldName} to ${newName}.`);
                } else if (emoteAction[emoteProperty] !== undefined) {
                    emoteAction[emoteProperty] = data.join(' ');
                    player.send(`Emote ${emoteName} property ${emoteProperty} updated successfully.`);
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

    /**
     * Formats an emote string by replacing placeholders.
     * 
     * @param {Player} player - The player performing the emote.
     * @param {Player} target - The target player.
     * @param {string} string - The emote string to format.
     * @returns {string} The formatted emote string.
     */
    formatEmote(player, target, string) {
        return string?.replace('%p', player?.username).replace('%t', target?.username);
    },

    /**
     * Handles an emote action.
     * 
     * @param {Player} player - The player performing the emote.
     * @param {string} emote - The emote string.
     * @param {Object} eventObj - The event object.
     */
    handleEmote(player, emote, eventObj) {
        if (emote === undefined || emote === "") return;

        const emoteParts = emote.match(/(?:[^\s"'`]+|["'][^"'`]*["']|`[^`]*`)+/g);
        const cleanedParts = emoteParts.map(part => part.replace(/^["'`]|["'`]$/g, ''));
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

    /**
     * Loads emotes from the JSON file.
     * 
     * @param {Player} [player] - The player loading the emotes (optional).
     */
    load(player) {
        try {
            const data = fs.readFileSync(EmoteModule.EMOTES_PATH, 'utf8');
            const emotes = JSON.parse(data);
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

    /**
     * Handles the hot boot before event.
     */
    onHotBootBefore() {
        EmoteModule.removeEvents();
    },

    /**
     * Registers event listeners for the module.
     */
    registerEvents() {
        EmoteModule.mudServer.on('handleEmote', EmoteModule.handleEmote);
        EmoteModule.mudServer.on('hotBootBefore', EmoteModule.onHotBootBefore);
    },

    /**
     * Removes event listeners for the module.
     */
    removeEvents() {
        EmoteModule.mudServer.off('handleEmote', EmoteModule.handleEmote);
        EmoteModule.mudServer.off('hotBootBefore', EmoteModule.onHotBootBefore);
    },

    /**
     * Saves the current emotes to the JSON file.
     * 
     * @param {Player} player - The player saving the emotes.
     */
    save(player) {
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
};

module.exports = EmoteModule;
