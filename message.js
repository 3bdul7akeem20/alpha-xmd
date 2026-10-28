// © 2026 Alpha - MESSAGE HANDLER (STABLE FULL FEATURES)
const fs = require("fs");
const path = require("path");
const config = require("./settings/config");

const clean = (jid) => { if (!jid) return ""; try { return jid.toString().replace(/[^0-9]/g, ""); } catch { return ""; } };

// 🎯 BULLETPROOF ADMIN CHECK (Handles LID, PhoneNumber, ID, and JID)
async function checkAdmin(sock, chatId, senderId, botId) {
    try {
        const metadata = await sock.groupMetadata(chatId);
        const participants = metadata.participants || [];
        
        const senderBase = senderId.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
        const botBase = botId.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');

        let isSenderAdmin = false;
        let isBotAdmin = false;

        for (const p of participants) {
            const pIds = [p.id, p.lid, p.phoneNumber, p.jid].filter(Boolean); 
            let isSenderMatch = false;
            let isBotMatch = false;

            for (const pId of pIds) {
                const pBase = pId.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
                if (pId === senderId || pBase === senderBase) isSenderMatch = true;
                if (pId === botId || pBase === botBase) isBotMatch = true;
            }

            const isAdmin = (p.admin === 'admin' || p.admin === 'superadmin');
            if (isSenderMatch && isAdmin) isSenderAdmin = true;
            if (isBotMatch && isAdmin) isBotAdmin = true;
        }
        return { isSenderAdmin, isBotAdmin };
    } catch (e) {
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

        if (sub === 'on' || sub === 'off') { cfg.enabled = sub === 'on'; } 
        else if (sub === 'mode') { const mode = args[1]?.toLowerCase(); if (['chat', 'owner', 'both'].includes(mode)) cfg.mode = mode; else return reply("❌ Invalid mode."); } 
        else if (sub === 'style') { const style = args[1]?.toLowerCase(); if (['fancy', 'simple'].includes(style)) cfg.style = style; else return reply("❌ Invalid style."); } 
        else if (sub === 'react') { const react = args[1]?.toLowerCase(); if (react === 'on') cfg.react = true; else if (react === 'off') cfg.react = false; else return reply("❌ Use: react on/off"); } 
        else { return reply("❌ Unknown option."); }

        g.antidelete = cfg;
        setGlobalSettings(g);
        reply(`✅ Antidelete updated!`);
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

        // 🎯 AUTO FEATURES (Moved to the VERY TOP so it works on media too)
        const gs = m.globalSettings || getGlobalSettings();
        if (!m.key.fromMe) {
            if (gs.autoread) { try { await sock.readMessages([m.key]); } catch {} }
            if (gs.autotyping) { try { await sock.sendPresenceUpdate("composing", m.chat); } catch {} }
            if (gs.autorecording) { try { await sock.sendPresenceUpdate("recording", m.chat); } catch {} }
            
            const prefix = m.prefix || config.prefix || ".";
            const rawTxt = m.text || "";
            
            if (gs.autoreact && !rawTxt.startsWith(prefix)) {
                const emojis = ["🔥", "😂", "😍", "😎", "🤖", "⚡", "💯", "👀", "🥶", "😈"];
                try { await sock.sendMessage(m.chat, { react: { text: emojis[Math.floor(Math.random() * emojis.length)], key: m.key } }); } catch {}
            }
        }

        // Now check if it's a text message to continue
        if (!m.text) return;

        const prefix = m.prefix || config.prefix || ".";
        
        if (!m.text.startsWith(prefix)) {
            if (m.isGroup && m.text) {
                const gsets = getGroupSettings(m.chat);
                
                if (containsBadWord(m.text, m.chat)) {
                    if (m.isBotAdmin) try { await sock.sendMessage(m.chat, { delete: m.key }); } catch {}
                    await sock.sendMessage(m.chat, { text: `🤬 Watch your language, @${m.sender.split('@')[0]}!`, mentions:[m.sender] }, { quoted: m });
                    return;
                }
                
                if (gsets.antilink) {
                    const mode = gsets.antilinkMode || 'admins';
                    const action = gsets.antilinkAction || 'delete';
                    let allowed = (mode === 'admins' && m.isAdmin) || (mode === 'owner' && m.isOwner);
                    
                    if (!allowed && containsLink(m.text)) {
                        if (action === 'delete') {
                            if (m.isBotAdmin) try { await sock.sendMessage(m.chat, { delete: m.key }); } catch {}
                            await sock.sendMessage(m.chat, { text: `🔗 Links not allowed, @${m.sender.split('@')[0]}.`, mentions:[m.sender] }, { quoted: m });
                        } else if (action === 'warn') {
                            await sock.sendMessage(m.chat, { text: `⚠️ @${m.sender.split('@')[0]}, no links please.`, mentions:[m.sender] }, { quoted: m });
                        } else if (action === 'kick') {
                            if (m.isBotAdmin) try { await sock.groupParticipantsUpdate(m.chat, [m.sender], 'remove'); } catch {}
                        }
                        return;
                    }
                }
            }
            return;
        }

        // COMMAND EXECUTION
        const args = m.text.slice(prefix.length).trim().split(/ +/);
        const cmdName = args.shift().toLowerCase();
        const command = commands.find(c => c.command === cmdName || (c.aliases && c.aliases.includes(cmdName)));
        if (!command) return;

        const botNum = clean(sock.user.id.split('@')[0].split(':')[0]);
        const senderNum = clean(m.sender.split('@')[0].split(':')[0]);
        const isOwner = senderNum === botNum || config.owner.includes(senderNum) || isTempOwnerBase(m.sender);

        if (cmdName !== 'mode' && getGlobalMode() === 'private' && !isOwner) return;

        await reactRandom(sock, m);

        if (cmdName !== 'unbanuser' && cmdName !== 'unban' && isUserBanned(m.sender) && !isOwner)
            return reply(deny.banned);

        let isSenderAdmin = false;
        let isBotAdmin = false;
        
        if (m.isGroup) {
            const adminStatus = await checkAdmin(sock, m.chat, m.sender, sock.user.id);
            isSenderAdmin = adminStatus.isSenderAdmin;
            isBotAdmin = adminStatus.isBotAdmin;
            m.isAdmin = isSenderAdmin;
            m.isBotAdmin = isBotAdmin;
        }

        if (command.admin) {
            if (!isBotAdmin) return reply(deny.botAdmin); 
            if (!isSenderAdmin && !isOwner) return reply(deny.admin); 
        }

        const ctx = { args, reply, send, isOwner, isGroup: m.isGroup, isAdmin: isSenderAdmin, isBotAdmin: isBotAdmin, config, prefix };

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