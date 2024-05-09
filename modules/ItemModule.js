// Importing necessary modules
const fs = require('fs');
const path = require('path');
const Item = require('./ItemModule/Item');
const { isNumber } = require('../Utils/helpers');

// Inventory module
const ItemModule = {
    ITEMS_PATH: path.join(__dirname, '../system', 'items.json'),
    name: "Item",
    itemsList: new Map(),
    init: function (mudServer) {
        global.ItemModule = this;
        this.mudServer = mudServer;
        this.registerEvents();
    },

    addItem(player, args) {
        // Check if necessary arguments are present
        if (args.length < 3) {
            player.send("Usage: addItem name \"description\" itemType");
            return;
        }

        const [name, description, itemType] = args;
        const lastEntry = Array.from(ItemModule.itemsList.entries())[ItemModule.itemsList.size - 1];
        const lastItemVNum = lastEntry[0];
        const vNumInt = parseInt(lastItemVNum) + 1;

        // Validate item number
        if (isNaN(vNumInt)) {
            player.send("Invalid item number.");
            return;
        }

        // Create a new item
        const newItem = new Item(vNumInt, name, description, itemType);

        // Add to the global items list
        ItemModule.itemsList.set(vNumInt, newItem);

        player.send(`Item added: ${name} (Type: ${itemType})`);
    },

    async editItem(player, args) {
        const [vNum, editWhat, value] = args;
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

        if (editWhat !== undefined) {
            switch (editWhat.toLowerCase()) {
                case "description":
                    const editorValue = await player.textEditor.startEditing(itemToEdit.description);
                    itemToEdit.description = editorValue;
                    break;
                case "name":
                    if (value === undefined || value == '') {
                        player.send('Must specify an item name!');
                        return;
                    }
                    itemToEdit.name = value;
                    break;
                case "type":
                    if (Item.getItemTypesArray().includes(value?.toLowerCase())) {
                        itemToEdit.itemType = Item.stringToItemType(value);
                    } else {
                        player.send(`Invalid type!`);
                        player.send(`Valid types: ${Item.getItemTypesArray()}`);
                        return;
                    }
                    break;
            }

            player.send(`Item editted successfully!`);
            ItemModule.updatePlayersItems();
        } else {
            player.send(`Usage: editItem <description | name | type>`);
        }
    },

    getItemByVNum(vNum) {
        if (isNumber(parseInt(vNum))) return ItemModule.itemsList.get(parseInt(vNum));
    },

    load(player) {
        try {
            const data = fs.readFileSync(ItemModule.ITEMS_PATH, 'utf8');
            const itemsData = JSON.parse(data);
            itemsData.forEach(item => {
                // Accessing the nested data structure
                const itemInfo = item.data;
                if (itemInfo) {
                    ItemModule.itemsList.set(parseInt(item.vNum), new Item(parseInt(item.vNum), itemInfo.name, itemInfo.description, itemInfo.itemType));
                }
            });
            console.log("Items loaded successfully.");
            if (player) player.send("Items loaded successfully.");
        } catch (err) {
            console.error('Error reading or parsing JSON file:', err);
            if (player) player.send("Failed to load items.");
        }
    },

    onHotBootBefore() {
        ItemModule.removeEvents();
    },

    onPlayerLoggedIn: (player) => {
        // const dustyKey = ItemModule.getItemByVNum(0);
        // player.inventory.addItem(player, dustyKey.vNum, dustyKey);
    },

    registerEvents() {
        const { mudEmitter } = ItemModule.mudServer;
        mudEmitter.on('hotBootBefore', ItemModule.onHotBootBefore);
        mudEmitter.on('playerLoggedIn', ItemModule.onPlayerLoggedIn);
        mudEmitter.on('updatePlayerItems', ItemModule.updatePlayerItems);
    },

    removeEvents() {
        const { mudEmitter } = ItemModule.mudServer;
        mudEmitter.removeListener('hotBootBefore', ItemModule.onHotBootBefore);
        mudEmitter.removeListener('playerLoggedIn', ItemModule.onPlayerLoggedIn);
        mudEmitter.removeListener('updatePlayerItems', ItemModule.updatePlayerItems);
    },

    async removeItem(player, args) {
        const [vNum] = args;

        const item = ItemModule.getItemByVNum(vNum);
        if(item) {
            const deleteForSure = await player.textEditor.showPrompt(`Delete ${item.name}? y/n`);

            if(deleteForSure.toLowerCase() == 'y' || deleteForSure == 'yes') {
                ItemModule.itemsList.delete(parseInt(vNum));
                ItemModule.updatePlayersItems();
                player.send(`${item.name} deleted successfully.`);
            } else {
                player.send(`${item.name} wasn't deleted.`);
            }
        }
    },

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

    serializeItems(itemsMap) {
        const itemsArray = [];
        for (const [vNum, item] of itemsMap.entries()) {
            const itemData = {
                vNum: parseInt(item.vNum),
                data: {
                    name: item.name,
                    description: item.description,
                    itemType: item.itemType
                }
            };
            itemsArray.push(itemData);
        }
        return itemsArray; // Pretty-print the JSON
    },

    updatePlayerItems(player, inventory) {
        for (const [key, items] of inventory.entries()) {
            const updatedItem = ItemModule.getItemByVNum(key);
            if (updatedItem) {
                items.forEach(item => {
                    Object.assign(item, updatedItem);
                    if (item.itemType === Item.ItemTypes.Container) {
                        ItemModule.updatePlayerItems(player, item.inventory);
                    }
                });
            } else inventory.delete(key);
        }
    },

    updatePlayersItems() {
        ItemModule.mudServer.players.forEach(player => {
            ItemModule.updatePlayerItems(player, player.inventory);
        });
    }
}

module.exports = ItemModule;