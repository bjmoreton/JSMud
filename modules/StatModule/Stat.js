const { addMissingProperties } = require("../Mud/Helpers");

class Stat {
    constructor(name, shortName) {
        this.name = name;
        this.shortName = shortName;
    }

    copy() {
        const copiedItem = new Stat(this.name, this.shortName);
        addMissingProperties(this, copiedItem);

        return copiedItem;
    }

    static deserialize(data) {
        const deserializedItem = new Stat(data.name, data.shortName);
        addMissingProperties(data, deserializedItem);
        return deserializedItem;
    }

    serialize() {
        return {
            ...this
        }
    }
}

module.exports = Stat;