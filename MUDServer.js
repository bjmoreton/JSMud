const { parseColors } = require('./Color.js');
const EventEmitter = require('events');
const fs = require('fs');
const net = require('net');
const path = require('path');

// Custom event emitter
class MUDEmitter extends EventEmitter { }

// Core MUD logic
class MUDServer {
    BANS_LIST_PATH = path.join(__dirname, 'system', 'bans.json');
    CONFIG_PATH = path.join(__dirname, 'system', 'config.json');
    MUD_TITLE_PATH = path.join(__dirname, 'system', 'mudtitle.txt');
    MODULES_PATH = path.join(__dirname, 'modules');

    banPlayer(player) {
        const socket = player.socket;

        this.banList.set(player.username, socket.remoteAddress);
        this.players.forEach(p => {
            if(p.username == player.username) return;
            if(p.socket.remoteAddress == socket.remoteAddress)
            {
                p.socket.end();
                p.destroy();
            }
        });
        socket.end();
        player.destroy();
        this.saveBansList();
    }

    commandExist(command) { return this.commands.includes(command); }

    constructor() {
        this.banList = new Map();
        this.commands = new Map();
        this.modules = [];
        this.mudEmitter = new MUDEmitter();
        this.players = new Map();
        this.server = net.createServer();
        
        this.loadConfig();
        this.loadModules();
        this.loadBanList();
        this.loadTitle();

        // Handle player commands
        this.mudEmitter.on('handleCommand', (player, command) => { this.handleCommand(player, command); });
        // Handle player disconnects
        this.mudEmitter.on('playerDisconnected', (player) => {
            this.players.delete(player.socket);
            player.destroy();
        });
        // Handle incoming connections
        this.server.on('connection', socket => {
            if(this.isBanned(socket)) {
                console.log(`Banned address tried to connect: ${socket.remoteAddress}`);
                socket.end();
                socket.destroy();
                return;
            }
            // Send MUD Title
            socket.write(parseColors(this.mudTitle));
            // Player connected, let modules know
            this.mudEmitter.emit('playerConnected', socket);
        });
        // Handle server errors
        this.server.on('error', err => {
            console.error('Server error:', err);
        });
    }

    handleCommand(player, command) {
        const [cmdName, ...args] = command.split(' ');
        const handler = this.commands.get(cmdName);

        if (handler) {
            handler(player, args);
        } else {
            player.send('Unknown command!');
        }
    }

    hotBoot(cb) {
        this.players.forEach(p => {
            p.send('Performing hotboot...');
        });
        this.mudEmitter.emit('before_hotboot');
        cb.loadModules();
        cb.loadTitle();
        this.players.forEach(p => {
            p.send('Hotboot finished');
        });
        this.mudEmitter.emit('after_hotboot');
    }

    isBanned(arg) {
        console.log(this.banList);
        return [...this.banList].some(([k, v]) => {
            return arg?.username === k || arg?.socket?.remoteAddress === v || arg?.remoteAddress === v;
        });
    }

    kickPlayer(player) {
        const socket = player.socket;
        player.save();
        this.players.forEach(p => {
            if(p.username == player.username) return;

            if(p.socket.remoteAddress == socket.remoteAddress)
            {
                p.save();
                p.socket.end();
                p.destroy();
            }
        });
        socket.end();
        player.destroy();
    }

    loadBanList() {
        try {
            // Read the JSON file synchronously
            const data = fs.readFileSync(this.BANS_LIST_PATH, 'utf-8');

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
            const data = fs.readFileSync(this.CONFIG_PATH, 'utf-8');

            // Parse the JSON data
            const configData = JSON.parse(data);

            // Assign the configuration data to the current object's properties
            Object.assign(this, configData);
        } catch (err) {
            console.error('Error reading or parsing JSON file:', err);
        }
    }

    loadModules() {
        this.modules = [];
        fs.readdirSync(this.MODULES_PATH).forEach(file => {
            const ModulePath = path.join(this.MODULES_PATH, file);
            this.loadModule(ModulePath);
        });
    }

    loadModule(ModulePath) {
        // Clear the module cache for the Module
        delete require.cache[require.resolve(ModulePath)];

        // Require the Module again
        const Module = require(ModulePath);

        // Initialize the Module and store it
        if (typeof Module.init === 'function') {
            Module.init(this);
            console.log(`Module ${Module.name} loaded`);
            this.modules.push(Module);
        } else {
            console.error(`Module ${ModulePath} does not have an init function.`);
        }
    }

    loadTitle() {
        // Synchronous file reading
        try {
            const dataSync = fs.readFileSync(this.MUD_TITLE_PATH, 'utf8');
            this.mudTitle = dataSync;
        } catch (err) {
            console.error('Error reading file synchronously:', err);
        }
    }

    registerCommand(name, handler, aliases) {
        this.commands.set(name, handler);
        aliases?.forEach(alias => {
            this.commands.set(alias, handler);
        });
    }

    saveBansList() {
        try {
        // Write player data to file in JSON format
        fs.writeFileSync(this.BANS_LIST_PATH, JSON.stringify(Array.from(this.banList.entries()), null, 2));
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
}

module.exports = MUDServer, MUDServer.ConnectionStatus;