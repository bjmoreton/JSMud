// Importing necessary modules
const fs = require('fs');
const path = require('path');
const { formatTime, isNumber } = require('./Mud/Helpers.js');
const Status = require('./StatusModule/Status.js');
const Statuses = require('./StatusModule/Statuses.js');

/**
 * Status module for MUD server.
 * Handles player and NPC statuses.
 * 
 * @module StatusModule
 */
const StatusModule = {
    STATUSES_PATH: path.join(__dirname, '../system', 'statuses.json'),
    name: "Status",

    /**
     * Adds a new status to the player statuses list.
     * 
     * @param {Player} player - The player adding the status.
     * @param {Array<string>} args - Status arguments (name, type).
     */
    async addStatus(player, args) {
        let [statusName, statusType] = args;
        try {
            if (!statusName || !statusType) {
                player.send(`Usage: addstatus [name] <buff | debuff | state>`);
                return;
            }

            if (Statuses.validStatus(statusName)) {
                player.send(`Status already exists!`);
                return;
            }

            const validStatusType = Status.validStatusType(statusType);

            if (!validStatusType) {
                player.send(`Invalid status type!`);
                return;
            }

            const status = new Status(statusName, statusType);
            Statuses.Statuses.set(statusName.toLowerCase(), status);
            player.send(`Status ${statusName} added successfully.`);
        } catch (error) {
            console.error(error);
        }
    },

    /**
     * Adds a status to a player.
     * 
     * @param {Player} player - The player adding the status.
     * @param {Array<string>} args - The arguments for the status (playerName, statusName, ticks, tickInterval).
     */
    addPlayerStatus(player, args) {
        const [playerName, statusName, ticks, tickInterval] = args;

        if (!playerName) {
            player.send(`Usage: addplayerstatus [player] [status] [ticks] [tickInterval]`);
            return;
        }

        if (!statusName) {
            player.send(`Usage: addplayerstatus ${playerName} [status] [ticks] [tickInterval]`);
            return;
        }

        if (!isNumber(ticks)) {
            player.send(`Usage: addplayerstatus ${playerName} ${statusName} [ticks] [tickInterval]`);
            return;
        }

        if (!isNumber(tickInterval)) {
            player.send(`Usage: addplayerstatus ${playerName} ${statusName} ${ticks} [tickInterval]`);
            return;
        }

        const addToPlayer = StatusModule.mudServer.findPlayerByUsername(playerName);
        if (!addToPlayer) {
            player.send(`Player ${playerName} not found!`);
            return;
        }

        const statusToAdd = Statuses.stringToStatus(statusName).copy();
        if (!statusToAdd) {
            player.send(`Status ${statusName} doesn't exist!`);
            return;
        }

        statusToAdd.ticks = parseInt(ticks);
        statusToAdd.tickInterval = parseInt(tickInterval);

        addToPlayer.statuses.addStatus(statusToAdd);
        player.send(`Added status ${statusToAdd.name} to ${addToPlayer.username} successfully.`);
    },

    /**
     * Edits an existing status.
     * 
     * @param {Player} player - The player editing the status.
     * @param {Array<string>} args - The arguments for the edit (statusName, editWhat, ...data).
     */
    async editStatus(player, args) {
        const [statusName, editWhat, ...data] = args;
        if (!statusName) {
            player.send(`Usage: editStatus [status] <duration | tickinterval> [value]`);
            player.send(`Usage: editStatus [status] <action | got | gotseen | look | lost | lostseen>`);
            return;
        }
        const status = Statuses.stringToStatus(statusName);

        if (status) {
            switch (editWhat?.toLowerCase()) {
                case 'action':
                    const actionCode = await player.textEditor.startEditing(status.action?.toString());
                    status.actionCode = actionCode;
                    status.action = new Function('target', status.actionCode);
                    break;
                case 'got':
                    const gotDescription = await player.textEditor.startEditing(status.gotDescription);
                    status.gotDescription = gotDescription;
                    break;
                case 'gotseen':
                    const gotSeenDescription = await player.textEditor.startEditing(status.gotSeenDescription);
                    status.gotSeenDescription = gotSeenDescription;
                    break;
                case 'look':
                    const lookDescription = await player.textEditor.startEditing(status.lookDescription);
                    status.lookDescription = lookDescription;
                    break;
                case 'lost':
                    const lostDescription = await player.textEditor.startEditing(status.lostDescription);
                    status.lostDescription = lostDescription;
                    break;
                case 'lostseen':
                    const lostSeenDescription = await player.textEditor.startEditing(status.lostSeenDescription);
                    status.lostSeenDescription = lostSeenDescription;
                    break;
                case 'ticks':
                    const [ticks] = data;
                    if (!isNumber(ticks)) {
                        player.send(`Duration needs to be a number!`);
                        return;
                    }
                    status.ticks = parseInt(ticks);
                    break;
                case 'tickinterval':
                    const [tickInterval] = data;
                    if (!isNumber(tickInterval)) {
                        player.send(`Interval needs to be a number!`);
                        return;
                    }
                    status.tickInterval = parseInt(tickInterval);
                    break;
                default:
                    player.send(`Usage: editStatus [status] <duration | interval> [value]`);
                    player.send(`Usage: editStatus [status] <action | got | gotseen | look | lost | lostseen>`);
                    return;
            }

            player.send(`Status ${status.name} updated successfully.`);
            StatusModule.updatePlayerStatuses(editWhat, status);
        } else {
            player.send(`Status ${statusName} doesn't exist!`);
        }
    },

    onLooked(player) {
        player.currentRoom.players.forEach(p => {
            if (p === player) return;
            player.send(`You see ${p.username}.`);
            for (const [name, status] of p.statuses) {
                player.send(`\t- ${status.lookDescription}`);
            }
        });
    },

    /**
     * Initializes the statuses for a new player.
     * 
     * @param {Player} player - The new player.
     */
    onNewPlayerConnected(player) {
        player.statuses = new Statuses(player);
    },

    /**
     * Loads statuses for a player.
     * 
     * @param {Player} player - The player whose statuses are being loaded.
     * @param {Object} data - The data containing the statuses.
     */
    onPlayerLoaded(player, data) {
        const statusLength = data.statuses?.length;
        player.statuses = new Statuses(player);
        if (statusLength === 0) {
            player.addStatusByName('standing');
        } else {
            data.statuses.forEach(status => {
                if (Statuses.validStatus(status.name)) {
                    const statusObj = Status.deserialize(player, status);
                    player.statuses.set(statusObj.name.toLowerCase(), statusObj);
                }
            });
        }
    },

    /**
     * Handles actions to be taken after a hot boot.
     */
    onHotBootAfter() {
        StatusModule.mudServer.players.forEach(p => {
            Object.setPrototypeOf(p.statuses, Statuses.prototype);
        });
    },

    /**
     * Handles actions to be taken before a hot boot.
     */
    onHotBootBefore() {
        StatusModule.mudServer.off('hotBootAfter', StatusModule.onHotBootAfter);
        StatusModule.mudServer.off('hotBootBefore', StatusModule.onHotBootBefore);
        StatusModule.mudServer.off('looked', StatusModule.onLooked);
        StatusModule.mudServer.off('newPlayerConnected', StatusModule.onNewPlayerConnected);
        StatusModule.mudServer.off('playerLoaded', StatusModule.onPlayerLoaded);
    },

    /**
     * Initializes the StatusModule.
     * 
     * @param {Object} mudServer - The MUD server instance.
     */
    init: function (mudServer) {
        global.StatusModule = this;
        this.mudServer = mudServer;

        this.mudServer.on('hotBootAfter', this.onHotBootAfter);
        this.mudServer.on('hotBootBefore', this.onHotBootBefore);
        this.mudServer.on('looked', this.onLooked);
        this.mudServer.on('newPlayerConnected', this.onNewPlayerConnected);
        this.mudServer.on('playerLoaded', this.onPlayerLoaded);
    },

    /**
     * Loads the StatusModule, including player statuses.
     */
    load() {
        StatusModule.loadStatuses();
    },

    /**
     * Loads player statuses from the JSON file.
     * 
     * @param {Player} [player] - The player loading the statuses (optional).
     */
    loadStatuses(player) {
        try {
            const data = fs.readFileSync(StatusModule.STATUSES_PATH, 'utf8');
            const statusesData = JSON.parse(data);
            StatusModule.mudServer.emit('statusesLoading', player);
            statusesData.forEach(status => {
                const statusObj = new Status(status.name, status.type);
                statusObj.actionCode = status.actionCode;
                if (statusObj.actionCode) statusObj.action = new Function('target', statusObj.actionCode);
                statusObj.duration = status.duration;
                statusObj.tickInterval = status.tickInterval;
                statusObj.gotDescription = status.gotDescription;
                statusObj.gotSeenDescription = status.gotSeenDescription;
                statusObj.lookDescription = status.lookDescription;
                statusObj.lostDescription = status.lostDescription;
                statusObj.lostSeenDescription = status.lostSeenDescription;
                Statuses.Statuses.set(statusObj.name.toLowerCase(), statusObj);
            });
            console.log("Statuses loaded successfully.");
            if (player) player.send("Statuses loaded successfully.");
        } catch (err) {
            console.error('Error reading or parsing JSON file:', err);
            if (player) player.send("Failed to load statuses.");
        }
    },

    /**
     * Removes a status from a player.
     * 
     * @param {Player} player - The player removing the status.
     * @param {Array<string>} args - The arguments for the status removal (playerName, statusName).
     */
    removePlayerStatus(player, args) {
        const [playerName, statusName] = args;

        if (!playerName) {
            player.send(`Usage: removeplayerstatus [player] [status]`);
            return;
        }

        if (!statusName) {
            player.send(`Usage: removeplayerstatus ${playerName} [status]`);
            return;
        }

        const removeFromPlayer = StatusModule.mudServer.findPlayerByUsername(playerName);
        if (!removeFromPlayer) {
            player.send(`Player ${playerName} not found!`);
            return;
        }

        const statusToRemove = Statuses.stringToStatus(statusName).copy();
        if (!statusToRemove) {
            player.send(`Status ${statusName} doesn't exist!`);
            return;
        }

        removeFromPlayer.statuses.removeStatus(statusToRemove);
        player.send(`Removed status ${statusToRemove.name} from ${removeFromPlayer.username} successfully.`);
    },

    /**
     * Removes a status from the player statuses list.
     * 
     * @param {Player} player - The player removing the status.
     * @param {Array<string>} args - Status arguments (name).
     */
    removeStatus(player, args) {
        const [statusName] = args;
        if (!statusName) {
            player.send(`Usage: removestatus [status]`);
            return;
        }

        if (Statuses.validStatus(statusName)) {
            Statuses.Statuses.delete(statusName.toLowerCase());
            player.send(`Status ${statusName} removed successfully.`);
        } else player.send(`Status ${statusName} not found!`);
    },

    /**
     * Saves player statuses to the JSON file.
     * 
     * @param {Player} [player] - The player saving the statuses (optional).
     */
    saveStatuses(player) {
        try {
            const serializedData = StatusModule.serializeStatuses();
            fs.writeFileSync(StatusModule.STATUSES_PATH, JSON.stringify(serializedData, null, 2), 'utf8');

            console.log("Statuses saved successfully.");
            if (player) player.send("Statuses saved successfully.");
        } catch (error) {
            console.error("Failed to save statuses:", error);
            if (player) player.send("Failed to save statuses.");
        }
    },

    /**
     * Serializes player statuses to an array of status objects.
     * 
     * @returns {Array<Object>} - Array of serialized status objects.
     */
    serializeStatuses() {
        const statusesArray = [];
        for (const [name, status] of Statuses.Statuses.entries()) {
            const statusData = {
                ...status.serialize()
            };
            statusesArray.push(statusData);
        }
        return statusesArray;
    },

    /**
     * Displays the details of a status.
     * 
     * @param {Player} player - The player requesting the status details.
     * @param {Array<string>} args - Status arguments (statusName).
     */
    showStatus(player, args) {
        const [statusName] = args;

        if (!statusName) {
            player.send(`Usage: showstatus [status]`);
            return;
        }

        const status = Statuses.stringToStatus(statusName);
        if (!status) {
            player.send(`Status ${statusName} doesn't exist!`);
            return;
        }

        player.send(`Action: ${status.action?.toString() ?? undefined}`);
        player.send(`Duration: ${status.ticks}`);
        player.send(`Tick Interval: ${status.tickInterval}`);
        player.send(`Got Description: ${status.gotDescription}`);
        player.send(`Got Seen Description: ${status.gotSeenDescription}`);
        player.send(`Look Description: ${status.lookDescription}`);
        player.send(`Lost Description: ${status.lostDescription}`);
        player.send(`Lost Seen Description: ${status.lostSeenDescription}`);
    },

    updatePlayerStatuses(updateWhat, status) {
        StatusModule.mudServer.players.forEach(p => {
            if (p.statuses.hasStatus(status.name)) {
                const pStatus = p.statuses.getStatus(status.name);

                switch (updateWhat.toLowerCase()) {
                    case 'action':
                        pStatus.actionCode = status.actionCode;
                        pStatus.action = new Function('target', status.actionCode);
                        break;
                    case 'got':
                        pStatus.gotDescription = status.gotDescription;
                        break;
                    case 'gotseen':
                        pStatus.gotSeenDescription = status.gotSeenDescription;
                        break;
                    case 'look':
                        pStatus.lookDescription = status.lookDescription;
                        break;
                    case 'lost':
                        pStatus.lostDescription = status.lostDescription;
                        break;
                    case 'lostseen':
                        pStatus.lostSeenDescription = status.lostSeenDescription;
                        break;
                    case 'ticks':
                        pStatus.ticks = status.ticks;
                        break;
                    case 'tickinterval':
                        pStatus.tickInterval = status.tickInterval;
                        break;
                }

                pStatus.startAction(p);
            }
        });
    }
};

module.exports = StatusModule;
