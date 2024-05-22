const { formatDate, formatTime } = require("../Mud/Helpers");
const fs = require('fs');
const path = require('path');
const Section = require("./Section");

class Area {
    constructor(jsonData) {
        this.blankSymbol = '&B~'
        this.description = '';
        this.lastUpdate = '';
        this.name = jsonData;
        this.nameDisplay = jsonData;
        this.sections = new Map();

        if (typeof jsonData === 'string') {

        } else {
            try {
                Object.assign(this, jsonData);
            } catch (error) {
                console.log(`${error}`);
            }
        }
    }

    // Method to add a section
    addSection(name, vSize) {
        const section = new Section(this.name, name, name, '', vSize);
        this.sections.set(name.toLowerCase(), section);
    }

    // Method to delete area
    delete(player, dir, showOutput = true) {
        const filePath = path.join(dir, this.name + '.json');
        fs.unlink(filePath, (err) => {
            if (showOutput) {
                if (err) {
                    player?.send(`Error deleting area ${this.name}: ${err}`);
                    console.error(`Error deleting area ${this.name}:`, err);
                } else {
                    player?.send(`Area ${this.name} deleted successfully`);
                }
            }
        });
    }

    // Method to find a section by name
    getSectionByName(section) {
        return this.sections.get(typeof section === 'object' ? section.name?.toLowerCase() : section?.toLowerCase());
    }

    // Method to retrieve area property by string
    propertyByString(property) {
        const propertyToLower = property.toLowerCase();
        return this[propertyToLower] || "Property not found";
    }
    // Method to save area
    save(player, dir, showOutput = true) {
        // Set last update timestamp
        const currentDate = new Date();
        if(this.changed === true) this.lastUpdate = formatDate(currentDate) + ' ' + formatTime(currentDate);

        const filePath = path.join(dir, this.name + '.json');

        try {
            // Convert sections to a plain object for serialization
            const sectionsObj = {};
            this.sections.forEach((section) => {
                const sectionData = sectionsObj[section.name] = {
                    area: section.area.name,
                    description: section.description,
                    nameDisplay: section.nameDisplay,
                    vSize: section.vSize,
                    rooms: Array.from(section.rooms.values()).map(room => {
                        const roomData = {
                            area: room.area.name,
                            section: room.section.name,
                            name: room.name,
                            description: room.description,
                            x: parseInt(room.x),
                            y: parseInt(room.y),
                            z: parseInt(room.z),
                            progs: room.progs,
                            symbol: room.symbol,
                            defaultState: {
                                flags: room.defaultState.flags
                            },
                            exits: Array.from(room.exits.values()).map(exit => {
                                const exitData = {
                                    area: exit.area.name,
                                    section: exit.section.name,
                                    direction: exit.direction.toString(),
                                    initialState: exit.initialState,
                                    x: parseInt(exit.x),
                                    y: parseInt(exit.y),
                                    z: parseInt(exit.z),
                                    progs: exit.progs,
                                    teleport: exit.teleport ?? false
                                };

                                // Emit an event after serializing each exit
                                global.mudServer.emit('exitSaved', player, exit, exitData);
                                return exitData;
                            })
                        };

                        // Emit an event after serializing each room
                        global.mudServer.emit('roomSaved', player, room, roomData);
                        return roomData;
                    })
                };

                // Emit an event after serializing each section
                global.mudServer.emit('sectionSaved', player, section, sectionData);
                return sectionData;
            });

            // Write data to file in JSON format
            const data = {
                blankSymbol: this.blankSymbol,
                name: this.name,
                nameDisplay: this.nameDisplay,
                description: this.description,
                lastUpdate: this.lastUpdate,
                sections: sectionsObj
            };
            
            global.mudServer.emit('areaSaved', player, this, data);

            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            if (showOutput) player.send(`Area ${this.name} saved!`);
            this.changed = false;
        } catch (error) {
            player.send(`Error saving area ${this.name}!`);
            console.log(`Error saving area ${this.name}!`, error);
        }
    }
}

module.exports = Area;