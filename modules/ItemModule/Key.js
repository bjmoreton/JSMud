const { addMissingProperties } = require("../Mud/Helpers");
const Item = require("./Item");

class Key extends Item {
    constructor(vNum, name, nameDisplay, itemType) {
        super(vNum, name, nameDisplay, Item.ItemTypes.Key);
    }

    copy() {
        const baseItem = super.copy();
        const copiedItem = new Key(this.vNum, this.name, this.nameDisplay, this.itemType);
        addMissingProperties(baseItem, copiedItem);
        return copiedItem;
    }

    static deserialize(vNum, data) {
        // Data should already be an object, so no need to parse it
        const baseItem = super.deserialize(vNum, data);
        const deserializedItem = new Key(vNum, data.name, data.nameDisplay, data.itemType);
        addMissingProperties(baseItem, deserializedItem);
        return deserializedItem;
    }

    serialize() {
        let serializedItem = super.serialize();
        serializedItem = {
            ...serializedItem
        };
        addMissingProperties(this, serializedItem);
        return serializedItem
    }

    static toString() { return 'Key'; }
    static toLowerCase() { return Key.toString().toLowerCase(); }
}

module.exports = Key;