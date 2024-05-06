const fs = require('fs');
const path = require('path');
const ServerCommand = require('./Mud/ServerCommand.js');
const { isNumber } = require('../Utils/helpers.js');

const CommandModule = {
    COMMANDS_PATH: path.join(__dirname, '../system', 'commands.json'),
    commands: new Map(),
    name: 'Command',

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

        if (!isNumber(parseInt(cmdLevel))) {
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
                switch (aliasAction.toLowerCase()) {
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
                        player.send(`Usage: editcommand commandnamee aliases <add | remove> aliases`);
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

        if (updated) player.send(`Editted command ${oldCMD} successfully.`);
    },

    findAction(player, cmdAction) {
        const [moduleName, methodName] = cmdAction.split('.');
        const module = CommandModule.mudServer.modules[moduleName];
        const action = (module && module[methodName]) || CommandModule.mudServer[methodName];
        if (!action) {
            player.send(`Method '${methodName}' not found in module '${moduleName}'`);
            return;
        }
        return action;
    },

    findCommand(command) {
        for (const [key, cmd] of CommandModule.commands) {
            if (cmd.aliases.includes(command.toLowerCase()) || cmd.command === command.toLowerCase()) {
                return cmd;
            }
        }
        return null; // Command not found
    },

    handleCommand(player, command) {
        if (command == undefined || command == "") return;

        // Split string by spaces, leaving spaces inside quotes alone
        const commandParts = command.match(/(?:[^\s"]+|"[^"]*")+/g);
        // Remove quotes from each part
        const cleanedParts = commandParts.map(part => part.replace(/^"|"$/g, ''));
        const [cmdName, ...args] = cleanedParts;
        const handler = CommandModule.findCommand(cmdName);

        if (handler) {
            handler.execute(player, args);
        } else {
            player.send('Unknown command!');
        }
    },

    init(mudServer) {
        this.mudServer = mudServer;
        this.loadCommands();
        this.registerEvents();
    },

    loadCommands() {
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

    onHotBootBefore() {
        CommandModule.removeEvents();
    },

    removeCommand(player, args) {
        const [cmdName] = args;

        if (!cmdName) {
            player.send(`Usage: removecommand commandName`);
            return;
        }

        const cmd = CommandModule.findCommand(cmdName);
        if (!cmd) {
            player.send(`Command ${cmd} doesn't exist!`);
            return;
        }

        CommandModule.commands.delete(cmdName.toLowerCase());
        player.send(`Command ${cmdName} removed successfully.`);
    },

    removeEvents() {
        const { mudEmitter } = CommandModule.mudServer;
        mudEmitter.removeListener('handleCommand', CommandModule.handleCommand);
        mudEmitter.removeListener('hotBootBefore', CommandModule.onHotBootBefore);
    },

    registerCommand(name, handler) {
        CommandModule.commands.set(name.toLowerCase(), handler);
    },

    registerEvents() {
        const { mudEmitter } = CommandModule.mudServer;
        mudEmitter.on('handleCommand', CommandModule.handleCommand);
        mudEmitter.on('hotBootBefore', CommandModule.onHotBootBefore);
    },

    saveCommands(player) {
        try {
            const commandsToSave = Array.from(CommandModule.commands.values()).map(({ handler, ...cmd }) => cmd);
            const jsonData = JSON.stringify(commandsToSave, null, 2);
            fs.writeFileSync(CommandModule.COMMANDS_PATH, jsonData);
            player.send('Commands saved successfully.');
        } catch (error) {
            player.send('Error saving commands:', error);
        }
    },
};

module.exports = CommandModule;
