class Item {
    static ItemFlags = {};
    static ItemTypes = {};
    static ItemRarities = {
        quest: { name: "quest", symbol: "[&YQ&~]", weight: 3 },
        trash: { name: "trash", symbol: "[&zT&~]", weight: 9 }
    };

    addFlag(...flags) {
        if (!this.flags) this.flags = [];

        flags.forEach(flag => {
            flag = flag?.toLowerCase();
            const flagValue = Item.ItemFlags[flag];

            if (flagValue && !this.hasFlag(flag)) {
                this.flags.push(flagValue);
            }
        });
    }

    static addItemFlag(...flags) {
        flags.forEach(flag => {
            Item.ItemFlags[flag.toLowerCase()] = flag.toLowerCase();
        });
    }

    static addItemRarities(...rarities) {
        rarities.forEach(rarity => {
            Item.ItemRarities[rarity.name.toLowerCase()] = rarity;
        });
    }

    static addItemType(...types) {
        types.forEach(type => {
            Item.ItemTypes[type.toLowerCase()] = type;
        });
    }

    constructor(vNum, name, nameDisplay, itemType) {
        this.vNum = parseInt(vNum);
        this.name = name;
        this.nameDisplay = nameDisplay;
        if (this.nameDisplay === undefined || this.nameDisplay === '') this.nameDisplay = this.name;
        this.itemType = Item.stringToItemType(itemType);
    }

    copy() {
        const copiedItem = new Item(this.vNum, this.name, this.nameDisplay, this.itemType);
        copiedItem.flags = this.flags;
        copiedItem.rarity = this.rarity;
        copiedItem.groundDescription = this.groundDescription;
        copiedItem.description = this.description;
        return copiedItem;
    }

    static deserialize(vNum, data) {

        // Data should already be an object, so no need to parse it
        const itemType = Item.stringToItemType(data.itemType);
        const deserializedItem = new itemType(vNum, data.name, data.nameDisplay, data.itemType);
        deserializedItem.flags = data.flags;
        deserializedItem.rarity = Item.getRarityByName(data.rarity?.name ?? 'trash');
        if (!deserializedItem.rarity) deserializedItem.rarity = Item.ItemRarities.trash;
        deserializedItem.groundDescription = data.groundDescription;
        deserializedItem.description = data.description;

        return deserializedItem;
    }

    get displayString() {
        return `${this.rarity.symbol} ${this.nameDisplay}`;
    }

    /**
     * Get a random rarity based on weights, with optional offsets specific to each rarity.
     * @param {Object} weightOffsets - An object where keys are rarity names and values are weight offsets.
     * @param  {...string} rarityNames - The names of rarities to consider.
     * @returns {Object} - The selected rarity object.
     */
    static getRandomRarity(weightOffsets = {}, ...rarityNames) {
        const allRarities = Object.values(Item.ItemRarities);

        // Convert rarityNames to lowercase for case-insensitive comparison
        const lowerCaseRarityNames = rarityNames.map(name => name.toLowerCase());

        // Filter rarities if specific names are provided
        const rarities = lowerCaseRarityNames.length > 0
            ? allRarities.filter(r => lowerCaseRarityNames.includes(r.name.toLowerCase()))
            : allRarities;


        // If no rarities match, return null or handle it as needed
        if (rarities.length === 0) return null;

        // Calculate total weight with offsets applied
        const totalWeight = rarities.reduce((acc, rarity) => {
            const offset = weightOffsets[rarity.name.toLowerCase()] || 0;
            return acc + (rarity.weight + offset);
        }, 0);

        let random = Math.random() * totalWeight;

        for (const rarity of rarities) {
            const offset = weightOffsets[rarity.name.toLowerCase()] || 0;
            const adjustedWeight = rarity.weight + offset;
            if (random < adjustedWeight) {
                return rarity;
            }
            random -= adjustedWeight;
        }

        // Fallback in case of floating-point precision issues
        return Item.ItemRarities.trash;
    }

    hasFlag(...flags) {
        if (!this.flags) return false;

        for (let flag of flags) {
            flag = flag?.toLowerCase();
            const flagValue = Item.ItemFlags[flag];
            if (!flagValue) {
                return false;
            }
            const index = this.flags.indexOf(flagValue);
            if (index === -1) {
                return false;
            }
        }
        return true;
    }

    // Method to get a comma-separated string of item flags in lowercase
    static getItemFlagsArray() {
        // Extract the values from the ItemFlags object, convert them to lowercase, and join them into a string
        return Object.values(Item.ItemFlags)
            .map(flag => flag.toLowerCase());  // Convert each flag to lowercase
    }

    // Method to get a comma-separated string of item rarities in lowercase
    static getItemRaritiesArray() {
        // Extract the values from the ItemRarities object, convert them to lowercase, and join them into a string
        return Object.values(Item.ItemRarities)
            .map(rarity => rarity.name.toLowerCase());  // Convert each rarity to lowercase
    }

    // Method to get a comma-separated string of item types in lowercase
    static getItemTypesArray() {
        // Extract the values from the ItemTypes object, convert them to lowercase, and join them into a string
        return Object.values(Item.ItemTypes)
            .map(type => type.name.toLowerCase());  // Convert each type to lowercase
    }

    static getRarityByName(name) {
        for (const [key, val] of Object.entries(Item.ItemRarities)) {
            if (val.name.toLowerCase() === name.toLowerCase()) {
                return Item.ItemRarities[key];
            }
        }
        return null; // Or handle the case where the value is not found
    }

    removeFlag(...flags) {
        if (!this.flags) this.flags = [];

        flags.forEach(flag => {
            flag = flag?.toLowerCase();
            const flagValue = Item.ItemFlags[flag];
            if (flagValue && this.hasFlag(flag)) {
                const index = this.flags.indexOf(flagValue);
                if (index !== -1) {
                    this.flags.splice(index, 1); // Remove the flag from the flags array
                }
            }
        });
    }

    serialize() {
        // Return an object instead of stringifying it here
        return {
            name: this.name,
            nameDisplay: this.nameDisplay,
            description: this.description,
            groundDescription: this.groundDescription,
            flags: this.flags,
            itemType: this.itemType.toString(),
            rarity: this.rarity
        };
    }

    // Method to convert string to ItemType
    static stringToItemType(itemTypeString) {
        if (!itemTypeString || itemTypeString === '') return null;
        
        const normalizedInput = itemTypeString.toLowerCase();
        for (const key in Item.ItemTypes) {
            if (key.toLowerCase() === normalizedInput) {
                return Item.ItemTypes[key];
            }
        }
        return null; // Return null if no matching state is found
    }
}

module.exports = Item;