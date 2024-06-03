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
     * Add one or more flags to the room state.
     * @param {...string} flagNames - The names of the flags to add.
     * @returns {void}
     */
    addFlag(...flagNames) {
        flagNames.forEach(flagName => {
            const flag = RoomState.getFlagByName(flagName);
            if (flag !== null) {
                this.flags |= flag;
            }
        });
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
        if (defaultState) {
            this.flags = Number(defaultState.flags);
        } else {
            this.flags |= RoomState.Flags.None;
        }
    }

    /**
     * Get the flag value by its string name, case-insensitive.
     * @param {string} name - The name of the flag.
     * @returns {number} The flag value, or null if not found.
     */
    static getFlagByName(name) {
        const lowerCaseName = name.toLowerCase();
        const flagKey = Object.keys(RoomState.Flags).find(key => key.toLowerCase() === lowerCaseName);
        return flagKey ? RoomState.Flags[flagKey] : null;
    }

    /**
     * Get a comma-separated string of flag names in lowercase.
     * @static
     * @returns {string} A comma-separated string of flag names in lowercase.
     */
    static getFlagsString() {
        return Object.keys(RoomState.Flags)
            .map(key => key.toLowerCase())
            .join(', ');
    }

    /**
     * Get the current flags of the room as a comma-separated string of flag names in lowercase.
     * @returns {string} A comma-separated string of current flag names in lowercase.
     */
    getCurrentFlagsString() {
        const ret = Object.keys(RoomState.Flags)
            .filter(key => (this.flags & RoomState.Flags[key]) !== 0)
            .map(key => key.toLowerCase())
            .join(', ');
        if(ret.length !== 0) return ret;
        else return 'None';
    }

    /**
     * Check if one or more flags are present in the room state.
     * @param {...string} flagNames - The names of the flags to check.
     * @returns {boolean} True if all flags are present, otherwise false.
     */
    hasFlag(...flagNames) {
        return flagNames.every(flagName => {
            const flag = RoomState.getFlagByName(flagName);
            return flag !== null && (this.flags & flag) !== 0;
        });
    }

    /**
     * Remove one or more flags from the room state.
     * @param {...string} flagNames - The names of the flags to remove.
     * @returns {void}
     */
    removeFlag(...flagNames) {
        flagNames.forEach(flagName => {
            const flag = RoomState.getFlagByName(flagName);
            if (flag !== null) {
                this.flags &= ~flag;
            }
        });
    }
}

module.exports = RoomState;
