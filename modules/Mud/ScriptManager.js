const ivm = require('isolated-vm');

class ScriptManager {
    constructor() {
        this.isolate = new ivm.Isolate({ memoryLimit: 128 }); // Set memory limit for the isolate
    }

    async executeExitScript(scriptCode, objContext) {
        const context = await this.isolate.createContext();
        const jail = context.global;
        const player = objContext.player.obj;
        delete objContext.player.obj;

        await jail.set('global', jail.derefInto());

        // Pass non-function properties as ExternalCopy
        jail.setSync('exit', new ivm.ExternalCopy(objContext.exit).copyInto());
        jail.setSync('exitStates', new ivm.ExternalCopy(objContext.exitStates).copyInto());
        jail.setSync('player', new ivm.ExternalCopy(objContext.player).copyInto());

        // Expose log function
        const logFunction = new ivm.Reference(function (message) {
            console.log(message);
        });

        await context.evalClosure(`
                global.log = function(message) {
                    $0.applySync(undefined, [message]);
                }`, [logFunction], { arguments: { copy: true }, result: { promise: true, copy: true } });

        // Expose sendToRoom function
        const sendToRoomFunction = new ivm.Reference(function (message) {
            global.mudEmitter.emit('sendToRoom', player, message, [player.username], message);
        });

        await context.evalClosure(`
                global.sendToRoom = function(message) {
                    $0.applySync(undefined, [message]);
                }`, [sendToRoomFunction], { arguments: { copy: true }, result: { promise: true, copy: true } });

        // Handle methods explicitly
        if (objContext.exit && typeof objContext.exit.addState === 'function') {
            const addStateFunction = new ivm.Reference(function (state) {
                objContext.exit.addState(state);
            });

            // Define addState globally within the isolated VM
            await context.evalClosure(`
                global.addState = function(state) {
                    $0.applySync(undefined, [state]);
                };
            `, [addStateFunction], { arguments: { copy: true }, result: { promise: true, copy: true } });
        }

        // Handle methods explicitly
        if (objContext.exit && typeof objContext.exit.removeState === 'function') {
            const removeStateFunction = new ivm.Reference(function (state) {
                objContext.exit.removeState(state);
            });

            // Define removeState globally within the isolated VM
            await context.evalClosure(`
                        global.removeState = function(state) {
                            $0.applySync(undefined, [state]);
                        };
                    `, [removeStateFunction], { arguments: { copy: true }, result: { promise: true, copy: true } });
        }

        // Handle methods explicitly
        if (player && typeof player.send === 'function') {
            const addSendFunction = new ivm.Reference(player.send.bind(player));

            // Define sendToPlayer globally within the isolated VM
            await context.evalClosure(`
                        global.sendToPlayer = function(message) {
                            $0.applySync(null, [message]);
                        };
                    `, [addSendFunction], { arguments: { copy: true }, result: { promise: true, copy: true } });
        }

        // Execute the script
        const script = await this.isolate.compileScript(scriptCode);
        try {
            await script.run(context);
        } catch (error) {
            console.error(error);
        }
    }
}

module.exports = ScriptManager;