// Importing necessary modules
const fs = require('fs');
const path = require('path');
const { formatDate, formatTime } = require('../Mud/Helpers.js');

// HelpFile class definition
class Helpfile {
    constructor(title) {
        this.title = title;
        this.titleDisplay = title;
        this.keywords = [];
    }

    // Method to delete a help file
    delete(player, dir, showOutput = true) {
        const filePath = path.join(dir, this.title + '.json');
        fs.unlink(filePath, (err) => {
            if (showOutput) {
                if (err) {
                    player?.send(`Error deleting helpfile ${this.title}: ${err}`);
                    console.error(`Error deleting helpfile ${this.title}:`, err);
                } else {
                    player?.send(`Helpfile ${this.title} deleted successfully`);
                }
            }
        });
    }

    // Method to save a help file
    save(player, dir, showOutput = true) {
        // Set author and last update timestamp
        this.author = player.username;
        const currentDate = new Date();
        this.lastUpdate = formatDate(currentDate) + ' ' + formatTime(currentDate);
        const filePath = path.join(dir, this.title + '.json');

        try {
            // Write player data to file in JSON format
            fs.writeFileSync(filePath, JSON.stringify(this, null, 2));
            if (showOutput) player.send(`Helpfile ${this.title} saved!`);
        } catch (error) {
            player.send(`Error saving helpfile ${this.title}!`);
            console.log(`Error saving helpfile ${this.title}!`);
        }
    }
}

module.exports = Helpfile;