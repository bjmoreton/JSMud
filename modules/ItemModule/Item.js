class Item {
    static ItemTypes = {}

    static addItemType(type) {
        if (!Item.ItemTypes[type.toString()]) Item.ItemTypes[type.toString()] = type;
    }

    static deserialize(data) {
        // Data should already be an object, so no need to parse it
        return new Item.stringToItemType(data.itemType)(data.vNum, data.name, data.nameDisplay, data.description, data.itemType);
    }

    // Method to get a comma-separated string of item types in lowercase
    static getItemTypesArray() {
        // Extract the values from the ItemTypes object, convert them to lowercase, and join them into a string
        return Object.values(Item.ItemTypes)
            .map(type => type.toLowerCase());  // Convert each type to lowercase
    }

    serialize() {
        // Return an object instead of stringifying it here
        return {
            name: this.name,
            nameDisplay: this.nameDisplay,
            description: this.description,
            itemType: this.itemType.toString()
        };
    }

    // Method to convert string to ItemType
    static stringToItemType(itemTypeString) {
        const normalizedInput = itemTypeString.toLowerCase();
        for (const key in Item.ItemTypes) {
            if (key.toLowerCase() === normalizedInput) {
                return Item.ItemTypes[key];
            }
        }
        return null; // Return null if no matching state is found
    }

    constructor(vNum, name, nameDisplay, description, itemType) {
        this.vNum = parseInt(vNum);
        this.name = name;
        this.nameDisplay = nameDisplay;
        if (this.nameDisplay === undefined) this.nameDisplay = this.name;
        this.description = description;
        this.itemType = Item.stringToItemType(itemType);
    }

    copy() {
        return new Item(this.vNum, this.name, this.nameDisplay, this.description, this.itemType);
    }
}

module.exports = Item;