const bcrypt = require('bcrypt');

function formatDate(date) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
}

function formatTime(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

function getAllFunctionProperties(obj, ignoreList = []) {
    const result = {};

    function recurse(currentObj, currentResult) {
        // Get both instance properties and prototype functions
        const properties = Object.getOwnPropertyNames(currentObj);
        const proto = Object.getPrototypeOf(currentObj);
        if (proto) {
            properties.push(...Object.getOwnPropertyNames(proto));
        }

        properties.forEach(prop => {
            if (!ignoreList.includes(prop) && !(prop in currentResult)) {
                const value = currentObj[prop];
                if (typeof value === 'function') {
                    currentResult[prop] = value;
                } else if (value && typeof value === 'object' && !Array.isArray(value)) {
                    currentResult[prop] = {};
                    recurse(value, currentResult[prop]);
                } else {
                    currentResult[prop] = value;
                }
            }
        });
    }

    recurse(obj, result);
    return result;
}


function generateRandomString(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

async function hashPassword(password) {
    try {
        const hashedPassword = await bcrypt.hash(password, 10); // 10 is the number of salt rounds
        return hashedPassword;
    } catch (error) {
        console.error('Error hashing password:', error);
        throw error;
    }
}

function inRange(value, low, high) {
    return value > low && value < high;
}

function isNumber(value) {
    return typeof value === 'number' && !Number.isNaN(value);
}

async function verifyPassword(plaintextPassword, hashedPassword) {
    try {
        const result = await bcrypt.compare(plaintextPassword, hashedPassword);
        return result;
    } catch (error) {
        console.error('Error verifying password:', error);
        throw error;
    }
}

module.exports = { formatTime, formatDate, getAllFunctionProperties, generateRandomString, hashPassword, inRange, isNumber, verifyPassword };