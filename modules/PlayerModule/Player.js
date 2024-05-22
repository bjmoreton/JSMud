const fs = require('fs');
const path = require('path');
const { parseColors } = require('../Mud/Color.js');
const TextEditor = require('./TextEditor.js');
const Status = require('./Status.js');

class Player {
    static Statuses = new Map();

    textEditor = new TextEditor(this);

    addCommands(cmds) {
        return this.commands.push(cmds);
    }

    static addStatus(statusName, statusDescription, statusType) {
        if (!Player.Statuses.has(statusName.toLowerCase())) {
            const status = new Status(statusName, statusDescription, statusType);
            Player.Statuses.set(statusName.toLowerCase(), status);

            return status;
        }
    }

    addStatus(statusName) {
        const resolvedStatus = Player.stringToStatus(statusName)?.copy();
        if (resolvedStatus && !this.hasStatus(resolvedStatus.name) && Player.validStatus(resolvedStatus.name)) {
            this.statuses.set(resolvedStatus.name.toLowerCase(), resolvedStatus);
        }
        return resolvedStatus;
    }

    constructor(socket, username) {
        this.socket = socket;
        this.username = username;
        this.commands = [];
        this.canBuild = false;
        this.loggedIn = false;
        this.modLevel = 0;
        this.statuses = new Map();
        this.workingArea = '';
        this.workingSection = '';
    }

    destroy() {
        this.socket.destroy();
    }

    disconnect(save) {
        if (save === true) this.save();
        this.socket.end();
        global.mudServer.emit('playerDisconnected', this);
    }

    getFilePath() {
        return path.join(__dirname, '../../players', this.username.charAt(0).toLowerCase(), `${this.username.toLowerCase()}.json`);
    }

    hasCommand(cmd) {
        return this.commands.includes(cmd);
    }

    hasStatus(statuses) {
        let statusList;
        if (Array.isArray(statuses)) {
            statusList = statuses;
        } else {
            statusList = statuses.toString().split(',').map(item => item.trim());
        }

        return statusList.every(statusName => {
            const resolvedStatus = Player.stringToStatus(statusName);
            return resolvedStatus && this.statuses.has(resolvedStatus.name.toLowerCase());
        });
    }

    load() {
        try {
            const jsonFilePath = this.getFilePath();
            const playerData = fs.readFileSync(jsonFilePath, 'utf-8');
            const playerObject = JSON.parse(playerData);

            Object.assign(this, playerObject);
            const statusLength = this.statuses.length;
            this.statuses = new Map();
            if (statusLength === 0) {
                this.addStatus('standing');
            } else {
                playerObject.statuses.forEach(status => {
                    if(Player.validStatus(status.name)) {
                        const statusObj = Status.deserialize(status);
                        this.statuses.set(statusObj.name.toLowerCase(), statusObj);
                    }
                });
            }

            global.mudServer.emit('playerLoaded', this, playerObject);
            return this;
        } catch (err) {
            console.error('Error reading or parsing JSON file:', err);
        }

        return null;
    }

    removeStatus(statuses) {
        const statusList = Array.isArray(statuses) ? statuses : statuses.toString().split(',').map(item => item.trim());
        statusList.forEach(statusName => {
            const resolvedStatus = Player.stringToStatus(statusName);
            if (resolvedStatus) {
                this.statuses.delete(resolvedStatus.name.toLowerCase());
            }
        });
    }

    save() {
        const { socket, connectionStatus, loggedIn, textEditor, currentRoom, currentArea, currentSection, ...playerData } = this;
        playerData.statuses = Array.from(this.statuses.values()).map(status => status.serialize());
        global.mudServer.emit('playerSaved', this, playerData);
        const filePath = this.getFilePath();
        const directoryPath = path.dirname(filePath);

        if (!fs.existsSync(directoryPath)) {
            fs.mkdirSync(directoryPath, { recursive: true });
        }

        fs.writeFileSync(filePath, JSON.stringify(playerData, null, 2));
        this.send("Saved!");
    }

    send(message) {
        try {
            if (!this.hasStatus('editing')) this.socket.write(`${parseColors(message)}\r\n`);
        } catch (error) {
            console.log(`${this.username} failed to receive ${message}`);
            console.log(error);
        }
    }

    sendRAW(message) {
        try {
            this.socket.write(`${message}\r\n`);
        } catch (error) {
            console.log(`${this.username} failed to receive ${message}`);
            console.log(error);
        }
    }

    static validStatus(statusName) {
        return Player.Statuses.has(statusName.toLowerCase());
    }

    /**
     * Method to get a comma-separated string of player statuses in lowercase
     * @returns {string} A comma-separated string of player statuses in lowercase
     */
    static getStatusesArray(statuses) {
        return Array.from(statuses.values()).map(status => status.name.toLowerCase()).join(', ');
    }

    static stringToStatus(statusString) {
        const normalizedInput = statusString.toLowerCase();
        for (const status of Player.Statuses.values()) {
            if (status.name.toLowerCase() === normalizedInput) {
                return status;
            }
        }
        return null;
    }
}

module.exports = Player;
