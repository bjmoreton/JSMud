// Importing necessary modules
const fs = require('fs');
const path = require('path');
const EquipmentSlot = require('./EquipmentModule/EquipmentSlot');
const Item = require('./ItemModule/Item');
const { isNumber, stringToBoolean, sendNestedKeys } = require('./Mud/Helpers');
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
                player.send(type);
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

    analyzeItem(player, args) {
        let [itemStr] = args;

        if (!itemStr) {
            player.send(`Usage: analyze [item]`);
            return false;
        }

        const parsePattern = /^(\d+)\.(.*)$/;
        let itemMatch = itemStr?.match(parsePattern);

        let itemIndex = itemMatch ? parseInt(itemMatch[1], 10) : 0;
        let itemName = itemMatch ? itemMatch[2].trim() : itemStr.trim();

        let itemList = player.inventory.findAllItemsByName(itemName);
        let item = itemList[itemIndex];

        if (!itemList.length || !item) {
            player.send(`${itemName} not found in your inventory.`);
            return false;
        }

        sendNestedKeys(player, item);
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
            player.send(`Usage: editequipmentslot [slot] <display | eqtype | layers | name> [value]`);
            return;
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
                case 'eqtype':
                    const typeStr = data.join(' ');
                    const eqType = Item.stringToItemType(typeStr);
                    if (!eqType) {
                        player.send(`Invalid Equipment type!`);
                        player.send(`Valid types:`);
                        Item.getItemTypesArray().forEach(type => {
                            player.send(type);
                        });
                        return;
                    }
                    slotObj.eqType = eqType;
                    break;
                case 'layers':
                    const [layers] = data;
                    if (!isNumber(layers)) {
                        player.send(`${layers} is invalid for layers!`);
                        return;
                    }
                    slotObj.layers = parseInt(layers);
                    break;
                case 'name':
                    const name = data.join(' ');
                    if (!EquipmentModule.hasEquipmentSlot(name)) {
                        const copiedSlot = slotObj.copy();
                        slotObj.delete = true;
                        copiedSlot.saved = false;
                        copiedSlot.name = name;
                        EquipmentModule.equipmentSlots.set(copiedSlot.name.toLowerCase(), copiedSlot);
                    } else {
                        player.send(`Equipment slot ${name} already exists!`);
                        return;
                    }
                    break;
                default:
                    player.send(`Usage: editequipmentslot [slot] <display | eqtype | layers | name> [value]`);
                    return;
            }
        } else {
            player.send(`Slot ${slot} doesn't exist!`);
            return;
        }

        slotObj.saved = false;
        slotObj.delete = false;
        player.send(`Equipment slot updated successfully.`);
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
        EquipmentModule.loadEquipmentSlots(player);

        global.ItemModule.addEditItemAction('layer', 'edititem [vNum] layer [layer(number)]', EquipmentModule.editItemLayer);
        global.ItemModule.addEditItemAction('type', 'edititem [vNum] type <add | remove> [...type]', EquipmentModule.editItemType);
        global.ItemModule.addEditItemAction('wearable', 'edititem [vNum] wearable [true/false]', EquipmentModule.editItemWearable);
        global.ItemModule.addEditItemRarityAction('statbonus', 'edititem [rarity] statbonus [value]', EquipmentModule.editItemRarityStatBonus);
    },

    loadEquipmentSlots(player) {
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
     * Edits the layer and wearable flag of an item.
     * 
     * @param {Player} player - The player executing the command.
     * @param {Item} item - The item being edited.
     * @param {Object} eventObj - The event object containing command arguments.
     * @returns {boolean} - Indicates whether the action was handled successfully.
     */
    editItemLayer(player, item, eventObj) {
        const [vNum, editWhat, action, ...data] = eventObj.args;

        if (!isNumber(action)) {
            eventObj.saved = false;
            player.send(`Usage: editItem ${vNum} layer [layer(number)]`);
            return false;
        }

        const layer = parseInt(action);
        item.layer = layer;
        return true;
    },

    /**
     * Edits the types of an item by adding or removing types.
     * 
     * @param {Player} player - The player executing the command.
     * @param {Item} item - The item being edited.
     * @param {Object} eventObj - The event object containing command arguments.
     * @returns {boolean} - Indicates whether the action was handled successfully.
     */
    editItemType(player, item, eventObj) {
        const [vNum, editWhat, action, ...data] = eventObj.args;

        if (!action) {
            player.send(`Usage: edititem ${vNum} type <add | remove> [...type]`);
            return false;
        }

        if (!item.types) item.types = [];
        switch (action.toLowerCase()) {
            case 'add':
                if (data.length === 0) {
                    player.send(`Usage: edititem ${vNum} type add [...type]`);
                    player.send(`Valid Options:`);
                    EquipmentModule.getFormattedEquipmentSlots().forEach(slots => {
                        player.send(`${slots}`);
                    });
                    eventObj.saved = false;
                    return false;
                }

                const types = data;
                types.forEach(type => {
                    if (EquipmentModule.equipmentSlots.has(type.toLowerCase())) {
                        item.types.push(type.toLowerCase());
                    }
                });
                return true;
            case 'remove':
                if (data.length === 0) {
                    player.send(`Usage: edititem ${vNum} type remove [...type]`);
                    player.send(`Valid Options:`);
                    EquipmentModule.getFormattedEquipmentSlots().forEach(slots => {
                        player.send(`${slots}`);
                    });
                    eventObj.saved = false;
                    return false;
                }

                types.forEach(type => {
                    const index = item.types.indexOf(type.toLowerCase());
                    if (index > -1) {
                        item.types.splice(index, 1);
                    }
                });
                return true;
            default:
                return false;
        }
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
     * Edits the wearable property of an item.
     * 
     * @param {Player} player - The player executing the command.
     * @param {Item} item - The item being edited.
     * @param {Object} eventObj - The event object containing command arguments.
     * @returns {boolean} - Indicates whether the action was handled successfully.
     */
    editItemWearable(player, item, eventObj) {
        const [vNum, editWhat, action, ...data] = eventObj.args;

        if (!action) {
            eventObj.saved = false;
            player.send(`Usage: editItem ${vNum} wearable true/false`);
            return false;
        }

        const wearable = stringToBoolean(action);
        if (wearable) {
            item.wearable = wearable;
        }
        return true;
    },

    /**
     * Event handler for hot boot after.
     */
    onHotBootAfter(player) {
        EquipmentModule.mudServer.players.forEach(p => {
            for (const slot in p.eqSlots) {
                Object.setPrototypeOf(p.eqSlots[slot], EquipmentSlot.prototype);
            }
        });
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
                for (const itemData of slot.items) {
                    const itemType = Item.stringToItemType(itemData.itemType);
                    const item = itemType.deserialize(itemData.vNum, itemData);

                    if (item) {
                        player.inventory.addItem(item.vNum, item, true);
                    }
                }

                delete player.eqSlots[slot.name.toLowerCase()];
            }
        }

        EquipmentModule.updatePlayerSlots(player, false);
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
                        player.send(`You remove ${highestLayeredItem.displayString} from your ${slotName} slot and put it back in your inventory.`);
                        return true;
                    } else {
                        if (player.inventory.isFull) {
                            player.send(`Inventory full!`);
                        } else player.send(`Failed to remove ${highestLayeredItem.displayString}!`);
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
                player.send(`You remove ${item.displayString} from your ${key} slot and put it back in your inventory.`);
                return true;
            } else {
                if (player.inventory.isFull) {
                    player.send(`Inventory full!`);
                }
                player.send(`Failed to remove ${item.displayString}!`);
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
                            } else player.send(`Failed to remove ${item.displayString} from your ${slot} slot.`);
                            player.eqSlots[slot].equip(item);
                            return false;
                        }
                        player.send(`You remove ${item.displayString} from your ${slot} slot and put it back in your inventory.`);
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
     * Remove an equipment slot.
     * 
     * @param {Player} player - The player removing the equipment slot.
     * @param {Array} args - The arguments for removal.
     */
    async removeEquipmentSlot(player, args) {
        const [eqSlotStr] = args;

        if (!eqSlotStr) {
            player.send(`Usage: removeequipmentslot [slot]`);
            return;
        }

        if (EquipmentModule.hasEquipmentSlot(eqSlotStr)) {
            const deleteForSure = await player.textEditor.showPrompt(`Delete ${eqSlotStr}? y/n`);

            if (deleteForSure.toLowerCase() == 'y' || deleteForSure.toLowerCase() == 'yes') {
                //EquipmentModule.equipmentSlots.delete(eqSlotStr.toLowerCase());
                EquipmentModule.equipmentSlots.get(eqSlotStr.toLowerCase()).delete = true;
                player.send(`Equipment slot ${eqSlotStr} successfully deleted.`);
            } else {
                player.send(`Equipment slot ${eqSlotStr} wasn't deleted.`);
            }
        } else {
            player.send(`Equipment slot ${eqSlotStr} doesn't exist!`);
        }
    },

    /**
     * Remove registered events.
     */
    removeEvents() {
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
    saveEquipmentSlots(player) {
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

            if (slotData.delete !== true) {
                slotsArray.push(slotData);
            } else {
                EquipmentModule.equipmentSlots.delete(slotData.name.toLowerCase());
            }
        }
        return slotsArray;
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
                let itemName = item.displayString;
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

    showEquipmentSlot(player, args) {
        const [slot] = args;

        if (!slot) {
            player.send(`Usage: showequipmentslot [slot]`);
            return;
        }

        if (EquipmentModule.hasEquipmentSlot(slot)) {
            const foundSlot = EquipmentModule.equipmentSlots.get(slot.toLowerCase());
            sendNestedKeys(player, foundSlot);
        } else {
            player.send(`Slot ${slot} doesn't exist!`);
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
    updatePlayerSlots(player, save = true) {
        for (const key in player.eqSlots) {
            const eqSlot = player.eqSlots[key];
            if (!EquipmentModule.hasEquipmentSlot(key)) {
                // Remove slot and place items back into inventory
                if (eqSlot) {
                    for (const item of eqSlot.items.values()) {
                        player.inventory.addItem(item.vNum, item, true);
                    }

                    delete player.eqSlots[eqSlot.name.toLowerCase()];
                }
            }
        }

        for (const eqSlot of EquipmentModule.equipmentSlots.values()) {
            const slotName = eqSlot.name.toLowerCase();

            if (eqSlot.saved === true) {
                if (!player.eqSlots[slotName]) {
                    const slot = eqSlot.copy();
                    player.eqSlots[slotName] = slot;
                } else {
                    player.eqSlots[slotName].eqType = eqSlot.eqType;
                    player.eqSlots[slotName].displayString = eqSlot.displayString;
                    player.eqSlots[slotName].layers = eqSlot.layers;
                }
            }
        }

        if (save) player.save(false);
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
            player.send(`You can't wear ${item.displayString}.`);
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
            player.send(`You can't wear a ${item.displayString} because you don't have the ${slotName} slot.`);
            return;
        }

        // Equip the item
        const equippedItem = slot.equip(item);
        if (equippedItem === true) {
            player.inventory.removeItem(item); // Remove the item from inventory
            player.send(`You start using ${item.displayString}.`);
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

        // Filter wearable items and sort them by their layer in ascending order
        const wearableItems = inventoryItems.filter(item => item.wearable)
            .sort((a, b) => a.layer - b.layer);

        wearableItems.forEach(item => {
            let slotName;
            if (Array.isArray(item.types)) {
                slotName = item.types[0].toLowerCase();
            }

            const slot = player.eqSlots[slotName];
            if (slot) {
                const equippedItem = slot.equip(item);
                if (equippedItem === true) {
                    player.inventory.removeItem(item); // Remove the item from inventory
                    player.send(`You start using ${item.displayString}.`);
                    wornItemsCount++;
                } else {
                    player.send(`${equippedItem}`);
                }
            } else {
                player.send(`You can't wear a ${item.displayString} because you don't have the ${slotName} slot.`);
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