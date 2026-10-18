(window.KOB_FILES = window.KOB_FILES || {}).show = '12';
/* ═══════════════════════════════════════════════════════════════════
   KING OF BEASTS — show programme
   · chapters + camera path (play mode)
   · showState(t): stateless lighting / content cues for any show time
   · event schedule (pyro, fireworks, CO2, confetti) – deterministic
   · free-mode viewpoints
   Positions in this file are BLENDER coordinates (metres, Z up, origin at
   venue centre, +X = main stand / stage front). The engine converts.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const KOB = (window.KOB = window.KOB || {});

  const BPM = 128;
  const BEAT = 60 / BPM;          // 0.46875 s
  const BAR = BEAT * 4;           // 1.875 s
  const TOTAL = 72 * BAR;         // 135 s
  KOB.BPM = BPM; KOB.BEAT = BEAT; KOB.BAR = BAR; KOB.TOTAL = TOTAL;

  /* ── chapters ─────────────────────────────────────────────────────── */
  const CH = [
    { t: 0 * BAR,  name: 'Outside',      cn: '序幕 · 巢外' },
    { t: 6 * BAR,  name: 'The Crown',    cn: '题字 · 点燃' },
    { t: 12 * BAR, name: 'Descent',      cn: '降临 · 穿顶' },
    { t: 17 * BAR, name: 'Stage Front',  cn: '台前 · 烈焰' },
    { t: 23 * BAR, name: 'The Wall',     cn: '主屏 · 点亮' },
    { t: 28 * BAR, name: 'Four Beasts',  cn: '四兽 · 苏醒' },
    { t: 38 * BAR, name: 'The Statues',  cn: '群像 · 守望' },
    { t: 43 * BAR, name: 'The Crowd',    cn: '人海 · 光潮' },
    { t: 51 * BAR, name: 'Finale',       cn: '终章 · 万兽之王' },
    { t: 63 * BAR, name: 'The Nest',     cn: '全景 · 鸟巢' },
  ];
  CH.forEach((c, i) => { c.end = i + 1 < CH.length ? CH[i + 1].t : TOTAL; c.index = i; });
  KOB.CHAPTERS = CH;
  KOB.chapterAt = (t) => { let i = 0; for (let k = 0; k < CH.length; k++) if (t >= CH[k].t) i = k; return i; };

  // tower ignition times (eagle → lion → elephant → whale)
  const TOWER_T = [28.5 * BAR, 31 * BAR, 33.5 * BAR, 36 * BAR];
  const IGNITE_T = 18 * BAR;       // main wall floor-to-roof ignition (33.75 s)
  const TITLE_T = 7 * BAR;         // roof title ignition (13.1 s)
  KOB.TOWER_T = TOWER_T; KOB.IGNITE_T = IGNITE_T; KOB.TITLE_T = TITLE_T;

  /* ── camera path ──────────────────────────────────────────────────────
     t: seconds · p: position · g: look target · f: lens (mm, 36 mm gate)
     hh: handheld amplitude (m) · cut: hard cut INTO this key (camera is moving
     on both sides). Keys with identical t and cut:true form a cut on motion. */
  const K = (t, p, g, f, hh, cut) => ({ t, p, g, f, hh: hh == null ? 0.25 : hh, cut: !!cut });
  KOB.CAMERA_KEYS = [
    // 1 OUTSIDE — exterior wide reveal, low and heroic across the plaza
    K(0.0,    [352, -236, 5.5], [0, 0, 56],     30, 0.22),
    K(5.6,    [322, -150, 24],  [0, 0, 60],     31, 0.35),
    // 2 THE CROWN — rise over the roof as 万兽之王 ignites (reads from +X)
    K(11.25,  [280, -54, 58],   [0, 0, 44],     32, 0.4),
    K(15.0,   [188, -22, 104],  [0, 0, 45],     30, 0.35),
    K(18.75,  [112, -4, 136],   [0, 0, 44],     30, 0.3),
    K(22.5,   [66, 6, 116],     [0, 0, 40],     30, 0.3),
    // 3 DESCENT — drop through the roof opening (inside X±67.6 / Y±98.2)
    K(25.6,   [60, 30, 82],     [0, 4, 12],     28, 0.28),
    K(28.6,   [58, 22, 46],     [0, 0, 18],     28, 0.26),
    K(31.875, [50, -30, 8],     [2, -8, 18],    26, 0.2),
    // 4 STAGE FRONT — low, heroic, in the front rows while the jets fire
    K(34.0,   [52, -34, 4.4],   [8, -14, 14],   24, 0.12),
    K(38.5,   [51.5, 1, 4.5],   [0, 0, 15],     24, 0.12),
    K(43.125, [52, 32, 4.6],    [6, 12, 15],    24, 0.14),
    // 5 THE WALL — rise back to read the whole box firing
    K(47.0,   [62, 20, 12],     [0, 2, 23],     26, 0.2),
    K(52.5,   [78, -4, 24],     [0, 0, 23],     28, 0.22),
    // 6 FOUR BEASTS — eagle (NE) → lion (SE) along the main stand …
    K(56.0,   [74, 31, 22],     [42, 54, 13.5], 32, 0.22),
    K(58.4,   [79, 7, 24],      [36, -18, 15],  30, 0.22),
    K(61.6,   [74, -31, 22],    [42, -54, 13.5],32, 0.22),
    K(62.81,  [72, -38, 21.5],  [42, -58, 13],  32, 0.22),
    // … cut on motion to the south end: elephant (SW), low and heroic
    K(62.81,  [14, -90, 8],     [-42, -54, 13], 30, 0.18, true),
    K(67.49,  [-7, -88, 11],    [-42, -54, 14], 30, 0.18),
    // … cut on motion to the north end: whale (NW), from higher
    K(67.49,  [10, 88, 30],     [-42, 54, 14],  32, 0.22, true),
    K(71.25,  [-3, 80, 26],     [-38, 56, 12],  32, 0.22),
    // 7 THE STATUES — eagle + lion on the north stand …
    K(74.6,   [-6, 70, 9],      [-18, 98, 14],  24, 0.16),
    K(76.88,  [7, 71, 9],       [18, 98, 14],   24, 0.16),
    // … cut on motion to whale + elephant on the south stand
    K(76.88,  [7, -70, 9],      [18, -98, 14],  24, 0.16, true),
    K(80.625, [-6, -71, 10],    [-18, -98, 14], 24, 0.18),
    // 8 THE CROWD — low through the in-field crowd, then out over the main stand
    K(80.625, [55, -46, 5],     [6, -8, 15],    24, 0.14, true),
    K(84.6,   [54, -30, 4.5],   [4, -4, 16],    24, 0.14),
    K(88.5,   [58, -14, 14],    [0, 4, 20],     26, 0.2),
    K(92.5,   [84, 8, 32],      [0, 0, 18],     28, 0.24),
    K(95.625, [100, 16, 46],    [0, 0, 22],     28, 0.26),
    // 9 FINALE — fireworks over the field and above the roof line
    K(100.5,  [92, -30, 40],    [0, 0, 44],     26, 0.26),
    K(104.0,  [66, -78, 34],    [0, -6, 46],    25, 0.22),
    K(108.0,  [34, -86, 5.5],   [0, 0, 48],     24, 0.16),
    K(112.5,  [12, -88, 3.6],   [0, 0, 58],     22, 0.14),
    K(118.125,[-14, -84, 14],   [0, 0, 46],     24, 0.2),
    // 10 THE NEST — rise out of the opening and pull back to the full venue
    K(122.0,  [10, -60, 58],    [0, 0, 30],     28, 0.24),
    K(126.0,  [60, -96, 128],   [0, 0, 42],     30, 0.32),
    K(130.5,  [318, -198, 30],  [0, 0, 56],     30, 0.35),
    K(135.0,  [352, -236, 5.5], [0, 0, 56],     30, 0.22),
  ];

  // Exposure (stops) by time: exterior and aerials sit a little brighter
  const EV_KEYS = [[0, 0.55], [11, 0.5], [22, 0.3], [30, 0.05], [34, -0.25], [43, -0.2], [53, -0.05], [71, 0.15], [80, 0.05], [95, -0.1], [118, 0.1], [126, 0.45], [135, 0.55]];

  /* ── colour library (linear RGB) ──────────────────────────────────── */
  const C = {
    gold: [1.0, 0.52, 0.1], amber: [1.0, 0.3, 0.03], red: [1.0, 0.045, 0.02], crimson: [0.8, 0.0, 0.06],
    blue: [0.04, 0.2, 1.0], cyan: [0.05, 0.65, 1.0], green: [0.08, 1.0, 0.18], jade: [0.05, 0.9, 0.5],
    violet: [0.5, 0.08, 1.0], magenta: [1.0, 0.06, 0.45], white: [1.0, 0.9, 0.78], ice: [0.75, 0.88, 1.0],
  };
  KOB.COLORS = C;
  const TOWER_COL = [C.gold, C.red, C.jade, C.blue];       // NE eagle, SE lion, SW elephant, NW whale
  KOB.TOWER_COL = TOWER_COL;

  const PAL_KEYS = [
    [0, C.red, C.violet, C.white],
    [10, C.red, C.violet, C.white],
    [12.5, C.gold, C.red, C.white],
    [22, C.gold, C.red, C.white],
    [24, C.green, C.cyan, C.white],
    [31, C.green, C.cyan, C.white],
    [33, C.amber, C.red, C.gold],
    [43, C.amber, C.red, C.gold],
    [44, C.blue, C.magenta, C.white],
    [48.5, C.blue, C.magenta, C.white],
    [49.5, C.gold, C.red, C.white],
    [52.5, C.gold, C.red, C.white],
    [53.5, C.gold, C.amber, C.white],
    [57.5, C.gold, C.amber, C.white],
    [58.5, C.red, C.amber, C.white],
    [62.3, C.red, C.amber, C.white],
    [63.3, C.jade, C.cyan, C.white],
    [67.0, C.jade, C.cyan, C.white],
    [68.0, C.blue, C.cyan, C.white],
    [71, C.blue, C.cyan, C.white],
    [72.5, C.gold, C.white, C.amber],
    [80, C.gold, C.white, C.amber],
    [81.5, C.violet, C.cyan, C.white],
    [95, C.violet, C.cyan, C.white],
    [96.5, C.gold, C.red, C.white],
    [118, C.gold, C.red, C.white],
    [120, C.red, C.gold, C.white],
    [133, C.red, C.violet, C.white],
    [135, C.red, C.violet, C.white],
  ];

  /* ── helpers ─────────────────────────────────────────────────────── */
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const ramp = (t, a, b) => clamp01((t - a) / (b - a));
  const smooth = (x) => x * x * (3 - 2 * x);
  const win = (t, a, b, fi, fo) => smooth(ramp(t, a, a + (fi || 0.001))) * (1 - smooth(ramp(t, b - (fo || 0.001), b)));
  const lerp = (a, b, k) => a + (b - a) * k;
  const lerp3 = (o, a, b, k) => { o[0] = lerp(a[0], b[0], k); o[1] = lerp(a[1], b[1], k); o[2] = lerp(a[2], b[2], k); return o; };
  KOB.util = { clamp01, ramp, smooth, win, lerp, lerp3 };

  function keyedScalar(keys, t) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i], b = keys[i + 1];
      if (t <= b[0]) return lerp(a[1], b[1], smooth((t - a[0]) / (b[0] - a[0])));
    }
    return keys[keys.length - 1][1];
  }
  function palette(t, out) {
    let i = 0;
    while (i < PAL_KEYS.length - 2 && t > PAL_KEYS[i + 1][0]) i++;
    const a = PAL_KEYS[i], b = PAL_KEYS[i + 1];
    const k = smooth(clamp01((t - a[0]) / Math.max(1e-3, b[0] - a[0])));
    lerp3(out.palA, a[1], b[1], k); lerp3(out.palB, a[2], b[2], k); lerp3(out.palC, a[3], b[3], k);
  }

  /* ── state object (allocated once, refilled every frame) ─────────── */
  function makeState() {
    return {
      t: 0, chapter: 0, chProg: 0, beat: 0, beatPulse: 0, barPhase: 0, bar: 0, ev: 0,
      palA: [1, 0, 0], palB: [1, 1, 1], palC: [1, 1, 1],
      led: { level: 0, ignite: 0, sceneA: 0, sceneB: 0, mix: 0, strobe: 0 },
      floor: 0,
      tower: { on: [0, 0, 0, 0], flash: [0, 0, 0, 0], level: 1 },
      title: 0, titleFlare: 0,
      canopy: 0, canopyChase: 0, rig: 0, deckEdge: 0,
      crowd: { A: [1, 0, 0], B: [1, 1, 1], C: [1, 1, 1], W: [0, 0, 0, 0], level: 0.6, surge: 0, wave: 1.4, quad: [0, 0, 0, 0], phones: 0.3, mixA: [1, 0, 0] },
      beams: {
        towerUp: { level: 0, pat: 'sky', col: [1, 1, 1], speed: 1, towerMask: [1, 1, 1, 1] },
        deck: { level: 0, pat: 'fanUp', col: [1, 1, 1], speed: 1 },
        boom: { level: 0, pat: 'down', col: [1, 1, 1], speed: 1 },
        rig: { level: 0, pat: 'wash', col: [1, 1, 1], speed: 1 },
        ring: { level: 0, pat: 'sky', col: [1, 1, 1], speed: 1 },
        plaza: { level: 0, pat: 'sky', col: [0.85, 0.9, 1.0] },
        follow: { level: 0, pat: 'throne', col: C.white },
        hunt: { level: 0, pat: 'stands', col: C.white },
        statue: 0, throne: 0,
      },
      kinetic: { level: 0, mode: 0 },
      lasers: { ceiling: 0, cone: 0, colCeiling: [0.1, 1, 0.75], crowdFan: 0, fieldSheet: 0, tunnel: 0, bounce: 0, roofSlice: 0, skyFan: 0, colFan: C.green, colSheet: C.blue, colTunnel: C.green, colBounce: C.red, colRoof: C.violet, colSky: C.green, hyper: 0, colHyperA: C.gold, colHyperB: C.white, towerMask: [1, 1, 1, 1], _mask: [1, 1, 1, 1] },
      blinder: 0, strobe: 0, floods: 0,
      drones: { level: 0, formation: 0, next: 1, k: 0 },
      fog: 0, fountains: 0, waterfall: 0, embers: 0, titleEmbers: 0,
      // the Nest's own skin (lattice light show) and the musical fountain in the lake
      facade: { level: 0, mode: 0, colA: [1, 0.5, 0.1], colB: [1, 1, 1] },
      fountain: { level: 1, mode: 0, colA: [1, 0.5, 0.1], colB: [1, 1, 1], height: 1 },
      // build-12 set pieces (levels 0..1; times are show seconds)
      sfx: { halo: 0, haloMode: 0, ball: 0, ballDrop: 0, holo: 0, holoReveal: 0, holoBeast: 1, rain: 0, rainMode: 0, snow: 0, galaxy: 0, card: 0,
        lanterns: 0, aurora: 0, lotus: 1, proj: 0, projMode: 0, flies: 1, city: 0, blimp: 0, blimpOn: 1,
        shockA: -1e3, shockB: -1e3, cityWave: -1e3 },
    };
  }
  KOB.makeState = makeState;

  const SHOCK_T = [IGNITE_T, 43.125, 45.0, 46.875, 48.75, 50.625, 52.5, 95.625, 100.5, 106.875, 112.5, 116.25];
  const CITY_T = [TITLE_T, 118.125, 126.0];

  /* ── stateless cue computer ───────────────────────────────────────── */
  function showState(t, S) {
    S = S || makeState();
    t = ((t % TOTAL) + TOTAL) % TOTAL;
    S.t = t;
    const ch = KOB.chapterAt(t);
    S.chapter = ch;
    S.chProg = (t - CH[ch].t) / (CH[ch].end - CH[ch].t);
    const beat = t / BEAT;
    S.beat = beat;
    const bph = beat - Math.floor(beat);
    S.bar = Math.floor(t / BAR);
    S.barPhase = (t / BAR) % 1;
    // energy curve 0..1 – intro sits around 0.55, never below
    const energy = keyedScalar([[0, 0.55], [11, 0.62], [22, 0.7], [31, 0.75], [34, 1], [53, 0.92], [71, 0.82], [81, 0.9], [96, 1], [118, 1], [128, 0.8], [135, 0.62]], t);
    S.energy = energy;
    S.beatPulse = Math.exp(-bph * 5.5) * (t > 32 ? 1 : 0.55);
    S.ev = keyedScalar(EV_KEYS, t);
    palette(t, S);

    /* main LED box */
    const L = S.led;
    L.ignite = t < IGNITE_T ? -0.05 : Math.min(1.15, (t - IGNITE_T) / 1.6 * 1.15);
    // before ignition the wall breathes at low level (standby embers)
    L.level = t < IGNITE_T ? 0 : 1;
    let sA = 0, sB = 0, mix = 0;
    if (t < IGNITE_T) { sA = 0; }
    else if (t < 43.125) { sA = 1; }                                   // waves after ignition
    else if (t < 52.5) {                                               // rank / pulses / art alternate every 2 bars
      const seq = [2, 3, 2, 4, 3];
      const k = (t - 43.125) / (2 * BAR);
      const i = Math.floor(k);
      sA = seq[i % seq.length]; sB = seq[(i + 1) % seq.length];
      mix = smooth(ramp(k - i, 0.85, 1));
    } else if (t < 71.25) {                                             // pulses ↔ the beast eye, per tower
      // the beast that just woke takes the main wall, alternating with pulses and the eye
      const seq = [8, 3, 8, 6, 8, 3, 8, 6];
      const k = (t - 52.5) / (1.25 * BAR);
      const i = Math.floor(k);
      sA = seq[i % seq.length]; sB = seq[(i + 1) % seq.length];
      mix = smooth(ramp(k - i, 0.8, 1));
    }
    else if (t < 80.625) { sA = 5; }                                    // title burning on the wall
    else if (t < 95.625) { sA = 1; sB = 3; mix = smooth(ramp((t - 80.625) % (4 * BAR), 3.2 * BAR, 4 * BAR)); }
    else if (t < 118.125) {
      const seq = [3, 2, 7, 3, 5, 2, 6, 5];
      const k = (t - 95.625) / (1.5 * BAR);
      const i = Math.floor(k);
      sA = seq[i % seq.length]; sB = seq[(i + 1) % seq.length];
      mix = smooth(ramp(k - i, 0.8, 1));
    } else { sA = 5; sB = 1; mix = smooth(ramp(t, 124, 128)); }
    L.sceneA = sA; L.sceneB = sB; L.mix = mix;
    // standby: wall glows faintly even before ignition so the venue is never dead
    L.standby = t < IGNITE_T ? 0.22 + 0.08 * Math.sin(t * 0.8) : 0;
    // strobe accents on the off-beats of the drops
    const drop = win(t, 43.125, 52.5, 0.2, 0.5) + win(t, 96, 118, 0.5, 0.5);
    L.strobe = drop * (bph < 0.12 && (Math.floor(beat) % 4 === 3) ? 0.9 : 0);
    S.floor = t < IGNITE_T ? 0.15 : 0.9;

    /* corner towers – power up one by one */
    for (let i = 0; i < 4; i++) {
      const on = ramp(t, TOWER_T[i], TOWER_T[i] + 1.4);
      S.tower.on[i] = t >= TOWER_T[i] ? on : 0;
      S.tower.flash[i] = Math.exp(-Math.max(0, t - TOWER_T[i]) * 1.2) * (t >= TOWER_T[i] ? 1 : 0) + S.beatPulse * 0.4 * (t > 96 ? 1 : 0);
    }
    if (t > 118) for (let i = 0; i < 4; i++) S.tower.on[i] = 1;

    /* roof title + canopy */
    S.title = t < TITLE_T ? 0 : Math.min(1, (t - TITLE_T) / 2.2);
    S.titleFlare = Math.exp(-Math.max(0, t - TITLE_T) * 0.9) * (t >= TITLE_T ? 1 : 0);
    S.titleEmbers = win(t, TITLE_T, 32, 0.5, 4) + win(t, 112, 135, 2, 2) * 0.6;
    S.canopy = 0.25 + 0.75 * win(t, TITLE_T - 1, TOTAL, 2, 0.1);
    S.canopyChase = energy;
    // rig lifts: the canopy wash fixtures fire bottom-up as the camera drops in
    S.rig = ramp(t, 24, 30);
    S.deckEdge = 0.4 + 0.6 * energy;

    /* crowd */
    const cr = S.crowd;
    cr.level = 0.55 + 0.6 * energy;
    cr.phones = keyedScalar([[0, 0.35], [11, 0.6], [22, 0.35], [72, 0.4], [74, 1.0], [80, 0.8], [82, 0.3], [130, 0.4]], t);
    cr.wave = 1.5;
    cr.surge = win(t, 81, 95.6, 1, 0.5) * 0.8 + win(t, 96, 118, 0.5, 2) * 0.5;
    for (let i = 0; i < 4; i++) cr.quad[i] = win(t, TOWER_T[i], 71.25, 0.4, 1.5) * (0.4 + 0.6 * Math.exp(-Math.max(0, t - TOWER_T[i]) * 0.6));
    // weights: wave / bloom / sparkle / call&response
    const W = cr.W;
    W[0] = win(t, 22, 32, 2, 1) + win(t, 81, 96, 1, 1) + win(t, 118, 135, 1, 1) * 0.7;
    W[1] = win(t, 43, 53, 0.5, 0.5) + win(t, 85, 96, 1, 1) + win(t, 96, 118, 1, 1) * 0.7;
    W[2] = win(t, 0, 22, 0.1, 2) * 0.8 + win(t, 71, 81, 1, 1) * 0.6 + win(t, 112, 135, 1, 1) * 0.8;
    W[3] = win(t, 88.5, 95.6, 0.5, 0.5) * 0.8;
    if (ch === 0 || ch === 1) { cr.A = lerp3(cr.mixA, C.red, C.crimson, 0.5); cr.B = C.white; cr.C = C.gold; }
    else if (ch === 2) { cr.A = C.red; cr.B = C.gold; cr.C = C.white; }
    else if (ch === 3) { cr.A = C.red; cr.B = C.amber; cr.C = C.gold; }
    else if (ch === 4) { cr.A = C.blue; cr.B = C.magenta; cr.C = C.white; }
    else if (ch === 5) { cr.A = C.red; cr.B = C.white; cr.C = C.gold; }
    else if (ch === 6) { cr.A = C.gold; cr.B = C.white; cr.C = C.amber; }
    else if (ch === 7) { cr.A = C.red; cr.B = C.gold; cr.C = C.cyan; }
    else if (ch === 8) {
      const hue = (t * 0.25) % 1;
      cr.A = hue < 0.33 ? C.red : hue < 0.66 ? C.gold : C.violet; cr.B = C.white; cr.C = C.gold;
    } else { cr.A = C.red; cr.B = C.gold; cr.C = C.white; }

    /* beams */
    const B = S.beams;
    // tower uplights: sky searchlights outside, then per-tower fans
    B.towerUp.level = win(t, 0, 31, 0.1, 1.5) * 1.0 + win(t, 52.5, 71.25, 0.5, 1) * 0.0 + win(t, 96, 135, 1, 0.1) * 1.0;
    B.towerUp.pat = t < 31 || t > 118 ? 'sky' : 'fanUp';
    B.towerUp.col = t < 11 ? C.white : t < 31 ? C.gold : C.white;
    const TM = B.towerUp.towerMask;
    TM[0] = TM[1] = TM[2] = TM[3] = 1;
    if (t >= 52.5 && t < 71.25) {
      B.towerUp.level = 1; B.towerUp.pat = 'fanUp';
      for (let i = 0; i < 4; i++) TM[i] = S.tower.on[i];
    }
    // deck perimeter beams: aerial fans, curtains on the drops
    B.deck.level = win(t, 11, 31, 1, 0.5) * 0.8 + win(t, 33.6, 53, 0.1, 0.5) + win(t, 81, 135, 1, 1) * 0.9;
    B.deck.pat = t < 31 ? 'fanUp' : t < 43.125 ? 'curtain' : t < 53 ? 'ballyhoo' : t < 96 ? 'fanUp' : (Math.floor(t / (2 * BAR)) % 2 ? 'cross' : 'curtain');
    B.deck.col = t < 31 ? C.gold : t < 43.125 ? C.amber : t < 53 ? (S.bar % 2 ? C.magenta : C.blue) : S.palA;
    // boom heads (red computer heads on the grid edge): tight fans on drops, sweep the crowd
    B.boom.level = win(t, 22, 135, 1, 1) * (0.7 + 0.3 * energy);
    B.boom.pat = t < 32 ? 'down' : t < 53 ? 'fanOut' : t < 71 ? 'sweep' : t < 81 ? 'down' : t < 96 ? 'sweep' : 'ballyhoo';
    B.boom.col = t < 32 ? C.green : t < 53 ? S.palB : S.palA;
    // canopy rig wash (lifts its rig in the descent)
    B.rig.level = 0.25 + 0.75 * S.rig;
    B.rig.pat = 'wash';
    B.rig.col = S.palA;
    // roof-ring searchlights (aerial beams over the roof)
    // the roof-ring searchlights stay dark while the finale fireworks fly (no beams behind the bursts)
    B.ring.level = win(t, 0, 24, 0.1, 2) + win(t, 119.5, 135, 1.5, 0.1);
    B.ring.pat = 'sky';
    B.ring.col = C.white;
    // plaza sky trackers: the outside world's share of the show
    B.plaza.level = win(t, 0, 27, 0.1, 3) + win(t, 116, 135, 3, 0.1);
    // follow spots: throne, statues, hunting the stands
    B.follow.level = win(t, 34, 135, 1, 1);
    B.follow.pat = t < 71.25 ? 'throne' : t < 81 ? 'statues' : t < 96 ? 'stands' : 'throne';
    B.hunt.level = win(t, 52, 135, 1, 1);
    B.hunt.pat = t < 71.25 ? 'towers' : t < 81 ? 'statues' : 'stands';
    B.statue = win(t, 70, 135, 1.5, 1) * (t < 81 ? 1 : 0.55);
    B.throne = win(t, 37.5, 135, 1.0, 1);

    /* lasers */
    const Z = S.lasers;
    Z.roofSlice = win(t, 2, 26, 1, 2) + win(t, 100, 135, 1, 0.1);
    Z.skyFan = win(t, 4, 24, 1, 2) * 0.8 + win(t, 118, 135, 1, 0.1);
    Z.crowdFan = win(t, 24, 33.5, 1, 0.5) + win(t, 43.125, 53, 0.1, 0.5) + win(t, 82, 118, 1, 1);
    Z.fieldSheet = win(t, 46, 53, 0.5, 0.5) * 0.8 + win(t, 72, 81, 2, 1) * 0.6 + win(t, 86, 118, 1, 1);
    Z.tunnel = win(t, 27, 33, 0.6, 0.4) + win(t, 104, 112, 0.3, 0.3);
    Z.bounce = win(t, 36, 43.5, 0.5, 0.5) + win(t, 98, 118, 0.5, 0.5) * 0.8;
    Z.colFan = t < 40 ? C.green : t < 80 ? S.palA : C.green;
    Z.ceiling = win(t, 85, 95.4, 1.2, 0.6) + win(t, 108.5, 116.2, 0.4, 0.4);
    Z.colCeiling = t < 100 ? C.cyan : C.green;
    Z.cone = win(t, 95.625, 104, 0.25, 0.8) + win(t, 112.5, 118.5, 0.2, 0.8);
    /* kinetic orbs: arrive with the first drop, change choreography every 8 bars */
    S.kinetic.level = win(t, 31.875, 127, 2.5, 3) * (0.55 + 0.45 * energy);
    S.kinetic.mode = Math.floor(t / (8 * BAR)) % 4;
    Z.colSheet = C.blue; Z.colTunnel = C.green; Z.colBounce = C.red; Z.colRoof = C.violet; Z.colSky = t < 20 ? C.violet : C.green;
    Z.towerMask = Z._mask;
    Z._mask[0] = Z._mask[1] = Z._mask[2] = Z._mask[3] = 1;
    if (t >= 52.5 && t < 71.25) {
      Z.crowdFan = 1; Z.colFan = null; // per-tower colour
      for (let i = 0; i < 4; i++) Z._mask[i] = S.tower.on[i] > 0.5 ? 1 : 0;
    }

    /* accents */
    S.blinder = 0;
    const hits = [IGNITE_T, 43.125, 52.5, TOWER_T[1], TOWER_T[2], TOWER_T[3], 95.625, 106.875, 112.5, 116.25];
    for (const h of hits) if (t >= h) S.blinder = Math.max(S.blinder, Math.exp(-(t - h) * 3.2));
    S.strobe = drop * ((Math.floor(beat * 2) % 2 === 0 && bph < 0.08) ? 1 : 0);
    S.floods = S.blinder;

    /* façade light show: rising gold rings over the lake, beat sectors for the crown, a quiet
       chase through the roof inside, then rainbow orbits and spirals for the finale outside */
    const FA = S.facade;
    FA.level = win(t, 0, 25, 0.6, 3) + win(t, 25, 115, 3, 3) * 0.16 + win(t, 115, 135, 2, 0.4);
    FA.mode = t < 11.25 ? 0 : t < 25 ? 2 : t < 115 ? 1 : [3, 1, 2][Math.floor((t - 115) / (2 * BAR)) % 3];
    lerp3(FA.colA, t < 11.25 ? C.gold : S.palA, S.palA, t < 11.25 ? 0 : 1);
    lerp3(FA.colB, t < 11.25 ? C.white : S.palB, S.palB, t < 11.25 ? 0 : 1);
    /* musical fountain: a new figure every four bars, height follows the energy */
    const FO = S.fountain;
    FO.level = 1;
    FO.mode = Math.floor(t / (4 * BAR)) % 5;
    FO.height = 0.55 + 0.45 * energy + (t < 11.25 ? 0.15 : 0);
    lerp3(FO.colA, S.palA, S.palA, 1); lerp3(FO.colB, S.palB, S.palB, 1);

    /* drones */
    const DT = 9.375;                          // formation change every 5 bars
    const fk = t / DT;
    const fi = Math.floor(fk);
    S.drones.level = win(t, 0, 135, 0.1, 0.1);
    S.drones.formation = fi;
    S.drones.k = smooth(ramp(fk - fi, 0.55, 1));

    /* atmosphere + continuous pyro */
    S.fog = 0.55 + 0.45 * win(t, 30, 135, 2, 2);
    S.fountains = win(t, 44, 52.5, 0.2, 0.3) + win(t, 72, 80.5, 0.5, 0.5) * 0.7 + win(t, 98, 118, 0.3, 0.5);
    S.waterfall = win(t, 47, 52.4, 0.3, 0.5) + win(t, 107, 117.5, 0.3, 0.8);
    S.embers = 0.35 + 0.65 * energy;

    /* build-12 set pieces ------------------------------------------------------------
       outside: lanterns, aurora, plaza mapping and the city open and close the show;
       inside: a galaxy in the roof opening for the descent, light rain round the wall drops,
       the mirror ball for the statues, a card stunt and halos for the crowd, the hologram
       king over the finale, gold snow for the two quiet moments */
    const X = S.sfx;
    X.galaxy = win(t, 21.2, 28.5, 1.6, 1.2);
    X.rain = win(t, 44, 52.6, 0.5, 0.4);
    X.rainMode = Math.floor(Math.max(0, t - 44) / (2 * BAR)) % 2;
    X.ball = win(t, 71.4, 81, 1.2, 1.2);
    X.ballDrop = smooth(ramp(t, 71.4, 74.4));
    X.snow = win(t, 73, 81.5, 1.5, 1.5) + win(t, 116.4, 127, 0.4, 3);
    X.card = win(t, 82, 95.6, 1.2, 0.8) + win(t, 118.6, 131, 1.5, 1.5);   // the aerial pull-out reads it round the whole bowl
    X.halo = win(t, 81, 96, 2, 1.5) + win(t, 118.5, 128, 1.5, 2);
    X.haloMode = t > 88.5 && t < 96 ? 1 : 0;
    X.holo = win(t, 96.6, 118.6, 0.3, 1.6);
    X.holoReveal = smooth(ramp(t, 96.6, 99.8));
    X.holoBeast = 1;                                 // the lion: the king
    X.lanterns = keyedScalar([[0, 0.75], [20, 0.75], [30, 0.3], [116, 0.3], [122, 1], [133, 0.8], [135, 0.75]], t);
    X.aurora = win(t, 0, 26, 0.1, 4) + win(t, 116, 135, 4, 0.1);
    X.proj = win(t, 0, 25, 0.1, 3) + win(t, 117, 135, 3, 0.1);
    X.projMode = Math.floor(t / (4 * BAR)) % 4;
    X.city = win(t, 0, 26, 0.1, 3) * 0.6 + win(t, 116, 135, 2, 0.1);
    X.lotus = 1; X.flies = 1; X.blimp = 0; X.blimpOn = 1;
    // shockwaves on the drops; the city flashes outward from the Nest on the big moments
    let a = -1e3, b = -1e3;
    for (const h of SHOCK_T) if (h <= t) { b = a; a = h; }
    X.shockA = a; X.shockB = b;
    let w = -1e3; for (const h of CITY_T) if (h <= t) w = h;
    X.cityWave = w;
    Z.hyper = win(t, 118.2, 125.5, 0.6, 1.2);
    Z.colHyperA = S.palA; Z.colHyperB = S.palB;
    // the hologram king takes the place of the finale's laser cone (no column of light behind him)
    Z.cone *= 1 - Math.min(1, X.holo * 1.5);
    return S;
  }
  KOB.showState = showState;

  /* ── deterministic event schedule ─────────────────────────────────── */
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  KOB.rng = rng;

  function buildEvents(seed, fwDensity) {
    const R = rng(seed * 7919 + 13);
    const E = [];
    const add = (t, type, o) => E.push(Object.assign({ t, type }, o || {}));
    // flame jet positions (Blender) – deck front edge, deck corners, tower feet
    // front edge flames (x = 33.6) staggered so the camera passes them in C4
    const frontY = [-44, -33, -22, -11, 11, 22, 33, 44];
    KOB.FLAME_POS = frontY.map((y) => [33.8, y, 3.25]).concat([[-33.8, -44, 3.25], [-33.8, 44, 3.25], [-33.8, -15, 3.25], [-33.8, 15, 3.25]]);
    KOB.TOWER_FLAME_POS = [];
    [[42, 54], [42, -54], [-42, -54], [-42, 54]].forEach(([x, y], i) => {
      const r = Math.hypot(x, y), ux = x / r, uy = y / r, tx = -uy, ty = ux;
      KOB.TOWER_FLAME_POS.push([[x + tx * 9, y + ty * 9, 0.4], [x - tx * 9, y - ty * 9, 0.4], [x + ux * 9, y + uy * 9, 0.4], [x - ux * 9.5, y - uy * 9.5, 0.4]]);
    });
    KOB.CO2_POS = [[33.2, -38, 3.3], [33.2, -26, 3.3], [33.2, -6, 3.3], [33.2, 6, 3.3], [33.2, 26, 3.3], [33.2, 38, 3.3], [20, -49.2, 3.3], [-20, -49.2, 3.3], [20, 49.2, 3.3], [-20, 49.2, 3.3]];

    // C1: a first barrage over the roof rim while we are still across the lake
    [[2.6, 0.5], [3.1, -0.6], [3.5, 1.4], [4.2, -1.6], [4.6, 2.3], [5.3, -0.1], [5.9, 0.9], [6.4, -1.1]].forEach(([tt, a], i) => {
      add(tt, 'firework', { from: [150 * Math.cos(a), 168 * Math.sin(a), 72], h: 125 + (i % 3) * 18, kind: ['chrys', 'peony', 'willow', 'ring'][i % 4], col: [KOB.COLORS.gold, KOB.COLORS.red, KOB.COLORS.white, KOB.COLORS.gold][i % 4], n: 190 });
    });
    // C1: comets from the roof ring at the end of the exterior shot
    [7.4, 8.4, 9.6, 10.3].forEach((t, i) => {
      const a = -0.5 + i * 0.35;
      add(t, 'firework', { from: [150 * Math.cos(a), 160 * Math.sin(a), 70], h: 92 + i * 6, kind: 'comet', col: KOB.COLORS.gold, n: 70 });
    });
    // C2: title ignition – gerb ring around the canopy edge
    add(TITLE_T, 'gerbRing', {});
    add(TITLE_T + 0.2, 'firework', { from: [0, 0, 46], h: 118, kind: 'ring', col: KOB.COLORS.gold, n: 160 });
    // C3: CO2 hit on the pre-drop
    add(30.9, 'co2', { which: 'all' });
    // C4: ignition salvo, then a flame chase that tracks the camera along the front
    add(IGNITE_T, 'flames', { which: 'front', dur: 1.6 });
    add(IGNITE_T, 'co2', { which: 'all' });
    for (let k = 0; k < 8; k++) {
      // camera passes y = -36 → +33 between 34 and 43 s
      const y = frontY[k];
      const tt = 35.0 + (y + 44) / 88 * 7.5;
      add(tt, 'flames', { idx: [k], dur: 1.1 });
    }
    add(37.5, 'co2', { which: 'front' });
    add(41.25, 'flames', { which: 'front', dur: 1.2 });
    // C5: drops
    [43.125, 45.0, 46.875, 48.75, 50.625].forEach((t, i) => add(t, 'flames', { which: i % 2 ? 'back' : 'front', dur: 0.9 }));
    add(43.125, 'co2', { which: 'all' });
    add(52.4, 'confetti', { n: 2400 });
    // C6: each tower wakes with flames at its feet + a crossette over its corner
    TOWER_T.forEach((t, i) => {
      add(t, 'towerFlames', { tower: i, dur: 1.4 });
      add(t + 0.9, 'towerFlames', { tower: i, dur: 0.8 });
      const [x, y] = [[42, 54], [42, -54], [-42, -54], [-42, 54]][i];
      add(t + 0.15, 'firework', { from: [x * 1.25, y * 1.25, 1], h: 95, kind: 'palm', col: KOB.TOWER_COL[i], n: 90 });
    });
    // C7: cold-spark gerbs on the statue plinths
    add(72.2, 'statueGerbs', { pair: 'north', dur: 3.5 });
    add(77.0, 'statueGerbs', { pair: 'south', dur: 3.5 });
    // C8: crowd chapter – CO2 + confetti, first teaser shells
    add(84.4, 'co2', { which: 'all' });
    add(88.125, 'co2', { which: 'all' });
    add(88.125, 'confetti', { n: 4000 });
    add(91.875, 'flames', { which: 'all', dur: 1.2 });
    [92.2, 93.4, 94.4, 95.0].forEach((t, i) => add(t, 'firework', { from: [R() * 60 - 30, (i % 2 ? 1 : -1) * (60 + R() * 20), 1], h: 105 + R() * 25, kind: 'peony', col: [KOB.COLORS.gold, KOB.COLORS.red, KOB.COLORS.white, KOB.COLORS.gold][i], n: 150 }));
    // C9: FINALE – build, salvos over the field, roof-line rings, barrage
    const kinds = ['peony', 'chrys', 'willow', 'ring', 'palm', 'glitter', 'brocade'];
    const cols = [KOB.COLORS.gold, KOB.COLORS.red, KOB.COLORS.white, KOB.COLORS.violet, KOB.COLORS.gold, KOB.COLORS.cyan, KOB.COLORS.magenta, KOB.COLORS.green];
    const field = () => [(R() - 0.5) * 100, (R() - 0.5) * 160, 1];
    const rim = (a) => [150 * Math.cos(a), 168 * Math.sin(a), 72];
    let t = 95.625;
    while (t < 100.5) { add(t, 'firework', { from: field(), h: 95 + R() * 30, kind: kinds[Math.floor(R() * 4)], col: cols[Math.floor(R() * cols.length)], n: 170 }); t += 0.7 / fwDensity; }
    add(95.625, 'flames', { which: 'all', dur: 1.5 });
    add(95.625, 'co2', { which: 'all' });
    for (let s = 0; s < 6; s++) { // salvos of 3–5 shells
      const ts = 100.5 + s * 1.0;
      const n = 3 + Math.floor(R() * 3 * fwDensity);
      const col = cols[Math.floor(R() * cols.length)];
      const kind = kinds[Math.floor(R() * kinds.length)];
      for (let k = 0; k < n; k++) add(ts + k * 0.07, 'firework', { from: field(), h: 110 + R() * 45, kind, col, n: 190 });
    }
    // roof-line ring: 16 shells around the shell rim, bursting above the roof
    for (let k = 0; k < 16; k++) add(106.875 + k * 0.09, 'firework', { from: rim(k / 16 * Math.PI * 2), h: 120 + (k % 2) * 25, kind: k % 2 ? 'ring' : 'chrys', col: k % 2 ? KOB.COLORS.gold : KOB.COLORS.red, n: 160 });
    add(106.875, 'flames', { which: 'all', dur: 1.4 });
    add(107.5, 'confetti', { n: 4000 });
    // building barrage
    t = 108.5;
    while (t < 116.2) {
      const dens = 1 + (t - 108.5) / 3;
      add(t, 'firework', { from: R() < 0.45 ? rim(R() * Math.PI * 2) : field(), h: 100 + R() * 70, kind: kinds[Math.floor(R() * kinds.length)], col: cols[Math.floor(R() * cols.length)], n: 200 });
      t += 0.32 / (dens * fwDensity);
    }
    [109.7, 111.6, 112.5, 113.4, 114.4, 115.3].forEach((tt) => add(tt, 'flames', { which: 'all', dur: 0.9 }));
    add(112.5, 'co2', { which: 'all' });
    // the last word: willow curtain + gold brocade crown over the whole venue
    for (let k = 0; k < 20; k++) add(116.25 + k * 0.04, 'firework', { from: k % 2 ? rim(k / 20 * Math.PI * 2) : field(), h: 130 + R() * 40, kind: k % 3 ? 'willow' : 'brocade', col: KOB.COLORS.gold, n: 260 });
    add(116.25, 'flames', { which: 'all', dur: 2.0 });
    add(116.25, 'confetti', { n: 5000 });
    // C10: fireworks keep rolling above the roof as we pull out
    t = 119;
    while (t < 133) {
      add(t, 'firework', { from: R() < 0.6 ? rim(R() * Math.PI * 2) : field(), h: 110 + R() * 60, kind: kinds[Math.floor(R() * kinds.length)], col: cols[Math.floor(R() * cols.length)], n: 180 });
      t += (0.7 + R() * 0.6) / fwDensity;
    }
    // build 12: fire on the lake and iron flowers on its bank for the exterior shots,
    // a fire tornado on the deck corner as each beast wakes, rings of fire for the crowd
    [[1.6, 'chase'], [5.4, 'all'], [8.9, 'chase'], [127.6, 'chase'], [131.2, 'all']].forEach(([tt, pat]) => add(tt, 'lakeFire', { pat }));
    add(2.4, 'iron', { dur: 8.4 });
    add(125.4, 'iron', { dur: 9.4 });
    TOWER_T.forEach((tt, i) => add(tt + 0.25, 'vortex', { corner: i, dur: 2.8 }));
    [88.125, 91.875, 112.5].forEach((tt) => add(tt, 'fireRing', {}));
    E.sort((a, b) => a.t - b.t);
    return E;
  }
  KOB.buildEvents = buildEvents;

  /* ── the performer: blocking on the deck (Blender x, y), pose, entrance on the lift ── */
  // pose: 0 sing (mic up, free arm out) · 1 both arms raised · 2 pointing at the crowd · 3 bow
  const BLOCK = [
    [33.75, 26, 0, 0], [43.1, 26, 0, 2], [47.0, 26, 0, 0], [52.5, 25, 14, 2], [58.4, 25, 14, 0], [61.6, 25, -14, 2], [66, 25, -14, 0],
    [71.25, 7.5, 0, 1], [76.9, 7.5, 0, 0], [80.6, 29, 0, 2], [86, 29, 9, 0], [91.9, 29, -9, 2], [95.6, 28, 0, 1], [100.5, 28, 0, 0],
    [106.9, 28, 0, 1], [110, 28, 0, 0], [116.25, 28, 0, 1], [122, 28, 0, 3], [128, 28, 0, 3],
  ];
  const ENTER_T = 33.75, EXIT_T = 131.5;
  KOB.performerAt = function (t, out) {
    out = out || {};
    out.vis = t >= ENTER_T - 1.2 && t < EXIT_T + 1.5 ? 1 : 0;
    let i = 0; for (let k = 0; k < BLOCK.length; k++) if (BLOCK[k][0] <= t) i = k;
    const a = BLOCK[i], b = BLOCK[Math.max(0, i - 1)];
    // walk to the new mark over 2.4 s
    const k = smooth(clamp01((t - a[0]) / 2.4));
    out.x = lerp(b[1], a[1], i === 0 ? 1 : k); out.y = lerp(b[2], a[2], i === 0 ? 1 : k);
    const moving = i > 0 && k > 0 && k < 1 && Math.hypot(a[1] - b[1], a[2] - b[2]) > 0.5;
    out.walk = moving ? 1 : 0;
    out.pose = a[3]; out.poseK = smooth(clamp01((t - a[0]) / 0.6)); out.prevPose = b[3];
    // the lift: rises through the deck at the ignition, sinks back at the end
    out.z = 3.3 - 3.0 * (1 - smooth(clamp01((t - (ENTER_T - 1.2)) / 1.2))) - 3.2 * smooth(clamp01((t - EXIT_T) / 1.5));
    return out;
  };

  /* ── free-mode viewpoints (Blender coords) ────────────────────────── */
  KOB.VIEWS_B = [
    { name: 'Exterior',        cn: '巢外全景',  p: [360, -160, 40],  g: [0, 0, 50],      f: 35 },
    { name: 'Dragon Lake',     cn: '龙形水系',  p: [352, -236, 5.5], g: [0, 0, 56],      f: 30 },
    { name: 'Roof Title',      cn: '题字俯瞰',  p: [96, 0, 140],     g: [0, 0, 45],      f: 28 },
    { name: 'Roof Opening',    cn: '洞口俯瞰',  p: [50, -56, 96],    g: [0, 0, 10],      f: 30 },
    { name: 'Stage Front',     cn: '台前仰望',  p: [37.5, -20, 2.5], g: [0, 0, 22],      f: 22 },
    { name: 'Main Wall',       cn: '主屏',      p: [78, 0, 24],      g: [0, 0, 23],      f: 28 },
    { name: 'The Throne',      cn: '王座',      p: [24, 10, 8],      g: [-2, 0, 9],      f: 32 },
    { name: 'Eagle · NE',      cn: '鹰 · 东北', p: [74, 31, 22],     g: [42, 54, 13.5],  f: 32 },
    { name: 'Lion · SE',       cn: '狮 · 东南', p: [74, -31, 22],    g: [42, -54, 13.5], f: 32 },
    { name: 'Elephant · SW',   cn: '象 · 西南', p: [-74, -31, 22],   g: [-42, -54, 13.5],f: 32 },
    { name: 'Whale · NW',      cn: '鲸 · 西北', p: [-74, 31, 22],    g: [-42, 54, 13.5], f: 32 },
    { name: 'North Statues',   cn: '北看台雕像',p: [0, 56, 13],      g: [0, 98, 15],     f: 24 },
    { name: 'South Statues',   cn: '南看台雕像',p: [0, -56, 13],     g: [0, -98, 15],    f: 24 },
    { name: 'Over the Crowd',  cn: '主看台上空',p: [100, 16, 46],    g: [0, 0, 22],      f: 28 },
    { name: 'Canopy Rig',      cn: '顶棚灯架',  p: [52, 0, 30],      g: [0, 0, 38],      f: 28 },
    { name: 'West Stand',      cn: '西看台',    p: [-95, 30, 40],    g: [0, 0, 20],      f: 26 },
  ];
})();
