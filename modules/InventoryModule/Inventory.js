const Item = require("../ItemModule/Item");
const { isNumber } = require("../Mud/Helpers");

/**
 * Represents a player's inventory.
 * Extends the Map class to store items with their vNum as keys.
 * 
 * @class Inventory
 * @extends {Map<number, Map<string, Array<Object>>>}
 */
class Inventory extends Map {
    /**
     * Creates an instance of Inventory.
     * @param {number} [maxSize=30] - Maximum number of items allowed in the inventory.
     */
    constructor(maxSize = 30) {
        super();
        /**
         * The maximum number of items allowed in the inventory.
         * @type {number}
         */
        this.maxSize = maxSize;
    }

    /**
     * Adds an item to the inventory.
     * 
     * @param {number} vNum - The unique identifier of the item.
     * @param {Object} item - The item to be added.
     * @param {boolean} [bypass=false] - If true, bypasses the inventory size limit.
     * @returns {boolean} - Returns true if the item is successfully added, false otherwise.
     */
    addItem(vNum, item, bypass = false) {
        const vNumParsed = parseInt(vNum);
        const rarity = item.rarity.name.toLowerCase();

        if (isNumber(vNumParsed)) {
            if (this.actualSize() + 1 <= this.maxSize || bypass) {
                if (!this.has(vNumParsed)) {
                    this.set(vNumParsed, new Map());
                }

                const rarityMap = this.get(vNumParsed);
                if (!rarityMap.has(rarity)) {
                    rarityMap.set(rarity, []);
                }

                rarityMap.get(rarity).push(item);
                return true;
            }
        }

        return false;
    }

    /**
     * Creates a deep copy of this Inventory instance, including all entries and the maxSize property.
     * @returns {Inventory} A new Inventory instance with duplicated entries and properties.
     */
    copy() {
        const newInventory = new Inventory(this.maxSize);
        this.forEach((rarityMap, vNum) => {
            const newRarityMap = new Map();
            rarityMap.forEach((items, rarity) => {
                newRarityMap.set(rarity, items.map(item => item.copy()));
            });
            newInventory.set(vNum, newRarityMap);
        });
        return newInventory;
    }

    /**
     * Searches through all entries to find containers whose names include a specified substring.
     * Assumes that the storage structure is a Map where each entry's key is a vNum and the value is a map of rarity to item arrays.
     * Each item is expected to have a name and an inventory property to qualify as a container.
     *
     * @param {string} itemName - The name or partial name to search for in container names.
     * @returns {Array} An array of all containers matching the specified name.
     */
    findAllContainersByName(itemName) {
        let foundItems = [];
        for (let rarityMap of this.values()) {
            for (let items of rarityMap.values()) {
                for (let item of items) {
                    if (item.name.toLowerCase().includes(itemName.toLowerCase()) && item.inventory) {
                        foundItems.push(item);
                    }
                }
            }
        }
        return foundItems;
    }

    /**
     * Retrieves all items from a collection that include the specified name.
     * This method performs a case-insensitive search through each item in the
     * collection, returning all items whose names contain the provided substring.
     *
     * @param {string} itemName - The name or partial name to search for in the item names.
     * @returns {Array} An array of all items that match the search criteria. If no items match,
     *                  an empty array is returned.
     */
    findAllItemsByName(itemName) {
        let foundItems = [];
        for (let rarityMap of this.values()) {
            for (let items of rarityMap.values()) {
                for (let item of items) {
                    if (itemName === undefined || item.name.toLowerCase().includes(itemName.toLowerCase())) {
                        foundItems.push(item);
                    }
                }
            }
        }
        return foundItems;
    }

    /**
     * Removes a specific item from the inventory based on its object reference.
     * Assumes that each `vNum` in the inventory maps to a map of rarity to item arrays.
     * 
     * @param {Object} targetItem - The item object to remove. This should be the exact object stored in the inventory.
     * @returns {boolean} True if the item was successfully removed, otherwise false.
     */
    removeItem(targetItem) {
        const itemsByRarity = this.get(targetItem.vNum);
        if (itemsByRarity) {
            const items = itemsByRarity.get(targetItem.rarity.name.toLowerCase());
            if (items && items.length > 0) {
                const index = items.findIndex(item => item === targetItem);
                if (index !== -1) {
                    items.splice(index, 1);  // Remove the item at the found index
                    if (items.length === 0) {
                        itemsByRarity.delete(targetItem.rarity.name.toLowerCase());
                        if (itemsByRarity.size === 0) {
                            this.delete(targetItem.vNum);  // If no items left, remove the key from the map
                        }
                    }
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Serializes the inventory into a JSON-compatible object.
     * 
     * @returns {Array<Object>} - Returns an array of objects representing the inventory items.
     */
    serialize() {
        let items = Array.from(this.entries()).map(([vNum, rarityMap]) => ({
            vNum: parseInt(vNum),
            data: Array.from(rarityMap.entries()).map(([rarity, itemList]) => ({
                rarity,
                items: itemList.map(item => item?.serialize())
            }))
        }));

        // Return as an object including maxSize
        return { items, maxSize: parseInt(this.maxSize) };
    }

    /**
     * Calculates the current number of items in the inventory.
     * 
     * @returns {number} - Returns the actual number of items in the inventory.
     */
    actualSize() {
        let sizeActual = 0;
        for (let rarityMap of this.values()) {
            for (let items of rarityMap.values()) {
                sizeActual += items.length;
            }
        }
        return parseInt(sizeActual);
    }

    /**
     * Checks if the inventory is full.
     * 
     * @returns {boolean} - Returns true if the inventory is full, false otherwise.
     */
    get isFull() { return this.actualSize() === this.maxSize; }

    /**
     * Deserializes a JSON string into an Inventory object.
     * 
     * @static
     * @param {string} data - A JSON string representing the inventory data.
     * @param {number} [maxSize=30] - Maximum number of items allowed in the inventory.
     * @returns {Inventory} - Returns an Inventory object.
     */
    static deserialize(data, maxSize = 30) {
        const inventory = new Inventory(maxSize);
        const invObj = JSON.parse(data);  // Assuming data is a JSON string
        const items = invObj.items;

        try {
            if (items) {
                items.forEach(item => {
                    item.data.forEach(({ rarity, items }) => {
                        items.forEach(newItem => {
                            const itemType = Item.stringToItemType(newItem.itemType);
                            const itemObj = itemType.deserialize(item.vNum, newItem);
                            if (itemObj.inventory && newItem.inventory) {
                                itemObj.inventory = Inventory.deserialize(JSON.stringify(newItem.inventory), newItem.inventory.maxSize);
                            }
                            inventory.addItem(parseInt(item.vNum), itemObj, true);
                        });
                    });
                });
            }
        } catch (error) {
            console.error("Failed to deserialize inventory:", error);
            return new Inventory(maxSize); // Optionally return an empty inventory on failure
        }

        return inventory;
    }
}

module.exports = Inventory;
