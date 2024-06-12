class ItemFlags extends Array {
    static Flags = {};

    /**
     * Add a flag.
     * @static
     * @param {string} flag - The flag to add.
     * @returns {Object} The added flag object.
     */
    static addFlag(flag) {
        ItemFlags.Flags[flag.toLowerCase()] = { name: flag, events: {} };
        return ItemFlags.Flags[flag.toLowerCase()];
    }

    /**
     * Add flags to the item.
     * @param {...string} flags - The flags to add.
     */
    add(...flags) {
        flags.forEach(flag => {
            flag = flag?.toLowerCase();
            const flagValue = ItemFlags.Flags[flag];

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
     * Create a deep copy of the current ItemFlags instance.
     * @returns {ItemFlags} A new ItemFlags instance with copied flags.
     */
    copy() {
        const newFlags = new ItemFlags();
        this.forEach(flag => {
            newFlags.push({ ...flag });
        });
        return newFlags;
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
        return ItemFlags.Flags[flag.toLowerCase()];
    }

    /**
     * Get an array of item flags in lowercase.
     * @static
     * @returns {string[]} An array of item flags in lowercase.
     */
    static getFlagsArray() {
        return Object.values(ItemFlags.Flags)
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
            const flagValue = ItemFlags.Flags[flag];
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
        return ItemFlags.Flags[flag.toLowerCase()];
    }

    /**
     * Remove specified flags from the item.
     * @param {...string} flags - The flags to remove.
     */
    remove(...flags) {
        flags.forEach(flag => {
            flag = flag?.toLowerCase();
            const flagValue = ItemFlags.Flags[flag];
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
        ItemFlags.Flags[flag.toLowerCase()].deleted = true;
    }

    /**
     * Serialize the item flags.
     * @returns {string[]} An array of flag names.
     */
    serialize() {
        return this.map(map => map.name);
    }

    /**
     * Serialize all flags to JSON where deleted is false.
     * Marks all ItemFlags.Flags[flag].saved as true before serialization.
     * @static
     * @returns {string} The JSON string of all flags where deleted is false.
     */
    static serialize() {
        // Iterate through all flags and set saved to true
        for (const flag in ItemFlags.Flags) {
            ItemFlags.Flags[flag.toLowerCase()].saved = true;
        }

        // Filter flags where deleted is false
        const filteredFlags = Object.fromEntries(
            Object.entries(ItemFlags.Flags).filter(([flag, value]) => !value.deleted)
        );

        ItemFlags.Flags = filteredFlags;
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
            if (flag.events && flag.events[flagEvent]) {
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

module.exports = ItemFlags;
