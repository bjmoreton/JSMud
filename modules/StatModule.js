// Importing necessary modules
const fs = require('fs');
const path = require('path');
const Stat = require('./StatModule/Stat');
const { isNumber, getRandomNumberInclusive } = require('./Mud/Helpers');

// Stat module
const StatModule = {
    name: "Stat",
    STATS_PATH: path.join(__dirname, '../system', 'stats.json'),
    stats: new Map(),

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

    getStat(statName) {
        if (statName.name) statName = statName.name;

        // Convert statName to lowercase for case-insensitive comparison
        const statNameLower = statName.toLowerCase();

        // Iterate through the stats to find and return the stat object by name or shortName
        for (const stat of StatModule.stats.values()) {
            if (stat.name.toLowerCase() === statNameLower ||
                stat.shortName.toLowerCase() === statNameLower) {
                return stat;
            }
        }

        // If no match is found, return null or handle it as needed
        return null;
    },

    // Method to get a comma-separated string of stat short names in lowercase
    getStats() {
        // Convert the map entries to an array
        const entries = Array.from(StatModule.stats.entries());
        const returnArray = [];

        // Iterate over the entries in batches of five
        for (let i = 0; i < entries.length; i += 4) {
            // Get the current batch
            const batch = entries.slice(i, i + 4);

            // Create a string for the current batch
            const batchStr = batch.map(([key, value]) => `${value.shortName} - ${value.name}`).join(', ');
            returnArray.push(batchStr);
        }

        return returnArray;
    },

    hasStat(statName) {
        if (statName.name) statName = statName.name;

        // Convert statName to lowercase for case-insensitive comparison
        const statNameLower = statName.toLowerCase();

        // Iterate through the stats to find a match by name or shortName
        return Array.from(StatModule.stats.values()).some(stat =>
            stat.name.toLowerCase() === statNameLower ||
            stat.shortName.toLowerCase() === statNameLower
        );
    },

    init: function (mudServer) {
        global.StatModule = this;
        this.mudServer = mudServer;
        this.registerEvents();
    },

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

    onCreatedItem(player, item) {
        for (const statId in item.stats) {
            const stat = item.stats[statId];
            const [maxValue, minValue] = [stat.maxValue, stat.minValue];
            const newMax = maxValue - (maxValue * item.rarity.statReduction);
            const newMin = minValue + (minValue * item.rarity.statAddition);
            stat.value = getRandomNumberInclusive(newMin, newMax);
            console.log(stat.shortName, stat.value);
        }
    },

    onEditItem(player, item, eventObj) {
        const [vNum, editWhat, action, ...data] = eventObj.args
        switch (editWhat.toLowerCase()) {
            case 'stats':
                eventObj.handled = true;
                const [stat, ...values] = data;
                if (!action) {
                    eventObj.handled = false;
                    player.send(`Usage: editItem ${vNum} stats <add | remove> [stat] [minValue] [maxValue]`);
                    return;
                }
                switch (action.toLowerCase()) {
                    case 'add':
                        if (stat && StatModule.hasStat(stat)) {
                            const statObj = StatModule.getStat(stat);
                            if (!item.stats) item.stats = {};
                            item.stats[statObj.shortName] = statObj.copy();
                            let [minValue, maxValue] = values;
                            if (!isNumber(minValue) || !isNumber(maxValue)) {
                                eventObj.saved = false;
                                player.send(`Must provide valid numbers for minValue and maxValue!`);
                                return;
                            }
                            minValue = parseInt(minValue);
                            maxValue = parseInt(maxValue);
                            if (maxValue < minValue) {
                                eventObj.saved = false;
                                player.send(`Must provide a valid range!`);
                                return;
                            }
                            item.stats[statObj.shortName].minValue = minValue;
                            item.stats[statObj.shortName].maxValue = maxValue;
                        } else {
                            eventObj.saved = false;
                            player.send(`Must provide a valid stat!`);
                            player.send(`Valid Options:`);
                            StatModule.getStats().forEach(stats => {
                                player.send(stats);
                            });
                            return;
                        }
                        break;
                    case 'remove':
                        if (stat && StatModule.hasStat(stat)) {
                            const statObj = StatModule.getStat(stat);
                            delete item.stats[statObj.shortName];
                        } else {
                            eventObj.saved = false;
                            player.send(`Must provide a valid stat!`);
                            player.send(`Valid Options:`);
                            StatModule.getStats().forEach(stats => {
                                player.send(stats);
                            });
                            return;
                        }
                        break;
                }
                break;
            default:
                player.send(`Usage: editItem ${vNum} stats <add | remove> [stat] [minValue] [maxValue]`);
                return;
        }
    },

    onItemDeserialized(player, item, data) {
        if (data.stats) {
            if (!item.stats) item.stats = {};
            const stats = data.stats;
            for (const key in stats) {
                const stat = stats[key];
                if (StatModule.hasStat(stat.shortName)) {
                    item.stats[stat.shortName] = Stat.deserialize(stat);
                }
            }
        }
    },

    onPlayerLoaded(player, playerData) {

    },

    onPlayerSaved(player, playerData) {

        return playerData;
    },

    registerEvents() {
        StatModule.mudServer.on('createdItem', StatModule.onCreatedItem);
        StatModule.mudServer.on('editItem', StatModule.onEditItem);
        StatModule.mudServer.on('hotBootAfter', StatModule.onHotBootAfter);
        StatModule.mudServer.on('hotBootBefore', StatModule.onHotBootBefore);
        StatModule.mudServer.on('itemDeserialized', StatModule.onItemDeserialized);
        StatModule.mudServer.on('playerLoaded', StatModule.onPlayerLoaded);
        StatModule.mudServer.on('playerSaved', StatModule.onPlayerSaved);
    },

    removeEvents() {
        StatModule.mudServer.off('createdItem', StatModule.onCreatedItem);
        StatModule.mudServer.off('editItem', StatModule.onEditItem);
        StatModule.mudServer.off('hotBootAfter', StatModule.onHotBootAfter);
        StatModule.mudServer.off('hotBootBefore', StatModule.onHotBootBefore);
        StatModule.mudServer.off('itemDeserialized', StatModule.onItemDeserialized);
        StatModule.mudServer.off('playerLoaded', StatModule.onPlayerLoaded);
        StatModule.mudServer.off('playerSaved', StatModule.onPlayerSaved);
    },

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
        } else player.send(`Stat ${stat} not found!`)
    },

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

    showStats(player) {
        player.send(`Current stats:`);
        StatModule.getStats().forEach(stats => {
            player.send(stats);
        });
    }
}

module.exports = StatModule;