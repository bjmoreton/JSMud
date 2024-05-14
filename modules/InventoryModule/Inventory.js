const { isNumber } = require("../../Utils/helpers");

/**
 * Represents a player's inventory.
 * Extends the Map class to store items with their vNum as keys.
 * 
 * @class Inventory
 * @extends {Map<number, Array<Object>>}
 */
class Inventory extends Map {
    /**
     * Creates an instance of Inventory.
     * @param {number} [maxSize=30] - Maximum number of items allowed in the inventory.
     */
    constructor(maxSize = 30) {
        super();
        /**
         * Maximum number of items allowed in the inventory.
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
        if (isNumber(vNumParsed)) {
            if (this.actualSize() + 1 <= this.maxSize || bypass) {
                if (this.has(vNumParsed)) {
                    this.get(vNumParsed).push(item);
                } else {
                    const itemArray = [];
                    itemArray.push(item);
                    this.set(vNumParsed, itemArray);
                }
                return true;
            }
        }

        return false;
    }

    /**
     * Searches through all entries to find containers whose names include a specified substring.
     * Assumes that the storage structure is a Map where each entry's key is a vNum and the value is an array of item objects.
     * Each item is expected to have a name and an inventory property to qualify as a container.
     *
     * @param {string} itemName - The name or partial name to search for in container names.
     * @returns {Array} An array of all containers matching the specified name.
     *
     * @example
     * // Assume a Map where each vNum corresponds to an array of item objects
     * const containers = inventory.findAllContainersByName('box');
     * console.log(containers); // logs all items with 'box' in their name that have an inventory property
     */
    findAllContainersByName = function (itemName) {
        let foundItems = [];
        for (let [vNum, items] of this.entries()) {
            for (let item of items) {
                if (item.name.toLowerCase().includes(itemName.toLowerCase()) && item.inventory) {
                    foundItems.push(item);
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
     *
     * @example
     * // Assume the collection has items with names "Sword of Truth", "Sword of Lies", and "Shield of Honor"
     * const swords = inventory.findAllItemsByName("sword");
     * console.log(swords); // Outputs information about "Sword of Truth" and "Sword of Lies"
     */
    findAllItemsByName(itemName) {
        let foundItems = [];
        for (let [vNum, items] of this.entries()) {
            for (let item of items) {
                if (itemName === undefined || item.name.toLowerCase().includes(itemName.toLowerCase())) {
                    foundItems.push(item);
                }
            }
        }
        return foundItems;
    };

    /**
     * Removes a specific item from the inventory based on its object reference.
     * Assumes that each `vNum` in the inventory maps to an array of item objects.
     * 
     * @param {Object} targetItem - The item object to remove. This should be the exact object stored in the inventory.
     * @returns {boolean} True if the item was successfully removed, otherwise false.
     * 
     * @example
     * // Assuming an item exists in the inventory with a `vNum` of 123
     * const itemToRemove = inventory.get(123).find(item => item.id === specificId);
     * const result = inventory.removeItem(itemToRemove);
     * console.log(result); // true if removed, false otherwise
     */
    removeItem(targetItem) {
        // Assume we use 'vNum' as the key to access the items in the inventory
        const items = this.get(targetItem.vNum);
        if (items && items.length > 0) {
            const index = items.findIndex(item => item === targetItem);
            if (index !== -1) {
                items.splice(index, 1);  // Remove the item at the found index
                if (items.length === 0) {
                    this.delete(targetItem.vNum);  // If no items left, remove the key from the map
                }
                return true;
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
        let items = Array.from(this.entries()).map(([vNum, itemList]) => ({
            vNum: parseInt(vNum),
            data: itemList.map(item => item?.serialize())
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
        for (const [key, value] of this.entries()) {
            sizeActual += value.length;
        }
        return parseInt(sizeActual);
    }

    /**
     * Checks if the inventory is full.
     * 
     * @returns {boolean} - Returns true if the inventory is full, false otherwise.
     */
    full = () => { return this.actualSize() === this.maxSize; }

    /**
     * Deserializes a JSON string into an Inventory object.
     * 
     * @static
     * @param {Object} player - The player owning the inventory.
     * @param {string} data - A JSON string representing the inventory data.
     * @param {number} [maxSize=30] - Maximum number of items allowed in the inventory.
     * @returns {Inventory} - Returns an Inventory object.
     */
    static deserialize(data, maxSize = 30) {
        const inventory = new Inventory(maxSize);
        const invObj = JSON.parse(data);  // Assuming data is a JSON string
        const items = invObj.items;

        try {
            items.forEach(item => {
                item.data.forEach(newItem => {
                    const addItem = global.ItemModule.getItemByVNum(item.vNum).copy();
                    global.mudServer.emit('inventoryItemDeserialized', newItem, addItem);
                    inventory.addItem(parseInt(item.vNum), addItem, true);
                });
            });
        } catch (error) {
            console.error("Failed to deserialize inventory:", error);
            return new Inventory(maxSize); // Optionally return an empty inventory on failure
        }

        return inventory;
    }
}

module.exports = Inventory;
