const fs = require("fs");
const path = require("path");
const express = require("express");
const pino = require("pino");
const chalk = require("chalk");
const { Boom } = require("@hapi/boom");
const { smsg } = require("./library/serialize");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const sessionsDir = path.join(__dirname, "sessions");
if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });

const activeSockets = new Map();
const tempSockets = new Map();
let baileys;

// ================= BOT LOGIC =================
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
        } catch (e) { console.log("Handler error:", e.message); }
      }
    } catch (err) { console.log("Msg error:", err.message); }
  });
}

// ================= START SINGLE BOT =================
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
      console.log(chalk.green(`✅ [${phoneNumber}] Connected!`));
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

// ================= PAIRING API =================
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

  console.log(`[${phoneNumber}] Pairing request...`);
  fs.mkdirSync(sessionPath, { recursive: true });
  const { state, saveCreds } = await baileys.useMultiFileAuthState(sessionPath);
  const { version } = await baileys.fetchLatestBaileysVersion();

  const sock = baileys.default({
    version,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    auth: state,
    browser: baileys.Browsers.ubuntu("Chrome"),
  });

  sock.ev.on("creds.update", saveCreds);
  tempSockets.set(phoneNumber, sock);

  let responded = false;
  let attempts = 0;

  const startSocket = async () => {
    attempts++;
    if (attempts > 5) {
      if(!responded) res.status(500).json({ success: false, error: "Connection failed." });
      return;
    }

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === "connecting" && !responded) {
        setTimeout(async () => {
          try {
            const code = await sock.requestPairingCode(phoneNumber);
            const formatted = code.match(/.{1,4}/g)?.join("-") || code;
            console.log(`[${phoneNumber}] Code: ${formatted}`);
            responded = true;
            res.json({ success: true, phoneNumber, code: formatted });
          } catch (err) {
            if(!responded) res.status(500).json({ success: false, error: err.message });
          }
        }, 3000);
      }

      if (connection === "open") {
        console.log(`[${phoneNumber}] 🎉 Linked!`);
        tempSockets.delete(phoneNumber);
        setTimeout(() => startBot(phoneNumber), 2000);
      }

      if (connection === "close") {
        const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
        if (code === 515 || code === baileys.DisconnectReason?.restartRequired) {
          console.log(`[${phoneNumber}] 515 reconnect`);
          setTimeout(startSocket, 1500);
        } else if (!responded) {
          res.status(500).json({ success: false, error: `Closed (${code})` });
        }
      }
    });
  };

  await startSocket();
});

// ================= STARTUP =================
(async () => {
  console.log("🚀 Starting Alpha Bot Server...");
  baileys = await import("@whiskeysockets/baileys");
  
  const PORT = process.env.PORT || process.env.SERVER_PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🌐 Website & API running on port ${PORT}`);
  });

  console.log("📂 Loading saved bots...");
  const dirs = fs.readdirSync(sessionsDir);
  for (const dir of dirs) {
    if (/^\d{10,15}$/.test(dir)) {
      await startBot(dir);
    }
  }
  console.log("✅ All loaded.");
})();