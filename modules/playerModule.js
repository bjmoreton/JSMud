const fs = require('fs');
const path = require('path');
const { parseColors } = require('../Color.js');
const loginModule = require('./loginModule.js');
const { formatDate, formatTime } = require('./../Utils/helpers.js');
const serverCommandsModule = require('./serverCommandsModule.js');
const textEditorModule = require('./textEditorModule.js');

const playerModule = {
    name: "Players",
    Player: class Player {
        Statuses = {
            None: 0,
            Editing: 1 << 0
        }

        textEditor = new textEditorModule.TextEditor(this);

        addCommands(cmds) {
            return this.commands.push(cmds);
        }

        addStatus(status) {
            this.statuses |= status;
        }

        constructor(socket, username) {
            this.socket = socket;
            this.username = username;
            this.commands = [];
            this.canBuild = false;
            this.loggedIn = false;
            this.modLevel = 0;
            this.statuses = this.Statuses.None;
        }

        destroy() {
            this.socket.destroy();
        }

        disconnect(save) {
            if (save === true) this.save();
            this.socket.end();
            playerModule.ms.mudEmitter.emit('playerDisconnected', this);
        }

        getFilePath(username) {
            return path.join(__dirname, '../players', username.charAt(0).toLowerCase(), `${username.toLowerCase()}.json`);
        }

        hasCommand(cmd) {
            return this.commands.includes(cmd);
        }

        hasStatus(status) {
            return this.statuses && status;
        }

        exist(username) {
            const filePath = this.getFilePath(username);
            try {
                fs.accessSync(filePath, fs.constants.F_OK);
                return true; // File exists
            } catch (err) {
                return false; // File does not exist
            }
        }

        load(username) {
            try {
                // Read the JSON file synchronously
                const jsonFilePath = this.getFilePath(username);
                const playerData = fs.readFileSync(jsonFilePath, 'utf-8');

                // Parse the JSON data
                const playerObject = JSON.parse(playerData);

                // Assign the player data to the player object
                Object.assign(this, playerObject);
            } catch (err) {
                console.error('Error reading or parsing JSON file:', err);
            }
        }

        removeStatus(status) {
            this.statuses &= ~status;
        }

        save() {
            if(!this.loggedIn) return;

            // Exclude the properties you want to ignore
            const { socket, send, connectionStatus, loggedIn, Statuses, textEditor, ...playerData } = this;
            const filePath = this.getFilePath(this.username);

            // Generate the directory path
            const directoryPath = path.dirname(this.getFilePath(this.username));

            // Check if the directory exists, and create it if not
            if (!fs.existsSync(directoryPath)) {
                fs.mkdirSync(directoryPath, { recursive: true });
            }

            // Write player data to file in JSON format
            fs.writeFileSync(filePath, JSON.stringify(playerData, null, 2));

            this.send("Saved!");
        }

        send(message) {
            try {
                if(!this.hasStatus(this.Statuses.Editing)) this.socket.write(`${parseColors(message)}\r\n`);
            } catch (error) {
                console.log(`${this.username} failed to receive ${message}`);
            }
        }

        sendRAW(message) {
            try {
                this.socket.write(`${message}\r\n`);
            } catch (error) {
                console.log(`${this.username} failed to receive ${message}`);
            }
        }
    },
    playerConnectedCB: (socket) => {
        const player = new playerModule.Player(socket, 'Guest');
        playerModule.ms.players.set(socket, player);

        playerModule.ms.mudEmitter.emit('handleLogin', player, "");

        player.socket.on('data', data => {
            data = data.toString().replace("\r\n", "");
            const command = data.toString().trim();
            if (player.connectionStatus == loginModule.ConnectionStatus.LoggedIn)
            {
                if(!player.hasStatus(player.Statuses.Editing)) playerModule.ms.mudEmitter.emit('handleCommand', player, command);
                else player.textEditor.processInput(command);
            } else playerModule.ms.mudEmitter.emit('handleLogin', player, command);
        });

        player.socket.on('error', error => {
            console.error('Socket error:', error);
        });

        player.socket.on('end', () => {
            playerModule.ms.mudEmitter.emit('playerDisconnected', player);
        });

    },
    hotBootAfterCB: () => {
        playerModule.ms.players.forEach(p => {
            if (p.connectionStatus != loginModule.ConnectionStatus.LoggedIn) {
                p.disconnect(false);
            }
            p.save();
        });        
    },
    hotBootBeforeCB: () => {
        playerModule.ms.players.forEach(p => {
            if (p.connectionStatus != loginModule.ConnectionStatus.LoggedIn) {
                p.disconnect(false);
            }
            p.save();
        });
        playerModule.ms.mudEmitter.removeListener('playerConnected', playerModule.playerConnectedCB);
        playerModule.ms.mudEmitter.removeListener('after_hotboot', playerModule.hotBootAfterCB);
        playerModule.ms.mudEmitter.removeListener('before_hotboot', playerModule.hotBootBeforeCB);
    },
    init: function (mudServer) {
        this.ms = mudServer;

        this.ms.registerCommand('globalchat', serverCommandsModule.createCommand('globalchat', ['chat', 'gc', 'global'], 0, (player, args) => {
            const message = args.join(' ');
            const currentDate = new Date();
            this.ms.players.forEach(p => {
                p.send(`[${formatTime(currentDate)}] ${player.username}: ${message}`);
            });
        }));
        this.ms.registerCommand('quit', serverCommandsModule.createCommand('quit', [], 0, (player, args) => {
            player.disconnect(true);
        }));
        this.ms.registerCommand('save', serverCommandsModule.createCommand('save', [], 0, (player, args) => {
            player.save();
        }));

        this.ms.players.forEach(p => {
            updatedTextEditor = new textEditorModule.TextEditor(this);
            updatedPlayer = new this.Player(p.socket, p.username, p.connectionStatus);
            updatedPlayer.load(updatedPlayer.username);
            updatedPlayer.loggedIn = true;
            Object.setPrototypeOf(p, updatedPlayer.__proto__);
            Object.setPrototypeOf(p.textEditor, updatedTextEditor.__proto__);
        });

        this.ms.mudEmitter.on('playerConnected', this.playerConnectedCB);
        this.ms.mudEmitter.on('after_hotboot', this.hotBootAfterCB);
        this.ms.mudEmitter.on('before_hotboot', this.hotBootBeforeCB);
    }
};

module.exports = playerModule;