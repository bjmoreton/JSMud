const { hashPassword, verifyPassword, formatDate, formatTime } = require("./Mud/Helpers");

/**
 * Login module for MUD server.
 * Handles player login, creation, and password verification.
 * 
 * @module LoginModule
 */
const LoginModule = {
    name: "Login",

    /**
     * Enum for connection status.
     * @enum {string}
     */
    ConnectionStatus: {
        ConfirmPassword: 'ConfirmPassword',
        CreatePlayer: 'CreatePlayer',
        EnterUsername: 'EnterUsername',
        EnterPassword: 'EnterPassword',
        LoggedIn: 'LoggedIn',
        WelcomeScreen: 'WelcomeScreen'
    },

    /**
     * Handles the login process for a player.
     * 
     * @param {Player} player - The player logging in.
     */
    handleLogin: async function (player) {
        const currentDate = new Date();
        // Set initial connection status if not already set
        if (player !== undefined && player.connectionStatus == null) {
            player.connectionStatus = this.ConnectionStatus.EnterUsername;
        }

        // Switch case to handle different stages of the login process
        switch (player.connectionStatus) {
            case this.ConnectionStatus.CreatePlayer:
                // Handle new player creation
                const newUsername = await player.textEditor.showPrompt('Please enter a character name: ');
                player.username = newUsername;
                if (newUsername.indexOf(" ") > -1 || newUsername == null || newUsername.toLowerCase() == 'new') {
                    player.send("Invalid character name!");
                    player.username = 'Guest';
                    player.connectionStatus = this.ConnectionStatus.CreatePlayer;
                } else if (LoginModule.mudServer.playerExist(player)) {
                    player.send("Character name already exists!");
                    player.username = 'Guest';
                    player.connectionStatus = this.ConnectionStatus.CreatePlayer;
                } else {
                    player.connectionStatus = this.ConnectionStatus.EnterPassword;
                }
                break;

            case this.ConnectionStatus.ConfirmPassword:
                // Confirm password for new player
                const confirmPassword = await player.textEditor.showPrompt('Confirm password: ');
                if (confirmPassword === player.password) {
                    player.password = await hashPassword(player.password);
                    LoginModule.mudServer.emit('playerCreated', player);
                    player.save(false);
                    global.mudServer.emit('playerLoaded', player, player);
                    player.connectionStatus = this.ConnectionStatus.WelcomeScreen;
                } else {
                    player.send("Passwords did not match!");
                    player.connectionStatus = this.ConnectionStatus.EnterPassword;
                }
                break;

            case this.ConnectionStatus.EnterPassword:
                // Handle password entry for existing player
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
                // Handle username entry
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
                // Handle welcome screen display after successful login
                player.connectionStatus = this.ConnectionStatus.LoggedIn;
                player.loggedIn = true;

                player.loginOn = formatDate(currentDate) + ' ' + formatTime(currentDate);
                if (!player.createdOn) player.createdOn = formatDate(currentDate) + ' ' + formatTime(currentDate);
                LoginModule.mudServer.players.forEach(p => {
                    if (p.username === player.username || p?.connectionStatus !== this.ConnectionStatus.LoggedIn) return;
                    p.send(`Player ${player.username} has logged in.`);
                });
                LoginModule.mudServer.emit('playerLoggedIn', player);
                break;
        }

        // If the player is not logged in, recursively handle login
        if (!player.loggedIn) await this.handleLogin(player);
    },

    /**
     * Callback function for handling login.
     * 
     * @param {Player} player - The player logging in.
     * @param {string} data - The data input by the player.
     */
    handleLoginCB: async function (player, data) {
        await LoginModule.handleLogin(player, data);
    },

    /**
     * Handles actions before a hotboot.
     */
    handleHotbootBefore: function () {
        LoginModule.mudServer.off('handleLogin', LoginModule.handleLoginCB);
        LoginModule.mudServer.off('hotBootBefore', LoginModule.handleHotbootBefore);
    },

    /**
     * Initializes the LoginModule.
     * 
     * @param {Object} mudServer - The MUD server instance.
     */
    init: function (mudServer) {
        global.LoginModule = this;
        this.mudServer = mudServer;
        this.mudServer.on('handleLogin', this.handleLoginCB);
        this.mudServer.on('hotBootBefore', this.handleHotbootBefore);
    }
};

module.exports = LoginModule;
