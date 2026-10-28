// © 2026 Alpha. All Rights Reserved.
const fs = require("fs");
const path = require("path");
const express = require("express");
const pino = require("pino");
const chalk = require("chalk");
const { Boom } = require("@hapi/boom");
const { smsg } = require("./library/serialize");
const config = () => require("./settings/config");

// Hide Baileys errors
const _origErr = console.error;
console.error = (...a) => {
  const m = a.join(" ");
  if (m.includes("Bad MAC") || m.includes("Session error") || m.includes("verifyMAC") || m.includes("Failed to decrypt") || m.includes("decryptWithSessions") || m.includes("closed session")) return;
  _origErr(...a);
};

const NGROK_AUTHTOKEN = "3L4Ccoik7R16ilMsfKycK2OZkmC_7qvF29reP3BEE19h42nyk"; 
const NGROK_DOMAIN = "itinerary-splashy-flyer.ngrok-free.dev"; 

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, ngrok-skip-browser-warning, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const sessionsDir = path.join(__dirname, "sessions");
if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });

const activeSockets = new Map();
const store = new Map(); 
let baileys;

let autoStatusHandler; try { autoStatusHandler = require("./plugins/autostatus"); } catch (e) { autoStatusHandler = { handleStatusUpdate: () => {} }; }

let messageHandler; 
try { 
    messageHandler = require("./message"); 
    console.log("✅ Message Handler loaded successfully!");
} catch (e) { 
    console.log("❌ FAILED TO LOAD message.js:", e.message); 
    messageHandler = async () => {}; 
}

const funnyDeleted = ["🕵️‍♂️ Someone deleted a message, but I saved it! 🛡️", "📝 Deleted message rescued:"];

const rateLimits = new Map();
function rateLimiter(req, res, next) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const now = Date.now();
  if (!rateLimits.has(ip)) rateLimits.set(ip, []);
  const requests = rateLimits.get(ip).filter(time => now - time < 3600000);
  if (requests.length >= 5) return res.status(429).json({ success: false, error: "Too many requests." });
  requests.push(now); rateLimits.set(ip, requests);
  if (requests.length === 0) rateLimits.delete(ip); 
  next();
}

function attachHandlers(sock, phoneNumber) {
  const channelJid = `${config().newsletter.id}@newsletter`;
  const sessionSettingsPath = path.join(sessionsDir, phoneNumber, "settings.json");

  const loadGlobalSettings = () => {
    let defaults = { autoread: false, autotyping: false, autorecording: false, autoreact: false, antidelete: false, antiedit: false, chreact: { enabled: false, emojis: ["💬"] }, prefix: "." };
    try { if(fs.existsSync(sessionSettingsPath)) return { ...defaults, ...JSON.parse(fs.readFileSync(sessionSettingsPath, "utf8")) }; } catch {}
    return defaults;
  };

  sock.ev.on("messages.upsert", async (chatUpdate) => {
    try {
      if (!chatUpdate.messages?.length) return;
      const globalSettings = loadGlobalSettings(); 

      for (const mek of chatUpdate.messages) {
        const remote = mek.key?.remoteJid;

        if (remote === "status@broadcast") {
          if (autoStatusHandler.handleStatusUpdate) await autoStatusHandler.handleStatusUpdate(sock, { messages: [mek] });
          continue;
        }
        
        // 🎯 If decryption fails, mek.message will be null. Skip it.
        if (!mek.message) continue;

        // Channel Reactions
        if (remote === channelJid) {
          const cr = globalSettings.chreact || { enabled: false, emojis: ["💬"] };
          if (cr.enabled) {
            for (const emoji of cr.emojis || []) {
              try {
                if (sock.newsletterReact) {
                  await sock.newsletterReact(channelJid, mek.key.id, emoji);
                } else {
                  await sock.relayMessage(channelJid, {
                    reactionMessage: {
                      key: { remoteJid: channelJid, id: mek.key.id, fromMe: false },
                      text: emoji,
                      senderTimestampMs: Date.now()
                    }
                  }, {});
                }
                await new Promise(r => setTimeout(r, 1000));
              } catch (e) {}
            }
          }
          continue;
        }

        const isCmd = mek.message?.conversation?.startsWith(globalSettings.prefix) || mek.message?.extendedTextMessage?.text?.startsWith(globalSettings.prefix);
        if (isCmd) {
          const msgText = mek.message?.conversation || mek.message?.extendedTextMessage?.text || '[Media]';
          const senderNumber = mek.key.participant?.split('@')[0] || mek.key.remoteJid?.split('@')[0] || 'unknown';
          console.log(`[CMD] ${phoneNumber} | ${senderNumber} | ${msgText.substring(0, 30)}`);
        }

        if (mek.key.fromMe) {
          const txt = mek.message?.conversation || mek.message?.extendedTextMessage?.text || "";
          if (!txt.startsWith(globalSettings.prefix)) continue;
        }

        const m = await smsg(sock, mek);
        m.prefix = globalSettings.prefix;
        m.globalSettings = globalSettings; 
        store.set(mek.key.id, { text: m.text || "", message: mek.message, sender: m.sender, pushName: m.pushName || null });

        await messageHandler(sock, m);
      }
    } catch (err) { console.log("⚠️ Message handler:", err.message); }
  });

  sock.ev.on("messages.update", async updates => {
    try {
      const globalSettings = loadGlobalSettings();
      const ad = globalSettings.antidelete || { enabled: false, mode: "chat", style: "fancy", react: true };
      const ownerNumber = (config().owner?.[0] || "").replace(/[^0-9]/g, "");
      const ownerJid = ownerNumber ? `${ownerNumber}@s.whatsapp.net` : null;

      for (const update of updates) {
        const oldMsg = store.get(update.key.id);
        if (!oldMsg) continue;

        if (update.update?.message === null && ad.enabled) {
          const chat = update.key.remoteJid; if (!chat) continue;
          const isGroup = chat.endsWith("@g.us");
          const sender = oldMsg.sender || update.key.participant || chat;
          const senderNumber = sender.split("@")[0].replace(/[^0-9]/g, "");
          let chatName = "Private Chat";
          if (isGroup) { try { const gm = await sock.groupMetadata(chat); chatName = gm.subject; } catch {} }
          const now = new Date();
          const deleted = (oldMsg.text || "Media").replace(/\n/g, "\n│ │ ");

          let text = ad.style === "fancy" 
            ? `╭───〔 👁️‍🗨️ ANTIDELETE 〕───⬣\n│\n│ 👤 @${senderNumber}\n│ 📍 ${chatName}\n│ 🕒 ${now.toLocaleTimeString()}\n│ 📅 ${now.toLocaleDateString()}\n│\n│ 🗑️:\n│ ┌─\n│ │ ${deleted}\n│ └─\n│ 🛡️ Alpha\n╰──`
            : `${funnyDeleted[0]}\n\n${oldMsg.text || "Media"}`;

          const destinations = [];
          if (ad.mode === "chat" || ad.mode === "both") destinations.push(chat);
          if ((ad.mode === "owner" || ad.mode === "both") && ownerJid) destinations.push(ownerJid);

          for (const dest of destinations) {
            const opts = {};
            if (isGroup && ad.style === "fancy" && dest === chat) opts.mentions = [sender];
            if (ad.style === "fancy") {
              await sock.sendMessage(dest, { text, contextInfo: { forwardingScore: 999, isForwarded: true, forwardedNewsletterMessageInfo: { newsletterJid: channelJid, newsletterName: config().newsletter.name } }, ...opts });
            } else { await sock.sendMessage(dest, { text, ...opts }); }
            if (ad.react && dest === chat) { try { await sock.sendMessage(dest, { react: { text: "👀", key: update.key } }); } catch {} }
          }
        }

        if (globalSettings.antiedit && update.update?.message) {
          let newText = "";
          try { const msg = update.update.message; const type = Object.keys(msg)[0]; newText = msg[type]?.text || msg[type]?.caption || ""; } catch {}
          if (oldMsg.text && newText && oldMsg.text !== newText) {
            try { await sock.sendMessage(update.key.remoteJid, { text: `✏️ Edited.\n\n📌 Old: ${oldMsg.text}\n🆕 New: ${newText}` }); } catch {}
          }
        }
      }
    } catch {}
  });

  sock.ev.on("group-participants.update", async update => {
    try {
      const { id, participants, action } = update;
      let gs = { welcome: false, welcomeMsg: "🌟 Welcome @user!", goodbye: false, goodbyeMsg: "🚶‍♂️ @user left." };
      try { const all = JSON.parse(fs.readFileSync(path.join(__dirname, "database/groupSettings.json"), "utf8")); gs = all[id] || gs; } catch {}

      if (action === "add" && gs.welcome) {
        for (const user of participants) await sock.sendMessage(id, { text: gs.welcomeMsg.replace(/@user/g, `@${user.split("@")[0]}`), mentions: [user] });
      }
      if (action === "remove" && gs.goodbye) {
        for (const user of participants) await sock.sendMessage(id, { text: gs.goodbyeMsg.replace(/@user/g, `@${user.split("@")[0]}`), mentions: [user] });
      }
    } catch {}
  });

  setTimeout(async () => { try { await sock.newsletterFollow(channelJid); } catch {} }, 3000);
  setTimeout(async () => {
    try {
      const botName = config().settings?.title || "Alpha Bot";
      const text = `╭───〔 🤖 ${botName} 〕───⬣\n\n✅ Bot Online\n👑 Owner: Alpha\n📞 Contact: wa.me/263786641436\n📂 Repo: https://github.com/Alexio11-09/alpha-xmd\n📢 Channel: https://whatsapp.com/channel/${config().newsletter.id}\n\n🔥 Ready to use.`;
      await sock.sendMessage(sock.user.id, { text, contextInfo: { forwardingScore: 999, isForwarded: true, forwardedNewsletterMessageInfo: { newsletterJid: channelJid, newsletterName: config().newsletter.name } } });
    } catch {}
  }, 4000);

  setInterval(() => { if (sock.user) sock.sendPresenceUpdate("available").catch(() => {}); }, 20000);
}

async function startBot(phoneNumber) {
  if (activeSockets.has(phoneNumber)) return; 
  const sessionPath = path.join(sessionsDir, phoneNumber);
  if (!fs.existsSync(path.join(sessionPath, "creds.json"))) return; 

  console.log(chalk.blue(`🤖 Starting bot for ${phoneNumber}`));

  try {
    const { state, saveCreds } = await baileys.useMultiFileAuthState(sessionPath);
    const { version } = await baileys.fetchLatestBaileysVersion();

    const sock = baileys.default({
      version,
      logger: pino({ level: "silent" }),
      printQRInTerminal: false,
      auth: state,
      browser: ["Ubuntu", "Chrome", "20.0.04"],
      generateHighQualityLinkPreview: false,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 15000,
      syncFullHistory: false,
    });

    sock.ev.on("creds.update", saveCreds);
    activeSockets.set(phoneNumber, sock);

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect } = update;
      if (connection === "open") console.log(chalk.green(`✅ [${phoneNumber}] Bot Connected!`));
      if (connection === "close") {
        const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
        activeSockets.delete(phoneNumber);
        
        if (code === 401) {
          console.log(chalk.red(`❌ [${phoneNumber}] Logged out. Backing up session.`));
          try { fs.renameSync(sessionPath, sessionPath + "_backup_" + Date.now()); } catch (e) {}
        } else {
          console.log(chalk.yellow(`🔄 [${phoneNumber}] Reconnecting in 5s...`));
          setTimeout(() => startBot(phoneNumber), 5000);
        }
      }
    });

    attachHandlers(sock, phoneNumber);
  } catch (error) {
    console.log(chalk.red(`❌ Failed to start ${phoneNumber}: ${error.message}`));
  }
}

global.startBot = startBot;

app.get("/api/stats", (req, res) => res.json({ connected: activeSockets.size, status: "online" }));
app.get("/api/status", (req, res) => res.json({ connected: activeSockets.has(req.query.phoneNumber) }));

app.post("/api/pair", rateLimiter, async (req, res) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber || !/^\d{10,15}$/.test(phoneNumber)) {
    return res.status(400).json({ success: false, error: "Invalid number format." });
  }

  const sessionPath = path.join(sessionsDir, phoneNumber);
  if (activeSockets.has(phoneNumber)) return res.json({ success: true, alreadyPaired: true });
  if (fs.existsSync(path.join(sessionPath, "creds.json"))) {
    startBot(phoneNumber);
    return res.json({ success: true, alreadyPaired: true });
  }

  fs.mkdirSync(sessionPath, { recursive: true });
  const { state, saveCreds } = await baileys.useMultiFileAuthState(sessionPath);
  const { version } = await baileys.fetchLatestBaileysVersion();

  const tempSock = baileys.default({
    version, logger: pino({ level: "silent" }), printQRInTerminal: false, auth: state, browser: baileys.Browsers.ubuntu("Chrome"),
  });

  tempSock.ev.on("creds.update", saveCreds);
  let responded = false;

  tempSock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "connecting" && !responded) {
      setTimeout(async () => {
        try {
          const code = await tempSock.requestPairingCode(phoneNumber);
          const formatted = code.match(/.{1,4}/g)?.join("-") || code;
          responded = true;
          res.json({ success: true, phoneNumber, code: formatted });
        } catch (err) {
          if(!responded) { responded = true; res.status(500).json({ success: false, error: err.message }); try { tempSock.end(undefined); } catch (e) {} }
        }
      }, 3000);
    }
    if (connection === "open") { setTimeout(() => startBot(phoneNumber), 3000); }
    if (connection === "close") {
      const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
      if (code === 515) { setTimeout(() => startBot(phoneNumber), 5000); } 
      else if (!responded) { responded = true; res.status(500).json({ success: false, error: `Closed (${code})` }); try { tempSock.end(undefined); } catch (e) {} }
    }
  });
});

app.post("/api/disconnect", async (req, res) => {
  const { phoneNumber } = req.body;
  const sessionPath = path.join(sessionsDir, phoneNumber);
  try {
    if (activeSockets.has(phoneNumber)) {
      await activeSockets.get(phoneNumber).logout(); 
      activeSockets.delete(phoneNumber);
    }
    if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, { recursive: true, force: true });
    res.json({ success: true, message: "Bot disconnected." });
  } catch (err) {
    try { if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, { recursive: true, force: true }); activeSockets.delete(phoneNumber); } catch(e) {}
    res.json({ success: true, message: "Session deleted." });
  }
});

app.get("/api/settings", (req, res) => {
  const { phoneNumber } = req.query;
  const settingsPath = path.join(sessionsDir, phoneNumber, "settings.json");
  if (fs.existsSync(settingsPath)) {
    try { return res.json(JSON.parse(fs.readFileSync(settingsPath, 'utf8'))); } catch(e) {}
  }
  res.json({ autoread: false, autotyping: false, antidelete: false, antilink: false, autoreact: false, chreact: { enabled: false, emojis: ["💬"] }, prefix: "." });
});

app.post("/api/settings", (req, res) => {
  const { phoneNumber, settings } = req.body;
  const dir = path.join(sessionsDir, phoneNumber);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "settings.json"), JSON.stringify(settings, null, 2));
  res.json({ success: true });
});

(async () => {
  console.log("🚀 Starting Alpha Bot Server...");
  baileys = await import("@whiskeysockets/baileys");

  const PORT = process.env.PORT || process.env.SERVER_PORT || 3000;

  app.listen(PORT, async () => {
    console.log(`🌐 Internal API running on port ${PORT}`);

    try {
      const ngrok = require("@ngrok/ngrok");
      await ngrok.forward({ addr: PORT, authtoken: NGROK_AUTHTOKEN, domain: NGROK_DOMAIN });
      console.log(`✅ PUBLIC API: https://${NGROK_DOMAIN}`);
    } catch (err) { console.log("⚠️ Ngrok failed:", err.message); }

    setInterval(() => {
      require('http').get(`http://localhost:${PORT}/api/stats`, () => {}).on('error', () => {});
    }, 10 * 60 * 1000); 

    console.log("📂 Loading saved bots...");
    const dirs = fs.readdirSync(sessionsDir);
    for (const dir of dirs) {
      if (/^\d{10,15}$/.test(dir)) {
        await startBot(dir);
        await new Promise(resolve => setTimeout(resolve, 3000)); 
      }
    }
    console.log("✅ All loaded.");
  });
})();