const fs = require('fs');
const path = require('path');
const { formatTime } = require('./Mud/Helpers.js');
const Player = require('./PlayerModule/Player.js');
const Status = require('./PlayerModule/Status.js');
const TextEditor = require('./PlayerModule/TextEditor.js');

const PlayerModule = {
    STATUSES_PATH: path.join(__dirname, '../system', 'statuses.json'),
    name: "Player",

    async addStatus(player, args) {
        let [statusName, statusType] = args;
        try {
            if (!statusName || !statusType) {
                player.send(`Usage: addstatus name <buff | debuff | state>`);
                return;
            }

            if (Player.validStatus(statusName)) {
                player.send(`Status already exist!`);
                return;
            }

            statusType = Status.validStatusType(statusType);

            if (!statusType) {
                player.send(`Invalid status type!`);
                return;
            }

            const description = await player.textEditor.startEditing('');
            if (!description && description?.trim() === '') {
                player.send('Invalid status description!');
                return;
            }

            Player.addStatus(statusName, description, statusType);
            player.send(`Status ${statusName} added successfully.`);
        } catch (error) {
            console.error(error);
        }
    },

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
        PlayerModule.mudServer.off('hotBootAfter', PlayerModule.onHotBootAfter);
        PlayerModule.mudServer.off('hotBootBefore', PlayerModule.onHotBootBefore);
        PlayerModule.mudServer.off('playerConnected', PlayerModule.onPlayerConnected);
        PlayerModule.mudServer.off('sendToAll', PlayerModule.onSendToAll);
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

    load() {
        PlayerModule.loadStatuses();
    },

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

    playerQuit(player) {
        player?.disconnect(true);
    },

    playerSave(player) {
        player?.save();
    },

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

    saveAllPlayers() {
        PlayerModule.mudServer.players.forEach(p => {
            if (!p.loggedIn) {
                p.disconnect(false);
                return;
            }
            p.save();
        });
    },

    saveStatuses(player) {
        try {
            const serializedData = PlayerModule.serializeStatuses(Player.Statuses);
            fs.writeFileSync(PlayerModule.STATUSES_PATH, JSON.stringify(serializedData, null, 2), 'utf8');
            console.log("Statuses saved successfully.");
            if (player) player.send("Statuses saved successfully.");
        } catch (error) {
            console.error("Failed to save items:", error);
            if (player) player.send("Failed to save statuses.");
        }
    },

    serializeStatuses() {
        const statusesArray = [];
        for (const [name, status] of Player.Statuses.entries()) {
            const statusData = {
                ...status.serialize()
            };
            statusesArray.push(statusData);
        }
        return statusesArray; // Pretty-print the JSON
    },
};

module.exports = PlayerModule;