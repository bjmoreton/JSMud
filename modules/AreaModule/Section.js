const { inRange } = require("../../Utils/helpers");
const Exit = require("./Exit");
const Room = require("./Room");

class Section {
    constructor(area, name, nameDisplay, description, vSize) {
        this.area = area;
        this.description = description;
        this.name = name;
        this.nameDisplay = nameDisplay;
        this.rooms = new Map();
        this.vSize = vSize;
    }

    // Method to add a room
    addRoom(player, area, section, x, y, z) {
        if (inRange(x, -this.vSize, this.vSize) &&
            inRange(y, -this.vSize, this.vSize) &&
            inRange(z, -this.vSize, this.vSize)) {
            const room = new Room(area, section, 'Empty Void', 'A void of emptiness!', x, y, z);
            this.rooms.set(`${x},${y},${z}`, room);
            player.send(`Room added!`);
            return room;
        } else {
            player.send(`x, y, or z wasn't in range of ${-this.vSize}-${this.vSize}`);
            return null;
        }
    }

    deleteRoom(player, x, y, z) {
        const room = this.getRoomByCoordinates(x, y, z);

        if (room != null) {
            room.exits?.forEach(exit => {
                room.removeExit(player, this, Exit.oppositeExit(exit.direction.toString()));
            });
            this.rooms.delete(`${x},${y},${z}`);
        } else {
            player.send(`Room ${x}, ${y}, ${z} doesn't exist!`);
        }
    }

    // Method to find a room by coordinates
    getRoomByCoordinates(x, y, z) {
        return this.rooms.get(`${x},${y},${z}`);
    }
}

module.exports = Section;