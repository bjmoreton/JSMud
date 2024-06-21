// Importing necessary modules
const fs = require('fs');
const path = require('path');
const { formatDate, formatTime } = require('../Mud/Helpers.js');

/**
 * Class representing a help file.
 */
class Helpfile {
    /**
     * Create a Helpfile.
     * @param {string} title - The title of the help file.
     */
    constructor(title) {
        /**
         * The title of the help file.
         * @type {string}
         */
        this.title = title;

        /**
         * The display title of the help file.
         * @type {string}
         */
        this.titleDisplay = title;

        /**
         * The keywords associated with the help file.
         * @type {string[]}
         */
        this.keywords = [];
    }

    /**
     * Delete the help file.
     * @param {Object} player - The player requesting the deletion.
     * @param {string} dir - The directory where the help file is located.
     * @param {boolean} [showOutput=true] - Whether to show output to the player.
     */
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

    /**
     * Save the help file.
     * @param {Object} player - The player requesting the save.
     * @param {string} dir - The directory where the help file should be saved.
     * @param {boolean} [showOutput=true] - Whether to show output to the player.
     */
    save(player, dir, showOutput = true) {
        // Set author and last update timestamp
        this.author = player.username;
        const currentDate = new Date();
        this.lastUpdate = formatDate(currentDate) + ' ' + formatTime(currentDate);
        const filePath = path.join(dir, this.title + '.json');

        try {
            // Write helpfile data to file in JSON format
            fs.writeFileSync(filePath, JSON.stringify(this, null, 2));
            if (showOutput) player.send(`Helpfile ${this.title} saved!`);
        } catch (error) {
            player.send(`Error saving helpfile ${this.title}!`);
            console.log(`Error saving helpfile ${this.title}!`);
        }
    }
}

module.exports = Helpfile;
