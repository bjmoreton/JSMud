// login module
const loginModule = {
    name: "Login",
    ConnectionStatus: {
        ConfirmPassword: 'ConfirmPassword',
        CreatePlayer: 'CreatePlayer',
        EnterUsername: 'EnterUsername',
        EnterPassword: 'EnterPassword',
        LoggedIn: 'LoggedIn',
        WelcomeScreen: 'WelcomeScreen'
    },
    handleLogin: function(player, data) {
        if(player != undefined && player.connectionStatus == undefined) {
            player.connectionStatus = this.ConnectionStatus.EnterUsername;
        
            player.send("\r\nPlease enter character name, or new: ");
            return;
        }

        switch(player.connectionStatus) {
            case this.ConnectionStatus.ConfirmPassword:
                if (data === player.password) {
                    player.connectionStatus = this.ConnectionStatus.WelcomeScreen;
                    this.handleLogin(player, "");
                } else {
                    player.connectionStatus = this.ConnectionStatus.EnterPassword;
                    player.send("Passwords do not match!");
                    player.send("Please enter a password: ");
                }
                break;
            case this.ConnectionStatus.CreatePlayer:
                if (data.indexOf(" ") > -1 || data == null) {
                    player.send("Invalid character name!");
                    player.send("Enter a Character name: ");
                } else if (player.exist(data)) {
                    player.send("Character name taken!");
                    player.send("Enter a Character name: ");
                } else {
                    player.username = data;
                    player.connectionStatus = this.ConnectionStatus.EnterPassword;
                    player.send("Please enter a password: ");
                }
                break;
            case this.ConnectionStatus.EnterUsername:
                if (data.indexOf(" ") > -1 || data == null) {
                    player.send("Invalid character name!");
                    player.send("Please enter character name, or new: ");
                } else {
                    if (player.exist(data)) {
                        if(loginModule.ms.loggedIn(data))
                        {
                            player.send('Account is already logged in!');
                            player.disconnect(false);
                            return;
                        }
                        player.load(data);
                        if(loginModule.ms.isBanned(player)){
                            player.send("This account hass been banned!");
                            console.log(`Banned player ${player.username} tried to connect.`);
                            player.disconnect(false);
                            return;
                        }
                        player.connectionStatus = this.ConnectionStatus.EnterPassword;
                        player.send("Please enter your password: ");
                    } else if (data.toLowerCase() === "new") {
                        player.connectionStatus = this.ConnectionStatus.CreatePlayer;
                        player.send("Enter a Character name: ");
                    } else {
                        player.send("Character doesn't exist!");
                        player.send("Please enter character name, or new: ");
                    }
                }
                break;
            case this.ConnectionStatus.EnterPassword:
                if (player.exist(player.username)) {
                    if (data === player.password) {
                        player.connectionStatus = this.ConnectionStatus.WelcomeScreen;
                        this.handleLogin(player, "");
                    } else {
                        player.send("Invalid password!");
                        player.disconnect(false);
                    }
                } else {
                    player.password = data;
                    player.connectionStatus = this.ConnectionStatus.ConfirmPassword;
                    player.send("Please confirm password: ");
                }
                break;
            case this.ConnectionStatus.WelcomeScreen:
                player.connectionStatus = this.ConnectionStatus.LoggedIn;
                player.loggedIn = true;
                player.send("Welcome Blah blah...\r\n\r\n");
                loginModule.ms.players.forEach(p => {
                    if(p.username == player.username || p?.connectionStatus != this.ConnectionStatus.LoggedIn) return;
                    p.send(`Player ${player.username} has logged in.`);
                });
                break;
        }
    },
    handleLoginCB:  function(player, data) {
        loginModule.handleLogin(player, data);
    },
    handleHotbootBefore: function() {
        loginModule.ms.mudEmitter.removeListener('handleLogin', loginModule.handleLoginCB);
        loginModule.ms.mudEmitter.removeListener('before_hotboot', loginModule.handleHotbootBefore);
    },
    init: function(mudServer) {
        this.ms = mudServer;
        this.ms.mudEmitter.on('handleLogin', this.handleLoginCB);
        this.ms.mudEmitter.on('before_hotboot', this.handleHotbootBefore);
    }
};

module.exports = loginModule;