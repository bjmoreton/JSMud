const Inventory = require("../InventoryModule/Inventory");
const Item = require("./Item");

class Container extends Item {
    constructor(player, size, vNum, name, description) {
        super(vNum, name, description, Item.ItemTypes.Container);
        this.inventory = new Inventory(player, size);
    }
}

module.exports = Container;