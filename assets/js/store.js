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
    // Har safar xotiradan o'qiymiz: admin boshqa oynada o'zgartirsa, do'kon darhol ko'radi
    try { const fresh = JSON.parse(localStorage.getItem(KEY) || 'null'); if (fresh) db = fresh; } catch { /* yopiq */ }
    if (!db) { db = await fetch('data/seed.json', { cache: 'no-store' }).then((r) => r.json()); db.orders = db.orders || []; db.requests = db.requests || []; db.promos = db.promos || []; persist(); }
    ['reviews', 'staff', 'audit'].forEach((k) => { db[k] = db[k] || []; });
    return db;
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch { throw new Error('Brauzer xotirasi toʻldi. Kichikroq rasm yuklang yoki demo maʼlumotni tiklang'); }
  }
  const nextId = (list) => list.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1;
  /* Demo sessiya: "owner" yoki "s<id>:<versiya>" sessionStorage'da */
  const OWNER = { id: 'owner', name: 'Egasi', role: 'owner', login: 'admin' };
  function sessionUser() {
    let v = ''; try { v = sessionStorage.getItem(AUTH) || ''; } catch { return null; }
    if (v === 'owner' || v === '1') return OWNER;
    const m = /^s(\d+):(\d+)$/.exec(v); if (!m || !db) return null;
    const u = (db.staff || []).find((x) => x.id === Number(m[1]));
    return u && u.active !== false && (u.ver || 0) === Number(m[2]) ? { id: u.id, name: u.name, role: u.role, login: u.login } : null;
  }
  let user = null;
  function needAuth(mod) {
    user = sessionUser();
    if (!user) { const e = new Error('Avval tizimga kiring'); e.status = 401; throw e; }
    if (mod && !SH.can(user.role, mod)) { const e = new Error('Bu boʻlim uchun ruxsatingiz yoʻq'); e.status = 403; throw e; }
  }
  function audit(action, note) {
    if (!user) return;
    db.audit = [{ id: nextId(db.audit || []), at: Date.now(), user: user.name, role: user.role, action, note: clean(note || '', 200) }].concat(db.audit || []).slice(0, 500);
  }
  async function sha(s) {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
  }
  const publicStaff = (u) => ({ id: u.id, login: u.login, name: u.name, role: u.role, active: u.active !== false, created: u.created, lastLogin: u.lastLogin || 0 });
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
      ratings: SH.ratings(d.reviews || []),
      reviews: (d.reviews || []).filter((r) => r.status === 'approved').slice(0, 300).map(SH.publicReview),
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
      return SH.publicOrder(o);
    },
    async message(code, phone, text) {
      const d = await loadDemo();
      const o = d.orders.find((x) => x.code === String(code || '').trim().toUpperCase());
      if (!o || o.phone !== normPhone(phone)) throw err('Buyurtma topilmadi. Raqam va telefonni tekshiring', 404);
      const r = SH.addMessage(o, 'customer', text); if (r.error) throw err(r.error);
      persist(); return SH.publicOrder(o);
    },
    async review(input) {
      const d = await loadDemo();
      const o = d.orders.find((x) => x.code === String(input.code || '').trim().toUpperCase());
      const r = SH.checkReview({ order: o, phone: input.phone, productId: input.productId, rating: input.rating, text: input.text, name: input.name });
      if (r.error) throw err(r.error);
      const rv = Object.assign(r.review, { id: nextId(d.reviews) });
      d.reviews.unshift(rv); o.reviewed = (o.reviewed || []).concat(rv.productId); persist();
      return { id: rv.id, status: rv.status };
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
      async login(pw, login) {
        const d = await loadDemo(); login = clean(login || 'admin', 40).toLowerCase();
        let v;
        if (login === 'admin') { if (pw !== DEMO_PASSWORD) throw err('Login yoki parol notoʻgʻri', 401); v = 'owner'; user = OWNER; }
        else {
          const u = d.staff.find((x) => x.login === login);
          if (!u || u.active === false || u.hash !== await sha(u.salt + pw)) throw err('Login yoki parol notoʻgʻri', 401);
          u.lastLogin = Date.now(); v = `s${u.id}:${u.ver || 0}`; user = { id: u.id, name: u.name, role: u.role };
        }
        try { sessionStorage.setItem(AUTH, v); } catch { /* yopiq */ }
        audit('Kirish', 'Kirdi'); persist(); return { ok: true };
      },
      async logout() { try { sessionStorage.removeItem(AUTH); } catch { /* yopiq */ } },
      async me() { await loadDemo(); const u = sessionUser(); return u ? Object.assign({ ok: true, perms: SH.PERMS[u.role] }, u) : null; },
      async all() {
        await loadDemo(); needAuth();
        const d = JSON.parse(JSON.stringify(db)); d.payments = { payme: false, click: false }; d.telegram = false;
        d.me = Object.assign({ perms: SH.PERMS[user.role] }, user);
        if (!SH.can(user.role, 'promos')) delete d.promos;
        if (user.role === 'owner') d.staff = db.staff.map(publicStaff); else { delete d.staff; delete d.audit; }
        return d;
      },
      async reply(id, text) {
        await loadDemo(); needAuth('orders'); const o = db.orders.find((x) => x.id === id);
        const r = SH.addMessage(o, 'shop', text, user.name); if (r.error) throw err(r.error);
        audit('Mijozga yozildi', o.code); persist(); return o;
      },
      async setReview(id, patch) {
        await loadDemo(); needAuth('reviews'); const r = db.reviews.find((x) => x.id === id);
        if (patch.status) r.status = patch.status; if ('reply' in patch) r.reply = clean(patch.reply, 1000);
        audit('Sharh oʻzgardi', `${r.productTitle} (${r.rating}/5)${patch.status ? ' → ' + SH.REVIEW_STATUS[patch.status][0] : ''}`); persist(); return r;
      },
      async deleteReview(id) { await loadDemo(); needAuth('reviews'); db.reviews = db.reviews.filter((x) => x.id !== id); audit('Sharh oʻchirildi'); persist(); },
      async saveStaff(b) {
        await loadDemo(); needAuth('staff');
        const prev = b.id ? db.staff.find((x) => x.id === b.id) : null;
        const u = Object.assign({ active: true, ver: 0, role: 'operator' }, prev || {});
        if ('login' in b) u.login = clean(b.login, 30).toLowerCase();
        if ('name' in b) u.name = clean(b.name, 60);
        if ('role' in b) u.role = b.role === 'manager' ? 'manager' : 'operator';
        if ('active' in b) { u.active = !!b.active; u.ver = (u.ver || 0) + 1; }
        if (b.password) { if (String(b.password).length < 8) throw err('Parol kamida 8 belgi boʻlsin'); u.salt = Math.random().toString(36).slice(2); u.hash = await sha(u.salt + b.password); u.ver = (u.ver || 0) + 1; }
        if (!/^[a-z0-9._-]{3,30}$/.test(u.login || '') || u.login === 'admin') throw err('Login 3–30 ta lotin harf yoki raqam boʻlsin (“admin” emas)');
        if (!u.name || u.name.length < 2) throw err('Ismni yozing');
        if (!u.hash) throw err('Parol kiriting');
        if (db.staff.some((x) => x.login === u.login && x.id !== u.id)) throw err('Bunday login bor');
        if (prev) Object.assign(prev, u); else { u.id = nextId(db.staff); u.created = Date.now(); db.staff.push(u); }
        audit(prev ? 'Xodim tahrirlandi' : 'Xodim qoʻshildi', u.login); persist(); return publicStaff(prev || u);
      },
      async deleteStaff(id) { await loadDemo(); needAuth('staff'); const u = db.staff.find((x) => x.id === id); db.staff = db.staff.filter((x) => x.id !== id); audit('Xodim oʻchirildi', u && u.login); persist(); },
      async saveProduct(p) {
        const d = await loadDemo(); needAuth('products'); const isNew = !p.id;
        if (p.id) { const i = d.products.findIndex((x) => x.id === p.id); if (i < 0) throw err('Mahsulot topilmadi'); d.products[i] = Object.assign({}, d.products[i], p); p = d.products[i]; }
        else { p = Object.assign({ created: Date.now(), active: true, stock: null }, p, { id: nextId(d.products) }); d.products.push(p); }
        audit(isNew ? 'Mahsulot qoʻshildi' : 'Mahsulot tahrirlandi', p.title); persist(); return p;
      },
      async deleteProduct(id) { const d = await loadDemo(); needAuth('products'); d.products = d.products.filter((x) => x.id !== id); audit('Mahsulot oʻchirildi', ''); persist(); },
      async saveCategories(list) { const d = await loadDemo(); needAuth('categories'); d.categories = list.map((c, i) => Object.assign({}, c, { sort: i + 1 })); audit('Turkumlar saqlandi', ''); persist(); return d.categories; },
      async saveReel(r) {
        const d = await loadDemo(); needAuth('reels');
        if (r.id) { const i = d.reels.findIndex((x) => x.id === r.id); d.reels[i] = Object.assign({}, d.reels[i], r); }
        else { r = Object.assign({ active: true }, r, { id: nextId(d.reels) }); d.reels.unshift(r); }
        audit('Video saqlandi', r.title || r.code); persist(); return r;
      },
      async deleteReel(id) { const d = await loadDemo(); needAuth('reels'); d.reels = d.reels.filter((x) => x.id !== id); audit('Video oʻchirildi', ''); persist(); },
      async moveReel(id, dir) {
        const d = await loadDemo(); needAuth('reels'); const i = d.reels.findIndex((x) => x.id === id), j = i + dir;
        if (i < 0 || j < 0 || j >= d.reels.length) return; [d.reels[i], d.reels[j]] = [d.reels[j], d.reels[i]]; persist();
      },
      async savePromo(p) {
        const d = await loadDemo(); needAuth('promos');
        const code = clean(p.code, 30).toUpperCase().replace(/[^A-Z0-9_-]/g, '');
        if (code.length < 3) throw err('Promokod kamida 3 belgi boʻlsin');
        if (!p.value || (p.kind !== 'sum' && p.value > 90)) throw err('Chegirma qiymatini toʻgʻri kiriting (foiz 1–90)');
        const dup = d.promos.find((x) => x.code === code && x.id !== p.id); if (dup) throw err('Bunday promokod bor');
        if (p.id) { const i = d.promos.findIndex((x) => x.id === p.id); d.promos[i] = Object.assign({}, d.promos[i], p, { code }); audit('Promokod tahrirlandi', code); persist(); return d.promos[i]; }
        const n = Object.assign({ uses: 0, active: true }, p, { code, id: nextId(d.promos) }); d.promos.unshift(n); audit('Promokod qoʻshildi', code); persist(); return n;
      },
      async deletePromo(id) { const d = await loadDemo(); needAuth('promos'); d.promos = d.promos.filter((x) => x.id !== id); audit('Promokod oʻchirildi', ''); persist(); },
      async setOrder(id, patch) {
        const d = await loadDemo(); needAuth('orders'); const o = d.orders.find((x) => x.id === id);
        if (patch.status && patch.status !== o.status) {
          if (patch.status === 'cancelled' && !o.stockReturned) { o.items.forEach((i) => { const p = d.products.find((x) => x.id === i.id); if (p && p.stock != null) p.stock += i.qty; }); o.stockReturned = true; }
          o.status = patch.status; o.history = (o.history || []).concat({ status: patch.status, at: Date.now() });
        }
        if ('adminNote' in patch) o.adminNote = patch.adminNote;
        if (patch.read) o.unread = false;
        audit('Buyurtma oʻzgardi', o.code + (patch.status ? ' → ' + (SH.ORDER_STATUS[patch.status] || [patch.status])[0] : '')); persist(); return o;
      },
      async deleteOrder(id) { const d = await loadDemo(); needAuth('orders'); d.orders = d.orders.filter((x) => x.id !== id); audit('Buyurtma oʻchirildi', ''); persist(); },
      async setRequest(id, patch) { const d = await loadDemo(); needAuth('requests'); const r = d.requests.find((x) => x.id === id); Object.assign(r, patch); audit('Soʻrov oʻzgardi', '#' + id); persist(); return r; },
      async deleteRequest(id) { const d = await loadDemo(); needAuth('requests'); d.requests = d.requests.filter((x) => x.id !== id); audit('Soʻrov oʻchirildi', ''); persist(); },
      async saveSettings(s) { const d = await loadDemo(); needAuth('settings'); d.settings = Object.assign({}, d.settings, s); audit('Sozlamalar saqlandi', ''); persist(); return d.settings; },
      async upload(file) { await loadDemo(); needAuth('products'); return { url: await fileToDataUrl(file, 1000) }; },
      async ordersCsv() { const d = await loadDemo(); needAuth('orders'); return SH.ordersCsv(d.orders); },
      async reset() { localStorage.removeItem(KEY); db = null; await loadDemo(); },
    },
  };

  const server = {
    catalog: () => http('GET', 'api/catalog'),
    promo: (code, subtotal) => http('POST', 'api/promo', { code, subtotal }),
    order: (input) => http('POST', 'api/orders', input),
    track: (code, phone) => http('GET', `api/track?code=${encodeURIComponent(code)}&phone=${encodeURIComponent(phone)}`),
    message: (code, phone, text) => http('POST', 'api/messages', { code, phone, text }),
    review: (input) => http('POST', 'api/reviews', input),
    request(input) {
      const fd = new FormData();
      ['name', 'phone', 'title', 'description', 'link', 'qty'].forEach((k) => fd.append(k, input[k] || ''));
      (input.files || []).forEach((f) => fd.append('files', f));
      return http('POST', 'api/requests', fd);
    },
    admin: {
      login: (password, login) => http('POST', 'api/admin/login', { password, login }),
      reply: (id, text) => http('POST', `api/admin/orders/${id}/messages`, { text }),
      setReview: (id, patch) => http('PATCH', 'api/admin/reviews/' + id, patch),
      deleteReview: (id) => http('DELETE', 'api/admin/reviews/' + id),
      saveStaff: (u) => (u.id ? http('PUT', 'api/admin/staff/' + u.id, u) : http('POST', 'api/admin/staff', u)),
      deleteStaff: (id) => http('DELETE', 'api/admin/staff/' + id),
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
    message: async (c, p, t) => { await detect(); return impl().message(c, p, t); },
    review: async (x) => { await detect(); return impl().review(x); },
    request: async (x) => { await detect(); return impl().request(x); },
    admin: new Proxy({}, { get: (_, k) => async (...a) => { await detect(); const f = impl().admin[k]; if (typeof f !== 'function') throw new Error('Bu amal faqat demo rejimda'); return f(...a); } }),
    ORDER_STATUS: SH.ORDER_STATUS, REQUEST_STATUS: SH.REQUEST_STATUS, BADGES: SH.BADGES, REVIEW_STATUS: SH.REVIEW_STATUS, ROLES: SH.ROLES, can: SH.can,
    colorHex: SH.colorHex, colorLabel: SH.colorLabel,
    normPhone: SH.normPhone, fmtPhone: SH.fmtPhone, money: SH.money, reelCode, DEMO_PASSWORD,
  };
})();
