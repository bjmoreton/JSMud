const { addMissingProperties } = require("../Mud/Helpers");
const Item = require("./Item");

/**
 * Class representing a key, extending the Item class.
 */
class Key extends Item {
    /**
     * Create a Key item.
     * @param {number} vNum - The virtual number of the item.
     * @param {string} name - The name of the item.
     * @param {string} nameDisplay - The display name of the item.
     * @param {string} itemType - The type of the item.
     */
    constructor(vNum, name, nameDisplay, itemType) {
        super(vNum, name, nameDisplay, itemType);
    }

    /**
     * Copy the key item.
     * @returns {Key} A copy of the key item.
     */
    copy() {
        const baseItem = super.copy();
        const copiedItem = new Key(this.vNum, this.name, this.nameDisplay, this.itemType);
        addMissingProperties(baseItem, copiedItem);
        return copiedItem;
    }

    /**
     * Deserialize data into a Key item.
     * @static
     * @param {number} vNum - The virtual number of the item.
     * @param {Object} data - The data to deserialize.
     * @returns {Key} The deserialized key item.
     */
    static deserialize(vNum, data) {
        const baseItem = super.deserialize(vNum, data);
        const deserializedItem = new Key(vNum, data.name, data.nameDisplay, data.itemType);
        addMissingProperties(baseItem, deserializedItem);
        return deserializedItem;
    }

    /**
     * Serialize the key item.
     * @returns {Object} The serialized data of the key item.
     */
    serialize() {
        let serializedItem = super.serialize();
        serializedItem = {
            ...serializedItem
        };
        addMissingProperties(this, serializedItem);
        return serializedItem;
    }

    /**
     * Get the string representation of the class.
     * @static
     * @returns {string} The string representation of the class.
     */
    static toString() { return 'Key'; }

    /**
     * Get the lowercase string representation of the class.
     * @static
     * @returns {string} The lowercase string representation of the class.
     */
    static toLowerCase() { return Key.toString().toLowerCase(); }
}

module.exports = Key;
