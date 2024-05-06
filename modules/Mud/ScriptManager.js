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
            const addAddStateFunction = new ivm.Reference(function (state) {
                objContext.exit.addState(state);
            });

            // Define addState globally within the isolated VM
            await context.evalClosure(`
                global.addState = function(state) {
                    $0.applySync(undefined, [state]);
                };
            `, [addAddStateFunction], { arguments: { copy: true }, result: { promise: true, copy: true } });
        }

        // Handle methods explicitly
        if (objContext.exit && typeof objContext.exit.removeState === 'function') {
            const addRemoveStateFunction = new ivm.Reference(function (state) {
                objContext.exit.removeState(state);
            });

            // Define removeState globally within the isolated VM
            await context.evalClosure(`
                global.removeState = function(state) {
                    $0.applySync(undefined, [state]);
                };
            `, [addRemoveStateFunction], { arguments: { copy: true }, result: { promise: true, copy: true } });
        }

        // Handle methods explicitly
        if (player && typeof player.send === 'function') {
            const addSendToPlayerFunction = new ivm.Reference(player.send.bind(player));

            // Define sendToPlayer globally within the isolated VM
            await context.evalClosure(`
                global.sendToPlayer = function(message) {
                    $0.applySync(null, [message]);
                };
            `, [addSendToPlayerFunction], { arguments: { copy: true }, result: { promise: true, copy: true } });
        }

        // Handle methods explicitly
        if (player && typeof player.hasItem === 'function') {
            const addHasItemFunction = new ivm.Reference(player.hasItem.bind(player));

            // Define hasItem globally within the isolated VM
            await context.evalClosure(`
                global.hasItem = function(...args) {
                    return $0.applySync(null, args);
                };
            `, [addHasItemFunction], { arguments: { copy: true }, result: { promise: true, copy: true } });
        }

        // bind all exit functions
        await this.bindExitFunctions(context, objContext.exit);

        // Execute the script
        scriptCode = "global.result = (function() {\r\n" + scriptCode + "\r\n})();";
        const script = await this.isolate.compileScript(scriptCode);
        try {
            await script.run(context);

            // Now retrieve the result from the global object
            const result = await context.eval('global.result');
            return result;  // Return the result to the caller
        } catch (error) {
            console.error(error);
        }
    }

    async bindExitFunctions(context, exit) {
        const functionsToBind = {
            canClose: exit.canClose.bind(exit),
            canLock: exit.canLock.bind(exit),
            isClosed: exit.isClosed.bind(exit),
            isLocked: exit.isLocked.bind(exit),
            isOpened: exit.isOpened.bind(exit)
        };

        for (const [funcName, func] of Object.entries(functionsToBind)) {
            const funcReference = new ivm.Reference(func);
            await context.evalClosure(`
                global.${funcName} = function(...args) {
                    return $0.applySync(undefined, args);
                };
            `, [funcReference], { arguments: { copy: true }, result: { promise: true, copy: true } });
        }
    }
}

module.exports = ScriptManager;