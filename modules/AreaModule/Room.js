const { isNumber } = require("../Mud/Helpers");
const Exit = require("./Exit");
const RoomState = require("./RoomState");

/**
 * Class representing a Room.
 */
class Room {
    /**
     * Create a Room.
     * @param {Object} area - The area to which the room belongs.
     * @param {Object} section - The section to which the room belongs.
     * @param {string} name - The name of the room.
     * @param {string} description - The description of the room.
     * @param {number} x - The x-coordinate of the room.
     * @param {number} y - The y-coordinate of the room.
     * @param {number} z - The z-coordinate of the room.
     * @param {Object} progs - The programs associated with the room.
     * @param {string} [symbol='#'] - The symbol representing the room.
     * @param {Object} defaultState - The default state of the room.
     */
    constructor(area, section, name, description, x, y, z, progs, symbol = '#', defaultState) {
        this.area = area;
        this.section = section;
        this.name = name;
        this.description = description;
        this.x = x;
        this.y = y;
        this.z = z;
        this.progs = progs;
        this.symbol = symbol;
        this.defaultState = new RoomState(defaultState);
        this.currentState = this.defaultState;

        this.exits = new Map();
        this.players = new Map();
    }

    /**
     * Adds an exit to the room.
     * @param {Object} player - The player adding the exit.
     * @param {Object} area - The area of the exit.
     * @param {Object} section - The section of the exit.
     * @param {string} direction - The direction of the exit.
     * @param {number} x - The x-coordinate of the exit.
     * @param {number} y - The y-coordinate of the exit.
     * @param {number} z - The z-coordinate of the exit.
     * @param {boolean} [teleport=false] - Whether the exit is a teleport.
     */
    addExit(player, area, section, direction, x, y, z, teleport = false) {
        const strToExit = Exit.stringToExit(direction);
        if (!strToExit) {
            player.send('Invalid exit direction!');
            return;
        }

        if (!this.exits.has(strToExit)) {
            let [rX, rY, rZ] = this.calculateCoordinates(strToExit, x, y, z);

            let toRoom = section.getRoomByCoordinates(rX, rY, rZ);
            if (!toRoom) {
                toRoom = section.addRoom(player, area, section, rX, rY, rZ);
                if (!toRoom) {
                    player.send(`Room doesn't exist!`);
                    return;
                }
            }

            this.exits.set(strToExit, new Exit(area, section, rX, rY, rZ, direction, {}, teleport));
            toRoom.exits.set(Exit.oppositeExit(direction), new Exit(this.area, this.section, this.x, this.y, this.z, Exit.oppositeExit(direction).toString(), {}, teleport));

            player.send(`Exit added successfully!`);
        } else {
            player.send(`Exit already exists in ${strToExit} direction!`);
        }
    }

    /**
     * Calculates the coordinates based on the direction.
     * @param {string} direction - The direction of the exit.
     * @param {number} x - The x-coordinate override.
     * @param {number} y - The y-coordinate override.
     * @param {number} z - The z-coordinate override.
     * @returns {Array<number>} The calculated coordinates [x, y, z].
     */
    calculateCoordinates(direction, x, y, z) {
        let [rX, rY, rZ] = [this.x, this.y, this.z];

        switch (direction) {
            case Exit.ExitDirections.Down: rZ--; break;
            case Exit.ExitDirections.East: rX++; break;
            case Exit.ExitDirections.North: rY++; break;
            case Exit.ExitDirections.NorthEast: rX++; rY++; break;
            case Exit.ExitDirections.NorthWest: rX--; rY++; break;
            case Exit.ExitDirections.South: rY--; break;
            case Exit.ExitDirections.SouthEast: rX++; rY--; break;
            case Exit.ExitDirections.SouthWest: rX--; rY--; break;
            case Exit.ExitDirections.Up: rZ++; break;
            case Exit.ExitDirections.West: rX--; break;
        }

        if (isNumber(x) && isNumber(y) && isNumber(z)) {
            rX = x;
            rY = y;
            rZ = z;
        }

        return [rX, rY, rZ];
    }

    /**
     * Adds a player to the room.
     * @param {Object} player - The player to add.
     */
    async addPlayer(player) {
        if (player) this.players.set(player.username, player);
        if (this.progs !== undefined && this.progs['onenter']) {
            try {
                await eval(this.progs['onenter']);
            } catch (error) {
                console.error(error);
            }
        }
    }

    /**
     * Gets an exit by direction.
     * @param {string} exitDirection - The direction of the exit.
     * @returns {Exit|undefined} The exit if found, otherwise undefined.
     */
    getExitByDirection(exitDirection) {
        return this.exits.get(exitDirection);
    }

    /**
     * Removes a player from the room.
     * @param {Object} player - The player to remove.
     */
    async removePlayer(player) {
        if (player) this.players.delete(player.username);
        if (this.progs !== undefined && this.progs['onexit']) {
            try {
                await eval(this.progs['onexit']);
            } catch (error) {
                console.error(error);
            }
        }
    }

    reset() {
        this.currentState = this.defaultState;
        this.exits.forEach(exit => {
            exit.reset();
        });
    }

    /**
     * Sends an emote to all exits in the room.
     * @param {Object} player - The player sending the emote.
     * @param {string} emote - The emote to send.
     */
    async sendToRoomEmote(player, emote) {
        if (this.progs !== undefined && this.progs['onemote']) {
            try {
                await eval(this.progs['onemote']);
            } catch (error) {
                console.error(error);
            }
        }
        this.exits.forEach(exit => {
            exit.sendToExitEmote(player, emote);
        });
    }

    /**
     * Sends a message to all players and exits in the room.
     * @param {Object} player - The player sending the message.
     * @param {string} message - The message to send.
     * @param {Array<string>} excludedPlayers - The players to exclude from the message.
     * @param {string} messagePlain - The plain message to send to the exits.
     */
    async sendToRoom(player, message, excludedPlayers, messagePlain) {
        if (this.progs !== undefined && this.progs['onmessage']) {
            try {
                await eval(this.progs['onmessage']);
            } catch (error) {
                console.error(error);
            }
        }
        this.players.forEach(p => {
            if (!excludedPlayers.includes(p.username)) {
                p.send(message);
            }
        });
        this.exits.forEach(exit => {
            exit.sendToExit(player, messagePlain);
        });
    }

    /**
     * Removes an exit from the room.
     * @param {Object} player - The player requesting the removal.
     * @param {Object} section - The section of the room.
     * @param {string} direction - The direction of the exit to remove.
     * @param {Object} toArea - The target area.
     * @param {Object} toSection - The target section.
     * @param {number} x - The x-coordinate of the exit.
     * @param {number} y - The y-coordinate of the exit.
     * @param {number} z - The z-coordinate of the exit.
     */
    removeExit(player, section, direction, toArea, toSection, x, y, z) {
        const strToExit = Exit.oppositeExit(Exit.stringToExit(direction));
        let [rX, rY, rZ] = this.calculateCoordinates(strToExit, x, y, z);

        const toRoom = section.getRoomByCoordinates(rX, rY, rZ);
        if (toRoom) {
            this.exits.delete(strToExit);
            toRoom.exits.delete(Exit.oppositeExit(strToExit));

            player.send(`Exit removed successfully!`);
        } else {
            player.send(`Room doesn't exist!`);
        }
    }
}

module.exports = Room;
