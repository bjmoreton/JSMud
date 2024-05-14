const Item = require("./Item");

class Key extends Item {
    constructor(vNum, name, nameDisplay, description, itemType) {
        super(vNum, name, nameDisplay, description, Item.ItemTypes.Key);
    }

    copy() {
        return new Key(this.vNum, this.name, this.nameDisplay, this.description, this.itemType);
    }

    static toString() { return 'Key'; }
    static toLowerCase() { return Key.toString().toLowerCase(); }
}

module.exports = Key;