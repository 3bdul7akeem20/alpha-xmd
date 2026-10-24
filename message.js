// © 2026 Alpha - MESSAGE HANDLER (STABLE FULL FEATURES)
const fs = require("fs");
const path = require("path");
const config = require("./settings/config");

const clean = (jid) => { if (!jid) return ""; try { return jid.toString().replace(/[^0-9]/g, ""); } catch { return ""; } };

// 🎯 HELPER: BULLETPROOF ADMIN CHECK (Handles LID and Phone Number)
async function checkAdmin(sock, chatId, senderId, botId) {
    try {
        const metadata = await sock.groupMetadata(chatId);
        const participants = metadata.participants || [];
        
        const senderBase = senderId.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
        const botBase = botId.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');

        let isSenderAdmin = false;
        let isBotAdmin = false;

        for (const p of participants) {
            const pId = p.id || '';
            const pLid = p.lid || '';
            
            const pIdBase = pId.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
            const pLidBase = pLid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');

            const isSenderMatch = (pId === senderId || pLid === senderId || pIdBase === senderBase || pLidBase === senderBase);
            const isBotMatch = (pId === botId || pLid === botId || pIdBase === botBase || pLidBase === botBase);

            if (isSenderMatch && (p.admin === 'admin' || p.admin === 'superadmin')) isSenderAdmin = true;
            if (isBotMatch && (p.admin === 'admin' || p.admin === 'superadmin')) isBotAdmin = true;
        }

        return { isSenderAdmin, isBotAdmin };
    } catch (e) {
        console.log("Admin check error:", e.message);
        return { isSenderAdmin: false, isBotAdmin: false };
    }
}

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
                const adminStatus = await checkAdmin(sock, m.chat, m.sender, sock.user.id);
                if (adminStatus.isBotAdmin) try { await sock.sendMessage(m.chat, { delete: m.key }); } catch {}
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
                    const adminStatus = await checkAdmin(sock, m.chat, m.sender, sock.user.id);
                    
                    let allowed = false;
                    if (mode === 'owner') { try { const meta = await sock.groupMetadata(m.chat); allowed = (meta.owner === m.sender); } catch { allowed = false; } }
                    else allowed = adminStatus.isSenderAdmin;
                    
                    if (!allowed && containsLink(m.text)) {
                        if (action === 'delete') {
                            if (adminStatus.isBotAdmin) try { await sock.sendMessage(m.chat, { delete: m.key }); } catch {}
                            else { try { const meta = await sock.groupMetadata(m.chat); await sock.sendMessage(m.chat, { text: `🙏 @${meta.owner.split('@')[0]} make me admin to delete links.`, mentions:[meta.owner] }, { quoted: m }); } catch {} }
                            const warn = `🔗 Links not allowed, @${m.sender.split('@')[0]}. Message deleted.`;
                            await sock.sendMessage(m.chat, { text: warn, mentions:[m.sender] }, { quoted: m });
                        } else if (action === 'warn') {
                            const warn = `⚠️ @${m.sender.split('@')[0]}, no links please.`;
                            await sock.sendMessage(m.chat, { text: warn, mentions:[m.sender] }, { quoted: m });
                        } else if (action === 'kick') {
                            if (adminStatus.isBotAdmin) try { await sock.groupParticipantsUpdate(m.chat, [m.sender], 'remove'); } catch {}
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

        // ⭐ PERMANENT OWNER FIX
        const botNum = clean(sock.user.id.split('@')[0].split(':')[0]);
        const senderNum = clean(m.sender.split('@')[0].split(':')[0]);
        const isOwner = senderNum === botNum || config.owner.includes(senderNum) || isTempOwnerBase(m.sender);

        // MODE CHECK
        if (cmdName !== 'mode' && getGlobalMode() === 'private' && !isOwner) return;

        await reactRandom(sock, m);

        if (cmdName !== 'unbanuser' && cmdName !== 'unban' && isUserBanned(m.sender) && !isOwner)
            return reply(deny.banned);

        // 🎯 EXACT FLOW YOU REQUESTED
        if (command.admin) {
            const adminStatus = await checkAdmin(sock, m.chat, m.sender, sock.user.id);
            
            // 1. Bot needs to be admin FIRST
            if (!adminStatus.isBotAdmin) return reply(deny.botAdmin); 
            
            // 2. Then sender needs to be admin (or bot owner bypass)
            if (!adminStatus.isSenderAdmin && !isOwner) return reply(deny.admin); 
        }

        const ctx = { args, reply, send, isOwner, isGroup: m.isGroup, isAdmin: command.admin ? true : false, isBotAdmin: command.admin ? true : false, config, prefix };

        // ---- PERMISSION CHECKS ----
        if (command.owner && !isOwner) return reply(deny.owner);
        if (command.owner && isOwner && m.isGroup) await reply(deny.ownerPrivateReminder);
        if (command.group === false && m.isGroup) return reply(deny.private);
        if (command.group && !m.isGroup) return reply(deny.group);

        await command.execute(sock, m, ctx);
    } catch (err) {
        console.log("🔥 HANDLER ERROR:", err);
        try { await sock.sendMessage(m.chat, { text: "🤖 Error. Try again later." }, { quoted: m }); } catch {}
    }
};

module.exports.games = games;