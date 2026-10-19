'use strict';
(function () {
  const { h, toast, modal } = UI;
  const { money, fmtPhone, BADGES } = Store;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const $ = (id) => document.getElementById(id);
  const NO3D = /[?&]no3d\b/.test(location.search);
  const ICON_IG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>';
  const ICON_PLUS = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
  const ICON_PLAY = '<svg width="26" height="26" viewBox="0 0 24 24" fill="#fff"><path d="M8 5.5v13l11-6.5z"/></svg>';

  let S = {}; let products = []; let categories = []; let reels = [];

  /* ---------- Sarlavha, menyu ---------- */
  const head = $('head');
  const onScroll = () => head.classList.toggle('solid', scrollY > 24);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  const nav = $('nav'), menuBtn = $('menuBtn');
  menuBtn.addEventListener('click', () => { const o = !nav.classList.contains('open'); nav.classList.toggle('open', o); menuBtn.setAttribute('aria-expanded', String(o)); });
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) { nav.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); } });
  $('year').textContent = new Date().getFullYear();

  /* ---------- Bosh ekran sarlavhasi: so'zlar navbat bilan ko'tariladi ---------- */
  function splitTitle(text) {
    const el = $('heroTitle'); el.replaceChildren();
    const words = text.split(/\s+/).filter(Boolean);
    let accentIdx = words.findIndex((w) => /qatlam/i.test(w));
    if (accentIdx < 0) accentIdx = words.length - 1;
    words.forEach((w, i) => {
      const inner = h('span', { class: i === accentIdx ? 'accent' : '', text: w, style: { animationDelay: (0.15 + i * 0.08) + 's' } });
      el.append(h('span', { class: 'w' }, inner), ' ');
    });
  }
  splitTitle($('heroTitle').textContent);

  /* ---------- Fon: oqib turuvchi filament chiziqlari ---------- */
  (function heroLines() {
    const cv = $('heroLines'); const ctx = cv.getContext('2d'); const hero = cv.parentElement;
    let W = 0, H = 0, running = true, mx = 0.5; const t0 = performance.now();
    const embers = Array.from({ length: 34 }, () => ({ x: Math.random(), y: Math.random(), s: 0.5 + Math.random() * 1.6, v: 0.015 + Math.random() * 0.05, c: Math.random() < 0.7 }));
    function size() { const d = Math.min(2, devicePixelRatio || 1); W = hero.clientWidth; H = hero.clientHeight; cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0); }
    function frame(now) {
      const t = (now - t0) / 1000; ctx.clearRect(0, 0, W, H);
      const rows = 26;
      for (let k = 0; k < rows; k++) {
        const f = k / (rows - 1), base = H * (0.1 + f * 0.85);
        ctx.beginPath();
        for (let x = 0; x <= W + 14; x += 14) {
          const y = base + Math.sin(x * 0.0038 + t * 0.5 + k * 0.42) * (10 + f * 14) + Math.sin(x * 0.011 - t * 0.33 + mx * 3) * 4;
          x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.strokeStyle = `rgba(245,137,42,${0.035 + f * 0.13})`; ctx.lineWidth = 1.3; ctx.stroke();
      }
      for (const e of embers) {
        e.y -= e.v * 0.016; if (e.y < -0.02) { e.y = 1.02; e.x = Math.random(); }
        ctx.fillStyle = e.c ? 'rgba(245,137,42,.6)' : 'rgba(116,214,63,.55)';
        ctx.beginPath(); ctx.arc(e.x * W, e.y * H, e.s, 0, 6.283); ctx.fill();
      }
    }
    function loop(now) { if (running) frame(now); requestAnimationFrame(loop); }
    size(); addEventListener('resize', size);
    hero.addEventListener('pointermove', (e) => { mx = e.clientX / W; }, { passive: true });
    new IntersectionObserver(([en]) => { running = en.isIntersecting; }).observe(hero);
    if (reduce) frame(t0 + 1500); else requestAnimationFrame(loop);
  })();

  /* ---------- Fon: haqiqiy 3D printer to'xtovsiz chop etadi ---------- */
  (function hero3d() {
    const canvas = $('hero3d'); const label = $('heroLayer');
    if (!window.THREE || !window.UP3D || NO3D) { canvas.hidden = true; return; }
    const small = innerWidth < 700;
    let loop;
    try { loop = UP3D.createLoop(canvas, { duration: 18, dpr: small ? 1.25 : 1.6 }); } catch (e) { canvas.hidden = true; return; }
    // Kuchsiz qurilmalarda sifatni avtomatik pasaytiramiz, juda sekin bo'lsa to'xtatamiz
    let frames = 0, t0 = 0, level = 0, stopped = false;
    function adapt(now) {
      if (!t0) { t0 = now; frames = 0; return; }
      frames++;
      if (now - t0 < 2000) return;
      const fps = frames * 1000 / (now - t0); t0 = now; frames = 0;
      if (fps < 24 && level === 0) { level = 1; loop.quality(1, false); }
      else if (fps < 12 && level === 1) { level = 2; loop.quality(0.75, false); }
      else if (fps < 8 && level === 2) { stopped = true; }
    }
    let visible = true, last = performance.now(), lastLabel = '';
    const hero = canvas.parentElement;
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { threshold: 0.02 }).observe(hero);
    document.addEventListener('visibilitychange', () => { last = performance.now(); });
    addEventListener('resize', () => loop.resize());
    if (finePointer) hero.addEventListener('pointermove', (e) => { const r = hero.getBoundingClientRect(); loop.pointer((e.clientX - r.left) / r.width * 2 - 1, (e.clientY - r.top) / r.height * 2 - 1); }, { passive: true });
    function tick(now) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (stopped) return;
      if (visible && !document.hidden) {
        adapt(now);
        const info = loop.step(reduce ? 0 : dt);
        const txt = info.done ? 'Tayyor · keyingisi chop etilmoqda' : `Chop etilmoqda · qatlam ${info.layer} / ${info.N}`;
        if (txt !== lastLabel) { label.textContent = txt; lastLabel = txt; }
      }
      requestAnimationFrame(tick);
    }
    loop.step(0); requestAnimationFrame(() => canvas.classList.add('ready'));
    requestAnimationFrame(tick);
  })();

  /* ---------- Skroll bilan chop etish sahnasi ---------- */
  (function printScene() {
    const scene = $('jarayon'); const canvas = $('printer3d'); const fallback = $('printerFallback');
    const steps = [...scene.querySelectorAll('.step')]; const label = $('layerLabel'); const fill = $('meterFill');
    let hero = null;
    try { if (window.THREE && window.UP3D && !NO3D) hero = UP3D.createHero(canvas, { kind: 'lamp' }); } catch (e) { hero = null; }
    if (!hero) { canvas.hidden = true; fallback.hidden = false; }
    const N = hero ? hero.obj.N : 100;
    let cur = 0, lastStep = -1, lastDraw = -1, near = false;
    new IntersectionObserver(([en]) => { near = en.isIntersecting; }, { rootMargin: '200px' }).observe(scene);
    const progress = () => { const total = scene.offsetHeight - innerHeight; return total > 0 ? clamp(-scene.getBoundingClientRect().top / total) : 0; };
    function update(p) {
      const pp = clamp(p / 0.68), f = pp * N;
      if (hero && Math.abs(p - lastDraw) > 0.00015) { hero.setProgress(p); hero.render(); lastDraw = p; }
      const idx = p < 0.25 ? 0 : p < 0.72 ? 1 : 2;
      if (idx !== lastStep) { steps.forEach((s, i) => s.classList.toggle('on', i === idx)); lastStep = idx; }
      label.textContent = `Qatlam ${Math.min(N, Math.round(f))} / ${N}`;
      fill.style.width = (pp * 100).toFixed(1) + '%';
    }
    if (hero) addEventListener('resize', () => { hero.resize(); lastDraw = -1; update(cur); });
    if (reduce) { scene.style.height = 'auto'; const pin = scene.querySelector('.scene-pin'); pin.style.position = 'static'; pin.style.height = 'auto'; pin.style.padding = '80px 0'; update(0.67); return; }
    update(0);
    (function tick() {
      if (near) { const target = progress(); cur += (target - cur) * 0.14; if (Math.abs(target - cur) < 0.0002) cur = target; update(cur); }
      requestAnimationFrame(tick);
    })();
  })();

  /* ---------- Ko'rinishga kelganda jonlanish ---------- */
  const io = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  const watch = (el) => { if (reduce) el.classList.add('in'); else io.observe(el); };
  // clip-path bilan yashiringan sarlavhani o'zi emas, ota-elementi orqali kuzatamiz
  const titleIo = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.querySelectorAll('.print-title').forEach((t) => t.classList.add('in')); titleIo.unobserve(en.target); } }), { threshold: 0.2 });
  document.querySelectorAll('.print-title').forEach((t) => { if (reduce) t.classList.add('in'); else titleIo.observe(t.parentElement); });

  /* Sonlar sanab chiqadi */
  const countIo = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (!en.isIntersecting) return; countIo.unobserve(en.target);
    const el = en.target, to = Number(el.dataset.countTo); const t0 = performance.now();
    (function step(now) { const k = clamp((now - t0) / 1400); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); })(t0);
  }));
  document.querySelectorAll('[data-count-to]').forEach((el) => { if (!reduce) countIo.observe(el); });

  /* Magnit tugmalar va kursor nuri */
  if (finePointer && !reduce) {
    document.querySelectorAll('.magnetic').forEach((b) => {
      b.addEventListener('pointermove', (e) => { const r = b.getBoundingClientRect(); b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.18}px, ${(e.clientY - r.top - r.height / 2) * 0.3}px)`; });
      b.addEventListener('pointerleave', () => { b.style.transform = ''; });
    });
    const glow = $('glow'); let gx = 0, gy = 0, cx = 0, cy = 0, on = false;
    addEventListener('pointermove', (e) => { gx = e.clientX; gy = e.clientY; if (!on) { on = true; glow.classList.add('on'); } }, { passive: true });
    document.addEventListener('pointerleave', () => { on = false; glow.classList.remove('on'); });
    (function follow() { cx += (gx - cx) * 0.12; cy += (gy - cy) * 0.12; glow.style.transform = `translate(${cx}px, ${cy}px)`; requestAnimationFrame(follow); })();
  }

  /* ---------- Sozlamalarni sahifaga qo'yish ---------- */
  function applySettings() {
    if (S.heroKicker) $('heroKicker').textContent = S.heroKicker;
    if (S.heroTitle) splitTitle(S.heroTitle);
    if (S.heroText) $('heroText').textContent = S.heroText;
    if (S.followers) $('statFollowers').textContent = S.followers;
    if (S.announce) { $('announceText').textContent = S.announce; $('announce').hidden = false; }
    if (S.delivery) $('faqDelivery').textContent = S.delivery + '. Yetkazish narxi manzilga qarab aytiladi.';
    if (S.city) $('footCity').textContent = S.city;
    const phone = String(S.phone || '').replace(/[^\d+]/g, '');
    if (phone) { ['footCall', 'footPhone'].forEach((id) => { $(id).href = 'tel:' + phone; }); $('footPhone').textContent = fmtPhone(phone); }
    const ig = String(S.instagram || '').replace(/^@/, '');
    if (ig) {
      const url = `https://www.instagram.com/${encodeURIComponent(ig)}/`;
      ['footIg', 'footIgHandle', 'igFollow'].forEach((id) => { $(id).href = url; });
      $('footIgHandle').textContent = '@' + ig;
      document.querySelectorAll('.ig-handle').forEach((e) => { e.textContent = ig; });
    }
    const tg = String(S.telegram || '').replace(/^@/, '').replace(/^https?:\/\/t\.me\//, '');
    if (tg) { $('footTgCol').hidden = false; $('footTg').href = 'https://t.me/' + encodeURIComponent(tg); $('footTg').textContent = '@' + tg; }
  }

  /* ---------- Lenta ---------- */
  function renderMarquee() {
    const words = categories.map((c) => c.name).concat(['Maxsus buyurtma', 'Logotipli sovgʻalar']);
    const track = $('marquee'); track.replaceChildren();
    for (let r = 0; r < 2; r++) words.forEach((w) => track.append(h('span', { text: w })));
  }

  /* ---------- Kataloglar ---------- */
  const isNew = (p) => (p.badges || []).includes('new');
  function renderCats() {
    const grid = $('catGrid'); grid.replaceChildren();
    const newList = products.filter(isNew);
    const tiles = [{ id: '__new', name: 'Yangi kelganlar', blurb: 'Ustaxonadan eng soʻnggi mahsulotlar', cover: (newList[0] && newList[0].images && newList[0].images[0]) || 'assets/img/lamp-orange.webp', count: newList.length, isNew: true }]
      .concat(categories.map((c) => ({ ...c, count: products.filter((p) => p.category === c.id).length })));
    tiles.forEach((c, i) => {
      const tile = h('button', { class: 'cat', type: 'button', style: { transitionDelay: Math.min(i, 7) * 60 + 'ms' }, onclick: () => pickCategory(c.id === '__new' ? 'new' : c.id, true) },
        c.cover ? h('img', { src: c.cover, alt: '', loading: 'lazy' }) : null,
        c.isNew ? h('span', { class: 'badge new cat-new', text: 'Yangi' }) : null,
        h('div', { class: 'cat-body' }, h('div', {}, h('h3', { text: c.name }), c.blurb ? h('p', { text: c.blurb }) : null), h('span', { class: 'cat-count', text: c.count })));
      grid.append(tile); watch(tile);
    });
    if ((tiles.length - 1) % 2 === 1 && grid.lastChild) grid.lastChild.classList.add('wide-sm');
  }

  /* ---------- Mahsulotlar ---------- */
  let category = 'all', query = '', sort = 'new';
  const catName = (id) => (categories.find((c) => c.id === id) || {}).name || id;
  function pickCategory(id, scroll) {
    category = id; renderChips(); renderProducts();
    if (scroll) $('mahsulotlar').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  }
  function renderChips() {
    const chips = $('chips'); chips.replaceChildren();
    const list = [['all', 'Hammasi', products.length], ['new', 'Yangi', products.filter(isNew).length]]
      .concat(categories.map((c) => [c.id, c.name, products.filter((p) => p.category === c.id).length])).filter((x) => x[0] === 'all' || x[2] > 0);
    list.forEach(([id, name, n]) => chips.append(h('button', { class: 'chip', type: 'button', 'aria-pressed': String(id === category), onclick: () => pickCategory(id) }, name, h('small', { text: n }))));
  }
  function filtered() {
    const q = query.toLowerCase();
    let list = products.filter((p) => (category === 'all' || (category === 'new' ? isNew(p) : p.category === category))
      && (!q || (p.title + ' ' + p.description + ' ' + catName(p.category)).toLowerCase().includes(q)));
    if (sort === 'cheap') list = list.slice().sort((a, b) => a.price - b.price);
    else if (sort === 'expensive') list = list.slice().sort((a, b) => b.price - a.price);
    else if (sort === 'popular') list = list.slice().sort((a, b) => ((b.badges || []).includes('hit') - (a.badges || []).includes('hit')));
    return list;
  }
  function tilt(card) {
    if (!finePointer || reduce) return;
    const glare = card.querySelector('.card-glare');
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      card.style.setProperty('--ry', ((x - 0.5) * 10).toFixed(2) + 'deg'); card.style.setProperty('--rx', ((0.5 - y) * 8).toFixed(2) + 'deg');
      glare.style.setProperty('--gx', x * 100 + '%'); glare.style.setProperty('--gy', y * 100 + '%');
    });
    card.addEventListener('pointerleave', () => { card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); });
  }
  function priceEl(p, cls) {
    return h('span', { class: cls || 'price' }, p.oldPrice > p.price ? h('s', { text: money(p.oldPrice) }) : null, p.price ? money(p.price) : 'Narxi kelishiladi');
  }
  function renderProducts() {
    const grid = $('products'); grid.replaceChildren();
    const list = filtered();
    if (!list.length) {
      grid.append(h('div', { class: 'empty' }, h('p', { text: query ? `“${query}” boʻyicha hech narsa topilmadi.` : 'Bu turkumda hozircha mahsulot yoʻq.' }),
        h('a', { class: 'btn btn-sm', href: '#buyurtma', text: 'Maxsus buyurtma berish' })));
      return;
    }
    list.forEach((p, i) => {
      const imgs = p.images || [];
      const card = h('article', { class: 'card', style: { transitionDelay: (Math.min(i % 8, 7) * 55) + 'ms' } },
        h('div', { class: 'card-glare' }),
        h('div', { class: 'card-img', onclick: () => openProduct(p) },
          imgs[0] ? h('img', { src: imgs[0], alt: p.title, loading: 'lazy' }) : null,
          imgs[1] ? h('img', { class: 'alt', src: imgs[1], alt: '', loading: 'lazy' }) : null,
          h('div', { class: 'card-badges' }, (p.badges || []).map((b) => h('span', { class: 'badge ' + b, text: BADGES[b] || b }))),
          p.model ? h('button', { class: 'card-3d', type: 'button', 'aria-label': p.title + ' — 3D koʻrinish', title: '3D koʻrinish', text: '3D', onclick: (e) => { e.stopPropagation(); openProduct(p, true); } }) : null,
          p.instagram ? h('a', { class: 'card-ig', href: p.instagram, target: '_blank', rel: 'noopener', 'aria-label': 'Instagramda koʻrish', html: ICON_IG, onclick: (e) => e.stopPropagation() }) : null),
        h('div', { class: 'card-body' },
          h('span', { class: 'card-cat', text: catName(p.category) }),
          h('h3', { class: 'card-title', text: p.title, onclick: () => openProduct(p) }),
          h('div', { class: 'card-foot' }, priceEl(p),
            h('button', { class: 'add-btn', type: 'button', 'aria-label': p.title + ' — savatga', html: ICON_PLUS, onclick: () => addToCart(p, 1, (p.colors || [])[0] || '') }))));
      grid.append(card); watch(card); tilt(card);
    });
  }
  $('search').addEventListener('input', (e) => { query = e.target.value.trim(); renderProducts(); });
  $('sort').addEventListener('change', (e) => { sort = e.target.value; renderProducts(); });
  document.querySelectorAll('[data-cat]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); pickCategory(a.dataset.cat, true); }));

  /* ---------- Mahsulot oynasi ---------- */
  function openProduct(p, start3d) {
    const imgs = p.images || [];
    let tt = null; let color = (p.colors || [])[0] || ''; let qty = 1;
    const main = h('div', { class: 'pd-main' });
    const thumbs = h('div', { class: 'pd-thumbs' });
    const views = imgs.map((src) => ({ type: 'img', src }));
    if (p.model && window.UP3D) views.push({ type: '3d' });
    let vi = start3d && p.model ? views.length - 1 : 0;
    function show(i) {
      vi = i; if (tt) { tt.dispose(); tt = null; }
      main.replaceChildren();
      const v = views[i];
      if (!v) { main.append(h('div', { class: 'empty', text: 'Rasm yoʻq' })); }
      else if (v.type === 'img') main.append(h('img', { src: v.src, alt: p.title }));
      else {
        const cv = h('canvas', { 'aria-label': p.title + ' 3D modeli' }); main.append(cv, h('span', { class: 'pd-hint', text: 'Aylantirish uchun suring' }));
        requestAnimationFrame(() => { try { tt = UP3D.createTurntable(cv, p.model, p.modelColor ? parseInt(p.modelColor.slice(1), 16) : undefined); } catch (e) { main.replaceChildren(h('div', { class: 'empty', text: '3D koʻrinish bu qurilmada ishlamadi' })); } });
      }
      [...thumbs.children].forEach((t, k) => t.setAttribute('aria-pressed', String(k === i)));
    }
    views.forEach((v, i) => thumbs.append(h('button', { class: 'pd-thumb', type: 'button', 'aria-label': v.type === '3d' ? '3D koʻrinish' : `Rasm ${i + 1}`, onclick: () => show(i) }, v.type === 'img' ? h('img', { src: v.src, alt: '' }) : '3D')));

    const qtyEl = h('span', { text: qty });
    const qtyBox = h('div', { class: 'qty' },
      h('button', { type: 'button', 'aria-label': 'Kamaytirish', text: '−', onclick: () => { qty = Math.max(1, qty - 1); qtyEl.textContent = qty; } }), qtyEl,
      h('button', { type: 'button', 'aria-label': 'Koʻpaytirish', text: '+', onclick: () => { qty = Math.min(999, qty + 1); qtyEl.textContent = qty; } }));
    const sw = h('div', { class: 'swatches' });
    (p.colors || []).forEach((c) => sw.append(h('button', { class: 'swatch', type: 'button', 'aria-pressed': String(c === color), text: c, onclick: (e) => { color = c; [...sw.children].forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); } })));

    const body = h('div', { class: 'pd' },
      h('div', { class: 'pd-media' }, main, views.length > 1 ? thumbs : null),
      h('div', { class: 'pd-info' },
        h('div', { class: 'card-badges', style: { position: 'static' } }, h('span', { class: 'badge', text: catName(p.category) }), (p.badges || []).map((b) => h('span', { class: 'badge ' + b, text: BADGES[b] || b }))),
        h('h2', { text: p.title }),
        h('div', { class: 'pd-price' }, p.price ? money(p.price) : 'Narxi kelishiladi', p.oldPrice > p.price ? h('s', { text: money(p.oldPrice) }) : null),
        p.description ? h('p', { class: 'muted', text: p.description }) : null,
        p.specs ? h('span', { class: 'pd-specs', text: p.specs }) : null,
        (p.colors || []).length ? h('div', { class: 'field' }, h('span', { class: 'label', text: 'Rang' }), sw) : null,
        h('div', { class: 'field' }, h('span', { class: 'label', text: 'Soni' }), qtyBox),
        h('div', { class: 'pd-actions' },
          h('button', { class: 'btn', type: 'button', text: 'Savatga qoʻshish', onclick: () => { addToCart(p, qty, color); m.close(); } }),
          h('button', { class: 'btn btn-ghost', type: 'button', text: 'Hoziroq buyurtma', onclick: () => { addToCart(p, qty, color, true); m.close(); openDrawer(true); } })),
        p.instagram ? h('a', { class: 'pd-link', href: p.instagram, target: '_blank', rel: 'noopener', html: ICON_IG + '<span>Instagramdagi videosini koʻrish</span>' }) : null));
    const m = modal(p.title, body, { wide: true, onClose: () => { if (tt) tt.dispose(); } });
    show(vi);
  }

  /* ---------- Instagram videolari ---------- */
  function renderReels() {
    const box = $('reels'); box.replaceChildren();
    if (!reels.length) { $('videolar').hidden = true; return; }
    $('videolar').hidden = false;
    reels.forEach((r) => box.append(h('button', { class: 'reel', type: 'button', 'aria-label': 'Videoni ochish: ' + (r.title || 'Instagram video'), onclick: () => openReel(r) },
      r.cover ? h('img', { src: r.cover, alt: '', loading: 'lazy' }) : h('span', { class: 'reel-noimg' }),
      h('span', { class: 'reel-top' }, h('i'), '@' + String(S.instagram || '3durbanprint').replace(/^@/, '')),
      h('span', { class: 'reel-play', html: ICON_PLAY }),
      r.title ? h('span', { class: 'reel-title', text: r.title }) : null)));
  }
  function openReel(r) {
    const url = `https://www.instagram.com/reel/${encodeURIComponent(r.code)}/`;
    const frame = h('div', { class: 'reel-frame' }, h('div', { class: 'spinner' }),
      h('iframe', { src: url + 'embed/', title: r.title || 'Instagram video', loading: 'eager', allow: 'autoplay; encrypted-media; picture-in-picture; clipboard-write', allowfullscreen: true, scrolling: 'no' }));
    const body = h('div', { class: 'stack' }, frame, h('a', { class: 'btn btn-ghost btn-sm', href: url, target: '_blank', rel: 'noopener', html: ICON_IG + '<span>Instagramda ochish</span>' }));
    modal(r.title || 'Instagram video', body, { cls: '' }).el.classList.add('reel-modal');
  }
  const scrollReels = (dir) => { const box = $('reels'); box.scrollBy({ left: dir * Math.min(box.clientWidth * 0.8, 800), behavior: reduce ? 'auto' : 'smooth' }); };
  $('reelPrev').addEventListener('click', () => scrollReels(-1));
  $('reelNext').addEventListener('click', () => scrollReels(1));

  /* ---------- Savat ---------- */
  let cart = [];
  try { cart = JSON.parse(localStorage.getItem('up_cart_v2') || '[]'); } catch { cart = []; }
  const saveCart = () => { try { localStorage.setItem('up_cart_v2', JSON.stringify(cart)); } catch { /* yopiq */ } };
  const drawer = $('drawer'), scrim = $('scrim');
  let form = { name: '', phone: '', address: '', note: '' };
  try { Object.assign(form, JSON.parse(localStorage.getItem('up_buyer') || '{}')); } catch { /* yo'q */ }
  function openDrawer(open) {
    drawer.classList.toggle('open', open); scrim.classList.toggle('open', open);
    drawer.setAttribute('aria-hidden', String(!open));
    document.documentElement.classList.toggle('locked', open);
    if (open) { renderCart(); $('drawerClose').focus(); }
  }
  $('cartBtn').addEventListener('click', () => openDrawer(true));
  $('drawerClose').addEventListener('click', () => openDrawer(false));
  scrim.addEventListener('click', () => openDrawer(false));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && drawer.classList.contains('open') && !document.querySelector('.overlay')) openDrawer(false); });
  function addToCart(p, qty, color, silent) {
    const l = cart.find((x) => x.id === p.id && x.color === color);
    if (l) l.qty = Math.min(999, l.qty + qty); else cart.push({ id: p.id, qty, color });
    saveCart(); renderCount();
    const b = $('cartBtn'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump');
    if (!silent) toast(`“${p.title}” savatga qoʻshildi`);
  }
  const lines = () => cart.map((l) => ({ ...l, p: products.find((x) => x.id === l.id) })).filter((l) => l.p);
  function renderCount() {
    const n = lines().reduce((s, l) => s + l.qty, 0);
    $('cartCount').textContent = n; $('cartCount').hidden = !n;
  }
  function renderCart() {
    const body = $('cartBody'), foot = $('cartFoot');
    body.replaceChildren(); foot.replaceChildren(); renderCount();
    const ls = lines();
    if (!ls.length) {
      body.append(h('div', { class: 'cart-empty', html: '<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7h12l-1 12H7z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>' },
        h('p', { text: 'Savat hozircha boʻsh' }), h('button', { class: 'btn btn-sm', type: 'button', text: 'Katalogga oʻtish', onclick: () => { openDrawer(false); $('mahsulotlar').scrollIntoView({ behavior: 'smooth' }); } })));
      return;
    }
    const setQty = (l, q) => { const c = cart.find((x) => x.id === l.id && x.color === l.color); if (q <= 0) cart = cart.filter((x) => x !== c); else c.qty = Math.min(999, q); saveCart(); renderCart(); };
    ls.forEach((l) => body.append(h('div', { class: 'line' },
      (l.p.images || [])[0] ? h('img', { src: l.p.images[0], alt: '' }) : h('span'),
      h('div', {}, h('strong', { text: l.p.title }), h('small', { text: (l.color ? l.color + ' · ' : '') + money(l.p.price) })),
      h('div', { class: 'line-right' },
        h('span', { class: 'price', style: { fontSize: '15px' }, text: money(l.p.price * l.qty) }),
        h('div', { class: 'qty' },
          h('button', { type: 'button', 'aria-label': 'Kamaytirish', text: '−', onclick: () => setQty(l, l.qty - 1) }), h('span', { text: l.qty }),
          h('button', { type: 'button', 'aria-label': 'Koʻpaytirish', text: '+', onclick: () => setQty(l, l.qty + 1) }))))));
    const total = ls.reduce((s, l) => s + l.p.price * l.qty, 0);
    const inp = (key, attrs) => { const el = h(attrs.tag || 'input', Object.assign({ class: attrs.tag === 'textarea' ? 'textarea' : 'input', id: 'c-' + key }, attrs, { tag: null })); el.value = form[key] || ''; el.addEventListener('input', () => { form[key] = el.value; }); return el; };
    const err = h('p', { class: 'form-error', role: 'alert' });
    const go = h('button', { class: 'btn btn-wide', type: 'button', text: 'Buyurtmani yuborish' });
    go.addEventListener('click', async () => {
      err.textContent = ''; go.disabled = true; go.textContent = 'Yuborilmoqda...';
      try {
        const r = await Store.order({ items: ls.map((l) => ({ id: l.id, qty: l.qty, color: l.color })), ...form });
        try { localStorage.setItem('up_buyer', JSON.stringify({ name: form.name, phone: form.phone, address: form.address })); } catch { /* yopiq */ }
        cart = []; saveCart(); renderCount();
        body.replaceChildren(h('div', { class: 'done-box' },
          h('div', { class: 'check', html: '<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#74D63F" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg>' }),
          h('h3', { text: `Buyurtma #${r.id} qabul qilindi` }),
          h('p', { class: 'muted', text: `Jami ${money(r.total)}. Tez orada ${fmtPhone(Store.normPhone(form.phone))} raqamiga qoʻngʻiroq qilib, yetkazish va toʻlovni kelishamiz.` }),
          h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Yopish', onclick: () => openDrawer(false) })));
        foot.replaceChildren();
      } catch (ex) { err.textContent = ex.message; go.disabled = false; go.textContent = 'Buyurtmani yuborish'; }
    });
    foot.append(
      h('div', { class: 'total' }, h('span', { text: 'Jami' }), h('span', { text: money(total) })),
      h('div', { class: 'grid-2' },
        h('div', { class: 'field' }, h('label', { for: 'c-name', text: 'Ismingiz' }), inp('name', { autocomplete: 'name', maxlength: 80 })),
        h('div', { class: 'field' }, h('label', { for: 'c-phone', text: 'Telefon' }), inp('phone', { type: 'tel', inputmode: 'tel', autocomplete: 'tel', placeholder: '90 123 45 67' }))),
      h('div', { class: 'field' }, h('label', { for: 'c-address', text: 'Yetkazib berish manzili' }), inp('address', { tag: 'textarea', style: { minHeight: '72px' }, placeholder: 'Viloyat, shahar, koʻcha, uy', maxlength: 400 })),
      h('div', { class: 'field' }, h('label', { for: 'c-note', text: 'Izoh (ixtiyoriy)' }), inp('note', { maxlength: 600, placeholder: 'Qulay vaqt, qoʻshimcha istak' })),
      err, go, h('small', { class: 'muted', style: { textAlign: 'center' }, text: 'Toʻlov buyurtma tasdiqlangandan keyin kelishiladi' }));
  }

  /* ---------- Maxsus buyurtma formasi ---------- */
  (function customForm() {
    const formEl = $('reqForm'), input = $('r-files'), drop = $('drop'), list = $('fileList'), err = $('reqErr'), ok = $('reqOk'), btn = $('reqBtn');
    let files = [];
    const MAX = 40 * 1024 * 1024;
    try { const b = JSON.parse(localStorage.getItem('up_buyer') || '{}'); if (b.name) $('r-name').value = b.name; if (b.phone) $('r-phone').value = b.phone; } catch { /* yo'q */ }
    function paint() {
      list.replaceChildren(...files.map((f, i) => h('span', { class: 'file-pill' },
        /^image\//.test(f.type) ? h('img', { src: URL.createObjectURL(f), alt: '' }) : h('span', { class: 'vid', text: 'VIDEO' }),
        h('span', { text: f.name }),
        h('button', { type: 'button', 'aria-label': 'Olib tashlash: ' + f.name, text: '✕', onclick: () => { files.splice(i, 1); paint(); } }))));
    }
    function add(fl) {
      err.textContent = '';
      for (const f of fl) {
        if (files.length >= 5) { err.textContent = 'Eng koʻpi bilan 5 ta fayl'; break; }
        if (!/^(image|video)\//.test(f.type)) { err.textContent = 'Faqat rasm va video qabul qilinadi'; continue; }
        if (f.size > MAX) { err.textContent = `“${f.name}” 40 MB dan katta`; continue; }
        files.push(f);
      }
      paint();
    }
    input.addEventListener('change', () => { add([...input.files]); input.value = ''; });
    ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', (e) => add([...e.dataTransfer.files]));
    document.querySelectorAll('[data-preset="biznes"]').forEach((a) => a.addEventListener('click', () => {
      if (!$('r-title').value) $('r-title').value = 'Logotipli mahsulot (ulgurji)';
      if (!$('r-qty').value) $('r-qty').value = '100';
      setTimeout(() => $('r-desc').focus({ preventScroll: true }), 700);
    }));
    formEl.addEventListener('submit', async (e) => {
      e.preventDefault(); err.textContent = ''; ok.hidden = true;
      btn.disabled = true; btn.textContent = 'Yuborilmoqda...';
      try {
        const r = await Store.request({ name: $('r-name').value, phone: $('r-phone').value, title: $('r-title').value, qty: $('r-qty').value, description: $('r-desc').value, link: $('r-link').value, files });
        try { localStorage.setItem('up_buyer', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('up_buyer') || '{}'), { name: $('r-name').value, phone: $('r-phone').value }))); } catch { /* yopiq */ }
        ['r-title', 'r-qty', 'r-desc', 'r-link'].forEach((id) => { $(id).value = ''; }); files = []; paint();
        ok.textContent = `Soʻrov #${r.id} yuborildi. Koʻrib chiqib, narx va muddatni aytish uchun siz bilan bogʻlanamiz.`; ok.hidden = false;
      } catch (ex) { err.textContent = ex.message; }
      finally { btn.disabled = false; btn.textContent = 'Soʻrovni yuborish'; }
    });
  })();

  /* ---------- Yuklash ---------- */
  (function skeletons() { const g = $('products'); for (let i = 0; i < 4; i++) g.append(h('div', { class: 'skeleton' })); })();
  Store.catalog().then((c) => {
    S = c.settings || {}; categories = c.categories || []; products = c.products || []; reels = c.reels || [];
    applySettings(); renderMarquee(); renderCats(); renderChips(); renderProducts(); renderReels(); renderCount();
  }).catch(() => {
    $('products').replaceChildren(h('div', { class: 'empty', text: 'Mahsulotlarni yuklab boʻlmadi. Sahifani yangilang.' }));
  });
})();
