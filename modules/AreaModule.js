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
                    mapString += area.blankSymbol + '&~'; // Empty space for unmapped area
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
                    if (areaName !== undefined) {
                        if (foundArea == null && !this.areaList.has(areaName.toLowerCase())) {
                            this.areaList.set(areaName.toLowerCase(), new AreaModule.Area(areaName));
                            player.send(`Area ${areaName} added!`);
                        } else {
                            player.send(`Area ${areaName} already exist!`);
                        }
                    } else {
                        player.send(`Usage: area create areaname`);
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
                case 'setsymbol':
                    foundArea.blankSymbol = data.join(' ');
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

    async executeClose(player, args) {
        const [exitDirection] = args;
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
        const exit = currentRoom.getExitByDirection(Exit.stringToExit(exitDirection));

        if (!exit) {
            player.send(`Exit ${exitDirection} not found.`);
            return;
        }

        await exit.close(player, args);
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
                    case 'addtexit':
                        const [toArea, toSection, toX, toY, toZ, toDirection] = data;
                        const fromRoom = foundSection.getRoomByCoordinates(player.currentX, player.currentY, player.currentZ);

                        if (toArea !== undefined && toSection !== undefined && toX !== undefined && toY !== undefined && toZ !== undefined &&
                            toDirection !== undefined) {
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
                            } else if (sectionTo.name.toLowerCase() !== player.workingSection.toLowerCase()) {
                                player.send(`Section ${sectionTo.name} not set as current work section!`);
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

                            let exitDeleted = false;
                            for (const area of AreaModule?.areaList?.values()) {
                                for (const section of area?.sections?.values()) {
                                    for (const room of section?.rooms?.values()) {
                                        for (const exit of room?.exits?.values()) {
                                            if (exit.isAt(areaTo?.name, sectionTo?.name, toX, toY, toZ)) {
                                                room.removeExit(player, section, exit?.direction, areaTo, sectionTo, toX, toY, toZ);
                                                exitDeleted = true;
                                            }
                                        }
                                        if (exitDeleted) break;
                                    }
                                    if (exitDeleted) break;
                                }
                                if (exitDeleted) break;
                            }

                            if (fromRoom.isAt(areaTo?.name, sectionTo?.name, toX, toY, toZ)) {
                                player.send(`Cannot place exit!`);
                                return;
                            }

                            if (!exitFound) fromRoom.addExit(player, areaTo, sectionTo, toDirection, parseInt(toX), parseInt(toY), parseInt(toZ));
                        } else {
                            player.send(`Usage: room addtexit area section x y z direction`);
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
                    case 'editexit':
                        const [editDirection, editOption, ...editValues] = data;
                        if (editDirection !== undefined && editOption !== undefined) {
                            const strToExit = Exit.stringToExit(editDirection);
                            if (strToExit != null) {
                                const fromRoom = foundSection.getRoomByCoordinates(player.currentX, player.currentY, player.currentZ);
                                const editExit = fromRoom.getExitByDirection(strToExit);
                                if (editExit != null) {
                                    switch (editOption?.toLowerCase()) {
                                        case 'script':
                                            const [command, onEvent] = editValues;
                                            if (command !== undefined && onEvent !== undefined) {
                                                // Ensure progs object exists
                                                if (editExit.progs === undefined) editExit.progs = {};

                                                switch (command.toLowerCase()) {
                                                    case 'add':
                                                        // Check if the script already exists for the event
                                                        if (editExit.progs[onEvent.toLowerCase()]) {
                                                            player.send(`${onEvent} already exists!`);
                                                        } else {
                                                            // Start editing session to create a new script
                                                            const script = await player.textEditor.startEditing('');
                                                            if (script.trim() !== '') { // Ensure the script is not empty
                                                                editExit.progs[onEvent.toLowerCase()] = script;
                                                                player.send(`${onEvent} added successfully.`);
                                                            } else {
                                                                player.send(`Script creation canceled or empty script provided.`);
                                                            }
                                                        }
                                                        break;

                                                    case 'edit':
                                                        // Check if the script exists for editing
                                                        if (editExit.progs[onEvent.toLowerCase()]) {
                                                            const updatedScript = await player.textEditor.startEditing(editExit.progs[onEvent.toLowerCase()]);
                                                            if (updatedScript.trim() !== '') {
                                                                editExit.progs[onEvent.toLowerCase()] = updatedScript;
                                                                player.send(`${onEvent} edited successfully.`);
                                                            } else {
                                                                player.send(`Script editing canceled or empty script provided.`);
                                                            }
                                                        } else {
                                                            player.send(`No existing script for ${onEvent} to edit.`);
                                                        }
                                                        break;

                                                    case 'remove':
                                                        // Check if the script exists to remove
                                                        if (editExit.progs[onEvent.toLowerCase()]) {
                                                            delete editExit.progs[onEvent.toLowerCase()];
                                                            player.send(`${onEvent} removed successfully.`);
                                                        } else {
                                                            player.send(`No existing script for ${onEvent} to remove.`);
                                                        }
                                                        break;

                                                    default:
                                                        player.send(`Usage: room editexit script <add | edit | remove> <event>`);
                                                        break;
                                                }
                                            } else {
                                                player.send(`Usage: room editexit script <add | edit | remove> <event>`);
                                            }
                                            break;
                                        case 'state':
                                            const [action, ...states] = editValues;
                                            if (action !== undefined) {
                                                switch (action.toLowerCase()) {
                                                    case 'add':
                                                        states.forEach(state => {
                                                            const actualState = Exit.stringToExitState(state);
                                                            if (actualState != null) editExit.addState(actualState);
                                                        });
                                                        player.send(`State(s) added successfully.`);
                                                        break;
                                                    case 'remove':
                                                        states.forEach(state => {
                                                            const actualState = Exit.stringToExitState(state);
                                                            if (actualState != null) editExit.removeState(actualState);
                                                        });
                                                        player.send(`State(s) removed successfully.`);
                                                        break;
                                                    case 'save':
                                                        editExit.saveState();
                                                        player.send(`State saved successfully.`);
                                                        break;
                                                    case 'showstate':
                                                        player.send(Exit.exitStateToString(editExit.currentState));
                                                        break;
                                                    case 'showdefaultstate':
                                                        player.send(Exit.exitStateToString(editExit.initialState));
                                                        break;
                                                    default:
                                                        player.send(`Usage: room editexit state <add | remove | save | show>`)
                                                        break;
                                                }
                                            } else {
                                                player.send(`Usage: room editexit state <add | remove | save | show>`)
                                            }
                                            break;
                                    }
                                } else {
                                    player.send(`Exit doesn't exist!`);
                                }
                            } else {
                                player.send('Invalid direction!');
                            }
                        } else {
                            player.send(`Usage: room edittexit direction <script | state>`);
                        }
                        break;
                    case 'removeexit':
                        const [removeDirection] = data;
                        const removeFromRoom = foundSection.getRoomByCoordinates(player.currentX, player.currentY, player.currentZ);

                        if (removeDirection !== undefined) {
                            if (removeFromRoom != null) {
                                const exit = removeFromRoom.getExitByDirection(Exit.stringToExit(removeDirection));
                                const exitArea = AreaModule.getAreaByName(exit.area);
                                const exitSection = exitArea.getSectionByName(exit.section);
                                removeFromRoom.removeExit(player, foundSection, removeDirection, exitArea, exitSection, exit.x, exit.y, exit.z);
                            } else {
                                player.send(`Unable to delete room, exists in another section!`);
                            }
                        } else {
                            player.send(`Usage: room removeexit direction`);
                        }
                        break;
                    default:
                        player.send(`Usage: room <addexit direction | create x y z | delete | edit>`);
                        player.send(`Usage: room <addtexit area section x y z direction> - Teleport`);
                        player.send(`Usage: room <removeexit direction>`);
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
                                    AreaModule.sections.delete(sectionToDelete);
                                } else {
                                    player.send(`Section ${areaToDelete} wasn't deleted.`);
                                }
                            }
                        } else {
                            player.send(`Usage: section delete sectionname`);
                        }
                        break;
                    case 'edit':
                        const [editWhat, ...newValue] = data;

                        if (editWhat !== undefined && newValue !== undefined) {
                            if (foundSection) {
                                if (foundSection[editWhat] != null) {
                                    const newName = newValue.join(' ');

                                    if (editWhat.toLowerCase() === 'name' && newName != '') {
                                        const sectionExist = foundArea.getSectionByName(newName);

                                        if (!sectionExist) {
                                            const oldName = foundSection.name;
                                            foundSection[editWhat] = newName;
                                            foundSection.rooms.forEach(room => {
                                                room.section = newName;
                                                room.exits.forEach(exit => {
                                                    if (exit.section.toLowerCase() == oldName.toLowerCase() &&
                                                        exit.area.toLowerCase() == foundArea.name.toLowerCase()) {
                                                        exit.section = newName;
                                                    }
                                                });
                                            });
                                            foundArea.sections.delete(oldName);
                                            foundArea.sections.set(newName, foundSection);

                                            player.send(`Section renamed successfully.`);
                                        } else {
                                            player.send(`Section ${newName} already exist!`);
                                        }
                                    } else {
                                        player.send(`Name cannot be blank!`);
                                    }
                                } else {
                                    player.send(`Property ${editWhat} doesns't exist!`);
                                }
                            } else {
                                player.send(`Section ${editSection} doesn't exist!`);
                            }
                        } else {
                            player.send(`Usage: section edit <name> value`);
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

    getRoomAt(atArea, atSection, atX, atY, atZ) {
        const area = AreaModule.getAreaByName(atArea);
        if (!area) {
            player.send("Error Current area not found!");
            return;
        }
        const section = area.getSectionByName(atSection);
        if (!section) {
            player.send("Error Current section not found!");
            return;
        }
        const room = section.getRoomByCoordinates(atX, atY, atZ);

        if (!room) {
            player.send("Error: Current room not found!");
            return;
        }

        return room;
    },

    init: function (mudServer) {
        this.mudServer = mudServer;

        this.loadAreas();
        this.mudServer.mudEmitter.on('enteredRoom', AreaModule.onEnteredRoom);
        this.mudServer.mudEmitter.on('hotBootAfter', AreaModule.onAfterHotboot);
        this.mudServer.mudEmitter.on('hotBootBefore', AreaModule.onBeforeHotboot);
        this.mudServer.mudEmitter.on('playerLoggedIn', AreaModule.onPlayerLoggedIn);
        this.mudServer.mudEmitter.on('sendToRoom', AreaModule.onSendToRoom);
    },

    async executeOpen(player, args) {
        const [exitDirection] = args;
        const area = AreaModule.getAreaByName(player.currentArea);
        if (!area) {
            player.send("Error Current area not found!");
            return;
        }
        const section = area.getSectionByName(player.currentSection);
        if (!section) {
            player.send("Error Current section not found!");
            return;
        }
        const currentRoom = section.getRoomByCoordinates(player.currentX, player.currentY, player.currentZ);

        if (!currentRoom) {
            player.send("Error: Current room not found!");
            return;
        }
        const exit = currentRoom.getExitByDirection(Exit.stringToExit(exitDirection));

        if (!exit) {
            player.send(`Exit ${exitDirection} not found.`);
            return;
        }

        await exit.open(player, args);
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

        const exit = currentRoom.getExitByDirection(Exit.stringToExit(exitDirection));

        if (!exit) {
            player.send(`Exit ${exitDirection} not found.`);
            return;
        }

        if (!exit.isOpened()) {
            player.send(`The door is shut!`);
            return;
        }

        const { area: newArea, section: newSection, x: newX, y: newY, z: newZ } = exit;
        let toRoom;

        if (section.name.toLowerCase() === newSection.toLowerCase()) {
            toRoom = section.getRoomByCoordinates(newX, newY, newZ);
        } else {
            const toArea = AreaModule.getAreaByName(newArea);
            const toSection = toArea?.getSectionByName(newSection);
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
        AreaModule.mudServer.mudEmitter.emit('enteredRoom', player, Exit.oppositeExit(exitDirection), toRoom);
        AreaModule.executeLook(player);
    },

    onAfterHotboot: () => {
        AreaModule.areaList?.forEach(area => {
            updatedArea = new Area();
            updatedSection = new Section();
            updatedRoom = new Room();
            updatedExit = new Exit();
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

        AreaModule.mudServer.mudEmitter.removeListener('enteredRoom', AreaModule.onEnteredRoom);
        AreaModule.mudServer.mudEmitter.removeListener('hotBootAfter', AreaModule.onAfterHotboot);
        AreaModule.mudServer.mudEmitter.removeListener('hotBootBefore', AreaModule.onBeforeHotboot);
        // Remove 'playerLoggedIn' event listener
        AreaModule.mudServer.mudEmitter.removeListener('playerLoggedIn', AreaModule.onPlayerLoggedIn);
        AreaModule.mudServer.mudEmitter.removeListener('sendToRoom', AreaModule.onSendToRoom);
    },

    onEnteredRoom(player, enterDirection, room) {
        let message = '';
        if (player.inRoom(room)) {
            if (enterDirection != Exit.ExitDirections.None) message = `${player.username} entered the room from the ${enterDirection}.`;
            else message = `${player.username} entered the room.`;

            global.mudEmitter.emit('sendToRoom', player, message, [player.username], message);
        }
    },

    onPlayerLoggedIn: (player) => {
        if (player.currentArea == undefined || player.currentArea == null) player.currentArea = AreaModule.startArea;
        if (player.currentSection == undefined || player.currentSection == null) player.currentSection = AreaModule.startSection;
        if (player.currentX == undefined || player.currentX == null) player.currentX = AreaModule.startX;
        if (player.currentY == undefined || player.currentY == null) player.currentY = AreaModule.startY;
        if (player.currentZ == undefined || player.currentZ == null) player.currentZ = AreaModule.startZ;

        AreaModule.mudServer.mudEmitter.emit('enteredRoom', player, Exit.ExitDirections.None, AreaModule.getRoomAt(player.currentArea, player.currentSection, 
                                                                                                                    player.currentX, player.currentY, player.currentZ));
        AreaModule.executeLook(player);
    },

    onSendToRoom(player, message, excludedPlayers = [], messagePlain) {
        AreaModule.getRoomAt(player.currentArea, player.currentSection, player.currentX, player.currentY, player.currentZ)?.sendToRoom(player, messagePlain);
        AreaModule.mudServer.players.forEach(p => {
            if (p.sameRoomAs(player) && !excludedPlayers?.includes(p.username)) {
                p.send(message);
            }
        });
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
                                const exit = new Exit(exitData.area, exitData.section, exitData.x, exitData.y, exitData.z, exitData.direction, exitData.initialState, exitData.progs);
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