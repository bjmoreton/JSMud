const bcrypt = require('bcrypt');
const { execFile } = require('child_process');

/**
 * Adds missing properties from a source object to a destination object.
 * @param {Object} source - The object to copy properties from.
 * @param {Object} destination - The object to copy properties to.
 */
function addMissingProperties(source, destination) {
    for (const key in source) {
        if (!(key in destination)) {
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

async function gitPull() {
    return new Promise((resolve, reject) => {
        execFile('git', ['pull'], (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing git pull: ${error.message}`);
                return reject(error.message);
            }

            if (stderr) {
                console.error(`git pull stderr: ${stderr}`);
                return reject(stderr);
            }

            resolve(stdout);
        });
    });
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
    return !Number.isNaN(Number(value));
}

/**
 * Checks if a string is valid (not empty or only whitespace).
 * @param {string} string - The string to check.
 * @returns {boolean} True if the string is valid, false otherwise.
 */
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
    const rows = [];
    const longRows = [];
    const columnWidth = 22; // Define the width for each column
    const totalWidth = columnWidth * 3 + 10; // Total width for 3 columns + padding and borders
    const twoColumnWidth = columnWidth * 2 + 7; // Total width for 2 columns + padding and borders

    function collectKeys(obj, prefix) {
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                const value = obj[key];
                const formattedKey = prefix ? `${prefix}.${key}` : key;

                if (typeof value === 'object' && value !== null) {
                    collectKeys(value, formattedKey);
                } else {
                    const row = padRight(`${formattedKey}: ${value}`, columnWidth);
                    if (stripAnsiCodes(row).length > columnWidth) {
                        longRows.push(row);
                    } else {
                        rows.push(row);
                    }
                }
            }
        }
    }

    function padCenter(str, width) {
        const cleanedStr = stripAnsiCodes(str);
        const padding = Math.max(width - cleanedStr.length, 0);
        const paddingLeft = Math.floor(padding / 2);
        const paddingRight = padding - paddingLeft;
        return ' '.repeat(paddingLeft) + str + ' '.repeat(paddingRight);
    }

    function padRight(str, width) {
        const cleanedStr = stripAnsiCodes(str);
        if (cleanedStr.length > width) {
            return str; // Don't pad if the string is too long
        }
        return str + ' '.repeat(Math.max(width - cleanedStr.length, 0));
    }

    function createTable(rows, longRows) {
        let table = '';
        const border = '-'.repeat(totalWidth) + '\n';

        // Add table header
        table += border;
        table += `|${padCenter(' Information ', totalWidth - 2)}|\n`;
        table += border;

        // Add key-value pairs in rows of 3 columns
        for (let i = 0; i < rows.length; i += 3) {
            const lineItems = rows.slice(i, i + 3);
            while (lineItems.length < 3) {
                lineItems.push(padRight('', columnWidth));
            }
            const line = lineItems.join(' | ');
            table += `| ${line} |\n`;
            table += border;
        }

        // Add long rows at the end, trying to fit two columns if possible
        for (let i = 0; i < longRows.length; i++) {
            let line;
            if (i + 1 < longRows.length && (stripAnsiCodes(longRows[i]).length + stripAnsiCodes(longRows[i + 1]).length + 3) <= twoColumnWidth) {
                line = `${padRight(longRows[i], columnWidth)} | ${padRight(longRows[i + 1], columnWidth)}`;
                i++;
            } else {
                line = longRows[i];
            }
            table += `| ${padRight(line, totalWidth - 4)} |\n`;
            table += border;
        }

        return table;
    }

    collectKeys(obj, prefix);

    const table = createTable(rows, longRows);
    player.send(table);
}

/**
 * Converts a string to a boolean.
 * @param {string} str - The string to convert.
 * @returns {boolean} The converted boolean value.
 */
function stringToBoolean(str) {
    if (typeof str !== 'string') {
        if (typeof str === 'boolean') return str;
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

function stripAnsiCodes(str) {
    let output = str.replace(/&./g, '');
    output = output.replace(/}(\d+)/g, '');
    return output;
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

module.exports = {
    addMissingProperties,
    formatTime,
    formatDate,
    getRandomNumberInclusive,
    generateRandomString,
    gitPull,
    hashPassword,
    inRange,
    isNumber,
    isValidString,
    sendNestedKeys,
    stringToBoolean,
    stripAnsiCodes,
    verifyPassword
};
