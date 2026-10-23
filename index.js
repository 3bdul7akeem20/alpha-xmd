// © 2026 Alpha. All Rights Reserved.
const fs = require("fs");
const path = require("path");
const express = require("express");
const pino = require("pino");
const chalk = require("chalk");
const { Boom } = require("@hapi/boom");
const { smsg } = require("./library/serialize");

const NGROK_AUTHTOKEN = "3L4Ccoik7R16ilMsfKycK2OZkmC_7qvF29reP3BEE19h42nyk"; 
const NGROK_DOMAIN = "itinerary-splashy-flyer.ngrok-free.dev"; 

const app = express();
app.use(express.json());

// 🎯 CORS FIX: Ensures your Vercel website can talk to this Ngrok server
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, ngrok-skip-browser-warning');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.static(path.join(__dirname, "public")));

const sessionsDir = path.join(__dirname, "sessions");
if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });

const activeSockets = new Map();
let baileys;

// ================= RATE LIMITER =================
const rateLimits = new Map();
function rateLimiter(req, res, next) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour
  const maxRequests = 5; // Max 5 pair requests per hour per IP

  if (!rateLimits.has(ip)) rateLimits.set(ip, []);
  const requests = rateLimits.get(ip).filter(time => now - time < windowMs);

  if (requests.length >= maxRequests) {
    return res.status(429).json({ success: false, error: "Too many requests. Please try again later." });
  }

  requests.push(now);
  rateLimits.set(ip, requests);
  
  // 🎯 FIX: This stops the server from crashing after too many users use the site
  if (requests.length === 0) rateLimits.delete(ip); 
  
  next();
}

// ================= BOT HANDLERS =================
function attachHandlers(sock, phoneNumber) {
  sock.ev.on("messages.upsert", async (chatUpdate) => {
    try {
      const messages = chatUpdate.messages;
      if (!messages?.length) return;
      for (const mek of messages) {
        const remote = mek.key?.remoteJid;
        if (remote === "status@broadcast" || !mek.message) continue;

        if (mek.key.fromMe) {
          const txt = mek.message?.conversation || mek.message?.extendedTextMessage?.text || "";
          if (!txt.startsWith(".")) continue;
        }
        const m = await smsg(sock, mek);
        try { 
          const handler = require("./message"); 
          await handler(sock, m); 
        } catch (e) { 
          console.log("Handler error:", e.message); 
        }
      }
    } catch (err) { 
      console.log("Msg error:", err.message); 
    }
  });
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
          console.log(chalk.red(`❌ [${phoneNumber}] Logged out. Deleting session.`));
          fs.rmSync(sessionPath, { recursive: true, force: true });
        } else {
          console.log(chalk.yellow(`🔄 [${phoneNumber}] Reconnecting in 10s...`));
          setTimeout(() => startBot(phoneNumber), 10000);
        }
      }
    });

    attachHandlers(sock, phoneNumber);
  } catch (error) {
    // 🎯 FIX: If one bot fails to start, it won't crash the whole server
    console.log(chalk.red(`❌ Failed to start bot for ${phoneNumber}: ${error.message}`));
  }
}

// ================= API ENDPOINTS =================

app.get("/api/stats", (req, res) => {
  res.json({ connected: activeSockets.size, status: "online" });
});

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
  
  try {
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
            if (!responded) {
              responded = true;
              res.json({ success: true, phoneNumber, code: formatted });
            }
          } catch (err) {
            if(!responded) { 
              responded = true; 
              res.status(500).json({ success: false, error: err.message }); 
              try { tempSock.end(undefined); } catch (e) {} 
            }
          }
        }, 3000);
      }
      
      if (connection === "open") { setTimeout(() => startBot(phoneNumber), 3000); }
      
      if (connection === "close") {
        const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
        if (code === 515) { setTimeout(() => startBot(phoneNumber), 5000); } 
        else if (!responded) { 
          responded = true; 
          res.status(500).json({ success: false, error: `Closed (${code})` }); 
          try { tempSock.end(undefined); } catch (e) {} 
        }
      }
    });
  } catch (error) {
    // 🎯 FIX: Prevents website crashes if Baileys fails to load
    res.status(500).json({ success: false, error: "Failed to initialize session." });
  }
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
  res.json({ autoread: false, autotyping: false, antidelete: false, antilink: false, autoreact: false });
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

  const PORT = process.env.PORT || process.env.SERVER_PORT || 3000;

  app.listen(PORT, async () => {
    console.log(`🌐 Internal API running on port ${PORT}`);

    try {
      const ngrok = require("@ngrok/ngrok");
      await ngrok.forward({ addr: PORT, authtoken: NGROK_AUTHTOKEN, domain: NGROK_DOMAIN });
      console.log(`✅ PUBLIC API: https://${NGROK_DOMAIN}`);
    } catch (err) { console.log("⚠️ Ngrok failed:", err.message); }

    // 🎯 SELF-PING TO KEEP HOST AWAKE
    setInterval(() => {
      require('http').get(`http://localhost:${PORT}/api/stats`, () => {}).on('error', () => {});
      console.log("💓 Self-ping to keep server awake");
    }, 10 * 60 * 1000); 

    console.log("📂 Loading saved bots...");
    if (fs.existsSync(sessionsDir)) {
      const dirs = fs.readdirSync(sessionsDir);
      for (const dir of dirs) {
        if (/^\d{10,15}$/.test(dir)) await startBot(dir);
      }
    }
    console.log("✅ All loaded.");
  });
})();