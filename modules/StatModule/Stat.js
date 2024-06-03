const { addMissingProperties } = require("../Mud/Helpers");

/**
 * Class representing a stat.
 */
class Stat {
    /**
     * Creates an instance of Stat.
     * @param {string} name - The name of the stat.
     * @param {string} shortName - The short name of the stat.
     */
    constructor(name, shortName) {
        this.name = name;
        this.shortName = shortName;
    }

    /**
     * Creates a copy of the stat.
     * @returns {Stat} A copy of the stat.
     */
    copy() {
        const copiedItem = new Stat(this.name, this.shortName);
        addMissingProperties(this, copiedItem);
        return copiedItem;
    }

    /**
     * Deserializes data into a Stat instance.
     * @param {Object} data - The data to deserialize.
     * @returns {Stat} The deserialized stat.
     */
    static deserialize(data) {
        const deserializedItem = new Stat(data.name, data.shortName);
        if(data.originalValue) deserializedItem.originalValue = Number(data.originalValue);
        if(data.value) deserializedItem.value = Number(data.value);
        addMissingProperties(data, deserializedItem);
        return deserializedItem;
    }

    /**
     * Serializes the stat into a JSON-compatible object.
     * @returns {Object} The serialized stat data.
     */
    serialize() {
        return {
            ...this
        };
    }
}

module.exports = Stat;
