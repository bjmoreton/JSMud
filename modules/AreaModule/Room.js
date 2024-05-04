const { isNumber } = require("../../Utils/helpers");
const Exit = require("./Exit");

class Room {
    constructor(area, section, name, description, x, y, z) {
        this.area = area;
        this.section = section;
        this.name = name;
        this.description = description;
        this.x = x;
        this.y = y;
        this.z = z;

        this.exits = new Map();
    }

    addExit(player, area, section, direction, x, y, z) {
        let rX = this.x;
        let rY = this.y;
        let rZ = this.z;

        const strToExit = Exit.stringToExit(direction);
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

        this.exits.set(strToExit, new Exit(area.name, section.name, rX, rY, rZ, direction));
        toRoom.exits.set(Exit.oppositeExit(direction), new Exit(this.area, this.section, this.x, this.y, this.z, Exit.oppositeExit(direction).toString()));

        player.send(`Exit added successfully!`);
    }

    // Method to get an exit by direction
    getExitByDirection(exitDirection) {
        return this.exits.get(exitDirection);
    }

    isAt(area, section, x, y, z) {
        return area === this.area &&
            section === this.section &&
            parseInt(x) === parseInt(this.x) &&
            parseInt(y) === parseInt(this.y) &&
            parseInt(z) === parseInt(this.z);
    }

    sendToRoom(player, message) {
        this.exits?.forEach(exit => {
            exit.sendToExit(player, message);
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

        let toRoom;
        if (toArea !== undefined && toSection !== undefined && x !== undefined &&
            y !== undefined && z !== undefined) {
            rX = x;
            rY = y;
            rZ = z;
            toRoom = toSection.getRoomByCoordinates(rX, rY, rZ);
        } else toRoom = section.getRoomByCoordinates(rX, rY, rZ);

        if (toRoom != null) {
            this.exits.delete(strToExit);
            toRoom.exits.delete(Exit.oppositeExit(strToExit));

            player.send(`Exit removed successfully!`);
        } else {
            player.send(`Room doesn't exist!`);
        }
    }
}

module.exports = Room;