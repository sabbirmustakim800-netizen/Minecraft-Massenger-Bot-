const moment = require("moment-timezone");
const { readdirSync, readFileSync, writeFileSync, existsSync, unlinkSync, rm } = require("fs-extra");
const { join, resolve } = require("path");
const { execSync } = require("child_process");
const logger = require("./utils/log");
const login = require("Sabbir-fca");
const axios = require("axios");

const listPackage = JSON.parse(readFileSync("./package.json")).dependencies;
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

// Initialize Global Data Containers
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

// Load Configuration File
var configValue;
try {
    global.client.configPath = join(global.client.mainPath, "config.json");
    configValue = require(global.client.configPath);
    logger.log("Found file config.json", "[ GLOBAL BOT ]");
} catch {
    if (existsSync(global.client.configPath.replace(/\.json/g, "") + ".temp")) {
        configValue = readFileSync(global.client.configPath.replace(/\.json/g, "") + ".temp");
        configValue = JSON.parse(configValue);
        logger.log("Found file " + global.client.configPath.replace(/\.json/g, "") + ".temp");
    } else {
        return logger.log("config.json not found!", "error");
    }
}

try {
    for (const key in configValue) {
        global.config[key] = configValue[key];
    }
    logger.log("Config Loaded!");
} catch {
    return logger.log("Can't load config.json", "error");
}

const { Sequelize, sequelize } = require("./includes/database");

// Update config backup
writeFileSync(
    global.client.configPath + ".temp",
    JSON.stringify(global.config, null, 4),
    "utf-8"
);

// Load Language File
const langFile = readFileSync(
    __dirname + "/languages/" + (global.config.language || "en") + ".lang",
    { encoding: "utf-8" }
).split(/\r?\n|\r/);

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

// Global Localizer Function
global.getText = function (...args) {
    const langContainer = global.language;
    if (!langContainer.hasOwnProperty(args[0])) {
        throw __filename + " - Not found key language: " + args[0];
    }
    var text = langContainer[args[0]][args[1]];
    for (var i = args.length - 1; i > 1; i--) {
        const reg = new RegExp("%" + (i - 1), "g");
        text = text.replace(reg, args[i]);
    }
    return text;
};

// Load Facebook AppState & Login
try {
    var appStateFile = resolve(
        join(global.client.mainPath, global.config.APPSTATEPATH || "appstate.json")
    );
    var appState = require(appStateFile);
    logger.log(global.getText("mirai", "foundPathAppstate"));
} catch {
    return logger.log(global.getText("mirai", "notFoundPathAppstate"), "error");
}

function onBot({ models }) {
    login({ appState }, async (err, api) => {
        if (err) return logger(JSON.stringify(err), "error");

        api.setOptions(global.config.FCAOption);
        writeFileSync(appStateFile, JSON.stringify(api.getAppState(), null, "\t"));

        global.client.api = api;
        global.config.version = "1.2.14";
        global.client.timeStart = new Date().getTime();

        // Load Commands
        (function () {
            const commandFiles = readdirSync(join(global.client.mainPath, "Script/commands"))
                .filter(file => file.endsWith(".js") && !file.includes("example") && !global.config.commandDisabled.includes(file));

            for (const file of commandFiles) {
                try {
                    var command = require(join(global.client.mainPath, "Script/commands", file));

                    if (!command.config || !command.run || !command.config.commandCategory) {
                        throw new Error(global.getText("mirai", "errorFormat"));
                    }
                    if (global.client.commands.has(command.config.name || "")) {
                        throw new Error(global.getText("mirai", "nameExist"));
                    }

                    // Auto-install missing dependencies
                    if (command.config.dependencies && typeof command.config.dependencies === "object") {
                        for (const pkg in command.config.dependencies) {
                            const pkgPath = join(__dirname, "nodemodule", "node_modules", pkg);
                            try {
                                if (!global.nodemodule.hasOwnProperty(pkg)) {
                                    if (listPackage.hasOwnProperty(pkg) || listbuiltinModules.includes(pkg)) {
                                        global.nodemodule[pkg] = require(pkg);
                                    } else {
                                        global.nodemodule[pkg] = require(pkgPath);
                                    }
                                }
                            } catch {
                                logger.log(global.getText("mirai", "cantInstall", pkg, command.config.name), "warning");
                                execSync(`npm --package-lock false --save install ${pkg}@${command.config.dependencies[pkg] || ""}`, {
                                    stdio: "inherit",
                                    env: process.env,
                                    shell: true,
                                    cwd: join(__dirname, "nodemodule")
                                });
                                global.nodemodule[pkg] = require(pkg);
                            }
                        }
                    }

                    // Module Configuration Setup
                    if (command.config.envConfig) {
                        try {
                            for (const envKey in command.config.envConfig) {
                                if (typeof global.configModule[command.config.name] === "undefined") global.configModule[command.config.name] = {};
                                if (typeof global.config[command.config.name] === "undefined") global.config[command.config.name] = {};

                                if (typeof global.config[command.config.name][envKey] !== "undefined") {
                                    global.configModule[command.config.name][envKey] = global.config[command.config.name][envKey];
                                } else {
                                    global.configModule[command.config.name][envKey] = command.config.envConfig[envKey] || "";
                                }
                            }
                        } catch (e) {
                            throw new Error(global.getText("mirai", "loadedConfig", command.config.name, JSON.stringify(e)));
                        }
                    }

                    if (command.onLoad) {
                        try {
                            command.onLoad({ api, models });
                        } catch (e) {
                            throw new Error(global.getText("mirai", "cantOnload", command.config.name, JSON.stringify(e)), "error");
                        }
                    }

                    if (command.handleEvent) global.client.eventRegistered.push(command.config.name);
                    global.client.commands.set(command.config.name, command);
                    logger.log(global.getText("mirai", "successLoadModule", command.config.name));
                } catch (err) {
                    logger.log(global.getText("mirai", "failLoadModule", command.config.name, err), "error");
                }
            }
        })();

        // Load Events
        (function () {
            const eventFiles = readdirSync(join(global.client.mainPath, "Script/events"))
                .filter(file => file.endsWith(".js") && !global.config.eventDisabled.includes(file));

            for (const file of eventFiles) {
                try {
                    var event = require(join(global.client.mainPath, "Script/events", file));

                    if (!event.config || !event.run) {
                        throw new Error(global.getText("mirai", "errorFormat"));
                    }
                    if (global.client.events.has(event.config.name) || "") {
                        throw new Error(global.getText("mirai", "nameExist"));
                    }

                    global.client.events.set(event.config.name, event);
                    logger.log(global.getText("mirai", "successLoadModule", event.config.name));
                } catch (err) {
                    logger.log(global.getText("mirai", "failLoadModule", event.config.name, err), "error");
                }
            }
        })();

        console.log("Bot successfully initialized!");
    });
}
