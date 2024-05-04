const { formatDate, formatTime } = require("../../Utils/helpers");
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
        const section = new Section(this.name, name, '', vSize);
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
    getSectionByName(name) {
        return this.sections.get(name?.toLowerCase());
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
        this.lastUpdate = formatDate(currentDate) + ' ' + formatTime(currentDate);
        const filePath = path.join(dir, this.name + '.json');

        try {
            // Convert sections to a plain object for serialization
            const sectionsObj = {};
            this.sections.forEach((section) => {
                sectionsObj[section.name] = {
                    area: section.area,
                    description: section.description,
                    vSize: section.vSize,
                    rooms: Array.from(section.rooms.values()).map(room => ({
                        area: room.area,
                        section: room.section,
                        name: room.name,
                        description: room.description,
                        x: room.x,
                        y: room.y,
                        z: room.z,
                        exits: Array.from(room.exits.values()).map(exit => ({
                            area: exit.area,
                            section: exit.section,
                            direction: exit.direction.toString(),
                            initialState: exit.initialState,
                            x: exit.x,
                            y: exit.y,
                            z: exit.z,
                            progs: exit.progs
                        }))
                    }))
                };
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
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            if (showOutput) player.send(`Area ${this.name} saved!`);
        } catch (error) {
            player.send(`Error saving area ${this.name}!`);
            console.log(`Error saving area ${this.name}!`, error);
        }
    }
}

module.exports = Area;