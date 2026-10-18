(window.KOB_FILES = window.KOB_FILES || {}).deck = '12';
/* ═══════════════════════════════════════════════════════════════════
   KING OF BEASTS — the layout builder (light signs + drone fleets)
   Assemble the surroundings freely: add signs and fleets, place them on the mini-map, give each its
   own words, colour, style, size, height and facing. Everything is saved per viewer; URL parameters
   (sign, drone, …) win over what was saved.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const KOB = (window.KOB = window.KOB || {});
  const $ = (s) => document.querySelector(s);

  const PAL = { gold: [1, 0.62, 0.22], red: [1, 0.1, 0.05], white: [1, 0.9, 0.78], cyan: [0.12, 0.72, 1], magenta: [1, 0.12, 0.55], jade: [0.08, 1, 0.48], violet: [0.55, 0.18, 1] };
  const CSS = { gold: '#ffb347', red: '#ff3b2f', white: '#fff1dc', cyan: '#3cc8ff', magenta: '#ff3fa0', jade: '#2cf59a', violet: '#9b5cff' };
  const lin = (h) => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.pow(v / 255, 2.2)); };
  const colOf = (c) => (PAL[c] ? PAL[c] : /^#?[0-9a-f]{6}$/i.test(c || '') ? lin(c) : PAL.gold);
  const cssOf = (c) => (CSS[c] ? CSS[c] : /^#?[0-9a-f]{6}$/i.test(c || '') ? (c[0] === '#' ? c : '#' + c) : CSS.gold);
  const KEY = 'kob.layout.v5';
  const BOWL = [160, 178];

  const DEFAULTS = () => ({
    signs: [
      { id: 's1', text: '万兽之王', color: 'gold', style: 1, anim: 1, on: true, x: 226, y: -150, height: 9.6, lift: 0.7, angle: null },
      { id: 's2', text: '薛之谦', color: 'red', style: 0, anim: 2, on: true, x: 168, y: -205, height: 6, lift: 15, angle: null },
    ],
    ticker: { on: true, text: '万兽之王 · 薛之谦', banners: false, screen: false },
    fleets: [{ id: 'f1', shape: 'text', text: '万兽之王', color: 'gold', effect: 1, on: true, x: -96, y: -98, alt: 118, size: 100, angle: null }],
    venue: { follow: true, shape: 'crown', text: '薛之谦', color: 'gold', effect: 1 },
  });

  KOB.makeDeck = function (app, ui) {
    const P = KOB.params, C = app.custom, W = KOB.WORLD;
    let L = DEFAULTS();
    try { const sv = JSON.parse(localStorage.getItem(KEY) || 'null'); if (sv && sv.signs && sv.fleets) L = Object.assign(DEFAULTS(), sv); } catch (e) { /* private mode */ }
    // URL parameters
    const pick = (v, list) => { const i = list.indexOf(String(v).toLowerCase()); return i >= 0 ? i : null; };
    const s0 = L.signs[0], f0 = L.fleets[0];
    if (s0) {
      if (P.sign != null) s0.text = String(P.sign).slice(0, 14);
      if (P.signColor != null) s0.color = String(P.signColor);
      if (P.signStyle != null && pick(P.signStyle, ['neon', 'bulbs', 'led']) != null) s0.style = pick(P.signStyle, ['neon', 'bulbs', 'led']);
      if (P.signAnim != null && pick(P.signAnim, ['steady', 'chase', 'pulse', 'rainbow']) != null) s0.anim = pick(P.signAnim, ['steady', 'chase', 'pulse', 'rainbow']);
    }
    if (P.ticker != null) L.ticker.on = !/^(0|false|no|off)$/i.test(String(P.ticker));
    if (f0) {
      if (P.drone != null) { f0.text = String(P.drone).slice(0, 14); f0.shape = 'text'; }
      if (P.droneShape != null && ['text', 'crown', 'heart', 'eye', 'claws', 'sphere', 'rings'].includes(String(P.droneShape))) f0.shape = String(P.droneShape);
      if (P.droneColor != null) f0.color = String(P.droneColor);
      if (P.droneFx != null && pick(P.droneFx, ['steady', 'wave', 'sparkle', 'rainbow']) != null) f0.effect = pick(P.droneFx, ['steady', 'wave', 'sparkle', 'rainbow']);
      const spots = { behind: [-96, -98, 118], lake: [330, -150, 90], crown: [0, 0, 215] };
      if (P.droneSpot != null && spots[P.droneSpot]) [f0.x, f0.y, f0.alt] = spots[P.droneSpot];
    }
    let saveT = 0;
    const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(L)); } catch (e) { /* ignore */ } }, 250); };

    /* push everything into the scene */
    const signOut = (s) => ({ text: s.text, color: colOf(s.color), style: s.style, anim: s.anim, on: s.on, x: s.x, y: s.y, height: s.height, lift: s.lift, angle: s.angle });
    const fleetOut = (f) => ({ shape: f.shape, text: f.text, color: colOf(f.color), effect: f.effect, on: f.on, x: f.x, y: f.y, alt: f.alt, size: f.size, angle: f.angle });
    for (const s of L.signs) C.addSign(s.id, signOut(s));
    for (const f of L.fleets) C.addFleet(f.id, fleetOut(f));
    C.setTicker({ on: L.ticker.on, text: L.ticker.text, banners: L.ticker.banners, screen: L.ticker.screen, color: colOf(L.signs[0] ? L.signs[0].color : 'gold') });
    if (!L.venue.follow) C.setVenue({ follow: false, shape: L.venue.shape, text: L.venue.text, color: colOf(L.venue.color), effect: L.venue.effect });

    let selSign = L.signs[0] ? L.signs[0].id : null, selFleet = L.fleets[0] ? L.fleets[0].id : 'venue';
    const signById = (id) => L.signs.find((s) => s.id === id), fleetById = (id) => L.fleets.find((f) => f.id === id);
    const newId = (p) => p + Math.random().toString(36).slice(2, 7);

    /* swatches */
    document.querySelectorAll('#deck .swatches').forEach((box) => {
      for (const k in CSS) { const b = document.createElement('button'); b.type = 'button'; b.dataset.v = k; b.title = k; b.style.background = CSS[k]; b.style.color = CSS[k]; box.appendChild(b); }
    });

    /* item lists */
    function renderItems() {
      const sh = $('#signItems');
      sh.innerHTML = '';
      L.signs.forEach((s, i) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'item' + (s.id === selSign ? ' is-on' : '');
        b.innerHTML = `<i style="background:${cssOf(s.color)};color:${cssOf(s.color)}"></i><b>${escapeHtml(s.text)}</b><small>${String(i + 1).padStart(2, '0')}</small>`;
        b.addEventListener('click', () => { selSign = s.id; sync(); });
        sh.appendChild(b);
      });
      if (L.signs.length < 8) { const add = document.createElement('button'); add.type = 'button'; add.className = 'item item--add'; add.innerHTML = '<b>+ 新建灯牌</b>'; add.addEventListener('click', addSign); sh.appendChild(add); }
      const fh = $('#fleetItems');
      fh.innerHTML = '';
      const v = document.createElement('button'); v.type = 'button'; v.className = 'item' + (selFleet === 'venue' ? ' is-on' : '');
      v.innerHTML = `<i style="background:${cssOf(L.venue.color)};color:${cssOf(L.venue.color)}"></i><b>鸟巢上空</b><small>${L.venue.follow ? '演出' : '自定'}</small>`;
      v.addEventListener('click', () => { selFleet = 'venue'; sync(); });
      fh.appendChild(v);
      L.fleets.forEach((f, i) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'item' + (f.id === selFleet ? ' is-on' : '');
        b.innerHTML = `<i style="background:${cssOf(f.color)};color:${cssOf(f.color)}"></i><b>${f.shape === 'text' ? escapeHtml(f.text) : shapeName(f.shape)}</b><small>${Math.round(f.alt)}m</small>`;
        b.addEventListener('click', () => { selFleet = f.id; sync(); });
        fh.appendChild(b);
      });
      if (L.fleets.length < 3) { const add = document.createElement('button'); add.type = 'button'; add.className = 'item item--add'; add.innerHTML = '<b>+ 新编队</b>'; add.addEventListener('click', addFleet); fh.appendChild(add); }
    }
    const SHAPES = { text: '文字', crown: '皇冠', heart: '爱心', star: '星星', note: '音符', eagle: '雄鹰', lion: '雄狮', elephant: '巨象', whale: '鲸', eye: '兽瞳', claws: '兽爪', sphere: '星球', rings: '光环' };
    const shapeName = (k) => SHAPES[k] || k;
    function escapeHtml(t) { return String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

    /* editors */
    const se = $('#signEditor'), fe = $('#fleetEditor'), dronesTab = document.querySelector('#deck .tab[data-tab="drones"]');
    const mark = (root, sel, v) => root.querySelectorAll(sel).forEach((b) => b.classList.toggle('is-on', String(b.dataset.v) === String(v)));
    function angleOf(o) { return o.angle == null ? ((Math.atan2(-236 - o.y, 352 - o.x) * 180 / Math.PI) + 360) % 360 : o.angle; }
    function setSlider(root, key, v, fmt) { const r = root.querySelector(`input[data-key="${key}"]`); if (!r) return; r.value = v; r.nextElementSibling.textContent = fmt ? fmt(v) : v; }
    function sync() {
      const s = signById(selSign);
      se.classList.toggle('is-empty', !s);
      if (s) {
        if (document.activeElement !== $('#signText')) $('#signText').value = s.text;
        mark(se, '.swatches button', s.color); mark(se, '[data-key="signStyle"] button', s.style); mark(se, '[data-key="signAnim"] button', s.anim);
        setSlider(se, 'height', s.height, (v) => v + ' m'); setSlider(se, 'lift', s.lift, (v) => Math.round(v) + ' m'); setSlider(se, 'angle', Math.round(angleOf(s)), (v) => v + '°');
        se.querySelectorAll('.chips[data-target="signText"] button').forEach((b) => b.classList.toggle('is-on', b.textContent === s.text));
      }
      document.querySelector('#deck [data-key="ticker"]').checked = L.ticker.on;
      document.querySelector('#deck [data-key="banners"]').checked = L.ticker.banners;
      document.querySelector('#deck [data-key="screen"]').checked = L.ticker.screen;
      if (document.activeElement !== $('#tickText')) $('#tickText').value = L.ticker.text;
      const venue = selFleet === 'venue', f = venue ? L.venue : fleetById(selFleet);
      dronesTab.classList.toggle('venue', venue);
      if (f) {
        if (document.activeElement !== $('#droneText')) $('#droneText').value = f.text || '';
        mark(fe, '[data-key="droneShape"] button', f.shape); mark(fe, '.swatches button', f.color); mark(fe, '[data-key="droneFx"] button', f.effect);
        fe.querySelector('[data-key="follow"]').checked = !!L.venue.follow;
        dronesTab.classList.toggle('no-text', f.shape !== 'text');
        if (!venue) { setSlider(fe, 'alt', f.alt, (v) => Math.round(v) + ' m'); setSlider(fe, 'size', f.size, (v) => Math.round(v) + ' m'); setSlider(fe, 'angle', Math.round(angleOf(f)), (v) => v + '°'); }
      }
      renderItems();
      drawMaps();
    }

    /* actions: signs */
    function addSign() {
      const cam = C.camera();
      // a fresh sign appears in view: 120 m in front of the camera, clear of the bowl
      let x = cam.x + Math.cos(cam.yaw) * 120, y = cam.y + Math.sin(cam.yaw) * 120;
      [x, y] = clearOfBowl(x, y);
      const s = { id: newId('s'), text: ['鸟巢见', '我们都爱你', 'KING OF BEASTS', '万兽之王'][L.signs.length % 4], color: ['magenta', 'cyan', 'white', 'gold'][L.signs.length % 4], style: L.signs.length % 3, anim: 1, on: true, x, y, height: 8, lift: 0.7, angle: null };
      L.signs.push(s); selSign = s.id;
      C.addSign(s.id, signOut(s)); save(); sync(); ui.toast('新灯牌 · ' + s.text);
    }
    function clearOfBowl(x, y) {
      const e = Math.hypot(x / (BOWL[0] * 1.12), y / (BOWL[1] * 1.12));
      return e < 1 ? [x / e, y / e] : [x, y];
    }
    const updSign = (patch, msg) => { const s = signById(selSign); if (!s) return; Object.assign(s, patch); C.updateSign(s.id, signOut(s)); save(); sync(); if (msg) ui.toast(msg); };
    const applySignText = () => { const v = $('#signText').value.trim(); const s = signById(selSign); if (s && v && v !== s.text) updSign({ text: v }, '灯牌点亮 · ' + v); };
    $('#signApply').addEventListener('click', applySignText);
    $('#signText').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && !e.isComposing) applySignText(); });
    se.querySelectorAll('.chips[data-target="signText"] button').forEach((b) => b.addEventListener('click', () => { $('#signText').value = b.textContent; applySignText(); }));
    se.querySelector('.swatches').addEventListener('click', (e) => { const v = e.target.dataset.v; if (v) { updSign({ color: v }); if (signById(selSign) === L.signs[0]) C.setTicker({ color: colOf(v) }); } });
    se.querySelectorAll('[data-key="signStyle"] button').forEach((b) => b.addEventListener('click', () => updSign({ style: +b.dataset.v })));
    se.querySelectorAll('[data-key="signAnim"] button').forEach((b) => b.addEventListener('click', () => updSign({ anim: +b.dataset.v })));
    se.querySelectorAll('input[type="range"]').forEach((r) => r.addEventListener('input', () => {
      const k = r.dataset.key, v = +r.value;
      r.nextElementSibling.textContent = k === 'angle' ? v + '°' : (k === 'height' ? v : Math.round(v)) + ' m';
      const s = signById(selSign); if (!s) return; s[k] = v; C.updateSign(s.id, signOut(s)); save(); drawMaps();
    }));
    se.querySelector('[data-act="face"]').addEventListener('click', () => { const s = signById(selSign), c = C.camera(); if (s) updSign({ angle: Math.round(((Math.atan2(c.y - s.y, c.x - s.x) * 180 / Math.PI) + 360) % 360) }, '朝向镜头'); });
    se.querySelector('[data-act="watch"]').addEventListener('click', () => { if (selSign) C.watch('sign', selSign); });
    se.querySelector('[data-act="remove"]').addEventListener('click', () => {
      const i = L.signs.findIndex((s) => s.id === selSign); if (i < 0) return;
      C.removeSign(selSign); const t = L.signs[i].text; L.signs.splice(i, 1); selSign = L.signs[Math.max(0, i - 1)] ? L.signs[Math.max(0, i - 1)].id : null; save(); sync(); ui.toast('已删除 · ' + t);
    });
    // ticker
    const applyTick = () => { const v = $('#tickText').value.trim(); if (v && v !== L.ticker.text) { L.ticker.text = v; C.setTicker({ text: v }); save(); ui.toast('跑马灯 · ' + v); } };
    $('#tickApply').addEventListener('click', applyTick);
    $('#tickText').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && !e.isComposing) applyTick(); });
    for (const k of ['ticker', 'banners', 'screen']) document.querySelector(`#deck [data-key="${k}"]`).addEventListener('change', (e) => {
      if (k === 'ticker') L.ticker.on = e.target.checked; else L.ticker[k] = e.target.checked;
      C.setTicker({ on: L.ticker.on, banners: L.ticker.banners, screen: L.ticker.screen }); save();
    });

    /* actions: fleets */
    function addFleet() {
      const cam = C.camera();
      let x = cam.x + Math.cos(cam.yaw) * 260, y = cam.y + Math.sin(cam.yaw) * 260;
      const f = { id: newId('f'), shape: ['lion', 'heart', 'eagle'][L.fleets.length % 3], text: '我爱你', color: ['magenta', 'cyan', 'gold'][L.fleets.length % 3], effect: 1, on: true, x, y, alt: 150, size: 60, angle: null };
      if (C.addFleet(f.id, fleetOut(f)) === false) return;
      L.fleets.push(f); selFleet = f.id; save(); sync(); ui.toast('编队起飞 · ' + (f.shape === 'text' ? f.text : shapeName(f.shape)));
    }
    const updFleet = (patch, msg) => {
      if (selFleet === 'venue') {
        Object.assign(L.venue, patch);
        if (!('follow' in patch)) L.venue.follow = false;
        C.setVenue({ follow: L.venue.follow, shape: L.venue.shape, text: L.venue.text, color: colOf(L.venue.color), effect: L.venue.effect });
      } else { const f = fleetById(selFleet); if (!f) return; Object.assign(f, patch); C.updateFleet(f.id, fleetOut(f)); }
      save(); sync(); if (msg) ui.toast(msg);
    };
    fe.querySelectorAll('[data-key="droneShape"] button').forEach((b) => b.addEventListener('click', () => updFleet({ shape: b.dataset.v }, '编队变换 · ' + b.textContent)));
    const applyDroneText = () => { const v = $('#droneText').value.trim(); if (v) updFleet({ text: v, shape: 'text' }, '无人机起飞 · ' + v); };
    $('#droneApply').addEventListener('click', applyDroneText);
    $('#droneText').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && !e.isComposing) applyDroneText(); });
    fe.querySelector('.swatches').addEventListener('click', (e) => { const v = e.target.dataset.v; if (v) updFleet({ color: v }); });
    fe.querySelectorAll('[data-key="droneFx"] button').forEach((b) => b.addEventListener('click', () => updFleet({ effect: +b.dataset.v })));
    fe.querySelector('[data-key="follow"]').addEventListener('change', (e) => updFleet({ follow: e.target.checked }, e.target.checked ? '交还演出编排' : '接管鸟巢编队'));
    let slideT = 0;
    fe.querySelectorAll('input[type="range"]').forEach((r) => r.addEventListener('input', () => {
      const k = r.dataset.key, v = +r.value;
      r.nextElementSibling.textContent = k === 'angle' ? v + '°' : Math.round(v) + ' m';
      const f = fleetById(selFleet); if (!f) return; f[k] = v; drawMaps();
      // re-order the fleet once the slider settles (no re-flight on every pixel of travel)
      clearTimeout(slideT); slideT = setTimeout(() => { C.updateFleet(f.id, fleetOut(f)); save(); }, 160);
    }));
    fe.querySelector('[data-act="face"]').addEventListener('click', () => { const f = fleetById(selFleet), c = C.camera(); if (f) updFleet({ angle: Math.round(((Math.atan2(c.y - f.y, c.x - f.x) * 180 / Math.PI) + 360) % 360) }, '朝向镜头'); });
    fe.querySelector('[data-act="watch"]').addEventListener('click', () => C.watch(selFleet === 'venue' ? 'venue' : 'fleet', selFleet));
    fe.querySelector('[data-act="remove"]').addEventListener('click', () => {
      const i = L.fleets.findIndex((f) => f.id === selFleet); if (i < 0) return;
      C.removeFleet(selFleet); L.fleets.splice(i, 1); selFleet = L.fleets[0] ? L.fleets[0].id : 'venue'; save(); sync(); ui.toast('编队解散');
    });

    /* ── the mini-map: the Olympic Green from above, the camera, every sign and fleet ── */
    const maps = [...document.querySelectorAll('#deck .minimap')];
    const EXT = { x0: -560, x1: 600, y0: -470, y1: 470 };
    function fit(cv) {
      const r = cv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
      if (!r.width) return null;
      if (cv.width !== Math.round(r.width * d)) { cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d); }
      const k = Math.min(cv.width / (EXT.x1 - EXT.x0), cv.height / (EXT.y1 - EXT.y0));
      const ox = cv.width / 2 - (EXT.x0 + EXT.x1) / 2 * k, oy = cv.height / 2 + (EXT.y0 + EXT.y1) / 2 * k;
      return { k, d, X: (x) => ox + x * k, Y: (y) => oy - y * k, inv: (px, py) => [(px - ox) / k, (oy - py) / k] };
    }
    let pulse = 0;
    function drawMap(cv) {
      const M = fit(cv); if (!M) return;
      cv._m = M;
      const g = cv.getContext('2d'), { k, X, Y, d } = M;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = '#0a090b'; g.fillRect(0, 0, cv.width, cv.height);
      g.strokeStyle = 'rgba(255,236,200,.05)'; g.lineWidth = 1;
      for (let x = -500; x <= 600; x += 100) { g.beginPath(); g.moveTo(X(x), 0); g.lineTo(X(x), cv.height); g.stroke(); }
      for (let y = -400; y <= 400; y += 100) { g.beginPath(); g.moveTo(0, Y(y)); g.lineTo(cv.width, Y(y)); g.stroke(); }
      // central axis + walkways
      g.fillStyle = 'rgba(255,236,200,.05)'; g.fillRect(X(W.axis.x - W.axis.half), 0, W.axis.half * 2 * k, cv.height);
      g.strokeStyle = 'rgba(255,200,140,.12)'; g.lineWidth = 1.2 * d;
      for (let j = 0; j < W.walk.n; j++) { const a = j / W.walk.n * Math.PI * 2 + W.walk.off; g.beginPath(); g.moveTo(X(Math.cos(a) * W.walk.r0), Y(Math.sin(a) * W.walk.r0)); g.lineTo(X(Math.cos(a) * W.walk.r1), Y(Math.sin(a) * W.walk.r1)); g.stroke(); }
      // lake
      g.fillStyle = 'rgba(40,110,190,.35)'; g.beginPath();
      for (let y = W.lake.y0; y <= W.lake.y1; y += 20) g.lineTo(X(W.lakeX(y) - W.lakeHW(y)), Y(y));
      for (let y = W.lake.y1; y >= W.lake.y0; y -= 20) g.lineTo(X(W.lakeX(y) + W.lakeHW(y)), Y(y));
      g.closePath(); g.fill();
      // water cube
      g.strokeStyle = 'rgba(80,170,255,.55)'; g.lineWidth = 1.2 * d; const wc = W.waterCube; g.strokeRect(X(wc.c[0] - wc.s[0] / 2), Y(wc.c[1] + wc.s[1] / 2), wc.s[0] * k, wc.s[1] * k);
      // plaza + bowl
      g.fillStyle = 'rgba(255,236,200,.06)'; g.beginPath(); g.ellipse(X(0), Y(0), W.plaza[0] * k, W.plaza[1] * k, 0, 0, 7); g.fill();
      const rg = g.createRadialGradient(X(0), Y(0), 0, X(0), Y(0), BOWL[1] * k * 1.2);
      rg.addColorStop(0.55, 'rgba(255,40,20,.0)'); rg.addColorStop(0.85, 'rgba(255,40,20,.55)'); rg.addColorStop(1, 'rgba(255,40,20,0)');
      g.fillStyle = rg; g.beginPath(); g.ellipse(X(0), Y(0), BOWL[0] * k * 1.15, BOWL[1] * k * 1.15, 0, 0, 7); g.fill();
      g.strokeStyle = '#ff5a3a'; g.lineWidth = 1.6 * d; g.beginPath(); g.ellipse(X(0), Y(0), BOWL[0] * k, BOWL[1] * k, 0, 0, 7); g.stroke();
      g.fillStyle = 'rgba(255,90,58,.18)'; g.beginPath(); g.ellipse(X(0), Y(0), 67 * k, 98 * k, 0, 0, 7); g.fill();
      // the venue fleet
      g.fillStyle = cssOf(L.venue.color); g.globalAlpha = 0.85; dotRing(g, X(0), Y(0), 7 * d, cv.dataset.kind === 'fleet' && selFleet === 'venue'); g.globalAlpha = 1;
      // signs
      for (const s of L.signs) {
        const a = angleOf(s) * Math.PI / 180, len = s.height * 5.3 * 1.2 * 0.6 * k;
        const sel = cv.dataset.kind === 'sign' && s.id === selSign;
        const cx = X(s.x), cy = Y(s.y), rx = -Math.sin(a), ry = Math.cos(a);
        g.strokeStyle = cssOf(s.color); g.lineWidth = (sel ? 4 : 3) * d; g.lineCap = 'round';
        g.globalAlpha = s.on ? 1 : 0.35;
        g.beginPath(); g.moveTo(cx - rx * len / 2, cy + ry * len / 2); g.lineTo(cx + rx * len / 2, cy - ry * len / 2); g.stroke();
        g.lineWidth = 1.2 * d; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * 9 * d, cy - Math.sin(a) * 9 * d); g.stroke();
        g.globalAlpha = 1;
        if (sel) ringAt(g, cx, cy, d);
      }
      // fleets
      for (const f of L.fleets) {
        const sel = cv.dataset.kind === 'fleet' && f.id === selFleet;
        g.fillStyle = cssOf(f.color); g.globalAlpha = f.on ? 1 : 0.35;
        dotRing(g, X(f.x), Y(f.y), 5 * d, false); g.globalAlpha = 1;
        g.fillStyle = 'rgba(244,239,230,.7)'; g.font = `${9 * d}px "JetBrains Mono", monospace`; g.textAlign = 'center'; g.fillText(Math.round(f.alt) + 'm', X(f.x), Y(f.y) + 15 * d);
        if (sel) ringAt(g, X(f.x), Y(f.y), d);
      }
      // camera
      const c = C.camera();
      const cx = X(c.x), cy = Y(c.y);
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, 70 * d);
      gr.addColorStop(0, 'rgba(255,255,255,.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, 70 * d, -c.yaw - c.fov / 2, -c.yaw + c.fov / 2); g.closePath(); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(cx, cy, 3 * d, 0, 7); g.fill();
    }
    function ringAt(g, x, y, d) { g.strokeStyle = 'rgba(255,255,255,' + (0.5 + 0.5 * Math.sin(pulse * 4)) + ')'; g.lineWidth = 1.2 * d; g.beginPath(); g.arc(x, y, (10 + 2 * Math.sin(pulse * 4)) * d, 0, 7); g.stroke(); }
    function dotRing(g, x, y, r, sel) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); if (sel) ringAt(g, x, y, r / 7); }
    function drawMaps() { for (const cv of maps) if (cv.offsetParent) drawMap(cv); }
    // interaction: click places the selected item; dragging a marker moves it
    for (const cv of maps) {
      let drag = null;
      const at = (e) => { const r = cv.getBoundingClientRect(), M = cv._m || fit(cv); return M.inv((e.clientX - r.left) * M.d, (e.clientY - r.top) * M.d); };
      const hit = (x, y) => {
        const list = cv.dataset.kind === 'sign' ? L.signs.map((s) => [s, 'sign']) : L.fleets.map((f) => [f, 'fleet']);
        let best = null, bd = 28 / ((cv._m && cv._m.k) || 0.2);
        for (const [o, kind] of list) { const dd = Math.hypot(o.x - x, o.y - y); if (dd < bd) { bd = dd; best = [o, kind]; } }
        return best;
      };
      const place = (x, y, done) => {
        if (cv.dataset.kind === 'sign') {
          const s = signById(selSign); if (!s) return;
          [s.x, s.y] = clearOfBowl(x, y); C.updateSign(s.id, signOut(s));
        } else {
          const f = fleetById(selFleet); if (!f) { if (done) ui.toast('鸟巢编队固定在场馆上空'); return; }
          f.x = x; f.y = y; if (done) C.updateFleet(f.id, fleetOut(f));
        }
        if (done) save();
        drawMaps();
      };
      cv.addEventListener('pointerdown', (e) => {
        const [x, y] = at(e); const h = hit(x, y);
        if (h) { if (h[1] === 'sign') selSign = h[0].id; else selFleet = h[0].id; sync(); }
        drag = true; cv.setPointerCapture(e.pointerId); place(x, y, false);
      });
      cv.addEventListener('pointermove', (e) => { if (drag) { const [x, y] = at(e); place(x, y, false); } });
      cv.addEventListener('pointerup', (e) => { if (!drag) return; drag = null; const [x, y] = at(e); place(x, y, true); sync(); });
    }
    // the maps animate (camera, selection pulse) only while their tab is open, ~12 fps
    setInterval(() => { pulse += 0.12; if (document.body.classList.contains('deck-open')) drawMaps(); }, 85);
    window.addEventListener('resize', drawMaps);

    sync();
    return { layout: L, sync };
  };
})();
