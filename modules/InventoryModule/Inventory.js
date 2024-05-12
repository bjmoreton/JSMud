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
     * Removes an item from the inventory by vNum.
     * 
     * @param {number} vNum - The unique identifier of the item.
     * @returns {boolean} - Returns true if the item is successfully removed, false otherwise.
     */
    removeItem(vNum) {
        const items = this.get(vNum);
        if (items && items.length > 0) {
            items.shift();
            if (items.length === 0) this.delete(vNum);
            return true;
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
    static deserialize(player, data, maxSize = 30) {
        const inventory = new Inventory(maxSize);
        const invObj = JSON.parse(data);  // Assuming data is a JSON string
        const items = invObj.items;

        try {
            items.forEach(item => {
                item.data.forEach(newItem => {
                    const addItem = global.ItemModule.getItemByVNum(item.vNum);
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
