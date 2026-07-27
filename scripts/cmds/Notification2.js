const { getStreamsFromAttachment } = global.utils;

module.exports = {
    config: {
        name: "notification2",
        aliases: ["notify2", "noti2"],
        version: "2.4",
        author: "Rasel Mahmud",
        countDown: 5,
        role: 2,
        description: "Send stylish notification to all groups and forward replies to admin",
        category: "owner",
        envConfig: {
            delayPerGroup: 250,
            adminID: "ADMIN_USER_ID" // <-- Replace with Sabbir id
        }
    },

    langs: {
        en: {
            missingMessage: "Please enter the message you want to send",
            autoReplyMessage: "📌 Thanks for your reply! Admin 亗🅼🅰ᥫᩣ🅼ᥫᩣ🆄🅽×͜×  will be notified.",
            sentNotification: "✅ Sent notification to %1 groups",
            errorNotification: "❌ Failed to send to %1 groups"
        }
    },

    onStart: async function ({ message, api, event, args, envCommands, threadsData, getLang }) {
        if (!args[0]) return message.reply(getLang("missingMessage"));

        const adminID = envCommands[this.config.name].adminID;
        const senderName = "亗🅼🅰ᥫᩣ🅼ᥫᩣ🆄🅽×͜×";

        const allThreads = (await threadsData.getAll()).filter(t => t.isGroup);

        // notification body (Front font + English only)
        const textMessage = `╔═══❰ ✨𝙰𝙻𝙻 𝙲𝙷𝙰𝚃 𝙱𝙾𝚇𝙴𝚂✨ ❱══╗
📢 𝙽𝚘𝚝𝚒𝚌𝚎 from 𝙰𝙳𝙼𝙸𝙽 ${senderName} 📢
───────────────────────
${args.join(" ")}
───────────────────────
💌 Sent with love by  ♡┋ 𝙋𝙊𝙊𝙆𝙄𝙀 ᥫ᭡🎀🙂
╚═══════════════════╝`;

        const sentThreads = [];

        for (const thread of allThreads) {
            try {
                const sentMsg = await api.sendMessage({ body: textMessage }, thread.threadID);
                sentThreads.push({ threadID: thread.threadID, messageID: sentMsg.messageID, replied: false });

                // listen for reply
                api.listenMqtt(async (evt) => {
                    if (
                        evt.type === "message" &&
                        evt.threadID === thread.threadID &&
                        evt.messageID !== sentMsg.messageID &&
                        !sentThreads.find(s => s.threadID === thread.threadID).replied
                    ) {
                        // mark as replied
                        sentThreads.find(s => s.threadID === thread.threadID).replied = true;

                        // forward to admin
                        const userInfo = await api.getUserInfo(evt.senderID);
                        const userName = userInfo[evt.senderID]?.name || "Unknown";
                        const forwardText = `📩 Reply from ${userName} in group "${thread.name || thread.threadID}":\n${evt.body}`;
                        await api.sendMessage(forwardText, adminID);

                        // auto-reply to member
                        await api.sendMessage(getLang("autoReplyMessage"), thread.threadID);
                    }
                });
            } catch (e) {
                console.error(`Failed to send to thread ${thread.threadID}:`, e);
            }

            await new Promise(resolve => setTimeout(resolve, envCommands[this.config.name].delayPerGroup));
        }

        message.reply(getLang("sentNotification", sentThreads.length));
    }
};
