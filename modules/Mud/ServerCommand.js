/**
 * Class representing a server command.
 */
class ServerCommand {
    /**
     * Create a ServerCommand.
     * @param {string} cmd - The main command string.
     * @param {string[]} aliases - An array of command aliases.
     * @param {string} action - The action associated with the command.
     * @param {number} modLevel - The required moderator level to execute the command.
     * @param {Function} handler - The function to handle the command execution.
     */
    constructor(cmd, aliases, action, modLevel, handler) {
        /**
         * The main command string.
         * @type {string}
         */
        this.command = cmd;

        /**
         * An array of command aliases.
         * @type {string[]}
         */
        this.aliases = aliases;

        /**
         * The action associated with the command.
         * @type {string}
         */
        this.action = action;

        /**
         * The required moderator level to execute the command.
         * @type {number}
         */
        this.modLevel = modLevel;

        /**
         * The function to handle the command execution.
         * @type {Function}
         */
        this.handler = handler;
    }

    /**
     * Execute the command for a player with given arguments.
     * @param {Object} player - The player executing the command.
     * @param {string[]} args - The arguments passed to the command.
     * @param {string} input - The raw input after the command.
     */
    execute(player, args, input) {
        if (player.hasCommand(this.command) || player.modLevel >= this.modLevel) {
            if (this.handler) {
                this.handler(player, args, input);
                return true;
            }
        }

        return false;
    }
}

module.exports = ServerCommand;
