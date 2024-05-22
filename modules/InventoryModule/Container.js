const Inventory = require("./Inventory");
const Item = require("../ItemModule/Item");
const { addMissingProperties } = require("../Mud/Helpers");

class Container extends Item {
    constructor(vNum, name, nameDisplay, itemType, maxSize = 10) {
        super(vNum, name, nameDisplay, Item.ItemTypes.Container);
        this.inventory = new Inventory(maxSize);
    }

    copy() {
        const baseItem = super.copy();
        const copiedItem = new Container(this.vNum, this.name, this.nameDisplay, this.itemType, this.inventory.mazSize);
        addMissingProperties(baseItem, copiedItem);
        if (this.inventory) copiedItem.inventory = this.inventory.copy();
        addMissingProperties(this, copiedItem);
        return copiedItem;
    }

    static deserialize(vNum, data) {
        // Data should already be an object, so no need to parse it
        const baseItem = super.deserialize(vNum, data);
        const deserializedItem = new Container(vNum, data.name, data.nameDisplay, data.itemType, data.inventory.maxSize);
        addMissingProperties(baseItem, deserializedItem);
        if(data.inventory) deserializedItem.inventory = Inventory.deserialize(JSON.stringify(data.inventory), data.inventory.maxSize);
        return deserializedItem;
    }

    serialize() {
        let serializedItem = super.serialize();
        serializedItem = {
            ...serializedItem,
            inventory: this.inventory.serialize()
        };
        addMissingProperties(this, serializedItem);
        return serializedItem
    }

    static toString() { return 'Container'; }
    static toLowerCase() { return Container.toString().toLowerCase(); }
}

module.exports = Container;