class Statuses extends Map {
    /**
     * A static map of all status effects.
     * @type {Map<string, Status>}
     */
    static Statuses = new Map();

    /**
     * Adds one or more statuses to the target and starts their actions.
     * @param {...Status} statuses - The statuses to add.
     */
    addStatus(...statuses) {
        statuses.forEach(status => {
            if (this.hasStatus(status.name.toLowerCase())) {
                const existingStatus = this.get(status.name.toLowerCase());
                existingStatus.stopAction();
            }
            this.set(status.name.toLowerCase(), status);
            status.startAction(this.target);
            if (status.gotDescription) this.target?.send(status.gotDescription);
            if (status.gotSeenDescription) {
                let message = status.gotSeenDescription;
                message = message.replace('%t', this.target.username || this.target.name);
                global.mudServer.emit('sendToRoom', this.target, message, [this.target.username]);
            }
        });
    }

    /**
     * Adds a status to the target by its name, with optional duration and tick interval.
     * @param {string} statusName - The name of the status.
     * @param {number} [duration=-1] - The duration of the status in ticks.
     * @param {number} [tickInterval=-1] - The interval between ticks in seconds.
     * @returns {Status|null} The added status, or null if the status was not found or invalid.
     */
    addStatusByName(statusName, duration = -1, tickInterval = -1) {
        const resolvedStatus = Statuses.stringToStatus(statusName)?.copy();
        if (resolvedStatus && !this.hasStatus(resolvedStatus.name) && Statuses.validStatus(resolvedStatus.name)) {
            resolvedStatus.duration = duration;
            resolvedStatus.tickInterval = tickInterval;
            this.addStatus(resolvedStatus);
        }

        return resolvedStatus;
    }

    /**
     * Creates an instance of Statuses.
     * @param {Object} target - The target object to which statuses are applied.
     */
    constructor(target) {
        super();
        this.target = target;
    }

    getStatus(statusName) {
        return this.get(statusName.toLowerCase());
    }

    /**
     * Checks if the target has specific statuses.
     * @param {...string} statuses - The statuses to check.
     * @returns {boolean} True if the target has all specified statuses, false otherwise.
     */
    hasStatus(...statuses) {
        return statuses.every(statusName => {
            const resolvedStatus = Statuses.stringToStatus(statusName);
            return resolvedStatus && this.has(resolvedStatus.name.toLowerCase());
        });
    }

    /**
     * Removes one or more statuses from the target.
     * @param {...Status} statuses - The statuses to remove.
     */
    removeStatus(...statuses) {
        statuses.forEach(status => {
            if (this.hasStatus(status.name)) {
                status.stopAction();
                this.delete(status.name.toLowerCase());
                if (status.lostDescription) this.target?.send(status.lostDescription);
                if (status.lostSeenDescription) {
                    let message = status.lostSeenDescription;
                    message = message.replace('%t', this.target.username || this.target.name);
                    global.mudServer.emit('sendToRoom', this.target, message, [this.target.username]);
                }
            }
        });
    }

    /**
     * Removes specific statuses from the target by their names.
     * @param {...string} statuses - The names of the statuses to remove.
     */
    removeStatusByName(...statuses) {
        statuses.forEach(statusName => {
            const resolvedStatus = Statuses.stringToStatus(statusName);
            if (resolvedStatus) this.removeStatus(resolvedStatus);
        });
    }

    /**
     * Checks if a status is valid.
     * @param {string} statusName - The name of the status.
     * @returns {boolean} True if the status is valid, false otherwise.
     */
    static validStatus(statusName) {
        return Statuses.Statuses.has(statusName.toLowerCase());
    }

    /**
     * Gets a comma-separated string of player statuses in lowercase.
     * @returns {string} A comma-separated string of player statuses in lowercase.
     */
    static getStatusesArray() {
        return Array.from(Statuses.Statuses.values()).map(status => status.name.toLowerCase()).join(', ');
    }

    /**
     * Converts a status string to a status object.
     * @param {string} statusString - The status string to convert.
     * @returns {Status|null} The status object if found, otherwise null.
     */
    static stringToStatus(statusString) {
        const normalizedInput = statusString.toLowerCase();
        for (const status of Statuses.Statuses.values()) {
            if (status.name.toLowerCase() === normalizedInput) {
                return status;
            }
        }
        return null;
    }
}

module.exports = Statuses;
