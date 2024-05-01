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

    constructor(area, section, x, y, z, direction) {
        this.area = area;
        this.section = section;
        this.x = x;
        this.y = y;
        this.z = z;
        this.direction = Exit.stringToExit(direction);
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
}

module.exports = Exit;