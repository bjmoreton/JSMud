const Item = require("../ItemModule/Item");
const { isNumber, addMissingProperties } = require("../Mud/Helpers");

/**
 * Class representing an equipment slot.
 */
class EquipmentSlot {
    /**
     * Create an EquipmentSlot.
     * @param {string} name - The name of the equipment slot.
     * @param {string} eqType - The equipment type.
     * @param {number} [layers=1] - The number of layers allowed in the slot.
     */
    constructor(name, eqType, layers = 1) {
        if (!isNumber(layers)) layers = 1;
        this.name = name;
        this.eqType = Item.stringToItemType(eqType);
        this.layers = parseInt(layers);
        this.items = new Map();
        this.saved = false;
    }

    /**
     * Copy the equipment slot.
     * @returns {EquipmentSlot} A copy of the equipment slot.
     */
    copy() {
        const copiedItem = new EquipmentSlot(this.name, this.eqType.toString(), this.layers);
        copiedItem.items = new Map();
        copiedItem.displayString = this.displayString;
        copiedItem.saved = this.saved;
        addMissingProperties(this, copiedItem);
        return copiedItem;
    }

    /**
     * Deserialize data into an EquipmentSlot.
     * @param {Object} data - The data to deserialize.
     * @returns {EquipmentSlot} The deserialized equipment slot.
     */
    static deserialize(data) {
        const deserializedItem = new EquipmentSlot(data.name, data.eqType, data.layers);
        deserializedItem.displayString = data.displayString;
        deserializedItem.saved = data.saved;
        deserializedItem.items = new Map();
        if (data.items) {
            if (Array.isArray(data.items)) {
                data.items.forEach(item => {
                    const itemType = Item.stringToItemType(item.itemType);
                    deserializedItem.items.set(item.vNum, itemType.deserialize(item.vNum, item));
                });
            }
        }
        return deserializedItem;
    }

    /**
     * Equip an item in the equipment slot.
     * @param {Object} item - The item to equip.
     * @returns {string|boolean} A message indicating the result of the equip action, or true if successful.
     */
    equip(item) {
        if (item.types.includes(this.name.toLowerCase())) {
            if (this.items.size <= this.layers) {
                if (!this.items.has(item.vNum)) {
                    for (let equippedItem of this.items.values()) {
                        if (equippedItem.layer > item.layer) {
                            return `Must remove ${equippedItem.name} (layer ${equippedItem.layer}) first!`;
                        }
                    }
                    this.items.set(item.vNum, item);
                    return true;
                }
                return `Already wearing ${item.name}!`;
            } else {
                return `Can't wear anything else there.`;
            }
        } else {
            return `Can't wear ${item.name} in slot ${this.name}`;
        }
    }

    /**
     * Serialize the equipment slot.
     * @returns {Object} The serialized data of the equipment slot.
     */
    serialize() {
        this.saved = true;
        return {
            delete: this.delete,
            displayString: this.displayString,
            name: this.name,
            eqType: this.eqType.toString(),
            layers: parseInt(this.layers),
            items: Array.from(this.items.values()).map(item => item.serialize()),
            saved: true,
        };
    }

    /**
     * Unequip an item from the equipment slot.
     * @param {Object} item - The item to unequip.
     * @returns {string|boolean} A message indicating the result of the unequip action, or true if successful.
     */
    unequip(item) {
        if (this.items.has(item.vNum)) {
            for (let equippedItem of this.items.values()) {
                if (equippedItem.layer > item.layer) {
                    return `Must remove ${equippedItem.name} (layer ${equippedItem.layer}) first!`;
                }
            }
            this.items.delete(item.vNum);
            return true;
        }
        return `Not wearing ${item.name}!`;
    }
}

module.exports = EquipmentSlot;
