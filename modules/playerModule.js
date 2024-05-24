// Importing necessary modules
const fs = require('fs');
const path = require('path');
const { formatTime, isNumber } = require('./Mud/Helpers.js');
const Player = require('./PlayerModule/Player.js');
const Status = require('./PlayerModule/Status.js');
const TextEditor = require('./PlayerModule/TextEditor.js');

/**
 * Player module for MUD server.
 * Handles player statuses, commands, and events related to players.
 * 
 * @module PlayerModule
 */
const PlayerModule = {
    STATUSES_PATH: path.join(__dirname, '../system', 'statuses.json'),
    name: "Player",

    /**
     * Adds a new status to the player statuses list.
     * 
     * @param {Player} player - The player adding the status.
     * @param {Array<string>} args - Status arguments (name, type).
     */
    async addStatus(player, args) {
        let [statusName, statusType] = args;
        try {
            if (!statusName || !statusType) {
                player.send(`Usage: addstatus name <buff | debuff | state>`);
                return;
            }

            if (Player.validStatus(statusName)) {
                player.send(`Status already exists!`);
                return;
            }

            statusType = Status.validStatusType(statusType);

            if (!statusType) {
                player.send(`Invalid status type!`);
                return;
            }

            const description = await player.textEditor.startEditing('');
            if (!description || description.trim() === '') {
                player.send('Invalid status description!');
                return;
            }

            Player.addStatus(statusName, description, statusType);
            player.send(`Status ${statusName} added successfully.`);
        } catch (error) {
            console.error(error);
        }
    },

    /**
     * Executes a global chat message.
     * 
     * @param {Player} player - The player sending the message.
     * @param {Array<string>} args - Message arguments.
     */
    executeGlobalChat(player, args) {
        const message = args.join(' ');
        const currentDate = new Date();

        PlayerModule.mudServer.emit('sendToAll', player, `[${formatTime(currentDate)}] ${player.username}: ${message}`);
    },

    /**
     * Executes a say command for the player.
     * 
     * @param {Player} player - The player saying the message.
     * @param {Array<string>} args - Message arguments.
     */
    executeSay(player, args) {
        const message = args.join(' ');

        player.send(`You say "${message}"`);
        PlayerModule.mudServer.emit('sendToRoom', player, `${player.username} says "${message}"`, [player.username], message);
    },

    fadedTimeout(player) {
        if (player.loggedIn) player.send(`You fade from existence.`);
        player.faded = true;
        player.fadedTimeout = setTimeout(() => { player.disconnect(player.loggedIn); }, 360000); // 5 minutes
    },

    /**
     * Handles player connection.
     * 
     * @param {Socket} socket - The player's socket connection.
     */
    onPlayerConnected: (socket) => {
        socket.setKeepAlive(true, 60000); // Send a keep-alive packet every 60 seconds
        const player = new Player(socket, 'Guest');
        PlayerModule.mudServer.players.set(socket, player);
        player.fadedTimeout = setTimeout(() => { player.disconnect(player.loggedIn); }, 360000); // 5 minutes
        PlayerModule.mudServer.emit('handleLogin', player, "");

        player.socket.on('data', data => {
            if (player.faded) {
                if (player.loggedIn) player.send(`You materialize into being.`);
                player.faded = false;
            }
            data = data.toString().replace("\n", "");
            const cleanedData = data.toString().trim();
            if (cleanedData.length === 0 || PlayerModule.mudServer.hotbooting) return;

            if (!player.hasStatus('editing')) {
                if (player.loggedIn) {
                    const eventObj = { handled: false };
                    PlayerModule.mudServer.emit('handleCommand', player, cleanedData, eventObj);
                    if (!eventObj.handled) {
                        PlayerModule.mudServer.emit('handleEmote', player, cleanedData, eventObj);
                    }

                    if (!eventObj.handled) {
                        player.send(`Unknown command`);
                    }
                } else PlayerModule.mudServer.emit('handleLogin', player, cleanedData);
            } else player.textEditor.processInput(cleanedData);

            clearTimeout(player.fadedTimeout);
            player.fadedTimeout = setTimeout(() => { PlayerModule.fadedTimeout(player); }, 720000); // 10 minutes
        });

        player.socket.on('error', error => {
            console.error('Socket error:', error);
        });

        player.socket.on('close', () => {
            PlayerModule.mudServer.emit('playerDisconnected', player);
        });

    },

    /**
     * Handles actions to be taken after a hot boot.
     */
    onHotBootAfter: () => {
        PlayerModule.saveAllPlayers();

        const updatedTextEditor = new TextEditor();
        const updatedPlayer = new Player();

        PlayerModule.mudServer.players.forEach(p => {
            Object.setPrototypeOf(p, updatedPlayer.__proto__);
            Object.setPrototypeOf(p.textEditor, updatedTextEditor.__proto__);
        });
    },

    /**
     * Handles actions to be taken before a hot boot.
     */
    onHotBootBefore: () => {
        PlayerModule.saveAllPlayers();
        PlayerModule.mudServer.off('hotBootAfter', PlayerModule.onHotBootAfter);
        PlayerModule.mudServer.off('hotBootBefore', PlayerModule.onHotBootBefore);
        PlayerModule.mudServer.off('playerConnected', PlayerModule.onPlayerConnected);
        PlayerModule.mudServer.off('sendToAll', PlayerModule.onSendToAll);
    },

    /**
     * Sends a message to all connected players.
     * 
     * @param {Player} player - The player sending the message.
     * @param {string} message - The message to send.
     * @param {Array<string>} [excludedPlayers=[]] - List of player usernames to exclude from receiving the message.
     */
    onSendToAll(player, message, excludedPlayers = []) {
        PlayerModule.mudServer.players.forEach(p => {
            if (!excludedPlayers.includes(p.username)) {
                p.send(message);
            }
        });
    },

    /**
     * Initializes the PlayerModule.
     * 
     * @param {Object} mudServer - The MUD server instance.
     */
    init: function (mudServer) {
        global.PlayerModule = this;
        this.mudServer = mudServer;

        this.mudServer.on('hotBootAfter', this.onHotBootAfter);
        this.mudServer.on('hotBootBefore', this.onHotBootBefore);
        this.mudServer.on('playerConnected', this.onPlayerConnected);
        this.mudServer.on('sendToAll', this.onSendToAll);
    },

    /**
     * Loads the PlayerModule, including player statuses.
     */
    load() {
        PlayerModule.loadStatuses();
    },

    /**
     * Loads player statuses from the JSON file.
     * 
     * @param {Player} [player] - The player loading the statuses (optional).
     */
    loadStatuses(player) {
        try {
            const data = fs.readFileSync(PlayerModule.STATUSES_PATH, 'utf8');
            const statusesData = JSON.parse(data);
            PlayerModule.mudServer.emit('statusesLoading', player);
            statusesData.forEach(status => {
                Player.addStatus(status.name, status.description, status.type);
            });
            console.log("Statuses loaded successfully.");
            if (player) player.send("Statuses loaded successfully.");
        } catch (err) {
            console.error('Error reading or parsing JSON file:', err);
            if (player) player.send("Failed to load statuses.");
        }
    },

    /**
     * Handles player quit action.
     * 
     * @param {Player} player - The player quitting.
     */
    playerQuit(player) {
        player?.disconnect(true);
    },

    /**
     * Saves the player's data.
     * 
     * @param {Player} player - The player to save.
     */
    playerSave(player) {
        player?.save();
    },

    /**
     * Removes a status from the player statuses list.
     * 
     * @param {Player} player - The player removing the status.
     * @param {Array<string>} args - Status arguments (name).
     */
    removeStatus(player, args) {
        const [statusName] = args;
        if (!statusName) {
            player.send(`Usage: removestatus status`);
            return;
        }

        if (Player.validStatus(statusName)) {
            delete Player.Statuses[statusName.toLowerCase()];
            player.send(`Status ${statusName} removed successfully.`);
        } else player.send(`Status ${statusName} not found!`);
    },

    /**
     * Saves all connected players' data.
     */
    saveAllPlayers() {
        PlayerModule.mudServer.players.forEach(p => {
            if (!p.loggedIn) {
                p.disconnect(false);
                return;
            }
            p.save(false);
        });
    },

    /**
     * Saves player statuses to the JSON file.
     * 
     * @param {Player} [player] - The player saving the statuses (optional).
     */
    saveStatuses(player) {
        try {
            const serializedData = PlayerModule.serializeStatuses(Player.Statuses);
            fs.writeFileSync(PlayerModule.STATUSES_PATH, JSON.stringify(serializedData, null, 2), 'utf8');
            console.log("Statuses saved successfully.");
            if (player) player.send("Statuses saved successfully.");
        } catch (error) {
            console.error("Failed to save statuses:", error);
            if (player) player.send("Failed to save statuses.");
        }
    },

    /**
     * Serializes player statuses to an array of status objects.
     * 
     * @returns {Array<Object>} - Array of serialized status objects.
     */
    serializeStatuses() {
        const statusesArray = [];
        for (const [name, status] of Player.Statuses.entries()) {
            const statusData = {
                ...status.serialize()
            };
            statusesArray.push(statusData);
        }
        return statusesArray;
    },

    /**
     * Sets the moderator level of a specified player.
     * 
     * @param {Player} player - The player executing the command.
     * @param {Array<string>} args - Command arguments [playerName, modLevel].
     */
    setModLevel(player, args) {
        const [playerName, modLevel] = args;

        if (!playerName) {
            player.send(`Usage: setmodlevel [player] [level]`);
            return;
        }

        if (!modLevel || !isNumber(modLevel)) {
            player.send(`Usage: setmodlevel ${playerName} [level]`);
            return;
        }

        const newModLevel = parseInt(modLevel);
        const playerModLevel = player.modLevel;

        if (newModLevel > playerModLevel) {
            player.send(`Cannot set a player's mod level higher than your own(${playerModLevel})!`);
            return;
        }

        const playerToEdit = PlayerModule.mudServer.findPlayerByUsername(playerName);
        if (playerToEdit === player) {
            player.send(`Cannot update your own mod level!`);
            return;
        }

        if (!playerToEdit) {
            player.send(`Player ${playerName} not found.`);
            return;
        }

        playerToEdit.modLevel = newModLevel;
        playerToEdit.send(`New mod level set: ${newModLevel}.`);
        playerToEdit.save(false);
        player.send(`New mod level(${newModLevel}) set for ${playerToEdit.username} successfully.`);
    },
};

module.exports = PlayerModule;
