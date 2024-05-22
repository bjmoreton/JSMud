class StoppableInterval {
    constructor(callback, delay) {
        this.callback = callback;
        this.delay = delay;
        this.intervalId = null;
    }

    setDelay(delay) {
        this.delay = delay;
    }

    start() {
        this.intervalId = setInterval(this.callback, this.delay);
    }

    stop() {
        clearInterval(this.intervalId);
    }
}

module.exports = StoppableInterval;