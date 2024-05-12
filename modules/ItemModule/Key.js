const Item = require("./Item");

class Key extends Item {
    constructor(vNum, name, nameDisplay, description) {
        super(vNum, name, nameDisplay, description, Item.ItemTypes.Key);
    }

    static toString() { return 'Key'; }
    static toLowerCase() { return Key.toString().toLowerCase(); }
}

module.exports = Key;