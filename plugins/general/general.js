// © 2026 Alpha - GENERAL COMMANDS (PRIORITY ORDER MENU)

const fs = require('fs');
const os = require('os');
const path = require('path');
const config = require("../../settings/config");

const R = (arr) => arr[Math.floor(Math.random() * arr.length)];

function runtime(seconds) {
    seconds = Number(seconds);
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor(seconds % (3600 * 24) / 3600);
    const m = Math.floor(seconds % 3600 / 60);
    const s = Math.floor(seconds % 60);
    return `${d}d ${h}h ${m}m ${s}s`;
}

const getCountry = (jid) => {
    if (!jid) return "Unknown 🌍";
    try {
        const PhoneNumber = require('awesome-phonenumber');
        let number = jid.replace(/[^0-9]/g, '');
        const pn = PhoneNumber('+' + number);
        if (pn.getRegionCode()) {
            const country = pn.getCountry();
            const flag = pn.getRegionCode().toUpperCase().replace(/./g, char =>
                String.fromCodePoint(char.charCodeAt(0) + 127397)
            );
            return `${country} ${flag}`;
        }
        return "Unknown 🌍";
    } catch {
        return "Unknown 🌍";
    }
};

module.exports = [
    {
        command: "menu",
        aliases: ["help", "commands"],
        category: "general",
        execute: async (sock, m, { send }) => {
            try {
                const loadMsg = await sock.sendMessage(m.chat, {
                    text: "⏳ Loading 0% ███▒▒▒▒▒▒▒"
                }, { quoted: m });

                await new Promise(resolve => setTimeout(resolve, 700));
                await sock.sendMessage(m.chat, {
                    text: "⚡ Loaded 100% ████████████",
                    edit: loadMsg.key
                });

                const now = new Date();
                const time = now.toLocaleTimeString();
                const date = now.toLocaleDateString();
                const pushname = m.pushName || "User";
                const uptime = runtime(process.uptime());
                const country = getCountry((m.sender || "").replace(/[^0-9]/g, ""));

                const menu = `
╭───〔 ${config.settings.title} 〕───⬣

👤 *User:* ${pushname}
🌍 *Country:* ${country}
🕒 *Time:* ${time}
📅 *Date:* ${date}
⚡ *Uptime:* ${uptime}

╰────────────⬣

╭───〔 📊 GENERAL 〕───⬣
│ • .menu
│ • .ping
│ • .alive
│ • .info
│ • .owner
│ • .repo
│ • .pair
╰────────────⬣

╭───〔 👑 OWNER 〕───⬣
│ • .update
│ • .restart
│ • .shutdown
│ • .eval
│ • .bc
│ • .bcgc
│ • .join
│ • .leave
│ • .block
│ • .unblock
│ • .blocklist
│ • .pm
│ • .banuser
│ • .unbanuser
│ • .banlist
│ • .addowner
│ • .delowner
│ • .owners
│ • .mode
│ • .anticall
│ • .poststatus
│ • .cleartmp
│ • .clearsession
│ • .sudo
│ • .antiblock
│ • .clear
│ • .vv2
│ • .tostatus
│ • .toviewonce
│ • .save
│ • .delete
╰────────────⬣

╭───〔 👥 GROUP 〕───⬣
│ • .tagall
│ • .kick
│ • .add
│ • .promote
│ • .demote
│ • .mute
│ • .unmute
│ • .hidetag
│ • .groupinfo
│ • .grouplink
│ • .revokelink
│ • .welcome on/off
│ • .goodbye on/off
│ • .antilink
│ • .antispam
│ • .antibadword
│ • .antibot
│ • .antitag
│ • .antisticker
│ • .antidemote
│ • .poll
│ • .listadmin
│ • .tagadmin
│ • .tagnotadmin
│ • .vcf
│ • .promoteall
│ • .demoteall
│ • .kickall
│ • .approveall
│ • .kickinactive
│ • .setgname
│ • .setgdesc
│ • .setgpp
│ • .warn
│ • .warnings
│ • .resetwarn
│ • .requestlist
│ • .rejectall
│ • .newgc
│ • .online
│ • .staff
│ • .myactivity
│ • .rank
│ • .invite
│ • .listactive
│ • .listinactive
│ • .totalmembers
│ • .topmembers
│ • .mediatag
│ • .getname
│ • .getdeskgc
│ • .getppgc
│ • .svcontact
│ • .opengroup
│ • .closegroup
│ • .approve
│ • .reject
│ • .disapproveall
│ • .addcode
│ • .delcode
│ • .listcode
│ • .allow
│ • .delallowed
│ • .listallowed
│ • .editsettings
│ • .removes
│ • .gcstatus
╰────────────⬣

╭───〔 📥 DOWNLOADER 〕───⬣
│ • .play
│ • .video
│ • .spotify
│ • .tiktok
│ • .instagram
│ • .facebook
│ • .ytpost
│ • .pindl
│ • .mediafire
│ • .gdrive
│ • .ringtone
│ • .yts
│ • .lyrics
│ • .apk
│ • .movie
│ • .wallpaper
│ • .gitclone
│ • .img
│ • .shazam
╰────────────⬣

╭───〔 ⚙️ SETTINGS 〕───⬣
│ • .autoread
│ • .autotyping
│ • .autorecording
│ • .autoreact
│ • .autoreactstatus
│ • .autoviewstatus
│ • .autostatus
│ • .antidelete
│ • .antiedit
│ • .autoreply
│ • .autosticker
│ • .autovoice
│ • .dmblocker
│ • .autosavestatus
│ • .autobio
│ • .autoblock
│ • .lastseen
│ • .ppprivacy
│ • .readreceipts
│ • .alwaysonline
│ • .fakelastseen
│ • .antibug
│ • .antiviewonce
│ • .setpp
│ • .setbio
│ • .setname
│ • .setprefix
│ • .resetprefix
│ • .chreact
│ • .setcontextlink
│ • .setfont
│ • .setmenu
│ • .setmenuimage
│ • .setownername
│ • .setownernumber
│ • .setstatusemoji
│ • .setstickerauthor
│ • .setstickerpackname
│ • .settimezone
│ • .setwarn
│ • .setwatermark
│ • .setwelcome
│ • .setgoodbye
│ • .showwelcome
│ • .showgoodbye
│ • .testwelcome
│ • .testgoodbye
│ • .statusdelay
│ • .statussettings
│ • .listwarn
╰────────────⬣

╭───〔 🤖 AI & IMAGE GEN 〕───⬣
│ • .gpt
│ • .gemini
│ • .blackbox
│ • .deepseek
│ • .copilot
│ • .claude
│ • .perplexity
│ • .venice
│ • .chatbot
│ • .dalle
│ • .flux
│ • .imagine
│ • .animagine
│ • .dreamshaper
│ • .pony
│ • .pixar
│ • .cartoon
│ • .seedream
│ • .toghibili
╰────────────⬣

╭───〔 🔧 UTILITIES 〕───⬣
│ • .tinyurl
│ • .fliptext
│ • .genpass
│ • .device
│ • .browse
│ • .fancy
│ • .font
│ • .carbon
│ • .obfuscate
│ • .calc
│ • .qr
│ • .tts
│ • .translate
│ • .weather
│ • .tozip
│ • .styletext
│ • .readmore
│ • .ngldm
│ • .webzip
│ • .disk
╰────────────⬣

╭───〔 🔍 SEARCH 〕───⬣
│ • .gsmarena
│ • .google
│ • .bing
│ • .livewallpapers
│ • .imdb
│ • .define
│ • .wiki
╰────────────⬣

╭───〔 🌐 INFORMATION 〕───⬣
│ • .news
│ • .countryinfo
│ • .check
│ • .bible
│ • .quran
│ • .inspect
│ • .webcrawl
╰────────────⬣

╭───〔 🎨 PHOTO EFFECTS 〕───⬣
│ • .zombie
│ • .figure
│ • .underground
│ • .oldage
│ • .turky
│ • .train
│ • .streetwear
│ • .tatoo
│ • .satan
│ • .sdm
│ • .spirit
│ • .toroblox
│ • .mirror
│ • .partner
│ • .bf
│ • .gf
│ • .polaroid
│ • .punk
│ • .piramid
│ • .peci
│ • .island
│ • .mangu
│ • .liquor
│ • .mecca
│ • .mayan
│ • .maid
│ • .glasses
│ • .cambodia
│ • .japan
│ • .hijab
│ • .hitam
│ • .vintage
╰────────────⬣

╭───〔 🎨 LOGO & TEXT MAKERS 〕───⬣
│ • .hacker
│ • .neon
│ • .fire
│ • .gold
│ • .logo
│ • .glitch
│ • .avenger
│ • .pubg
│ • .naruto
│ • .matrix
│ • .graffiti
│ • .1000d
│ • .rainbow
│ • .metallic
│ • .ice
│ • .snow
│ • .purple
│ • .thunder
│ • .water
│ • .underwater
│ • .4d
│ • .luxury
│ • .silver
│ • .foggyglass
│ • .wetglass
│ • .candy
│ • .christmas
│ • .3dchristmas
│ • .sparklechristmas
│ • .deepsea
│ • .scifi
│ • .waterpipe
│ • .spooky
│ • .pencil
│ • .circuit
│ • .discovery
│ • .fiction
│ • .transformer
│ • .berry
│ • .magma
│ • .3dstone
│ • .neonlight
│ • .harrypotter
│ • .brokenglass
│ • .papercut
│ • .watercolor
│ • .multicolor
│ • .neondevil
│ • .graffitibike
│ • .cloud
│ • .honey
│ • .fruitjuice
│ • .biscuit
│ • .wood
│ • .chocolate
│ • .strawberry
│ • .blood
│ • .dropwater
│ • .toxic
│ • .lava
│ • .rock
│ • .bloodglass
│ • .halloween
│ • .darkgold
│ • .joker
│ • .wicker
│ • .firework
│ • .skeleton
│ • .sand
│ • .glue
│ • .1917
│ • .leaves
╰────────────⬣

╭───〔 🎵 AUDIO EFFECTS 〕───⬣
│ • .deep
│ • .smooth
│ • .fat
│ • .blown
│ • .radio
│ • .robot
│ • .chipmunk
│ • .nightcore
│ • .earrape
│ • .bass
│ • .reverse
│ • .slow
│ • .fast
│ • .baby
│ • .demon
╰────────────⬣

╭───〔 😂 EMOJI ANIMATIONS 〕───⬣
│ • .happy
│ • .heart
│ • .angry
│ • .sad
│ • .shy
│ • .moon
│ • .confused
│ • .hot
│ • .nikal
╰────────────⬣

╭───〔 🎮 GAMES & FUN 〕───⬣
│ • .tictactoe
│ • .hangman
│ • .guess
│ • .quiz
│ • .trivia
│ • .answer
│ • .truth
│ • .dare
│ • .8ball
│ • .compliment
│ • .insult
│ • .flirt
│ • .shayari
│ • .simp
│ • .stupid
│ • .goodnight
│ • .meme
│ • .squidgame
│ • .konami
│ • .lovetest
│ • .aura
│ • .dice
│ • .roll
│ • .joke
│ • .quote
│ • .fact
│ • .flip
│ • .rps
│ • .ship
│ • .hug
│ • .emojimix
│ • .wcg
╰────────────⬣

╭───〔 🎌 ANIME & REACTIONS 〕───⬣
│ • .waifu
│ • .neko
│ • .shinobu
│ • .megumin
│ • .aizen
│ • .animequote
│ • .anime
│ • .manga
│ • .topanime
│ • .topmanga
│ • .character
│ • .randomanime
│ • .seasonal
│ • .hentai 🔞
│ • .hentaigif 🔞
│ • .nom
│ • .poke
│ • .cry
│ • .kiss
│ • .pat
│ • .wink
│ • .facepalm
│ • .slap
│ • .bite
╰────────────⬣

╭───〔 🎬 MOVIES / SERIES 〕───⬣
│ • .selectmovie
│ • .dlmovie
│ • .dlseries
│ • .selectseries
│ • .seriesinfo
╰────────────⬣

╭───〔 ⚽ FOOTBALL 〕───⬣
│ • .livescore
│ • .competitions
│ • .matches
│ • .standings
│ • .team
│ • .head2head
│ • .matchlist
│ • .teamperson
│ • .teammatches
│ • .areas
╰────────────⬣

╭───〔 👁️ STALK 〕───⬣
│ • .npmstalk
│ • .wastalk
│ • .igstalk
│ • .tiktokstalk
│ • .twitterstalk
│ • .ytstalk
│ • .tgstalk
│ • .minecraftstalk
│ • .xboxstalk
│ • .steamstalk
│ • .githubstalk
╰────────────⬣

╭───〔 🐙 GITHUB 〕───⬣
│ • .ghlogin
│ • .ghtoken
│ • .ghcreate
│ • .ghdelete
│ • .ghpush
│ • .ghpushall
│ • .ghcommit
│ • .ghfork
│ • .ghlist
│ • .ghbranches
│ • .ghdeletefile
│ • .ghcreatebranch
│ • .ghlogout
╰────────────⬣

╭───〔 📺 CHANNEL 〕───⬣
│ • .createchannel
│ • .followchannel
│ • .unfollowchannel
│ • .updatechannelname
│ • .updatechannelpic
│ • .updatechanneldesc
│ • .mutechannel
│ • .unmutechannel
│ • .deletechannel
╰────────────⬣

╭───〔 💰 FINANCE 〕───⬣
│ • .currencylist
│ • .rates
│ • .exchange
│ • .forex
╰────────────⬣

╭───〔 📧 TEMP MAIL / NUMBER 〕───⬣
│ • .tempmail
│ • .tempinbox
│ • .tempnumber
│ • .checksms
│ • .listcountries
╰────────────⬣

╭───〔 🖥️ CPANEL 〕───⬣
│ • .addserver
│ • .delserver
│ • .listservers
│ • .sendpanel
│ • .1gb…9gb
│ • .unli
│ • .admin
│ • .addprem
│ • .delprem
│ • .premiumlist
│ • .bothosting
╰────────────⬣

${config.settings.footer}
`;

                await send({
                    image: { url: config.thumbUrl },
                    caption: menu
                });

            } catch (err) {
                console.log("Menu error:", err);
                await sock.sendMessage(m.chat, { text: "❌ Menu failed to load" }, { quoted: m });
            }
        }
    },

    {
        command: "ping",
        aliases: ["p"],
        category: "general",
        execute: async (sock, m, { reply }) => {
            const latency = m.messageTimestamp ? (Date.now() - (m.messageTimestamp * 1000)) : '??';
            const pings = [
                `🏓 Pong! ${latency}ms — faster than your WiFi on a good day.`,
                `⚡ ${latency}ms — I'm basically speed.`,
                `📡 ${latency}ms — the connection is so good I can hear you thinking.`,
                `🛰️ ${latency}ms — signal came from Mars, apparently.`,
                `🤖 ${latency}ms — beep boop, I'm alive!`
            ];
            reply(R(pings));
        }
    },

    {
        command: "alive",
        aliases: ["online", "test"],
        category: "general",
        execute: async (sock, m, { reply }) => {
            const uptime = runtime(process.uptime());
            const memory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
            const ping = m.messageTimestamp ? (Date.now() - (m.messageTimestamp * 1000)) : '??';

            const quotes = [
                `✅ I'm alive and kicking! ⏳ Uptime: ${uptime} | 🧠 RAM: ${memory}MB | 📡 Ping: ${ping}ms`,
                `🟢 Reporting for duty! Uptime: ${uptime} | Ping: ${ping}ms | RAM: ${memory}MB`,
                `💪 Still breathing, human. Uptime: ${uptime} | Ping: ${ping}ms`,
                `🤖 Beep boop… I'm online! Uptime: ${uptime} | Memory: ${memory}MB`,
                `🏃‍♂️ Running like a champ. Uptime: ${uptime} | Ping: ${ping}ms`
            ];

            reply(R(quotes));
        }
    },

    {
        command: "info",
        aliases: ["botinfo", "status"],
        category: "general",
        execute: async (sock, m, { reply }) => {
            const uptime = runtime(process.uptime());
            const memory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
            const platform = os.platform();
            const hostname = os.hostname();
            const nodeVersion = process.version;
            const botName = config.settings?.title || 'Alpha Bot';
            const owner = config.owner?.[0] || 'Unknown';
            const ownerJid = owner.includes('@') ? owner : owner + '@s.whatsapp.net';

            const infos = [
                `📊 *${botName} Info*\n\n⏳ Uptime: ${uptime}\n🧠 Memory: ${memory} MB\n💻 Platform: ${platform}\n🖥️ Host: ${hostname}\n🔧 Node.js: ${nodeVersion}\n👑 Owner: @${owner}`,
                `🤖 *Bot Status*\n\n🟢 Status: Online\n⏱️ Running: ${uptime}\n📡 Ping: Fast\n🧠 RAM: ${memory}MB\n👤 Owner: @${owner}`,
                `📋 *Technical Info*\n\n⚡ Uptime: ${uptime}\n💾 Memory: ${memory}MB\n🖥️ OS: ${platform}\n🔢 Node: ${nodeVersion}\n👑 @${owner}`
            ];

            reply(R(infos), { mentions: [ownerJid] });
        }
    },

    {
        command: "owner",
        aliases: ["creator", "dev"],
        category: "general",
        execute: async (sock, m, { reply }) => {
            const ownerNumber = config.owner?.[0] || 'Unknown';
            const ownerName = config.settings?.title?.split(' ')[0] || 'Alpha';
            const ownerJid = ownerNumber.includes('@') ? ownerNumber : ownerNumber + '@s.whatsapp.net';

            const messages = [
                `👑 *Owner:* @${ownerNumber}\n👤 *Name:* ${ownerName}\n\n💬 DM anytime.`,
                `🤴 *The Boss*\n📞 @${ownerNumber}\n👤 ${ownerName}\n\nMessage for business/support.`,
                `🫅 *Contact*\n👤 ${ownerName}\n📱 @${ownerNumber}\n\nDMs open.`,
                `👤 *Bot Creator*\n${ownerName}\n📞 @${ownerNumber}\n\nReach out anytime.`
            ];

            reply(R(messages), { mentions: [ownerJid] });
        }
    },

    {
        command: "repo",
        aliases: ["source", "github", "sc"],
        category: "general",
        execute: async (sock, m, { reply }) => {
            const repoLink = "https://GitHub.com/Alexio11-09/alpha-xmd";
            const ownerName = "Alpha";
            const ownerContact = "wa.me/263786641436";
            const botName = config.settings?.title || "Alpha Bot";

            const texts = [
                `📂 *${botName} – Source Code*\n\n🔗 *Repo:* ${repoLink}\n👤 *Owner:* ${ownerName}\n📞 *Contact:* ${ownerContact}\n\n⭐ Star & fork freely!`,
                `🧬 *Open Source Bot*\n\n💻 *Repo:* ${repoLink}\n👑 *Dev:* ${ownerName}\n📱 *WhatsApp:* ${ownerContact}\n\n🤖 Build your own version.`,
                `⚡ *Alpha XMD Repository*\n\n🔗 ${repoLink}\n👤 *Maintainer:* ${ownerName}\n📞 ${ownerContact}\n\n📥 Clone, modify, deploy.`
            ];

            reply(texts[Math.floor(Math.random() * texts.length)]);
        }
    },

    {
        command: "pair",
        aliases: ["pairing", "session"],
        category: "general",
        execute: async (sock, m, { args, reply }) => {
            if (!args[0]) return reply("❌ Provide a phone number!\n\n📌 Example: .pair 263786641436");
            const rawNumber = args[0].replace(/[^0-9]/g, "");
            if (rawNumber.length < 10) return reply("❌ Invalid phone number.");

            reply(`🔐 Requesting pairing code for +${rawNumber}... Please wait.`);

            try {
                const { makeWASocket, Browsers, useMultiFileAuthState, fetchLatestBaileysVersion } = await import('@whiskeysockets/baileys');
                const pino = require('pino');
                
                const sessionPath = path.join(process.cwd(), 'sessions', rawNumber);
                if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath, { recursive: true });

                const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
                const { version } = await fetchLatestBaileysVersion();

                const tempSock = makeWASocket({
                    auth: state,
                    version,
                    browser: Browsers.macOS('Chrome'),
                    logger: pino({ level: 'silent' }),
                    printQRInTerminal: false,
                    connectTimeoutMs: 60000
                });

                tempSock.ev.on('creds.update', saveCreds);
                let responded = false;

                tempSock.ev.on('connection.update', async (update) => {
                    const { connection } = update;

                    if (connection === 'connecting' && !responded) {
                        setTimeout(async () => {
                            try {
                                const code = await tempSock.requestPairingCode(rawNumber);
                                const formatted = code.match(/.{1,4}/g)?.join("-") || code;
                                if (!responded) {
                                    responded = true;
                                    reply(
                                        `✅ *Pairing Code Ready*\n\n` +
                                        `📞 *Number:* +${rawNumber}\n` +
                                        `🔢 *Code:* *${formatted}*\n\n` +
                                        `⏱️ Expires in 60 seconds.\n` +
                                        `📱 Open WhatsApp → Linked devices → Link with phone number → Enter this code.`
                                    );
                                }
                            } catch (err) {
                                if (!responded) {
                                    responded = true;
                                    reply(`❌ Pairing failed: ${err.message || String(err)}`);
                                    tempSock.end();
                                }
                            }
                        }, 3000);
                    }

                    if (connection === 'open') {
                        reply(`🎉 Successfully connected +${rawNumber}!\n\nYour bot is now starting... You will receive a startup message shortly.`);
                        
                        // 🎯 FIX: Close temp socket, wait, then start main bot
                        setTimeout(() => {
                            try { tempSock.end(undefined); } catch(e) {}
                            setTimeout(() => {
                                if (global.startBot) global.startBot(rawNumber);
                                else reply("⚠️ Internal error: startBot not found.");
                            }, 3000);
                        }, 5000);
                    }

                    if (connection === 'close' && !responded) {
                        responded = true;
                        reply(`❌ Pairing timed out or closed. Please try again.`);
                    }
                });

            } catch (err) {
                console.error('Pair error:', err);
                reply(`❌ Error: ${err.message || String(err)}`);
            }
        }
    }
];