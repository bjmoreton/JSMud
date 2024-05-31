// Importing necessary modules
const fs = require('fs');
const path = require('path');
const Item = require('./ItemModule/Item');
const { isNumber, sendNestedKeys } = require('./Mud/Helpers');
const Key = require('./ItemModule/Key');

/**
 * Inventory module for handling items in the MUD server.
 * 
 * @module ItemModule
 */
const ItemModule = {
    ITEMS_PATH: path.join(__dirname, '../system', 'items.json'),
    ITEM_RARITIES_PATH: path.join(__dirname, '../system', 'rarities.json'),
    name: "Item",
    itemsList: new Map(),
    editItemActions: new Map(),
    editItemRarityActions: new Map(),

    addEditItemAction(name, useCase, action = () => { }) {
        if (!ItemModule.editItemActions.has(name.toLowerCase())) {
            ItemModule.editItemActions.set(name.toLowerCase(), { action, useCase });
        }
    },

    addEditItemRarityAction(name, useCase, action = () => { }) {
        if (!ItemModule.editItemRarityActions.has(name.toLowerCase())) {
            ItemModule.editItemRarityActions.set(name.toLowerCase(), { action, useCase });
        }
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

    addItemRarity(player, args) {
        const [name, symbol, weight] = args;

        if (!name) {
            player.send(`Usage: additemrarity [name] [symbol] [weight]`);
            return;
        }

        if (!symbol) {
            player.send(`A symbol is needed.`);
            return;
        }

        if (!isNumber(weight)) {
            player.send(`Weight needs to be a number.`);
            return;
        }

        const rarity = Item.getRarityByName(name);
        if (!rarity) {
            Item.addItemRarities({ name: name, symbol: symbol, weight: weight });
        } else {
            player.send(`Rarity ${rarity.name} already exists!`);
            return;
        }

        player.send(`Item rarity ${name} added successfully!`);
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

            switch (editWhat.toLowerCase()) {
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
                        player.send('Must specify an item name!');
                        return;
                    }
                    itemToEdit.name = value?.trim();
                    break;
                default:
                    if (ItemModule.editItemActions.has(editWhat.toLowerCase())) {
                        const editAction = ItemModule.editItemActions.get(editWhat.toLowerCase());
                        await editAction.action(player, itemToEdit, eventObj);
                    } else {
                        player.send(`Usage: edititem [vNum] <description | flags | name>`);
                        for (const action of ItemModule.editItemActions.values()) {
                            player.send(`Usage: ${action.useCase}`);
                        }
                        return;
                    }
            }

            if (eventObj.saved) player.send(`Item edited successfully!`);
        } else {
            player.send(`Usage: edititem [vNum] <description | flags | name>`);
            for (const action of ItemModule.editItemActions.values()) {
                player.send(`Usage: ${action.useCase}`);
            }
        }
    },

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
                    case "symbol":
                        if (value === undefined || value?.trim() == '') {
                            player.send('Must specify a new item rarity symbol!');
                            return;
                        }
                        rarityToEdit.symbol = value.trim();
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

                if (eventObj.saved) player.send(`Item rarity edited successfully!`);
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

    /**
     * Edit the flags of an item.
     * 
     * @param {Player} player - The player editing the item.
     * @param {Item} item - The item being edited.
     * @param {string} action - The action to perform (add/remove).
     * @param {Array} data - The flags data.
     */
    editItemFlags(player, item, action, data) {
        switch (action?.toLowerCase()) {
            case "add":
                item.addFlag(...data);
                player.send(`New flags: ${item.flags}`);
                break;
            case "remove":
                item.removeFlag(...data);
                player.send(`New flags: ${item.flags}`);
                break;
            default:
                player.send(`Usage: editItem vNum flags <add | remove>`);
                player.send(`Valid flags: ${Item.getItemFlagsArray()}`);
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
     * Load items from the JSON file.
     * 
     * @param {Player} player - The player initiating the load.
     */
    load(player) {
        try {
            ItemModule.loadItemRarities(player);

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
            console.log("Items loaded successfully.");
            if (player) player.send("Items loaded successfully.");
        } catch (err) {
            console.error('Error reading or parsing JSON file:', err);
            if (player) player.send("Failed to load items.");
        }
    },

    loadItemRarities(player) {
        try {
            const data = fs.readFileSync(ItemModule.ITEM_RARITIES_PATH, 'utf8');
            const rarityData = JSON.parse(data);

            Object.values(rarityData).forEach(rarity => {
                Item.addItemRarities(rarity);
            });

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
                ItemModule.itemsList.delete(parseInt(vNum));
                player.send(`${item.name} deleted successfully.`);
            } else {
                player.send(`${item.name} wasn't deleted.`);
            }
        }
    },

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
                Item.ItemRarities.delete(rarity.name.toLowerCase());
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
            console.log("Items saved successfully.");
            if (player) player.send("Items saved successfully.");
        } catch (error) {
            console.error("Failed to save items:", error);
            if (player) player.send("Failed to save items.");
        }
    },

    saveItemRarities(player) {
        try {
            fs.writeFileSync(ItemModule.ITEM_RARITIES_PATH, JSON.stringify(Item.ItemRarities, null, 2), 'utf8');
            console.log("Item rarities saved successfully.");
            if (player) player.send("Item rarities saved successfully.");
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
            itemsArray.push(itemData);
        }
        return itemsArray; // Pretty-print the JSON
    },

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
        const [vNum, weightOffset, ...rarityNames] = args;
        if (args.length === 0) {
            player.send(`Usage: spawnItem [vNum] [weightOffset] [...Rarities]`);
            return;
        }

        if (!isNumber(vNum)) {
            player.send(`Invalid item vNum!`);
            return;
        }

        if (!isNumber(weightOffset)) {
            player.send(`Invalid weightOffset enter 0 for none.`);
            return;
        }

        const rarity = Item.getRandomRarity(parseInt(weightOffset), ...rarityNames);
        if (!rarity) {
            player.send(`No valid rarities found!`);
            return;
        }

        const item = ItemModule.getItemByVNum(vNum)?.copy();
        if (item) {
            item.rarity = rarity;
            ItemModule.mudServer.emit('createdItem', player, item);
            player.send(`You create ${item.displayString} out of thin air!`);
            player.inventory.addItem(item.vNum, item);
        } else {
            player.send(`Item vNum ${vNum} doesn't exist!`);
        }
    }
}

module.exports = ItemModule;
