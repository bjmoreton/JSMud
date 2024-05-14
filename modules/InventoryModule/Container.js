const Inventory = require("./Inventory");
const Item = require("../ItemModule/Item");

class Container extends Item {
    constructor(vNum, name, nameDisplay, description, itemType, size = 10) {
        super(vNum, name, nameDisplay, description, Item.ItemTypes.Container);
        this.inventory = new Inventory(size);
    }

    copy() {
        return new Container(this.vNum, this.name, this.nameDisplay, this.description, this.itemType, this.inventory.maxSize);
    }

    serialize() {
        // Return an object instead of stringifying it here
        return {
            name: this.name,
            nameDisplay: this.nameDisplay,
            description: this.description,
            itemType: this.itemType.toString(),
            inventory: this.inventory.serialize()
        };
    }

    static toString() { return 'Container'; }
    static toLowerCase() { return Container.toString().toLowerCase(); }
}

module.exports = Container;