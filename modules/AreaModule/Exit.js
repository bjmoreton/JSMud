const { getAllFunctionProperties } = require("../Mud/Helpers");
class Exit {
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

    addState(states) {
        // Add reverse State
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

    canClose() {
        return this.hasState(Exit.ExitStates.CanClose);
    }

    canLock() {
        return this.hasState(Exit.ExitStates.CanLock);
    }

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

    // Method to get a comma-separated string of exit states in lowercase
    static getExitStatesArray() {
        // Extract the values from the ExitStates object, convert them to lowercase, and join them into a string
        return Object.values(Exit.ExitStates)
            .map(type => type.toLowerCase());  // Convert each type to lowercase
    }

    hasState(states) {
        // Handle different types of inputs flexibly
        let stateList;
        if (Array.isArray(states)) {
            stateList = states;
        } else {
            stateList = states.toString().split(',').map(item => item.trim());
        }

        // Check if every state in the list is included in the current state
        return stateList.every(state => {
            const resolvedState = Exit.stringToExitState(state);
            return resolvedState && this.currentState.includes(resolvedState);
        });
    }

    isAt(area, section, x, y, z) {
        return area.toLowerCase() === this.area?.name.toLowerCase() &&
            section?.toLowerCase() === this.section?.name.toLowerCase() &&
            parseInt(x) === parseInt(this.x) &&
            parseInt(y) === parseInt(this.y) &&
            parseInt(z) === parseInt(this.z);
    }

    isClosed() {
        return this.hasState(Exit.ExitStates.Closed);
    }

    isLocked() {
        return this.hasState(Exit.ExitStates.Locked);
    }

    isOpened() {
        return this.hasState(Exit.ExitStates.Opened);
    }

    isUnlocked() {
        return this.hasState(Exit.ExitStates.Unlocked);
    }

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

    async open(player, args) {
        try {
            if (!(this.isLocked())) {
                if (this.isOpened()) {
                    player.send(`The door is already opened!`);
                    return;
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

    removeState(states) {
        const stateList = Array.isArray(states) ? states : states.toString().split(',').map(item => item.trim());

        // Filter out the states to be removed from the currentState array
        stateList.forEach(state => {
            const resolvedState = Exit.stringToExitState(state);
            if (this.currentState.includes(resolvedState)) {
                this.currentState = this.currentState.filter(s => s !== resolvedState);
            }
        });

        // Remove state from the reverse exit if it exists and has the same state
        const revRoom = this.section.getRoomByCoordinates(this.x, this.y, this.z);
        const revExit = revRoom && revRoom.exits.get(Exit.oppositeExit(this.direction));
        if (revExit && revExit.hasState(states)) {
            revExit.removeState(states); // Ensure states are resolved when passed to reverse exit
        }
    }

    requiresEmote() {
        return this.hasState(Exit.ExitStates.Emote);
    }

    requiresKey() {
        return this.hasState(Exit.ExitStates.Key);
    }

    requiresPassword() {
        return this.hasState(Exit.ExitStates.Password);
    }

    reset() {
        if (this.currentState === this.initialState) return;
        this.currentState = this.initialState;

        // Reset reverse State
        const revRoom = this.section.getRoomByCoordinates(this.x, this.y, this.z);
        const revExit = revRoom.exits.get(Exit.oppositeExit(this.direction));

        if (revExit && revExit.currentState != revExit.initialState) {
            revExit.reset();
        }
    }

    saveState() {
        if (this.initialState === this.currentState) return;

        this.initialState = this.currentState;
        // Save reverse State
        const revRoom = this.section.getRoomByCoordinates(this.x, this.y, this.z);
        const revExit = revRoom.exits.get(Exit.oppositeExit(this.direction));

        if (revExit && revExit.initialState != revExit.currentStateState) {
            revExit.saveState();
        }
    }

    async sendToExit(player, message) {
        if (this.progs !== undefined && this.progs['onmessage'] && this.requiresPassword()) {
            try {
                await eval(this.progs['onmessage']);
            } catch (error) {
                console.error(error);
            }
        }
    }

    async sendToExitEmote(player, emote) {
        if (this.progs !== undefined && this.progs['onemote'] && this.requiresEmote()) {
            try {
                await eval(this.progs['onemote']);
            } catch (error) {
                console.error(error);
            }
        }
    }

    setState(states) {
        this.initialState = [];
        for (const state of states.toString().split(',').map(item => item.trim())) {
            if (this.validExitState(state)) this.initialState.push(Exit.stringToExitState(state));
        }

        if (this.initialState.length === 0) this.initialState.push(Exit.ExitStates.Opened);
    }

    static stringToExit(exitString) {
        const normalizedInput = exitString.toLowerCase();
        // First, check abbreviations
        if (Exit.DirectionAbbreviations[normalizedInput]) {
            return Exit.DirectionAbbreviations[normalizedInput];
        }

        // Second, check full names
        for (const key in Exit.ExitDirections) {
            if (key.toLowerCase() === normalizedInput) {
                return Exit.ExitDirections[key];
            }
        }
        return null; // Return null if no matching direction is found
    }

    static stringToExitState(stateString) {
        const normalizedInput = stateString.toLowerCase();
        for (const key in Exit.ExitStates) {
            if (key.toLowerCase() === normalizedInput) {
                return Exit.ExitStates[key];
            }
        }
        return null; // Return null if no matching state is found
    }

    async unlock(player, args) {
        const [bypass] = args
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

    validExitState(state) {
        return Object.values(Exit.ExitStates).includes(state);
    }
}

module.exports = Exit;