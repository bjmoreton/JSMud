const bcrypt = require('bcrypt');

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
    return typeof value === 'number' && !Number.isNaN(value);
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

module.exports = { formatTime, formatDate, generateRandomString, hashPassword, inRange, isNumber, verifyPassword };
