const MUDServer = require('./MUDServer.js');

/**
 * Initializes and starts the MUD server.
 * @module StartMUDServer
 */

/**
 * The main entry point for the MUD server.
 * Creates an instance of MUDServer and starts it.
 */
const mudServer = new MUDServer();

/**
 * Starts the MUD server.
 * The server will begin listening for connections on the specified port.
 */
mudServer.start();
