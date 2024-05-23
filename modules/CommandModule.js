const fs = require('fs');
const path = require('path');
const ServerCommand = require('./Mud/ServerCommand.js');
const { isNumber } = require('./Mud/Helpers.js');

/**
 * Command Module for MUD server.
 * Provides functionalities to add, edit, remove, and handle commands.
 * 
 * @module CommandModule
 */
const CommandModule = {
    COMMANDS_PATH: path.join(__dirname, '../system', 'commands.json'),
    commands: new Map(),
    name: 'Command',

    /**
     * Adds a new command to the command list.
     * 
     * @param {Player} player - The player adding the command.
     * @param {Array<string>} args - Command arguments (name, level, action, aliases).
     */
    addCommand(player, args) {
        const [cmdName, cmdLevel, cmdAction, ...cmdAliases] = args;

        if (!cmdName || !cmdAction) {
            player.send(`Usage: addcommand name level action aliases`);
            return;
        }

        if (CommandModule.commands.has(cmdName.toLowerCase())) {
            player.send(`Command ${cmdName} already exists!`);
            return;
        }

        if (!isNumber(cmdLevel)) {
            player.send(`modLevel invalid!`);
            return;
        }

        if (parseInt(cmdLevel) > player.modLevel) {
            player.send(`Level cannot be higher than your own(${player.modLevel})`);
            return;
        }

        const action = CommandModule.findAction(player, cmdAction);

        const serverCommand = new ServerCommand(cmdName, cmdAliases, cmdAction, parseInt(cmdLevel), action);
        CommandModule.registerCommand(cmdName, serverCommand);
        player.send(`Added command ${cmdName} successfully.`);
    },

    /**
     * Edits an existing command.
     * 
     * @param {Player} player - The player editing the command.
     * @param {Array<string>} args - Command arguments (name, action, data).
     */
    editCommand(player, args) {
        const [cmdName, cmdAction, ...cmdData] = args;
        let updated = false;

        if (!cmdName || !cmdAction) {
            player.send(`Usage: editcommand commandName <action | aliases | level | name>`);
            return;
        }

        const cmd = CommandModule.findCommand(cmdName);
        if (!cmd) {
            player.send(`Command ${cmd} doesn't exist!`);
            return;
        }
        const oldCMD = cmd.command;
        switch (cmdAction.toLowerCase()) {
            case 'action':
                const [newActionName] = cmdData;
                const newAction = CommandModule.findAction(player, newActionName);

                if (newAction) {
                    cmd.action = newActionName;
                    cmd.handler = newAction;
                    updated = true;
                }
                break;
            case 'aliases':
                const [aliasAction, ...aliases] = cmdData;
                switch (aliasAction?.toLowerCase()) {
                    case 'add':
                        aliases.forEach(alias => {
                            const existingAlias = cmd.aliases.find(a => a === alias);
                            if (!existingAlias) cmd.aliases.push(alias);
                        });
                        updated = true;
                        break;
                    case 'remove':
                        aliases.forEach(alias => {
                            const index = cmd.aliases.findIndex(a => a === alias);
                            if (index !== -1) {
                                cmd.aliases.splice(index, 1); // Remove Alias at the found index
                            }
                        });
                        updated = true;
                        break;
                    default:
                        player.send(`Usage: editcommand commandname aliases <add | remove> aliases`);
                        break;
                }
                break;
            case 'level':
                const [newLevel] = cmdData;
                if (!isNumber(newLevel) || parseInt(newLevel) > player.modLevel) {
                    player.send(`Level needs to be a number <= ${player.modLevel}!`);
                    return;
                }

                cmd.modLevel = parseInt(newLevel);
                updated = true;
                break;
            case 'name':
                const [newName] = cmdData;
                const exists = CommandModule.findCommand(newName);

                if (!exists) {
                    cmd.command = newName;
                    CommandModule.commands.delete(oldCMD);
                    CommandModule.commands.set(newName, cmd.handler);
                    updated = true;
                } else {
                    player.send(`Command ${newName} already exists!`);
                }
                break;
            default:
                player.send(`Usage: editcommand commandName <action | aliases | level | name>`);
                break;
        }

        if (updated) player.send(`Edited command ${oldCMD} successfully.`);
    },

    /**
     * Finds the action method for a command.
     * 
     * @param {Player} player - The player executing the command.
     * @param {string} cmdAction - The action string in format 'module.method'.
     * @returns {Function|null} The action function if found, null otherwise.
     */
    findAction(player, cmdAction) {
        const [moduleName, methodName] = cmdAction.split('.');
        const module = CommandModule.mudServer.modules[moduleName];
        const action = (module && module[methodName]) || CommandModule.mudServer[methodName];
        if (!action) {
            player.send(`Method '${methodName}' not found in module '${moduleName}'`);
            return null;
        }
        return action;
    },

    /**
     * Finds a command by its name or alias.
     * 
     * @param {string} command - The command name or alias.
     * @returns {ServerCommand|null} The command if found, null otherwise.
     */
    findCommand(command) {
        for (const [key, cmd] of CommandModule.commands) {
            if (cmd.aliases.includes(command.toLowerCase()) || cmd.command === command.toLowerCase()) {
                return cmd;
            }
        }
        return null; // Command not found
    },

    /**
     * Handles the execution of a command.
     * 
     * @param {Player} player - The player executing the command.
     * @param {string} command - The command string.
     * @param {Object} eventObj - The event object.
     */
    handleCommand(player, command, eventObj) {
        if (command == undefined || command == "") return;
        const commandParts = command.match(/(?:[^\s"'`]+|["'][^"'`]*["']|`[^`]*`)+/g);
        const cleanedParts = commandParts.map(part => part.replace(/^["'`]|["'`]$/g, ''));
        const [cmdName, ...args] = cleanedParts;
        let handler = undefined;
        if (args.length > 0) {
            handler = CommandModule.findCommand(`${cmdName} ${args[0]}`);

            if (handler) {
                args.shift();
            }
        }

        if (!handler) handler = CommandModule.findCommand(cmdName);

        if (handler) {
            eventObj.handled = true;
            handler.execute(player, args);
        }
    },

    /**
     * Initializes the CommandModule.
     * 
     * @param {Object} mudServer - The MUD server instance.
     */
    init(mudServer) {
        global.CommandModule = this;
        this.mudServer = mudServer;
        this.registerEvents();
    },

    /**
     * Loads commands from the commands JSON file.
     */
    load() {
        try {
            const data = fs.readFileSync(CommandModule.COMMANDS_PATH, 'utf-8');
            const commands = JSON.parse(data);

            commands.forEach(cmd => {
                const [moduleName, methodName] = cmd.action.split('.');
                const module = CommandModule.mudServer.modules[moduleName];
                const action = (module && module[methodName]) || CommandModule.mudServer[methodName];

                if (!action) {
                    console.error(`Method '${methodName}' not found in module '${moduleName}'`);
                    return;
                }

                const serverCommand = new ServerCommand(cmd.command, cmd.aliases, cmd.action, parseInt(cmd.modLevel), action);
                CommandModule.registerCommand(cmd.command, serverCommand);
            });
        } catch (error) {
            console.error('Error loading commands:', error);
        }
    },

    /**
     * Handles the hot boot before event.
     */
    onHotBootBefore() {
        CommandModule.removeEvents();
    },

    /**
     * Removes a command from the command list.
     * 
     * @param {Player} player - The player removing the command.
     * @param {Array<string>} args - Command arguments (name).
     */
    removeCommand(player, args) {
        const [cmdName] = args;

        if (!cmdName) {
            player.send(`Usage: removecommand commandName`);
            return;
        }

        const cmd = CommandModule.findCommand(cmdName);
        if (!cmd) {
            player.send(`Command ${cmdName} doesn't exist!`);
            return;
        }

        CommandModule.commands.delete(cmdName.toLowerCase());
        player.send(`Command ${cmdName} removed successfully.`);
    },

    /**
     * Removes event listeners for the module.
     */
    removeEvents() {
        CommandModule.mudServer.off('handleCommand', CommandModule.handleCommand);
        CommandModule.mudServer.off('hotBootBefore', CommandModule.onHotBootBefore);
    },

    /**
     * Registers a command in the command list.
     * 
     * @param {string} name - The command name.
     * @param {ServerCommand} handler - The command handler.
     */
    registerCommand(name, handler) {
        CommandModule.commands.set(name.toLowerCase(), handler);
    },

    /**
     * Registers event listeners for the module.
     */
    registerEvents() {
        CommandModule.mudServer.on('handleCommand', CommandModule.handleCommand);
        CommandModule.mudServer.on('hotBootBefore', CommandModule.onHotBootBefore);
    },

    /**
     * Saves the current commands to the JSON file.
     * 
     * @param {Player} player - The player saving the commands.
     */
    save(player) {
        try {
            const commandsToSave = Array.from(CommandModule.commands.values()).map(({ handler, ...cmd }) => cmd);
            const jsonData = JSON.stringify(commandsToSave, null, 2);
            fs.writeFileSync(CommandModule.COMMANDS_PATH, jsonData);
            player.send('Commands saved successfully.');
        } catch (error) {
            player.send('Error saving commands:', error);
        }
    },

    /**
     * Shows the list of commands, optionally filtered by a search term, in batches of 5.
     * 
     * @param {Player} player - The player requesting the command list.
     * @param {Array<string>} args - Command arguments (optional search term).
     */
    showCommands(player, args) {
        const batchSize = 5;
        const searchTerm = args.length > 0 ? args.join(' ').toLowerCase() : null;
        const commandsArray = Array.from(CommandModule.commands.entries())
            .filter(([cmdName, cmd]) => cmd.modLevel <= player.modLevel)
            .map(([cmdName]) => cmdName)
            .sort();
        let filteredCommands;
    
        if (searchTerm) {
            filteredCommands = commandsArray.filter(cmd => cmd.toLowerCase().includes(searchTerm.toLowerCase()));
        } else {
            filteredCommands = commandsArray;
        }
    
        if (filteredCommands.length === 0) {
            player.send(`No commands found matching '${searchTerm}'.`);
            return;
        }
    
        for (let i = 0; i < filteredCommands.length; i += batchSize) {
            const batch = filteredCommands.slice(i, i + batchSize);
            player.send(`Commands: ${batch.join(', ')}`);
        }
    },
};

module.exports = CommandModule;
