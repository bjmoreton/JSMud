// serverCommands module
const serverCommandsModule = {
    name: "Server Commands",
    ServerCommand: class ServerCommand {
        constructor(cmd, aliases, modLevel, handler) {
            this.aliases = aliases;
            this.command = cmd;
            this.handler = handler;
            this.modLevel = modLevel;
        }

        execute(player, args) {
            if (player.hasCommand(this.command) || player.modLevel >= this.modLevel) {
                this.handler(player, args);
            }
        }
    },
    createCommand: function (cmd, aliases, modLevel, handler) {
        return new serverCommandsModule.ServerCommand(cmd, aliases, modLevel, handler);
    },
    init: function (mudServer) {
        this.ms = mudServer;

        this.ms.registerCommand('ban', this.createCommand('ban', [], 55, (player, args) => {
            const usernameToBan = args[0];
            let banPlayer = null;

            // Iterate through the players Map
            for (const [socket, playerInstance] of this.ms.players.entries()) {
                if (playerInstance.username.toLowerCase() === usernameToBan.toLowerCase()) {
                    banPlayer = playerInstance;
                    break; // Stop iterating once the player is found
                }
            }

            if (banPlayer !== null) {
                this.ms.banPlayer(banPlayer);
                player.send('Player banned!');
            } else {
                player.send('Invalid player name!');
            }
        }));

        this.ms.registerCommand('hotboot', this.createCommand('hotboot', ['hb'], 60, (player, args) => {
            if (args == '' || args == null) {
                this.ms.hotBoot(this.ms);
            } else {
                if (args[0].toString().toLowerCase() == 'stop') {
                    if (this.ms.hotbootInterval == undefined) this.ms.hotbootInterval = new StoppableInterval(() => this.ms.hotBoot(this.ms), -1);
                    this.ms.hotbootInterval.stop();
                } else if (!isNaN(args[0])) {
                    const interval = args[0] * 300000;
                    if (interval >= 300000) {
                        if (this.ms.hotbootInterval == undefined) this.ms.hotbootInterval = new StoppableInterval(() => this.ms.hotBoot(this.ms), interval);
                        this.ms.hotbootInterval.stop();
                        this.ms.hotbootInterval.setDelay(interval);
                        this.ms.hotbootInterval.start();
                    } else {
                        player.send('Usage: hotboot <value >= 5 | stop>');
                    }
                } else {
                    player.send('Usage: hotboot <value >= 5 | stop>');
                }
            }
        }));

        this.ms.registerCommand('kick', this.createCommand('kick', [], 50, (player, args) => {
            const usernameToBan = args[0];
            let kickPlayer = null;

            // Iterate through the players Map
            for (const [socket, playerInstance] of this.ms.players.entries()) {
                if (playerInstance.username.toLowerCase() === usernameToBan.toLowerCase()) {
                    kickPlayer = playerInstance;
                    break; // Stop iterating once the player is found
                }
            }

            if (kickPlayer !== null) {
                this.ms.kickPlayer(kickPlayer);
                player.send('Player kicked!');
            } else {
                player.send('Invalid player name!');
            }
        }));

        this.ms.registerCommand('reloadconfig', this.createCommand('reloadconfig', ['rlc'], 60, (player, args) => {
            this.ms.loadConfig();
            player.send('Config reloaded!');
        }));

        this.ms.registerCommand('reloadtitle', this.createCommand('reloadtitle', ['rt'], 60, (player, args) => {
            this.ms.loadTitle();
            player.send('Title reloaded!');
        }));

        this.ms.registerCommand('unban', this.createCommand('unban', [], 55, (player, args) => {
            const usernameToUnBan = args[0];
            // Convert the input username to lowercase
            const usernameToUnbanLower = usernameToUnBan.toLowerCase();

            // Check if any banned username matches the lowercase input
            const bannedUser = Array.from(this.ms.banList.keys()).find(key => key.toLowerCase() === usernameToUnbanLower);

            if (!bannedUser) {
                player.send(`${usernameToUnBan} is not currently banned.`);
                return;
            }
            const address = this.ms.banList.get(bannedUser);
            // Check for any other banned users that match the remote address
            const otherUsers = Array.from(this.ms.banList.entries())
                .filter(([key, value]) => value.toLowerCase() === address)
                .map(([key, value]) => key);

            otherUsers.forEach(u => {
                this.ms.banList.delete(u);
            });

            this.ms.banList.delete(bannedUser);
            this.ms.saveBansList();
            player.send(`Player ${usernameToUnBan} and other address players unbanned.`);
        }));
    }
};

module.exports = serverCommandsModule;