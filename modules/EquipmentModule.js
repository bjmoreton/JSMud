// Importing necessary modules
const fs = require('fs');
const path = require('path');
const EquipmentSlot = require('./EquipmentModule/EquipmentSlot');
const Item = require('./ItemModule/Item');
const { isNumber, stringToBoolean } = require('./Mud/Helpers');
const Equipment = require('./EquipmentModule/Equipment');

/**
 * Equipment module for managing equipment slots and item equipment in the MUD server.
 * 
 * @module EquipmentModule
 */
const EquipmentModule = {
    // Module name
    name: "Equipment",
    // Path to the equipment slots JSON file
    EQ_SLOTS_PATH: path.join(__dirname, '../system', 'eqslots.json'),
    // Map to store equipment slots
    equipmentSlots: new Map(),

    /**
     * Add a new equipment slot.
     * 
     * @param {Player} player - The player adding the equipment slot.
     * @param {Array} args - The arguments for adding the equipment slot.
     */
    addEquipmentSlot(player, args) {
        const [name, eqType, layers] = args;
        if (!name) {
            player.send(`Usage: addEquipmentSlot name eqType layers`);
            return;
        }

        if (!Item.stringToItemType(eqType)) {
            player.send(`Invalid Equipment type!`);
            player.send(`Valid types:`);
            Item.getItemTypesArray().forEach(type => {
                player.send(type)
            });
            return;
        }

        if (!layers || !isNumber(layers)) {
            player.send(`Layers needs to be a number!`);
            return;
        }

        if (!EquipmentModule.hasEquipmentSlot(name)) {
            const eqSlot = new EquipmentSlot(name, eqType, layers);
            EquipmentModule.equipmentSlots.set(name.toLowerCase(), eqSlot);
            player.send(`Equipment slot ${name} added successfully!`);
        } else {
            player.send(`Equipment slot ${name} already exists!`);
        }
    },

    /**
     * Get formatted equipment slots.
     * 
     * @returns {Array} - Array of formatted equipment slot strings.
     */
    getFormattedEquipmentSlots() {
        const keys = Array.from(this.equipmentSlots.keys());
        let result = '';

        for (let i = 0; i < keys.length; i++) {
            result += keys[i];
            if ((i + 1) % 5 === 0 && i !== keys.length - 1) {
                result += ',\n';
            } else if (i !== keys.length - 1) {
                result += ', ';
            }
        }

        return result.split('\n');
    },

    /**
     * Edit an existing equipment slot.
     * 
     * @param {Player} player - The player editing the equipment slot.
     * @param {Array} args - The arguments for editing the equipment slot.
     */
    editEquipmentSlot(player, args) {
        const [slot, editWhat, ...data] = args;
        if (!slot) {
            player.send(`Usage: editequipmentslot [slot] <display> [value]`);
        }

        if (EquipmentModule.hasEquipmentSlot(slot)) {
            const slotObj = EquipmentModule.equipmentSlots.get(slot.toLowerCase());
            switch (editWhat?.toLowerCase()) {
                case 'display':
                    const value = data.join(' ');
                    slotObj.displayString = value;
                    EquipmentModule.mudServer.players.forEach(p => {
                        p.eqSlots[slotObj.name.toLowerCase()].displayString = value;
                    });
                    break;
                default:
                    player.send(`Usage: editequipmentslot [slot] <display> [value]`);
                    return;
            }
        } else {
            player.send(`Slot ${slot} doesn't exist!`);
            return;
        }

        player.send(`Equipment slot saved successfully.`);
    },

    /**
     * Check if an equipment slot exists.
     * 
     * @param {string} slotName - The name of the slot.
     * @returns {boolean} - True if the slot exists, false otherwise.
     */
    hasEquipmentSlot(slotName) {
        if (slotName.name) slotName = slotName.name;

        return EquipmentModule.equipmentSlots.has(slotName.toLowerCase());
    },

    /**
     * Initialize the Equipment module.
     * 
     * @param {Object} mudServer - The MUD server instance.
     */
    init: function (mudServer) {
        global.EquipmentModule = this;
        this.mudServer = mudServer;
        this.registerEvents();
    },

    /**
     * Load equipment slots from the JSON file.
     * 
     * @param {Player} [player] - The player (optional).
     */
    load(player) {
        try {
            const data = fs.readFileSync(EquipmentModule.EQ_SLOTS_PATH, 'utf8');
            const eqSlotsData = JSON.parse(data);
            EquipmentModule.mudServer.emit('equipmentSlotsLoading', player);
            eqSlotsData.forEach(eqSlot => {
                const eqSlotObj = EquipmentSlot.deserialize(eqSlot);
                EquipmentModule.equipmentSlots.set(eqSlotObj.name.toLowerCase(), eqSlotObj);
            });
            console.log("Equipment slots loaded successfully.");
            if (player) player.send("Equipment slots loaded successfully.");
        } catch (err) {
            console.error('Error reading or parsing JSON file:', err);
            if (player) player.send("Failed to load equipment slots.");
        }
    },

    /**
     * Event handler for editing an item.
     * 
     * @param {Player} player - The player editing the item.
     * @param {Item} item - The item being edited.
     * @param {Object} eventObj - The event object.
     */
    onEditItem(player, item, eventObj) {
        const [vNum, editWhat, action, ...data] = eventObj.args;
        switch (editWhat.toLowerCase()) {
            case 'layer':
                if (!isNumber(action)) {
                    eventObj.saved = false;
                    player.send(`Usage: editItem ${vNum} layer [layer]`);
                    return false;
                }
                eventObj.handled = true;
                const layer = parseInt(action);
                item.layer = layer;
                break;
            case 'type':
                if (!action) {
                    player.send(`Usage: edititem ${vNum} type [type]`);
                    return false;
                }

                if (!item.types) item.types = [];
                switch (action.toLowerCase()) {
                    case 'add':
                        const types = data;
                        types.forEach(type => {
                            if (EquipmentModule.equipmentSlots.has(type.toLowerCase())) {
                                item.types.push(type.toLowerCase());
                            }
                        });
                        break;
                    case 'remove':
                        types.forEach(type => {
                            const index = item.types.indexOf(type.toLowerCase());
                            if (index > -1) {
                                item.types.splice(index, 1);
                            }
                        });
                        break;
                    default:
                        return false;
                }
                break;
            case 'wearable':
                if (!action) {
                    eventObj.saved = false;
                    player.send(`Usage: editItem ${vNum} wearable true/false`);
                    return false;
                }
                eventObj.handled = true;
                const wearable = stringToBoolean(action);
                if (wearable) {
                    item.wearable = wearable;
                }
                break;
            default:
                eventObj.saved = false;
                return false;
        }

        return true;
    },

    onHotBootAfter(player) {
        // Placeholder for hot boot after event handling
    },

    /**
     * Event handler for hot boot before.
     */
    onHotBootBefore() {
        EquipmentModule.removeEvents();
    },

    /**
     * Event handler for items loading.
     */
    onItemsLoading() {
        // Add weapon item type, etc.
        Item.addItemType(Equipment);

        // Define item rarities
        Item.ItemRarities['trash'].statReduction = .9;
        Item.ItemRarities['quest'].statReduction = 1;
        Item.ItemRarities['trash'].statAddition = 0;
        Item.ItemRarities['quest'].statAddition = 1;
        Item.addItemRarities(
            { name: "common", statAddition: .2, statReduction: .8, symbol: "[C]", weight: 8 },
            { name: "uncommon", statAddition: .4, statReduction: .6, symbol: "[UC]", weight: 6 },
            { name: "rare", statAddition: .6, statReduction: .4, symbol: "[R]", weight: 4 },
            { name: "epic", statAddition: .8, statReduction: .2, symbol: "[E]", weight: 2 },
            { name: "Legendary", statAddition: 1, statReduction: 0, symbol: "[L]", weight: 1 }
        );
    },

    /**
     * Event handler for player loaded.
     * 
     * @param {Player} player - The loaded player.
     * @param {Object} playerData - The player data.
     */
    onPlayerLoaded(player, playerData) {
        if (!player.eqSlots) player.eqSlots = {};
        for (const eqSlot in playerData.eqSlots) {
            const slot = playerData.eqSlots[eqSlot];
            if (EquipmentModule.hasEquipmentSlot(slot.name)) {
                const slotObj = EquipmentSlot.deserialize(slot);
                if (slotObj) player.eqSlots[slotObj.name.toLowerCase()] = slotObj;
            } else {
                // Remove items from data back into inventory.
            }
        }

        EquipmentModule.updatePlayerSlots(player);
    },

    /**
     * Event handler for player saved.
     * 
     * @param {Player} player - The player being saved.
     * @param {Object} playerData - The player data.
     * @returns {Object} - The updated player data.
     */
    onPlayerSaved(player, playerData) {
        playerData.eqSlots = {};
        for (const key in player.eqSlots) {
            playerData.eqSlots[key] = player.eqSlots[key].serialize();
        }
        return playerData;
    },

    /**
     * Register events for the Equipment module.
     */
    registerEvents() {
        EquipmentModule.mudServer.on('editItem', EquipmentModule.onEditItem);
        EquipmentModule.mudServer.on('hotBootBefore', EquipmentModule.onHotBootAfter);
        EquipmentModule.mudServer.on('hotBootBefore', EquipmentModule.onHotBootBefore);
        EquipmentModule.mudServer.on('itemsLoading', EquipmentModule.onItemsLoading);
        EquipmentModule.mudServer.on('playerLoaded', EquipmentModule.onPlayerLoaded);
        EquipmentModule.mudServer.on('playerSaved', EquipmentModule.onPlayerSaved);
    },

    /**
     * Remove an item or equipment slot.
     * 
     * @param {Player} player - The player removing the item/slot.
     * @param {Array} args - The arguments for removal.
     * @returns {boolean} - True if removal was successful, false otherwise.
     */
    remove(player, args) {
        let [itemOrSlotString] = args;

        if (!itemOrSlotString) {
            player.send(`Remove what?`);
            return false;
        }

        const parsePattern = /^(\d+)\.(.*)$/;
        let itemMatch = itemOrSlotString?.match(parsePattern);

        let itemIndex = itemMatch ? parseInt(itemMatch[1], 10) - 1 : 0; // Convert to zero-based index
        let itemName = itemMatch ? itemMatch[2].trim() : itemOrSlotString.trim();

        // Check if the argument is an equipment slot
        const slotName = itemOrSlotString.toLowerCase();
        if (player.eqSlots[slotName] && player.eqSlots[slotName].items instanceof Map) {
            let highestLayeredItem = null;
            let highestLayer = -Infinity;
            let mapKeyToRemove = null;

            player.eqSlots[slotName].items.forEach((item, mapKey) => {
                if (item.layer > highestLayer) {
                    highestLayeredItem = item;
                    highestLayer = item.layer;
                    mapKeyToRemove = mapKey;
                }
            });

            if (highestLayeredItem && mapKeyToRemove !== null) {
                const unequipped = player.eqSlots[slotName].unequip(highestLayeredItem);
                if (unequipped === true) {
                    if (player.inventory.addItem(highestLayeredItem.vNum, highestLayeredItem)) { // Add item back to inventory
                        player.send(`You remove ${highestLayeredItem.name} from your ${slotName} slot and put it back in your inventory.`);
                        return true;
                    } else {
                        if (player.inventory.isFull) {
                            player.send(`Inventory full!`);
                        } else player.send(`Failed to remove ${highestLayeredItem.name}!`);
                        player.eqSlots[slotName].equip(highestLayeredItem);
                        return false;
                    }
                } else {
                    player.send(`${unequipped}`);
                    return false;
                }
            } else {
                player.send(`No items found in your ${slotName} slot.`);
                return false;
            }
        }

        // Otherwise, treat the argument as an item name
        let foundItems = [];
        for (let key in player.eqSlots) {
            if (player.eqSlots[key].items instanceof Map) {
                player.eqSlots[key].items.forEach((item, mapKey) => {
                    if (item.name.toLowerCase().includes(itemName.toLowerCase())) {
                        foundItems.push({ item, key, mapKey });
                    }
                });
            }
        }

        if (foundItems.length === 0 || !foundItems[itemIndex]) {
            player.send(`${itemName} not found in your equipment slots.`);
            return false;
        }

        let { item, key, mapKey } = foundItems[itemIndex];
        const unequipped = player.eqSlots[key].unequip(item);
        if (unequipped === true) {
            if (player.inventory.addItem(item.vNum, item)) { // Add item back to inventory
                player.send(`You remove ${item.name} from your ${key} slot and put it back in your inventory.`);
                return true;
            } else {
                if (player.inventory.isFull) {
                    player.send(`Inventory full!`);
                } player.send(`Failed to remove ${item.name}!`);
                player.eqSlots[key].equip(item);
                return false;
            }
        } else {
            player.send(`${unequipped}`);
            return false;
        }
    },

    /**
     * Remove all items from equipment slots.
     * 
     * @param {Player} player - The player removing all items.
     * @returns {boolean} - True if all items were removed successfully, false otherwise.
     */
    removeAll(player) {
        for (let slot in player.eqSlots) {
            if (player.eqSlots[slot].items instanceof Map) {
                let itemsToRemove = Array.from(player.eqSlots[slot].items.values());
                for (let item of itemsToRemove) {
                    const unequipped = player.eqSlots[slot].unequip(item);
                    if (unequipped === true) {
                        if (!player.inventory.addItem(item.vNum, item)) {
                            if (player.inventory.isFull) {
                                player.send(`Inventory full! Could not remove all items.`);
                            } else player.send(`Failed to remove ${item.name} from your ${slot} slot.`);
                            player.eqSlots[slot].equip(item);
                            return false;
                        }
                        player.send(`You remove ${item.name} from your ${slot} slot and put it back in your inventory.`);
                    } else {
                        player.send(`${unequipped}`);
                        return false;
                    }
                }
            }
        }
        player.send(`All items have been removed from your equipment slots and put back in your inventory.`);
        return true;
    },

    /**
     * Remove registered events.
     */
    removeEvents() {
        EquipmentModule.mudServer.off('editItem', EquipmentModule.onEditItem);
        EquipmentModule.mudServer.off('hotBootBefore', EquipmentModule.onHotBootAfter);
        EquipmentModule.mudServer.off('hotBootBefore', EquipmentModule.onHotBootBefore);
        EquipmentModule.mudServer.off('itemsLoading', EquipmentModule.onItemsLoading);
        EquipmentModule.mudServer.off('playerLoaded', EquipmentModule.onPlayerLoaded);
        EquipmentModule.mudServer.off('playerSaved', EquipmentModule.onPlayerSaved);
    },

    /**
     * Save equipment slots to the JSON file.
     * 
     * @param {Player} [player] - The player (optional).
     */
    save(player) {
        try {
            const serializedData = EquipmentModule.serializeEQSlots();
            fs.writeFileSync(EquipmentModule.EQ_SLOTS_PATH, JSON.stringify(serializedData, null, 2), 'utf8');
            EquipmentModule.updateAllPlayerSlots(player);
            console.log("Equipment slots saved successfully.");
            if (player) player.send("Equipment slots saved successfully.");
        } catch (error) {
            console.error("Failed to save equipment slots:", error);
            if (player) player.send("Failed to save equipment slots.");
        }
    },

    /**
     * Serialize equipment slots for saving to a file.
     * 
     * @returns {Array} - Array of serialized equipment slots.
     */
    serializeEQSlots() {
        const slotsArray = [];
        for (const [name, data] of EquipmentModule.equipmentSlots.entries()) {
            const slotData = {
                ...data.serialize()
            };
            slotsArray.push(slotData);
        }
        return slotsArray; // Pretty-print the JSON
    },

    /**
     * Display the equipment slots and their items.
     * 
     * @param {Player} player - The player viewing the equipment.
     * @param {Array} args - The arguments for showing equipment.
     */
    showEquipment(player, args) {
        const maxLineLength = 50;
        const tabLength = 4; // Number of spaces for the tab
        const tab = ' '.repeat(tabLength);

        player.send("Current Equipment:");

        for (const slotKey in player.eqSlots) {
            const equipmentSlot = player.eqSlots[slotKey];
            let outputLines = [];
            let initialPosition = (equipmentSlot.displayString?.length ?? 0) + tabLength;

            // Truncate slot description if necessary
            let slotDescription = equipmentSlot.displayString ?? '';
            if (slotDescription.length > maxLineLength) {
                slotDescription = slotDescription.slice(0, maxLineLength - 3) + '...';
            }
            let firstLine = slotDescription.padEnd(maxLineLength, ' ');
            outputLines.push(firstLine);

            // Subsequent lines with item names
            let position = initialPosition;

            for (const item of equipmentSlot.items.values()) {
                let itemName = item.name;
                if (itemName.length > maxLineLength - tabLength) {
                    itemName = itemName.slice(0, maxLineLength - tabLength - 3) + '...';
                }
                let paddedItemName = tab + itemName;

                // Ensure that each line is exactly maxLineLength characters long
                let line = paddedItemName.padEnd(maxLineLength, ' ');

                outputLines.push(line);
                position = initialPosition + tabLength;
            }

            // Print each line
            outputLines.forEach(line => player.send(`${line}`));
        }
    },

    /**
     * Update all player equipment slots.
     * 
     * @param {Player} player - The player.
     */
    updateAllPlayerSlots(player) {
        EquipmentModule.mudServer.players.forEach(p => {
            EquipmentModule.updatePlayerSlots(p);
        });
    },

    /**
     * Update the equipment slots for a player.
     * 
     * @param {Player} player - The player.
     */
    updatePlayerSlots(player) {
        for (const key in player.eqSlots) {
            const eqSlot = player.eqSlots[key];
            if (!EquipmentModule.hasEquipmentSlot(key)) {
                // Remove slot and place items back into inventory
            }
        }

        for (const eqSlot of EquipmentModule.equipmentSlots.values()) {
            const slotName = eqSlot.name.toLowerCase();
            if (!player.eqSlots[slotName]) {
                const slot = eqSlot.copy();
                player.eqSlots[slotName] = slot;
            } else {
                player.eqSlots[slotName].eqType = eqSlot.eqType;
                player.eqSlots[slotName].displayString = eqSlot.displayString;
                player.eqSlots[slotName].layers = eqSlot.layers;
            }
        }
    },

    /**
     * Wear an item.
     * 
     * @param {Player} player - The player wearing the item.
     * @param {Array} args - The arguments for wearing the item.
     * @returns {boolean} - True if the item was worn successfully, false otherwise.
     */
    wear(player, args) {
        let [itemString, wearSlot] = args;

        if (!itemString) {
            player.send(`Wear what where?`);
            return false;
        }

        const parsePattern = /^(\d+)\.(.*)$/;
        let itemMatch = itemString?.match(parsePattern);

        let itemIndex = itemMatch ? parseInt(itemMatch[1], 10) : 0;
        let itemName = itemMatch ? itemMatch[2].trim() : itemString.trim();

        let itemList = player.inventory.findAllItemsByName(itemName);
        let item = itemList[itemIndex];

        if (!itemList.length || !item) {
            player.send(`${itemName} not found in your inventory.`);
            return false;
        }

        // Check if the item is a wearable type (e.g., armor)
        if (!item.wearable) {
            player.send(`You can't wear ${item.name}.`);
            return;
        }

        // Determine the equipment slot
        let slotName;
        if (Array.isArray(item.types)) {
            slotName = item.types[0].toLowerCase();
        }
        if (wearSlot) {
            slotName = wearSlot.toLowerCase();
        }

        // Check if the player has the corresponding equipment slot available
        const slot = player.eqSlots[slotName];
        if (!slot) {
            player.send(`You can't wear a ${item.name} because you don't have the ${slotName} slot.`);
            return;
        }

        // Equip the item
        const equippedItem = slot.equip(item);
        if (equippedItem === true) {
            player.inventory.removeItem(item); // Remove the item from inventory
            player.send(`You start using ${item.name}.`);
        } else {
            player.send(`${equippedItem}`);
        }
    },

    /**
     * Wear all wearable items in the inventory.
     * 
     * @param {Player} player - The player wearing the items.
     * @returns {boolean} - True if items were worn successfully, false otherwise.
     */
    wearAll(player) {
        const inventoryItems = player.inventory.findAllItemsByName();

        if (!inventoryItems.length) {
            player.send("You have no items in your inventory to wear.");
            return false;
        }

        let wornItemsCount = 0;

        inventoryItems.forEach(item => {
            if (item.wearable) {
                let slotName;
                if (Array.isArray(item.types)) {
                    slotName = item.types[0].toLowerCase();
                }

                const slot = player.eqSlots[slotName];
                if (slot) {
                    const equippedItem = slot.equip(item);
                    if (equippedItem === true) {
                        player.inventory.removeItem(item); // Remove the item from inventory
                        player.send(`You start using ${item.name}.`);
                        wornItemsCount++;
                    } else {
                        player.send(`${equippedItem}`);
                    }
                } else {
                    player.send(`You can't wear a ${item.name} because you don't have the ${slotName} slot.`);
                }
            } else {
                player.send(`You can't wear a ${item.name}.`);
            }
        });

        if (wornItemsCount === 0) {
            player.send("No items found to use.");
            return false;
        } else {
            player.send(`Started using ${wornItemsCount} item(s) successfully.`);
            return true;
        }
    },
};

// Export the EquipmentModule
module.exports = EquipmentModule;
