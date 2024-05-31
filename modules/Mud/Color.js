/**
 * An object containing ANSI escape codes for various colors and text effects.
 * @namespace Colors
 * @property {string} reset - Reset all attributes.
 * @property {string} black - Black text color.
 * @property {string} darkGrey - Dark grey text color.
 * @property {string} red - Red text color.
 * @property {string} green - Green text color.
 * @property {string} yellow - Yellow text color.
 * @property {string} orange - Orange text color.
 * @property {string} blue - Blue text color.
 * @property {string} magenta - Magenta text color.
 * @property {string} cyan - Cyan text color.
 * @property {string} lightBlue - Light blue text color.
 * @property {string} white - White text color.
 * @property {string} grey - Grey text color.
 * @property {string} brightBlack - Bright black text color.
 * @property {string} brightRed - Bright red text color.
 * @property {string} brightGreen - Bright green text color.
 * @property {string} brightYellow - Bright yellow text color.
 * @property {string} brightBlue - Bright blue text color.
 * @property {string} brightMagenta - Bright magenta text color.
 * @property {string} brightCyan - Bright cyan text color.
 * @property {string} brightWhite - Bright white text color.
 * @property {string} bgBlack - Black background color.
 * @property {string} bgRed - Red background color.
 * @property {string} bgGreen - Green background color.
 * @property {string} bgYellow - Yellow background color.
 * @property {string} bgBlue - Blue background color.
 * @property {string} bgMagenta - Magenta background color.
 * @property {string} bgCyan - Cyan background color.
 * @property {string} bgWhite - White background color.
 * @property {string} bgBrightBlack - Bright black background color.
 * @property {string} bgBrightRed - Bright red background color.
 * @property {string} bgBrightGreen - Bright green background color.
 * @property {string} bgBrightYellow - Bright yellow background color.
 * @property {string} bgBrightBlue - Bright blue background color.
 * @property {string} bgBrightMagenta - Bright magenta background color.
 * @property {string} bgBrightCyan - Bright cyan background color.
 * @property {string} bgBrightWhite - Bright white background color.
 * @property {string} blink - Blinking text.
 */
const Colors = {
  // Reset
  reset: "\x1b[0m",

  // Text color
  black: "\x1b[30m",
  darkGrey: "\x1b[1;30m",
  red: "\x1b[0;31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  orange: "\x1b[0;33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  lightBlue: "\x1b[1;36m",
  white: "\x1b[37m",
  grey: "\x1b[0;37m",

  // Bright text color
  brightBlack: "\x1b[30;1m",
  brightRed: "\x1b[31;1m",
  brightGreen: "\x1b[32;1m",
  brightYellow: "\x1b[33;1m",
  brightOrange: "\x1b[38;5;214;1m",
  brightBlue: "\x1b[34;1m",
  brightMagenta: "\x1b[35;1m",
  brightCyan: "\x1b[36;1m",
  brightWhite: "\x1b[37;1m",

  // Background color
  bgBlack: "\x1b[40m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgOrange: "\x1b[48;5;208m",
  bgBlue: "\x1b[44m",
  bgMagenta: "\x1b[45m",
  bgCyan: "\x1b[46m",
  bgWhite: "\x1b[47m",

  // Bright background color
  bgBrightBlack: "\x1b[40;1m",
  bgBrightRed: "\x1b[41;1m",
  bgBrightGreen: "\x1b[42;1m",
  bgBrightYellow: "\x1b[43;1m",
  bgBrightOrange: "\x1b[48;5;214;1m",
  bgBrightBlue: "\x1b[44;1m",
  bgBrightMagenta: "\x1b[45;1m",
  bgBrightCyan: "\x1b[46;1m",
  bgBrightWhite: "\x1b[47;1m",

  // Blinking text
  blink: "\x1b[5m",

  // 256 Colors
  color256: (color) => `\x1b[38;5;${color}m`,
  bgColor256: (color) => `\x1b[48;5;${color}m`,
};

// Function to replace }# with a color code
const replaceWithColorCode = (input) => {
  return input.replace(/}(\d+)/g, (match, p1) => {
      // Convert captured group to a number and create a color code
      let colorCode = Colors.color256(Number(p1));
      return `${colorCode}`;
  });
};

/**
* Parses a string and replaces color codes with their corresponding ANSI escape codes.
* 
* @param {string} stringToParse - The string to parse for color codes.
* @returns {string} The parsed string with ANSI escape codes.
*/
function parseColors(stringToParse) {
  let retString = stringToParse;

  retString = retString.replace(/&x/g, Colors.black);
  retString = retString.replace(/&B/g, Colors.blue);
  retString = retString.replace(/&c/g, Colors.cyan);
  retString = retString.replace(/&b/g, Colors.brightBlue);
  retString = retString.replace(/&g/g, Colors.brightGreen);
  retString = retString.replace(/&z/g, Colors.brightBlack);
  retString = retString.replace(/&r/g, Colors.brightRed);
  retString = retString.replace(/&G/g, Colors.green);
  retString = retString.replace(/&w/g, Colors.brightWhite);
  retString = retString.replace(/&C/g, Colors.lightBlue);
  retString = retString.replace(/&O/g, Colors.orange);
  retString = retString.replace(/&P/g, Colors.brightMagenta);
  retString = retString.replace(/&p/g, Colors.magenta);
  retString = retString.replace(/&R/g, Colors.red);
  retString = retString.replace(/&W/g, Colors.white);
  retString = retString.replace(/&y/g, Colors.yellow);
  retString = retString.replace(/&Y/g, Colors.brightYellow);
  retString = retString.replace(/&~/g, Colors.reset);

  retString = replaceWithColorCode(retString);

  // for(let i = 0; i <= 256; i++) {
  //   console.log(`${Colors.color256(i)}${i}${Colors.reset}`);
  // }

  return `${retString}${Colors.reset}`;
}

module.exports = { Colors, parseColors };
