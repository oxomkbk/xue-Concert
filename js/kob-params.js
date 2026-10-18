(window.KOB_FILES = window.KOB_FILES || {}).params = '12';
/* ═══════════════════════════════════════════════════════════════════
   KING OF BEASTS — parameters
   Merges (lowest → highest priority):
     built-in defaults  <  window.KOB_CONFIG (index.html)  <
     data-* attributes on <script id="kob-main">  <  URL query string
   Result: window.KOB.params   (also window.__viewer.params once running)
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const KOB = (window.KOB = window.KOB || {});

  const DEFAULTS = {
    mode: 'play', t: 0, chapter: null, speed: 1, loop: true,
    quality: 'auto', scale: null,
    audio: false, volume: 0.8,
    ui: true, letterbox: true, idle: 0,
    ev: 0, bloom: 1, flare: 1, grain: 1, haze: 1, dof: true, mblur: true, shake: 1,
    fireworks: 1, crowd: 1, drones: 1,
    view: null, seed: 7, stats: false, cdn: 'auto', capture: false, fps: 0,
    gate: true, titles: true, autohide: 3.5, crop: false,
    sign: null, signColor: null, signStyle: null, signAnim: null, ticker: null,
    drone: null, droneShape: null, droneColor: null, droneFx: null, droneSpot: null,
  };
  // numeric ranges are clamped so a typo in the URL can never break the renderer
  const RANGES = {
    t: [0, 100000], chapter: [1, 10], speed: [0.05, 4], scale: [0.25, 2], volume: [0, 1], idle: [0, 3600],
    ev: [-4, 4], bloom: [0, 4], flare: [0, 4], grain: [0, 4], haze: [0, 4], shake: [0, 4],
    fireworks: [0, 3], crowd: [0, 3], drones: [0, 3], view: [0, 99], seed: [0, 1e9], fps: [0, 240], autohide: [0, 600],
  };
  const TEXT = ['sign', 'drone', 'signColor', 'droneColor', 'signStyle', 'signAnim', 'droneShape', 'droneFx', 'droneSpot'];
  const ENUMS = {
    mode: ['play', 'free'],
    quality: ['auto', 'low', 'medium', 'high', 'ultra'],
    cdn: ['auto', 'jsdelivr', 'unpkg', 'npmmirror'],
  };

  function coerce(key, raw) {
    const def = DEFAULTS[key];
    if (raw === null || raw === undefined) return def;
    if (typeof raw !== 'string') return raw;
    const s = raw.trim();
    if (s === '' || s === 'null') return null;
    if (typeof def === 'boolean') return !/^(0|false|no|off)$/i.test(s);
    if (TEXT.includes(key)) return s;
    if (typeof def === 'number' || def === null && /^-?[\d.]+$/.test(s)) {
      const n = Number(s);
      return Number.isFinite(n) ? n : def;
    }
    return s;
  }

  function sanitize(p) {
    for (const k in RANGES) {
      if (p[k] === null || p[k] === undefined) continue;
      const v = Number(p[k]);
      if (!Number.isFinite(v)) { p[k] = DEFAULTS[k]; continue; }
      p[k] = Math.min(RANGES[k][1], Math.max(RANGES[k][0], v));
    }
    for (const k in ENUMS) {
      const v = String(p[k]).toLowerCase();
      p[k] = ENUMS[k].includes(v) ? v : DEFAULTS[k];
    }
    return p;
  }

  function parse() {
    const p = Object.assign({}, DEFAULTS);
    const cfg = window.KOB_CONFIG || {};
    for (const k in cfg) p[k] = cfg[k];
    const tag = document.getElementById('kob-main');
    if (tag) for (const k in tag.dataset) p[k] = coerce(k, tag.dataset[k]);
    const q = new URLSearchParams(location.search);
    for (const [k, v] of q) p[k] = (k in DEFAULTS) ? coerce(k, v) : v;
    return sanitize(p);
  }

  KOB.DEFAULTS = DEFAULTS;
  KOB.params = parse();

  // Build a shareable URL for the current state (used by the UI "copy link" helpers)
  KOB.paramsToURL = function (overrides) {
    const p = Object.assign({}, KOB.params, overrides || {});
    const q = new URLSearchParams();
    for (const k in p) if (k in DEFAULTS && p[k] !== DEFAULTS[k] && p[k] !== null) q.set(k, p[k]);
    const s = q.toString();
    return location.href.split('?')[0].split('#')[0] + (s ? '?' + s : '');
  };
})();
