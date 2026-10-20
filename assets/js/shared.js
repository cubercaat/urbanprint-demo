'use strict';
/* Brauzer va server uchun umumiy qoidalar: narx hisoblash, promokod, holatlar.
   Bitta joyda yozilgani uchun saytdagi va serverdagi summa doim bir xil chiqadi. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.Shared = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const clean = (s, max) => String(s == null ? '' : s).trim().slice(0, max || 500);
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
  const money = (n, cur) => new Intl.NumberFormat('ru-RU').format(Math.round(n || 0)).replace(/\s/g, ' ') + ' ' + (cur || 'soʻm');

  const ORDER_STATUS = {
    pending_payment: ['Toʻlov kutilmoqda', 'warn'],
    new: ['Yangi', 'warn'],
    paid: ['Toʻlandi', 'ok'],
    confirmed: ['Tasdiqlandi', 'info'],
    printing: ['Chop etilmoqda', 'info'],
    shipped: ['Yoʻlda', 'info'],
    done: ['Yetkazildi', 'ok'],
    cancelled: ['Bekor qilindi', 'bad'],
  };
  const REQUEST_STATUS = { new: ['Yangi', 'warn'], quoted: ['Narx aytildi', 'info'], accepted: ['Qabul qilindi', 'ok'], done: ['Bajarildi', 'ok'], rejected: ['Rad etildi', 'bad'] };
  const BADGES = { new: 'Yangi', hit: 'Xit', sale: 'Chegirma', custom: 'Buyurtma asosida' };
  const SETTINGS_TEXT = ['brand', 'phone', 'telegram', 'instagram', 'city', 'pickupAddress', 'workHours',
    'heroKicker', 'heroKicker_ru', 'heroKicker_en', 'heroTitle', 'heroTitle_ru', 'heroTitle_en', 'heroText', 'heroText_ru', 'heroText_en',
    'followers', 'announce', 'announce_ru', 'announce_en', 'delivery', 'delivery_ru', 'delivery_en'];

  function applyPromo(p, subtotal, today) {
    if (!p || p.active === false) return { error: 'Promokod topilmadi' };
    const day = today || new Date().toISOString().slice(0, 10);
    if (p.expires && p.expires < day) return { error: 'Promokod muddati tugagan' };
    if (p.maxUses && (p.uses || 0) >= p.maxUses) return { error: 'Promokod limiti tugagan' };
    if (subtotal < (p.minOrder || 0)) return { error: `Promokod ${money(p.minOrder)} dan ortiq xaridga amal qiladi` };
    const discount = Math.min(subtotal, p.kind === 'sum' ? p.value : Math.round(subtotal * p.value / 100));
    return { discount };
  }

  /* Buyurtmani tekshiradi va summasini hisoblaydi. */
  function priceOrder({ input, settings, getProduct, findPromo }) {
    const b = input || {};
    const name = clean(b.name, 80), phone = normPhone(b.phone), note = clean(b.note, 600);
    const delivery = b.delivery === 'pickup' ? 'pickup' : 'courier';
    const address = delivery === 'pickup' ? '' : clean(b.address, 400);
    if (name.length < 2) return { error: 'Ismingizni yozing' };
    if (!phone) return { error: 'Telefon raqamni toʻgʻri yozing, masalan 90 123 45 67' };
    if (delivery === 'courier' && address.length < 5) return { error: 'Yetkazib berish manzilini yozing' };
    let location = null;
    if (b.location && isFinite(b.location.lat) && isFinite(b.location.lng)) {
      const lat = Number(b.location.lat), lng = Number(b.location.lng);
      if (lat > 36 && lat < 46.5 && lng > 55 && lng < 74) location = { lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5 };
    }
    const items = []; const qtyById = {};
    for (const it of Array.isArray(b.items) ? b.items.slice(0, 50) : []) {
      const p = getProduct(Number(it.id));
      if (!p || p.active === false) continue;
      const qty = Math.max(1, Math.min(999, parseInt(it.qty, 10) || 1));
      qtyById[p.id] = (qtyById[p.id] || 0) + qty;
      if (p.stock != null && qtyById[p.id] > p.stock) return { error: p.stock ? `“${p.title}” omborda faqat ${p.stock} dona bor` : `“${p.title}” hozir tugagan` };
      items.push({ id: p.id, title: p.title, price: p.price, qty, color: clean(it.color, 40), image: (p.images || [])[0] || '' });
    }
    if (!items.length) return { error: 'Savat boʻsh' };
    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    let discount = 0, promo = '';
    if (b.promo) {
      const p = findPromo(b.promo);
      const r = applyPromo(p, subtotal);
      if (r.error) return { error: r.error };
      discount = r.discount; promo = p.code;
    }
    const s = settings || {};
    const after = subtotal - discount;
    const fee = delivery === 'pickup' ? 0 : (s.freeFrom && after >= s.freeFrom ? 0 : (s.deliveryFee || 0));
    return { order: { name, phone, delivery, address, location, note, items, subtotal, discount, promo, fee, total: after + fee } };
  }

  function ordersCsv(orders) {
    const q = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const head = ['Raqam', 'Sana', 'Holat', 'Ism', 'Telefon', 'Yetkazish', 'Manzil', 'Mahsulotlar', 'Mahsulotlar summasi', 'Chegirma', 'Promokod', 'Yetkazish narxi', 'Jami', 'Toʻlov', 'Izoh'];
    const rows = orders.map((o) => [o.code, new Date(o.created).toISOString().replace('T', ' ').slice(0, 16), (ORDER_STATUS[o.status] || [o.status])[0], o.name, '+' + o.phone,
      o.delivery === 'pickup' ? 'Olib ketish' : 'Kuryer', o.address, o.items.map((i) => `${i.title}${i.color ? ' (' + i.color + ')' : ''} x${i.qty}`).join('; '),
      o.subtotal, o.discount || 0, o.promo || '', o.fee || 0, o.total, ({ cash: 'Naqd/karta', payme: 'Payme', click: 'Click' })[o.payment] || '', o.note || '']);
    return [head].concat(rows).map((r) => r.map(q).join(';')).join('\r\n');
  }

  /* ---------- Rang nomidan filament rangi (3D modelni jonli bo'yash uchun) ----------
     Admin rang nomiga "#RRGGBB" yozsa (masalan "Feruza #30C9B0"), aynan shu rang olinadi. */
  const COLOR_WORDS = [
    [/#([0-9a-f]{6})\b/i, null],
    [/to[ʻ'‘`]?q sariq|оранж|orange|apelsin/i, '#FF7A1A'], [/oltin|золот|gold/i, '#D4A537'], [/sariq|жёлт|желт|yellow/i, '#F5C518'],
    [/qizil|красн|red/i, '#E0362C'], [/pushti|розов|pink/i, '#F07AA8'], [/binafsha|фиолет|purple|violet/i, '#7B5CD6'],
    [/feruza|бирюз|turquoise|teal/i, '#30C9B0'], [/ko[ʻ'‘`]?k|син|голуб|blue/i, '#2F7BE0'], [/yashil|зел|green/i, '#5DBB3A'],
    [/krem|кремов|cream|beige|bej/i, '#E8D9B5'], [/jigarrang|корич|brown/i, '#8A5A3B'], [/kulrang|сер|grey|gray/i, '#8A9097'],
    [/qora|чёрн|черн|black/i, '#25282C'], [/oq|бел|white/i, '#F2EFE8'],
  ];
  function colorHex(name) {
    const s = String(name || '');
    // "Qora-yashil" kabi nomlarda birinchi aytilgan rang olinadi
    let best = null, at = Infinity;
    for (const [re, hex] of COLOR_WORDS) {
      const m = re.exec(s); if (!m) continue;
      if (!hex) return '#' + m[1].toUpperCase();
      if (m.index < at) { at = m.index; best = hex; }
    }
    return best;
  }
  const colorLabel = (name) => String(name || '').replace(/\s*#[0-9a-f]{6}\b/i, '').trim();

  /* ---------- Sharhlar ---------- */
  const REVIEW_STATUS = { pending: ['Tekshiruvda', 'warn'], approved: ['Saytda', 'ok'], hidden: ['Yashirilgan', 'bad'] };
  /* Faqat yetkazilgan buyurtmadagi mahsulotga, bir marta baho berish mumkin */
  function checkReview({ order, phone, productId, rating, text, name }) {
    if (!order || order.phone !== normPhone(phone)) return { error: 'Buyurtma topilmadi. Raqam va telefonni tekshiring' };
    if (order.status !== 'done') return { error: 'Baho buyurtma yetkazilgandan keyin qoldiriladi' };
    const item = order.items.find((i) => i.id === Number(productId));
    if (!item) return { error: 'Bu mahsulot buyurtmada yoʻq' };
    if ((order.reviewed || []).includes(item.id)) return { error: 'Bu mahsulotga allaqachon baho bergansiz' };
    const r = Math.round(Number(rating));
    if (!(r >= 1 && r <= 5)) return { error: 'Yulduzchalardan birini tanlang' };
    const t = clean(text, 1200);
    if (t.length < 3) return { error: 'Bir-ikki soʻz yozib qoldiring' };
    // Ismdan faqat birinchi soʻz chiqadi (familiya saytda koʻrinmaydi)
    const nm = clean(name || order.name, 40).split(/\s+/)[0] || 'Mijoz';
    return { review: { productId: item.id, productTitle: item.title, orderCode: order.code, rating: r, text: t, name: nm, status: 'pending', reply: '', created: Date.now() } };
  }
  function ratings(reviews) {
    const out = {};
    reviews.forEach((r) => { if (r.status !== 'approved') return; const o = out[r.productId] || (out[r.productId] = { sum: 0, count: 0 }); o.sum += r.rating; o.count++; });
    Object.values(out).forEach((o) => { o.avg = Math.round(o.sum / o.count * 10) / 10; delete o.sum; });
    return out;
  }
  const publicReview = (r) => ({ id: r.id, productId: r.productId, productTitle: r.productTitle, name: r.name, rating: r.rating, text: r.text, reply: r.reply || '', created: r.created });

  /* ---------- Buyurtma bo'yicha yozishma ---------- */
  function addMessage(order, from, text, by) {
    const t = clean(text, 1000);
    if (t.length < 1) return { error: 'Xabar boʻsh' };
    order.messages = (order.messages || []).concat({ from, text: t, by: by || '', at: Date.now() }).slice(-200);
    order.unread = from === 'customer';
    return { order };
  }
  // Mijozga ko'rsatiladigan buyurtma ma'lumoti (ichki eslatmalarsiz)
  const publicOrder = (o) => ({ code: o.code, status: o.status, history: o.history || [], items: o.items, total: o.total, fee: o.fee, discount: o.discount, created: o.created,
    delivery: o.delivery, payment: o.payment, messages: (o.messages || []).map((m) => ({ from: m.from, text: m.text, at: m.at })), reviewed: o.reviewed || [] });

  /* ---------- Xodimlar va ruxsatlar ---------- */
  const ROLES = { owner: 'Egasi', manager: 'Menejer', operator: 'Operator' };
  const PERMS = {
    owner: ['*'],
    manager: ['dash', 'orders', 'requests', 'reviews', 'customers', 'products', 'categories', 'reels', 'promos'],
    operator: ['dash', 'orders', 'requests', 'reviews', 'customers'],
  };
  const can = (role, mod) => { const p = PERMS[role] || []; return p.includes('*') || p.includes(mod); };

  return { clean, normPhone, fmtPhone, money, ORDER_STATUS, REQUEST_STATUS, BADGES, SETTINGS_TEXT, applyPromo, priceOrder, ordersCsv,
    colorHex, colorLabel, REVIEW_STATUS, checkReview, ratings, publicReview, addMessage, publicOrder, ROLES, PERMS, can };
});
