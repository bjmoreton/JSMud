const { isNumber } = require("../Mud/Helpers");
const Exit = require("./Exit");
const RoomState = require("./RoomState");

class Room {
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
        this.flags = this.defaultState.flags;

        this.exits = new Map();
        this.players = new Map();
    }

    addExit(player, area, section, direction, x, y, z, teleport = false) {
        let rX = this.x;
        let rY = this.y;
        let rZ = this.z;

        const strToExit = Exit.stringToExit(direction);
        if (!this.exits.has(strToExit)) {
            switch (strToExit) {
                case Exit.ExitDirections.Down:
                    rZ--;
                    break;
                case Exit.ExitDirections.East:
                    rX++;
                    break;
                case Exit.ExitDirections.North:
                    rY++;
                    break;
                case Exit.ExitDirections.NorthEast:
                    rX++;
                    rY++;
                    break;
                case Exit.ExitDirections.NorthWest:
                    rX--;
                    rY++;
                    break;
                case Exit.ExitDirections.South:
                    rY--;
                    break;
                case Exit.ExitDirections.SouthEast:
                    rX++;
                    rY--;
                    break;
                case Exit.ExitDirections.SouthWest:
                    rX--;
                    rY--;
                    break;
                case Exit.ExitDirections.Up:
                    rZ++;
                    break;
                case Exit.ExitDirections.West:
                    rX--;
                    break;
                default:
                    player.send('Invalid exit direction!');
                    return;
            }

            if (isNumber(x) && isNumber(y) && isNumber(z)) {
                rX = x;
                rY = y;
                rZ = z;
            }

            let toRoom = section.getRoomByCoordinates(rX, rY, rZ);
            if (toRoom == null) {
                toRoom = section.addRoom(player, area, section, rX, rY, rZ);
                if (toRoom == null) {
                    player.send(`Room doesn't exist!`);
                    return;
                }
            }

            this.exits.set(strToExit, new Exit(area, section, rX, rY, rZ, direction, {}, teleport));
            toRoom.exits.set(Exit.oppositeExit(direction), new Exit(this.area, this.section, this.x, this.y, this.z, Exit.oppositeExit(direction).toString(), {}, teleport));

            player.send(`Exit added successfully!`);
        } else {
            player.send(`Exit already exist in ${strToExit} direction!`);
        }
    }

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

    // Method to get an exit by direction
    getExitByDirection(exitDirection) {
        return this.exits.get(exitDirection);
    }

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

    sendToRoomEmote(player, emote) {
        this.exits?.forEach(exit => {
            exit.sendToExitEmote(player, emote);
        });
    }

    sendToRoom(player, message, excludedPlayers, messagePlain) {
        this.players.forEach(p => {
            if (!excludedPlayers.includes(p.username)) {
                p.send(message);
            }
        });
        this.exits?.forEach(exit => {
            exit.sendToExit(player, messagePlain);
        });
    }

    // Method to retrieve area property by string
    propertyByString(property) {
        const propertyToLower = property.toLowerCase();
        return this[propertyToLower] || "Property not found";
    }

    removeExit(player, section, direction, toArea, toSection, x, y, z) {
        let rX = this.x;
        let rY = this.y;
        let rZ = this.z;

        const strToExit = Exit.oppositeExit(Exit.stringToExit(direction));

        switch (strToExit) {
            case Exit.ExitDirections.Down:
                rZ--;
                break;
            case Exit.ExitDirections.East:
                rX++;
                break;
            case Exit.ExitDirections.North:
                rY++;
                break;
            case Exit.ExitDirections.NorthEast:
                rX++;
                rY++;
                break;
            case Exit.ExitDirections.NorthWest:
                rX--;
                rY++;
                break;
            case Exit.ExitDirections.South:
                rY--;
                break;
            case Exit.ExitDirections.SouthEast:
                rX++;
                rY--;
                break;
            case Exit.ExitDirections.SouthWest:
                rX--;
                rY--;
                break;
            case Exit.ExitDirections.Up:
                rZ++;
                break;
            case Exit.ExitDirections.West:
                rX--;
                break;
            default:
                player.send(`Invalid exit direction!`);
                return;
        }

        if (toArea !== undefined && toSection !== undefined && x !== undefined &&
            y !== undefined && z !== undefined) {
            rX = x;
            rY = y;
            rZ = z;
        }

        const toRoom = section.getRoomByCoordinates(rX, rY, rZ);
        if (toRoom != null) {
            this.exits.delete(Exit.oppositeExit(strToExit));
            toRoom.exits.delete(strToExit);

            player.send(`Exit removed successfully!`);
        } else {
            player.send(`Room doesn't exist!`);
        }
    }
}

module.exports = Room;