// Importing necessary modules
const path = require('path');
const Inventory = require('./InventoryModule/Inventory');
const { isNumber } = require('../Utils/helpers');
const Item = require('./ItemModule/Item');

// Inventory module
const InventoryModule = {
    ITEMS_PATH: path.join(__dirname, '../system', 'items.json'),
    name: "Inventory",

    dropItem(player, args) {
        const [item] = args;
        let itemDropped = false;

        if (player.hasItemLike(item)) {
            for (let [key, value] of player.inventory.entries()) {
                // Check if any item in this stack matches the given name
                const index = value.findIndex(i => i.name?.toLowerCase().includes(item?.toLowerCase()));

                if (index !== -1) {
                    const droppedItem = value[index];
                    const vNum = key;

                    // Remove the individual item from the stack
                    value.splice(index, 1);

                    // If the stack is empty, remove the key from the inventory
                    if (value.length === 0) {
                        player.inventory.delete(key);
                    }

                    // Add the item to the room's inventory
                    if (!player.currentRoom.inventory.addItem(vNum, droppedItem)) {
                        player.inventory.addItem(vNum, droppedItem);
                    } else {
                        player.send(`Dropped ${droppedItem.name}!`);
                        itemDropped = true;
                        return true;
                    }
                }
            }

            if (!itemDropped) {
                if (player.currentRoom.inventory.full) player.send(`Room is full!`);
                else player.send(`Failed to drop ${item}!`);
                return false;
            }
        } else {
            player.send(`${item} not found!`);
            return false;
        }
    },

    dropAll(player, args) {
        const [item] = args;

        if (item) {
            if (player.hasItemLike(item)) {
                while (player.hasItemLike(item)) {
                    InventoryModule.dropItem(player, [item]);
                }

                if (!player.hasItemLike(item)) {
                    player.send(`Dropped all of ${item} successfully.`);
                    return true;
                }

                player.send(`Failed to drop all of ${item}!`);
                return false;
            }

            player.send(`${item} not found!`);
            return false;
        } else {
            const allItems = [];

            // Collect all items in the player's inventory
            for (let [key, value] of player.inventory.entries()) {
                for (let item of value) {
                    allItems.push([key, item.name]);
                }
            }

            // Drop all collected items
            for (let [key, itemName] of allItems) {
                InventoryModule.dropItem(player, [itemName]);
            }

            if (player.inventory.size === 0) {
                player.send(`Dropped all items successfully.`);
                return true;
            }

            player.send(`Failed to drop all items!`);
            return false;
        }
    },

    init: function (mudServer) {
        global.InventoryModule = this;
        this.mudServer = mudServer;
        this.registerEvents();
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
        player.hasItemLike = function (item) {
            if (!isNumber(item)) {
                // Look through the inventory for any item with this vNum
                for (let [key, value] of this.inventory.entries()) {
                    if (value[0].name?.toLowerCase().includes(item?.toLowerCase())) {
                        return true;
                    }
                }
            } else {
                return this.inventory.has(item);
            }

            return false;
        };

        InventoryModule.mudServer.mudEmitter.emit('updatePlayerItems', player, player.inventory);
    },

    onLooked(player) {
        if (player.currentRoom && player.currentRoom.inventory) {
            player.currentRoom.inventory?.forEach((details) => {
                player.send(`(${details.length}) ${details[0].name}: ${details[0].description}`);
            });
        }
    },

    onRoomAdded(room, roomData) {
        if (!room.inventory) {
            room.inventory = new Inventory(10); // Assuming Inventory is correctly imported or defined elsewhere
            roomData.inventory?.forEach(itemData => {
                for (const item of itemData.data) {
                    room.inventory.addItem(itemData.vNum, new Item(itemData.vNum, item.name, item.description, item.itemType), true);
                }
            });
            room.hasItem = function (item) {
                if (!isNumber(item)) {
                    // Look through the inventory for any item with this description
                    for (let [key, value] of this.inventory.entries()) {
                        if (value[0].name?.toLowerCase() === item?.toLowerCase()) {
                            return true;
                        }
                    }
                } else {
                    return room.inventory.has(item);
                }

                return false;
            };
            room.hasItemLike = function (item) {
                if (!isNumber(item)) {
                    // Look through the inventory for any item with this vNum
                    for (let [key, value] of this.inventory.entries()) {
                        if (value[0].name?.toLowerCase().includes(item?.toLowerCase())) {
                            return true;
                        }
                    }
                } else {
                    return this.inventory.has(item);
                }

                return false;
            };
            room.onSpawn();
        }
    },

    getRoomInventory(area, roomObj) {
        for (const section of area.sections.values()) {
            for (const room of section.rooms.values()) {
                if (room.x == roomObj.x && room.y == roomObj.y && room.z == roomObj.z) {
                    return room.inventory;
                }
            }
        }
    },

    registerEvents() {
        const { mudEmitter } = InventoryModule.mudServer;
        mudEmitter.on('hotBootBefore', InventoryModule.onHotBootBefore);
        mudEmitter.on('playerLoggedIn', InventoryModule.onPlayerLoggedIn);
        mudEmitter.on('looked', InventoryModule.onLooked);
        mudEmitter.on('roomAdded', InventoryModule.onRoomAdded);
    },

    removeEvents() {
        const { mudEmitter } = InventoryModule.mudServer;
        mudEmitter.removeListener('hotBootBefore', InventoryModule.onHotBootBefore);
        mudEmitter.removeListener('playerLoggedIn', InventoryModule.onPlayerLoggedIn);
        mudEmitter.removeListener('looked', InventoryModule.onLooked);
        mudEmitter.removeListener('roomAdded', InventoryModule.onRoomAdded);
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
                if (details[0].name.toLowerCase().includes(searchTerm.toLowerCase())) {
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

    takeAllItems(player, args) {
        const [takeItem] = args; 

        if (player.currentRoom && player.currentRoom.inventory) {
            const allItems = [];

            // Collect all items in the room
            for (let [key, value] of player.currentRoom.inventory.entries()) {
                for (let item of value) {
                    // Apply the optional item
                    if (!takeItem || item.name.toLowerCase().includes(takeItem.toLowerCase())) {
                        allItems.push([key, item]);
                    }
                }
            }

            // Pick up all collected items
            for (let [key, item] of allItems) {
                const removed = player.currentRoom.inventory.removeItem(key, item);
                if (removed) {
                    if (!player.inventory.addItem(key, item)) {
                        player.currentRoom.inventory.addItem(key, item); // Re-add item if inventory is full
                        player.send(`Inventory is full! Failed to pick up ${item.name}.`);
                    } else {
                        player.send(`Picked up ${item.name}!`);
                    }
                }
            }

            if (allItems.length > 0) {
                if (player.currentRoom.inventory.size === 0) {
                    player.send(`Picked up all items${takeItem ? ` matching '${takeItem}'` : ''} successfully.`);
                } else {
                    player.send(`Failed to pick up all items${takeItem ? ` matching '${takeItem}'` : ''}!`);
                }
            } else {
                player.send(`No items found${takeItem ? ` matching '${takeItem}'` : ''}.`);
            }
        } else {
            player.send(`No items to pick up!`);
        }
    },

    takeItem(player, args) {
        const [item] = args;
        if (player.currentRoom.hasItemLike(item)) {
            for (let [key, value] of player.currentRoom.inventory.entries()) {
                if (value[0].name?.toLowerCase().includes(item?.toLowerCase())) {
                    const takenItem = value[0];
                    const vNum = key;
                    const removed = player.currentRoom.inventory.removeItem(key);
                    if (removed) {
                        if (!player.inventory.addItem(vNum, takenItem)) {
                            player.currentRoom.inventory.addItem(vNum, takenItem);
                        } else {
                            player.send(`Picked up ${takenItem.name}!`);
                            return true;
                        }
                    }
                }
            }

            if (player.inventory.full) player.send(`Inventory is full!`);
            else player.send(`Failed to pick-up ${item}!`);
            return false;
        }
        player.send(`${item} not found!`);
        return false;
    },
}

module.exports = InventoryModule;