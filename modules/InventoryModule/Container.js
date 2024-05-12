const Inventory = require("./Inventory");
const Item = require("../ItemModule/Item");

class Container extends Item {
    /**
     * Adds an item to the container inventory.
     * 
     * @param {number} vNum - The unique identifier of the item.
     * @param {Object} item - The item to be added.
     * @param {boolean} [bypass=false] - If true, bypasses the inventory size limit.
     * @returns {boolean} - Returns true if the item is successfully added, false otherwise.
     */
    addItem(vNum, item, bypass = false) { return this.inventory.addItem(vNum, item, bypass); }

    constructor(vNum, name, nameDisplay, description, itemType, size = 10) {
        super(vNum, name, nameDisplay, description, Item.ItemTypes.Container);
        this.inventory = new Inventory(size);
    }
    
    static toString() { return 'Container'; }
    static toLowerCase() { return Container.toString().toLowerCase(); }
}

module.exports = Container;