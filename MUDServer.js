const { parseColors } = require('./Color.js');
const StoppableTimeout = require('./Utils/StoppableInterval.js');
const EventEmitter = require('events');
const fs = require('fs');
const net = require('net');
const path = require('path');
const StoppableInterval = require('./Utils/StoppableInterval.js');

// Custom event emitter
class MUDEmitter extends EventEmitter { }

// Core MUD logic
class MUDServer {
    CONFIG_PATH = path.join(__dirname, 'system', 'config.json');
    MUD_TITLE_PATH = path.join(__dirname, 'system', 'mudtitle.txt');
    MODULES_PATH = path.join(__dirname, 'modules');

    addPermissions(...permission) {
        this.permissions.push(permission);
    }

    permissionExist(permission) {
        return this.permissions.includes(permission);
    }

    constructor() {
        this.commands = new Map();
        this.mudEmitter = new MUDEmitter();
        this.players = new Map();
        this.modules = [];
        this.permissions = [];
        this.server = net.createServer();
        this.loadConfig();
        this.loadModules();
        this.loadTitle();
        this.addPermissions('hotboot', 'reloadtitle');

        // Handle player commands
        this.mudEmitter.on('handleCommand', (player, command) => { this.handleCommand(player, command); });
        // Handle player disconnects
        this.mudEmitter.on('playerDisconnected', (player) => {
            this.players.delete(player.socket);
            player.destroy();
        });
        // Handle incoming connections
        this.server.on('connection', socket => {
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
        this.mudEmitter.emit('before_hotboot');
        cb.loadModules();
        cb.loadTitle();
        this.mudEmitter.emit('after_hotboot');
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

    start() {
        this.server.listen(this.port, () => {
            console.log(`${this.name} server listening on port ${this.port}`);
        });
    }
}

module.exports = MUDServer, MUDServer.ConnectionStatus;