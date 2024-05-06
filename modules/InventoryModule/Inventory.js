const { isNumber } = require("../../Utils/helpers");
const Item = require("./Item");

class Inventory extends Map {
    constructor(player, maxSize = 30) {
        super();
        this.maxSize = maxSize;
        this.player = player;
    }

    addItem(vNum, item) {
        const vNumParsed = parseInt(vNum);
        if (isNumber(vNumParsed)) {
            if (this.size + 1 <= this.maxSize) {
                if (this.has(vNumParsed)) {
                    this.get(vNumParsed).push(item);
                } else {
                    const itemArray = [];
                    itemArray.push(item);
                    this.set(vNumParsed, itemArray);
                }
                return true;
            } else {
                this.player.send(`Inventory is full!`);
            }
        }
        return false;
    }

    serialize() {
        let items = Array.from(this.entries()).map(([vNum, itemList]) => ({
            vNum: parseInt(vNum),
            data: itemList.map(item => item.serialize())  // Directly use serialize to get the object
        }));
        return items;  // Only stringify once, at the top level
    }

    static deserialize(player, data, maxSize = 30) {
        let inventory = new Inventory(player, maxSize);
        let items = JSON.parse(data);  // Assuming data is a JSON string
        try {
            items.forEach(item => {
                item.data.forEach(newItem => {
                    inventory.addItem(item.vNum, new Item(item.vNum, newItem.name, newItem.description, newItem.itemType));
                });
            });
        } catch (error) {
            console.error("Failed to deserialize inventory:", error);
            return new Inventory(player, maxSize); // Optionally return an empty inventory on failure
        }
        return inventory;
    }
}

module.exports = Inventory;