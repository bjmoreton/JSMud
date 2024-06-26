// Importing necessary modules
const fs = require('fs');
const path = require('path');
const Item = require('./ItemModule/Item');
const { isNumber, sendNestedKeys, isEmptyObj, stringToBoolean } = require('./Mud/Helpers');
const Key = require('./ItemModule/Key');
const ItemFlags = require('./ItemModule/ItemFlags');

/**
 * Inventory module for handling items in the MUD server.
 * 
 * @module ItemModule
 */
const ItemModule = {
    ITEMS_PATH: path.join(__dirname, '../system', 'items.json'),
    ITEM_RARITIES_PATH: path.join(__dirname, '../system', 'rarities.json'),
    ITEM_FLAGS_PATH: path.join(__dirname, '../system', 'itemFlags.json'),
    name: "Item",
    itemsList: new Map(),
    editItemActions: new Map(),
    editItemRarityActions: new Map(),

    /**
     * Add a new item to the items list.
     * 
     * @param {Player} player - The player adding the item.
     * @param {Array} args - Arguments for the item.
     */
    addItem(player, args) {
        const [name, itemType] = args;
        const lastEntry = Array.from(ItemModule.itemsList.entries())[ItemModule.itemsList.size - 1];
        const lastItemVNum = lastEntry ? lastEntry[0] : -1;
        const vNumInt = parseInt(lastItemVNum) + 1;

        if (!name) {
            player.send("Usage: additem [itemname] [itemtype]");
            return;
        }

        // Validate item number
        if (!isNumber(vNumInt)) {
            player.send("Invalid item number.");
            return;
        }

        const itemTypeConstructor = Item.stringToItemType(itemType);
        if (!itemTypeConstructor) {
            player.send(`Invalid Item type!`);
            player.send(`Valid types:` + Item.getItemTypesArray());
            return;
        }

        // Create a new item
        const newItem = new itemTypeConstructor(vNumInt, name, name, itemType);

        // Add to the global items list
        ItemModule.itemsList.set(vNumInt, newItem);

        player.send(`Item added: vNum: ${vNumInt} ${newItem.name} (Type: ${newItem.itemType})`);
    },

    addItemFlag(player, args) {
        const [flagName] = args;

        if (!flagName) {
            player.send(`Usage: additemflag [value]`);
            return;
        }

        let flag;
        if (!ItemFlags.hasFlag(flagName)) {
            flag = ItemFlags.addFlag(flagName);
        } else {
            player.send(`Flag ${flagName} already exist!`);
            return;
        }
        flag.saved = false;
        player.send(`Item flag ${flag.name} added successfully.`);
    },

    /**
     * Add a new item rarity.
     * 
     * @param {Player} player - The player adding the item rarity.
     * @param {Array} args - Arguments for the item rarity.
     */
    addItemRarity(player, args) {
        const [name, symbol, weight, randomSpawn] = args;

        if (!name) {
            player.send(`Usage: additemrarity [name] [symbol] [weight] [randomspawn]`);
            return;
        }

        if (!symbol) {
            player.send(`A symbol is needed!`);
            return;
        }

        if (!isNumber(weight)) {
            player.send(`Weight needs to be a number!`);
            return;
        }

        if (!randomSpawn) {
            player.send(`Random spawn needs to be true or false!`);
            return;
        }

        const rarity = Item.getRarityByName(name);
        const boolValue = stringToBoolean(randomSpawn);
        if (!rarity) {
            Item.addItemRarities({ name: name, randomSpawn: boolValue, symbol: symbol, weight: weight });
        } else {
            player.send(`Rarity ${rarity.symbol} ${rarity.name} already exists!`);
            return;
        }

        player.send(`Item rarity ${symbol} ${name} added successfully!`);
    },

    /**
     * Add an edit action for items.
     * 
     * @param {string} name - The name of the action.
     * @param {string} useCase - The use case description.
     * @param {function} [action=()=>{}] - The action function.
     */
    addEditItemAction(name, useCase, action = () => { }) {
        if (!ItemModule.editItemActions.has(name.toLowerCase())) {
            ItemModule.editItemActions.set(name.toLowerCase(), { action, useCase });
        }
    },

    /**
     * Add an edit action for item rarities.
     * 
     * @param {string} name - The name of the action.
     * @param {string} useCase - The use case description.
     * @param {function} [action=()=>{}] - The action function.
     */
    addEditItemRarityAction(name, useCase, action = () => { }) {
        if (!ItemModule.editItemRarityActions.has(name.toLowerCase())) {
            ItemModule.editItemRarityActions.set(name.toLowerCase(), { action, useCase });
        }
    },

    createItem(player, item, rarity) {
        const itemCopy = item.copy();
        if (!rarity || isEmptyObj(rarity)) {
            rarity = Item.getRandomRarity();
        }
        itemCopy.rarity = rarity;
        return itemCopy;
    },

    /**
     * Initialize the ItemModule.
     * 
     * @param {Object} mudServer - The MUD server instance.
     */
    init: function (mudServer) {
        global.ItemModule = this;
        this.mudServer = mudServer;
        this.registerEvents();
    },

    /**
     * Edit an existing item.
     * 
     * @param {Player} player - The player editing the item.
     * @param {Array} args - Arguments for the item edit.
     */
    async editItem(player, args) {
        const [vNum, editWhat, value, ...data] = args;
        const eventObj = { args: args, handled: false, saved: true };

        if (vNum) {
            const vNumInt = parseInt(vNum);
            // Check if the item number is valid and if the item exists
            if (!isNumber(vNumInt) || !ItemModule.itemsList.has(vNumInt)) {
                player.send("Invalid item number or item does not exist.");
                return;
            }

            const itemToEdit = ItemModule.getItemByVNum(vNumInt);
            if (!itemToEdit) {
                player.send(`vNum item ${vNumInt} not found!`);
                return;
            }

            switch (editWhat?.toLowerCase()) {
                case "desc":
                case "description":
                    const description = await player.textEditor.startEditing(itemToEdit.description);
                    itemToEdit.description = description?.trim();
                    break;
                case "grounddesc":
                case "grounddescription":
                    const groundDescription = await player.textEditor.startEditing(itemToEdit.groundDescription);
                    itemToEdit.groundDescription = groundDescription?.trim();
                    break;
                case "flags":
                    if (!ItemModule.editItemFlags(player, itemToEdit, value, data)) {
                        return;
                    }
                    break;
                case "name":
                    if (value === undefined || value?.trim() == '') {
                        player.send('Must specify a new item name!');
                        return;
                    }
                    itemToEdit.name = value?.trim();
                    break;
                case "namedisplay":
                    if (value === undefined || value?.trim() == '') {
                        player.send('Must specify a new item name display!');
                        return;
                    }
                    itemToEdit.nameDisplay = value?.trim();
                    break;
                default:
                    if (ItemModule.editItemActions.has(editWhat?.toLowerCase())) {
                        const editAction = ItemModule.editItemActions.get(editWhat?.toLowerCase());
                        await editAction.action(player, itemToEdit, eventObj);
                    } else {
                        player.send(`Usage: edititem [vNum] <description | flags | name | namedisplay>`);
                        for (const action of ItemModule.editItemActions.values()) {
                            player.send(`Usage: ${action.useCase}`);
                        }
                        return;
                    }
            }

            if (eventObj.saved) {
                itemToEdit.saved = false;
                itemToEdit.delete = false;
                ItemModule.mudServer.emit('itemEditted', itemToEdit);
                player.send(`Item edited successfully!`);
            }
        } else {
            player.send(`Usage: edititem [vNum] <description | flags | name | namedisplay>`);
            for (const action of ItemModule.editItemActions.values()) {
                player.send(`Usage: ${action.useCase}`);
            }
        }
    },

    /**
     * Edit an existing item rarity.
     * 
     * @param {Player} player - The player editing the item rarity.
     * @param {Array} args - Arguments for the item rarity edit.
     */
    async editItemRarity(player, args) {
        const [rarityStr, editWhat, value, ...data] = args;
        const eventObj = { args: args, handled: false, saved: true };

        if (rarityStr) {
            const rarityToEdit = Item.getRarityByName(rarityStr);
            if (rarityToEdit) {
                switch (editWhat?.toLowerCase()) {
                    case "name":
                        const oldName = rarityToEdit.name;
                        if (value === undefined || value?.trim() == '') {
                            player.send('Must specify a new item rarity name!');
                            return;
                        }
                        delete Item.ItemRarities[oldName];
                        rarityToEdit.name = value.trim();
                        Item.ItemRarities[rarityToEdit.name] = rarityToEdit;
                        break;
                    case "randomspawn":
                        const boolValue = stringToBoolean(value);
                        rarityToEdit.randomSpawn = boolValue;
                        player.send(`Random spawn set to ${rarityToEdit.randomSpawn}.`);
                        break;
                    case "symbol":
                        if (value === undefined || value?.trim() == '') {
                            player.send('Must specify a new item rarity symbol!');
                            return;
                        }
                        rarityToEdit.symbol = value.trim();
                        player.send(`New Symbol: ${rarityToEdit.symbol}.`);
                        break;
                    case "weight":
                        if (!isNumber(value)) {
                            player.send('Must specify a new item rarity weight!');
                            return;
                        }
                        rarityToEdit.weight = Number(value);
                        break;
                    default:
                        if (ItemModule.editItemRarityActions.has(editWhat.toLowerCase())) {
                            const editAction = ItemModule.editItemRarityActions.get(editWhat.toLowerCase());
                            await editAction.action(player, rarityToEdit, eventObj);
                        } else {
                            player.send(`Usage: edititemrarity [rarity] <name | symbol | weight> [value]`);
                            for (const action of ItemModule.editItemRarityActions.values()) {
                                player.send(`Usage: ${action.useCase}`);
                            }
                            return;
                        }
                }

                if (eventObj.saved) {
                    rarityToEdit.saved = false;
                    rarityToEdit.delete = false;
                    player.send(`Item rarity edited successfully!`);
                }
            } else {
                player.send(`Rarity ${rarityStr} not found!`);
                return;
            }
        } else {
            player.send(`Usage: edititemrarity [rarity] <name | symbol | weight> [value]`);
            for (const action of ItemModule.editItemRarityActions.values()) {
                player.send(`Usage: ${action.useCase}`);
            }
        }
    },

    async editItemFlag(player, args) {
        const [flagName, eventName] = args;
        if (!flagName) {
            player.send(`Usage: edititemflag [flag] [event]`);
            return;
        }

        if (!eventName) {
            player.send(`Usage: edititemflag ${flagName} [event]`);
            return;
        }

        const flag = ItemFlags.getFlag(flagName);
        if (!flag) {
            player.send(`Flag ${flagName} not found!`);
            return;
        }
        const defaultText = flag.events[eventName.toLowerCase()]?.actionCode;
        const actionCode = await player.textEditor.startEditing((defaultText ? defaultText : ''));

        if (actionCode !== null) {
            flag.saved = false;
            ItemFlags.addEvent(flag, eventName, actionCode);
            player.send(`Updated ${flagName} successfully!`);
        } else {
            player.send(`Canceled edit of ${eventName} on item flag ${flagName}!`);
        }
    },

    /**
     * Edit the flags of an item.
     * 
     * @param {Player} player - The player editing the item.
     * @param {Item} item - The item being edited.
     * @param {string} action - The action to perform (add/remove).
     * @param {Array} data - The flags data.
     * @returns {boolean} True if the action was successful, false otherwise.
     */
    editItemFlags(player, item, action, data) {
        switch (action?.toLowerCase()) {
            case "add":
                item.flags.add(...data);
                player.send(`New flags: ${item.flags.map(map => map.name)}`);
                break;
            case "remove":
                item.flags.remove(...data);
                player.send(`New flags: ${item.flags.map(map => map.name)}`);
                break;
            default:
                player.send(`Usage: editItem vNum flags <add | remove>`);
                player.send(`Valid flags: ${ItemFlags.getFlagsArray()}`);
                return false;
        }

        return true;
    },

    /**
     * Look up an item by its vNum.
     * 
     * @param {Player} player - The player looking up the item.
     * @param {Array} args - The arguments for the lookup.
     */
    executeLookupVNum(player, args) {
        const [vNum] = args;

        if (!vNum) {
            player.send(`Usage: lookupvnum [vNum]`);
            return;
        }

        if (isNumber(vNum)) {
            const foundItem = ItemModule.getItemByVNum(vNum);
            if (foundItem) sendNestedKeys(player, foundItem);
            else player.send(`Item vNum ${vNum} doesn't exist!`);
        } else {
            player.send(`vNum needs to be a number!`);
        }
    },

    /**
     * Find items by their name.
     * 
     * @param {Player} player - The player finding the items.
     * @param {Array} args - The arguments for the find operation.
     */
    findItemByName(player, args) {
        const [itemStr] = args;
        if (!itemStr) {
            player.send(`Usage: finditembyname [value]`);
            return;
        }
        const items = ItemModule.getItemByName(itemStr);
        if (items.length > 0) {
            if (items.length > 1) {
                player.send(`vNum --- Item Name --- Item Type`);
                items.forEach(item => {
                    player.send(`${item.vNum} --- ${item.name} --- ${item.itemType}`);
                });
            } else {
                sendNestedKeys(player, items[0]);
            }
        } else {
            player.send(`No items found containing ${itemStr}!`);
        }
    },

    /**
     * Get an item by its vNum.
     * 
     * @param {number} vNum - The vNum of the item.
     * @returns {Item|null} The item if found, null otherwise.
     */
    getItemByVNum(vNum) {
        if (isNumber(vNum)) return ItemModule.itemsList.get(parseInt(vNum));
        return null;
    },

    /**
     * Get items by their name.
     * 
     * @param {string} name - The name of the items to find.
     * @returns {Array} The array of found items.
     */
    getItemByName(name) {
        const items = [];
        for (const item of ItemModule.itemsList.values()) {
            if (!name || item.name.toLowerCase().includes(name.toLowerCase())) items.push(item);
        }

        return items;
    },

    /**
     * Load items from the JSON file.
     * 
     * @param {Player} player - The player initiating the load.
     */
    load(player) {
        try {
            ItemModule.loadItemFlags(player, false);
            ItemModule.loadItemRarities(player, false);

            const data = fs.readFileSync(ItemModule.ITEMS_PATH, 'utf8');
            const itemsData = JSON.parse(data);
            ItemModule.mudServer.emit('itemsLoading', player);
            itemsData.forEach(item => {
                // Accessing the nested data structure
                const itemInfo = item.data;
                if (itemInfo) {
                    const itemType = Item.stringToItemType(itemInfo.itemType);
                    const itemObj = itemType.deserialize(item.vNum, itemInfo);
                    ItemModule.mudServer.emit('itemDeserialized', player, itemObj, itemInfo);
                    ItemModule.itemsList.set(parseInt(item.vNum), itemObj);
                }
            });

            ItemModule.mudServer.emit('itemsLoaded');
            console.log("Items loaded successfully.");
            if (player) player.send("Items loaded successfully.");
        } catch (err) {
            console.error('Error reading or parsing JSON file:', err);
            if (player) player.send("Failed to load items.");
        }
    },

    /**
     * Load item flags from the JSON file.
     * 
     * @param {Player} player - The player initiating the load.
     * @param {boolean} [triggerEvent=true] - Whether to trigger the itemsLoaded event.
     */
    loadItemFlags(player, triggerEvent = true) {
        try {
            const data = fs.readFileSync(ItemModule.ITEM_FLAGS_PATH, 'utf8');
            const flagsData = JSON.parse(data);

            ItemFlags.deserialize(flagsData);

            if (triggerEvent) ItemModule.mudServer.emit('itemsLoaded');
            console.log("Item flags loaded successfully.");
            if (player) player.send("Item flags loaded successfully.");
        } catch (error) {
            console.error("Failed to loaded item flags:", error);
            if (player) player.send("Failed to loaded item flags.");
        }
    },

    /**
     * Load item rarities from the JSON file.
     * 
     * @param {Player} player - The player initiating the load.
     * @param {boolean} [triggerEvent=true] - Whether to trigger the itemsLoaded event.
     */
    loadItemRarities(player, triggerEvent = true) {
        try {
            const data = fs.readFileSync(ItemModule.ITEM_RARITIES_PATH, 'utf8');
            const rarityData = JSON.parse(data);

            Object.values(rarityData).forEach(rarity => {
                Item.addItemRarities(rarity);
            });

            if (triggerEvent) ItemModule.mudServer.emit('itemsLoaded');
            console.log("Item rarities loaded successfully.");
            if (player) player.send("Item rarities loaded successfully.");
        } catch (error) {
            console.error("Failed to loaded item rarities:", error);
            if (player) player.send("Failed to loaded item rarities.");
        }
    },

    /**
     * Handle actions before a hotboot.
     */
    onHotBootBefore() {
        ItemModule.removeEvents();
    },

    /**
     * Handle actions when items are loading.
     */
    onItemsLoading() {
        Item.addItemType(Key);
    },

    /**
     * Handle actions when a player logs in.
     * 
     * @param {Player} player - The player logging in.
     */
    onPlayerLoggedIn: (player) => {

    },

    /**
     * Register events for the ItemModule.
     */
    registerEvents() {
        ItemModule.mudServer.on('hotBootBefore', ItemModule.onHotBootBefore);
        ItemModule.mudServer.on('itemsLoading', ItemModule.onItemsLoading);
        ItemModule.mudServer.on('playerLoggedIn', ItemModule.onPlayerLoggedIn);
    },

    /**
     * Remove events for the ItemModule.
     */
    removeEvents() {
        ItemModule.mudServer.off('hotBootBefore', ItemModule.onHotBootBefore);
        ItemModule.mudServer.off('itemsLoading', ItemModule.onItemsLoading);
        ItemModule.mudServer.off('playerLoggedIn', ItemModule.onPlayerLoggedIn);
    },

    /**
     * Remove an item from the items list.
     * 
     * @param {Player} player - The player removing the item.
     * @param {Array} args - The arguments for the removal.
     */
    async removeItem(player, args) {
        const [vNum] = args;

        if (!vNum) {
            player.send(`Usage: removeitem [vNum]`);
            return;
        }

        const item = ItemModule.getItemByVNum(vNum);
        if (item) {
            const deleteForSure = await player.textEditor.showPrompt(`Delete ${item.name}? y/n`);

            if (deleteForSure.toLowerCase() == 'y' || deleteForSure.toLowerCase() == 'yes') {
                // Mark the item as deleted instead of removing it from the list
                item.delete = true;
                player.send(`${item.name} deleted successfully.`);
            } else {
                player.send(`${item.name} wasn't deleted.`);
            }
        }
    },

    removeItemFlag(player, args) {
        const [flag] = args;
        if (!flag) {
            player.send(`Usage: removeitemflag [flag]`);
            return;
        }

        ItemFlags.removeFlag(flag);
        player.send(`Item flag deleted successfully.`);
    },

    /**
     * Remove an item rarity.
     * 
     * @param {Player} player - The player removing the item rarity.
     * @param {Array} args - The arguments for the removal.
     */
    async removeItemRarity(player, args) {
        const [rarityStr] = args;

        if (!rarityStr) {
            player.send(`Usage: removeitemrarity [rarity]`);
            return;
        }

        const rarity = Item.getRarityByName(rarityStr);
        if (rarity) {
            const deleteForSure = await player.textEditor.showPrompt(`Delete ${rarity.name}? y/n`);

            if (deleteForSure.toLowerCase() == 'y' || deleteForSure.toLowerCase() == 'yes') {
                Item.ItemRarities.get(rarity.name.toLowerCase()).delete = true;
                player.send(`${rarity.name} deleted successfully.`);
            } else {
                player.send(`${rarity.name} wasn't deleted.`);
            }
        }
    },

    /**
     * Save the items to the JSON file.
     * 
     * @param {Player} player - The player initiating the save.
     */
    save(player) {
        try {
            const serializedData = ItemModule.serializeItems(ItemModule.itemsList);
            fs.writeFileSync(ItemModule.ITEMS_PATH, JSON.stringify(serializedData, null, 2), 'utf8');
            ItemModule.mudServer.emit('itemsSaved');
            console.log("Items saved successfully.");
            if (player) player.send("Items saved successfully.");
        } catch (error) {
            console.error("Failed to save items:", error);
            if (player) player.send("Failed to save items.");
        }
    },

    /**
     * Save item flags to the JSON file.
     * 
     * @param {Player} player - The player initiating the save.
     */
    saveItemFlags(player) {
        try {
            fs.writeFileSync(ItemModule.ITEM_FLAGS_PATH, ItemFlags.serialize(), 'utf8');

            ItemModule.itemsList.forEach(item => {
                const removeFlags = [];
                item.flags.forEach(flag => {
                    const existingFlag = ItemFlags.getFlag(flag.name);
                    if (!existingFlag) {
                        removeFlags.push(flag);
                    }
                });
                removeFlags.forEach(flag => {
                    item.flags.remove(flag.name);
                });
            });

            console.log("Item flags saved successfully.");
            if (player) player.send("Item flags saved successfully.");
            ItemModule.save(player);
        } catch (error) {
            console.error("Failed to save item flags:", error);
            if (player) player.send("Failed to save item flags.");
        }
    },


    /**
     * Save item rarities to the JSON file.
     * 
     * @param {Player} player - The player initiating the save.
     */
    saveItemRarities(player) {
        try {
            const filteredRarities = Object.keys(Item.ItemRarities)
                .filter(key => !Item.ItemRarities[key].deleted)
                .reduce((acc, key) => {
                    acc[key] = Item.ItemRarities[key];
                    return acc;
                }, {});
            const jsonString = JSON.stringify(filteredRarities, null, 2);
            fs.writeFileSync(ItemModule.ITEM_RARITIES_PATH, jsonString, 'utf8');
            console.log("Item rarities saved successfully.");
            if (player) player.send("Item rarities saved successfully.");
            ItemModule.save(player);
        } catch (error) {
            console.error("Failed to save item rarities:", error);
            if (player) player.send("Failed to save item rarities.");
        }
    },

    /**
     * Serialize the items list.
     * 
     * @param {Map} itemsMap - The map of items.
     * @returns {Array} The serialized items array.
     */
    serializeItems(itemsMap) {
        const itemsArray = [];
        for (const [vNum, item] of itemsMap.entries()) {
            const itemData = {
                vNum: parseInt(vNum),
                data: {
                    ...item.serialize()
                }
            };

            if (!itemData.data.delete) {
                itemsArray.push(itemData);
            }
        }
        return itemsArray;
    },

    /**
     * Show item rarity details.
     * 
     * @param {Player} player - The player requesting the details.
     * @param {Array} args - The arguments for the request.
     */
    showItemRarity(player, args) {
        const [rarityStr] = args;

        const rarity = Item.getRarityByName(rarityStr);
        if (rarity) {
            sendNestedKeys(player, rarity);
        } else {
            player.send(`Item rarity ${rarityStr} doesn't exist!`);
        }
    },

    /**
     * Spawn a new item.
     * 
     * @param {Player} player - The player spawning the item.
     * @param {Array} args - The arguments for the spawn.
     */
    spawnItem(player, args) {
        const [vNum, ...rarityNames] = args;
        if (args.length === 0) {
            player.send(`Usage: spawnItem [vNum] [...rarities]`);
            return;
        }

        if (!isNumber(vNum)) {
            player.send(`Invalid item vNum!`);
            return;
        }

        const rarity = Item.getRandomRarity(...rarityNames);
        if (!rarity) {
            player.send(`No valid rarities found!`);
            return;
        }

        const item = ItemModule.getItemByVNum(vNum);
        if (item) {
            const newItem = ItemModule.createItem(player, item, rarity);
            ItemModule.mudServer.emit('createdItem', player, newItem, item);
            player.send(`You create ${newItem.displayString} out of thin air!`);
        } else {
            player.send(`Item vNum ${vNum} doesn't exist!`);
        }
    },
}

module.exports = ItemModule;
