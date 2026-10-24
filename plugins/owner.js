const fs=require('fs'),{exec}=require('child_process'),os=require('os'),path=require('path'),{downloadContentFromMessage}=require('@whiskeysockets/baileys'),cl=j=>j?j.replace(/[^0-9]/g,''):'';
const bp='./database/banned.json',op='./database/owners.json';
[bp,op].forEach(p=>{if(!fs.existsSync(path.dirname(p)))fs.mkdirSync(path.dirname(p),{recursive:!0});if(!fs.existsSync(p))fs.writeFileSync(p,p.endsWith('banned.json')?'{}':JSON.stringify({tempOwners:[]}))});
const LB=()=>{try{return JSON.parse(fs.readFileSync(bp))}catch{return{}}},SB=d=>fs.writeFileSync(bp,JSON.stringify(d,null,2)),LO=()=>{try{return JSON.parse(fs.readFileSync(op))}catch{return{tempOwners:[]}}},SO=d=>fs.writeFileSync(op,JSON.stringify(d,null,2)),H=(s,m,r)=>s.sendMessage(m.chat,{text:r},{quoted:m}),T=(s,m)=>m.mentionedJid?.[0]||m.quoted?.sender||(s?s.replace(/[^0-9]/g,'')+'@s.whatsapp.net':null);

module.exports=[
{command:"botip",aliases:["serverip","myip","getip"],category:"owner",owner:!0,execute:async(s,m,{reply:r})=>{exec('curl -s ifconfig.me',(e,o)=>{e?exec('curl -s ipinfo.io/ip',(e2,o2)=>H(s,m,r(`🌐 ${o2.trim()}`))):H(s,m,r(`🌐 ${o.trim()}`))})}},
{command:"restart",aliases:["reboot","reload"],category:"owner",owner:!0,execute:async(s,m,{reply:r})=>{await H(s,m,r("🔄 Restarting session..."));setTimeout(async()=>{try{await s.end(undefined)}catch(e){}},2000)}},

// 🎯 FIXED: No more isPO restriction. Any bot owner can use this.
{command:"update",aliases:["up"],category:"owner",owner:!0,execute:async(s,m,{reply:r})=>{
    await H(s,m,r("⏳ Pulling latest updates from GitHub..."));
    
    exec('git pull', (err, stdout, stderr) => {
        if (err) return H(s,m,r(`❌ Update failed:\n${err.message}`));
        
        if (stdout.includes("Already up to date.")) {
            return H(s,m,r("✅ Bot is already up to date. No changes pulled."));
        }

        H(s,m,r(`✅ *Update Successful!*\n\n🔄 Restarting server to apply changes...\n*(Sessions are safe and will auto-reconnect in a few seconds. No re-pairing needed!)*`));
        
        setTimeout(() => {
            process.exit(0); // Pterodactyl catches this and restarts the server
        }, 5000);
    });
}},

{command:"shutdown",aliases:["stop","kill"],category:"owner",owner:!0,execute:async(s,m,{reply:r})=>{await H(s,m,r("🔴 Shutting down..."));setTimeout(()=>process.exit(0),1500)}},
{command:"eval",aliases:[">","exec"],category:"owner",owner:!0,execute:async(s,m,{args:a,reply:r})=>{if(!a[0])return H(s,m,r("❌ Code?"));try{let res=eval(a.join(" "));typeof res==='object'&&(res=JSON.stringify(res,null,2));H(s,m,r(`✅ ${String(res).substring(0,1000)}`))}catch(e){H(s,m,r(`❌ ${e.message}`))}}},
{command:"bc",aliases:["broadcast"],category:"owner",owner:!0,execute:async(s,m,{args:a,reply:r})=>{if(!a[0])return H(s,m,r("❌ Msg?"));let msg=a.join(" "),chats=Object.keys(await s.groupFetchAllParticipating());if(!chats.length)return H(s,m,r("❌ No groups."));H(s,m,r(`📢 ${chats.length} groups...`));let ok=0,fl=0;for(let c of chats){try{await s.sendMessage(c,{text:`📢 BROADCAST\n\n${msg}`});ok++}catch{fl++};await new Promise(r=>setTimeout(r,500))}H(s,m,r(`✅ ${ok} | ❌ ${fl}`))}},
{command:"join",aliases:["enter"],category:"owner",owner:!0,execute:async(s,m,{args:a,reply:r})=>{if(!a[0])return H(s,m,r("❌ Link?"));let code=a[0].split('/').pop().replace(/\?.*/,'');try{H(s,m,r(`✅ Joined: ${await s.groupAcceptInvite(code)}`))}catch(e){H(s,m,r(`❌ ${e.message}`))}}},
{command:"leave",aliases:["exit"],category:"owner",owner:!0,execute:async(s,m,{args:a,reply:r})=>{if(!m.isGroup)return H(s,m,r("❌ Groups only."));if(a[0]==='all'){let chats=Object.keys(await s.groupFetchAllParticipating()),ok=0;for(let c of chats){try{await s.groupLeave(c);ok++}catch{}}H(s,m,r(`✅ Left ${ok} groups.`))}else{try{await s.groupLeave(m.chat)}catch(e){H(s,m,r(`❌ ${e.message}`))}}}},
{command:"block",category:"owner",owner:!0,execute:async(s,m,{args:a,reply:r})=>{let t=m.isGroup?T(a[0],m):m.chat;if(!t||t===s.user.id)return H(s,m,r("❌ Target?"));try{await s.updateBlockStatus(t,"block");H(s,m,r(`🚫 @${t.split('@')[0]}`))}catch(e){H(s,m,r(`❌ ${e.message}`))}}},
{command:"unblock",category:"owner",owner:!0,execute:async(s,m,{args:a,reply:r})=>{let t=m.isGroup?T(a[0],m):m.chat;if(!t)return H(s,m,r("❌ Target?"));try{await s.updateBlockStatus(t,"unblock");H(s,m,r(`✅ @${t.split('@')[0]}`))}catch(e){H(s,m,r(`❌ ${e.message}`))}}},
{command:"blocklist",category:"owner",owner:!0,execute:async(s,m,{reply:r})=>{try{let b=await s.fetchBlocklist();if(!b.length)return H(s,m,r("📋 None."));let t=`🚫 ${b.length}\n\n`;b.forEach(u=>t+=`• @${u.split('@')[0]}\n`);s.sendMessage(m.chat,{text:t,mentions:b})}catch(e){H(s,m,r(`❌ ${e.message}`))}}},
{command:"pm",aliases:["msg"],category:"owner",owner:!0,execute:async(s,m,{args:a,reply:r})=>{if(!a[0]||!a[1])return H(s,m,r("❌ .pm <num> <msg>"));try{await s.sendMessage(a[0].replace(/[^0-9]/g,'')+'@s.whatsapp.net',{text:a.slice(1).join(" ")});H(s,m,r("✅ Sent"))}catch(e){H(s,m,r(`❌ ${e.message}`))}}},
{command:"ban",category:"owner",owner:!0,execute:async(s,m,{args:a,reply:r})=>{let t=T(a[0],m);if(!t)return H(s,m,r("❌ Target?"));let b=LB();b[cl(t)]={jid:t,date:new Date().toISOString()};SB(b);H(s,m,r(`🚫 Banned @${t.split('@')[0]}`))}},
{command:"unban",category:"owner",owner:!0,execute:async(s,m,{args:a,reply:r})=>{let t=T(a[0],m);if(!t)return H(s,m,r("❌ Target?"));let b=LB(),n=cl(t);if(b[n]){delete b[n];SB(b);H(s,m,r(`✅ Unbanned @${t.split('@')[0]}`))}else H(s,m,r("❌ Not banned."))}},
{command:"banlist",category:"owner",owner:!0,execute:async(s,m,{reply:r})=>{let b=Object.values(LB());if(!b.length)return H(s,m,r("📋 None."));let t=`🚫 ${b.length}\n\n`,men=[];b.forEach(u=>{t+=`• @${u.jid.split('@')[0]}\n`;men.push(u.jid)});s.sendMessage(m.chat,{text:t,mentions:men})}},
{command:"addowner",category:"owner",owner:!0,execute:async(s,m,{args:a,reply:r})=>{let t=T(a[0],m);if(!t)return H(s,m,r("❌ Target?"));let o=LO(),n=cl(t);if(!o.tempOwners.includes(n)){o.tempOwners.push(n);SO(o);H(s,m,r(`👑 Added @${t.split('@')[0]}`))}else H(s,m,r("❌ Already owner."))}},
{command:"delowner",category:"owner",owner:!0,execute:async(s,m,{args:a,reply:r})=>{let t=T(a[0],m);if(!t)return H(s,m,r("❌ Target?"));let o=LO(),n=cl(t),i=o.tempOwners.indexOf(n);if(i>-1){o.tempOwners.splice(i,1);SO(o);H(s,m,r(`✅ Removed @${t.split('@')[0]}`))}else H(s,m,r("❌ Not owner."))}},
{command:"owners",category:"owner",owner:!0,execute:async(s,m,{reply:r,config:cfg})=>{let o=LO(),t=`👑 OWNERS\n\n🔷 Main: ${cfg.owner.join(', ')}\n`;if(o.tempOwners.length){t+=`\n🔶 Temp:\n`;o.tempOwners.forEach(x=>t+=`• ${x}\n`)}H(s,m,r(t))}},
{command:"getchannel",aliases:["cjid"],category:"owner",owner:!0,execute:async(s,m,{args:a,reply:r})=>{let m2=a[0]?.match(/channel\/([^\/\?]+)/);if(!m2)return H(s,m,r("❌ Link?"));H(s,m,r(`✅ \`${m2[1]+'@newsletter'}\``))}},
{command:"anticall",category:"owner",owner:!0,execute:async(s,m,{args:a,reply:r})=>{let p='./database/anticall.json';if(!fs.existsSync(p))fs.writeFileSync(p,'{"enabled":0}');let c=a[0]?.toLowerCase();if(c==='on'||c==='off'){fs.writeFileSync(p,`{"enabled":${c==='on'?1:0}}`);H(s,m,r(`📵 ${c.toUpperCase()}`))}else{let d=JSON.parse(fs.readFileSync(p));H(s,m,r(`📵 ${d.enabled?'ON':'OFF'}`))}}},
{command:"autoreply",category:"owner",owner:!0,execute:async(s,m,{args:a,reply:r})=>{let p='./database/autoreply.json';if(!fs.existsSync(p))fs.writeFileSync(p,'{"enabled":0,"msg":"Busy."}');let c=a[0]?.toLowerCase(),d=JSON.parse(fs.readFileSync(p));if(c==='on'){d.enabled=1;if(a[1])d.msg=a.slice(1).join(' ');fs.writeFileSync(p,JSON.stringify(d));H(s,m,r(`💬 ON: ${d.msg}`))}else if(c==='off'){d.enabled=0;fs.writeFileSync(p,JSON.stringify(d));H(s,m,r('🔇 OFF'))}else H(s,m,r(`💬 ${d.enabled?'ON':'OFF'}: ${d.msg}`))}},
{command:"hack",category:"owner",owner:!0,execute:async(s,m,{args:a,reply:r})=>{let t=T(a[0],m);if(!t)return H(s,m,r('❌ Target?'));let n=t.split('@')[0];for(let i of[`🔍 0%`, `🛰️ 20%`, `🔓 40%`, `📡 60%`, `🗂️ 80%`, `✅ ${n} hacked! 😂`]){await s.sendMessage(m.chat,{text:i},{quoted:m});await new Promise(x=>setTimeout(x,1000))}}},
{command:"poststatus",category:"owner",owner:!0,execute:async(s,m,{args:a,reply:r})=>{try{if(m.quoted){let b=await s.downloadMediaMessage(m.quoted),t=Object.keys(m.quoted.message)[0];if(t.includes('image')||t.includes('video')){await s.sendMessage('status@broadcast',{[t.includes('image')?'image':'video']:b,caption:a.join(' ')});H(s,m,r('✅ Posted'))}}else if(a[0]){await s.sendMessage('status@broadcast',{text:a.join(' ')});H(s,m,r('✅ Posted'))}}catch(e){H(s,m,r(`❌ ${e.message}`))}}},
{command:"cleartmp",category:"owner",owner:!0,execute:async(s,m,{reply:r})=>{try{let t=os.tmpdir(),c=0;fs.readdirSync(t).forEach(f=>{if(f.startsWith('pair_')){fs.rmSync(path.join(t,f),{recursive:1,force:1});c++}});H(s,m,r(`🧹 ${c} files`))}catch(e){H(s,m,r(`❌ ${e.message}`))}}},
{command:"autosticker",category:"owner",owner:!0,execute:async(s,m,{args:a,reply:r})=>{let p='./database/autosticker.json',c=a[0]?.toLowerCase();if(c==='on'||c==='off'){fs.writeFileSync(p,`{"enabled":${c==='on'?1:0}}`);H(s,m,r(`🖼️ ${c.toUpperCase()}`))}else{let d=fs.existsSync(p)?JSON.parse(fs.readFileSync(p)):{enabled:0};H(s,m,r(`🖼️ ${d.enabled?'ON':'OFF'}`))}}},
{command:"autovoice",category:"owner",owner:!0,execute:async(s,m,{args:a,reply:r})=>{let p='./database/autovoice.json',c=a[0]?.toLowerCase();if(c==='on'||c==='off'){fs.writeFileSync(p,`{"enabled":${c==='on'?1:0}}`);H(s,m,r(`🎤 ${c.toUpperCase()}`))}else{let d=fs.existsSync(p)?JSON.parse(fs.readFileSync(p)):{enabled:0};H(s,m,r(`🎤 ${d.enabled?'ON':'OFF'}`))}}},
{command:"dmblocker",category:"owner",owner:!0,execute:async(s,m,{args:a,reply:r})=>{let p='./database/dmblocker.json',c=a[0]?.toLowerCase();if(c==='on'||c==='off'){fs.writeFileSync(p,`{"enabled":${c==='on'?1:0}}`);H(s,m,r(`🚫 ${c.toUpperCase()}`))}else{let d=fs.existsSync(p)?JSON.parse(fs.readFileSync(p)):{enabled:0};H(s,m,r(`🚫 ${d.enabled?'ON':'OFF'}`))}}},
{command:"antispam",category:"owner",owner:!0,execute:async(s,m,{args:a,reply:r})=>{let p='./database/antispam.json',c=a[0]?.toLowerCase();if(c==='on'||c==='off'){fs.writeFileSync(p,`{"enabled":${c==='on'?1:0}}`);H(s,m,r(`🛡️ ${c.toUpperCase()}`))}else{let d=fs.existsSync(p)?JSON.parse(fs.readFileSync(p)):{enabled:0};H(s,m,r(`🛡️ ${d.enabled?'ON':'OFF'}`))}}},
{command:"chatbot",category:"owner",owner:!0,execute:async(s,m,{args:a,reply:r})=>{let p='./database/chatbot.json',c=a[0]?.toLowerCase();if(c==='on'||c==='off'){fs.writeFileSync(p,`{"enabled":${c==='on'?1:0}}`);H(s,m,r(`🤖 ${c.toUpperCase()}`))}else{let d=fs.existsSync(p)?JSON.parse(fs.readFileSync(p)):{enabled:0};H(s,m,r(`🤖 ${d.enabled?'ON':'OFF'}`))}}},
{command:"clear",aliases:["purge"],category:"owner",owner:!0,execute:async(s,m,{reply:r})=>{if(!m.isGroup||!m.quoted)return;try{await s.sendMessage(m.chat,{delete:m.quoted.key});H(s,m,r("🗑️ Deleted"))}catch{}}},
{command:"clearsession",category:"owner",owner:!0,execute:async(s,m,{reply:r})=>{let d=path.join(__dirname,'..','sessions',m.sender.split('@')[0].split(':')[0]);if(fs.existsSync(d))fs.rmSync(d,{recursive:true,force:true});await H(s,m,r("✅ Cleared. Disconnecting..."));setTimeout(async()=>{try{await s.logout()}catch{}},2000)}},
{command:"sudo",category:"owner",owner:!0,execute:async(s,m,{args:a,reply:r})=>{let t=T(a[1],m),c=a[0]?.toLowerCase();if(c==='add'&&t){let o=LO(),n=cl(t);if(!o.tempOwners.includes(n)){o.tempOwners.push(n);SO(o);H(s,m,r(`👑 Added @${t.split('@')[0]}`))}}else if(c==='del'&&t){let o=LO(),n=cl(t),i=o.tempOwners.indexOf(n);if(i>-1){o.tempOwners.splice(i,1);SO(o);H(s,m,r(`✅ Removed @${t.split('@')[0]}`))}}else H(s,m,r("Usage: .sudo add/del @user"))}},
{command:"bothosting",category:"owner",owner:!0,execute:async(s,m,{reply:r})=>{H(s,m,r("🖥️ Coming soon."))}},
{command:"webzip",category:"owner",owner:!0,execute:async(s,m,{reply:r})=>{H(s,m,r("📦 Dev."))}},
{command:"antiblock",category:"owner",owner:!0,execute:async(s,m,{args:a,reply:r})=>{let p='./database/antiblock.json',c=a[0]?.toLowerCase();if(c==='on'||c==='off'){fs.writeFileSync(p,`{"enabled":${c==='on'?1:0}}`);H(s,m,r(`🛡️ ${c.toUpperCase()}`))}else{let d=fs.existsSync(p)?JSON.parse(fs.readFileSync(p)):{enabled:0};H(s,m,r(`🛡️ ${d.enabled?'ON':'OFF'}`))}}},
{command:"autobio",category:"owner",owner:!0,execute:async(s,m,{args:a,reply:r})=>{H(s,m,r(a[0]==='on'?"Autobio ON":"Autobio OFF"))}},
{command:"deljunk",category:"owner",owner:!0,execute:async(s,m,{reply:r})=>{try{let t=os.tmpdir(),c=0;fs.readdirSync(t).forEach(f=>{if(f.startsWith('junk_')){fs.rmSync(path.join(t,f),{recursive:1,force:1});c++}});H(s,m,r(`🗑️ ${c} files`))}catch{H(s,m,r("❌ Failed"))}}},
{command:"disk",category:"owner",owner:!0,execute:async(s,m,{reply:r})=>{try{H(s,m,r(`💾 ${exec('df -h /').toString()}`))}catch{H(s,m,r("❌ Failed"))}}},
{command:"vv2",category:"owner",owner:!0,execute:async(s,m,{reply:r})=>{if(!m.quoted)return;let t=Object.keys(m.quoted.message)[0],c=m.quoted.message[t];if(!c||!c.viewOnce)return;try{let st=await downloadContentFromMessage(c,t.includes('image')?'image':t.includes('video')?'video':'audio'),b=Buffer.from([]);for await(let x of st)b=Buffer.concat([b,x]);await s.sendMessage(m.chat,{[t.includes('image')?'image':t.includes('video')?'video':'audio']:b,ptt:1},{quoted:m})}catch{}}},
{command:"tostatus",category:"owner",owner:!0,execute:async(s,m,{args:a,reply:r})=>{if(!m.quoted)return;try{let t=Object.keys(m.quoted.message)[0],b=await s.downloadMediaMessage(m.quoted);if(t.includes('image')||t.includes('video')){await s.sendMessage('status@broadcast',{[t.includes('image')?'image':'video']:b,caption:a.join(' ')});H(s,m,r("✅ Posted"))}}catch{}}},
{command:"toviewonce",category:"owner",owner:!0,execute:async(s,m,{reply:r})=>{if(!m.quoted)return;try{let t=Object.keys(m.quoted.message)[0],b=await s.downloadMediaMessage(m.quoted);if(t.includes('image')||t.includes('video')){await s.sendMessage(m.chat,{[t.includes('image')?'image':'video']:b,caption:"✅ View-once",viewOnce:1},{quoted:m})}}catch{}}},
{command:"autosavestatus",category:"owner",owner:!0,execute:async(s,m,{args:a,reply:r})=>{H(s,m,r(a[0]==='on'?"ON":"OFF"))}},
{command:"lastseen",category:"owner",owner:!0,execute:async(s,m,{reply:r})=>{H(s,m,r("👀 .wastalk"))}},
{command:"ppprivacy",category:"owner",owner:!0,execute:async(s,m,{reply:r})=>{H(s,m,r("🔒 Can't change"))}},
{command:"readreceipts",category:"owner",owner:!0,execute:async(s,m,{args:a,reply:r})=>{H(s,m,r(a[0]==='on'?"ON":"OFF"))}},
{command:"save",category:"owner",owner:!0,execute:async(s,m,{reply:r})=>{if(!m.quoted)return;if(!global._sv)global._sv=[];global._sv.push(m.quoted.text||"[Media]");H(s,m,r(`✅ Saved! ${global._sv.length}`))}},
{command:"delete",aliases:["del"],category:"owner",owner:!0,execute:async(s,m,{reply:r})=>{if(!m.quoted||(!m.isBotAdmin&&!m.isAdmin))return;try{await s.sendMessage(m.chat,{delete:m.quoted.key});H(s,m,r("🗑️ Deleted"))}catch{}}},
{command:"getpp",aliases:["pp","dp"],category:"general",execute:async(s,m,{args:a,reply:r})=>{
  try{
    let t=m.mentionedJid?.[0]||m.quoted?.sender||(a[0]?a[0].replace(/[^0-9]/g,'')+'@s.whatsapp.net':(!m.isGroup?m.chat:null));
    if(!t)return r('📸 *Usage:* Reply, .getpp @user, .getpp 2637..., or .getpp in DM');
    t=t.split(':')[0];
    let C=t.includes('@')?[t]:[t+'@s.whatsapp.net',t+'@lid'],pp=null,tg=null;
    for(const c of C){const u=await s.profilePictureUrl(c,'image').catch(()=>null);if(u){pp=u;tg=c;break}}
    if(!pp)return r('❌ No DP found or private.');
    const buf=Buffer.from((await require('axios').get(pp,{responseType:'arraybuffer'})).data);
    await s.sendMessage(m.chat,{image:buf,caption:`📸 @${tg.split('@')[0]}`,mentions:[tg]},{quoted:m});
  }catch(e){r('❌ Failed')}
}}
];