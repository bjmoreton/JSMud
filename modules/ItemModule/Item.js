/**
 * Class representing an item.
 */
class Item {
    static ItemFlags = {};
    static ItemTypes = {};
    static ItemRarities = {
        quest: { name: "quest", symbol: "[&YQ&~]", weight: 3 },
        trash: { name: "trash", symbol: "[&zT&~]", weight: 9 }
    };

    /**
     * Create an Item.
     * @param {number} vNum - The virtual number of the item.
     * @param {string} name - The name of the item.
     * @param {string} nameDisplay - The display name of the item.
     * @param {string} itemType - The type of the item.
     */
    constructor(vNum, name, nameDisplay, itemType) {
        this.vNum = parseInt(vNum);
        this.name = name;
        this.nameDisplay = nameDisplay;
        if (this.nameDisplay === undefined || this.nameDisplay === '') this.nameDisplay = this.name;
        this.itemType = Item.stringToItemType(itemType);
    }

    /**
     * Add flags to the item.
     * @param {...string} flags - The flags to add.
     */
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

    /**
     * Add item flags.
     * @static
     * @param {...string} flags - The flags to add.
     */
    static addItemFlag(...flags) {
        flags.forEach(flag => {
            Item.ItemFlags[flag.toLowerCase()] = flag.toLowerCase();
        });
    }

    /**
     * Add item rarities.
     * @static
     * @param {...Object} rarities - The rarities to add.
     */
    static addItemRarities(...rarities) {
        rarities.forEach(rarity => {
            Item.ItemRarities[rarity.name.toLowerCase()] = rarity;
        });
    }

    /**
     * Add item types.
     * @static
     * @param {...string} types - The types to add.
     */
    static addItemType(...types) {
        types.forEach(type => {
            Item.ItemTypes[type.toLowerCase()] = type;
        });
    }

    /**
     * Copy the item.
     * @returns {Item} A copy of the item.
     */
    copy() {
        const copiedItem = new Item(this.vNum, this.name, this.nameDisplay, this.itemType);
        copiedItem.flags = this.flags;
        copiedItem.rarity = this.rarity;
        copiedItem.groundDescription = this.groundDescription;
        copiedItem.description = this.description;
        return copiedItem;
    }

    /**
     * Deserialize data into an Item.
     * @static
     * @param {number} vNum - The virtual number of the item.
     * @param {Object} data - The data to deserialize.
     * @returns {Item} The deserialized item.
     */
    static deserialize(vNum, data) {
        const itemType = Item.stringToItemType(data.itemType);
        const deserializedItem = new itemType(vNum, data.name, data.nameDisplay, data.itemType);
        deserializedItem.flags = data.flags;
        deserializedItem.rarity = Item.getRarityByName(data.rarity?.name ?? 'trash');
        if (!deserializedItem.rarity) deserializedItem.rarity = Item.ItemRarities.trash;
        deserializedItem.groundDescription = data.groundDescription;
        deserializedItem.description = data.description;

        return deserializedItem;
    }

    /**
     * Get the display string of the item.
     * @returns {string} The display string of the item.
     */
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

        const lowerCaseRarityNames = rarityNames.map(name => name.toLowerCase());

        const rarities = lowerCaseRarityNames.length > 0
            ? allRarities.filter(r => lowerCaseRarityNames.includes(r.name.toLowerCase()))
            : allRarities;

        if (rarities.length === 0) return null;

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

    /**
     * Check if the item has specified flags.
     * @param {...string} flags - The flags to check.
     * @returns {boolean} True if the item has all specified flags, otherwise false.
     */
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

    /**
     * Get a comma-separated string of item flags in lowercase.
     * @static
     * @returns {string[]} An array of item flags in lowercase.
     */
    static getItemFlagsArray() {
        return Object.values(Item.ItemFlags)
            .map(flag => flag.toLowerCase());
    }

    /**
     * Get a comma-separated string of item rarities in lowercase.
     * @static
     * @returns {string[]} An array of item rarities in lowercase.
     */
    static getItemRaritiesArray() {
        return Object.values(Item.ItemRarities)
            .map(rarity => rarity.name.toLowerCase());
    }

    /**
     * Get a comma-separated string of item types in lowercase.
     * @static
     * @returns {string[]} An array of item types in lowercase.
     */
    static getItemTypesArray() {
        return Object.values(Item.ItemTypes)
            .map(type => type.toLowerCase());
    }

    /**
     * Get an item rarity by name.
     * @static
     * @param {string} name - The name of the rarity.
     * @returns {Object|null} The rarity object if found, otherwise null.
     */
    static getRarityByName(name) {
        for (const [key, val] of Object.entries(Item.ItemRarities)) {
            if (val.name.toLowerCase() === name.toLowerCase()) {
                return Item.ItemRarities[key];
            }
        }
        return null;
    }

    /**
     * Remove specified flags from the item.
     * @param {...string} flags - The flags to remove.
     */
    removeFlag(...flags) {
        if (!this.flags) this.flags = [];

        flags.forEach(flag => {
            flag = flag?.toLowerCase();
            const flagValue = Item.ItemFlags[flag];
            if (flagValue && this.hasFlag(flag)) {
                const index = this.flags.indexOf(flagValue);
                if (index !== -1) {
                    this.flags.splice(index, 1);
                }
            }
        });
    }

    /**
     * Serialize the item.
     * @returns {Object} The serialized data of the item.
     */
    serialize() {
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

    /**
     * Convert a string to an item type.
     * @static
     * @param {string} itemTypeString - The item type string to convert.
     * @returns {Object|null} The item type if found, otherwise null.
     */
    static stringToItemType(itemTypeString) {
        if (!itemTypeString || itemTypeString === '') return null;

        const normalizedInput = itemTypeString.toLowerCase();
        for (const key in Item.ItemTypes) {
            if (key.toLowerCase() === normalizedInput) {
                return Item.ItemTypes[key];
            }
        }
        return null;
    }
}

module.exports = Item;

