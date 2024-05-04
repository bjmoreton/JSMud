const ScriptManager = require("../../Utils/ScriptManager");

class Exit {
    static ExitDirections = {
        Down: "Down",
        East: "East",
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
        Unlocked: 1 << 5
    }

    addState(state) {
        this.currentState |= state;
    }

    async close(player, args) {
        if (this.currentState & Exit.ExitStates.CanClose) {
            if (this.currentState & Exit.ExitStates.Closed) {
                player.send(`The door is already closed!`);
                return;
            } else if (this.progs !== undefined && this.progs['onclose']) {
                await this.scriptManager.executeExitScript(this.progs['onclose'], { player: { obj: player, args: args, username: player.username }, exit: this, exitStates: Exit.ExitStates, mudEmitter: global.mudEmitter });
            } else {
                this.addState(Exit.ExitStates.Closed);
                this.removeState(Exit.ExitStates.Opened);
            }

            if (this.currentState & Exit.ExitStates.Closed) {
                player.send(`You close the door.`);
            } else {
                player.send(`You couldn't seem to closse the door!`);
            }
        } else {
            player.send(`You cannot close this door!`);
        }
    }

    constructor(area, section, x, y, z, direction, initialState = Exit.ExitStates.Opened, progs) {
        this.area = area;
        this.section = section;
        this.x = x;
        this.y = y;
        this.z = z;
        this.direction = Exit.stringToExit(direction);
        this.initialState = initialState;
        this.currentState = this.initialState;
        this.progs = progs;

        this.scriptManager = new ScriptManager();
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

        return states.join(', ');
    }

    isAt(area, section, x, y, z) {
        return area === this.area &&
            section === this.section &&
            parseInt(x) === parseInt(this.x) &&
            parseInt(y) === parseInt(this.y) &&
            parseInt(z) === parseInt(this.z);
    }

    isLocked() {
        return this.currentState & Exit.ExitStates.Locked;
    }

    isOpened() {
        return this.currentState & Exit.ExitStates.Opened;
    }

    async onSendToRoom(player, message) {
        if (this.progs !== undefined && this.progs['onmessage']) {
            await this.scriptManager.executeExitScript(this.progs['onmessage'], { player: { obj: player, username: player.username, message: message }, exit: this, exitStates: Exit.ExitStates });
        }
    }

    async onSendToRoomEmote(player, emote) {
        if (this.progs !== undefined && this.progs['onemote']) {
            await this.scriptManager.executeExitScript(this.progs['onemote'], { player: { obj: player, emote: emote, username: player.username }, exit: this, exitStates: Exit.ExitStates });
        }
    }

    async open(player, args) {
        if (!(this.currentState & Exit.ExitStates.Locked)) {
            if (this.currentState & Exit.ExitStates.Opened) {
                player.send(`The door is already opened!`);
                return;
            } else if (this.progs !== undefined && this.progs['onopen']) {
                await this.scriptManager.executeExitScript(this.progs['onopen'], { player: { obj: player, username: player.username }, exit: this, exitStates: Exit.ExitStates });
            } else {
                this.addState(Exit.ExitStates.Opened);
                this.removeState(Exit.ExitStates.Closed);
            }

            if (this.currentState & Exit.ExitStates.Opened) {
                player.send(`You open the door.`);
            } else {
                player.send(`The door remained shut!`);
            }
        } else {
            player.send(`The door is locked!`);
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
    }

    removeState(state) {
        this.currentState &= ~state;
    }

    saveState() {
        this.initialState = this.currentState;
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
            default: return null;
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
            default:
                console.error("Invalid exit state string: " + stateString);
                return null;  // or throw an error, or return a default state
        }
    }
}

module.exports = Exit;