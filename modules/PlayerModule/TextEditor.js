const { parseColors } = require('../../Utils/Color.js');

class TextEditor {
    constructor(player) {
        this.player = player;
        this.textValues = [];
        this.lineIndex = 0;
        this.resolveInputPromise = null;
        this.isPrompt = false;
        this.isList = false;
        this.listItems = [];
        this.defaultValue = '';
    }

    showPrompt(prompt, colors = false) {
        this.isPrompt = true;
        this.player.addStatus(this.player.Statuses.Editing);
        if (colors === true) this.player.sendRAW(`${parseColors(`${prompt}`)}`);
        else this.player.sendRAW(prompt);
        return new Promise((resolve, reject) => {
            try {
                this.resolveInputPromise = resolve;
            } catch (error) {
                this.resolveInputPromise = reject;
            }
        });
    }

    startEditing(defaultValue) {
        this.player.addStatus(this.player.Statuses.Editing);
        this.defaultValue = defaultValue;
        if (this.defaultValue != '' && this.defaultValue != undefined && this.defaultValue != null) {
            this.textValues = this.defaultValue.split('\r\n');
            this.lineIndex = this.textValues.length + 1;
        } else {
            this.textValues = [];
            this.lineIndex = 0;
        }
        this.player.sendRAW("Type /c to clear all text, /g # to goto a line number.");
        this.player.sendRAW("Type /q to quit, /s to save, /t to see text.");
        this.player.sendRAW("Enter your text:");
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
        this.resolveInputPromise(this.defaultValue); // Resolve the promise with null to indicate cancellation
        this.player.removeStatus(this.player.Statuses.Editing);
    }

    processInput(input) {
        const inputString = input.toLowerCase();

        if (!this.isList && !this.isPrompt) {
            const [cmd, value] = inputString.split(' ');
            if (cmd === '/c') {
                this.textValues = [];
                this.lineIndex = 0;
            } else if (cmd === '/g') {
                this.lineIndex = parseInt(value);
                if (this.lineIndex == NaN) this.lineIndex = 0;
                if (this.lineIndex > this.textValues.length) this.lineIndex = this.textValues.length;
                this.player.sendRAW(`At line ${parseColors(`&g${this.lineIndex}`)}`);
            } else if (cmd === '/q') {
                this.cancelEditing();
            } else if (cmd === '/s') {
                this.saveText();
            } else if (cmd === '/t') {
                this.player.sendRAW('Current text:');
                this.textValues.forEach((tV, index) => {
                    this.player.sendRAW(`${index}: ${tV}`);
                });
            } else {
                if (this.lineIndex > this.textValues.length) {
                    this.textValues.push(input);
                } else {
                    this.textValues[this.lineIndex] = input;
                }

                this.lineIndex = this.textValues.length + 1;
            }
        } else if (this.isList) {
            this.isList = false;
            this.resolveInputPromise();
        } else if (this.isPrompt) {
            this.player.removeStatus(this.player.Statuses.Editing);
            this.isPrompt = false;
            this.resolveInputPromise(input); // Resolve the promise with the edited text
        }
    }
}

module.exports = TextEditor;