const bcrypt = require('bcrypt');

/**
 * Adds missing properties from a source object to a destination object.
 * @param {Object} source - The object to copy properties from.
 * @param {Object} destination - The object to copy properties to.
 */
function addMissingProperties(source, destination) {
    // Iterate over each property in the source object
    for (const key in source) {
        // Check if the property exists in the destination object
        if (!(key in destination)) {
            // If the property does not exist, copy it from the source
            destination[key] = source[key];
        }
    }
}

/**
 * Formats a date object into a string in MM/DD/YYYY format.
 * @param {Date} date - The date object to format.
 * @returns {string} Formatted date as a string.
 */
function formatDate(date) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
}

/**
 * Formats a date object into a time string in HH:MM:SS format.
 * @param {Date} date - The date object to format.
 * @returns {string} Formatted time as a string.
 */
function formatTime(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

/**
 * Generates a random number between low and high inclusive.
 *
 * @param {number} low - The lower bound (inclusive).
 * @param {number} high - The upper bound (inclusive).
 * @returns {number} A random number between low and high inclusive.
 */
function getRandomNumberInclusive(low, high) {
    return Math.floor(Math.random() * (high - low + 1)) + low;
}

/**
 * Generates a random alphanumeric string of a specified length.
 * @param {number} length - The length of the string to generate.
 * @returns {string} A random alphanumeric string.
 */
function generateRandomString(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

/**
 * Hashes a plaintext password using bcrypt with a specified number of salt rounds.
 * @param {string} password - The plaintext password to hash.
 * @returns {Promise<string>} A promise that resolves to the hashed password.
 */
async function hashPassword(password) {
    try {
        const hashedPassword = await bcrypt.hash(password, 10); // 10 is the number of salt rounds
        return hashedPassword;
    } catch (error) {
        console.error('Error hashing password:', error);
        throw error;
    }
}

/**
 * Checks if a value is within a specified range (exclusive).
 * @param {number} value - The value to check.
 * @param {number} low - The lower bound of the range.
 * @param {number} high - The upper bound of the range.
 * @returns {boolean} True if the value is within the range, false otherwise.
 */
function inRange(value, low, high) {
    return value > low && value < high;
}

/**
 * Determines if a variable is strictly a number and not NaN.
 * @param {any} value - The value to check.
 * @returns {boolean} True if the value is a number and not NaN, false otherwise.
 */
function isNumber(value) {
    return !Number.isNaN(parseInt(value));
}

function isValidString(string) {
    if (!string || (typeof string === 'string' && string.trim().length === 0)) {
        return false;
    } else {
        return true;
    }
}

/**
 * Recursively sends keys and values from a nested object to the player.
 * @param {Object} player - The player object.
 * @param {Object} obj - The object to be traversed.
 * @param {string} [prefix=''] - The prefix for the current key path (used for nested objects).
 */
function sendNestedKeys(player, obj, prefix = '') {
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            const value = obj[key];
            const formattedKey = prefix ? `${prefix}.${key}` : key;

            if (typeof value === 'object' && value !== null) {
                // Recursively handle nested objects
                sendNestedKeys(player, value, formattedKey);
            } else {
                // Send the key-value pair to the player
                player.send(`${formattedKey}: ${value}`);
            }
        }
    }
}

function stringToBoolean(str) {
    if (typeof str !== 'string') {
        return false;
    }

    switch (str.trim().toLowerCase()) {
        case "true":
        case "yes":
        case "1":
            return true;
        case "false":
        case "no":
        case "0":
            return false;
        default:
            return false;
    }
}

/**
 * Verifies a plaintext password against a hashed password.
 * @param {string} plaintextPassword - The plaintext password to verify.
 * @param {string} hashedPassword - The hashed password to compare against.
 * @returns {Promise<boolean>} A promise that resolves to a boolean indicating if the password verification was successful.
 */
async function verifyPassword(plaintextPassword, hashedPassword) {
    try {
        const result = await bcrypt.compare(plaintextPassword, hashedPassword);
        return result;
    } catch (error) {
        console.error('Error verifying password:', error);
        throw error;
    }
}

module.exports = { addMissingProperties, formatTime, formatDate, getRandomNumberInclusive, generateRandomString, hashPassword, inRange, isNumber, isValidString, sendNestedKeys, stringToBoolean, verifyPassword };
