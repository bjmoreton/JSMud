const { isNumber } = require("../../Utils/helpers");
const Item = require("../ItemModule/Item");
const Player = require("../PlayerModule/Player");

class Inventory extends Map {
    constructor(parent, maxSize = 30) {
        super();
        this.maxSize = maxSize;
        this.parent = parent;
    }

    addItem(player, vNum, item, bypass = false) {
        const vNumParsed = parseInt(vNum);
        if (isNumber(vNumParsed)) {
            if (this.size + 1 <= this.maxSize || bypass) {
                if (this.has(vNumParsed)) {
                    this.get(vNumParsed).push(item);
                } else {
                    const itemArray = [];
                    itemArray.push(item);
                    this.set(vNumParsed, itemArray);
                }
                return true;
            } else {
                if (this.parent instanceof Player) this.parent.send(`Inventory is full!`);
                else player.send(`No more items can be dropped here.`);
            }
        }
        return false;
    }

    removeItem(vNum) {
        const items = this.get(vNum);
        if (items.length > 0) {
            items.shift();
            if (items.length === 0) this.delete(vNum);
            return true;
        }
        
        return false;
    }

    serialize() {
        let items = Array.from(this.entries()).map(([vNum, itemList]) => ({
            vNum: parseInt(vNum),
            data: itemList.map(item => item?.serialize())  // Directly use serialize to get the object
        }));
        return items;  // Only stringify once, at the top level
    }

    static deserialize(player, data, maxSize = 30) {
        let inventory = new Inventory(player, maxSize);
        let items = JSON.parse(data);  // Assuming data is a JSON string
        try {
            items.forEach(item => {
                item.data.forEach(newItem => {
                    const addItem = global.ItemModule.getItemByVNum(item.vNum);
                    inventory.addItem(player, parseInt(item.vNum), addItem);
                });
            });
        } catch (error) {
            console.error("Failed to deserialize inventory:", error);
            return new Inventory(player, maxSize); // Optionally return an empty inventory on failure
        }
        console.log("OMG", inventory);
        return inventory;
    }
}

module.exports = Inventory;