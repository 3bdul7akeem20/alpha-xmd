// © 2026 Alpha. All Rights Reserved.
const fs = require("fs");
const path = require("path");
const express = require("express");
const pino = require("pino");
const chalk = require("chalk");
const { Boom } = require("@hapi/boom");
const { smsg } = require("./library/serialize");

// 🔴 NGROK CREDENTIALS
const NGROK_AUTHTOKEN = "3L4Ccoik7R16ilMsfKycK2OZkmC_7qvF29reP3BEE19h42nyk"; 
const NGROK_DOMAIN = "itinerary-splashy-flyer.ngrok-free.dev"; 

const app = express();
app.use(express.json());

// ✅ FIX: Allow the specific Ngrok header in CORS
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

function attachHandlers(sock, phoneNumber) {
  sock.ev.on("messages.upsert", async (chatUpdate) => {
    try {
      const messages = chatUpdate.messages;
      if (!messages?.length) return;
      for (const mek of messages) {
        const remote = mek.key?.remoteJid;
        if (remote === "status@broadcast" || !mek.message) continue;
        
        try {
          const msgType = Object.keys(mek.message || {})[0] || 'unknown';
          const msgText = mek.message?.conversation || mek.message?.extendedTextMessage?.text || '[Media]';
          console.log(chalk.green(`[${phoneNumber}]`) + ` ${mek.key.fromMe ? '⬅️' : '➡️'} ${msgType}: ${msgText.substring(0,30)}`);
        } catch (e) {}

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
    if (connection === "open") {
      console.log(chalk.green(`✅ [${phoneNumber}] Bot Connected!`));
    }
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
}

app.post("/api/pair", async (req, res) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber || !/^\d{10,15}$/.test(phoneNumber)) {
    return res.status(400).json({ success: false, error: "Invalid number format." });
  }

  const sessionPath = path.join(sessionsDir, phoneNumber);
  
  if (activeSockets.has(phoneNumber)) {
    return res.json({ success: true, alreadyPaired: true, message: "Bot is already running!" });
  }

  if (fs.existsSync(path.join(sessionPath, "creds.json"))) {
    startBot(phoneNumber);
    return res.json({ success: true, alreadyPaired: true, message: "Session found. Starting bot!" });
  }

  console.log(`[${phoneNumber}] New pairing request...`);
  fs.mkdirSync(sessionPath, { recursive: true });
  
  const { state, saveCreds } = await baileys.useMultiFileAuthState(sessionPath);
  const { version } = await baileys.fetchLatestBaileysVersion();

  const tempSock = baileys.default({
    version,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    auth: state,
    browser: baileys.Browsers.ubuntu("Chrome"),
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
          console.log(`[${phoneNumber}] Code: ${formatted}`);
          responded = true;
          res.json({ success: true, phoneNumber, code: formatted });
        } catch (err) {
          if(!responded) {
            responded = true;
            res.status(500).json({ success: false, error: err.message });
            try { tempSock.end(undefined); } catch (e) {}
            fs.rmSync(sessionPath, { recursive: true, force: true });
          }
        }
      }, 3000);
    }

    if (connection === "open") {
      console.log(`[${phoneNumber}] 🎉 Linked successfully!`);
      setTimeout(() => startBot(phoneNumber), 3000);
    }

    if (connection === "close") {
      const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
      // ✅ FIX: 515 means pairing succeeded. Start the real bot and stop the temp socket.
      if (code === 515 || code === baileys.DisconnectReason?.restartRequired) {
        console.log(`[${phoneNumber}] 515 Restart. Pairing successful. Starting bot...`);
        try { tempSock.end(undefined); } catch (e) {}
        setTimeout(() => startBot(phoneNumber), 5000); // Give time for session to save
      } else if (!responded) {
        responded = true;
        res.status(500).json({ success: false, error: `Closed (${code})` });
        try { tempSock.end(undefined); } catch (e) {}
        fs.rmSync(sessionPath, { recursive: true, force: true });
      }
    }
  });
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
      console.log("⏳ Connecting to Ngrok...");
      
      await ngrok.forward({
        addr: PORT,
        authtoken: NGROK_AUTHTOKEN,
        domain: NGROK_DOMAIN
      });
      
      console.log(`\n======================================================`);
      console.log(`✅ PUBLIC API URL: https://${NGROK_DOMAIN}`);
      console.log(`======================================================\n`);
      
    } catch (err) {
      console.log("⚠️ Ngrok failed to start:", err.message);
    }

    console.log("📂 Loading saved bots...");
    const dirs = fs.readdirSync(sessionsDir);
    for (const dir of dirs) {
      if (/^\d{10,15}$/.test(dir)) {
        await startBot(dir);
      }
    }
    console.log("✅ All loaded.");
  });
})();