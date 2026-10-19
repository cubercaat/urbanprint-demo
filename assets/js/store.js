'use strict';
/* Ma'lumot qatlami.
   Server ishlayotgan bo'lsa (api/health javob bersa) hamma narsa serverga yoziladi.
   Statik hostingda (GitHub Pages) "demo rejim": ma'lumot shu brauzerning localStorage'ida saqlanadi,
   shuning uchun admin paneldagi o'zgarishlar shu brauzerdagi do'kon sahifasida darhol ko'rinadi.
   Narx, promokod va qoldiq qoidalari shared.js'da, server bilan bir xil. */
window.Store = (function () {
  const SH = window.Shared;
  const KEY = 'up_db_v3';
  const AUTH = 'up_admin_demo';
  const DEMO_PASSWORD = 'admin';
  let mode = null;
  let db = null;
  const { clean, normPhone } = SH;

  /* ---------- Server rejimi ---------- */
  async function http(method, url, body) {
    const opts = { method, headers: {}, credentials: 'same-origin' };
    if (body instanceof FormData) opts.body = body;
    else if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    let res;
    try { res = await fetch(url, opts); } catch { throw new Error('Internet bilan aloqa yoʻq. Qayta urinib koʻring'); }
    let data = null;
    try { data = await res.json(); } catch { /* bo'sh javob */ }
    if (!res.ok) { const e = new Error((data && data.error) || 'Xatolik yuz berdi'); e.status = res.status; throw e; }
    return data;
  }

  /* ---------- Demo rejimi ---------- */
  async function loadDemo() {
    if (db) return db;
    try { db = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { db = null; }
    if (!db) { db = await fetch('data/seed.json', { cache: 'no-store' }).then((r) => r.json()); db.orders = db.orders || []; db.requests = db.requests || []; db.promos = db.promos || []; persist(); }
    return db;
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch { throw new Error('Brauzer xotirasi toʻldi. Kichikroq rasm yuklang yoki demo maʼlumotni tiklang'); }
  }
  const nextId = (list) => list.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1;
  const isAuthed = () => { try { return sessionStorage.getItem(AUTH) === '1'; } catch { return false; } };
  function needAuth() { if (!isAuthed()) { const e = new Error('Avval tizimga kiring'); e.status = 401; throw e; } }
  const err = (m, status) => { const e = new Error(m); e.status = status || 400; return e; };
  const findPromo = (code) => (db.promos || []).find((p) => p.code === String(code || '').trim().toUpperCase()) || null;

  function fileToDataUrl(file, maxW) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, (maxW || 900) / img.naturalWidth);
        const c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        let out = c.toDataURL('image/webp', 0.8);
        if (out.indexOf('data:image/webp') !== 0) out = c.toDataURL('image/jpeg', 0.8);
        resolve(out);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Rasmni oʻqib boʻlmadi')); };
      img.src = url;
    });
  }
  function publicCatalog(d) {
    return {
      settings: d.settings,
      categories: [...d.categories].sort((a, b) => (a.sort || 0) - (b.sort || 0)),
      products: d.products.filter((p) => p.active !== false).sort((a, b) => (b.created || 0) - (a.created || 0)),
      reels: d.reels.filter((r) => r.active !== false),
      payments: { payme: false, click: false },
    };
  }
  function newCode() { for (;;) { const c = 'UP' + (10000 + Math.floor(Math.random() * 90000)); if (!db.orders.some((o) => o.code === c)) return c; } }

  const demo = {
    async catalog() { return publicCatalog(await loadDemo()); },
    async promo(code, subtotal) {
      await loadDemo(); const p = findPromo(code); const r = SH.applyPromo(p, subtotal);
      if (r.error) throw err(r.error); return { code: p.code, discount: r.discount, kind: p.kind, value: p.value };
    },
    async order(input) {
      const d = await loadDemo();
      const priced = SH.priceOrder({ input, settings: d.settings, getProduct: (id) => d.products.find((p) => p.id === id), findPromo });
      if (priced.error) throw err(priced.error);
      const now = Date.now();
      const order = Object.assign(priced.order, { id: nextId(d.orders), code: newCode(), payment: 'cash', status: 'new', created: now, lang: input.lang || 'uz', history: [{ status: 'new', at: now }] });
      order.items.forEach((i) => { const p = d.products.find((x) => x.id === i.id); if (p && p.stock != null) p.stock = Math.max(0, p.stock - i.qty); });
      if (order.promo) { const pr = findPromo(order.promo); pr.uses = (pr.uses || 0) + 1; }
      d.orders.unshift(order); persist();
      return { id: order.id, code: order.code, total: order.total, status: order.status, payUrl: null };
    },
    async track(code, phone) {
      const d = await loadDemo();
      const o = d.orders.find((x) => x.code === String(code || '').trim().toUpperCase());
      if (!o || o.phone !== normPhone(phone)) throw err('Buyurtma topilmadi. Raqam va telefonni tekshiring', 404);
      return o;
    },
    async request(input) {
      const d = await loadDemo();
      const name = clean(input.name, 80), phone = normPhone(input.phone);
      const title = clean(input.title, 120), description = clean(input.description, 3000);
      if (name.length < 2) throw err('Ismingizni yozing');
      if (!phone) throw err('Telefon raqamni toʻgʻri yozing');
      if (title.length < 3) throw err('Nima kerakligini qisqa yozing');
      if (description.length < 10) throw err('Tushuntirishni kamida 10 belgi bilan yozing');
      const files = [];
      for (const f of (input.files || []).slice(0, 5)) {
        if (/^image\//.test(f.type)) { try { files.push({ name: f.name, url: await fileToDataUrl(f, 640) }); continue; } catch { /* rasm emas */ } }
        files.push({ name: f.name, url: '' });
      }
      const r = { id: nextId(d.requests), name, phone, title, description, link: clean(input.link, 300), qty: clean(input.qty, 20), files, status: 'new', reply: '', created: Date.now() };
      d.requests.unshift(r); persist();
      return { id: r.id };
    },
    admin: {
      async login(pw) { if (pw !== DEMO_PASSWORD) throw err('Parol notoʻgʻri', 401); try { sessionStorage.setItem(AUTH, '1'); } catch { /* yopiq */ } return { ok: true }; },
      async logout() { try { sessionStorage.removeItem(AUTH); } catch { /* yopiq */ } },
      async me() { return isAuthed() ? { ok: true } : null; },
      async all() { needAuth(); const d = JSON.parse(JSON.stringify(await loadDemo())); d.payments = { payme: false, click: false }; d.telegram = false; return d; },
      async saveProduct(p) {
        needAuth(); const d = await loadDemo();
        if (p.id) { const i = d.products.findIndex((x) => x.id === p.id); if (i < 0) throw err('Mahsulot topilmadi'); d.products[i] = Object.assign({}, d.products[i], p); p = d.products[i]; }
        else { p = Object.assign({ created: Date.now(), active: true, stock: null }, p, { id: nextId(d.products) }); d.products.push(p); }
        persist(); return p;
      },
      async deleteProduct(id) { needAuth(); const d = await loadDemo(); d.products = d.products.filter((x) => x.id !== id); persist(); },
      async saveCategories(list) { needAuth(); const d = await loadDemo(); d.categories = list.map((c, i) => Object.assign({}, c, { sort: i + 1 })); persist(); return d.categories; },
      async saveReel(r) {
        needAuth(); const d = await loadDemo();
        if (r.id) { const i = d.reels.findIndex((x) => x.id === r.id); d.reels[i] = Object.assign({}, d.reels[i], r); }
        else { r = Object.assign({ active: true }, r, { id: nextId(d.reels) }); d.reels.unshift(r); }
        persist(); return r;
      },
      async deleteReel(id) { needAuth(); const d = await loadDemo(); d.reels = d.reels.filter((x) => x.id !== id); persist(); },
      async moveReel(id, dir) {
        needAuth(); const d = await loadDemo(); const i = d.reels.findIndex((x) => x.id === id), j = i + dir;
        if (i < 0 || j < 0 || j >= d.reels.length) return; [d.reels[i], d.reels[j]] = [d.reels[j], d.reels[i]]; persist();
      },
      async savePromo(p) {
        needAuth(); const d = await loadDemo();
        const code = clean(p.code, 30).toUpperCase().replace(/[^A-Z0-9_-]/g, '');
        if (code.length < 3) throw err('Promokod kamida 3 belgi boʻlsin');
        if (!p.value || (p.kind !== 'sum' && p.value > 90)) throw err('Chegirma qiymatini toʻgʻri kiriting (foiz 1–90)');
        const dup = d.promos.find((x) => x.code === code && x.id !== p.id); if (dup) throw err('Bunday promokod bor');
        if (p.id) { const i = d.promos.findIndex((x) => x.id === p.id); d.promos[i] = Object.assign({}, d.promos[i], p, { code }); persist(); return d.promos[i]; }
        const n = Object.assign({ uses: 0, active: true }, p, { code, id: nextId(d.promos) }); d.promos.unshift(n); persist(); return n;
      },
      async deletePromo(id) { needAuth(); const d = await loadDemo(); d.promos = d.promos.filter((x) => x.id !== id); persist(); },
      async setOrder(id, patch) {
        needAuth(); const d = await loadDemo(); const o = d.orders.find((x) => x.id === id);
        if (patch.status && patch.status !== o.status) {
          if (patch.status === 'cancelled' && !o.stockReturned) { o.items.forEach((i) => { const p = d.products.find((x) => x.id === i.id); if (p && p.stock != null) p.stock += i.qty; }); o.stockReturned = true; }
          o.status = patch.status; o.history = (o.history || []).concat({ status: patch.status, at: Date.now() });
        }
        if ('adminNote' in patch) o.adminNote = patch.adminNote;
        persist(); return o;
      },
      async deleteOrder(id) { needAuth(); const d = await loadDemo(); d.orders = d.orders.filter((x) => x.id !== id); persist(); },
      async setRequest(id, patch) { needAuth(); const d = await loadDemo(); const r = d.requests.find((x) => x.id === id); Object.assign(r, patch); persist(); return r; },
      async deleteRequest(id) { needAuth(); const d = await loadDemo(); d.requests = d.requests.filter((x) => x.id !== id); persist(); },
      async saveSettings(s) { needAuth(); const d = await loadDemo(); d.settings = Object.assign({}, d.settings, s); persist(); return d.settings; },
      async upload(file) { needAuth(); return { url: await fileToDataUrl(file, 1000) }; },
      async ordersCsv() { needAuth(); const d = await loadDemo(); return SH.ordersCsv(d.orders); },
      async reset() { localStorage.removeItem(KEY); db = null; await loadDemo(); },
    },
  };

  const server = {
    catalog: () => http('GET', 'api/catalog'),
    promo: (code, subtotal) => http('POST', 'api/promo', { code, subtotal }),
    order: (input) => http('POST', 'api/orders', input),
    track: (code, phone) => http('GET', `api/track?code=${encodeURIComponent(code)}&phone=${encodeURIComponent(phone)}`),
    request(input) {
      const fd = new FormData();
      ['name', 'phone', 'title', 'description', 'link', 'qty'].forEach((k) => fd.append(k, input[k] || ''));
      (input.files || []).forEach((f) => fd.append('files', f));
      return http('POST', 'api/requests', fd);
    },
    admin: {
      login: (password) => http('POST', 'api/admin/login', { password }),
      logout: () => http('POST', 'api/admin/logout'),
      me: () => http('GET', 'api/admin/me').catch(() => null),
      all: () => http('GET', 'api/admin/data'),
      saveProduct: (p) => (p.id ? http('PUT', 'api/admin/products/' + p.id, p) : http('POST', 'api/admin/products', p)),
      deleteProduct: (id) => http('DELETE', 'api/admin/products/' + id),
      saveCategories: (list) => http('PUT', 'api/admin/categories', list),
      saveReel: (r) => (r.id ? http('PUT', 'api/admin/reels/' + r.id, r) : http('POST', 'api/admin/reels', r)),
      deleteReel: (id) => http('DELETE', 'api/admin/reels/' + id),
      moveReel: (id, dir) => http('POST', `api/admin/reels/${id}/move`, { dir }),
      savePromo: (p) => (p.id ? http('PUT', 'api/admin/promos/' + p.id, p) : http('POST', 'api/admin/promos', p)),
      deletePromo: (id) => http('DELETE', 'api/admin/promos/' + id),
      setOrder: (id, patch) => http('PATCH', 'api/admin/orders/' + id, patch),
      deleteOrder: (id) => http('DELETE', 'api/admin/orders/' + id),
      setRequest: (id, patch) => http('PATCH', 'api/admin/requests/' + id, patch),
      deleteRequest: (id) => http('DELETE', 'api/admin/requests/' + id),
      saveSettings: (s) => http('PUT', 'api/admin/settings', s),
      upload(file) { const fd = new FormData(); fd.append('file', file); return http('POST', 'api/admin/upload', fd); },
      async ordersCsv() { const r = await fetch('api/admin/orders.csv', { credentials: 'same-origin' }); if (!r.ok) throw new Error('Yuklab boʻlmadi'); return (await r.text()).replace(/^﻿/, ''); },
    },
  };

  async function detect() {
    if (mode) return mode;
    if (location.protocol === 'file:' || /\.github\.io$/.test(location.hostname)) return (mode = 'demo');
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 1800);
      const r = await fetch('api/health', { signal: ctl.signal, cache: 'no-store' }); clearTimeout(t);
      const j = r.ok ? await r.json() : null;
      mode = j && j.ok ? 'server' : 'demo';
    } catch { mode = 'demo'; }
    return mode;
  }
  const impl = () => (mode === 'server' ? server : demo);

  function reelCode(input) {
    const s = String(input || '').trim();
    const m = s.match(/instagram\.com\/(?:[\w.]+\/)?(?:reel|reels|p|tv)\/([\w-]{5,})/i);
    if (m) return m[1];
    return /^[\w-]{5,}$/.test(s) ? s : null;
  }

  return {
    detect,
    get mode() { return mode; },
    catalog: async () => { await detect(); return impl().catalog(); },
    promo: async (c, s) => { await detect(); return impl().promo(c, s); },
    order: async (x) => { await detect(); return impl().order(x); },
    track: async (c, p) => { await detect(); return impl().track(c, p); },
    request: async (x) => { await detect(); return impl().request(x); },
    admin: new Proxy({}, { get: (_, k) => async (...a) => { await detect(); const f = impl().admin[k]; if (typeof f !== 'function') throw new Error('Bu amal faqat demo rejimda'); return f(...a); } }),
    ORDER_STATUS: SH.ORDER_STATUS, REQUEST_STATUS: SH.REQUEST_STATUS, BADGES: SH.BADGES,
    normPhone: SH.normPhone, fmtPhone: SH.fmtPhone, money: SH.money, reelCode, DEMO_PASSWORD,
  };
})();
