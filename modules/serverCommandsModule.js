// HelpFiles module
const serverCommandsModule = {
    name: "Server Commands",
    init: function(mudServer) {
        this.ms = mudServer;
        
        this.ms.registerCommand('hotboot', (player, args) => {
            if (player.hasPermission('hotboot') || player.isAdmin()) {
                if (args == '' || args == null) {
                    this.ms.hotBoot(this.ms);
                } else {
                    if (args[0].toString().toLowerCase() == 'stop') {
                        if (this.ms.hotbootInterval == undefined) this.ms.hotbootInterval = new StoppableInterval(() => this.ms.hotBoot(this.ms), -1);
                        this.ms.hotbootInterval.stop();
                    } else if (!isNaN(args[0])) {
                        const interval = args[0] * 60000;
                        if (interval >= 60000) {
                            if (this.ms.hotbootInterval == undefined) this.ms.hotbootInterval = new StoppableInterval(() => this.ms.hotBoot(this.ms), interval);
                            this.ms.hotbootInterval.stop();
                            this.ms.hotbootInterval.setDelay(interval);
                            this.ms.hotbootInterval.start();
                        } else {
                            player.send('Interval needs to be no less than 1.');
                        }
                    } else {
                        player.send('Parameter needs to be a number, or stop');
                    }
                }
            }
        }, ['hb']);

        this.ms.registerCommand('reloadtitle', (player, args) => {
            if (player.hasPermission('reloadtitle') || player.isModerator()) {
                this.ms.loadTitle();
                player.send('Title reloaded!');
            }
        }, ['rt']);
    }
};

module.exports = serverCommandsModule;