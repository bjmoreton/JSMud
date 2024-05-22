const Item = require("../ItemModule/Item");
const { addMissingProperties } = require("../Mud/Helpers");

class Equipment extends Item {
    addEQType(...types) {
        types.forEach(type => {
            type = type?.toLowerCase();
            const EQTypeValue = Item.ItemTypes[type];
            if (EQTypeValue && !this.hasEQType(type)) {
                this.equipmentTypes.push(EQTypeValue);
            }
        });
    }

    constructor(vNum, name, nameDisplay, itemType) {
        super(vNum, name, nameDisplay, itemType);
    }

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

    static deserialize(vNum, data) {
        // Data should already be an object, so no need to parse it
        const baseItem = super.deserialize(vNum, data);
        const deserializedItem = new Equipment(vNum, data.name, data.nameDisplay, data.itemType);
        deserializedItem.wearable = data.wearable;
        deserializedItem.layer = data.layer;
        deserializedItem.types = data.types;
        addMissingProperties(baseItem, deserializedItem);
        return deserializedItem;
    }

    // Method to get a comma-separated string of equipmwnr types in lowercase
    static getEquipmentTypesArray() {
        // Extract the values from the EquipmentTypes object, convert them to lowercase, and join them into a string
        return Object.values(Equipment.EquipmentTypes)
            .map(type => type.toLowerCase());  // Convert each type to lowercase
    }

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

    serialize() {
        let serializedItem = super.serialize();
        serializedItem = {
            ...serializedItem,
        };
        addMissingProperties(this, serializedItem);
        return serializedItem
    }

    static toString() { return 'Equipment'; }
    static toLowerCase() { return Equipment.toString().toLowerCase(); }
}

module.exports = Equipment;