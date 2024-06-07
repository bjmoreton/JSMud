// Importing necessary modules
const fs = require('fs');
const path = require('path');
const Stat = require('./StatModule/Stat');
const { isNumber, getRandomNumberInclusive } = require('./Mud/Helpers');

/**
 * Stat module for MUD server.
 * Handles stats, including adding, editing, deleting, loading, and saving stats.
 * 
 * @module StatModule
 */
const StatModule = {
    name: "Stat",
    STATS_PATH: path.join(__dirname, '../system', 'stats.json'),
    stats: new Map(),

    /**
     * Adds a new stat to the stats list.
     * 
     * @param {Player} player - The player adding the stat.
     * @param {Array<string>} args - Stat arguments (name, short name).
     */
    addStat(player, args) {
        const [name, shortName] = args;
        if (!name || !shortName) {
            player.send(`Usage: addStat [name] [shortname]`);
            return;
        }

        if (StatModule.hasStat(name)) {
            player.send(`Stat ${name} already exists!`);
            return;
        }

        if (StatModule.hasStat(shortName)) {
            player.send(`Stat ${shortName} already exists!`);
            return;
        }

        const stat = new Stat(name, shortName);
        StatModule.stats.set(name.toLowerCase(), stat);
        player.send(`Stat ${name} added successfully!`);
    },

    /**
     * Edits the stat addition of an item rarity.
     * 
     * @param {Player} player - The player executing the command.
     * @param {Object} rarity - The rarity being edited.
     * @param {Object} eventObj - The event object containing command arguments.
     * @returns {boolean} - Indicates whether the action was handled successfully.
     */
    editItemRarityStatBonus(player, rarity, eventObj) {
        const [rarityStr, editWhat, value, ...data] = eventObj.args;

        if (!value || !isNumber(value)) {
            player.send(`Value needs to be a valid number!`);
            eventObj.saved = false;
            return false;
        }

        rarity.statBonus = Number(value);
        return true;
    },

    /**
     * Retrieves a stat by its name or short name.
     * 
     * @param {string|object} statName - Stat name or stat object.
     * @returns {Stat|null} - The stat object if found, null otherwise.
     */
    getStat(statName) {
        if (statName.name) statName = statName.name;

        const statNameLower = statName.toLowerCase();

        for (const stat of StatModule.stats.values()) {
            if (stat.name.toLowerCase() === statNameLower ||
                stat.shortName.toLowerCase() === statNameLower) {
                return stat;
            }
        }

        return null;
    },

    /**
     * Retrieves all stats as a comma-separated string of stat short names.
     * 
     * @returns {Array<string>} - Array of stat short names in lowercase.
     */
    getStats() {
        const entries = Array.from(StatModule.stats.entries());
        const returnArray = [];

        for (let i = 0; i < entries.length; i += 4) {
            const batch = entries.slice(i, i + 4);
            const batchStr = batch.map(([key, value]) => `${value.shortName} - ${value.name}`).join(', ');
            returnArray.push(batchStr);
        }

        return returnArray;
    },

    /**
     * Checks if a stat exists by its name or short name.
     * 
     * @param {string|object} statName - Stat name or stat object.
     * @returns {boolean} - True if the stat exists, false otherwise.
     */
    hasStat(statName) {
        if (statName.name) statName = statName.name;

        const statNameLower = statName.toLowerCase();

        return Array.from(StatModule.stats.values()).some(stat =>
            stat.name.toLowerCase() === statNameLower ||
            stat.shortName.toLowerCase() === statNameLower
        );
    },

    /**
     * Initializes the StatModule.
     * 
     * @param {Object} mudServer - The MUD server instance.
     */
    init: function (mudServer) {
        global.StatModule = this;
        this.mudServer = mudServer;
        this.registerEvents();
    },

    /**
     * Loads stats from the JSON file.
     * 
     * @param {Player} [player] - The player loading the stats (optional).
     */
    load(player) {
        try {
            const data = fs.readFileSync(StatModule.STATS_PATH, 'utf8');
            const statsData = JSON.parse(data);

            statsData.forEach(stat => {
                const statObj = Stat.deserialize(stat);
                StatModule.stats.set(statObj.name.toLowerCase(), statObj);
            });
            console.log("Stats loaded successfully.");
            if (player) player.send("Stats loaded successfully.");

            global.ItemModule.addEditItemAction('stats', [`edititem [vNum] stats <add | edit | remove> [stat] [value]`], StatModule.editStats);
            global.ItemModule.addEditItemRarityAction('statbonus', 'edititemrarity [rarity] statbonus [value]', StatModule.editItemRarityStatBonus);
        } catch (err) {
            console.error('Error reading or parsing JSON file:', err);
            if (player) player.send("Failed to load stats.");
        }
    },

    onHotBootAfter(player) {

    },

    onHotBootBefore() {
        StatModule.removeEvents();
    },

    /**
     * Handles item creation by adjusting item stats based on rarity.
     * 
     * @param {Item} item - The item being created.
     * @param {Item} updatedItem - The updated version of the item being created.
     */
    onCreatedItem(player, item, updatedItem) {
        item.stats = {};

        if (updatedItem) {
            for (const statId in updatedItem.stats) {
                item.stats[statId] = updatedItem.stats[statId].copy();
            }
        }

        for (const statId in item.stats) {
            const stat = item.stats[statId];
            const newValue = stat.originalValue + (stat.originalValue * item.rarity.statBonus);
            stat.value = newValue;
        }
    },

    /**
     * Handles item editing for stats.
     * 
     * @param {Player} player - The player editing the item.
     * @param {Item} item - The item being edited.
     * @param {Object} eventObj - The event object containing arguments.
     */
    editStats(player, item, eventObj) {
        const [vNum, editWhat, action, ...data] = eventObj.args;
        switch (editWhat?.toLowerCase()) {
            case 'stats':
                const [stat, value] = data;
                if (!action) {
                    eventObj.saved = false;
                    player.send(`Usage: edititem ${vNum} stats <add | edit | remove> [stat] [value]`);
                    return false;
                }
                switch (action.toLowerCase()) {
                    case 'add':
                        if (stat && StatModule.hasStat(stat)) {
                            const statObj = StatModule.getStat(stat);
                            if (!item.stats) item.stats = {};
                            item.stats[statObj.name.toLowerCase()] = statObj.copy();
                            if (!isNumber(value)) {
                                eventObj.saved = false;
                                player.send(`Must provide valid number value!`);
                                return false;
                            }
                            item.stats[statObj.name.toLowerCase()].originalValue = Number(value);
                            return true;
                        } else {
                            eventObj.saved = false;
                            player.send(`Must provide a valid stat!`);
                            player.send(`Valid Options:`);
                            StatModule.getStats().forEach(stats => {
                                player.send(stats);
                            });
                            return false;
                        }
                    case 'edit':
                        if (stat && StatModule.hasStat(stat)) {
                            if (!item.stats) {
                                eventObj.saved = false;
                                player.send(`Item ${item.displayString} doesn't have any stats!`);
                                return false;
                            }
                            const statObj = StatModule.getStat(stat);
                            const editStat = item.stats[statObj.name.toLowerCase()];
                            if (!editStat) {
                                eventObj.saved = false;
                                player.send(`Item ${item.displayString} doesn't have stat ${stat}!`);
                                return false;
                            }
                            if (!isNumber(value)) {
                                eventObj.saved = false;
                                player.send(`Must provide valid number value!`);
                                return false;
                            }
                            item.stats[statObj.name.toLowerCase()].originalValue = Number(value);
                            return true;
                        } else {
                            eventObj.saved = false;
                            player.send(`Must provide a valid stat!`);
                            player.send(`Valid Options:`);
                            StatModule.getStats().forEach(stats => {
                                player.send(stats);
                            });
                            return false;
                        }
                    case 'remove':
                        if (stat && StatModule.hasStat(stat)) {
                            const statObj = StatModule.getStat(stat);
                            delete item.stats[statObj.name.toLowerCase()];
                        } else {
                            eventObj.saved = false;
                            player.send(`Must provide a valid stat!`);
                            player.send(`Valid Options:`);
                            StatModule.getStats().forEach(stats => {
                                player.send(stats);
                            });
                            return false;
                        }
                        break;
                }
                break;
            default:
                player.send(`Usage: edititem ${vNum} stats <add | remove> [stat] [value]`);
                return false;
        }
    },

    /**
     * Handles item deserialization for stats.
     * 
     * @param {Player} player - The player deserializing the item.
     * @param {Item} item - The item being deserialized.
     * @param {Object} data - The serialized data.
     */
    onItemDeserialized(player, item, data) {
        if (data.stats) {
            if (!item.stats) item.stats = {};
            const stats = data.stats;
            for (const key in stats) {
                const stat = stats[key];
                if (StatModule.hasStat(stat.name)) {
                    item.stats[stat.name.toLowerCase()] = Stat.deserialize(stat);
                }
            }
        }
    },

    onPlayerLoaded(player, playerData) {

    },

    onPlayerSaved(player, playerData) {

        return playerData;
    },

    /**
     * Registers event listeners for the module.
     */
    registerEvents() {
        StatModule.mudServer.on('createdItem', StatModule.onCreatedItem);
        StatModule.mudServer.on('hotBootAfter', StatModule.onHotBootAfter);
        StatModule.mudServer.on('hotBootBefore', StatModule.onHotBootBefore);
        StatModule.mudServer.on('itemDeserialized', StatModule.onItemDeserialized);
        StatModule.mudServer.on('playerLoaded', StatModule.onPlayerLoaded);
        StatModule.mudServer.on('playerSaved', StatModule.onPlayerSaved);
        StatModule.mudServer.on('syncedItem', StatModule.onCreatedItem);
    },

    /**
     * Removes event listeners for the module.
     */
    removeEvents() {
        StatModule.mudServer.off('createdItem', StatModule.onCreatedItem);
        StatModule.mudServer.off('hotBootAfter', StatModule.onHotBootAfter);
        StatModule.mudServer.off('hotBootBefore', StatModule.onHotBootBefore);
        StatModule.mudServer.off('itemDeserialized', StatModule.onItemDeserialized);
        StatModule.mudServer.off('playerLoaded', StatModule.onPlayerLoaded);
        StatModule.mudServer.off('playerSaved', StatModule.onPlayerSaved);
        StatModule.mudServer.off('syncedItem', StatModule.onCreatedItem);
    },

    /**
     * Removes a stat from the stats list.
     * 
     * @param {Player} player - The player removing the stat.
     * @param {Array<string>} args - Stat arguments (name).
     */
    removeStat(player, args) {
        const [stat] = args;
        if (!stat) {
            player.send(`Usage: removestat stat`);
            return;
        }
        if (StatModule.hasStat(stat)) {
            const statObj = StatModule.getStat(stat);
            StatModule.stats.delete(statObj.name.toLowerCase());
            player.send(`Stat ${stat} removed successfully.`);
        } else player.send(`Stat ${stat} not found!`);
    },

    /**
     * Saves the current stats to the JSON file.
     * 
     * @param {Player} [player] - The player saving the stats (optional).
     */
    save(player) {
        try {
            const serializedData = StatModule.serializeStats();
            fs.writeFileSync(StatModule.STATS_PATH, JSON.stringify(serializedData, null, 2), 'utf8');

            console.log("Stats saved successfully.");
            if (player) player.send("Stats saved successfully.");
        } catch (error) {
            console.error("Failed to save stats:", error);
            if (player) player.send("Failed to save stats.");
        }
    },

    /**
     * Serializes the current stats to an array of stat objects.
     * 
     * @returns {Array<Object>} - Array of serialized stat objects.
     */
    serializeStats() {
        const statsArray = [];
        for (const [name, data] of StatModule.stats.entries()) {
            const statData = {
                ...data.serialize()
            };
            statsArray.push(statData);
        }
        return statsArray;
    },

    /**
     * Displays the current stats to the player.
     * 
     * @param {Player} player - The player to display the stats to.
     */
    showStats(player) {
        player.send(`Current stats:`);
        StatModule.getStats().forEach(stats => {
            player.send(stats);
        });
    }
};

module.exports = StatModule;
