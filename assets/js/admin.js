'use strict';
(function () {
  const { h, toast, modal, confirmBox, date } = UI;
  const { money, fmtPhone, ORDER_STATUS, REQUEST_STATUS, BADGES, reelCode, REVIEW_STATUS, ROLES } = Store;
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
    promos: '<path d="M20 12 12 20 4 12V4h8z"/><circle cx="8.5" cy="8.5" r="1.5"/>',
    customers: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6"/>',
    reviews: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    staff: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/><path d="m16.5 3.5 1.5 1.5 3-3"/>',
    audit: '<path d="M8 4h11v16H5V7z"/><path d="M8 4v3H5M9 11h7M9 15h7"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 13.6H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10.4 3V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  };
  const icon = (k, s) => `<svg width="${s || 20}" height="${s || 20}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${IC[k]}</svg>`;
  const ALL_TABS = [['dash', 'Bosh sahifa'], ['orders', 'Buyurtmalar'], ['requests', 'Soʻrovlar'], ['reviews', 'Sharhlar'], ['products', 'Mahsulotlar'], ['categories', 'Turkumlar'], ['reels', 'Instagram videolari'], ['promos', 'Promokodlar'], ['customers', 'Mijozlar'], ['staff', 'Xodimlar'], ['audit', 'Amallar jurnali'], ['settings', 'Sozlamalar']];
  // Har bir xodim faqat o'z ruxsati bor bo'limlarni ko'radi
  let TABS = ALL_TABS;
  const allowed = (k) => !data || !data.me || Store.can(data.me.role, k);
  const st = (map, k) => { const [t, c] = map[k] || [k, '']; return h('span', { class: 'st ' + c, text: t }); };
  const catName = (id) => ((data.categories.find((c) => c.id === id) || {}).name || id);
  const run = async (fn, okMsg) => { try { const r = await fn(); if (okMsg) toast(okMsg); return r; } catch (e) { if (e.status === 401) { showLogin(); } toast(e.message, true); throw e; } };
  async function reload() { data = await A.all(); }

  /* ---------- Kirish ---------- */
  function showLogin() {
    side = null;
    const lg = h('input', { class: 'input', id: 'lg', autocomplete: 'username', value: 'admin', autocapitalize: 'none', spellcheck: 'false' });
    const pw = h('input', { class: 'input', type: 'password', id: 'pw', autocomplete: 'current-password', autofocus: true });
    const err = h('p', { class: 'form-error', role: 'alert' });
    const btn = h('button', { class: 'btn btn-wide', type: 'submit', text: 'Kirish' });
    const form = h('form', { class: 'login-card', novalidate: true },
      h('a', { class: 'logo', href: './', html: '<svg width="34" height="34" viewBox="0 0 40 40"><path d="M20 3 36 12v16L20 37 4 28V12z" fill="#F5892A"/><path d="M20 3 36 12 20 21 4 12z" fill="#FFB067"/><path d="M20 21v16L4 28V12z" fill="#C96A14"/></svg><span><b>3D</b> UrbanPrint</span>' }),
      h('h1', { text: 'Admin panelga kirish' }),
      Store.mode === 'demo' ? h('div', { class: 'demo-note', html: `Demo rejim. Login: <b>admin</b>, parol: <b>${Store.DEMO_PASSWORD}</b>. Oʻzgarishlar faqat shu brauzerda saqlanadi va doʻkon sahifasida darhol koʻrinadi.` }) : null,
      h('div', { class: 'field' }, h('label', { for: 'lg', text: 'Login' }), lg),
      h('div', { class: 'field' }, h('label', { for: 'pw', text: 'Parol' }), pw), err, btn,
      h('small', { class: 'help', text: 'Egasi “admin” login bilan kiradi. Xodimlarga login va parolni egasi “Xodimlar” boʻlimida beradi.' }));
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); err.textContent = ''; btn.disabled = true;
      try { await A.login(pw.value, lg.value); await boot(); } catch (ex) { err.textContent = ex.message; btn.disabled = false; pw.select(); }
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
    const unread = data.orders.filter((o) => o.unread).length;
    const pendRev = (data.reviews || []).filter((r) => r.status === 'pending').length;
    side.replaceChildren(
      h('a', { class: 'logo', href: './', target: '_blank', html: '<svg width="30" height="30" viewBox="0 0 40 40"><path d="M20 3 36 12v16L20 37 4 28V12z" fill="#F5892A"/><path d="M20 3 36 12 20 21 4 12z" fill="#FFB067"/><path d="M20 21v16L4 28V12z" fill="#C96A14"/></svg><span><b>3D</b> UrbanPrint</span>' }),
      ...TABS.map(([k, name]) => h('a', { class: 'tab' + (k === cur ? ' on' : ''), href: '#' + k, onclick: () => side.classList.remove('open') },
        h('span', { html: icon(k) }), name,
        k === 'orders' && (newOrders || unread) ? h('span', { class: 'cnt', title: unread ? `${unread} ta javobsiz xabar` : '', text: newOrders + (unread ? ' · 💬' + unread : '') }) : null,
        k === 'reviews' && pendRev ? h('span', { class: 'cnt', text: pendRev }) : null,
        k === 'requests' && newReq ? h('span', { class: 'cnt', text: newReq }) : null)),
      h('div', { class: 'side-foot' },
        data.me ? h('div', { class: 'who' }, h('span', { class: 'who-ava', text: (data.me.name || '?').slice(0, 1) }), h('div', {}, h('b', { text: data.me.name }), h('small', { text: data.me.role === 'owner' ? '@admin · barcha huquqlar' : `${ROLES[data.me.role] || data.me.role}${data.me.login ? ' · @' + data.me.login : ''}` }))) : null,
        h('span', { class: 'mode-pill' + (Store.mode === 'demo' ? ' demo' : '') }, h('i'), Store.mode === 'demo' ? 'Demo rejim (brauzerda)' : 'Server ulangan'),
        h('div', { style: { display: 'flex', gap: '8px' } },
          h('a', { class: 'btn btn-ghost btn-sm', style: { flex: 1 }, href: './', target: '_blank', text: 'Saytni ochish' }),
          h('button', { class: 'btn btn-ghost btn-sm', type: 'button', title: 'Yorugʻ / qorongʻi mavzu', 'aria-label': 'Mavzu', text: '◐', onclick: () => {
            const light = document.documentElement.dataset.theme !== 'light';
            if (light) document.documentElement.dataset.theme = 'light'; else delete document.documentElement.dataset.theme;
            try { localStorage.setItem('up_theme', light ? 'light' : 'dark'); } catch { /* yopiq */ }
          } })),
        h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Chiqish', onclick: async () => { await A.logout(); showLogin(); } })));
  }
  async function route() {
    const k = (location.hash || '#dash').slice(1);
    try { await reload(); } catch (e) { if (e.status === 401) return showLogin(); toast(e.message, true); return; }
    TABS = ALL_TABS.filter(([key]) => allowed(key));
    const tab = TABS.find((t) => t[0] === k) ? k : 'dash';
    renderSide(tab);
    title.textContent = TABS.find((t) => t[0] === tab)[1];
    topActions.replaceChildren(); content.replaceChildren();
    VIEWS[tab]();
    window.scrollTo(0, 0);
  }
  const refresh = () => route();

  /* ---------- Bosh sahifa ---------- */
  const COUNTED = (x) => !['cancelled', 'pending_payment'].includes(x.status);
  function viewDash() {
    const o = data.orders, live = o.filter(COUNTED);
    const revenue = o.filter((x) => x.status === 'done').reduce((s, x) => s + x.total, 0);
    const pending = live.filter((x) => x.status !== 'done').reduce((s, x) => s + x.total, 0);
    const days = [...Array(14)].map((_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - 13 + i); return d; });
    const sums = days.map((d) => live.filter((x) => x.created >= +d && x.created < +d + 864e5).reduce((s, x) => s + x.total, 0));
    const counts = days.map((d) => live.filter((x) => x.created >= +d && x.created < +d + 864e5).length);
    const max = Math.max(1, ...sums);
    const top = {}; live.forEach((x) => x.items.forEach((i) => { top[i.title] = top[i.title] || { qty: 0, sum: 0 }; top[i.title].qty += i.qty; top[i.title].sum += i.qty * i.price; }));
    const topList = Object.entries(top).sort((a, b) => b[1].sum - a[1].sum).slice(0, 5);
    const low = data.products.filter((p) => p.active !== false && p.stock != null && p.stock <= 3);
    const avg = live.length ? Math.round(live.reduce((s, x) => s + x.total, 0) / live.length) : 0;
    content.append(
      h('div', { class: 'kpis' },
        h('a', { class: 'kpi', href: '#orders' }, h('span', { text: 'Yangi buyurtmalar' }), h('b', { text: o.filter((x) => ['new', 'paid'].includes(x.status)).length }), h('small', { text: `jami ${o.length} ta` })),
        h('div', { class: 'kpi' }, h('span', { text: 'Yetkazilgan tushum' }), h('b', { text: money(revenue) }), h('small', { text: `jarayonda: ${money(pending)}` })),
        h('div', { class: 'kpi' }, h('span', { text: 'Oʻrtacha chek' }), h('b', { text: money(avg) }), h('small', { text: `${new Set(live.map((x) => x.phone)).size} ta mijoz` })),
        h('a', { class: 'kpi', href: '#requests' }, h('span', { text: 'Yangi soʻrovlar' }), h('b', { text: data.requests.filter((x) => x.status === 'new').length }), h('small', { text: `jami ${data.requests.length} ta` }))),
      (function () {
        const unread = o.filter((x) => x.unread), pend = (data.reviews || []).filter((r) => r.status === 'pending');
        const rv = (data.reviews || []).filter((r) => r.status === 'approved');
        const avgR = rv.length ? (rv.reduce((a, r) => a + r.rating, 0) / rv.length).toFixed(1) : '—';
        return h('div', { class: 'kpis' },
          h('a', { class: 'kpi' + (unread.length ? ' hot' : ''), href: '#orders' }, h('span', { text: 'Javob kutayotgan xabarlar' }), h('b', { text: unread.length }), h('small', { text: unread.length ? unread.slice(0, 3).map((x) => x.code).join(', ') : 'Hammasiga javob berilgan' })),
          h('a', { class: 'kpi' + (pend.length ? ' hot' : ''), href: '#reviews' }, h('span', { text: 'Tekshiruvdagi sharhlar' }), h('b', { text: pend.length }), h('small', { text: `Saytda ${rv.length} ta · oʻrtacha ${avgR} ★` })));
      })(),
      h('div', { class: 'grid-dash' },
        h('div', { class: 'box' }, h('div', { class: 'box-head' }, h('h2', { text: 'Soʻnggi 14 kun: tushum' }), h('small', { class: 'muted', text: `${counts.reduce((a, b) => a + b, 0)} ta buyurtma` })),
          h('div', { class: 'bars' }, sums.map((n, i) => h('div', { class: n ? '' : 'zero', 'data-n': counts[i] || '', title: money(n), style: { height: (n / max) * 100 + '%' } }))),
          h('div', { class: 'bar-labels' }, days.map((d) => h('span', { text: d.getDate() })))),
        h('div', { class: 'box' }, h('div', { class: 'box-head' }, h('h2', { text: 'Eng koʻp sotilgan' })),
          topList.length ? h('div', { class: 'list' }, topList.map(([n, v], i) => h('div', { class: 'top-row' }, h('span', { class: 'id', text: i + 1 }), h('div', {}, h('strong', { text: n }), h('small', { text: `${v.qty} dona` })), h('b', { text: money(v.sum) }))))
            : h('div', { class: 'empty-sm', text: 'Sotuvlar shu yerda koʻrinadi' }))),
      h('div', { class: 'grid-dash' },
        h('div', { class: 'box' }, h('div', { class: 'box-head' }, h('h2', { text: 'Soʻnggi buyurtmalar' }), h('a', { class: 'btn btn-ghost btn-sm', href: '#orders', text: 'Hammasi' })),
          o.length ? h('div', { class: 'list' }, o.slice(0, 5).map((x) => h('a', { href: '#orders', class: 'top-row' },
            h('span', { class: 'id', text: x.code || '#' + x.id }), h('div', {}, h('strong', { text: x.name }), h('small', { text: money(x.total) + ' · ' + date(x.created) })), st(ORDER_STATUS, x.status))))
            : h('div', { class: 'empty-sm', text: 'Hozircha buyurtma yoʻq. Saytdan sinov buyurtmasi berib koʻring.' })),
        h('div', { class: 'box' }, h('div', { class: 'box-head' }, h('h2', { text: 'Holat' })),
          h('div', { class: 'list' },
            h('div', { class: 'top-row' }, h('span', { class: 'dot ' + (data.payments && data.payments.payme ? 'on' : '') }), h('div', {}, h('strong', { text: 'Payme' }), h('small', { text: data.payments && data.payments.payme ? 'Ulangan' : 'Ulanmagan (serverda kalitlar kerak)' }))),
            h('div', { class: 'top-row' }, h('span', { class: 'dot ' + (data.payments && data.payments.click ? 'on' : '') }), h('div', {}, h('strong', { text: 'Click' }), h('small', { text: data.payments && data.payments.click ? 'Ulangan' : 'Ulanmagan (serverda kalitlar kerak)' }))),
            h('div', { class: 'top-row' }, h('span', { class: 'dot ' + (data.telegram ? 'on' : '') }), h('div', {}, h('strong', { text: 'Telegram xabarnoma' }), h('small', { text: data.telegram ? 'Yoqilgan' : 'Oʻchiq' }))),
            low.length ? h('div', { class: 'top-row' }, h('span', { class: 'dot warn' }), h('div', {}, h('strong', { text: 'Qoldiq kam' }), h('small', { text: low.map((p) => `${p.title}: ${p.stock}`).join(', ') }))) : null))),
      Store.mode === 'demo' ? h('div', { class: 'box' }, h('div', { class: 'box-head' }, h('h2', { text: 'Demo rejim haqida' })),
        h('p', { class: 'muted', text: 'Bu nusxa statik hostingda ishlayapti, shuning uchun barcha maʼlumot shu brauzer xotirasida saqlanadi. Server (server/server.js) ishga tushirilganda xuddi shu panel haqiqiy bazaga yozadi, rasm yuklaydi, Payme/Click toʻlovlarini qabul qiladi va yangi buyurtmalarni Telegramga yuboradi.' })) : null);
  }

  /* ---------- Buyurtmalar ---------- */
  let orderFilter = 'all', oq = '';
  const PAY = { cash: 'Qabul qilganda', payme: 'Payme', click: 'Click' };
  function viewOrders() {
    topActions.append(h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'CSV yuklab olish', onclick: async () => {
      const csv = await run(() => A.ordersCsv());
      const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
      const a = h('a', { href: url, download: `buyurtmalar-${new Date().toISOString().slice(0, 10)}.csv` }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    } }));
    const filters = h('div', { class: 'filters' }, [['all', 'Hammasi']].concat(Object.entries(ORDER_STATUS).map(([k, v]) => [k, v[0]])).map(([k, n]) => {
      const c = k === 'all' ? data.orders.length : data.orders.filter((o) => o.status === k).length;
      if (k !== 'all' && !c && k !== orderFilter) return null;
      return h('button', { class: 'chip', type: 'button', 'aria-pressed': String(k === orderFilter), onclick: () => { orderFilter = k; refresh(); } }, n, h('small', { text: c }));
    }));
    const s = h('input', { type: 'search', placeholder: 'Raqam, ism yoki telefon', value: oq, 'aria-label': 'Qidirish' });
    const box = h('div', { class: 'list' });
    const paint = () => {
      const q = oq.toLowerCase().replace(/\s/g, '');
      const list = data.orders.filter((o) => (orderFilter === 'all' || o.status === orderFilter) && (!q || [o.code, o.name, o.phone, '#' + o.id].join(' ').toLowerCase().replace(/\s/g, '').includes(q)));
      box.replaceChildren(...(list.length ? list.map(orderRow) : [h('div', { class: 'empty-sm', text: 'Buyurtma topilmadi' })]));
    };
    s.addEventListener('input', () => { oq = s.value; paint(); });
    content.append(h('div', { class: 'filters' }, h('label', { class: 'search', html: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' }, s)), filters, box);
    paint();
  }
  // Chekdagi QR: do'kon sahifasida buyurtma kuzatish oynasini ochadi
  const trackUrl = (o) => new URL('./?order=' + encodeURIComponent(o.code), location.href).href;
  function printReceipt(o) {
    const w = window.open('', '_blank', 'width=420,height=640');
    if (!w) return toast('Brauzer yangi oynani blokladi', true);
    const e = UI.esc;
    w.document.write(`<!doctype html><meta charset="utf-8"><title>${e(o.code)}</title><style>body{font:14px/1.45 system-ui,sans-serif;margin:20px;color:#111}h1{font-size:18px;margin:0 0 4px}table{width:100%;border-collapse:collapse;margin:12px 0}td{padding:5px 0;border-bottom:1px dashed #bbb;vertical-align:top}td:last-child{text-align:right;white-space:nowrap}.t{font-size:17px;font-weight:700}.m{color:#555}</style>
      <h1>3D UrbanPrint</h1><div class="m">${e(data.settings.phone || '')}</div><hr>
      <div><b>${e(o.code)}</b> · ${e(date(o.created))}</div><div>${e(o.name)}, ${e(fmtPhone(o.phone))}</div>
      <div>${o.delivery === 'pickup' ? 'Olib ketish' : e(o.address)}</div>
      <table>${o.items.map((i) => `<tr><td>${e(i.title)}${i.color ? ' (' + e(i.color) + ')' : ''} × ${i.qty}</td><td>${e(money(i.price * i.qty))}</td></tr>`).join('')}
      ${o.discount ? `<tr><td>Chegirma ${e(o.promo)}</td><td>−${e(money(o.discount))}</td></tr>` : ''}${o.fee ? `<tr><td>Yetkazish</td><td>${e(money(o.fee))}</td></tr>` : ''}
      <tr><td class="t">Jami</td><td class="t">${e(money(o.total))}</td></tr></table>
      <div class="m">Toʻlov: ${e(PAY[o.payment] || '')} · ${e(ORDER_STATUS[o.status] ? ORDER_STATUS[o.status][0] : o.status)}</div>${o.note ? `<p>Izoh: ${e(o.note)}</p>` : ''}
      <p class="m">Rahmat! Instagram: @${e(String(data.settings.instagram || '').replace(/^@/, ''))}</p>
      <div style="display:flex;gap:12px;align-items:center;margin-top:10px"><div id="qr"></div><div class="m" style="font-size:12px">Buyurtmani kuzatish va doʻkonga yozish uchun skanerlang.<br>Raqam: <b>${e(o.code)}</b></div></div>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js"><\/script>
      <script>try{var q=qrcode(0,'M');q.addData(${JSON.stringify(trackUrl(o))});q.make();document.getElementById('qr').innerHTML=q.createSvgTag({cellSize:3,margin:0})}catch(err){}setTimeout(print,300)<\/script>`);
    w.document.close();
  }
  function orderRow(o) {
    const sel = h('select', { class: 'select', 'aria-label': 'Holat', onclick: (e) => e.stopPropagation() }, Object.entries(ORDER_STATUS).map(([k, v]) => h('option', { value: k, text: v[0], selected: k === o.status })));
    sel.addEventListener('change', async () => {
      if (sel.value === 'cancelled' && !(await confirmBox(`${o.code} bekor qilinsinmi? Ombordagi qoldiq qaytariladi.`, 'Bekor qilish'))) { sel.value = o.status; return; }
      run(() => A.setOrder(o.id, { status: sel.value }), 'Holat oʻzgardi').then(refresh);
    });
    const map = o.location ? `https://maps.google.com/?q=${o.location.lat},${o.location.lng}` : '';
    const detail = h('div', { class: 'row-detail', hidden: true, onclick: (e) => e.stopPropagation() },
      h('div', {}, h('small', { text: 'Mahsulotlar' }), o.items.map((i) => h('div', { text: `${i.title}${i.color ? ' (' + i.color + ')' : ''} × ${i.qty} — ${money(i.price * i.qty)}` })),
        o.discount ? h('div', { class: 'muted', text: `Chegirma ${o.promo}: −${money(o.discount)}` }) : null,
        o.fee ? h('div', { class: 'muted', text: `Yetkazish: ${money(o.fee)}` }) : null),
      h('div', {}, h('small', { text: o.delivery === 'pickup' ? 'Olib ketadi' : 'Manzil' }), o.delivery === 'pickup' ? null : h('p', { text: o.address }),
        map ? h('a', { href: map, target: '_blank', rel: 'noopener', class: 'tel', text: '📍 Xaritada ochish' }) : null,
        h('p', { text: 'Toʻlov: ' + (PAY[o.payment] || '—') + (o.paidAt ? ' · toʻlangan ' + date(o.paidAt) : '') }),
        o.note ? h('small', { text: 'Izoh' }) : null, o.note ? h('p', { text: o.note }) : null),
      h('div', {}, h('small', { text: 'Tarix' }), h('ol', { class: 'mini-timeline' }, (o.history || []).map((x) => h('li', { text: `${(ORDER_STATUS[x.status] || [x.status])[0]} — ${date(x.at)}` })))),
      orderChat(o),
      h('div', { class: 'field' }, h('label', { text: 'Ichki eslatma (mijoz koʻrmaydi)' }), (() => {
        const t = h('textarea', { class: 'textarea', style: { minHeight: '70px' } }); t.value = o.adminNote || '';
        t.addEventListener('change', () => run(() => A.setOrder(o.id, { adminNote: t.value }), 'Saqlandi')); return t;
      })()));
    return h('div', { class: 'row order expand' + (o.unread ? ' unread' : ''), onclick: (ev) => {
      detail.hidden = !detail.hidden;
      if (!detail.hidden && o.unread) { o.unread = false; ev.currentTarget.classList.remove('unread'); A.setOrder(o.id, { read: true }).catch(() => {}); }
    } },
      h('span', { class: 'id' }, o.code || '#' + o.id, o.unread ? h('i', { class: 'msg-dot', title: 'Javobsiz xabar' }) : null),
      h('div', {}, h('strong', { text: o.name }), h('a', { class: 'tel', href: 'tel:+' + o.phone, text: fmtPhone(o.phone), onclick: (e) => e.stopPropagation() }), h('small', { text: ' · ' + date(o.created) })),
      h('div', { class: 'items-mini' }, o.items.slice(0, 2).map((i) => h('div', { text: `${i.title} × ${i.qty}` })), o.items.length > 2 ? h('div', { text: `+${o.items.length - 2} ta` }) : null),
      h('div', {}, h('b', { class: 'price', text: money(o.total) }), h('small', { text: (PAY[o.payment] || '') + (o.delivery === 'pickup' ? ' · olib ketish' : '') })), sel,
      h('div', { class: 'row-actions' },
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Chek chop etish', title: 'Chek', text: '🧾', onclick: (e) => { e.stopPropagation(); printReceipt(o); } }),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Oʻchirish', text: '🗑', onclick: async (e) => { e.stopPropagation(); if (await confirmBox(`${o.code} buyurtmani oʻchirasizmi?`)) run(() => A.deleteOrder(o.id), 'Oʻchirildi').then(refresh); } })),
      detail);
  }

  function orderChat(o) {
    const list = h('div', { class: 'chat-list' }, (o.messages || []).length
      ? o.messages.map((m) => h('div', { class: 'msg ' + (m.from === 'shop' ? 'me' : 'them') }, h('p', { text: m.text }), h('small', { text: `${m.from === 'shop' ? (m.by || 'Doʻkon') : o.name} · ${date(m.at)}` })))
      : [h('p', { class: 'help', text: 'Mijoz “Buyurtmam qayerda?” oynasidan yozsa, xabar shu yerda chiqadi. Siz ham birinchi boʻlib yozishingiz mumkin.' })]);
    const inp = h('input', { class: 'input', placeholder: 'Mijozga javob...', maxlength: 1000 });
    const send = h('button', { class: 'btn btn-sm', type: 'button', text: 'Yuborish' });
    const box = h('div', { class: 'chat field' }, h('label', { text: 'Mijoz bilan yozishma' }), list, h('div', { class: 'chat-in' }, inp, send));
    const go = async () => {
      if (!inp.value.trim()) return; send.disabled = true;
      try { const x = await A.reply(o.id, inp.value); Object.assign(o, x); box.replaceWith(orderChat(o)); toast('Yuborildi — mijoz kuzatish oynasida koʻradi'); }
      catch (e) { toast(e.message, true); send.disabled = false; }
    };
    send.addEventListener('click', go);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
    requestAnimationFrame(() => { list.scrollTop = list.scrollHeight; });
    return box;
  }

  /* ---------- Sharhlar ---------- */
  let revFilter = 'pending';
  function viewReviews() {
    const all = data.reviews || [];
    if (!all.length) { content.append(h('div', { class: 'empty-sm', text: 'Sharhlar shu yerda chiqadi. Mijoz buyurtmasi “Yetkazildi” boʻlgach, kuzatish oynasidan baho qoldira oladi. Tasdiqlangan sharhlar saytda koʻrinadi.' })); return; }
    if (!all.some((r) => r.status === revFilter)) revFilter = 'all';
    content.append(h('div', { class: 'filters' }, [['all', 'Hammasi']].concat(Object.entries(REVIEW_STATUS).map(([k, v]) => [k, v[0]])).map(([k, n]) =>
      h('button', { class: 'chip', type: 'button', 'aria-pressed': String(k === revFilter), onclick: () => { revFilter = k; refresh(); } }, n, h('small', { text: k === 'all' ? all.length : all.filter((r) => r.status === k).length })))));
    const list = all.filter((r) => revFilter === 'all' || r.status === revFilter);
    content.append(h('div', { class: 'list' }, list.map((r) => {
      const reply = h('textarea', { class: 'textarea', style: { minHeight: '60px' }, placeholder: 'Doʻkon javobi (saytda sharh ostida chiqadi)', maxlength: 1000 }); reply.value = r.reply || '';
      const set = (patch, msg) => run(() => A.setReview(r.id, Object.assign({ reply: reply.value }, patch)), msg).then(refresh);
      return h('div', { class: 'box rev-admin' },
        h('div', { class: 'box-head' },
          h('div', {}, h('h2', { text: r.productTitle }), h('small', { class: 'muted', text: `${r.name} · ${r.orderCode || ''} · ${date(r.created)}` })),
          h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center' } }, h('span', { class: 'stars-a', text: '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating) }), st(REVIEW_STATUS, r.status))),
        h('p', { style: { whiteSpace: 'pre-wrap' }, text: r.text }), reply,
        h('div', { class: 'row-end' },
          h('button', { class: 'btn btn-danger btn-sm', type: 'button', text: 'Oʻchirish', onclick: async () => { if (await confirmBox('Sharh butunlay oʻchirilsinmi?')) run(() => A.deleteReview(r.id), 'Oʻchirildi').then(refresh); } }),
          r.status !== 'hidden' ? h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Yashirish', onclick: () => set({ status: 'hidden' }, 'Yashirildi') }) : null,
          r.status === 'approved' ? h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Javobni saqlash', onclick: () => set({}, 'Saqlandi') })
            : h('button', { class: 'btn btn-sm', type: 'button', text: 'Tasdiqlash va saytga chiqarish', onclick: () => set({ status: 'approved' }, 'Saytga chiqdi') })));
    })));
  }

  /* ---------- Xodimlar ---------- */
  function viewStaff() {
    topActions.append(h('button', { class: 'btn btn-sm', type: 'button', text: '+ Xodim qoʻshish', onclick: () => editStaff(null) }));
    content.append(h('div', { class: 'box' }, h('div', { class: 'box-head' }, h('h2', { text: 'Rollar' })),
      h('div', { class: 'roles' },
        h('div', {}, h('b', { text: 'Egasi' }), h('small', { text: 'Hamma narsa: sozlamalar, xodimlar, jurnal. “admin” login bilan kiradi.' })),
        h('div', {}, h('b', { text: 'Menejer' }), h('small', { text: 'Buyurtma, soʻrov, sharh, mahsulot, turkum, video, promokod. Sozlamalar va xodimlarga kira olmaydi.' })),
        h('div', {}, h('b', { text: 'Operator' }), h('small', { text: 'Faqat buyurtmalar, soʻrovlar, sharhlar va mijozlar. Mahsulot va narxlarni oʻzgartira olmaydi.' })))));
    const list = data.staff || [];
    content.append(list.length ? h('div', { class: 'list' }, list.map((u) => h('div', { class: 'row', style: { gridTemplateColumns: '44px minmax(0,1.3fr) minmax(0,1fr) auto auto' } },
      h('span', { class: 'who-ava', text: u.name.slice(0, 1) }),
      h('div', {}, h('strong', { text: u.name }), h('small', { class: 'muted', text: '@' + u.login })),
      h('small', { class: 'muted', text: u.lastLogin ? 'Oxirgi kirish: ' + date(u.lastLogin) : 'Hali kirmagan' }),
      h('span', { class: 'st ' + (u.active ? 'ok' : 'bad'), text: (ROLES[u.role] || u.role) + (u.active ? '' : ' · oʻchirilgan') }),
      h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Tahrirlash', onclick: () => editStaff(u) }))))
      : h('div', { class: 'empty-sm', text: 'Hozircha xodim yoʻq. Buyurtmalarni boshqa odam ham qabul qilsa, unga alohida login bering — kim nima qilgani jurnalda koʻrinadi.' }));
  }
  function editStaff(u0) {
    const u = Object.assign({ login: '', name: '', role: 'operator', active: true }, u0 || {});
    const name = h('input', { class: 'input', id: 'st-n', value: u.name, maxlength: 60, autofocus: true });
    const login = h('input', { class: 'input', id: 'st-l', value: u.login, maxlength: 30, autocapitalize: 'none', placeholder: 'masalan: dilnoza' });
    const role = h('select', { class: 'select', id: 'st-r' }, [['operator', 'Operator'], ['manager', 'Menejer']].map(([v, n]) => h('option', { value: v, text: n, selected: v === u.role })));
    const pw = h('input', { class: 'input', id: 'st-p', type: 'text', autocomplete: 'new-password', placeholder: u0 ? 'Oʻzgartirmaslik uchun boʻsh qoldiring' : 'Kamida 8 belgi' });
    const gen = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Parol yaratish', onclick: () => { const a = new Uint32Array(3); crypto.getRandomValues(a); pw.value = [...a].map((x) => x.toString(36)).join('').slice(0, 12); } });
    const active = h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: u.active }), h('i'), 'Kira oladi');
    const err = h('p', { class: 'form-error', role: 'alert' });
    const form = h('form', { class: 'stack', novalidate: true },
      h('div', { class: 'form-grid' },
        h('div', { class: 'field' }, h('label', { for: 'st-n', text: 'Ismi' }), name),
        h('div', { class: 'field' }, h('label', { for: 'st-l', text: 'Login' }), login),
        h('div', { class: 'field' }, h('label', { for: 'st-r', text: 'Rol' }), role),
        h('div', { class: 'field' }, h('label', { for: 'st-p', text: 'Parol' }), pw, gen),
        u0 ? h('div', { class: 'field full' }, active, h('span', { class: 'help', text: 'Oʻchirilsa yoki parol oʻzgarsa, xodimning ochiq sessiyasi darhol yopiladi.' })) : null),
      err,
      h('div', { class: 'modal-foot' },
        h('div', {}, u0 ? h('button', { class: 'btn btn-danger btn-sm', type: 'button', text: 'Oʻchirish', onclick: async () => { if (await confirmBox(`${u0.name} oʻchirilsinmi?`)) { await run(() => A.deleteStaff(u0.id), 'Oʻchirildi'); m.close(); refresh(); } } }) : null),
        h('div', {}, h('button', { class: 'btn btn-ghost', type: 'button', text: 'Bekor qilish', onclick: () => m.close() }), h('button', { class: 'btn', type: 'submit', text: 'Saqlash' }))));
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); err.textContent = '';
      const out = { name: name.value.trim(), login: login.value.trim(), role: role.value };
      if (pw.value) out.password = pw.value;
      if (u0) { out.id = u0.id; if (active.querySelector('input').checked !== u0.active) out.active = active.querySelector('input').checked; }
      try { await A.saveStaff(out); toast(pw.value ? `Saqlandi. Login: ${out.login}, parol: ${pw.value} — xodimga yetkazing` : 'Saqlandi'); m.close(); refresh(); }
      catch (ex) { err.textContent = ex.message; }
    });
    const m = modal(u0 ? 'Xodimni tahrirlash' : 'Yangi xodim', form);
  }

  /* ---------- Amallar jurnali ---------- */
  function viewAudit() {
    const list = data.audit || [];
    if (!list.length) { content.append(h('div', { class: 'empty-sm', text: 'Kim qachon nima qilgani shu yerda yoziladi.' })); return; }
    content.append(h('p', { class: 'help', text: 'Admin paneldagi har bir oʻzgarish: kim, qachon, nima. Oxirgi 300 ta yozuv.' }),
      h('div', { class: 'audit' }, list.map((a) => h('div', { class: 'audit-row' },
        h('small', { class: 'muted', text: date(a.at) }),
        h('span', {}, h('b', { text: a.user }), h('small', { class: 'muted', text: ' · ' + (ROLES[a.role] || a.role) })),
        h('span', { text: a.action }),
        h('small', { class: 'muted', text: a.note || (a.target ? '#' + a.target : '') }))))); 
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
      h('div', { class: 'pbody' }, h('small', { class: 'muted', text: catName(p.category) + (p.featured ? ' · ★ tanlov' : '') }), h('b', { text: p.title }), h('span', { class: 'price', style: { fontSize: '16px' }, text: p.price ? money(p.price) : 'Narxi kelishiladi' }),
        p.stock != null ? h('small', { style: { color: p.stock <= 3 ? '#FFB867' : 'var(--faint)' }, text: p.stock ? `Omborda: ${p.stock} dona` : 'Tugagan' }) : null,
        h('div', { class: 'pfoot' }, tg, h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Tahrirlash', onclick: () => editProduct(p) }))));
  }
  function editProduct(p0) {
    const isNew = !p0;
    const p = JSON.parse(JSON.stringify(p0 || { title: '', category: (data.categories[0] || {}).id, price: 0, oldPrice: 0, description: '', specs: '', badges: ['new'], images: [], colors: [], model: '', modelColor: '#FF7A1A', instagram: '', active: true, featured: false, stock: null }));
    const f = {};
    const inp = (k, attrs) => { const e = h(attrs && attrs.tag === 'textarea' ? 'textarea' : 'input', Object.assign({ class: attrs && attrs.tag === 'textarea' ? 'textarea' : 'input', id: 'p-' + k }, attrs || {}, { tag: null })); e.value = p[k] == null ? '' : p[k]; f[k] = e; return e; };
    const fld = (label, el, full, help) => h('div', { class: 'field' + (full ? ' full' : '') }, h('label', { for: el.id, text: label }), el, help ? h('span', { class: 'help', text: help }) : null);
    const cat = h('select', { class: 'select', id: 'p-cat' }, data.categories.map((c) => h('option', { value: c.id, text: c.name, selected: c.id === p.category })));
    const badges = h('div', { class: 'checks' }, Object.entries(BADGES).map(([k, n]) => h('label', { class: 'check-pill' }, h('input', { type: 'checkbox', value: k, checked: (p.badges || []).includes(k) }), n)));
    const imgs = h('div', { class: 'imgs' });
    let dragFrom = -1;
    const paintImgs = () => {
      imgs.replaceChildren(...p.images.map((src, i) => {
        const el = h('div', { class: 'im', draggable: 'true', title: 'Tartibni oʻzgartirish uchun suring' }, h('img', { src, alt: '' }), i === 0 ? h('span', { class: 'first', text: 'Asosiy' }) : null,
          h('div', { class: 'tools' },
            i > 0 ? h('button', { type: 'button', title: 'Asosiy qilish', 'aria-label': 'Asosiy qilish', text: '★', onclick: () => { p.images.unshift(p.images.splice(i, 1)[0]); paintImgs(); } }) : null,
            h('button', { type: 'button', title: 'Olib tashlash', 'aria-label': 'Olib tashlash', text: '✕', onclick: () => { p.images.splice(i, 1); paintImgs(); } })));
        el.addEventListener('dragstart', () => { dragFrom = i; el.classList.add('dragging'); });
        el.addEventListener('dragend', () => el.classList.remove('dragging'));
        el.addEventListener('dragover', (e) => e.preventDefault());
        el.addEventListener('drop', (e) => { e.preventDefault(); if (dragFrom < 0 || dragFrom === i) return; const [x] = p.images.splice(dragFrom, 1); p.images.splice(i, 0, x); dragFrom = -1; paintImgs(); });
        return el;
      }),
      h('button', { class: 'add', type: 'button', text: '+ Rasm qoʻshish', onclick: async () => { const u = await pickImages(true); p.images.push(...u); paintImgs(); } }));
    };
    paintImgs();
    // Rasmlarni kompyuterdan to'g'ridan-to'g'ri tashlash
    imgs.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); imgs.classList.add('over'); } });
    imgs.addEventListener('dragleave', () => imgs.classList.remove('over'));
    imgs.addEventListener('drop', async (e) => {
      if (!e.dataTransfer.files.length) return; e.preventDefault(); imgs.classList.remove('over');
      for (const file of [...e.dataTransfer.files].filter((x) => /^image\//.test(x.type))) { try { p.images.push((await A.upload(file)).url); } catch (ex) { toast(ex.message, true); } }
      paintImgs();
    });
    const model = h('select', { class: 'select', id: 'p-model' }, [['', 'Yoʻq'], ['lamp', 'Spiral svetilnik'], ['lampTall', 'Uzun svetilnik'], ['pawn', 'Shaxmat figurasi'], ['keychain', 'Brelok']].map(([v, n]) => h('option', { value: v, text: n, selected: v === (p.model || '') })));
    const mcolor = h('input', { type: 'color', id: 'p-mcolor', class: 'input', style: { padding: '4px', height: '50px' }, value: p.modelColor || '#FF7A1A' });
    const active = h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: p.active !== false }), h('i'), 'Saytda koʻrinadi');
    const featured = h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: !!p.featured }), h('i'), '“Ustaxona tanlovi”da koʻrsatish');
    const stockOn = h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: p.stock != null }), h('i'), 'Qoldiqni hisoblash');
    const stockIn = h('input', { class: 'input', id: 'p-stock', inputmode: 'numeric', value: p.stock != null ? p.stock : '', placeholder: 'Nechta bor', disabled: p.stock == null });
    stockOn.querySelector('input').addEventListener('change', (e) => { stockIn.disabled = !e.target.checked; if (e.target.checked && stockIn.value === '') stockIn.value = '10'; });
    const tr = h('details', { class: 'tr-box full' }, h('summary', { text: 'Rus va ingliz tilidagi nom va tavsif' }),
      h('div', { class: 'form-grid' },
        fld('Nomi (rus)', inp('title_ru', { maxlength: 120 })), fld('Nomi (ingliz)', inp('title_en', { maxlength: 120 })),
        fld('Tavsif (rus)', inp('description_ru', { tag: 'textarea', maxlength: 2000 })), fld('Tavsif (ingliz)', inp('description_en', { tag: 'textarea', maxlength: 2000 }))));
    if (p.title_ru || p.title_en) tr.open = false;
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
        tr,
        fld('Xususiyatlar', inp('specs', { maxlength: 200, placeholder: '220V · 3W · 20 sm' })),
        fld('Ranglar (vergul bilan)', (() => { const e = h('input', { class: 'input', id: 'p-colors', placeholder: 'Oq, Qora, Toʻq sariq' }); e.value = (p.colors || []).join(', '); f.colors = e; return e; })()),
        h('div', { class: 'field full' }, h('span', { class: 'label', text: 'Belgilar' }), badges),
        h('div', { class: 'field full' }, h('span', { class: 'label', text: 'Rasmlar — suring yoki kompyuterdan tashlang. Birinchisi kartochkada chiqadi' }), imgs),
        fld('3D koʻrinish', model, false, 'Mahsulot oynasida aylanuvchi 3D model chiqadi'),
        fld('3D model rangi', mcolor),
        h('div', { class: 'field' }, stockOn, stockIn),
        h('div', { class: 'field', style: { gap: '14px' } }, active, featured)),
      err,
      h('div', { class: 'modal-foot' },
        h('div', {}, !isNew ? h('button', { class: 'btn btn-danger btn-sm', type: 'button', text: 'Oʻchirish', onclick: async () => { if (await confirmBox(`“${p.title}” oʻchirilsinmi?`)) { await run(() => A.deleteProduct(p.id), 'Oʻchirildi'); m.close(); refresh(); } } }) : null,
          !isNew ? h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Nusxa olish', onclick: async () => { const c = Object.assign({}, p, { title: p.title + ' (nusxa)', created: Date.now() }); delete c.id; await run(() => A.saveProduct(c), 'Nusxa yaratildi'); m.close(); refresh(); } }) : null),
        h('div', {}, h('button', { class: 'btn btn-ghost', type: 'button', text: 'Bekor qilish', onclick: () => m.close() }), save)));
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); err.textContent = '';
      const out = {
        title: f.title.value.trim(), category: cat.value, instagram: f.instagram.value.trim(), price: num(f.price.value), oldPrice: num(f.oldPrice.value),
        description: f.description.value.trim(), specs: f.specs.value.trim(), colors: f.colors.value.split(',').map((x) => x.trim()).filter(Boolean),
        title_ru: f.title_ru.value.trim(), title_en: f.title_en.value.trim(), description_ru: f.description_ru.value.trim(), description_en: f.description_en.value.trim(),
        badges: [...badges.querySelectorAll('input:checked')].map((x) => x.value), images: p.images, model: model.value, modelColor: mcolor.value,
        active: active.querySelector('input').checked, featured: featured.querySelector('input').checked,
        stock: stockOn.querySelector('input').checked ? num(stockIn.value) : null,
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
        const bind = (key, ph) => { const e = h('input', { class: 'input', value: c[key] || '', 'aria-label': ph, placeholder: ph }); e.addEventListener('input', () => { c[key] = e.value; }); return e; };
        const id = h('input', { class: 'input', value: c.id, 'aria-label': 'Kodi', placeholder: 'kodi (lotin harf)', disabled: used > 0 && !c._new, title: used ? 'Mahsulotlar bogʻlangan, kodni oʻzgartirib boʻlmaydi' : '' }); id.addEventListener('input', () => { c.id = id.value.toLowerCase().replace(/[^a-z0-9-]/g, ''); });
        const color = h('input', { type: 'color', class: 'color-in', value: c.color || '#FF7A1A', 'aria-label': 'Filament rangi', title: 'Turkum rangi' }); color.addEventListener('input', () => { c.color = color.value; });
        return h('div', { class: 'cat-row v2' },
          h('button', { class: 'cover', type: 'button', title: 'Muqova rasmi', onclick: async () => { const u = await pickImages(false); if (u[0]) { c.cover = u[0]; paint(); } } }, c.cover ? h('img', { src: c.cover, alt: '' }) : 'Rasm'),
          h('div', { class: 'cat-fields' },
            h('div', { class: 'cat-line' }, bind('name', 'Nomi'), bind('name_ru', 'Nomi (rus)'), bind('name_en', 'Nomi (ingliz)'), id),
            h('div', { class: 'cat-line' }, bind('blurb', 'Qisqa tavsif'), bind('blurb_ru', 'Tavsif (rus)'), bind('blurb_en', 'Tavsif (ingliz)'), color)),
          h('div', { class: 'row-actions' },
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Yuqoriga', text: '↑', disabled: i === 0, onclick: () => { [list[i - 1], list[i]] = [list[i], list[i - 1]]; paint(); } }),
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Pastga', text: '↓', disabled: i === list.length - 1, onclick: () => { [list[i + 1], list[i]] = [list[i], list[i + 1]]; paint(); } }),
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Oʻchirish', text: '🗑', onclick: () => {
              if (used) { toast(`Bu turkumda ${used} ta mahsulot bor. Avval ularni boshqa turkumga oʻtkazing`, true); return; }
              list.splice(i, 1); paint();
            } })));
      }));
    };
    paint();
    topActions.append(h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: '+ Turkum', onclick: () => { list.push({ id: 'yangi-' + (list.length + 1), name: 'Yangi turkum', blurb: '', cover: '', color: '#7CC6F2', _new: true }); paint(); } }),
      h('button', { class: 'btn btn-sm', type: 'button', text: 'Saqlash', onclick: async () => {
        const out = list.map((c, i) => ({ id: c.id, name: (c.name || '').trim(), name_ru: (c.name_ru || '').trim(), name_en: (c.name_en || '').trim(), blurb: (c.blurb || '').trim(), blurb_ru: (c.blurb_ru || '').trim(), blurb_en: (c.blurb_en || '').trim(), cover: c.cover || '', color: c.color || '#FF7A1A', sort: i + 1 }));
        if (out.some((c) => !c.name || !c.id)) return toast('Har bir turkumning nomi va kodi boʻlsin', true);
        if (new Set(out.map((c) => c.id)).size !== out.length) return toast('Turkum kodlari takrorlanmasin', true);
        await run(() => A.saveCategories(out), 'Turkumlar saqlandi'); refresh();
      } }));
    content.append(h('p', { class: 'help', text: 'Muqova rasmi va rang bosh sahifadagi “Kataloglar” plitkasida chiqadi. Tartibni oʻqlar bilan oʻzgartiring, keyin “Saqlash”ni bosing.' }), box);
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
    const fld = (k, label, attrs, help) => { const e = h(attrs && attrs.tag === 'textarea' ? 'textarea' : 'input', Object.assign({ class: attrs && attrs.tag === 'textarea' ? 'textarea' : 'input', id: 's-' + k }, attrs || {}, { tag: null, full: null })); e.value = s[k] == null ? '' : s[k]; f[k] = e; return h('div', { class: 'field' + (attrs && attrs.full ? ' full' : '') }, h('label', { for: e.id, text: label }), e, help ? h('span', { class: 'help', text: help }) : null); };
    const tri = (k, label, attrs, help) => h('div', { class: 'tri full' }, fld(k, label, attrs, help), fld(k + '_ru', label + ' (rus)', attrs), fld(k + '_en', label + ' (ingliz)', attrs));
    const form = h('form', { class: 'stack', novalidate: true },
      h('div', { class: 'box' }, h('div', { class: 'box-head' }, h('h2', { text: 'Aloqa' })),
        h('div', { class: 'form-grid' },
          fld('phone', 'Telefon', { placeholder: '+998 99 700 00 71' }),
          fld('instagram', 'Instagram (username)', { placeholder: '3durbanprint' }),
          fld('telegram', 'Telegram (username)', { placeholder: 'urbanprint_uz' }, 'Boʻsh qolsa saytda koʻrinmaydi'),
          fld('city', 'Shahar / manzil'),
          fld('workHours', 'Ish vaqti', { placeholder: 'Har kuni 10:00–20:00' }),
          fld('followers', 'Kuzatuvchilar soni', { placeholder: '1 900+' }))),
      h('div', { class: 'box' }, h('div', { class: 'box-head' }, h('h2', { text: 'Yetkazib berish' })),
        h('div', { class: 'form-grid' },
          fld('deliveryFee', 'Yetkazish narxi, soʻm', { inputmode: 'numeric' }),
          fld('freeFrom', 'Shu summadan bepul, soʻm', { inputmode: 'numeric' }, '0 boʻlsa bepul yetkazish yoʻq'),
          fld('pickupAddress', 'Olib ketish manzili', { full: true }),
          tri('delivery', 'Muddat matni'))),
      h('div', { class: 'box' }, h('div', { class: 'box-head' }, h('h2', { text: 'Bosh ekran va eʼlon' })),
        h('div', { class: 'form-grid' },
          tri('heroKicker', 'Ustki yozuv'),
          tri('heroTitle', 'Katta sarlavha'),
          tri('heroText', 'Sarlavha ostidagi matn', { tag: 'textarea' }),
          tri('announce', 'Eng tepadagi eʼlon', {}, 'Boʻsh qolsa koʻrinmaydi'))),
      h('div', { class: 'row-end' }, h('button', { class: 'btn', type: 'submit', text: 'Saqlash' })));
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); const out = {};
      Object.keys(f).forEach((k) => { out[k] = ['deliveryFee', 'freeFrom'].includes(k) ? Number(String(f[k].value).replace(/\D/g, '')) || 0 : f[k].value.trim(); });
      await run(() => A.saveSettings(out), 'Sozlamalar saqlandi'); refresh();
    });
    content.append(form);
    if (Store.mode === 'demo') content.append(h('div', { class: 'box' }, h('div', { class: 'box-head' }, h('h2', { text: 'Demo maʼlumotlar' })),
      h('p', { class: 'muted', text: 'Barcha oʻzgarishlarni oʻchirib, boshlangʻich mahsulotlar va videolarni qaytarish.' }),
      h('div', { class: 'row-end' }, h('button', { class: 'btn btn-danger btn-sm', type: 'button', text: 'Demo maʼlumotni tiklash', onclick: async () => { if (await confirmBox('Barcha demo oʻzgarishlar oʻchiriladi. Davom etasizmi?', 'Tiklash')) { await A.reset(); toast('Tiklandi'); refresh(); } } }))));
    else content.append(h('div', { class: 'box' }, h('div', { class: 'box-head' }, h('h2', { text: 'Toʻlov va Telegram' })),
      h('p', { class: 'muted', text: 'Payme, Click va Telegram kalitlari xavfsizlik uchun server muhit oʻzgaruvchilarida saqlanadi (README’da batafsil). Holatini Bosh sahifada koʻrasiz.' })));
  }

  /* ---------- Promokodlar ---------- */
  function viewPromos() {
    topActions.append(h('button', { class: 'btn btn-sm', type: 'button', text: '+ Promokod', onclick: () => editPromo(null) }));
    if (!data.promos.length) { content.append(h('div', { class: 'empty-sm', text: 'Promokod yoʻq. Masalan, birinchi xarid uchun 10% chegirma yarating.' })); return; }
    const today = new Date().toISOString().slice(0, 10);
    content.append(h('div', { class: 'list' }, data.promos.map((p) => {
      const expired = p.expires && p.expires < today, full = p.maxUses && p.uses >= p.maxUses;
      const tg = h('label', { class: 'toggle', title: 'Faol' }, h('input', { type: 'checkbox', checked: p.active !== false }), h('i'));
      tg.querySelector('input').addEventListener('change', (e) => run(() => A.savePromo(Object.assign({}, p, { active: e.target.checked })), 'Saqlandi').then(refresh));
      return h('div', { class: 'row promo-row-a' },
        h('b', { class: 'promo-code', text: p.code }),
        h('div', {}, h('strong', { text: p.kind === 'sum' ? `−${money(p.value)}` : `−${p.value}%` }), h('small', { text: p.minOrder ? ` · ${money(p.minOrder)} dan` : ' · har qanday summaga' })),
        h('small', { class: 'muted', text: `Ishlatildi: ${p.uses || 0}${p.maxUses ? ' / ' + p.maxUses : ''}${p.expires ? ' · ' + p.expires + ' gacha' : ''}` }),
        expired || full ? h('span', { class: 'st bad', text: expired ? 'Muddati tugagan' : 'Limit tugagan' }) : h('span', { class: 'st ' + (p.active !== false ? 'ok' : 'warn'), text: p.active !== false ? 'Faol' : 'Oʻchiq' }),
        h('div', { class: 'row-actions' }, tg,
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Tahrirlash', text: '✎', onclick: () => editPromo(p) }),
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Oʻchirish', text: '🗑', onclick: async () => { if (await confirmBox(`${p.code} oʻchirilsinmi?`)) run(() => A.deletePromo(p.id), 'Oʻchirildi').then(refresh); } })));
    })));
  }
  function editPromo(p0) {
    const p = Object.assign({ code: '', kind: 'percent', value: 10, minOrder: 0, maxUses: 0, expires: '', active: true }, p0 || {});
    const code = h('input', { class: 'input', id: 'pr-code', value: p.code, placeholder: 'YOZ2026', style: { textTransform: 'uppercase' }, autofocus: true });
    const kind = h('select', { class: 'select', id: 'pr-kind' }, h('option', { value: 'percent', text: 'Foiz (%)', selected: p.kind !== 'sum' }), h('option', { value: 'sum', text: 'Summa (soʻm)', selected: p.kind === 'sum' }));
    const val = h('input', { class: 'input', id: 'pr-val', inputmode: 'numeric', value: p.value });
    const min = h('input', { class: 'input', id: 'pr-min', inputmode: 'numeric', value: p.minOrder || '' , placeholder: '0' });
    const max = h('input', { class: 'input', id: 'pr-max', inputmode: 'numeric', value: p.maxUses || '', placeholder: 'cheksiz' });
    const exp = h('input', { class: 'input', id: 'pr-exp', type: 'date', value: p.expires || '' });
    const err = h('p', { class: 'form-error', role: 'alert' });
    const num = (v) => Number(String(v).replace(/\D/g, '')) || 0;
    const form = h('form', { class: 'stack', novalidate: true },
      h('div', { class: 'form-grid' },
        h('div', { class: 'field full' }, h('label', { for: 'pr-code', text: 'Kod' }), code),
        h('div', { class: 'field' }, h('label', { for: 'pr-kind', text: 'Turi' }), kind), h('div', { class: 'field' }, h('label', { for: 'pr-val', text: 'Qiymati' }), val),
        h('div', { class: 'field' }, h('label', { for: 'pr-min', text: 'Minimal xarid, soʻm' }), min), h('div', { class: 'field' }, h('label', { for: 'pr-max', text: 'Necha marta ishlatiladi' }), max),
        h('div', { class: 'field full' }, h('label', { for: 'pr-exp', text: 'Amal qilish muddati (ixtiyoriy)' }), exp)),
      err, h('div', { class: 'row-end' }, h('button', { class: 'btn', type: 'submit', text: 'Saqlash' })));
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); err.textContent = '';
      const out = { code: code.value.trim(), kind: kind.value, value: num(val.value), minOrder: num(min.value), maxUses: num(max.value), expires: exp.value, active: p.active !== false };
      if (p0) out.id = p0.id;
      try { await A.savePromo(out); toast('Saqlandi'); m.close(); refresh(); } catch (ex) { err.textContent = ex.message; }
    });
    const m = modal(p0 ? 'Promokodni tahrirlash' : 'Yangi promokod', form);
  }

  /* ---------- Mijozlar (buyurtmalardan yig'iladi) ---------- */
  function viewCustomers() {
    const map = new Map();
    data.orders.forEach((o) => {
      const c = map.get(o.phone) || { phone: o.phone, name: o.name, orders: 0, spent: 0, last: 0, address: '' };
      c.orders++; if (COUNTED(o)) c.spent += o.total;
      if (o.created > c.last) { c.last = o.created; c.name = o.name; c.address = o.address || c.address; }
      map.set(o.phone, c);
    });
    data.requests.forEach((r) => { if (!map.has(r.phone)) map.set(r.phone, { phone: r.phone, name: r.name, orders: 0, spent: 0, last: r.created, address: '', requestOnly: true }); });
    const list = [...map.values()].sort((a, b) => b.spent - a.spent || b.last - a.last);
    if (!list.length) { content.append(h('div', { class: 'empty-sm', text: 'Mijozlar birinchi buyurtma yoki soʻrovdan keyin shu yerda paydo boʻladi.' })); return; }
    content.append(h('p', { class: 'help', text: `${list.length} ta mijoz. Roʻyxat buyurtma va soʻrovlardagi telefon raqamlardan tuziladi.` }),
      h('div', { class: 'list' }, list.map((c, i) => h('div', { class: 'row', style: { gridTemplateColumns: '44px minmax(0,1.4fr) minmax(0,1fr) auto auto' } },
        h('span', { class: 'id', text: i + 1 }),
        h('div', {}, h('strong', { text: c.name }), h('a', { class: 'tel', href: 'tel:+' + c.phone, text: fmtPhone(c.phone) })),
        h('small', { class: 'muted', text: c.address || (c.requestOnly ? 'Faqat soʻrov yuborgan' : '') }),
        h('div', { style: { textAlign: 'right' } }, h('b', { text: money(c.spent) }), h('small', { class: 'muted', style: { display: 'block' }, text: `${c.orders} ta buyurtma · ${date(c.last)}` })),
        h('a', { class: 'btn btn-ghost btn-sm', href: 'tel:+' + c.phone, text: 'Qoʻngʻiroq' })))));
  }

  const VIEWS = { dash: viewDash, orders: viewOrders, requests: viewRequests, reviews: viewReviews, products: viewProducts, categories: viewCategories, reels: viewReels, promos: viewPromos, customers: viewCustomers, staff: viewStaff, audit: viewAudit, settings: viewSettings };

  async function boot() {
    await Store.detect();
    const me = await A.me();
    if (!me) return showLogin();
    if (!side) shell();
    route();
  }
  boot();
})();
