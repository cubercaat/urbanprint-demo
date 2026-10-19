'use strict';
/* Ma'lumot qatlami.
   Server ishlayotgan bo'lsa (api/health javob bersa) hamma narsa serverga yoziladi.
   Statik hostingda (GitHub Pages) esa "demo rejim": ma'lumot shu brauzerning localStorage'ida saqlanadi,
   shuning uchun admin paneldagi o'zgarishlar shu brauzerdagi do'kon sahifasida darhol ko'rinadi. */
window.Store = (function () {
  const KEY = 'up_db_v2';
  const AUTH = 'up_admin_demo';
  const DEMO_PASSWORD = 'admin';
  let mode = null;
  let db = null;

  const ORDER_STATUS = {
    new: ['Yangi', 'warn'],
    confirmed: ['Tasdiqlandi', 'info'],
    printing: ['Chop etilmoqda', 'info'],
    shipped: ['Yoʻlda', 'info'],
    done: ['Yetkazildi', 'ok'],
    cancelled: ['Bekor qilindi', 'bad'],
  };
  const REQUEST_STATUS = {
    new: ['Yangi', 'warn'],
    quoted: ['Narx aytildi', 'info'],
    accepted: ['Qabul qilindi', 'ok'],
    done: ['Bajarildi', 'ok'],
    rejected: ['Rad etildi', 'bad'],
  };
  const BADGES = { new: 'Yangi', hit: 'Xit', sale: 'Chegirma', custom: 'Buyurtma asosida' };

  function normPhone(p) {
    let d = String(p || '').replace(/\D/g, '');
    if (d.length === 9) d = '998' + d;
    return /^998\d{9}$/.test(d) ? d : null;
  }
  function fmtPhone(d) {
    d = String(d || '').replace(/\D/g, '');
    if (d.length !== 12) return d ? '+' + d : '';
    return `+${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10, 12)}`;
  }
  const money = (n) => new Intl.NumberFormat('ru-RU').format(Math.round(n || 0)).replace(/ | /g, ' ') + ' soʻm';
  const clean = (s, max) => String(s == null ? '' : s).trim().slice(0, max || 500);

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
    if (!db) { db = await fetch('data/seed.json', { cache: 'no-store' }).then((r) => r.json()); persist(); }
    return db;
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch { throw new Error('Brauzer xotirasi toʻldi. Kichikroq rasm yuklang yoki demo maʼlumotni tozalang'); }
  }
  const nextId = (list) => list.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1;
  const isAuthed = () => { try { return sessionStorage.getItem(AUTH) === '1'; } catch { return false; } };
  function needAuth() { if (!isAuthed()) { const e = new Error('Avval tizimga kiring'); e.status = 401; throw e; } }

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
    };
  }
  function validateOrder(d, input) {
    const name = clean(input.name, 80), phone = normPhone(input.phone), address = clean(input.address, 400), note = clean(input.note, 600);
    if (name.length < 2) throw new Error('Ismingizni yozing');
    if (!phone) throw new Error('Telefon raqamni toʻgʻri yozing, masalan 90 123 45 67');
    if (address.length < 5) throw new Error('Yetkazib berish manzilini yozing');
    const items = [];
    for (const it of input.items || []) {
      const p = d.products.find((x) => x.id === Number(it.id) && x.active !== false);
      const qty = Math.max(1, Math.min(999, parseInt(it.qty, 10) || 1));
      if (p) items.push({ id: p.id, title: p.title, price: p.price, qty, color: clean(it.color, 40) });
    }
    if (!items.length) throw new Error('Savat boʻsh');
    const total = items.reduce((s, i) => s + i.price * i.qty, 0);
    return { name, phone, address, note, items, total };
  }

  const demo = {
    async catalog() { return publicCatalog(await loadDemo()); },
    async order(input) {
      const d = await loadDemo();
      const o = validateOrder(d, input);
      const order = Object.assign({ id: nextId(d.orders), status: 'new', created: Date.now() }, o);
      d.orders.unshift(order); persist();
      return { id: order.id, total: order.total };
    },
    async request(input) {
      const d = await loadDemo();
      const name = clean(input.name, 80), phone = normPhone(input.phone);
      const title = clean(input.title, 120), description = clean(input.description, 3000);
      if (name.length < 2) throw new Error('Ismingizni yozing');
      if (!phone) throw new Error('Telefon raqamni toʻgʻri yozing');
      if (title.length < 3) throw new Error('Nima kerakligini qisqa yozing');
      if (description.length < 10) throw new Error('Tushuntirishni kamida 10 belgi bilan yozing');
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
      demoPassword: DEMO_PASSWORD,
      async login(pw) {
        if (pw !== DEMO_PASSWORD) throw new Error('Parol notoʻgʻri');
        try { sessionStorage.setItem(AUTH, '1'); } catch { /* yopiq */ }
        return { ok: true };
      },
      async logout() { try { sessionStorage.removeItem(AUTH); } catch { /* yopiq */ } },
      async me() { return isAuthed() ? { ok: true } : null; },
      async all() { needAuth(); return JSON.parse(JSON.stringify(await loadDemo())); },
      async saveProduct(p) {
        needAuth(); const d = await loadDemo();
        if (p.id) { const i = d.products.findIndex((x) => x.id === p.id); if (i < 0) throw new Error('Mahsulot topilmadi'); d.products[i] = Object.assign({}, d.products[i], p); }
        else { p = Object.assign({ created: Date.now(), active: true, stock: true }, p, { id: nextId(d.products) }); d.products.push(p); }
        persist(); return p;
      },
      async deleteProduct(id) { needAuth(); const d = await loadDemo(); d.products = d.products.filter((x) => x.id !== id); persist(); },
      async saveCategories(list) { needAuth(); const d = await loadDemo(); d.categories = list; persist(); return list; },
      async saveReel(r) {
        needAuth(); const d = await loadDemo();
        if (r.id) { const i = d.reels.findIndex((x) => x.id === r.id); d.reels[i] = Object.assign({}, d.reels[i], r); }
        else { r = Object.assign({ active: true }, r, { id: nextId(d.reels) }); d.reels.unshift(r); }
        persist(); return r;
      },
      async deleteReel(id) { needAuth(); const d = await loadDemo(); d.reels = d.reels.filter((x) => x.id !== id); persist(); },
      async moveReel(id, dir) {
        needAuth(); const d = await loadDemo(); const i = d.reels.findIndex((x) => x.id === id); const j = i + dir;
        if (i < 0 || j < 0 || j >= d.reels.length) return; [d.reels[i], d.reels[j]] = [d.reels[j], d.reels[i]]; persist();
      },
      async setOrder(id, patch) { needAuth(); const d = await loadDemo(); const o = d.orders.find((x) => x.id === id); Object.assign(o, patch); persist(); return o; },
      async deleteOrder(id) { needAuth(); const d = await loadDemo(); d.orders = d.orders.filter((x) => x.id !== id); persist(); },
      async setRequest(id, patch) { needAuth(); const d = await loadDemo(); const r = d.requests.find((x) => x.id === id); Object.assign(r, patch); persist(); return r; },
      async deleteRequest(id) { needAuth(); const d = await loadDemo(); d.requests = d.requests.filter((x) => x.id !== id); persist(); },
      async saveSettings(s) { needAuth(); const d = await loadDemo(); d.settings = Object.assign({}, d.settings, s); persist(); return d.settings; },
      async upload(file) { needAuth(); return { url: await fileToDataUrl(file, 1000) }; },
      async reset() { localStorage.removeItem(KEY); db = null; await loadDemo(); },
    },
  };

  const server = {
    catalog: () => http('GET', 'api/catalog'),
    order: (input) => http('POST', 'api/orders', input),
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
      setOrder: (id, patch) => http('PATCH', 'api/admin/orders/' + id, patch),
      deleteOrder: (id) => http('DELETE', 'api/admin/orders/' + id),
      setRequest: (id, patch) => http('PATCH', 'api/admin/requests/' + id, patch),
      deleteRequest: (id) => http('DELETE', 'api/admin/requests/' + id),
      saveSettings: (s) => http('PUT', 'api/admin/settings', s),
      upload(file) { const fd = new FormData(); fd.append('file', file); return http('POST', 'api/admin/upload', fd); },
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

  /* Instagram havolasidan post kodini ajratib oladi */
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
    order: async (x) => { await detect(); return impl().order(x); },
    request: async (x) => { await detect(); return impl().request(x); },
    admin: new Proxy({}, { get: (_, k) => async (...a) => { await detect(); const f = impl().admin[k]; if (typeof f !== 'function') throw new Error('Bu amal faqat demo rejimda'); return f(...a); } }),
    ORDER_STATUS, REQUEST_STATUS, BADGES, normPhone, fmtPhone, money, reelCode, DEMO_PASSWORD,
  };
})();
