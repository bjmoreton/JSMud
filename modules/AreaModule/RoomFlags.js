class RoomFlags extends Array {
    static Flags = {};

    /**
     * Add a flag.
     * @static
     * @param {string} flag - The flag to add.
     * @returns {Object} The added flag object.
     */
    static addFlag(flag) {
        RoomFlags.Flags[flag.toLowerCase()] = { name: flag, events: {} };
        return RoomFlags.Flags[flag.toLowerCase()];
    }

    /**
     * Add flags to the item.
     * @param {...string} flags - The flags to add.
     */
    add(...flags) {
        flags.forEach(flag => {
            flag = flag?.toLowerCase();
            const flagValue = RoomFlags.Flags[flag];

            if (flagValue && !this.has(flag)) {
                this.push(flagValue);
            }
        });
    }

    /**
     * Add an event to a flag.
     * @static
     * @param {Object} flag - The flag to add the event to.
     * @param {string} event - The event name.
     * @param {string} action - The action code as a string.
     */
    static addEvent(flag, event, action) {
        const eventAction = new Function('...args', action);
        if (!flag.events[event.toLowerCase()]) flag.events[event.toLowerCase()] = {};
        flag.events[event.toLowerCase()].actionCode = action;
        flag.events[event.toLowerCase()].action = eventAction;
    }

    constructor() {
        super();
    }

    /**
     * Create a deep copy of the current RoomFlags instance.
     * @returns {RoomFlags} A new RoomFlags instance with copied flags.
     */
    copy() {
        const newFlags = new RoomFlags();
        this.forEach(flag => {
            newFlags.push({ ...flag });
        });
        return newFlags;
    }

    get current() {
        return this.map(map => map.name).join(', ');
    }

    /**
     * Deserialize flags from an object.
     * @static
     * @param {Object} flags - The flags to deserialize.
     */
    static deserialize(flags) {
        for (const flag in flags) {
            const addedFlag = this.addFlag(flag);
            for (const event in flags[flag].events) {
                const eventObj = flags[flag].events[event];
                this.addEvent(addedFlag, event, eventObj.actionCode);
            }
        }
    }

    /**
     * Get a flag by name.
     * @static
     * @param {string} flag - The flag name.
     * @returns {Object} The flag object.
     */
    static getFlag(flag) {
        return RoomFlags.Flags[flag.toLowerCase()];
    }

    /**
     * Get an array of item flags in lowercase.
     * @static
     * @returns {string[]} An array of item flags in lowercase.
     */
    static getFlagsArray() {
        return Object.values(RoomFlags.Flags)
            .map(flag => flag.name);
    }

    /**
     * Check if the item has specified flags.
     * @param {...string} flags - The flags to check.
     * @returns {boolean} True if the item has all specified flags, otherwise false.
     */
    has(...flags) {
        for (let flag of flags) {
            flag = flag?.toLowerCase();
            const flagValue = RoomFlags.Flags[flag];
            if (!flagValue) {
                return false;
            }
            const index = this.indexOf(flagValue);
            if (index === -1) {
                return false;
            }
        }
        return true;
    }

    /**
     * Check if a flag exists.
     * @static
     * @param {string} flag - The flag name.
     * @returns {boolean} True if the flag exists, otherwise false.
     */
    static hasFlag(flag) {
        return RoomFlags.Flags[flag.toLowerCase()];
    }

    /**
     * Remove specified flags from the room.
     * @param {...string} flags - The flags to remove.
     */
    remove(...flags) {
        flags.forEach(flag => {
            flag = flag?.toLowerCase();
            const flagValue = RoomFlags.Flags[flag];
            if (flagValue && this.has(flag)) {
                const index = this.findIndex(f => f.name.toLowerCase() === flagValue.name.toLowerCase())
                if (index !== -1) {
                    this.splice(index, 1);
                }
            }
        });
    }

    /**
     * Remove a flag.
     * @static
     * @param {string} flag - The flag name.
     */
    static removeFlag(flag) {
        RoomFlags.Flags[flag.toLowerCase()].delete = true;
        //delete RoomFlags.Flags[flag.toLowerCase()];
    }

    /**
     * Serialize the item flags.
     * @returns {string[]} An array of flag names.
     */
    serialize() {
        return this.map(map => map.name);
    }

    /**
     * Serialize all flags to JSON.
     * @static
     * @returns {string} The JSON string of all flags.
     */
    static serialize() {
        // Iterate through all flags and set saved to true
        for (const flag in RoomFlags.Flags) {
            RoomFlags.Flags[flag.toLowerCase()].saved = true;
        }

        // Filter flags where deleted is false
        const filteredFlags = Object.fromEntries(
            Object.entries(RoomFlags.Flags).filter(([flag, value]) => !value.deleted)
        );

        RoomFlags.Flags = filteredFlags;
        // Serialize to JSON
        return JSON.stringify(filteredFlags, null, 2);
    }

    /**
     * Trigger an event for the flags.
     * @param {string} flagEvent - The event name.
     * @param {...*} args - The arguments to pass to the event.
     * @returns {Array} The results of the event executions.
     */
    trigger(flagEvent, ...args) {
        const results = [];
        this.forEach(flag => {
            if (flag.events[flagEvent]) {
                const event = flag.events[flagEvent].action;
                if (event) {
                    try {
                        const result = event(...args);
                        results.push(result);
                    } catch (error) {
                        console.log(error);
                    }
                }
            }
        });
        return results;
    }
}

module.exports = RoomFlags;
