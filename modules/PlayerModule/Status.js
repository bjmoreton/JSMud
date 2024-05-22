const { isNumber } = require("../Mud/Helpers");

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
     * @param {string} type - The type of the status (e.g., "buff", "debuff", "state").
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

    copy() {
        const copiedItem = new Status(this.name, this.description, this.type);
        return copiedItem;
    }

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
     */
    applyEffect(player, duration, effect = () => { }, tickInterval = 1000) {
        this.effect = effect;
        this.duration = duration;
        this.remainingDuration = duration;
        this.tickInterval = tickInterval;
        this.intervalID = setInterval(this.tick.bind(this), tickInterval);
    }

    serialize() {
        const { intervalID, ...data } = this;
        if (this.effect) data.effect = this.effect.toString();
        return { ...data };
    }

    /**
     * Ticks the status duration and checks if it has expired.
     * @returns {boolean} - Returns true if the status has expired, false otherwise.
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

    static validStatusType(statusType) {
        return Status.StatusTypes[statusType.toLowerCase()];
    }
}

module.exports = Status;