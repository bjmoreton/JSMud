const { parseColors } = require('./Utils/Color.js');
const EventEmitter = require('events');
const fs = require('fs');
const net = require('net');
const path = require('path');
const { generateRandomString } = require('./Utils/helpers.js');

// Core MUD logic
class MUDServer extends EventEmitter {
    static BANS_LIST_PATH = path.join(__dirname, 'system', 'bans.json');
    static CONFIG_PATH = path.join(__dirname, 'system', 'config.json');
    static MODULE_ORDER_FILE = path.join(__dirname, 'system', 'module_order.txt');
    static MUD_TITLE_PATH = path.join(__dirname, 'system', 'mudtitle.txt');
    static MODULES_PATH = path.join(__dirname, 'modules');
    banList = new Map();
    commands = new Map();
    modules = [];
    players = new Map();
    server = net.createServer();

    banPlayer(player, args) {
        const [banPlayer] = args;
        if (banPlayer !== undefined) {
            if (banPlayer.toLowerCase() != player.username.toLowerCase()) {
                const playerToBan = this.findPlayerByUsername(banPlayer);
                if (playerToBan != null) {
                    const socket = playerToBan.socket;
                    this.banList.set(playerToBan.username, socket.remoteAddress);
                    this.players.forEach(p => {
                        if (p.username == player.username) return;
                        if (p.socket.remoteAddress == socket.remoteAddress) {
                            this.banList.set(p.username, p.socket.remoteAddress)
                            p.socket.end();
                            p.destroy();
                        }
                    });
                    socket.end();
                    player.destroy();
                    this.saveBansList();
                    player.send(`Player ${banPlayer} banned successfully.`);
                } else {
                    player.send('You cannot ban yourself!');
                }
            } else {
                player.send(`Player ${banPlayer} doesn't exist!`);
            }
        } else {
            player.send(`A player to ban must be specified!`);
        }
    }

    commandExist(command) { return this.commands.includes(command); }

    emit(event, ...args) {
        // console.log('EVENT:', event);
        super.emit(event, ...args);
    }

    constructor() {
        super();
        global.mudServer = this;
        this.loadConfig();
        this.loadModules();
        this.loadBanList();
        this.loadTitle();


        // Handle player disconnects
        this.on('playerDisconnected', (player) => {
            if (player.connectionStatus == null) return;
            const playerName = player.username;
            const wasLoggedIn = player.loggedIn;
            this.players.delete(player.socket);
            player.destroy();
            if (wasLoggedIn) {
                player.connectionStatus = null;
                player.loggedIn = false;
                player.save();
                this.players.forEach(p => {
                    p.send(`Player ${playerName} has logged out.`);
                });
            }
        });

        // Handle incoming connections
        this.server.on('connection', socket => {
            if (this.isConnected(socket.remoteAddress) && !this.multiplay) {
                socket.write('MUD doesn\'t allow multiplaying!');
                socket.end();
                socket.destroy();
                return;
            }
            if (this.isBanned(socket)) {
                console.log(`Banned address tried to connect: ${socket.remoteAddress}`);
                socket.end();
                socket.destroy();
                return;
            }
            // Send MUD Title
            socket.write(parseColors(this.mudTitle));
            // Player connected, let modules know
            this.emit('playerConnected', socket);
        });
        // Handle server errors
        this.server.on('error', err => {
            console.error('Server error:', err);
        });
    }

    findCommand(command) {
        for (const [key, cmd] of this.commands) {
            if (cmd.aliases.includes(command.toLowerCase()) || cmd.command === command.toLowerCase()) {
                return cmd;
            }
        }
        return null; // Command not found
    }

    // Function to find a player by their username
    findPlayerByUsername(username) {
        if (username != null && username != '') {
            for (let [key, player] of this.players) {
                if (player.username.toLowerCase() === username.toLowerCase()) {
                    return player; // Return the player object if found
                }
            }
        }
        return null; // Return null if no player is found with the given username
    }

    handleCommand(player, command) {
        if (command == undefined || command == "") return;

        // Split string by spaces, leaving spaces inside quotes alone
        const commandParts = command.match(/(?:[^\s"]+|"[^"]*")+/g);
        // Remove quotes from each part
        const cleanedParts = commandParts.map(part => part.replace(/^"|"$/g, ''));
        const [cmdName, ...args] = cleanedParts;
        const handler = this.findCommand(cmdName);

        if (handler) {
            handler.execute(player, args);
        } else {
            player.send('Unknown command!');
        }
    }

    hotBoot(player) {
        global.mudServer.players.forEach(p => {
            p.send('Performing hotboot...');
        });
        global.mudServer.emit('hotBootBefore', player);
        global.mudServer.loadModules();
        global.mudServer.loadTitle();
        global.mudServer.players.forEach(p => {
            p.send('Hotboot finished');
        });
        global.mudServer.emit('hotBootAfter', player);
    }

    isBanned(arg) {
        return [...this.banList].some(([k, v]) => {
            return arg?.username === k || arg?.socket?.remoteAddress === v || arg?.remoteAddress === v;
        });
    }

    isConnected(address) {
        return [...this.players].some(([k]) => {
            return k.remoteAddress == address;
        });
    }

    kickPlayer(player, args) {
        const [kickPlayer] = args;

        if (kickPlayer !== undefined) {
            const playerToKick = this.findPlayerByUsername(kickPlayer);
            if (playerToKick != null) {
                if (kickPlayer.toLowerCase() != player.username.toLowerCase()) {
                    const socket = player.socket;
                    kickPlayer.save();
                    this.players.forEach(p => {
                        if (p.username == kickPlayer.username) return;

                        if (p.socket.remoteAddress == socket.remoteAddress) {
                            p.save();
                            p.socket.end();
                            p.destroy();
                        }
                    });
                    socket.end();
                    player.destroy();
                } else {
                    player.send(`You cannot kick yourself!`);
                }
            } else {
                player.send(`Player ${kickPlayer} doesn't exist!`);
            }
        } else {
            player.send(`A player to kick must be specified!`);
        }
    }

    loggedIn(player) {
        return [...this.players].some(([k, v]) => {
            return player?.username?.toLowerCase() == v?.username?.toLowerCase() && v?.loggedIn;
        });
    }

    loadBanList() {
        try {
            // Read the JSON file synchronously
            const data = fs.readFileSync(MUDServer.BANS_LIST_PATH, 'utf-8');

            // Parse the JSON data
            const banListEntries = JSON.parse(data);
            // Check if the array is empty
            if (Array.isArray(banListEntries) && banListEntries.length > 0) {
                // Assign the ban data to the current bans list
                this.banList = new Map(banListEntries);
            }
            console.log('Bans list loaded');
        } catch (err) {
            console.error('Error reading or parsing JSON file:', err);
        }
    }

    loadConfig() {
        try {
            // Read the JSON file synchronously
            const data = fs.readFileSync(MUDServer.CONFIG_PATH, 'utf-8');

            // Parse the JSON data
            const configData = JSON.parse(data);

            // Assign the configuration data to the current object's properties
            Object.assign(this, configData);
        } catch (err) {
            console.error('Error reading or parsing JSON file:', err);
        }
    }

    // Load modules based on their order listed in the text file
    loadModules() {
        try {
            this.modules = {};
            // Read the contents of the text file
            const moduleNames = fs.readFileSync(MUDServer.MODULE_ORDER_FILE, 'utf-8').split('\n');

            // Iterate through each module name and load the corresponding module
            moduleNames.forEach(moduleName => {
                // Trim any leading or trailing whitespace from the module name
                moduleName = moduleName.trim();

                // Construct the path to the module file
                const modulePath = path.join(MUDServer.MODULES_PATH, moduleName + '.js');

                // Load the module
                this.loadModule(modulePath);
            });

            for (const moduleId in this.modules) {
                const module = this.modules[moduleId];

                if (typeof module.load === 'function') {
                    module.load();
                    console.log(`Module ${module.name} loaded`);
                }
            }

            console.log('Modules loaded based on order specified in the text file.');
        } catch (error) {
            console.error('Error loading modules based on order:', error);
        }
    }

    // Function to load a single module
    loadModule(modulePath) {
        // Check if the module file exists
        if (fs.existsSync(modulePath)) {
            // Clear the module cache for the module
            delete require.cache[require.resolve(modulePath)];

            // Require the module
            const module = require(modulePath);
            // Store it
            this.modules[module.name === undefined ? generateRandomString(10) : module.name] = module;
            // Initialize the module if an init function is found
            if (typeof module.init === 'function') {
                module.init(this);
                console.log(`Module ${module.name} initialized.`);
            }
        } else {
            console.error(`Module file '${modulePath}' not found.`);
        }
    }

    loadTitle() {
        // Synchronous file reading
        try {
            const dataSync = fs.readFileSync(MUDServer.MUD_TITLE_PATH, 'utf8');
            this.mudTitle = dataSync + '\r\n';
        } catch (err) {
            console.error('Error reading file synchronously:', err);
        }
    }

    playerExist(player) {
        const filePath = player.getFilePath();
        try {
            fs.accessSync(filePath, fs.constants.F_OK);
            return true; // File exists
        } catch (err) {
            return false; // File does not exist
        }
    }

    registerCommand(handler) {
        this.commands.set(handler.command.toLowerCase(), handler);
    }

    reloadConfig(player) {
        this.loadConfig();
        player.send('Config reloaded!');
    }

    reloadTitle(player) {
        this.loadTitle();
        player.send('Title reloaded!');
    }

    saveBansList() {
        try {
            // Write player data to file in JSON format
            fs.writeFileSync(MUDServer.BANS_LIST_PATH, JSON.stringify(Array.from(this.banList.entries()), null, 2));
            console.log('Bans list saved!');
        } catch (err) {
            console.error('Error writing bans file synchronously:', err);
        }
    }

    start() {
        this.server.listen(this.port, () => {
            console.log(`${this.name} server listening on port ${this.port}`);
        });
    }

    unBan(player, args) {
        const [usernameToUnBan] = args;

        // Check if any banned username matches the lowercase input
        const bannedUser = Array.from(this.banList.keys()).find(key => key.toLowerCase() === usernameToUnBan.toLowerCase());

        if (!bannedUser) {
            player.send(`${usernameToUnBan} is not currently banned.`);
            return;
        }
        const address = this.banList.get(bannedUser);
        // Check for any other banned users that match the remote address
        const otherUsers = Array.from(ms.banList.entries())
            .filter(([key, value]) => value.toLowerCase() === address)
            .map(([key, value]) => key);

        otherUsers.forEach(u => {
            this.banList.delete(u);
        });

        this.banList.delete(bannedUser);
        this.saveBansList();
        player.send(`Player ${usernameToUnBan} and other address players unbanned.`);
    }
}

module.exports = MUDServer;