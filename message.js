// © 2026 Alpha - MESSAGE HANDLER (STABLE FULL FEATURES)
const fs = require("fs");
const path = require("path");
const config = require("./settings/config");

const clean = (jid) => { if (!jid) return ""; try { return jid.toString().replace(/[^0-9]/g, ""); } catch { return ""; } };

// BAN CHECK
const isUserBanned = (sender) => {
    try {
        const bp = './database/banned.json';
        if (!fs.existsSync(bp)) { if (!fs.existsSync('./database')) fs.mkdirSync('./database', { recursive: true }); fs.writeFileSync(bp, '{}'); }
        const b = JSON.parse(fs.readFileSync(bp)); return b[clean(sender)] ? true : false;
    } catch { return false; }
};

// TEMP OWNER (base number, no device ID)
function isTempOwnerBase(sender) {
    try {
        const op = './database/owners.json';
        if (!fs.existsSync(op)) return false;
        const o = JSON.parse(fs.readFileSync(op));
        const senderBase = clean(sender.split('@')[0].split(':')[0]);
        return o.tempOwners?.includes(senderBase);
    } catch { return false; }
}

// BADWORDS
const bwPath = './database/badwords.json', gbwPath = './database/badwords_global.json';
try { if (!fs.existsSync('./database')) fs.mkdirSync('./database', { recursive: true }); if (!fs.existsSync(bwPath)) fs.writeFileSync(bwPath, '{}'); if (!fs.existsSync(gbwPath)) fs.writeFileSync(gbwPath, '[]'); } catch {}
const loadGlobalBadWords = () => { try { return JSON.parse(fs.readFileSync(gbwPath, 'utf-8')); } catch { return []; } };
const getGroupBW = (chatId) => { try { const d = JSON.parse(fs.readFileSync(bwPath)); return d[chatId] || { enabled: false, words: [] }; } catch { return { enabled: false, words: [] }; } };
const containsBadWord = (text, chatId) => {
    const cfg = getGroupBW(chatId); if (!cfg.enabled) return false;
    const all = [...loadGlobalBadWords(), ...(cfg.words||[])];
    return all.some(w => text.toLowerCase().includes(w.toLowerCase()));
};

// LINK DETECTION
const containsLink = (text) => /https?:\/\/[^\s]+|wa\.me\/[^\s]+|chat\.whatsapp\.com\/[^\s]+/gi.test(text);

// GROUP SETTINGS
const dbPath = './database/groupSettings.json';
try { if (!fs.existsSync('./database')) fs.mkdirSync('./database', { recursive: true }); fs.writeFileSync(dbPath, '{}', { flag: 'a' }); } catch {}
const getGroupSettings = (chatId) => { try { return JSON.parse(fs.readFileSync(dbPath))[chatId] || {}; } catch { return {}; } };

// GLOBAL MODE & ANTIDELETE SETTINGS
const settingsPath = './database/settings.json';
try { if (!fs.existsSync('./database')) fs.mkdirSync('./database', { recursive: true }); if (!fs.existsSync(settingsPath)) fs.writeFileSync(settingsPath, '{}'); } catch {}
const getGlobalSettings = () => {
    try { const s = JSON.parse(fs.readFileSync(settingsPath)); return s.global || {}; } catch { return {}; }
};
const setGlobalSettings = (newGlobal) => {
    try {
        const s = JSON.parse(fs.readFileSync(settingsPath));
        s.global = newGlobal;
        fs.writeFileSync(settingsPath, JSON.stringify(s, null, 2));
    } catch {}
};
const getGlobalMode = () => getGlobalSettings().mode || 'public';
const setGlobalMode = (mode) => {
    const g = getGlobalSettings();
    g.mode = mode;
    setGlobalSettings(g);
};

// COMMANDS
const commands = [];
const loadCommands = (dir) => {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (let f of files) {
        const fp = path.join(dir, f);
        if (fs.lstatSync(fp).isDirectory()) loadCommands(fp);
        else if (f.endsWith(".js")) {
            try { delete require.cache[require.resolve(fp)]; const c = require(fp); if (Array.isArray(c)) commands.push(...c); else if (c.command) commands.push(c); } catch (e) { console.log(`❌ Load fail ${f}:`, e.message); }
        }
    }
};
loadCommands(path.join(__dirname, "plugins"));

// Add mode command directly
commands.push({
    command: "mode",
    aliases: ["botmode"],
    category: "owner",
    owner: true,
    execute: async (sock, m, { args, reply }) => {
        const mode = args[0]?.toLowerCase();
        if (mode === 'public') {
            setGlobalMode('public');
            return reply("✅ Bot is now in *public mode*. Everyone can use commands.");
        } else if (mode === 'private') {
            setGlobalMode('private');
            return reply("🔒 Bot is now in *private mode*. Only the owner can use commands.");
        } else {
            const current = getGlobalMode();
            return reply(`📱 Current mode: *${current}*\n\nChange with: .mode public / .mode private`);
        }
    }
});

// Add antidelete config command
commands.push({
    command: "antideleteconfig",
    aliases: ["adconfig", "antidelete"],
    category: "owner",
    owner: true,
    execute: async (sock, m, { args, reply }) => {
        const sub = args[0]?.toLowerCase();
        const g = getGlobalSettings();
        const cfg = g.antidelete || { enabled: false, mode: 'chat', style: 'fancy', react: true };

        if (!sub) {
            return reply(`🛡️ *Antidelete Settings*\n\n` +
                `🔹 Enabled: ${cfg.enabled ? '✅' : '❌'}\n` +
                `🔹 Mode: ${cfg.mode}\n` +
                `🔹 Style: ${cfg.style}\n` +
                `🔹 Reaction: ${cfg.react ? '👀 ON' : 'OFF'}\n\n` +
                `Usage:\n` +
                `.antidelete on/off\n` +
                `.antidelete mode chat/owner/both\n` +
                `.antidelete style fancy/simple\n` +
                `.antidelete react on/off`);
        }

        if (sub === 'on' || sub === 'off') {
            cfg.enabled = sub === 'on';
        } else if (sub === 'mode') {
            const mode = args[1]?.toLowerCase();
            if (['chat', 'owner', 'both'].includes(mode)) {
                cfg.mode = mode;
            } else {
                return reply("❌ Invalid mode. Use: chat, owner, both");
            }
        } else if (sub === 'style') {
            const style = args[1]?.toLowerCase();
            if (['fancy', 'simple'].includes(style)) {
                cfg.style = style;
            } else {
                return reply("❌ Invalid style. Use: fancy, simple");
            }
        } else if (sub === 'react') {
            const react = args[1]?.toLowerCase();
            if (react === 'on') cfg.react = true;
            else if (react === 'off') cfg.react = false;
            else return reply("❌ Use: react on/off");
        } else {
            return reply("❌ Unknown option. Use on/off, mode, style, react");
        }

        g.antidelete = cfg;
        setGlobalSettings(g);
        reply(`✅ Antidelete updated:\nEnabled: ${cfg.enabled ? 'ON' : 'OFF'}, Mode: ${cfg.mode}, Style: ${cfg.style}, React: ${cfg.react ? 'ON' : 'OFF'}`);
    }
});

// GAMES
const games = { tictactoe:{}, guess:{}, quiz:{}, riddle:{} };

// SHORT DENIALS
const deny = {
    owner: "😂 Only the bot owner can do that.",
    admin: "🚫 Only admins can use this.",
    group: "👥 This only works in groups.",
    botAdmin: "🤖 I need admin powers.",
    banned: "🚫 You're banned from using the bot.",
    private: "🔒 This command only works in private chat.",
    ownerPrivateReminder: "⚠️ For security, owner commands are best used in private chat."
};

// REACTIONS
const reacts = ["😂","❤️","🔥","👍","🎉","🤔","😮","💯","👀","🥳","⚡","😎"];
async function reactRandom(sock, msg) { try { const e = reacts[Math.floor(Math.random()*reacts.length)]; await sock.sendMessage(msg.key.remoteJid, { react:{ text:e, key:msg.key } }); } catch {} }

// MAIN HANDLER
module.exports = async (sock, m) => {
    try {
        const contextInfo = { forwardingScore:999, isForwarded:true, forwardedNewsletterMessageInfo:{ newsletterJid: config.newsletter.id + "@newsletter", newsletterName: config.newsletter.name } };
        const reply = (text, extra={}) => { try { return sock.sendMessage(m.chat, { text, contextInfo, ...extra }, { quoted: m }); } catch { return sock.sendMessage(m.chat, { text, ...extra }, { quoted: m }); } };
        const send = (data) => { try { return sock.sendMessage(m.chat, { ...data, contextInfo }, { quoted: m }); } catch { return sock.sendMessage(m.chat, data, { quoted: m }); } };

        if (!m.text) return;

        const prefix = config.prefix || ".";
        if (!m.text.startsWith(prefix)) {
            // ANTIBADWORD
            if (m.isGroup && m.text && containsBadWord(m.text, m.chat)) {
                if (m.isBotAdmin) try { await sock.sendMessage(m.chat, { delete: m.key }); } catch {}
                const w = `🤬 Watch your language, @${m.sender.split('@')[0]}! That word is banned.`;
                await sock.sendMessage(m.chat, { text: w, mentions:[m.sender] }, { quoted: m });
                return;
            }
            // ANTILINK
            if (m.isGroup && m.text) {
                const gs = getGroupSettings(m.chat);
                if (gs.antilink) {
                    const mode = gs.antilinkMode || 'admins';
                    const action = gs.antilinkAction || 'delete';
                    let allowed = false;
                    if (mode === 'owner') { try { const meta = await sock.groupMetadata(m.chat); allowed = (meta.owner === m.sender); } catch { allowed = false; } }
                    else allowed = m.isAdmin;
                    if (!allowed && containsLink(m.text)) {
                        if (action === 'delete') {
                            if (m.isBotAdmin) try { await sock.sendMessage(m.chat, { delete: m.key }); } catch {}
                            else { try { const meta = await sock.groupMetadata(m.chat); await sock.sendMessage(m.chat, { text: `🙏 @${meta.owner.split('@')[0]} make me admin to delete links.`, mentions:[meta.owner] }, { quoted: m }); } catch {} }
                            const warn = `🔗 Links not allowed, @${m.sender.split('@')[0]}. Message deleted.`;
                            await sock.sendMessage(m.chat, { text: warn, mentions:[m.sender] }, { quoted: m });
                        } else if (action === 'warn') {
                            const warn = `⚠️ @${m.sender.split('@')[0]}, no links please.`;
                            await sock.sendMessage(m.chat, { text: warn, mentions:[m.sender] }, { quoted: m });
                        } else if (action === 'kick') {
                            if (m.isBotAdmin) try { await sock.groupParticipantsUpdate(m.chat, [m.sender], 'remove'); } catch {}
                            else { try { const meta = await sock.groupMetadata(m.chat); await sock.sendMessage(m.chat, { text: `🙏 @${meta.owner.split('@')[0]} make me admin to kick link spammers.`, mentions:[meta.owner] }, { quoted: m }); } catch {} }
                        }
                        return;
                    }
                }
            }
            return;
        }

        // COMMAND
        const args = m.text.slice(prefix.length).trim().split(/ +/);
        const cmdName = args.shift().toLowerCase();
        const command = commands.find(c => c.command === cmdName || (c.aliases && c.aliases.includes(cmdName)));
        if (!command) return;

        // ⭐ PERMANENT OWNER FIX – strip device IDs from both bot and sender
        const botNum = clean(sock.user.id.split('@')[0].split(':')[0]);
        const senderNum = clean(m.sender.split('@')[0].split(':')[0]);
        const isOwner = senderNum === botNum || config.owner.includes(senderNum) || isTempOwnerBase(m.sender);

        // MODE CHECK
        if (cmdName !== 'mode' && getGlobalMode() === 'private' && !isOwner) return;

        await reactRandom(sock, m);

        if (cmdName !== 'unbanuser' && cmdName !== 'unban' && isUserBanned(m.sender) && !isOwner)
            return reply(deny.banned);

        // 🎯 FIXED: Calculate admin status HERE using LID and Phone Number matching
        if (m.isGroup) {
            try {
                const metadata = await sock.groupMetadata(m.chat);
                const senderJid = sock.decodeJid(m.sender);
                const senderNumber = senderJid.split("@")[0].replace(/[^0-9]/g, "");
                
                m.isAdmin = metadata.participants.some(p => {
                    const pJid = sock.decodeJid(p.id);
                    const pNumber = pJid.split("@")[0].replace(/[^0-9]/g, "");
                    const pLid = p.lid ? sock.decodeJid(p.lid) : null;
                    
                    const isMatch = pJid === senderJid || pNumber === senderNumber || pLid === senderJid;
                    return isMatch && (p.admin === "admin" || p.admin === "superadmin" || p.admin === true);
                });

                const botJid = sock.decodeJid(sock.user?.id);
                m.isBotAdmin = metadata.participants.some(p => {
                    const pJid = sock.decodeJid(p.id);
                    const isMatch = pJid === botJid || (p.lid && sock.decodeJid(p.lid) === botJid);
                    return isMatch && (p.admin === "admin" || p.admin === "superadmin" || p.admin === true);
                });
            } catch (e) {
                console.log("Admin check error:", e.message);
                m.isAdmin = false;
                m.isBotAdmin = false;
            }
        }

        const ctx = { args, reply, send, isOwner, isGroup: m.isGroup, isAdmin: m.isAdmin, isBotAdmin: m.isBotAdmin, config, prefix };

        // ---- PERMISSION CHECKS ----
        if (command.owner && !isOwner) return reply(deny.owner);
        if (command.owner && isOwner && m.isGroup) await reply(deny.ownerPrivateReminder);
        if (command.group === false && m.isGroup) return reply(deny.private);
        if (command.group && !m.isGroup) return reply(deny.group);
        if (command.admin) {
            if (!m.isAdmin) return reply(deny.admin);
            if (!m.isBotAdmin) return reply(deny.botAdmin);
        }

        await command.execute(sock, m, ctx);
    } catch (err) {
        console.log("🔥 HANDLER ERROR:", err);
        try { await sock.sendMessage(m.chat, { text: "🤖 Error. Try again later." }, { quoted: m }); } catch {}
    }
};

// ✅ FIXED: PAIR HANDLER - Now correctly waits for the 'connecting' state before requesting the code
module.exports.handlePairChoice = async (sock, m, number, method, reply, send) => {
    const baileys = await import('@whiskeysockets/baileys');
    const { makeWASocket, Browsers, useMultiFileAuthState, fetchLatestBaileysVersion } = baileys;
    const pino = require('pino'), qrcode = require('qrcode'), os = require('os'), path = require('path'), fs = require('fs');

    reply(`⏳ Generating ${method==='qr'?'QR code':'pairing code'} for +${number}...`);

    const tempDir = path.join(os.tmpdir(), `p_${number}_${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    let tempSock;
    try {
        const { state } = await useMultiFileAuthState(tempDir);
        const { version } = await fetchLatestBaileysVersion();

        tempSock = makeWASocket({
            auth: state,
            version,
            browser: Browsers.macOS('Chrome'),
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false
        });

        const result = await new Promise((resolve, reject) => {
            let settled = false;
            const finish = (data) => { if (settled) return; settled = true; resolve(data); };
            const fail = (err) => { if (settled) return; settled = true; reject(err); };
            const timeout = setTimeout(() => fail(new Error('Request timed out.')), 60000);

            if (method === 'code') {
                let codeRequested = false;

                const requestCode = async () => {
                    if (codeRequested) return;
                    codeRequested = true;
                    try {
                        const code = await tempSock.requestPairingCode(number);
                        clearTimeout(timeout);
                        finish({ code });
                    } catch (err) {
                        clearTimeout(timeout);
                        fail(err);
                    }
                };

                tempSock.ev.on('connection.update', async (up) => {
                    const { connection } = up;
                    if (connection === 'connecting') {
                        setTimeout(requestCode, 2000);
                    } else if (connection === 'close') {
                        clearTimeout(timeout);
                        fail(new Error('Connection closed before pairing code could be generated'));
                    }
                });

                setTimeout(requestCode, 4000);

            } else if (method === 'qr') {
                tempSock.ev.on('connection.update', (up) => {
                    if (up.qr) {
                        clearTimeout(timeout);
                        finish({ qr: up.qr });
                    } else if (up.connection === 'close') {
                        clearTimeout(timeout);
                        fail(new Error('Connection closed'));
                    }
                });
            }
        });

        tempSock.end();
        fs.rmSync(tempDir, { recursive: true, force: true });

        if (result.code) {
            reply(`✅ *Pairing Code Ready*\n📞 +${number}\n🔢 *${result.code}*\n⏱️ Expires in 60s\n📱 WhatsApp → Linked devices → Link with phone number`);
            await sock.sendMessage(m.chat, {
                text: `📢 *Stay connected!*\n\nJoin our official channel for updates, support, and news.\n\n🔗 https://whatsapp.com/channel/${config.newsletter.id}`,
                contextInfo: { forwardingScore: 999, isForwarded: true, forwardedNewsletterMessageInfo: { newsletterJid: config.newsletter.id + "@newsletter", newsletterName: config.newsletter.name } }
            }, { quoted: m });
        } else if (result.qr) {
            const qrBuf = await qrcode.toBuffer(result.qr, { type: 'png' });
            await sock.sendMessage(m.chat, { image: qrBuf, caption: `📷 QR for +${number}\nScan to link.` }, { quoted: m });
            await sock.sendMessage(m.chat, {
                text: `📢 *Stay connected!*\n\nJoin our official channel for updates, support, and news.\n\n🔗 https://whatsapp.com/channel/${config.newsletter.id}`,
                contextInfo: { forwardingScore: 999, isForwarded: true, forwardedNewsletterMessageInfo: { newsletterJid: config.newsletter.id + "@newsletter", newsletterName: config.newsletter.name } }
            }, { quoted: m });
        }
    } catch (err) {
        console.error('Pair error:', err);
        try { tempSock?.end(); } catch {}
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
        reply(`❌ Pairing failed: ${err.message || err}`);
    }
};

module.exports.games = games;