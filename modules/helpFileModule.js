const fs = require('fs');
const path = require('path');

const HELP_FILES_DIR = path.join(__dirname, '../helpfiles');

// HelpFiles module
const helpFileModule = {
    name: "HelpFiles",
    HelpFile: class HelpFile {
        constructor(title, titleDisplay, description, keywordString) {
            this.title = title;
            this.titleDisplay = titleDisplay;
            this.description = description;
            this.keywordString = keywordString;
            this.keywords = keywordString.toLowerCase().split(',');
        }
    },
    doHelp: (player, entry) => {
        if (entry == "" || entry == null) {
            player.send("Specify a search term");
        } else {
            const _helpFile = entry.toLowerCase();
            const foundHelpFiles = helpFileModule.HelpFileList.filter(help => {
                return help.title.toLowerCase() === _helpFile || help.keywords.includes(_helpFile);
            });

            if (foundHelpFiles.length === 1) {
                player.send(foundHelpFiles[0].titleDisplay);
                player.send(foundHelpFiles[0].description);
            } else if (foundHelpFiles.length === 0) {
                console.log(`No Help files found for ${entry}!`);
                player.send(`No Help files found for ${entry}`);
            } else {
                const helpfileRet = foundHelpFiles.map(helpFile => helpFile.title).join(',');
                player.send("Multiple helpfiles found");
                player.send(helpfileRet);
            }
        }
    },
    init: function (mudServer) {
        this.loadHelpFiles();
        mudServer.registerCommand('help', (player, args) => {
            this.doHelp(player, args[0]);
        });
    },
    HelpFileList: [],
    loadHelpFiles: function () {
        this.HelpFileList = [];

        fs.readdirSync(HELP_FILES_DIR).forEach(file => {
            const filePath = path.join(HELP_FILES_DIR, file);
            console.log(`Loading ${filePath}`);

            try {
                const jsonData = fs.readFileSync(filePath, 'utf-8');
                const helpFile = JSON.parse(jsonData);

                helpFile.keywords = helpFile.keywordString.toLowerCase().split(',');
                this.HelpFileList.push(helpFile);
            } catch (err) {
                console.error(`Error reading or parsing JSON file ${filePath}: ${err.message}`);
            }
        });
    }
};

module.exports = helpFileModule;