class ServerCommand {
    constructor(cmd, aliases, action, modLevel, handler) {
        this.aliases = aliases;
        this.action = action;
        this.command = cmd;
        this.handler = handler;
        this.modLevel = modLevel;
    }

    execute(player, args) {
        if (player.hasCommand(this.command) || player.modLevel >= this.modLevel) {
            if(this.handler) this.handler(player, args);
        }
    }
}

module.exports = ServerCommand;