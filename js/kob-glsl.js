(window.KOB_FILES = window.KOB_FILES || {}).glsl = '12';
/* ═══════════════════════════════════════════════════════════════════
   KING OF BEASTS — GLSL library
   All world-space maths is in three.js / glTF space (Y up).
   Blender (x, y, z)  →  three (x, z, -y)
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const KOB = (window.KOB = window.KOB || {});
  const G = (KOB.GLSL = {});

  /* ── noise / hash ─────────────────────────────────────────────────── */
  G.noise = /* glsl */`
  float kSq(float x){ return x * x; }
  float kHash11(float p){ p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
  float kHash21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  float kHash31(vec3 p3){ p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
  float kNoise3(vec3 x){
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    float n000 = kHash31(i), n100 = kHash31(i + vec3(1,0,0)), n010 = kHash31(i + vec3(0,1,0)), n110 = kHash31(i + vec3(1,1,0));
    float n001 = kHash31(i + vec3(0,0,1)), n101 = kHash31(i + vec3(1,0,1)), n011 = kHash31(i + vec3(0,1,1)), n111 = kHash31(i + vec3(1,1,1));
    return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y), mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);
  }
  float kNoise2(vec2 x){
    vec2 i = floor(x); vec2 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(kHash21(i), kHash21(i + vec2(1,0)), f.x), mix(kHash21(i + vec2(0,1)), kHash21(i + vec2(1,1)), f.x), f.y);
  }
  float kFbm3(vec3 p){ float a = .5, s = 0.0; for (int i = 0; i < 3; i++){ s += a * kNoise3(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= .5; } return s / .875; }
  float kFbm2(vec2 p){ float a = .5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * kNoise2(p); p = p * 2.07 + vec2(5.3, 1.9); a *= .5; } return s / .9375; }
  vec3 kBlackbody(float t){ // 0..1 → ember red … white-yellow (artistic blackbody ramp, linear)
    t = clamp(t, 0.0, 1.0);
    vec3 c = mix(vec3(0.35, 0.02, 0.0), vec3(1.0, 0.22, 0.02), smoothstep(0.0, 0.35, t));
    c = mix(c, vec3(1.0, 0.62, 0.16), smoothstep(0.3, 0.65, t));
    c = mix(c, vec3(1.0, 0.92, 0.7), smoothstep(0.6, 1.0, t));
    return c;
  }
  `;

  /* ── baked noise: 2 texture taps replace ~24 hashes of procedural fbm ── */
  G.tnoise = /* glsl */`
  uniform sampler2D uNoiseTex;
  float tn2(vec2 p){ return texture2D(uNoiseTex, p).r; }
  float tn3(vec3 p){
    return texture2D(uNoiseTex, p.xz * 0.25 + vec2(p.y * 0.17, -p.y * 0.11)).r * 0.6
         + texture2D(uNoiseTex, p.zy * 0.31 + vec2(0.37, p.x * 0.07)).g * 0.4;
  }
  `;

  /* ── shared show uniforms (declared once per program) ────────────── */
  G.showUniforms = /* glsl */`
  uniform float uTime;        // fx clock (monotonic)
  uniform float uBeatPulse;   // 1 on the beat, decays
  uniform float uBar;         // bar phase 0..1
  uniform vec3  uPalA; uniform vec3 uPalB; uniform vec3 uPalC;
  uniform vec3  uLedAvg;      // average radiance of the main LED box
  uniform float uHaze;
  `;

  /* ── crowd light field (light sticks + phones) ───────────────────── */
  G.crowd = /* glsl */`
  uniform vec3  uCrowdA; uniform vec3 uCrowdB; uniform vec3 uCrowdC;
  uniform vec4  uCrowdW;      // x wave, y stage bloom, z sparkle, w call/response
  uniform float uCrowdLevel;  // master
  uniform float uCrowdSurge;
  uniform float uWaveSpeed;
  uniform vec4  uQuad;        // NE SE SW NW tower answer
  uniform vec3  uQuadCol[4];
  uniform float uPhones;
  // p: three world position. r: per-light random 0..1. returns colour, writes brightness
  vec3 crowdField(vec3 p, float r, out float bright){
    float ang = atan(-p.z, p.x);           // Blender azimuth
    float rad = length(p.xz);
    vec3 col = uCrowdA;
    float b = 0.55 + 0.75 * uBeatPulse * (0.55 + 0.45 * r);
    // waves rolling round the bowl (two crests, each section lights in turn)
    float w = sin(ang * 2.0 - uTime * uWaveSpeed + r * 0.5);
    w = smoothstep(0.35, 1.0, w);
    col = mix(col, uCrowdB, w * uCrowdW.x);
    b += w * uCrowdW.x * 1.6;
    // colour bloom surging outward from the stage
    float ring = fract(rad * 0.018 - uTime * 0.42);
    float bl = smoothstep(0.0, 0.06, ring) * smoothstep(0.42, 0.06, ring);
    col = mix(col, uCrowdC, bl * uCrowdW.y);
    b += bl * uCrowdW.y * 2.0;
    // sparkle
    float tw = step(0.9, kHash11(floor(uTime * 7.0 + r * 113.0) + r * 17.0));
    b += tw * uCrowdW.z * 2.2;
    col = mix(col, vec3(1.0, 0.95, 0.9), tw * uCrowdW.z * 0.6);
    // call & response: east/west halves trade on the bar
    float side = step(0.0, p.x);
    float cr = mix(side, 1.0 - side, step(0.5, uBar));
    b *= mix(1.0, 0.25 + 1.5 * cr, uCrowdW.w);
    // quadrants answering the corner beasts
    float bx = p.x, by = -p.z;
    vec4 qw = vec4(step(0.0, bx) * step(0.0, by), step(0.0, bx) * step(by, 0.0), step(bx, 0.0) * step(by, 0.0), step(bx, 0.0) * step(0.0, by));
    vec4 qa = qw * uQuad;
    float q = qa.x + qa.y + qa.z + qa.w;
    vec3 qc = uQuadCol[0] * qa.x + uQuadCol[1] * qa.y + uQuadCol[2] * qa.z + uQuadCol[3] * qa.w;
    col = mix(col, qc / max(q, 1e-3), clamp(q, 0.0, 1.0));
    b += q * 1.2;
    // surge = controlled chaos
    b *= 1.0 + uCrowdSurge * (0.7 + 0.9 * sin(uTime * 8.0 + r * 40.0 + ang * 3.0));
    // organic per-light variation
    b *= 0.6 + 0.8 * fract(r * 7.13);
    bright = b * uCrowdLevel;
    return col;
  }
  `;

  /* ── analytic AO + exterior architecture light, injected in PBR ───── */
  G.stdPars = /* glsl */`
  varying vec3 vKW;
  uniform float uKAO;
  float kBoxSDF(vec2 p, vec2 b){ vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
  float kobAO(vec3 p, vec3 n){
    float ao = 1.0;
    // ground contact around the stage deck (deck x±33, z±49, top 3.2)
    float dDeck = kBoxSDF(p.xz, vec2(33.0, 49.0));
    if (p.y < 1.2) ao *= mix(0.42, 1.0, smoothstep(0.0, 7.0, max(dDeck, 0.0)) + step(dDeck, -0.5));
    // deck skirt / stair foot darkening
    if (dDeck < 0.6 && dDeck > -0.6 && p.y < 3.4) ao *= mix(0.55, 1.0, smoothstep(0.0, 2.6, p.y));
    // under the main LED box (x±19.5 z±32.5, bottom 13.6)
    float dBox = kBoxSDF(p.xz, vec2(19.5, 32.5));
    if (p.y < 13.6) ao *= mix(0.5, 1.0, smoothstep(-4.0, 10.0, dBox) + smoothstep(13.6, 8.0, p.y) * 0.35);
    // under the canopy (x±28 z±40, 34 → 41.6) and inside the rig
    float dCan = kBoxSDF(p.xz, vec2(28.0, 40.0));
    if (p.y > 33.5 && p.y < 41.8 && dCan < 1.5) ao *= mix(0.45, 1.0, clamp(n.y * 0.5 + 0.5, 0.0, 1.0) * 0.6 + smoothstep(-2.0, 1.5, dCan) * 0.4);
    // column feet (±24, ±38) and corner tower feet (±42, ±54)
    float dc = length(abs(p.xz) - vec2(24.0, 38.0));
    if (p.y < 6.0) ao *= mix(0.55, 1.0, smoothstep(0.8, 4.0, dc));
    float dt = kBoxSDF(abs(p.xz) - vec2(42.0, 54.0), vec2(7.0, 7.0));
    if (p.y < 2.0) ao *= mix(0.55, 1.0, smoothstep(0.0, 4.0, dt));
    // statue plinths
    float dpl = kBoxSDF(abs(p.xz) - vec2(26.0, 99.0), vec2(9.0, 6.0));
    if (p.y < 8.0 && p.y > 6.0) ao *= mix(0.6, 1.0, smoothstep(0.0, 2.5, -dpl + 2.5));
    // bowl under the roof: less sky, more occlusion
    float e = length(p.xz / vec2(67.6, 98.2));
    if (e > 1.0 && p.y < 60.0) ao *= mix(1.0, 0.62, smoothstep(1.0, 1.5, e));
    // front wall crevice of the bowl
    float ei = length(p.xz / vec2(61.5, 106.0));
    if (p.y < 2.5) ao *= mix(0.6, 1.0, smoothstep(0.0, 0.08, abs(ei - 1.0)));
    return mix(1.0, clamp(ao, 0.25, 1.0), uKAO);
  }
  `;

  // One loop for all show lights (towers, fireworks, flames, strobes, follow / hunt / statue / throne
  // spots) + an analytic area light for the four LED box faces. Diffuse Lambert + normalised Blinn
  // lobe, range-culled per fragment – a fraction of the cost of three.js' per-light GGX / LTC path.
  G.kobLights = /* glsl */`
  #define KL_MAX 22
  uniform vec4 uKLPos[KL_MAX];   // xyz, range (m)
  uniform vec4 uKLCol[KL_MAX];   // rgb * candela, cos(outer) (< -1.5 = point light)
  uniform vec4 uKLDir[KL_MAX];   // spot direction, cos(inner)
  uniform int  uKLN;
  uniform vec3 uBoxL;            // LED box radiance
  float kShin(float r){ float a = max(r * r, 0.03); return clamp(2.0 / (a * a) - 2.0, 2.0, 900.0); }
  void kobFace(vec3 p, vec3 N, vec3 R, float shin, vec3 c, vec3 nf, vec3 u, vec3 v, vec2 he, inout float E, inout float S){
    vec3 d = p - c;
    if (dot(d, nf) <= 0.05) return;
    vec3 q = c + u * clamp(dot(d, u), -he.x, he.x) + v * clamp(dot(d, v), -he.y, he.y);
    vec3 lv = q - p; float d2 = max(dot(lv, lv), 1e-3); vec3 l = lv * inversesqrt(d2);
    float A = 4.0 * he.x * he.y;
    float om = A * max(-dot(nf, l), 0.0) / (d2 + A * 0.3183);
    E += om * max(dot(N, l), 0.0);
    float den = dot(R, nf);
    if (den < -1e-3) {
      vec3 e = p + R * (dot(c - p, nf) / den) - c;
      vec3 qs = c + u * clamp(dot(e, u), -he.x, he.x) + v * clamp(dot(e, v), -he.y, he.y);
      vec3 ls = normalize(qs - p);
      S += min(pow(max(dot(R, ls), 0.0), shin) * (shin + 2.0) * 0.159 * om, 1.0) * max(dot(N, ls), 0.0);
    }
  }
  void kobLights(vec3 p, vec3 N, vec3 V, vec3 albedo, vec3 f0, float rough, inout vec3 dd, inout vec3 ds){
    float shin = kShin(rough);
    vec3 R = reflect(-V, N);
    float lb = uBoxL.r + uBoxL.g + uBoxL.b;
    if (lb > 1e-4) {
      float E = 0.0, S = 0.0;
      kobFace(p, N, R, shin, vec3(19.6, 23.75, 0.0), vec3(1.0, 0.0, 0.0), vec3(0.0, 0.0, 1.0), vec3(0.0, 1.0, 0.0), vec2(32.5, 10.15), E, S);
      kobFace(p, N, R, shin, vec3(-19.6, 23.75, 0.0), vec3(-1.0, 0.0, 0.0), vec3(0.0, 0.0, 1.0), vec3(0.0, 1.0, 0.0), vec2(32.5, 10.15), E, S);
      kobFace(p, N, R, shin, vec3(0.0, 23.75, 32.6), vec3(0.0, 0.0, 1.0), vec3(1.0, 0.0, 0.0), vec3(0.0, 1.0, 0.0), vec2(19.5, 10.15), E, S);
      kobFace(p, N, R, shin, vec3(0.0, 23.75, -32.6), vec3(0.0, 0.0, -1.0), vec3(1.0, 0.0, 0.0), vec3(0.0, 1.0, 0.0), vec2(19.5, 10.15), E, S);
      dd += uBoxL * E * albedo * 0.3183;
      ds += uBoxL * S * f0;
    }
    float norm = (shin + 8.0) * 0.0398;
    for (int i = 0; i < KL_MAX; i++){
      if (i >= uKLN) break;
      vec4 lp = uKLPos[i];
      vec3 lv = lp.xyz - p;
      float d2 = dot(lv, lv);
      if (d2 > lp.w * lp.w) continue;
      vec3 l = lv * inversesqrt(d2);
      float ndl = dot(N, l);
      if (ndl <= 0.0) continue;
      vec4 lc = uKLCol[i];
      float w = 1.0 - d2 / (lp.w * lp.w);
      float att = w * w / (d2 + 1.0);
      if (lc.w > -1.5) { vec4 sd = uKLDir[i]; att *= smoothstep(lc.w, sd.w, dot(-l, sd.xyz)); }
      vec3 rad = lc.rgb * att * ndl;
      dd += rad * albedo * 0.3183;
      ds += rad * f0 * pow(max(dot(N, normalize(l + V)), 0.0), shin) * norm;
    }
  }
  `;

  // exterior "architecture" light: wall-washers at the plaza uplighting the steel shell
  G.uplight = /* glsl */`
  uniform vec3 uUplight;
  vec3 kobUplight(vec3 p, vec3 n){
    float e = length(p.xz / vec2(158.2, 176.9));
    float w = smoothstep(0.78, 0.97, e);
    if (w <= 0.0) return vec3(0.0);
    vec3 outw = normalize(vec3(p.x, 0.0, p.z));
    vec3 L = normalize(outw * 0.8 + vec3(0.0, -0.6, 0.0));
    float nl = max(dot(n, L), 0.0) + 0.15 * max(dot(n, outw), 0.0);
    float h = clamp(1.0 - p.y / 95.0, 0.0, 1.0);
    // cool silver wash from the plaza floods + warm red bounce from the glowing bowl wall behind
    float inward = max(dot(n, -outw), 0.0);
    vec3 red = vec3(0.55, 0.05, 0.02) * inward * smoothstep(0.0, 20.0, p.y) * (1.0 - smoothstep(45.0, 70.0, p.y));
    float flick = 0.85 + 0.15 * sin(atan(p.z, p.x) * 24.0);
    return (uUplight * nl * (0.18 + h * h * h * 1.6) * flick + red * 0.6) * w;
  }
  `;

  /* ── LED content: main box ───────────────────────────────────────── */
  G.ledBox = /* glsl */`
  uniform float uLedLevel;    // master radiance
  uniform float uIgnite;      // 0 → 1.15 floor-to-roof ignition sweep
  uniform float uSceneA; uniform float uSceneB; uniform float uSceneMix;
  uniform float uStrobe;      // 0..1 white flash
  uniform float uFace;        // 0 front 1 back 2 ends
  uniform sampler2D uTitleTex; uniform float uTitleOn;
  uniform vec2  uFaceSize;    // metres
  uniform float uStandby;     // pre-ignition breathing level
  uniform sampler2D uBeastTex; uniform vec3 uBeastCol;
  vec3 kPal(float x){ x = fract(x); return x < 0.5 ? mix(uPalA, uPalB, x * 2.0) : mix(uPalB, uPalA, x * 2.0 - 1.0); }

  vec3 ledScene(float s, vec2 uv, vec2 m, vec3 art){
    float t = uTime;
    vec2 c = m - uFaceSize * 0.5;
    if (s < 0.5) { // standby: slow embers breathing
      float n = kFbm2(m * 0.08 + vec2(0.0, -t * 0.25));
      return uPalA * pow(n, 3.0) * 0.6;
    }
    if (s < 1.5) { // waves
      float y = uv.y + 0.08 * sin(m.x * 0.11 + t * 1.6) + 0.05 * sin(m.x * 0.27 - t * 2.3);
      float ph = sin(y * 26.0 - t * 4.0) * 0.5 + 0.5;
      float glow = ph * ph * ph;
      float line = pow(ph, 14.0);
      float fine = pow(sin(y * 78.0 - t * 6.0) * 0.5 + 0.5, 10.0) * 0.35;
      vec3 col = kPal(uv.x * 0.6 + t * 0.07 + y * 0.4);
      return col * (0.03 + glow * 0.32 + line * 1.5 + fine) + uPalC * line * 0.5 * uBeatPulse;
    }
    if (s < 2.5) { // rank: chevrons climbing + equaliser columns
      float chev = fract((m.y - abs(c.x) * 0.55) * 0.09 - t * 0.9);
      float ch = smoothstep(0.0, 0.05, chev) * smoothstep(0.32, 0.22, chev);
      float col_i = floor(m.x / 2.4);
      float h = 0.25 + 0.75 * kNoise2(vec2(col_i * 0.7, t * 2.2)) * (0.6 + 0.4 * uBeatPulse);
      float eq = step(uv.y, h) * step(0.18, fract(m.x / 2.4)) * step(0.25, fract(m.y / 0.9));
      return uPalB * ch * 1.1 + mix(uPalA, uPalB, uv.y) * eq * 0.6;
    }
    if (s < 3.5) { // pulses: rings from centre on the beat
      float r = length(c * vec2(1.0, 1.25));
      float ph = fract(t * 2.133);
      float ring = exp(-kSq((r - ph * 48.0) / 0.9)) + 0.6 * exp(-kSq((r - fract(ph + 0.5) * 48.0) / 0.6));
      float halo = exp(-kSq((r - ph * 48.0) / 4.0)) * 0.18;
      float grid = step(0.9, fract(m.x / 1.2)) + step(0.9, fract(m.y / 1.2));
      return mix(uPalA, uPalB, smoothstep(0.0, 40.0, r)) * (ring * 1.5 + halo) + uPalA * grid * 0.05 + uPalC * exp(-r * 0.45) * uBeatPulse * 0.7;
    }
    if (s < 4.5) { // beast artwork, graded + scanned
      float scan = 0.85 + 0.15 * sin(m.y * 3.0 - t * 12.0);
      float gl = step(0.985, kHash11(floor(m.y * 1.5) + floor(t * 9.0)));
      vec3 a = art * scan;
      a = mix(a, a * uPalA * 2.2, 0.35);
      return a * 1.15 + gl * uPalC * 0.8;
    }
    if (s < 5.5) { // title 万兽之王 burning
      vec2 tuv = (uv - 0.5) * vec2(uFaceSize.x / uFaceSize.y / 3.6, 1.0) * 1.15 + 0.5;
      float txt = 0.0;
      if (tuv.x > 0.0 && tuv.x < 1.0 && tuv.y > 0.0 && tuv.y < 1.0) txt = texture2D(uTitleTex, vec2(tuv.y, 1.0 - tuv.x)).a;
      float heat = kFbm2(m * 0.12 + vec2(0.0, -t * 1.4));
      vec3 fire = kBlackbody(0.35 + heat * 0.8);
      float glow = kFbm2(m * 0.05 + vec2(t * 0.1, -t * 0.6));
      return fire * txt * 1.8 + kBlackbody(glow * 0.6) * 0.25 * (1.0 - txt);
    }
    if (s < 6.5) { // the beast eye
      vec2 e = c / uFaceSize.y;
      float lid = 0.36 * (0.82 + 0.18 * sin(t * 0.7));
      float almond = smoothstep(0.02, -0.02, abs(e.y) - lid * (1.0 - kSq(abs(e.x) / 0.95)));
      float r = length(e * vec2(1.0, 1.0));
      float iris = smoothstep(0.34, 0.3, r);
      float slit = smoothstep(0.03, 0.0, abs(e.x) - 0.035 * (1.0 + uBeatPulse));
      float fib = 0.6 + 0.4 * sin(atan(e.y, e.x) * 40.0 + kNoise2(e * 20.0) * 4.0);
      vec3 ic = mix(uPalB, uPalA, r / 0.34) * fib * 1.6;
      return almond * (iris * (1.0 - slit) * ic + (1.0 - iris) * vec3(0.05, 0.03, 0.02)) + (1.0 - almond) * uPalA * 0.04;
    }
    if (s > 7.5) { // 8: beast gallery – hero portrait centre, a rank of smaller copies either side
      float aspA = 0.68;
      float hw = aspA * uFaceSize.y * 0.5;
      float cx = m.x - uFaceSize.x * 0.5;
      vec3 col = vec3(0.0);
      if (abs(cx) < hw) {
        vec2 a = vec2(cx / (2.0 * hw) + 0.5, uv.y);
        float scan = 0.88 + 0.12 * sin(m.y * 2.5 - t * 9.0);
        col = texture2D(uBeastTex, a).rgb * 1.25 * scan;
        float frame = smoothstep(0.03, 0.0, min(a.x, 1.0 - a.x));
        col += uBeastCol * frame * 1.5;
      } else {
        float tw = aspA * uFaceSize.y * 0.5;
        float k = floor((abs(cx) - hw) / tw);
        vec2 a = vec2(fract((abs(cx) - hw) / tw), fract(uv.y * 2.0));
        float dim = exp(-k * 0.45) * (0.35 + 0.65 * step(0.5, fract(k * 0.5 + t * 0.533)));
        col = texture2D(uBeastTex, a).rgb * dim * 0.7 + uBeastCol * 0.04;
        col *= smoothstep(0.0, 0.04, min(min(a.x, 1.0 - a.x), min(a.y, 1.0 - a.y)));
      }
      return col;
    }
    // 7: strobe chase – white bars flicking across on the 16ths (never a flat white wall)
    float bar = floor(m.x / 3.0);
    float on16 = step(0.55, kHash11(bar * 7.3 + floor(t * 8.533)));
    float fx = fract(m.x / 3.0);
    float core = exp(-kSq((fx - 0.5) * 9.0));
    float shaft = exp(-kSq((fx - 0.5) * 3.2)) * (0.6 + 0.4 * sin(uv.y * 3.14159));
    return uPalA * 0.06 + on16 * (vec3(1.0, 0.95, 0.88) * core * 0.9 + mix(uPalA, uPalB, uv.y) * shaft * 0.5);
  }

  vec3 ledBox(vec2 uv, vec3 art){
    vec2 m = uv * uFaceSize;
    if (uIgnite < 0.0) return ledScene(0.0, uv, m, art) * uStandby * 3.2;
    vec3 a = ledScene(uSceneA, uv, m, art);
    vec3 b = uSceneMix > 0.001 ? ledScene(uSceneB, uv, m, art) : a;
    vec3 col = mix(a, b, uSceneMix);
    // ignition: floor → roof sweep with a white-hot leading edge and module pop-in
    vec2 mod_ = floor(m / vec2(1.0, 0.5));
    float pop = kHash21(mod_) * 0.06;
    float front = uIgnite - pop;
    float on = step(uv.y, front);
    float edge = exp(-kSq((uv.y - front) * 26.0)) * step(0.0, uIgnite) * step(uIgnite, 1.1);
    col = col * on + vec3(1.0, 0.85, 0.6) * edge * 1.6;
    col += vec3(1.0, 0.97, 0.92) * uStrobe * on;
    // cabinet seams
    vec2 f = fract(m / vec2(1.0, 0.5));
    float seam = smoothstep(0.0, 0.03, f.x) * smoothstep(0.0, 0.05, f.y);
    col *= mix(0.65, 1.0, seam);
    return col * uLedLevel;
  }
  `;

  /* ── LED content: corner beast towers ────────────────────────────── */
  G.ledTower = /* glsl */`
  uniform float uTowerOn;     // 0 → 1 power-up
  uniform float uTowerLevel;
  uniform vec3  uTowerCol;
  uniform float uTowerFlash;
  vec3 ledTower(vec2 uv, vec3 art){
    float t = uTime;
    // power-up: scan from top, glitching rows lock in
    float sweep = uTowerOn * 1.25;
    float row = floor(uv.y * 64.0);
    float jitter = (kHash11(row + floor(t * 14.0)) - 0.5) * 0.12 * (1.0 - smoothstep(0.9, 1.0, uTowerOn));
    float on = step(1.0 - uv.y, sweep + jitter);
    float edge = exp(-kSq((1.0 - uv.y - sweep) * 30.0)) * step(uTowerOn, 0.99);
    vec2 auv = uv + vec2(jitter * 0.15 * step(0.5, kHash11(row * 3.1 + floor(t * 20.0))), 0.0);
    vec3 a = art;
    a *= 0.9 + 0.1 * sin(uv.y * 400.0);
    vec3 col = a * (0.9 + 0.5 * uTowerFlash) + uTowerCol * (0.12 + 0.5 * uBeatPulse * uTowerFlash);
    // rim light frame
    vec2 d = min(uv, 1.0 - uv);
    float rim = exp(-min(d.x * 3.0, d.y * 2.0) * 22.0);
    col += uTowerCol * rim * 1.4;
    col = col * on + uTowerCol * edge * 2.5 + vec3(1.0) * edge * 0.6;
    float standby = (1.0 - on) * 0.03 * (0.5 + 0.5 * sin(t * 2.0 + uv.y * 10.0));
    return (col + uTowerCol * standby) * uTowerLevel;
  }
  `;

  /* ── volumetric beam (instanced cone) ────────────────────────────── */
  G.beamVert = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute vec3 aO; attribute vec3 aD; attribute vec4 aP; attribute vec3 aC;
  varying vec3 vW; varying vec3 vN; varying float vT; varying vec3 vC; varying float vI; varying float vLen; varying vec3 vD;
  varying float vAng; varying vec3 vGobo;
  void main(){
    float gid = float(gl_InstanceID);
    vGobo = vec3(3.0 + floor(fract(sin(gid * 12.9898) * 43758.5453) * 5.0), (fract(sin(gid * 78.233) * 9631.21) - 0.5) * 3.0, step(aP.z / max(aP.x, 1.0), 0.09));
    vAng = atan(position.z, position.x);
    vec3 d = normalize(aD);
    vec3 up = abs(d.y) < 0.98 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 u = normalize(cross(d, up)); vec3 v = cross(d, u);
    float t = position.y;
    float r = mix(aP.y, aP.z, t);
    vec3 radial = u * position.x + v * position.z;
    vec3 w = aO + d * (t * aP.x) + radial * r;
    vN = normalize(radial - d * ((aP.z - aP.y) / max(aP.x, 0.01)));
    vW = w; vT = t; vC = aC; vI = aP.w; vLen = aP.x; vD = d;
    gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
    if (aP.w <= 0.0) gl_Position = vec4(0.0, 0.0, -2.0, 1.0);
    #include <logdepthbuf_vertex>
  }`;
  G.beamFrag = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform float uTime; uniform float uHaze;
  varying vec3 vW; varying vec3 vN; varying float vT; varying vec3 vC; varying float vI; varying float vLen; varying vec3 vD;
  varying float vAng; varying vec3 vGobo;
  ${G.tnoise}
  void main(){
    #include <logdepthbuf_fragment>
    vec3 V = normalize(cameraPosition - vW);
    float nl = length(vN);
    float ndv = nl > 1e-4 ? clamp(abs(dot(vN / nl, V)), 0.0, 1.0) : 0.0;
    float edge = pow(ndv, 3.2);
    float dist = vT * vLen;
    float att = 1.0 / (1.0 + dist * 0.07);
    float hot = exp(-dist * 0.5) * 1.5;
    vec3 q = vW * 0.06 + vec3(uTime * 0.11, -uTime * 0.05, uTime * 0.08);
    float smoke = tn3(q);
    smoke = 0.12 + 1.6 * smoke * smoke + 0.3 * tn3(vW * 0.25 + uTime * 0.3);
    // gobo breakup: a rotating slotted wheel turns each narrow shaft into a fan of fine sub-beams
    float gob = sin(vAng * vGobo.x + uTime * vGobo.y + vT * 1.5);
    smoke *= mix(1.0, 0.35 + 0.9 * smoothstep(-0.2, 0.7, gob), vGobo.z * 0.75);
    float hz = mix(1.0, 0.22, smoothstep(40.0, 170.0, vW.y)) * uHaze;
    float fade = smoothstep(0.0, 0.02, vT) * (1.0 - smoothstep(0.62, 1.0, vT));
    float cosT = dot(-V, vD);
    float g = 0.55;
    float hg = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * (-cosT), 1.5) * 0.25;
    float phase = mix(1.0, hg * 3.0, 0.65);
    float camFade = smoothstep(1.5, 14.0, length(cameraPosition - vW));
    vec3 col = vC * vI * edge * (att + hot) * smoke * hz * fade * phase * camFade * 0.55;
    gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
  }`;

  /* ── lens glint at a fixture (instanced billboard) ───────────────── */
  G.flareVert = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute vec3 aO; attribute vec3 aD; attribute vec4 aP; attribute vec3 aC;
  uniform float uPxWorld;
  varying vec2 vUv; varying vec3 vC; varying float vF;
  void main(){
    vec3 toCam = cameraPosition - aO; float dist = length(toCam); toCam /= dist;
    float facing = max(dot(normalize(aD), toCam), 0.0);
    float f = pow(facing, 12.0);
    float size = (0.3 + f * 2.2) * (0.4 + 0.6 * min(aP.w, 3.0));
    size = max(size, uPxWorld * dist * 3.0);
    vec4 mv = viewMatrix * vec4(aO, 1.0);
    mv.xyz += normalize(-mv.xyz) * 1.0; // pull toward camera so it clears its own housing
    mv.xy += position.xy * size;
    gl_Position = projectionMatrix * mv;
    if (aP.w <= 0.0) gl_Position = vec4(0.0, 0.0, -2.0, 1.0);
    vUv = position.xy; vC = aC * aP.w; vF = 0.25 + f * 2.0;
    #include <logdepthbuf_vertex>
  }`;
  G.flareFrag = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_fragment>
  varying vec2 vUv; varying vec3 vC; varying float vF;
  void main(){
    #include <logdepthbuf_fragment>
    float r = length(vUv);
    float core = exp(-r * r * 60.0) * 6.0 + exp(-r * r * 9.0) * 0.6;
    float star = exp(-abs(vUv.x) * 70.0) * exp(-abs(vUv.y) * 3.5) + exp(-abs(vUv.y) * 70.0) * exp(-abs(vUv.x) * 3.5);
    float a = (core + star * 0.9) * smoothstep(1.0, 0.6, r);
    gl_FragColor = vec4((vC * 0.7 + vec3(0.3) * length(vC)) * a * vF, 1.0);
  }`;

  /* ── laser ribbon (instanced segment) ────────────────────────────── */
  G.laserVert = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute vec3 aA; attribute vec3 aB; attribute vec3 aC; attribute vec2 aW;
  uniform float uPxWorld;
  varying float vS; varying vec3 vC; varying float vI; varying vec3 vWp; varying float vX;
  void main(){
    vec3 P = mix(aA, aB, position.x);
    vec3 dir = normalize(aB - aA + 1e-5);
    vec3 toCam = normalize(cameraPosition - P);
    vec3 side = normalize(cross(dir, toCam) + 1e-6);
    float dist = length(cameraPosition - P);
    float w = max(aW.x, uPxWorld * dist * 1.1);
    vI = aW.y * (aW.x / w);
    P += side * w * position.y * 2.5;
    vS = position.y * 2.5; vC = aC; vWp = P; vX = position.x;
    gl_Position = projectionMatrix * viewMatrix * vec4(P, 1.0);
    if (aW.y <= 0.0) gl_Position = vec4(0.0, 0.0, -2.0, 1.0);
    #include <logdepthbuf_vertex>
  }`;
  G.laserFrag = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform float uTime; uniform float uHaze;
  varying float vS; varying vec3 vC; varying float vI; varying vec3 vWp; varying float vX;
  ${G.tnoise}
  void main(){
    #include <logdepthbuf_fragment>
    // razor core that burns white-hot, a soft sheath scattered by the haze
    float prof = exp(-vS * vS * 2.4);
    float core = exp(-vS * vS * 10.0);
    float halo = exp(-abs(vS) * 1.1) * 0.16;
    // smoke drifting through the beam: fine grain riding on slow, larger banks
    float hz = (0.18 + 1.5 * tn3(vWp * 0.35 + vec3(0.0, uTime * 0.6, uTime * 0.2)));
    hz *= 0.55 + 0.9 * tn3(vWp * 0.07 + vec3(uTime * 0.05, -uTime * 0.03, 0.0));
    hz *= uHaze * mix(1.0, 0.35, smoothstep(50.0, 160.0, vWp.y));
    float along = mix(1.3, 0.55, vX);
    float endF = smoothstep(1.0, 0.97, vX);
    vec3 c = vC * (prof + halo) + mix(vC, vec3(1.0), 0.65) * core * 0.9;
    gl_FragColor = vec4(c * vI * hz * along * endF, 1.0);
  }`;

  /* ── spark / streak particles (fireworks, sparkulars, embers) ────── */
  G.streakVert = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute vec3 aP0; attribute vec3 aV0; attribute vec4 aT; attribute vec3 aC; attribute vec4 aS;
  uniform float uTime; uniform float uPxWorld;
  varying vec3 vCol; varying vec2 vQ;
  vec3 posAt(float t){
    float k = aT.z; vec3 g = vec3(0.0, -9.81 * aT.w, 0.0);
    if (k < 1e-3) return aP0 + aV0 * t + 0.5 * g * t * t;
    float e = exp(-k * t);
    return aP0 + aV0 * (1.0 - e) / k + g * (t / k - (1.0 - e) / (k * k));
  }
  float h11(float p){ p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
  void main(){
    float age = uTime - aT.x;
    if (age < 0.0 || age > aT.y) { gl_Position = vec4(0.0, 0.0, -2.0, 1.0); return; }
    float life = age / aT.y;
    float tail = max(0.0, age - aS.y);
    vec3 H = posAt(age); vec3 Tl = posAt(tail);
    if (aS.z > 2.5) { // embers: turbulent drift
      vec3 sw = vec3(sin(age * 1.7 + aS.w * 20.0), 0.0, cos(age * 1.3 + aS.w * 31.0)) * age * 0.6;
      H += sw; Tl += vec3(sin(tail * 1.7 + aS.w * 20.0), 0.0, cos(tail * 1.3 + aS.w * 31.0)) * tail * 0.6;
    }
    vec3 dir = H - Tl; float L = length(dir);
    vec3 dn = L > 1e-4 ? dir / L : vec3(0.0, 1.0, 0.0);
    vec3 P = mix(Tl, H, position.x);
    vec3 toCam = normalize(cameraPosition - P);
    vec3 side = normalize(cross(dn, toCam) + 1e-6);
    float dist = length(cameraPosition - P);
    float w = max(aS.x, uPxWorld * dist * 1.0);
    float ener = aS.x / w;
    P += side * w * position.y + dn * w * (position.x * 2.0 - 1.0);
    // brightness envelope per type
    // brightness envelopes modelled on real stars: ignite white-hot, burn in colour, sputter out
    float env;
    float type = aS.z;
    float flick = h11(floor(uTime * 22.0) + aS.w * 91.0);
    if (type < 0.5) {
      // ignite, burn, then fade out smoothly (a soft twinkle, no hard flicker)
      env = smoothstep(0.0, 0.05, age) * (1.0 + 0.6 * exp(-age * 9.0));
      env *= (1.0 - smoothstep(0.55, 1.0, life)) * (0.88 + 0.12 * sin(uTime * 31.0 + aS.w * 60.0));
    }
    else if (type < 1.5) env = (0.25 + 0.95 * step(0.6, flick)) * smoothstep(0.05, 0.2, life) * (1.0 - smoothstep(0.7, 1.0, life)); // glitter twinkles
    else if (type < 2.5) env = smoothstep(0.0, 0.05, age) * (1.0 + 0.8 * exp(-age * 6.0)) * (1.0 - smoothstep(0.35, 1.0, life)); // willow / brocade
    else env = smoothstep(0.0, 0.1, life) * (1.0 - smoothstep(0.5, 1.0, life));                                              // ember / fountain
    vec3 c = aC;
    if (type < 0.5) c = mix(mix(c, vec3(1.6, 1.5, 1.35), exp(-age * 14.0) * 0.8), c * vec3(1.0, 0.6, 0.4), smoothstep(0.7, 1.0, life));
    if (type > 1.5 && type < 2.5) c = mix(aC, aC * vec3(1.0, 0.42, 0.1), smoothstep(0.1, 0.85, life));
    // per-spark ceiling: a spark is a bright point, never a bloom-flooding blob
    vCol = min(c * env * 3.0, vec3(9.0)) * ener;
    vQ = vec2(position.x, position.y);
    gl_Position = projectionMatrix * viewMatrix * vec4(P, 1.0);
    #include <logdepthbuf_vertex>
  }`;
  G.streakFrag = /* glsl */`
  #include <common>
  float kSq(float x){ return x * x; }
  #include <logdepthbuf_pars_fragment>
  varying vec3 vCol; varying vec2 vQ;
  void main(){
    #include <logdepthbuf_fragment>
    // a hot round head and a tail that thins and fades behind it (long-exposure streak)
    // a clean round head with only a whisper of tail behind it
    float a = clamp(vQ.x, 0.0, 1.0);
    float wdt = mix(0.3, 1.0, a * a);
    float across = exp(-(vQ.y * vQ.y) / (wdt * wdt) * 5.0);
    float along = pow(a, 3.0) * 0.55;
    float head = exp(-kSq((1.0 - a) * 6.0)) * 1.3;
    gl_FragColor = vec4(vCol * across * (along + head), 1.0);
  }`;

  /* ── billboard sprites: fire (additive) & smoke (lit, alpha) ─────── */
  G.spriteVert = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute vec3 aP0; attribute vec3 aV0; attribute vec4 aT; attribute vec4 aS; attribute vec4 aC;
  uniform float uTime;
  varying vec2 vUv; varying float vLife; varying vec4 vC; varying float vSeed; varying vec3 vW;
  vec3 posAt(float t){
    float k = aT.z; vec3 g = vec3(0.0, aT.w, 0.0);  // aT.w = buoyancy (+ up)
    if (k < 1e-3) return aP0 + aV0 * t + 0.5 * g * t * t;
    float e = exp(-k * t);
    return aP0 + aV0 * (1.0 - e) / k + g * (t / k - (1.0 - e) / (k * k));
  }
  void main(){
    float age = uTime - aT.x;
    if (age < 0.0 || age > aT.y) { gl_Position = vec4(0.0, 0.0, -2.0, 1.0); return; }
    float life = age / aT.y;
    vec3 P = posAt(age);
    P += vec3(sin(age * 0.6 + aS.z * 7.0), 0.0, cos(age * 0.5 + aS.z * 5.0)) * age * 0.35;
    float size = mix(aS.x, aS.y, 1.0 - (1.0 - life) * (1.0 - life));
    float rot = aS.z * 6.2831 + age * (aS.w - 0.5) * 0.8;
    vec2 q = position.xy;
    q = mat2(cos(rot), -sin(rot), sin(rot), cos(rot)) * q;
    vec4 mv = viewMatrix * vec4(P, 1.0);
    mv.xy += q * size;
    gl_Position = projectionMatrix * mv;
    vUv = position.xy; vLife = life; vC = aC; vSeed = aS.z; vW = P;
    #include <logdepthbuf_vertex>
  }`;
  G.fireFrag = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform float uTime;
  varying vec2 vUv; varying float vLife; varying vec4 vC; varying float vSeed; varying vec3 vW;
  ${G.noise}
  ${G.tnoise}
  void main(){
    #include <logdepthbuf_fragment>
    float r = length(vUv);
    float n = tn2((vUv * 3.4 + vec2(vSeed * 13.0, -uTime * 3.2 - vSeed * 7.0)) * 0.22);
    float shape = smoothstep(0.85, 0.35, r + (n - 0.5) * 1.1);
    float heat = shape * (1.0 - vLife * 0.9) * (0.45 + n * 1.0);
    vec3 col = kBlackbody(heat * 0.95) * vC.rgb * vC.a;
    float a = shape * smoothstep(0.0, 0.08, vLife) * (1.0 - smoothstep(0.55, 1.0, vLife));
    gl_FragColor = vec4(col * a * 1.5, 1.0);
  }`;
  G.smokeFrag = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform float uTime; uniform vec3 uLedAvg; uniform vec3 uAmb;
  uniform vec4 uDynPos[6]; uniform vec3 uDynCol[6];
  varying vec2 vUv; varying float vLife; varying vec4 vC; varying float vSeed; varying vec3 vW;
  ${G.tnoise}
  void main(){
    #include <logdepthbuf_fragment>
    float r = length(vUv);
    float n = tn2((vUv * 1.7 + vec2(vSeed * 11.0, uTime * 0.05 + vSeed * 3.0)) * 0.2);
    float d = smoothstep(1.0, 0.0, r) * (0.35 + n * 0.9);
    d *= smoothstep(0.0, 0.12, vLife) * (1.0 - smoothstep(0.55, 1.0, vLife));
    // lighting: LED box (approximated at its centre), ambient haze, dynamic lights
    vec3 toBox = vec3(0.0, 23.7, 0.0) - vW;
    float db = length(toBox);
    vec3 L = uAmb + uLedAvg * (320.0 / (db * db + 500.0));
    for (int i = 0; i < 6; i++){
      vec3 dl = uDynPos[i].xyz - vW; float dd = dot(dl, dl);
      L += uDynCol[i] * (uDynPos[i].w / (dd + 25.0));
    }
    float a = d * vC.a;
    gl_FragColor = vec4(L * vC.rgb * a, a);
  }`;

  /* ── confetti (instanced flutter quads) ──────────────────────────── */
  G.confettiVert = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute vec3 aP0; attribute vec3 aV0; attribute vec4 aT; attribute vec4 aS;
  uniform float uTime; uniform float uPxWorld; uniform vec3 uLedAvg;
  varying vec3 vCol;
  void main(){
    float age = uTime - aT.x;
    if (age < 0.0 || age > aT.y) { gl_Position = vec4(0.0, 0.0, -2.0, 1.0); return; }
    float k = 2.4; float e = exp(-k * age);
    vec3 P = aP0 + aV0 * (1.0 - e) / k + vec3(0.0, -1.6, 0.0) * age;
    P += vec3(sin(age * 2.1 + aS.x * 30.0), 0.0, cos(age * 1.7 + aS.x * 20.0)) * 0.9 * smoothstep(0.5, 2.0, age);
    float rot = age * (4.0 + aS.x * 6.0) + aS.x * 30.0;
    vec3 ax = normalize(vec3(sin(aS.x * 40.0), cos(aS.x * 17.0), sin(aS.x * 9.0)));
    vec3 tA = normalize(cross(ax, vec3(0.0, 1.0, 0.1)));
    vec3 tB = cross(ax, tA);
    vec3 du = tA * cos(rot) + tB * sin(rot);
    vec3 dv = ax;
    float dist = length(cameraPosition - P);
    float s = max(0.07, uPxWorld * dist * 1.2);
    vec3 W = P + du * position.x * s + dv * position.y * s * 0.7;
    vec3 nrm = cross(du, dv);
    float glint = pow(abs(dot(nrm, normalize(cameraPosition - P))), 6.0);
    vec3 base = aS.y < 0.33 ? vec3(1.0, 0.72, 0.25) : (aS.y < 0.66 ? vec3(0.9, 0.08, 0.05) : vec3(0.85, 0.85, 0.9));
    float ener = (0.07 * 0.07) / (s * s);
    vCol = base * (0.08 + uLedAvg * 0.25 + glint * 3.0) * min(1.0, ener * 4.0) * (1.0 - smoothstep(0.85, 1.0, age / aT.y));
    gl_Position = projectionMatrix * viewMatrix * vec4(W, 1.0);
    #include <logdepthbuf_vertex>
  }`;
  G.confettiFrag = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_fragment>
  varying vec3 vCol;
  void main(){
    #include <logdepthbuf_fragment>
    gl_FragColor = vec4(vCol, 1.0);
  }`;

  /* ── glowing points: crowd light sticks / drones / laser hits ─────── */
  G.crowdVert = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute float aR; attribute float aK;
  uniform float uPxScale; uniform float uSize;
  uniform vec4 uShock; uniform vec4 uCard; uniform sampler2D uCardTex;
  ${G.showUniforms}
  ${G.noise}
  ${G.crowd}
  varying vec3 vCol;
  void main(){
    vec3 p = position;
    float sw = sin(uTime * (2.2 + aR * 1.6) + aR * 6.2831);
    float amp = (1.0 - aK * 0.75) * (0.6 + uCrowdSurge * 0.6);
    p += vec3(sw * 0.28, abs(sw) * 0.1, cos(uTime * 1.9 + aR * 11.0) * 0.18) * amp;
    float br; vec3 c = crowdField(p, aR, br);
    // shockwave: a ring of flashes racing out through the crowd
    {
      float sd = length(vec2(p.x, p.z / 1.55));
      float sa = uTime - uShock.x, sb = uTime - uShock.y;
      float fa = sa >= 0.0 && sa < 4.8 ? exp(-kSq((sd - sa * 36.0) / (3.0 + sa * 1.6))) * exp(-sa * 0.55) : 0.0;
      float fb = sb >= 0.0 && sb < 4.8 ? exp(-kSq((sd - sb * 36.0) / (3.0 + sb * 1.6))) * exp(-sb * 0.55) : 0.0;
      float f = min(1.0, (fa + fb * 0.8) * uShock.z);
      c = mix(c, vec3(1.0, 0.86, 0.62), f * 0.8); br += f * 1.4;
    }
    if (aK > 0.5) { c = vec3(1.0, 0.96, 0.88); br = uPhones * (0.55 + 0.45 * kHash11(aR * 31.0 + floor(uTime * 1.3 + aR * 9.0))); }
    // card stunt: every light on the seating (sticks and phones) becomes one pixel of a picture
    // wrapped round the bowl
    if (uCard.x > 0.0 && length(vec2(p.x / 61.5, p.z / 106.0)) > 0.97) {
      vec2 uv = vec2(fract(-atan(-p.z, p.x) / 6.2831853 + uCard.y), clamp((p.y - 2.0) / 53.0, 0.02, 0.98));
      vec3 px = texture2D(uCardTex, uv).rgb;
      c = mix(c, px * px * 1.6, uCard.x); br = mix(br, 1.25, uCard.x);
    }
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float dist = -mv.z;
    float px = uSize * uPxScale / max(dist, 0.1);
    float s = clamp(px, 1.5, 12.0);
    float ener = min((px * px) / (s * s), 1.6);
    gl_PointSize = s;
    vCol = c * br * ener * smoothstep(2.5, 9.0, dist);
    #include <logdepthbuf_vertex>
  }`;
  G.pointFrag = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_fragment>
  varying vec3 vCol;
  void main(){
    #include <logdepthbuf_fragment>
    vec2 d = gl_PointCoord - 0.5;
    float r2 = dot(d, d) * 4.0;
    if (r2 > 1.0) discard;
    float a = (exp(-r2 * 6.0) + 0.16 * exp(-r2 * 2.0)) * (1.0 - r2) * (1.0 - r2);
    gl_FragColor = vec4(vCol * a, 1.0);
  }`;
  G.dotVert = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute vec4 aCol;
  uniform float uPxScale; uniform float uSize;
  varying vec3 vCol;
  void main(){
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float px = uSize * aCol.a * uPxScale / max(-mv.z, 0.1);
    float s = clamp(px, 1.6, 64.0);
    gl_PointSize = s;
    vCol = aCol.rgb * (px * px) / (s * s);
    if (aCol.a <= 0.0) gl_Position = vec4(0.0, 0.0, -2.0, 1.0);
    #include <logdepthbuf_vertex>
  }`;

  G.peopleVert = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute vec3 aP; attribute vec2 aR;      // stick position; (random, base height)
  uniform float uTime; uniform float uCrowdSurge; uniform float uPxScale;
  varying vec2 vQ; varying float vSide; varying float vH;
  void main(){
    float r = aR.x;
    float h = 1.58 + fract(r * 17.3) * 0.32;
    vec3 base = vec3(aP.x, aR.y, aP.z);
    vec3 toCam = cameraPosition - base;
    float dist = length(toCam);
    // sub-pixel figures add nothing but shimmer: collapse them
    if (h * uPxScale / max(dist, 0.1) < 2.5) { gl_Position = vec4(0.0, 0.0, -2.0, 1.0); return; }
    vec3 rt = normalize(vec3(toCam.z, 0.0, -toCam.x));
    float wdt = 0.62;
    vec3 W = base + rt * position.x * wdt + vec3(0.0, position.y * (h + 0.55), 0.0);
    gl_Position = projectionMatrix * viewMatrix * vec4(W, 1.0);
    float sw = sin(uTime * (2.2 + r * 1.6) + r * 6.2831) * (0.6 + uCrowdSurge * 0.6);
    vQ = vec2(position.x * wdt, position.y * (h + 0.55));
    vSide = sw * 0.28; vH = h;
    #include <logdepthbuf_vertex>
  }`;
  G.peopleFrag = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform vec3 uLedAvg; uniform vec3 uCrowdA;
  varying vec2 vQ; varying float vSide; varying float vH;
  float sdSeg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
  void main(){
    #include <logdepthbuf_fragment>
    vec2 p = vQ; float h = vH;
    float head = length(p - vec2(0.0, h - 0.11)) - 0.105;
    float neck = sdSeg(p, vec2(0.0, h - 0.25), vec2(0.0, h - 0.16)) - 0.05;
    float torso = sdSeg(p, vec2(0.0, h * 0.48), vec2(0.0, h - 0.33)) - 0.17;
    float shoulders = sdSeg(p, vec2(-0.15, h - 0.31), vec2(0.15, h - 0.31)) - 0.07;
    float legs = sdSeg(p, vec2(-0.07, 0.0), vec2(-0.05, h * 0.5)) - 0.07;
    legs = min(legs, sdSeg(p, vec2(0.07, 0.0), vec2(0.05, h * 0.5)) - 0.07);
    vec2 hand = vec2(0.2 + vSide, h + 0.42);
    float arm = sdSeg(p, vec2(0.15, h - 0.32), vec2(0.21 + vSide * 0.5, h + 0.02)) - 0.04;
    arm = min(arm, sdSeg(p, vec2(0.21 + vSide * 0.5, h + 0.02), hand) - 0.035);
    float d = min(min(min(head, neck), min(torso, shoulders)), min(legs, arm));
    if (d > 0.0) discard;
    // rim from the stage + the stick's own glow on head and shoulders
    float rim = smoothstep(-0.035, 0.0, d);
    float top = smoothstep(h * 0.6, h + 0.3, p.y);
    vec3 col = vec3(0.004, 0.004, 0.005) + uLedAvg * rim * 0.05 + uCrowdA * top * 0.03;
    gl_FragColor = vec4(col, 1.0);
  }`;

  /* ═══ POST ════════════════════════════════════════════════════════ */
  G.fsVert = /* glsl */`
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

  G.depthDecode = /* glsl */`
  uniform float uNear; uniform float uFar;
  float viewW(float d){ return uNear * uFar / (uFar - d * (uFar - uNear)); }
  `;

  // atmosphere: sky, height fog, analytic in-scatter from key lights
  G.atmosFrag = /* glsl */`
  uniform sampler2D tColor; uniform sampler2D tDepth;
  uniform mat4 uInvProj; uniform mat4 uCamWorld; uniform vec3 uCamPos;
  uniform float uTime; uniform float uHaze;
  uniform vec3 uFogCol; uniform vec3 uLedAvg; uniform vec3 uSkyGlow;
  uniform vec4 uVL[18]; uniform vec3 uVC[18]; uniform int uVN;
  varying vec2 vUv;
  ${G.depthDecode}
  ${G.noise}
  ${G.tnoise}
  vec3 rayDir(vec2 uv){
    vec4 c = uInvProj * vec4(uv * 2.0 - 1.0, 1.0, 1.0);
    vec3 v = normalize(c.xyz / c.w);
    return normalize((uCamWorld * vec4(v, 0.0)).xyz);
  }
  uniform vec3 uCityFog; uniform float uCloudY;
  uniform vec4 uSpot[12]; uniform vec3 uSpotC[12]; uniform int uSpotN;
  vec3 sky(vec3 d){
    float h = d.y;
    vec3 zen = vec3(0.0011, 0.0015, 0.0032);
    vec3 c = mix(uCityFog * 1.25, zen, smoothstep(-0.02, 0.42, h));
    // Beijing's light dome hugging the horizon
    c += uCityFog * 0.9 * exp(-max(h, 0.0) * 16.0);
    // the show lighting up the haze above the venue
    vec3 toV = normalize(vec3(0.0, 120.0, 0.0) - uCamPos);
    float vd = max(dot(d, toV), 0.0);
    c += uSkyGlow * (pow(vd, 6.0) * 0.5 + pow(vd, 40.0) * 1.0);
    if (h > 0.003) {
      // a broken stratocumulus deck, lit from below by the city, the venue, the beams and the fireworks
      float t = max(uCloudY - uCamPos.y, 20.0) / h;
      vec3 p = uCamPos + d * t;
      vec2 cp = p.xz * 0.00042 + vec2(uTime * 0.0011, uTime * 0.0004);
      float n = tn2(cp) * 0.6 + tn2(cp * 2.7 + 0.31) * 0.28 + tn2(cp * 7.3 + 0.71) * 0.12;
      float dens = smoothstep(0.44, 0.76, n);
      float far = exp(-t * 0.00022);
      float rV = length(p.xz);
      // city light from below, the red bowl and the show's glow pooled above the venue
      vec3 lit = uCityFog * 8.0 + (uSkyGlow * 9.0 + vec3(0.09, 0.008, 0.003)) * exp(-rV / 900.0);
      for (int i = 0; i < 12; i++) {
        if (i >= uSpotN) break;
        vec2 dd = p.xz - uSpot[i].xy;
        lit += uSpotC[i] * exp(-dot(dd, dd) / (uSpot[i].z * uSpot[i].z));
      }
      for (int i = 0; i < 18; i++) {
        if (i >= uVN) break;
        vec3 dl = uVL[i].xyz - p;
        lit += max(uVC[i], vec3(0.0)) * 700.0 / (dot(dl, dl) + 6e4);
      }
      float core = 0.55 + 0.45 * (1.0 - smoothstep(0.55, 0.95, n));   // thick cores sit darker
      c = mix(c, lit * core * 0.8 + zen, dens * far * 0.95);
      // stars only through the gaps, high up, away from the light dome
      vec2 sp = d.xz / (h + 0.3) * 260.0;
      float st = step(0.9972, kHash21(floor(sp))) * smoothstep(0.18, 0.6, h) * (1.0 - dens);
      c += st * vec3(0.35, 0.4, 0.55) * (0.3 + 0.7 * kHash21(floor(sp) + 7.0));
    }
    return c;
  }
  // analytic single-scatter integral for a point light along a ray segment [0, L]
  float scatterPoint(vec3 ro, vec3 rd, float L, vec3 sp){
    vec3 q = sp - ro;
    float b = dot(q, rd);
    float h2 = max(dot(q, q) - b * b, 1.0);
    float h = sqrt(h2);
    return (atan((L - b) / h) + atan(b / h)) / h;
  }
  void main(){
    vec3 col = texture2D(tColor, vUv).rgb;
    // insurance: one bad sample must never become a black hole in the bloom pyramid
    if (any(isnan(col)) || any(isinf(col))) col = vec3(0.0);
    col = clamp(col, 0.0, 30000.0);
    float dz = texture2D(tDepth, vUv).r;
    vec3 rd = rayDir(vUv);
    bool isSky = dz >= 0.99999;
    float w = viewW(dz);
    vec4 cf = uInvProj * vec4(0.0, 0.0, 1.0, 1.0);
    vec3 fwd = normalize((uCamWorld * vec4(normalize(cf.xyz / cf.w), 0.0)).xyz);
    float L = isSky ? 9000.0 : w / max(dot(rd, fwd), 1e-3);
    if (isSky) col = sky(rd) + col;   // keep additive sky-space fx drawn into the buffer
    // exponential height fog, analytic optical depth
    float a = 0.0019 * uHaze, b = 0.018;
    float y0 = uCamPos.y, dy = rd.y;
    // the show haze is dense in the venue; beyond ~250 m it is ordinary (lighter) city air
    float Lf = min(L, 250.0) + max(L - 250.0, 0.0) * 0.2;
    float od = abs(dy) > 1e-4 ? a * exp(-b * y0) * (1.0 - exp(-b * dy * Lf)) / (b * dy) : a * exp(-b * y0) * Lf;
    od = max(od, 0.0);
    float fog = 1.0 - exp(-od);
    // drifting particulate texture
    float lm = min(L, 90.0);
    vec3 sp = uCamPos + rd * lm * 0.5;
    float tex = 0.45 + 1.1 * tn3(sp * 0.035 + vec3(uTime * 0.03, uTime * 0.01, -uTime * 0.02));
    vec3 fcol = mix(uFogCol, uCityFog, smoothstep(220.0, 1300.0, L));
    col = col * (1.0 - fog) + fcol * fog * tex;
    // in-scatter: LED box, fireworks, flames, strobes …
    vec3 ins = vec3(0.0);
    float Ls = min(L, 1500.0);
    for (int i = 0; i < 18; i++){
      if (i >= uVN) break;
      float s = scatterPoint(uCamPos, rd, Ls, uVL[i].xyz);
      ins += max(uVC[i], vec3(0.0)) * s * uVL[i].w;
    }
    float dens = 0.0017 * uHaze * mix(1.0, 0.35, smoothstep(30.0, 140.0, uCamPos.y + rd.y * min(Ls, 80.0)));
    col += ins * dens * tex;
    gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
  }`;

  // circle-of-confusion + motion vector prep is folded into the lens pass
  G.dofFrag = /* glsl */`
  uniform sampler2D tColor; uniform sampler2D tDepth;
  uniform vec2 uTexel; uniform float uFocus; uniform float uAperture; uniform float uMaxCoc; uniform int uTaps;
  varying vec2 vUv;
  ${G.depthDecode}
  float coc(vec2 uv){
    float dz = texture2D(tDepth, uv).r;
    if (dz >= 0.99999) return 0.0;      // sky + what floats in it (fireworks, drones) stay crisp
    float w = viewW(dz);
    return clamp(uAperture * abs(w - uFocus) / (w * max(uFocus, 1.0)) * 900.0, 0.0, uMaxCoc);
  }
  void main(){
    float c0 = coc(vUv);
    vec3 acc = vec3(0.0); float wsum = 0.0;
    const float GA = 2.39996323;
    float nt = float(uTaps);
    for (int i = 0; i < 28; i++){
      if (i >= uTaps) break;
      float fi = float(i) + 0.5;
      float r = sqrt(fi / nt);
      float th = fi * GA;
      vec2 o = vec2(cos(th), sin(th)) * r;
      vec2 uv = vUv + o * uMaxCoc * uTexel;
      float cs = coc(uv);
      float wgt = smoothstep(r * uMaxCoc - 1.0, r * uMaxCoc + 0.5, max(cs, c0 * 0.6));
      vec3 s = texture2D(tColor, uv).rgb;
      wgt *= 1.0 + dot(s, vec3(0.3)) * 0.4; // bright bokeh bias
      acc += s * wgt; wsum += wgt;
    }
    vec3 col = wsum > 0.0 ? acc / wsum : texture2D(tColor, vUv).rgb;
    gl_FragColor = vec4(col, c0);
  }`;

  G.lensFrag = /* glsl */`
  uniform sampler2D tColor; uniform sampler2D tDof; uniform sampler2D tDepth;
  uniform mat4 uInvProj; uniform mat4 uCamWorld; uniform vec3 uCamPos; uniform mat4 uPrevVP;
  uniform float uMBlur; uniform float uDofOn; uniform float uMaxCoc;
  varying vec2 vUv;
  ${G.depthDecode}
  void main(){
    vec3 sharp = texture2D(tColor, vUv).rgb;
    vec4 dof = texture2D(tDof, vUv);
    float dz = texture2D(tDepth, vUv).r;
    // reconstruct world position → previous frame screen position
    vec4 c = uInvProj * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
    vec3 vdir = normalize(c.xyz / c.w);
    vec3 rd = normalize((uCamWorld * vec4(vdir, 0.0)).xyz);
    vec4 cf = uInvProj * vec4(0.0, 0.0, 1.0, 1.0);
    vec3 fwd = normalize((uCamWorld * vec4(normalize(cf.xyz / cf.w), 0.0)).xyz);
    float w = dz >= 0.99999 ? 3000.0 : viewW(dz);
    vec3 wp = uCamPos + rd * (w / max(dot(rd, fwd), 1e-3));
    vec4 pp = uPrevVP * vec4(wp, 1.0);
    vec2 puv = pp.xy / pp.w * 0.5 + 0.5;
    vec2 vel = (vUv - puv) * uMBlur;
    float vl = length(vel);
    if (vl > 0.08) vel *= 0.08 / vl;
    vec3 col = sharp;
    if (vl > 0.0008 && dz < 0.99999) {
      vec3 acc = sharp; float n = 1.0;
      for (int i = 1; i < 7; i++){
        float f = float(i) / 6.0 - 0.5;
        acc += texture2D(tColor, vUv + vel * f).rgb; n += 1.0;
      }
      col = acc / n;
    }
    float k = smoothstep(0.6, 2.2, dof.a) * uDofOn;
    col = mix(col, dof.rgb, k);
    gl_FragColor = vec4(col, 1.0);
  }`;

  G.downFrag = /* glsl */`
  uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uFirst;
  varying vec2 vUv;
  vec3 s(vec2 o){ return texture2D(tSrc, vUv + o * uTexel).rgb; }
  float kw(vec3 c){ return 1.0 / (1.0 + max(max(c.r, c.g), c.b)); }
  void main(){
    vec3 a = s(vec2(-2, 2)), b = s(vec2(0, 2)), c = s(vec2(2, 2));
    vec3 d = s(vec2(-2, 0)), e = s(vec2(0, 0)), f = s(vec2(2, 0));
    vec3 g = s(vec2(-2, -2)), h = s(vec2(0, -2)), i = s(vec2(2, -2));
    vec3 j = s(vec2(-1, 1)), k = s(vec2(1, 1)), l = s(vec2(-1, -1)), m = s(vec2(1, -1));
    vec3 col;
    if (uFirst > 0.5) {
      vec3 g0 = (a + b + d + e) * 0.25, g1 = (b + c + e + f) * 0.25, g2 = (d + e + g + h) * 0.25, g3 = (e + f + h + i) * 0.25, g4 = (j + k + l + m) * 0.25;
      float w0 = kw(g0), w1 = kw(g1), w2 = kw(g2), w3 = kw(g3), w4 = kw(g4);
      col = (g0 * w0 * 0.125 + g1 * w1 * 0.125 + g2 * w2 * 0.125 + g3 * w3 * 0.125 + g4 * w4 * 0.5) / (w0 * 0.125 + w1 * 0.125 + w2 * 0.125 + w3 * 0.125 + w4 * 0.5);
    } else {
      col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
    }
    gl_FragColor = vec4(col, 1.0);
  }`;
  G.upFrag = /* glsl */`
  uniform sampler2D tSrc; uniform sampler2D tPrev; uniform vec2 uTexel; uniform float uRadius; uniform float uMixPrev;
  varying vec2 vUv;
  void main(){
    vec2 o = uTexel * uRadius;
    vec3 c = texture2D(tSrc, vUv).rgb * 4.0;
    c += (texture2D(tSrc, vUv + vec2(o.x, 0.0)).rgb + texture2D(tSrc, vUv - vec2(o.x, 0.0)).rgb + texture2D(tSrc, vUv + vec2(0.0, o.y)).rgb + texture2D(tSrc, vUv - vec2(0.0, o.y)).rgb) * 2.0;
    c += texture2D(tSrc, vUv + o).rgb + texture2D(tSrc, vUv - o).rgb + texture2D(tSrc, vUv + vec2(o.x, -o.y)).rgb + texture2D(tSrc, vUv + vec2(-o.x, o.y)).rgb;
    c /= 16.0;
    gl_FragColor = vec4(c + texture2D(tPrev, vUv).rgb * uMixPrev, 1.0);
  }`;

  G.finalFrag = /* glsl */`
  uniform sampler2D tColor; uniform sampler2D tBloom; uniform sampler2D tGlow; uniform sampler2D tStreak; uniform sampler2D tDirt; uniform sampler2D tShaft; uniform float uShaft;
  uniform float uExposure; uniform float uBloom; uniform float uFlare; uniform float uGrain; uniform float uTime;
  uniform vec2 uRes; uniform float uCA; uniform float uVignette;
  uniform vec4 uHeat[6]; uniform float uFade; uniform float uFlash;
  varying vec2 vUv;
  float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  vec3 acesFit(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
  float acesS(float x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
  vec3 toSRGB(vec3 c){ c = clamp(c, 0.0, 1.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
  void main(){
    vec2 uv = vUv;
    // heat shimmer above flames
    vec2 sh = vec2(0.0);
    for (int i = 0; i < 6; i++){
      vec4 hz = uHeat[i];
      if (hz.w <= 0.0) continue;
      vec2 d = (uv - hz.xy) / vec2(hz.z * 0.6, hz.z * 1.6);
      float m = exp(-dot(d, d) * 2.0) * hz.w;
      sh += m * vec2(sin(uv.y * 160.0 + uTime * 9.0), cos(uv.x * 120.0 - uTime * 7.0)) * 0.0022;
    }
    uv += sh;
    // chromatic edges
    vec2 cc = uv - 0.5;
    float r2 = dot(cc, cc);
    vec2 ca = cc * r2 * uCA;
    vec3 col;
    col.r = texture2D(tColor, uv - ca).r;
    col.g = texture2D(tColor, uv).g;
    col.b = texture2D(tColor, uv + ca).b;
    // contrast-adaptive sharpening: restores the edge crispness the resolution budget costs,
    // limited by the local range so it never rings around lights
    {
      vec2 px = 1.0 / uRes;
      vec3 n = texture2D(tColor, uv + vec2(0.0, px.y)).rgb, s = texture2D(tColor, uv - vec2(0.0, px.y)).rgb;
      vec3 e = texture2D(tColor, uv + vec2(px.x, 0.0)).rgb, w = texture2D(tColor, uv - vec2(px.x, 0.0)).rgb;
      vec3 mn = min(min(n, s), min(min(e, w), col)), mx = max(max(n, s), max(max(e, w), col));
      vec3 amp = sqrt(clamp(min(mn, 2.0 - mx) / max(mx, 1e-4), 0.0, 1.0));
      vec3 sh = col + (col * 4.0 - (n + s + e + w)) * amp * 0.12;
      col = clamp(sh, mn, mx);
    }
    vec3 bloom = texture2D(tBloom, uv).rgb;
    vec3 glow = texture2D(tGlow, uv).rgb;
    float dirt = texture2D(tDirt, uv).r;
    col += bloom * uBloom * (0.011 + dirt * 0.005) + glow * uBloom * 0.007;
    // anamorphic streak + ghosts
    vec3 st = texture2D(tStreak, uv).rgb;
    col += st * vec3(0.55, 0.7, 1.2) * uFlare * 0.05;
    vec2 gu = 1.0 - uv;
    vec3 gh = texture2D(tGlow, (gu - 0.5) * 0.6 + 0.5).rgb * vec3(1.0, 0.6, 0.3) + texture2D(tGlow, (gu - 0.5) * 1.4 + 0.5).rgb * vec3(0.3, 0.6, 1.0);
    col += gh * uFlare * 0.0015 * smoothstep(0.7, 0.0, length(gu - 0.5));
    col += texture2D(tShaft, uv).rgb * uShaft;
    col += uFlash * vec3(1.0, 0.95, 0.9);
    // exposure + hue-preserving filmic tonemap blended with ACES for highlight roll-off
    col *= uExposure;
    float l = max(max(col.r, col.g), col.b);
    vec3 hp = col * (acesS(l) / max(l, 1e-5));
    // hot lights burn through to white like on a real sensor; mids keep their hue
    vec3 tm = mix(hp, acesFit(col), 0.62);
    // grade: cool shadows, warm highlights, a touch of contrast
    float lum = dot(tm, vec3(0.2126, 0.7152, 0.0722));
    tm = mix(vec3(lum), tm, 1.06);
    // filmic toe: deeper blacks, the haze only where there is light
    tm = tm * tm / (tm + 0.026) * 1.026;
    tm += vec3(-0.004, 0.0, 0.008) * (1.0 - smoothstep(0.0, 0.3, lum));
    tm *= mix(vec3(1.0), vec3(1.03, 1.0, 0.96), smoothstep(0.4, 1.0, lum));
    // vignette
    float v = smoothstep(1.15, 0.25, length(cc * vec2(1.0, uRes.y / uRes.x) * 1.6));
    tm *= mix(1.0 - uVignette, 1.0, v);
    vec3 o = toSRGB(tm);
    // film grain (luma-weighted) + dither
    float gr = h21(uv * uRes + fract(uTime * 37.0) * 400.0) - 0.5;
    o += gr * uGrain * 0.028 * (1.0 - o * 0.7);
    o += (h21(uv * uRes * 1.3 + 17.0) - 0.5) / 255.0;
    o *= uFade;
    gl_FragColor = vec4(o, 1.0);
  }`;

  // screen-space light shafts: march from each pixel towards the key light on screen, gathering
  // the bright (thresholded) image with decay. Anything dark in between – crowd, steel, the
  // performer – cuts its own shadow ray through the haze.
  G.shaftFrag = /* glsl */`
  uniform sampler2D tSrc; uniform vec2 uLight; uniform float uT; uniform float uLen;
  varying vec2 vUv;
  void main(){
    vec2 d = (vUv - uLight) * (uLen / 36.0);
    vec2 uv = vUv; float w = 1.0; vec3 acc = vec3(0.0);
    for (int i = 0; i < 36; i++){
      uv -= d;
      vec3 c = texture2D(tSrc, uv).rgb;
      acc += max(c - uT, vec3(0.0)) * w;
      w *= 0.95;
    }
    gl_FragColor = vec4(acc / 36.0, 1.0);
  }`;

  G.streakBlurFrag = /* glsl */`
  uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uStep;
  varying vec2 vUv;
  void main(){
    vec3 c = vec3(0.0); float ws = 0.0;
    for (int i = -7; i <= 7; i++){
      float fi = float(i);
      float w = exp(-fi * fi / 18.0);
      vec3 s = texture2D(tSrc, vUv + vec2(fi * uStep * uTexel.x, 0.0)).rgb;
      c += s * w; ws += w;
    }
    gl_FragColor = vec4(c / ws, 1.0);
  }`;
  G.threshFrag = /* glsl */`
  uniform sampler2D tSrc; uniform float uT;
  varying vec2 vUv;
  void main(){
    vec3 c = texture2D(tSrc, vUv).rgb;
    float l = max(max(c.r, c.g), c.b);
    gl_FragColor = vec4(c * smoothstep(uT, uT * 3.0, l), 1.0);
  }`;
})();
