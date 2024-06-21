const fs = require('fs');
const path = require('path');
const { isNumber, isValidString, stringToBoolean, stripAnsiCodes } = require('./Mud/Helpers.js');
const Area = require('./AreaModule/Area.js');
const Exit = require('./AreaModule/Exit.js');
const Room = require('./AreaModule/Room.js');
const Section = require('./AreaModule/Section.js');
const RoomState = require('./AreaModule/RoomState.js');
const RoomFlags = require('./AreaModule/RoomFlags.js');

// Constants
const AREAS_DIR = path.join(__dirname, '../areas');
const ROOM_TEMPLATE = path.join(__dirname, '../system', 'templates', 'room.template');
const MUD_MAP_SIZE_Y = 1; // Grid Y size
const MUD_MAP_SIZE_X = 3; // Grid X size

/**
 * Area Module for managing areas, sections, and rooms.
 * @module AreaModule
 */
const AreaModule = {
    name: "Area",
    ROOM_FLAGS_PATH: path.join(__dirname, '../system', 'roomFlags.json'),
    areaList: new Map(),
    roomTemplate: [],
    startArea: 'Start',
    startSection: 'Start',
    startX: 0,
    startY: 0,
    startZ: 0,

    addRoomFlag(player, args) {
        const [flagName] = args;

        if (!flagName) {
            player.send(`Usage: addroomflag [value]`);
            return;
        }

        if (!RoomFlags.hasFlag(flagName)) {
            RoomFlags.addFlag(flagName);
        } else {
            player.send(`Flag ${flagName} already exist!`);
            return;
        }

        player.send(`Item flag ${flagName} added successfully.`);
    },

    async editRoomFlag(player, args) {
        const [flagName, eventName] = args;
        if (!flagName) {
            player.send(`Usage: editroomflag [flag] [event]`);
            return;
        }

        if (!eventName) {
            player.send(`Usage: editroomflag ${flagName} [event]`);
            return;
        }

        const flag = RoomFlags.getFlag(flagName);
        if (!flag) {
            player.send(`Flag ${flagName} not found!`);
            return;
        }
        const defaultText = flag.events[eventName.toLowerCase()]?.actionCode;
        const actionCode = await player.textEditor.startEditing((defaultText ? defaultText : ''));

        if (actionCode !== null) {
            RoomFlags.addEvent(flag, eventName, actionCode);
            player.send(`Updated ${flagName} successfully!`);
        } else {
            player.send(`Canceled edit of ${eventName} on room flag ${flagName}!`);
        }
    },

    removeRoomFlag(player, args) {
        const [flag] = args;
        if (!flag) {
            player.send(`Usage: removeroomflag [flag]`);
            return;
        }

        RoomFlags.removeFlag(flag);
        player.send(`Room flag deleted successfully.`);
    },

    /**
     * Save item rarities to the JSON file.
     * 
     * @param {Player} player - The player initiating the save.
     */
    saveRoomFlags(player) {
        try {
            fs.writeFileSync(AreaModule.ROOM_FLAGS_PATH, RoomFlags.serialize(), 'utf8');
            AreaModule.areaList.forEach(area => {
                area.sections.forEach(section => {
                    section.rooms.forEach(room => {
                        const removeCSFlags = [];
                        const removeDSFlags = [];
                        room.currentState.flags.forEach(flag => {
                            const existingFlag = RoomFlags.getFlag(flag.name);
                            if (!existingFlag) {
                                removeCSFlags.push(flag);
                            }
                        });
                        room.defaultState.flags.forEach(flag => {
                            const existingFlag = RoomFlags.getFlag(flag.name);
                            if (!existingFlag) {
                                removeDSFlags.push(flag);
                            }
                        });
                        removeCSFlags.forEach(flag => {
                            room.currentState.flags.remove(flag.name);
                        });
                        removeDSFlags.forEach(flag => {
                            room.defaultState.flags.remove(flag.name);
                        });
                    });
                });

                area.save(player, AREAS_DIR);
            });
            AreaModule.mudServer.emit('roomFlagsSaved');
            console.log("Room flags saved successfully.");
            if (player) player.send("Room flags saved successfully.");
        } catch (error) {
            console.error("Failed to save room flags:", error);
            if (player) player.send("Failed to save room flags.");
        }
    },

    /**
     * Load room flags from the JSON file.
     * 
     * @param {Player} player - The player initiating the load.
     * @param {boolean} [triggerEvent=true] - Whether to trigger the roomFlagsLoaded event.
     */
    loadRoomFlags(player) {
        try {
            const data = fs.readFileSync(AreaModule.ROOM_FLAGS_PATH, 'utf8');
            const flagsData = JSON.parse(data);

            RoomFlags.deserialize(flagsData);

            console.log("Room flags loaded successfully.");
            if (player) player.send("Room flags loaded successfully.");
        } catch (error) {
            console.error("Failed to loaded room flags:", error);
            if (player) player.send("Failed to loaded room flags.");
        }
    },

    /**
     * Get area by name.
     * @param {string|object} area - Area name or area object.
     * @returns {Area|null} - The area object if found, null otherwise.
     */
    getAreaByName(area) {
        if (!area) return null;
        return AreaModule.areaList.get(typeof area === 'object' ? area.name?.toLowerCase() : area?.toLowerCase()) || undefined;
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

        this.mudServer.on('enteredRoom', this.onEnteredRoom);
        this.mudServer.on('exitedRoom', this.onExitedRoom);
        this.mudServer.on('hotBootAfter', this.onAfterHotboot);
        this.mudServer.on('hotBootBefore', this.onBeforeHotboot);
        this.mudServer.on('playerDisconnected', this.onPlayerDisconnected);
        this.mudServer.on('playerLoggedIn', this.onPlayerLoggedIn);
        this.mudServer.on('playerSaved', this.onPlayerSaved);
        this.mudServer.on('sendToRoom', this.onSendToRoom);
        this.mudServer.on('sendToRoomEmote', this.onSendToRoomEmote);
        this.mudServer.on('sendToSectionMessage', this.onSendToSectionMessage);
    },

    /**
     * Sends a message to all players in the section.
     * @param {string} message - The message to send.
     */
    onSendToSectionMessage(section, message) {
        AreaModule.mudServer.players.forEach(player => {
            if (player.currentSection === section) {
                player.send(message);
            }
        });
    },

    /**
     * Load the room template.
     */
    loadRoomTemplate() {
        try {
            const data = fs.readFileSync(ROOM_TEMPLATE, 'utf8');
            AreaModule.roomTemplate = data.split('\n');
        } catch (err) {
            console.error('Error reading room template:', err);
        }
    },

    /**
     * Load areas from the directory.
     */
    load() {
        AreaModule.loadRoomFlags();
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

                        section.resetMessages = sectionData.resetMessages;
                        section.maxReset = parseInt(sectionData.maxReset);
                        section.minReset = parseInt(sectionData.minReset);
                        section.resetEnabled = sectionData.resetEnabled;
                        section.startResetTimer();
                        area.sections.set(sectionName.toLowerCase(), section);

                        sectionData.rooms.forEach(roomData => {
                            const room = new Room(area, section, roomData.name, roomData.description, roomData.x, roomData.y, roomData.z,
                                roomData.progs, roomData.symbol, roomData.defaultState);
                            section.rooms.set(`${room.x},${room.y},${room.z}`, room);
                            allExits.set(room, roomData.exits);

                            AreaModule.mudServer.emit('roomLoaded', room, roomData);
                        });
                    }

                    allExits.forEach((exits, room) => {
                        exits.forEach(exitData => {
                            const exitArea = AreaModule.getAreaByName(exitData.area);
                            const exitSection = exitArea.getSectionByName(exitData.section);
                            const fromRoomData = exitData.fromRoom;
                            const fromRoomArea = AreaModule.getAreaByName(fromRoomData.area);
                            const fromRoomSection = fromRoomArea.getSectionByName(fromRoomData.section);
                            const fromRoom = fromRoomSection.getRoomByCoordinates(fromRoomData.x, fromRoomData.y, fromRoomData.z);
                            const exit = new Exit(
                                exitArea,
                                exitSection,
                                exitData.x,
                                exitData.y,
                                exitData.z,
                                exitData.direction,
                                exitData.progs,
                                fromRoom,
                                exitData.teleport,
                                exitData.initialState
                            );
                            room.exits.set(Exit.stringToExit(exit.direction), exit);
                            Room.addExitActual(exit, room);
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
        if (room && player.inRoom(room)) {
            room.addPlayer(player);
            if (enterDirection && enterDirection != Exit.ExitDirections.None) message = `${player.username} entered the room from the ${enterDirection}.`;
            else message = `${player.username} entered the room.`;

            AreaModule.mudServer.emit('sendToRoom', player, message, [player.username]);
        }
    },

    /**
     * Handle player exiting a room.
     * @param {object} player - The player object.
     * @param {string} enterDirection - The direction exiting.
     * @param {Room} room - The room exiting from.
     */
    onExitedRoom(player, enterDirection, room) {
        let message = '';
        if (player.inRoom && player.inRoom(room)) {
            room.removePlayer(player);
            if (enterDirection && enterDirection != Exit.ExitDirections.None) message = `${player.username} left in the ${enterDirection} direction.`;
            else message = `${player.username} left the room.`;

            AreaModule.mudServer.emit('sendToRoom', player, message, [player.username]);
        }
    },

    /**
     * Handle player disconnecting.
     * @param {object} player - The player object.
     */
    onPlayerDisconnected(player) {
        AreaModule.mudServer.emit('exitedRoom', player, Exit.ExitDirections.None, player.currentRoom);
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

        AreaModule.addPlayerMethods(player);

        player.currentArea = AreaModule.getAreaByName(player.currentArea);
        if (player.currentArea) {
            player.currentSection = player.currentArea.getSectionByName(player.currentSection);
            if (player.currentSection) {
                player.currentRoom = player.currentSection.getRoomByCoordinates(player.currentX, player.currentY, player.currentZ);
            } else {
                player.currentRoom = undefined;
            }
        } else {
            player.currentSection = undefined;
            player.currentRoom = undefined;
        }

        if (player.workingArea) player.workingArea = AreaModule.getAreaByName(player.workingArea);
        if (player.workingSection) player.workingSection = player.workingArea.getSectionByName(player.workingSection);

        AreaModule.mudServer.emit('enteredRoom', player, Exit.ExitDirections.None, player.currentRoom);
        AreaModule.executeLook(player);
    },

    /**
     * Add methods to the player.
     * @param {object} player - The player object.
     */
    addPlayerMethods(player) {
        player.inRoom = function (room) {
            return parseInt(this.currentX) === parseInt(room?.x) &&
                parseInt(this.currentY) == parseInt(room?.y) &&
                parseInt(this.currentZ) == parseInt(room?.z);
        };

        player.sameRoomAs = function (otherPlayer) {
            return parseInt(this.currentX) === parseInt(otherPlayer?.currentX) &&
                parseInt(this.currentY) == parseInt(otherPlayer?.currentY) &&
                parseInt(this.currentZ) == parseInt(otherPlayer?.currentZ);
        };
    },

    /**
     * Handle player saving.
     * @param {object} player - The player object.
     * @param {object} playerData - The save data to modify.
     */
    onPlayerSaved(player, playerData) {
        playerData.currentArea = player.currentArea?.name;
        playerData.currentRoom = player.currentRoom?.name;
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
                section.startResetTimer();
                section.rooms.forEach(room => {
                    Object.setPrototypeOf(room, Room.prototype);
                    if (room.currentState) {
                        Object.setPrototypeOf(room.currentState, RoomState.prototype);
                        if (room.currentState.flags) Object.setPrototypeOf(room.currentState.flags, RoomFlags.prototype);
                    }
                    if (room.defaultState) {
                        Object.setPrototypeOf(room.defaultState, RoomState.prototype);
                        if (room.defaultState.flags) Object.setPrototypeOf(room.defaultState.flags, RoomFlags.prototype);
                    }
                    room.exits.forEach(exit => {
                        Object.setPrototypeOf(exit, Exit.prototype);
                    });
                });
            });
        });

        AreaModule.mudServer.players.forEach(player => {
            AreaModule.addPlayerMethods(player);
            player.currentArea = AreaModule.getAreaByName(player.currentArea);
            if (player.currentArea) {
                player.currentSection = player.currentArea?.getSectionByName(player.currentSection);
                if (player.currentSection) {
                    player.currentRoom = AreaModule.getRoomAt(player.currentArea.name, player.currentSection.name, player.currentX, player.currentY, player.currentZ);

                    player.currentRoom?.addPlayer(player);
                } else {
                    player.currentRoom = undefined;
                }
            } else {
                player.currentSection = undefined;
                player.currentRoom = undefined;
            }

            player.workingArea = AreaModule.getAreaByName(player.workingArea);
            player.workingSection = player.workingArea?.getSectionByName(player.workingSection);

        });
    },

    /**
     * Handle hotboot before event.
     * @param {object} player - The player object.
     */
    onBeforeHotboot(player) {
        AreaModule.areaList.forEach(area => {
            area.sections.forEach(section => {
                section.clearResetTimer();
            });
        });

        AreaModule.mudServer.off('enteredRoom', AreaModule.onEnteredRoom);
        AreaModule.mudServer.off('exitedRoom', AreaModule.onExitedRoom);
        AreaModule.mudServer.off('hotBootAfter', AreaModule.onAfterHotboot);
        AreaModule.mudServer.off('hotBootBefore', AreaModule.onBeforeHotboot);
        AreaModule.mudServer.off('playerDisconnected', AreaModule.onPlayerDisconnected);
        AreaModule.mudServer.off('playerLoggedIn', AreaModule.onPlayerLoggedIn);
        AreaModule.mudServer.off('playerSaved', AreaModule.onPlayerSaved);
        AreaModule.mudServer.off('sendToRoom', AreaModule.onSendToRoom);
        AreaModule.mudServer.off('sendToRoomEmote', AreaModule.onSendToRoomEmote);
        AreaModule.mudServer.off('sendToSectionMessage', AreaModule.onSendToSectionMessage);
    },

    /**
     * Handle sending a message to a room.
     * @param {object} player - The player object.
     * @param {string} message - The message to send.
     * @param {array} excludedPlayers - List of players to exclude from the message.
     * @param {string} [messagePlain] - The plain message to send.
     */
    onSendToRoom(player, message, excludedPlayers = [], messagePlain) {
        if (messagePlain === undefined) messagePlain = message;
        player.currentRoom?.sendToRoom(player, message, excludedPlayers, messagePlain);
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
            roomTemplate += parsedData + "\n";
        });

        const dataSplit = roomTemplate.split('\n');
        const map = AreaModule.displayMap(player);
        const mapSplit = map?.split('\n');
        let x = 0;
        let y = mapStart;

        for (let i = 0; i < mapStart; i++) {
            output += dataSplit[i] + "\n";
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
            output += '\n';
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

        // Initialize the roomMap as a Map of Maps of Maps
        const roomMap = new Map();
        const queue = [{ room: currentRoom, x: parseInt(player.currentX), y: parseInt(player.currentY), z: parseInt(player.currentZ) }];

        while (queue.length > 0) {
            const { room, x, y, z } = queue.shift();
            let symbol = room === currentRoom ? "&g@&~" : (room.players.size > 0 ? "&P@&~" : `${room.symbol}&~`);

            // Ensure the structure exists for the z coordinate
            if (!roomMap.has(z)) {
                roomMap.set(z, new Map());
            }

            const zLayer = roomMap.get(z);

            if (!zLayer.has(x)) {
                zLayer.set(x, new Map());
            }

            const xLayer = zLayer.get(x);

            if (!xLayer.has(y)) {
                xLayer.set(y, { exits: new Map(), symbol });
            }

            console.log(room);
            console.log(room.exits);
            if (room && room.exits) {
                room?.exits?.forEach((exit, exitDirection) => {
                    const { newX, newY, newZ } = AreaModule.getNewCoordinates(x, y, z, exitDirection);
                    if (!roomMap.has(newZ) || !roomMap.get(newZ).has(newX) || !roomMap.get(newZ).get(newX).has(newY)) {
                        const exitRoom = exit.toRoom();
                        if ((exit.teleport || (exitRoom.area.name == player.currentArea.name && exitRoom.section.name == player.currentSection.name)) && !exit.isClosed()) {
                            queue.push({ room: exitRoom, x: newX, y: newY, z: newZ });
                        }
                    }

                    xLayer.get(y).exits.set(exitDirection.toLowerCase(), exit);
                });
            }
        }
        return AreaModule.generateMapString(roomMap, player, area);
    },

    /**
     * Generate the map string from the room map.
     * Inspired by DragonBall: Infinity dbinfinity.bounceme.net:4000
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
            let rowString = "";
            let bottomConnections = "";
            let topConnections = "";
            for (let x = minX; x <= maxX; x++) {
                const room = roomMap.get(player.currentZ)?.get(x)?.get(y);
                const symbol = room?.symbol || area?.blankSymbol + '&~';
                const lockSymbol = '}226*&~';
                const doorSymbol = '}229#&~';
                const east = room?.exits.get('east');
                const north = room?.exits.get('north');
                const northEast = room?.exits.get('northeast');
                const northWest = room?.exits.get('northwest');
                const south = room?.exits.get('south');
                const southEast = room?.exits.get('southeast');
                const southWest = room?.exits.get('southwest');
                const west = room?.exits.get('west');

                const eastConnection = east ? (east.isClosed() ? (east.isLocked() ? lockSymbol : doorSymbol) : '-') : area?.blankSymbol + '&~';
                const northConnection = north ? (north.isClosed() ? (north.isLocked() ? lockSymbol : doorSymbol) : '|') : area?.blankSymbol + '&~'
                const northEastConnection = northEast ? (northEast.isClosed() ? (northEast.isLocked() ? lockSymbol : doorSymbol) : '/') : area?.blankSymbol + '&~';
                const northWestConnection = northWest ? (northWest.isClosed() ? (northWest.isLocked() ? lockSymbol : doorSymbol) : '\\') : area?.blankSymbol + '&~';
                const southConnection = south ? (south.isClosed() ? (south.isLocked() ? lockSymbol : doorSymbol) : '|') : area?.blankSymbol + '&~';
                const southEastConnection = southEast ? (southEast.isClosed() ? (southEast.isLocked() ? lockSymbol : doorSymbol) : '\\') : area?.blankSymbol + '&~';
                const southWestConnection = southWest ? (southWest.isClosed() ? (southWest.isLocked() ? lockSymbol : doorSymbol) : '/') : area?.blankSymbol + '&~';
                const westConnection = west ? (west.isClosed() ? (west.isLocked() ? lockSymbol : doorSymbol) : '-') : area?.blankSymbol + '&~';

                topConnections += northWestConnection + northConnection + northEastConnection;
                rowString += westConnection + symbol + eastConnection;
                bottomConnections += southWestConnection + southConnection + southEastConnection;
            }
            mapString += topConnections + "|\n" + rowString + "|\n" + bottomConnections + "|\n";
        }

        const lines = mapString.split('\n');
        const middleIndex = Math.floor(lines.length / 2);

        for (let line = 0; line < lines.length; line++) {
            if (line === middleIndex - 2) {
                const symbol = roomMap.get(player.currentZ + 1)?.get(player.currentX)?.get(player.currentY)?.symbol;
                lines[line] += (symbol || area?.blankSymbol) + '&~|';
            } else if (line === middleIndex - 1) {
                const symbol = roomMap.get(player.currentZ)?.get(player.currentX)?.get(player.currentY)?.symbol;
                lines[line] += (symbol || area?.blankSymbol) + '&~|';
            } else if (line === middleIndex) {
                const symbol = roomMap.get(player.currentZ - 1)?.get(player.currentX)?.get(player.currentY)?.symbol;
                lines[line] += (symbol || area?.blankSymbol) + '&~|';
            } else if (line < lines.length - 1) {
                lines[line] += ' |';
            }
        }

        mapString = lines.join('\n');
        const coordinateString = `(${player.currentX}, ${player.currentY}, ${player.currentZ})`;

        // Calculate total padding needed to center the coordinate string
        const totalPadding = Math.max(0, stripAnsiCodes(lines[0])?.length - coordinateString.length);
        const leftPadding = Math.floor(totalPadding / 2);
        const rightPadding = totalPadding - leftPadding;

        // Create the centered coordinate line
        const coordinateLine = " ".repeat(leftPadding) + coordinateString + " ".repeat(rightPadding - 3) + "| |\n";

        // Append the centered coordinate line to the map string
        mapString += coordinateLine;
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
     * Move player in a given direction.
     * @param {object} player - The player object.
     * @param {string} exitDirection - The direction to move.
     */
    movePlayer(player, exitDirection) {
        try {
            const exit = player.currentRoom?.getExitByDirection(Exit.stringToExit(exitDirection));

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

            AreaModule.mudServer.emit('exitedRoom', player, exitDirection, player.currentRoom);

            player.currentArea = newArea;
            player.currentSection = newSection;
            player.currentX = parseInt(newX);
            player.currentY = parseInt(newY);
            player.currentZ = parseInt(newZ);

            player.currentRoom = toRoom;

            AreaModule.mudServer.emit('enteredRoom', player, Exit.oppositeExit(exitDirection), toRoom);
            AreaModule.executeLook(player);
        } catch (error) {
            console.error(error);
            player.send('Unable to move.');
        }
    },

    /**
     * Execute the "look" command.
     * @param {object} player - The player object.
     * @param {array} args - The command arguments.
     */
    executeLook(player, args = []) {
        const [direction] = args;

        if (direction === undefined) {
            const roomTemplate = AreaModule.builtRoomTemplate(player)?.split('\n');
            roomTemplate.forEach(string => {
                player.send(`${string}`);
            });
            AreaModule.mudServer.emit('looked', player);
        } else {
            const strToExit = Exit.stringToExit(direction);
            let eventObj = { handled: false };
            if (strToExit && strToExit !== Exit.ExitDirections.None) {
                const exit = player.currentRoom.getExitByDirection(strToExit);
                if (exit) {
                    const room = exit.toRoom();
                    player.send(`${exitRoom.area.nameDisplay}:${exitRoom.section.nameDisplay}:${room.name}`);
                    eventObj.handled = true;
                }
            } else {
                AreaModule.mudServer.emit('executedLook', player, args, eventObj);
            }

            if (!eventObj.handled) {
                player.send(`You see no ${direction} here!`);
            }
        }
    },

    /**
     * Create a new area.
     * @param {object} player - The player object.
     * @param {array} data - The command arguments.
     */
    createArea(player, data) {
        const [areaName] = data;
        if (areaName) {
            if (!AreaModule.areaList.has(areaName.toLowerCase())) {
                AreaModule.areaList.set(areaName.toLowerCase(), new Area(areaName));
                player.send(`Area ${areaName} added!`);
            } else {
                player.send(`Area ${areaName} already exists!`);
            }
        } else {
            player.send(`Usage: createarea areaname`);
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
        } else {
            player.send(`Usage: deletearea areaname fromMemory`);
        }
    },

    /**
     * Edit an existing area.
     * @param {object} player - The player object.
     * @param {array} args - The command arguments.
     */
    async editArea(player, args) {
        if (!player.workingArea) {
            player.send(`Must set a working area first!`);
            return;
        }
        const [editCmd, ...values] = args;
        const area = player.workingArea;

        if (editCmd !== undefined && editCmd !== "") {
            const value = values?.join(' ');
            let textValue = value;

            switch (editCmd?.toLowerCase()) {
                case "description":
                    textValue = await player.textEditor.startEditing(area.description);
                    area.description = textValue;
                    break;
                case "name":
                    if (isValidString(textValue)) {
                        const oldName = area.name;

                        if (!AreaModule.areaList.has(textValue.toLowerCase())) {
                            area.name = textValue;
                            AreaModule.areaList.delete(oldName);
                            AreaModule.areaList.set(area.name.toLowerCase(), area);
                            area.delete(player, AREAS_DIR, false);
                        } else {
                            player.send(`Area ${textValue} already exists!`);
                            return;
                        }
                    } else {
                        player.send(`Must provide a new area name!`);
                        return;
                    }
                    break;
                case "namedisplay":
                    if (isValidString(textValue)) {
                        area.nameDisplay = textValue;
                    } else {
                        player.send(`Must provide a new area display name!`);
                        return;
                    }
                    break;
                case 'setsymbol':
                    area.blankSymbol = textValue;
                    break;
                default:
                    player.send(`Usage: editarea <description | name | namedisplay | setsymbol>`);
                    return;
            }
            player.workingArea.changed = true;
        } else {
            player.send(`Usage: editarea <description | name | namedisplay | setsymbol>`);
        }
    },

    /**
     * Set the working area for the player.
     * @param {object} player - The player object.
     * @param {array} data - The command arguments.
     */
    saveArea(player, data) {
        if (player.workingArea) {
            try {
                player.workingArea.save(player, AREAS_DIR);
            } catch (error) {
                player.send(`Failed to save area!`);
                console.error(error);
            }
        } else {
            player.send(`Must set a working area first!`);
        }
    },

    /**
     * Set the working area for the player.
     * @param {object} player - The player object.
     * @param {array} data - The command arguments.
     */
    setWorkingArea(player, data) {
        const [workAreaName] = data;
        if (isValidString(workAreaName)) {
            if (AreaModule.areaList.has(workAreaName?.toLowerCase())) {
                player.workingArea = AreaModule.areaList.get(workAreaName?.toLowerCase());
                player.send(`Working area set to ${workAreaName}.`);
            } else {
                player.send(`Area ${workAreaName} doesn't exist!`);
            }
        } else {
            player.send(`Usage: workarea areaname`);
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

        await exit.close(player);
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

        await exit.open(player);
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

        await exit.unlock(player);
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

        await exit.lock(player);
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
                    player.currentX = parseInt(x);
                    player.currentY = parseInt(y);
                    player.currentZ = parseInt(z);
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

    /**
     * Execute the "north" command.
     * @param {object} player - The player object.
     * @param {array} args - The command arguments.
     */
    executeNorth(player, args) {
        AreaModule.movePlayer(player, Exit.ExitDirections.North);
    },

    /**
     * Execute the "south" command.
     * @param {object} player - The player object.
     * @param {array} args - The command arguments.
     */
    executeSouth(player, args) {
        AreaModule.movePlayer(player, Exit.ExitDirections.South);
    },

    /**
     * Execute the "east" command.
     * @param {object} player - The player object.
     * @param {array} args - The command arguments.
     */
    executeEast(player, args) {
        AreaModule.movePlayer(player, Exit.ExitDirections.East);
    },

    /**
     * Execute the "west" command.
     * @param {object} player - The player object.
     * @param {array} args - The command arguments.
     */
    executeWest(player, args) {
        AreaModule.movePlayer(player, Exit.ExitDirections.West);
    },

    /**
     * Execute the "northeast" command.
     * @param {object} player - The player object.
     * @param {array} args - The command arguments.
     */
    executeNorthEast(player, args) {
        AreaModule.movePlayer(player, Exit.ExitDirections.NorthEast);
    },

    /**
     * Execute the "northwest" command.
     * @param {object} player - The player object.
     * @param {array} args - The command arguments.
     */
    executeNorthWest(player, args) {
        AreaModule.movePlayer(player, Exit.ExitDirections.NorthWest);
    },

    /**
     * Execute the "southeast" command.
     * @param {object} player - The player object.
     * @param {array} args - The command arguments.
     */
    executeSouthEast(player, args) {
        AreaModule.movePlayer(player, Exit.ExitDirections.SouthEast);
    },

    /**
     * Execute the "southwest" command.
     * @param {object} player - The player object.
     * @param {array} args - The command arguments.
     */
    executeSouthWest(player, args) {
        AreaModule.movePlayer(player, Exit.ExitDirections.SouthWest);
    },

    /**
     * Execute the "up" command.
     * @param {object} player - The player object.
     * @param {array} args - The command arguments.
     */
    executeUp(player, args) {
        AreaModule.movePlayer(player, Exit.ExitDirections.Up);
    },

    /**
     * Execute the "down" command.
     * @param {object} player - The player object.
     * @param {array} args - The command arguments.
     */
    executeDown(player, args) {
        AreaModule.movePlayer(player, Exit.ExitDirections.Down);
    },

    /**
     * Create a new section.
     * @param {object} player - The player object.
     * @param {array} data - The command arguments.
     */
    async createSection(player, data) {
        const [sectionName, vSize] = data;
        const foundArea = player.workingArea;

        if (sectionName === undefined || vSize === undefined) {
            player.send(`Usage: createsection name vSize`);
            return;
        }

        if (!foundArea) {
            player.send(`Working area not set!`);
            return;
        }

        const newSection = foundArea.getSectionByName(sectionName);

        if (!newSection) {
            if (isNumber(vSize)) {
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
     * @param {array} data - The command arguments.
     */
    async deleteSection(player, data) {
        const [sectionToDelete] = data;
        const foundArea = player.workingArea;
        if (!foundArea) {
            player.send(`Working area not set!`);
            return;
        }

        if (sectionToDelete !== undefined) {
            const reallyDelete = await player.textEditor.showPrompt(`Really delete section ${sectionToDelete}? yes/no `);

            if (reallyDelete.toLowerCase() === 'y' || reallyDelete.toLowerCase() === 'yes') {
                foundArea.sections.delete(sectionToDelete.toLowerCase());
                player.send(`Section ${sectionToDelete} deleted successfully.`);
            } else {
                player.send(`Section ${sectionToDelete} wasn't deleted.`);
            }
        } else {
            player.send(`Usage: section delete sectionname`);
        }
    },

    /**
     * Edit an existing section.
     * @param {object} player - The player object.
     * @param {array} args - The command arguments.
     */
    async editSection(player, args) {
        const [editWhat, ...data] = args;
        const foundArea = player.workingArea;

        if (!foundArea) {
            player.send(`Working area not set!`);
            return;
        }

        const foundSection = player.workingSection;

        if (!foundSection) {
            player.send(`Working section not set!`);
            return;
        }

        if (editWhat !== undefined) {
            switch (editWhat.toLowerCase()) {
                case 'description':
                    const description = await player.textEditor.startEditing(foundSection.description);
                    foundSection.description = description;
                    break;
                case 'maxreset':
                    const [maxResetStr] = data;
                    const maxReset = parseInt(maxResetStr);
                    if (maxReset > foundSection?.minReset ?? 0) {
                        foundSection.maxReset = maxReset;
                        foundArea.changed = true;
                        player.send(`maxReset updated successfully.`);
                    } else {
                        player.send(`maxReset must be greater than ${foundSection?.minReset ?? 0}!`);
                        return;
                    }
                    break;
                case 'minreset':
                    const [minResetStr] = data;
                    const minReset = parseInt(minResetStr);
                    if (minReset >= 0) {
                        foundSection.minReset = minReset;
                        foundArea.changed = true;
                        player.send(`minReset updated successfully.`);
                    } else {
                        player.send(`minReset must be greater than or equal to 0!`);
                        return;
                    }
                    break;
                case 'name':
                    const newName = data.join(' ').trim();
                    const oldName = foundSection.name;
                    if (newName && newName.length !== 0) {
                        if (!foundArea.getSectionByName(newName)) {
                            foundSection.name = newName;
                            foundArea.sections.delete(oldName.toLowerCase());
                            foundArea.sections.set(newName.toLowerCase(), foundSection);
                            foundArea.changed = true;
                            player.send(`Section renamed successfully.`);
                        } else {
                            player.send(`Section ${newName} already exists!`);
                            return;
                        }
                    } else {
                        player.send(`Name cannot be blank!`);
                        return;
                    }
                    break;
                case 'resetmsg':
                    const [action] = data;

                    switch (action?.toLowerCase()) {
                        case 'add':
                            const msg = await player.textEditor.startEditing('');
                            if (msg && msg.length !== 0) {
                                foundSection.addResetMsg(msg);
                                player.send(`Message added: "${msg}"`);
                                foundArea.changed = true;
                            } else {
                                player.send(`Message cannot be blank!`);
                                return;
                            }
                            break;
                        case 'remove':
                            const indexToRemove = parseInt(msg, 10);
                            if (!isNaN(indexToRemove) && indexToRemove >= 0 && indexToRemove < foundSection.resetMessages.length) {
                                const removedMsg = foundSection.resetMessages.splice(indexToRemove, 1);
                                player.send(`Removed message: "${removedMsg}"`);
                                foundArea.changed = true;
                            } else {
                                player.send(`Invalid index!`);
                                return;
                            }
                            break;
                        case 'show':
                            if (!foundSection.resetMessages || foundSection.resetMessages.length === 0) {
                                player.send(`No reset messages available.`);
                            } else {
                                const messagesList = foundSection.resetMessages
                                    .map((message, index) => `${index}: ${message}`)
                                    .join('\n');
                                player.send(`Reset Messages:\n${messagesList}`);
                            }
                            break;
                        default:
                            player.send(`Invalid action for resetmsg. Use add, remove, or show.`);
                            break;
                    }
                    break;
                case 'togglereset':
                    if (foundSection.maxReset && foundSection.minReset) {
                        foundSection.resetEnabled = !foundSection.resetEnabled;
                    } else {
                        player.send(`Must set maxReset and minReset first!`);
                        return;
                    }
                    break;
                case 'vsize':
                    const [vSizeStr] = data;
                    const vSize = parseInt(vSizeStr);
                    if (vSize >= foundSection.vSize) {
                        foundSection.vSize = vSize;
                        foundArea.changed = true;
                        player.send(`vSize updated successfully.`);
                    } else {
                        player.send(`vSize must be greater than ${foundSection.vSize}!`);
                        return;
                    }
                    break;
                default:
                    player.send(`Usage: editsection <maxreset | minreset | name | vsize> [value]`);
                    player.send(`Usage: editsection resetmsg <add | remove | show> [value]`);
                    return;
            }

            player.send(`Section ${foundSection.name} in area ${foundArea.name} updated successully!`);
        } else {
            player.send(`Usage: editsection <maxreset | minreset | name | vsize> [value]`);
            player.send(`Usage: editsection resetmsg <add | remove | show> [value]`);
        }
    },

    /**
     * Set the working section for the player.
     * @param {object} player - The player object.
     * @param {array} data - The command arguments.
     */
    setWorkingSection(player, data) {
        const [workSection] = data;
        const foundArea = player.workingArea;
        if (!foundArea) {
            player.send(`Working area not set!`);
            return;
        }

        if (foundArea.sections.has(workSection.toLowerCase())) {
            player.workingSection = foundArea.sections.get(workSection.toLowerCase());
            player.send(`Working section set to ${workSection}.`);
        } else {
            player.send(`Section ${workSection} doesn't exist!`);
        }
    },

    /**
     * Create a new room.
     * @param {object} player - The player object.
     * @param {array} data - The command arguments.
     */
    createRoom(player, data) {
        const [x, y, z] = data;
        const foundArea = player.workingArea;
        const foundSection = player.workingSection;

        if (!foundArea) {
            player.send(`Working area not set!`);
            return;
        }

        if (!foundSection) {
            player.send(`Working section not set!`);
            return;
        }

        if (x !== undefined && y !== undefined && z !== undefined) {
            const foundRoom = foundSection.getRoomByCoordinates(x, y, z);
            if (!foundRoom) {
                foundSection.addRoom(player, foundArea, foundSection, x, y, z);
            } else {
                player.send(`Room already exists at ${x}, ${y}, ${z}!`);
            }
        } else {
            player.send(`Usage: createroom x y z`);
        }
    },

    /**
     * Delete an existing room.
     * @param {object} player - The player object.
     * @param {array} data - The command arguments.
     */
    async deleteRoom(player, data) {
        const [x, y, z] = data;
        const foundArea = player.workingArea;
        const foundSection = player.workingSection;

        if (!foundArea) {
            player.send(`Working area not set!`);
            return;
        }

        if (!foundSection) {
            player.send(`Working section not set!`);
            return;
        }

        if (x !== undefined && y !== undefined && z !== undefined) {
            const reallyDelete = await player.textEditor.showPrompt(`Really delete room ${x}, ${y}, ${z} from ${foundArea.name}:${foundSection.name}? yes/no `);

            if (reallyDelete.toLowerCase() === 'y' || reallyDelete.toLowerCase() === 'yes') {
                foundSection.deleteRoom(player, x, y, z);
            } else {
                player.send(`Room ${x}, ${y}, ${z} wasn't deleted.`);
            }
        } else {
            player.send(`Usage: deleteroom x y z`);
        }
    },

    /**
     * Edit an existing room.
     * @param {object} player - The player object.
     * @param {array} args - The command arguments.
     */
    async editRoom(player, args) {
        let room = player.currentRoom;
        const foundArea = player.workingArea;
        const foundSection = player.workingSection;

        if (!foundArea) {
            player.send(`Working area not set!`);
            return;
        }

        if (!foundSection) {
            player.send(`Working section not set!`);
            return;
        }

        if (fromRoom.area === foundArea && foundRoom.section === foundSection) {
            const [editCmd, x, y, z, ...values] = args;

            if (editCmd) {
                if (!isNumber(x) || !isNumber(y) || !isNumber(z)) {
                    await AreaModule.editRoomProperties(player, room, args);
                } else {
                    room = foundSection.getRoomByCoordinates(x, y, z);

                    if (room) {
                        const newArgs = [editCmd, ...values];
                        await AreaModule.editRoomProperties(player, room, newArgs);
                    } else {
                        player.send(`Room doesn't exist!`);
                    }
                }
            } else {
                player.send(`Usage: editroom <description | flags | name | script | symbol> {x y z} [...values]`);
                player.send(`x y and z are optional. Used for editing a room without being in it.`);
            }
        } else {
            player.send(`Room is in area ${fromRoom.area.name} section ${fromRoom.section.name}`);
            player.send(`Not in working area ${foundArea.name} working section ${foundSection.name}, exit not added!`);
        }
    },

    /**
     * Edits the properties or scripts of an exit based on user input.
     * @param {Player} player - The player performing the edit.
     * @param {Array<string>} args - Arguments provided by the player which include the exit direction, the type of edit, and additional parameters.
     * @async
     * @returns {Promise<void>} Nothing is returned, but messages are sent to the player based on the outcome of the operation.
     */
    async editExit(player, args) {
        const [editDirection, editOption, ...editValues] = args;
        const foundArea = player.workingArea;
        const foundSection = player.workingSection;

        if (!foundArea) {
            player.send(`Working area not set!`);
            return;
        }

        if (!foundSection) {
            player.send(`Working section not set!`);
            return;
        }

        if (fromRoom.area === foundArea && fromRoom.section === foundSection) {
            if (!editDirection || !editOption) {
                player.send(`Usage: editexit [direction] <script | state> <add | edit | remove> [...values]`);
                return;
            }

            const strToExit = Exit.stringToExit(editDirection);
            if (strToExit === null) {
                player.send("Invalid exit direction provided.");
                return;
            }

            const fromRoom = player.currentRoom;
            const editExit = fromRoom.getExitByDirection(strToExit);
            if (!editExit) {
                player.send("No exit found in the specified direction.");
                return;
            }

            switch (editOption.toLowerCase()) {
                case 'script':
                    await AreaModule.editExitScript(player, editExit, editValues);
                    break;
                case 'state':
                    AreaModule.editExitState(player, editExit, editValues);
                    break;
                default:
                    player.send(`Usage: editexit [direction] <script | state> <add | edit | remove> [...values]`);
                    break;
            }
        } else {
            player.send(`Room is in area ${fromRoom.area.name} section ${fromRoom.section.name}`);
            player.send(`Not in working area ${foundArea.name} working section ${foundSection.name}, exit not added!`);
        }
    },

    /**
     * Handles editing scripts associated with an exit.
     * @param {Player} player - The player who is editing the exit's script.
     * @param {Exit} exit - The exit object being edited.
     * @param {Array<string>} editValues - Additional arguments including the command ('add', 'edit', 'remove'), the event name, and potentially the script content to edit.
     * @async
     * @returns {Promise<void>} The function sends messages to the player based on the result of the script editing operation.
     */
    async editExitScript(player, exit, editValues) {
        const [command, onEvent] = editValues;
        if (!command) {
            player.send(`Usage: editexit ${exit.direction} script <add | edit | remove> [event]`);
            return;
        }
        if (!onEvent) {
            player.send(`Usage: editexit ${exit.direction} script ${command} [event]`);
        }

        const eventName = onEvent.toLowerCase();
        if (!exit.progs) exit.progs = {};

        switch (command.toLowerCase()) {
            case 'add':
                if (exit.progs[eventName]) {
                    player.send(`${onEvent} already exists.`);
                    return;
                }
                const newScript = await player.textEditor.startEditing('');
                if (newScript === null || newScript.trim() === '') {
                    player.send("Script creation canceled or empty script provided.");
                    return;
                }
                exit.progs[eventName] = newScript;
                player.send(`${onEvent} added successfully.`);
                break;
            case 'edit':
                if (!exit.progs[eventName]) {
                    player.send(`No existing script for ${onEvent} to edit.`);
                    return;
                }
                const updatedScript = await player.textEditor.startEditing(exit.progs[eventName]);
                if (newScript === null || updatedScript.trim() === '') {
                    player.send("Script editing canceled or empty script provided.");
                    return;
                }
                exit.progs[eventName] = updatedScript;
                player.send(`${onEvent} edited successfully.`);
                break;
            case 'remove':
                if (!exit.progs[eventName]) {
                    player.send(`No existing script for ${onEvent} to remove.`);
                    return;
                }
                delete exit.progs[eventName];
                player.send(`${onEvent} removed successfully.`);
                break;
            default:
                player.send(`Usage: editexit ${exit.direction} script <add | edit | remove> [event]`);
                break;
        }
    },

    /**
     * Manages state changes to an exit, including adding, removing, saving, or displaying the state.
     * @param {Player} player - The player making state changes to the exit.
     * @param {Exit} exit - The exit object whose state is being modified.
     * @param {Array<string>} editValues - Commands and parameters for state management such as 'add', 'remove', 'save', 'showstate', or 'showdefaultstate'.
     * @returns {void} Sends feedback to the player about the outcome of the state change operations.
     */
    async editExitState(player, exit, editValues) {
        const [action, ...states] = editValues;
        if (!action) {
            player.send("Usage: editexit state <add | defaults | remove | save | setdefault | show>");
            return;
        }

        switch (action.toLowerCase()) {
            case 'add':
            case 'remove':
                states.forEach(state => {
                    const actualState = Exit.stringToExitState(state);
                    if (actualState === null) {
                        player.send(`Invalid state: ${state}`);
                        return;
                    }
                    action === 'add' ? exit.addState(actualState) : exit.removeState(actualState);
                });
                player.send(`State(s) ${action === 'add' ? 'added' : 'removed'} successfully.`);
                break;
            case 'save':
                exit.saveState();
                player.send("State saved successfully.");
                break;
            case "setdefault":
                await AreaModule.saveRoomExitState(player, exit);
                break;
            case 'show':
                player.send(exit.currentState.join(', '));
                break;
            case 'defaults':
                player.send(exit.initialState.join(', '));
                break;
            default:
                player.send("Usage: editexit state <add | defaults | remove | save | setdefault | show>");
                break;
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

        if (editCmd !== undefined && editCmd !== "") {
            const value = values?.join(' ');
            let textValue = value;
            switch (editCmd?.toLowerCase()) {
                case "description":
                    textValue = await player.textEditor.startEditing(textValue.length === 0 ? room.description : textValue);
                    if (textValue === null) {
                        player.send(`Edit canceled`);
                        return;
                    }
                    room.description = textValue;
                    break;
                case "flags":
                    const [action, ...flags] = values;
                    if (!action) {
                        player.send(`Usage: editroom flags <add | check | defaults | remove> [flags]`);
                        return;
                    }
                    switch (action.toLowerCase()) {
                        case "add":
                            if (flags.length > 0) {
                                room.currentState.flags.add(...flags);
                            } else {
                                player.send(`Valid flags:`);
                                player.send(RoomFlags.getFlagsArray().join(', '));
                                return;
                            }
                            break;
                        case "check":
                            player.send(`Current room flags:`);
                            player.send(room.currentState.flags.current);
                            return;
                        case "defaults":
                            player.send(`Default room flags:`);
                            player.send(room.defaultState.flags.current);
                            return;
                        case "remove":
                            room.currentState.flags.remove(...flags);
                            break;
                    }
                    break;
                case "name":
                    room.name = textValue;
                    break;
                case "setdefault":
                    await AreaModule.saveRoomState(player, room);
                    break;
                case "script":
                    await AreaModule.editRoomScripts(player, values)
                    break;
                case 'symbol':
                    player.currentRoom.symbol = textValue;
                    break;
                default:
                    player.send(`Usage: editroom <description | flags | name | script | setdefault |symbol> {x y z} [...values]`);
                    player.send(`x y and z are optional. Used for editing a room without being in it.`);
                    return;
            }
            player.send(`Room updated successfully!`);
        } else {
            player.send(`Usage: editroom <description | flags | name | script | setdefualt | symbol> {x y z} [...values]`);
            player.send(`x y and z are optional. Used for editing a room without being in it.`);
        }
    },

    /**
     * Handles the editing of room scripts.
     * @param {object} player - The player object.
     * @param {array} args - The command arguments.
     */
    async editRoomScripts(player, args) {
        const [command, onEvent] = args;
        if (!command) {
            player.send(`Usage: editroom script <add | edit | remove> [event]`);
            return;
        }
        if (!onEvent) {
            player.send(`Usage: editroom script ${command} [event]`);
        }

        const eventName = onEvent.toLowerCase();
        if (!player.currentRoom.progs) player.currentRoom.progs = {};

        switch (command.toLowerCase()) {
            case 'add':
                if (player.currentRoom.progs[eventName]) {
                    player.send(`${onEvent} already exists.`);
                    return;
                }
                const newScript = await player.textEditor.startEditing('');
                if (newScript === null || newScript.trim() === '') {
                    player.send("Script creation canceled or empty script provided.");
                    return;
                }
                player.currentRoom.progs[eventName] = newScript;
                player.send(`${onEvent} added successfully.`);
                break;
            case 'edit':
                if (!player.currentRoom.progs[eventName]) {
                    player.send(`No existing script for ${onEvent} to edit.`);
                    return;
                }
                const updatedScript = await player.textEditor.startEditing(player.currentRoom.progs[eventName]);
                if (newScript === null || updatedScript.trim() === '') {
                    player.send("Script editing canceled or empty script provided.");
                    return;
                }
                player.currentRoom.progs[eventName] = updatedScript;
                player.send(`${onEvent} edited successfully.`);
                break;
            case 'remove':
                if (!player.currentRoom.progs[eventName]) {
                    player.send(`No existing script for ${onEvent} to remove.`);
                    return;
                }
                delete player.currentRoom.progs[eventName];
                player.send(`${onEvent} removed successfully.`);
                break;
            default:
                player.send(`Usage: editroom script <add | edit | remove> [event]`);
                break;
        }
    },

    /**
     * Add an exit to the current room.
     * @param {object} player - The player object.
     * @param {array} args - The command arguments.
     */
    addRoomExit(player, args) {
        const [direction] = args;
        const currentRoom = player.currentRoom;
        const foundArea = player.workingArea;
        const foundSection = player.workingSection;

        if (!foundArea) {
            player.send(`Working area not set!`);
            return;
        }

        if (!foundSection) {
            player.send(`Working section not set!`);
            return;
        }

        if (currentRoom.area === foundArea && currentRoom.section === foundSection) {
            if (direction !== undefined) {
                player.currentRoom.addExit(player, player.currentRoom.area, player.currentRoom.section, direction);
            } else {
                player.send(`Usage: addexit direction`);
            }
        } else {
            player.send(`Room is in area ${currentRoom.area.name} section ${currentRoom.section.name}`);
            player.send(`Not in working area ${foundArea.name} working section ${foundSection.name}, exit not added!`);
        }
    },

    /**
     * Add a teleport exit to the current room.
     * @param {object} player - The player object.
     * @param {array} args - The command arguments.
     */
    addTeleportExit(player, args) {
        const [toArea, toSection, toX, toY, toZ, toDirection] = args;
        const fromRoom = player.currentRoom;
        const foundArea = player.workingArea;
        const foundSection = player.workingSection;

        if (!foundArea) {
            player.send(`Working area not set!`);
            return;
        }

        if (!foundSection) {
            player.send(`Working section not set!`);
            return;
        }

        if (fromRoom.area === foundArea && fromRoom.section === foundSection) {
            if (toArea !== undefined && toSection !== undefined && toX !== undefined && toY !== undefined && toZ !== undefined && toDirection !== undefined) {
                if (!isNumber(toX) || !isNumber(toY) || !isNumber(toZ)) {
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
        } else {
            player.send(`Room is in area ${fromRoom.area.name} section ${fromRoom.section.name}`);
            player.send(`Not in working area ${foundArea.name} working section ${foundSection.name}, exit not added!`);
        }
    },

    /**
     * Remove an exit from the current room.
     * @param {object} player - The player object.
     * @param {array} args - The command arguments.
     */
    removeRoomExit(player, args) {
        const [direction] = args;
        const fromRoom = player.currentRoom;
        const foundArea = player.workingArea;
        const foundSection = player.workingSection;

        if (!foundArea) {
            player.send(`Working area not set!`);
            return;
        }

        if (!foundSection) {
            player.send(`Working section not set!`);
            return;
        }

        if (fromRoom.area === foundArea && fromRoom.section === foundSection) {
            if (direction !== undefined) {
                const exit = fromRoom.getExitByDirection(Exit.stringToExit(direction));

                if (exit) {
                    fromRoom.removeExit(player, direction, exit);
                } else {
                    player.send(`Exit not found in that direction!`);
                }
            } else {
                player.send(`Usage: room removeexit direction`);
            }
        } else {
            player.send(`Room is in area ${fromRoom.area.name} section ${fromRoom.section.name}`);
            player.send(`Not in working area ${foundArea.name} working section ${foundSection.name}, exit not added!`);
        }
    },

    /**
     * Save the state of a room exit.
     * @param {object} player - The player object.
     * @param {Exit} exit - The exit object.
     */
    async saveRoomExitState(player, exit) {
        const reallyOverwrite = await player.textEditor.showPrompt(`Overwrite existing exit state? yes/no `);

        if (reallyOverwrite.toLowerCase() === 'y' || reallyOverwrite.toLowerCase() === 'yes') {
            exit.saveState();
            AreaModule.mudServer.emit('roomExitStateSaved', player, player.currentRoom, exit);
            player.send(`Room exit state overwritten successfully.`);
        } else {
            player.send(`Room exit state wasn't overwritten.`);
        }
    },

    /**
     * Save the state of a room.
     * @param {object} player - The player object.
     * @param {Room} room - The room object.
     */
    async saveRoomState(player, room) {
        const reallyOverwrite = await player.textEditor.showPrompt(`Overwrite existing room state? yes/no `);

        if (reallyOverwrite.toLowerCase() === 'y' || reallyOverwrite.toLowerCase() === 'yes') {
            room.defaultState = room.currentState;
            AreaModule.mudServer.emit('roomStateSaved', player,);
            player.send(`Room state overwritten successfully.`);
        } else {
            player.send(`Room state wasn't overwritten.`);
        }
    },
};

module.exports = AreaModule;
