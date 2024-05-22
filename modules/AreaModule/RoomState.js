/**
 * Class representing the state of a room.
 */
class RoomState {
    /**
     * Enum for room flags.
     * @readonly
     * @enum {number}
     */
    static Flags = {
        None: 0,
        NoEmote: 1 << 0,
        NoTalk: 1 << 1,
    }

    /**
     * Create a RoomState.
     * @param {Object} [defaultState] - The default state of the room.
     * @param {number} [defaultState.flags] - The flags for the room state.
     */
    constructor(defaultState) {
        /**
         * The flags representing the state of the room.
         * @type {number}
         */
        this.flags = defaultState?.flags ?? RoomState.Flags.None;
    }
}

module.exports = RoomState;
