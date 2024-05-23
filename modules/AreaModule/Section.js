const { inRange, getRandomNumberInclusive } = require("../Mud/Helpers");
const Exit = require("./Exit");
const Room = require("./Room");

/**
 * Class representing a section of an area.
 */
class Section {
    /**
     * Create a Section.
     * @param {Object} area - The area to which the section belongs.
     * @param {string} name - The name of the section.
     * @param {string} nameDisplay - The display name of the section.
     * @param {string} description - The description of the section.
     * @param {number} vSize - The vertical size of the section.
     */
    constructor(area, name, nameDisplay, description, vSize) {
        this.area = area;
        this.description = description;
        this.name = name;
        this.nameDisplay = nameDisplay;
        this.rooms = new Map();
        this.vSize = vSize;

        this.startResetTimer();
    }

    addResetMsg(msg) {
        if (!Array.isArray(this.resetMessages)) {
            this.resetMessages = [];
        }
        this.resetMessages.push(msg);
    }

    /**
     * Adds a room to the section.
     * @param {Object} player - The player adding the room.
     * @param {Object} area - The area to which the room belongs.
     * @param {Object} section - The section to which the room belongs.
     * @param {number} x - The x-coordinate of the room.
     * @param {number} y - The y-coordinate of the room.
     * @param {number} z - The z-coordinate of the room.
     * @returns {Room|null} The newly added room, or null if out of range.
     */
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

    /**
     * Clears the sections reset interval.
     */
    clearResetTimer() {
        clearInterval(this.intervalId);
    }

    /**
     * Deletes a room from the section.
     * @param {Object} player - The player requesting the deletion.
     * @param {number} x - The x-coordinate of the room.
     * @param {number} y - The y-coordinate of the room.
     * @param {number} z - The z-coordinate of the room.
     */
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

    /**
     * Finds a room by its coordinates.
     * @param {number} x - The x-coordinate of the room.
     * @param {number} y - The y-coordinate of the room.
     * @param {number} z - The z-coordinate of the room.
     * @returns {Room|undefined} The room if found, otherwise undefined.
     */
    getRoomByCoordinates(x, y, z) {
        return this.rooms.get(`${x},${y},${z}`);
    }

    /**
     * Resets the section's rooms to their default state and sends a reset message.
     */
    reset() {
        this.rooms.forEach(room => {
            room.flags = room.defaultState.flags;
            global.mudServer.emit('roomReset', room);
            // Reset other properties as needed
        });

        const messages = this.resetMessages;
        let message = 'You feel a sudden shift as the area resets.';
        if (messages && Array.isArray(this.resetMessages) && this.resetMessages.length > 0) {
            message = messages[Math.floor(Math.random() * messages.length)];
        }

        global.mudServer.emit('sendToSectionMessage', this, message);

        // Reset for a new random interval so it isn't the same from time of creation
        this.startResetTimer();
    }

    /**
     * Sets up a random interval to reset the section periodically.
     */
    startResetTimer() {
        this.clearResetTimer();
        const minInterval = (isNaN(this.minReset) ? 8 : this.minReset) * 60 * 1000; // 8 minutes in milliseconds
        const maxInterval = (isNaN(this.maxReset) ? 15 : this.maxReset) * 60 * 1000; // 15 minutes in milliseconds as default
        const intervalMS = getRandomNumberInclusive(minInterval, maxInterval);
        if(!isNaN(intervalMS)) this.intervalId = setInterval(() => this.reset(), intervalMS);
    }
}

module.exports = Section;
