const fs = require('fs');
const path = require('path');
const { parseColors } = require('../Mud/Color.js');
const TextEditor = require('./TextEditor.js');
const Status = require('../StatusModule/Status.js');
const { formatDate, formatTime } = require('../Mud/Helpers.js');

/**
 * Class representing a player.
 */
class Player {
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
     * Load the player's data from a file.
     * @returns {Player|null} The loaded player object, or null if loading failed.
     */
    load() {
        try {
            const jsonFilePath = this.getFilePath();
            const playerData = fs.readFileSync(jsonFilePath, 'utf-8');
            const playerObject = JSON.parse(playerData);

            Object.assign(this, playerObject);
            this.faded = false;
            global.mudServer.emit('playerLoaded', this, playerObject);
            return this;
        } catch (err) {
            console.error('Error reading or parsing JSON file:', err);
        }

        return null;
    }

    /**
     * Save the player's data to a file.
     */
    save(output = true) {
        const currentDate = new Date();
        this.savedOn = formatDate(currentDate) + ' ' + formatTime(currentDate);
        const { socket, connectionStatus, loggedIn, textEditor, fadedTimeout, ...playerData } = this;
        playerData.statuses = Array.from(this.statuses.values()).map(status => status.serialize());
        global.mudServer.emit('playerSaved', this, playerData);
        const filePath = this.getFilePath();
        const directoryPath = path.dirname(filePath);

        if (!fs.existsSync(directoryPath)) {
            fs.mkdirSync(directoryPath, { recursive: true });
        }

        fs.writeFileSync(filePath, JSON.stringify(playerData, null, 2));
        if (output) this.send("Saved!");
    }

    /**
     * Send a message to the player with color parsing.
     * @param {string} message - The message to send.
     */
    send(message) {
        try {
            if (!this.faded) this.socket.write(`${parseColors(message)}\n`);
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
            this.socket.write(`${message}\n`);
        } catch (error) {
            console.log(`${this.username} failed to receive ${message}`);
            console.log(error);
        }
    }
}

module.exports = Player;
