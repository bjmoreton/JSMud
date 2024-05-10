const fs = require('fs');
const path = require('path');
const { isNumber } = require('../Utils/helpers.js');
const Area = require('./AreaModule/Area.js');
const Exit = require('./AreaModule/Exit.js');
const Room = require('./AreaModule/Room.js');
const Section = require('./AreaModule/Section.js');

// Constants
const AREAS_DIR = path.join(__dirname, '../areas');
const ROOM_TEMPLATE = path.join(__dirname, '../system', 'templates', 'room.template');
const MUD_MAP_SIZE_Y = 3; // Grid X size
const MUD_MAP_SIZE_X = 6; // Grid Y size

// Area Module
const AreaModule = {
    name: "Area",
    areaList: new Map(),
    roomTemplate: [],
    startArea: 'Start',
    startSection: 'Start',
    startX: 0,
    startY: 0,
    startZ: 0,

    /**
     * Get area by name.
     * @param {string|object} area - Area name or area object.
     * @returns {Area|null} - The area object if found, null otherwise.
     */
    getAreaByName(area) {
        return AreaModule.areaList.get(typeof area === 'object' ? area.name?.toLowerCase() : area?.toLowerCase()) || null;
    },

    /**
     * Find a room at specified coordinates.
     * @param {string} atArea - Area name.
     * @param {string} atSection - Section name.
     * @param {number} atX - X coordinate.
     * @param {number} atY - Y coordinate.
     * @param {number} atZ - Z coordinate.
     * @returns {Room|null} - The room object if found, null otherwise.
     */
    getRoomAt(atArea, atSection, atX, atY, atZ) {
        const area = AreaModule.getAreaByName(atArea);
        if (!area) {
            console.error('Error: Current area not found!');
            return null;
        }
        const section = area.getSectionByName(atSection);
        if (!section) {
            console.error('Error: Current section not found!');
            return null;
        }
        return section.getRoomByCoordinates(atX, atY, atZ) || null;
    },

    /**
     * Initialize the module.
     * @param {Object} mudServer - The MUD server instance.
     */
    init(mudServer) {
        global.AreaModule = this;
        this.mudServer = mudServer;

        this.mudServer.mudEmitter.on('enteredRoom', this.onEnteredRoom);
        this.mudServer.mudEmitter.on('hotBootAfter', this.onAfterHotboot);
        this.mudServer.mudEmitter.on('hotBootBefore', this.onBeforeHotboot);
        this.mudServer.mudEmitter.on('playerLoggedIn', this.onPlayerLoggedIn);
        this.mudServer.mudEmitter.on('playerSaved', this.onPlayerSaved);
        this.mudServer.mudEmitter.on('sendToRoom', this.onSendToRoom);
        this.mudServer.mudEmitter.on('sendToRoomEmote', this.onSendToRoomEmote);
    },

    /**
     * Load the room template.
     */
    loadRoomTemplate() {
        try {
            const data = fs.readFileSync(ROOM_TEMPLATE, 'utf8');
            AreaModule.roomTemplate = data.split('\r\n');
        } catch (err) {
            console.error('Error reading room template:', err);
        }
    },

    /**
     * Load areas from the directory.
     */
    load() {
        AreaModule.loadRoomTemplate();

        try {
            fs.readdirSync(AREAS_DIR).forEach(file => {
                const filePath = path.join(AREAS_DIR, file);
                console.log(`Loading area ${filePath}`);

                try {
                    const jsonData = fs.readFileSync(filePath, 'utf-8');
                    const areaData = JSON.parse(jsonData);

                    const area = new Area(areaData.name);
                    Object.assign(area, areaData);
                    area.sections = new Map();
                    AreaModule.areaList.set(area.name.toLowerCase(), area);

                    const allExits = new Map();
                    for (const sectionName in areaData.sections) {
                        const sectionData = areaData.sections[sectionName];
                        const section = new Section(area, sectionName, sectionData.nameDisplay, sectionData.description, sectionData.vSize);

                        area.sections.set(sectionName.toLowerCase(), section);

                        sectionData.rooms.forEach(roomData => {
                            const room = new Room(area, section, roomData.name, roomData.description, roomData.x, roomData.y, roomData.z, roomData.progs, roomData.symbol);

                            section.rooms.set(`${room.x},${room.y},${room.z}`, room);
                            allExits.set(room, roomData.exits);

                            AreaModule.mudServer.mudEmitter.emit('roomAdded', room, roomData);
                        });
                    }

                    allExits.forEach((exits, room) => {
                        exits.forEach(exitData => {
                            const exitArea = AreaModule.getAreaByName(exitData.area);
                            const exitSection = exitArea.getSectionByName(exitData.section);
                            const exit = new Exit(
                                exitArea,
                                exitSection,
                                exitData.x,
                                exitData.y,
                                exitData.z,
                                exitData.direction,
                                exitData.progs,
                                exitData.teleport,
                                exitData.initialState
                            );
                            room.exits.set(Exit.stringToExit(exit.direction), exit);
                        });
                    });
                } catch (err) {
                    console.error(`Error reading or parsing JSON file ${filePath}: ${err}`);
                }
            });
        } catch (err) {
            console.error('Error reading directory:', err);
        }
    },

    /**
     * Handle player entering a room.
     * @param {object} player - The player object.
     * @param {string} enterDirection - The direction entered from.
     * @param {Room} room - The room entered.
     */
    onEnteredRoom(player, enterDirection, room) {
        let message = '';
        if (player.inRoom(room)) {
            if (enterDirection != Exit.ExitDirections.None) message = `${player.username} entered the room from the ${enterDirection}.`;
            else message = `${player.username} entered the room.`;

            global.mudEmitter.emit('sendToRoom', player, message, [player.username], message);
        }
    },

    /**
     * Handle player logging in.
     * @param {object} player - The player object.
     */
    onPlayerLoggedIn(player) {
        if (!player.currentArea) player.currentArea = AreaModule.startArea;
        if (!player.currentSection) player.currentSection = AreaModule.startSection;
        if (player.currentX === undefined) player.currentX = AreaModule.startX;
        if (player.currentY === undefined) player.currentY = AreaModule.startY;
        if (player.currentZ === undefined) player.currentZ = AreaModule.startZ;

        player.inRoom = function (room) {
            return parseInt(AreaModule.currentX) === parseInt(room?.x) &&
                parseInt(AreaModule.currentY) == parseInt(room?.y) &&
                parseInt(AreaModule.currentZ) == parseInt(room?.z);
        };

        player.sameRoomAs = function (otherPlayer) {
            return parseInt(AreaModule.currentX) === parseInt(otherPlayer?.currentX) &&
                parseInt(AreaModule.currentY) == parseInt(otherPlayer?.currentY) &&
                parseInt(AreaModule.currentZ) == parseInt(otherPlayer?.currentZ);
        };

        player.currentArea = AreaModule.getAreaByName(player.currentArea);
        player.currentSection = player.currentArea.getSectionByName(player.currentSection);
        player.currentRoom = player.currentSection.getRoomByCoordinates(player.currentX, player.currentY, player.currentZ);

        AreaModule.mudServer.mudEmitter.emit('enteredRoom', player, Exit.ExitDirections.None, player.currentRoom);
        AreaModule.executeLook(player);
    },

    /**
     * Handle player saving.
     * @param {object} player - The player object.
     * @param {object} playerData - The save data to modify.
     */
    onPlayerSaved(player, playerData) {
        playerData.currentArea = player.currentArea?.name;
        playerData.currentSection = player.currentSection?.name;
        playerData.workingArea = player.workingArea?.name;
        playerData.workingSection = player.workingSection?.name;
    },

    /**
     * Handle hotboot after event.
     */
    onAfterHotboot() {
        AreaModule.areaList.forEach(area => {
            Object.setPrototypeOf(area, Area.prototype);
            area.sections.forEach(section => {
                Object.setPrototypeOf(section, Section.prototype);
                section.rooms.forEach(room => {
                    Object.setPrototypeOf(room, Room.prototype);
                    room.exits.forEach(exit => {
                        Object.setPrototypeOf(exit, Exit.prototype);
                    });
                });
            });
        });

        AreaModule.mudServer.players.forEach(player => {
            player.currentArea = AreaModule.getAreaByName(player.currentArea);
            player.currentSection = player.currentArea?.getSectionByName(player.currentSection);
            player.currentRoom = AreaModule.getRoomAt(player.currentArea, player.currentSection, player.currentX, player.currentY, player.currentZ);
            player.workingArea = AreaModule.getAreaByName(player.workingArea);
            player.workingSection = player.workingArea?.getSectionByName(player.workingSection);
        });
    },

    /**
     * Handle hotboot before event.
     */
    onBeforeHotboot(player) {
        AreaModule.save(player);
        AreaModule.mudServer.mudEmitter.removeListener('enteredRoom', AreaModule.onEnteredRoom);
        AreaModule.mudServer.mudEmitter.removeListener('hotBootAfter', AreaModule.onAfterHotboot);
        AreaModule.mudServer.mudEmitter.removeListener('hotBootBefore', AreaModule.onBeforeHotboot);
        AreaModule.mudServer.mudEmitter.removeListener('playerLoggedIn', AreaModule.onPlayerLoggedIn);
        AreaModule.mudServer.mudEmitter.removeListener('playerSaved', AreaModule.onPlayerSaved);
        AreaModule.mudServer.mudEmitter.removeListener('sendToRoom', AreaModule.onSendToRoom);
        AreaModule.mudServer.mudEmitter.removeListener('sendToRoomEmote', AreaModule.onSendToRoomEmote);
    },

    /**
     * Handle sending a message to a room.
     * @param {object} player - The player object.
     * @param {string} message - The message to send.
     * @param {array} excludedPlayers - List of players to exclude from the message.
     * @param {string} [messagePlain] - The plain message to send.
     */
    onSendToRoom(player, message, excludedPlayers = [], messagePlain) {
        console.log('Sending message to room:', message);
        if (messagePlain === undefined) messagePlain = message;
        player.currentRoom?.sendToRoom(player, messagePlain);
        AreaModule.mudServer.players.forEach(p => {
            if (p.sameRoomAs(player) && !excludedPlayers.includes(p.username)) {
                p.send(message);
            }
        });
    },

    /**
     * Handle sending an emote to a room.
     * @param {object} player - The player object.
     * @param {string} emote - The emote message to send.
     */
    onSendToRoomEmote(player, emote) {
        player.currentRoom?.sendToRoomEmote(player, emote);
    },

    /**
     * Generate the room template for the player.
     * @param {object} player - The player object.
     * @returns {string} - The generated room template.
     */
    builtRoomTemplate(player) {
        let roomTemplate = '';
        let output = '';
        const mapStart = AreaModule.roomTemplate.findIndex(entry => entry.includes('%map'));

        AreaModule.roomTemplate.forEach(line => {
            const parsedData = line
                .replace('%map', '')
                .replace('%roomname', player.currentRoom?.name)
                .replace('%description', player.currentRoom?.description)
                .replace('%areaname', player.currentArea?.nameDisplay)
                .replace('%sectionname', player.currentSection?.nameDisplay)
                .replace('%updatedate', player.currentRoom?.lastUpdate);
            roomTemplate += parsedData + "\r\n";
        });

        const dataSplit = roomTemplate.split('\r\n');
        const map = AreaModule.displayMap(player);
        const mapSplit = map?.split('\r\n');
        let x = 0;
        let y = mapStart;

        for (let i = 0; i < mapStart; i++) {
            output += dataSplit[i] + "\r\n";
        }

        while (mapSplit?.length > x || y < dataSplit.length) {
            if (x < mapSplit?.length) {
                output += mapSplit[x];
                x++;
            }

            if (y < dataSplit.length) {
                if (y + 2 < dataSplit.length) output += '\t' + dataSplit[y];
                else output += dataSplit[y];
                y++;
            }
            output += '\r\n';
        }
        return output.trim();
    },

    /**
     * Display the map for the player.
     * @param {object} player - The player object.
     * @returns {string} - The generated map string.
     */
    displayMap(player) {
        const area = AreaModule.getAreaByName(player.currentArea);
        const currentRoom = player.currentRoom;

        if (!currentRoom) {
            player.send("Error: Current room not found.");
            return '';
        }

        const roomMap = new Map();
        const queue = [{ room: currentRoom, x: parseInt(player.currentX), y: parseInt(player.currentY), z: parseInt(player.currentZ) }];

        while (queue.length > 0) {
            const { room, x, y, z } = queue.shift();
            const symbol = room === currentRoom ? "&g@&~" : `${room.symbol}&~`;

            if (!roomMap.has(x)) {
                roomMap.set(x, new Map());
            }
            if (!roomMap.get(x).has(y)) {
                roomMap.get(x).set(y, symbol);
            } else {
                continue;
            }

            room?.exits?.forEach((exit, exitDirection) => {
                const { newX, newY, newZ } = AreaModule.getNewCoordinates(x, y, z, exitDirection);
                if (!roomMap.has(newX) || !roomMap.get(newX).has(newY)) {
                    const exitRoom = AreaModule.exitToRoom(exit);
                    if (exit.teleport || (exitRoom.area.name == player.currentArea.name && exitRoom.section.name == player.currentSection.name)) {
                        queue.push({ room: exitRoom, x: newX, y: newY, z: newZ });
                    }
                }
            });
        }

        return AreaModule.generateMapString(roomMap, player, area);
    },

    /**
     * Generate the map string from the room map.
     * @param {Map} roomMap - The map of rooms.
     * @param {object} player - The player object.
     * @param {Area} area - The area object.
     * @returns {string} - The generated map string.
     */
    generateMapString(roomMap, player, area) {
        let mapString = "";
        const minY = parseInt(player.currentY) - MUD_MAP_SIZE_Y;
        const maxY = parseInt(player.currentY) + MUD_MAP_SIZE_Y;
        const minX = parseInt(player.currentX) - MUD_MAP_SIZE_X;
        const maxX = parseInt(player.currentX) + MUD_MAP_SIZE_X;

        for (let y = maxY; y >= minY; y--) {
            for (let x = minX; x <= maxX; x++) {
                mapString += roomMap.get(x)?.get(y) || area.blankSymbol + '&~';
            }
            mapString += "|\r\n";
        }

        return mapString;
    },

    /**
     * Get new coordinates based on the direction.
     * @param {number} x - X coordinate.
     * @param {number} y - Y coordinate.
     * @param {number} z - Z coordinate.
     * @param {string} direction - Direction string.
     * @returns {object} - Object containing new coordinates.
     */
    getNewCoordinates(x, y, z, direction) {
        switch (Exit.stringToExit(direction)) {
            case Exit.ExitDirections.East:
                return { newX: x + 1, newY: y, newZ: z };
            case Exit.ExitDirections.West:
                return { newX: x - 1, newY: y, newZ: z };
            case Exit.ExitDirections.North:
                return { newX: x, newY: y + 1, newZ: z };
            case Exit.ExitDirections.South:
                return { newX: x, newY: y - 1, newZ: z };
            case Exit.ExitDirections.NorthEast:
                return { newX: x + 1, newY: y + 1, newZ: z };
            case Exit.ExitDirections.NorthWest:
                return { newX: x - 1, newY: y + 1, newZ: z };
            case Exit.ExitDirections.SouthEast:
                return { newX: x + 1, newY: y - 1, newZ: z };
            case Exit.ExitDirections.SouthWest:
                return { newX: x - 1, newY: y - 1, newZ: z };
            case Exit.ExitDirections.Up:
                return { newX: x, newY: y, newZ: z + 1 };
            case Exit.ExitDirections.Down:
                return { newX: x, newY: y, newZ: z - 1 };
            default:
                console.error("Invalid direction provided:", direction);
                return { newX: x, newY: y, newZ: z };
        }
    },

    /**
     * Convert an exit to a room.
     * @param {Exit} exitRoom - The exit object.
     * @returns {Room|null} - The room object if found, null otherwise.
     */
    exitToRoom(exitRoom) {
        const area = AreaModule.getAreaByName(exitRoom.area);
        const section = area?.getSectionByName(exitRoom.section);
        return section?.getRoomByCoordinates(exitRoom.x, exitRoom.y, exitRoom.z) || null;
    },

    /**
     * Save all areas.
     * @param {object} player - The player object.
     */
    save(player) {
        AreaModule.areaList.forEach(area => {
            area.save(player, AREAS_DIR, true);
        });
    },

    /**
     * Move player in a given direction.
     * @param {object} player - The player object.
     * @param {string} exitDirection - The direction to move.
     */
    movePlayer(player, exitDirection) {
        const exit = player.currentRoom.getExitByDirection(Exit.stringToExit(exitDirection));

        if (!exit && exit != Exit.ExitDirections.None) {
            player.send(`Exit ${exitDirection} not found.`);
            return;
        }

        if (!exit.isOpened()) {
            player.send(`The door is shut!`);
            return;
        }

        const { area: newArea, section: newSection, x: newX, y: newY, z: newZ } = exit;
        let toRoom;

        if (player.currentSection?.name?.toLowerCase() === newSection?.name?.toLowerCase()) {
            toRoom = player.currentSection.getRoomByCoordinates(newX, newY, newZ);
        } else {
            const toArea = AreaModule.getAreaByName(newArea.name);
            const toSection = toArea?.getSectionByName(newSection.name);
            toRoom = toSection?.getRoomByCoordinates(newX, newY, newZ);
        }

        if (!toRoom) {
            player.send(`Error: Destination room not found.`);
            return;
        }

        player.currentArea = newArea;
        player.currentSection = newSection;
        player.currentX = parseInt(newX);
        player.currentY = parseInt(newY);
        player.currentZ = parseInt(newZ);

        player.currentRoom = toRoom;

        AreaModule.mudServer.mudEmitter.emit('enteredRoom', player, Exit.oppositeExit(exitDirection), toRoom);
        AreaModule.executeLook(player);
    },

    /**
     * Execute the "look" command.
     * @param {object} player - The player object.
     * @param {array} args - The command arguments.
     */
    executeLook(player, args = []) {
        const [direction] = args;

        if (direction === undefined) {
            const roomTemplate = AreaModule.builtRoomTemplate(player)?.split('\r\n');
            roomTemplate.forEach(string => {
                player.send(`${string}`);
            });
            AreaModule.mudServer.mudEmitter.emit('looked', player);
        } else {
            const strToExit = Exit.stringToExit(direction);
            if (strToExit !== Exit.ExitDirections.None) {
                const exitRoom = player.currentRoom.getExitByDirection(strToExit);
                const room = AreaModule.exitToRoom(exitRoom);
                player.send(`${exitRoom.area.nameDisplay}:${exitRoom.section.nameDisplay}:${room.name}`);
            } else {
                player.send(`You see no ${direction} here!`);
            }
        }
    },

    /**
     * Execute the "area" command.
     * @param {object} player - The player object.
     * @param {array} args - The command arguments.
     */
    async executeArea(player, args) {
        const [cmdName, ...data] = args;
        const foundArea = player.workingArea;

        if (foundArea || cmdName.toLowerCase() == 'create' || cmdName.toLowerCase() == 'work') {
            switch (cmdName?.toLowerCase()) {
                case 'create':
                    await AreaModule.createArea(player, data);
                    break;
                case 'delete':
                    await AreaModule.deleteArea(player, data);
                    break;
                case 'edit':
                    await AreaModule.editArea(player, foundArea, data);
                    break;
                case 'save':
                    foundArea.save(player, AREAS_DIR);
                    break;
                case 'setsymbol':
                    foundArea.blankSymbol = data.join(' ');
                    break;
                case 'work':
                    AreaModule.setWorkingArea(player, data);
                    break;
                default:
                    player.send(`Usage: area <create | delete | edit | save | setsymbol | work>`);
                    break;
            }
        } else {
            player.send(`Usage: area <create | delete | edit | save | setsymbol | work>`);
        }
    },

    /**
     * Create a new area.
     * @param {object} player - The player object.
     * @param {array} data - The command arguments.
     */
    async createArea(player, data) {
        const [areaName] = data;
        if (areaName) {
            if (!AreaModule.areaList.has(areaName.toLowerCase())) {
                AreaModule.areaList.set(areaName.toLowerCase(), new Area(areaName));
                player.send(`Area ${areaName} added!`);
            } else {
                player.send(`Area ${areaName} already exists!`);
            }
        } else {
            player.send(`Usage: area create areaname`);
        }
    },

    /**
     * Delete an area.
     * @param {object} player - The player object.
     * @param {array} data - The command arguments.
     */
    async deleteArea(player, data) {
        const [areaToDelete, fromMemory] = data;
        const deleteArea = AreaModule.getAreaByName(areaToDelete);
        if (areaToDelete !== undefined && fromMemory !== undefined) {
            if (player.hasCommand('area delete') || player.modLevel >= 80) {
                if (deleteArea) {
                    const reallyDelete = await player.textEditor.showPrompt(`Really delete area ${areaToDelete}? yes/no `);

                    if (reallyDelete.toLowerCase() == 'y' || reallyDelete.toLowerCase() == 'yes') {
                        deleteArea.delete(player, AREAS_DIR);
                        if (fromMemory.toLowerCase() == 'true' || fromMemory == 't') AreaModule.areaList.delete(areaToDelete);
                    } else {
                        player.send(`Area ${areaToDelete} wasn't deleted.`);
                    }
                } else {
                    player.send(`Area ${areaToDelete} doesn't exist!`);
                }
            }
        } else {
            player.send(`Usage: area delete areaname fromMemory`);
        }
    },

    /**
     * Edit an existing area.
     * @param {object} player - The player object.
     * @param {Area} area - The area object.
     * @param {array} args - The command arguments.
     */
    async editArea(player, area, args) {
        const [editCmd, ...values] = args;
        const editKeys = ['description', 'name', 'namedisplay'];
        const oldName = area.name;

        if (editCmd !== undefined && editCmd !== "") {
            const value = values?.join(' ');
            let textValue = '';

            if (editKeys.includes(editCmd.toLowerCase())) {
                textValue = value || await player.textEditor.startEditing(area.propertyByString(editCmd));

                if (textValue != null) {
                    switch (editCmd?.toLowerCase()) {
                        case "description":
                            area.description = textValue;
                            break;
                        case "name":
                            if (!AreaModule.areaList.has(textValue.toLowerCase())) {
                                area.name = textValue;
                                AreaModule.areaList.delete(oldName);
                                AreaModule.areaList.set(area.name.toLowerCase(), area);
                                area.delete(player, AREAS_DIR, false);
                            } else {
                                player.send(`Area ${textValue} already exists!`);
                                return;
                            }
                            break;
                        case "namedisplay":
                            area.nameDisplay = textValue;
                            break;
                        default:
                            player.send(`Usage: area edit <description | name | namedisplay>`);
                            break;
                    }
                    area.save(player, AREAS_DIR);
                } else {
                    player.send(`Edit canceled!`);
                }
            } else {
                player.send(`Usage: area edit <description | name | namedisplay>`);
            }
        } else {
            player.send(`Usage: area edit <description | name | namedisplay>`);
        }
    },

    /**
     * Set the working area for the player.
     * @param {object} player - The player object.
     * @param {array} data - The command arguments.
     */
    setWorkingArea(player, data) {
        const [workAreaName] = data;
        if (AreaModule.areaList.has(workAreaName?.toLowerCase())) {
            player.workingArea = AreaModule.areaList.get(workAreaName?.toLowerCase());
            player.send(`Working area set to ${workAreaName}.`);
        } else {
            player.send(`Area ${workAreaName} doesn't exist!`);
        }
    },

    /**
     * Execute the "close" command.
     * @param {object} player - The player object.
     * @param {array} args - The command arguments.
     */
    async executeClose(player, args) {
        const [exitDirection] = args;
        const exit = player.currentRoom.getExitByDirection(Exit.stringToExit(exitDirection));

        if (!exit) {
            player.send(`Exit ${exitDirection} not found.`);
            return;
        }

        await exit.close(player, args);
    },

    /**
     * Execute the "open" command.
     * @param {object} player - The player object.
     * @param {array} args - The command arguments.
     */
    async executeOpen(player, args) {
        const [exitDirection] = args;
        const exit = player.currentRoom.getExitByDirection(Exit.stringToExit(exitDirection));

        if (!exit) {
            player.send(`Exit ${exitDirection} not found.`);
            return;
        }

        await exit.open(player, args);
    },

    /**
     * Execute the "unlock" command.
     * @param {object} player - The player object.
     * @param {array} args - The command arguments.
     */
    async executeUnlock(player, args) {
        const [exitDirection] = args;
        const exit = player.currentRoom.getExitByDirection(Exit.stringToExit(exitDirection));

        if (!exit) {
            player.send(`Exit ${exitDirection} not found.`);
            return;
        }

        await exit.unlock(player, args);
    },

    /**
     * Execute the "lock" command.
     * @param {object} player - The player object.
     * @param {array} args - The command arguments.
     */
    async executeLock(player, args) {
        const [exitDirection] = args;
        const exit = player.currentRoom.getExitByDirection(Exit.stringToExit(exitDirection));

        if (!exit) {
            player.send(`Exit ${exitDirection} not found.`);
            return;
        }

        await exit.lock(player, args);
    },

    /**
     * Execute the "goto" command.
     * @param {object} player - The player object.
     * @param {array} args - The command arguments.
     */
    executeGoto(player, args) {
        const [areaName, sectionName, x, y, z] = args;

        if (AreaModule.areaList.has(areaName?.toLowerCase())) {
            const foundArea = AreaModule.getAreaByName(areaName);
            if (foundArea.sections.has(sectionName?.toLowerCase())) {
                const foundSection = foundArea.getSectionByName(sectionName);
                const room = foundSection?.getRoomByCoordinates(x, y, z);

                if (room != null) {
                    player.currentArea = room.area;
                    player.currentSection = room.section;
                    player.currentX = x;
                    player.currentY = y;
                    player.currentZ = z;
                    player.currentRoom = room;
                    AreaModule.executeLook(player);
                } else {
                    player.send(`Room at ${x}, ${y}, ${z} in area ${areaName} not found!`);
                }
            } else {
                player.send(`Section ${sectionName} not found in area ${areaName}`);
            }
        } else {
            if (areaName === undefined) player.send(`Usage: goto area section x y z`);
            else player.send(`Area ${areaName} not found!`);
        }
    },

    executeNorth(player, args) {
        AreaModule.movePlayer(player, Exit.ExitDirections.North);
    },

    executeSouth(player, args) {
        AreaModule.movePlayer(player, Exit.ExitDirections.South);
    },

    executeEast(player, args) {
        AreaModule.movePlayer(player, Exit.ExitDirections.East);
    },

    executeWest(player, args) {
        AreaModule.movePlayer(player, Exit.ExitDirections.West);
    },

    executeNorthEast(player, args) {
        AreaModule.movePlayer(player, Exit.ExitDirections.NorthEast);
    },

    executeNorthWest(player, args) {
        AreaModule.movePlayer(player, Exit.ExitDirections.NorthWest);
    },

    executeSouthEast(player, args) {
        AreaModule.movePlayer(player, Exit.ExitDirections.SouthEast);
    },

    executeSouthWest(player, args) {
        AreaModule.movePlayer(player, Exit.ExitDirections.SouthWest);
    },

    executeUp(player, args) {
        AreaModule.movePlayer(player, Exit.ExitDirections.Up);
    },

    executeDown(player, args) {
        AreaModule.movePlayer(player, Exit.ExitDirections.Down);
    },

    /**
     * Execute the "section" command.
     * @param {object} player - The player object.
     * @param {array} args - The command arguments.
     */
    async executeSection(player, args) {
        const [cmdName, ...data] = args;
        const foundArea = player.workingArea;

        if (foundArea || cmdName?.toLowerCase() === 'create' || cmdName.toLowerCase() === 'work') {
            switch (cmdName?.toLowerCase()) {
                case 'create':
                    await AreaModule.createSection(player, foundArea, data);
                    break;
                case 'delete':
                    await AreaModule.deleteSection(player, foundArea, data);
                    break;
                case 'edit':
                    await AreaModule.editSection(player, foundArea, data);
                    break;
                case 'work':
                    AreaModule.setWorkingSection(player, foundArea, data);
                    break;
                default:
                    player.send(`Usage: section <create | delete | edit | work>`);
                    break;
            }
        } else {
            player.send(`Usage: section <create | delete | edit | work>`);
        }
    },

    /**
     * Create a new section.
     * @param {object} player - The player object.
     * @param {Area} foundArea - The area object.
     * @param {array} data - The command arguments.
     */
    async createSection(player, foundArea, data) {
        const [sectionName, vSize] = data;

        if (sectionName === undefined || vSize === undefined) {
            player.send(`Usage: section create name vSize`);
            return;
        }

        if (!foundArea) {
            player.send(`Working area not set!`);
            return;
        }

        const newSection = foundArea.getSectionByName(sectionName);

        if (!newSection) {
            if (isNumber(parseInt(vSize))) {
                foundArea.addSection(sectionName, parseInt(vSize));
                player.send(`Section ${sectionName} added successfully!`);
            } else {
                player.send(`vSize needs to be a number!`);
            }
        } else {
            player.send(`Section ${sectionName} already exists in ${foundArea.name}!`);
        }
    },

    /**
     * Delete an existing section.
     * @param {object} player - The player object.
     * @param {Area} foundArea - The area object.
     * @param {array} data - The command arguments.
     */
    async deleteSection(player, foundArea, data) {
        const [sectionToDelete] = data;

        if (!foundArea) {
            player.send(`Working area not set!`);
            return;
        }

        if (sectionToDelete !== undefined) {
            if (player.hasCommand('section delete') || player.modLevel >= 80) {
                const reallyDelete = await player.textEditor.showPrompt(`Really delete section ${sectionToDelete}? yes/no `);

                if (reallyDelete.toLowerCase() === 'y' || reallyDelete.toLowerCase() === 'yes') {
                    foundArea.sections.delete(sectionToDelete.toLowerCase());
                    player.send(`Section ${sectionToDelete} deleted successfully.`);
                } else {
                    player.send(`Section ${sectionToDelete} wasn't deleted.`);
                }
            }
        } else {
            player.send(`Usage: section delete sectionname`);
        }
    },

    /**
     * Edit an existing section.
     * @param {object} player - The player object.
     * @param {Area} foundArea - The area object.
     * @param {array} data - The command arguments.
     */
    async editSection(player, foundArea, data) {
        const [editWhat, ...newValue] = data;

        if (!foundArea) {
            player.send(`Working area not set!`);
            return;
        }

        const foundSection = player.workingSection;

        if (!foundSection) {
            player.send(`Working section not set!`);
            return;
        }

        if (editWhat !== undefined && newValue !== undefined) {
            const newName = newValue.join(' ');
            const oldName = foundSection.name;

            switch (editWhat.toLowerCase()) {
                case 'name':
                    if (newName) {
                        if (!foundArea.getSectionByName(newName)) {
                            foundSection.name = newName;
                            foundArea.sections.delete(oldName.toLowerCase());
                            foundArea.sections.set(newName.toLowerCase(), foundSection);
                            player.send(`Section renamed successfully.`);
                        } else {
                            player.send(`Section ${newName} already exists!`);
                        }
                    } else {
                        player.send(`Name cannot be blank!`);
                    }
                    break;
                default:
                    foundSection[editWhat] = newName;
                    player.send(`${editWhat} updated successfully on ${foundSection.name}.`);
                    break;
            }
        } else {
            player.send(`Usage: section edit <name> value`);
        }
    },

    /**
     * Set the working section for the player.
     * @param {object} player - The player object.
     * @param {Area} foundArea - The area object.
     * @param {array} data - The command arguments.
     */
    setWorkingSection(player, foundArea, data) {
        const [workSection] = data;

        if (foundArea.sections.has(workSection.toLowerCase())) {
            player.workingSection = foundArea.sections.get(workSection.toLowerCase());
            player.send(`Working section set to ${workSection}.`);
        } else {
            player.send(`Section ${workSection} doesn't exist!`);
        }
    },

    /**
     * Execute the "room" command.
     * @param {object} player - The player object.
     * @param {array} args - The command arguments.
     */
    async executeRoom(player, args) {
        const [cmdName, ...data] = args;
        const foundArea = player.workingArea;

        if (foundArea) {
            const foundSection = player.workingSection;

            if (foundSection) {
                switch (cmdName?.toLowerCase()) {
                    case 'create':
                        await AreaModule.createRoom(player, foundArea, foundSection, data);
                        break;
                    case 'delete':
                        await AreaModule.deleteRoom(player, foundSection, data);
                        break;
                    case 'edit':
                        await AreaModule.editRoom(player, foundSection, data);
                        break;
                    case 'addexit':
                        await AreaModule.addRoomExit(player, foundArea, foundSection, data);
                        break;
                    case 'addtexit':
                        await AreaModule.addTeleportExit(player, data);
                        break;
                    case 'removeexit':
                        await AreaModule.removeRoomExit(player, foundSection, data);
                        break;
                    case 'setsymbol':
                        player.currentRoom.symbol = data.join(' ');
                        break;
                    default:
                        player.send(`Usage: room <create | delete | edit | addexit | removeexit | setsymbol>`);
                        break;
                }
            } else {
                player.send(`Working section not set!`);
            }
        } else {
            player.send(`Working area not set!`);
        }
    },

    /**
     * Create a new room.
     * @param {object} player - The player object.
     * @param {Area} foundArea - The area object.
     * @param {Section} foundSection - The section object.
     * @param {array} data - The command arguments.
     */
    async createRoom(player, foundArea, foundSection, data) {
        const [x, y, z] = data;

        if (x !== undefined && y !== undefined && z !== undefined) {
            const foundRoom = foundSection.getRoomByCoordinates(x, y, z);
            if (!foundRoom) {
                foundSection.addRoom(player, foundArea, foundSection, x, y, z);
            } else {
                player.send(`Room already exists at ${x}, ${y}, ${z}!`);
            }
        } else {
            player.send(`Usage: room create x y z`);
        }
    },

    /**
     * Delete an existing room.
     * @param {object} player - The player object.
     * @param {Section} foundSection - The section object.
     * @param {array} data - The command arguments.
     */
    async deleteRoom(player, foundSection, data) {
        const [x, y, z] = data;

        if (x !== undefined && y !== undefined && z !== undefined) {
            if (player.hasCommand('room delete') || player.modLevel >= 80) {
                const reallyDelete = await player.textEditor.showPrompt(`Really delete room ${x}, ${y}, ${z}? yes/no `);

                if (reallyDelete.toLowerCase() === 'y' || reallyDelete.toLowerCase() === 'yes') {
                    foundSection.deleteRoom(player, x, y, z);
                } else {
                    player.send(`Room ${x}, ${y}, ${z} wasn't deleted.`);
                }
            }
        } else {
            player.send(`Usage: room delete x y z`);
        }
    },

    /**
     * Edit an existing room.
     * @param {object} player - The player object.
     * @param {Section} foundSection - The section object.
     * @param {array} args - The command arguments.
     */
    async editRoom(player, foundSection, args) {
        let room = player.currentRoom;
        if (args.length === 1) {
            await AreaModule.editRoomProperties(player, room, args);
        } else {
            const [editCmd, x, y, z, ...values] = args;

            if (x !== undefined && y !== undefined && z !== undefined) {
                room = foundSection.getRoomByCoordinates(x, y, z);

                if (room) {
                    const newArgs = [editCmd, ...values];
                    await AreaModule.editRoomProperties(player, room, newArgs);
                } else {
                    player.send(`Room doesn't exist!`);
                }
            } else {
                player.send(`Usage: room ${editCmd} x y z`);
            }
        }
    },

    /**
     * Edit room properties.
     * @param {object} player - The player object.
     * @param {Room} room - The room object.
     * @param {array} args - The command arguments.
     */
    async editRoomProperties(player, room, args) {
        const [editCmd, ...values] = args;
        const editKeys = ['description', 'name'];

        if (editCmd !== undefined && editCmd !== "") {
            const value = values?.join(' ');
            let textValue = '';

            if (editKeys.includes(editCmd.toLowerCase())) {
                textValue = value || await player.textEditor.startEditing(room.propertyByString(editCmd));

                if (textValue != null) {
                    switch (editCmd?.toLowerCase()) {
                        case "description":
                            room.description = textValue;
                            break;
                        case "name":
                            room.name = textValue;
                            break;
                        default:
                            player.send(`Usage: room edit <description | name>`);
                            break;
                    }
                } else {
                    player.send(`Edit canceled!`);
                }
            } else {
                player.send(`Usage: room edit <description | name>`);
            }
        } else {
            player.send(`Usage: room edit <description | name>`);
        }
    },

    /**
     * Add an exit to the current room.
     * @param {object} player - The player object.
     * @param {Area} foundArea - The area object.
     * @param {Section} foundSection - The section object.
     * @param {array} data - The command arguments.
     */
    async addRoomExit(player, foundArea, foundSection, data) {
        const [direction] = data;

        if (direction !== undefined) {
            player.currentRoom.addExit(player, foundArea, foundSection, direction);
        } else {
            player.send(`Usage: room addexit direction`);
        }
    },

    /**
     * Add a teleport exit to the current room.
     * @param {object} player - The player object.
     * @param {array} data - The command arguments.
     */
    async addTeleportExit(player, data) {
        const [toArea, toSection, toX, toY, toZ, toDirection] = data;
        const fromRoom = player.currentRoom;

        if (toArea !== undefined && toSection !== undefined && toX !== undefined && toY !== undefined && toZ !== undefined && toDirection !== undefined) {
            if (!isNumber(parseInt(toX)) || !isNumber(parseInt(toY)) || !isNumber(parseInt(toZ))) {
                player.send(`Invalid x, y, or z!`);
                return;
            }

            const areaTo = AreaModule.getAreaByName(toArea);
            if (!areaTo) {
                player.send(`Area ${toArea} doesn't exist!`);
                return;
            }

            const sectionTo = areaTo.getSectionByName(toSection);
            if (!sectionTo) {
                player.send(`Section ${toSection} doesn't exist!`);
                return;
            }

            let exitFound = false;
            for (const exit of fromRoom?.exits?.values()) {
                if (exit.isAt(areaTo?.name, sectionTo?.name, toX, toY, toZ)) {
                    player.send(`Exit already exists for that room`);
                    exitFound = true;
                    break;
                }
            }

            if (!exitFound) {
                fromRoom.addExit(player, areaTo, sectionTo, toDirection, parseInt(toX), parseInt(toY), parseInt(toZ), true);
            } else {
                player.send(`Exit already exists for the destination room.`);
            }
        } else {
            player.send(`Usage: room addtexit area section x y z direction`);
        }
    },

    /**
     * Remove an exit from the current room.
     * @param {object} player - The player object.
     * @param {Section} foundSection - The section object.
     * @param {array} data - The command arguments.
     */
    async removeRoomExit(player, foundSection, data) {
        const [direction] = data;
        const fromRoom = player.currentRoom;

        if (direction !== undefined) {
            const exit = fromRoom.getExitByDirection(Exit.stringToExit(direction));
            if (exit) {
                const exitArea = AreaModule.getAreaByName(exit.area.name);
                const exitSection = exitArea.getSectionByName(exit.section.name);
                fromRoom.removeExit(player, foundSection, direction, exitArea, exitSection, exit.x, exit.y, exit.z);
            } else {
                player.send(`Exit not found in that direction!`);
            }
        } else {
            player.send(`Usage: room removeexit direction`);
        }
    },
};

module.exports = AreaModule;