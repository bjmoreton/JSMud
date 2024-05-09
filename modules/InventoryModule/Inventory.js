const { isNumber } = require("../../Utils/helpers");
const Player = require("../PlayerModule/Player");

class Inventory extends Map {
    constructor(maxSize = 30) {
        super();
        this.maxSize = maxSize;
    }

    addItem(vNum, item, bypass = false) {
        const vNumParsed = parseInt(vNum);

        if (isNumber(vNumParsed)) {
            if (this.actualSize() + 1 <= this.maxSize || bypass) {
                if (this.has(vNumParsed)) {
                    this.get(vNumParsed).push(item);
                } else {
                    const itemArray = [];
                    itemArray.push(item);
                    this.set(vNumParsed, itemArray);
                }
                return true;
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

    actualSize() {
        let sizeActual = this.size - 1;
        for (const [key, value] of this.entries()) {
            sizeActual += value.length;
        }

        return parseInt(sizeActual);
    }

    full = () => { return this.actualSize() === this.maxSize; }

    static deserialize(player, data, maxSize = 30) {
        let inventory = new Inventory(maxSize);
        let items = JSON.parse(data);  // Assuming data is a JSON string
        try {
            items.forEach(item => {
                item.data.forEach(newItem => {
                    const addItem = global.ItemModule.getItemByVNum(item.vNum);
                    inventory.addItem(parseInt(item.vNum), addItem, true);
                });
            });
        } catch (error) {
            console.error("Failed to deserialize inventory:", error);
            return new Inventory(maxSize); // Optionally return an empty inventory on failure
        }

        return inventory;
    }
}

module.exports = Inventory;