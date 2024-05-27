const { isNumber, addMissingProperties } = require("../Mud/Helpers");

/**
 * Class representing a status effect.
 */
class Status {
    /**
     * Enumeration for status types.
     * @readonly
     * @enum {number}
     */
    static StatusTypes = {
        buff: 0,
        debuff: 1,
        state: 2
    };

    /**
     * Creates an instance of Status.
     * @param {string} name - The name of the status.
     * @param {string|number} type - The type of the status (e.g., "buff", "debuff", "state").
     */
    constructor(name, type) {
        this.name = name;

        if (isNumber(type)) {
            this.type = parseInt(type);
        } else {
            this.type = Status.StatusTypes[type.toLowerCase()] ?? 2;
        }
    }

    /**
     * Creates a copy of the status.
     * @returns {Status} A copy of the status.
     */
    copy() {
        const copiedItem = new Status(this.name, this.type);
        addMissingProperties(this, copiedItem);
        return copiedItem;
    }

    /**
     * Deserializes data into a Status instance.
     * @param {Object} target - The target to apply deserialized status to.
     * @param {Object} data - The data to deserialize.
     * @returns {Status} The deserialized status.
     */
    static deserialize(target, data) {
        const status = new Status(data.name, data.type);
        status.gotDescription = data.gotDescription;
        status.gotSeenDescription = data.gotSeenDescription;
        status.lookDescription = data.lookDescription;
        status.lostDescription = data.lostDescription;
        status.lostSeenDescription = data.lostSeenDescription;

        if (data.ticks) status.ticks = data.ticks;
        if (data.remainingTicks) status.remainingTicks = data.remainingTicks;
        if (data.tickInterval) status.tickInterval = data.tickInterval;
        if (data.actionCode) status.actionCode = data.actionCode;
        if (status.actionCode && status.ticks && status.remainingTicks && status.tickInterval) {
            this.applyNewAction(target, status.ticks, status.actionCode, status.tickInterval);
        }
        return status;
    }

    /**
     * Applies the status effect to the target.
     * @param {Object} target - The target to apply the status effect to.
     * @param {number} ticks - The ticks of the status in seconds.
     * @param {function} [actionCode] - The code to the action that applies the action to the target. Optional for states.
     * @param {number} [tickInterval=1] - The interval in seconds at which the status effect ticks.
     */
    applyNewAction(target, ticks, actionCode, tickInterval = 1) {
        this.target = target;
        this.action = new Function('target', actionCode);
        this.ticks = ticks;
        this.remainingTicks = ticks;
        this.tickInterval = tickInterval;
        this.intervalID = setInterval(this.tick.bind(this), this.tickInterval * 1000);
    }

    /**
     * Serializes the status into a JSON-compatible object.
     * @returns {Object} The serialized status data.
     */
    serialize() {
        const { intervalID, action, ...data } = this;
        if (this.actionCode) data.actionCode = this.actionCode.toString();
        if (this.target) data.target = this.target.username || this.target.name;
        return { ...data };
    }

    /**
     * Starts the action associated with the status effect.
     * @param {Object} target - The target to apply the status effect to.
     * @param {number} ticks - The ticks of the status in seconds.
     * @param {number} tickInterval - The interval in seconds at which the status effect ticks.
     */
    startAction(target, ticks, tickInterval) {
        if (this.action && (tickInterval || this.tickInterval) && (ticks || this.ticks)) {
            this.target = target;
            this.ticks = ticks || this.ticks;
            this.remainingTicks = this.ticks;
            this.intervalID = setInterval(this.tick.bind(this), (tickInterval || this.tickInterval) * 1000);
        }
    }

    /**
     * Stops the action associated with the status effect.
     */
    stopAction() {
        clearInterval(this.intervalID);
    }

    /**
     * Ticks the status ticks and checks if it has expired.
     * @returns {boolean} Returns true if the status has expired, false otherwise.
     */
    tick() {
        if (this.action) {
            try {
                this.action(this.target);
            } catch (error) {
                console.error(error);
            }
        }

        if (this.remainingTicks > 0) {
            this.remainingTicks--;
            return false;
        }

        clearInterval(this.intervalID);
        this.target.statuses.removeStatus(this);
        return true;
    }

    /**
     * Validates if the provided status type is valid.
     * @static
     * @param {string} statusType - The status type to validate.
     * @returns {boolean} True if the status type is valid, false otherwise.
     */
    static validStatusType(statusType) {
        return Status.StatusTypes[statusType.toLowerCase()] !== undefined;
    }
}

module.exports = Status;
