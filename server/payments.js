'use strict';
/* Payme (Merchant API) va Click (Shop API) to'lovlari.
   cubercaat/3durbanprint loyihasidagi tekshirilgan kod asosida, yangi bazaga moslangan.
   Summa har doim serverdagi buyurtmadan olinadi, mijoz o'zgartira olmaydi. */
const crypto = require('crypto');
const D = require('./db');
const { db } = D;

const cfg = () => ({
  publicUrl: (process.env.PUBLIC_URL || 'http://localhost:3000').replace(/\/$/, ''),
  payme: { merchantId: process.env.PAYME_MERCHANT_ID || '', key: process.env.PAYME_KEY || '', test: process.env.PAYME_TEST === '1' },
  click: { serviceId: process.env.CLICK_SERVICE_ID || '', merchantId: process.env.CLICK_MERCHANT_ID || '', secret: process.env.CLICK_SECRET_KEY || '' },
});

function availability() {
  const c = cfg();
  return { payme: !!(c.payme.merchantId && c.payme.key), click: !!(c.click.serviceId && c.click.merchantId && c.click.secret) };
}

let onPaid = () => {};
function setOnPaid(fn) { onPaid = fn; }

function markOrderPaid(orderId, method) {
  const o = D.getOrder(orderId);
  if (!o || o.status !== 'pending_payment') return;
  o.status = 'paid'; o.paidWith = method; o.paidAt = Date.now();
  o.history = (o.history || []).concat({ status: 'paid', at: o.paidAt });
  D.updateOrder(o);
  setImmediate(() => onPaid(o));
}

function checkoutUrl(provider, order) {
  const c = cfg();
  const back = `${c.publicUrl}/?order=${encodeURIComponent(order.code)}`;
  if (provider === 'payme') {
    const raw = `m=${c.payme.merchantId};ac.order_id=${order.id};a=${order.total * 100};l=uz;c=${back}`;
    return `${c.payme.test ? 'https://test.paycom.uz' : 'https://checkout.paycom.uz'}/${Buffer.from(raw).toString('base64')}`;
  }
  if (provider === 'click') {
    const q = new URLSearchParams({ service_id: c.click.serviceId, merchant_id: c.click.merchantId, amount: String(order.total), transaction_param: String(order.id), return_url: back });
    return `https://my.click.uz/services/pay?${q}`;
  }
  return null;
}

/* ---------- Payme Merchant API (JSON-RPC) ---------- */
const PAYME_TIMEOUT_MS = 12 * 60 * 60 * 1000;
const msg = (uz, ru, en) => ({ uz, ru, en });
const E = {
  AUTH: { code: -32504, message: msg('Ruxsat yoʻq', 'Недостаточно привилегий', 'Insufficient privilege') },
  METHOD: { code: -32601, message: msg('Metod topilmadi', 'Метод не найден', 'Method not found') },
  ORDER: { code: -31050, message: msg('Buyurtma topilmadi', 'Заказ не найден', 'Order not found'), data: 'order_id' },
  AMOUNT: { code: -31001, message: msg('Summa notoʻgʻri', 'Неверная сумма', 'Wrong amount') },
  CANT: { code: -31008, message: msg('Amalni bajarib boʻlmaydi', 'Невозможно выполнить операцию', 'Cannot perform operation') },
  TX: { code: -31003, message: msg('Tranzaksiya topilmadi', 'Транзакция не найдена', 'Transaction not found') },
  BUSY: { code: -31099, message: msg('Buyurtmani toʻlab boʻlmaydi', 'Заказ не может быть оплачен', 'Order cannot be paid'), data: 'order_id' },
  CANCEL: { code: -31007, message: msg('Buyurtma bajarilgan, bekor qilib boʻlmaydi', 'Заказ выполнен, отменить нельзя', 'Order completed, cannot cancel') },
};
class RpcError extends Error { constructor(e) { super(e.message.en); this.e = e; } }
const fail = (e) => { throw new RpcError(e); };

function paymeAuthOk(header) {
  const key = cfg().payme.key;
  if (!key) return false;
  const m = /^Basic (.+)$/.exec(header || '');
  if (!m) return false;
  const expected = Buffer.from(`Paycom:${key}`), got = Buffer.from(Buffer.from(m[1], 'base64').toString());
  return got.length === expected.length && crypto.timingSafeEqual(got, expected);
}
function paymeOrderFor(params) {
  const id = Number(params.account && params.account.order_id);
  const order = Number.isInteger(id) ? D.getOrder(id) : null;
  if (!order) fail(E.ORDER);
  if (order.status !== 'pending_payment') fail(E.BUSY);
  if (Number(params.amount) !== order.total * 100) fail(E.AMOUNT);
  return order;
}
const txView = (t) => ({ create_time: t.create_time, perform_time: t.perform_time, cancel_time: t.cancel_time, transaction: String(t.id), state: t.state, reason: t.reason == null ? null : t.reason });
const getPay = (id) => db.prepare('SELECT * FROM payments WHERE id = ?').get(id);
function paymeTx(params) {
  const t = db.prepare("SELECT * FROM payments WHERE provider = 'payme' AND provider_trans_id = ?").get(String(params.id));
  if (!t) fail(E.TX);
  return t;
}
function expireIfNeeded(t) {
  if (t.state === 1 && Date.now() - t.create_time > PAYME_TIMEOUT_MS) {
    db.prepare('UPDATE payments SET state = -1, reason = 4, cancel_time = ? WHERE id = ?').run(Date.now(), t.id);
    return getPay(t.id);
  }
  return t;
}

const paymeMethods = {
  CheckPerformTransaction(p) { paymeOrderFor(p); return { allow: true }; },
  CreateTransaction(p) {
    const existing = db.prepare("SELECT * FROM payments WHERE provider = 'payme' AND provider_trans_id = ?").get(String(p.id));
    if (existing) {
      const t = expireIfNeeded(existing);
      if (t.state !== 1) fail(E.CANT);
      return { create_time: t.create_time, transaction: String(t.id), state: t.state };
    }
    const order = paymeOrderFor(p);
    if (db.prepare('SELECT id FROM payments WHERE order_id = ? AND state = 1').get(order.id)) fail(E.BUSY);
    const now = Date.now();
    const info = db.prepare("INSERT INTO payments (order_id, provider, provider_trans_id, amount, state, create_time) VALUES (?, 'payme', ?, ?, 1, ?)").run(order.id, String(p.id), order.total, now);
    return { create_time: now, transaction: String(info.lastInsertRowid), state: 1 };
  },
  PerformTransaction(p) {
    const t = expireIfNeeded(paymeTx(p));
    if (t.state === 2) return { transaction: String(t.id), perform_time: t.perform_time, state: 2 };
    if (t.state !== 1) fail(E.CANT);
    const now = Date.now();
    D.tx(() => { db.prepare('UPDATE payments SET state = 2, perform_time = ? WHERE id = ?').run(now, t.id); markOrderPaid(t.order_id, 'payme'); });
    return { transaction: String(t.id), perform_time: now, state: 2 };
  },
  CancelTransaction(p) {
    const t = paymeTx(p);
    if (t.state < 0) return { transaction: String(t.id), cancel_time: t.cancel_time, state: t.state };
    const now = Date.now();
    if (t.state === 1) {
      db.prepare('UPDATE payments SET state = -1, reason = ?, cancel_time = ? WHERE id = ?').run(p.reason ?? null, now, t.id);
      return { transaction: String(t.id), cancel_time: now, state: -1 };
    }
    // To'langan buyurtma: ishlab chiqarish boshlangan bo'lsa bekor qilib bo'lmaydi
    const order = D.getOrder(t.order_id);
    if (order && !['paid', 'pending_payment'].includes(order.status)) fail(E.CANCEL);
    D.tx(() => {
      db.prepare('UPDATE payments SET state = -2, reason = ?, cancel_time = ? WHERE id = ?').run(p.reason ?? null, now, t.id);
      if (order) { order.status = 'cancelled'; order.history = (order.history || []).concat({ status: 'cancelled', at: now }); D.updateOrder(order); }
    });
    return { transaction: String(t.id), cancel_time: now, state: -2 };
  },
  CheckTransaction(p) { return txView(expireIfNeeded(paymeTx(p))); },
  GetStatement(p) {
    const rows = db.prepare("SELECT * FROM payments WHERE provider = 'payme' AND create_time BETWEEN ? AND ? ORDER BY create_time").all(Number(p.from), Number(p.to));
    return { transactions: rows.map((t) => ({ id: t.provider_trans_id, time: t.create_time, amount: t.amount * 100, account: { order_id: String(t.order_id) }, ...txView(t) })) };
  },
};
function payme(body, authHeader) {
  const reply = (obj) => ({ jsonrpc: '2.0', id: body.id ?? null, ...obj });
  if (!paymeAuthOk(authHeader)) return reply({ error: E.AUTH });
  const fn = paymeMethods[body.method];
  if (!fn) return reply({ error: E.METHOD });
  try { return reply({ result: fn(body.params || {}) }); }
  catch (err) {
    if (err instanceof RpcError) return reply({ error: err.e });
    console.error('[payme]', err);
    return reply({ error: { code: -32400, message: msg('Ichki xato', 'Внутренняя ошибка', 'Internal error') } });
  }
}

/* ---------- Click Shop API ---------- */
const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');
const out = (extra, error, note) => ({ ...extra, error, error_note: note });
function clickSignOk(b, withPrepareId) {
  const secret = cfg().click.secret;
  if (!secret) return false;
  const parts = [b.click_trans_id, b.service_id, secret, b.merchant_trans_id];
  if (withPrepareId) parts.push(b.merchant_prepare_id);
  parts.push(b.amount, b.action, b.sign_time);
  const expected = md5(parts.join('')), got = String(b.sign_string || '');
  return got.length === expected.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}
function clickPrepare(b) {
  const base = { click_trans_id: b.click_trans_id, merchant_trans_id: b.merchant_trans_id };
  if (!clickSignOk(b, false)) return out(base, -1, 'SIGN CHECK FAILED!');
  if (String(b.service_id) !== cfg().click.serviceId) return out(base, -8, 'Error in request from click');
  if (Number(b.action) !== 0) return out(base, -3, 'Action not found');
  const order = D.getOrder(Number(b.merchant_trans_id));
  if (!order) return out(base, -5, 'Order not found');
  if (order.status === 'paid') return out(base, -4, 'Already paid');
  if (order.status !== 'pending_payment') return out(base, -9, 'Transaction cancelled');
  if (Math.abs(Number(b.amount) - order.total) > 0.01) return out(base, -2, 'Incorrect parameter amount');
  let t = db.prepare("SELECT * FROM payments WHERE provider = 'click' AND provider_trans_id = ?").get(String(b.click_trans_id));
  if (!t) {
    const info = db.prepare("INSERT INTO payments (order_id, provider, provider_trans_id, amount, state, create_time) VALUES (?, 'click', ?, ?, 1, ?)").run(order.id, String(b.click_trans_id), order.total, Date.now());
    t = { id: Number(info.lastInsertRowid) };
  }
  return out({ ...base, merchant_prepare_id: t.id }, 0, 'Success');
}
function clickComplete(b) {
  const base = { click_trans_id: b.click_trans_id, merchant_trans_id: b.merchant_trans_id };
  if (!clickSignOk(b, true)) return out(base, -1, 'SIGN CHECK FAILED!');
  if (String(b.service_id) !== cfg().click.serviceId) return out(base, -8, 'Error in request from click');
  if (Number(b.action) !== 1) return out(base, -3, 'Action not found');
  const t = db.prepare("SELECT * FROM payments WHERE id = ? AND provider = 'click'").get(Number(b.merchant_prepare_id));
  if (!t || String(t.provider_trans_id) !== String(b.click_trans_id)) return out(base, -6, 'Transaction does not exist');
  const order = D.getOrder(Number(b.merchant_trans_id));
  if (!order || order.id !== t.order_id) return out(base, -5, 'Order not found');
  if (Math.abs(Number(b.amount) - order.total) > 0.01) return out(base, -2, 'Incorrect parameter amount');
  const done = { ...base, merchant_confirm_id: t.id };
  if (t.state === 2) return out(done, -4, 'Already paid');
  if (t.state < 0 || order.status === 'cancelled') return out(base, -9, 'Transaction cancelled');
  if (Number(b.error) < 0) { db.prepare('UPDATE payments SET state = -1, cancel_time = ? WHERE id = ?').run(Date.now(), t.id); return out(base, -9, 'Transaction cancelled'); }
  D.tx(() => { db.prepare('UPDATE payments SET state = 2, perform_time = ? WHERE id = ?').run(Date.now(), t.id); markOrderPaid(order.id, 'click'); });
  return out(done, 0, 'Success');
}

module.exports = { availability, checkoutUrl, payme, clickPrepare, clickComplete, setOnPaid };
