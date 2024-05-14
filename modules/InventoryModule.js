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
        if (!foundItems) {
            player.send(`${itemString} not found!`);
            return false;
        }

        if (foundItems) {
            if (itemIndex >= 0 && itemIndex < foundItems.length) {
                foundItems = [foundItems[itemIndex]];
            }

            for (const foundItem of foundItems) {
                console.log(foundItem);
                if (player.currentRoom.inventory.addItem(foundItem.vNum, foundItem)) {
                    player.send(`Dropped ${foundItem.name} successfully.`);
                    player.inventory.removeItem(foundItem);
                } else {
                    player.send(`Failed to drop ${foundItem.name}!`);
                    return false;
                }
            }
            return true;
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

        let foundItems = player.inventory.findAllItemsByName(itemString);
        if (!foundItems) {
            player.send(`${itemString} not found!`);
            return false;
        }

        if (foundItems) {
            if (itemIndex < 0 && itemIndex >= foundItems.size) {
                player.send(`Index ${itemIndex} is out of range!`);
                return false;
            }

            const foundItem = foundItems[itemIndex];
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
        let containers = [...player.currentRoom.inventory.findAllContainersByName(containerName), ...player.inventory.findAllContainersByName(containerName)];
        if (containerIndex !== undefined && containers.length > containerIndex) {
            containers = [containers[containerIndex]]; // Select specific container by index if within range
        } else containers = [containers[0]];

        containers.forEach(container => {
            if (container === undefined) return;
            let itemsArray = [];
            if (itemName) {
                // Assuming inventory is a Map; adjust accordingly if it's another type
                container.inventory.forEach(items => {
                    items.forEach(item => {
                        if (item.name.toLowerCase().includes(itemName.toLowerCase())) {
                            itemsArray.push(item); // Collect items matching the type
                        }
                    });
                });
            } else {
                // Flatten all items if no specific type is provided
                container.inventory.forEach((value, key) => {
                    itemsArray.push(...value);
                });
            }

            if (itemIndex !== undefined && itemsArray.length > itemIndex) {
                itemsArray = [itemsArray[itemIndex]]; // Select specific item by index if within range
            }

            itemsArray.forEach(item => {
                if (player.inventory.addItem(item.vNum, item)) {
                    container.inventory.delete(item.vNum); // Remove the item from the container inventory
                    player.send(`You took ${item.name} from ${container.name}.`);
                }
            });
        });
    },

    init: function (mudServer) {
        global.InventoryModule = this;
        this.mudServer = mudServer;
        this.registerEvents();
    },

    // Recursive function to load items into a container
    loadItemsIntoContainer(container, itemsData) {
        if (!itemsData) return;

        if (itemsData instanceof Map) {
            itemsData.forEach(items => {
                items.forEach(itemObj => {
                    const item = global.ItemModule.getItemByVNum(itemObj.vNum).copy();
                    if (item.inventory) {
                        // Recurse if this item is also a container
                        InventoryModule.loadItemsIntoContainer(item, itemObj.inventory);
                    }

                    container.inventory.addItem(item.vNum, item, true);
                });
            });
        } else {
            itemsData.data.forEach(itemData => {
                const item = global.ItemModule.getItemByVNum(itemsData.vNum).copy();
                if (item.inventory) {
                    // Recurse if this item is also a container
                    InventoryModule.loadItemsIntoContainer(item, itemData.items);
                }

                container.inventory.addItem(item.vNum, item, true);
            });
        }
    },

    onExecutedLook(player, args, eventObj) {
        eventObj.handled = true;
        const parsePattern = /^(\d+)\.(.*)$/;
        let [itemString] = args;
        let itemMatch = itemString.match(parsePattern);
        let itemName = itemMatch ? itemMatch[2].trim() : itemString.trim();
        let itemIndex = itemMatch ? parseInt(itemMatch[1], 10) : 0; // Convert to zero-based index

        // Gather all items from both player's inventory and room's inventory
        let combinedItems = [...player.inventory.findAllItemsByName(itemName), ...player.currentRoom.inventory.findAllItemsByName(itemName)];

        if (combinedItems.length === 0) {
            eventObj.handled = false;
            return;
        }

        let item = itemIndex >= 0 ? combinedItems[itemIndex] : combinedItems[0]; // Take indexed item or first if no index provided
        if (!item) {
            eventObj.handled = false;
            return;
        }

        // Provide details about the item or list contents if it's a container
        if (item.inventory) {
            player.send(`Looking in the ${item.name}: Contains:`);

            item.inventory.forEach((items, key) => {
                player.send(`(${items.length}) ${items[0].name}: ${items[0].description}`);
            });

        } else {
            player.send(`Looking at ${item.name}: ${item.description}`);
        }
    },

    onHotBootAfter() {

    },

    onHotBootBefore() {
        InventoryModule.removeEvents();
    },

    onInventoryItemDeserialized(item, outItem) {
        if (outItem.itemType === Item.ItemTypes.Container) {
            outItem.inventory = Inventory.deserialize(JSON.stringify(item.inventory), item.inventory.maxSize);
        }
    },

    onItemLoaded(itemObj, itemInfo) {
        if (Item.stringToItemType(itemInfo.data.itemType) === Item.ItemTypes.Container) {
            itemObj.item = new Container(itemInfo.vNum, itemInfo.data.name, itemInfo.data.nameDisplay, itemInfo.data.description, itemInfo.data.itemType, itemInfo.data.inventory.maxSize);
            itemObj.item.inventory = Inventory.deserialize(JSON.stringify(itemInfo.data.inventory), itemInfo.data.inventory.maxSize);
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
        if (player.inventory !== undefined) player.inventory = Inventory.deserialize(JSON.stringify(playerData.inventory), playerData.inventory.maxSize);

        // global.ItemModule.addItem(player, ['Old brown bag', 'Container']);
        // const oldBag = global.ItemModule.getItemByVNum(2).copy();
        // player.inventory.addItem(itemOldBag.vNum, oldBag, true);
    },

    onPlayerLoggedIn: (player) => {
        if (player.inventory == undefined || player.inventory == null) player.inventory = new Inventory();
        InventoryModule.mudServer.emit('updatePlayerItems', player, player.inventory);
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
            // Assuming roomData.defaultState.inventory.items is an array of item groups
            roomData.defaultState.inventory.items.forEach(roomItems => {
                // Assuming each roomItems.data is an array of actual item data
                roomItems.data.forEach(itemData => {
                    const item = global.ItemModule.getItemByVNum(roomItems.vNum).copy();  // Copy the item
                    if (item.inventory) {
                        // Recursively load items into the container if it is a container
                        InventoryModule.loadItemsIntoContainer(item, itemData.inventory.items);
                    }
                    // Add the item or container to the room's default state inventory
                    room.defaultState.inventory.addItem(roomItems.vNum, item, true);
                });
            });
        }

        if (!room.inventory) {
            room.inventory = new Inventory(room.defaultState.inventory.maxSize); // Create new inventory for the room

            room.defaultState.inventory.forEach(roomItems => {
                roomItems.forEach(itemData => {
                    const item = global.ItemModule.getItemByVNum(itemData.vNum).copy(); // Copy the item
                    if (item.inventory && itemData.inventory) {
                        // Recursively load items into the container if it is a container
                        InventoryModule.loadItemsIntoContainer(item, itemData.inventory);
                    }
                    room.inventory.addItem(itemData.vNum, item, true); // Add the item to the room's inventory
                });
            });
        }
    },

    onRoomSaved(player, room, roomData) {
        roomData.defaultState.inventory = room.defaultState.inventory.serialize();
    },

    onRoomStateSaved(player, room) {
        room.inventory?.forEach(itemData => {
            for (const item of itemData) {
                room.defaultState?.inventory?.addItem(item.vNum, global.ItemModule.getItemByVNum(item.vNum).copy(), true);
            }
        });
    },

    onUpdatePlayerItem(player, item, itemCopy, updatedItem) {
        if (item.itemType === Item.ItemTypes.Container) {
            item.inventory = itemCopy.inventory;
            item.inventory.maxSize = updatedItem.inventory.maxSize;
            if (item.inventory) InventoryModule.mudServer.emit('updatePlayerItems', player, item.inventory)
        }
    },

    parseArgument(arg) {
        const parsePattern = /^(\d+)?\.(.*)$/; // Pattern to capture optional index and item or container
        const match = arg.match(parsePattern);
        if (match) {
            return [parseInt(match[1]), match[2]]; // index, name
        }
        return [undefined, arg]; // no index provided, only name
    },

    registerEvents() {
        InventoryModule.mudServer.on('executedLook', InventoryModule.onExecutedLook);
        InventoryModule.mudServer.on('hotBootAfter', InventoryModule.onHotBootAfter);
        InventoryModule.mudServer.on('hotBootBefore', InventoryModule.onHotBootBefore);
        InventoryModule.mudServer.on('inventoryItemDeserialized', InventoryModule.onInventoryItemDeserialized);
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
        InventoryModule.mudServer.removeListener('executedLook', InventoryModule.onExecutedLook);
        InventoryModule.mudServer.removeListener('hotBootAfter', InventoryModule.onHotBootAfter);
        InventoryModule.mudServer.removeListener('hotBootBefore', InventoryModule.onHotBootBefore);
        InventoryModule.mudServer.removeListener('inventoryItemDeserialized', InventoryModule.onInventoryItemDeserialized);
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
        if (args.length === 0) {
            const takenItems = [];
            // Take everything from the room
            player.currentRoom.inventory.forEach((items, vNum) => {
                items.forEach(item => {
                    takenItems.push(item);
                });
            });

            if (takenItems.length > 0) {
                takenItems.forEach(item => {
                    if (player.inventory.addItem(item.vNum, item)) {
                        player.currentRoom.inventory.removeItem(item);
                        player.send(`You took ${item.name} from the room.`);
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
            if (player.currentRoom.inventory.findAllContainersByName(firstName)) {
                // It's a container, take all from it
                InventoryModule.handleTakeFromContainer(player, undefined, undefined, firstName, firstIndex);
            } else {
                // It's an item type, take all items of this type from the room
                let items = player.currentRoom.inventory.filter(item => item.name.includes(firstName));
                if (firstIndex !== undefined) {
                    items = [items[firstIndex]]; // Specific item by index
                }

                items.forEach(item => {
                    if (player.inventory.addItem(item.vNum, item)) {
                        player.currentRoom.inventory.removeItem(item);
                        player.send(`You took ${item.name} from the room.`);
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
                player.send(`${containerName} not found or index out of range.`);
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
                    player.send(`You took ${selectedItem.name} from ${container.name}.`);
                    return true;
                } else {
                    player.send(`Failed to take ${selectedItem.name}, inventory may be full.`);
                    return false;
                }
            } else {
                player.send(`${itemName} not found in ${container.name} or index out of range.`);
                return false;
            }
        } else {
            // Taking directly from the room, or container was not specified
            let items = player.currentRoom.inventory.findAllItemsByName(itemName);
            if (items.length > itemIndex) {
                let selectedItem = items[itemIndex];
                if (player.inventory.addItem(selectedItem.vNum, selectedItem)) {
                    player.currentRoom.inventory.removeItem(selectedItem);
                    player.send(`You took ${selectedItem.name} from the room.`);
                    return true;
                } else {
                    player.send(`Failed to take ${selectedItem.name}, inventory may be full.`);
                    return false;
                }
            } else {
                player.send(`${itemName} not found in the room or index out of range.`);
                return false;
            }
        }
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

        let container = player.inventory.findAllContainersByName(containerName);
        if (!container) {
            player.send(`${containerName} not found.`);
            return false;
        }
        container = container[containerIndex];

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
            items = [];
            player.inventory.forEach((vItems, vNum) => {
                items.push(...vItems.filter(item => item !== container));
            });
        }

        let count = 0;
        items.forEach(item => {
            if (item !== container && container.inventory.addItem(item.vNum, item)) {
                player.inventory.removeItem(item);
                count++;
            }
        });

        if (count > 0) {
            player.send(`You put ${count} item(s) into ${container.name}.`);
            return true;
        } else {
            player.send(`Could not put any items into ${container.name}.`);
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

        let item = player.inventory.findAllItemsByName(itemName);
        let container = player.inventory.findAllContainersByName(containerName);

        item = item[itemIndex];
        container = container[containerIndex];

        if (!item) {
            player.send(`${itemName} not found in your inventory.`);
            return false;
        }
        if (!container) {
            player.send(`${containerName} not found.`);
            return false;
        }

        if (item === container) {
            player.send(`Can't put ${container.name} into itself!`);
            return false;
        }

        // Attempt to add the item to the container
        if (container.inventory.addItem(item.vNum, item)) {
            player.inventory.removeItem(item); // Remove from player's inventory if successfully added
            player.send(`You put ${item.name} into ${container.name}.`);
            return true;
        } else {
            player.send(`Could not put ${item.name} into ${container.name}, maybe it's full.`);
            return false;
        }
    }
}

module.exports = InventoryModule;