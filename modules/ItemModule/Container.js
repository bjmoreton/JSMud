const Inventory = require("../InventoryModule/Inventory");
const Item = require("./Item");

class Container extends Item {
    constructor(size, vNum, name, description) {
        super(vNum, name, description, Item.ItemTypes.Container);
        this.inventory = new Inventory(size);
    }
}

module.exports = Container;