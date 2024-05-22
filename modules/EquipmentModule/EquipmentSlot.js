const Item = require("../ItemModule/Item");
const { isNumber, addMissingProperties } = require("../Mud/Helpers");

class EquipmentSlot {
    constructor(name, eqType, layers = 1) {
        if (!isNumber(layers)) layers = 1;
        this.name = name;
        this.eqType = Item.stringToItemType(eqType);
        this.layers = parseInt(layers);
        this.items = new Map();
    }

    copy() {
        const copiedItem = new EquipmentSlot(this.name, this.eqType.toString(), this.layers);
        copiedItem.items = new Map();
        copiedItem.displayString = this.displayString;
        addMissingProperties(this, copiedItem);
        return copiedItem;
    }

    static deserialize(data) {
        // Data should already be an object, so no need to parse it
        const deserializedItem = new EquipmentSlot(data.name, data.eqType, data.layers);
        deserializedItem.displayString = data.displayString;
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

    equip(item) {
        if (this.items.size <= this.layers) {
            // Check if the item is already in the equipment slot
            if (!this.items.has(item.vNum)) {
                // Check if there is a higher layer equipped
                for (let equippedItem of this.items.values()) {
                    if (equippedItem.layer > item.layer) {
                        return `Must remove ${equippedItem.name} (layer ${equippedItem.layer}) first!`;
                    }
                }
                // If no conflict, add the item to the slot
                this.items.set(item.vNum, item);
                return true; // Successfully equipped
            }

            return `Already wearing ${item.name}!`; // Item is already equipped in this slot
        } else {
            return `Can't wear anything else there.`;
        }
    }

    serialize() {
        // Return an object instead of stringifying it here
        return {
            displayString: this.displayString,
            name: this.name,
            eqType: this.eqType.toString(),
            layers: parseInt(this.layers),
            items: Array.from(this.items.values()).map(item => item.serialize())
        };
    }

    unequip(item) {
        // Check if the item is currently equipped
        if (this.items.has(item.vNum)) {
            // Check if the item is the highest layer
            for (let equippedItem of this.items.values()) {
                if (equippedItem.layer > item.layer) {
                    return `Must remove ${equippedItem.name} (layer ${equippedItem.layer}) first!`;
                }
            }

            // Remove the item from the slot
            this.items.delete(item.vNum);
            return true; // Successfully unequipped
        }

        return `Not wearing ${item.name}!`; // Item is not equipped in this slot
    }
}

module.exports = EquipmentSlot;