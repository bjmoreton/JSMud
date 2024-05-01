const fs = require('fs');
const LoginModule = require('./LoginModule.js');
const { formatDate, formatTime } = require('../Utils/helpers.js');
const Player = require('./PlayerModule/Player.js');
const TextEditor = require('./PlayerModule/TextEditor.js');

const PlayerModule = {
    name: "Player",

    executeGlobalChat(player, args) {
        const message = args.join(' ');
        const currentDate = new Date();
        PlayerModule.mudServer.players.forEach(p => {
            p.send(`[${formatTime(currentDate)}] ${player.username}: ${message}`);
        });
    },

    onPlayerConnected: (socket) => {
        const player = new Player(socket, 'Guest');
        PlayerModule.mudServer.players.set(socket, player);

        PlayerModule.mudServer.mudEmitter.emit('handleLogin', player, "");

        player.socket.on('data', data => {
            data = data.toString().replace("\r\n", "");
            const command = data.toString().trim();
            if (!player.hasStatus(player.Statuses.Editing)) {
                if (player.connectionStatus == LoginModule.ConnectionStatus.LoggedIn) PlayerModule.mudServer.mudEmitter.emit('handleCommand', player, command);
                else PlayerModule.mudServer.mudEmitter.emit('handleLogin', player, command);
            } else player.textEditor.processInput(command);
        });

        player.socket.on('error', error => {
            console.error('Socket error:', error);
        });

        player.socket.on('close', () => {
            PlayerModule.mudServer.mudEmitter.emit('playerDisconnected', player);
        });

    },
    onHotBootAfter: () => {
        PlayerModule.mudServer.players.forEach(p => {
            if (p.connectionStatus != LoginModule.ConnectionStatus.LoggedIn) {
                p.disconnect(false);
                return;
            }
            p.save();
        });

        updatedTextEditor = new TextEditor();
        updatedPlayer = new Player();

        PlayerModule.mudServer.players.forEach(p => {
            Object.setPrototypeOf(p, updatedPlayer.__proto__);
            Object.setPrototypeOf(p.textEditor, updatedTextEditor.__proto__);
        });
    },
    onHotBootBefore: () => {
        PlayerModule.mudServer.players.forEach(p => {
            if (p.connectionStatus != LoginModule.ConnectionStatus.LoggedIn) {
                p.disconnect(false);
                return;
            }
            p.save();
        });
        PlayerModule.mudServer.mudEmitter.removeListener('playerConnected', PlayerModule.onPlayerConnected);
        PlayerModule.mudServer.mudEmitter.removeListener('hotBootAfter', PlayerModule.onHotBootAfter);
        PlayerModule.mudServer.mudEmitter.removeListener('hotBootBefore', PlayerModule.onHotBootBefore);
    },
    init: function (mudServer) {
        this.mudServer = mudServer;

        // this.mudServer.registerCommand(serverCommandsModule.createCommand('globalchat', ['chat', 'gc', 'global'], 0, (player, args) => {
        //     const message = args.join(' ');
        //     const currentDate = new Date();
        //     this.mudServer.players.forEach(p => {
        //         p.send(`[${formatTime(currentDate)}] ${player.username}: ${message}`);
        //     });
        // }));

        this.mudServer.mudEmitter.on('playerConnected', this.onPlayerConnected);
        this.mudServer.mudEmitter.on('hotBootAfter', this.onHotBootAfter);
        this.mudServer.mudEmitter.on('hotBootBefore', this.onHotBootBefore);
    },

    playerExist: (player) => {
        const filePath = player.getFilePath();
        try {
            fs.accessSync(filePath, fs.constants.F_OK);
            return true; // File exists
        } catch (err) {
            return false; // File does not exist
        }
    },

    playerQuit(player) {
        player?.disconnect(true);
    },

    playerSave(player) {
        player?.save();
    }
};

module.exports = PlayerModule;