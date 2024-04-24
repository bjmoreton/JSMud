// HelpFiles module
const serverCommandsModule = {
    name: "Server Commands",
    init: function(mudServer) {
        this.ms = mudServer;
        
        this.ms.registerCommand('ban', (player, args) => {
            if(player.isModerator())
            {
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
            }
        });

        this.ms.registerCommand('hotboot', (player, args) => {
            if (player.hasPermission('hotboot') || player.isAdmin()) {
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
                            player.send('Interval needs to be no less than 5.');
                        }
                    } else {
                        player.send('Parameter needs to be a number, or stop');
                    }
                }
            }
        }, ['hb']);

        this.ms.registerCommand('kick', (player, args) => {
            if(player.isModerator())
            {
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
            }
        });

        this.ms.registerCommand('reloadtitle', (player, args) => {
            if (player.hasPermission('reloadtitle') || player.isModerator()) {
                this.ms.loadTitle();
                player.send('Title reloaded!');
            }
        }, ['rt']);
    }
};

module.exports = serverCommandsModule;