const { parseColors } = require('../Color.js');

// textEditor module
const textEditorModule = {
    name: "Text Editor",
    TextEditor: class TextEditor {
        constructor(player) {
            this.player = player;
            this.textValues = [];
            this.lineIndex = 0;
            this.resolveInputPromise = null;
        }

        startEditing(defaultValue) {
            this.player.addStatus(this.player.Statuses.Editing);
            console.log(defaultValue);
            if(defaultValue != '' && defaultValue != undefined && defaultValue != null)
            {
                this.textValues = defaultValue.split('\r\n');
                this.lineIndex = this.textValues.length + 1;
            } else {
                this.textValues = [];
                this.lineIndex = 0;
            }
            this.player.sendRAW("Enter your text");
            this.player.sendRAW("Type /c to clear all text, /g # to goto a line number.");
            this.player.sendRAW("Type /q to quit, /s to save, /t to see text.");
            return new Promise((resolve, reject) => {
                try {
                    this.resolveInputPromise = resolve;
                } catch (error) {
                    this.resolveInputPromise = reject;
                }
            });
        }

        saveText() {
            this.resolveInputPromise(this.textValues.join('\r\n')); // Resolve the promise with the edited text
            this.player.removeStatus(this.player.Statuses.Editing);
        }

        cancelEditing() {
            this.resolveInputPromise(null); // Resolve the promise with null to indicate cancellation
            this.player.removeStatus(this.player.Statuses.Editing);
        }

        processInput(input) {
            const inputString = input.toLowerCase();

            if (inputString === '/c') {
                this.textValues = [];
                this.lineIndex = 0;
            } else if (inputString.startsWith('/g')) {
                const [cmd, lineNumber] = inputString.split(' ');
                this.lineIndex = parseInt(lineNumber);
                if(this.lineIndex == NaN) this.lineIndex = 0;
                if(this.lineIndex > this.textValues.length) this.lineIndex = this.textValues.length;
                this.player.sendRAW(`At line ${parseColors(`&g${this.lineIndex}`)}`);
            } else if (inputString === '/q') {
                this.cancelEditing();
            } else if (inputString === '/s') {
                this.saveText();
            } else if (inputString === '/t') {
                this.player.sendRAW('Current text:');
                this.textValues.forEach((tV, index) => {
                    this.player.sendRAW(`${index}: ${tV}`);
                });
            } else {
                if(this.lineIndex > this.textValues.length) {
                    this.textValues.push(input);
                } else {
                    this.textValues[this.lineIndex] = input;
                }

                this.lineIndex = this.textValues.length + 1;
            }
        }
    },
    init: function (mudServer) {
        this.ms = mudServer;
    }
};

module.exports = textEditorModule;