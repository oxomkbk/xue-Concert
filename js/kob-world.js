(window.KOB_FILES = window.KOB_FILES || {}).world = '12';
/* ═══════════════════════════════════════════════════════════════════
   KING OF BEASTS — the world outside the Nest (Olympic Green at night)
   dragon-shaped lake · central axis · walkways and roads · street lamps · trees · fans outside
   · traffic · elevated ring road · city skyline · Water Cube · Ling Long Tower · Olympic Tower
   · plaza searchlights. All of it is ADDED scenery around the venue; the model is untouched.
   Layout data is in Blender space (metres, Z up, +X east, +Y north) like kob-show.js.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const KOB = (window.KOB = window.KOB || {});
  const G = KOB.GLSL;

  /* ── layout ───────────────────────────────────────────────────────── */
  const L = (KOB.WORLD = {
    plaza: [203, 222],
    bowl: [160, 178],
    lake: { x0: 300, amp: 42, k: 1 / 150, ph: 0.6, w0: 62, wa: 16, wk: 0.011, wp: 1.3, y0: -780, y1: 1000, gaps: [-640] },
    axis: { x: -262, half: 56, rows: 44, step: 20, y0: -880, y1: 880 },
    walk: { n: 8, off: Math.PI / 8, half: 5.5, r0: 236, r1: 812, step: 24, side: 7 },
    ring: { e0: 1.19, e1: 1.25, lamps: 72, lr: [212, 232] },
    roads: [
      { ax: 'x', c: 640, a: -1300, b: 2400, hw: 13 },
      { ax: 'x', c: -720, a: -1300, b: 2400, hw: 13 },
      { ax: 'y', c: -640, a: -1500, b: 1500, hw: 12 },
      { ax: 'y', c: 1320, a: -1500, b: 1500, hw: 12 },
    ],
    roadStep: 36,
    express: { y: -1150, z: 9, hw: 17, a: -7000, b: 7000 },
    waterCube: { c: [-470, -70], s: [177, 177, 31] },
    lingLong: { c: [-440, 700] },
    convention: { c: [-150, 1080], s: [420, 150, 38] },
    olyTower: { c: [-130, 1950] },
  });
  const lakeX = (y) => L.lake.x0 + L.lake.amp * Math.sin(y * L.lake.k + L.lake.ph);
  const lakeHW = (y) => 0.5 * (L.lake.w0 + L.lake.wa * Math.sin(y * L.lake.wk + L.lake.wp));
  const inLake = (x, y, pad) => y > L.lake.y0 - (pad || 0) && y < L.lake.y1 + (pad || 0) && Math.abs(x - lakeX(y)) < lakeHW(y) + (pad || 0);
  const onRoad = (x, y, pad) => L.roads.some((r) => (r.ax === 'x' ? Math.abs(x - r.c) < r.hw + pad && y > r.a && y < r.b : Math.abs(y - r.c) < r.hw + pad && x > r.a && x < r.b));
  const plazaE = (x, y) => Math.hypot(x / L.plaza[0], y / L.plaza[1]);
  KOB.WORLD.lakeX = lakeX; KOB.WORLD.lakeHW = lakeHW;

  const f = (v) => (Number.isInteger(v) ? v.toFixed(1) : String(v));
  // the street-lamp layout as GLSL: the ground shader evaluates the nearest lamp of every family,
  // the JS below places the actual lamp posts at exactly the same spots
  const roadGLSL = L.roads.map((r) => r.ax === 'x'
    ? `{ float yy = clamp((floor(b.y / RSTEP) + 0.5) * RSTEP, ${f(r.a)}, ${f(r.b)}); E2 += kLampE(vec2(abs(b.x - ${f(r.c)}) - ${f(r.hw + 2)}, b.y - yy), 10.0); }`
    : `{ float xx = clamp((floor(b.x / RSTEP) + 0.5) * RSTEP, ${f(r.a)}, ${f(r.b)}); E2 += kLampE(vec2(b.x - xx, abs(b.y - ${f(r.c)}) - ${f(r.hw + 2)}), 10.0); }`).join('\n    ');
  const roadMask = L.roads.map((r) => r.ax === 'x'
    ? `if (abs(b.x - ${f(r.c)}) < ${f(r.hw)} && b.y > ${f(r.a)} && b.y < ${f(r.b)}) { asph = 1.0; lane = abs(b.x - ${f(r.c)}); along = b.y; }`
    : `if (abs(b.y - ${f(r.c)}) < ${f(r.hw)} && b.x > ${f(r.a)} && b.x < ${f(r.b)}) { asph = 1.0; lane = abs(b.y - ${f(r.c)}); along = b.x; }`).join('\n    ');

  G.world = /* glsl */`
  #define RSTEP ${f(L.roadStep)}
  float kLakeX(float y){ return ${f(L.lake.x0)} + ${f(L.lake.amp)} * sin(y * ${L.lake.k.toFixed(6)} + ${f(L.lake.ph)}); }
  float kLakeHW(float y){ return 0.5 * (${f(L.lake.w0)} + ${f(L.lake.wa)} * sin(y * ${f(L.lake.wk)} + ${f(L.lake.wp)})); }
  // cosine-weighted irradiance of a lamp at height h, per unit intensity
  float kLampE(vec2 d, float h){ float q = dot(d, d) + h * h; return h / (q * sqrt(q)); }
  // warm park lamps (rgb) and road lamps, summed over the nearest lamp of each family
  vec3 kobLamps(vec2 b){
    float E = 0.0, E2 = 0.0;
    { vec2 R2 = vec2(${f(L.ring.lr[0])}, ${f(L.ring.lr[1])}); float st = 6.2831853 / ${f(L.ring.lamps)};
      float k = floor(atan(b.y / R2.y, b.x / R2.x) / st + 0.5) * st; E += kLampE(b - R2 * vec2(cos(k), sin(k)), 7.0); }
    { float st = 6.2831853 / ${f(L.walk.n)}; float k = floor((atan(b.y, b.x) - ${f(L.walk.off)}) / st + 0.5) * st + ${f(L.walk.off)};
      vec2 dir = vec2(cos(k), sin(k)), pp = vec2(-dir.y, dir.x);
      float rn = clamp(floor((dot(b, dir) - ${f(L.walk.r0)}) / ${f(L.walk.step)} + 0.5), 0.0, ${f(Math.floor((L.walk.r1 - L.walk.r0) / L.walk.step))}) * ${f(L.walk.step)} + ${f(L.walk.r0)};
      vec2 q = b - dir * rn; float s = dot(q, pp);
      E += kLampE(q - pp * sign(s) * ${f(L.walk.side)}, 7.0); }
    { float yy = clamp((floor(b.y / ${f(L.axis.step)}) + 0.5) * ${f(L.axis.step)}, ${f(L.axis.y0)}, ${f(L.axis.y1)});
      E += kLampE(vec2(abs(abs(b.x - ${f(L.axis.x)}) - ${f(L.axis.rows)}), b.y - yy), 8.0); }
    if (b.y > ${f(L.lake.y0)} && b.y < ${f(L.lake.y1)}) {
      float yy = (floor(b.y / 26.0) + 0.5) * 26.0;
      E += kLampE(vec2(abs(b.x - kLakeX(yy)) - kLakeHW(yy) - 6.0, b.y - yy), 6.0) * 0.8; }
    ${roadGLSL}
    return vec3(1.0, 0.74, 0.48) * E + vec3(1.0, 0.6, 0.3) * E2 * 1.4;
  }
  // zones of the Olympic Green: albedo, roughness, wetness (how much of the mirror it sees)
  void kobGround(vec2 b, inout vec3 alb, inout float rough, out float wet){
    float e = length(b / vec2(${f(L.plaza[0])}, ${f(L.plaza[1])}));
    float n1 = tn2(b * 0.0029 + 0.17), n2 = tn2(b * 0.019 + 0.31), n3 = texture2D(uNoiseTex, b * 0.13).g;
    vec3 c = vec3(0.010, 0.015, 0.008) * (0.55 + 0.9 * n2);   // lawn / planting
    float r = 0.93, pave = 0.0, asph = 0.0, lane = 99.0, along = 0.0;
    if (e < 1.07) pave = 1.0;
    { float st = 6.2831853 / ${f(L.walk.n)}; float k = floor((atan(b.y, b.x) - ${f(L.walk.off)}) / st + 0.5) * st + ${f(L.walk.off)};
      vec2 dir = vec2(cos(k), sin(k)); float al = dot(b, dir);
      if (abs(dot(b, vec2(-dir.y, dir.x))) < ${f(L.walk.half)} && al > 190.0 && al < ${f(L.walk.r1 + 14)}) pave = 1.0; }
    if (abs(b.x - ${f(L.axis.x)}) < ${f(L.axis.half)}) pave = 1.0;
    if (b.y > ${f(L.lake.y0 - 14)} && b.y < ${f(L.lake.y1 + 14)} && abs(b.x - kLakeX(b.y)) - kLakeHW(b.y) < 11.0) pave = 1.0;
    if (e > ${f(L.ring.e0)} && e < ${f(L.ring.e1)}) { asph = 1.0; lane = abs(e - ${f((L.ring.e0 + L.ring.e1) / 2)}) * 210.0; along = atan(b.y, b.x) * 210.0; }
    ${roadMask}
    if (pave > 0.5) {
      // granite: 1.6 m slabs, darker wet joints; filtered when a slab gets smaller than a pixel
      vec2 g = b / 1.6; vec2 fg = abs(fract(g) - 0.5);
      float fw = max(fwidth(g.x), fwidth(g.y));
      float joint = smoothstep(0.5 - max(fw, 0.02), 0.5, max(fg.x, fg.y)) * (1.0 - smoothstep(0.25, 0.6, fw));
      float slab = mix(0.75 + 0.5 * kHash21(floor(g)), 1.0, smoothstep(0.2, 0.7, fw));
      c = vec3(0.085, 0.082, 0.077) * slab * (1.0 - joint * 0.6) * (0.85 + 0.3 * n2);
      r = mix(0.3, 0.6, n3) + joint * 0.2;
    }
    if (asph > 0.5) {
      c = vec3(0.020, 0.021, 0.023) * (0.8 + 0.4 * n3);
      r = 0.5 + 0.15 * n3;
      // markings: dashed centre line + solid edge lines (paint is rough, so it reflects less)
      float fwl = fwidth(lane) + 0.02;
      float centre = (1.0 - smoothstep(0.12, 0.12 + fwl, lane)) * step(0.5, fract(along / 9.0));
      float edgeL = 1.0 - smoothstep(0.1, 0.1 + fwl, abs(lane - 10.0));
      float paint = max(centre, edgeL) * (1.0 - smoothstep(0.3, 0.8, fwl));
      c = mix(c, vec3(0.32, 0.3, 0.26), paint); r = mix(r, 0.75, paint);
    }
    // standing water after the evening rain: puddles on every hard surface
    float hard = max(pave, asph);
    float pud = smoothstep(0.54, 0.64, n1 * 0.65 + n2 * 0.35) * hard;
    r = mix(r, 0.05, pud);
    c *= mix(1.0, 0.45, pud);
    wet = hard * (0.55 + 0.45 * pud);
    alb = c; rough = r;
  }
  // lights set into the ground: walkway edge lines, a dotted ring at the plaza edge, the axis
  // runways, and a ring at the foot of the bowl breathing with the show
  vec3 kobGroundLights(vec2 b, vec3 pal, float beat, float t){
    vec3 E = vec3(0.0);
    float e = length(b / vec2(${f(L.plaza[0])}, ${f(L.plaza[1])}));
    { float st = 6.2831853 / ${f(L.walk.n)}; float k = floor((atan(b.y, b.x) - ${f(L.walk.off)}) / st + 0.5) * st + ${f(L.walk.off)};
      vec2 dir = vec2(cos(k), sin(k)); float al = dot(b, dir), pd = abs(dot(b, vec2(-dir.y, dir.x)));
      float d = abs(pd - ${f(L.walk.half - 0.4)}); float fw = fwidth(pd) + 0.02;
      float line = (1.0 - smoothstep(0.08, 0.08 + fw * 1.5, d)) * step(205.0, al) * step(al, ${f(L.walk.r1)});
      float run = 0.35 + 0.65 * exp(-kSq((fract(al / 60.0 - t * 0.4) - 0.5) * 6.0));
      E += vec3(1.0, 0.72, 0.42) * line * run * 2.2 * (1.0 - smoothstep(0.3, 1.5, fw)); }
    { float ang = atan(b.y / ${f(L.plaza[1])}, b.x / ${f(L.plaza[0])});
      float per = ang * 213.0; float fw = fwidth(per) + 0.01;
      float dots = (1.0 - smoothstep(0.0, 0.006 + fwidth(e) * 1.5, abs(e - 0.993))) * (1.0 - smoothstep(0.12, 0.12 + fw, abs(fract(per / 3.5) - 0.5) * 3.5));
      E += vec3(0.85, 0.9, 1.0) * dots * 3.0; }
    { float eb = length(b / vec2(162.5, 180.5)); float fwb = fwidth(eb) + 1e-4;
      float ring = 1.0 - smoothstep(0.0015, 0.0015 + fwb * 1.5, abs(eb - 1.0));
      float chase = 0.55 + 0.45 * sin(atan(b.y, b.x) * 12.0 - t * 2.0);
      E += pal * ring * (1.2 + 1.6 * beat) * chase; }
    { float d = abs(abs(b.x - ${f(L.axis.x)}) - 20.0); float fw = fwidth(b.x) + 0.02;
      float runway = (1.0 - smoothstep(0.1, 0.1 + fw * 1.5, d)) * step(0.5, fract(b.y / 4.0)) * (1.0 - smoothstep(0.3, 1.5, fw));
      E += vec3(0.75, 0.85, 1.0) * runway * 1.6; }
    return E;
  }
  // analytic reflection of the glowing bowl (used where there is no planar mirror)
  vec3 kobBowlRefl(vec3 p, vec3 R){
    vec2 o = p.xz / vec2(${f(L.bowl[0])}, ${f(L.bowl[1])}); vec2 d = R.xz / vec2(${f(L.bowl[0])}, ${f(L.bowl[1])});
    float A = dot(d, d), B = dot(o, d), C = dot(o, o) - 1.0, disc = B * B - A * C;
    if (disc < 0.0 || C < 0.0) return vec3(0.0);
    float t = (-B - sqrt(disc)) / max(A, 1e-5);
    if (t < 0.0) return vec3(0.0);
    float y = p.y + R.y * t;
    float hy = smoothstep(2.0, 6.0, y) * (1.0 - smoothstep(46.0, 58.0, y));
    vec3 q = p + R * t;
    float lat = 0.55 + 0.45 * smoothstep(0.2, 0.6, abs(fract(atan(q.z, q.x) * 18.0 + y * 0.03) - 0.5) * 2.0);
    return vec3(0.9, 0.05, 0.02) * hy * lat * (0.12 + 0.32 * pow(1.0 - clamp(y / 55.0, 0.0, 1.0), 1.6));
  }
  `;

  /* ── JS twin of the lamp layout (for posts, heads, tree under-light) ── */
  function lampList() {
    const out = [];   // [x, y, h, kind]   kind 0 park, 1 road
    const ring = L.ring;
    for (let i = 0; i < ring.lamps; i++) { const k = i / ring.lamps * Math.PI * 2; out.push([ring.lr[0] * Math.cos(k), ring.lr[1] * Math.sin(k), 7, 0]); }
    const W = L.walk, nw = Math.floor((W.r1 - W.r0) / W.step);
    for (let j = 0; j < W.n; j++) {
      const k = j / W.n * Math.PI * 2 + W.off, dx = Math.cos(k), dy = Math.sin(k);
      for (let i = 0; i <= nw; i++) for (const s of [-1, 1]) {
        const r = W.r0 + i * W.step, x = dx * r - dy * s * W.side, y = dy * r + dx * s * W.side;
        if (!inLake(x, y, 2) && !onRoad(x, y, 1) && Math.abs(x) < 900 && Math.abs(y) < 900) out.push([x, y, 7, 0]);
      }
    }
    for (let y = L.axis.y0 + L.axis.step / 2; y < L.axis.y1; y += L.axis.step) for (const s of [-1, 1]) out.push([L.axis.x + s * L.axis.rows, y, 8, 0]);
    for (let y = Math.floor(L.lake.y0 / 26) * 26 + 13; y < L.lake.y1; y += 26) for (const s of [-1, 1]) out.push([lakeX(y) + s * (lakeHW(y) + 6), y, 6, 0]);
    for (const r of L.roads) for (let t = Math.ceil(r.a / L.roadStep) * L.roadStep + L.roadStep / 2; t < r.b; t += L.roadStep) for (const s of [-1, 1]) {
      const x = r.ax === 'x' ? r.c + s * (r.hw + 2) : t, y = r.ax === 'x' ? t : r.c + s * (r.hw + 2);
      if (!inLake(x, y, 0)) out.push([x, y, 10, 1]);
    }
    return out;
  }
  function lampsAt(list, x, y) {
    let e = 0;
    for (const l of list) { const dx = x - l[0], dy = y - l[1]; const d2 = dx * dx + dy * dy; if (d2 > 3600) continue; const q = d2 + l[2] * l[2]; e += l[2] / (q * Math.sqrt(q)); }
    return e;
  }

  /* ── shaders ──────────────────────────────────────────────────────── */
  const commonVS = '#include <common>\n#include <logdepthbuf_pars_vertex>\n';
  // city blocks: windows, shop fronts, crown lights, filtered to their average when sub-pixel
  const cityVert = /* glsl */`
  ${commonVS}
  attribute vec4 aB; attribute vec4 aH;     // x, z, width, depth · height, rotation, seed, type
  varying vec3 vL; varying vec3 vN; varying vec4 vH; varying vec3 vW; varying vec2 vS;
  void main(){
    vec3 s = vec3(aB.z, aH.x, aB.w);
    vec3 lp = position * s;                 // unit box, base at 0
    float c = cos(aH.y), sn = sin(aH.y);
    vec3 w = vec3(aB.x + lp.x * c - lp.z * sn, lp.y, aB.y + lp.x * sn + lp.z * c);
    vN = vec3(normal.x * c - normal.z * sn, normal.y, normal.x * sn + normal.z * c);
    vL = lp; vH = aH; vW = w; vS = vec2(aB.z, aB.w);
    gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
    #include <logdepthbuf_vertex>
  }`;
  const cityFrag = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform float uTime; uniform vec3 uPalA; uniform vec3 uPalB; uniform vec3 uCityAmb; uniform float uShowGlow;
  uniform vec4 uCity;      // city light show: level, fx time of the last wave
  varying vec3 vL; varying vec3 vN; varying vec4 vH; varying vec3 vW; varying vec2 vS;
  ${G.noise}
  float voro(vec2 p){                      // bubble cells for the Water Cube
    vec2 i = floor(p), fr = fract(p); float d1 = 8.0, d2 = 8.0;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){
      vec2 g = vec2(float(x), float(y)); vec2 o = vec2(kHash21(i + g), kHash21(i + g + 17.3));
      float d = length(g + o - fr); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
    }
    return d2 - d1;
  }
  void main(){
    #include <logdepthbuf_fragment>
    vec3 N = normalize(vN);
    float seed = vH.z, type = vH.w, h = vH.x;
    vec3 base = vec3(0.006, 0.0062, 0.007);
    vec3 em = vec3(0.0);
    // sky / city ambient on the facades, a little of the show's glow on faces turned to the venue
    vec3 toV = normalize(vec3(-vW.x, 60.0 - vW.y, -vW.z));
    float dV2 = dot(vW.xz, vW.xz);
    vec3 amb = uCityAmb * (0.5 + 0.5 * N.y) + vec3(0.9, 0.12, 0.05) * uShowGlow * max(dot(N, toV), 0.0) * 0.04 * 6e5 / (dV2 + 6e5);
    if (abs(N.y) < 0.5) {
      float u = abs(N.x) > abs(N.z) ? vL.z : vL.x;
      float v = vL.y;
      if (type < 1.5) {
        // windows: 3.2 m bays, 3.3 m floors (offices: taller floors, more lit, cooler)
        bool off = type > 0.5;
        vec2 cs = vec2(off ? 3.6 : 3.2, off ? 3.9 : 3.3);
        vec2 g = vec2(u, v) / cs; vec2 id = floor(g); vec2 fr = fract(g);
        float lit = step(kHash21(id + seed * 37.0 + floor(N.x * 2.0 + N.z * 3.0) * 5.0), off ? 0.5 : 0.3 + 0.2 * fract(seed * 7.0));
        float win = step(0.18, fr.x) * step(fr.x, off ? 0.94 : 0.78) * step(0.28, fr.y) * step(fr.y, 0.86);
        float tint = kHash21(id * 1.7 + seed);
        vec3 wc = mix(vec3(1.0, 0.62, 0.32), vec3(0.75, 0.86, 1.0), off ? 0.7 : step(0.78, tint)) * (0.35 + 0.9 * tint);
        float fw = max(length(fwidth(g)), 0.0);
        float avgK = smoothstep(0.5, 1.2, fw);
        vec3 near = wc * lit * win;
        // sub-pixel windows: keep a sparse sparkle (a few bright cells) over a very low average
        float spark = step(0.985, kHash21(floor(g * 0.5) + seed * 13.0 + floor(N.x * 2.0 + N.z * 3.0) * 7.0));
        vec3 far = mix(vec3(1.0, 0.68, 0.38), vec3(0.8, 0.88, 1.0), off ? 0.7 : 0.2) * ((off ? 0.012 : 0.007) + spark * 0.5);
        float awake = step(0.18, fract(seed * 17.3));
        em = mix(near, far, avgK) * (off ? 1.2 : 0.9) * step(4.5, v) * awake;
        // street level: shop fronts
        em += vec3(1.0, 0.7, 0.4) * (1.0 - step(4.5, v)) * step(0.8, v) * step(0.45, fract(seed * 13.0)) * 1.2;
        // crown lights on the towers
        if (off) em += mix(vec3(0.7, 0.85, 1.0), vec3(1.0, 0.6, 0.25), step(0.5, fract(seed * 3.1))) * smoothstep(h - 3.0, h - 0.6, v) * step(v, h - 0.2) * 3.0 * step(0.35, fract(seed * 5.7));
        // the whole city joins in: crown bands sweep in the show colours, tall offices run media
        // façades, and on the big moments a wave of light races outward from the Nest
        if (uCity.x > 0.0) {
          float r = length(vW.xz), wa = uTime - uCity.y;
          float wave = wa > 0.0 && wa < 14.0 ? exp(-kSq((r - wa * 620.0) / 260.0)) * exp(-wa * 0.12) : 0.0;
          float band = smoothstep(h * 0.68, h * 0.74, v) * step(v, h - 0.3);
          float sweep = pow(0.5 + 0.5 * sin(atan(vW.z, vW.x) * 3.0 - uTime * 0.7 + seed), 6.0);
          vec3 pc = mix(uPalA, uPalB, step(0.5, fract(seed * 3.7)));
          float media = off ? step(0.45, fract(seed * 11.3)) * (0.5 + 0.5 * sin(v * 0.22 - uTime * 2.2 + seed * 6.2831)) * step(4.5, v) : 0.0;
          em += pc * (band * (0.35 + 1.6 * sweep + 5.0 * wave) + media * 0.9 + wave * 1.2 * step(4.5, v) * awake) * uCity.x * (0.5 + 0.5 * step(0.3, fract(seed * 5.1)));
        }
      } else if (type < 2.5) {
        // Ling Long Tower: LED crown carrying the show palette, light seams down the shaft
        float crown = step(h - 15.0, v);
        float scan = 0.6 + 0.4 * sin(v * 0.6 - uTime * 2.0 + u * 0.3);
        em = mix(vec3(0.0), uPalA * 1.6 * scan + vec3(0.12), crown);
        float seam = 1.0 - smoothstep(0.2, 0.6, abs(abs(u) - vS.x * 0.5 + 0.6));
        em += vec3(0.85, 0.9, 1.0) * seam * (1.0 - crown) * 0.35;
        float fl = step(0.5, fract(v / 4.2)) * step(fract(u / 2.0), 0.7) * 0.05;
        em += vec3(1.0, 0.8, 0.6) * fl * (1.0 - crown);
      } else if (type < 3.5) {
        // Water Cube: blue ETFE bubbles, slowly breathing
        float c = voro(vec2(u, v) / 5.5 + seed);
        float cell = smoothstep(0.02, 0.18, c);
        float pulse = 0.7 + 0.3 * sin(uTime * 0.6 + u * 0.02 + v * 0.05);
        em = mix(vec3(0.6, 0.85, 1.0) * 1.4, vec3(0.02, 0.22, 0.9) * (0.9 + 0.6 * kHash21(floor(vec2(u, v) / 5.5))), cell) * pulse * 1.3;
      } else {
        // convention centre: warm glass curtain with mullions
        vec2 g = vec2(u / 2.4, v / 4.5);
        float mul = step(0.92, fract(g.x)) + step(0.94, fract(g.y));
        float fw = length(fwidth(g));
        em = vec3(1.0, 0.72, 0.42) * mix(0.55 * (1.0 - min(mul, 1.0)), 0.5, smoothstep(0.3, 1.0, fw)) * (0.5 + 0.5 * kHash21(floor(g) + seed));
      }
    } else {
      // roofs: dark, Water Cube roof keeps a faint bubble glow
      if (type > 2.5 && type < 3.5) em = vec3(0.02, 0.12, 0.45) * 0.4;
    }
    gl_FragColor = vec4(base * amb * 30.0 + em, 1.0);
  }`;

  // trees: one camera-facing card each, shaded as a lumpy volume (a canopy silhouette with leaf
  // breakup and a pseudo-3D normal), lit from below by the lamps and from the side by the venue
  const treeVert = /* glsl */`
  ${commonVS}
  attribute vec4 aT;   // x, z, scale, lamp light
  attribute float aR;
  uniform float uPxScale;
  varying vec2 vQ; varying vec3 vW; varying float vLamp; varying float vR; varying vec3 vRt;
  void main(){
    float s = aT.z * (0.85 + 0.3 * fract(aR * 7.0));
    vec3 base = vec3(aT.x, 0.0, aT.y);
    vec3 toCam = cameraPosition - base;
    float dist = length(toCam);
    vec3 rt = normalize(vec3(toCam.z, 0.0, -toCam.x));
    vec2 q = position.xy * vec2(4.4, 10.0) * s;        // card: 8.8 m wide, 10 m tall at scale 1
    vec3 w = base + rt * q.x + vec3(0.0, q.y, 0.0);
    gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
    if (10.0 * s * uPxScale / max(dist, 0.1) < 1.5) gl_Position = vec4(0.0, 0.0, -2.0, 1.0);
    vQ = vec2(position.x, position.y); vW = w; vLamp = aT.w; vR = aR; vRt = rt;
    #include <logdepthbuf_vertex>
  }`;
  const treeFrag = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform vec3 uCityAmb; uniform float uShowGlow; uniform float uLampI;
  varying vec2 vQ; varying vec3 vW; varying float vLamp; varying float vR; varying vec3 vRt;
  ${G.tnoise}
  void main(){
    #include <logdepthbuf_fragment>
    vec2 q = vQ;                                   // x −0.5..0.5, y 0..1
    float sd = fract(vR * 31.0);
    // canopy: a lumpy ellipse sitting on a short trunk
    vec2 c = vec2(q.x / 0.5, (q.y - 0.6) / 0.38);
    float ang = atan(c.y, c.x);
    float lump = 0.12 * sin(ang * 5.0 + sd * 20.0) + 0.08 * sin(ang * 9.0 + sd * 7.0);
    float leaf = tn2(q * vec2(2.2, 2.6) + sd * 3.0);
    float r = length(c) - lump - (leaf - 0.5) * 0.35;
    float trunk = step(abs(q.x), 0.035 + 0.02 * (1.0 - q.y)) * step(q.y, 0.42);
    if (r > 1.0 && trunk < 0.5) discard;
    vec3 col;
    if (r <= 1.0) {
      // pseudo normal of the canopy volume
      vec2 cn = c * 0.9;
      vec3 N = normalize(vRt * cn.x + vec3(0.0, cn.y, 0.0) + normalize(cross(vRt, vec3(0.0, 1.0, 0.0))) * sqrt(max(1.0 - dot(cn, cn), 0.0)));
      float detail = 0.6 + 0.8 * tn2(q * vec2(9.0, 11.0) + sd * 5.0);
      vec3 alb = vec3(0.016, 0.026, 0.012) * detail * (0.8 + 0.4 * fract(vR * 13.0));
      float under = clamp(-N.y * 0.7 + 0.45, 0.0, 1.0) * (1.0 - smoothstep(0.35, 0.95, q.y));
      vec3 lamp = vec3(1.0, 0.74, 0.48) * vLamp * uLampI * (0.25 + under * 1.4);
      vec3 toV = normalize(vec3(-vW.x, 40.0 - vW.y, -vW.z));
      float dV = length(vW.xz);
      vec3 venue = vec3(0.9, 0.1, 0.04) * uShowGlow * (0.3 + max(dot(N, toV), 0.0)) * 1.6e4 / (dV * dV + 6e4);
      vec3 sky = uCityAmb * (0.5 + 0.5 * max(N.y, 0.0));
      col = alb * (lamp + venue + sky * 2.0);
      // self-shadowed interior
      col *= 0.55 + 0.45 * smoothstep(0.2, 1.0, r);
    } else {
      col = vec3(0.012, 0.009, 0.007) * (vLamp * uLampI * 0.6 + 0.1);
    }
    gl_FragColor = vec4(col, 1.0);
  }`;

  const postVert = /* glsl */`
  ${commonVS}
  attribute vec3 aP; attribute float aHgt;
  varying vec3 vN; varying vec3 vW; varying float vY;
  void main(){
    vec3 p = position; p.y = position.y < 0.5 ? 0.0 : position.y + aHgt - 1.0;
    vec3 w = aP + p;
    vN = normal; vW = w; vY = position.y;
    gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
    #include <logdepthbuf_vertex>
  }`;
  const postFrag = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform vec3 uCityAmb; uniform float uShowGlow;
  varying vec3 vN; varying vec3 vW; varying float vY;
  void main(){
    #include <logdepthbuf_fragment>
    vec3 N = normalize(vN);
    vec3 col = vec3(0.03, 0.03, 0.032) * (uCityAmb * 3.0 + vec3(0.6, 0.06, 0.02) * uShowGlow * max(dot(N, normalize(vec3(-vW.x, 0.0, -vW.z))), 0.0) * 0.3);
    // the lamp head: a warm emitter underneath
    col += vec3(1.0, 0.78, 0.5) * 6.0 * step(0.9, vY) * step(N.y, -0.5);
    gl_FragColor = vec4(col, 1.0);
  }`;

  // glowing points: lamp heads, aviation lights, shop signs
  const glowVert = /* glsl */`
  ${commonVS}
  attribute vec4 aC;          // rgb, size (m)
  attribute float aBlink;     // 0 steady, >0 blink phase
  uniform float uPxScale; uniform float uTime;
  varying vec3 vCol;
  void main(){
    vec4 mv = viewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float px = aC.a * uPxScale / max(-mv.z, 0.1);
    float s = clamp(px, 1.6, 40.0);
    gl_PointSize = s;
    float bl = aBlink > 0.0 ? step(0.72, fract(uTime * 0.5 + aBlink)) : 1.0;
    vCol = aC.rgb * min((px * px) / (s * s), 1.0) * bl;
    if (bl <= 0.0) gl_Position = vec4(0.0, 0.0, -2.0, 1.0);
    #include <logdepthbuf_vertex>
  }`;

  // fans outside: light sticks and phones on the plaza and along the lake
  const fanVert = /* glsl */`
  ${commonVS}
  attribute vec2 aR;          // random, kind (1 = phone)
  uniform float uPxScale; uniform float uTime; uniform vec3 uCrowdA; uniform float uBeatPulse; uniform float uFans;
  varying vec3 vCol;
  void main(){
    float r = aR.x;
    vec3 p = position;
    float sw = sin(uTime * (2.0 + r * 1.4) + r * 6.28);
    p += vec3(sw * 0.25, abs(sw) * 0.08, cos(uTime * 1.7 + r * 9.0) * 0.18) * (1.0 - aR.y * 0.8);
    vec4 mv = viewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float px = 0.32 * uPxScale / max(-mv.z, 0.1);
    float s = clamp(px, 1.4, 10.0);
    gl_PointSize = s;
    vec3 c = aR.y > 0.5 ? vec3(1.0, 0.95, 0.88) * (0.4 + 0.6 * step(0.5, fract(uTime * 0.3 + r * 7.0)))
                        : mix(uCrowdA, vec3(1.0, 0.25, 0.1), 0.35) * (0.7 + 0.6 * uBeatPulse * fract(r * 3.7));
    vCol = c * 2.6 * uFans * min((px * px) / (s * s), 1.6);
    #include <logdepthbuf_vertex>
  }`;

  // traffic: each point is a car's light pair, moving along its lane
  const NL = 16;
  const trafficVert = /* glsl */`
  ${commonVS}
  attribute vec4 aCar;        // lane, phase, speed (m/s), lateral offset
  uniform vec4 uLaneA[${NL}]; uniform vec4 uLaneB[${NL}];   // xyz start (three), length · xyz end, 0
  uniform float uPxScale; uniform float uTime;
  varying vec3 vCol;
  void main(){
    int li = int(aCar.x);
    vec4 A = uLaneA[li], Bv = uLaneB[li];
    vec3 d = Bv.xyz - A.xyz;
    float s = fract(aCar.y + uTime * aCar.z / A.w);
    vec3 side = normalize(vec3(-d.z, 0.0, d.x));
    vec3 p = A.xyz + d * s + side * aCar.w + vec3(0.0, 0.7, 0.0);
    vec4 mv = viewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float px = 1.4 * uPxScale / max(-mv.z, 0.1);
    float sz = clamp(px, 1.3, 14.0);
    gl_PointSize = sz;
    float facing = dot(normalize(d), normalize(cameraPosition - p));
    vec3 c = facing > 0.0 ? vec3(1.0, 0.9, 0.75) * (0.5 + 2.5 * facing * facing) : vec3(1.0, 0.04, 0.015) * 1.6;
    float edge = smoothstep(0.0, 0.03, s) * smoothstep(1.0, 0.97, s);
    vCol = c * 3.0 * edge * min((px * px) / (sz * sz), 1.0);
    #include <logdepthbuf_vertex>
  }`;

  const waterVert = /* glsl */`
  ${commonVS}
  varying vec3 vW;
  void main(){ vW = position; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }`;
  const waterFrag = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform sampler2D uMirror; uniform mat4 uMirrorVP; uniform float uMirrorK; uniform float uMirrorY; uniform float uTime;
  uniform vec3 uCityAmb; uniform float uShowGlow; uniform float uLampI; uniform vec4 uFo; uniform vec3 uFoA;
  varying vec3 vW;
  ${G.noise}
  ${G.tnoise}
  ${G.world}
  void main(){
    #include <logdepthbuf_fragment>
    vec2 b = vec2(vW.x, -vW.z);
    vec3 V = normalize(cameraPosition - vW);
    float dist = length(cameraPosition - vW);
    // two scrolling ripple layers, flattened with distance (no shimmer at grazing angles)
    vec2 q1 = b * 0.035 + vec2(uTime * 0.011, uTime * 0.006), q2 = b * 0.09 - vec2(uTime * 0.017, -uTime * 0.013);
    float e = 0.01;
    vec2 g1 = vec2(tn2(q1 + vec2(e, 0.0)) - tn2(q1 - vec2(e, 0.0)), tn2(q1 + vec2(0.0, e)) - tn2(q1 - vec2(0.0, e)));
    vec2 g2 = vec2(tn2(q2 + vec2(e, 0.0)) - tn2(q2 - vec2(e, 0.0)), tn2(q2 + vec2(0.0, e)) - tn2(q2 - vec2(0.0, e)));
    vec2 gr = (g1 + g2 * 0.6) * 2.2 / (1.0 + dist * 0.004);
    vec3 N = normalize(vec3(-gr.x, 1.0, gr.y));
    float ndv = max(dot(N, V), 0.0);
    float F = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
    vec3 refl;
    if (uMirrorK > 0.0 && uMirrorY < 0.5) {
      vec4 mc = uMirrorVP * vec4(vW.x, 0.0, vW.z, 1.0);
      vec2 muv = mc.xy / mc.w * 0.5 + 0.5 + vec2(gr.x, gr.y * 2.5) * 0.06;
      refl = texture2D(uMirror, muv).rgb * 0.4
           + (texture2D(uMirror, muv + vec2(0.0, 0.006)).rgb + texture2D(uMirror, muv - vec2(0.0, 0.006)).rgb) * 0.2
           + (texture2D(uMirror, muv + vec2(0.0015, 0.0)).rgb + texture2D(uMirror, muv - vec2(0.0015, 0.0)).rgb) * 0.1;
    } else {
      refl = kobBowlRefl(vW, reflect(-V, N)) * 2.0;
    }
    vec3 skyR = uCityAmb * 6.0 * (1.0 - smoothstep(0.0, 0.6, reflect(-V, N).y)) + vec3(0.002, 0.003, 0.006);
    vec3 col = vec3(0.0015, 0.003, 0.004) + (refl + skyR) * F;
    // lamp pools on the water read as soft glints
    col += kobLamps(b) * uLampI * 0.02 * (0.3 + F);
    // the fountain's underwater lights
    if (b.y > -336.0 && b.y < -70.0) {
      float yy = clamp(floor((b.y + 330.0) / 6.35 + 0.5) * 6.35 - 330.0, -330.0, -76.0);
      vec2 d = vec2(b.x - kLakeX(yy), b.y - yy);
      col += mix(uFoA, vec3(1.0), 0.3) * exp(-dot(d, d) / 5.0) * 2.0 * uFo.x;
    }
    gl_FragColor = vec4(col, 1.0);
  }`;

  const deckFrag = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform vec3 uCityAmb; uniform float uTime;
  varying vec3 vN; varying vec3 vW; varying float vY;
  void main(){
    #include <logdepthbuf_fragment>
    vec3 N = normalize(vN);
    vec3 col = vec3(0.025) * uCityAmb * (N.y > 0.5 ? 4.0 : 1.5);
    // LED strips along both parapets, lamps every 40 m
    float strip = smoothstep(0.72, 0.95, vY) * step(abs(N.y), 0.5);
    col += vec3(0.5, 0.75, 1.0) * strip * 1.6;
    gl_FragColor = vec4(col, 1.0);
  }`;

  const otowFrag = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform vec3 uCityAmb;
  varying vec3 vN; varying vec3 vW; varying float vY;
  void main(){
    #include <logdepthbuf_fragment>
    vec3 N = normalize(vN);
    float up = smoothstep(240.0, 20.0, vW.y);
    vec3 col = vec3(0.6, 0.66, 0.75) * 0.05 * (0.4 + up) * (0.6 + 0.4 * max(N.x, 0.0));
    // disc rims glow white-blue
    col += vec3(0.6, 0.8, 1.0) * 3.5 * step(0.5, vY) * step(abs(N.y), 0.3);
    gl_FragColor = vec4(col + uCityAmb * 0.05, 1.0);
  }`;

  /* ── builder ──────────────────────────────────────────────────────── */
  KOB.makeWorld = function (THREE, ctx, AQ) {
    const { U, scene } = ctx;
    const V3 = THREE.Vector3;
    const group = new THREE.Group(); group.name = 'KOB_World';
    scene.add(group);
    const WU = {};   // world uniforms live in the shared set (uCityAmb, uShowGlow, uLampI, uFans)
    const uni = Object.assign({}, U, WU);
    const mk = (vert, frag, extra, opts) => new THREE.ShaderMaterial(Object.assign({ uniforms: Object.assign({}, uni, extra || {}), vertexShader: vert, fragmentShader: frag }, opts || {}));
    const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };
    const lamps = lampList();
    const api = { group, lamps, WU, parts: {} };

    /* lake: one ribbon, split where the road bridges it */
    {
      const pos = [], idx = [];
      const Lk = L.lake;
      let segStart = true;
      for (let y = Lk.y0; y <= Lk.y1; y += 5) {
        if (Lk.gaps.some((g) => Math.abs(y - g) < L.roads[2].hw + 1.5)) { segStart = true; continue; }
        const xc = lakeX(y), hw = lakeHW(y) * Math.min(1, 0.35 + 0.65 * Math.min((y - Lk.y0) / 60, (Lk.y1 - y) / 60, 1));
        const n = pos.length / 3;
        pos.push(xc - hw, 0.16, -y, xc + hw, 0.16, -y);
        if (!segStart) idx.push(n - 2, n - 1, n, n - 1, n + 1, n);
        segStart = false;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
      const m = mk(waterVert, waterFrag, {}, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
      const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false;
      group.add(mesh); api.parts.lake = mesh;
    }

    /* street lamps: posts (instanced boxes) + glowing heads (points) */
    {
      const n = lamps.length;
      const box = new THREE.BoxGeometry(0.22, 1, 0.22); box.translate(0, 0.5, 0);
      const head = new THREE.BoxGeometry(0.7, 0.18, 0.7); head.translate(0, 1, 0);
      const merged = mergeGeos(THREE, [box, head]);
      const g = new THREE.InstancedBufferGeometry(); g.index = merged.index;
      g.setAttribute('position', merged.attributes.position); g.setAttribute('normal', merged.attributes.normal);
      const aP = new Float32Array(n * 3), aH = new Float32Array(n);
      const hp = new Float32Array(n * 3), hc = new Float32Array(n * 4), hb = new Float32Array(n);
      lamps.forEach((l, i) => {
        aP.set([l[0], 0, -l[1]], i * 3); aH[i] = l[2];
        hp.set([l[0], l[2] - 0.15, -l[1]], i * 3);
        const c = l[3] ? [1, 0.62, 0.3] : [1, 0.78, 0.52];
        hc.set([c[0] * 16, c[1] * 16, c[2] * 16, 0.55], i * 4);
      });
      g.setAttribute('aP', new THREE.InstancedBufferAttribute(aP, 3)); g.setAttribute('aHgt', new THREE.InstancedBufferAttribute(aH, 1));
      g.instanceCount = n;
      const posts = new THREE.Mesh(g, mk(postVert, postFrag)); posts.frustumCulled = false;
      group.add(posts); api.parts.posts = posts;
      const hg = new THREE.BufferGeometry();
      hg.setAttribute('position', new THREE.BufferAttribute(hp, 3)); hg.setAttribute('aC', new THREE.BufferAttribute(hc, 4)); hg.setAttribute('aBlink', new THREE.BufferAttribute(hb, 1));
      const heads = new THREE.Points(hg, mk(glowVert, G.pointFrag, {}, additive));
      heads.frustumCulled = false; heads.layers.enable(3); heads.renderOrder = 6;
      group.add(heads); api.parts.heads = heads;
    }

    /* trees: rows on the axis, along the lake and roads, a ring round the plaza, the forest park */
    {
      const R = KOB.rng(808);
      const T = [];
      const ok = (x, y) => !inLake(x, y, 9) && !onRoad(x, y, 4) && plazaE(x, y) > 1.09 && !(plazaE(x, y) > L.ring.e0 - 0.03 && plazaE(x, y) < L.ring.e1 + 0.03)
        && Math.abs(x - L.axis.x) > 8 && !(y > -250 && y < 0 && x < lakeX(y) && x > lakeX(y) - 70) && !(y > -330 && y < -100 && x > lakeX(y) && x < lakeX(y) + 90) && !(Math.abs(x - L.waterCube.c[0]) < 100 && Math.abs(y - L.waterCube.c[1]) < 100) && Math.abs(y - L.express.y) > 30;
      const walkClear = (x, y) => { const th = Math.atan2(y, x); const st = Math.PI * 2 / L.walk.n; const k = Math.round((th - L.walk.off) / st) * st + L.walk.off; return Math.abs(-Math.sin(k) * x + Math.cos(k) * y) > L.walk.half + 3; };
      const add = (x, y, s) => { if (ok(x, y) && walkClear(x, y)) T.push([x, y, s]); };
      for (let y = L.axis.y0; y < L.axis.y1; y += 12) for (const s of [-1, 1]) { add(L.axis.x + s * (L.axis.half - 6), y + (R() - 0.5) * 2, 0.9 + R() * 0.3); add(L.axis.x + s * (L.axis.half + 8), y + 6, 1.0 + R() * 0.4); }
      for (let y = L.lake.y0; y < L.lake.y1; y += 13) for (const s of [-1, 1]) { const x = lakeX(y) + s * (lakeHW(y) + 15 + R() * 5); add(x, y + R() * 5, 1 + R() * 0.5); if (R() < 0.6) add(x + s * (9 + R() * 8), y + R() * 10, 0.9 + R() * 0.6); }
      for (let i = 0; i < 150; i++) { const a = i / 150 * Math.PI * 2; const e = 1.12 + (i % 2) * 0.035; add(L.plaza[0] * e * Math.cos(a), L.plaza[1] * e * Math.sin(a), 0.85 + R() * 0.3); }
      for (const r of L.roads) for (let t = r.a; t < r.b; t += 15) for (const s of [-1, 1]) { const o = r.hw + 7 + R() * 3; add(r.ax === 'x' ? r.c + s * o : t, r.ax === 'x' ? t : r.c + s * o, 0.9 + R() * 0.4); }
      // forest park (north) and pocket groves
      for (let i = 0; i < 2600; i++) {
        const cx = (R() - 0.5) * 1700, cy = 420 + R() * 1450;
        if (R() < 0.6) add(cx + (R() - 0.5) * 30, cy + (R() - 0.5) * 30, 0.9 + R() * 0.9);
      }
      for (let i = 0; i < 900; i++) { const x = (R() - 0.5) * 1700, y = -880 + R() * 1250; if (plazaE(x, y) > 1.45) add(x, y, 0.8 + R() * 0.7); }
      // shuffle (a draw-range prefix is a uniform subset for lower tiers)
      api.axisTrees = T.filter((t) => Math.abs(t[0] - L.axis.x) < L.axis.half + 12 || (Math.hypot(t[0] / L.plaza[0], t[1] / L.plaza[1]) < 1.2));
      for (let i = T.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const t = T[i]; T[i] = T[j]; T[j] = t; }
      const n = T.length;
      const g = new THREE.InstancedBufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3)); g.setIndex([0, 1, 2, 0, 2, 3]);
      const aT = new Float32Array(n * 4), aR = new Float32Array(n);
      T.forEach((t, i) => { aT.set([t[0], -t[1], t[2], Math.min(0.02, lampsAt(lamps, t[0], t[1]))], i * 4); aR[i] = R(); });
      g.setAttribute('aT', new THREE.InstancedBufferAttribute(aT, 4)); g.setAttribute('aR', new THREE.InstancedBufferAttribute(aR, 1));
      g.instanceCount = n;
      const trees = new THREE.Mesh(g, mk(treeVert, treeFrag, {}, { side: THREE.DoubleSide })); trees.frustumCulled = false;
      group.add(trees); api.parts.trees = trees; api.treeCount = n;
    }

    /* fans outside: around the four gates, on the east plaza and the lake promenade */
    {
      const R = KOB.rng(515);
      const P = [], RR = [];
      const N = Math.round(7000 * Math.max(0.5, AQ.people));
      const gates = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75, 0, Math.PI];
      for (let i = 0; i < N; i++) {
        let x, y;
        const k = R();
        if (k < 0.62) {
          // queues and gatherings at the gates, between the shell and the plaza edge
          const a = gates[Math.floor(R() * gates.length)] + (R() - 0.5) * 0.42, s = R();
          x = Math.cos(a) * (L.bowl[0] * 1.05 + s * (L.plaza[0] * 1.03 - L.bowl[0] * 1.05));
          y = Math.sin(a) * (L.bowl[1] * 1.05 + s * (L.plaza[1] * 1.03 - L.bowl[1] * 1.05));
        } else if (k < 0.86) {
          // the east plaza and its walkways, people who came to listen from outside
          const a = (R() - 0.5) * 1.3, e = 1.02 + R() * 0.3;
          x = L.plaza[0] * e * Math.cos(a); y = L.plaza[1] * e * Math.sin(a);
        } else {
          y = -420 + R() * 700; x = lakeX(y) + (R() < 0.5 ? -1 : 1) * (lakeHW(y) + 2 + R() * 7);
        }
        if (inLake(x, y, 1) || Math.hypot(x / L.bowl[0], y / L.bowl[1]) < 1.04) continue;
        P.push(x, 2.1 + R() * 0.25, -y); RR.push(R(), R() < 0.3 ? 1 : 0);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aR', new THREE.Float32BufferAttribute(RR, 2));
      const pts = new THREE.Points(g, mk(fanVert, G.pointFrag, {}, additive));
      pts.frustumCulled = false; pts.renderOrder = 6;
      group.add(pts); api.parts.fans = pts;
      api.fanStick = new Float32Array(P); api.fanR = RR.filter((_, i) => i % 2 === 0); api.fanBase = new Array(P.length / 3).fill(0.02);
    }

    /* traffic */
    {
      const lanes = [];
      const lane = (ax, ay, bx, by, z, n, speed) => lanes.push({ a: [ax, z, -ay], b: [bx, z, -by], n, speed });
      for (const r of L.roads) {
        if (r.ax === 'x') { lane(r.c - 4, r.a, r.c - 4, r.b, 0, 90, 14); lane(r.c + 4, r.b, r.c + 4, r.a, 0, 90, 14); }
        else { lane(r.a, r.c - 4, r.b, r.c - 4, 0, 80, 13); lane(r.b, r.c + 4, r.a, r.c + 4, 0, 80, 13); }
      }
      const X = L.express;
      lane(X.a, X.y - 7, X.b, X.y - 7, X.z, 900, 22); lane(X.b, X.y + 7, X.a, X.y + 7, X.z, 900, 22);
      lane(X.a, X.y - 22, X.b, X.y - 22, 0, 260, 12); lane(X.b, X.y + 22, X.a, X.y + 22, 0, 260, 12);
      // far arterials
      lane(-7000, -2600, 7000, -2600, 0, 380, 16); lane(7000, -2590, -7000, -2590, 0, 380, 16);
      lane(2500, -7000, 2500, 7000, 0, 380, 16); lane(-2900, 7000, -2900, -7000, 0, 380, 16);
      const R = KOB.rng(313);
      const cars = [];
      lanes.forEach((ln, li) => { for (let i = 0; i < ln.n; i++) cars.push(li, R(), ln.speed * (0.8 + R() * 0.4), (R() < 0.5 ? -1.6 : 1.6) + (R() - 0.5)); });
      const n = cars.length / 4;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
      g.setAttribute('aCar', new THREE.Float32BufferAttribute(cars, 4));
      const A = [], B = [];
      for (let i = 0; i < NL; i++) {
        const ln = lanes[Math.min(i, lanes.length - 1)];
        const len = Math.hypot(ln.b[0] - ln.a[0], ln.b[2] - ln.a[2]);
        A.push(new THREE.Vector4(ln.a[0], ln.a[1], ln.a[2], len)); B.push(new THREE.Vector4(ln.b[0], ln.b[1], ln.b[2], 0));
      }
      const pts = new THREE.Points(g, mk(trafficVert, G.pointFrag, { uLaneA: { value: A }, uLaneB: { value: B } }, additive));
      pts.frustumCulled = false; pts.renderOrder = 6;
      group.add(pts); api.parts.traffic = pts;
    }

    /* elevated ring road (North 4th Ring) */
    {
      const X = L.express;
      const g = new THREE.BoxGeometry(X.b - X.a, 1.6, X.hw * 2, 1, 1, 1);
      g.translate(0, X.z - 0.8, -X.y);
      const pos = g.attributes.position; const yv = new Float32Array(pos.count);
      for (let i = 0; i < pos.count; i++) yv[i] = pos.getY(i) > X.z - 0.1 ? 1 : 0;
      const vert = `${commonVS} varying vec3 vN; varying vec3 vW; varying float vY; attribute float aTop;
        void main(){ vN = normal; vW = position; vY = aTop; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
        #include <logdepthbuf_vertex>
        }`;
      g.setAttribute('aTop', new THREE.BufferAttribute(yv, 1));
      const mesh = new THREE.Mesh(g, mk(vert, deckFrag)); mesh.frustumCulled = false;
      group.add(mesh); api.parts.express = mesh;
    }

    /* city skyline + landmarks (one instanced draw) */
    {
      const R = KOB.rng(2026);
      const B = [];      // x, z(three), w, d, h, rot, seed, type
      const park = (x, y) => Math.abs(x) < 900 && y > -900 && y < 2700;
      const near = (x, y) => Math.abs(y - L.express.y) < 60;
      const N = Math.round(2200 * AQ.cityK);
      for (let i = 0; i < N; i++) {
        const r = Math.sqrt(R() * (5600 * 5600 - 980 * 980) + 980 * 980), a = R() * Math.PI * 2;
        const x = r * Math.cos(a), y = r * Math.sin(a);
        if (park(x, y) || near(x, y)) continue;
        let h = 16 + 48 * R() * R();
        let type = 0;
        if (R() < 0.13) { h = 70 + 95 * R(); type = 1; }
        if (r < 1500) h = Math.min(h, 60);
        B.push(x, -y, 22 + 36 * R(), 16 + 30 * R(), h, (R() - 0.5) * 0.12, R(), type);
      }
      // clusters: Zhongguancun to the north-west, the CBD far to the south-east, Asian Games Village south
      const cluster = (cx, cy, rad, n, h0, h1) => { for (let i = 0; i < n; i++) { const a = R() * 6.283, rr = Math.sqrt(R()) * rad; const x = cx + rr * Math.cos(a), y = cy + rr * Math.sin(a); if (park(x, y)) continue; B.push(x, -y, 30 + 30 * R(), 26 + 26 * R(), h0 + (h1 - h0) * R() * R(), (R() - 0.5) * 0.1, R(), 1); } };
      cluster(-3900, 1500, 900, 70, 70, 190);
      cluster(3600, -4300, 900, 90, 110, 330);
      cluster(-200, -1900, 600, 40, 60, 140);
      cluster(1900, 300, 500, 30, 60, 150);
      // landmarks
      const wc = L.waterCube; B.push(wc.c[0], -wc.c[1], wc.s[0], wc.s[1], wc.s[2], 0, 0.37, 3);
      B.push(L.lingLong.c[0], -L.lingLong.c[1], 17, 17, 118, 0, 0.5, 2);
      B.push(L.lingLong.c[0], -L.lingLong.c[1], 30, 30, 133, 0, 0.5, 2);
      const cv = L.convention; B.push(cv.c[0], -cv.c[1], cv.s[0], cv.s[1], cv.s[2], 0, 0.2, 4);
      const n = B.length / 8;
      const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
      const g = new THREE.InstancedBufferGeometry(); g.index = box.index;
      g.setAttribute('position', box.attributes.position); g.setAttribute('normal', box.attributes.normal);
      const aB = new Float32Array(n * 4), aH = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) { aB.set([B[i * 8], B[i * 8 + 1], B[i * 8 + 2], B[i * 8 + 3]], i * 4); aH.set([B[i * 8 + 4], B[i * 8 + 5], B[i * 8 + 6], B[i * 8 + 7]], i * 4); }
      g.setAttribute('aB', new THREE.InstancedBufferAttribute(aB, 4)); g.setAttribute('aH', new THREE.InstancedBufferAttribute(aH, 4));
      g.instanceCount = n;
      const city = new THREE.Mesh(g, mk(cityVert, cityFrag)); city.frustumCulled = false; city.layers.enable(3);
      group.add(city); api.parts.city = city;
      // aviation warning lights on everything tall
      const ap = [], ac = [], ab = [];
      for (let i = 0; i < n; i++) {
        const h = B[i * 8 + 4]; if (h < 65 || B[i * 8 + 7] === 3) continue;
        ap.push(B[i * 8], h + 1, B[i * 8 + 1]); ac.push(9, 0.25, 0.08, 2.2); ab.push(0.01 + (i % 3) * 0.002);
      }
      const ot = L.olyTower.c;
      ap.push(ot[0], 252, -ot[1]); ac.push(9, 0.25, 0.08, 3); ab.push(0.02);
      const ag = new THREE.BufferGeometry();
      ag.setAttribute('position', new THREE.Float32BufferAttribute(ap, 3)); ag.setAttribute('aC', new THREE.Float32BufferAttribute(ac, 4)); ag.setAttribute('aBlink', new THREE.Float32BufferAttribute(ab, 1));
      const av = new THREE.Points(ag, mk(glowVert, G.pointFrag, {}, additive)); av.frustumCulled = false; av.renderOrder = 6;
      group.add(av); api.parts.aviation = av;
    }

    /* Olympic Tower: five shafts carrying five discs */
    {
      const ot = L.olyTower.c, parts = [];
      const spec = [[0, 0, 4.5, 246, 24], [26, 14, 3.8, 226, 18], [-22, 18, 3.6, 214, 16], [16, -24, 3.2, 200, 14], [-14, -22, 3.0, 186, 12]];
      const tops = [];
      for (const [dx, dy, r, h, dr] of spec) {
        const s = new THREE.CylinderGeometry(r * 0.8, r, h, 10, 1, true); s.translate(ot[0] + dx, h / 2, -(ot[1] + dy)); parts.push(s);
        const d = new THREE.CylinderGeometry(dr, dr * 0.92, 5, 24, 1, false); d.translate(ot[0] + dx, h + 2.5, -(ot[1] + dy)); tops.push(d);
      }
      const shafts = mergeGeos(THREE, parts), discs = mergeGeos(THREE, tops);
      shafts.setAttribute('aTop', new THREE.BufferAttribute(new Float32Array(shafts.attributes.position.count), 1));
      discs.setAttribute('aTop', new THREE.BufferAttribute(new Float32Array(discs.attributes.position.count).fill(1), 1));
      const all = mergeGeos(THREE, [shafts, discs]);
      const vert = `${commonVS} attribute float aTop; varying vec3 vN; varying vec3 vW; varying float vY;
        void main(){ vN = normal; vW = position; vY = aTop; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
        #include <logdepthbuf_vertex>
        }`;
      const mesh = new THREE.Mesh(all, mk(vert, otowFrag)); mesh.frustumCulled = false; mesh.layers.enable(3);
      group.add(mesh); api.parts.olyTower = mesh;
    }

    /* far ground: the city carpet beyond the venue's 1.8 km ground plane */
    {
      const g = new THREE.RingGeometry(880, 9000, 64, 1); g.rotateX(-Math.PI / 2); g.translate(0, -0.6, 0);
      const vert = `${commonVS} varying vec3 vW; void main(){ vW = position; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
        #include <logdepthbuf_vertex>
        }`;
      const frag = `#include <common>
        #include <logdepthbuf_pars_fragment>
        uniform vec3 uCityAmb; varying vec3 vW;
        ${G.noise}
        void main(){
          #include <logdepthbuf_fragment>
          // the city carpet: arterials every ~1 km, side streets that come and go, and the faint glow
          // of blocks; every line is filtered by its pixel footprint so the distance never shimmers
          vec2 b = vec2(vW.x, -vW.z);
          vec2 ga = b / 1040.0, gs = b / 260.0;
          vec2 fa = abs(fract(ga) - 0.5), fs = abs(fract(gs) - 0.5);
          float fwa = max(fwidth(ga.x), fwidth(ga.y)), fws = max(fwidth(gs.x), fwidth(gs.y));
          float art = 1.0 - smoothstep(0.0, max(fwa * 1.2, 0.006), 0.5 - max(fa.x, fa.y));
          float side = (1.0 - smoothstep(0.0, max(fws * 1.2, 0.01), 0.5 - max(fs.x, fs.y)))
                     * step(0.45, kHash21(floor(gs + 0.5) + vec2(fs.x > fs.y ? 0.0 : 31.0)));
          art = mix(art, 0.012, smoothstep(0.08, 0.5, fwa));
          side = mix(side, 0.02, smoothstep(0.08, 0.5, fws));
          float blocks = kNoise2(b * 0.003) * kNoise2(b * 0.011 + 3.0);
          vec3 col = vec3(0.0035, 0.0037, 0.004) + vec3(1.0, 0.58, 0.28) * (art * 0.16 + side * 0.045 + blocks * 0.004);
          gl_FragColor = vec4(col, 1.0);
        }`;
      const mesh = new THREE.Mesh(g, mk(vert, frag)); mesh.frustumCulled = false;
      group.add(mesh); api.parts.farGround = mesh;
    }

    /* plaza searchlight origins (sky trackers, Blender coords → three) */
    api.searchlights = [];
    for (let i = 0; i < 12; i++) { const a = (i + 0.5) / 12 * Math.PI * 2; api.searchlights.push(new V3(L.plaza[0] * 1.09 * Math.cos(a), 0.8, -L.plaza[1] * 1.09 * Math.sin(a))); }


    /* ═══ festival dressing ═══════════════════════════════════════════ */
    const glowPts = (P, C, B, name, layer) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aC', new THREE.Float32BufferAttribute(C, 4));
      g.setAttribute('aBlink', new THREE.Float32BufferAttribute(B || new Array(P.length / 3).fill(0), 1));
      const pts = new THREE.Points(g, mk(glowVert, G.pointFrag, {}, additive)); pts.frustumCulled = false; pts.renderOrder = 6;
      if (layer) pts.layers.enable(3);
      group.add(pts); api.parts[name] = pts; return pts;
    };
    const canvasTex = (w, h, draw) => {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      draw(c.getContext('2d'), w, h);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
    };
    const CNF = '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", sans-serif';
    const fontFor = (t) => (/^[\x00-\x7f]*$/.test(t) ? '"Barlow Condensed", "Arial Narrow", Impact, sans-serif' : CNF);

    /* musical fountain: a line of vertical jets down the lake + crossing arcs from both banks */
    {
      const noz = [];
      const Y0 = -330, Y1 = -76, STEP = 6.35;
      for (let y = Y0, i = 0; y <= Y1; y += STEP, i++) noz.push([lakeX(y), y, 0, (y - Y0) / (Y1 - Y0)]);
      for (let y = Y0 + 3, i = 0; y <= Y1; y += STEP * 2, i++) for (const sd of [-1, 1]) noz.push([lakeX(y) + sd * (lakeHW(y) - 3), y, sd < 0 ? 1 : 2, (y - Y0) / (Y1 - Y0)]);
      const K = 34, n = noz.length * K;
      const g = new THREE.InstancedBufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3)); g.setIndex([0, 1, 2, 0, 2, 3]);
      const aN = new Float32Array(n * 4), aS = new Float32Array(n * 2), R = KOB.rng(77);
      let k = 0;
      for (const z of noz) for (let j = 0; j < K; j++, k++) {
        aN.set([z[0], -z[1], z[2], z[3]], k * 4);
        aS.set([(j + R() * 0.8) / K, R()], k * 2);
      }
      g.setAttribute('aN', new THREE.InstancedBufferAttribute(aN, 4)); g.setAttribute('aS', new THREE.InstancedBufferAttribute(aS, 2));
      g.instanceCount = n;
      const vert = `${commonVS}
        attribute vec4 aN; attribute vec2 aS;
        uniform float uTime; uniform float uBeatPulse; uniform vec4 uFo; uniform vec3 uFoA; uniform vec3 uFoB; uniform float uPxScale;
        varying vec2 vQ; varying vec3 vCol; varying float vS; varying float vR;
        float kSq(float x){ return x * x; }
        float jetH(float u){
          float m = uFo.y;
          if (m < 0.5) return 0.45 + 0.55 * (0.5 + 0.5 * sin(uTime * 2.2 - u * 14.0));
          if (m < 1.5) return 0.25 + 0.85 * step(0.5, fract(u * 6.0 + floor(uTime / 0.46875) * 0.5)) * (0.5 + 0.5 * uBeatPulse);
          if (m < 2.5) return 1.0 - abs(u - 0.5) * 1.5 + 0.1 * sin(uTime * 3.0);
          if (m < 3.5) return 0.25 + 0.85 * exp(-kSq((fract(u - uTime * 0.22) - 0.5) * 5.0));
          return 0.7 + 0.3 * sin(uTime * 3.0 + u * 6.0);
        }
        void main(){
          float s = aS.x, r = aS.y, u = aN.w;
          float h = jetH(u) * uFo.z;
          vec3 base = vec3(aN.x, 0.25, aN.y);
          vec3 p, tg; float w, segL;
          if (aN.z < 0.5) {
            float H = 6.0 + 20.0 * h;
            float sp = s * s;
            p = base + vec3(sin(uTime * 3.1 + r * 40.0) * sp * 0.7, s * H, cos(uTime * 2.7 + r * 31.0) * sp * 0.7);
            tg = vec3(0.0, 1.0, 0.0);
            w = 0.18 + s * 0.7 + smoothstep(0.85, 1.0, s) * 1.2;
            segL = H / 34.0 * 2.2;
          } else {
            // arcs from the banks, crossing over the centre line
            float dir = aN.z < 1.5 ? 1.0 : -1.0;
            float H = 3.0 + 8.0 * h, D = 15.0 + 10.0 * h;
            p = base + vec3(dir * s * D, 4.0 * H * s * (1.0 - s), (r - 0.5) * 0.5 * s);
            tg = normalize(vec3(dir * D, 4.0 * H * (1.0 - 2.0 * s), 0.0));
            w = 0.14 + s * 0.35;
            segL = length(vec2(D, 4.0 * H)) / 34.0 * 2.2;
          }
          // a streak along the water's path, turned to face the camera: overlapping streaks read as a column
          vec3 side = normalize(cross(tg, cameraPosition - p));
          p += side * position.x * w + tg * position.y * segL;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
          vec3 c = mix(uFoA, uFoB, fract(u * 3.0 + uTime * 0.05) > 0.5 ? 1.0 : 0.0);
          // lit from the nozzle: brightest low, a white core, spray fading at the top
          float lum = (1.15 - s * 0.7) * (0.85 + 0.3 * r) * uFo.x;
          vCol = (mix(c, vec3(1.0), 0.45) * lum + vec3(0.15) * (1.0 - s)) * 0.3;
          vQ = position.xy; vS = s; vR = r;
          #include <logdepthbuf_vertex>
        }`;
      const frag = `#include <common>
        #include <logdepthbuf_pars_fragment>
        uniform float uTime;
        varying vec2 vQ; varying vec3 vCol; varying float vS; varying float vR;
        ${G.tnoise}
        void main(){
          #include <logdepthbuf_fragment>
          float ax = abs(vQ.x);
          if (ax > 1.0) discard;
          float spray = tn2(vec2(vQ.x * 0.3 + vR * 7.0, vQ.y * 0.08 + vR * 3.0 - uTime * 0.9));
          float a = exp(-ax * ax * 3.5) * (1.0 - vQ.y * vQ.y * 0.6) * (0.45 + 1.1 * spray);
          gl_FragColor = vec4(vCol * a, 1.0);
        }`;
      const mesh = new THREE.Mesh(g, mk(vert, frag, {}, additive)); mesh.frustumCulled = false; mesh.renderOrder = 7; mesh.layers.enable(3);
      group.add(mesh); api.parts.fountain = mesh;
    }

    /* the fan screen: a live-relay LED wall on a truss for everyone outside */
    {
      const c = [232, -72], face = Math.atan2(-236 + 72, 352 - 232);   // turned towards the lake and the fans
      const Wd = 24, Ht = 13.5, base = 7.5;
      const nx = Math.cos(face), ny = Math.sin(face);
      const geo = new THREE.PlaneGeometry(Wd, Ht);
      const sv = `${commonVS} varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
        #include <logdepthbuf_vertex>
        }`;
      const sf = `#include <common>
        #include <logdepthbuf_pars_fragment>
        uniform float uTime; uniform float uBeatPulse; uniform vec3 uPalA; uniform vec3 uPalB; uniform vec3 uLedAvg; uniform sampler2D uTitle; uniform sampler2D uArt; uniform float uArtOn;
        varying vec2 vUv;
        void main(){
          #include <logdepthbuf_fragment>
          vec2 uv = vUv;
          // relay content: the show's palette flowing behind the title, the beast art when one wakes
          float wv = 0.5 + 0.5 * sin(uv.x * 9.0 + sin(uv.y * 5.0 + uTime) * 1.5 - uTime * 1.4);
          vec3 c = mix(uPalA * 0.12, uPalB * 0.3, wv * wv) * (0.7 + 0.5 * uBeatPulse);
          vec4 tt = texture2D(uTitle, uv);
          c = mix(c * 0.6, tt.rgb * 1.5, tt.a * (1.0 - uArtOn));
          c = mix(c, texture2D(uArt, uv).rgb * 1.5, uArtOn);
          c += uLedAvg * 0.15;
          // LED pixel structure up close
          vec2 px = fract(uv * vec2(384.0, 216.0));
          float dot_ = smoothstep(0.5, 0.25, length(px - 0.5));
          float fw = length(fwidth(uv * vec2(384.0, 216.0)));
          c *= mix(0.25 + 1.2 * dot_, 0.8, smoothstep(0.4, 1.2, fw));
          gl_FragColor = vec4(c * 1.6, 1.0);
        }`;
      const drawCard = (g, w, h, text) => {
        g.clearRect(0, 0, w, h); g.textAlign = 'center'; g.textBaseline = 'middle';
        const tg = g.createLinearGradient(0, 180, 0, 380); tg.addColorStop(0, '#fff3d6'); tg.addColorStop(0.55, '#f2b860'); tg.addColorStop(1, '#c8442a');
        g.font = `900 190px ${fontFor(text)}`;
        const fs = Math.min(190, 190 * (w * 0.88) / Math.max(1, g.measureText(text).width));
        g.font = `900 ${fs}px ${fontFor(text)}`; g.fillStyle = tg; g.fillText(text, w / 2, 270);
        g.font = `500 40px ${CNF}`; g.fillStyle = '#f6d9a8'; g.fillText('薛之谦 · 鸟巢 · LIVE', w / 2, 440);
      };
      const card = canvasTex(1024, 576, (g, w, h) => drawCard(g, w, h, '万兽之王'));
      api.redrawCard = (text) => { drawCard(card.image.getContext('2d'), 1024, 576, text); card.needsUpdate = true; };
      const scr = new THREE.Mesh(geo, mk(sv, sf, { uTitle: { value: card }, uArt: { value: null }, uArtOn: { value: 0 } }));
      scr.position.set(c[0], base + Ht / 2, -c[1]);
      scr.lookAt(c[0] + nx * 100, base + Ht / 2, -(c[1] + ny * 100));
      scr.layers.enable(3); scr.frustumCulled = false;
      group.add(scr); api.parts.screen = scr; api.screenU = scr.material.uniforms;
      // cabinet + truss legs
      const darkM = mk(postVert.replace('attribute vec3 aP; attribute float aHgt;', 'vec3 aP = vec3(0.0); float aHgt = 1.0;').replace('vec3 p = position; p.y = position.y < 0.5 ? 0.0 : position.y + aHgt - 1.0;', 'vec3 p = (modelMatrix * vec4(position, 1.0)).xyz;').replace('vN = normal;', 'vN = normalize(mat3(modelMatrix) * normal);'), postFrag);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(Wd + 1, Ht + 1, 0.9), darkM);
      cab.position.copy(scr.position); cab.quaternion.copy(scr.quaternion); cab.translateZ(-0.5); group.add(cab);
      for (const sx of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(1.2, base + Ht, 1.2), darkM);
        leg.position.copy(scr.position); leg.quaternion.copy(scr.quaternion); leg.translateX(sx * (Wd / 2 - 3)); leg.translateZ(-1.4); leg.position.y = (base + Ht) / 2;
        group.add(leg);
      }
    }

    /* LED banner towers along the walkways and the axis */
    {
      const drawBanners = (g, w, h, text) => {
        for (let v = 0; v < 2; v++) {
          const x0 = v * 128;
          const gr = g.createLinearGradient(0, 0, 0, h);
          gr.addColorStop(0, v ? '#120606' : '#2a0603'); gr.addColorStop(0.55, v ? '#2b0a04' : '#120303'); gr.addColorStop(1, '#050202');
          g.fillStyle = gr; g.fillRect(x0, 0, 128, h);
          g.textAlign = 'center'; g.textBaseline = 'middle';
          if (!v) {
            g.font = `900 92px ${CNF}`;
            const tg = g.createLinearGradient(0, 80, 0, 780); tg.addColorStop(0, '#fff2cf'); tg.addColorStop(0.6, '#f0b85a'); tg.addColorStop(1, '#d2462a');
            const chars = [...text].filter((ch) => ch.trim()).slice(0, 6);
            if (/^[\x00-\x7f]*$/.test(text)) {
              g.save(); g.translate(x0 + 64, 470); g.rotate(Math.PI / 2);
              g.font = `800 80px "Barlow Condensed", "Arial Narrow", sans-serif`;
              const fs = Math.min(80, 80 * 780 / Math.max(1, g.measureText(text).width));
              g.font = `800 ${fs}px "Barlow Condensed", "Arial Narrow", sans-serif`; g.fillStyle = tg; g.fillText(text, 0, 0); g.restore();
            } else {
              const step = Math.min(168, 720 / Math.max(1, chars.length)), fs = Math.min(92, step * 0.82);
              g.font = `900 ${fs}px ${CNF}`; g.fillStyle = tg;
              chars.forEach((ch, i) => g.fillText(ch, x0 + 64, 150 + step * (i + 0.5) - step / 2 + (720 - step * chars.length) / 2));
            }
            g.font = `500 22px ${CNF}`; g.fillStyle = '#e8c48a'; g.fillText('薛之谦', x0 + 64, 900); g.fillText('鸟巢', x0 + 64, 940);
          } else {
            g.save(); g.translate(x0 + 64, h / 2); g.rotate(Math.PI / 2);
            g.font = `800 70px "Barlow Condensed", "Arial Narrow", sans-serif`; g.fillStyle = '#ffdca0'; g.fillText('KING OF BEASTS', 0, -10);
            g.font = `500 30px "Barlow Condensed", "Arial Narrow", sans-serif`; g.fillStyle = '#d98a4a'; g.fillText('XUE ZHIQIAN · BIRD’S NEST', 0, 40);
            g.restore();
          }
        }
      };
      const tex = canvasTex(256, 1024, (g, w, h) => drawBanners(g, w, h, '万兽之王'));
      api.redrawBanners = (text) => { const g2 = tex.image.getContext('2d'); g2.clearRect(0, 0, 256, 1024); drawBanners(g2, 256, 1024, text); tex.needsUpdate = true; };
      const P = [];
      const W = L.walk;
      for (let j = 0; j < W.n; j++) {
        const k = j / W.n * Math.PI * 2 + W.off, dx = Math.cos(k), dy = Math.sin(k);
        for (let r = 262; r < 560; r += 62) for (const sd of [-1, 1]) {
          const x = dx * r - dy * sd * 11.5, y = dy * r + dx * sd * 11.5;
          if (!inLake(x, y, 6) && !onRoad(x, y, 3) && Math.abs(x) < 880 && Math.abs(y) < 880) P.push([x, y, Math.atan2(-dy, dx), P.length]);
        }
      }
      for (let y = -560; y <= 560; y += 70) for (const sd of [-1, 1]) P.push([L.axis.x + sd * (L.axis.half - 1), y, -Math.PI / 2, P.length]);
      const n = P.length;
      const g = new THREE.InstancedBufferGeometry();
      const box = new THREE.BoxGeometry(1.8, 12, 0.5); box.translate(0, 6.6, 0);
      g.index = box.index; g.setAttribute('position', box.attributes.position); g.setAttribute('normal', box.attributes.normal); g.setAttribute('uv', box.attributes.uv);
      const aB = new Float32Array(n * 4);
      P.forEach((q, i) => aB.set([q[0], -q[1], q[2], (i * 0.618) % 1], i * 4));
      g.setAttribute('aB', new THREE.InstancedBufferAttribute(aB, 4)); g.instanceCount = n;
      const vert = `${commonVS} attribute vec4 aB; varying vec2 vUv; varying vec3 vN; varying float vSeed; varying vec3 vW;
        void main(){ float c = cos(aB.z), s = sin(aB.z);
          vec3 p = vec3(position.x * c - position.z * s, position.y, position.x * s + position.z * c) + vec3(aB.x, 0.0, aB.y);
          vN = normal; vUv = uv; vSeed = aB.w; vW = p;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
          #include <logdepthbuf_vertex>
        }`;
      const frag = `#include <common>
        #include <logdepthbuf_pars_fragment>
        uniform sampler2D uTex; uniform float uTime; uniform float uBeatPulse; uniform vec3 uPalA;
        varying vec2 vUv; varying vec3 vN; varying float vSeed; varying vec3 vW;
        void main(){
          #include <logdepthbuf_fragment>
          vec3 N = normalize(vN);
          vec3 col;
          if (abs(N.y) > 0.5) col = vec3(0.01);
          else if (abs(N.x) > 0.5) col = uPalA * (1.0 + uBeatPulse);         // thin sides: LED edge strips
          else {
            vec2 uv = vec2(vUv.x * 0.5 + step(0.5, vSeed) * 0.5, vUv.y);
            vec3 art = texture2D(uTex, uv).rgb;
            // a light sweep travels up the towers, the whole avenue answering the beat
            float sweep = exp(-kSq((fract(vUv.y - uTime * 0.35 + vSeed * 0.3) - 0.5) * 9.0));
            col = art * (1.1 + 0.6 * uBeatPulse) + uPalA * sweep * 0.35;
          }
          gl_FragColor = vec4(col * 1.4, 1.0);
        }`;
      const mesh = new THREE.Mesh(g, mk(vert, frag.replace('#include <common>', '#include <common>\nfloat kSq(float x){ return x * x; }'), { uTex: { value: tex } }));
      mesh.frustumCulled = false; mesh.layers.enable(3);
      group.add(mesh); api.parts.banners = mesh;
    }

    /* entrance arches at the four gates, with queue lights */
    {
      const tex = canvasTex(512, 256, (g, w, h) => {
        g.fillStyle = '#080404'; g.fillRect(0, 0, w, h);
        ['A', 'B', 'C', 'D'].forEach((L_, i) => {
          const y = i * 64 + 32;
          g.textBaseline = 'middle'; g.textAlign = 'left';
          g.fillStyle = '#ffd896'; g.font = `700 38px ${CNF}`; g.fillText('入口 ' + L_, 22, y);
          g.fillStyle = '#e45a32'; g.font = `600 30px "Barlow Condensed", "Arial Narrow", sans-serif`; g.fillText('GATE ' + L_ + ' · 万兽之王', 210, y + 2);
        });
      });
      const parts = [];
      const gates = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75];
      const header = [];
      gates.forEach((a, gi) => {
        const e = 1.02, x = L.plaza[0] * e * Math.cos(a), y = L.plaza[1] * e * Math.sin(a);
        const rot = Math.atan2(L.plaza[1] * Math.cos(a), -L.plaza[0] * Math.sin(a));
        for (const sd of [-1, 1]) {
          const b = new THREE.BoxGeometry(1.1, 9, 1.1); b.translate(sd * 8, 4.5, 0); b.rotateY(rot); b.translate(x, 0, -y); parts.push(b);
        }
        const h = new THREE.BoxGeometry(18, 2.2, 1.0); h.translate(0, 9.6, 0); h.rotateY(rot); h.translate(x, 0, -y);
        const uv = h.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, (uv.getY(i) + 3 - gi) / 4);
        header.push(h);
      });
      const vert = `${commonVS} varying vec2 vUv; varying vec3 vN; void main(){ vUv = uv; vN = normal; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
        #include <logdepthbuf_vertex>
        }`;
      const frag = `#include <common>
        #include <logdepthbuf_pars_fragment>
        uniform sampler2D uTex; uniform float uBeatPulse; uniform vec3 uPalA; uniform float uSign;
        varying vec2 vUv; varying vec3 vN;
        void main(){
          #include <logdepthbuf_fragment>
          vec3 col = vec3(0.012);
          if (uSign > 0.5 && abs(normalize(vN).y) < 0.5) col = texture2D(uTex, vUv).rgb * 2.2;
          else if (uSign < 0.5) col = vec3(0.015) + uPalA * (0.6 + 0.6 * uBeatPulse) * smoothstep(0.42, 0.5, abs(fract(vUv.x * 2.0) - 0.5));
          gl_FragColor = vec4(col, 1.0);
        }`;
      const posts = new THREE.Mesh(mergeGeoUV(THREE, parts), mk(vert, frag, { uSign: { value: 0 } }));
      const heads = new THREE.Mesh(mergeGeoUV(THREE, header), mk(vert, frag, { uTex: { value: tex }, uSign: { value: 1 } }));
      for (const m of [posts, heads]) { m.frustumCulled = false; m.layers.enable(3); group.add(m); }
      api.parts.gates = heads;
    }

    /* food and merch tents: rows of glowing pagodas on the plaza rim */
    {
      const T = [];
      const rows = [[-0.95, -0.55], [1.75, 2.2], [2.75, 3.2], [0.55, 0.85]];
      const offWalk = (a) => { const st = Math.PI * 2 / L.walk.n; const d = a - L.walk.off - Math.round((a - L.walk.off) / st) * st; return Math.abs(d) * 225 > 10; };
      for (const [a0, a1] of rows) for (let a = a0; a <= a1; a += 0.045) if (offWalk(a)) T.push([L.plaza[0] * 1.08 * Math.cos(a), L.plaza[1] * 1.08 * Math.sin(a), a]);
      const n = T.length;
      const wall = new THREE.BoxGeometry(5, 2.6, 5); wall.translate(0, 1.3, 0);
      const roof = new THREE.ConeGeometry(3.9, 2.4, 4, 1); roof.rotateY(Math.PI / 4); roof.translate(0, 3.8, 0);
      const wa = new Float32Array(wall.attributes.position.count).fill(0), ra = new Float32Array(roof.attributes.position.count).fill(1);
      wall.setAttribute('aRoof', new THREE.BufferAttribute(wa, 1)); roof.setAttribute('aRoof', new THREE.BufferAttribute(ra, 1));
      const m = mergeGeos(THREE, [wall, roof]);
      const g = new THREE.InstancedBufferGeometry(); g.index = m.index;
      g.setAttribute('position', m.attributes.position); g.setAttribute('normal', m.attributes.normal); g.setAttribute('aRoof', m.attributes.aRoof);
      const aB = new Float32Array(n * 4);
      T.forEach((t, i) => aB.set([t[0], -t[1], -t[2] + Math.PI / 2, (i * 0.37) % 1], i * 4));
      g.setAttribute('aB', new THREE.InstancedBufferAttribute(aB, 4)); g.instanceCount = n;
      const vert = `${commonVS} attribute vec4 aB; attribute float aRoof; varying vec3 vN; varying vec3 vL; varying float vRoof; varying float vSeed;
        void main(){ float c = cos(aB.z), s = sin(aB.z);
          vec3 p = vec3(position.x * c - position.z * s, position.y, position.x * s + position.z * c) + vec3(aB.x, 0.0, aB.y);
          vN = vec3(normal.x * c - normal.z * s, normal.y, normal.x * s + normal.z * c); vL = position; vRoof = aRoof; vSeed = aB.w;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
          #include <logdepthbuf_vertex>
        }`;
      const frag = `#include <common>
        #include <logdepthbuf_pars_fragment>
        uniform vec3 uCityAmb;
        varying vec3 vN; varying vec3 vL; varying float vRoof; varying float vSeed;
        void main(){
          #include <logdepthbuf_fragment>
          vec3 N = normalize(vN);
          vec3 warm = mix(vec3(1.0, 0.68, 0.36), vec3(1.0, 0.85, 0.6), vSeed);
          vec3 col;
          if (vRoof > 0.5) col = warm * 0.18 * (0.4 + 0.6 * (1.0 - vL.y / 5.0)) + uCityAmb;   // canvas roof glowing from inside
          else {
            // translucent walls, an open counter on the front, strings of bulbs under the eave
            float counter = step(abs(vL.x), 2.2) * step(0.9, vL.y) * step(vL.y, 2.2) * step(2.4, vL.z);
            float eave = step(2.35, vL.y) * step(0.5, fract(vL.x * 1.6 + vL.z * 1.6));
            col = warm * (0.25 + counter * 1.8 + eave * 2.5);
            if (abs(N.y) > 0.5) col = vec3(0.02);
          }
          gl_FragColor = vec4(col, 1.0);
        }`;
      const mesh = new THREE.Mesh(g, mk(vert, frag)); mesh.frustumCulled = false;
      group.add(mesh); api.parts.tents = mesh;
    }

    /* festoon strings between the lamp posts, fairy lights in the plaza and axis trees */
    {
      const P = [], C = [];
      const W = L.walk;
      for (let j = 0; j < W.n; j++) {
        const k = j / W.n * Math.PI * 2 + W.off, dx = Math.cos(k), dy = Math.sin(k);
        for (let r = W.r0; r < 520; r += W.step) for (const sd of [-1, 1]) {
          const ax = dx * r - dy * sd * W.side, ay = dy * r + dx * sd * W.side, bx = dx * (r + W.step) - dy * sd * W.side, by = dy * (r + W.step) + dx * sd * W.side;
          if (inLake(ax, ay, 3) || inLake(bx, by, 3)) continue;
          for (let i = 0; i < 14; i++) { const u = (i + 0.5) / 14; P.push(ax + (bx - ax) * u, 5.6 - Math.sin(Math.PI * u) * 1.0, -(ay + (by - ay) * u)); C.push(7, 5.2, 3.2, 0.2); }
        }
        // a canopy of strings crossing the walkway between the pairs
        for (let r = W.r0; r < 520; r += W.step * 2) {
          const ax = dx * r + dy * W.side, ay = dy * r - dx * W.side, bx = dx * (r + W.step) - dy * W.side, by = dy * (r + W.step) + dx * W.side;
          if (inLake(ax, ay, 3) || inLake(bx, by, 3)) continue;
          for (let i = 0; i < 16; i++) { const u = (i + 0.5) / 16; P.push(ax + (bx - ax) * u, 5.6 - Math.sin(Math.PI * u) * 1.4, -(ay + (by - ay) * u)); C.push(7, 5.2, 3.2, 0.2); }
        }
      }
      const R = KOB.rng(4);
      for (const t of (api.axisTrees || []).slice(0, 420)) {
        const cool = R() < 0.35, s = t[2];
        for (let i = 0; i < 22; i++) {
          const a = R() * 6.283, rr = Math.sqrt(R()) * 3.4 * s, hy = 4.2 * s + R() * 6 * s;
          P.push(t[0] + Math.cos(a) * rr, hy, -(t[1] + Math.sin(a) * rr));
          if (cool) C.push(3.2, 4.8, 8, 0.13); else C.push(8, 5.6, 3, 0.13);
        }
      }
      glowPts(P, C, null, 'festoon', true);
    }

    /* shuttle buses circling on the service road */
    {
      const n = 10;
      const box = new THREE.BoxGeometry(2.6, 3.2, 12); box.translate(0, 1.9, 0);
      const g = new THREE.InstancedBufferGeometry(); g.index = box.index;
      g.setAttribute('position', box.attributes.position); g.setAttribute('normal', box.attributes.normal);
      const aB = new Float32Array(n * 2); for (let i = 0; i < n; i++) aB.set([i / n * 6.283 + (i % 3) * 0.2, i % 2 ? 1 : -1], i * 2);
      g.setAttribute('aB', new THREE.InstancedBufferAttribute(aB, 2)); g.instanceCount = n;
      const RX = L.plaza[0] * (L.ring.e0 + L.ring.e1) / 2, RY = L.plaza[1] * (L.ring.e0 + L.ring.e1) / 2;
      const vert = `${commonVS} attribute vec2 aB; uniform float uTime; varying vec3 vN; varying vec3 vL; varying vec3 vW;
        void main(){
          float a = aB.x + uTime * 0.018 * aB.y;
          vec2 c = vec2(${f(RX)} * cos(a), ${f(RY)} * sin(a)) + vec2(-sin(a), cos(a)) * 2.6 * aB.y;
          vec2 tg = normalize(vec2(-${f(RX)} * sin(a), ${f(RY)} * cos(a))) * aB.y;
          float rot = atan(tg.x, -tg.y);
          float cs = cos(rot), sn = sin(rot);
          vec3 lp = position;
          vec3 p = vec3(lp.x * cs + lp.z * sn, lp.y, -lp.x * sn + lp.z * cs) + vec3(c.x, 0.0, -c.y);
          vN = vec3(normal.x * cs + normal.z * sn, normal.y, -normal.x * sn + normal.z * cs); vL = lp; vW = p;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
          #include <logdepthbuf_vertex>
        }`;
      const frag = `#include <common>
        #include <logdepthbuf_pars_fragment>
        uniform vec3 uCityAmb;
        varying vec3 vN; varying vec3 vL; varying vec3 vW;
        void main(){
          #include <logdepthbuf_fragment>
          vec3 N = normalize(vN);
          vec3 col = vec3(0.05, 0.05, 0.055) * (uCityAmb * 20.0 + 0.1);
          float side = step(abs(N.y), 0.5) * step(abs(vL.z), 5.6);
          float win = step(1.9, vL.y) * step(vL.y, 3.0) * step(0.18, fract(vL.z * 0.62)) * side;
          col += vec3(1.0, 0.86, 0.66) * win * 1.4;
          float front = step(5.95, vL.z) * step(vL.y, 1.1) * step(0.7, abs(vL.x));
          float back = step(vL.z, -5.95) * step(vL.y, 1.4) * step(0.8, abs(vL.x));
          col += vec3(1.0, 0.95, 0.85) * front * 8.0 + vec3(1.0, 0.05, 0.02) * back * 5.0;
          gl_FragColor = vec4(col, 1.0);
        }`;
      const mesh = new THREE.Mesh(g, mk(vert, frag)); mesh.frustumCulled = false;
      group.add(mesh); api.parts.buses = mesh;
    }

    /* an arched footbridge over the lake, its rails traced in light */
    {
      const by = -48, xc = lakeX(by), hw = lakeHW(by) + 7;
      const pos = [], top = [], idx = [];
      const N = 24;
      for (let i = 0; i <= N; i++) {
        const u = i / N, x = xc - hw + 2 * hw * u, y = 1.2 + 4.2 * Math.sin(Math.PI * u);
        for (const [dz, dy, tp] of [[-3, 0, 0], [3, 0, 0], [-3, -0.9, 0], [3, -0.9, 0], [-3, 1.1, 1], [3, 1.1, 1]]) { pos.push(x, y + dy, -by + dz); top.push(tp); }
      }
      for (let i = 0; i < N; i++) {
        const a = i * 6, b = a + 6;
        idx.push(a, b, a + 1, a + 1, b, b + 1);                  // deck top
        idx.push(a + 2, a + 3, b + 2, a + 3, b + 3, b + 2);      // underside
        idx.push(a, a + 2, b, a + 2, b + 2, b);                  // sides
        idx.push(a + 1, b + 1, a + 3, a + 3, b + 1, b + 3);
        idx.push(a, b, a + 4, a + 4, b, b + 4);                  // parapets
        idx.push(a + 1, a + 5, b + 1, a + 5, b + 5, b + 1);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aTop', new THREE.Float32BufferAttribute(top, 1)); g.setIndex(idx);
      g.computeVertexNormals();
      const vert = `${commonVS} attribute float aTop; varying vec3 vN; varying vec3 vW; varying float vY;
        void main(){ vN = normal; vW = position; vY = aTop; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
        #include <logdepthbuf_vertex>
        }`;
      const frag = `#include <common>
        #include <logdepthbuf_pars_fragment>
        uniform vec3 uPalA; uniform vec3 uPalB; uniform float uTime; uniform float uBeatPulse;
        varying vec3 vN; varying vec3 vW; varying float vY;
        void main(){
          #include <logdepthbuf_fragment>
          vec3 col = vec3(0.012, 0.012, 0.014);
          float rail = smoothstep(0.8, 0.98, vY);
          float run = 0.5 + 0.5 * sin(vW.x * 0.35 - uTime * 3.0);
          col += mix(uPalA, uPalB, run) * rail * (1.2 + uBeatPulse);
          gl_FragColor = vec4(col, 1.0);
        }`;
      const mesh = new THREE.Mesh(g, mk(vert, frag, {}, { side: THREE.DoubleSide })); mesh.frustumCulled = false; mesh.layers.enable(3);
      group.add(mesh); api.parts.bridge = mesh;
    }


    /* ═══ light signs: as many as you like, each one 3D letters with its own words, look and place ═══ */
    const MW = 1536, MH = 288;
    const drawMaskOn = (mc, text) => {
      const g = mc.getContext('2d');
      g.globalCompositeOperation = 'source-over'; g.fillStyle = '#000'; g.fillRect(0, 0, MW, MH);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      let fs = 230; g.font = `900 ${fs}px ${fontFor(text)}`;
      fs = Math.min(230, fs * (MW * 0.94) / Math.max(1, g.measureText(text).width));
      g.font = `900 ${fs}px ${fontFor(text)}`;
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = '#ff0000'; g.fillText(text, MW / 2, MH / 2 + fs * 0.04);
      g.lineWidth = Math.max(3, fs * 0.035); g.strokeStyle = '#00ff00'; g.lineJoin = 'round'; g.strokeText(text, MW / 2, MH / 2 + fs * 0.04);
      // how much of the width the words use (the sign's frame and poles follow it)
      return Math.min(0.94, g.measureText(text).width / MW + 0.04);
    };
    const signVert = `${commonVS} attribute float aL; uniform vec3 uOrigin; uniform vec3 uFace; uniform vec2 uSize;
      varying vec2 vUv; varying float vL; varying vec3 vW;
      void main(){
        vec3 rt = normalize(cross(vec3(0.0, 1.0, 0.0), uFace));
        vec3 p = uOrigin + rt * position.x * uSize.x + vec3(0.0, position.y * uSize.y, 0.0) - uFace * aL * uSize.y * 0.014;
        vUv = vec2(position.x + 0.5, position.y); vL = aL; vW = p;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        #include <logdepthbuf_vertex>
      }`;
    const signFrag = `#include <common>
      #include <logdepthbuf_pars_fragment>
      uniform sampler2D uMask; uniform vec3 uSignCol; uniform vec3 uSignCol2; uniform vec4 uSign; uniform float uSignOff; uniform float uTime; uniform float uBeatPulse;
      varying vec2 vUv; varying float vL; varying vec3 vW;
      vec3 hue(float h){ return clamp(abs(fract(h + vec3(0.0, 0.667, 0.333)) * 6.0 - 3.0) - 1.0, 0.0, 1.0); }
      float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      void main(){
        #include <logdepthbuf_fragment>
        vec4 m = texture2D(uMask, vUv);
        if (m.r < 0.5 || uSign.x <= 0.0) discard;
        // power: wipe on from the left with a neon flicker, or fade out before a change of words
        float age = uTime - uSign.w;
        float wipe = smoothstep(vUv.x - 0.06, vUv.x, age / 1.3);
        float flick = age < 1.8 ? step(0.25, h21(vec2(floor(uTime * 24.0), floor(vUv.x * 9.0)))) : 1.0;
        float off = 1.0 - smoothstep(0.0, 0.45, uTime - uSignOff) * step(uSign.w, uSignOff);
        float pw = wipe * mix(0.4, 1.0, flick) * off;
        vec3 col = mix(uSignCol, uSignCol2, smoothstep(0.1, 0.9, vUv.y));
        float an = uSign.z;
        if (an > 2.5) col = hue(vUv.x * 0.7 - uTime * 0.18) * 1.1;
        float k = 1.0;
        if (an > 0.5 && an < 1.5) k = 0.35 + 0.65 * step(0.45, fract(vUv.x * 14.0 - uTime * 1.6));
        else if (an > 1.5 && an < 2.5) k = 0.45 + 0.4 * (0.5 + 0.5 * sin(uTime * 2.6)) + 0.5 * uBeatPulse;
        vec3 E;
        if (vL > 0.5) E = col * 0.05 * pw + vec3(0.01);
        else if (uSign.y < 0.5) E = col * (0.35 + m.g * 4.5) * k * pw;
        else if (uSign.y < 1.5) {
          vec2 cells = vec2(170.0, 32.0);
          vec2 cl = vUv * cells; vec2 id = floor(cl);
          float inside = step(0.5, texture2D(uMask, (id + 0.5) / cells).r);
          float d = length(fract(cl) - 0.5);
          float fw = length(fwidth(cl));
          float bulb = mix(smoothstep(0.36, 0.18, d), 0.45, smoothstep(0.4, 1.0, fw)) * inside;
          float chase = an > 0.5 && an < 1.5 ? 0.25 + 0.75 * step(0.5, fract((id.x + id.y) / 6.0 - uTime * 3.0)) : k;
          E = (mix(col, vec3(1.0, 0.92, 0.75), 0.45) * bulb * 4.0 * chase + col * 0.04) * pw;
        } else {
          vec2 cells = vec2(340.0, 64.0);
          vec2 cl = vUv * cells; float d = length(fract(cl) - 0.5);
          float fw = length(fwidth(cl));
          float px = mix(smoothstep(0.45, 0.3, d), 0.6, smoothstep(0.4, 1.0, fw));
          vec3 grad = mix(uSignCol, uSignCol2, 0.5 + 0.5 * sin(vUv.x * 8.0 - uTime * 2.0));
          if (an > 2.5) grad = col;
          E = grad * px * 3.0 * k * pw;
        }
        gl_FragColor = vec4(E, 1.0);
      }`;
    const darkVert = postVert.replace('attribute vec3 aP; attribute float aHgt;', 'vec3 aP = vec3(0.0); float aHgt = 1.0;').replace('vec3 p = position; p.y = position.y < 0.5 ? 0.0 : position.y + aHgt - 1.0;', 'vec3 p = (modelMatrix * vec4(position, 1.0)).xyz;').replace('vN = normal;', 'vN = normalize(mat3(modelMatrix) * normal);');
    const darkMat = mk(darkVert, postFrag);
    const layerGeo = (() => {
      const g = new THREE.InstancedBufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3)); g.setIndex([0, 1, 2, 0, 2, 3]);
      const aL = new Float32Array(9); for (let i = 0; i < 9; i++) aL[i] = i;
      g.setAttribute('aL', new THREE.InstancedBufferAttribute(aL, 1)); g.instanceCount = 9;
      return g;
    })();
    const unitBox = new THREE.BoxGeometry(1, 1, 1); unitBox.translate(0, 0.5, 0);
    const signs = new Map();
    api.signs = signs;
    // o: { text, color, color2, style, anim, on, x, y (Blender), height (letter metres), lift (m above ground), angle (deg, facing) }
    api.addSign = function (id, o, t) {
      const mc = document.createElement('canvas'); mc.width = MW; mc.height = MH;
      const tex = new THREE.CanvasTexture(mc); tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.anisotropy = 8;
      const SU = {
        uMask: { value: tex }, uSignCol: { value: new V3(1, 0.62, 0.22) }, uSignCol2: { value: new V3(1, 0.2, 0.08) },
        uSign: { value: new THREE.Vector4(1, 1, 1, t || 0) }, uSignOff: { value: -10 },
        uOrigin: { value: new V3() }, uFace: { value: new V3(1, 0, 0) }, uSize: { value: new THREE.Vector2(40, 8) },
      };
      const mesh = new THREE.Mesh(layerGeo, mk(signVert, signFrag, SU, { side: THREE.DoubleSide }));
      mesh.frustumCulled = false; mesh.layers.enable(3);
      const frame = new THREE.Group();
      const base = new THREE.Mesh(unitBox, darkMat), poleL = new THREE.Mesh(unitBox, darkMat), poleR = new THREE.Mesh(unitBox, darkMat);
      frame.add(base, poleL, poleR);
      group.add(mesh, frame);
      const sg = { id, mesh, frame, base, poleL, poleR, SU, tex, mc, o: {}, fill: 0.9, pending: null };
      signs.set(id, sg);
      api.updateSign(id, Object.assign({ text: '万兽之王', color: [1, 0.62, 0.22], style: 1, anim: 1, on: true, x: 226, y: -150, height: 9.6, lift: 0.7, angle: null }, o), t, true);
      return sg;
    };
    api.updateSign = function (id, o, t, instant) {
      const sg = signs.get(id); if (!sg) return;
      const prev = sg.o, SU = sg.SU;
      Object.assign(sg.o, o);
      const c = sg.o.color; SU.uSignCol.value.set(c[0], c[1], c[2]);
      const c2 = sg.o.color2 || [c[0], c[1] * 0.4, c[2] * 0.4]; SU.uSignCol2.value.set(c2[0], c2[1], c2[2]);
      SU.uSign.value.x = sg.o.on ? 1 : 0; SU.uSign.value.y = sg.o.style; SU.uSign.value.z = sg.o.anim;
      if ('text' in o) {
        if (instant) { sg.fill = drawMaskOn(sg.mc, sg.o.text); sg.tex.needsUpdate = true; SU.uSign.value.w = t || 0; sg.shown = sg.o.text; }
        else if (sg.o.text !== sg.shown) { SU.uSignOff.value = t; sg.pending = { text: sg.o.text, at: t + 0.5 }; }
      }
      // placement: facing angle (Blender degrees, 0 = +X) or towards the main exterior camera
      const ang = sg.o.angle == null ? Math.atan2(-236 - sg.o.y, 352 - sg.o.x) : sg.o.angle * Math.PI / 180;
      const fx = Math.cos(ang), fy = Math.sin(ang);
      const H = sg.o.height * 1.2, Wd = H * MW / MH;
      SU.uOrigin.value.set(sg.o.x, sg.o.lift, -sg.o.y); SU.uFace.value.set(fx, 0, -fy); SU.uSize.value.set(Wd, H);
      sg.frame.position.set(sg.o.x, 0, -sg.o.y); sg.frame.rotation.set(0, Math.atan2(fx, -fy), 0);
      const fw = Wd * sg.fill;
      sg.base.scale.set(fw, 0.6, H * 0.18); sg.base.position.set(0, Math.max(0, sg.o.lift - 0.6), -H * 0.05);
      const tall = sg.o.lift > 1.5;
      for (const [pl, sx] of [[sg.poleL, -1], [sg.poleR, 1]]) { pl.visible = tall; pl.scale.set(0.7, Math.max(0.1, sg.o.lift), 0.7); pl.position.set(sx * fw * 0.38, 0, -H * 0.05); }
      sg.frame.visible = sg.o.on;
    };
    api.removeSign = function (id) {
      const sg = signs.get(id); if (!sg) return;
      group.remove(sg.mesh, sg.frame); sg.mesh.material.dispose(); sg.tex.dispose(); signs.delete(id);
    };

    /* the wall ticker and the banner towers / fan screen share their own line of words */
    const tickCanvas = document.createElement('canvas'); tickCanvas.width = MW; tickCanvas.height = MH;
    const tickTex = new THREE.CanvasTexture(tickCanvas);
    drawMaskOn(tickCanvas, '万兽之王 · 薛之谦'); tickTex.needsUpdate = true;
    api.signMask = tickTex;
    let tickShown = '万兽之王 · 薛之谦', bannerShown = '万兽之王', screenShown = '万兽之王';
    api.ticker = { on: true, text: '万兽之王 · 薛之谦', banners: false, screen: false };
    api.setTicker = function (o) { Object.assign(api.ticker, o); api._ticker = api.ticker.on; };
    api._ticker = true;
    api.signText = () => { const f = signs.values().next().value; return f ? f.o.text : ''; };

    api.setScreen = function (title, art, artOn) { if (art) api.screenU.uArt.value = art; api.screenU.uArtOn.value = art ? artOn : 0; };

    /* tier control + per-frame update */
    api.setTier = function (Q) {
      api.parts.trees.geometry.instanceCount = Math.round(api.treeCount * Q.trees);
      api.parts.fans.geometry.setDrawRange(0, Math.round(api.parts.fans.geometry.attributes.position.count * Q.fans));
    };
    // housekeeping: deferred text swaps and texture redraws, only when something changed
    api.tick = function (t) {
      for (const sg of signs.values()) {
        const pt = sg.pending;
        if (pt && t >= pt.at) {
          sg.fill = drawMaskOn(sg.mc, pt.text); sg.tex.needsUpdate = true; sg.shown = pt.text;
          sg.SU.uSign.value.w = t; sg.SU.uSignOff.value = -10; sg.pending = null;
          api.updateSign(sg.id, {}, t);
        }
      }
      const T = api.ticker;
      if (T.text !== tickShown) { tickShown = T.text; drawMaskOn(tickCanvas, T.text); tickTex.needsUpdate = true; }
      const bt = T.banners ? T.text : '万兽之王', st = T.screen ? T.text : '万兽之王';
      if (bt !== bannerShown) { bannerShown = bt; api.redrawBanners(bt); }
      if (st !== screenShown) { screenShown = st; api.redrawCard(st); }
    };
    api.update = function (S, camPos) {
      // nothing outside is visible from inside the bowl below the roof
      const inside = Math.hypot(camPos.x / 158, camPos.z / 176) < 1 && camPos.y < 62;
      group.visible = !inside;
      return !inside;
    };
    return api;
  };

  function mergeGeos(THREE, list) {
    let nv = 0, ni = 0;
    for (const g of list) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), idx = new Uint32Array(ni);
    const extra = {};
    let ov = 0, oi = 0;
    for (const g of list) {
      pos.set(g.attributes.position.array, ov * 3);
      if (g.attributes.normal) nor.set(g.attributes.normal.array, ov * 3);
      for (const k in g.attributes) {
        if (k === 'position' || k === 'normal' || k === 'uv') continue;
        const a = g.attributes[k];
        if (!extra[k]) extra[k] = { size: a.itemSize, data: new Float32Array(nv * a.itemSize) };
        extra[k].data.set(a.array, ov * a.itemSize);
      }
      if (g.index) for (let i = 0; i < g.index.count; i++) idx[oi + i] = g.index.array[i] + ov;
      else for (let i = 0; i < g.attributes.position.count; i++) idx[oi + i] = i + ov;
      oi += g.index ? g.index.count : g.attributes.position.count;
      ov += g.attributes.position.count;
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    for (const k in extra) out.setAttribute(k, new THREE.BufferAttribute(extra[k].data, extra[k].size));
    out.setIndex(new THREE.BufferAttribute(idx, 1));
    return out;
  }
  KOB.mergeGeos = mergeGeos;
  function mergeGeoUV(THREE, list) {
    const out = mergeGeos(THREE, list);
    const n = out.attributes.position.count, uv = new Float32Array(n * 2);
    let o = 0; for (const g of list) { if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2); o += g.attributes.position.count; }
    out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return out;
  }
})();
