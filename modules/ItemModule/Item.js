const { stringToBoolean, addMissingProperties } = require("../Mud/Helpers");
const ItemFlags = require("../ItemModule/ItemFlags");
/**
 * Class representing an item.
 */
class Item {
    static ItemTypes = {};
    static ItemRarities = {};

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
        this.saved = false;
        this.delete = false;
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
        copiedItem.flags = this.flags.copy();
        copiedItem.rarity = { ...this.rarity };
        copiedItem.groundDescription = this.groundDescription;
        copiedItem.description = this.description;
        copiedItem.delete = false;
        copiedItem.saved = false;
        return copiedItem;
    }

    static sync(source, destination) {
        destination.flags = source.flags.copy();
        if (!source.rarity) {
            destination.rarity = { ...Item.getRarityByName(destination.rarity?.name) };
        } else {
            destination.rarity = { ...source.rarity };
        }
        destination.groundDescription = source.groundDescription;
        destination.description = source.description;
        destination.name = source.name;
        destination.nameDisplay = source.nameDisplay;
        addMissingProperties(source, destination);

        return destination;
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
        if (data.flags) {
            if (!deserializedItem.flags) deserializedItem.flags = new ItemFlags();
            data.flags.forEach(flag => {
                deserializedItem.flags.add(flag);
            });
        }
        deserializedItem.rarity = Item.getRarityByName(data.rarity?.name);
        if (!deserializedItem.rarity) deserializedItem.rarity = undefined;
        deserializedItem.groundDescription = data.groundDescription;
        deserializedItem.description = data.description;
        deserializedItem.delete = stringToBoolean(data.delete);
        deserializedItem.saved = stringToBoolean(data.saved);
        addMissingProperties(data, deserializedItem);
        return deserializedItem;
    }

    /**
     * Get the display string of the item.
     * @returns {string} The display string of the item.
     */
    get displayString() {
        return `${this.rarity?.symbol ? this.rarity.symbol : ''} ${this.nameDisplay}`;
    }

    /**
     * Get a random rarity based on weights, with optional offsets specific to each rarity.
     * @param  {...string} rarityNames - The names of rarities to consider.
     * @returns {Object} - The selected rarity object.
     */
    static getRandomRarity(...rarityNames) {
        const allRarities = Object.values(Item.ItemRarities);

        const lowerCaseRarityNames = rarityNames.map(name => name.toLowerCase());

        const rarities = lowerCaseRarityNames.length > 0
            ? allRarities.filter(r => lowerCaseRarityNames.includes(r.name.toLowerCase()) && r.randomSpawn)
            : allRarities.filter(r => r.randomSpawn);

        if (rarities.length === 0) return undefined;

        const totalWeight = rarities.reduce((acc, rarity) => {
            return acc + rarity.weight;
        }, 0);

        let random = Math.random() * totalWeight;

        for (const rarity of rarities) {
            if (random < rarity.weight) {
                return rarity;
            }
            random -= rarity.weight;
        }

        // Fallback in case of floating-point precision issues
        return undefined;
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
            if (val.name.toLowerCase() === name?.toLowerCase()) {
                return Item.ItemRarities[key];
            }
        }
        return null;
    }

    /**
     * Serialize the item.
     * @returns {Object} The serialized data of the item.
     */
    serialize() {
        this.saved = true;

        return {
            name: this.name,
            nameDisplay: this.nameDisplay,
            description: this.description,
            groundDescription: this.groundDescription,
            flags: this.flags.serialize(),
            itemType: this.itemType.toString(),
            rarity: this.rarity,
            delete: this.delete,
            saved: true,
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

