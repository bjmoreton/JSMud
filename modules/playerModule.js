const { formatDate, formatTime } = require('../Utils/helpers.js');
const Player = require('./PlayerModule/Player.js');
const TextEditor = require('./PlayerModule/TextEditor.js');

const PlayerModule = {
    name: "Player",

    executeGlobalChat(player, args) {
        const message = args.join(' ');
        const currentDate = new Date();

        PlayerModule.mudServer.mudEmitter.emit('sendToAll', player, `[${formatTime(currentDate)}] ${player.username}: ${message}`);
    },

    executeSay(player, args) {
        const message = args.join(' ');

        player.send(`You say "${message}"`);
        PlayerModule.mudServer.mudEmitter.emit('sendToRoom', player, `${player.username} says "${message}"`, [player.username], message);
    },

    onPlayerConnected: (socket) => {
        const player = new Player(socket, 'Guest');
        PlayerModule.mudServer.players.set(socket, player);

        PlayerModule.mudServer.mudEmitter.emit('handleLogin', player, "");

        player.socket.on('data', data => {
            data = data.toString().replace("\r\n", "");
            const cleanedData = data.toString().trim();
            if (!player.hasStatus(player.Statuses.Editing)) {
                if (player.loggedIn) {
                    if (!cleanedData.startsWith('/')) PlayerModule.mudServer.mudEmitter.emit('handleCommand', player, cleanedData);
                    else {
                        const emoteData = cleanedData.startsWith('/') ? cleanedData.replace('/', '') : cleanedData;
                        PlayerModule.mudServer.mudEmitter.emit('handleEmote', player, emoteData);
                    }
                } else PlayerModule.mudServer.mudEmitter.emit('handleLogin', player, cleanedData);
            } else player.textEditor.processInput(cleanedData);
        });

        player.socket.on('error', error => {
            console.error('Socket error:', error);
        });

        player.socket.on('close', () => {
            PlayerModule.mudServer.mudEmitter.emit('playerDisconnected', player);
        });

    },
    onHotBootAfter: () => {
        PlayerModule.saveAllPlayers();

        updatedTextEditor = new TextEditor();
        updatedPlayer = new Player();

        PlayerModule.mudServer.players.forEach(p => {
            Object.setPrototypeOf(p, updatedPlayer.__proto__);
            Object.setPrototypeOf(p.textEditor, updatedTextEditor.__proto__);
        });
    },
    
    onHotBootBefore: () => {
        PlayerModule.saveAllPlayers();
        PlayerModule.mudServer.mudEmitter.removeListener('hotBootAfter', PlayerModule.onHotBootAfter);
        PlayerModule.mudServer.mudEmitter.removeListener('hotBootBefore', PlayerModule.onHotBootBefore);
        PlayerModule.mudServer.mudEmitter.removeListener('playerConnected', PlayerModule.onPlayerConnected);
        PlayerModule.mudServer.mudEmitter.removeListener('sendToAll', PlayerModule.onSendToAll);
    },

    onSendToAll(player, message, excludedPlayers = []) {
        PlayerModule.mudServer.players.forEach(p => {
            if (!excludedPlayers.includes(p.username)) {
                p.send(message);
            }
        });
    },

    init: function (mudServer) {
        this.mudServer = mudServer;

        this.mudServer.mudEmitter.on('hotBootAfter', this.onHotBootAfter);
        this.mudServer.mudEmitter.on('hotBootBefore', this.onHotBootBefore);
        this.mudServer.mudEmitter.on('playerConnected', this.onPlayerConnected);
        this.mudServer.mudEmitter.on('sendToAll', this.onSendToAll);
    },

    playerQuit(player) {
        player?.disconnect(true);
    },

    playerSave(player) {
        player?.save();
    },

    saveAllPlayers() {
        PlayerModule.mudServer.players.forEach(p => {
            if (!p.loggedIn) {
                p.disconnect(false);
                return;
            }
            p.save();
        });
    }
};

module.exports = PlayerModule;