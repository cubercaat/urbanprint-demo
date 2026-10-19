'use strict';
(function () {
  const { h, toast, modal, confirmBox, date } = UI;
  const { money, fmtPhone, ORDER_STATUS, REQUEST_STATUS, BADGES, reelCode } = Store;
  const A = Store.admin;
  const app = document.getElementById('app');
  let data = null;

  const IC = {
    dash: '<path d="M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z"/>',
    orders: '<path d="M6 7h12l-1 12H7z"/><path d="M9 7a3 3 0 0 1 6 0"/>',
    requests: '<path d="M4 5h16v11H8l-4 4z"/>',
    products: '<path d="M12 3 21 8v8l-9 5-9-5V8z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
    categories: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>',
    reels: '<rect x="3" y="3" width="18" height="18" rx="5"/><path d="m10 8.5 5 3.5-5 3.5z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 13.6H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10.4 3V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  };
  const icon = (k, s) => `<svg width="${s || 20}" height="${s || 20}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${IC[k]}</svg>`;
  const TABS = [['dash', 'Bosh sahifa'], ['orders', 'Buyurtmalar'], ['requests', 'Soʻrovlar'], ['products', 'Mahsulotlar'], ['categories', 'Turkumlar'], ['reels', 'Instagram videolari'], ['settings', 'Sozlamalar']];
  const st = (map, k) => { const [t, c] = map[k] || [k, '']; return h('span', { class: 'st ' + c, text: t }); };
  const catName = (id) => ((data.categories.find((c) => c.id === id) || {}).name || id);
  const run = async (fn, okMsg) => { try { const r = await fn(); if (okMsg) toast(okMsg); return r; } catch (e) { if (e.status === 401) { showLogin(); } toast(e.message, true); throw e; } };
  async function reload() { data = await A.all(); }

  /* ---------- Kirish ---------- */
  function showLogin() {
    side = null;
    const pw = h('input', { class: 'input', type: 'password', id: 'pw', autocomplete: 'current-password', autofocus: true });
    const err = h('p', { class: 'form-error', role: 'alert' });
    const btn = h('button', { class: 'btn btn-wide', type: 'submit', text: 'Kirish' });
    const form = h('form', { class: 'login-card', novalidate: true },
      h('a', { class: 'logo', href: './', html: '<svg width="34" height="34" viewBox="0 0 40 40"><path d="M20 3 36 12v16L20 37 4 28V12z" fill="#F5892A"/><path d="M20 3 36 12 20 21 4 12z" fill="#FFB067"/><path d="M20 21v16L4 28V12z" fill="#C96A14"/></svg><span><b>3D</b> UrbanPrint</span>' }),
      h('h1', { text: 'Admin panelga kirish' }),
      Store.mode === 'demo' ? h('div', { class: 'demo-note', html: `Demo rejim. Parol: <b>${Store.DEMO_PASSWORD}</b>. Oʻzgarishlar faqat shu brauzerda saqlanadi va doʻkon sahifasida darhol koʻrinadi.` }) : null,
      h('div', { class: 'field' }, h('label', { for: 'pw', text: 'Parol' }), pw), err, btn);
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); err.textContent = ''; btn.disabled = true;
      try { await A.login(pw.value); await boot(); } catch (ex) { err.textContent = ex.message; btn.disabled = false; pw.select(); }
    });
    app.className = ''; app.replaceChildren(h('div', { class: 'login' }, form)); pw.focus();
  }

  /* ---------- Karkas ---------- */
  let side, title, content, topActions;
  function shell() {
    side = h('aside', { class: 'side' });
    title = h('h1'); topActions = h('div', { class: 'top-actions' }); content = h('div', { class: 'content' });
    const burger = h('button', { class: 'icon-btn burger', type: 'button', 'aria-label': 'Menyu', text: '☰', onclick: () => side.classList.toggle('open') });
    app.className = '';
    app.replaceChildren(h('div', { class: 'shell' }, side, h('div', { class: 'main' },
      h('header', { class: 'top' }, h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px' } }, burger, title), topActions), content)));
    if (!shell.bound) { addEventListener('hashchange', () => { if (side) route(); }); shell.bound = true; }
  }
  function renderSide(cur) {
    const newOrders = data.orders.filter((o) => o.status === 'new').length;
    const newReq = data.requests.filter((r) => r.status === 'new').length;
    side.replaceChildren(
      h('a', { class: 'logo', href: './', target: '_blank', html: '<svg width="30" height="30" viewBox="0 0 40 40"><path d="M20 3 36 12v16L20 37 4 28V12z" fill="#F5892A"/><path d="M20 3 36 12 20 21 4 12z" fill="#FFB067"/><path d="M20 21v16L4 28V12z" fill="#C96A14"/></svg><span><b>3D</b> UrbanPrint</span>' }),
      ...TABS.map(([k, name]) => h('a', { class: 'tab' + (k === cur ? ' on' : ''), href: '#' + k, onclick: () => side.classList.remove('open') },
        h('span', { html: icon(k) }), name,
        k === 'orders' && newOrders ? h('span', { class: 'cnt', text: newOrders }) : null,
        k === 'requests' && newReq ? h('span', { class: 'cnt', text: newReq }) : null)),
      h('div', { class: 'side-foot' },
        h('span', { class: 'mode-pill' + (Store.mode === 'demo' ? ' demo' : '') }, h('i'), Store.mode === 'demo' ? 'Demo rejim (brauzerda)' : 'Server ulangan'),
        h('a', { class: 'btn btn-ghost btn-sm', href: './', target: '_blank', text: 'Saytni ochish' }),
        h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Chiqish', onclick: async () => { await A.logout(); showLogin(); } })));
  }
  async function route() {
    const k = (location.hash || '#dash').slice(1);
    const tab = TABS.find((t) => t[0] === k) ? k : 'dash';
    try { await reload(); } catch (e) { if (e.status === 401) return showLogin(); toast(e.message, true); return; }
    renderSide(tab);
    title.textContent = TABS.find((t) => t[0] === tab)[1];
    topActions.replaceChildren(); content.replaceChildren();
    VIEWS[tab]();
    window.scrollTo(0, 0);
  }
  const refresh = () => route();

  /* ---------- Bosh sahifa ---------- */
  function viewDash() {
    const o = data.orders, active = o.filter((x) => x.status !== 'cancelled');
    const revenue = o.filter((x) => x.status === 'done').reduce((s, x) => s + x.total, 0);
    const pending = active.filter((x) => x.status !== 'done').reduce((s, x) => s + x.total, 0);
    const days = [...Array(14)].map((_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - 13 + i); return d; });
    const counts = days.map((d) => o.filter((x) => x.created >= +d && x.created < +d + 864e5).length);
    const max = Math.max(1, ...counts);
    content.append(
      h('div', { class: 'kpis' },
        h('div', { class: 'kpi' }, h('span', { text: 'Yangi buyurtmalar' }), h('b', { text: o.filter((x) => x.status === 'new').length }), h('small', { text: `jami ${o.length} ta` })),
        h('div', { class: 'kpi' }, h('span', { text: 'Yetkazilgan tushum' }), h('b', { text: money(revenue) }), h('small', { text: `jarayonda: ${money(pending)}` })),
        h('div', { class: 'kpi' }, h('span', { text: 'Yangi soʻrovlar' }), h('b', { text: data.requests.filter((x) => x.status === 'new').length }), h('small', { text: `jami ${data.requests.length} ta` })),
        h('div', { class: 'kpi' }, h('span', { text: 'Saytdagi mahsulotlar' }), h('b', { text: data.products.filter((p) => p.active !== false).length }), h('small', { text: `${data.categories.length} turkum · ${data.reels.length} video` }))),
      h('div', { class: 'grid-dash' },
        h('div', { class: 'box' }, h('div', { class: 'box-head' }, h('h2', { text: 'Soʻnggi 14 kunda buyurtmalar' })),
          h('div', { class: 'bars' }, counts.map((n) => h('div', { class: n ? '' : 'zero', 'data-n': n, style: { height: (n / max) * 100 + '%' } }))),
          h('div', { class: 'bar-labels' }, days.map((d) => h('span', { text: d.getDate() })))),
        h('div', { class: 'box' }, h('div', { class: 'box-head' }, h('h2', { text: 'Soʻnggi buyurtmalar' }), h('a', { class: 'btn btn-ghost btn-sm', href: '#orders', text: 'Hammasi' })),
          o.length ? h('div', { class: 'list' }, o.slice(0, 5).map((x) => h('a', { href: '#orders', class: 'row', style: { gridTemplateColumns: '50px minmax(0,1fr) auto' } },
            h('span', { class: 'id', text: '#' + x.id }), h('div', {}, h('strong', { text: x.name }), h('small', { text: money(x.total) + ' · ' + date(x.created) })), st(ORDER_STATUS, x.status))))
            : h('div', { class: 'empty-sm', text: 'Hozircha buyurtma yoʻq. Saytdan sinov buyurtmasi berib koʻring.' }))),
      Store.mode === 'demo' ? h('div', { class: 'box' }, h('div', { class: 'box-head' }, h('h2', { text: 'Demo rejim haqida' })),
        h('p', { class: 'muted', text: 'Bu nusxa statik hostingda ishlayapti, shuning uchun barcha maʼlumot shu brauzer xotirasida saqlanadi. Server (server/server.js) ishga tushirilganda xuddi shu panel haqiqiy bazaga yozadi, rasm yuklaydi va yangi buyurtmalarni Telegramga yuboradi.' })) : null);
  }

  /* ---------- Buyurtmalar ---------- */
  let orderFilter = 'all';
  function viewOrders() {
    const filters = h('div', { class: 'filters' }, [['all', 'Hammasi']].concat(Object.entries(ORDER_STATUS).map(([k, v]) => [k, v[0]])).map(([k, n]) => {
      const c = k === 'all' ? data.orders.length : data.orders.filter((o) => o.status === k).length;
      return h('button', { class: 'chip', type: 'button', 'aria-pressed': String(k === orderFilter), onclick: () => { orderFilter = k; refresh(); } }, n, h('small', { text: c }));
    }));
    const list = data.orders.filter((o) => orderFilter === 'all' || o.status === orderFilter);
    content.append(filters, list.length ? h('div', { class: 'list' }, list.map(orderRow)) : h('div', { class: 'empty-sm', text: 'Bu holatda buyurtma yoʻq' }));
  }
  function orderRow(o) {
    const sel = h('select', { class: 'select', 'aria-label': 'Holat', onclick: (e) => e.stopPropagation() }, Object.entries(ORDER_STATUS).map(([k, v]) => h('option', { value: k, text: v[0], selected: k === o.status })));
    sel.addEventListener('change', () => run(() => A.setOrder(o.id, { status: sel.value }), 'Holat oʻzgardi').then(refresh));
    const detail = h('div', { class: 'row-detail', hidden: true, onclick: (e) => e.stopPropagation() },
      h('div', {}, h('small', { text: 'Mahsulotlar' }), o.items.map((i) => h('div', { text: `${i.title}${i.color ? ' (' + i.color + ')' : ''} × ${i.qty} — ${money(i.price * i.qty)}` }))),
      h('div', {}, h('small', { text: 'Manzil' }), h('p', { text: o.address }), o.note ? h('small', { text: 'Izoh' }) : null, o.note ? h('p', { text: o.note }) : null),
      h('div', { class: 'field' }, h('label', { text: 'Ichki eslatma (mijoz koʻrmaydi)' }), (() => {
        const t = h('textarea', { class: 'textarea', style: { minHeight: '70px' } }); t.value = o.adminNote || '';
        t.addEventListener('change', () => run(() => A.setOrder(o.id, { adminNote: t.value }), 'Saqlandi')); return t;
      })()));
    const row = h('div', { class: 'row order expand', onclick: () => { detail.hidden = !detail.hidden; } },
      h('span', { class: 'id', text: '#' + o.id }),
      h('div', {}, h('strong', { text: o.name }), h('a', { class: 'tel', href: 'tel:+' + o.phone, text: fmtPhone(o.phone), onclick: (e) => e.stopPropagation() }), h('small', { text: ' · ' + date(o.created) })),
      h('div', { class: 'items-mini' }, o.items.slice(0, 2).map((i) => h('div', { text: `${i.title} × ${i.qty}` })), o.items.length > 2 ? h('div', { text: `+${o.items.length - 2} ta` }) : null),
      h('b', { class: 'price', text: money(o.total) }), sel,
      h('div', { class: 'row-actions' }, h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Oʻchirish', text: '🗑', onclick: async (e) => { e.stopPropagation(); if (await confirmBox(`#${o.id} buyurtmani oʻchirasizmi?`)) run(() => A.deleteOrder(o.id), 'Oʻchirildi').then(refresh); } })),
      detail);
    return row;
  }

  /* ---------- So'rovlar ---------- */
  function viewRequests() {
    if (!data.requests.length) { content.append(h('div', { class: 'empty-sm', text: 'Maxsus buyurtma soʻrovlari shu yerda paydo boʻladi.' })); return; }
    content.append(h('div', { class: 'list' }, data.requests.map((r) => {
      const sel = h('select', { class: 'select', 'aria-label': 'Holat' }, Object.entries(REQUEST_STATUS).map(([k, v]) => h('option', { value: k, text: v[0], selected: k === r.status })));
      sel.addEventListener('change', () => run(() => A.setRequest(r.id, { status: sel.value }), 'Holat oʻzgardi').then(refresh));
      const price = h('input', { class: 'input', inputmode: 'numeric', placeholder: 'Taklif narxi, soʻm' }); price.value = r.price || '';
      const reply = h('textarea', { class: 'textarea', style: { minHeight: '70px' }, placeholder: 'Mijozga javob yoki eslatma' }); reply.value = r.reply || '';
      return h('div', { class: 'box' },
        h('div', { class: 'box-head' }, h('div', {}, h('h2', { text: `#${r.id} · ${r.title}` }), h('small', { class: 'muted', text: `${r.name} · ` }), h('a', { class: 'tel', style: { color: 'var(--orange-hi)', fontWeight: 600 }, href: 'tel:+' + r.phone, text: fmtPhone(r.phone) }), h('small', { class: 'muted', text: ' · ' + date(r.created) + (r.qty ? ` · ${r.qty} dona` : '') })), st(REQUEST_STATUS, r.status)),
        h('p', { style: { whiteSpace: 'pre-wrap' }, text: r.description }),
        r.link ? h('a', { href: /^https?:/.test(r.link) ? r.link : 'https://' + r.link, target: '_blank', rel: 'noopener noreferrer', style: { color: 'var(--orange-hi)', wordBreak: 'break-all' }, text: r.link }) : null,
        (r.files || []).length ? h('div', { class: 'files' }, r.files.map((f) => f.url && /\.(jpe?g|png|webp|gif)$|^data:image/i.test(f.url)
          ? h('a', { href: f.url, target: '_blank', rel: 'noopener', title: f.name }, h('img', { src: f.url, alt: f.name }))
          : h('a', { href: f.url || '#', target: '_blank', rel: 'noopener', title: f.name }, h('span', { text: (f.url ? '▶ ' : '') + f.name })))) : null,
        h('div', { class: 'form-grid' }, h('div', { class: 'field' }, h('label', { text: 'Holat' }), sel), h('div', { class: 'field' }, h('label', { text: 'Narx' }), price), h('div', { class: 'field full' }, h('label', { text: 'Javob' }), reply)),
        h('div', { class: 'row-end' },
          h('button', { class: 'btn btn-danger btn-sm', type: 'button', text: 'Oʻchirish', onclick: async () => { if (await confirmBox(`#${r.id} soʻrovni oʻchirasizmi?`)) run(() => A.deleteRequest(r.id), 'Oʻchirildi').then(refresh); } }),
          h('a', { class: 'btn btn-ghost btn-sm', href: 'tel:+' + r.phone, text: 'Qoʻngʻiroq' }),
          h('button', { class: 'btn btn-sm', type: 'button', text: 'Saqlash', onclick: () => run(() => A.setRequest(r.id, { reply: reply.value, price: Number(String(price.value).replace(/\D/g, '')) || 0 }), 'Saqlandi') })));
    })));
  }

  /* ---------- Rasm tanlash ---------- */
  function pickImages(multiple) {
    return new Promise((resolve) => {
      const inp = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/gif', multiple: !!multiple, style: { display: 'none' } });
      inp.addEventListener('change', async () => {
        const out = [];
        for (const f of inp.files) {
          if (f.size > 8 * 1024 * 1024) { toast(`“${f.name}” 8 MB dan katta`, true); continue; }
          try { out.push((await A.upload(f)).url); } catch (e) { toast(e.message, true); }
        }
        inp.remove(); resolve(out);
      });
      document.body.append(inp); inp.click();
    });
  }

  /* ---------- Mahsulotlar ---------- */
  let pq = '', pcat = 'all';
  function viewProducts() {
    topActions.append(h('button', { class: 'btn btn-sm', type: 'button', text: '+ Yangi mahsulot', onclick: () => editProduct(null) }));
    const s = h('input', { type: 'search', placeholder: 'Qidirish', value: pq, 'aria-label': 'Qidirish' });
    const grid = h('div', { class: 'pgrid' });
    const paint = () => {
      const list = data.products.filter((p) => (pcat === 'all' || p.category === pcat) && (!pq || p.title.toLowerCase().includes(pq.toLowerCase())))
        .sort((a, b) => (b.created || 0) - (a.created || 0));
      grid.replaceChildren(...(list.length ? list.map(productCard) : [h('div', { class: 'empty-sm', style: { gridColumn: '1/-1' }, text: 'Mahsulot topilmadi' })]));
    };
    s.addEventListener('input', () => { pq = s.value; paint(); });
    const cs = h('select', { class: 'select', style: { width: 'auto', borderRadius: '999px' }, 'aria-label': 'Turkum' }, h('option', { value: 'all', text: 'Barcha turkumlar' }), data.categories.map((c) => h('option', { value: c.id, text: c.name, selected: c.id === pcat })));
    cs.addEventListener('change', () => { pcat = cs.value; paint(); });
    content.append(h('div', { class: 'filters' }, h('label', { class: 'search', html: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' }, s), cs), grid);
    paint();
  }
  function productCard(p) {
    const tg = h('label', { class: 'toggle', title: 'Saytda koʻrinadi' }, h('input', { type: 'checkbox', checked: p.active !== false }), h('i'), h('span', { class: 'hide-sm', text: 'Saytda' }));
    tg.querySelector('input').addEventListener('change', (e) => run(() => A.saveProduct({ id: p.id, active: e.target.checked }), e.target.checked ? 'Saytga chiqarildi' : 'Saytdan yashirildi').then(refresh));
    return h('div', { class: 'pcard' + (p.active === false ? ' off' : '') },
      h('div', { class: 'pimg', onclick: () => editProduct(p) }, (p.images || [])[0] ? h('img', { src: p.images[0], alt: '' }) : null,
        h('div', { class: 'card-badges' }, (p.badges || []).map((b) => h('span', { class: 'badge ' + b, text: BADGES[b] })))),
      h('div', { class: 'pbody' }, h('small', { class: 'muted', text: catName(p.category) }), h('b', { text: p.title }), h('span', { class: 'price', style: { fontSize: '16px' }, text: p.price ? money(p.price) : 'Narxi kelishiladi' }),
        h('div', { class: 'pfoot' }, tg, h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Tahrirlash', onclick: () => editProduct(p) }))));
  }
  function editProduct(p0) {
    const isNew = !p0;
    const p = JSON.parse(JSON.stringify(p0 || { title: '', category: (data.categories[0] || {}).id, price: 0, oldPrice: 0, description: '', specs: '', badges: ['new'], images: [], colors: [], model: '', modelColor: '#F5892A', instagram: '', active: true, stock: true }));
    const f = {};
    const inp = (k, attrs) => { const e = h(attrs && attrs.tag === 'textarea' ? 'textarea' : 'input', Object.assign({ class: attrs && attrs.tag === 'textarea' ? 'textarea' : 'input', id: 'p-' + k }, attrs || {}, { tag: null })); e.value = p[k] == null ? '' : p[k]; f[k] = e; return e; };
    const fld = (label, el, full, help) => h('div', { class: 'field' + (full ? ' full' : '') }, h('label', { for: el.id, text: label }), el, help ? h('span', { class: 'help', text: help }) : null);
    const cat = h('select', { class: 'select', id: 'p-cat' }, data.categories.map((c) => h('option', { value: c.id, text: c.name, selected: c.id === p.category })));
    const badges = h('div', { class: 'checks' }, Object.entries(BADGES).map(([k, n]) => h('label', { class: 'check-pill' }, h('input', { type: 'checkbox', value: k, checked: (p.badges || []).includes(k) }), n)));
    const imgs = h('div', { class: 'imgs' });
    const paintImgs = () => {
      imgs.replaceChildren(...p.images.map((src, i) => h('div', { class: 'im' }, h('img', { src, alt: '' }), i === 0 ? h('span', { class: 'first', text: 'Asosiy' }) : null,
        h('div', { class: 'tools' },
          i > 0 ? h('button', { type: 'button', title: 'Asosiy qilish', 'aria-label': 'Asosiy qilish', text: '★', onclick: () => { p.images.unshift(p.images.splice(i, 1)[0]); paintImgs(); } }) : null,
          h('button', { type: 'button', title: 'Olib tashlash', 'aria-label': 'Olib tashlash', text: '✕', onclick: () => { p.images.splice(i, 1); paintImgs(); } })))),
      h('button', { class: 'add', type: 'button', text: '+ Rasm qoʻshish', onclick: async () => { const u = await pickImages(true); p.images.push(...u); paintImgs(); } }));
    };
    paintImgs();
    const model = h('select', { class: 'select', id: 'p-model' }, [['', 'Yoʻq'], ['lamp', 'Spiral svetilnik'], ['lampTall', 'Uzun svetilnik'], ['pawn', 'Shaxmat figurasi'], ['keychain', 'Brelok']].map(([v, n]) => h('option', { value: v, text: n, selected: v === (p.model || '') })));
    const mcolor = h('input', { type: 'color', id: 'p-mcolor', class: 'input', style: { padding: '4px', height: '50px' }, value: p.modelColor || '#F5892A' });
    const active = h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: p.active !== false }), h('i'), 'Saytda koʻrinadi');
    const err = h('p', { class: 'form-error', role: 'alert' });
    const save = h('button', { class: 'btn', type: 'submit', text: isNew ? 'Qoʻshish' : 'Saqlash' });
    const num = (v) => Number(String(v).replace(/\D/g, '')) || 0;
    const form = h('form', { class: 'stack', novalidate: true },
      h('div', { class: 'form-grid' },
        fld('Nomi', inp('title', { maxlength: 120, autofocus: true }), true),
        fld('Turkum', cat),
        fld('Instagram havolasi (ixtiyoriy)', inp('instagram', { placeholder: 'https://www.instagram.com/reel/...' })),
        fld('Narxi, soʻm', inp('price', { inputmode: 'numeric' }), false, '0 boʻlsa “Narxi kelishiladi” deb chiqadi'),
        fld('Eski narx (chegirma uchun)', inp('oldPrice', { inputmode: 'numeric' })),
        fld('Tavsif', inp('description', { tag: 'textarea', maxlength: 2000 }), true),
        fld('Xususiyatlar', inp('specs', { maxlength: 200, placeholder: '220V · 3W · 20 sm' })),
        fld('Ranglar (vergul bilan)', (() => { const e = h('input', { class: 'input', id: 'p-colors', placeholder: 'Oq, Qora, Toʻq sariq' }); e.value = (p.colors || []).join(', '); f.colors = e; return e; })()),
        h('div', { class: 'field full' }, h('span', { class: 'label', text: 'Belgilar' }), badges),
        h('div', { class: 'field full' }, h('span', { class: 'label', text: 'Rasmlar (birinchisi kartochkada chiqadi, ikkinchisi sichqoncha ustiga kelganda)' }), imgs),
        fld('3D koʻrinish', model, false, 'Mahsulot oynasida aylanuvchi 3D model chiqadi'),
        fld('3D model rangi', mcolor),
        h('div', { class: 'field full' }, active)),
      err,
      h('div', { class: 'modal-foot' },
        h('div', {}, !isNew ? h('button', { class: 'btn btn-danger btn-sm', type: 'button', text: 'Oʻchirish', onclick: async () => { if (await confirmBox(`“${p.title}” oʻchirilsinmi?`)) { await run(() => A.deleteProduct(p.id), 'Oʻchirildi'); m.close(); refresh(); } } }) : null,
          !isNew ? h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Nusxa olish', onclick: async () => { const c = Object.assign({}, p, { id: undefined, title: p.title + ' (nusxa)', created: Date.now() }); delete c.id; await run(() => A.saveProduct(c), 'Nusxa yaratildi'); m.close(); refresh(); } }) : null),
        h('div', {}, h('button', { class: 'btn btn-ghost', type: 'button', text: 'Bekor qilish', onclick: () => m.close() }), save)));
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); err.textContent = '';
      const out = {
        title: f.title.value.trim(), category: cat.value, instagram: f.instagram.value.trim(), price: num(f.price.value), oldPrice: num(f.oldPrice.value),
        description: f.description.value.trim(), specs: f.specs.value.trim(), colors: f.colors.value.split(',').map((x) => x.trim()).filter(Boolean),
        badges: [...badges.querySelectorAll('input:checked')].map((x) => x.value), images: p.images, model: model.value, modelColor: mcolor.value, active: active.querySelector('input').checked,
      };
      if (out.title.length < 2) { err.textContent = 'Mahsulot nomini yozing'; f.title.focus(); return; }
      if (out.instagram && !/^https:\/\/(www\.)?instagram\.com\//.test(out.instagram)) { err.textContent = 'Instagram havolasi https://www.instagram.com/ bilan boshlansin'; return; }
      if (!isNew) out.id = p.id;
      save.disabled = true;
      try { await A.saveProduct(out); toast(isNew ? 'Mahsulot qoʻshildi' : 'Saqlandi'); m.close(); refresh(); } catch (ex) { err.textContent = ex.message; save.disabled = false; }
    });
    const m = modal(isNew ? 'Yangi mahsulot' : 'Mahsulotni tahrirlash', form, { wide: true });
  }

  /* ---------- Turkumlar ---------- */
  function viewCategories() {
    const list = data.categories.map((c) => Object.assign({}, c));
    const box = h('div', { class: 'list' });
    const paint = () => {
      box.replaceChildren(...list.map((c, i) => {
        const used = data.products.filter((p) => p.category === c.id).length;
        const name = h('input', { class: 'input', value: c.name, 'aria-label': 'Nomi', placeholder: 'Nomi' }); name.addEventListener('input', () => { c.name = name.value; });
        const id = h('input', { class: 'input', value: c.id, 'aria-label': 'Kodi', placeholder: 'kodi (lotin harf)', disabled: used > 0 && !c._new, title: used ? 'Mahsulotlar bogʻlangan, kodni oʻzgartirib boʻlmaydi' : '' }); id.addEventListener('input', () => { c.id = id.value.toLowerCase().replace(/[^a-z0-9-]/g, ''); });
        const blurb = h('input', { class: 'input', value: c.blurb || '', 'aria-label': 'Qisqa tavsif', placeholder: 'Qisqa tavsif' }); blurb.addEventListener('input', () => { c.blurb = blurb.value; });
        return h('div', { class: 'cat-row' },
          h('button', { class: 'cover', type: 'button', title: 'Muqova rasmi', onclick: async () => { const u = await pickImages(false); if (u[0]) { c.cover = u[0]; paint(); } } }, c.cover ? h('img', { src: c.cover, alt: '' }) : 'Rasm'),
          name, id, blurb,
          h('div', { class: 'row-actions' },
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Yuqoriga', text: '↑', disabled: i === 0, onclick: () => { [list[i - 1], list[i]] = [list[i], list[i - 1]]; paint(); } }),
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Pastga', text: '↓', disabled: i === list.length - 1, onclick: () => { [list[i + 1], list[i]] = [list[i], list[i + 1]]; paint(); } }),
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Oʻchirish', text: '🗑', onclick: async () => {
              if (used) { toast(`Bu turkumda ${used} ta mahsulot bor. Avval ularni boshqa turkumga oʻtkazing`, true); return; }
              list.splice(i, 1); paint();
            } })));
      }));
    };
    paint();
    topActions.append(h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: '+ Turkum', onclick: () => { list.push({ id: 'yangi-' + (list.length + 1), name: 'Yangi turkum', blurb: '', cover: '', _new: true }); paint(); } }),
      h('button', { class: 'btn btn-sm', type: 'button', text: 'Saqlash', onclick: async () => {
        const clean = list.map((c, i) => ({ id: c.id, name: c.name.trim(), blurb: (c.blurb || '').trim(), cover: c.cover || '', sort: i + 1 }));
        if (clean.some((c) => !c.name || !c.id)) return toast('Har bir turkumning nomi va kodi boʻlsin', true);
        if (new Set(clean.map((c) => c.id)).size !== clean.length) return toast('Turkum kodlari takrorlanmasin', true);
        await run(() => A.saveCategories(clean), 'Turkumlar saqlandi'); refresh();
      } }));
    content.append(h('p', { class: 'help', text: 'Muqova rasmi bosh sahifadagi “Kataloglar” plitkasida chiqadi. Tartibni oʻqlar bilan oʻzgartiring, keyin “Saqlash”ni bosing.' }), box);
  }

  /* ---------- Instagram videolari ---------- */
  function viewReels() {
    const link = h('input', { class: 'input', id: 'rl', placeholder: 'https://www.instagram.com/reel/...' });
    const ttl = h('input', { class: 'input', id: 'rt', placeholder: 'Video sarlavhasi', maxlength: 100 });
    let cover = '';
    const coverBtn = h('button', { class: 'btn btn-ghost', type: 'button', text: 'Muqova rasmi (ixtiyoriy)', onclick: async () => { const u = await pickImages(false); if (u[0]) { cover = u[0]; coverBtn.textContent = 'Muqova tanlandi ✓'; } } });
    const add = h('form', { class: 'box', novalidate: true },
      h('div', { class: 'box-head' }, h('h2', { text: 'Video qoʻshish' })),
      h('p', { class: 'help', text: 'Instagramdagi reels yoki post havolasini nusxalab qoʻying. Video saytda Instagram pleyeri orqali shu sahifaning oʻzida ochiladi.' }),
      h('div', { class: 'form-grid' }, h('div', { class: 'field' }, h('label', { for: 'rl', text: 'Havola' }), link), h('div', { class: 'field' }, h('label', { for: 'rt', text: 'Sarlavha' }), ttl)),
      h('div', { class: 'row-end' }, coverBtn, h('button', { class: 'btn', type: 'submit', text: 'Qoʻshish' })));
    add.addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = reelCode(link.value);
      if (!code) return toast('Havola notoʻgʻri. Masalan: https://www.instagram.com/reel/ABC123/', true);
      if (data.reels.some((r) => r.code === code)) return toast('Bu video allaqachon qoʻshilgan', true);
      await run(() => A.saveReel({ code, title: ttl.value.trim(), cover, active: true }), 'Video qoʻshildi'); refresh();
    });
    const grid = h('div', { class: 'rgrid' }, data.reels.map((r, i) => {
      const tg = h('label', { class: 'toggle', title: 'Saytda' }, h('input', { type: 'checkbox', checked: r.active !== false }), h('i'));
      tg.querySelector('input').addEventListener('change', (e) => run(() => A.saveReel({ id: r.id, code: r.code, active: e.target.checked }), 'Saqlandi').then(refresh));
      return h('div', { class: 'rcard' + (r.active === false ? ' off' : '') },
        h('div', { class: 'rimg', onclick: () => preview(r) }, r.cover ? h('img', { src: r.cover, alt: '' }) : h('span', { class: 'reel-noimg' }), h('span', { class: 'reel-play', html: '<svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M8 5.5v13l11-6.5z"/></svg>' })),
        h('div', { class: 'rbody' }, h('b', { text: r.title || r.code }),
          h('div', { class: 'rtools' }, tg,
            h('div', { style: { display: 'flex', gap: '4px' } },
              h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Chapga', text: '←', disabled: i === 0, onclick: () => run(() => A.moveReel(r.id, -1)).then(refresh) }),
              h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Oʻngga', text: '→', disabled: i === data.reels.length - 1, onclick: () => run(() => A.moveReel(r.id, 1)).then(refresh) }),
              h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Tahrirlash', text: '✎', onclick: () => editReel(r) }),
              h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Oʻchirish', text: '🗑', onclick: async () => { if (await confirmBox('Video saytdan olib tashlansinmi?')) run(() => A.deleteReel(r.id), 'Oʻchirildi').then(refresh); } })))));
    }));
    content.append(add, data.reels.length ? grid : h('div', { class: 'empty-sm', text: 'Hali video qoʻshilmagan' }));
  }
  function preview(r) {
    const url = `https://www.instagram.com/reel/${encodeURIComponent(r.code)}/`;
    const m = modal(r.title || 'Video', h('div', { class: 'stack' }, h('div', { class: 'reel-frame' }, h('div', { class: 'spinner' }), h('iframe', { src: url + 'embed/', title: r.title || 'Instagram', allowfullscreen: true, scrolling: 'no' })), h('a', { class: 'btn btn-ghost btn-sm', href: url, target: '_blank', rel: 'noopener', text: 'Instagramda ochish' })));
    m.el.classList.add('reel-modal');
  }
  function editReel(r) {
    const ttl = h('input', { class: 'input', id: 'er-t', value: r.title || '', maxlength: 100 });
    const link = h('input', { class: 'input', id: 'er-l', value: `https://www.instagram.com/reel/${r.code}/` });
    let cover = r.cover || '';
    const img = h('div', { class: 'imgs' });
    const paint = () => img.replaceChildren(...[cover ? h('div', { class: 'im' }, h('img', { src: cover, alt: '' }), h('div', { class: 'tools' }, h('button', { type: 'button', text: '✕', 'aria-label': 'Olib tashlash', onclick: () => { cover = ''; paint(); } }))) : null,
      h('button', { class: 'add', type: 'button', text: cover ? 'Almashtirish' : '+ Muqova', onclick: async () => { const u = await pickImages(false); if (u[0]) { cover = u[0]; paint(); } } })].filter(Boolean));
    paint();
    const form = h('form', { class: 'stack', novalidate: true },
      h('div', { class: 'field' }, h('label', { for: 'er-t', text: 'Sarlavha' }), ttl),
      h('div', { class: 'field' }, h('label', { for: 'er-l', text: 'Havola' }), link),
      h('div', { class: 'field' }, h('span', { class: 'label', text: 'Muqova' }), img),
      h('div', { class: 'row-end' }, h('button', { class: 'btn', type: 'submit', text: 'Saqlash' })));
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); const code = reelCode(link.value); if (!code) return toast('Havola notoʻgʻri', true);
      await run(() => A.saveReel({ id: r.id, code, title: ttl.value.trim(), cover }), 'Saqlandi'); m.close(); refresh();
    });
    const m = modal('Videoni tahrirlash', form);
  }

  /* ---------- Sozlamalar ---------- */
  function viewSettings() {
    const s = data.settings; const f = {};
    const fld = (k, label, attrs, help) => { const e = h(attrs && attrs.tag === 'textarea' ? 'textarea' : 'input', Object.assign({ class: attrs && attrs.tag === 'textarea' ? 'textarea' : 'input', id: 's-' + k }, attrs || {}, { tag: null })); e.value = s[k] || ''; f[k] = e; return h('div', { class: 'field' + (attrs && attrs.full ? ' full' : '') }, h('label', { for: e.id, text: label }), e, help ? h('span', { class: 'help', text: help }) : null); };
    const form = h('form', { class: 'box', novalidate: true },
      h('div', { class: 'box-head' }, h('h2', { text: 'Aloqa' })),
      h('div', { class: 'form-grid' },
        fld('phone', 'Telefon', { placeholder: '+998 99 700 00 71' }),
        fld('instagram', 'Instagram (username)', { placeholder: '3durbanprint' }),
        fld('telegram', 'Telegram (username)', { placeholder: 'urbanprint_uz' }, 'Boʻsh qolsa saytda koʻrinmaydi'),
        fld('city', 'Shahar / manzil')),
      h('div', { class: 'box-head' }, h('h2', { text: 'Bosh ekran matnlari' })),
      h('div', { class: 'form-grid' },
        fld('heroKicker', 'Ustki yozuv', { full: true }),
        fld('heroTitle', 'Katta sarlavha', { full: true }, '“qatlam” soʻzi boʻlsa, u rangli boʻlib chiqadi'),
        fld('heroText', 'Sarlavha ostidagi matn', { tag: 'textarea', full: true }),
        fld('followers', 'Kuzatuvchilar soni', { placeholder: '1 900+' }),
        fld('announce', 'Eng tepadagi eʼlon qatori', {}, 'Boʻsh qolsa koʻrinmaydi'),
        fld('delivery', 'Yetkazib berish muddati', { full: true })),
      h('div', { class: 'row-end' }, h('button', { class: 'btn', type: 'submit', text: 'Saqlash' })));
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); const out = {}; Object.keys(f).forEach((k) => { out[k] = f[k].value.trim(); });
      await run(() => A.saveSettings(out), 'Sozlamalar saqlandi'); refresh();
    });
    content.append(form);
    if (Store.mode === 'demo') content.append(h('div', { class: 'box' }, h('div', { class: 'box-head' }, h('h2', { text: 'Demo maʼlumotlar' })),
      h('p', { class: 'muted', text: 'Barcha oʻzgarishlarni oʻchirib, boshlangʻich mahsulotlar va videolarni qaytarish.' }),
      h('div', { class: 'row-end' }, h('button', { class: 'btn btn-danger btn-sm', type: 'button', text: 'Demo maʼlumotni tiklash', onclick: async () => { if (await confirmBox('Barcha demo oʻzgarishlar oʻchiriladi. Davom etasizmi?', 'Tiklash')) { await A.reset(); toast('Tiklandi'); refresh(); } } }))));
    else content.append(h('div', { class: 'box' }, h('div', { class: 'box-head' }, h('h2', { text: 'Telegram xabarnoma' })),
      h('p', { class: 'muted', text: 'Yangi buyurtma va soʻrovlar Telegramga kelishi uchun serverni TELEGRAM_BOT_TOKEN va TELEGRAM_CHAT_ID bilan ishga tushiring (README’da batafsil).' })));
  }

  const VIEWS = { dash: viewDash, orders: viewOrders, requests: viewRequests, products: viewProducts, categories: viewCategories, reels: viewReels, settings: viewSettings };

  async function boot() {
    await Store.detect();
    const me = await A.me();
    if (!me) return showLogin();
    if (!side) shell();
    route();
  }
  boot();
})();
