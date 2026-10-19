'use strict';
/* 3D UrbanPrint server: do'kon API, admin panel API, rasm yuklash, Telegram xabarnoma.
   Hech qanday tashqi paket kerak emas (faqat Node.js 18+).
   Ishga tushirish:  ADMIN_PASSWORD="kuchliParol123" node server/server.js  */
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const DB_FILE = path.join(DATA_DIR, 'db.json');
const UPLOADS = path.join(DATA_DIR, 'uploads');
const PORT = Number(process.env.PORT) || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TG_CHAT = process.env.TELEGRAM_CHAT_ID || '';

if (require.main === module && (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 8)) {
  console.error('ADMIN_PASSWORD muhit oʻzgaruvchisini kamida 8 belgi bilan bering.\nMasalan: ADMIN_PASSWORD="kuchliParol123" node server/server.js');
  process.exit(1);
}
fs.mkdirSync(UPLOADS, { recursive: true });

/* ---------- Ma'lumotlar bazasi: JSON fayl, atomik yozish ---------- */
let db = fs.existsSync(DB_FILE)
  ? JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))
  : JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'seed.json'), 'utf8'));
let chain = Promise.resolve();
function save() {
  const snap = JSON.stringify(db, null, 1);
  chain = chain.then(() => fs.promises.writeFile(DB_FILE + '.tmp', snap).then(() => fs.promises.rename(DB_FILE + '.tmp', DB_FILE)))
    .catch((e) => console.error('DB yozishda xato:', e.message));
  return chain;
}
save();
const nextId = (list) => list.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1;

/* ---------- Yordamchilar ---------- */
const clean = (s, max) => String(s == null ? '' : s).trim().slice(0, max || 500);
function normPhone(p) {
  let d = String(p || '').replace(/\D/g, '');
  if (d.length === 9) d = '998' + d;
  return /^998\d{9}$/.test(d) ? d : null;
}
const money = (n) => new Intl.NumberFormat('ru-RU').format(n).replace(/\s/g, ' ') + ' soʻm';
const IMG_PATH = /^(assets\/img\/|uploads\/)[\w.-]+$/;
const ORDER_STATUSES = ['new', 'confirmed', 'printing', 'shipped', 'done', 'cancelled'];
const REQUEST_STATUSES = ['new', 'quoted', 'accepted', 'done', 'rejected'];
const BADGES = ['new', 'hit', 'sale', 'custom'];
const MODELS = ['lamp', 'lampTall', 'pawn', 'keychain'];
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const fail = (status, msg) => { throw new HttpError(status, msg); };

function sanitizeProduct(b, prev) {
  const p = Object.assign({}, prev || {});
  if ('title' in b) p.title = clean(b.title, 120);
  if ('category' in b) p.category = clean(b.category, 40);
  if ('price' in b) p.price = Math.max(0, Math.round(Number(b.price) || 0));
  if ('oldPrice' in b) p.oldPrice = Math.max(0, Math.round(Number(b.oldPrice) || 0));
  if ('description' in b) p.description = clean(b.description, 2000);
  if ('specs' in b) p.specs = clean(b.specs, 200);
  if ('badges' in b) p.badges = (Array.isArray(b.badges) ? b.badges : []).filter((x) => BADGES.includes(x));
  if ('images' in b) p.images = (Array.isArray(b.images) ? b.images : []).map((x) => clean(x, 300)).filter((x) => IMG_PATH.test(x)).slice(0, 8);
  if ('colors' in b) p.colors = (Array.isArray(b.colors) ? b.colors : []).map((x) => clean(x, 40)).filter(Boolean).slice(0, 12);
  if ('model' in b) p.model = MODELS.includes(b.model) ? b.model : '';
  if ('modelColor' in b) p.modelColor = /^#[0-9a-f]{6}$/i.test(b.modelColor || '') ? b.modelColor : '';
  if ('instagram' in b) p.instagram = /^https:\/\/(www\.)?instagram\.com\//.test(b.instagram || '') ? clean(b.instagram, 300) : '';
  if ('active' in b) p.active = !!b.active;
  if ('stock' in b) p.stock = !!b.stock;
  if (!p.title || p.title.length < 2) fail(400, 'Mahsulot nomini yozing');
  if (!db.categories.some((c) => c.id === p.category)) fail(400, 'Turkumni tanlang');
  return p;
}
function sanitizeReel(b, prev) {
  const r = Object.assign({}, prev || {});
  if ('code' in b) r.code = /^[\w-]{5,40}$/.test(b.code || '') ? b.code : '';
  if ('title' in b) r.title = clean(b.title, 100);
  if ('cover' in b) r.cover = IMG_PATH.test(b.cover || '') ? b.cover : '';
  if ('active' in b) r.active = !!b.active;
  if (!r.code) fail(400, 'Instagram havolasi notoʻgʻri');
  return r;
}

async function notify(text) {
  if (!TG_TOKEN || !TG_CHAT) return;
  try {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT, text, disable_web_page_preview: true }),
    });
  } catch (e) { console.error('Telegram xabar yuborilmadi:', e.message); }
}

/* ---------- Admin sessiyasi: imzolangan cookie ---------- */
const COOKIE = 'up_admin';
const sign = (v) => crypto.createHmac('sha256', SECRET).update(v).digest('hex');
function makeToken() { const v = `admin.${Date.now() + 7 * 864e5}`; return `${v}.${sign(v)}`; }
function validToken(t) {
  const parts = String(t || '').split('.');
  if (parts.length !== 3) return false;
  const good = Buffer.from(sign(`${parts[0]}.${parts[1]}`)), got = Buffer.from(parts[2]);
  return good.length === got.length && crypto.timingSafeEqual(good, got) && Number(parts[1]) > Date.now();
}
function cookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((c) => { const i = c.indexOf('='); if (i > 0) out[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim()); });
  return out;
}
const isAdmin = (req) => validToken(cookies(req)[COOKIE]);

function limiter(max, windowMs, msg) {
  const hits = new Map();
  return (req) => {
    const ip = req.ip, now = Date.now();
    const a = (hits.get(ip) || []).filter((t) => now - t < windowMs);
    if (a.length >= max) fail(429, msg);
    a.push(now); hits.set(ip, a);
    if (hits.size > 5000) hits.clear();
  };
}
const loginLimit = limiter(10, 15 * 60e3, 'Juda koʻp urinish. 15 daqiqadan keyin qayta urinib koʻring');
const formLimit = limiter(6, 60e3, 'Biroz kuting va qayta yuboring');

/* ---------- So'rov tanasini o'qish ---------- */
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new HttpError(413, 'Fayl juda katta')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
async function readJson(req) {
  const buf = await readBody(req, 1024 * 1024);
  if (!buf.length) return {};
  try { return JSON.parse(buf.toString('utf8')); } catch { fail(400, 'Notoʻgʻri soʻrov'); }
}
/* multipart/form-data: maydonlar va fayllarni ajratadi */
async function readMultipart(req, limit) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(req.headers['content-type'] || '');
  if (!m) fail(400, 'Notoʻgʻri soʻrov');
  const boundary = Buffer.from('--' + (m[1] || m[2]));
  const buf = await readBody(req, limit);
  const fields = {}, files = [];
  let pos = buf.indexOf(boundary);
  while (pos !== -1) {
    pos += boundary.length;
    if (buf[pos] === 45 && buf[pos + 1] === 45) break; // "--" yakun
    pos += 2; // \r\n
    const headEnd = buf.indexOf('\r\n\r\n', pos);
    if (headEnd === -1) break;
    const head = buf.slice(pos, headEnd).toString('utf8');
    const next = buf.indexOf(boundary, headEnd + 4);
    if (next === -1) break;
    const data = buf.slice(headEnd + 4, next - 2);
    const name = (/name="([^"]*)"/i.exec(head) || [])[1];
    const filename = (/filename="([^"]*)"/i.exec(head) || [])[1];
    const type = ((/content-type:\s*([^\r\n]+)/i.exec(head) || [])[1] || '').trim().toLowerCase();
    if (name != null) {
      if (filename != null) { if (data.length) files.push({ field: name, filename, type, data }); }
      else fields[name] = data.toString('utf8');
    }
    pos = next;
  }
  return { fields, files };
}
const IMG_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
const VID_TYPES = { 'video/mp4': '.mp4', 'video/quicktime': '.mov', 'video/webm': '.webm' };
function sniffOk(f) { // fayl boshidagi belgilar bilan haqiqiy turini tekshirish
  const b = f.data;
  if (f.type === 'image/jpeg') return b[0] === 0xff && b[1] === 0xd8;
  if (f.type === 'image/png') return b.slice(0, 4).toString('hex') === '89504e47';
  if (f.type === 'image/gif') return b.slice(0, 3).toString() === 'GIF';
  if (f.type === 'image/webp') return b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP';
  if (VID_TYPES[f.type]) return true;
  return false;
}
async function storeFile(f) {
  const ext = IMG_TYPES[f.type] || VID_TYPES[f.type];
  if (!ext || !sniffOk(f)) fail(400, 'Faqat rasm (JPG, PNG, WEBP, GIF) yoki video (MP4, MOV, WEBM)');
  const name = crypto.randomBytes(12).toString('hex') + ext;
  await fs.promises.writeFile(path.join(UPLOADS, name), f.data);
  return 'uploads/' + name;
}

/* ---------- Javoblar ---------- */
function send(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.woff2': 'font/woff2' };
function serveFile(req, res, file, maxAge) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, { error: 'Topilmadi' });
    const ext = path.extname(file).toLowerCase();
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': maxAge ? `public, max-age=${maxAge}` : 'no-cache', 'Last-Modified': st.mtime.toUTCString() };
    if (req.headers['if-modified-since'] && new Date(req.headers['if-modified-since']) >= new Date(st.mtime.toUTCString())) { res.writeHead(304, headers); return res.end(); }
    res.writeHead(200, headers);
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}
function safeJoin(base, rel) {
  const p = path.resolve(base, '.' + path.sep + rel);
  return p.startsWith(base + path.sep) ? p : null;
}

/* ---------- Marshrutlar ---------- */
const routes = [];
const route = (method, pattern, handler, opts) => {
  const keys = []; const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ method, re, keys, handler, admin: !!(opts && opts.admin) });
};

route('GET', '/api/health', () => ({ ok: true }));
route('GET', '/api/catalog', () => ({
  settings: db.settings,
  categories: [...db.categories].sort((a, b) => (a.sort || 0) - (b.sort || 0)),
  products: db.products.filter((p) => p.active !== false).sort((a, b) => (b.created || 0) - (a.created || 0)),
  reels: db.reels.filter((r) => r.active !== false),
}));

route('POST', '/api/orders', async (req) => {
  formLimit(req);
  const b = await readJson(req);
  const name = clean(b.name, 80), phone = normPhone(b.phone), address = clean(b.address, 400), note = clean(b.note, 600);
  if (name.length < 2) fail(400, 'Ismingizni yozing');
  if (!phone) fail(400, 'Telefon raqamni toʻgʻri yozing, masalan 90 123 45 67');
  if (address.length < 5) fail(400, 'Yetkazib berish manzilini yozing');
  const items = [];
  for (const it of Array.isArray(b.items) ? b.items.slice(0, 50) : []) {
    const p = db.products.find((x) => x.id === Number(it.id) && x.active !== false);
    const qty = Math.max(1, Math.min(999, parseInt(it.qty, 10) || 1));
    if (p) items.push({ id: p.id, title: p.title, price: p.price, qty, color: clean(it.color, 40) });
  }
  if (!items.length) fail(400, 'Savat boʻsh');
  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  const order = { id: nextId(db.orders), status: 'new', created: Date.now(), name, phone, address, note, items, total };
  db.orders.unshift(order); save();
  notify(`🛒 Yangi buyurtma #${order.id}\n${name}, +${phone}\n${address}\n\n${items.map((i) => `• ${i.title}${i.color ? ` (${i.color})` : ''} × ${i.qty}`).join('\n')}\n\nJami: ${money(total)}${note ? `\nIzoh: ${note}` : ''}`);
  return { id: order.id, total };
});

route('POST', '/api/requests', async (req) => {
  formLimit(req);
  const { fields: b, files: raw } = await readMultipart(req, 80 * 1024 * 1024);
  const name = clean(b.name, 80), phone = normPhone(b.phone), title = clean(b.title, 120), description = clean(b.description, 3000);
  if (name.length < 2) fail(400, 'Ismingizni yozing');
  if (!phone) fail(400, 'Telefon raqamni toʻgʻri yozing');
  if (title.length < 3) fail(400, 'Nima kerakligini qisqa yozing');
  if (description.length < 10) fail(400, 'Tushuntirishni kamida 10 belgi bilan yozing');
  const list = raw.filter((f) => f.field === 'files');
  if (list.length > 5) fail(400, 'Eng koʻpi bilan 5 ta fayl');
  if (list.some((f) => f.data.length > 40 * 1024 * 1024)) fail(400, 'Har bir fayl 40 MB gacha boʻlsin');
  const files = [];
  for (const f of list) files.push({ name: clean(f.filename, 120), url: await storeFile(f) });
  const r = { id: nextId(db.requests), name, phone, title, description, link: clean(b.link, 300), qty: clean(b.qty, 20), files, status: 'new', reply: '', created: Date.now() };
  db.requests.unshift(r); save();
  notify(`✨ Maxsus buyurtma soʻrovi #${r.id}\n${name}, +${phone}\n${title}${r.qty ? ` — ${r.qty} dona` : ''}\n\n${description}${r.link ? `\n${r.link}` : ''}${files.length ? `\n📎 ${files.length} ta fayl` : ''}`);
  return { id: r.id };
});

route('POST', '/api/admin/login', async (req, prm, res) => {
  loginLimit(req);
  const pw = String((await readJson(req)).password || '');
  const a = Buffer.from(sign(pw)), b = Buffer.from(sign(ADMIN_PASSWORD));
  if (!ADMIN_PASSWORD || !crypto.timingSafeEqual(a, b)) fail(401, 'Parol notoʻgʻri');
  const secure = req.secure ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE}=${makeToken()}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${7 * 86400}${secure}`);
  return { ok: true };
});
route('POST', '/api/admin/logout', (req, prm, res) => { res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`); return { ok: true }; });
route('GET', '/api/admin/me', () => ({ ok: true }), { admin: true });
route('GET', '/api/admin/data', () => db, { admin: true });

route('POST', '/api/admin/products', async (req) => {
  const p = sanitizeProduct(Object.assign({ active: true, stock: true, badges: [], images: [], colors: [] }, await readJson(req)));
  p.id = nextId(db.products); p.created = Date.now();
  db.products.push(p); save(); return p;
}, { admin: true });
route('PUT', '/api/admin/products/:id', async (req, prm) => {
  const i = db.products.findIndex((x) => x.id === Number(prm.id));
  if (i < 0) fail(404, 'Mahsulot topilmadi');
  db.products[i] = sanitizeProduct(await readJson(req), db.products[i]); save(); return db.products[i];
}, { admin: true });
route('DELETE', '/api/admin/products/:id', (req, prm) => { db.products = db.products.filter((x) => x.id !== Number(prm.id)); save(); return { ok: true }; }, { admin: true });

route('PUT', '/api/admin/categories', async (req) => {
  const body = await readJson(req);
  const list = (Array.isArray(body) ? body : []).slice(0, 40).map((c, i) => ({
    id: clean(c.id, 40).toLowerCase().replace(/[^a-z0-9-]/g, '') || 'turkum-' + (i + 1),
    name: clean(c.name, 60), blurb: clean(c.blurb, 160), cover: IMG_PATH.test(c.cover || '') ? c.cover : '', sort: i + 1,
  })).filter((c) => c.name);
  if (new Set(list.map((c) => c.id)).size !== list.length) fail(400, 'Turkum kodlari takrorlanmasin');
  db.categories = list; save(); return list;
}, { admin: true });

route('POST', '/api/admin/reels', async (req) => { const r = sanitizeReel(Object.assign({ active: true }, await readJson(req))); r.id = nextId(db.reels); db.reels.unshift(r); save(); return r; }, { admin: true });
route('PUT', '/api/admin/reels/:id', async (req, prm) => {
  const i = db.reels.findIndex((x) => x.id === Number(prm.id)); if (i < 0) fail(404, 'Video topilmadi');
  db.reels[i] = sanitizeReel(await readJson(req), db.reels[i]); save(); return db.reels[i];
}, { admin: true });
route('POST', '/api/admin/reels/:id/move', async (req, prm) => {
  const dir = Number((await readJson(req)).dir) < 0 ? -1 : 1;
  const i = db.reels.findIndex((x) => x.id === Number(prm.id)), j = i + dir;
  if (i >= 0 && j >= 0 && j < db.reels.length) { [db.reels[i], db.reels[j]] = [db.reels[j], db.reels[i]]; save(); }
  return { ok: true };
}, { admin: true });
route('DELETE', '/api/admin/reels/:id', (req, prm) => { db.reels = db.reels.filter((x) => x.id !== Number(prm.id)); save(); return { ok: true }; }, { admin: true });

route('PATCH', '/api/admin/orders/:id', async (req, prm) => {
  const o = db.orders.find((x) => x.id === Number(prm.id)); if (!o) fail(404, 'Buyurtma topilmadi');
  const b = await readJson(req);
  if ('status' in b) { if (!ORDER_STATUSES.includes(b.status)) fail(400, 'Holat notoʻgʻri'); o.status = b.status; }
  if ('adminNote' in b) o.adminNote = clean(b.adminNote, 1000);
  save(); return o;
}, { admin: true });
route('DELETE', '/api/admin/orders/:id', (req, prm) => { db.orders = db.orders.filter((x) => x.id !== Number(prm.id)); save(); return { ok: true }; }, { admin: true });
route('PATCH', '/api/admin/requests/:id', async (req, prm) => {
  const r = db.requests.find((x) => x.id === Number(prm.id)); if (!r) fail(404, 'Soʻrov topilmadi');
  const b = await readJson(req);
  if ('status' in b) { if (!REQUEST_STATUSES.includes(b.status)) fail(400, 'Holat notoʻgʻri'); r.status = b.status; }
  if ('reply' in b) r.reply = clean(b.reply, 2000);
  if ('price' in b) r.price = Math.max(0, Math.round(Number(b.price) || 0));
  save(); return r;
}, { admin: true });
route('DELETE', '/api/admin/requests/:id', (req, prm) => { db.requests = db.requests.filter((x) => x.id !== Number(prm.id)); save(); return { ok: true }; }, { admin: true });

route('PUT', '/api/admin/settings', async (req) => {
  const b = await readJson(req);
  ['brand', 'phone', 'telegram', 'instagram', 'city', 'heroKicker', 'heroTitle', 'heroText', 'followers', 'announce', 'delivery']
    .forEach((k) => { if (k in b) db.settings[k] = clean(b[k], k === 'heroText' ? 400 : 160); });
  save(); return db.settings;
}, { admin: true });
route('POST', '/api/admin/upload', async (req) => {
  const { files } = await readMultipart(req, 9 * 1024 * 1024);
  const f = files.find((x) => x.field === 'file');
  if (!f) fail(400, 'Rasm tanlang');
  if (!IMG_TYPES[f.type]) fail(400, 'Faqat JPG, PNG, WEBP yoki GIF rasm');
  return { url: await storeFile(f) };
}, { admin: true });

/* ---------- Server ---------- */
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  req.ip = (process.env.TRUST_PROXY ? fwd : '') || req.socket.remoteAddress || '';
  req.secure = req.socket.encrypted || (process.env.TRUST_PROXY && req.headers['x-forwarded-proto'] === 'https');
  let url;
  try { url = new URL(req.url, 'http://x'); } catch { return send(res, 400, { error: 'Notoʻgʻri manzil' }); }
  const p = decodeURIComponent(url.pathname);

  if (p.startsWith('/api/')) {
    // Admin amallari uchun boshqa saytlardan kelgan so'rovlarni rad etamiz
    if (req.method !== 'GET' && req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return send(res, 403, { error: 'Ruxsat yoʻq' });
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const m = r.re.exec(p); if (!m) continue;
      const prm = {}; r.keys.forEach((k, i) => { prm[k] = m[i + 1]; });
      try {
        if (r.admin && !isAdmin(req)) fail(401, 'Avval tizimga kiring');
        const out = await r.handler(req, prm, res);
        return send(res, 200, out);
      } catch (e) {
        const status = e.status || 500;
        if (status >= 500) console.error(e);
        return send(res, status, { error: status >= 500 ? 'Serverda xatolik' : e.message });
      }
    }
    return send(res, 404, { error: 'Topilmadi' });
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Ruxsat etilmagan' });
  if (p === '/' || p === '/index.html') return serveFile(req, res, path.join(ROOT, 'index.html'));
  if (p === '/admin' || p === '/admin.html') return serveFile(req, res, path.join(ROOT, 'admin.html'));
  if (p === '/data/seed.json') return serveFile(req, res, path.join(ROOT, 'data', 'seed.json'));
  if (p.startsWith('/uploads/')) { const f = safeJoin(UPLOADS, p.slice(9)); return f ? serveFile(req, res, f, 2592000) : send(res, 404, { error: 'Topilmadi' }); }
  if (p.startsWith('/assets/')) { const f = safeJoin(path.join(ROOT, 'assets'), p.slice(8)); return f ? serveFile(req, res, f, 86400) : send(res, 404, { error: 'Topilmadi' }); }
  return send(res, 404, { error: 'Topilmadi' });
});

if (require.main === module) server.listen(PORT, () => console.log(`3D UrbanPrint ishlayapti: http://localhost:${PORT}   Admin panel: http://localhost:${PORT}/admin`));
module.exports = { server, get db() { return db; } };
