class Item {
    static ItemTypes = {
        Container: "Container",
        Drink: "Drink",
        Food: "Food",
        Key: "Key",
        Quest: "Quest",
        Other: "Other",
    }

    static deserialize(data) {
        // Data should already be an object, so no need to parse it
        return new Item(data.vNum, data.name, data.description, data.itemType);
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
            description: this.description,
            itemType: this.itemType
        };
    }

    // Method to convert string to ItemType
    static stringToItemType(str) {
        const typeMap = {
            "container": Item.ItemTypes.Container,
            "drink": Item.ItemTypes.Drink,
            "food": Item.ItemTypes.Food,
            "key": Item.ItemTypes.Key,
            "quest": Item.ItemTypes.Quest,
            "other": Item.ItemTypes.Other
        };

        // Normalize the string to lowercase to make the method case-insensitive
        const normalizedStr = str?.toLowerCase();
        return typeMap[normalizedStr] || Item.ItemTypes.Other; // Default to 'Other' if not found
    }

    constructor(vNum, name, description, itemType) {
        this.vNum = parseInt(vNum);
        this.name = name;
        this.description = description;
        this.itemType = Item.stringToItemType(itemType);
    }
}

module.exports = Item;