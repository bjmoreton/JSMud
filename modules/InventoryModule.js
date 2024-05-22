// Importing necessary modules
const path = require('path');
const Inventory = require('./InventoryModule/Inventory');
const Container = require('./InventoryModule/Container');
const Item = require('./ItemModule/Item');

// Inventory module
const InventoryModule = {
    ITEMS_PATH: path.join(__dirname, '../system', 'items.json'),
    name: "Inventory",

    dropAll(player, args) {
        let [itemString] = args;

        let itemIndex = undefined;
        const indexPattern = /^(\d+)\.(.*)/;
        const match = itemString?.match(indexPattern);

        if (match) {
            // Extract index and new itemString
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

    getRoomInventory(area, roomObj) {
        for (const section of area.sections.values()) {
            for (const room of section.rooms.values()) {
                if (room.x == roomObj.x && room.y == roomObj.y && room.z == roomObj.z) {
                    return room.inventory;
                }
            }
        }
    },

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

    init: function (mudServer) {
        global.InventoryModule = this;
        this.mudServer = mudServer;
        this.registerEvents();
    },

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

    onHotBootAfter() {
        InventoryModule.mudServer.players.forEach(player => {
            InventoryModule.updateInventoryReferences(player.inventory);
        });
    },

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

    onHotBootBefore() {
        InventoryModule.removeEvents();
    },

    onItemsLoading(player) {
        Item.addItemType(Container);
        Item.addItemFlag('groundrot', 'hidden', 'notake');
    },

    onPlayerLoaded(player, playerData) {
        if (player.inventory !== undefined) player.inventory = Inventory.deserialize(JSON.stringify(playerData.inventory), playerData.inventory.maxSize);
    },

    onPlayerLoggedIn: (player) => {
        if (player.inventory == undefined || player.inventory == null) player.inventory = new Inventory();
    },

    onPlayerSaved(player, playerData) {
        playerData.inventory = player.inventory.serialize();

        return playerData;
    },

    onLooked(player) {
        if (player.currentRoom && player.currentRoom.inventory) {
            player.currentRoom.inventory?.forEach((details) => {
                for (const items of details.values()) {
                    player.send(`(${items.length}) ${items[0].displayString}: ${items[0].description}`);
                }
            });
        }
    },

    onRoomLoaded(room, roomData) {
        if (!room.defaultState.inventory) {
            room.defaultState.inventory = new Inventory(roomData.defaultState?.inventory?.maxSize ?? 20);

            // Assuming roomData.defaultState.inventory.items is an array of item groups
            roomData.defaultState.inventory.items.forEach(roomItems => {
                // Assuming each roomItems.data is an array of actual item data
                roomItems.data.forEach(itemData => {
                    itemData.items.forEach(item => {
                        const itemType = Item.stringToItemType(item.itemType);
                        const itemObj = itemType.deserialize(roomItems.vNum, item);

                        // Add the item to the room's default state inventory
                        room.defaultState.inventory.addItem(roomItems.vNum, itemObj, true);
                    });
                });
            });
        }

        if (!room.inventory) {
            room.inventory = new Inventory(room.defaultState.inventory.maxSize); // Create new inventory for the room

            room.defaultState.inventory.forEach((rarityMap, vNum) => {
                rarityMap.forEach((items, rarity) => {
                    items.forEach(itemData => {
                        const item = itemData.copy(); // Copy the item
                        room.inventory.addItem(itemData.vNum, item, true); // Add the item to the room's inventory
                    });
                });
            });
        }
    },

    onRoomSaved(player, room, roomData) {
        roomData.defaultState.inventory = room.defaultState.inventory.serialize();
    },

    onRoomStateSaved(player, room) {
        room.defaultState?.inventory?.clear();
        room.defaultState.inventory = room.inventory?.copy();
    },

    parseArgument(arg) {
        const parsePattern = /^(\d+)?\.(.*)$/; // Pattern to capture optional index and item or container
        const match = arg.match(parsePattern);
        if (match) {
            return [parseInt(match[1]), match[2]]; // index, name
        }
        return [undefined, arg]; // no index provided, only name
    },

    putAllItems(player, args) {
        const parsePattern = /^(\d+)\.(.*)$/;
        let itemString, containerString;

        if (args.length === 1) {
            // If only one argument, assume it's the container
            containerString = args[0];
            itemString = "";  // Indicates moving all items
        } else if (args.length === 0) {
            player.send(`Put what where?`);
            return false;
        } else {
            // Otherwise, assume both item and container are specified
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
            // If an item name is provided, find all matching items
            let itemMatch = itemString.match(parsePattern);
            let itemName = itemMatch ? itemMatch[2].trim() : itemString.trim();
            items = player.inventory.findAllItemsByName(itemName);
            if (!items.length) {
                player.send(`No items named ${itemName} found in your inventory.`);
                return false;
            }
        } else {
            // If no item name is provided, select all items from the inventory
            items = player.inventory.findAllItemsByName('');
            items = items.filter(item => item !== container);  // Exclude the container itself
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
                for (const items of details.values()) {
                    player.send(`(${items.length}) ${items[0].displayString}: ${items[0].description}`);
                }
            });
        } else {
            // Display only items that include the search term in their name
            let found = false;
            player.inventory.forEach((details) => {
                for (const items of details.values()) {
                    if (items[0].name.toLowerCase().includes(searchTerm.toLowerCase())) {
                        player.send(`(${items.length}) ${items[0].displayString}: ${items[0].description}`);
                        found = true;
                    }
                }
            });
            // Feedback if no items matched the search term
            if (!found) {
                player.send(`No items found matching '${searchTerm}'.`);
            }
        }
    },

    takeAllItems(player, args) {
        if (args.length === 0) {
            const takenItems = [];
            // Take everything from the room
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

        // Parse first argument which could be 'item' or 'container'
        let [firstIndex, firstName] = InventoryModule.parseArgument(firstArg);
        // If second argument exists, parse it as container
        let [secondIndex, secondName] = secondArg ? InventoryModule.parseArgument(secondArg) : [undefined, undefined];

        if (secondArg) {
            // Assume second arg is always a container
            InventoryModule.handleTakeFromContainer(player, firstName, firstIndex, secondName, secondIndex);
        } else {
            // Single argument, determine if it's an item type or container
            let containerList = player.currentRoom.inventory.findAllContainersByName(firstName);
            if (containerList.length > 0) {
                // It's a container, take all from it
                InventoryModule.handleTakeFromContainer(player, undefined, undefined, firstName, firstIndex);
            } else {
                // It's an item type, take all items of this type from the room
                let items = player.currentRoom.inventory.findAllItemsByName(firstName);
                if (firstIndex !== undefined) {
                    items = [items[firstIndex]]; // Specific item by index
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

    takeItem(player, args) {
        const indexPattern = /^(\d*)\.(.*)$/; // Allows for optional index
        let itemString = args[0];
        let containerString = args[1];

        let itemIndex = 0, itemName, containerIndex = 0, containerName;

        // Parse item argument
        let itemMatch = itemString.match(indexPattern);
        if (itemMatch) {
            itemIndex = itemMatch[1] ? parseInt(itemMatch[1], 10) : 0; // Default index to 0 if not specified
            itemName = itemMatch[2];
        } else {
            itemName = itemString;
        }

        // If a second argument is provided, it's assumed to be a container
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
            // Taking from a specified container
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
            // Taking directly from the room, or container was not specified
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
}

module.exports = InventoryModule;