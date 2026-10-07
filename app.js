(() => {
'use strict';

const CFG = Object.assign({ FIREBASE_DB_URL: '', BOOST: 1.10, GRACE_SEC: 60 }, window.CONFIG || {});
const $ = s => document.querySelector(s);
const KEY = 'studycase_v1';
const LOCAL_BOARD = 'studycase_local_board';
const ANIM_MS = 7000;           // thời gian hiệu ứng quay
const SPIN_CSS_MS = 6500;

/* ---------- DỮ LIỆU ---------- */
// Tỉ lệ gốc theo hòm CS:GO. Các màu hiếm được nhân BOOST (mặc định +10%), phần còn lại là màu trắng.
const TIERS = {
  white:  { name: 'Trắng', base: 79.92, color: '#b0c3d9' },
  blue:   { name: 'Xanh',  base: 15.98, color: '#4b69ff' },
  purple: { name: 'Tím',   base: 3.20,  color: '#8847ff' },
  red:    { name: 'Đỏ',    base: 0.64,  color: '#eb4b4b' },
  gold:   { name: 'Vàng',  base: 0.26,  color: '#ffd700' }
};
const ORDER = ['white', 'blue', 'purple', 'red', 'gold'];

// kind: 'study' = học/đọc (không bao giờ bị trừ ELO), 'fun' = giải trí (quá giờ bị trừ ELO)
const REWARDS = [
  { id: 'study15', tier: 'white', icon: '📚', name: 'Học thêm',            min: 15, kind: 'study', w: 40 },
  { id: 'read15',  tier: 'white', icon: '📖', name: 'Đọc sách',            min: 15, kind: 'study', w: 40 },
  { id: 'social5', tier: 'white', icon: '📱', name: 'Xem mạng xã hội',     min: 5,  kind: 'fun',   w: 20 },

  { id: 'music10', tier: 'blue',  icon: '🎧', name: 'Nghe nhạc',           min: 10, kind: 'fun', w: 1 },
  { id: 'snack10', tier: 'blue',  icon: '🍿', name: 'Ăn vặt thư giãn',     min: 10, kind: 'fun', w: 1 },
  { id: 'mini10',  tier: 'blue',  icon: '🧩', name: 'Game mini',           min: 10, kind: 'fun', w: 1 },
  { id: 'stretch', tier: 'blue',  icon: '🤸', name: 'Vận động & uống nước', min: 10, kind: 'fun', w: 1 },

  { id: 'yt20',    tier: 'purple', icon: '▶️', name: 'Xem YouTube',        min: 20, kind: 'fun', w: 1 },
  { id: 'game20',  tier: 'purple', icon: '🎮', name: 'Chơi game',          min: 20, kind: 'fun', w: 1 },
  { id: 'anime25', tier: 'purple', icon: '🎬', name: 'Xem 1 tập phim ngắn', min: 25, kind: 'fun', w: 1 },

  { id: 'game45',  tier: 'red',   icon: '🕹️', name: 'Chơi game dài',      min: 45, kind: 'fun', w: 1 },
  { id: 'movie45', tier: 'red',   icon: '🍿', name: 'Xem phim thoải mái', min: 45, kind: 'fun', w: 1 },

  { id: 'free90',  tier: 'gold',  icon: '👑', name: 'Tự do 90 phút',      min: 90, kind: 'fun', w: 1 }
];
const byId = id => REWARDS.find(r => r.id === id);

const RANKS = [
  [0, 'Sắt'], [800, 'Đồng'], [950, 'Bạc'], [1100, 'Vàng'], [1250, 'Bạch Kim'],
  [1400, 'Kim Cương'], [1600, 'Cao Thủ'], [1800, 'Thách Đấu']
];
const rankOf = elo => { let n = RANKS[0][1]; for (const [m, name] of RANKS) if (elo >= m) n = name; return n; };

const ELO = { start: 1000, studyDone: 12, funOnTime: 8, streakBonus: 2, streakCap: 5, perMinute: 5, penaltyCap: 60 };
const penalty = overSec => Math.min(ELO.penaltyCap, ELO.perMinute * Math.ceil(overSec / 60));

function tierChances() {
  const c = {};
  let sum = 0;
  for (const t of ORDER) if (t !== 'white') { c[t] = TIERS[t].base * CFG.BOOST; sum += c[t]; }
  c.white = 100 - sum;
  return c;
}

/* ---------- NGẪU NHIÊN ---------- */
function rnd() {
  try { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 4294967296; }
  catch { return Math.random(); }
}
function rollReward() {
  const ch = tierChances();
  let x = rnd() * 100, tier = 'white';
  for (const t of ['gold', 'red', 'purple', 'blue']) { // từ hiếm tới thường
    if (x < ch[t]) { tier = t; break; }
    x -= ch[t];
  }
  const pool = REWARDS.filter(r => r.tier === tier);
  const total = pool.reduce((s, r) => s + r.w, 0);
  let y = rnd() * total;
  for (const r of pool) { if (y < r.w) return r; y -= r.w; }
  return pool[0];
}
// Chỉ để làm đẹp dải quay (không ảnh hưởng tỉ lệ thật)
function fillerReward() {
  const w = { white: 40, blue: 28, purple: 17, red: 10, gold: 5 };
  let x = rnd() * 100, tier = 'white';
  for (const t of ORDER) { if (x < w[t]) { tier = t; break; } x -= w[t]; }
  const pool = REWARDS.filter(r => r.tier === tier);
  return pool[Math.floor(rnd() * pool.length)];
}

/* ---------- TRẠNG THÁI ---------- */
let S = null;
try { S = JSON.parse(localStorage.getItem(KEY)); } catch { S = null; }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} };

/* ---------- ÂM THANH & HIỆU ỨNG ---------- */
let ac;
function beep(f = 600, d = 0.08, type = 'square', v = 0.04) {
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = f; g.gain.value = v;
    o.connect(g); g.connect(ac.destination);
    o.start(); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + d); o.stop(ac.currentTime + d);
  } catch {}
}
const revealSound = tier => {
  const seq = { white: [400], blue: [500, 650], purple: [500, 650, 800], red: [500, 650, 800, 1000], gold: [500, 650, 800, 1000, 1300] }[tier];
  seq.forEach((f, i) => setTimeout(() => beep(f, 0.18, 'triangle', 0.06), i * 110));
};

const fx = $('#fx'), cx = fx.getContext('2d');
let parts = [], fxRun = false;
function sizeFx() { fx.width = innerWidth; fx.height = innerHeight; }
addEventListener('resize', sizeFx); sizeFx();
function burst(color) {
  for (let i = 0; i < 160; i++) parts.push({
    x: innerWidth / 2, y: innerHeight / 2.3,
    vx: (Math.random() - 0.5) * 18, vy: Math.random() * -15 - 2, g: 0.38,
    s: 4 + Math.random() * 6, c: Math.random() < 0.5 ? color : '#ffffff', l: 90 + Math.random() * 70
  });
  if (!fxRun) { fxRun = true; requestAnimationFrame(fxLoop); }
}
function fxLoop() {
  cx.clearRect(0, 0, fx.width, fx.height);
  parts = parts.filter(p => p.l-- > 0);
  for (const p of parts) { p.x += p.vx; p.y += p.vy; p.vy += p.g; cx.fillStyle = p.c; cx.fillRect(p.x, p.y, p.s, p.s); }
  if (parts.length) requestAnimationFrame(fxLoop); else { fxRun = false; cx.clearRect(0, 0, fx.width, fx.height); }
}

let toastT;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3500);
}

/* ---------- BẢNG XẾP HẠNG (Firebase REST hoặc cục bộ) ---------- */
const online = () => !!CFG.FIREBASE_DB_URL;
const dbUrl = p => CFG.FIREBASE_DB_URL.replace(/\/$/, '') + '/' + p + '.json';
const slug = n => n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd')
  .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'user';

async function sha(str) {
  try {
    if (crypto.subtle) {
      const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
      return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
    }
  } catch {}
  let h = 5381; for (const c of str) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0;
  return 'x' + h.toString(16);
}
const newToken = () => { const a = new Uint8Array(12); crypto.getRandomValues(a); return [...a].map(x => x.toString(36).padStart(2, '0')).join('').slice(0, 20); };

function record() {
  return { nick: S.nick, elo: S.elo, studyMin: S.studyMin, spins: S.spins, h: S.h, t: Date.now() };
}
let syncT;
function sync() {
  clearTimeout(syncT);
  syncT = setTimeout(async () => {
    if (!S) return;
    try {
      if (online()) {
        await fetch(dbUrl('players/' + S.key), { method: 'PUT', body: JSON.stringify(record()) });
      } else {
        const m = JSON.parse(localStorage.getItem(LOCAL_BOARD) || '{}');
        m[S.key] = record(); localStorage.setItem(LOCAL_BOARD, JSON.stringify(m));
      }
    } catch {}
  }, 700);
}
async function loadBoard() {
  if (online()) {
    const r = await fetch(dbUrl('players') + '?orderBy=%22elo%22&limitToLast=50');
    if (!r.ok) throw new Error('board');
    return Object.entries((await r.json()) || {}).map(([k, v]) => ({ key: k, ...v }));
  }
  const m = JSON.parse(localStorage.getItem(LOCAL_BOARD) || '{}');
  return Object.entries(m).map(([k, v]) => ({ key: k, ...v }));
}
async function renderBoard() {
  $('#boardMode').textContent = online() ? '🌐 Bảng chung' : '💻 Chỉ trên máy này';
  $('#boardNote').textContent = online() ? '' : 'Chủ web chưa nối Firebase (xem README) nên bảng này chỉ có người chơi trên thiết bị này.';
  const body = $('#boardBody');
  try {
    const list = (await loadBoard()).sort((a, b) => b.elo - a.elo).slice(0, 50);
    body.innerHTML = list.map((p, i) => {
      const me = S && p.key === S.key;
      const medal = ['🥇', '🥈', '🥉'][i] || (i + 1);
      return `<tr class="${me ? 'me' : ''}"><td>${medal}</td><td>${esc(p.nick)}</td><td>${rankOf(p.elo)}</td><td>${p.elo}</td><td>${p.studyMin || 0}</td></tr>`;
    }).join('') || '<tr><td colspan="5" class="muted">Chưa có ai.</td></tr>';
  } catch {
    body.innerHTML = '<tr><td colspan="5" class="muted">Không tải được bảng xếp hạng. Thử lại sau.</td></tr>';
  }
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- ĐĂNG NHẬP ---------- */
$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const err = $('#loginErr'); err.textContent = '';
  const nick = $('#nickIn').value.trim().replace(/\s+/g, ' ');
  const code = $('#codeIn').value.trim();
  if (nick.length < 2 || nick.length > 16) { err.textContent = 'Biệt danh dài 2–16 ký tự.'; return; }
  const key = slug(nick);
  $('#loginBtn').disabled = true;
  try {
    let token = code || newToken(), h = await sha(token);
    let base = { elo: ELO.start, studyMin: 0, spins: 0 };
    if (online()) {
      const r = await fetch(dbUrl('players/' + key));
      if (!r.ok) throw new Error('net');
      const rec = await r.json();
      if (rec) {
        if (!code || (await sha(code)) !== rec.h) {
          err.textContent = 'Biệt danh này đã có người dùng. Nếu là bạn, nhập mã khôi phục (nút 🔑 trên máy cũ).';
          return;
        }
        base = { elo: rec.elo, studyMin: rec.studyMin || 0, spins: rec.spins || 0 };
      }
    }
    S = { nick, key, token, h, ...base, streak: 0, active: null };
    save(); sync(); enter();
  } catch {
    err.textContent = 'Không kết nối được máy chủ xếp hạng. Kiểm tra mạng rồi thử lại.';
  } finally { $('#loginBtn').disabled = false; }
});

function enter() {
  $('#login').classList.add('hide');
  $('#me').hidden = false;
  renderMe(); tick();
}
$('#keyBtn').addEventListener('click', () => {
  alert('Mã khôi phục của bạn:\n\n' + S.token + '\n\nGhi lại để đăng nhập biệt danh "' + S.nick + '" trên thiết bị khác. Đừng đưa cho người khác.');
});

function renderMe() {
  $('#meNick').textContent = S.nick;
  $('#meElo').textContent = S.elo;
  $('#meRank').textContent = rankOf(S.elo);
  $('#stSpins').textContent = S.spins;
  $('#stStudy').textContent = S.studyMin;
  $('#stStreak').textContent = S.streak;
}

/* ---------- MỞ HÒM ---------- */
let pitch = 158;
function itemHtml(r) {
  return `<div class="it" style="--c:${TIERS[r.tier].color}"><div class="ic">${r.icon}</div><div class="nm">${r.name}</div><div class="mn">${r.min} phút</div></div>`;
}
function animate(winner) {
  const strip = $('#strip'), box = $('#roulette');
  $('#idle').classList.add('hide');
  const WIN = 52, N = 62;
  let html = '';
  for (let i = 0; i < N; i++) html += itemHtml(i === WIN ? winner : fillerReward());
  strip.style.transition = 'none';
  strip.style.transform = 'translateX(0)';
  strip.innerHTML = html;
  const first = strip.firstElementChild.getBoundingClientRect().width;
  pitch = first + 8;
  void strip.offsetWidth;
  const jitter = (rnd() - 0.5) * (first * 0.7);
  const x = WIN * pitch + 4 + first / 2 - box.clientWidth / 2 + jitter;
  strip.style.transition = `transform ${SPIN_CSS_MS}ms cubic-bezier(.12,.72,.08,1)`;
  strip.style.transform = `translateX(${-x}px)`;
  // tiếng tích tắc khi đi qua từng ô
  let last = -1;
  const t0 = performance.now();
  (function loop() {
    const m = new DOMMatrix(getComputedStyle(strip).transform);
    const idx = Math.floor((-m.m41 + box.clientWidth / 2) / pitch);
    if (idx !== last) { last = idx; beep(900, 0.03, 'square', 0.02); }
    if (performance.now() - t0 < SPIN_CSS_MS + 200) requestAnimationFrame(loop);
  })();
}

$('#spinBtn').addEventListener('click', () => {
  if (!S || S.active) return;
  const r = rollReward();
  const startAt = Date.now() + ANIM_MS;
  S.active = { id: r.id, startAt, endAt: startAt + r.min * 60000 };
  S.spins++;
  save(); renderMe(); sync();
  beep(300, 0.1);
  animate(r);
});

/* ---------- ĐỒNG HỒ BẮT BUỘC ---------- */
const fmt = sec => {
  sec = Math.max(0, Math.ceil(sec));
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  const p = n => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
};
let shown = false, alarmAt = 0;
const baseTitle = document.title;

function tick() {
  if (!S) return;
  const a = S.active, lock = $('#lock');
  $('#spinBtn').disabled = !!a;
  $('#spinBtn').textContent = a ? 'ĐANG CÓ QUÀ CHƯA DÙNG XONG' : 'MỞ HÒM — MIỄN PHÍ';
  if (!a) {
    if (shown) { shown = false; lock.hidden = true; }
    document.title = baseTitle; return;
  }
  const now = Date.now();
  if (now < a.startAt) return; // đang quay
  const r = byId(a.id), color = TIERS[r.tier].color;
  const card = $('#lockCard');
  if (!shown) {
    shown = true; lock.hidden = false;
    card.style.setProperty('--c', color);
    $('#lkTier').textContent = 'HÒM ' + TIERS[r.tier].name.toUpperCase();
    $('#lkIcon').textContent = r.icon;
    $('#lkName').textContent = `${r.name} · ${r.min} phút`;
    $('#lkHint').textContent = r.kind === 'study'
      ? 'Học/đọc thật sự đến hết giờ. Phần này không bao giờ bị trừ ELO.'
      : `Dùng xong trước khi hết giờ. Trễ quá ${CFG.GRACE_SEC} giây sẽ bị trừ ELO.`;
    revealSound(r.tier);
    if (r.tier === 'red' || r.tier === 'gold' || r.tier === 'purple') burst(color);
  }
  const total = (a.endAt - a.startAt) / 1000;
  const left = (a.endAt - now) / 1000;
  const btn = $('#doneBtn');
  if (left > 0) {
    card.classList.remove('overtime');
    $('#lkClock').textContent = fmt(left);
    $('#lkBar').style.width = (100 * (1 - left / total)) + '%';
    $('#lkOver').textContent = '';
    btn.disabled = true; btn.classList.remove('done-ok'); btn.textContent = 'Chưa hết giờ';
    document.title = `⏳ ${fmt(left)} · ${r.name}`;
  } else {
    $('#lkBar').style.width = '100%';
    btn.disabled = false; btn.classList.add('done-ok');
    const over = -left - CFG.GRACE_SEC;
    if (r.kind === 'study') {
      $('#lkClock').textContent = '00:00';
      $('#lkOver').textContent = '✅ Hết giờ! Bấm xác nhận để nhận ELO.';
      btn.textContent = 'XONG — NHẬN ELO';
      document.title = '✅ Hết giờ!';
    } else if (over <= 0) {
      card.classList.remove('overtime');
      $('#lkClock').textContent = '00:00';
      $('#lkOver').textContent = `⚠️ Hết giờ! Bấm trong ${Math.ceil(-over)} giây nữa để không bị trừ ELO.`;
      btn.textContent = 'MÌNH ĐÃ DỪNG — XONG';
      document.title = '⚠️ HẾT GIỜ!';
    } else {
      card.classList.add('overtime');
      $('#lkClock').textContent = '+' + fmt(-left);
      $('#lkOver').textContent = `⏰ QUÁ GIỜ! Đang bị trừ −${penalty(over)} ELO. Dừng lại rồi bấm xác nhận.`;
      btn.textContent = 'MÌNH ĐÃ DỪNG — XONG';
      document.title = '⏰ QUÁ GIỜ!';
    }
    if (now - alarmAt > 2000) { alarmAt = now; beep(over > 0 ? 220 : 880, 0.25, 'sawtooth', 0.05); }
  }
}
setInterval(tick, 250);

$('#doneBtn').addEventListener('click', () => {
  const a = S && S.active;
  if (!a || Date.now() < a.endAt) return;
  const r = byId(a.id);
  const over = (Date.now() - a.endAt) / 1000 - CFG.GRACE_SEC;
  let delta;
  if (r.kind === 'study') {
    delta = ELO.studyDone + Math.min(S.streak, ELO.streakCap) * ELO.streakBonus;
    S.studyMin += r.min; S.streak++;
  } else if (over <= 0) {
    delta = ELO.funOnTime + Math.min(S.streak, ELO.streakCap) * ELO.streakBonus;
    S.streak++;
  } else {
    delta = -penalty(over); S.streak = 0;
  }
  const before = S.elo;
  S.elo = Math.max(0, S.elo + delta);
  S.active = null;
  save(); sync(); renderMe();
  toast(delta >= 0 ? `+${delta} ELO · giữ chuỗi đúng giờ 🔥` : `${S.elo - before} ELO · quá giờ nên bị trừ`);
  shown = false; $('#lock').hidden = true; tick();
});

/* ---------- TAB ---------- */
document.querySelectorAll('#tabs button').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('on', x === b));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.id === 'tab-' + b.dataset.tab));
  if (b.dataset.tab === 'board') renderBoard();
}));
setInterval(() => { if ($('#tab-board').classList.contains('on')) renderBoard(); }, 30000);

function renderOdds() {
  const ch = tierChances();
  $('#oddsList').innerHTML = ORDER.map(t => {
    const list = REWARDS.filter(r => r.tier === t).map(r =>
      `<li>${r.icon} ${r.name} — ${r.min} phút${r.kind === 'study' ? ' <small class="muted">(học, không bị trừ ELO)</small>' : ''}</li>`).join('');
    return `<div class="tier" style="--c:${TIERS[t].color}"><h3><span>${TIERS[t].name}</span><span>${ch[t].toFixed(3)}%</span></h3><ul>${list}</ul></div>`;
  }).join('');
  $('#eloRules').innerHTML = `
    <li>Mọi người bắt đầu với <b>${ELO.start} ELO</b>.</li>
    <li>Dùng quà giải trí đúng giờ (trễ không quá ${CFG.GRACE_SEC} giây): <b>+${ELO.funOnTime} ELO</b>.</li>
    <li>Hoàn thành <b>học thêm / đọc sách</b>: <b>+${ELO.studyDone} ELO</b>, không bao giờ bị trừ dù trễ.</li>
    <li>Chuỗi đúng giờ liên tiếp cộng thêm <b>+${ELO.streakBonus} ELO mỗi mốc</b>, tối đa +${ELO.streakCap * ELO.streakBonus}.</li>
    <li>Quá giờ quà giải trí: <b>−${ELO.perMinute} ELO mỗi phút trễ</b> (tối đa −${ELO.penaltyCap}) và mất chuỗi.</li>
    <li>Hạng: ${RANKS.map(([m, n]) => `${n} (${m}+)`).join(' · ')}.</li>`;
}

/* ---------- KHỞI ĐỘNG ---------- */
renderOdds();
if (S && S.nick) { enter(); if (S.active && Date.now() < S.active.startAt) $('#idle').textContent = '📦 Đang mở hòm...'; }
else $('#login').classList.remove('hide');
})();
