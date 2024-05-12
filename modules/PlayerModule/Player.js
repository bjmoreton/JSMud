const fs = require('fs');
const path = require('path');
const { parseColors } = require('../../Utils/Color.js');
const TextEditor = require('./TextEditor.js');

class Player {
    static Statuses = {
        None: "None",
        Editing: "Editing"
    }

    textEditor = new TextEditor(this);

    addCommands(cmds) {
        return this.commands.push(cmds);
    }

    addStatus(statuses) {
        const statusList = Array.isArray(statuses) ? statuses : statuses.toString().split(',').map(s => s.trim());

        statusList.forEach(status => {
            const resolvedStatus = Player.stringToStatus(status);
            if (resolvedStatus && !this.statuses.includes(resolvedStatus) && this.validStatus(resolvedStatus)) {
                this.statuses.push(resolvedStatus);
            }
        });

        this.removeStatus(Player.Statuses.None);
    }

    constructor(socket, username) {
        this.socket = socket;
        this.username = username;
        this.commands = [];
        this.canBuild = false;
        this.loggedIn = false;
        this.modLevel = 0;
        this.statuses = [Player.Statuses.None];
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

    hasStatus(statuses) {
        // Handle different types of inputs flexibly
        let statusList;
        if (Array.isArray(statuses)) {
            statusList = statuses;
        } else {
            statusList = statuses.toString().split(',').map(item => item.trim());
        }

        // Check if every status in the list is included in the current statuses
        return statusList.every(status => {
            const resolvedStatus = Player.stringToStatus(status);
            return resolvedStatus && this.statuses.includes(resolvedStatus);
        });
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
            this.setStatus(this.statuses);

            global.mudServer.emit('playerLoaded', this, playerObject);
            return this;
        } catch (err) {
            console.error('Error reading or parsing JSON file:', err);
        }

        return null;
    }

    removeStatus(statuses) {
        const statusList = Array.isArray(statuses) ? statuses : statuses.toString().split(',').map(item => item.trim());

        // Filter out the statuses to be removed from the currentStatus array
        statusList.forEach(status => {
            const resolvedStatus = Player.stringToStatus(status);
            if (this.statuses.includes(resolvedStatus)) {
                this.statuses = this.statuses.filter(s => s !== resolvedStatus);
            }
        });

        if(this.statuses.length === 0) this.statuses.push(Player.Statuses.None);
    }

    save() {
        // Exclude the properties you want to ignore
        const { socket, send, connectionStatus, loggedIn, textEditor, currentRoom, currentArea, currentSection, ...playerData } = this;
        global.mudServer.emit('playerSaved', this, playerData);
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
            if (!this.hasStatus(Player.Statuses.Editing)) this.socket.write(`${parseColors(message)}\r\n`);
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

    setStatus(statuses) {
        this.statuses = [];
        for (const status of statuses.toString().split(',').map(item => item.trim())) {
            if (this.validStatus(status)) this.statuses.push(Player.stringToStatus(status));
        }

        if (this.statuses.length === 0) this.statuses.push(Player.Statuses.None);
    }

    validStatus(status) {
        return Object.values(Player.Statuses).includes(status);
    }

    static stringToStatus(statusString) {
        const normalizedInput = statusString.toLowerCase();
        for (const key in Player.Statuses) {
            if (key.toLowerCase() === normalizedInput) {
                return Player.Statuses[key];
            }
        }
        return null; // Return null if no matching state is found
    }
}

module.exports = Player;