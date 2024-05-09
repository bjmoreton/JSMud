const { hashPassword, verifyPassword } = require("../Utils/helpers");

// login module
const LoginModule = {
    name: "Login",
    ConnectionStatus: {
        ConfirmPassword: 'ConfirmPassword',
        CreatePlayer: 'CreatePlayer',
        EnterUsername: 'EnterUsername',
        EnterPassword: 'EnterPassword',
        LoggedIn: 'LoggedIn',
        WelcomeScreen: 'WelcomeScreen'
    },
    handleLogin: async function (player) {
        if (player != undefined && player.connectionStatus == null) {
            player.connectionStatus = this.ConnectionStatus.EnterUsername;
        }
        switch (player.connectionStatus) {
            case this.ConnectionStatus.CreatePlayer:
                const newUsername = await player.textEditor.showPrompt('Please enter a character name: ');
                player.username = newUsername;
                if (newUsername.indexOf(" ") > -1 || newUsername == null || newUsername.toLowerCase() == 'new') {
                    player.send("Invalid character name!");
                    player.username = 'Guest';
                    player.connectionStatus = this.ConnectionStatus.CreatePlayer;
                } else if (LoginModule.mudServer.playerExist(player)) {
                    player.send("Character name already exist!");
                    player.username = 'Guest';
                    player.connectionStatus = this.ConnectionStatus.CreatePlayer;
                } else {
                    player.connectionStatus = this.ConnectionStatus.EnterPassword;
                }
                break;
            case this.ConnectionStatus.ConfirmPassword:
                const confirmPassword = await player.textEditor.showPrompt('Confirm password: ');
                if (confirmPassword === player.password) {
                    player.password = await hashPassword(player.password);
                    LoginModule.mudServer.mudEmitter.emit('playerCreated', player);
                    player.save();
                    player.connectionStatus = this.ConnectionStatus.WelcomeScreen;
                } else {
                    player.send("Passwords did not match!");
                    player.connectionStatus = this.ConnectionStatus.EnterPassword;
                }
                break;
            case this.ConnectionStatus.EnterPassword:
                const password = await player.textEditor.showPrompt('Enter password: ');
                if (LoginModule.mudServer.playerExist(player)) {
                    player.load();

                    if (await verifyPassword(password, player.password)) {
                        player.connectionStatus = this.ConnectionStatus.WelcomeScreen;
                    } else {
                        player.send("Invalid password!");
                        player.username = 'Guest';
                        player.connectionStatus = this.ConnectionStatus.EnterUsername;
                    }
                } else {
                    player.password = password;
                    player.connectionStatus = this.ConnectionStatus.ConfirmPassword;
                }
                break;
            case this.ConnectionStatus.EnterUsername:
                const username = await player.textEditor.showPrompt('Please enter a character name or type new: ');
                player.username = username;
                if (username.indexOf(" ") > -1 || username == null) {
                    player.send("Invalid character name!");
                    player.username = 'Guest';
                    player.connectionStatus = this.ConnectionStatus.EnterUsername;
                } else if (username.toLowerCase() == 'new') {
                    player.connectionStatus = this.ConnectionStatus.CreatePlayer;
                } else if (!LoginModule.mudServer.playerExist(player)) {
                    player.send("Character doesn't exist!");
                    player.username = 'Guest';
                    player.connectionStatus = this.ConnectionStatus.EnterUsername;
                } else {
                    player.username = username;
                    if (this.mudServer.loggedIn(player)) {
                        player.send('Character is already logged in!');
                        player.username = 'Guest';
                        player.connectionStatus = this.ConnectionStatus.EnterUsername;
                    } else if (this.mudServer.isBanned(player)) {
                        player.send("This account has been banned!");
                        console.log(`Banned player ${player.username} tried to connect.`);
                        player.username = 'Guest';
                        player.connectionStatus = this.ConnectionStatus.EnterUsername;

                    } else player.connectionStatus = this.ConnectionStatus.EnterPassword;
                }
                break;
            case this.ConnectionStatus.WelcomeScreen:
                player.connectionStatus = this.ConnectionStatus.LoggedIn;
                player.loggedIn = true;
                LoginModule.mudServer.players.forEach(p => {
                    if (p.username == player.username || p?.connectionStatus != this.ConnectionStatus.LoggedIn) return;
                    p.send(`Player ${player.username} has logged in.`);
                });
                LoginModule.mudServer.mudEmitter.emit('playerLoggedIn', player);
                break;
        }

        if (!player.loggedIn) await this.handleLogin(player);
    },
    handleLoginCB: async function (player, data) {
        await LoginModule.handleLogin(player, data);
    },
    handleHotbootBefore: function () {
        LoginModule.mudServer.mudEmitter.removeListener('handleLogin', LoginModule.handleLoginCB);
        LoginModule.mudServer.mudEmitter.removeListener('hotBootBefore', LoginModule.handleHotbootBefore);
    },
    init: function (mudServer) {
        global.LoginModule = this;
        this.mudServer = mudServer;
        this.mudServer.mudEmitter.on('handleLogin', this.handleLoginCB);
        this.mudServer.mudEmitter.on('hotBootBefore', this.handleHotbootBefore);
    }
};

module.exports = LoginModule;