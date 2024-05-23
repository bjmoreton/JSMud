// Importing necessary modules
const path = require('path');
const Inventory = require('./InventoryModule/Inventory');
const Container = require('./InventoryModule/Container');
const Item = require('./ItemModule/Item');

// Inventory module
const InventoryModule = {
    ITEMS_PATH: path.join(__dirname, '../system', 'items.json'),
    name: "Inventory",

    /**
     * Drop all items matching the given name from the player's inventory into the current room.
     * 
     * @param {Player} player - The player dropping the items.
     * @param {Array} args - The arguments containing the item name.
     * @returns {boolean} - True if items were dropped successfully, false otherwise.
     */
    dropAll(player, args) {
        let [itemString] = args;

        let itemIndex = undefined;
        const indexPattern = /^(\d+)\.(.*)/;
        const match = itemString?.match(indexPattern);

        if (match) {
            itemIndex = parseInt(match[1], 10);
            itemString = match[2].trim();
        }

        let foundItems = player.inventory.findAllItemsByName(itemString);
        if (foundItems.length === 0) {
            player.send(`${itemString} not found!`);
            return false;
        }

        if (itemIndex !== undefined) {
            if (itemIndex >= 0 && itemIndex < foundItems.length) {
                foundItems = [foundItems[itemIndex]];
            } else {
                player.send(`Index ${itemIndex} out of bounds for ${itemString}!`);
                return false;
            }
        }

        for (const foundItem of foundItems) {
            if (player.currentRoom.inventory.addItem(foundItem.vNum, foundItem)) {
                player.send(`Dropped ${foundItem.displayString} successfully.`);
                player.inventory.removeItem(foundItem);
            } else {
                player.send(`Failed to drop ${foundItem.displayString}!`);
                return false;
            }
        }
        return true;
    },

    /**
     * Drop a specific item from the player's inventory into the current room.
     * 
     * @param {Player} player - The player dropping the item.
     * @param {Array} args - The arguments containing the item name and index.
     * @returns {boolean} - True if the item was dropped successfully, false otherwise.
     */
    dropItem(player, args) {
        let [itemString] = args;
        let itemIndex = 0;
        const indexPattern = /^(\d+)\.(.*)/;
        const match = itemString?.match(indexPattern);

        if (itemString === undefined) return;

        if (match) {
            itemIndex = parseInt(match[1], 10);
            itemString = match[2].trim();
        }

        let foundItems = player.inventory.findAllItemsByName(itemString);
        if (foundItems.length === 0) {
            player.send(`${itemString} not found!`);
            return false;
        }

        if (itemIndex >= 0 && itemIndex < foundItems.length) {
            const foundItem = foundItems[itemIndex];
            if (!player.currentRoom.inventory.addItem(foundItem.vNum, foundItem)) {
                player.send(`Failed to drop ${foundItem.displayString}!`);
                return false;
            } else {
                player.send(`Dropped ${foundItem.displayString} successfully.`);
                player.inventory.removeItem(foundItem);
                return true;
            }
        } else {
            player.send(`Index ${itemIndex} out of bounds for ${itemString}!`);
            return false;
        }
    },

    /**
     * Get the inventory of a room by matching coordinates.
     * 
     * @param {Area} area - The area containing the room.
     * @param {Object} roomObj - The room object with coordinates.
     * @returns {Inventory} - The inventory of the matched room.
     */
    getRoomInventory(area, roomObj) {
        for (const section of area.sections.values()) {
            for (const room of section.rooms.values()) {
                if (room.x == roomObj.x && room.y == roomObj.y && room.z == roomObj.z) {
                    return room.inventory;
                }
            }
        }
    },

    /**
     * Handle taking items from a container.
     * 
     * @param {Player} player - The player taking the items.
     * @param {string} itemName - The name of the item to take.
     * @param {number} itemIndex - The index of the item to take.
     * @param {string} containerName - The name of the container.
     * @param {number} containerIndex - The index of the container.
     */
    handleTakeFromContainer(player, itemName, itemIndex, containerName, containerIndex) {
        let containers = [
            ...player.currentRoom.inventory.findAllContainersByName(containerName),
            ...player.inventory.findAllContainersByName(containerName)
        ];

        if (containerIndex !== undefined && containers.length > containerIndex) {
            containers = [containers[containerIndex]]; // Select specific container by index if within range
        } else {
            containers = [containers[0]];
        }

        containers.forEach(container => {
            if (container === undefined) return;

            let itemsArray = [];

            if (itemName) {
                // Collect items matching the type from the container's inventory
                container.inventory.forEach(rarityMap => {
                    rarityMap.forEach(items => {
                        items.forEach(item => {
                            if (item.name.toLowerCase().includes(itemName.toLowerCase())) {
                                itemsArray.push(item);
                            }
                        });
                    });
                });
            } else {
                // Flatten all items if no specific type is provided
                container.inventory.forEach(rarityMap => {
                    rarityMap.forEach(items => {
                        itemsArray.push(...items);
                    });
                });
            }

            if (itemIndex !== undefined && itemsArray.length > itemIndex) {
                itemsArray = [itemsArray[itemIndex]]; // Select specific item by index if within range
            }

            itemsArray.forEach(item => {
                if (player.inventory.addItem(item.vNum, item)) {
                    container.inventory.removeItem(item); // Remove the item from the container inventory
                    player.send(`You took ${item.displayString} from ${container.displayString}.`);
                }
            });
        });
    },

    /**
     * Initialize the Inventory module.
     * 
     * @param {MudServer} mudServer - The mud server instance.
     */
    init: function (mudServer) {
        global.InventoryModule = this;
        this.mudServer = mudServer;
        this.registerEvents();
    },

    /**
     * Handle the look command executed by a player.
     * 
     * @param {Player} player - The player executing the look command.
     * @param {Array} args - The arguments for the look command.
     * @param {Object} eventObj - The event object.
     */
    onExecutedLook(player, args, eventObj) {
        eventObj.handled = true;
        const parsePattern = /^(\d+)\.(.*)$/;
        let [itemString] = args;
        let itemMatch = itemString.match(parsePattern);
        let itemName = itemMatch ? itemMatch[2].trim() : itemString.trim();
        let itemIndex = itemMatch ? parseInt(itemMatch[1], 10) : 0; // Convert to zero-based index

        // Gather all items from both player's inventory and room's inventory
        let combinedItems = [
            ...player.inventory.findAllItemsByName(itemName),
            ...player.currentRoom.inventory.findAllItemsByName(itemName)
        ];

        if (combinedItems.length === 0) {
            eventObj.handled = false;
            player.send(`No items named ${itemName} found.`);
            return;
        }

        let item = itemIndex >= 0 && itemIndex < combinedItems.length ? combinedItems[itemIndex] : combinedItems[0]; // Take indexed item or first if no index provided
        if (!item) {
            eventObj.handled = false;
            player.send(`No items found at index ${itemIndex} for ${itemName}.`);
            return;
        }

        // Provide details about the item or list contents if it's a container
        if (item.inventory) {
            player.send(`Looking in ${item.displayString} it contains:`);
            item.inventory.forEach((details) => {
                for (const items of details.values()) {
                    player.send(`(${items.length}) ${items[0].displayString}: ${items[0].description}`);
                }
            });
        } else {
            player.send(`Looking at ${item.displayString}: ${item.description}`);
        }
    },

    /**
     * Update inventory references after a hot boot.
     */
    onHotBootAfter() {
        InventoryModule.mudServer.players.forEach(player => {
            InventoryModule.updateInventoryReferences(player.inventory);
        });
    },

    /**
     * Update inventory references recursively.
     * 
     * @param {Inventory} inventory - The inventory to update.
     */
    updateInventoryReferences(inventory) {
        for (const invItems of inventory.values()) {
            invItems.forEach(items => {
                items.forEach(item => {
                    // Set the prototype based on the itemType
                    const itemTypeConstructor = Item.stringToItemType(item.itemType.toString());
                    if (itemTypeConstructor) {
                        Object.setPrototypeOf(item, itemTypeConstructor.prototype);
                    }

                    // Check and recurse into the item's inventory if it exists
                    if (item.inventory) {
                        Object.setPrototypeOf(item.inventory, Inventory.prototype);
                        InventoryModule.updateInventoryReferences(item.inventory);
                    }
                });
            });
        }
    },

    /**
     * Handle pre-hot boot actions.
     */
    onHotBootBefore() {
        InventoryModule.removeEvents();
    },

    /**
     * Handle item loading event.
     * 
     * @param {Player} player - The player triggering the event.
     */
    onItemsLoading(player) {
        Item.addItemType(Container);
        Item.addItemFlag('groundrot', 'hidden', 'notake');
    },

    /**
     * Handle player loaded event.
     * 
     * @param {Player} player - The loaded player.
     * @param {Object} playerData - The player data.
     */
    onPlayerLoaded(player, playerData) {
        if (player.inventory !== undefined) player.inventory = Inventory.deserialize(JSON.stringify(playerData.inventory), playerData.inventory.maxSize);
    },

    /**
     * Handle player logged in event.
     * 
     * @param {Player} player - The logged-in player.
     */
    onPlayerLoggedIn: (player) => {
        if (player.inventory == undefined || player.inventory == null) player.inventory = new Inventory();
    },

    /**
     * Handle player saved event.
     * 
     * @param {Player} player - The saved player.
     * @param {Object} playerData - The player data.
     * @returns {Object} - The updated player data.
     */
    onPlayerSaved(player, playerData) {
        playerData.inventory = player.inventory.serialize();
        return playerData;
    },

    /**
     * Handle look command by displaying items in the current room.
     * 
     * @param {Player} player - The player executing the look command.
     */
    onLooked(player) {
        if (player.currentRoom && player.currentRoom.inventory) {
            player.currentRoom.inventory?.forEach((details) => {
                for (const items of details.values()) {
                    player.send(`(${items.length}) ${items[0].displayString}: ${items[0].description}`);
                }
            });
        }
    },

    /**
     * Handle room loaded event.
     * 
     * @param {Room} room - The loaded room.
     * @param {Object} roomData - The room data.
     */
    onRoomLoaded(room, roomData) {
        if (!room.defaultState.inventory) {
            room.defaultState.inventory = new Inventory(roomData.defaultState?.inventory?.maxSize ?? 20);

            roomData.defaultState.inventory.items.forEach(roomItems => {
                roomItems.data.forEach(itemData => {
                    itemData.items.forEach(item => {
                        const itemType = Item.stringToItemType(item.itemType);
                        const itemObj = itemType.deserialize(roomItems.vNum, item);
                        room.defaultState.inventory.addItem(roomItems.vNum, itemObj, true);
                    });
                });
            });
        }

        if (!room.inventory) {
            room.inventory = new Inventory(room.defaultState.inventory.maxSize);
            room.defaultState.inventory.forEach((rarityMap, vNum) => {
                rarityMap.forEach((items, rarity) => {
                    items.forEach(itemData => {
                        const item = itemData.copy();
                        room.inventory.addItem(itemData.vNum, item, true);
                    });
                });
            });
        }
    },

    /**
     * Handle room saved event.
     * 
     * @param {Player} player - The player triggering the event.
     * @param {Room} room - The saved room.
     * @param {Object} roomData - The room data.
     */
    onRoomSaved(player, room, roomData) {
        roomData.defaultState.inventory = room.defaultState.inventory.serialize();
    },

    /**
     * Handle room state saved event.
     * 
     * @param {Player} player - The player triggering the event.
     * @param {Room} room - The room whose state is saved.
     */
    onRoomStateSaved(player, room) {
        room.defaultState?.inventory?.clear();
        room.defaultState.inventory = room.inventory?.copy();
    },

    /**
     * Parse an argument to extract an optional index and name.
     * 
     * @param {string} arg - The argument to parse.
     * @returns {Array} - An array containing the index and name.
     */
    parseArgument(arg) {
        const parsePattern = /^(\d+)?\.(.*)$/;
        const match = arg.match(parsePattern);
        if (match) {
            return [parseInt(match[1]), match[2]];
        }
        return [undefined, arg];
    },

    /**
     * Put all items matching a name into a container.
     * 
     * @param {Player} player - The player putting the items.
     * @param {Array} args - The arguments containing item and container names.
     * @returns {boolean} - True if items were put successfully, false otherwise.
     */
    putAllItems(player, args) {
        const parsePattern = /^(\d+)\.(.*)$/;
        let itemString, containerString;

        if (args.length === 1) {
            containerString = args[0];
            itemString = "";  // Indicates moving all items
        } else if (args.length === 0) {
            player.send(`Put what where?`);
            return false;
        } else {
            [itemString, containerString] = args;
        }

        let containerMatch = containerString.match(parsePattern);
        let containerName = containerMatch ? containerMatch[2].trim() : containerString.trim();
        let containerIndex = containerMatch ? parseInt(containerMatch[1], 10) : 0;

        let containerList = player.inventory.findAllContainersByName(containerName);
        if (!containerList.length) {
            player.send(`${containerName} not found.`);
            return false;
        }
        let container = containerList[containerIndex];

        let items;
        if (itemString) {
            let itemMatch = itemString.match(parsePattern);
            let itemName = itemMatch ? itemMatch[2].trim() : itemString.trim();
            items = player.inventory.findAllItemsByName(itemName);
            if (!items.length) {
                player.send(`No items named ${itemName} found in your inventory.`);
                return false;
            }
        } else {
            items = player.inventory.findAllItemsByName('');
            items = items.filter(item => item !== container);
        }

        let count = 0;
        items.forEach(item => {
            if (item !== container && container.inventory.addItem(item.vNum, item)) {
                player.inventory.removeItem(item);
                count++;
            }
        });

        if (count > 0) {
            player.send(`You put ${count} item(s) into ${container.displayString}.`);
            return true;
        } else {
            if (container.inventory.isFull) {
                player.send(`${container.displayString} is full!`);
            } else {
                player.send(`Could not put any items into ${container.displayString}.`);
            }
            return false;
        }
    },

    /**
     * Put a specific item into a container.
     * 
     * @param {Player} player - The player putting the item.
     * @param {Array} args - The arguments containing item and container names.
     * @returns {boolean} - True if the item was put successfully, false otherwise.
     */
    putItem(player, args) {
        let [itemString, containerString] = args;

        if (!itemString) {
            player.send(`Put what where?`);
            return false;
        }

        const parsePattern = /^(\d+)\.(.*)$/;
        let itemMatch = itemString?.match(parsePattern);
        let containerMatch = containerString?.match(parsePattern);

        let itemIndex = itemMatch ? parseInt(itemMatch[1], 10) : 0;
        let containerIndex = containerMatch ? parseInt(containerMatch[1], 10) : 0;
        let itemName = itemMatch ? itemMatch[2].trim() : itemString.trim();
        let containerName = containerMatch ? containerMatch[2].trim() : containerString.trim();

        let itemList = player.inventory.findAllItemsByName(itemName);
        let containerList = player.inventory.findAllContainersByName(containerName);

        if (!itemList.length) {
            player.send(`${itemName} not found in your inventory.`);
            return false;
        }
        if (!containerList.length) {
            player.send(`${containerName} not found.`);
            return false;
        }

        let item = itemList[itemIndex];
        let container = containerList[containerIndex];

        if (!item) {
            player.send(`${itemName} not found in your inventory.`);
            return false;
        }
        if (!container) {
            player.send(`${containerName} not found.`);
            return false;
        }

        if (item === container) {
            player.send(`Can't put ${container.displayString} into itself!`);
            return false;
        }

        // Attempt to add the item to the container
        if (container.inventory.addItem(item.vNum, item)) {
            player.inventory.removeItem(item); // Remove from player's inventory if successfully added
            player.send(`You put ${item.displayString} into ${container.displayString}.`);
            return true;
        } else {
            if (container.inventory.isFull) {
                player.send(`${container.displayString} is full!`);
            } else {
                player.send(`Could not put ${item.displayString} into ${container.displayString}.`);
            }
            return false;
        }
    },

    /**
     * Register module events with the MUD server.
     */
    registerEvents() {
        InventoryModule.mudServer.on('executedLook', InventoryModule.onExecutedLook);
        InventoryModule.mudServer.on('hotBootAfter', InventoryModule.onHotBootAfter);
        InventoryModule.mudServer.on('hotBootBefore', InventoryModule.onHotBootBefore);
        InventoryModule.mudServer.on('itemsLoading', InventoryModule.onItemsLoading);
        InventoryModule.mudServer.on('looked', InventoryModule.onLooked);
        InventoryModule.mudServer.on('playerLoaded', InventoryModule.onPlayerLoaded);
        InventoryModule.mudServer.on('playerLoggedIn', InventoryModule.onPlayerLoggedIn);
        InventoryModule.mudServer.on('playerSaved', InventoryModule.onPlayerSaved);
        InventoryModule.mudServer.on('roomLoaded', InventoryModule.onRoomLoaded);
        InventoryModule.mudServer.on('roomSaved', InventoryModule.onRoomSaved);
        InventoryModule.mudServer.on('roomStateSaved', InventoryModule.onRoomStateSaved);
    },

    /**
     * Unregister module events from the MUD server.
     */
    removeEvents() {
        InventoryModule.mudServer.off('executedLook', InventoryModule.onExecutedLook);
        InventoryModule.mudServer.off('hotBootAfter', InventoryModule.onHotBootAfter);
        InventoryModule.mudServer.off('hotBootBefore', InventoryModule.onHotBootBefore);
        InventoryModule.mudServer.off('itemsLoading', InventoryModule.onItemsLoading);
        InventoryModule.mudServer.off('looked', InventoryModule.onLooked);
        InventoryModule.mudServer.off('playerLoaded', InventoryModule.onPlayerLoaded);
        InventoryModule.mudServer.off('playerLoggedIn', InventoryModule.onPlayerLoggedIn);
        InventoryModule.mudServer.off('playerSaved', InventoryModule.onPlayerSaved);
        InventoryModule.mudServer.off('roomLoaded', InventoryModule.onRoomLoaded);
        InventoryModule.mudServer.off('roomSaved', InventoryModule.onRoomSaved);
        InventoryModule.mudServer.off('roomStateSaved', InventoryModule.onRoomStateSaved);
    },

    /**
     * Display the player's inventory.
     * 
     * @param {Player} player - The player whose inventory to show.
     * @param {Array} args - The arguments containing an optional search term.
     */
    showInventory(player, args) {
        const [searchTerm] = args;

        player.send("Your inventory:");

        if (player.inventory.size === 0) {
            player.send("You are carrying nothing.");
            return;
        }

        if (searchTerm === undefined) {
            player.inventory.forEach((details) => {
                for (const items of details.values()) {
                    player.send(`(${items.length}) ${items[0].displayString}: ${items[0].description}`);
                }
            });
        } else {
            let found = false;
            player.inventory.forEach((details) => {
                for (const items of details.values()) {
                    if (items[0].name.toLowerCase().includes(searchTerm.toLowerCase())) {
                        player.send(`(${items.length}) ${items[0].displayString}: ${items[0].description}`);
                        found = true;
                    }
                }
            });
            if (!found) {
                player.send(`No items found matching '${searchTerm}'.`);
            }
        }
    },

    /**
     * Take all items matching a name from the room or container.
     * 
     * @param {Player} player - The player taking the items.
     * @param {Array} args - The arguments containing item and container names.
     */
    takeAllItems(player, args) {
        if (args.length === 0) {
            const takenItems = [];
            player.currentRoom.inventory.forEach((rarityMap, vNum) => {
                rarityMap.forEach((items, rarity) => {
                    items.forEach(item => {
                        takenItems.push(item);
                    });
                });
            });

            if (takenItems.length > 0) {
                takenItems.forEach(item => {
                    if (player.inventory.addItem(item.vNum, item)) {
                        player.currentRoom.inventory.removeItem(item);
                        player.send(`You took ${item.displayString} from the room.`);
                    }
                });
            }
            return;
        }

        let firstArg = args[0];
        let secondArg = args[1];

        let [firstIndex, firstName] = InventoryModule.parseArgument(firstArg);
        let [secondIndex, secondName] = secondArg ? InventoryModule.parseArgument(secondArg) : [undefined, undefined];

        if (secondArg) {
            InventoryModule.handleTakeFromContainer(player, firstName, firstIndex, secondName, secondIndex);
        } else {
            let containerList = player.currentRoom.inventory.findAllContainersByName(firstName);
            if (containerList.length > 0) {
                InventoryModule.handleTakeFromContainer(player, undefined, undefined, firstName, firstIndex);
            } else {
                let items = player.currentRoom.inventory.findAllItemsByName(firstName);
                if (firstIndex !== undefined) {
                    items = [items[firstIndex]];
                }

                items.forEach(item => {
                    if (player.inventory.addItem(item.vNum, item)) {
                        player.currentRoom.inventory.removeItem(item);
                        player.send(`You took ${item.displayString} from the room.`);
                    }
                });
            }
        }
    },

    /**
     * Take a specific item from the room or container.
     * 
     * @param {Player} player - The player taking the item.
     * @param {Array} args - The arguments containing item and container names.
     * @returns {boolean} - True if the item was taken successfully, false otherwise.
     */
    takeItem(player, args) {
        const indexPattern = /^(\d*)\.(.*)$/;
        let itemString = args[0];
        let containerString = args[1];

        let itemIndex = 0, itemName, containerIndex = 0, containerName;

        let itemMatch = itemString.match(indexPattern);
        if (itemMatch) {
            itemIndex = itemMatch[1] ? parseInt(itemMatch[1], 10) : 0;
            itemName = itemMatch[2];
        } else {
            itemName = itemString;
        }

        let container;
        if (containerString) {
            let containerMatch = containerString.match(indexPattern);
            if (containerMatch) {
                containerIndex = containerMatch[1] ? parseInt(containerMatch[1], 10) : 0;
                containerName = containerMatch[2];
            } else {
                containerName = containerString;
            }

            let containers = [...player.inventory.findAllContainersByName(containerName), ...player.currentRoom.inventory.findAllContainersByName(containerName)];
            if (containers.length > containerIndex) {
                container = containers[containerIndex];
            } else {
                player.send(`${containerName} not found.`);
                return false;
            }
        }

        if (container) {
            let items = container.inventory.findAllItemsByName(itemName);
            if (items.length > itemIndex) {
                let selectedItem = items[itemIndex];
                if (player.inventory.addItem(selectedItem.vNum, selectedItem)) {
                    container.inventory.removeItem(selectedItem);
                    player.send(`You took ${selectedItem.displayString} from ${container.displayString}.`);
                    return true;
                } else {
                    if (player.inventory.isFull) {
                        player.send(`Inventory is full!`);
                    } else {
                        player.send(`Failed to take ${selectedItem.displayString}.`);
                    }
                    return false;
                }
            } else {
                player.send(`${itemName} not found in ${container.displayString}.`);
                return false;
            }
        } else {
            let items = player.currentRoom.inventory.findAllItemsByName(itemName);
            if (items.length > itemIndex) {
                let selectedItem = items[itemIndex];
                if (player.inventory.addItem(selectedItem.vNum, selectedItem)) {
                    player.currentRoom.inventory.removeItem(selectedItem);
                    player.send(`You took ${selectedItem.displayString} from the room.`);
                    return true;
                } else {
                    if (player.inventory.isFull) {
                        player.send(`Inventory is full!`);
                    } else {
                        player.send(`Failed to take ${selectedItem.displayString}.`);
                    }
                    return false;
                }
            } else {
                player.send(`${itemName} not found in the room.`);
                return false;
            }
        }
    },
};

module.exports = InventoryModule;
