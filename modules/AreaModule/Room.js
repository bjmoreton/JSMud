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

    addExit(player, area, section, direction) {
        let rX = this.x;
        let rY = this.y;
        let rZ = this.z;

        switch (Exit.stringToExit(direction)) {
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
        }

        let toRoom = section.getRoomByCoordinates(rX, rY, rZ);
        if (toRoom == null) {
            toRoom = section.addRoom(player, area, section, rX, rY, rZ);
            if (toRoom == null) return;
        }
        const strToExit = Exit.stringToExit(direction);
        if (strToExit != null) {
            this.exits.set(strToExit, new Exit(area.name, section.name, rX, rY, rZ, direction));
            toRoom.exits.set(Exit.oppositeExit(direction), new Exit(this.area, this.section, this.x, this.y, this.z, Exit.oppositeExit(direction).toString()));
        } else {
            player.send(`Invalid exit direction!`);
            return;
        }

        player.send(`Exit added successfully!`);
    }

    // Method to get an exit by direction
    getExitByDirection(exitDirection) {
        return this.exits.get(exitDirection);
    }

    // Method to retrieve area property by string
    propertyByString(property) {
        const propertyToLower = property.toLowerCase();
        return this[propertyToLower] || "Property not found";
    }

    removeExit(player, area, section, direction) {
        let rX = this.x;
        let rY = this.y;
        let rZ = this.z;

        switch (Exit.stringToExit(direction)) {
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
        }

        let toRoom = section.getRoomByCoordinates(rX, rY, rZ);
        if (toRoom == null) {
            return;
        }
        const strToExit = Exit.stringToExit(direction);
        if (strToExit != null) {
            this.exits.delete(strToExit);
            toRoom.exits.delete(Exit.oppositeExit(direction));
        } else {
            player.send(`Invalid exit direction!`);
            return;
        }

        player.send(`Exit removed successfully!`);
    }
}

module.exports = Room;