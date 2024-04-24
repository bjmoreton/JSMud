const fs = require('fs');
const path = require('path');
const { parseColors } = require('../Color.js');
const loginModule = require('./loginModule.js');

const playerModule = {
    name: "Players",
    Player: class Player {
        Permission_Groups = {
            SuperAdmin: 'SuperAdmin',
            Admin: 'Admin',
            Moderator: 'Moderator',
            Builder: 'Builder',
            Player: 'Player'
        }

        constructor(socket, username) {
            this.socket = socket;
            this.username = username;
            this.permissions = [];
            this.perm_group = this.Permission_Groups.Player;
        }

        destroy() {
            this.socket.destroy();
        }

        disconnect(save) {
            if (save === true) this.save();
            this.socket.end();
        }

        getFilePath(username) {
            return path.join(__dirname, '../players', username.charAt(0).toLowerCase(), `${username.toLowerCase()}.json`);
        }

        hasPermission(perm) {
            return this.permissions.includes(perm);
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

        isAdmin() {
            return this.perm_group == this.Permission_Groups.SuperAdmin || this.perm_group == this.Permission_Groups.Admin;
        }

        isBuilder() { return this.perm_group == this.Permission_Groups.Builder || this.perm_group == this.Permission_Groups.SuperAdmin || this.perm_group == this.Permission_Groups.Admin }

        isModerator() { return this.perm_group == this.Permission_Groups.Moderator || this.perm_group == this.Permission_Groups.SuperAdmin || this.perm_group == this.Permission_Groups.Admin }

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

        save() {
            // Exclude the properties you want to ignore
            const { socket, send, connectionStatus, Permission_Groups, ...playerData } = this;
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
            this.socket.write(`${parseColors(message)}\r\n`);
        }
    },
    playerConnectedCB: (socket) => {
        const player = new playerModule.Player(socket, 'Guest');
        playerModule.ms.players.set(socket, player);

        playerModule.ms.mudEmitter.emit('handleLogin', player, "");

        player.socket.on('data', data => {
            data = data.toString().replace("\r\n", "");
            const command = data.toString().trim();
            if (player.connectionStatus == loginModule.ConnectionStatus.LoggedIn) playerModule.ms.mudEmitter.emit('handleCommand', player, command);
            else playerModule.ms.mudEmitter.emit('handleLogin', player, command);
        });

        player.socket.on('end', () => {
            playerModule.ms.mudEmitter.emit('playerDisconnected', player);
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
        playerModule.ms.mudEmitter.removeListener('before_hotboot', playerModule.hotBootBeforeCB);
    },
    init: function (mudServer) {
        this.ms = mudServer;

        this.ms.registerCommand('quit', (player, args) => {
            player.disconnect(true);
        });
        this.ms.registerCommand('save', (player, args) => {
            player.save();
        });
        this.ms.registerCommand('say', (player, args) => {
            const message = args.join(' ');
            this.ms.players.forEach(p => {
                if (p.username != player.username) p.send(`${player.username} says: ${message}`);
                else p.send(`You say: ${message}`);
            });
        });

        this.ms.players.forEach(p => {
            updatedPlayer = new this.Player(p.socket, p.username, p.connectionStatus);
            updatedPlayer.load(updatedPlayer.username);
            Object.setPrototypeOf(p, updatedPlayer.__proto__);
        });

        this.ms.mudEmitter.on('playerConnected', this.playerConnectedCB);
        this.ms.mudEmitter.on('before_hotboot', this.hotBootBeforeCB);
    }
};

module.exports = playerModule;