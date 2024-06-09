const RoomFlags = require("./RoomFlags");

/**
 * Class representing the state of a room.
 */
class RoomState {
    /**
     * Create a RoomState.
     * @param {Object} [defaultState] - The default state of the room.
     */
    constructor(defaultState) {
        if (defaultState && defaultState.flags) {
            if (!this.flags) this.flags = new RoomFlags();
            if (RoomFlags.isArray(defaultState.flags)) {
                defaultState.flags.forEach(flag => {
                    this.flags.add(flag);
                });
            }
        } else {
            this.flags = new RoomFlags();
        }
    }

    copy() {
        const copiedItem = new RoomState();
        copiedItem.flags = this.flags.copy();

        return copiedItem;
    }
}

module.exports = RoomState;
