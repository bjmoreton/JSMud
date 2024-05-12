// Importing necessary modules
const fs = require('fs');
const path = require('path');
const Item = require('./ItemModule/Item');
const { isNumber } = require('../Utils/helpers');
const Key = require('./ItemModule/Key');

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
        if (args.length < 2) {
            player.send("Usage: addItem name itemType");
            return;
        }

        const [name, itemType] = args;
        const lastEntry = Array.from(ItemModule.itemsList.entries())[ItemModule.itemsList.size - 1];
        const lastItemVNum = lastEntry[0];
        const vNumInt = parseInt(lastItemVNum) + 1;

        // Validate item number
        if (isNaN(vNumInt)) {
            player.send("Invalid item number.");
            return;
        }

        // Create a new item
        const newItem = new Item.ItemTypes[itemType](vNumInt, name, name, '', itemType);
        console.log(newItem);

        // Add to the global items list
        ItemModule.itemsList.set(vNumInt, newItem);

        player.send(`Item added: ${newItem.name} (Type: ${newItem.itemType})`);
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
            player.send(`Usage: editItem vNum <description | name | type>`);
        }
    },

    getItemByVNum(vNum) {
        if (isNumber(parseInt(vNum))) return ItemModule.itemsList.get(parseInt(vNum));
    },

    load(player) {
        try {
            const data = fs.readFileSync(ItemModule.ITEMS_PATH, 'utf8');
            const itemsData = JSON.parse(data);
            Item.addItemType(Key);
            ItemModule.mudServer.emit('itemsLoading', player);
            itemsData.forEach(item => {
                // Accessing the nested data structure
                const itemInfo = item.data;
                if (itemInfo) {
                    const itemObj = new Item(parseInt(item.vNum), itemInfo.name, itemInfo.nameDisplay, itemInfo.description, itemInfo.itemType);
                    ItemModule.mudServer.emit('itemLoaded', itemObj, item);
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

    onHotBootBefore() {
        ItemModule.removeEvents();
    },

    onPlayerLoggedIn: (player) => {
        // const dustyKey = ItemModule.getItemByVNum(0);
        // for(let i = 0; i < 2; i++) player.inventory.addItem(dustyKey.vNum, dustyKey, true);
        // const bronzeKey = ItemModule.getItemByVNum(1);
        // for (let i = 0; i < 2; i++) player.inventory.addItem(bronzeKey.vNum, bronzeKey, true);
    },

    registerEvents() {
        ItemModule.mudServer.on('hotBootBefore', ItemModule.onHotBootBefore);
        ItemModule.mudServer.on('playerLoggedIn', ItemModule.onPlayerLoggedIn);
        ItemModule.mudServer.on('updatePlayerItems', ItemModule.updatePlayerItems);
    },

    removeEvents() {
        ItemModule.mudServer.removeListener('hotBootBefore', ItemModule.onHotBootBefore);
        ItemModule.mudServer.removeListener('playerLoggedIn', ItemModule.onPlayerLoggedIn);
        ItemModule.mudServer.removeListener('updatePlayerItems', ItemModule.updatePlayerItems);
    },

    async removeItem(player, args) {
        const [vNum] = args;

        const item = ItemModule.getItemByVNum(vNum);
        if (item) {
            const deleteForSure = await player.textEditor.showPrompt(`Delete ${item.name}? y/n`);

            if (deleteForSure.toLowerCase() == 'y' || deleteForSure == 'yes') {
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
                vNum: parseInt(vNum),
                data: {
                    name: item.name,
                    description: item.description,
                    itemType: item.itemType.toString()
                }
            };
            ItemModule.mudServer.emit('itemSerialized', item, itemData);
            itemsArray.push(itemData);
        }
        return itemsArray; // Pretty-print the JSON
    },

    updatePlayerItems(player, inventory) {
        for (const [key, items] of inventory.entries()) {
            const updatedItem = ItemModule.getItemByVNum(key);
            if (updatedItem) {
                items.forEach(item => {
                    let itemCopy = { ...item };
                    Object.assign(item, updatedItem);
                    ItemModule.mudServer.emit('updatePlayerItem', player, item, itemCopy, updatedItem);
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