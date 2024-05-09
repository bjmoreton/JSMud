// Importing necessary modules
const fs = require('fs');
const path = require('path');
const Helpfile = require('./HelpfileModule/Helpfile.js');

// Define the directory where help files are stored
const HELP_FILES_DIR = path.join(__dirname, '../helpfiles');
const HELP_FILES_TEMPLATE = path.join(__dirname, '../system', 'templates', 'help.template');

// HelpFiles module
const HelpfileModule = {
    // Module name
    name: "Helpfile",

    // Method to create a new help file
    createHelpfile(player, helpfileTitle) {
        // Check if helpfile with the same title already exists
        if (!this.findHelpfile(helpfileTitle)) {
            const helpfile = new this.HelpFile(helpfileTitle);
            this.HelpfileList.push(helpfile);
            helpfile.save(player, HELP_FILES_DIR, false);
            player.send(`Helpfile ${helpfileTitle} has been added.`);
        } else {
            player.send(`Helpfile ${helpfileTitle} already exists, edit the description or delete it.`);
        }
    },

    // Method to retrieve helpfile property by string
    helpfilePropertyByString: (property, foundHelpfile) => {
        switch (property.toLowerCase()) {
            case "description":
                return foundHelpfile.description;
            case "keywords":
                console.log(`Keywords: ${foundHelpfile.keywords}`);
                return foundHelpfile.keywords?.map((word, index) => (index + 1) % 6 === 0 ? word + '\n' : word).join(' ');
            case "title":
                return foundHelpfile.title;
            case "titledisplay":
                return foundHelpfile.titleDisplay;
        }
    },

    // Method to edit an existing help file
    editHelpfile: async function (player, args) {
        // Extract command arguments
        const [helpfile, editCmd] = args;
        const foundHelpfile = this.findHelpfile(helpfile);
        const oldTitle = foundHelpfile.title;
        if (foundHelpfile != null) {
            if (editCmd !== undefined && editCmd != "") {
                const textValue = await player.textEditor.startEditing(this.helpfilePropertyByString(editCmd, foundHelpfile));
                if (textValue != null) {
                    switch (editCmd?.toLowerCase()) {
                        case "description":
                            foundHelpfile.description = textValue;
                            break;
                        case "keywords":
                            let keywordString = textValue.replace('\r\n', ' ');
                            keywordString = textValue.replace('\r', ' ').replace('\n', ' ');

                            // Split string by spaces, leaving spaces inside quotes alone
                            const keywords = keywordString.match(/(?:[^\s"]+|"[^"]*")+/g);
                            if (keywords != "" || keywords != null || keywords != undefined) {
                                // Remove quotes from each part
                                const cleanedKeywords = keywords.map(keyword => keyword.replace(/^"|"$/g, ''));
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
                    player.send(`Edit canceled!`);
                    return;
                }
            } else {
                player.send(`Usage: helpfile edit helpfileTitle <description | keywords | title | titledisplay>`);
            }
        } else {
            player.send(`Helpfile ${helpfile} not found!`);
        }
    },

    // Method to find a help file by title
    findHelpfile(helpfileTitle) {
        return HelpfileModule.HelpfileList.get(helpfileTitle.toLowerCase());
    },

    // Method to display edit prompt
    executeEdit: async (player, args) => {
        const [cmdName, editHelpfile, ...data] = args;
        switch (cmdName?.toLowerCase()) {
            case 'create':
                HelpfileModule.createHelpfile(player, editHelpfile);
                break;
            case 'delete':
                if (player.hasCommand('helpfile delete') || player.modLevel >= 60) {
                    const helpfile = HelpfileModule.findHelpfile(editHelpfile);

                    if (helpfile != null) {
                        helpfile.delete(player, HELP_FILES_DIR);
                    } else {
                        player.send(`Helpfile ${editHelpfile} doesn't exist!`);
                    }
                }
                break;
            case 'edit':
                await HelpfileModule.editHelpfile(player, data);
                break;
            default:
                player.send(`Usage: helpfile <create | delete | edit> helpfileTitle`);
                break;
        }
    },

    // Method to display help information
    executeHelp: (player, args) => {
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

    executeReloadHelpfiles: (player) => {
        HelpfileModule.loadHelpfiles();
        player.send('Helpfiles reloaded');
    },

    // Method to replace template data with helpfile information
    replaceTemplateData: (data, helpfile) => {
        const parsedData = data.replace('%titledisplay', helpfile.titleDisplay)
            .replace('%title', helpfile.title)
            .replace('%description', helpfile.description)
            .replace('%author', helpfile.author)
            .replace('%updatedate', helpfile.lastUpdate)
            .replace('%keywords', helpfile.keywords?.join(','));
        return parsedData;
    },

    // Initialization method
    init: function (mudServer) {
        global.HelpfileModule = this;
        this.mudServer = mudServer;
    },

    // Map to store help files
    HelpfileList: new Map(),
    Template: [],

    // Method to load help files from directory
    load: function () {
        try {
            const dataSync = fs.readFileSync(HELP_FILES_TEMPLATE, 'utf8');
            HelpfileModule.Template = dataSync?.split('\r\n');
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