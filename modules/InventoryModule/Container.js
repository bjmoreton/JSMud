const Inventory = require("./Inventory");
const Item = require("../ItemModule/Item");
const { addMissingProperties } = require("../Mud/Helpers");

/**
 * Class representing a container, extending the Item class.
 */
class Container extends Item {
    /**
     * Create a Container item.
     * @param {number} vNum - The virtual number of the item.
     * @param {string} name - The name of the item.
     * @param {string} nameDisplay - The display name of the item.
     * @param {string} itemType - The type of the item.
     * @param {number} [maxSize=10] - The maximum size of the container.
     */
    constructor(vNum, name, nameDisplay, itemType, maxSize = 10) {
        super(vNum, name, nameDisplay, Item.ItemTypes.Container);
        /**
         * The inventory of the container.
         * @type {Inventory}
         */
        this.inventory = new Inventory(maxSize);
    }

    /**
     * Copy the container item.
     * @returns {Container} A copy of the container item.
     */
    copy() {
        const baseItem = super.copy();
        const copiedItem = new Container(this.vNum, this.name, this.nameDisplay, this.itemType, this.inventory.maxSize);
        addMissingProperties(baseItem, copiedItem);
        if (this.inventory) copiedItem.inventory = this.inventory.copy();
        addMissingProperties(this, copiedItem);
        return copiedItem;
    }

    static sync(source, destination) {
        destination = super.sync(source, destination);
        if (!destination.inventory) destination.inventory = new Inventory(source.inventory.maxSize);
        else if (source.inventory) destination.inventory.maxSize = source.inventory.maxSize;

        return destination;
    }
    /**
     * Deserialize data into a Container item.
     * @param {number} vNum - The virtual number of the item.
     * @param {Object} data - The data to deserialize.
     * @returns {Container} The deserialized container item.
     */
    static deserialize(vNum, data) {
        const baseItem = super.deserialize(vNum, data);
        const deserializedItem = new Container(vNum, data.name, data.nameDisplay, data.itemType, data.inventory.maxSize);
        addMissingProperties(baseItem, deserializedItem);
        if (data.inventory) deserializedItem.inventory = Inventory.deserialize(JSON.stringify(data.inventory), data.inventory.maxSize);
        return deserializedItem;
    }

    /**
     * Serialize the container item.
     * @returns {Object} The serialized data of the container item.
     */
    serialize() {
        let serializedItem = super.serialize();
        serializedItem = {
            ...serializedItem,
            inventory: this.inventory.serialize()
        };
        addMissingProperties(this, serializedItem);
        return serializedItem;
    }

    /**
     * Get the string representation of the class.
     * @returns {string} The string representation of the class.
     */
    static toString() { return 'Container'; }

    /**
     * Get the lowercase string representation of the class.
     * @returns {string} The lowercase string representation of the class.
     */
    static toLowerCase() { return Container.toString().toLowerCase(); }
}

module.exports = Container;
