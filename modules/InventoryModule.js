// Importing necessary modules
const path = require('path');
const Inventory = require('./InventoryModule/Inventory');
const { isNumber, mapGetByIndex } = require('../Utils/helpers');
const Container = require('./InventoryModule/Container');
const Item = require('./ItemModule/Item');

// Inventory module
const InventoryModule = {
    ITEMS_PATH: path.join(__dirname, '../system', 'items.json'),
    name: "Inventory",

    dropAll(player, args) {
        let [itemString] = args;

        let itemIndex = 0;
        const indexPattern = /^(\d+)\.(.*)/;
        const match = itemString?.match(indexPattern);

        if (match) {
            // Extract index and new itemString
            itemIndex = parseInt(match[1], 10);
            itemString = match[2].trim();
        }

        let foundItems = player.hasItemLike(itemString);

        if (foundItems) {
            if (itemIndex >= 0 && itemIndex < foundItems.size) {
                foundItems = mapGetByIndex(foundItems, itemIndex);
            } else {
                player.send(`Index ${itemIndex} is out of range!`);
                return false;
            }

            let droppedCount = 0;
            for (const foundItemId in foundItems) {
                for (let foundItem in foundItems[foundItemId]) {
                    foundItem = foundItems[foundItemId][foundItem];
                    const itemStack = player.inventory.get(foundItem.vNum);

                    // Move all items from player's inventory to the room's inventory
                    while (itemStack?.length > 0) {
                        const item = itemStack.shift(); // Retrieve an item from the stack

                        if (player.currentRoom.inventory.addItem(item.vNum, item)) {
                            player.send(`Dropped ${item.name} successfully.`);
                            droppedCount++;
                        } else {
                            // Failed to add to the room, return the item back to the player's inventory
                            player.inventory.addItem(item.vNum, item, true);
                            player.send(`Failed to drop ${item.name}!`);
                            break;
                        }
                    }

                    // Remove the empty inventory entry if necessary
                    if (itemStack?.length === 0) {
                        player.inventory.delete(foundItem.vNum);
                    }
                }
            }

            if (droppedCount > 0) {
                if (!match) return InventoryModule.dropAll(player, args);
                return true;
            } else {
                return false;
            }
        } else {
            if (match) player.send(`${itemString} not found!`);
            else player.send(`Nothing left to drop!`);
            return false;
        }
    },

    dropItem(player, args) {
        let [itemString] = args;
        let itemIndex = 0;
        const indexPattern = /^(\d+)\.(.*)/;
        const match = itemString?.match(indexPattern);

        if (itemString === undefined) return;

        if (match) {
            // Extract index and new itemString
            itemIndex = parseInt(match[1], 10);
            itemString = match[2].trim();
        }

        let foundItems = player.hasItemLike(itemString);

        if (foundItems) {
            if (itemIndex < 0 && itemIndex >= foundItems.size) {
                player.send(`Index ${itemIndex} is out of range!`);
                return false;
            }

            const foundItem = Array.from(foundItems.values())[itemIndex][0];
            if (!player.currentRoom.inventory.addItem(foundItem.vNum, foundItem)) {
                player.inventory.addItem(foundItem.vNum, foundItem);
                player.send(`Failed to drop ${foundItem.name}!`);
                return false;
            } else {
                player.send(`Dropped ${foundItem.name} successfully.`);
                player.inventory.get(foundItem.vNum).splice(0, 1);
                if (player.inventory.get(foundItem.vNum).length === 0) {
                    player.inventory.delete(foundItem.vNum);
                }
                return true;
            }
        } else {
            player.send(`${itemString} not found!`);
            return false;
        }
    },

    init: function (mudServer) {
        global.InventoryModule = this;
        this.mudServer = mudServer;
        this.registerEvents();
    },

    onHotBootAfter() {
        InventoryModule.mudServer.players.forEach(player => {
            InventoryModule.addPlayerMethods(player);
        });
    },

    onHotBootBefore() {
        InventoryModule.removeEvents();
    },

    onItemLoaded(item, itemInfo) {
        if (item.itemType === Item.ItemTypes.Container) {
            item.inventory = Inventory.deserialize(null, JSON.stringify(itemInfo.data.inventory), itemInfo.data.inventory.maxSize);
        }
    },

    onItemsLoading(player) {
        Item.addItemType(Container);
    },

    onItemSerialized(item, itemData) {
        if (item !== undefined) {
            if (item.itemType === Item.ItemTypes.Container) {
                itemData.data.inventory = item.inventory.serialize();
            }
        }
    },

    onPlayerLoaded(player, playerData) {
        if (player.inventory !== undefined) player.inventory = Inventory.deserialize(player, JSON.stringify(playerData.inventory), playerData.inventory.maxSize);

        // global.ItemModule.addItem(player, ['Old brown bag', 'Container']);
        // const oldBag = global.ItemModule.getItemByVNum(2);
        // player.inventory.addItem(oldBag.vNum, oldBag, true);
    },

    onPlayerLoggedIn: (player) => {
        if (player.inventory == undefined || player.inventory == null) player.inventory = new Inventory();
        InventoryModule.addPlayerMethods(player);
        InventoryModule.mudServer.emit('updatePlayerItems', player, player.inventory);
    },

    addPlayerMethods(player) {
        player.hasItem = function (item) {
            if (!isNumber(item)) {
                // Look through the inventory for any item with this vNum
                for (let [key, value] of this.inventory.entries()) {
                    if (value[0].name?.toLowerCase() === item?.toLowerCase()) {
                        return value;
                    }
                }
            } else {
                return this.inventory.get(item);
            }

            return false;
        };
        player.hasItemLike = function (itemString) {
            const search = itemString?.toLowerCase();
            let foundItems = new Map();

            for (const [vNum, items] of this.inventory.entries()) {
                for (const item of items) {
                    if (item.name.toLowerCase().includes(search) || search === undefined) {
                        if (!foundItems.has(item.vNum)) foundItems.set(item.vNum, []);
                        foundItems.get(item.vNum).push(item);
                    }
                }
            }

            return foundItems.size ? foundItems : null;
        };
    },

    onPlayerSaved(player, playerData) {
        playerData.inventory = player.inventory.serialize();

        return playerData;
    },

    onLooked(player) {
        if (player.currentRoom && player.currentRoom.inventory) {
            player.currentRoom.inventory?.forEach((details) => {
                player.send(`(${details.length}) ${details[0].name}: ${details[0].description}`);
            });
        }
    },

    onRoomLoaded(room, roomData) {
        if (!room.defaultState.inventory) {
            room.defaultState.inventory = new Inventory(roomData.defaultState?.inventory?.maxSize ?? 20);
            roomData.defaultState?.inventory?.forEach(itemData => {
                for (const item of itemData.data) {
                    room.defaultState.inventory.addItem(itemData.vNum, global.ItemModule.getItemByVNum(itemData.vNum), true);
                }
            });
        }

        if (!room.inventory) {
            room.inventory = new Inventory(room.defaultState.inventory.maxSize); // Assuming Inventory is correctly imported or defined elsewhere
            room.defaultState.inventory?.forEach(itemData => {
                for (const item of itemData) {
                    room.inventory.addItem(item.vNum, global.ItemModule.getItemByVNum(item.vNum), true);
                }
            });

            room.hasItem = function (item) {
                if (!isNumber(item)) {
                    // Look through the inventory for an item with a specific name
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

            room.hasItemLike = function (itemString) {
                const search = itemString?.toLowerCase();
                let foundItems = new Map();

                for (const [vNum, items] of this.inventory.entries()) {
                    for (const item of items) {
                        if (item.name.toLowerCase().includes(search) || search === undefined) {
                            if (!foundItems.has(vNum)) foundItems.set(vNum, []);
                            foundItems.get(vNum).push(item);
                        }
                    }
                }

                return foundItems.size ? foundItems : null;
            };
        }
    },

    onRoomSaved(player, room, roomData) {
        roomData.defaultState.inventory = room.defaultState.inventory.serialize();
    },

    onRoomStateSaved(player, room) {
        room.inventory?.forEach(itemData => {
            for (const item of itemData) {
                room.defaultState?.inventory?.addItem(item.vNum, global.ItemModule.getItemByVNum(item.vNum), true);
            }
        });
    },

    onUpdatePlayerItem(player, item, itemCopy, updatedItem) {
        if (item.itemType === Item.ItemTypes.Container) {
            item.inventory = itemCopy.inventory;
            //item.inventory.maxSize = updatedItem.inventory.maxSize;
            InventoryModule.mudServer.emit('updatePlayerItems', player, item.inventory)
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
        InventoryModule.mudServer.on('hotBootAfter', InventoryModule.onHotBootAfter);
        InventoryModule.mudServer.on('hotBootBefore', InventoryModule.onHotBootBefore);
        InventoryModule.mudServer.on('itemLoaded', InventoryModule.onItemLoaded);
        InventoryModule.mudServer.on('itemsLoading', InventoryModule.onItemsLoading);
        InventoryModule.mudServer.on('itemSerialized', InventoryModule.onItemSerialized);
        InventoryModule.mudServer.on('looked', InventoryModule.onLooked);
        InventoryModule.mudServer.on('playerLoaded', InventoryModule.onPlayerLoaded);
        InventoryModule.mudServer.on('playerLoggedIn', InventoryModule.onPlayerLoggedIn);
        InventoryModule.mudServer.on('playerSaved', InventoryModule.onPlayerSaved);
        InventoryModule.mudServer.on('roomLoaded', InventoryModule.onRoomLoaded);
        InventoryModule.mudServer.on('roomSaved', InventoryModule.onRoomSaved);
        InventoryModule.mudServer.on('roomStateSaved', InventoryModule.onRoomStateSaved);
        InventoryModule.mudServer.on('updatePlayerItem', InventoryModule.onUpdatePlayerItem);
    },

    removeEvents() {
        InventoryModule.mudServer.removeListener('hotBootAfter', InventoryModule.onHotBootAfter);
        InventoryModule.mudServer.removeListener('hotBootBefore', InventoryModule.onHotBootBefore);
        InventoryModule.mudServer.removeListener('itemLoaded', InventoryModule.onItemLoaded);
        InventoryModule.mudServer.removeListener('itemsLoading', InventoryModule.onItemsLoading);
        InventoryModule.mudServer.removeListener('itemSerialized', InventoryModule.onItemSerialized);
        InventoryModule.mudServer.removeListener('looked', InventoryModule.onLooked);
        InventoryModule.mudServer.removeListener('playerLoaded', InventoryModule.onPlayerLoaded);
        InventoryModule.mudServer.removeListener('playerLoggedIn', InventoryModule.onPlayerLoggedIn);
        InventoryModule.mudServer.removeListener('playerSaved', InventoryModule.onPlayerSaved);
        InventoryModule.mudServer.removeListener('roomLoaded', InventoryModule.onRoomLoaded);
        InventoryModule.mudServer.removeListener('roomSaved', InventoryModule.onRoomSaved);
        InventoryModule.mudServer.removeListener('roomStateSaved', InventoryModule.onRoomStateSaved);
        InventoryModule.mudServer.removeListener('updatePlayerItem', InventoryModule.onUpdatePlayerItem);
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
        let [takeItem] = args;

        let itemIndex = 0;
        const indexPattern = /^(\d+)\.(.*)/;
        const match = takeItem?.match(indexPattern);

        if (match) {
            itemIndex = parseInt(match[1], 10);
            takeItem = match[2].trim();
        }

        if (player.currentRoom && player.currentRoom.inventory) {
            let foundItems = player.currentRoom.hasItemLike(takeItem);

            if (foundItems) {
                if (itemIndex >= 0 && itemIndex < foundItems.size) {
                    foundItems = mapGetByIndex(foundItems, itemIndex);
                }

                let pickedCount = 0;
                for (const foundItemId in foundItems) {
                    for (let foundItem in foundItems[foundItemId]) {
                        foundItem = foundItems[foundItemId][foundItem];
                        if (player.currentRoom.inventory.removeItem(foundItem.vNum, foundItem)) {
                            if (!player.inventory.addItem(foundItem.vNum, foundItem)) {
                                player.currentRoom.inventory.addItem(foundItem.vNum, foundItem, true); // Re-add item if inventory is full
                                player.send(`Inventory is full! Failed to pick up ${foundItem.name}.`);
                                break;
                            } else {
                                player.send(`Picked up ${foundItem.name}!`);
                                pickedCount++;
                            }
                        }
                    }
                }

                if (pickedCount > 0) {
                    if (!match) return InventoryModule.takeAllItems(player, args);
                    return true;
                } else {
                    return false;
                }
            } else {
                if (match) player.send(`${takeItem} not found!`);
                else player.send(`Nothing left to pick up!`);
                return false;
            }
        } else {
            player.send(`No items to pick up!`);
            return false;
        }
    },


    takeItem(player, args) {
        let [itemString] = args;

        let itemIndex = 0;
        const indexPattern = /^(\d+)\.(.*)/;
        const match = itemString.match(indexPattern);

        if (match) {
            // Extract index and new itemString
            itemIndex = parseInt(match[1], 10);
            itemString = match[2].trim();
        }

        let foundItems = player.currentRoom.hasItemLike(itemString);

        if (foundItems && foundItems.size > 0) {
            if (itemIndex >= 0 && itemIndex < foundItems.size) {
                // Map the items from the map into an array to access them by index
                let itemArray = [];
                foundItems = mapGetByIndex(foundItems, itemIndex);

                for (const foundItemId in foundItems) {
                    for (const foundItem in foundItems[foundItemId]) {
                        itemArray.push(foundItems[foundItemId][foundItem]);
                    }
                }

                // Check if the itemIndex is valid
                if (itemArray.length > itemIndex) {
                    let selectedItem = itemArray[itemIndex];
                    if (player.currentRoom.inventory.removeItem(selectedItem.vNum, selectedItem)) {
                        if (!player.inventory.addItem(selectedItem.vNum, selectedItem)) {
                            // If adding the item fails, put it back in the room inventory
                            player.currentRoom.inventory.addItem(selectedItem.vNum, selectedItem, true);
                            player.send(`Inventory is full! Failed to pick up ${selectedItem.name}.`);
                        } else {
                            player.send(`Picked up ${selectedItem.name}!`);
                            return true;
                        }
                    } else {
                        player.send(`Failed to pick up ${selectedItem.name}!`);
                    }
                } else {
                    player.send(`Index ${itemIndex} is out of range!`);
                }
            } else {
                player.send(`Index ${itemIndex} is out of range!`);
            }
        } else {
            player.send(`${itemString} not found!`);
        }
        return false;
    },
}

module.exports = InventoryModule;