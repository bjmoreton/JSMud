const { isNumber } = require("../Mud/Helpers");

/**
 * Class representing a status effect.
 */
class Status {
    static StatusTypes = {
        buff: 0,
        debuff: 1,
        state: 2
    };

    /**
     * Creates an instance of Status.
     * @param {string} name - The name of the status.
     * @param {string} description - The description of the status.
     * @param {string|number} type - The type of the status (e.g., "buff", "debuff", "state").
     */
    constructor(name, description, type) {
        this.description = description;
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
        const copiedItem = new Status(this.name, this.description, this.type);
        return copiedItem;
    }

    /**
     * Deserializes data into a Status instance.
     * @param {Object} data - The data to deserialize.
     * @returns {Status} The deserialized status.
     */
    static deserialize(data) {
        const status = new Status(data.name, data.description, data.type);
        if (data.duration) status.duration = data.duration;
        if (data.remainingDuration) status.remainingDuration = data.remainingDuration;
        if (data.tickInterval) status.tickInterval = data.tickInterval;
        if (data.effect && status.duration && status.remainingDuration && status.tickInterval) {
            status.effect = eval('(' + data.effect + ')');
            status.intervalID = setInterval(status.tick.bind(status), status.tickInterval);
        }
        return status;
    }

    /**
     * Applies the status effect to the player.
     * @param {Player} player - The player to apply the status effect to.
     * @param {number} duration - The duration of the status in seconds. Use -1 for infinite duration.
     * @param {function} [effect] - The effect function that applies the status effect. Optional for states.
     * @param {number} [tickInterval=1000] - The interval in milliseconds at which the status effect ticks.
     */
    applyEffect(player, duration, effect = () => { }, tickInterval = 1000) {
        this.effect = effect;
        this.duration = duration;
        this.remainingDuration = duration;
        this.tickInterval = tickInterval;
        this.intervalID = setInterval(this.tick.bind(this), tickInterval);
    }

    /**
     * Serializes the status into a JSON-compatible object.
     * @returns {Object} The serialized status data.
     */
    serialize() {
        const { intervalID, ...data } = this;
        if (this.effect) data.effect = this.effect.toString();
        return { ...data };
    }

    /**
     * Ticks the status duration and checks if it has expired.
     * @param {Player} player - The player to apply the tick effect to.
     * @returns {boolean} Returns true if the status has expired, false otherwise.
     */
    tick(player) {
        if (this.effect) this.effect(player);

        if (this.remainingDuration > 0) {
            this.remainingDuration--;
            return false;
        }

        clearInterval(this.intervalID);
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
