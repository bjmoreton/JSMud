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
    brightBlue: "\x1b[34;1m",
    brightMagenta: "\x1b[35;1m",
    brightCyan: "\x1b[36;1m",
    brightWhite: "\x1b[37;1m",
  
    // Background color
    bgBlack: "\x1b[40m",
    bgRed: "\x1b[41m",
    bgGreen: "\x1b[42m",
    bgYellow: "\x1b[43m",
    bgBlue: "\x1b[44m",
    bgMagenta: "\x1b[45m",
    bgCyan: "\x1b[46m",
    bgWhite: "\x1b[47m",
  
    // Bright background color
    bgBrightBlack: "\x1b[40;1m",
    bgBrightRed: "\x1b[41;1m",
    bgBrightGreen: "\x1b[42;1m",
    bgBrightYellow: "\x1b[43;1m",
    bgBrightBlue: "\x1b[44;1m",
    bgBrightMagenta: "\x1b[45;1m",
    bgBrightCyan: "\x1b[46;1m",
    bgBrightWhite: "\x1b[47;1m",
  
    // Blinking text
    blink: "\x1b[5m",
  };

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

        return `${retString}${Colors.reset}`;
    }

  module.exports = { Colors, parseColors };