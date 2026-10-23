// © 2026 Alpha. All Rights Reserved.
const fs = require("fs");
const path = require("path");
const express = require("express");
const pino = require("pino");
const chalk = require("chalk");
const { Boom } = require("@hapi/boom");
const { smsg } = require("./library/serialize");
const config = () => require("./settings/config");

// Hide annoying Baileys errors
const _origErr = console.error;
console.error = (...a) => {
  const m = a.join(" ");
  if (m.includes("Bad MAC") || m.includes("Session error") || m.includes("verifyMAC") || m.includes("Failed to decrypt") || m.includes("decryptWithSessions")) return;
  _origErr(...a);
};

const NGROK_AUTHTOKEN = process.env.NGROK_AUTHTOKEN || "3L4Ccoik7R16ilMsfKycK2OZkmC_7qvF29reP3BEE19h42nyk"; 
const NGROK_DOMAIN = process.env.NGROK_DOMAIN || "itinerary-splashy-flyer.ngrok-free.dev"; 

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
let messageHandler; try { messageHandler = require("./message"); } catch (e) { messageHandler = async () => {}; }

const rateLimits = new Map();
function rateLimiter(req, res, next) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const now = Date.now();
  if (!rateLimits.has(ip)) rateLimits.set(ip, []);
  const requests = rateLimits.get(ip).filter(time => now - time < 3600000); // 1 hr
  if (requests.length >= 10) return res.status(429).json({ success: false, error: "Too many requests." });
  requests.push(now); rateLimits.set(ip, requests);
  if (requests.length === 0) rateLimits.delete(ip); 
  next();
}

// ================= BOT HANDLERS =================
function attachHandlers(sock, phoneNumber) {
  const channelJid = `${config().newsletter.id}@newsletter`;
  const sessionSettingsPath = path.join(sessionsDir, phoneNumber, "settings.json");
  
  const loadGlobalSettings = () => {
    let defaults = { autoread: false, autotyping: false, autorecording: false, autoreact: false, antidelete: false, antiedit: false, prefix: "." };
    try { if(fs.existsSync(sessionSettingsPath)) return { ...defaults, ...JSON.parse(fs.readFileSync(sessionSettingsPath, "utf8")) }; } catch {}
    return defaults;
  };

  sock.ev.on("messages.upsert", async (chatUpdate) => {
    try {
      if (!chatUpdate.messages?.length) return;
      const globalSettings = loadGlobalSettings(); 
      for (const mek of chatUpdate.messages) {
        const remote = mek.key?.remoteJid;
        if (remote === "status@broadcast") { if (autoStatusHandler.handleStatusUpdate) await autoStatusHandler.handleStatusUpdate(sock, { messages: [mek] }); continue; }
        if (!mek.message) continue;
        
        if (mek.key.fromMe) {
          const txt = mek.message?.conversation || mek.message?.extendedTextMessage?.text || "";
          if (!txt.startsWith(globalSettings.prefix)) continue;
        }
        
        const m = await smsg(sock, mek);
        m.prefix = globalSettings.prefix;
        store.set(mek.key.id, { text: m.text || "", message: mek.message, sender: m.sender, pushName: m.pushName || null });

        if (m.isGroup) {
          try {
            const metadata = await sock.groupMetadata(m.chat);
            const sender = sock.decodeJid(m.sender);
            m.isAdmin = metadata.participants.some(p => sock.decodeJid(p.id).split("@")[0] === sender.split("@")[0] && p.admin);
            m.isBotAdmin = metadata.participants.some(p => sock.decodeJid(p.id) === sock.decodeJid(sock.user?.id) && p.admin);
          } catch { m.isAdmin = false; m.isBotAdmin = false; }
        }
        
        if (globalSettings.autoread) { try { await sock.readMessages([mek.key]); } catch {} }
        if (globalSettings.autotyping) { try { await sock.sendPresenceUpdate("composing", m.chat); } catch {} }
        if (globalSettings.autoreact) { try { await sock.sendMessage(m.chat, { react: { text: "🔥", key: mek.key } }); } catch {} }
        
        await messageHandler(sock, m);
      }
    } catch (err) { console.log("⚠️ Error:", err.message); }
  });

  // Anti-Delete
  sock.ev.on("messages.update", async updates => {
    try {
      const globalSettings = loadGlobalSettings();
      const ad = globalSettings.antidelete || { enabled: false };
      for (const update of updates) {
        const oldMsg = store.get(update.key.id);
        if (!oldMsg) continue;
        if (update.update?.message === null && ad.enabled) {
          const chat = update.key.remoteJid; if (!chat) continue;
          const text = `╭───〔 👁️‍🗨️ ANTIDELETE 〕───⬣\n│ 👤 @${oldMsg.sender.split("@")[0]}\n│ 🗑️: ${oldMsg.text || "Media"}\n╰──`;
          await sock.sendMessage(chat, { text, mentions: [oldMsg.sender] });
        }
      }
    } catch {}
  });

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
    const sock = baileys.default({ version, logger: pino({ level: "silent" }), printQRInTerminal: false, auth: state, browser: ["Ubuntu", "Chrome", "20.0.04"] });
    
    sock.decodeJid = jid => { if (!jid) return jid; if (/:\d+@/gi.test(jid)) { const d = baileys.jidDecode(jid) || {}; return d.user && d.server ? `${d.user}@${d.server}` : jid; } return jid; };
    sock.ev.on("creds.update", saveCreds);
    activeSockets.set(phoneNumber, sock);
    
    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect } = update;
      if (connection === "open") { 
        console.log(chalk.green(`✅ [${phoneNumber}] Bot Connected!`));
        attachHandlers(sock, phoneNumber); 
      }
      if (connection === "close") {
        activeSockets.delete(phoneNumber);
        const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
        if (code === 401) {
          console.log(chalk.red(`❌ [${phoneNumber}] Logged out. Deleting session.`));
          fs.rmSync(sessionPath, { recursive: true, force: true });
        } else {
          setTimeout(() => startBot(phoneNumber), 10000);
        }
      }
    });
  } catch (error) { console.log(chalk.red(`❌ Failed to start ${phoneNumber}: ${error.message}`)); }
}

// ================= API ENDPOINTS =================
app.get("/api/stats", (req, res) => res.json({ connected: activeSockets.size, status: "online" }));
app.get("/api/status", (req, res) => res.json({ connected: activeSockets.has(req.query.phoneNumber) }));

app.post("/api/pair", rateLimiter, async (req, res) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber || !/^\d{10,15}$/.test(phoneNumber)) return res.status(400).json({ success: false, error: "Invalid number." });
  const sessionPath = path.join(sessionsDir, phoneNumber);
  if (activeSockets.has(phoneNumber)) return res.json({ success: true, alreadyPaired: true });
  if (fs.existsSync(path.join(sessionPath, "creds.json"))) { startBot(phoneNumber); return res.json({ success: true, alreadyPaired: true }); }

  fs.mkdirSync(sessionPath, { recursive: true });
  try {
    const { state, saveCreds } = await baileys.useMultiFileAuthState(sessionPath);
    const { version } = await baileys.fetchLatestBaileysVersion();
    const tempSock = baileys.default({ version, logger: pino({ level: "silent" }), printQRInTerminal: false, auth: state, browser: baileys.Browsers.ubuntu("Chrome") });
    
    tempSock.ev.on("creds.update", saveCreds);
    let responded = false;
    
    tempSock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect } = update;
      if (connection === "connecting" && !responded) {
        setTimeout(async () => {
          try {
            const code = await tempSock.requestPairingCode(phoneNumber);
            if (!responded) { responded = true; res.json({ success: true, phoneNumber, code: code.match(/.{1,4}/g)?.join("-") || code }); }
          } catch (err) { if(!responded) { responded = true; res.status(500).json({ success: false, error: err.message }); tempSock.end(undefined); } }
        }, 3000);
      }
      if (connection === "open") setTimeout(() => startBot(phoneNumber), 3000);
      if (connection === "close") { if (!responded) { responded = true; res.status(500).json({ success: false, error: "Closed" }); } }
    });
  } catch (error) { res.status(500).json({ success: false, error: "Init failed." }); }
});

app.post("/api/qr", rateLimiter, async (req, res) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) return res.status(400).json({ success: false, error: "Invalid number." });
  const sessionPath = path.join(sessionsDir, phoneNumber);
  if (activeSockets.has(phoneNumber)) return res.json({ success: true, alreadyPaired: true });
  
  fs.mkdirSync(sessionPath, { recursive: true });
  try {
    const { state, saveCreds } = await baileys.useMultiFileAuthState(sessionPath);
    const { version } = await baileys.fetchLatestBaileysVersion();
    const tempSock = baileys.default({ version, logger: pino({ level: "silent" }), printQRInTerminal: false, auth: state, browser: baileys.Browsers.ubuntu("Chrome") });
    
    tempSock.ev.on("creds.update", saveCreds);
    let responded = false;
    
    tempSock.ev.on("connection.update", async (update) => {
      const { connection, qr } = update;
      if (qr && !responded) { responded = true; res.json({ success: true, phoneNumber, qr }); }
      if (connection === "open") setTimeout(() => startBot(phoneNumber), 3000);
    });
    setTimeout(() => { if(!responded){ responded = true; res.status(500).json({ success: false, error: "QR timeout" }); tempSock.end(); } }, 30000);
  } catch (error) { res.status(500).json({ success: false, error: "Init failed." }); }
});

app.post("/api/disconnect", async (req, res) => {
  const { phoneNumber } = req.body;
  const sessionPath = path.join(sessionsDir, phoneNumber);
  try {
    if (activeSockets.has(phoneNumber)) { await activeSockets.get(phoneNumber).logout(); activeSockets.delete(phoneNumber); }
    if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, { recursive: true, force: true });
    res.json({ success: true });
  } catch (err) { res.json({ success: true }); }
});

app.get("/api/settings", (req, res) => {
  const settingsPath = path.join(sessionsDir, req.query.phoneNumber, "settings.json");
  if (fs.existsSync(settingsPath)) { try { return res.json(JSON.parse(fs.readFileSync(settingsPath, 'utf8'))); } catch(e) {} }
  res.json({ autoread: false, autotyping: false, autorecording: false, antidelete: false, antiedit: false, autoreact: false, prefix: "." });
});

app.post("/api/settings", (req, res) => {
  const { phoneNumber, settings } = req.body;
  const dir = path.join(sessionsDir, phoneNumber);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "settings.json"), JSON.stringify(settings, null, 2));
  res.json({ success: true });
});

// ================= STARTUP =================
(async () => {
  console.log("🚀 Starting Alpha Bot Server...");
  baileys = await import("@whiskeysockets/baileys");
  const PORT = process.env.PORT || 3000;
  
  app.listen(PORT, async () => {
    console.log(`🌐 Internal API running on port ${PORT}`);
    try {
      const ngrok = require("@ngrok/ngrok");
      await ngrok.forward({ addr: PORT, authtoken: NGROK_AUTHTOKEN, domain: NGROK_DOMAIN });
      console.log(`✅ PUBLIC API: https://${NGROK_DOMAIN}`);
    } catch (err) { console.log("⚠️ Ngrok failed:", err.message); }

    console.log("📂 Loading saved bots...");
    if (fs.existsSync(sessionsDir)) { 
      for (const dir of fs.readdirSync(sessionsDir)) { 
        if (/^\d{10,15}$/.test(dir)) await startBot(dir); 
      } 
    }
    console.log("✅ All loaded and ready!");
  });
})();