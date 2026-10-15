/* =====================================================
   Birthday Surprise – script.js
   Vanilla JavaScript, no libraries, no backend.
   Sections:
     1. Helpers & state
     2. Toasts, modals, confirm dialog
     3. Screen navigation + loading screen
     4. Effects (confetti, fireworks, emoji rain, background)
     5. Music (built-in melody or assets/song.mp3)
     6. Storage (IndexedDB with in-memory fallback)
     7. QR code settings + QR panels
     8. Photo gallery + slideshow
     9. Screen logic (welcome, cake, envelope, question, results)
    10. Certificate, replay, startup
   ===================================================== */
'use strict';

/* ---------- 1. HELPERS & STATE ---------- */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const rand = (a, b) => Math.random() * (b - a) + a;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const pad2 = (n) => String(n).padStart(2, '0');

/** Create an element quickly: el('p', 'class-name', 'text') */
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/** Everything the site needs to remember while it is open */
const state = {
  name: '',          // the person's cleaned-up name
  birthday: '',      // optional "YYYY-MM-DD"
  answer: null,      // 'yes' | 'no' | null
  candlesLit: false,
  finalNote: ''
};

const LOADING_MESSAGES = [
  'Preparing birthday happiness... 🎂',
  'Calculating biryani budget... 🍗',
  'Checking party balance... 💸',
  'Loading friendship emotions... ❤️'
];

const RANDOM_MESSAGES = [
  'Birthday enjoy cheyyi ra, bill maatram marchipoku! 😂',
  'Friendship free, biryani costly! 🍗💸',
  'Cake nenu chupistha, party nuvvu ivvali! 😂',
  'Nee happiness ki limit ledhu, naa budget ki undhi! 😭'
];

/** Small shake animation for invalid inputs */
function shake(node) {
  node.classList.remove('shake');
  void node.offsetWidth; // restart the animation
  node.classList.add('shake');
}

/** Put the person's name into every <span class="js-name"> (textContent = safe) */
function applyName() {
  $$('.js-name').forEach((n) => { n.textContent = state.name; });
}

/**
 * Turn whatever was typed into a clean name:
 * removes control characters, squeezes extra spaces, trims, max 30 chars.
 * Returns '' when the name is not usable (empty or no letters/numbers).
 */
function cleanName(raw) {
  const v = String(raw || '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 30)
    .trim();
  return /[\p{L}\p{N}]/u.test(v) ? v : '';
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Is "YYYY-MM-DD" a real calendar date that is not in the future? */
function isValidBirthday(str) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (!m) return false;
  const y = +m[1], mo = +m[2], d = +m[3];
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return false;
  return y >= 1900 && str <= todayISO();
}

/** How many days until the next birthday? 0 = today */
function daysUntilBirthday(str) {
  const [, mo, d] = str.split('-').map(Number);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(today.getFullYear(), mo - 1, d); // Feb 29 becomes Mar 1 in non-leap years
  if (next < today) next = new Date(today.getFullYear() + 1, mo - 1, d);
  return Math.round((next - today) / 86400000);
}

/* ---------- 2. TOASTS, MODALS, CONFIRM ---------- */

let toastTimer = null;
function showToast(msg, ms = 3200) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

function openModal(id) {
  const m = $('#' + id);
  m.hidden = false;
  document.body.classList.add('modal-open');
  const focusTarget = $('[data-autofocus]', m);
  if (focusTarget) focusTarget.focus();
}

function closeModal(id) {
  $('#' + id).hidden = true;
  if (!$$('.modal:not([hidden])').length) document.body.classList.remove('modal-open');
  if (id === 'slideshowModal') stopSlideshow();
}

let confirmResolve = null;
/** Pretty replacement for window.confirm. Returns a Promise<boolean>. */
function askConfirm(title, message, okLabel = 'Yes', cancelLabel = 'Cancel') {
  if (confirmResolve) resolveConfirm(false);
  $('#confirmTitle').textContent = title;
  $('#confirmMsg').textContent = message;
  $('#confirmOk').textContent = okLabel;
  $('#confirmCancel').textContent = cancelLabel;
  openModal('confirmModal');
  return new Promise((resolve) => { confirmResolve = resolve; });
}
function resolveConfirm(value) {
  closeModal('confirmModal');
  if (confirmResolve) {
    const r = confirmResolve;
    confirmResolve = null;
    r(value);
  }
}

function openLightbox(src, caption) {
  $('#lightboxImg').src = src;
  $('#lightboxCaption').textContent = caption || '';
  openModal('lightboxModal');
}

/* ---------- 3. SCREEN NAVIGATION + LOADING ---------- */

/** Things to do when a screen appears */
const screenHooks = {
  'screen-celebrate': () => {
    applyName();
    renderCountdown();
    renderGallery();
    setTimeout(() => { burstConfetti(150); fireworkShow(4); }, 350);
    startRain();
  },
  'screen-question': () => {
    $('#answerError').textContent = '';
  },
  'screen-yes': () => {
    resetQrPanels();
    renderQrPanel('500', { auto: true });
    setTimeout(() => { burstConfetti(200); fireworkShow(5); }, 250);
    emojiRain(['💸', '💰', '🤑', '🍗', '🍛'], 32);
    startRain();
  },
  'screen-no': () => {
    resetQrPanels();
    renderQrPanel('1000', { auto: true });
    emojiRain(['💔', '😭', '💧', '💸'], 26);
  },
  'screen-final': () => {
    $('#finalNote').textContent = state.finalNote;
  }
};

/** Switch to another screen (no page reload) */
function showScreen(id, opts = {}) {
  $$('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
  $('#' + id).scrollTop = 0;
  stopRain();
  $('#emojiLayer').innerHTML = '';
  applyName();
  if (screenHooks[id]) screenHooks[id]();
  const quiet = opts.silent || id === 'screen-loading' || id === 'screen-welcome';
  if (!quiet) showToast(pick(RANDOM_MESSAGES));
}

let loadingTimer = null;
let loadingToken = 0;
/**
 * Show the funny loading screen for `duration` ms, then go to `nextId`.
 * The messages rotate while loading.
 */
function runLoading(title, duration, nextId) {
  const token = ++loadingToken;
  $('#loadingTitle').textContent = title;
  const textEl = $('#loadingText');
  const bar = $('#loadingBar');
  let i = 0;
  textEl.textContent = LOADING_MESSAGES[0];
  bar.style.transition = 'none';
  bar.style.width = '0%';
  showScreen('screen-loading', { silent: true });
  requestAnimationFrame(() => requestAnimationFrame(() => {
    bar.style.transition = `width ${duration}ms linear`;
    bar.style.width = '100%';
  }));
  clearInterval(loadingTimer);
  loadingTimer = setInterval(() => {
    i = (i + 1) % LOADING_MESSAGES.length;
    textEl.textContent = LOADING_MESSAGES[i];
  }, 700);
  setTimeout(() => {
    if (token !== loadingToken) return; // a newer loading started
    clearInterval(loadingTimer);
    showScreen(nextId);
  }, duration);
}

/* ---------- 4. EFFECTS ---------- */

const fx = { canvas: $('#fx'), ctx: null, parts: [], rain: false, running: false, w: 0, h: 0 };
fx.ctx = fx.canvas.getContext('2d');
const CONFETTI_COLORS = ['#ff5fa2', '#ffd24d', '#8e54e9', '#3fa9ff', '#ffffff', '#ff8a3d', '#4ade80'];

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  fx.w = window.innerWidth;
  fx.h = window.innerHeight;
  fx.canvas.width = fx.w * dpr;
  fx.canvas.height = fx.h * dpr;
  fx.canvas.style.width = fx.w + 'px';
  fx.canvas.style.height = fx.h + 'px';
  fx.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/** Confetti cannon from the lower middle of the screen */
function burstConfetti(n = 100) {
  for (let i = 0; i < n; i++) {
    const angle = rand(-Math.PI * 0.95, -Math.PI * 0.05);
    const speed = rand(6, 16);
    fx.parts.push({
      type: 'c', x: fx.w / 2 + rand(-40, 40), y: fx.h * 0.7,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, g: 0.25,
      size: rand(6, 11), color: pick(CONFETTI_COLORS),
      rot: rand(0, 6.28), vr: rand(-0.3, 0.3), life: 1, decay: rand(0.004, 0.009)
    });
  }
  startLoop();
}

/** One firework explosion at x,y */
function firework(x, y) {
  const hue = rand(0, 360);
  for (let i = 0; i < 70; i++) {
    const a = rand(0, Math.PI * 2), s = rand(1, 6);
    fx.parts.push({
      type: 's', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      color: `hsl(${hue + rand(-25, 25)}, 100%, 60%)`, life: 1, decay: rand(0.012, 0.022)
    });
  }
  startLoop();
}

function fireworkShow(count = 4) {
  for (let i = 0; i < count; i++) {
    setTimeout(() => firework(rand(fx.w * 0.15, fx.w * 0.85), rand(fx.h * 0.1, fx.h * 0.45)), i * 450);
  }
}

function startRain() { fx.rain = true; startLoop(); }
function stopRain() { fx.rain = false; }

function startLoop() {
  if (!fx.running) { fx.running = true; requestAnimationFrame(loop); }
}

/** Animation loop: moves and draws every confetti piece / spark */
function loop() {
  const { ctx, w, h } = fx;
  ctx.clearRect(0, 0, w, h);

  if (fx.rain && Math.random() < 0.5) {
    fx.parts.push({
      type: 'c', x: rand(0, w), y: -12, vx: rand(-1, 1), vy: rand(2, 4.5), g: 0.01,
      size: rand(6, 10), color: pick(CONFETTI_COLORS),
      rot: rand(0, 6.28), vr: rand(-0.15, 0.15), life: 1, decay: 0.0008
    });
  }

  fx.parts = fx.parts.filter((p) => {
    p.x += p.vx; p.y += p.vy;
    if (p.type === 'c') {
      p.vy += p.g; p.vx *= 0.99; p.rot += p.vr; p.life -= p.decay;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2));
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.6);
      ctx.restore();
    } else {
      p.vx *= 0.98; p.vy = p.vy * 0.98 + 0.06; p.life -= p.decay;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    return p.life > 0 && p.y < h + 30;
  });

  if (fx.parts.length || fx.rain) requestAnimationFrame(loop);
  else fx.running = false;
}

/** Falling emojis (money, hearts...) using the DOM */
function emojiRain(list, count = 20) {
  const layer = $('#emojiLayer');
  for (let i = 0; i < count; i++) {
    const s = el('span', 'emoji-fall', pick(list));
    s.style.left = rand(0, 100) + 'vw';
    s.style.fontSize = rand(1.4, 2.6) + 'rem';
    s.style.animationDuration = rand(3.5, 7) + 's';
    s.style.animationDelay = rand(0, 3.5) + 's';
    s.style.setProperty('--dx', rand(-60, 60) + 'px');
    s.addEventListener('animationend', () => s.remove());
    layer.appendChild(s);
  }
}

/** Floating balloons, hearts and stars in the background */
function buildBackground() {
  const bg = $('#bg');
  const balloonColors = ['#ff5fa2', '#ffd24d', '#8e54e9', '#3fa9ff', '#ff8a3d', '#4ade80'];
  for (let i = 0; i < 12; i++) {
    const b = el('div', 'balloon');
    b.style.left = rand(2, 95) + '%';
    b.style.setProperty('--c', pick(balloonColors));
    b.style.transform = `scale(${rand(0.7, 1.25)})`;
    b.style.animationDuration = rand(14, 28) + 's';
    b.style.animationDelay = -rand(0, 28) + 's';
    bg.appendChild(b);
  }
  const hearts = ['❤️', '💖', '💜', '💙', '✨', '💛'];
  for (let i = 0; i < 14; i++) {
    const h = el('span', 'heart-float', pick(hearts));
    h.style.left = rand(0, 98) + '%';
    h.style.fontSize = rand(1, 2) + 'rem';
    h.style.animationDuration = rand(9, 18) + 's';
    h.style.animationDelay = -rand(0, 18) + 's';
    bg.appendChild(h);
  }
  for (let i = 0; i < 22; i++) {
    const s = el('span', 'star-float', '✦');
    s.style.left = rand(0, 98) + '%';
    s.style.top = rand(0, 95) + '%';
    s.style.fontSize = rand(0.6, 1.4) + 'rem';
    s.style.animationDuration = rand(2, 5) + 's';
    s.style.animationDelay = -rand(0, 5) + 's';
    bg.appendChild(s);
  }
}

/* ---------- 5. MUSIC ---------- */

/* ---------- 5. MUSIC ---------- */

const music = {
  playing: false,
  audio: null,

  async start() {
    if (this.playing) return;

    try {
      if (!this.audio) {
        this.audio = new Audio("assets/song.mp3");
        this.audio.loop = true;
        this.audio.volume = 1;
      }

      await this.audio.play();

      this.playing = true;
      updateMusicUI();

    } catch (err) {
      console.error("Music Error:", err);
    }
  },

  stop() {
    this.playing = false;

    if (this.audio) {
      this.audio.pause();
    }

    updateMusicUI();
  },

  toggle() {
    this.playing ? this.stop() : this.start();
  }
};

function updateMusicUI() {
  $('#musicTopBtn').textContent = music.playing ? '🔊' : '🔇';
  $('#musicBtn').textContent = music.playing
    ? '⏸️ Pause Music'
    : '🎵 Play Music';
}

/* ---------- 6. STORAGE (IndexedDB + fallback) ---------- */

/**
 * Saves QR images and gallery photos in IndexedDB so they survive a page refresh.
 * If IndexedDB is not available (some private modes) it falls back to memory,
 * which works but is lost when the page is refreshed.
 */
const store = {
  db: null,
  useMem: false,
  mem: { qr: new Map(), photos: [] },
  memId: 1,

  open() {
    if (this.db) return Promise.resolve(this.db);
    if (this.useMem || !window.indexedDB) { this.useMem = true; return Promise.reject(new Error('IndexedDB unavailable')); }
    return new Promise((resolve, reject) => {
      let req;
      try { req = indexedDB.open('birthdaySurpriseDB', 1); }
      catch (e) { this.useMem = true; reject(e); return; }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('qr')) db.createObjectStore('qr');
        if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath: 'id', autoIncrement: true });
      };
      req.onsuccess = () => { this.db = req.result; resolve(this.db); };
      req.onerror = () => { this.useMem = true; reject(req.error); };
      req.onblocked = () => { this.useMem = true; reject(new Error('blocked')); };
    });
  },

  /** Run one IndexedDB request inside a transaction */
  async run(storeName, mode, fn) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const req = fn(tx.objectStore(storeName));
      tx.oncomplete = () => resolve(req ? req.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  },

  /** Try IndexedDB; on any failure switch to memory */
  async guard(idbFn, memFn) {
    if (!this.useMem) {
      try { return await idbFn(); }
      catch (e) { this.useMem = true; $('#storageWarning').hidden = false; }
    }
    return memFn();
  },

  getQr(key) {
    return this.guard(
      async () => (await this.run('qr', 'readonly', (s) => s.get(key))) || null,
      async () => this.mem.qr.get(key) || null
    );
  },
  setQr(key, rec) {
    return this.guard(
      () => this.run('qr', 'readwrite', (s) => s.put(rec, key)),
      async () => { this.mem.qr.set(key, rec); }
    );
  },
  deleteQr(key) {
    return this.guard(
      () => this.run('qr', 'readwrite', (s) => s.delete(key)),
      async () => { this.mem.qr.delete(key); }
    );
  },
  addPhoto(rec) {
    return this.guard(
      () => this.run('photos', 'readwrite', (s) => s.add(rec)),
      async () => { this.mem.photos.push({ ...rec, id: this.memId++ }); }
    );
  },
  getPhotos() {
    return this.guard(
      async () => (await this.run('photos', 'readonly', (s) => s.getAll())) || [],
      async () => this.mem.photos.slice()
    );
  },
  deletePhoto(id) {
    return this.guard(
      () => this.run('photos', 'readwrite', (s) => s.delete(id)),
      async () => { this.mem.photos = this.mem.photos.filter((p) => p.id !== id); }
    );
  },
  clearAll() {
    return this.guard(
      async () => {
        await this.run('qr', 'readwrite', (s) => s.clear());
        await this.run('photos', 'readwrite', (s) => s.clear());
      },
      async () => { this.mem.qr.clear(); this.mem.photos = []; }
    );
  }
};

/** Keep one object URL per key and free the old one (prevents memory leaks) */
const urlCache = {};
function blobUrl(key, blob) {
  if (urlCache[key]) URL.revokeObjectURL(urlCache[key]);
  urlCache[key] = URL.createObjectURL(blob);
  return urlCache[key];
}

/**
 * Check that a chosen file is a PNG/JPG/JPEG that is not empty or too large.
 * Returns an error message, or '' when the file is fine.
 */
function validateImage(file, maxMB) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const okTypes = ['image/png', 'image/jpeg'];
  const okExt = ['png', 'jpg', 'jpeg'];
  const valid = okTypes.includes(file.type) || (!file.type && okExt.includes(ext));
  if (!valid) return 'Only PNG, JPG or JPEG images are allowed ra! 🙏';
  if (file.size === 0) return 'That file is empty 😅';
  if (file.size > maxMB * 1024 * 1024) return `Image is too big (max ${maxMB} MB).`;
  return '';
}

/* ---------- 7. QR CODE SETTINGS + QR PANELS ---------- */

const pendingQr = { '500': null, '1000': null }; // chosen but not yet saved
const defaultQrCache = {};                        // results of looking for assets/qr-XXX.png

/**
 * Looks for a ready-made QR image in the assets folder (qr-500.png, qr-1000.jpg ...).
 * Useful because browser-saved uploads do not travel to other devices.
 */
function findDefaultQr(key) {
  if (defaultQrCache[key]) return Promise.resolve(defaultQrCache[key]); // only successful lookups are remembered
  const names = ['png', 'jpg', 'jpeg', 'PNG', 'JPG', 'JPEG'].map((e) => `assets/qr-${key}.${e}`);
  const bust = location.protocol.startsWith('http') ? '?t=' + Date.now() : ''; // avoid stale cached 404s
  return new Promise((resolve) => {
    const tryNext = (i) => {
      if (i >= names.length) { resolve(null); return; }
      const img = new Image();
      img.onload = () => { defaultQrCache[key] = names[i] + bust; resolve(names[i] + bust); };
      img.onerror = () => tryNext(i + 1);
      img.src = names[i] + bust;
    };
    tryNext(0);
  });
}

/** Returns { url, source } for the QR to show: saved upload first, then assets file, else null */
async function getQrSource(key) {
  const rec = await store.getQr(key);
  if (rec && rec.blob) return { url: blobUrl('qrshow' + key, rec.blob), source: 'upload' };
  const def = await findDefaultQr(key);
  if (def) return { url: def, source: 'assets' };
  return null;
}

/** Build both upload sections inside the settings panel */
function initQrSettings() {
  const tpl = $('#qrSectionTpl');
  ['500', '1000'].forEach((key) => {
    const sec = tpl.content.cloneNode(true).querySelector('.qr-section');
    sec.dataset.key = key;
    $('.qr-title', sec).textContent = `₹${key} Payment QR Code`;
    $('.qr-where', sec).textContent = key === '500'
      ? 'Shown only on the 🥰 "Nachindhi" result screen.'
      : 'Shown only on the 😭 "Nachaledhu" result screen.';

    const fileInput = $('.qr-file', sec);
    $('.qr-choose', sec).addEventListener('click', () => fileInput.click());

    // When a file is chosen: validate, then show a preview (not saved yet)
    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      fileInput.value = '';
      if (!file) return;
      const err = validateImage(file, 5);
      if (err) { $('.qr-status', sec).textContent = '❌ ' + err; return; }
      pendingQr[key] = file;
      refreshQrSection(key);
    });

    $('.qr-save', sec).addEventListener('click', async () => {
      const file = pendingQr[key];
      if (!file) return;
      try {
        await store.setQr(key, { blob: file, name: file.name, type: file.type });
        pendingQr[key] = null;
        refreshQrSection(key, '✅ Saved! This QR will be used on the result screen.');
        refreshOpenQrPanels();
      } catch (e) {
        $('.qr-status', sec).textContent = '❌ Could not save the image. Try a smaller file.';
      }
    });

    $('.qr-remove', sec).addEventListener('click', async () => {
      const ok = await askConfirm(`Remove the ₹${key} QR code?`, 'The saved image will be deleted from this browser.', 'Yes, remove', 'Keep it');
      if (!ok) return;
      pendingQr[key] = null;
      await store.deleteQr(key);
      refreshQrSection(key, '🗑️ Removed.');
      refreshOpenQrPanels();
    });

    $('#qrSections').appendChild(sec);
    refreshQrSection(key);
  });
}

/** Redraw one upload section (preview, buttons, status text) */
async function refreshQrSection(key, statusMsg) {
  const sec = $(`.qr-section[data-key="${key}"]`);
  if (!sec) return;
  const img = $('.qr-preview', sec);
  const empty = $('.qr-empty', sec);
  const status = $('.qr-status', sec);
  const saveBtn = $('.qr-save', sec);
  const removeBtn = $('.qr-remove', sec);
  const chooseBtn = $('.qr-choose', sec);

  const pending = pendingQr[key];
  const rec = await store.getQr(key);
  let src = null, msg = '';

  if (pending) {
    src = blobUrl('qrprev' + key, pending);
    msg = '👀 Preview only – click "Save This QR" to use it.';
  } else if (rec && rec.blob) {
    src = blobUrl('qrprev' + key, rec.blob);
    msg = '✅ Saved in this browser.';
  } else {
    const def = await findDefaultQr(key);
    if (def) { src = def; msg = `ℹ️ Using the default file ${def}. Upload an image to override it.`; }
  }

  if (src) {
    img.src = src;
    img.hidden = false;
    empty.hidden = true;
    img.onerror = () => { img.hidden = true; empty.hidden = false; empty.textContent = 'This image could not be opened.'; };
  } else {
    img.removeAttribute('src');
    img.hidden = true;
    empty.hidden = false;
    empty.textContent = 'No QR code uploaded yet';
  }
  saveBtn.hidden = !pending;
  removeBtn.disabled = !(pending || (rec && rec.blob));
  chooseBtn.textContent = (pending || (rec && rec.blob)) ? 'Replace Image' : 'Choose Image';
  status.textContent = statusMsg || msg;
}

/** Build/refresh the "Scan to Pay" box on a result screen */
async function renderQrPanel(key, opts = {}) {
  const box = $('#qrPanel' + key);
  box.hidden = false;
  box.textContent = '';
  const src = await getQrSource(key);

  box.appendChild(el('h3', 'qr-heading', 'Scan to Pay 📱'));
  box.appendChild(el('div', 'qr-amount', `₹${key}`));

  if (src) {
    const img = new Image();
    img.className = 'qr-img';
    img.alt = `₹${key} payment QR code`;
    img.title = 'Tap to enlarge';
    img.addEventListener('click', () => openLightbox(src.url, `₹${key} – Scan to Pay`));
    img.addEventListener('error', () => {
      img.replaceWith(el('div', 'qr-missing', 'This QR image could not be opened 😕 Please upload it again in Settings ⚙️.'));
    });
    img.src = src.url;
    box.appendChild(img);
    box.appendChild(el('p', 'qr-hint', '👆 Tap the QR code to enlarge it'));
    box.appendChild(el('p', 'qr-msg', 'Scan using your UPI payment app. 😂💸'));
    box.appendChild(el('p', 'qr-note', 'Payments are not verified by this website – the host checks their own UPI app.'));
  } else {
    const missing = el('div', 'qr-missing', `The ₹${key} QR code was not found. Looked for: ${new URL('assets/qr-' + key + '.png', location.href).href}  –  or add it in Settings ⚙️ (top right).`);
    box.appendChild(missing);
    const btn = el('button', 'btn small', '⚙️ Open Settings');
    btn.type = 'button';
    btn.addEventListener('click', () => openModal('settingsModal'));
    box.appendChild(btn);
  }

  if (!opts.auto) { // shown directly on the result screen, so no close button needed
    const close = el('button', 'btn small secondary', 'Close QR Code');
    close.type = 'button';
    close.addEventListener('click', () => closeQrPanel(key));
    box.appendChild(close);
  }
}

function closeQrPanel(key) {
  const box = $('#qrPanel' + key);
  box.hidden = true;
  box.textContent = '';
}
function resetQrPanels() { closeQrPanel('500'); closeQrPanel('1000'); }
function refreshOpenQrPanels() {
  ['500', '1000'].forEach((k) => { if (!$('#qrPanel' + k).hidden) renderQrPanel(k, { auto: true }); });
}

/* ---------- 8. PHOTO GALLERY + SLIDESHOW ---------- */

let galleryPhotos = []; // [{ id, name, url }]

/** Load all saved photos from storage and draw the grid */
async function renderGallery() {
  const photos = await store.getPhotos();
  galleryPhotos.forEach((p) => URL.revokeObjectURL(p.url));
  galleryPhotos = photos.map((p) => ({ id: p.id, name: p.name, url: URL.createObjectURL(p.blob) }));

  const grid = $('#gallery');
  grid.textContent = '';
  $('#galleryEmpty').hidden = galleryPhotos.length > 0;
  $('#slideshowBtn').disabled = galleryPhotos.length === 0;

  galleryPhotos.forEach((p, idx) => {
    const fig = el('figure');
    const img = new Image();
    img.src = p.url;
    img.alt = p.name || 'Birthday memory';
    img.loading = 'lazy';
    img.addEventListener('click', () => openLightbox(p.url, `Photo ${idx + 1} of ${galleryPhotos.length}`));
    img.addEventListener('error', () => { fig.textContent = '⚠️'; });
    const del = el('button', 'del', '🗑️');
    del.type = 'button';
    del.title = 'Delete photo';
    del.setAttribute('aria-label', 'Delete this photo');
    del.addEventListener('click', async () => {
      const ok = await askConfirm('Delete this photo?', 'It will be removed from this browser.', 'Delete', 'Keep');
      if (!ok) return;
      await store.deletePhoto(p.id);
      renderGallery();
    });
    fig.append(img, del);
    grid.appendChild(fig);
  });
}

/** Handle photos picked with the file input (multiple allowed) */
async function addPhotos(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  let added = 0, rejected = 0;
  for (const file of files) {
    if (validateImage(file, 8)) { rejected++; continue; }
    try {
      await store.addPhoto({ blob: file, name: file.name, type: file.type, added: Date.now() });
      added++;
    } catch (e) { rejected++; }
  }
  await renderGallery();
  if (added && !rejected) showToast(`${added} photo${added > 1 ? 's' : ''} added 📸`);
  else if (added) showToast(`${added} added, ${rejected} skipped (only PNG/JPG up to 8 MB) 😅`, 4500);
  else showToast('Only PNG, JPG or JPEG photos (max 8 MB) are allowed 🙏', 4500);
}

const slideshow = { idx: 0, timer: null, playing: false };

function updateSlide() {
  const p = galleryPhotos[slideshow.idx];
  if (!p) return;
  $('#slideImg').src = p.url;
  $('#slideCount').textContent = `${slideshow.idx + 1} / ${galleryPhotos.length}`;
}
function moveSlide(step) {
  if (!galleryPhotos.length) return;
  slideshow.idx = (slideshow.idx + step + galleryPhotos.length) % galleryPhotos.length;
  updateSlide();
}
function startSlideshowTimer() {
  clearInterval(slideshow.timer);
  slideshow.playing = true;
  slideshow.timer = setInterval(() => moveSlide(1), 2800);
  $('#slideToggle').textContent = '⏸️ Pause';
}
function stopSlideshow() {
  clearInterval(slideshow.timer);
  slideshow.playing = false;
  $('#slideToggle').textContent = '▶️ Play';
}
function openSlideshow() {
  if (!galleryPhotos.length) { showToast('Mundu konni photos add cheyyi ra! 📸'); return; }
  slideshow.idx = 0;
  updateSlide();
  openModal('slideshowModal');
  startSlideshowTimer();
}

/* ---------- 9. SCREEN LOGIC ---------- */

/** Welcome screen: validate name (+ optional date), then start the show */
function handleStart() {
  const nameInput = $('#nameInput');
  const dateInput = $('#birthdayInput');
  const nameErr = $('#nameError');
  const dateErr = $('#dateError');
  nameErr.textContent = '';
  dateErr.textContent = '';

  const name = cleanName(nameInput.value);
  if (!name) {
    nameErr.textContent = 'Arey! Peru lekunda ela ra? 😂 Nee peru enter cheyyi first!';
    shake(nameInput);
    nameInput.focus();
    return;
  }
  let bday = '';
  if (dateInput.value) {
    if (!isValidBirthday(dateInput.value)) {
      dateErr.textContent = 'Ee date correct ga ledhu ra 😅 (future date undakoodadhu).';
      shake(dateInput);
      return;
    }
    bday = dateInput.value;
  }

  state.name = name;
  state.birthday = bday;
  nameInput.value = name;
  applyName();
  music.start(); // allowed because the click is a user gesture
  runLoading(`Ready aa, ${name}? 👀 Nee kosam oka surprise undhi! 🎁😂`, 2800, 'screen-celebrate');
}

function renderCountdown() {
  const box = $('#countdownBox');
  if (!state.birthday) { box.hidden = true; return; }
  const days = daysUntilBirthday(state.birthday);
  box.hidden = false;
  if (days === 0) {
    $('#countdownNumber').textContent = '🎉';
    $('#countdownLabel').textContent = `Ee roju nee birthday ra, ${state.name}! 🥳`;
  } else {
    $('#countdownNumber').textContent = String(days);
    $('#countdownLabel').textContent = days === 1
      ? 'day left for your next birthday! 🎂'
      : 'days left for your next birthday! 🎂';
  }
}

/* Cake buttons */
function lightCandles() {
  if (state.candlesLit) { showToast('Candles already veluguthunnayi ra! 🔥😂'); return; }
  state.candlesLit = true;
  $('#cake').classList.add('lit');
  showToast('Make a wish, ' + state.name + '! 🤫✨');
}
function blowCandles() {
  if (!state.candlesLit) { showToast('Mundu candles light cheyyi ra! 🕯️😂'); return; }
  state.candlesLit = false;
  $('#cake').classList.remove('lit');
  burstConfetti(180);
  fireworkShow(4);
  showToast('Wish chesukunnava? Ippudu cake cut cheddam! 🎂🥳');
}

function toggleSecret() {
  const box = $('#secretBox');
  box.hidden = !box.hidden;
  $('#secretBtn').textContent = box.hidden ? '🤫 Reveal Secret Message' : '🙈 Hide Secret Message';
  if (!box.hidden) burstConfetti(40);
}

/* Question */
function selectAnswer(value) {
  state.answer = value;
  $('#answerError').textContent = '';
  $$('.choice').forEach((c) => {
    const on = c.dataset.answer === value;
    c.classList.toggle('selected', on);
    c.setAttribute('aria-checked', on ? 'true' : 'false');
    if (on) {
      c.classList.remove('pop');
      void c.offsetWidth;
      c.classList.add('pop');
    }
  });
  if (value === 'yes') {
    burstConfetti(60);
    emojiRain(['🥰', '❤️', '😍'], 10);
    showToast('Aww! Super ra! 🥰');
  } else {
    emojiRain(['😭', '💔', '😢'], 10);
    showToast('Ayyo! Dramatic ga unnav ra! 😭😂');
  }
}

async function submitAnswer() {
  const err = $('#answerError');
  if (!state.answer) {
    err.textContent = `Orey ${state.name}, answer select cheyyi first! 😂`;
    shake($('.choices'));
    return;
  }
  const label = state.answer === 'yes' ? '🥰 Nachindhi! Super ga unnayi!' : '😭 Nachaledhu! Inka better ga undochu!';
  const ok = await askConfirm(`Final answer ah, ${state.name}? 👀`, label, 'Yes, Submit! ✅', 'Wait, change chestha 🙈');
  if (!ok) return;
  runLoading('Result calculate chestunna... 🧮', 2000, state.answer === 'yes' ? 'screen-yes' : 'screen-no');
}

/* Result screens */
function partyConfirmed() {
  burstConfetti(220);
  fireworkShow(5);
  state.finalNote = 'Party plan confirmed! 🎉 (This website cannot verify payments – the host will check their UPI app.)';
  setTimeout(() => showScreen('screen-final'), 1700);
}
function nextTimeImprove() {
  emojiRain(['😂', '🔥', '💪'], 14);
  state.finalNote = 'Next time wishes inka super ga untayi, promise! 😎🔥 (Payments are not verified here – the host checks their UPI app.)';
  setTimeout(() => showScreen('screen-final'), 1200);
}

/* ---------- 10. CERTIFICATE, REPLAY, STARTUP ---------- */

function openCertificate() {
  $('#certName').textContent = state.name;
  $('#certDate').textContent = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  openModal('certModal');
  burstConfetti(80);
}

/** Draws the certificate on a canvas and downloads it as a PNG */
function downloadCertificate() {
  const c = document.createElement('canvas');
  c.width = 1200; c.height = 850;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 1200, 850);
  g.addColorStop(0, '#ffe27a'); g.addColorStop(0.4, '#ffb347'); g.addColorStop(0.7, '#ff7eb3'); g.addColorStop(1, '#8e54e9');
  x.fillStyle = g; x.fillRect(0, 0, 1200, 850);
  x.fillStyle = '#fffaf0'; x.fillRect(40, 40, 1120, 770);
  x.strokeStyle = '#c9962b'; x.lineWidth = 6; x.strokeRect(60, 60, 1080, 730);
  x.lineWidth = 2; x.strokeRect(72, 72, 1056, 706);
  x.textAlign = 'center';

  x.font = '70px serif'; x.fillStyle = '#000';
  x.fillText('🏆 🎂 🏆', 600, 175);
  x.fillStyle = '#8e54e9'; x.font = 'bold 66px "Segoe UI", Arial, sans-serif';
  x.fillText('Certificate of Awesomeness', 600, 275);
  x.fillStyle = '#4a3b5c'; x.font = '32px "Segoe UI", Arial, sans-serif';
  x.fillText('This certificate proudly certifies that', 600, 345);

  let size = 100;
  x.fillStyle = '#d6336c';
  do { x.font = `bold ${size}px "Segoe UI", Arial, sans-serif`; size -= 4; } while (x.measureText(state.name).width > 960 && size > 28);
  x.fillText(state.name, 600, 470);

  x.fillStyle = '#4a3b5c'; x.font = '30px "Segoe UI", Arial, sans-serif';
  x.fillText('has successfully completed another trip around the sun and is', 600, 550);
  x.fillText('officially entitled to unlimited cake, biryani and party vibes! 🍗🥳', 600, 595);

  x.font = 'bold 30px "Segoe UI", Arial, sans-serif';
  x.textAlign = 'left';
  x.fillText('📅 ' + $('#certDate').textContent, 120, 730);
  x.textAlign = 'right';
  x.fillText('✍️ Your Best Friend', 1080, 730);

  c.toBlob((blob) => {
    if (!blob) { showToast('Could not create the image 😕'); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'Birthday-Certificate-' + (state.name.replace(/[^\p{L}\p{N}]+/gu, '-') || 'Friend') + '.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  }, 'image/png');
}

/** Start the whole surprise again (name is kept) */
function replay() {
  state.answer = null;
  state.candlesLit = false;
  $('#cake').classList.remove('lit');
  $('#secretBox').hidden = true;
  $('#secretBtn').textContent = '🤫 Reveal Secret Message';
  $$('.choice').forEach((c) => { c.classList.remove('selected', 'pop'); c.setAttribute('aria-checked', 'false'); });
  resetQrPanels();
  runLoading('Replay loading... 🔁', 2000, 'screen-celebrate');
}

/** Delete every uploaded QR code and photo */
async function resetAllImages() {
  const ok = await askConfirm('Reset all uploaded images?', 'This deletes both QR codes and all gallery photos from this browser.', 'Yes, reset', 'Cancel');
  if (!ok) return;
  await store.clearAll();
  pendingQr['500'] = null;
  pendingQr['1000'] = null;
  await Promise.all([refreshQrSection('500', '🗑️ Reset.'), refreshQrSection('1000', '🗑️ Reset.')]);
  refreshOpenQrPanels();
  renderGallery();
  showToast('All uploaded images were reset ✅');
}

/** Wire up every button */
function bindEvents() {
  const on = (id, ev, fn) => $('#' + id).addEventListener(ev, fn);

  on('startBtn', 'click', handleStart);
  on('nameInput', 'keydown', (e) => { if (e.key === 'Enter') handleStart(); });
  on('nameInput', 'input', () => { $('#nameError').textContent = ''; });

  on('musicTopBtn', 'click', () => music.toggle());
  on('musicBtn', 'click', () => music.toggle());
  on('settingsBtn', 'click', () => { refreshQrSection('500'); refreshQrSection('1000'); openModal('settingsModal'); });

  on('lightCandlesBtn', 'click', lightCandles);
  on('blowCandlesBtn', 'click', blowCandles);
  on('secretBtn', 'click', toggleSecret);
  on('specialSurpriseBtn', 'click', () => showScreen('screen-question'));

  on('photoInput', 'change', (e) => { addPhotos(e.target.files); e.target.value = ''; });
  on('slideshowBtn', 'click', openSlideshow);
  on('slidePrev', 'click', () => { moveSlide(-1); if (slideshow.playing) startSlideshowTimer(); });
  on('slideNext', 'click', () => { moveSlide(1); if (slideshow.playing) startSlideshowTimer(); });
  on('slideToggle', 'click', () => (slideshow.playing ? stopSlideshow() : startSlideshowTimer()));

  $$('.choice').forEach((c) => c.addEventListener('click', () => selectAnswer(c.dataset.answer)));
  on('submitAnswer', 'click', submitAnswer);

  on('partyConfirmedBtn', 'click', partyConfirmed);
  on('nextTimeBtn', 'click', nextTimeImprove);
  on('backYesBtn', 'click', () => showScreen('screen-question'));
  on('backNoBtn', 'click', () => showScreen('screen-question'));

  on('replayBtn', 'click', replay);
  on('certBtn', 'click', openCertificate);
  on('certDownload', 'click', downloadCertificate);
  on('certPrint', 'click', () => window.print());

  on('resetImagesBtn', 'click', resetAllImages);
  on('confirmOk', 'click', () => resolveConfirm(true));
  on('confirmCancel', 'click', () => resolveConfirm(false));

  // Any element with data-close="modalId" closes that modal; clicking the dark backdrop closes it too
  document.addEventListener('click', (e) => {
    const closer = e.target.closest('[data-close]');
    if (closer) { closeModal(closer.dataset.close); return; }
    if (e.target.classList.contains('modal') && e.target.id !== 'confirmModal') closeModal(e.target.id);
  });

  // Escape closes the top-most modal
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const open = $$('.modal:not([hidden])').pop();
    if (!open) return;
    if (open.id === 'confirmModal') resolveConfirm(false);
    else closeModal(open.id);
  });

  window.addEventListener('resize', resizeCanvas);
}

/** Startup */
function init() {
  resizeCanvas();
  buildBackground();
  initQrSettings();
  bindEvents();
  updateMusicUI();
  $('#birthdayInput').max = todayISO();
  // Show a warning in Settings if the browser cannot store images permanently
  store.open().catch(() => { $('#storageWarning').hidden = false; });

  runLoading('Preparing your surprise... 🎁', 3200, 'screen-welcome');
}

init();
