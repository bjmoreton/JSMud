const { getAllFunctionProperties } = require("../../Utils/helpers");
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

    static ExitStates = {
        None: 0,
        CanClose: 1 << 0,
        CanLock: 1 << 1,
        Closed: 1 << 2,
        Locked: 1 << 3,
        Opened: 1 << 4,
        Unlocked: 1 << 5,
        Password: 1 << 6,
        Emote: 1 << 7,
        Key: 1 << 8
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

    addState(state) {
        this.currentState |= state;
        // Add reverse State
        const revRoom = this.section.getRoomByCoordinates(this.x, this.y, this.z);
        const revExit = revRoom.exits.get(Exit.oppositeExit(this.direction));

        if (revExit && !revExit.hasState(state)) {
            revExit.addState(state);
        }
    }

    canClose() {
        return this.currentState & Exit.ExitStates.CanClose;
    }

    canLock() {
        return this.currentState & Exit.ExitStates.CanLock;
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
        this.initialState = initialState;
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

    emitEvent(event, ...args) {
        console.log('emit ' + event);
        global.mudEmitter.emit(event, ...args);
    }

    static exitStateToString(stateValue) {
        const states = [];
        if (stateValue === Exit.ExitStates.None) {
            return 'None';
        }

        if (stateValue & Exit.ExitStates.CanClose) states.push('Can Close');
        if (stateValue & Exit.ExitStates.CanLock) states.push('Can Lock');
        if (stateValue & Exit.ExitStates.Closed) states.push('Closed');
        if (stateValue & Exit.ExitStates.Locked) states.push('Locked');
        if (stateValue & Exit.ExitStates.Opened) states.push('Opened');
        if (stateValue & Exit.ExitStates.Unlocked) states.push('Unlocked');
        if (stateValue & Exit.ExitStates.Password) states.push('Password');
        if (stateValue & Exit.ExitStates.Emote) states.push('Emote');
        if (stateValue & this.ExitStates.Key) states.push('Key');

        return states.join(', ');
    }

    getPlayerProperties(player) {
        return getAllFunctionProperties(player, ['socket', 'textEditor', 'inventory', 'hasItem', 'sameRoomAs', 'inRoom']);
    }

    hasState(state) {
        return this.currentState & state;
    }

    isAt(area, section, x, y, z) {
        return area.toLowerCase() === this.area?.name.toLowerCase() &&
            section?.toLowerCase() === this.section?.name.toLowerCase() &&
            parseInt(x) === parseInt(this.x) &&
            parseInt(y) === parseInt(this.y) &&
            parseInt(z) === parseInt(this.z);
    }

    isClosed() {
        return this.currentState & Exit.ExitStates.Closed;
    }

    isLocked() {
        return this.currentState & Exit.ExitStates.Locked;
    }

    isOpened() {
        return this.currentState & Exit.ExitStates.Opened;
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
                } else {
                    player.send(`You couldn't open the door!`);
                }
            } else {
                player.send(`The door is locked!`);
            }
        } catch (error) {
            console.error(error);
        }
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

    removeState(state) {
        this.currentState &= ~state;
        // Remove reverse State
        const revRoom = this.section.getRoomByCoordinates(this.x, this.y, this.z);
        const revExit = revRoom.exits.get(Exit.oppositeExit(this.direction));

        if (revExit && revExit.hasState(state)) {
            revExit.removeState(state);
        }
    }

    requiresEmote() {
        return this.currentState & Exit.ExitStates.Emote;
    }

    requiresKey() {
        return this.currentState & Exit.ExitStates.Key;
    }

    requiresPassword() {
        return this.currentState & Exit.ExitStates.Password;
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
            await eval(this.progs['onmessage']);
        }
    }

    async sendToExitEmote(player, emote) {

        if (this.progs !== undefined && this.progs['onemote'] && this.requiresEmote()) {
            await eval(this.progs['onemote']);
        }
    }

    static stringToExit(string) {
        switch (string?.toLowerCase()) {
            case 'd':
            case 'down': return Exit.ExitDirections.Down;
            case 'e':
            case 'east': return Exit.ExitDirections.East;
            case 'n':
            case 'north': return Exit.ExitDirections.North;
            case 'ne':
            case 'northeast': return Exit.ExitDirections.NorthEast;
            case 'nw':
            case 'northwest': return Exit.ExitDirections.NorthWest;
            case 's':
            case 'south': return Exit.ExitDirections.South;
            case 'se':
            case 'southeast': return Exit.ExitDirections.SouthEast;
            case 'sw':
            case 'southwest': return Exit.ExitDirections.SouthWest;
            case 'u':
            case 'up': return Exit.ExitDirections.Up;
            case 'w':
            case 'west': return Exit.ExitDirections.West;
            default: return Exit.ExitDirections.None;
        }
    }

    static stringToExitState(stateString) {
        switch (stateString.toLowerCase()) {
            case "none":
                return Exit.ExitStates.None;
            case "canclose":
                return Exit.ExitStates.CanClose;
            case "canlock":
                return Exit.ExitStates.CanLock;
            case "closed":
                return Exit.ExitStates.Closed;
            case "locked":
                return Exit.ExitStates.Locked;
            case "opened":
                return Exit.ExitStates.Opened;
            case "unlocked":
                return Exit.ExitStates.Unlocked;
            case "password":
                return Exit.ExitStates.Password;
            case "emote":
                return Exit.ExitStates.Emote;
            case "key":
                return Exit.ExitStates.Key;
            default:
                console.error("Invalid exit state string: " + stateString);
                return null;  // or throw an error, or return a default state
        }
    }

    async unlock(player, args) {
        try {
            if (this.isLocked()) {
                if (this.requiresKey()) {
                    let unlocked = true;
                    if (this.progs !== undefined && this.progs['onunlock']) {
                        await eval(this.progs['onunlock']);
                    }

                    if (unlocked) {
                        this.addState(Exit.ExitStates.Unlocked);
                        this.removeState(Exit.ExitStates.Locked);
                        player.send(`You unlock the door.`);
                    } else {
                        player.send(`You couldn't seem to unlock the door!`);
                    }
                } else {
                    player.send(`You couldn't seem to unlock the door!`);
                }
            } else {
                player.send(`The door isn't locked!`);
            }
        } catch (error) {
            console.error(error);
        }
    }
}

module.exports = Exit;