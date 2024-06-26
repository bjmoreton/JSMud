// Importing necessary modules
const path = require('path');
const Inventory = require('./InventoryModule/Inventory');
const Container = require('./InventoryModule/Container');
const Item = require('./ItemModule/Item');
const { isNumber } = require('./Mud/Helpers');

// Inventory module
const InventoryModule = {
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
            const drop = foundItem.flags.trigger('ondrop', player, foundItem);

            if (!drop.includes(false)) {
                if (player.currentRoom.inventory.addItem(foundItem.vNum, foundItem)) {
                    player.send(`Dropped ${foundItem.displayString} successfully.`);
                    player.inventory.removeItem(foundItem);
                    foundItem.flags.trigger('ondropped', player, foundItem);
                } else {
                    player.send(`Failed to drop ${foundItem.displayString}!`);
                    return false;
                }
            } else {
                player.send(`Can't drop ${foundItem.displayString}!`);
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
            const drop = foundItem.flags.trigger('ondrop', player, foundItem);

            if (!drop.includes(false)) {
                if (!player.currentRoom.inventory.addItem(foundItem.vNum, foundItem)) {
                    player.send(`Failed to drop ${foundItem.displayString}!`);
                    return false;
                } else {
                    player.send(`Dropped ${foundItem.displayString} successfully.`);
                    player.inventory.removeItem(foundItem);
                    foundItem.flags.trigger('ondropped', player, foundItem);
                    return true;
                }
            } else {
                player.send(`Can't drop ${foundItem.displayString}!`);
                return false;
            }
        } else {
            player.send(`Index ${itemIndex} out of bounds for ${itemString}!`);
            return false;
        }
    },

    /**
     * Edit the inventory of an item.
     * 
     * @param {Player} player - The player editing the item.
     * @param {Item} item - The item being edited.
     * @param {Object} eventObj - The event object containing the arguments.
     */
    editItemInventory(player, item, eventObj) {
        const [vNum, editWhat, action, ...data] = eventObj.args;
        if (!action) {
            eventObj.saved = false;
            player.send(`Usage: edititem ${vNum} inventory <add | allowedtypes | check | remove | size> [value]`);
            return;
        }
        if (item.inventory) {
            switch (action.toLowerCase()) {
                case 'add':
                    const [addVNum, addRarityStr] = data;
                    if (!isNumber(addVNum)) {
                        eventObj.saved = false;
                        player.send(`Item vNum needs to be a number!`);
                        return;
                    }
                    const addItem = global.ItemModule.getItemByVNum(addVNum);

                    if (addItem) {
                        if (addRarityStr) {
                            const rarity = Item.getRarityByName(addRarityStr);
                            if (rarity) addItem.rarity = rarity;
                        }
                        if (item.addItem(addItem.vNum, addItem, true)) {
                            player.send(`Added ${addItem.name} to ${item.name} successfully.`);
                        } else {
                            eventObj.saved = false;
                            player.send(`Failed to add ${addItem.name} to ${item.name}!`);
                            return;
                        }
                    } else {
                        eventObj.saved = false;
                        player.send(`Item not found with vNum ${addVNum}!`);
                        return;
                    }
                    break;
                case 'allowedtypes':
                    const [subAction, ...types] = data;
                    if (!subAction) {
                        eventObj.saved = false;
                        player.send(`Usage: edititem ${vNum} inventory allowedtypes <add | check | remove> [value]`);
                        return;
                    }
                    switch (subAction.toLowerCase()) {
                        case 'add':
                            if (types.length > 0) {
                                types.forEach(type => {
                                    const itemType = Item.stringToItemType(type);
                                    if (itemType) {
                                        if (!item.allowedTypes) item.allowedTypes = [];
                                        if (!item.allowedTypes.includes(itemType)) {
                                            item.allowedTypes.push(itemType);
                                        }
                                    } else player.send(`Item type ${type} doesn't exist!`);
                                });
                            } else {
                                eventObj.saved = false;
                                player.send(`Valid types:` + Item.getItemTypesArray());
                                return;
                            }
                            break;
                        case 'check':
                            player.send(`Current allowedTypes for ${item.name}:`);
                            player.send(`${item?.allowedTypes?.join(', ')}`);
                            eventObj.saved = false;
                            return;
                        case 'remove':
                            if (types.length > 0) {
                                if (!item.allowedTypes) item.allowedTypes = [];
                                types.forEach(type => {
                                    const itemType = Item.stringToItemType(type);
                                    if (itemType) {
                                        const index = item.allowedTypes.indexOf(itemType);
                                        if (index > -1) {
                                            item.allowedTypes.splice(index, 1);
                                        }
                                    } else player.send(`Item type ${type} doesn't exist!`);
                                });
                            } else {
                                eventObj.saved = false;
                                player.send(`Valid types:` + Item.getItemTypesArray());
                                return;
                            }
                            break;
                    }
                    break;
                case 'check':
                    player.send(`Items inside ${item.name}:`);
                    player.send(`[vNum] (Qty) Rarity Itemname`);
                    item.inventory.forEach((details) => {
                        for (const items of details.values()) {
                            player.send(`[${items[0].vNum}] (${items.length}) ${items[0].displayString}`);
                        }
                    });
                    eventObj.saved = false;
                    return;
                case 'remove':
                    const [removeVNum, rarityStr] = data;
                    if (!isNumber(removeVNum)) {
                        eventObj.saved = false;
                        player.send(`Item vNum needs to be a number!`);
                        return;
                    }
                    const removeItem = global.ItemModule.getItemByVNum(removeVNum);

                    if (removeItem) {
                        let rarity;
                        if (rarityStr) rarity = Item.getRarityByName(rarityStr);
                        const foundItem = item.inventory.getItem(removeItem, rarity);
                        if (!foundItem) {
                            eventObj.saved = false;
                            player.send(`${removeItem.name} doesn't exist in ${item.name}!`);
                            return;
                        }

                        if (item.inventory.removeItem(foundItem)) {
                            player.send(`Removed ${foundItem.displayString} from ${item.name} successfully.`);
                        } else {
                            eventObj.saved = false;
                            player.send(`Failed to remove ${foundItem.displayString} from ${item.name}!`);
                            return;
                        }
                    } else {
                        eventObj.saved = false;
                        player.send(`Item not found with vNum ${removeVNum}!`);
                        return;
                    }
                    break;
                case 'size':
                    if (item.inventory) {
                        const [value] = data;
                        if (!value) {
                            eventObj.saved = false;
                            player.send(`${item.displayString} current inventory size is ${item.inventory.maxSize}.`);
                            return;
                        }
                        if (!isNumber(value) || parseInt(value) < 0) {
                            eventObj.saved = false;
                            player.send(`Value needs to be a none negative number!`);
                            return;
                        }
                        item.inventory.maxSize = parseInt(value);
                    } else {
                        eventObj.saved = false;
                        player.send(`Item doesn't have an inventory!`);
                        return;
                    }
                    break;
                default:
                    eventObj.saved = false;
                    return;
            }
        } else {
            eventObj.saved = false;
            player.send(`Item doesn't have an inventory!`);
            return;
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
     * Initialize the Inventory module.
     * 
     * @param {MudServer} mudServer - The mud server instance.
     */
    init: function (mudServer) {
        global.InventoryModule = this;
        this.mudServer = mudServer;
        this.registerEvents();
    },

    load() {
        global.ItemModule.addEditItemAction('inventory', 'edititem [vNum] inventory <add | allowedtypes | check | remove | size> [value]', InventoryModule.editItemInventory);
    },

    /**
     * Handles item creation by adjusting item stats based on rarity.
     * 
     * @param {Item} item - The item being created.
     * @param {Item} updatedItem - The updated version of the item being created.
     */
    onCreatedItem(player, item, updatedItem) {
        player.inventory.addItem(item.vNum, item, true);
        if (item.inventory) {
            InventoryModule.updateInventoryContents(player, item.inventory);
        }
    },

    /**
     * Recursively update the contents of an inventory.
     * 
     * @param {Player} player - The player owning the inventory.
     * @param {Inventory} inventory - The inventory to update.
     */
    updateInventoryContents(player, inventory) {
        for (const rarityMap of inventory.values()) {
            for (const items of rarityMap.values()) {
                for (let item of items) {
                    if (inventory.addItem(item.vNum, global.ItemModule.createItem(player, item, item.rarity))) {
                        inventory.removeItem(item);
                        if (item.inventory) InventoryModule.updateInventoryContents(player, item.inventory);
                    }
                }
            }
        }
    },

    /**
     * Handle the look in command executed by a player.
     * 
     * @param {Player} player - The player executing the look in command.
     * @param {Array} args - The arguments for the look in command.
     */
    lookIn(player, args) {
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
            player.send(`No items named ${itemName} found.`);
            return;
        }

        let item = itemIndex >= 0 && itemIndex < combinedItems.length ? combinedItems[itemIndex] : combinedItems[0]; // Take indexed item or first if no index provided
        if (!item) {
            player.send(`No items found at index ${itemIndex} for ${itemName}.`);
            return;
        }

        // Provide details about the item or list contents if it's a container
        if (item.inventory) {
            player.send(`Looking in ${item.displayString} it contains:`);
            item.inventory.forEach((details) => {
                for (const items of details.values()) {
                    const item = items[0];
                    const flagDescriptors = item.flags.trigger('ondescriptor', player, item)
                    const flagDescriptorStr = flagDescriptors.join('');
                    player.send(`(${items.length}) ${flagDescriptorStr}${item.displayString}`);
                }
            });
        } else {
            player.send(`Can't look in ${item.displayString}!`);
        }
    },

    /**
     * Update inventory references after a hot boot.
     */
    onHotBootAfter() {
        InventoryModule.mudServer.players.forEach(player => {
            InventoryModule.updateInventoryReferences(player.inventory);
        });

        global.ItemModule.itemsList.forEach(item => {
            if (item.inventory) InventoryModule.updateInventoryReferences(item.inventory);
        });
    },

    /**
     * Handle pre-hot boot actions.
     */
    onHotBootBefore() {
        InventoryModule.removeEvents();
    },

    /**
     * Handle item edited event.
     * 
     * @param {Item} item - The item that was edited.
     */
    onItemEditted(item) {
        if (item.inventory) {
            item.inventory.forEach((details) => {
                const itemsList = details.values();

                for (const items of itemsList) {
                    items.forEach(oldItem => {
                        const updatedItem = global.ItemModule.getItemByVNum(oldItem.vNum);
                        Item.sync(updatedItem, oldItem);
                        if (oldItem.inventory) InventoryModule.onItemEditted(oldItem);
                    });
                }
            });
        }
    },

    /**
     * Handle item loading event.
     * 
     * @param {Player} player - The player triggering the event.
     */
    onItemsLoading(player) {
        Item.addItemType(Container);
        //Item.addItemFlag('groundrot', 'hidden', 'notake');
    },

    /**
     * Handle items saved event.
     */
    onItemsSaved() {
        InventoryModule.mudServer.players.forEach(p => {
            InventoryModule.updatePlayerInventory(p.inventory);
        });
    },

    /**
     * Handle player loaded event.
     * 
     * @param {Player} player - The loaded player.
     * @param {Object} playerData - The player data.
     */
    onPlayerLoaded(player, playerData) {
        if (playerData.inventory !== undefined) player.inventory = Inventory.deserialize(JSON.stringify(playerData.inventory), playerData.inventory.maxSize);
        if (player.inventory) InventoryModule.updatePlayerInventory(player.inventory);
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
        if (player.inventory) playerData.inventory = player.inventory.serialize();
        return playerData;
    },

    /**
     * Handle look command by displaying items in the current room.
     * 
     * @param {Player} player - The player executing the look command.
     */
    onLooked(player) {
        if (player.currentRoom && player.currentRoom.inventory) {
            if (player.currentRoom.inventory.size > 0) {
                player.currentRoom.inventory.forEach((details) => {
                    for (const items of details.values()) {
                        player.send(`(${items.length}) ${items[0].displayString}: ${items[0].groundDescription}`);
                    }
                });
            }
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
            room.defaultState.inventory = new Inventory(roomData?.defaultState?.inventory?.maxSize ?? 20);

            if (roomData?.defaultState && roomData.defaultState.inventory) {
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
     * Handle room reset event.
     * 
     * @param {Room} room - The room being reset.
     */
    onRoomReset(room) {
        room.inventory = room.defaultState.inventory.copy();
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
            const place = item.flags.trigger('onplace', player, item, container);

            if (!place.includes(false)) {
                if (item !== container && container.addItem(item.vNum, item)) {
                    player.inventory.removeItem(item);
                    player.send(`You put ${item.displayString} into ${container.displayString}.`);
                    item.flags.trigger('onplaced', player, item, container);
                    count++;
                }
            } else player.send(`Could not put ${item.displayString} into ${container.displayString}!`);
        });

        if (count > 0) {
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
        const place = item.flags.trigger('onplace', player, item, container);

        if (!place.includes(false)) {
            if (container.addItem(item.vNum, item)) {
                player.inventory.removeItem(item); // Remove from player's inventory if successfully added
                player.send(`You put ${item.displayString} into ${container.displayString}.`);
                item.flags.trigger('onplaced', player, item, container);
                return true;
            } else {
                if (container.inventory.isFull) {
                    player.send(`${container.displayString} is full!`);
                } else {
                    player.send(`Could not put ${item.displayString} into ${container.displayString}.`);
                }
                return false;
            }
        } else {
            player.send(`Could not put ${item.displayString} into ${container.displayString}!`);
            return false;
        }
    },

    /**
     * Register module events with the MUD server.
     */
    registerEvents() {
        InventoryModule.mudServer.on('createdItem', InventoryModule.onCreatedItem);
        InventoryModule.mudServer.on('hotBootAfter', InventoryModule.onHotBootAfter);
        InventoryModule.mudServer.on('hotBootBefore', InventoryModule.onHotBootBefore);
        InventoryModule.mudServer.on('itemEditted', InventoryModule.onItemEditted);
        InventoryModule.mudServer.on('itemsLoaded', InventoryModule.onItemsSaved);
        InventoryModule.mudServer.on('itemsLoading', InventoryModule.onItemsLoading);
        InventoryModule.mudServer.on('itemsSaved', InventoryModule.onItemsSaved);
        InventoryModule.mudServer.on('looked', InventoryModule.onLooked);
        InventoryModule.mudServer.on('playerLoaded', InventoryModule.onPlayerLoaded);
        InventoryModule.mudServer.on('playerLoggedIn', InventoryModule.onPlayerLoggedIn);
        InventoryModule.mudServer.on('playerSaved', InventoryModule.onPlayerSaved);
        InventoryModule.mudServer.on('roomLoaded', InventoryModule.onRoomLoaded);
        InventoryModule.mudServer.on('roomReset', InventoryModule.onRoomReset);
        InventoryModule.mudServer.on('roomSaved', InventoryModule.onRoomSaved);
        InventoryModule.mudServer.on('roomStateSaved', InventoryModule.onRoomStateSaved);
    },

    /**
     * Unregister module events from the MUD server.
     */
    removeEvents() {
        InventoryModule.mudServer.off('createdItem', InventoryModule.onCreatedItem);
        InventoryModule.mudServer.off('hotBootAfter', InventoryModule.onHotBootAfter);
        InventoryModule.mudServer.off('hotBootBefore', InventoryModule.onHotBootBefore);
        InventoryModule.mudServer.off('itemEditted', InventoryModule.onItemEditted);
        InventoryModule.mudServer.off('itemsLoaded', InventoryModule.onItemsSaved);
        InventoryModule.mudServer.off('itemsLoading', InventoryModule.onItemsLoading);
        InventoryModule.mudServer.off('itemsSaved', InventoryModule.onItemsSaved);
        InventoryModule.mudServer.off('looked', InventoryModule.onLooked);
        InventoryModule.mudServer.off('playerLoaded', InventoryModule.onPlayerLoaded);
        InventoryModule.mudServer.off('playerLoggedIn', InventoryModule.onPlayerLoggedIn);
        InventoryModule.mudServer.off('playerSaved', InventoryModule.onPlayerSaved);
        InventoryModule.mudServer.off('roomLoaded', InventoryModule.onRoomLoaded);
        InventoryModule.mudServer.off('roomReset', InventoryModule.onRoomReset);
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
                    const item = items[0];
                    const flagDescriptors = item.flags.trigger('ondescriptor', player, item)
                    const flagDescriptorStr = flagDescriptors.join('');
                    player.send(`(${items.length}) ${flagDescriptorStr}${item.displayString}`);
                }
            });
        } else {
            let found = false;
            player.inventory.forEach((details) => {
                for (const items of details.values()) {
                    const item = items[0];
                    if (item.name.toLowerCase().includes(searchTerm.toLowerCase())) {
                        const flagDescriptors = item.flags.trigger('ondescriptor', player, item)
                        const flagDescriptorStr = flagDescriptors.join('');
                        player.send(`(${items.length}) ${flagDescriptorStr}${item.displayString}`);
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
        if (!args.length) {
            // No arguments provided, take all items from the room
            let items = player.currentRoom.inventory.findAllItemsByName();
            if (items.length > 0) {
                for (let selectedItem of items) {
                    const take = selectedItem.flags.trigger('ontake', player, selectedItem);
                    if (!take.includes(false)) {
                        if (player.inventory.addItem(selectedItem.vNum, selectedItem)) {
                            player.currentRoom.inventory.removeItem(selectedItem);
                            player.send(`You took ${selectedItem.displayString} from the room.`);
                            selectedItem.flags.trigger('ontaken', player, selectedItem);
                        } else {
                            if (player.inventory.isFull) {
                                player.send(`Inventory is full!`);
                            } else {
                                player.send(`Failed to take ${selectedItem.displayString}.`);
                            }
                            return false;
                        }
                    } else {
                        player.send(`You can't take that!`);
                        return false;
                    }
                }
                return true;
            } else {
                player.send(`No items found in the room.`);
                return false;
            }
        }

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
        } else {
            // If no containerString is provided, treat itemString as a container name
            containerName = itemString;
            let containerMatch = containerName.match(indexPattern);
            if (containerMatch) {
                containerIndex = containerMatch[1] ? parseInt(containerMatch[1], 10) : 0;
                containerName = containerMatch[2];
            }

            let containers = [...player.inventory.findAllContainersByName(containerName), ...player.currentRoom.inventory.findAllContainersByName(containerName)];
            if (containers.length > containerIndex) {
                container = containers[containerIndex];
            } else {
                player.send(`${containerName} not found.`);
                return false;
            }

            itemName = null; // Reset itemName as we're treating itemString as a container
        }

        if (container) {
            let items = itemName ? container.inventory.findAllItemsByName(itemName) : container.inventory.findAllItemsByName();
            if (items.length > 0) {
                for (let selectedItem of items) {
                    const take = selectedItem.flags.trigger('ontake', player, selectedItem, container);
                    if (!take.includes(false)) {
                        if (player.inventory.addItem(selectedItem.vNum, selectedItem)) {
                            container.inventory.removeItem(selectedItem);
                            player.send(`You took ${selectedItem.displayString} from ${container.displayString}.`);
                            selectedItem.flags.trigger('ontaken', player, selectedItem, container);
                        } else {
                            if (player.inventory.isFull) {
                                player.send(`Inventory is full!`);
                            } else {
                                player.send(`Failed to take ${selectedItem.displayString}.`);
                            }
                            return false;
                        }
                    } else {
                        player.send(`You can't take that!`);
                        return false;
                    }
                }
                return true;
            } else {
                player.send(`No items found in ${container.displayString}.`);
                return false;
            }
        } else {
            let items = player.currentRoom.inventory.findAllItemsByName(itemName);
            if (items.length > 0) {
                for (let selectedItem of items) {
                    const take = selectedItem.flags.trigger('ontake', player, selectedItem);
                    if (!take.includes(false)) {
                        if (player.inventory.addItem(selectedItem.vNum, selectedItem)) {
                            player.currentRoom.inventory.removeItem(selectedItem);
                            player.send(`You took ${selectedItem.displayString} from the room.`);
                            selectedItem.flags.trigger('ontaken', player, selectedItem);
                        } else {
                            if (player.inventory.isFull) {
                                player.send(`Inventory is full!`);
                            } else {
                                player.send(`Failed to take ${selectedItem.displayString}.`);
                            }
                            return false;
                        }
                    } else {
                        player.send(`You can't take that!`);
                        return false;
                    }
                }
                return true;
            } else {
                player.send(`${itemName} not found in the room.`);
                return false;
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
                const take = selectedItem.flags.trigger('ontake', player, selectedItem, container);
                if (!take.includes(false)) {
                    if (player.inventory.addItem(selectedItem.vNum, selectedItem)) {
                        container.inventory.removeItem(selectedItem);
                        player.send(`You took ${selectedItem.displayString} from ${container.displayString}.`);
                        selectedItem.flags.trigger('ontaken', player, selectedItem, container);
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
                    player.send(`You can't take that!`);
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
                const take = selectedItem.flags.trigger('ontake', player, selectedItem);

                if (!take.includes(false)) {
                    if (player.inventory.addItem(selectedItem.vNum, selectedItem)) {
                        player.currentRoom.inventory.removeItem(selectedItem);
                        player.send(`You took ${selectedItem.displayString} from the room.`);
                        selectedItem.flags.trigger('ontaken', player, selectedItem);
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
                    player.send(`You can't take that!`);
                    return false;
                }
            } else {
                player.send(`${itemName} not found in the room.`);
                return false;
            }
        }
    },

    /**
     * Update inventory references recursively.
     * 
     * @param {Inventory} inventory - The inventory to update.
     */
    updateInventoryReferences(inventory) {
        Object.setPrototypeOf(inventory, Inventory.prototype);
        for (const invItems of inventory.values()) {
            invItems.forEach(items => {
                items.forEach(item => {
                    if (item.allowedTypes) {
                        item.allowedTypes.forEach(type => {
                            const itemType = Item.stringToItemType(type.toString());
                            type = itemType;
                        });
                    }
                    // Set the prototype based on the itemType
                    const itemTypeConstructor = Item.stringToItemType(item.itemType.toString());
                    if (itemTypeConstructor) {
                        Object.setPrototypeOf(item, itemTypeConstructor.prototype);
                        item.itemType = itemTypeConstructor;
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
     * Update player inventory.
     * 
     * @param {Inventory} inventory - The player's inventory to update.
     */
    updatePlayerInventory(inventory) {
        for (const invItems of inventory.values()) {
            invItems.forEach(items => {
                const deletedItems = [];

                items.forEach(item => {
                    const updatedItem = global.ItemModule.getItemByVNum(item.vNum);

                    if (updatedItem) {
                        const itemTypeConstructor = Item.stringToItemType(item.itemType.toString());
                        if (itemTypeConstructor) {
                            item = itemTypeConstructor.sync(updatedItem, item);
                            InventoryModule.mudServer.emit('syncedItem', item, updatedItem);
                        }

                        // Check and recurse into the item's inventory if it exists
                        if (item.inventory) {
                            InventoryModule.updatePlayerInventory(item.inventory);
                        }
                    } else deletedItems.push(item);
                });

                deletedItems.forEach(deletedItem => {
                    let index = items.findIndex(item => item === deletedItem);
                    while (index !== -1) {
                        items.splice(index, 1);
                        index = items.findIndex(item => item === deletedItem);
                    }
                });
            });
        }
    },
};

module.exports = InventoryModule;
