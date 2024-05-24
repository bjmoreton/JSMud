const { parseColors } = require('../Mud/Color.js');
const { isNumber } = require('../Mud/Helpers.js');

/**
 * Class representing a text editor for a player.
 */
class TextEditor {
    /**
     * Create a TextEditor.
     * @param {Player} player - The player using the text editor.
     */
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

    /**
     * Show a prompt to the player.
     * @param {string} prompt - The prompt message to show.
     * @param {boolean} [colors=false] - Whether to parse colors in the prompt message.
     * @returns {Promise<string>} A promise that resolves with the player's input.
     */
    showPrompt(prompt, colors = false) {
        this.isPrompt = true;
        this.player.addStatus('editing');
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

    /**
     * Start editing text.
     * @param {string} defaultValue - The default value to pre-fill the editor with.
     * @returns {Promise<string>} A promise that resolves with the edited text.
     */
    startEditing(defaultValue) {
        this.player.addStatus('editing');
        this.defaultValue = defaultValue;
        if (this.defaultValue != '' && this.defaultValue != undefined && this.defaultValue != null) {
            this.textValues = this.defaultValue.split('\n');
            this.lineIndex = this.textValues.length + 1;
        } else {
            this.textValues = [];
            this.lineIndex = 0;
        }
        this.player.sendRAW("Type /c to clear all text, /g # to goto a line number.");
        this.player.sendRAW("Type /i # to insert a line at that line number.");
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

    /**
     * Save the edited text.
     */
    saveText() {
        this.resolveInputPromise(this.textValues.join('\n'));
        this.player.removeStatus('editing');
    }

    /**
     * Cancel the text editing.
     */
    cancelEditing() {
        this.resolveInputPromise(null);
        this.player.removeStatus('editing');
    }

    /**
     * Process player input for the text editor.
     * @param {string} input - The input from the player.
     */
    processInput(input) {
        const inputString = input.toLowerCase();

        if (!this.isList && !this.isPrompt) {
            const [cmd, value] = inputString.split(' ');
            if (cmd === '/c') {
                this.textValues = [];
                this.lineIndex = 0;
            } else if (cmd === '/g') {
                this.lineIndex = parseInt(value);
                if (!isNumber(this.lineIndex) == NaN) this.lineIndex = 0;
                if (this.lineIndex > this.textValues.length) this.lineIndex = this.textValues.length;
                this.player.sendRAW(`At line ${parseColors(`&g${this.lineIndex}`)}`);
            } else if (cmd === '/i') {
                const insertIndex = parseInt(value);
                if (!isNumber(insertIndex) || insertIndex < 0 || insertIndex > this.textValues.length) {
                    this.player.sendRAW("Invalid line number for insertion.");
                } else {
                    this.textValues.splice(insertIndex, 0, '');
                    this.player.sendRAW(`Inserted blank line at ${parseColors(`&g${insertIndex}`)}`);
                }
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
            this.player.removeStatus('editing');
            this.isPrompt = false;
            this.resolveInputPromise(input);
        }
    }
}

module.exports = TextEditor;
