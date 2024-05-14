const { formatDate, formatTime } = require('../Utils/helpers.js');
const Player = require('./PlayerModule/Player.js');
const TextEditor = require('./PlayerModule/TextEditor.js');

const PlayerModule = {
    name: "Player",

    executeGlobalChat(player, args) {
        const message = args.join(' ');
        const currentDate = new Date();

        PlayerModule.mudServer.emit('sendToAll', player, `[${formatTime(currentDate)}] ${player.username}: ${message}`);
    },

    executeSay(player, args) {
        const message = args.join(' ');

        player.send(`You say "${message}"`);
        PlayerModule.mudServer.emit('sendToRoom', player, `${player.username} says "${message}"`, [player.username], message);
    },

    onPlayerConnected: (socket) => {
        const player = new Player(socket, 'Guest');
        PlayerModule.mudServer.players.set(socket, player);

        PlayerModule.mudServer.emit('handleLogin', player, "");

        player.socket.on('data', data => {
            data = data.toString().replace("\r\n", "");
            const cleanedData = data.toString().trim();
            if (!player.hasStatus(Player.Statuses.Editing)) {
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
        });

        player.socket.on('error', error => {
            console.error('Socket error:', error);
        });

        player.socket.on('close', () => {
            PlayerModule.mudServer.emit('playerDisconnected', player);
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
        PlayerModule.mudServer.removeListener('hotBootAfter', PlayerModule.onHotBootAfter);
        PlayerModule.mudServer.removeListener('hotBootBefore', PlayerModule.onHotBootBefore);
        PlayerModule.mudServer.removeListener('playerConnected', PlayerModule.onPlayerConnected);
        PlayerModule.mudServer.removeListener('sendToAll', PlayerModule.onSendToAll);
    },

    onSendToAll(player, message, excludedPlayers = []) {
        PlayerModule.mudServer.players.forEach(p => {
            if (!excludedPlayers.includes(p.username)) {
                p.send(message);
            }
        });
    },

    init: function (mudServer) {
        global.PlayerModule = this;
        this.mudServer = mudServer;

        this.mudServer.on('hotBootAfter', this.onHotBootAfter);
        this.mudServer.on('hotBootBefore', this.onHotBootBefore);
        this.mudServer.on('playerConnected', this.onPlayerConnected);
        this.mudServer.on('sendToAll', this.onSendToAll);
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