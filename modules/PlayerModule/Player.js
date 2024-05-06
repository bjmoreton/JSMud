const fs = require('fs');
const path = require('path');
const { parseColors } = require('../../Utils/Color.js');
const TextEditor = require('./TextEditor.js');
const Inventory = require('../InventoryModule/Inventory.js');

class Player {
    Statuses = {
        None: 0,
        Editing: 1 << 0
    }

    textEditor = new TextEditor(this);

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
        this.workingArea = '';
        this.workingSection = '';
    }

    destroy() {
        this.socket.destroy();
    }

    disconnect(save) {
        if (save === true) this.save();
        this.socket.end();
    }

    getFilePath() {
        return path.join(__dirname, '../../players', this.username.charAt(0).toLowerCase(), `${this.username.toLowerCase()}.json`);
    }

    hasCommand(cmd) {
        return this.commands.includes(cmd);
    }

    hasStatus(status) {
        return this.statuses && status;
    }

    load() {
        try {
            // Read the JSON file synchronously
            const jsonFilePath = this.getFilePath();
            const playerData = fs.readFileSync(jsonFilePath, 'utf-8');

            // Parse the JSON data
            const playerObject = JSON.parse(playerData);

            // Assign the player data to the player object
            Object.assign(this, playerObject);
            if(this.inventory !== undefined) this.inventory = Inventory.deserialize(this, JSON.stringify(playerObject.inventory), playerObject.inventory.maxSize);
            return this;
        } catch (err) {
            console.error('Error reading or parsing JSON file:', err);
        }

        return null;
    }

    removeStatus(status) {
        this.statuses &= ~status;
    }

    save() {
        // Exclude the properties you want to ignore
        const { socket, send, connectionStatus, loggedIn, Statuses, textEditor, currentRoom, ...playerData } = this;
        playerData.inventory = this.inventory.serialize();
        const filePath = this.getFilePath();
        // Generate the directory path
        const directoryPath = path.dirname(filePath);

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
            if (!this.hasStatus(this.Statuses.Editing)) this.socket.write(`${parseColors(message)}\r\n`);
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
}

module.exports = Player;