// Importing necessary modules
const fs = require('fs');
const path = require('path');
const { isNumber } = require('../Utils/helpers.js');
const Area = require('./AreaModule/Area.js');
const Exit = require('./AreaModule/Exit.js');
const Room = require('./AreaModule/Room.js');
const Section = require('./AreaModule/Section.js');

// Define the directory where areas are stored
const AREAS_DIR = path.join(__dirname, '../areas');
const MUD_MAP_SIZE_Y = 6; // Grid X size
const MUD_MAP_SIZE_X = 10; // Grid Y size
const ROOM_TEMPLATE = path.join(__dirname, '../system', 'templates', 'room.template');

// area module
const AreaModule = {
    name: "Area",
    areaList: new Map(),
    roomTemplate: [],
    startArea: 'Start',
    startSection: 'Start',
    startX: 0,
    startY: 0,
    startZ: 0,

    // Method to replace template data with helpfile information
    builtRoomTemplate: (player, area, section, room) => {
        let roomTemplate = '';
        let output = '';
        //const mapPlaceholder = '\r\n'.repeat(MUD_MAP_SIZE_Y);
        const mapStart = AreaModule.roomTemplate.findIndex(entry => entry.includes('%map'));

        AreaModule.roomTemplate.forEach(line => {
            const parsedData = line.replace('%roomname', room?.name)
                .replace('%description', room?.description)
                .replace('%areaname', area?.nameDisplay)
                .replace('%sectionname', section?.name)
                .replace('%updatedate', room?.lastUpdate)
                .replace('%map', '');
            roomTemplate += parsedData + "\r\n";
        });

        const dataSplit = roomTemplate.split('\r\n');
        const map = AreaModule.displayMap(player);
        const mapSplit = map?.split('\r\n');
        let x = 0;
        let y = mapStart;
        for (i = 0; i < mapStart; i++) {
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

        return output;
    },

    displayMap: (player) => {
        const area = AreaModule.getAreaByName(player.currentArea);
        const section = area.getSectionByName(player.currentSection);
        const currentRoom = section.getRoomByCoordinates(player.currentX, player.currentY, player.currentZ);

        if (!currentRoom) {
            player.send("Error: Current room not found.");
            return;
        }

        const roomMap = new Map();
        const queue = [{ room: currentRoom, x: parseInt(player.currentX), y: parseInt(player.currentY), z: parseInt(player.currentZ) }]; // Include current layer in the queue items

        while (queue.length > 0) {
            const { room, x, y, z } = queue.shift();
            const symbol = room === currentRoom ? "&g@&~" : "&O#&~"; // Current room symbol

            if (!roomMap.has(x)) {
                roomMap.set(x, new Map());
            }
            roomMap.get(x).set(y, symbol);

            // Add neighboring rooms to the queue
            room?.exits?.forEach((exitRoom, exitDirection) => {
                let newX = x;
                let newY = y;
                let newZ = z;

                switch (Exit.stringToExit(exitDirection)) {
                    case Exit.ExitDirections.Down:
                        newZ--;
                        break;
                    case Exit.ExitDirections.East:
                        newX++;
                        break;
                    case Exit.ExitDirections.North:
                        newY++;
                        break;
                    case Exit.ExitDirections.NorthEast:
                        newY++;
                        newX++;
                        break;
                    case Exit.ExitDirections.NorthWest:
                        newY++;
                        newX--;
                        break;
                    case Exit.ExitDirections.South:
                        newY--;
                        break;
                    case Exit.ExitDirections.SouthEast:
                        newY--;
                        newX++;
                        break;
                    case Exit.ExitDirections.SouthWest:
                        newY--;
                        newX--;
                        break;
                    case Exit.ExitDirections.West:
                        newX--;
                        break;
                    case Exit.ExitDirections.Up:
                        newZ++;
                        break;
                }

                // Ensure the neighboring room is not already mapped
                if (!roomMap.has(newX) || !roomMap.get(newX).has(newY)) {
                    // Check if the neighboring room is on the same or adjacent layer as the player
                    if (Math.abs(newZ - player.currentZ) <= 1) {
                        queue.push({ room: AreaModule.exitToRoom(exitRoom), x: parseInt(newX), y: parseInt(newY), z: parseInt(newZ) });
                    }
                }
            });
        }

        // Convert the room map to a string for display
        let mapString = "";
        const minY = player.currentY - Math.floor(MUD_MAP_SIZE_Y / 2);
        const maxY = player.currentY + Math.floor(MUD_MAP_SIZE_Y / 2);
        const minX = player.currentX - Math.floor(MUD_MAP_SIZE_X / 2);
        const maxX = player.currentX + Math.floor(MUD_MAP_SIZE_X / 2);

        for (let y = maxY; y >= minY; y--) {
            for (let x = minX; x <= maxX; x++) {
                if (roomMap.has(x) && roomMap.get(x).has(y)) {
                    mapString += roomMap.get(x).get(y);
                } else {
                    mapString += "~"; // Empty space for unmapped area
                }
            }
            mapString += "\r\n"; // Move to the next row
        }

        return mapString;
    },

    // Method to edit an existing area
    editArea: async function (player, area, args) {
        // Extract command arguments
        const [editCmd, ...values] = args;
        const editKeys = ['description', 'name', 'namedisplay'];
        const oldName = area.name;
        if (editCmd !== undefined && editCmd != "") {
            const value = values?.join(' ');
            let textValue = '';
            if (editKeys.includes(editCmd.toLowerCase())) {
                if (value == '' || value == null) {
                    textValue = await player.textEditor.startEditing(area.propertyByString(editCmd));
                } else {
                    textValue = value;
                }

                if (textValue != null) {
                    switch (editCmd?.toLowerCase()) {
                        case "description":
                            area.description = textValue;
                            break;
                        case "name":
                            if (!AreaModule.areaList.has(textValue.toLowerCase())) {
                                area.name = textValue;
                                area.sections?.forEach(section => {
                                    section.area = area.name;
                                    section.rooms?.forEach(room => {
                                        room.area = area.name;
                                        room?.exits(exit => {
                                            exit.area = area.name;
                                        });
                                    });
                                });
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
                    return;
                }
            } else {
                player.send(`Usage: area edit <description | name | namedisplay>`);
            }
        } else {
            player.send(`Usage: area edit <description | name | namedisplay>`);
        }
    },

    // Method to edit an existing room
    editRoom: async function (player, room, args) {
        // Extract command arguments
        const [editCmd, ...values] = args;
        const editKeys = ['description', 'name'];
        if (editCmd !== undefined && editCmd != "") {
            const value = values?.join(' ');
            let textValue = '';
            if (editKeys.includes(editCmd.toLowerCase())) {
                if (value == '' || value == null) {
                    textValue = await player.textEditor.startEditing(room.propertyByString(editCmd));
                } else {
                    textValue = value;
                }

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
                    return;
                }
            } else {
                player.send(`Usage: room edit <description | name>`);
            }
        } else {
            player.send(`Usage: room edit <description | name>`);
        }
    },

    executeLook(player) {
        const area = AreaModule.getAreaByName(player.currentArea);
        if (area == null) return;
        const section = area.getSectionByName(player.currentSection);
        if (section == null) return;
        const room = section.getRoomByCoordinates(player.currentX, player.currentY, player.currentZ);

        const roomTemplate = AreaModule.builtRoomTemplate(player, area, section, room)?.split('\r\n');
        roomTemplate.forEach(string => {
            player.send(`${string}`);
        });
    },

    async executeArea(player, args) {
        const [cmdName, ...data] = args;
        const foundArea = AreaModule.getAreaByName(player.workingArea);

        if (foundArea != null || cmdName.toLowerCase() == 'create' || cmdName.toLowerCase() == 'work') {
            switch (cmdName?.toLowerCase()) {
                case 'create':
                    const [areaName] = data;
                    if (foundArea == null && !this.areaList.has(areaName.toLowerCase())) {
                        this.areaList.set(areaName.toLowerCase(), new AreaModule.Area(areaName));
                        player.send(`Area ${areaName} added!`);
                    } else {
                        player.send(`Area ${areaName} already exist!`);
                    }
                    break;
                case 'delete':
                    const [areaToDelete, fromMemory] = data;
                    const deleteArea = AreaModule.getAreaByName(areaToDelete);
                    if (areaToDelete != undefined && fromMemory != undefined) {
                        if (player.hasCommand('area delete') || player.modLevel >= 80) {
                            if (deleteArea != null) {
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
                    break;
                case 'edit':
                    await this.editArea(player, foundArea, data);
                    break;
                case 'save':
                    foundArea.save(player, AREAS_DIR);
                    break;
                case 'work':
                    const [workAreaName] = data;
                    if (AreaModule.areaList.has(workAreaName.toLowerCase())) {
                        player.workingArea = workAreaName;
                        player.send(`Working area set to ${workAreaName}.`);
                    } else {
                        player.send(`Area ${workAreaName} doesn't exist!`);
                    }
                    break;
                default:
                    player.send(`Usage: area <create areaname | delete | edit | save | work areaname>`);
                    break;
            }
        } else {
            player.send(`Usage: area <create areaname | delete | edit | save | work areaname>`);
        }
    },

    executeDown(player, args) {
        AreaModule.movePlayer(player, Exit.ExitDirections.Down);
    },

    executeEast(player, args) {
        AreaModule.movePlayer(player, Exit.ExitDirections.East);
    },

    executeGoto(player, args) {
        const [areaName, sectionName, x, y, z] = args;

        if (AreaModule.areaList.has(areaName?.toLowerCase())) {
            const foundArea = this.getAreaByName(areaName);
            if (foundArea.sections.has(sectionName?.toLowerCase())) {
                const foundSection = foundArea.getSectionByName(sectionName);
                const room = foundSection?.getRoomByCoordinates(x, y, z);

                if (room != null) {
                    player.currentArea = room.area;
                    player.currentSection = room.section;
                    player.currentX = x;
                    player.currentY = y;
                    player.currentZ = z;
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

    executeNorthEast(player, args) {
        AreaModule.movePlayer(player, Exit.ExitDirections.NorthEast);
    },

    executeNorthWest(player, args) {
        AreaModule.movePlayer(player, Exit.ExitDirections.NorthWest);
    },

    async executeRoom(player, args) {
        const [cmdName, ...data] = args;
        const foundArea = AreaModule.getAreaByName(player.workingArea);
        if (foundArea != null) {
            const foundSection = foundArea.getSectionByName(player.workingSection);
            if (foundSection != null) {
                switch (cmdName?.toLowerCase()) {
                    case 'addexit':
                        const [direction] = data;
                        const currentRoom = foundSection.getRoomByCoordinates(player.currentX, player.currentY, player.currentZ);

                        if (direction !== undefined) {
                            currentRoom.addExit(player, foundArea, foundSection, direction);
                        } else {
                            player.send(`Usage: room addexit direction`);
                        }
                        break;
                    case 'create':
                        const [x, y, z] = data;
                        const foundRoom = foundSection.getRoomByCoordinates(x, y, z);
                        if (x !== undefined) {
                            if (foundRoom == null) {
                                foundSection.addRoom(player, foundArea, foundSection, x, y, z);
                            } else {
                                player.send(`Room already exists at ${x}, ${y}, ${z}!`);
                            }
                        } else {
                            player.send(`Usage: room create x y z`);
                        }
                        break;
                    case 'delete':
                        const [dX, dY, dZ] = data;
                        if (dX != undefined && dY != undefined && dZ != undefined) {
                            if (player.hasCommand('room delete') || player.modLevel >= 80) {
                                const reallyDelete = await player.textEditor.showPrompt(`Really delete room ${dX}, ${dY}, ${dZ}? yes/no `);

                                if (reallyDelete.toLowerCase() == 'y' || reallyDelete.toLowerCase() == 'yes') {
                                    foundSection.deleteRoom(player, dX, dY, dZ);
                                } else {
                                    player.send(`Room ${dX}, ${dY}, ${dZ} wasn't deleted.`);
                                }
                            }
                        } else {
                            player.send(`Usage: room delete x y z`);
                        }
                        break;
                    case 'edit':
                        let room;
                        if (data.length == 1) {
                            room = foundSection.getRoomByCoordinates(player.currentX, player.currentY, player.currentZ);
                            await AreaModule.editRoom(player, room, data);
                        } else {
                            const [editCmd, rX, rY, rZ, ...values] = data;
                            room = foundSection.getRoomByCoordinates(rX, rY, rZ);

                            if (room != null) {
                                const newData = [editCmd, ...values];
                                await AreaModule.editRoom(player, room, newData);
                            } else {
                                player.send(`Room doesn't exist!`);
                            }
                        }
                        break;
                    case 'removeexit':
                        const [removeDirection] = data;
                        const removeFromRoom = foundSection.getRoomByCoordinates(player.currentX, player.currentY, player.currentZ);

                        if (removeDirection !== undefined) {
                            removeFromRoom.removeExit(player, foundArea, foundSection, removeDirection);
                        } else {
                            player.send(`Usage: room removeexit direction`);
                        }
                        break;
                    default:
                        player.send(`Usage: room <addexit direction | create x y z | delete | edit>`);
                        player.send(`Usage: room <addtexit area section x y z direction> - Teleport`);
                        player.send(`Usage: room <removeexit direction> - Teleport`);
                        break;
                }
            } else {
                player.send(`Working section not set!`);
            }
        } else {
            player.send(`Working area not set!`);
        }
    },

    async executeSection(player, args) {
        const [cmdName, ...data] = args;
        const foundArea = AreaModule.getAreaByName(player.workingArea);
        if (foundArea != null) {
            const foundSection = foundArea.getSectionByName(player.workingSection);

            if (foundSection != null || cmdName?.toLowerCase() == "create" || cmdName.toLowerCase() == "work") {
                switch (cmdName?.toLowerCase()) {
                    case 'create':
                        const [sectionName, vSize] = data;
                        const newSection = foundArea.getSectionByName(sectionName);

                        if (newSection == null) {
                            if (isNumber(parseInt(vSize))) {
                                foundArea.addSection(sectionName, parseInt(vSize));
                                player.send(`Section ${sectionName} added successfully!`);
                            } else {
                                player.send(`vSize needs to be a number!`);
                            }
                        } else {
                            player.send(`Section ${sectionName} already exists in ${foundArea.name}!`);
                        }
                        break;
                    case 'delete':
                        const [sectionToDelete] = data;
                        if (sectionToDelete != undefined) {
                            if (player.hasCommand('section delete') || player.modLevel >= 80) {
                                const reallyDelete = await player.textEditor.showPrompt(`Really delete section ${sectionToDelete}? yes/no `);

                                if (reallyDelete.toLowerCase() == 'y' || reallyDelete.toLowerCase() == 'yes') {
                                    area.sections.delete(sectionToDelete);
                                } else {
                                    player.send(`Section ${areaToDelete} wasn't deleted.`);
                                }
                            }
                        } else {
                            player.send(`Usage: section delete sectionname`);
                        }
                        break;
                    case "work":
                        const [workSection] = data;

                        if (foundArea.sections.has(workSection.toLowerCase())) {
                            player.workingSection = workSection;
                            player.send(`Working section set to ${workSection}.`);
                        } else {
                            player.send(`Section ${workSection} doesn't exist!`);
                        }
                        break;
                    default:
                        player.send(`Usage: section <create sectionname size | delete | edit | work sectionname>`);
                        break;
                }
            } else {
                player.send(`Usage: section <create sectionname size | delete | edit | work sectionname>`);
            }
        } else {
            player.send(`Working area not set!`);
        }
    },

    executeSouth(player, args) {
        AreaModule.movePlayer(player, Exit.ExitDirections.South);
    },

    executeSouthEast(player, args) {
        AreaModule.movePlayer(player, Exit.ExitDirections.SouthEast);
    },

    executeSouthWest(player, args) {
        AreaModule.movePlayer(player, Exit.ExitDirections.SouthWest);
    },

    executeWest(player, args) {
        AreaModule.movePlayer(player, Exit.ExitDirections.West);
    },

    executeUp(player, args) {
        AreaModule.movePlayer(player, Exit.ExitDirections.Up);
    },

    exitToRoom(exitRoom) {
        const area = AreaModule.getAreaByName(exitRoom.area);
        const section = area?.getSectionByName(exitRoom.section);
        const room = section?.getRoomByCoordinates(exitRoom.x, exitRoom.y, exitRoom.z);

        return room;
    },

    // Method to find a area by name
    getAreaByName(area) {
        return AreaModule.areaList.get(area?.toLowerCase());
    },

    init: function (mudServer) {
        this.ms = mudServer;

        this.loadAreas();
        this.ms.mudEmitter.on('hotBootAfter', AreaModule.onAfterHotboot);
        this.ms.mudEmitter.on('hotBootBefore', AreaModule.onBeforeHotboot);
        this.ms.mudEmitter.on('playerLoggedIn', AreaModule.onPlayerLoggedIn);
    },

    movePlayer: (player, exitDirection) => {
        const area = AreaModule.getAreaByName(player.currentArea);
        if (!area) {
            player.send("Error Current area not found!");
            return
        }
        const section = area.getSectionByName(player.currentSection);
        if (!section) {
            player.send("Error Current section not found!");
            return
        }
        const currentRoom = section.getRoomByCoordinates(player.currentX, player.currentY, player.currentZ);

        if (!currentRoom) {
            player.send("Error: Current room not found!");
            return;
        }

        const exit = currentRoom.getExitByDirection(exitDirection);

        if (!exit) {
            player.send(`Exit ${exitDirection} not found.`);
            return;
        }

        const { area: newArea, section: newSection, x: newX, y: newY, z: newZ } = exit;

        const toRoom = section.getRoomByCoordinates(newX, newY, newZ);

        if (!toRoom) {
            player.send(`Error: Destination room not found.`);
            return;
        }

        player.currentArea = newArea;
        player.currentSection = newSection;
        player.currentX = newX;
        player.currentY = newY;
        player.currentZ = newZ;

        AreaModule.executeLook(player);
    },

    onAfterHotboot: () => {
        AreaModule.areaList?.forEach(area => {
            updatedArea = new Area();
            updatedSection = new Section();
            updatedRoom = new Room();
            updatedExit = new Exit;
            Object.setPrototypeOf(area, updatedArea.__proto__);
            area.section?.forEach(section => {
                Object.setPrototypeOf(section, updatedSection.__proto__);
                section.rooms?.forEach(room => {
                    Object.setPrototypeOf(room, updatedRoom.__proto__);
                    room.exits?.forEach(exit => {
                        Object.setPrototypeOf(exit, updatedExit.__proto__);
                    });
                });
            });
        });

    },

    onBeforeHotboot: () => {
        // AreaModule.areaList?.forEach(area => {
        //     area.save(player, AREAS_DIR, false);
        // });

        AreaModule.ms.mudEmitter.removeListener('hotBootAfter', AreaModule.onAfterHotboot);
        AreaModule.ms.mudEmitter.removeListener('hotBootBefore', AreaModule.onBeforeHotboot);
        // Remove 'playerLoggedIn' event listener
        AreaModule.ms.mudEmitter.removeListener('playerLoggedIn', AreaModule.onPlayerLoggedIn);
    },

    onPlayerLoggedIn: (player) => {
        if (player.currentArea == undefined || player.currentArea == null) player.currentArea = AreaModule.startArea;
        if (player.currentSection == undefined || player.currentSection == null) player.currentSection = AreaModule.startSection;
        if (player.currentX == undefined || player.currentX == null) player.currentX = AreaModule.startX;
        if (player.currentY == undefined || player.currentY == null) player.currentY = AreaModule.startY;
        if (player.currentZ == undefined || player.currentZ == null) player.currentZ = AreaModule.startZ;
        AreaModule.executeLook(player);
    },

    // Method to load help files from directory
    loadAreas: function () {
        try {
            const dataSync = fs.readFileSync(ROOM_TEMPLATE, 'utf8');
            AreaModule.roomTemplate = dataSync?.split('\r\n');
        } catch (err) {
            console.error('Error reading file synchronously:', err);
        }

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
                    // Restore sections
                    for (const sectionName in areaData.sections) {
                        const sectionData = areaData.sections[sectionName];
                        const section = new Section(sectionData.area, sectionName, sectionData.description, sectionData.vSize);

                        // Restore rooms
                        for (const roomData of sectionData.rooms) {
                            const room = new Room(roomData.area, roomData.section, roomData.name, roomData.description, roomData.x, roomData.y, roomData.z);

                            // Restore exits
                            for (const exitData of roomData.exits) {
                                const exit = new Exit(exitData.area, exitData.section, exitData.x, exitData.y, exitData.z, exitData.direction);
                                room.exits.set(Exit.stringToExit(exit.direction), exit);
                            }

                            section.rooms.set(`${room.x},${room.y},${room.z}`, room);
                        }
                        area.sections.set(sectionName.toLowerCase(), section);
                    }

                    AreaModule.areaList.set(area.name.toLowerCase(), area);
                } catch (err) {
                    console.error(`Error reading or parsing JSON file ${filePath}: ${err.message}`);
                }
            });
        } catch (err) {
            console.error('Error reading directory:', err);
        }
    },
};

module.exports = AreaModule;