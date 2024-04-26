// Importing necessary modules
const fs = require('fs');
const path = require('path');
const serverCommandsModule = require('./serverCommandsModule.js');
const { formatDate, formatTime } = require('./../Utils/helpers.js');

// Define the directory where help files are stored
const HELP_FILES_DIR = path.join(__dirname, '../helpfiles');
const HELP_FILES_TEMPLATE = path.join(__dirname, '../templates', 'help.template');
// HelpFiles module
const helpFileModule = {
    // Module name
    name: "HelpFiles",

    // HelpFile class definition
    HelpFile: class HelpFile {
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
    },

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
                    switch (editCmd.toLowerCase()) {
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
                            foundHelpfile.delete(player, HELP_FILES_DIR, false);
                            foundHelpfile.title = textValue;
                            break;
                        case "titledisplay":
                            foundHelpfile.titleDisplay = textValue;
                            break;
                    }
                    foundHelpfile.save(player, HELP_FILES_DIR);
                    helpFileModule.HelpfileList.set(oldTitle, foundHelpfile);
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
        return this.HelpfileList.get(helpfileTitle);
    },

    // Method to display help information
    doHelp: (player, entry) => {
        if (entry == "" || entry == null) {
            player.send("Specify a search term");
        } else {
            const _helpFile = entry.toLowerCase();
            const foundHelpFiles = [];

            // Iterate over the HelpfileList map
            helpFileModule.HelpfileList.forEach(helpfile => {
                if (helpfile.title.toLowerCase() === _helpFile || helpfile.keywords.some(keyword => keyword.toLowerCase() === _helpFile)) {
                    foundHelpFiles.push(helpfile);
                }
            });

            if (foundHelpFiles.length === 1) {
                const foundHelpfile = foundHelpFiles[0];
                
                helpFileModule.Template.forEach(line => {
                    player.send(helpFileModule.replaceTemplateData(line, foundHelpfile));
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
        // Load help files
        this.loadHelpfiles();
        this.ms = mudServer;

        // Register commands
        this.ms.registerCommand('helpfile', serverCommandsModule.createCommand('helpfile', ['hf'], 50, async (player, args) => {
            const [cmdName, ...data] = args;
            switch (cmdName.toLowerCase()) {
                case 'create':
                    this.createHelpfile(player, data[0]);
                    break;
                case 'delete':
                    if (player.hasCommand('helpfile delete') || player.modLevel >= 60) {
                        const helpfile = this.findHelpfile(data[0]);

                        if (helpfile != null) {
                            helpfile.delete(player, HELP_FILES_DIR);
                        } else {
                            player.send(`Helpfile ${data[0]} not found!`);
                        }
                    }
                    break;
                case 'edit':
                    await this.editHelpfile(player, data);
                    break;
                default:
                    player.send(`Usage: helpfile <create | delete | edit> helpfileTitle`);
                    break;
            }
        }));

        // Register help command
        this.ms.registerCommand('help', serverCommandsModule.createCommand('help', [], 0, (player, args) => {
            this.doHelp(player, args[0]);
        }));

        // Register reload help files command
        this.ms.registerCommand('reloadhelpfiles', serverCommandsModule.createCommand('reloadhelpfiles', ['rlhfs'], 50, (player, args) => {
            this.loadHelpfiles();
            player.send('Helpfiles reloaded');
        }));
    },

    // Map to store help files
    HelpfileList: new Map(),
    Template: [],

    // Method to load help files from directory
    loadHelpfiles: function () {
        try {
            const dataSync = fs.readFileSync(HELP_FILES_TEMPLATE, 'utf8');
            this.Template = dataSync?.split('\r\n');
        } catch (err) {
            console.error('Error reading file synchronously:', err);
        }

        fs.readdirSync(HELP_FILES_DIR).forEach(file => {
            const filePath = path.join(HELP_FILES_DIR, file);
            console.log(`Loading ${filePath}`);

            try {
                const jsonData = fs.readFileSync(filePath, 'utf-8');
                const helpFileData = JSON.parse(jsonData);
                const helpfile = new this.HelpFile();

                Object.assign(helpfile, helpFileData);
                this.HelpfileList.set(helpfile.title.toLowerCase(), helpfile);
            } catch (err) {
                console.error(`Error reading or parsing JSON file ${filePath}: ${err.message}`);
            }
        });
    }
};

// Export the helpFileModule
module.exports = helpFileModule;
