const { parseColors } = require('./modules/Mud/Color.js');
const EventEmitter = require('events');
const fs = require('fs');
const net = require('net');
const path = require('path');
const { generateRandomString } = require('./modules/Mud/Helpers.js');

/**
 * Class representing a MUD (Multi-User Dungeon) server.
 * @extends EventEmitter
 */
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

    /**
     * Creates an instance of MUDServer.
     */
    constructor() {
        super();
        this.events = {};
        global.mudServer = this;
        this.hotbooting = false;
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

    /**
     * Ban a player.
     * @param {Player} player - The player issuing the ban.
     * @param {string[]} args - The arguments for the ban command.
     */
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
                            this.banList.set(p.username, p.socket.remoteAddress);
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

    /**
     * Check if a command exists.
     * @param {string} command - The command to check.
     * @returns {boolean} True if the command exists, false otherwise.
     */
    commandExist(command) { 
        return this.commands.includes(command); 
    }

    /**
     * Add an event listener.
     * @param {string} event - The event name.
     * @param {Function} listener - The listener function.
     */
    on(event, listener) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(listener);
    }

    /**
     * Emit an event.
     * @param {string} event - The event name.
     * @param {...any} args - The arguments to pass to the event listeners.
     * @returns {boolean} True if the event was handled, false otherwise.
     */
    emit(event, ...args) {
        if (!this.events[event] || this.events[event].length === 0) {
            return false;
        }

        let eventHandled = false;

        for (const listener of this.events[event]) {
            if (eventHandled) {
                break; // If an event has been handled, ignore subsequent events
            }
            if (listener(...args) === true) {
                eventHandled = true;
            }
        }

        return eventHandled;
    }

    /**
     * Remove an event listener.
     * @param {string} event - The event name.
     * @param {Function} listener - The listener function to remove.
     */
    off(event, listener) {
        if (!this.events[event]) return;
        this.events[event] = this.events[event].filter(l => l !== listener);
    }

    /**
     * Find a player by their username.
     * @param {string} username - The username of the player to find.
     * @returns {Player|null} The player object if found, otherwise null.
     */
    findPlayerByUsername(username) {
        if (username != null && username != '') {
            for (let [key, player] of this.players) {
                if (player.username.toLowerCase() === username.toLowerCase()) {
                    return player;
                }
            }
        }
        return null;
    }

    /**
     * Perform a hotboot, reloading modules and the title.
     * @param {Player} player - The player issuing the hotboot command.
     */
    hotBoot(player) {
        global.mudServer.hotbooting = true;
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
        global.mudServer.hotbooting = false;
    }

    /**
     * Check if an address is banned.
     * @param {Object} arg - The argument to check (player, socket, or address).
     * @returns {boolean} True if the address is banned, false otherwise.
     */
    isBanned(arg) {
        return [...this.banList].some(([k, v]) => {
            return arg?.username === k || arg?.socket?.remoteAddress === v || arg?.remoteAddress === v;
        });
    }

    /**
     * Check if an address is already connected.
     * @param {string} address - The address to check.
     * @returns {boolean} True if the address is connected, false otherwise.
     */
    isConnected(address) {
        return [...this.players].some(([k]) => {
            return k.remoteAddress == address;
        });
    }

    /**
     * Kick a player.
     * @param {Player} player - The player issuing the kick command.
     * @param {string[]} args - The arguments for the kick command.
     */
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

    /**
     * Check if a player is logged in.
     * @param {Player} player - The player to check.
     * @returns {boolean} True if the player is logged in, false otherwise.
     */
    loggedIn(player) {
        return [...this.players].some(([k, v]) => {
            return player?.username?.toLowerCase() == v?.username?.toLowerCase() && v?.loggedIn;
        });
    }

    /**
     * Load the ban list from a JSON file.
     */
    loadBanList() {
        try {
            const data = fs.readFileSync(MUDServer.BANS_LIST_PATH, 'utf-8');
            const banListEntries = JSON.parse(data);
            if (Array.isArray(banListEntries) && banListEntries.length > 0) {
                this.banList = new Map(banListEntries);
            }
            console.log('Bans list loaded');
        } catch (err) {
            console.error('Error reading or parsing JSON file:', err);
        }
    }

    /**
     * Load the configuration from a JSON file.
     */
    loadConfig() {
        try {
            const data = fs.readFileSync(MUDServer.CONFIG_PATH, 'utf-8');
            const configData = JSON.parse(data);
            Object.assign(this, configData);
        } catch (err) {
            console.error('Error reading or parsing JSON file:', err);
        }
    }

    /**
     * Load modules based on their order listed in the text file.
     */
    loadModules() {
        try {
            this.modules = {};
            const moduleNames = fs.readFileSync(MUDServer.MODULE_ORDER_FILE, 'utf-8').split('\n');
            moduleNames.forEach(moduleName => {
                moduleName = moduleName.trim();
                const modulePath = path.join(MUDServer.MODULES_PATH, moduleName + '.js');
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

    /**
     * Load a single module.
     * @param {string} modulePath - The path to the module file.
     */
    loadModule(modulePath) {
        if (fs.existsSync(modulePath)) {
            delete require.cache[require.resolve(modulePath)];
            const module = require(modulePath);
            this.modules[module.name === undefined ? generateRandomString(10) : module.name] = module;
            if (typeof module.init === 'function') {
                module.init(this);
                console.log(`Module ${module.name} initialized.`);
            }
        } else {
            console.error(`Module file '${modulePath}' not found.`);
        }
    }

    /**
     * Load the MUD title from a file.
     */
    loadTitle() {
        try {
            const dataSync = fs.readFileSync(MUDServer.MUD_TITLE_PATH, 'utf8');
            this.mudTitle = dataSync + '\r\n';
        } catch (err) {
            console.error('Error reading file synchronously:', err);
        }
    }

    /**
     * Check if a player's data file exists.
     * @param {Player} player - The player to check.
     * @returns {boolean} True if the player's data file exists, false otherwise.
     */
    playerExist(player) {
        const filePath = player.getFilePath();
        try {
            fs.accessSync(filePath, fs.constants.F_OK);
            return true;
        } catch (err) {
            return false;
        }
    }

    /**
     * Register a command handler.
     * @param {Object} handler - The command handler to register.
     */
    registerCommand(handler) {
        this.commands.set(handler.command.toLowerCase(), handler);
    }

    /**
     * Reload the configuration.
     * @param {Player} player - The player issuing the reload command.
     */
    reloadConfig(player) {
        this.loadConfig();
        player.send('Config reloaded!');
    }

    /**
     * Reload the MUD title.
     * @param {Player} player - The player issuing the reload command.
     */
    reloadTitle(player) {
        this.loadTitle();
        player.send('Title reloaded!');
    }

    /**
     * Save the ban list to a JSON file.
     */
    saveBansList() {
        try {
            fs.writeFileSync(MUDServer.BANS_LIST_PATH, JSON.stringify(Array.from(this.banList.entries()), null, 2));
            console.log('Bans list saved!');
        } catch (err) {
            console.error('Error writing bans file synchronously:', err);
        }
    }

    /**
     * Start the MUD server.
     */
    start() {
        this.server.listen(this.port, () => {
            console.log(`${this.name} server listening on port ${this.port}`);
        });
    }

    /**
     * Unban a player.
     * @param {Player} player - The player issuing the unban command.
     * @param {string[]} args - The arguments for the unban command.
     */
    unBan(player, args) {
        const [usernameToUnBan] = args;
        const bannedUser = Array.from(this.banList.keys()).find(key => key.toLowerCase() === usernameToUnBan.toLowerCase());

        if (!bannedUser) {
            player.send(`${usernameToUnBan} is not currently banned.`);
            return;
        }
        const address = this.banList.get(bannedUser);
        const otherUsers = Array.from(this.banList.entries())
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
