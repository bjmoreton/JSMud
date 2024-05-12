class RoomState {
    static Flags = {
        None: 0,
        NoEmote: 1 << 0,
        NoTalk: 1 << 1,
    }

    constructor(defaultState) {
        this.flags = defaultState.flags ?? RoomState.Flags.None;
    }
}

module.exports = RoomState;