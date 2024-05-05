class Emote {
    constructor(name, solo, you, target, others, othersSolo) {
        this.name = name;
        this.solo = solo;
        this.you = you;
        this.target = target;
        this.others = others;
        this.othersSolo = othersSolo
    }
}

module.exports = Emote;