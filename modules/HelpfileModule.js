// Importing necessary modules
const fs = require('fs');
const path = require('path');
const Helpfile = require('./HelpfileModule/Helpfile.js');
const { isValidString } = require('./Mud/Helpers.js');

// Define the directory where help files are stored
const HELP_FILES_DIR = path.join(__dirname, '../helpfiles');
const HELP_FILES_TEMPLATE = path.join(__dirname, '../system', 'templates', 'help.template');

/**
 * Helpfile module for managing help files in the MUD server.
 * 
 * @module HelpfileModule
 */
const HelpfileModule = {
    // Module name
    name: "Helpfile",

    /**
     * Create a new help file.
     * 
     * @param {Player} player - The player creating the help file.
     * @param {Array} args - The arguments for creating the help file.
     */
    createHelpfile(player, args) {
        const [helpfileTitle] = args;
        if (isValidString(helpfileTitle)) {
            // Check if helpfile with the same title already exists
            if (!HelpfileModule.findHelpfile(helpfileTitle)) {
                const helpfile = new Helpfile(helpfileTitle);
                HelpfileModule.HelpfileList.push(helpfile);
                helpfile.save(player, HELP_FILES_DIR, false);
                player.send(`Helpfile ${helpfileTitle} has been added.`);
            } else {
                player.send(`Helpfile ${helpfileTitle} already exists, edit the description or delete it.`);
            }
        } else {
            player.send(`Invalid helpfile title!`);
            return;
        }
    },

    /**
     * Delete a help file.
     * 
     * @param {Player} player - The player deleting the help file.
     * @param {Array} args - The arguments for deleting the help file.
     */
    deleteHelpfile(player, args) {
        const [helpfileTitle] = args;
        const helpfile = HelpfileModule.findHelpfile(helpfileTitle);

        if (helpfile != null) {
            helpfile.delete(player, HELP_FILES_DIR);
        } else {
            player.send(`Helpfile ${helpfileTitle} doesn't exist!`);
        }
    },

    /**
     * Retrieve helpfile property by string.
     * 
     * @param {string} property - The property to retrieve.
     * @param {Helpfile} foundHelpfile - The helpfile object.
     * @returns {string} - The property value.
     */
    helpfilePropertyByString(property, foundHelpfile) {
        switch (property.toLowerCase()) {
            case "description":
                return foundHelpfile.description;
            case "keywords":
                return foundHelpfile.keywords?.map((word, index) => (index + 1) % 6 === 0 ? word + '\n' : word).join(' ');
            case "title":
                return foundHelpfile.title;
            case "titledisplay":
                return foundHelpfile.titleDisplay;
        }
    },

    /**
     * Edit an existing help file.
     * 
     * @param {Player} player - The player editing the help file.
     * @param {Array} args - The arguments for editing the help file.
     */
    async editHelpfile(player, args) {
        // Extract command arguments
        const [helpfile, editCmd, ...values] = args;
        const foundHelpfile = HelpfileModule.findHelpfile(helpfile);
        const oldTitle = foundHelpfile.title;
        if (foundHelpfile != null) {
            if (editCmd !== undefined && editCmd != "") {
                const value = values?.join(' ');
                let textValue = value;

                switch (editCmd?.toLowerCase()) {
                    case "description":
                        textValue = await player.textEditor.startEditing(HelpfileModule.helpfilePropertyByString(editCmd, foundHelpfile));
                        if (textValue === null) {
                            player.send(`Edit canceled`);
                            return;
                        }
                        foundHelpfile.description = textValue;
                        break;
                    case "keywords":
                        let keywordString = textValue;

                        // Split string by spaces, leaving spaces inside quotes alone
                        const keywords = keywordString.match(/(".*?"|'.*?'|`.*?`|\S+)/g);
                        if (keywords != "" || keywords != null || keywords != undefined) {
                            // Remove quotes from each part
                            const cleanedKeywords = keywords.map(keyword => keyword.replace(/^["'`]|["'`]$/g, ''));
                            foundHelpfile.keywords = [...cleanedKeywords];
                        };
                        break;
                    case "title":
                        if (!HelpfileModule.HelpfileList.has(textValue.toLowerCase())) {
                            foundHelpfile.delete(player, HELP_FILES_DIR, false);
                            foundHelpfile.title = textValue;
                            HelpfileModule.HelpfileList.delete(oldTitle);
                            HelpfileModule.HelpfileList.set(foundHelpfile.title.toLowerCase(), foundHelpfile);
                        }
                        break;
                    case "titledisplay":
                        foundHelpfile.titleDisplay = textValue;
                        break;
                }
                foundHelpfile.save(player, HELP_FILES_DIR);
            } else {
                player.send(`Usage: edithelpfile helpfileTitle <description | keywords | title | titledisplay>`);
            }
        } else {
            player.send(`Helpfile ${helpfile} not found!`);
        }
    },

    /**
     * Find a help file by title.
     * 
     * @param {string} helpfileTitle - The title of the help file.
     * @returns {Helpfile|null} - The found help file or null.
     */
    findHelpfile(helpfileTitle) {
        return HelpfileModule.HelpfileList.get(helpfileTitle.toLowerCase());
    },

    /**
     * Display help information.
     * 
     * @param {Player} player - The player requesting help.
     * @param {Array} args - The arguments for the help command.
     */
    executeHelp(player, args) {
        const [entry] = args;

        if (entry == "" || entry == null) {
            player.send("Specify a search term");
        } else {
            const _helpFile = entry.toLowerCase();
            const foundHelpFiles = [];

            // Iterate over the HelpfileList map
            HelpfileModule.HelpfileList.forEach(helpfile => {
                if (helpfile.title.toLowerCase() === _helpFile || helpfile.keywords.some(keyword => keyword.toLowerCase() === _helpFile)) {
                    foundHelpFiles.push(helpfile);
                }
            });

            if (foundHelpFiles.length === 1) {
                const foundHelpfile = foundHelpFiles[0];

                HelpfileModule.Template.forEach(line => {
                    player.send(HelpfileModule.replaceTemplateData(line, foundHelpfile));
                });
            } else if (foundHelpFiles.length === 0) {
                console.log(`No helpfiles found for ${entry}!`);
                player.send(`No helpfiles found for ${entry}`);
            } else {
                const helpfileRet = foundHelpFiles.map(helpFile => helpFile.title).join(',');
                player.send("Multiple helpfiles found");
                player.send(helpfileRet);
            }
        }
    },

    /**
     * Reload help files.
     * 
     * @param {Player} player - The player requesting the reload.
     */
    executeReloadHelpfiles(player) {
        HelpfileModule.loadHelpfiles();
        player.send('Helpfiles reloaded');
    },

    /**
     * Replace template data with helpfile information.
     * 
     * @param {string} data - The template data.
     * @param {Helpfile} helpfile - The helpfile object.
     * @returns {string} - The replaced data.
     */
    replaceTemplateData(data, helpfile) {
        const parsedData = data.replace('%titledisplay', helpfile.titleDisplay)
            .replace('%title', helpfile.title)
            .replace('%description', helpfile.description)
            .replace('%author', helpfile.author)
            .replace('%updatedate', helpfile.lastUpdate)
            .replace('%keywords', helpfile.keywords?.join(','));
        return parsedData;
    },

    /**
     * Initialization method for the HelpfileModule.
     * 
     * @param {Object} mudServer - The MUD server instance.
     */
    init: function (mudServer) {
        global.HelpfileModule = this;
        this.mudServer = mudServer;
    },

    // Map to store help files
    HelpfileList: new Map(),
    Template: [],

    /**
     * Load help files from the directory.
     */
    load: function () {
        try {
            const dataSync = fs.readFileSync(HELP_FILES_TEMPLATE, 'utf8');
            HelpfileModule.Template = dataSync?.split('\n');
        } catch (err) {
            console.error('Error reading file synchronously:', err);
        }

        fs.readdirSync(HELP_FILES_DIR).forEach(file => {
            const filePath = path.join(HELP_FILES_DIR, file);
            console.log(`Loading helpfile ${filePath}`);

            try {
                const jsonData = fs.readFileSync(filePath, 'utf-8');
                const helpFileData = JSON.parse(jsonData);
                const helpfile = new Helpfile();

                Object.assign(helpfile, helpFileData);
                HelpfileModule.HelpfileList.set(helpfile.title.toLowerCase(), helpfile);
            } catch (err) {
                console.error(`Error reading or parsing JSON file ${filePath}: ${err.message}`);
            }
        });
    }
};

// Export the HelpfileModule
module.exports = HelpfileModule;
