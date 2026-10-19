'use strict';
(function () {
  const { h, toast, modal } = UI;
  const { money, fmtPhone, normPhone, BADGES } = Store;
  const { t, pick } = I18N;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const $ = (id) => document.getElementById(id);
  const NO3D = /[?&]no3d\b/.test(location.search);
  const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* yopiq */ } } };
  const IC = {
    ig: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
    plus: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    play: '<svg width="26" height="26" viewBox="0 0 24 24" fill="#fff"><path d="M8 5.5v13l11-6.5z"/></svg>',
    heart: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
    link: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>',
    check: '<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#8BE04E" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg>',
    bag: '<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7h12l-1 12H7z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>',
  };

  let S = {}; let products = []; let categories = []; let reels = []; let payAvail = { payme: false, click: false };
  let favs = ls.get('up_favs', []);
  const byId = (id) => products.find((p) => p.id === id);
  const cat = (id) => categories.find((c) => c.id === id) || {};
  const catColor = (id) => cat(id).color || '#FF7A1A';
  const title = (p) => pick(p, 'title');

  /* ================= Yuklanish ekrani ================= */
  const loader = (function () {
    const el = $('loader'), num = $('loaderNum');
    if (document.documentElement.classList.contains('seen') || reduce) { el.remove(); return { done() {} }; }
    let shown = 0, target = 30, finished = false; const t0 = performance.now();
    (function tick() {
      shown += (target - shown) * 0.08; num.textContent = Math.min(100, Math.round(shown));
      if (finished && shown > 99.4) { num.textContent = 100; el.classList.add('done'); setTimeout(() => el.remove(), 1000); return; }
      requestAnimationFrame(tick);
    })();
    addEventListener('load', () => { target = Math.max(target, 80); });
    setTimeout(() => { target = Math.max(target, 65); }, 600);
    return { done() { const wait = Math.max(0, 1500 - (performance.now() - t0)); setTimeout(() => { target = 100; finished = true; try { sessionStorage.setItem('up_seen', '1'); } catch { /* yopiq */ } }, wait); } };
  })();
  setTimeout(() => loader.done(), 3500);

  /* ================= Sarlavha, menyu, til ================= */
  const head = $('head'), progress = $('progress'), fab = $('fab');
  let lastY = scrollY;
  function onScroll() {
    const y = scrollY;
    head.classList.toggle('solid', y > 24);
    head.classList.toggle('hide', y > 500 && y > lastY + 4 && !$('nav').classList.contains('open'));
    if (y < lastY - 4) head.classList.remove('hide');
    lastY = y;
    const max = document.documentElement.scrollHeight - innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    fab.classList.toggle('show', y > innerHeight * 0.9);
  }
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  const nav = $('nav'), menuBtn = $('menuBtn');
  menuBtn.addEventListener('click', () => { const o = !nav.classList.contains('open'); nav.classList.toggle('open', o); menuBtn.setAttribute('aria-expanded', String(o)); });
  nav.addEventListener('click', (e) => { if (e.target.closest('a,button')) { nav.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); } });
  $('year').textContent = new Date().getFullYear();
  document.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => { I18N.set(b.dataset.lang); renderAll(); }));
  function paintLang() { document.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === I18N.lang))); }

  /* ================= Silliq skroll (faqat sichqoncha g'ildiragi) ================= */
  (function smooth() {
    if (!finePointer || reduce || /[?&]nosmooth\b/.test(location.search)) return;
    let target = scrollY, cur = scrollY, running = false;
    const scrollable = (el) => { for (; el && el !== document.body; el = el.parentElement) { const s = getComputedStyle(el); if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight) return true; } return false; };
    addEventListener('wheel', (e) => {
      if (e.ctrlKey || document.documentElement.classList.contains('locked') || scrollable(e.target) || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      if (!running) { target = cur = scrollY; }
      target = clamp(target + e.deltaY * (e.deltaMode === 1 ? 32 : 1), 0, document.documentElement.scrollHeight - innerHeight);
      if (!running) { running = true; requestAnimationFrame(step); }
    }, { passive: false });
    function step() {
      cur += (target - cur) * 0.11;
      if (Math.abs(target - cur) < 0.5) { cur = target; running = false; }
      scrollTo(0, cur);
      if (running) requestAnimationFrame(step);
    }
    addEventListener('scroll', () => { if (!running) target = cur = scrollY; }, { passive: true });
  })();

  /* ================= Bosh ekran ================= */
  function splitTitle(text) {
    const el = $('heroTitle'); el.replaceChildren();
    text.split(/\s+/).filter(Boolean).forEach((w, i) => {
      el.append(h('span', { class: 'ln' }, h('span', { text: w, style: { animationDelay: (0.2 + i * 0.07) + 's' } })), ' ');
    });
  }
  (function heroLines() {
    const cv = $('heroLines'); const ctx = cv.getContext('2d'); const hero = cv.parentElement;
    let W = 0, H = 0, running = true, mx = 0.5; const t0 = performance.now();
    const embers = Array.from({ length: 30 }, () => ({ x: Math.random(), y: Math.random(), s: 0.5 + Math.random() * 1.5, v: 0.015 + Math.random() * 0.05, c: Math.random() < 0.7 }));
    function size() { const d = Math.min(2, devicePixelRatio || 1); W = hero.clientWidth; H = hero.clientHeight; cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0); }
    function frame(now) {
      const tt = (now - t0) / 1000; ctx.clearRect(0, 0, W, H);
      for (let k = 0; k < 24; k++) {
        const f = k / 23, base = H * (0.1 + f * 0.85);
        ctx.beginPath();
        for (let x = 0; x <= W + 14; x += 14) { const y = base + Math.sin(x * 0.0038 + tt * 0.5 + k * 0.42) * (10 + f * 14) + Math.sin(x * 0.011 - tt * 0.33 + mx * 3) * 4; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.strokeStyle = `rgba(255,122,26,${0.03 + f * 0.11})`; ctx.lineWidth = 1.3; ctx.stroke();
      }
      for (const e of embers) {
        e.y -= e.v * 0.016; if (e.y < -0.02) { e.y = 1.02; e.x = Math.random(); }
        ctx.fillStyle = e.c ? 'rgba(255,122,26,.6)' : 'rgba(139,224,78,.5)';
        ctx.beginPath(); ctx.arc(e.x * W, e.y * H, e.s, 0, 6.283); ctx.fill();
      }
    }
    function loop(now) { if (running) frame(now); requestAnimationFrame(loop); }
    size(); addEventListener('resize', size);
    hero.addEventListener('pointermove', (e) => { mx = e.clientX / W; }, { passive: true });
    new IntersectionObserver(([en]) => { running = en.isIntersecting; }).observe(hero);
    if (reduce) frame(t0 + 1500); else requestAnimationFrame(loop);
  })();

  /* Fon: haqiqiy 3D printer to'xtovsiz chop etadi; o'ngdagi "chipta" uning holatini ko'rsatadi */
  (function hero3d() {
    const canvas = $('hero3d');
    const NAMES = { lamp: 'Lamp-01', lampTall: { uz: 'Burama svetilnik', ru: 'Витой светильник', en: 'Twisted lamp' }, pawn: { uz: 'Shaxmat piyodasi', ru: 'Шахматная пешка', en: 'Chess pawn' } };
    const MAT = { lamp: 'PLA', lampTall: 'PLA Silk', pawn: 'PETG' };
    if (!window.THREE || !window.UP3D || NO3D) { canvas.hidden = true; return; }
    const small = innerWidth < 700;
    let loop;
    try { loop = UP3D.createLoop(canvas, { duration: 18, dpr: small ? 1.25 : 1.6 }); } catch (e) { canvas.hidden = true; return; }
    let frames = 0, t0 = 0, level = 0, stopped = false;
    function adapt(now) {
      if (!t0) { t0 = now; frames = 0; return; }
      frames++; if (now - t0 < 2000) return;
      const fps = frames * 1000 / (now - t0); t0 = now; frames = 0;
      if (fps < 24 && level === 0) { level = 1; loop.quality(1, false); }
      else if (fps < 12 && level === 1) { level = 2; loop.quality(0.75, false); }
      else if (fps < 8 && level === 2) stopped = true;
    }
    let visible = true, last = performance.now(), lastTxt = '';
    const hero = canvas.parentElement;
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { threshold: 0.02 }).observe(hero);
    addEventListener('resize', () => loop.resize());
    if (finePointer) hero.addEventListener('pointermove', (e) => { const r = hero.getBoundingClientRect(); loop.pointer((e.clientX - r.left) / r.width * 2 - 1, (e.clientY - r.top) / r.height * 2 - 1); }, { passive: true });
    function tick(now) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (stopped) return;
      if (visible && !document.hidden) {
        adapt(now);
        const info = loop.step(reduce ? 0 : dt);
        const nm = NAMES[info.kind]; const name = typeof nm === 'string' ? nm : (nm ? nm[I18N.lang] || nm.uz : '');
        const txt = `${name}|${info.layer}|${info.done}|${I18N.lang}`;
        if (txt !== lastTxt) {
          lastTxt = txt;
          $('tkName').textContent = info.done ? t('ticket.done') : name;
          $('tkLayer').textContent = `${info.layer} / ${info.N}`;
          $('tkMat').textContent = MAT[info.kind] || 'PLA';
          $('tkLeft').textContent = info.done ? '—' : `${Math.ceil((1 - info.p) * 180)} ${t('ticket.min')}`;
          $('tkBar').style.width = (info.p * 100).toFixed(1) + '%';
        }
      }
      requestAnimationFrame(tick);
    }
    loop.step(0); requestAnimationFrame(() => canvas.classList.add('ready'));
    requestAnimationFrame(tick);
  })();

  /* ================= Skroll bilan chop etish sahnasi ================= */
  (function printScene() {
    const scene = $('jarayon'); const canvas = $('printer3d'); const fallback = $('printerFallback');
    const steps = [...scene.querySelectorAll('.step')]; const label = $('layerLabel'); const fill = $('meterFill');
    let hero = null;
    try { if (window.THREE && window.UP3D && !NO3D) hero = UP3D.createHero(canvas, { kind: 'lamp' }); } catch (e) { hero = null; }
    if (!hero) { canvas.hidden = true; fallback.hidden = false; }
    const N = hero ? hero.obj.N : 100;
    let cur = 0, lastStep = -1, lastDraw = -1, near = false;
    new IntersectionObserver(([en]) => { near = en.isIntersecting; }, { rootMargin: '200px' }).observe(scene);
    const progressOf = () => { const total = scene.offsetHeight - innerHeight; return total > 0 ? clamp(-scene.getBoundingClientRect().top / total) : 0; };
    function update(p) {
      const pp = clamp(p / 0.68), f = pp * N;
      if (hero && Math.abs(p - lastDraw) > 0.00015) { hero.setProgress(p); hero.render(); lastDraw = p; }
      const idx = p < 0.25 ? 0 : p < 0.72 ? 1 : 2;
      if (idx !== lastStep) { steps.forEach((s, i) => s.classList.toggle('on', i === idx)); lastStep = idx; }
      label.textContent = `${t('ticket.layer')} ${Math.min(N, Math.round(f))} / ${N}`;
      fill.style.width = (pp * 100).toFixed(1) + '%';
    }
    if (hero) addEventListener('resize', () => { hero.resize(); lastDraw = -1; update(cur); });
    if (reduce) { scene.style.height = 'auto'; const pin = scene.querySelector('.scene-pin'); pin.style.position = 'static'; pin.style.height = 'auto'; pin.style.padding = '80px 0'; update(0.67); return; }
    update(0);
    (function tick() { if (near) { const target = progressOf(); cur += (target - cur) * 0.14; if (Math.abs(target - cur) < 0.0002) cur = target; update(cur); } requestAnimationFrame(tick); })();
    I18N.onChange = () => update(cur);
  })();

  /* ================= Jonlanishlar ================= */
  const io = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { threshold: 0.12, rootMargin: '0px 0px -30px 0px' });
  const watch = (el) => { if (reduce) el.classList.add('in'); else io.observe(el); };
  const titleIo = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.querySelectorAll(':scope > .print-title, :scope .print-title').forEach((x) => x.classList.add('in')); titleIo.unobserve(en.target); } }), { threshold: 0.2 });
  document.querySelectorAll('.print-title').forEach((x) => { if (reduce) x.classList.add('in'); else titleIo.observe(x.parentElement); });
  const countIo = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (!en.isIntersecting) return; countIo.unobserve(en.target);
    const el = en.target, to = Number(el.dataset.countTo), s0 = performance.now();
    (function step(now) { const k = clamp((now - s0) / 1400); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); })(s0);
  }));
  document.querySelectorAll('[data-count-to]').forEach((el) => { if (!reduce) countIo.observe(el); });

  /* Kursor: kartochka ustida "Ko'rish", video ustida "Video" */
  (function cursor() {
    if (!finePointer || reduce) return;
    const c = $('cursor'), lab = $('cursorLabel');
    let x = -100, y = -100, cx = -100, cy = -100;
    addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; c.classList.add('on'); }, { passive: true });
    document.addEventListener('pointerleave', () => c.classList.remove('on'));
    document.addEventListener('pointerover', (e) => {
      const tgt = e.target.closest('[data-cursor], a, button, summary, label, select, input, textarea');
      const kind = tgt && tgt.dataset.cursor;
      c.classList.toggle('big', !!kind); c.classList.toggle('link', !kind && !!tgt);
      lab.textContent = kind ? t('cursor.' + kind) : '';
    });
    (function follow() { cx += (x - cx) * 0.22; cy += (y - cy) * 0.22; c.style.transform = `translate(${cx}px, ${cy}px)`; requestAnimationFrame(follow); })();
    document.querySelectorAll('.magnetic').forEach((b) => {
      b.addEventListener('pointermove', (e) => { const r = b.getBoundingClientRect(); b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.18}px, ${(e.clientY - r.top - r.height / 2) * 0.3}px)`; });
      b.addEventListener('pointerleave', () => { b.style.transform = ''; });
    });
  })();

  /* ================= Sozlamalar ================= */
  function applySettings() {
    $('heroKicker').textContent = pick(S, 'heroKicker') || $('heroKicker').textContent;
    splitTitle(pick(S, 'heroTitle') || $('heroTitle').textContent);
    if (pick(S, 'heroText')) $('heroText').textContent = pick(S, 'heroText');
    if (S.followers) $('statFollowers').textContent = S.followers;
    const ann = pick(S, 'announce'); $('announce').hidden = !ann; $('announceText').textContent = ann;
    $('faqDelivery').textContent = (pick(S, 'delivery') ? pick(S, 'delivery') + '. ' : '') + t('faq.deliveryTail');
    if (S.city) $('footCity').textContent = S.city;
    if (S.workHours) { $('footHoursCol').hidden = false; $('footHours').textContent = S.workHours; }
    const phone = String(S.phone || '').replace(/[^\d+]/g, '');
    if (phone) { ['footCall', 'footPhone', 'fab'].forEach((id) => { $(id).href = 'tel:' + phone; }); $('footPhone').textContent = fmtPhone(phone); }
    const ig = String(S.instagram || '').replace(/^@/, '');
    if (ig) { const url = `https://www.instagram.com/${encodeURIComponent(ig)}/`; ['footIg', 'footIgHandle', 'igFollow'].forEach((id) => { $(id).href = url; }); $('footIgHandle').textContent = '@' + ig; }
    const tg = String(S.telegram || '').replace(/^@/, '').replace(/^https?:\/\/t\.me\//, '');
    if (tg) { $('footTgCol').hidden = false; $('footTg').href = 'https://t.me/' + encodeURIComponent(tg); $('footTg').textContent = '@' + tg; }
  }

  /* ================= Kataloglar ================= */
  const isNew = (p) => (p.badges || []).includes('new');
  function renderCats() {
    const grid = $('catGrid'); grid.replaceChildren();
    const newList = products.filter(isNew);
    const tiles = [{ id: '__new', name: t('cats.new'), blurb: t('cats.newBlurb'), cover: (newList[0] && (newList[0].images || [])[0]) || 'assets/img/lamp-orange.webp', count: newList.length, color: '#8BE04E' }]
      .concat(categories.map((c) => ({ id: c.id, name: pick(c, 'name'), blurb: pick(c, 'blurb'), cover: c.cover, color: c.color, count: products.filter((p) => p.category === c.id).length })));
    tiles.forEach((c) => {
      grid.append(h('button', { class: 'cat', type: 'button', 'data-cursor': 'view', style: { '--c': c.color || '#FF7A1A' }, onclick: () => pickCategory(c.id === '__new' ? 'new' : c.id, true) },
        c.cover ? h('img', { src: c.cover, alt: '', loading: 'lazy' }) : null,
        h('span', { class: 'cat-spool', 'aria-hidden': 'true' }),
        h('div', { class: 'cat-body' }, h('div', {}, h('h3', { text: c.name }), c.blurb ? h('p', { text: c.blurb }) : null), h('span', { class: 'cat-count', text: c.count }))));
    });
    if ((tiles.length - 1) % 2 === 1 && grid.lastChild) grid.lastChild.classList.add('wide-sm');
  }

  /* ================= Ko'rgazma: vertikal skroll gorizontal harakatga aylanadi ================= */
  const showcase = (function () {
    const sec = $('korgazma'), track = $('showcase'), bar = $('showcaseBar');
    let dist = 0, active = false;
    function measure() {
      active = innerWidth > 900 && !reduce;
      if (!active) { sec.style.height = ''; track.style.transform = ''; return; }
      dist = Math.max(0, track.scrollWidth - innerWidth);
      sec.style.height = (innerHeight + dist) + 'px';
      update();
    }
    function update() {
      if (!active) return;
      const r = sec.getBoundingClientRect();
      const p = clamp(-r.top / Math.max(1, sec.offsetHeight - innerHeight));
      track.style.transform = `translate3d(${-p * dist}px,0,0)`;
      bar.style.width = (p * 100) + '%';
    }
    addEventListener('scroll', () => { if (active) requestAnimationFrame(update); }, { passive: true });
    addEventListener('resize', measure);
    function render() {
      const list = products.filter((p) => p.featured).slice(0, 8);
      sec.hidden = !list.length;
      track.replaceChildren(...list.map((p, i) => h('button', { class: 'feat', type: 'button', 'data-cursor': 'view', style: { '--c': catColor(p.category) }, onclick: () => openProduct(p) },
        h('div', { class: 'feat-media' }, (p.images || [])[0] ? h('img', { src: p.images[0], alt: title(p), loading: 'lazy' }) : null),
        h('div', { class: 'feat-body' },
          h('span', { class: 'feat-num', text: `${String(i + 1).padStart(2, '0')} / ${String(list.length).padStart(2, '0')}` }),
          h('h3', { text: title(p) }),
          h('p', { text: pick(p, 'description') }),
          h('div', { class: 'feat-foot' }, priceEl(p), h('span', { class: 'feat-go', text: t('feat.open') }))))));
      requestAnimationFrame(measure);
    }
    return { render };
  })();

  /* ================= Mahsulotlar ================= */
  let category = 'all', query = '', sort = 'new';
  function pickCategory(id, scroll) { category = id; renderChips(); renderProducts(); if (scroll) $('mahsulotlar').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); }
  function renderChips() {
    const chips = $('chips'); chips.replaceChildren();
    const list = [['all', t('chip.all'), products.length], ['new', t('chip.new'), products.filter(isNew).length, '#8BE04E'], ['fav', t('chip.fav'), favs.filter((id) => byId(id)).length, '#F4A7C6']]
      .concat(categories.map((c) => [c.id, pick(c, 'name'), products.filter((p) => p.category === c.id).length, c.color])).filter((x) => x[0] === 'all' || x[0] === category || x[2] > 0);
    list.forEach(([id, name, n, color]) => chips.append(h('button', { class: 'chip', type: 'button', 'aria-pressed': String(id === category), style: color ? { '--c': color } : null, onclick: () => pickCategory(id) }, color ? h('i') : null, name, h('small', { text: n }))));
  }
  function filtered() {
    const q = query.toLowerCase();
    let list = products.filter((p) => (category === 'all' || (category === 'new' ? isNew(p) : category === 'fav' ? favs.includes(p.id) : p.category === category))
      && (!q || [p.title, p.title_ru, p.title_en, p.description, pick(cat(p.category), 'name')].join(' ').toLowerCase().includes(q)));
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
      card.style.setProperty('--ry', ((x - 0.5) * 9).toFixed(2) + 'deg'); card.style.setProperty('--rx', ((0.5 - y) * 7).toFixed(2) + 'deg');
      glare.style.setProperty('--gx', x * 100 + '%'); glare.style.setProperty('--gy', y * 100 + '%');
    });
    card.addEventListener('pointerleave', () => { card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); });
  }
  const badgeText = (b) => ({ new: t('chip.new'), hit: t('sort.popular').replace(/s$/, ''), sale: I18N.lang === 'ru' ? 'Скидка' : I18N.lang === 'en' ? 'Sale' : 'Chegirma', custom: BADGES.custom })[b] || b;
  function priceEl(p, cls) { return h('span', { class: cls || 'price' }, p.oldPrice > p.price ? h('s', { text: money(p.oldPrice, t('common.sum')) }) : null, p.price ? money(p.price, t('common.sum')) : t('shop.price0')); }
  const soldOut = (p) => p.stock != null && p.stock <= 0;
  function favBtn(p, cls) {
    const b = h('button', { class: (cls || 'pill-btn') + ' fav', type: 'button', 'aria-pressed': String(favs.includes(p.id)), 'aria-label': t('pd.fav'), html: IC.heart });
    b.addEventListener('click', (e) => { e.stopPropagation(); toggleFav(p.id); b.setAttribute('aria-pressed', String(favs.includes(p.id))); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); });
    return b;
  }
  function renderProducts() {
    const grid = $('products'); grid.replaceChildren();
    const list = filtered();
    if (!list.length) {
      grid.append(h('div', { class: 'empty' }, h('p', { text: query ? `“${query}” ${t('shop.noneQuery')}` : category === 'fav' ? t('cart.favEmpty') : t('shop.none') }), h('a', { class: 'btn btn-sm', href: '#buyurtma', text: t('shop.customCta') })));
      return;
    }
    list.forEach((p) => {
      const imgs = p.images || [];
      const card = h('article', { class: 'card', style: { '--c': catColor(p.category) } },
        h('div', { class: 'card-glare' }),
        h('div', { class: 'card-img', 'data-cursor': 'view', onclick: () => openProduct(p) },
          imgs[0] ? h('img', { src: imgs[0], alt: title(p), loading: 'lazy' }) : null,
          imgs[1] ? h('img', { class: 'alt', src: imgs[1], alt: '', loading: 'lazy' }) : null,
          h('div', { class: 'card-badges' }, soldOut(p) ? h('span', { class: 'badge out', text: t('shop.out') }) : null, (p.badges || []).map((b) => h('span', { class: 'badge ' + b, text: badgeText(b) }))),
          h('div', { class: 'card-side' }, favBtn(p),
            p.model ? h('button', { class: 'pill-btn', type: 'button', 'aria-label': '3D', text: '3D', onclick: (e) => { e.stopPropagation(); openProduct(p, true); } }) : null)),
        h('div', { class: 'card-body' },
          h('span', { class: 'card-cat' }, h('i'), pick(cat(p.category), 'name')),
          h('h3', { class: 'card-title', text: title(p), onclick: () => openProduct(p) }),
          p.stock != null && p.stock > 0 && p.stock <= 5 ? h('span', { class: 'card-stock', text: `${p.stock} ${t('shop.left')}` }) : null,
          h('div', { class: 'card-foot' }, priceEl(p),
            h('button', { class: 'add-btn', type: 'button', disabled: soldOut(p), 'aria-label': `${title(p)} — ${t('shop.add')}`, html: IC.plus, onclick: () => addToCart(p, 1, (p.colors || [])[0] || '') }))));
      grid.append(card); watch(card); tilt(card);
    });
  }
  $('search').addEventListener('input', (e) => { query = e.target.value.trim(); renderProducts(); });
  $('sort').addEventListener('change', (e) => { sort = e.target.value; renderProducts(); });
  document.querySelectorAll('[data-cat]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); pickCategory(a.dataset.cat, true); }));

  /* ================= Sevimlilar ================= */
  function toggleFav(id) {
    favs = favs.includes(id) ? favs.filter((x) => x !== id) : favs.concat(id);
    ls.set('up_favs', favs); renderCounts();
    if (category === 'fav') renderProducts(); else renderChips();
    if (drawer.classList.contains('open') && tab === 'fav') renderDrawer();
  }

  /* ================= Mahsulot oynasi ================= */
  let openModal = null;
  function openProduct(p, start3d) {
    if (openModal) openModal.close();
    const imgs = p.images || [];
    let tt = null; let color = (p.colors || [])[0] || ''; let qty = 1;
    const main = h('div', { class: 'pd-main' });
    const thumbs = h('div', { class: 'pd-thumbs' });
    const views = imgs.map((src) => ({ type: 'img', src }));
    if (p.model && window.UP3D && !NO3D) views.push({ type: '3d' });
    let vi = start3d && p.model ? views.length - 1 : 0;
    function show(i) {
      vi = i; if (tt) { tt.dispose(); tt = null; }
      main.replaceChildren(); main.classList.remove('zoom');
      const v = views[i];
      if (!v) main.append(h('div', { class: 'empty', text: '—' }));
      else if (v.type === 'img') main.append(h('img', { src: v.src, alt: title(p) }));
      else {
        const cv = h('canvas', { 'aria-label': title(p) + ' 3D' }); main.append(cv, h('span', { class: 'pd-hint', text: t('pd.3d') }));
        requestAnimationFrame(() => { try { tt = UP3D.createTurntable(cv, p.model, p.modelColor ? parseInt(p.modelColor.slice(1), 16) : undefined); } catch (e) { main.replaceChildren(h('div', { class: 'empty', text: '3D —' })); } });
      }
      [...thumbs.children].forEach((x, k) => x.setAttribute('aria-pressed', String(k === i)));
    }
    // Rasmni bosganda kattalashtirish (sichqoncha bilan qarash)
    main.addEventListener('click', (e) => { if (!main.querySelector('img')) return; const r = main.getBoundingClientRect(); main.style.setProperty('--zx', ((e.clientX - r.left) / r.width * 100) + '%'); main.style.setProperty('--zy', ((e.clientY - r.top) / r.height * 100) + '%'); main.classList.toggle('zoom'); });
    main.addEventListener('pointermove', (e) => { if (!main.classList.contains('zoom')) return; const r = main.getBoundingClientRect(); main.style.setProperty('--zx', ((e.clientX - r.left) / r.width * 100) + '%'); main.style.setProperty('--zy', ((e.clientY - r.top) / r.height * 100) + '%'); });
    views.forEach((v, i) => thumbs.append(h('button', { class: 'pd-thumb', type: 'button', 'aria-label': v.type === '3d' ? '3D' : `${i + 1}`, onclick: () => show(i) }, v.type === 'img' ? h('img', { src: v.src, alt: '' }) : '3D')));
    const qtyEl = h('span', { text: qty });
    const qtyBox = h('div', { class: 'qty' },
      h('button', { type: 'button', 'aria-label': '−', text: '−', onclick: () => { qty = Math.max(1, qty - 1); qtyEl.textContent = qty; } }), qtyEl,
      h('button', { type: 'button', 'aria-label': '+', text: '+', onclick: () => { qty = Math.min(p.stock != null ? Math.max(1, p.stock) : 999, qty + 1); qtyEl.textContent = qty; } }));
    const sw = h('div', { class: 'swatches' });
    (p.colors || []).forEach((c) => sw.append(h('button', { class: 'swatch', type: 'button', 'aria-pressed': String(c === color), text: c, onclick: (e) => { color = c; [...sw.children].forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); } })));
    const related = products.filter((x) => x.id !== p.id && x.category === p.category).concat(products.filter((x) => x.id !== p.id && x.category !== p.category && x.featured)).slice(0, 4);
    const out = soldOut(p);
    const share = h('button', { class: 'pd-link', type: 'button', html: IC.link + `<span>${UI.esc(t('pd.share'))}</span>`, onclick: async () => {
      const url = location.origin + location.pathname + '#p-' + p.id;
      try { await navigator.clipboard.writeText(url); toast(t('pd.copied')); } catch { prompt('', url); }
    } });
    const body = h('div', { class: 'pd' },
      h('div', { class: 'pd-media' }, main, views.length > 1 ? thumbs : null),
      h('div', { class: 'pd-info' },
        h('div', { class: 'card-badges', style: { position: 'static' } }, h('span', { class: 'badge', text: pick(cat(p.category), 'name') }), out ? h('span', { class: 'badge out', text: t('shop.out') }) : null, (p.badges || []).map((b) => h('span', { class: 'badge ' + b, text: badgeText(b) }))),
        h('h2', { text: title(p) }),
        h('div', { class: 'pd-price' }, p.price ? money(p.price, t('common.sum')) : t('shop.price0'), p.oldPrice > p.price ? h('s', { text: money(p.oldPrice, t('common.sum')) }) : null),
        pick(p, 'description') ? h('p', { class: 'muted', text: pick(p, 'description') }) : null,
        p.specs ? h('span', { class: 'pd-specs', text: p.specs }) : null,
        (p.colors || []).length ? h('div', { class: 'field' }, h('span', { class: 'label', text: t('pd.color') }), sw) : null,
        h('div', { class: 'field' }, h('span', { class: 'label', text: t('pd.qty') }), qtyBox),
        h('div', { class: 'pd-actions' },
          h('button', { class: 'btn', type: 'button', disabled: out, text: t('pd.add'), onclick: () => { addToCart(p, qty, color); m.close(); } }),
          h('button', { class: 'btn btn-ghost', type: 'button', disabled: out, text: t('pd.buy'), onclick: () => { addToCart(p, qty, color, true); m.close(); openDrawer('cart', true); } }),
          favBtn(p, 'icon-btn')),
        h('div', { class: 'pd-links' }, p.instagram ? h('a', { class: 'pd-link', href: p.instagram, target: '_blank', rel: 'noopener', html: IC.ig + `<span>${UI.esc(t('pd.ig'))}</span>` }) : null, share)),
      related.length ? h('div', { class: 'pd-related' }, h('h4', { text: t('pd.related') }),
        h('div', { class: 'rel-row' }, related.map((r) => h('button', { class: 'rel', type: 'button', onclick: () => openProduct(r) }, (r.images || [])[0] ? h('img', { src: r.images[0], alt: '', loading: 'lazy' }) : null, h('span', { text: title(r) }))))) : null);
    if (location.hash !== '#p-' + p.id) history.replaceState(null, '', '#p-' + p.id);
    const m = modal(title(p), body, { wide: true, onClose: () => { if (tt) tt.dispose(); if (openModal === m) openModal = null; if (/^#p-/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search); } });
    openModal = m;
    show(vi);
  }

  /* ================= Instagram videolari ================= */
  function renderReels() {
    const box = $('reels'); box.replaceChildren();
    $('videolar').hidden = !reels.length;
    const handle = '@' + String(S.instagram || '3durbanprint').replace(/^@/, '');
    reels.forEach((r) => box.append(h('button', { class: 'reel', type: 'button', 'data-cursor': 'play', 'aria-label': r.title || 'Instagram video', onclick: () => openReel(r) },
      r.cover ? h('img', { src: r.cover, alt: '', loading: 'lazy' }) : h('span', { class: 'reel-noimg' }),
      h('span', { class: 'reel-top' }, h('i'), handle), h('span', { class: 'reel-play', html: IC.play }),
      r.title ? h('span', { class: 'reel-title', text: r.title }) : null)));
  }
  function openReel(r) {
    const url = `https://www.instagram.com/reel/${encodeURIComponent(r.code)}/`;
    const body = h('div', { class: 'stack-sm' },
      h('div', { class: 'reel-frame' }, h('div', { class: 'spinner' }), h('iframe', { src: url + 'embed/', title: r.title || 'Instagram video', allow: 'autoplay; encrypted-media; picture-in-picture; clipboard-write', allowfullscreen: true, scrolling: 'no' })),
      h('a', { class: 'btn btn-ghost btn-sm', href: url, target: '_blank', rel: 'noopener', html: IC.ig + `<span>${UI.esc(t('reels.open'))}</span>` }));
    modal(r.title || 'Instagram', body).el.classList.add('reel-modal');
  }
  const scrollReels = (dir) => { const box = $('reels'); box.scrollBy({ left: dir * Math.min(box.clientWidth * 0.8, 800), behavior: reduce ? 'auto' : 'smooth' }); };
  $('reelPrev').addEventListener('click', () => scrollReels(-1));
  $('reelNext').addEventListener('click', () => scrollReels(1));

  /* ================= Savat, sevimlilar, rasmiylashtirish ================= */
  let cart = ls.get('up_cart_v2', []);
  const saveCart = () => ls.set('up_cart_v2', cart);
  const drawer = $('drawer'), scrim = $('scrim');
  let tab = 'cart', step = 'cart';
  let form = Object.assign({ name: '', phone: '', address: '', note: '', delivery: 'courier', payment: 'cash', promo: '', location: null }, ls.get('up_buyer', {}));
  let promoApplied = null;
  function openDrawer(which, checkout) {
    tab = which || 'cart'; step = checkout ? 'checkout' : 'cart';
    drawer.classList.add('open'); scrim.classList.add('open'); drawer.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('locked');
    renderDrawer(); $('drawerClose').focus();
  }
  function closeDrawer() {
    drawer.classList.remove('open'); scrim.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true');
    if (!document.querySelector('.overlay')) document.documentElement.classList.remove('locked');
    if (step === 'done') step = 'cart';
  }
  $('cartBtn').addEventListener('click', () => openDrawer('cart'));
  $('favBtn').addEventListener('click', () => openDrawer('fav'));
  $('drawerClose').addEventListener('click', closeDrawer);
  scrim.addEventListener('click', closeDrawer);
  drawer.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; if (step === 'done') step = 'cart'; renderDrawer(); }));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && drawer.classList.contains('open') && !document.querySelector('.overlay')) closeDrawer(); });
  function addToCart(p, qty, color, silent) {
    if (soldOut(p)) return;
    const l = cart.find((x) => x.id === p.id && x.color === color);
    const max = p.stock != null ? p.stock : 999;
    if (l) l.qty = Math.min(max, l.qty + qty); else cart.push({ id: p.id, qty: Math.min(max, qty), color });
    saveCart(); renderCounts();
    const b = $('cartBtn'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump');
    if (!silent) toast(`“${title(p)}” ${t('shop.added')}`);
  }
  const lines = () => cart.map((l) => ({ ...l, p: byId(l.id) })).filter((l) => l.p);
  function renderCounts() {
    const n = lines().reduce((s, l) => s + l.qty, 0), f = favs.filter((id) => byId(id)).length;
    $('cartCount').textContent = n; $('cartCount').hidden = !n;
    $('favCount').textContent = f; $('favCount').hidden = !f;
    $('tabCartN').textContent = n || ''; $('tabFavN').textContent = f || '';
  }
  function totals() {
    const ls2 = lines();
    const subtotal = ls2.reduce((s, l) => s + l.p.price * l.qty, 0);
    let discount = 0;
    if (promoApplied) discount = Math.min(subtotal, promoApplied.kind === 'sum' ? promoApplied.value : Math.round(subtotal * promoApplied.value / 100));
    if (promoApplied && subtotal < (promoApplied.minOrder || 0)) discount = 0;
    const after = subtotal - discount;
    const fee = form.delivery === 'pickup' ? 0 : (S.freeFrom && after >= S.freeFrom ? 0 : (S.deliveryFee || 0));
    return { subtotal, discount, fee, total: after + fee, after };
  }
  function summary(withFee) {
    const tt = totals(); const out = [];
    out.push(h('div', { class: 'sum-row' }, h('span', { text: t('cart.subtotal') }), h('span', { text: money(tt.subtotal, t('common.sum')) })));
    if (tt.discount) out.push(h('div', { class: 'sum-row' }, h('span', { text: `${t('cart.discount')} (${promoApplied.code})` }), h('span', { class: 'good', text: '−' + money(tt.discount, t('common.sum')) })));
    if (withFee) out.push(h('div', { class: 'sum-row' }, h('span', { text: t('cart.delivery') }), h('span', { class: tt.fee ? '' : 'good', text: tt.fee ? money(tt.fee, t('common.sum')) : t('cart.free') })));
    out.push(h('div', { class: 'sum-row total' }, h('span', { text: t('cart.total') }), h('span', { text: money(withFee ? tt.total : tt.after, t('common.sum')) })));
    return out;
  }
  function freeBar() {
    if (!S.freeFrom || form.delivery === 'pickup') return null;
    const tt = totals(); const left = S.freeFrom - tt.after;
    return h('div', { class: 'free-bar' }, h('span', { text: left > 0 ? t('cart.freeLeft', { x: money(left, t('common.sum')) }) : t('cart.freeOk') }), h('div', {}, h('i', { style: { width: Math.min(100, tt.after / S.freeFrom * 100) + '%' } })));
  }
  function renderDrawer() {
    renderCounts();
    drawer.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    const body = $('cartBody'), foot = $('cartFoot');
    body.replaceChildren(); foot.replaceChildren();
    if (tab === 'fav') return renderFavs(body);
    if (step === 'done') return;
    const ls2 = lines();
    if (!ls2.length) {
      body.append(h('div', { class: 'cart-empty', html: IC.bag }, h('p', { text: t('cart.empty') }), h('button', { class: 'btn btn-sm', type: 'button', text: t('cart.toShop'), onclick: () => { closeDrawer(); $('mahsulotlar').scrollIntoView({ behavior: 'smooth' }); } })));
      return;
    }
    if (step === 'checkout') return renderCheckout(body, foot);
    const setQty = (l, q) => { const c = cart.find((x) => x.id === l.id && x.color === l.color); if (q <= 0) cart = cart.filter((x) => x !== c); else c.qty = Math.min(l.p.stock != null ? l.p.stock : 999, q); saveCart(); renderDrawer(); };
    ls2.forEach((l) => body.append(h('div', { class: 'line' },
      (l.p.images || [])[0] ? h('img', { src: l.p.images[0], alt: '' }) : h('span'),
      h('div', {}, h('strong', { text: title(l.p) }), h('small', { text: (l.color ? l.color + ' · ' : '') + money(l.p.price, t('common.sum')) })),
      h('div', { class: 'line-right' },
        h('span', { class: 'price', style: { fontSize: '15px' }, text: money(l.p.price * l.qty, t('common.sum')) }),
        h('div', { class: 'qty' }, h('button', { type: 'button', 'aria-label': '−', text: '−', onclick: () => setQty(l, l.qty - 1) }), h('span', { text: l.qty }), h('button', { type: 'button', 'aria-label': '+', text: '+', onclick: () => setQty(l, l.qty + 1) }))))));
    const fb = freeBar(); if (fb) foot.append(fb);
    foot.append(...summary(false), h('button', { class: 'btn btn-wide', type: 'button', text: t('cart.checkout'), onclick: () => { step = 'checkout'; renderDrawer(); } }));
  }
  function renderFavs(body) {
    const list = favs.map(byId).filter(Boolean);
    if (!list.length) { body.append(h('div', { class: 'cart-empty', html: IC.heart.replace(/17/g, '48') }, h('p', { text: t('cart.favEmpty') }))); return; }
    list.forEach((p) => body.append(h('div', { class: 'line' },
      (p.images || [])[0] ? h('img', { src: p.images[0], alt: '', style: { cursor: 'pointer' }, onclick: () => { closeDrawer(); openProduct(p); } }) : h('span'),
      h('div', {}, h('strong', { text: title(p) }), h('small', { text: p.price ? money(p.price, t('common.sum')) : t('shop.price0') })),
      h('div', { class: 'line-right' },
        h('button', { class: 'add-btn', type: 'button', disabled: soldOut(p), 'aria-label': t('shop.add'), html: IC.plus, onclick: () => { addToCart(p, 1, (p.colors || [])[0] || ''); renderDrawer(); } }),
        h('button', { class: 'link-btn', type: 'button', style: { fontSize: '13px', color: 'var(--faint)' }, text: '✕', 'aria-label': 'Olib tashlash', onclick: () => toggleFav(p.id) })))));
  }
  function renderCheckout(body, foot) {
    const inp = (key, attrs) => { const el = h(attrs.tag || 'input', Object.assign({ class: attrs.tag === 'textarea' ? 'textarea' : 'input', id: 'c-' + key }, attrs, { tag: null })); el.value = form[key] || ''; el.addEventListener('input', () => { form[key] = el.value; }); return el; };
    const seg = (key, opts, onchange) => h('div', { class: 'seg', role: 'group' }, opts.map(([v, label, hint]) => h('button', { type: 'button', 'aria-pressed': String(form[key] === v), onclick: () => { form[key] = v; if (onchange) onchange(); renderDrawer(); } }, label, hint ? h('small', { text: hint }) : null)));
    body.append(h('button', { class: 'link-btn', type: 'button', style: { alignSelf: 'flex-start', color: 'var(--muted)', fontSize: '14px' }, text: '← ' + t('cart.back'), onclick: () => { step = 'cart'; renderDrawer(); } }));
    body.append(h('div', { class: 'grid-2' },
      h('div', { class: 'field' }, h('label', { for: 'c-name', text: t('f.name') }), inp('name', { autocomplete: 'name', maxlength: 80 })),
      h('div', { class: 'field' }, h('label', { for: 'c-phone', text: t('f.phone') }), inp('phone', { type: 'tel', inputmode: 'tel', autocomplete: 'tel', placeholder: '90 123 45 67' }))));
    body.append(h('div', { class: 'field' }, h('span', { class: 'label', text: t('co.how') }), seg('delivery', [['courier', t('co.courier')], ['pickup', t('co.pickup')]])));
    if (form.delivery === 'courier') {
      const mapWrap = h('div', { class: 'stack-sm' });
      const mapBtn = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: form.location ? '✓ ' + t('co.mapSet') : t('co.map'), onclick: () => openMap(mapWrap, mapBtn) });
      body.append(h('div', { class: 'field' }, h('label', { for: 'c-address', text: t('co.address') }), inp('address', { tag: 'textarea', style: { minHeight: '70px' }, placeholder: t('co.addressPh'), maxlength: 400 })), mapBtn, mapWrap);
    } else if (S.pickupAddress) {
      body.append(h('div', { class: 'pd-specs', text: `${t('co.pickupAt')}: ${S.pickupAddress}` }));
    }
    const payOpts = [['cash', t('co.cash'), t('co.cashHint')]];
    if (payAvail.payme) payOpts.push(['payme', 'Payme']);
    if (payAvail.click) payOpts.push(['click', 'Click']);
    if (!payOpts.some((o) => o[0] === form.payment)) form.payment = 'cash';
    body.append(h('div', { class: 'field' }, h('span', { class: 'label', text: t('co.pay') }), seg('payment', payOpts)));
    body.append(h('div', { class: 'field' }, h('label', { for: 'c-note', text: t('co.note') }), inp('note', { maxlength: 600, placeholder: t('co.notePh') })));
    // Promokod
    const promoIn = h('input', { class: 'input', id: 'c-promo', placeholder: t('co.promo'), maxlength: 30, value: promoApplied ? promoApplied.code : form.promo || '' });
    const promoMsg = h('small', { class: 'muted' });
    const promoBtn = h('button', { class: 'btn btn-ghost', type: 'button', text: t('co.apply'), onclick: async () => {
      const code = promoIn.value.trim(); if (!code) { promoApplied = null; renderDrawer(); return; }
      promoBtn.disabled = true;
      try { const r = await Store.promo(code, totals().subtotal); promoApplied = { code: r.code, kind: r.kind, value: r.value }; form.promo = r.code; renderDrawer(); }
      catch (e) { promoApplied = null; form.promo = ''; promoMsg.textContent = e.message; promoMsg.style.color = 'var(--danger)'; promoBtn.disabled = false; }
    } });
    body.append(h('div', { class: 'field' }, h('label', { for: 'c-promo', text: t('co.promo') }), h('div', { class: 'promo-row' }, promoIn, promoBtn), promoMsg));
    const err = h('p', { class: 'form-error', role: 'alert' });
    const online = form.payment !== 'cash';
    const go = h('button', { class: 'btn btn-wide', type: 'button', text: online ? t('co.placePay') : t('co.place') });
    go.addEventListener('click', async () => {
      err.textContent = ''; go.disabled = true;
      try {
        const r = await Store.order({ items: lines().map((l) => ({ id: l.id, qty: l.qty, color: l.color })), name: form.name, phone: form.phone, address: form.address, note: form.note, delivery: form.delivery, payment: form.payment, promo: promoApplied ? promoApplied.code : '', location: form.location, lang: I18N.lang });
        ls.set('up_buyer', { name: form.name, phone: form.phone, address: form.address, delivery: form.delivery, location: form.location });
        ls.set('up_last_order', { code: r.code, phone: normPhone(form.phone) });
        cart = []; saveCart(); promoApplied = null; form.promo = '';
        if (r.payUrl) { location.href = r.payUrl; return; }
        step = 'done'; renderCounts();
        $('cartFoot').replaceChildren();
        $('cartBody').replaceChildren(h('div', { class: 'done-box' }, h('div', { class: 'check', html: IC.check }),
          h('span', { class: 'order-code', text: r.code }),
          h('h3', { text: `${t('cart.total')}: ${money(r.total, t('common.sum'))} — ${t('co.done')}` }),
          h('p', { class: 'muted', text: t('co.doneText') }),
          h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: t('common.close'), onclick: closeDrawer })));
      } catch (ex) { err.textContent = ex.message; go.disabled = false; }
    });
    // Batafsil hisob tanada, pastki qismda faqat jami va tugma: telefonda forma uchun joy qoladi
    const rows = summary(true); const totalRow = rows.pop();
    const fb = freeBar();
    body.append(h('div', { class: 'stack-sm', style: { paddingTop: '6px', borderTop: '1px solid var(--line)' } }, ...[fb].filter(Boolean), ...rows));
    foot.append(totalRow, err, go, h('small', { class: 'muted', style: { textAlign: 'center' }, text: online ? t('co.payNote') : t('co.cashNote') }));
  }

  /* Xarita (OpenStreetMap, Leaflet faqat kerak bo'lganda yuklanadi) */
  let leafletP = null;
  function loadLeaflet() {
    if (window.L) return Promise.resolve();
    if (leafletP) return leafletP;
    leafletP = new Promise((res, rej) => {
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'; document.head.append(l);
      const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'; s.onload = res; s.onerror = () => { leafletP = null; rej(new Error('leaflet')); }; document.head.append(s);
    });
    return leafletP;
  }
  async function openMap(wrap, btn) {
    if (wrap.childNodes.length) return;
    const box = h('div', { class: 'map-box' }, h('div', { class: 'spinner', style: { margin: '100px auto' } }));
    const info = h('span', { text: t('co.mapHint') });
    const me = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: t('co.myLoc') });
    wrap.append(box, h('div', { class: 'map-tools' }, info, me));
    try { await loadLeaflet(); } catch { box.replaceChildren(h('p', { class: 'muted', style: { padding: '20px' }, text: t('co.mapFail') })); return; }
    box.replaceChildren();
    const start = form.location || { lat: 41.3111, lng: 69.2797 };
    const map = L.map(box, { zoomControl: true, attributionControl: true }).setView([start.lat, start.lng], form.location ? 16 : 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
    const marker = L.marker([start.lat, start.lng], { draggable: true }).addTo(map);
    const set = (ll) => { form.location = { lat: ll.lat, lng: ll.lng }; marker.setLatLng(ll); info.textContent = '✓ ' + t('co.mapSet'); btn.textContent = '✓ ' + t('co.mapSet'); };
    map.on('click', (e) => set(e.latlng));
    marker.on('dragend', () => set(marker.getLatLng()));
    me.addEventListener('click', () => navigator.geolocation && navigator.geolocation.getCurrentPosition((pos) => { const ll = { lat: pos.coords.latitude, lng: pos.coords.longitude }; map.setView([ll.lat, ll.lng], 17); set(ll); }, () => toast(t('co.mapFail'), true), { enableHighAccuracy: true, timeout: 10000 }));
    setTimeout(() => map.invalidateSize(), 200);
  }

  /* ================= Buyurtmani kuzatish ================= */
  const FLOW = ['new', 'confirmed', 'printing', 'shipped', 'done'];
  function openTrack(prefill, auto) {
    const last = ls.get('up_last_order', null);
    const code = h('input', { class: 'input', id: 'tr-code', placeholder: 'UP12345', value: (prefill && prefill.code) || (last && last.code) || '', style: { textTransform: 'uppercase' } });
    const phone = h('input', { class: 'input', id: 'tr-phone', type: 'tel', placeholder: '90 123 45 67', value: (prefill && prefill.phone) || (last && fmtPhone(last.phone)) || '' });
    const out = h('div', { class: 'stack-sm' }); const err = h('p', { class: 'form-error', role: 'alert' });
    const btn = h('button', { class: 'btn', type: 'submit', text: t('track.check') });
    const form2 = h('form', { class: 'stack', novalidate: true },
      h('div', { class: 'grid-2' }, h('div', { class: 'field' }, h('label', { for: 'tr-code', text: t('track.code') }), code), h('div', { class: 'field' }, h('label', { for: 'tr-phone', text: t('track.phone') }), phone)),
      err, btn, out);
    form2.addEventListener('submit', async (e) => {
      e.preventDefault(); err.textContent = ''; out.replaceChildren(); btn.disabled = true;
      try {
        const o = await Store.track(code.value, phone.value);
        const reached = new Set((o.history || []).map((x) => x.status));
        const at = Object.fromEntries((o.history || []).map((x) => [x.status, x.at]));
        const flow = o.status === 'cancelled' ? ['new', 'cancelled'] : (o.payment !== 'cash' ? ['pending_payment', 'paid'].concat(FLOW.slice(1)) : FLOW);
        out.append(...[
          o.status === 'paid' && auto ? h('div', { class: 'ok-box', text: t('track.paidOk') }) : null,
          h('div', { class: 'sum-row total' }, h('span', { class: 'order-code', style: { fontSize: '22px' }, text: o.code }), h('span', { text: money(o.total, t('common.sum')) })),
          h('ol', { class: 'timeline' }, flow.map((s) => h('li', { class: reached.has(s) || s === o.status ? 'on' : '' }, I18N.status(s), at[s] ? h('small', { text: UI.date(at[s]) }) : null))),
          h('div', { class: 'muted', style: { fontSize: '14px' } }, o.items.map((i) => h('div', { text: `${i.title}${i.color ? ' (' + i.color + ')' : ''} × ${i.qty}` })))].filter(Boolean));
      } catch (ex) { err.textContent = ex.message; }
      finally { btn.disabled = false; }
    });
    modal(t('track.title'), form2);
    if (auto && code.value && phone.value) form2.requestSubmit();
  }
  document.querySelectorAll('[data-track]').forEach((b) => b.addEventListener('click', () => openTrack()));

  /* ================= Maxsus buyurtma formasi ================= */
  (function customForm() {
    const formEl = $('reqForm'), input = $('r-files'), drop = $('drop'), list = $('fileList'), err = $('reqErr'), ok = $('reqOk'), btn = $('reqBtn');
    let files = []; const MAX = 40 * 1024 * 1024;
    const b0 = ls.get('up_buyer', {}); if (b0.name) $('r-name').value = b0.name; if (b0.phone) $('r-phone').value = b0.phone;
    function paint() {
      list.replaceChildren(...files.map((f, i) => h('span', { class: 'file-pill' },
        /^image\//.test(f.type) ? h('img', { src: URL.createObjectURL(f), alt: '' }) : h('span', { class: 'vid', text: 'VIDEO' }),
        h('span', { text: f.name }), h('button', { type: 'button', 'aria-label': '✕ ' + f.name, text: '✕', onclick: () => { files.splice(i, 1); paint(); } }))));
    }
    function add(fl) {
      err.textContent = '';
      for (const f of fl) {
        if (files.length >= 5) { err.textContent = 'Max 5'; break; }
        if (!/^(image|video)\//.test(f.type)) { err.textContent = t('f.files'); continue; }
        if (f.size > MAX) { err.textContent = `“${f.name}” > 40 MB`; continue; }
        files.push(f);
      }
      paint();
    }
    input.addEventListener('change', () => { add([...input.files]); input.value = ''; });
    ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', (e) => add([...e.dataTransfer.files]));
    document.querySelectorAll('[data-preset="biznes"]').forEach((a) => a.addEventListener('click', () => {
      if (!$('r-title').value) $('r-title').value = I18N.lang === 'ru' ? 'Продукция с логотипом (опт)' : I18N.lang === 'en' ? 'Branded products (bulk)' : 'Logotipli mahsulot (ulgurji)';
      if (!$('r-qty').value) $('r-qty').value = '100';
    }));
    formEl.addEventListener('submit', async (e) => {
      e.preventDefault(); err.textContent = ''; ok.hidden = true; btn.disabled = true; btn.textContent = t('f.sending');
      try {
        const r = await Store.request({ name: $('r-name').value, phone: $('r-phone').value, title: $('r-title').value, qty: $('r-qty').value, description: $('r-desc').value, link: $('r-link').value, files });
        ls.set('up_buyer', Object.assign(ls.get('up_buyer', {}), { name: $('r-name').value, phone: $('r-phone').value }));
        ['r-title', 'r-qty', 'r-desc', 'r-link'].forEach((id) => { $(id).value = ''; }); files = []; paint();
        ok.textContent = `#${r.id} ${t('f.sent')}`; ok.hidden = false;
      } catch (ex) { err.textContent = ex.message; }
      finally { btn.disabled = false; btn.textContent = t('f.send'); }
    });
  })();

  /* ================= Yig'ish ================= */
  function renderAll() {
    I18N.apply(); paintLang(); applySettings();
    renderCats(); showcase.render(); renderChips(); renderProducts(); renderReels(); renderCounts();
    if (drawer.classList.contains('open')) renderDrawer();
    if (I18N.onChange) I18N.onChange();
  }
  function fromHash() {
    const m = /^#p-(\d+)$/.exec(location.hash);
    if (m) { const p = byId(Number(m[1])); if (p) openProduct(p); }
  }
  addEventListener('hashchange', fromHash);
  I18N.apply(); paintLang();
  (function skeletons() { const g = $('products'); for (let i = 0; i < 4; i++) g.append(h('div', { class: 'skeleton' })); })();
  Store.catalog().then((c) => {
    S = c.settings || {}; categories = c.categories || []; products = c.products || []; reels = c.reels || []; payAvail = c.payments || payAvail;
    renderAll(); loader.done();
    fromHash();
    // To'lovdan qaytganda buyurtma holatini ko'rsatamiz
    const ord = new URLSearchParams(location.search).get('order');
    if (ord) { const last = ls.get('up_last_order', null); openTrack({ code: ord, phone: last && last.code === ord ? fmtPhone(last.phone) : '' }, true); history.replaceState(null, '', location.pathname); }
  }).catch(() => {
    $('products').replaceChildren(h('div', { class: 'empty', text: 'Mahsulotlarni yuklab boʻlmadi. Sahifani yangilang.' }));
    loader.done();
  });
})();
