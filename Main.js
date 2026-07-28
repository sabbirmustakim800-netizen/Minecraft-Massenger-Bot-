const moment = require("moment-timezone");
const { readdirSync, readFileSync, writeFileSync, existsSync, unlinkSync, rm } = require("fs-extra");
const { join, resolve } = require("path");
const { execSync } = require("child_process");
const logger = require("./utils/log");
const login = require("Sabbir-fca");
const axios = require("axios");

const listPackage = JSON.parse(readFileSync("./package.json")).dependencies || {};
const listbuiltinModules = require("module").builtinModules;

const BOT_ART = `
  ██████╗░██████╗░██████╗░██████╗░████████╗
  ██╔══██╗██╔══██╗██╔══██╗██╔══██╗╚══██╔══╝
  ██████╔╝██████╔╝██████╔╝██████╔╝░░░██║░░░
  ██╔══██╗██╔══██╗██╔══██╗██╔══██╗░░░██║░░░
  ██████╔╝██║░░██║██████╔╝██║░░██║░░░██║░░░
  ╚═════╝░╚═╝░░╚═╝╚═════╝░╚═╝░░╚═╝░░░╚═╝░░░
            ER SHAHADAT SAHU
             FB BOT OWNER
`;

console.log(BOT_ART);

// Global State
global.client = {
    commands: new Map(),
    events: new Map(),
    cooldowns: new Map(),
    eventRegistered: new Array(),
    handleSchedule: new Array(),
    handleReaction: new Array(),
    handleReply: new Array(),
    mainPath: process.cwd(),
    configPath: new String(),
    getTime: function (type) {
        switch (type) {
            case "seconds": return "" + moment.tz("Asia/Dhaka").format("ss");
            case "minutes": return "" + moment.tz("Asia/Dhaka").format("mm");
            case "hours": return "" + moment.tz("Asia/Dhaka").format("HH");
            case "date": return "" + moment.tz("Asia/Dhaka").format("DD");
            case "month": return "" + moment.tz("Asia/Dhaka").format("MM");
            case "year": return "" + moment.tz("Asia/Dhaka").format("YYYY");
            case "fullHour": return "" + moment.tz("Asia/Dhaka").format("HH:mm:ss");
            case "fullTime": return "" + moment.tz("Asia/Dhaka").format("HH:mm:ss DD/MM/YYYY");
            case "fullYear": return "" + moment.tz("Asia/Dhaka").format("DD/MM/YYYY");
        }
    }
};

global.data = {
    threadInfo: new Map(),
    threadData: new Map(),
    userName: new Map(),
    userBanned: new Map(),
    threadBanned: new Map(),
    commandBanned: new Map(),
    threadAllowNSFW: new Array(),
    allUserID: new Array(),
    allCurrenciesID: new Array(),
    allThreadID: new Array()
};

global.nodemodule = new Object();
global.config = new Object();
global.configModule = new Object();
global.moduleData = new Array();
global.language = new Object();

// 1. Config Loader
var configValue;
try {
    global.client.configPath = join(global.client.mainPath, "config.json");
    configValue = require(global.client.configPath);
    logger.log("Found config.json", "[ GLOBAL BOT ]");
} catch {
    if (existsSync(global.client.configPath.replace(/\.json/g, "") + ".temp")) {
        configValue = readFileSync(global.client.configPath.replace(/\.json/g, "") + ".temp");
        configValue = JSON.parse(configValue);
        logger.log("Loaded backup config.temp", "[ GLOBAL BOT ]");
    } else {
        return logger.log("config.json not found!", "error");
    }
}

try {
    for (const key in configValue) {
        global.config[key] = configValue[key];
    }
    logger.log("Config Loaded successfully!", "[ GLOBAL BOT ]");
} catch {
    return logger.log("Can't load config.json", "error");
}

// Config backup write
writeFileSync(
    global.client.configPath + ".temp",
    JSON.stringify(global.config, null, 4),
    "utf-8"
);

// 2. Language Loader
try {
    const langFilePath = join(__dirname, "languages", (global.config.language || "en") + ".lang");
    if (existsSync(langFilePath)) {
        const langFile = readFileSync(langFilePath, { encoding: "utf-8" }).split(/\r?\n|\r/);
        const langData = langFile.filter(line => line.indexOf("#") !== 0 && line !== "");

        for (const item of langData) {
            const getSeparator = item.indexOf("=");
            const itemKey = item.slice(0, getSeparator);
            const itemValue = item.slice(getSeparator + 1, item.length);
            const head = itemKey.slice(0, itemKey.indexOf("."));
            const key = itemKey.replace(head + ".", "");
            const value = itemValue.replace(/\\n/gi, "\n");

            if (typeof global.language[head] === "undefined") {
                global.language[head] = new Object();
            }
            global.language[head][key] = value;
        }
    }
} catch (e) {
    logger.log("Language file load warning: " + e.message, "warning");
}

global.getText = function (...args) {
    const langContainer = global.language;
    if (!langContainer || !langContainer.hasOwnProperty(args[0])) {
        return args[1] || args[0];
    }
    var text = langContainer[args[0]][args[1]] || args[1];
    for (var i = args.length - 1; i > 1; i--) {
        const reg = new RegExp("%" + (i - 1), "g");
        text = text.replace(reg, args[i]);
    }
    return text;
};

// 3. Detect Correct Command/Event Paths Automatically
let commandsPath = join(global.client.mainPath, "Script/commands");
let eventsPath = join(global.client.mainPath, "Script/events");

if (!existsSync(commandsPath)) {
    if (existsSync(join(global.client.mainPath, "modules/commands"))) {
        commandsPath = join(global.client.mainPath, "modules/commands");
    } else if (existsSync(join(global.client.mainPath, "commands"))) {
        commandsPath = join(global.client.mainPath, "commands");
    }
}

if (!existsSync(eventsPath)) {
    if (existsSync(join(global.client.mainPath, "modules/events"))) {
        eventsPath = join(global.client.mainPath, "modules/events");
    } else if (existsSync(join(global.client.mainPath, "events"))) {
        eventsPath = join(global.client.mainPath, "events");
    }
}

// 4. AppState Check & Login
var appStateFile = resolve(
    join(global.client.mainPath, global.config.APPSTATEPATH || "appstate.json")
);

if (!existsSync(appStateFile)) {
    return logger.log("appstate.json file not found! Please provide a valid appstate.", "error");
}

var appState = require(appStateFile);

login({ appState }, async (err, api) => {
    if (err) return logger.log("Facebook Login Error: " + JSON.stringify(err), "error");

    api.setOptions(global.config.FCAOption || { listenEvents: true, selfListen: false });
    writeFileSync(appStateFile, JSON.stringify(api.getAppState(), null, "\t"));

    global.client.api = api;
    global.config.version = "1.2.14";
    global.client.timeStart = new Date().getTime();

    // Load Commands
    if (existsSync(commandsPath)) {
        const commandFiles = readdirSync(commandsPath)
            .filter(file => file.endsWith(".js") && !file.includes("example") && !(global.config.commandDisabled || []).includes(file));

        for (const file of commandFiles) {
            try {
                var command = require(join(commandsPath, file));
                if (!command.config || !command.run) continue;

                if (command.config.dependencies && typeof command.config.dependencies === "object") {
                    for (const pkg in command.config.dependencies) {
                        try {
                            global.nodemodule[pkg] = require(pkg);
                        } catch {
                            execSync(`npm install ${pkg}@${command.config.dependencies[pkg] || "latest"}`, { stdio: "ignore" });
                            global.nodemodule[pkg] = require(pkg);
                        }
                    }
                }

                if (command.handleEvent) global.client.eventRegistered.push(command.config.name);
                global.client.commands.set(command.config.name, command);
                logger.log(`Loaded Command: ${command.config.name}`, "[ COMMAND ]");
            } catch (err) {
                logger.log(`Failed to load command ${file}: ${err.message}`, "error");
            }
        }
    }

    // Load Events
    if (existsSync(eventsPath)) {
        const eventFiles = readdirSync(eventsPath)
            .filter(file => file.endsWith(".js") && !(global.config.eventDisabled || []).includes(file));

        for (const file of eventFiles) {
            try {
                var event = require(join(eventsPath, file));
                if (!event.config || !event.run) continue;

                global.client.events.set(event.config.name, event);
                logger.log(`Loaded Event: ${event.config.name}`, "[ EVENT ]");
            } catch (err) {
                logger.log(`Failed to load event ${file}: ${err.message}`, "error");
            }
        }
    }

    logger.log(`Bot started successfully! Premium FCA active.`, "[ SUCCESS ]");

    // 5. Message Listener (Fixes the non-responsive bot issue)
    const handleListener = require("./includes/listen")({ api });
    
    api.listenMqtt((error, event) => {
        if (error) {
            if (JSON.stringify(error).includes("404")) {
                logger.log("Connection lost, retrying...", "error");
            }
            return;
        }
        
        // Execute handleListener if available, or basic command trigger
        if (typeof handleListener === "function") {
            handleListener(event);
        } else if (event.type === "message" || event.type === "message_reply") {
            const prefix = global.config.PREFIX || "!";
            if (!event.body || !event.body.startsWith(prefix)) return;

            const args = event.body.slice(prefix.length).trim().split(/ +/);
            const commandName = args.shift().toLowerCase();
            const command = global.client.commands.get(commandName);

            if (command) {
                try {
                    command.run({ api, event, args, global });
                } catch (e) {
                    api.sendMessage(`Error executing command: ${e.message}`, event.threadID);
                }
            }
        }
    });
});
