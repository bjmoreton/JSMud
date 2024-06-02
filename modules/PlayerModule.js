// Importing necessary modules
const fs = require('fs');
const path = require('path');
const { formatTime, isNumber } = require('./Mud/Helpers.js');
const Player = require('./PlayerModule/Player.js');
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
     * Executes a global chat message.
     * 
     * @param {Player} player - The player sending the message.
     * @param {Array<string>} args - Message arguments.
     */
    executeGlobalChat(player, args, input) {
        const message = input;
        const currentDate = new Date();

        PlayerModule.mudServer.emit('sendToAll', player, `[${formatTime(currentDate)}] ${player.username}: ${message}`);
    },

    /**
     * Executes a say command for the player.
     * 
     * @param {Player} player - The player saying the message.
     * @param {Array<string>} args - Message arguments.
     */
    executeSay(player, args, input) {
        const message = input;

        player.send(`You say "${message}"`);
        PlayerModule.mudServer.emit('sendToRoom', player, `${player.username} says "${message}"`, [player.username], message);
    },

    fadedTimeout(player) {
        if (player.loggedIn) player.send(`You fade from existence.`);
        player.faded = true;
        PlayerModule.startFadeOut(player, 360000); // 5 minutes
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
        PlayerModule.startFadeOut(player, 720000); // 10 minutes
        PlayerModule.mudServer.emit('newPlayerConnected', player);
        PlayerModule.mudServer.emit('handleLogin', player, "");

        player.socket.on('data', data => {
            data = data.toString().replace("\n", "");
            const cleanedData = data.toString().trim();
            if (cleanedData.length === 0 || PlayerModule.mudServer.hotbooting) return;

            if (player.faded) {
                player.faded = false;
                if (player.loggedIn) player.send(`You materialize into being.`);
            }

            if (!player.statuses.hasStatus('editing')) {
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
            PlayerModule.startFadeOut(720000); // 10 minutes
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
        PlayerModule.mudServer.players.forEach(p => {
            Object.setPrototypeOf(p, Player.prototype);
            Object.setPrototypeOf(p.textEditor, TextEditor.prototype);
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

    startFadeOut(player, timeout) {
        if (player.modLevel < 40) player.fadedTimeout = setTimeout(() => { PlayerModule.fadedTimeout(player); }, timeout);
    }
};

module.exports = PlayerModule;
