'use strict';
/* SQLite baza (Node.js ichidagi node:sqlite, tashqi paket kerak emas).
   Mahsulot, turkum, video, buyurtma va so'rovlar JSON hujjat sifatida saqlanadi:
   maydon qo'shish oson, sxema migratsiyasi kerak bo'lmaydi. */
const path = require('path');
const fs = require('fs');

// node:sqlite "experimental" ogohlantirishini yashiramiz, qolganlari chiqaveradi
const origEmit = process.emitWarning;
process.emitWarning = function (w, ...a) { if (String(w && w.message || w).includes('SQLite')) return; return origEmit.call(process, w, ...a); };
const { DatabaseSync } = require('node:sqlite');
process.emitWarning = origEmit;

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
fs.mkdirSync(path.join(DATA_DIR, 'uploads'), { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'shop.db'));
db.exec(`
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, sort INTEGER DEFAULT 0, doc TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY, created INTEGER, doc TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS reels (id INTEGER PRIMARY KEY, sort INTEGER DEFAULT 0, doc TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS promos (id INTEGER PRIMARY KEY, code TEXT UNIQUE NOT NULL, doc TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY, code TEXT UNIQUE NOT NULL, phone TEXT, status TEXT, total INTEGER, created INTEGER, doc TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS requests (id INTEGER PRIMARY KEY, status TEXT, created INTEGER, doc TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL, provider TEXT NOT NULL, provider_trans_id TEXT NOT NULL,
  amount INTEGER NOT NULL, state INTEGER NOT NULL, create_time INTEGER NOT NULL,
  perform_time INTEGER DEFAULT 0, cancel_time INTEGER DEFAULT 0, reason INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pay_tx ON payments(provider, provider_trans_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created);
`);

const parse = (row) => (row ? Object.assign(JSON.parse(row.doc), { id: row.id }) : null);
function tx(fn) {
  db.exec('BEGIN IMMEDIATE');
  try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
}

/* ---------- Sozlamalar ---------- */
function getSettings() { const r = db.prepare("SELECT value FROM kv WHERE key = 'settings'").get(); return r ? JSON.parse(r.value) : {}; }
function setSettings(s) { db.prepare("INSERT INTO kv (key, value) VALUES ('settings', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(JSON.stringify(s)); return s; }

/* ---------- Turkumlar ---------- */
const listCategories = () => db.prepare('SELECT id, doc FROM categories ORDER BY sort, rowid').all().map((r) => Object.assign(JSON.parse(r.doc), { id: r.id }));
function replaceCategories(list) {
  tx(() => {
    db.exec('DELETE FROM categories');
    const ins = db.prepare('INSERT INTO categories (id, sort, doc) VALUES (?, ?, ?)');
    list.forEach((c, i) => { const { id, ...doc } = c; ins.run(id, i + 1, JSON.stringify(Object.assign(doc, { sort: i + 1 }))); });
  });
  return listCategories();
}

/* ---------- Mahsulotlar ---------- */
const listProducts = () => db.prepare('SELECT id, doc FROM products ORDER BY created DESC').all().map(parse);
const getProduct = (id) => parse(db.prepare('SELECT id, doc FROM products WHERE id = ?').get(id));
function saveProduct(p) {
  const { id, ...doc } = p;
  if (id) { db.prepare('UPDATE products SET doc = ?, created = ? WHERE id = ?').run(JSON.stringify(doc), doc.created || 0, id); return getProduct(id); }
  const r = db.prepare('INSERT INTO products (created, doc) VALUES (?, ?)').run(doc.created || Date.now(), JSON.stringify(doc));
  return getProduct(Number(r.lastInsertRowid));
}
const deleteProduct = (id) => db.prepare('DELETE FROM products WHERE id = ?').run(id);

/* ---------- Videolar ---------- */
const listReels = () => db.prepare('SELECT id, doc FROM reels ORDER BY sort, id').all().map(parse);
function saveReel(r, atTop) {
  const { id, ...doc } = r;
  if (id) { db.prepare('UPDATE reels SET doc = ? WHERE id = ?').run(JSON.stringify(doc), id); return parse(db.prepare('SELECT id, doc FROM reels WHERE id = ?').get(id)); }
  const min = db.prepare('SELECT MIN(sort) m, MAX(sort) x FROM reels').get();
  const sort = atTop ? (min.m || 0) - 1 : (min.x || 0) + 1;
  const res = db.prepare('INSERT INTO reels (sort, doc) VALUES (?, ?)').run(sort, JSON.stringify(doc));
  return parse(db.prepare('SELECT id, doc FROM reels WHERE id = ?').get(Number(res.lastInsertRowid)));
}
function moveReel(id, dir) {
  const list = db.prepare('SELECT id FROM reels ORDER BY sort, id').all().map((r) => r.id);
  const i = list.indexOf(id), j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  tx(() => { const up = db.prepare('UPDATE reels SET sort = ? WHERE id = ?'); list.forEach((rid, k) => up.run(k + 1, rid)); });
}
const deleteReel = (id) => db.prepare('DELETE FROM reels WHERE id = ?').run(id);

/* ---------- Promokodlar ---------- */
const listPromos = () => db.prepare('SELECT id, doc FROM promos ORDER BY id DESC').all().map(parse);
const findPromo = (code) => parse(db.prepare('SELECT id, doc FROM promos WHERE code = ?').get(String(code || '').trim().toUpperCase()));
function savePromo(p) {
  const { id, ...doc } = p;
  if (id) { db.prepare('UPDATE promos SET code = ?, doc = ? WHERE id = ?').run(doc.code, JSON.stringify(doc), id); return parse(db.prepare('SELECT id, doc FROM promos WHERE id = ?').get(id)); }
  const r = db.prepare('INSERT INTO promos (code, doc) VALUES (?, ?)').run(doc.code, JSON.stringify(doc));
  return parse(db.prepare('SELECT id, doc FROM promos WHERE id = ?').get(Number(r.lastInsertRowid)));
}
const deletePromo = (id) => db.prepare('DELETE FROM promos WHERE id = ?').run(id);

/* ---------- Buyurtmalar ---------- */
const listOrders = () => db.prepare('SELECT id, doc FROM orders ORDER BY id DESC').all().map(parse);
const getOrder = (id) => parse(db.prepare('SELECT id, doc FROM orders WHERE id = ?').get(id));
const getOrderByCode = (code) => parse(db.prepare('SELECT id, doc FROM orders WHERE code = ?').get(String(code || '').trim().toUpperCase()));
function insertOrder(o) {
  const { id, ...doc } = o;
  const r = db.prepare('INSERT INTO orders (code, phone, status, total, created, doc) VALUES (?, ?, ?, ?, ?, ?)').run(doc.code, doc.phone, doc.status, doc.total, doc.created, JSON.stringify(doc));
  return getOrder(Number(r.lastInsertRowid));
}
function updateOrder(o) {
  const { id, ...doc } = o;
  db.prepare('UPDATE orders SET status = ?, total = ?, doc = ? WHERE id = ?').run(doc.status, doc.total, JSON.stringify(doc), id);
  return getOrder(id);
}
const deleteOrder = (id) => db.prepare('DELETE FROM orders WHERE id = ?').run(id);

/* ---------- So'rovlar ---------- */
const listRequests = () => db.prepare('SELECT id, doc FROM requests ORDER BY id DESC').all().map(parse);
const getRequest = (id) => parse(db.prepare('SELECT id, doc FROM requests WHERE id = ?').get(id));
function insertRequest(r) {
  const { id, ...doc } = r;
  const res = db.prepare('INSERT INTO requests (status, created, doc) VALUES (?, ?, ?)').run(doc.status, doc.created, JSON.stringify(doc));
  return getRequest(Number(res.lastInsertRowid));
}
function updateRequest(r) { const { id, ...doc } = r; db.prepare('UPDATE requests SET status = ?, doc = ? WHERE id = ?').run(doc.status, JSON.stringify(doc), id); return getRequest(id); }
const deleteRequest = (id) => db.prepare('DELETE FROM requests WHERE id = ?').run(id);

/* ---------- Birinchi ishga tushish: boshlang'ich ma'lumot ---------- */
function seedIfEmpty() {
  if (db.prepare("SELECT 1 FROM kv WHERE key = 'settings'").get()) return;
  const seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'seed.json'), 'utf8'));
  // Eski versiyadagi db.json bo'lsa, undagi buyurtma va so'rovlarni ham ko'chiramiz
  const legacyFile = path.join(DATA_DIR, 'db.json');
  const legacy = fs.existsSync(legacyFile) ? JSON.parse(fs.readFileSync(legacyFile, 'utf8')) : null;
  const src = legacy ? Object.assign({}, seed, legacy, { settings: Object.assign({}, seed.settings, legacy.settings), promos: seed.promos }) : seed;
  tx(() => {
    setSettings(src.settings);
    const ic = db.prepare('INSERT INTO categories (id, sort, doc) VALUES (?, ?, ?)');
    src.categories.forEach((c, i) => { const { id, ...doc } = c; ic.run(id, i + 1, JSON.stringify(doc)); });
    const ip = db.prepare('INSERT INTO products (id, created, doc) VALUES (?, ?, ?)');
    src.products.forEach((p) => { const { id, ...doc } = p; ip.run(id, doc.created || Date.now(), JSON.stringify(doc)); });
    const ir = db.prepare('INSERT INTO reels (id, sort, doc) VALUES (?, ?, ?)');
    src.reels.forEach((r, i) => { const { id, ...doc } = r; ir.run(id, i + 1, JSON.stringify(doc)); });
    const ipr = db.prepare('INSERT INTO promos (id, code, doc) VALUES (?, ?, ?)');
    (src.promos || []).forEach((p) => { const { id, ...doc } = p; ipr.run(id, doc.code, JSON.stringify(doc)); });
    (src.orders || []).slice().reverse().forEach((o) => {
      const { id, ...doc } = o; doc.code = doc.code || 'UP-' + String(id).padStart(4, '0');
      db.prepare('INSERT INTO orders (id, code, phone, status, total, created, doc) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, doc.code, doc.phone, doc.status, doc.total, doc.created, JSON.stringify(doc));
    });
    (src.requests || []).slice().reverse().forEach((r) => { const { id, ...doc } = r; db.prepare('INSERT INTO requests (id, status, created, doc) VALUES (?, ?, ?, ?)').run(id, doc.status, doc.created, JSON.stringify(doc)); });
  });
  if (legacy) console.log('Eski db.json maʼlumotlari SQLite bazaga koʻchirildi');
}
seedIfEmpty();

function dump() {
  return { settings: getSettings(), categories: listCategories(), products: listProducts(), reels: listReels(), promos: listPromos(), orders: listOrders(), requests: listRequests() };
}

module.exports = {
  db, tx, DATA_DIR, ROOT, dump,
  getSettings, setSettings, listCategories, replaceCategories,
  listProducts, getProduct, saveProduct, deleteProduct,
  listReels, saveReel, moveReel, deleteReel,
  listPromos, findPromo, savePromo, deletePromo,
  listOrders, getOrder, getOrderByCode, insertOrder, updateOrder, deleteOrder,
  listRequests, getRequest, insertRequest, updateRequest, deleteRequest,
};
