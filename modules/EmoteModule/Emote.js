/**
 * Class representing an emote.
 */
class Emote {
    /**
     * Create an Emote.
     * @param {string} name - The name of the emote.
     * @param {string} solo - The message for when the emote is performed solo.
     * @param {string} you - The message for the player performing the emote with a target.
     * @param {string} target - The message for the target of the emote.
     * @param {string} others - The message for others witnessing the emote with a target.
     * @param {string} othersSolo - The message for others witnessing the solo emote.
     */
    constructor(name, solo, you, target, others, othersSolo) {
        /**
         * The name of the emote.
         * @type {string}
         */
        this.name = name;

        /**
         * The message for when the emote is performed solo.
         * @type {string}
         */
        this.solo = solo;

        /**
         * The message for the player performing the emote with a target.
         * @type {string}
         */
        this.you = you;

        /**
         * The message for the target of the emote.
         * @type {string}
         */
        this.target = target;

        /**
         * The message for others witnessing the emote with a target.
         * @type {string}
         */
        this.others = others;

        /**
         * The message for others witnessing the solo emote.
         * @type {string}
         */
        this.othersSolo = othersSolo;
    }
}

module.exports = Emote;
