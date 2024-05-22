const { getAllFunctionProperties } = require("../Mud/Helpers");

/**
 * Class representing an Exit.
 */
class Exit {
    /**
     * Enum for exit directions.
     * @readonly
     * @enum {string}
     */
    static ExitDirections = {
        Down: "Down",
        East: "East",
        None: "None",
        North: "North",
        NorthEast: "NorthEast",
        NorthWest: "NorthWest",
        South: "South",
        SouthEast: "SouthEast",
        SouthWest: "SouthWest",
        Up: "Up",
        West: "West"
    }

    /**
     * Enum for direction abbreviations.
     * @readonly
     * @enum {string}
     */
    static DirectionAbbreviations = {
        d: "Down",
        e: "East",
        n: "North",
        ne: "NorthEast",
        nw: "NorthWest",
        s: "South",
        se: "SouthEast",
        sw: "SouthWest",
        u: "Up",
        w: "West"
    };

    /**
     * Enum for exit states.
     * @readonly
     * @enum {string}
     */
    static ExitStates = {
        None: "None",
        CanClose: "CanClose",
        CanLock: "CanLock",
        Closed: "Closed",
        Locked: "Locked",
        Opened: "Opened",
        Unlocked: "Unlocked",
        Password: "Password",
        Emote: "Emote",
        Key: "Key"
    }

    /**
     * Creates an Exit.
     * @param {Object} area - The area to which the exit belongs.
     * @param {Object} section - The section to which the exit belongs.
     * @param {number} x - The x-coordinate of the exit.
     * @param {number} y - The y-coordinate of the exit.
     * @param {number} z - The z-coordinate of the exit.
     * @param {string} direction - The direction of the exit.
     * @param {Object} progs - The programs associated with the exit.
     * @param {boolean} [teleport=false] - Whether the exit is a teleport.
     * @param {string} [initialState=Exit.ExitStates.Opened] - The initial state of the exit.
     */
    constructor(area, section, x, y, z, direction, progs, teleport = false, initialState = Exit.ExitStates.Opened) {
        this.area = area;
        this.section = section;
        this.x = x;
        this.y = y;
        this.z = z;
        this.direction = Exit.stringToExit(direction);
        this.setState(initialState);
        this.currentState = this.initialState;
        this.progs = progs;
        this.teleport = teleport;
    }

    /**
     * Adds or edits a reverse script.
     * @param {string} event - The event name.
     * @param {string} script - The script to be executed.
     */
    addEditReverseScript(event, script) {
        const revRoom = this.section.getRoomByCoordinates(this.x, this.y, this.z);
        const revExit = revRoom.exits.get(Exit.oppositeExit(this.direction));

        if (revExit) {
            if (!revExit.progs) {
                revExit.progs = {};  // Initialize progs if it doesn't exist
            }
            revExit.progs[event] = script;
        }
    }

    /**
     * Adds states to the exit.
     * @param {string|string[]} states - The states to be added.
     */
    addState(states) {
        const revRoom = this.section.getRoomByCoordinates(this.x, this.y, this.z);
        const revExit = revRoom.exits.get(Exit.oppositeExit(this.direction));

        const stateList = Array.isArray(states) ? states : states.toString().split(',').map(s => s.trim());

        stateList.forEach(state => {
            const resolvedState = Exit.stringToExitState(state);
            if (resolvedState && !this.currentState.includes(resolvedState) && this.validExitState(resolvedState)) {
                this.currentState.push(resolvedState);
            }
        });

        if (revExit && !revExit.hasState(states)) {
            revExit.addState(states);
        }
    }

    /**
     * Checks if the exit can be closed.
     * @returns {boolean} True if the exit can be closed, otherwise false.
     */
    canClose() {
        return this.hasState(Exit.ExitStates.CanClose);
    }

    /**
     * Checks if the exit can be locked.
     * @returns {boolean} True if the exit can be locked, otherwise false.
     */
    canLock() {
        return this.hasState(Exit.ExitStates.CanLock);
    }

    /**
     * Closes the exit.
     * @param {Object} player - The player requesting the action.
     * @param {Array} args - The arguments for the action.
     */
    async close(player, args) {
        try {
            if (this.canClose()) {
                if (this.isClosed()) {
                    player.send(`The door is already closed!`);
                    return;
                }
                const closed = true;

                if (this.progs !== undefined && this.progs['onclose']) {
                    await eval(this.progs['onclose']);
                }

                if (closed) {
                    this.addState(Exit.ExitStates.Closed);
                    this.removeState(Exit.ExitStates.Opened);
                    player.send(`You close the door.`);
                }
            } else {
                player.send(`You cannot close this door!`);
            }
        } catch (error) {
            console.error(error);
        }
    }

    /**
     * Deletes a reverse script.
     * @param {string} event - The event name.
     */
    deleteReverseScript(event) {
        const revRoom = this.section.getRoomByCoordinates(this.x, this.y, this.z);
        const revExit = revRoom.exits.get(Exit.oppositeExit(this.direction));

        if (revExit) {
            if (!revExit.progs) {
                revExit.progs = {};  // Initialize progs if it doesn't exist
            }
            delete revExit.progs[event];
        }
    }

    /**
     * Gets an array of exit states in lowercase.
     * @returns {string[]} An array of exit states in lowercase.
     */
    static getExitStatesArray() {
        return Object.values(Exit.ExitStates).map(type => type.toLowerCase());
    }

    /**
     * Checks if the exit has the specified states.
     * @param {string|string[]} states - The states to check.
     * @returns {boolean} True if the exit has all the specified states, otherwise false.
     */
    hasState(states) {
        let stateList;
        if (Array.isArray(states)) {
            stateList = states;
        } else {
            stateList = states.toString().split(',').map(item => item.trim());
        }

        return stateList.every(state => {
            const resolvedState = Exit.stringToExitState(state);
            return resolvedState && this.currentState.includes(resolvedState);
        });
    }

    /**
     * Checks if the exit is at the specified coordinates.
     * @param {string} area - The area name.
     * @param {string} section - The section name.
     * @param {number} x - The x-coordinate.
     * @param {number} y - The y-coordinate.
     * @param {number} z - The z-coordinate.
     * @returns {boolean} True if the exit is at the specified coordinates, otherwise false.
     */
    isAt(area, section, x, y, z) {
        return area.toLowerCase() === this.area?.name.toLowerCase() &&
            section?.toLowerCase() === this.section?.name.toLowerCase() &&
            parseInt(x) === parseInt(this.x) &&
            parseInt(y) === parseInt(this.y) &&
            parseInt(z) === parseInt(this.z);
    }

    /**
     * Checks if the exit is closed.
     * @returns {boolean} True if the exit is closed, otherwise false.
     */
    isClosed() {
        return this.hasState(Exit.ExitStates.Closed);
    }

    /**
     * Checks if the exit is locked.
     * @returns {boolean} True if the exit is locked, otherwise false.
     */
    isLocked() {
        return this.hasState(Exit.ExitStates.Locked);
    }

    /**
     * Checks if the exit is opened.
     * @returns {boolean} True if the exit is opened, otherwise false.
     */
    isOpened() {
        return this.hasState(Exit.ExitStates.Opened);
    }

    /**
     * Checks if the exit is unlocked.
     * @returns {boolean} True if the exit is unlocked, otherwise false.
     */
    isUnlocked() {
        return this.hasState(Exit.ExitStates.Unlocked);
    }

    /**
     * Locks the exit.
     * @param {Object} player - The player requesting the action.
     * @param {Array} args - The arguments for the action.
     */
    async lock(player, args) {
        try {
            if (!this.isLocked()) {
                if (this.canLock()) {
                    let locked = true;
                    if (this.progs !== undefined && this.progs['onlock']) {
                        await eval(this.progs['onlock']);
                    }

                    if (locked) {
                        this.addState(Exit.ExitStates.Locked);
                        this.removeState(Exit.ExitStates.Unlocked);
                        player.send(`You lock the door.`);
                    } else {
                        player.send(`You couldn't seem to lock the door!`);
                    }
                } else {
                    player.send(`You cannot lock this door!`);
                }
            } else {
                player.send(`The door is already locked!`);
            }
        } catch (error) {
            console.error(error);
        }
    }

    /**
     * Opens the exit.
     * @param {Object} player - The player requesting the action.
     * @param {Array} args - The arguments for the action.
     * @returns {boolean} True if the door was opened, otherwise false.
     */
    async open(player, args) {
        try {
            if (!(this.isLocked())) {
                if (this.isOpened()) {
                    player.send(`The door is already opened!`);
                    return false;
                }

                let opened = true;
                if (this.progs !== undefined && this.progs['onopen']) {
                    await eval(this.progs['onopen']);
                }

                if (opened) {
                    this.addState(Exit.ExitStates.Opened);
                    this.removeState(Exit.ExitStates.Closed);
                    player.send(`You open the door.`);
                    return true;
                } else {
                    player.send(`You couldn't open the door!`);
                }
            } else {
                player.send(`The door is locked!`);
            }
        } catch (error) {
            console.error(error);
        }

        return false;
    }

    /**
     * Gets the opposite direction of the given direction.
     * @param {string} direction - The direction to get the opposite of.
     * @returns {string} The opposite direction.
     */
    static oppositeExit(direction) {
        switch (Exit.stringToExit(direction)) {
            case Exit.ExitDirections.Down: return Exit.ExitDirections.Up;
            case Exit.ExitDirections.East: return Exit.ExitDirections.West;
            case Exit.ExitDirections.North: return Exit.ExitDirections.South;
            case Exit.ExitDirections.NorthEast: return Exit.ExitDirections.SouthWest;
            case Exit.ExitDirections.NorthWest: return Exit.ExitDirections.SouthEast;
            case Exit.ExitDirections.South: return Exit.ExitDirections.North;
            case Exit.ExitDirections.SouthEast: return Exit.ExitDirections.NorthWest;
            case Exit.ExitDirections.SouthWest: return Exit.ExitDirections.NorthEast;
            case Exit.ExitDirections.Up: return Exit.ExitDirections.Down;
            case Exit.ExitDirections.West: return Exit.ExitDirections.East;
        }

        return Exit.ExitDirections.None;
    }

    /**
     * Removes states from the exit.
     * @param {string|string[]} states - The states to be removed.
     */
    removeState(states) {
        const stateList = Array.isArray(states) ? states : states.toString().split(',').map(item => item.trim());

        stateList.forEach(state => {
            const resolvedState = Exit.stringToExitState(state);
            if (this.currentState.includes(resolvedState)) {
                this.currentState = this.currentState.filter(s => s !== resolvedState);
            }
        });

        const revRoom = this.section.getRoomByCoordinates(this.x, this.y, this.z);
        const revExit = revRoom && revRoom.exits.get(Exit.oppositeExit(this.direction));
        if (revExit && revExit.hasState(states)) {
            revExit.removeState(states);
        }
    }

    /**
     * Checks if the exit requires an emote.
     * @returns {boolean} True if the exit requires an emote, otherwise false.
     */
    requiresEmote() {
        return this.hasState(Exit.ExitStates.Emote);
    }

    /**
     * Checks if the exit requires a key.
     * @returns {boolean} True if the exit requires a key, otherwise false.
     */
    requiresKey() {
        return this.hasState(Exit.ExitStates.Key);
    }

    /**
     * Checks if the exit requires a password.
     * @returns {boolean} True if the exit requires a password, otherwise false.
     */
    requiresPassword() {
        return this.hasState(Exit.ExitStates.Password);
    }

    /**
     * Resets the exit to its initial state.
     */
    reset() {
        if (this.currentState === this.initialState) return;
        this.currentState = this.initialState;

        const revRoom = this.section.getRoomByCoordinates(this.x, this.y, this.z);
        const revExit = revRoom.exits.get(Exit.oppositeExit(this.direction));

        if (revExit && revExit.currentState !== revExit.initialState) {
            revExit.reset();
        }
    }

    /**
     * Saves the current state as the initial state.
     */
    saveState() {
        if (this.initialState === this.currentState) return;

        this.initialState = this.currentState;

        const revRoom = this.section.getRoomByCoordinates(this.x, this.y, this.z);
        const revExit = revRoom.exits.get(Exit.oppositeExit(this.direction));

        if (revExit && revExit.initialState !== revExit.currentState) {
            revExit.saveState();
        }
    }

    /**
     * Sends a message to the exit.
     * @param {Object} player - The player sending the message.
     * @param {string} message - The message to send.
     */
    async sendToExit(player, message) {
        if (this.progs !== undefined && this.progs['onmessage'] && this.requiresPassword()) {
            try {
                await eval(this.progs['onmessage']);
            } catch (error) {
                console.error(error);
            }
        }
    }

    /**
     * Sends an emote to the exit.
     * @param {Object} player - The player sending the emote.
     * @param {string} emote - The emote to send.
     */
    async sendToExitEmote(player, emote) {
        if (this.progs !== undefined && this.progs['onemote'] && this.requiresEmote()) {
            try {
                await eval(this.progs['onemote']);
            } catch (error) {
                console.error(error);
            }
        }
    }

    /**
     * Sets the state of the exit.
     * @param {string|string[]} states - The states to set.
     */
    setState(states) {
        this.initialState = [];
        for (const state of states.toString().split(',').map(item => item.trim())) {
            if (this.validExitState(state)) this.initialState.push(Exit.stringToExitState(state));
        }

        if (this.initialState.length === 0) this.initialState.push(Exit.ExitStates.Opened);
    }

    /**
     * Converts a string to an exit direction.
     * @param {string} exitString - The string to convert.
     * @returns {string|null} The exit direction, or null if not found.
     */
    static stringToExit(exitString) {
        const normalizedInput = exitString.toLowerCase();
        if (Exit.DirectionAbbreviations[normalizedInput]) {
            return Exit.DirectionAbbreviations[normalizedInput];
        }

        for (const key in Exit.ExitDirections) {
            if (key.toLowerCase() === normalizedInput) {
                return Exit.ExitDirections[key];
            }
        }
        return null;
    }

    /**
     * Converts a string to an exit state.
     * @param {string} stateString - The string to convert.
     * @returns {string|null} The exit state, or null if not found.
     */
    static stringToExitState(stateString) {
        const normalizedInput = stateString.toLowerCase();
        for (const key in Exit.ExitStates) {
            if (key.toLowerCase() === normalizedInput) {
                return Exit.ExitStates[key];
            }
        }
        return null;
    }

    /**
     * Unlocks the exit.
     * @param {Object} player - The player requesting the action.
     * @param {Array} args - The arguments for the action.
     * @returns {boolean} True if the door was unlocked, otherwise false.
     */
    async unlock(player, args) {
        const [bypass] = args;
        try {
            if (this.isLocked()) {
                let unlocked = true;
                if (this.progs !== undefined && this.progs['onunlock'] && !bypass) {
                    try {
                        await eval(this.progs['onunlock']);
                    } catch (error) {
                        console.error(error);
                    }
                }

                if (unlocked) {
                    this.addState(Exit.ExitStates.Unlocked);
                    this.removeState(Exit.ExitStates.Locked);
                    player.send(`You unlock the door.`);
                    return true;
                } else {
                    player.send(`You couldn't seem to unlock the door!`);
                }
            } else {
                player.send(`The door isn't locked!`);
            }
        } catch (error) {
            console.error(error);
        }

        return false;
    }

    /**
     * Validates if a state is a valid exit state.
     * @param {string} state - The state to validate.
     * @returns {boolean} True if the state is valid, otherwise false.
     */
    validExitState(state) {
        return Object.values(Exit.ExitStates).includes(state);
    }
}

module.exports = Exit;
