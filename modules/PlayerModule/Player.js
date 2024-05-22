const fs = require('fs');
const path = require('path');
const { parseColors } = require('../Mud/Color.js');
const TextEditor = require('./TextEditor.js');
const Status = require('./Status.js');

/**
 * Class representing a player.
 */
class Player {
    static Statuses = new Map();
    
    /**
     * Create a player.
     * @param {Object} socket - The player's socket connection.
     * @param {string} username - The player's username.
     */
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
        this.textEditor = new TextEditor(this);
    }

    /**
     * Add commands to the player's command list.
     * @param {string[]} cmds - An array of command strings to add.
     * @returns {number} The new length of the commands array.
     */
    addCommands(cmds) {
        return this.commands.push(cmds);
    }

    /**
     * Add a status to the player's status list.
     * @param {string} statusName - The name of the status to add.
     * @returns {Status} The added status object.
     */
    addStatus(statusName) {
        const resolvedStatus = Player.stringToStatus(statusName)?.copy();
        if (resolvedStatus && !this.hasStatus(resolvedStatus.name) && Player.validStatus(resolvedStatus.name)) {
            this.statuses.set(resolvedStatus.name.toLowerCase(), resolvedStatus);
        }
        return resolvedStatus;
    }

    /**
     * Destroy the player's socket connection.
     */
    destroy() {
        this.socket.destroy();
    }

    /**
     * Disconnect the player and optionally save their data.
     * @param {boolean} save - Whether to save the player's data before disconnecting.
     */
    disconnect(save) {
        if (save === true) this.save();
        this.socket.end();
        global.mudServer.emit('playerDisconnected', this);
    }

    /**
     * Get the file path for the player's data file.
     * @returns {string} The file path.
     */
    getFilePath() {
        return path.join(__dirname, '../../players', this.username.charAt(0).toLowerCase(), `${this.username.toLowerCase()}.json`);
    }

    /**
     * Check if the player has a specific command.
     * @param {string} cmd - The command to check.
     * @returns {boolean} True if the player has the command, false otherwise.
     */
    hasCommand(cmd) {
        return this.commands.includes(cmd);
    }

    /**
     * Check if the player has specific statuses.
     * @param {string|string[]} statuses - The statuses to check.
     * @returns {boolean} True if the player has all specified statuses, false otherwise.
     */
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

    /**
     * Load the player's data from a file.
     * @returns {Player|null} The loaded player object, or null if loading failed.
     */
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
                    if (Player.validStatus(status.name)) {
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

    /**
     * Remove specific statuses from the player.
     * @param {string|string[]} statuses - The statuses to remove.
     */
    removeStatus(statuses) {
        const statusList = Array.isArray(statuses) ? statuses : statuses.toString().split(',').map(item => item.trim());
        statusList.forEach(statusName => {
            const resolvedStatus = Player.stringToStatus(statusName);
            if (resolvedStatus) {
                this.statuses.delete(resolvedStatus.name.toLowerCase());
            }
        });
    }

    /**
     * Save the player's data to a file.
     */
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

    /**
     * Send a message to the player with color parsing.
     * @param {string} message - The message to send.
     */
    send(message) {
        try {
            if (!this.hasStatus('editing')) this.socket.write(`${parseColors(message)}\r\n`);
        } catch (error) {
            console.log(`${this.username} failed to receive ${message}`);
            console.log(error);
        }
    }

    /**
     * Send a raw message to the player without color parsing.
     * @param {string} message - The message to send.
     */
    sendRAW(message) {
        try {
            this.socket.write(`${message}\r\n`);
        } catch (error) {
            console.log(`${this.username} failed to receive ${message}`);
            console.log(error);
        }
    }

    /**
     * Add a new status type to the Player class.
     * @static
     * @param {string} statusName - The name of the status.
     * @param {string} statusDescription - The description of the status.
     * @param {string} statusType - The type of the status.
     * @returns {Status} The added status object.
     */
    static addStatus(statusName, statusDescription, statusType) {
        if (!Player.Statuses.has(statusName.toLowerCase())) {
            const status = new Status(statusName, statusDescription, statusType);
            Player.Statuses.set(statusName.toLowerCase(), status);

            return status;
        }
    }

    /**
     * Check if a status is valid.
     * @static
     * @param {string} statusName - The name of the status.
     * @returns {boolean} True if the status is valid, false otherwise.
     */
    static validStatus(statusName) {
        return Player.Statuses.has(statusName.toLowerCase());
    }

    /**
     * Get a comma-separated string of player statuses in lowercase.
     * @static
     * @param {Map<string, Status>} statuses - The statuses map.
     * @returns {string} A comma-separated string of player statuses in lowercase.
     */
    static getStatusesArray(statuses) {
        return Array.from(statuses.values()).map(status => status.name.toLowerCase()).join(', ');
    }

    /**
     * Convert a status string to a status object.
     * @static
     * @param {string} statusString - The status string to convert.
     * @returns {Status|null} The status object if found, otherwise null.
     */
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
