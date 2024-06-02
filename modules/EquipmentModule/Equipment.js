const Item = require("../ItemModule/Item");
const { addMissingProperties } = require("../Mud/Helpers");

/**
 * Class representing equipment, extending the Item class.
 */
class Equipment extends Item {
    /**
     * Create an Equipment item.
     * @param {number} vNum - The virtual number of the item.
     * @param {string} name - The name of the item.
     * @param {string} nameDisplay - The display name of the item.
     * @param {string} itemType - The type of the item.
     */
    constructor(vNum, name, nameDisplay, itemType) {
        super(vNum, name, nameDisplay, itemType);
    }

    /**
     * Add equipment types to the item.
     * @param {...string} types - The types to add.
     */
    addEQType(...types) {
        types.forEach(type => {
            type = type?.toLowerCase();
            const EQTypeValue = Item.ItemTypes[type];
            if (EQTypeValue && !this.hasEQType(type)) {
                this.equipmentTypes.push(EQTypeValue);
            }
        });
    }

    /**
     * Copy the equipment item.
     * @returns {Equipment} A copy of the equipment item.
     */
    copy() {
        const baseItem = super.copy();
        const copiedItem = new Equipment(this.vNum, this.name, this.nameDisplay, this.itemType);
        copiedItem.wearable = this.wearable;
        copiedItem.layer = this.layer;
        copiedItem.types = this.types;
        addMissingProperties(baseItem, copiedItem);
        addMissingProperties(this, copiedItem);
        return copiedItem;
    }

    static sync(source, destination) {
        destination = super.sync(source, destination);
        destination.wearable = source.wearable;
        destination.layer = source.layer;
        destination.types = source.types;

        return destination;
    }

    /**
     * Deserialize data into an Equipment item.
     * @param {number} vNum - The virtual number of the item.
     * @param {Object} data - The data to deserialize.
     * @returns {Equipment} The deserialized equipment item.
     */
    static deserialize(vNum, data) {
        const baseItem = super.deserialize(vNum, data);
        const deserializedItem = new Equipment(vNum, data.name, data.nameDisplay, data.itemType);
        deserializedItem.wearable = data.wearable;
        deserializedItem.layer = data.layer;
        deserializedItem.types = data.types;
        addMissingProperties(baseItem, deserializedItem);
        return deserializedItem;
    }

    /**
     * Get a comma-separated string of equipment types in lowercase.
     * @returns {string[]} An array of equipment types in lowercase.
     */
    static getEquipmentTypesArray() {
        return Object.values(Equipment.EquipmentTypes)
            .map(type => type.toLowerCase());
    }

    /**
     * Check if the item has specified equipment types.
     * @param {...string} types - The types to check.
     * @returns {boolean} True if the item has all specified types, otherwise false.
     */
    hasEQType(...types) {
        if (!this.equipmentTypes) return false;

        for (let type of types) {
            type = type?.toLowerCase();
            const typeValue = Item.ItemTypes[type];
            if (!typeValue) {
                console.log(`Flag "${type}" does not exist in Item.ItemTypes`);
                return false;
            }
            const index = this.equipmentTypes.indexOf(typeValue);
            if (index === -1) {
                console.log(`Equipment type "${type}" with value "${typeValue}" not found in equipment types!`);
                return false;
            }
        }
        return true;
    }

    /**
     * Remove specified equipment types from the item.
     * @param {...string} types - The types to remove.
     */
    removeEQType(...types) {
        types.forEach(type => {
            type = type?.toLowerCase();
            const EQTypeValue = Item.ItemTypes[type];
            if (EQTypeValue && this.hasFlag(type)) {
                const index = this.equipmentTypes.indexOf(EQTypeValue);
                if (index !== -1) {
                    this.equipmentTypes.splice(index, 1); // Remove the type from the types array
                }
            }
        });
    }

    /**
     * Serialize the equipment item.
     * @returns {Object} The serialized data of the equipment item.
     */
    serialize() {
        let serializedItem = super.serialize();
        serializedItem = {
            ...serializedItem,
        };
        addMissingProperties(this, serializedItem);
        return serializedItem;
    }

    /**
     * Get the string representation of the class.
     * @returns {string} The string representation of the class.
     */
    static toString() { return 'Equipment'; }

    /**
     * Get the lowercase string representation of the class.
     * @returns {string} The lowercase string representation of the class.
     */
    static toLowerCase() { return Equipment.toString().toLowerCase(); }
}

module.exports = Equipment;
