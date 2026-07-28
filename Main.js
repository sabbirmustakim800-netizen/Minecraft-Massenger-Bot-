const moment = require("moment-timezone");
const { readdirSync, readFileSync, writeFileSync, existsSync } = require("fs-extra");
const { join, resolve } = require("path");
const { execSync } = require("child_process");
const rawLogger = require("./utils/log");
const login = require("fca-unofficial");
const axios = require("axios");

// Safe Logger Wrapper
const logger = (msg, type = "[ BOT ]") => {
    if (typeof rawLogger === "function") {
        rawLogger(msg, type);
    } else if (rawLogger && typeof rawLogger.log === "function") {
        rawLogger.log(msg, type);
    } else {
        console.log(`[ ${type} ] ${msg}`);
    }
};

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

// Global State Setup
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
global.client.configPath = join(global.client.mainPath, "config.json");

if (existsSync(global.client.configPath)) {
    try {
        configValue = require(global.client.configPath);
        logger("Found config.json", "[ GLOBAL BOT ]");
    } catch (e) {
        logger("Error parsing config.json", "error");
    }
} else if (existsSync(global.client.configPath.replace(/\.json/g, "") + ".temp")) {
    try {
        configValue = JSON.parse(readFileSync(global.client.configPath.replace(/\.json/g, "") + ".temp"));
        logger("Loaded backup config.temp", "[ GLOBAL BOT ]");
    } catch (e) {
        logger("Error reading config.temp", "error");
    }
} else {
    logger("config.json not found in root directory!", "error");
    process.exit(1);
}

try {
    for (const key in configValue) {
        global.config[key] = configValue[key];
    }
    logger("Config Loaded successfully!", "[ GLOBAL BOT ]");
} catch {
    logger("Can't load config.json", "error");
    process.exit(1);
}

// Config backup write
try {
    writeFileSync(
        global.client.configPath + ".temp",
        JSON.stringify(global.config, null, 4),
        "utf-8"
    );
} catch (e) {}

// 2. Detect Command & Event Paths
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

// 3. AppState Check & Login
var appStateFile = resolve(
    join(global.client.mainPath, global.config.APPSTATEPATH || "appstate.json")
);

if (!existsSync(appStateFile)) {
    logger("appstate.json file not found! Please check your root directory.", "error");
    process.exit(1);
}

var appState;
try {
    appState = require(appStateFile);
} catch (e) {
    logger("Failed to parse appstate.json!", "error");
    process.exit(1);
}

login({ appState }, async (err, api) => {
    if (err) {
        logger("Facebook Login Error: " + JSON.stringify(err), "error");
        return;
    }

    api.setOptions(global.config.FCAOption || { listenEvents: true, selfListen: false });
    try {
        writeFileSync(appStateFile, JSON.stringify(api.getAppState(), null, "\t"));
    } catch (e) {}

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
                logger(`Loaded Command: ${command.config.name}`, "[ COMMAND ]");
            } catch (err) {
                logger(`Failed to load command ${file}: ${err.message}`, "error");
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
                logger(`Loaded Event: ${event.config.name}`, "[ EVENT ]");
            } catch (err) {
                logger(`Failed to load event ${file}: ${err.message}`, "error");
            }
        }
    }

    logger("Bot started successfully!", "[ SUCCESS ]");

    // Message Listener
    api.listenMqtt((error, event) => {
        if (error) return;

        if (event.type === "message" || event.type === "message_reply") {
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
