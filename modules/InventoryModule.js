// Importing necessary modules
const fs = require('fs');
const path = require('path');
const Item = require('./InventoryModule/Item');
const Inventory = require('./InventoryModule/Inventory');
const { isNumber } = require('../Utils/helpers');

// Inventory module
const InventoryModule = {
    ITEMS_PATH: path.join(__dirname, '../system', 'items.json'),
    name: "Inventory",
    itemsList: new Map(),
    init: function (mudServer) {
        this.mudServer = mudServer;
        this.loadItems();
        this.registerEvents();
    },

    addItem(player, args) {
        // Check if necessary arguments are present
        if (args.length < 3) {
            player.send("Usage: addItem name \"description\" itemType");
            return;
        }
    
        const [name, description, itemType] = args;
        const lastEntry = Array.from(InventoryModule.itemsList.entries())[InventoryModule.itemsList.size - 1];
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
        InventoryModule.itemsList.set(vNumInt, newItem);
    
        // Optionally add to player's personal inventory
        player.inventory.addItem(vNumInt, newItem);
    
        player.send(`Item added: ${name} (Type: ${itemType})`);
    },

    editItem(player, args) {

    },

    loadItems(player) {
        try {
            const data = fs.readFileSync(InventoryModule.ITEMS_PATH, 'utf8');
            const itemsData = JSON.parse(data);
            itemsData.forEach(item => {
                // Accessing the nested data structure
                const itemInfo = item.data;
                if (itemInfo) {
                    InventoryModule.itemsList.set(item.vNum, new Item(item.vNum, itemInfo.name, itemInfo.description, itemInfo.itemType));
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
        InventoryModule.removeEvents();
    },

    onPlayerLoggedIn: (player) => {
        if (player.inventory == undefined || player.inventory == null) player.inventory = new Inventory();
        player.hasItem = function (item) {
            if (!isNumber(item)) {
                // Look through the inventory for any item with this vNum
                for (let [key, value] of this.inventory.entries()) {
                    if (value[0].name?.toLowerCase() === item?.toLowerCase()) {
                        return true;
                    }
                }
            } else {
                return this.inventory.has(item);
            }

            return false;
        };

        player.inventory.addItem(0, new Item(0, 'Dusty Key', 'An old dusty key.', Item.ItemTypes.Key));
    },

    registerEvents() {
        const { mudEmitter } = InventoryModule.mudServer;
        mudEmitter.on('hotBootBefore', InventoryModule.onHotBootBefore);
        mudEmitter.on('playerLoggedIn', InventoryModule.onPlayerLoggedIn);
    },

    removeEvents() {
        const { mudEmitter } = InventoryModule.mudServer;
        mudEmitter.removeListener('hotBootBefore', InventoryModule.onHotBootBefore);
        mudEmitter.removeListener('playerLoggedIn', InventoryModule.onPlayerLoggedIn);
    },

    saveItems(player) {
        try {
            const serializedData = serializeItems(InventoryModule.itemsList);
            fs.writeFileSync(InventoryModule.ITEMS_PATH, serializedData, 'utf8');
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
                vNum: item.vNum,
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

    showInventory(player, args) {
        const [searchTerm] = args;

        // Header or introductory text for inventory
        player.send("Your inventory:");

        // Check if the inventory is empty
        if (player.inventory.size === 0) {
            player.send("You are carrying nothing.");
            return;
        }

        if (searchTerm === undefined) {
            // Display all items if no search term is provided
            player.inventory.forEach((details) => {
                player.send(`(${details.length}) ${details[0].name}: ${details[0].description}`);
            });
        } else {
            // Display only items that include the search term in their name
            let found = false;
            player.inventory.forEach((details) => {
                if (itemName.toLowerCase().includes(searchTerm.toLowerCase())) {
                    player.send(`(${details.length}) ${details[0].name}: ${details[0].description}`);
                    found = true;
                }
            });
            // Feedback if no items matched the search term
            if (!found) {
                player.send(`No items found matching '${searchTerm}'.`);
            }
        }
    },
}

module.exports = InventoryModule;