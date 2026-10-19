'use strict';
/* 3D UrbanPrint: realistik 3D printer va qatlam-qatlam chop etilgan buyumlar (three.js r128).
   Bir xil kod ham skroll sahnasida, ham mahsulot rasmlarini tayyorlashda ishlatiladi. */
(function (g) {
  const THREE = g.THREE;
  const TAU = Math.PI * 2;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);
  const C = (hex) => new THREE.Color(hex).convertSRGBToLinear();

  /* ---------- Yorug'lik muhiti: studiya softbokslari ---------- */
  function studioEnv(renderer) {
    const s = new THREE.Scene();
    s.background = new THREE.Color(0x07080a);
    const panel = (w, h, x, y, z, k, col) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k), side: THREE.DoubleSide }));
      m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m);
    };
    panel(16, 9, -12, 10, 11, 2.2, 0xfff1e2);
    panel(10, 12, 15, 5, 7, 0.9, 0xd9e6ff);
    panel(22, 3, 0, 15, -7, 1.3, 0xffffff);
    panel(14, 6, -4, 3, -14, 0.6, 0xffd2a0);
    panel(40, 40, 0, -12, 0, 0.12, 0x8a7358);
    const pm = new THREE.PMREMGenerator(renderer);
    const tex = pm.fromScene(s, 0.035).texture;
    pm.dispose();
    return tex;
  }

  /* ---------- Materiallar ---------- */
  const mats = {
    pla: (color, o) => new THREE.MeshPhysicalMaterial(Object.assign({ color: C(color), roughness: 0.46, metalness: 0.04, clearcoat: 0.22, clearcoatRoughness: 0.5, side: THREE.DoubleSide }, o)),
    alu: new THREE.MeshStandardMaterial({ color: C(0x8d949b), metalness: 1, roughness: 0.4 }),
    anod: new THREE.MeshStandardMaterial({ color: C(0x15181b), metalness: 0.85, roughness: 0.4 }),
    chrome: new THREE.MeshStandardMaterial({ color: C(0xe4e8ec), metalness: 1, roughness: 0.14 }),
    plastic: new THREE.MeshStandardMaterial({ color: C(0x1c1f23), metalness: 0.1, roughness: 0.55 }),
    plastic2: new THREE.MeshStandardMaterial({ color: C(0x2a2f34), metalness: 0.1, roughness: 0.5 }),
    brass: new THREE.MeshStandardMaterial({ color: C(0xc89b3c), metalness: 1, roughness: 0.28 }),
    accent: new THREE.MeshStandardMaterial({ color: C(0xf5892a), metalness: 0.05, roughness: 0.5 }),
    glass: new THREE.MeshPhysicalMaterial({ color: C(0x0c0e10), metalness: 0.2, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 }),
    tube: new THREE.MeshStandardMaterial({ color: C(0xeceae4), roughness: 0.55 }),
  };

  function roundedBox(w, h, d, r, mat) {
    const b = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
    const iw = w - 2 * b, ih = h - 2 * b, rr = Math.max(b * 0.6, 0.001);
    const x = -iw / 2, y = -ih / 2;
    const s = new THREE.Shape();
    s.moveTo(x + rr, y); s.lineTo(x + iw - rr, y); s.quadraticCurveTo(x + iw, y, x + iw, y + rr);
    s.lineTo(x + iw, y + ih - rr); s.quadraticCurveTo(x + iw, y + ih, x + iw - rr, y + ih);
    s.lineTo(x + rr, y + ih); s.quadraticCurveTo(x, y + ih, x, y + ih - rr);
    s.lineTo(x, y + rr); s.quadraticCurveTo(x, y, x + rr, y);
    const geo = new THREE.ExtrudeGeometry(s, { depth: d - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 6 });
    geo.translate(0, 0, -(d - 2 * b) / 2);
    const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; return m;
  }
  function cyl(rt, rb, h, mat, seg = 32) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.castShadow = true; m.receiveShadow = true; return m;
  }
  function box(w, h, d, mat) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.castShadow = true; m.receiveShadow = true; return m;
  }

  /* ---------- Qatlamlar: burchak bo'yicha tartiblangan geometriya (drawRange bilan ochiladi) ---------- */
  function sweepGeometry(M, K, posAt) {
    const pos = new Float32Array(M * K * 3);
    for (let j = 0; j < M; j++) for (let k = 0; k < K; k++) {
      const p = posAt(j, k); const o = (j * K + k) * 3; pos[o] = p[0]; pos[o + 1] = p[1]; pos[o + 2] = p[2];
    }
    const idx = [];
    for (let j = 0; j < M; j++) {
      const j2 = (j + 1) % M;
      for (let k = 0; k < K; k++) {
        const k2 = (k + 1) % K;
        const a = j * K + k, b = j2 * K + k, c = j2 * K + k2, d = j * K + k2;
        idx.push(a, b, c, a, c, d);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    geo.userData.total = idx.length; geo.userData.perSeg = K * 6; geo.userData.M = M;
    return geo;
  }
  /* Ichi bo'sh (vaza rejimi) halqa: erkin radius funksiyasi, yumaloq kesim */
  function beadRing(rfun, y, a, b, M, K) {
    return sweepGeometry(M, K, (j, k) => {
      const th = (j / M) * TAU, ph = (k / K) * TAU;
      const cp = Math.cos(ph), sp = Math.sin(ph);
      const u = Math.sign(cp) * Math.pow(Math.abs(cp), 0.62), v = Math.sign(sp) * Math.pow(Math.abs(sp), 0.62);
      const r = rfun(th) + a * u;
      return [r * Math.cos(th), y + b * v, r * Math.sin(th)];
    });
  }
  /* Qattiq qatlam (disk): chetlari ozgina yumaloq, shuning uchun qatlamlar orasida egat ko'rinadi */
  function slab(r, y0, y1, bev, M) {
    const bv = Math.min(bev, (y1 - y0) * 0.45, r * 0.5);
    const prof = [[0, y0], [Math.max(r - bv, 0), y0], [r, y0 + bv], [r, y1 - bv], [Math.max(r - bv, 0), y1], [0, y1]];
    return sweepGeometry(M, prof.length, (j, k) => {
      const th = (j / M) * TAU; return [prof[k][0] * Math.cos(th), prof[k][1], prof[k][0] * Math.sin(th)];
    });
  }

  /* ---------- Buyum turlari ---------- */
  function tableR(tbl, y) {
    if (y <= tbl[0][0]) return tbl[0][1];
    for (let i = 1; i < tbl.length; i++) if (y <= tbl[i][0]) {
      const t = (y - tbl[i - 1][0]) / (tbl[i][0] - tbl[i - 1][0]);
      return lerp(tbl[i - 1][1], tbl[i][1], smooth(t));
    }
    return tbl[tbl.length - 1][1];
  }

  const KINDS = {
    /* Spiral qovurg'ali dizayn svetilnik */
    lamp: { H: 2.0, N: 100, hollow: true, color: 0xf5892a, rfun(t) {
      const s = Math.sin(Math.PI * (0.06 + 0.88 * t));
      const base = 0.62 + 0.58 * Math.pow(s, 0.85);
      return (th) => base * (1 + 0.07 * Math.cos(9 * th + 7.5 * t));
    } },
    /* Uzun, kuchli buralgan svetilnik */
    lampTall: { H: 2.6, N: 120, hollow: true, color: 0xe3cfa6, rfun(t) {
      const base = 0.58 + 0.2 * Math.sin(Math.PI * t * 1.3) + 0.1 * t;
      return (th) => base * (1 + 0.085 * Math.cos(6 * th + 14 * t));
    } },
    /* Shaxmat piyodasi: qattiq, aylanma */
    pawn: { H: 2.0, N: 100, hollow: false, color: 0xd8c39b, solid(y) {
      const tbl = [[0, 0.6], [0.1, 0.6], [0.13, 0.5], [0.2, 0.44], [0.4, 0.3], [0.8, 0.22], [1.15, 0.19], [1.2, 0.36], [1.3, 0.36], [1.34, 0.2], [1.55, 0.18]];
      const sph = 0.3 * 1.0, cy = 1.7;
      const head = Math.abs(y - cy) < sph ? Math.sqrt(sph * sph - (y - cy) * (y - cy)) : 0;
      const body = y <= 1.55 ? tableR(tbl, y) : 0;
      return Math.max(body, head);
    } },
  };

  /* Qatlamli buyum yaratadi. setLayers(f): f ta qatlam (kasr qismi hozirgi qatlamning burchagi) */
  function buildObject(kind, colorOverride) {
    const K = KINDS[kind];
    const group = new THREE.Group();
    const N = K.N, H = K.H, LH = H / N;
    const mat = mats.pla(colorOverride || K.color);
    const layers = [];
    const M = 140;
    for (let i = 0; i < N; i++) {
      const y0 = i * LH, y1 = y0 + LH * 1.02;
      let geo;
      if (K.hollow) {
        if (i < 3) geo = slab(K.rfun(0)(0) * 0.9, y0, y1, LH * 0.3, 96);
        else geo = beadRing(K.rfun(i / N), (y0 + y1) / 2, 0.052, LH * 0.56, M, 8);
      } else {
        const r = Math.max(K.solid((y0 + y1) / 2), 0.012);
        geo = slab(r, y0, y1, LH * 0.34, 96);
      }
      const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; m.visible = false; m.frustumCulled = false;
      group.add(m); layers.push(m);
    }
    function setLayers(f) {
      const full = Math.floor(f), frac = f - full;
      for (let i = 0; i < N; i++) {
        const m = layers[i], tot = m.geometry.userData.total;
        if (i < full) { m.visible = true; m.geometry.setDrawRange(0, tot); }
        else if (i === full && frac > 0.002) { m.visible = true; m.geometry.setDrawRange(0, Math.max(3, Math.floor(frac * m.geometry.userData.M) * m.geometry.userData.perSeg)); }
        else m.visible = false;
      }
    }
    /* Burchak th da, i-qatlamdagi chetki nuqta (mahalliy koordinata) */
    function rimAt(i, th) {
      i = Math.min(N - 1, i);
      const r = K.hollow ? K.rfun(i / N)(th) : K.solid((i + 0.5) * LH);
      return new THREE.Vector3(r * Math.cos(th), (i + 1) * LH, r * Math.sin(th));
    }
    return { group, N, H, LH, setLayers, rimAt, layers, hollow: K.hollow };
  }

  /* Breloklar: har qatlam alohida cho'ziq shakl */
  function buildKeychain(opts) {
    opts = opts || {};
    const base = mats.pla(opts.base || 0xf5892a), top = mats.pla(opts.top || 0x6fcf3b), dark = mats.pla(0x1d2024, { roughness: 0.5 });
    const group = new THREE.Group();
    const LH = 0.04, NB = 12, NT = 3;
    const rr = (w, h, r) => {
      const s = new THREE.Shape(); const x = -w / 2, y = -h / 2;
      s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0);
      s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2);
      s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
      s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
      return s;
    };
    const hex = (R) => { const s = new THREE.Shape(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + Math.PI / 6; const p = [R * Math.cos(a), R * Math.sin(a)]; i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1]); } s.closePath(); return s; };
    const lug = new THREE.Shape(); lug.absarc(0, 0, 0.42, 0, TAU);
    const hole = new THREE.Path(); hole.absarc(0, 0, 0.17, 0, TAU, true); lug.holes.push(hole);
    const ext = (shape, y, h, m, ox, oz) => {
      const geo = new THREE.ExtrudeGeometry(shape, { depth: h * 0.8, bevelEnabled: true, bevelThickness: h * 0.1, bevelSize: h * 0.1, bevelSegments: 2, curveSegments: 28 });
      geo.rotateX(-Math.PI / 2); geo.translate(ox || 0, y, oz || 0);
      const mm = new THREE.Mesh(geo, m); mm.castShadow = true; mm.receiveShadow = true; group.add(mm); return mm;
    };
    for (let i = 0; i < NB; i++) { ext(rr(2.3, 1.3, 0.3), i * LH, LH, base, 0.25, 0); ext(lug, i * LH, LH, base, -1.25, 0); }
    for (let i = 0; i < NT; i++) ext(hex(0.5 - i * 0.012), (NB + i) * LH, LH, i === 0 ? dark : top, 0.55, 0);
    for (let i = 0; i < 2; i++) ext(hex(0.28), (NB + NT + i) * LH, LH, base, 0.55, 0);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.04, 14, 48), mats.chrome);
    ring.position.set(-1.25 - 0.28, 0.13, 0); ring.rotation.set(Math.PI / 2 - 0.5, 0, 0.0); ring.castShadow = true; group.add(ring);
    return group;
  }

  /* ---------- Printer ---------- */
  const NOZ_Y = 3.55;
  function buildPrinter() {
    const P = new THREE.Group();
    const lab = document.createElement('canvas'); lab.width = 512; lab.height = 128;
    const lc = lab.getContext('2d'); lc.fillStyle = '#0c0e10'; lc.fillRect(0, 0, 512, 128);
    lc.fillStyle = '#f5892a'; lc.font = '700 54px Arial, sans-serif'; lc.fillText('3D URBANPRINT', 26, 62);
    lc.fillStyle = '#6fcf3b'; lc.fillRect(26, 84, 70, 8); lc.fillStyle = '#59626c'; lc.fillRect(110, 84, 250, 8);
    const labTex = new THREE.CanvasTexture(lab); labTex.encoding = THREE.sRGBEncoding;

    // Taglik
    const bas = roundedBox(4.1, 0.46, 3.7, 0.1, mats.plastic); bas.position.y = 0.23; P.add(bas);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshBasicMaterial({ map: labTex, toneMapped: false })); face.position.set(0.8, 0.23, 1.86); P.add(face);
    const strip = box(4.1, 0.03, 0.02, mats.accent); strip.position.set(0, 0.47, 1.84); P.add(strip);
    // Burchak ustunlari
    [[-1.9, -1.65], [1.9, -1.65], [-1.9, 1.65], [1.9, 1.65]].forEach(([x, z]) => {
      const post = box(0.16, 3.85, 0.16, mats.alu); post.position.set(x, 0.46 + 1.925, z); P.add(post);
      const foot = box(0.26, 0.1, 0.26, mats.anod); foot.position.set(x, 0.5, z); P.add(foot);
      const cap = box(0.24, 0.1, 0.24, mats.anod); cap.position.set(x, 4.36, z); P.add(cap);
    });
    // Yuqori ramka
    [[-1.9, 1], [1.9, 1]].forEach(([x]) => { const b = box(0.12, 0.1, 3.4, mats.anod); b.position.set(x, 4.3, 0); P.add(b); });
    [[-1.65], [1.65]].forEach(([z]) => { const b = box(3.8, 0.1, 0.12, mats.anod); b.position.set(0, 4.3, z); P.add(b); });
    // Orqa panel va lift ustuni
    const back = box(3.7, 3.6, 0.04, mats.plastic2); back.position.set(0, 2.28, -1.7); P.add(back);
    const screw = cyl(0.05, 0.05, 3.7, mats.chrome, 20); screw.position.set(0, 2.3, -1.45); P.add(screw);
    const rail2 = cyl(0.04, 0.04, 3.7, mats.chrome, 16); rail2.position.set(-0.4, 2.3, -1.45); P.add(rail2);
    // Z yo'naltiruvchi sterjenlar (yon)
    [-1.5, 1.5].forEach((x) => { const r = cyl(0.045, 0.045, 3.3, mats.chrome, 20); r.rotation.x = Math.PI / 2; r.position.set(x, 4.0, 0); P.add(r); });
    [-1.5, 1.5].forEach((x) => { const r = cyl(0.04, 0.04, 3.3, mats.chrome, 16); r.rotation.x = Math.PI / 2; r.position.set(x, 3.78, 0); P.add(r); });

    // Ko'chuvchi X ko'prik
    const xbar = new THREE.Group(); P.add(xbar);
    [4.0, 3.78].forEach((y, i) => { const r = cyl(0.04, 0.04, 3.2, mats.chrome, 16); r.rotation.z = Math.PI / 2; r.position.set(0, y, i ? 0.06 : -0.06); xbar.add(r); });
    [-1.5, 1.5].forEach((x) => { const s = roundedBox(0.34, 0.42, 0.34, 0.06, mats.plastic2); s.position.set(x, 3.89, 0); xbar.add(s); const a = box(0.34, 0.03, 0.34, mats.accent); a.position.set(x, 4.1, 0); xbar.add(a); });
    // Bosh (head)
    const head = new THREE.Group(); xbar.add(head);
    const hb = roundedBox(0.62, 0.5, 0.62, 0.08, mats.plastic2); hb.position.set(0, 3.9, 0); head.add(hb);
    const hf = box(0.5, 0.2, 0.02, mats.accent); hf.position.set(0, 3.98, 0.32); head.add(hf);
    const fan = cyl(0.17, 0.17, 0.08, mats.anod, 24); fan.rotation.x = Math.PI / 2; fan.position.set(0, 3.9, 0.35); head.add(fan);
    const duct = roundedBox(0.4, 0.2, 0.34, 0.05, mats.plastic); duct.position.set(0, 3.6, 0.02); head.add(duct);
    const heater = box(0.2, 0.12, 0.2, mats.brass); heater.position.set(0, 3.58, 0); head.add(heater);
    const cone = cyl(0.015, 0.075, 0.1, mats.brass, 20); cone.position.set(0, NOZ_Y + 0.05, 0); head.add(cone);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 12), new THREE.MeshBasicMaterial({ color: C(0xffa24d), toneMapped: false })); tip.position.set(0, NOZ_Y, 0); head.add(tip);
    const nozLight = new THREE.PointLight(0xff8a2a, 0.9, 2.4, 2); nozLight.position.set(0, NOZ_Y - 0.12, 0); head.add(nozLight);

    // Pech (yotqizish) sathi, pastga tushadi
    const bed = new THREE.Group(); P.add(bed);
    const bplate = roundedBox(2.9, 0.07, 2.9, 0.03, mats.glass); bplate.position.y = -0.035; bed.add(bplate);
    const bh = roundedBox(2.7, 0.2, 2.7, 0.04, mats.anod); bh.position.y = -0.18; bed.add(bh);
    const arm = roundedBox(0.6, 0.3, 1.5, 0.05, mats.plastic2); arm.position.set(0, -0.2, -1.4); bed.add(arm);
    const trim = box(2.92, 0.02, 0.03, mats.accent); trim.position.set(0, -0.05, 1.45); bed.add(trim);

    // Filament g'altagi
    const spool = new THREE.Group(); spool.position.set(1.0, 5.15, -1.0); P.add(spool);
    [-0.34, 0.34].forEach((dx) => { const f = cyl(0.78, 0.78, 0.05, new THREE.MeshStandardMaterial({ color: C(0x14171a), roughness: 0.4, metalness: 0.1 }), 56); f.rotation.z = Math.PI / 2; f.position.x = dx; spool.add(f); });
    const wound = cyl(0.7, 0.7, 0.62, mats.pla(0xf5892a, { roughness: 0.62 }), 56); wound.rotation.z = Math.PI / 2; spool.add(wound);
    const hub = cyl(0.2, 0.2, 0.7, mats.plastic, 24); hub.rotation.z = Math.PI / 2; spool.add(hub);
    const sh = cyl(0.04, 0.04, 1.1, mats.chrome, 12); sh.rotation.z = Math.PI / 2; sh.position.set(0, 0, 0); spool.add(sh);
    [-0.55, 0.55].forEach((dx) => { const b = box(0.06, 0.8, 0.16, mats.anod); b.position.set(dx, -0.4, 0); spool.add(b); });
    const spoolBase = box(1.3, 0.1, 0.5, mats.anod); spoolBase.position.set(1.0, 4.4, -1.0); P.add(spoolBase);

    // Filament naychasi: bosh bilan birga o'zgaradi
    const tubeMesh = new THREE.Mesh(new THREE.BufferGeometry(), mats.tube); tubeMesh.castShadow = true; P.add(tubeMesh);
    function updateTube() {
      const hp = new THREE.Vector3(head.position.x, 4.1, xbar.position.z);
      const sp = new THREE.Vector3(1.0 - 0.34, 5.15 + 0.7, -1.0);
      const mid = new THREE.Vector3((hp.x + sp.x) / 2, 5.5, (hp.z + sp.z) / 2);
      const curve = new THREE.CatmullRomCurve3([sp, mid, new THREE.Vector3(hp.x, 4.9, hp.z), hp]);
      tubeMesh.geometry.dispose();
      tubeMesh.geometry = new THREE.TubeGeometry(curve, 36, 0.035, 8, false);
    }
    function setHead(x, z) { head.position.x = x; xbar.position.z = z; updateTube(); }
    function setBed(y) { bed.position.y = y; }
    function glow(k) { nozLight.intensity = 0.9 * k; tip.visible = k > 0.05; }
    setHead(0, 0); setBed(NOZ_Y - 0.02);
    return { group: P, bed, head, xbar, setHead, setBed, glow, NOZ_Y };
  }

  /* ---------- Studiya rasmi (mahsulot kartochkasi uchun) ---------- */
  function studioScene(renderer, w, h) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x15181b);
    scene.fog = new THREE.Fog(0x15181b, 14, 30);
    scene.environment = studioEnv(renderer);
    const cam = new THREE.PerspectiveCamera(28, w / h, 0.1, 100);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 64), new THREE.MeshStandardMaterial({ color: C(0x1e2328), roughness: 0.8, metalness: 0.0 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    const key = new THREE.SpotLight(0xfff0e0, 2.2, 0, 0.5, 0.7, 1); key.position.set(-5, 9, 6); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.radius = 5; scene.add(key, key.target);
    const rim = new THREE.DirectionalLight(0xffa24d, 0.8); rim.position.set(6, 3, -6); scene.add(rim);
    return { scene, cam, floor, key };
  }

  /* ---------- Skroll sahnasi ---------- */
  function createHero(canvas, opts) {
    opts = opts || {};
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.preserve });
    renderer.setPixelRatio(Math.min(g.devicePixelRatio || 1, 1.75));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.8;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    scene.environment = studioEnv(renderer);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 120);
    const printer = buildPrinter(); scene.add(printer.group);
    const kind = opts.kind || 'lamp';
    const obj = buildObject(kind);
    const holder = new THREE.Group(); holder.add(obj.group); printer.bed.add(holder);
    const key = new THREE.DirectionalLight(0xfff1e0, 1.5); key.position.set(2, 12, 7); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = -7; key.shadow.camera.right = 7; key.shadow.camera.top = 9; key.shadow.camera.bottom = -4; key.shadow.camera.far = 40;
    key.shadow.bias = -0.0005; key.shadow.radius = 4; scene.add(key);
    const rim = new THREE.DirectionalLight(0xffa24d, 0.9); rim.position.set(7, 4, -6); scene.add(rim);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.5 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.001; ground.receiveShadow = true; scene.add(ground);

    function resize() {
      const w = canvas.clientWidth || 600, h = canvas.clientHeight || 640;
      renderer.setSize(w, h, false); cam.aspect = w / h;
      const narrow = w / h < 0.9;
      cam.position.set(5.6, 4.3, narrow ? 15.6 : 13.2); cam.lookAt(0.2, 2.5, 0); cam.updateProjectionMatrix();
    }
    resize();

    const N = obj.N, LH = obj.LH;
    function setProgress(p) {
      const pp = clamp(p / 0.68), f = pp * N;
      obj.setLayers(f);
      const full = Math.min(N - 1, Math.floor(f)), frac = f - Math.floor(f);
      const done = Math.min(N, f);
      printer.setBed(NOZ_Y - 0.02 - done * LH);
      const hold = smooth(clamp((p - 0.68) / 0.1));
      const th = pp < 1 ? frac * TAU : 0;
      const rim0 = obj.rimAt(full, th);
      let hx = pp < 1 ? rim0.x : 1.3, hz = pp < 1 ? rim0.z : 0;
      hx = lerp(hx, 1.2, hold); hz = lerp(hz, -1.1, hold);
      printer.setHead(hx, hz);
      printer.glow(1 - hold);
      // Tushish bosqichi
      const d = clamp((p - 0.78) / 0.22);
      const slide = smooth(clamp(d / 0.32)), fall = clamp((d - 0.32) / 0.68);
      holder.position.set(0, 0, slide * 4.4);
      holder.position.y = -fall * fall * 15;
      holder.rotation.x = fall * 1.1 + slide * 0.04; holder.rotation.z = fall * 0.5;
      if (opts.onFrame) opts.onFrame(p);
    }
    let pending = 0;
    function render() { renderer.render(scene, cam); }
    return { renderer, scene, cam, printer, obj, holder, setProgress, render, resize, dispose() { renderer.dispose(); } };
  }

  /* ---------- Bosh ekran: printer to'xtovsiz chop etadi, buyumlar almashib turadi ---------- */
  function createLoop(canvas, opts) {
    opts = opts || {};
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    let maxDpr = opts.dpr || 1.6;
    renderer.setPixelRatio(Math.min(g.devicePixelRatio || 1, maxDpr));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.85;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    scene.environment = studioEnv(renderer);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 160);
    const printer = buildPrinter(); scene.add(printer.group);
    const key = new THREE.DirectionalLight(0xfff1e0, 1.4); key.position.set(3, 12, 8); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -7; key.shadow.camera.right = 7; key.shadow.camera.top = 9; key.shadow.camera.bottom = -4;
    key.shadow.bias = -0.0005; key.shadow.radius = 4; scene.add(key);
    const rim = new THREE.DirectionalLight(0xffa24d, 1.1); rim.position.set(-7, 5, -6); scene.add(rim);
    const rim2 = new THREE.DirectionalLight(0x6fcf3b, 0.45); rim2.position.set(8, 2, -4); scene.add(rim2);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.45 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

    // Atrofda suzib yuruvchi tayyor buyumlar
    const floaters = new THREE.Group(); scene.add(floaters);
    const fl = [];
    const addFloat = (obj, x, y, z, s, sp) => { obj.scale.setScalar(s); obj.position.set(x, y, z); floaters.add(obj); fl.push({ o: obj, y, sp, ph: Math.random() * TAU }); };
    // Har bir suzuvchi buyumning qatlamlari bitta geometriyaga birlashtiriladi (telefonlarda tez ishlashi uchun)
    function merged(kind, color) {
      const o = buildObject(kind, color);
      let nv = 0, ni = 0;
      o.layers.forEach((m) => { nv += m.geometry.attributes.position.count; ni += m.geometry.index.count; });
      const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), idx = new Uint32Array(ni);
      let vo = 0, io = 0;
      o.layers.forEach((m) => {
        const gg = m.geometry; pos.set(gg.attributes.position.array, vo * 3); nor.set(gg.attributes.normal.array, vo * 3);
        const src = gg.index.array; for (let i = 0; i < src.length; i++) idx[io + i] = src[i] + vo;
        vo += gg.attributes.position.count; io += src.length; gg.dispose();
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setIndex(new THREE.BufferAttribute(idx, 1));
      const mesh = new THREE.Mesh(geo, o.layers[0].material); mesh.position.y = -o.H / 2;
      const w = new THREE.Group(); w.add(mesh); return w;
    }
    [['lamp', 0x6fcf3b, -5.2, 5.4, -3.5, 0.55], ['lampTall', 0xe3cfa6, 4.9, 1.2, -2.5, 0.5], ['pawn', 0xf5892a, -4.6, 1.0, 1.6, 0.6]].forEach(([k, c, x, y, z, s], i) => {
      addFloat(merged(k, c), x, y, z, s, 0.25 + i * 0.08);
    });
    const kc = buildKeychain({ base: 0xf5892a, top: 0x6fcf3b }); kc.rotation.x = 1.1; const kw = new THREE.Group(); kw.add(kc); addFloat(kw, 4.0, 5.0, 0.6, 0.55, 0.32);

    const queue = opts.queue || [['lamp', 0xf5892a], ['pawn', 0xd8c39b], ['lampTall', 0xe3cfa6], ['lamp', 0x6fcf3b]];
    let qi = 0, obj = null;
    const holder = new THREE.Group(); printer.bed.add(holder);
    function next() {
      if (obj) { holder.remove(obj.group); obj.layers.forEach((m) => m.geometry.dispose()); }
      const [k, c] = queue[qi++ % queue.length];
      obj = buildObject(k, c); holder.add(obj.group);
      holder.position.set(0, 0, 0); holder.rotation.set(0, 0, 0);
    }
    next();

    let mx = 0, my = 0, tx = 0, ty = 0;
    function resize() {
      const w = canvas.clientWidth || 600, h = canvas.clientHeight || 640;
      renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
    }
    resize();
    function pointer(x, y) { tx = x; ty = y; }

    const DUR = opts.duration || 16;
    let t = opts.start || 0.25 * DUR;
    function step(dt) {
      t += dt;
      if (t > DUR) { t = 0; next(); }
      const p = t / DUR;
      const N = obj.N, LH = obj.LH;
      const pp = clamp(p / 0.72), f = pp * N;
      obj.setLayers(f);
      const full = Math.min(N - 1, Math.floor(f)), frac = f - Math.floor(f);
      printer.setBed(NOZ_Y - 0.02 - Math.min(N, f) * LH);
      const hold = smooth(clamp((p - 0.72) / 0.08));
      const rimP = obj.rimAt(full, pp < 1 ? frac * TAU : 0);
      printer.setHead(lerp(pp < 1 ? rimP.x : 1.3, 1.2, hold), lerp(pp < 1 ? rimP.z : 0, -1.1, hold));
      printer.glow(1 - hold);
      const d = clamp((p - 0.82) / 0.18);
      const slide = smooth(clamp(d / 0.4)), fall = clamp((d - 0.4) / 0.6);
      holder.position.set(0, -fall * fall * 14, slide * 4.4);
      holder.rotation.set(fall * 1.1, 0, fall * 0.5);
      // Kamera: sekin aylanadi va sichqonchaga ergashadi
      mx += (tx - mx) * 0.05; my += (ty - my) * 0.05;
      const narrow = cam.aspect < 0.9;
      const ang = 0.42 + Math.sin(performance.now() / 9000) * 0.18 + mx * 0.25;
      const R = narrow ? 17.5 : 14.5;
      cam.position.set(Math.sin(ang) * R, 4.6 + my * 1.4, Math.cos(ang) * R);
      cam.lookAt(0, 2.4, 0);
      const now = performance.now() / 1000;
      fl.forEach((q) => { q.o.position.y = q.y + Math.sin(now * q.sp * 2 + q.ph) * 0.35; q.o.rotation.y += dt * q.sp; });
      renderer.render(scene, cam);
      return { layer: Math.min(N, Math.floor(f)), N, done: pp >= 1 };
    }
    function quality(dpr, shadows) {
      maxDpr = dpr; renderer.setPixelRatio(Math.min(g.devicePixelRatio || 1, dpr));
      renderer.shadowMap.enabled = shadows !== false; resize();
    }
    return { step, resize, pointer, quality, renderer, dispose() { renderer.dispose(); } };
  }

  /* ---------- Mahsulot oynasi: aylanuvchi 3D model ---------- */
  function createTurntable(canvas, kind, color) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(g.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.9;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene(); scene.environment = studioEnv(renderer);
    const cam = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    const key = new THREE.DirectionalLight(0xfff1e0, 1.6); key.position.set(-4, 9, 6); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.radius = 5; scene.add(key);
    const rim = new THREE.DirectionalLight(0xffa24d, 0.9); rim.position.set(6, 3, -6); scene.add(rim);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(6, 48), new THREE.ShadowMaterial({ opacity: 0.4 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    const spin = new THREE.Group(); scene.add(spin);
    let H = 2;
    if (kind === 'keychain') { const k = buildKeychain({ base: color || 0xf5892a }); k.position.y = 0.05; spin.add(k); H = 0.8; }
    else { const o = buildObject(KINDS[kind] ? kind : 'lamp', color); o.setLayers(o.N); spin.add(o.group); H = o.H; }
    let drag = false, lx = 0, vel = 0.6, rot = 0, build = 0;
    canvas.addEventListener('pointerdown', (e) => { drag = true; lx = e.clientX; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', (e) => { if (!drag) return; const dx = e.clientX - lx; lx = e.clientX; rot += dx * 0.012; vel = dx * 0.6; });
    canvas.addEventListener('pointerup', () => { drag = false; });
    function resize() {
      const w = canvas.clientWidth || 400, h = canvas.clientHeight || 400;
      renderer.setSize(w, h, false); cam.aspect = w / h;
      const d = 4.2 + H * 2.2; cam.position.set(0, H * 0.9 + 1.2, d); cam.lookAt(0, H * 0.45, 0); cam.updateProjectionMatrix();
    }
    resize();
    let raf = 0, last = performance.now(), alive = true;
    function loop(now) {
      if (!alive) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!drag) { vel += (0.6 - vel) * 0.03; rot += vel * dt; }
      spin.rotation.y = rot;
      build = Math.min(1, build + dt * 0.9);
      spin.scale.set(1, smooth(build), 1);
      renderer.render(scene, cam);
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    return { resize, dispose() { alive = false; cancelAnimationFrame(raf); renderer.dispose(); renderer.forceContextLoss && renderer.forceContextLoss(); } };
  }

  g.UP3D = { THREE, studioEnv, studioScene, buildPrinter, buildObject, buildKeychain, createHero, createLoop, createTurntable, mats, roundedBox, KINDS, NOZ_Y };
})(window);

