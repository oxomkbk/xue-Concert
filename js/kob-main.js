(window.KOB_FILES = window.KOB_FILES || {}).main = '12';
/* ═══════════════════════════════════════════════════════════════════
   KING OF BEASTS — main
   boot · venue prep (materials, light rig) · show runtime · director camera
   · free camera · capture API (window.__viewer)
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const KOB = window.KOB;
  const P = KOB.params;
  const $ = (s) => document.querySelector(s);

  const CDNS = {
    jsdelivr: 'https://cdn.jsdelivr.net/npm/three@0.160.0/',
    unpkg: 'https://unpkg.com/three@0.160.0/',
    npmmirror: 'https://registry.npmmirror.com/three/0.160.0/files/',
  };

  // temporary UI shim until the real UI exists
  const bootUI = {
    boot(p, m) { const b = $('#bootBar'); if (b) b.style.width = Math.round(p * 100) + '%'; if (m) $('#bootMsg').textContent = m; },
    fail(m) { $('#bootErrText').textContent = m; $('#boot').classList.add('is-error'); },
  };
  window.addEventListener('error', (e) => { if (document.body.classList.contains('is-booting')) bootUI.fail(String(e.message || e)); });
  window.addEventListener('unhandledrejection', (e) => { if (document.body.classList.contains('is-booting')) bootUI.fail(String((e.reason && e.reason.message) || e.reason)); });

  async function probe(base) {
    const ctl = 'AbortController' in window ? new AbortController() : null;
    const tm = setTimeout(() => ctl && ctl.abort(), 6000);
    try { const r = await fetch(base + 'package.json', { cache: 'no-store', signal: ctl && ctl.signal }); clearTimeout(tm); if (!r.ok) throw new Error(r.status); return base; }
    finally { clearTimeout(tm); }
  }
  function loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('cannot load ' + src)); document.head.appendChild(s); });
  }

  // every script stamps the build it belongs to; a mismatch means the browser served a stale copy
  const FILES = ['params', 'glsl', 'show', 'fx', 'sfx', 'world', 'post', 'ui', 'deck', 'audio', 'main'];
  async function freshness() {
    const want = String(window.KOB_BUILD || '');
    const got = window.KOB_FILES || {};
    let stale = FILES.some((f) => got[f] !== want);
    // the page itself may be stale too: compare with the copy on disk / on the server
    if (location.protocol !== 'file:') try { const r = await fetch(location.pathname + '?_=' + Date.now(), { cache: 'no-store' }); if (r.ok) { const m = /KOB_BUILD = '([^']+)'/.exec(await r.text()); if (m && m[1] !== want) stale = true; } } catch (e) { /* file:// without fetch: rely on the stamps */ }
    if (!stale) { try { sessionStorage.removeItem('kob.reload'); } catch (e) { /* ignore */ } return true; }
    let tried = false; try { tried = sessionStorage.getItem('kob.reload') === want; sessionStorage.setItem('kob.reload', want); } catch (e) { /* ignore */ }
    if (!tried) { const u = new URL(location.href); u.searchParams.set('_r', Date.now()); location.replace(u.toString()); return false; }
    bootUI.fail('浏览器仍在使用旧版本文件 · The browser is serving cached files from an older build. Press Ctrl+F5 (Cmd+Shift+R on a Mac) to load build ' + want + '.');
    return false;
  }

  (async function boot() {
    if (!(await freshness())) return;
    console.log('[kob] build ' + window.KOB_BUILD);
    bootUI.boot(0.05, 'Finding a three.js CDN…');
    const order = P.cdn === 'auto' ? ['jsdelivr', 'unpkg', 'npmmirror'] : [P.cdn].concat(Object.keys(CDNS).filter((k) => k !== P.cdn));
    let base = null;
    for (const k of order) { try { base = await probe(CDNS[k]); break; } catch (e) { /* next */ } }
    if (!base) { bootUI.fail('None of the three.js CDNs (jsDelivr / unpkg / npmmirror) answered.'); return; }
    const im = document.createElement('script');
    im.type = 'importmap';
    im.textContent = JSON.stringify({ imports: { three: base + 'build/three.module.js', 'three/addons/': base + 'examples/jsm/' } });
    document.head.appendChild(im);
    bootUI.boot(0.15, 'Loading three.js…');
    const THREE = await import('three');
    const [{ GLTFLoader }, { DRACOLoader }, { OrbitControls }] = await Promise.all([
      import('three/addons/loaders/GLTFLoader.js'), import('three/addons/loaders/DRACOLoader.js'),
      import('three/addons/controls/OrbitControls.js'),
    ]);
    bootUI.boot(0.25, 'Loading the venue…');
    let buf = null;
    if (/^https?:/.test(location.protocol)) {
      try { const r = await fetch('model.glb'); if (r.ok) buf = await r.arrayBuffer(); } catch (e) { /* fall back to the embedded copy */ }
    }
    if (!buf) {
      if (!window.__KOB_MODEL_B64) await loadScript('js/model-data.js');
      bootUI.boot(0.45, 'Decoding the embedded model…');
      await new Promise((r) => setTimeout(r, 20));
      const bin = atob(window.__KOB_MODEL_B64);
      const u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      buf = u8.buffer;
      try { delete window.__KOB_MODEL_B64; } catch (e) { window.__KOB_MODEL_B64 = null; }
    }
    bootUI.boot(0.6, 'Decompressing geometry (Draco)…');
    const draco = new DRACOLoader();
    draco.setDecoderPath(base + 'examples/jsm/libs/draco/');
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);
    const gltf = await loader.parseAsync(buf, '');
    buf = null;
    bootUI.boot(0.78, 'Rigging lights, lasers, pyro…');
    await new Promise((r) => setTimeout(r, 20));
    await start(THREE, gltf, { OrbitControls });
  })().catch((e) => { console.error(e); bootUI.fail(String((e && e.message) || e)); });

  /* ════════════════════════════════════════════════════════════════════ */
  async function start(THREE, gltf, libs) {
    const G = KOB.GLSL;
    const V3 = THREE.Vector3;
    const B = (b) => new V3(b[0], b[2], -b[1]);              // Blender → three
    const toB = (v) => [v.x, -v.z, v.y];

    /* ── quality tiers ───────────────────────────────────────────────────
       Everything in a tier can change at runtime WITHOUT recompiling a shader (resolution, MSAA,
       mirror cadence, DOF taps, beam thinning, particle density, crowd / haze counts). The light
       rig is identical on every tier, so dropping a tier never causes a compile hitch. */
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const QP = {
      low:    { maxPx: 0.55e6, msaa: 0, mirrorEvery: 0, mirrorBeams: false, groundFx: false, dofTaps: 0,  mblur: false, beamThin: 2, pk: 0.5,  haze: 0.45, crowdK: 0.45, people: 0.45, bowlPeople: 0,   drones: 0.5,  hunters: 0, fw: 2, laserRays: 6, flare: 0.6, trees: 0.35, fans: 0.4, cityK: 0.6, outPeople: 0, shafts: 0 },
      medium: { maxPx: 1.0e6,  msaa: 2, mirrorEvery: 2, mirrorBeams: false, groundFx: true,  dofTaps: 12, mblur: true,  beamThin: 0, pk: 0.75, haze: 0.7,  crowdK: 0.7,  people: 1,    bowlPeople: 0,   drones: 0.75, hunters: 2, fw: 3, laserRays: 8, flare: 1,   trees: 0.65, fans: 0.7, cityK: 1, outPeople: 0.5, shafts: 1 },
      high:   { maxPx: 1.9e6,  msaa: 2, mirrorEvery: 1, mirrorBeams: false, groundFx: true,  dofTaps: 20, mblur: true,  beamThin: 0, pk: 1,    haze: 1,    crowdK: 1,    people: 1,    bowlPeople: 1,   drones: 1,    hunters: 4, fw: 3, laserRays: 9, flare: 1,   trees: 1,    fans: 1,   cityK: 1, outPeople: 1, shafts: 1 },
      ultra:  { maxPx: 3.6e6,  msaa: 4, mirrorEvery: 1, mirrorBeams: true,  groundFx: true,  dofTaps: 28, mblur: true,  beamThin: 0, pk: 1,    haze: 1,    crowdK: 1,    people: 1,    bowlPeople: 1,   drones: 1,    hunters: 4, fw: 3, laserRays: 9, flare: 1,   trees: 1,    fans: 1,   cityK: 1.3, outPeople: 1, shafts: 1 },
    };
    const TIERS = ['low', 'medium', 'high', 'ultra'];
    let dynScale = 1;

    /* ── renderer ────────────────────────────────────────────────────── */
    const canvas = $('#gl');
    // NOTE: a standard (not logarithmic) depth buffer keeps early-z alive – every hidden surface
    // behind the steel lattice is rejected before shading. A dynamic near plane keeps precision.
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!P.capture, stencil: false, alpha: false });
    if (!renderer.capabilities.isWebGL2) { bootUI.fail('This show needs WebGL 2.'); return; }
    renderer.setPixelRatio(1);
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.info.autoReset = false;   // stats count the whole frame (scene + mirror + post)
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;   // the only shadow caster set is static: render it once
    renderer.shadowMap.needsUpdate = true;

    function detectTier() {
      try {
        const gl = renderer.getContext();
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const r = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)).toLowerCase();
        KOB.gpu = r;
        const mobile = /android|iphone|ipad|mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /macintosh/i.test(navigator.userAgent) && !/apple m\d/.test(r));
        if (/swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic/.test(r)) return 'low';
        if (mobile || /mali|adreno|powervr|apple gpu|videocore/.test(r)) return 'low';
        if (/intel|uhd|iris|hd graphics|radeon\(tm\) graphics|radeon graphics|vega \d+ graphics|apple m\d(?! (pro|max|ultra))/.test(r)) return 'medium';
        return 'high';
      } catch (e) { return 'medium'; }
    }
    const detected = detectTier();
    let quality = P.quality === 'auto' ? (P.capture ? 'high' : detected) : P.quality;
    let Q = QP[quality];
    // allocation sizes follow the best tier we may reach (auto never climbs above high)
    const allocTier = quality === 'ultra' ? 'ultra' : (TIERS.indexOf(quality) < 2 && P.quality === 'auto' ? 'high' : quality);
    const AQ = QP[allocTier === 'low' ? 'medium' : allocTier];

    const scene = new THREE.Scene();
    scene.background = null;
    const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.6, 9000);
    scene.add(camera);

    /* ── baked noise tile (shared by beams, lasers, fire, smoke, atmosphere) ── */
    function noiseTexture() {
      const N = 128, data = new Uint8Array(N * N * 4);
      const lattice = (s, seed) => { const R = KOB.rng(seed); const g = new Float32Array(s * s); for (let i = 0; i < g.length; i++) g[i] = R(); return g; };
      const L = [[4, 11], [8, 12], [16, 13], [32, 14], [64, 15], [16, 21], [8, 31]].map(([sz, sd]) => ({ s: sz, g: lattice(sz, sd) }));
      const at = (o, x, y) => {
        const fx = x * o.s / N, fy = y * o.s / N, x0 = Math.floor(fx), y0 = Math.floor(fy);
        let tx = fx - x0, ty = fy - y0; tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
        const s = o.s, i = (a, b) => o.g[((b % s + s) % s) * s + ((a % s + s) % s)];
        const a0 = i(x0, y0) + (i(x0 + 1, y0) - i(x0, y0)) * tx, a1 = i(x0, y0 + 1) + (i(x0 + 1, y0 + 1) - i(x0, y0 + 1)) * tx;
        return a0 + (a1 - a0) * ty;
      };
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const f = (at(L[0], x, y) * 0.5 + at(L[1], x, y) * 0.25 + at(L[2], x, y) * 0.125 + at(L[3], x, y) * 0.0625 + at(L[4], x, y) * 0.03125) / 0.96875;
        const k = (y * N + x) * 4;
        data[k] = Math.round(f * 255); data[k + 1] = Math.round(at(L[5], x, y) * 255); data[k + 2] = Math.round(at(L[6], x, y) * 255); data[k + 3] = 255;
      }
      const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat, THREE.UnsignedByteType);
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
      t.needsUpdate = true;
      return t;
    }
    const noiseTex = noiseTexture();

    /* ── shared uniforms ─────────────────────────────────────────────── */
    const v3u = (x, y, z) => ({ value: new V3(x, y, z) });
    const KL_MAX = 22;
    const U = {
      uTime: { value: 0 }, uBeatPulse: { value: 0 }, uBar: { value: 0 },
      uPalA: v3u(1, 0, 0), uPalB: v3u(1, 1, 1), uPalC: v3u(1, 1, 1), uLedAvg: v3u(0, 0, 0), uHaze: { value: P.haze },
      uPxWorld: { value: 0.001 }, uPxScale: { value: 800 }, uNoiseTex: { value: noiseTex },
      uCrowdA: v3u(1, 0, 0), uCrowdB: v3u(1, 1, 1), uCrowdC: v3u(1, 1, 1), uCrowdW: { value: new THREE.Vector4() },
      uCrowdLevel: { value: 1 }, uCrowdSurge: { value: 0 }, uWaveSpeed: { value: 1.5 }, uQuad: { value: new THREE.Vector4() },
      uQuadCol: { value: KOB.TOWER_COL.map((c) => new V3(c[0], c[1], c[2])) }, uPhones: { value: 0.4 },
      uDynPos: { value: Array.from({ length: 6 }, () => new THREE.Vector4()) }, uDynCol: { value: Array.from({ length: 6 }, () => new V3()) },
      uAmb: v3u(0.004, 0.004, 0.006),
      uKAO: { value: 1 }, uUplight: v3u(0.42, 0.46, 0.55), uSeatGlow: { value: 0.05 },
      uMirror: { value: null }, uMirrorVP: { value: new THREE.Matrix4() }, uMirrorK: { value: 0 }, uMirrorY: { value: 3.3 },
      uLampI: { value: 240 }, uFac: { value: new THREE.Vector4() }, uFacA: v3u(1, 0.5, 0.1), uFacB: v3u(1, 1, 1),
      uFo: { value: new THREE.Vector4(1, 0, 1, 0) }, uFoA: v3u(1, 0.5, 0.1), uFoB: v3u(1, 1, 1),
      uTick: { value: new THREE.Vector4(0, 0, 0, 0) }, uTickTex: { value: null }, uTickCol: v3u(1, 0.62, 0.22), uCityAmb: v3u(0.012, 0.009, 0.007), uShowGlow: { value: 0.4 }, uFans: { value: 1 },
      // custom show-light rig (see GLSL kobLights)
      uKLPos: { value: Array.from({ length: KL_MAX }, () => new THREE.Vector4()) },
      uKLCol: { value: Array.from({ length: KL_MAX }, () => new THREE.Vector4()) },
      uKLDir: { value: Array.from({ length: KL_MAX }, () => new THREE.Vector4()) },
      uKLN: { value: 0 }, uBoxL: v3u(0, 0, 0),
      // build-12 set pieces: shockwave rings (two fx times, strength), city light show (level, wave
      // fx time), card stunt (level, scroll) and its picture
      uShock: { value: new THREE.Vector4(-1e3, -1e3, 0, 0) }, uCity: { value: new THREE.Vector4(0, -1e3, 0, 0) },
      uCard: { value: new THREE.Vector4() }, uCardTex: { value: null },
    };

    /* ── venue ───────────────────────────────────────────────────────── */
    const root = gltf.scene;
    root.name = 'KingOfBeasts_Stage';
    scene.add(root);
    root.updateMatrixWorld(true);
    const NODES = {};
    const MATS = {};
    root.traverse((o) => {
      if (o.name) NODES[o.name] = o;
      if (o.isMesh) {
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m) MATS[m.name] = m;
      }
    });
    const meshes = []; root.traverse((o) => { if (o.isMesh) meshes.push(o); });

    /* ── material patching ───────────────────────────────────────────── */
    const SHOW_DECL = G.showUniforms.replace(/uniform float uHaze;/, 'uniform float uHaze;');
    function patch(mat, key, opts) {
      opts = opts || {};
      const extra = opts.uniforms || {};
      mat.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, U, extra);
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vKW;')
          .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvKW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        let pars = SHOW_DECL + G.noise + G.stdPars + G.uplight + G.kobLights + `\nuniform float uSeatGlow; uniform sampler2D uMirror; uniform mat4 uMirrorVP; uniform float uMirrorK; uniform float uMirrorY;\n`;
        if (opts.crowd) pars += G.crowd;
        if (opts.pars) pars += opts.pars;
        let frag = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + pars);
        if (opts.emissive) frag = frag.replace('#include <emissivemap_fragment>', opts.emissive);
        if (opts.surface) frag = frag.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + opts.surface);
        let post = `
          vec3 nW = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
          kobLights(vKW, nW, normalize(cameraPosition - vKW), material.diffuseColor, material.specularColor, material.roughness, reflectedLight.directDiffuse, reflectedLight.directSpecular);
          float kao = kobAO(vKW, nW);
          reflectedLight.indirectDiffuse *= kao;
          reflectedLight.indirectSpecular *= mix(1.0, kao, 0.7);
          reflectedLight.directDiffuse *= mix(1.0, kao, 0.55);
          reflectedLight.directSpecular *= mix(1.0, kao, 0.35);
        `;
        if (opts.uplight) post += `reflectedLight.directDiffuse += kobUplight(vKW, nW) * diffuseColor.rgb * 0.3183;\n`;
        if (opts.post) post += opts.post;
        if (opts.crowd) post += `
          { float cb; vec3 cc = crowdField(vKW + vec3(0.0, 1.3, 0.0), 0.5, cb);
            reflectedLight.directDiffuse += cc * cb * uSeatGlow * diffuseColor.rgb;
            totalEmissiveRadiance += cc * cb * uSeatGlow * 0.12; }`;
        if (opts.mirror) post += `
          if (nW.y > 0.9 && abs(vKW.y - uMirrorY) < 0.7) {
            vec4 mc = uMirrorVP * vec4(vKW, 1.0);
            vec2 muv = mc.xy / mc.w * 0.5 + 0.5;
            vec3 Vv = normalize(cameraPosition - vKW);
            float fres = 0.04 + 0.96 * pow(1.0 - max(dot(nW, Vv), 0.0), 5.0);
            float rr = ${(opts.mirrorBlur || 1).toFixed(2)};
            vec3 mr = texture2D(uMirror, muv).rgb * 0.4
              + (texture2D(uMirror, muv + vec2(0.004, 0.0) * rr).rgb + texture2D(uMirror, muv - vec2(0.004, 0.0) * rr).rgb
              + texture2D(uMirror, muv + vec2(0.0, 0.006) * rr).rgb + texture2D(uMirror, muv - vec2(0.0, 0.006) * rr).rgb) * 0.15;
            reflectedLight.indirectSpecular += mr * fres * uMirrorK * ${(opts.mirrorK || 1).toFixed(2)};
          }`;
        frag = frag.replace('#include <aomap_fragment>', '#include <aomap_fragment>\n' + post);
        sh.fragmentShader = frag;
      };
      mat.customProgramCacheKey = () => 'kob_' + key;
      mat.needsUpdate = true;
      return mat;
    }

    const setPBR = (m, o) => { for (const k in o) { if (k === 'color') m.color.setRGB(o.color[0], o.color[1], o.color[2]); else m[k] = o[k]; } };
    // steel: powder-coated silver-grey lattice, carrying its own LED light show (the Nest's skin):
    // rising rings, orbiting chases, beat-locked sectors and spirals run along every member
    const FACADE = `
      uniform vec4 uFac; uniform vec3 uFacA; uniform vec3 uFacB;
      vec3 kobFacade(vec3 p){
        if (uFac.x <= 0.002) return vec3(0.0);
        float ang = atan(-p.z, p.x) * 0.15915 + 0.5;          // 0..1 round the bowl
        float m = uFac.y, k;
        if (m < 0.5) k = exp(-kSq(fract(p.y / 24.0 - uTime * 0.32 + ang * 2.0) - 0.5) * 70.0) * 1.4;
        else if (m < 1.5) k = exp(-kSq(fract(ang * 3.0 - uTime * 0.11) - 0.5) * 40.0) * (0.55 + 0.45 * sin(p.y * 0.16 - uTime * 1.6));
        else if (m < 2.5) k = (0.25 + 1.1 * uBeatPulse) * step(0.5, fract(ang * 8.0 + floor(uTime / 0.46875) * 0.5));
        else k = exp(-kSq(fract(ang * 2.0 + p.y / 70.0 - uTime * 0.28) - 0.5) * 22.0) * 1.3;
        vec3 c = mix(uFacA, uFacB, 0.5 + 0.5 * sin(ang * 12.566 + uTime * 0.4));
        return c * k * uFac.x * 3.2;
      }
    `;
    for (const n of ['ST_Steel_Main', 'ST_Steel_Column', 'ST_Steel_Secondary', 'ST_Steel_Ring', 'ST_Roof_InnerRing', 'ST_Roof_InnerRingWeb']) {
      const m = MATS[n]; if (!m) continue;
      setPBR(m, { metalness: 0.62, roughness: 0.38, envMapIntensity: 0.8 });
      m.color.multiplyScalar(0.9);
      patch(m, 'steel', { uplight: true, pars: FACADE, post: 'totalEmissiveRadiance += kobFacade(vKW);\n' });
    }
    // stage steel: darker, satin truss
    for (const n of ['TR_Steel', 'BC_Grid_Steel', 'LB_Boom_Steel', 'AX_Rigging_Steel', 'SM_Col_Steel', 'SM_Col_Frame', 'TW_Steel', 'SM_Box_Trim', 'TR_Rib', 'LD_Frame_Gold']) {
      const m = MATS[n]; if (!m) continue;
      setPBR(m, { metalness: 0.7, roughness: 0.34, envMapIntensity: 1.4 });
      patch(m, 'truss');
    }
    // seats: matte plastic, China red → Great-Wall grey; lit by the sticks around them
    if (MATS.AU_Seat_White) MATS.AU_Seat_White.color.setRGB(0.42, 0.41, 0.39);
    if (MATS.AU_Seat_Grey) MATS.AU_Seat_Grey.color.setRGB(0.3, 0.3, 0.3);
    if (MATS.AU_Seat_Red) MATS.AU_Seat_Red.color.setRGB(0.38, 0.035, 0.025);
    for (const n of ['AU_Seat_Red', 'AU_Seat_White', 'AU_Seat_Grey', 'AU_Field_Warm', 'AU_Field_Cool', 'AU_Block_Deck']) {
      const m = MATS[n]; if (!m) continue;
      setPBR(m, { roughness: 0.55, metalness: 0, envMapIntensity: 0.6 });
      patch(m, 'seat', { crowd: true });
    }
    if (MATS.AU_Field_Warm) MATS.AU_Field_Warm.color.setRGB(0.3, 0.06, 0.05);
    if (MATS.AU_Field_Cool) MATS.AU_Field_Cool.color.setRGB(0.2, 0.2, 0.21);
    // the deck: glossy LED floor, satin runway, matte lawn – all pick up the box in reflection
    const floorU = { uFloor: { value: 0 } };
    if (MATS.SM_Floor_LED) {
      const m = MATS.SM_Floor_LED;
      setPBR(m, { roughness: 0.12, metalness: 0, color: [0.02, 0.02, 0.025] });
      m.emissive.setRGB(1, 1, 1);
      patch(m, 'floorLED', {
        mirror: true, mirrorK: 1.0, mirrorBlur: 0.6, uniforms: floorU, pars: 'uniform float uFloor;\n',
        emissive: `{
          vec2 fp = vKW.xz;
          float r = length(fp * vec2(1.0, 0.6));
          float ring = exp(-kSq(fract(r * 0.035 - uTime * 0.5) - 0.5) * 90.0);
          vec2 g = abs(fract(fp / 1.0) - 0.5);
          float tile = smoothstep(0.47, 0.5, max(g.x, g.y));
          float n = kNoise2(floor(fp / 1.0) * 0.37 + floor(uTime * 4.0) * 0.21);
          vec3 c = mix(uPalA, uPalB, n) * (0.08 + ring * 0.9 + uBeatPulse * 0.25 * step(0.6, n));
          totalEmissiveRadiance = c * (1.0 - tile * 0.8) * uFloor;
        }`,
      });
    }
    for (const n of ['SM_Apron_Track', 'SM_Deck_Steel', 'SM_Deck_Skirt', 'SM_Stair_Steel', 'SM_Bay_Dark']) {
      const m = MATS[n]; if (!m) continue;
      setPBR(m, { roughness: n === 'SM_Apron_Track' ? 0.28 : 0.45, metalness: 0.2 });
      m.color.setRGB(0.035, 0.035, 0.04);
      patch(m, 'deck_' + n, { mirror: n === 'SM_Apron_Track' || n === 'SM_Deck_Steel', mirrorK: 0.55, mirrorBlur: 2.2 });
    }
    if (MATS.SM_Deck_Lawn) { setPBR(MATS.SM_Deck_Lawn, { roughness: 0.9 }); MATS.SM_Deck_Lawn.color.setRGB(0.05, 0.1, 0.045); patch(MATS.SM_Deck_Lawn, 'lawn'); }
    // box shell, ribs
    for (const n of ['SM_Box_Shell', 'AX_Speaker_Shell', 'BD_Lamp_Body', 'LB_Head_Body']) { const m = MATS[n]; if (m) { setPBR(m, { roughness: 0.5, metalness: 0.3 }); patch(m, 'shell'); } }
    // backs of LED panels are dark cabinet steel, not screens
    if (MATS.LD_LED_Base) { MATS.LD_LED_Base.emissive.setRGB(0, 0, 0); MATS.LD_LED_Base.color.setRGB(0.03, 0.03, 0.035); setPBR(MATS.LD_LED_Base, { roughness: 0.45, metalness: 0.4 }); patch(MATS.LD_LED_Base, 'ledback'); }
    // canopy membrane: lit from below by the 480 rig washes
    if (MATS.TR_Membrane_PTFE) { const m = MATS.TR_Membrane_PTFE; m.transparent = false; m.opacity = 1; m.depthWrite = true; m.color.setRGB(0.36, 0.36, 0.38); setPBR(m, { roughness: 0.6 }); m.emissive.setRGB(0, 0, 0); patch(m, 'membrane'); }
    // roof membranes stay as translucent skins
    if (MATS.ST_Membrane_PTFE) { const m = MATS.ST_Membrane_PTFE; m.opacity = 0.75; m.color.setRGB(0.42, 0.43, 0.45); setPBR(m, { roughness: 0.75 }); m.depthWrite = false; patch(m, 'ptfe'); }
    if (MATS.ST_Membrane_ETFE) { const m = MATS.ST_Membrane_ETFE; m.depthWrite = false; setPBR(m, { roughness: 0.12, metalness: 0 }); }
    // the red bowl wall behind the lattice – the Bird's Nest's signature glow
    const outerWall = NODES.BW_Bowl_OuterWall;
    let wallMat = null;
    if (outerWall) {
      wallMat = outerWall.material.clone(); wallMat.name = 'BW_Wall_Red';
      wallMat.color.setRGB(0.22, 0.03, 0.02); wallMat.emissive.setRGB(1, 1, 1);
      const wu = { uWall: { value: 1 } };
      patch(wallMat, 'wall', { uniforms: wu, pars: G.tnoise + 'uniform float uWall; uniform vec4 uFac; uniform vec4 uTick; uniform sampler2D uTickTex; uniform vec3 uTickCol;\n', emissive: `{
        float h = clamp(vKW.y / 55.0, 0.0, 1.0);
        float bands = 0.75 + 0.25 * smoothstep(0.2, 0.0, abs(fract(vKW.y / 6.0) - 0.5));
        vec3 em = vec3(0.9, 0.05, 0.02) * (0.08 + 0.32 * pow(1.0 - h, 1.6)) * bands;
        // the concourses behind the lattice: warm light lines, people walking past them
        float per = atan(vKW.z, vKW.x) * 168.0;
        for (int k = 0; k < 4; k++) {
          float y0 = 9.5 + float(k) * 9.6;
          float band = exp(-kSq((vKW.y - y0) * 3.2)) + 0.25 * exp(-kSq((vKW.y - y0 + 1.2) * 1.1));
          float dir = mod(float(k), 2.0) * 2.0 - 1.0;
          float ppl = smoothstep(0.5, 0.72, tn2(vec2((per + uTime * 1.3 * dir) * 0.035, float(k) * 0.29)));
          float fig = smoothstep(y0 - 2.1, y0 - 1.6, vKW.y) * (1.0 - smoothstep(y0 - 0.2, y0 + 0.1, vKW.y));
          em += vec3(1.0, 0.7, 0.42) * band * 0.16 * (1.0 - ppl * fig * 0.9);
        }
        // the sign's words scroll round the bowl as a gold LED ticker
        if (uTick.x > 0.01) {
          float v = (vKW.y - 29.0) / 8.4;
          if (v > 0.0 && v < 1.0) {
            float per = -atan(vKW.z, vKW.x) * 168.0;
            float u = fract((per + uTime * 7.0) / 66.0) * 66.0 / 44.8;
            em *= mix(1.0, 0.45, uTick.x);
            if (u < 1.0) {
              vec2 cl = vec2(u * 340.0, v * 64.0), id = floor(cl);
              float on = step(0.5, texture2D(uTickTex, (id + 0.5) / vec2(340.0, 64.0)).r);
              float fw = length(fwidth(cl));
              float dotm = mix(smoothstep(0.5, 0.22, length(fract(cl) - 0.5)), 0.5, smoothstep(0.4, 1.0, fw));
              em += uTickCol * on * dotm * 2.4 * uTick.x;
            }
          }
        }
        totalEmissiveRadiance = em * uWall * (1.0 + uFac.x * (0.25 * uBeatPulse + 0.15 * sin(atan(vKW.z, vKW.x) * 3.0 - uTime * 1.2)));
      }` });
      wallMat.userData.u = wu;
      outerWall.material = wallMat;
    }
    // the Olympic Green: wet granite, asphalt and lawns, lamp pools, mirror (or analytic) reflections
    const GROUND_SURF = `
      float gWet = 0.0;
      { vec3 ga = diffuseColor.rgb; float gr = roughnessFactor; kobGround(vec2(vKW.x, -vKW.z), ga, gr, gWet); diffuseColor.rgb = ga; roughnessFactor = gr; }
      vec3 gEmit = kobGroundLights(vec2(vKW.x, -vKW.z), uPalA, uBeatPulse, uTime);
    `;
    const GROUND_POST = `
      { vec2 gb = vec2(vKW.x, -vKW.z);
        reflectedLight.directDiffuse += kobLamps(gb) * uLampI * diffuseColor.rgb * 0.3183;
        // the glowing bowl throws red light across the plaza
        float eb = length(gb / vec2(160.0, 178.0));
        reflectedLight.directDiffuse += vec3(0.9, 0.07, 0.03) * exp(-max(eb - 1.0, 0.0) * 6.0) * step(0.98, eb) * 0.5 * diffuseColor.rgb;
        vec3 Vg = normalize(cameraPosition - vKW);
        float Fg = 0.02 + 0.98 * pow(1.0 - max(dot(nW, Vg), 0.0), 5.0);
        float sharp = 1.0 - smoothstep(0.05, 0.6, roughnessFactor);
        vec3 refl;
        if (uMirrorK > 0.0 && uMirrorY < 0.5) {
          vec4 mc = uMirrorVP * vec4(vKW.x, 0.0, vKW.z, 1.0);
          vec2 muv = mc.xy / mc.w * 0.5 + 0.5;
          float bl = 0.0015 + roughnessFactor * 0.028;
          muv += (vec2(tn2(gb * 0.21), tn2(gb * 0.23 + 0.5)) - 0.5) * roughnessFactor * 0.025;
          refl = texture2D(uMirror, muv).rgb * 0.28
            + (texture2D(uMirror, muv + vec2(0.0, bl)).rgb + texture2D(uMirror, muv - vec2(0.0, bl)).rgb) * 0.2
            + (texture2D(uMirror, muv + vec2(0.0, bl * 2.4)).rgb + texture2D(uMirror, muv - vec2(0.0, bl * 2.4)).rgb) * 0.1
            + (texture2D(uMirror, muv + vec2(bl * 0.35, 0.0)).rgb + texture2D(uMirror, muv - vec2(bl * 0.35, 0.0)).rgb) * 0.06;
        } else refl = kobBowlRefl(vKW, reflect(-Vg, nW)) * 1.6;
        reflectedLight.indirectSpecular += refl * Fg * gWet * mix(0.3, 1.0, sharp);
        totalEmissiveRadiance += gEmit;
      }
    `;
    // concrete / ground / everything else gets AO + exterior uplight where relevant
    const done = new Set(Object.values(MATS).filter((m) => m.onBeforeCompile && m.customProgramCacheKey && String(m.customProgramCacheKey()).startsWith('kob_')));
    const SCREENS = ['LD_Screen_Long', 'LD_Screen_Long_B', 'LD_Screen_End', 'LD_Screen_Tower_NE', 'LD_Screen_Tower_SE', 'LD_Screen_Tower_SW', 'LD_Screen_Tower_NW', 'RT_Title'];
    const EMISSIVE_FIX = ['LT_Fixture_Shell', 'ST_Roof_Floodlight', 'BD_Edge_Lamp', 'LB_Head_Lens', 'TW_Beacon', 'SM_Deck_EdgeLED', 'TR_Canopy_LED'];
    for (const n in MATS) {
      const m = MATS[n];
      if (done.has(m) || SCREENS.includes(n) || EMISSIVE_FIX.includes(n)) continue;
      if (!m.isMeshStandardMaterial) continue;
      if (/^SI_/.test(n)) patch(m, 'ground', { pars: G.tnoise + G.world + 'uniform float uLampI;\n', surface: GROUND_SURF, post: GROUND_POST });
      else if (/^ST_|^BW_/.test(n)) { if (/Concrete|Fascia|TopFascia|Mullion|Band/.test(n)) setPBR(m, { roughness: 0.82 }); patch(m, 'arch', { uplight: /ST_Concrete|Fascia|Column/.test(n) }); }
      else patch(m, 'generic');
    }
    for (const n of ['SI_Ground_Asphalt', 'SI_Plaza_Concrete', 'SI_Plaza_Step']) if (MATS[n]) { setPBR(MATS[n], { roughness: 0.5, metalness: 0.0, envMapIntensity: 0.4 }); MATS[n].color.setRGB(0.05, 0.05, 0.05); }
    if (MATS.ST_Pitch) MATS.ST_Pitch.color.setRGB(0.05, 0.12, 0.04);
    if (MATS.ST_Grass) MATS.ST_Grass.color.setRGB(0.05, 0.11, 0.04);

    /* LED screens ------------------------------------------------------ */
    const titleTex = MATS.RT_Title && MATS.RT_Title.map;
    const ledU = {
      uLedLevel: { value: 0 }, uIgnite: { value: -0.05 }, uSceneA: { value: 0 }, uSceneB: { value: 0 }, uSceneMix: { value: 0 },
      uStrobe: { value: 0 }, uTitleTex: { value: titleTex || null }, uTitleOn: { value: 0 }, uStandby: { value: 0 },
      uBeastTex: { value: null }, uBeastCol: v3u(1, 0.5, 0.1),
    };
    const boxMats = [];
    [['LD_Screen_Long', 0, 65, 20.3], ['LD_Screen_Long_B', 1, 65, 20.3], ['LD_Screen_End', 2, 39, 20.3]].forEach(([n, face, w, h]) => {
      const m = MATS[n]; if (!m) return;
      m.color.setRGB(0.012, 0.012, 0.014); m.roughness = 0.22; m.metalness = 0; m.emissive.setRGB(1, 1, 1); m.emissiveIntensity = 1;
      const local = { uFace: { value: face }, uFaceSize: { value: new THREE.Vector2(w, h) } };
      patch(m, 'ledbox' + face, {
        uniforms: Object.assign({}, ledU, local), pars: G.ledBox,
        emissive: `{
          vec3 art = vec3(0.0);
          #ifdef USE_EMISSIVEMAP
            art = texture2D(emissiveMap, vEmissiveMapUv).rgb;
            totalEmissiveRadiance = ledBox(vEmissiveMapUv, art);
          #endif
        }`,
      });
      boxMats.push(m);
    });
    // Tower screens are resolved by WORLD position: the panels were named before the stage yaw,
    // so the meshes called "NW"/"SE" stand on the opposite corners. Beasts follow the brief:
    // NE eagle · SE lion · SW elephant · NW whale (geometry untouched, only the artwork is routed).
    const quadW = (p) => { const bx = p.x, by = -p.z; return bx >= 0 ? (by >= 0 ? 0 : 1) : (by < 0 ? 2 : 3); };
    const TOWER_KEYS = ['NE', 'SE', 'SW', 'NW'];
    const BEAST_OF_QUAD = ['eagle', 'lion', 'elephant', 'whale'];
    const beastTex = {};
    for (const k of TOWER_KEYS) { const m = MATS['LD_Screen_Tower_' + k]; if (m && m.emissiveMap) beastTex[(m.emissiveMap.name || k).replace('led_beast_', '')] = m.emissiveMap; }
    const towerMats = [], towerPanels = [[], [], [], []];
    for (const o of meshes) if (/^LD_Tower_Panel_/.test(o.name)) { o.geometry.computeBoundingBox(); const c = o.geometry.boundingBox.getCenter(new V3()).applyMatrix4(o.matrixWorld); towerPanels[quadW(c)].push(o); }
    for (let q = 0; q < 4; q++) {
      const o = towerPanels[q][0]; if (!o) continue;
      const m = o.material;
      if (beastTex[BEAST_OF_QUAD[q]]) m.emissiveMap = beastTex[BEAST_OF_QUAD[q]];
      m.color.setRGB(0.012, 0.012, 0.014); m.roughness = 0.22; m.metalness = 0; m.emissive.setRGB(1, 1, 1);
      const c = KOB.TOWER_COL[q];
      const tu = { uTowerOn: { value: 0 }, uTowerLevel: { value: 2.2 }, uTowerCol: { value: new V3(c[0], c[1], c[2]) }, uTowerFlash: { value: 0 } };
      patch(m, 'tower', {
        uniforms: tu, pars: G.ledTower,
        emissive: `{
          #ifdef USE_EMISSIVEMAP
            vec3 art = texture2D(emissiveMap, vEmissiveMapUv).rgb;
            totalEmissiveRadiance = ledTower(vEmissiveMapUv, art);
          #endif
        }`,
      });
      m.userData.u = tu;
      towerMats[q] = m;
    }
    console.log('[kob] towers ' + JSON.stringify(towerPanels.map((a) => a.map((o) => o.name))));
    // roof title: burns like a brand on the canopy crown
    const titleU = { uTitleOn: { value: 0 }, uTitleFlare: { value: 0 } };
    if (MATS.RT_Title) {
      const m = MATS.RT_Title;
      m.transparent = false; m.alphaTest = 0.35; m.depthWrite = true;
      m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2;
      m.color.setRGB(0.06, 0.04, 0.03); m.emissive.setRGB(1, 1, 1);
      patch(m, 'title', {
        uniforms: titleU, pars: 'uniform float uTitleOn; uniform float uTitleFlare;\n',
        emissive: `{
          float ta = 1.0;
          #ifdef USE_MAP
            ta = texture2D(map, vMapUv).a;
          #endif
          float along = (vKW.z / 36.7) * 0.5 + 0.5;              // ignition runs along the roof (north → south)
          float front = uTitleOn * 1.35 - 0.1;
          float lit = smoothstep(along - 0.08, along, front);
          float heat = kFbm2(vKW.xz * 0.35 + vec2(0.0, -uTime * 1.3));
          float flick = 0.8 + 0.2 * sin(uTime * 23.0 + vKW.z) * sin(uTime * 17.0);
          vec3 fire = kBlackbody(0.28 + heat * 0.5) * (1.1 + 2.5 * uTitleFlare) * flick;
          float edge = exp(-kSq((along - front) * 18.0)) * step(uTitleOn, 0.999);
          totalEmissiveRadiance = (fire * lit + vec3(1.0, 0.8, 0.5) * edge * 6.0) * ta * step(0.001, uTitleOn);
        }`,
      });
    }
    // edge LED strips: chase
    const chaseU = { uChaseCol: v3u(1, 0.1, 0.05), uChaseLevel: { value: 1 } };
    for (const n of ['SM_Deck_EdgeLED', 'TR_Canopy_LED']) {
      const m = MATS[n]; if (!m) continue;
      m.emissive.setRGB(1, 1, 1); m.emissiveIntensity = 1;
      patch(m, 'chase', { uniforms: chaseU, pars: 'uniform vec3 uChaseCol; uniform float uChaseLevel;\n', emissive: `{
        float a = atan(vKW.z, vKW.x) / 6.2831;
        float ch = fract(a * 6.0 - uTime * 0.6);
        float dash = smoothstep(0.0, 0.05, ch) * smoothstep(0.35, 0.1, ch);
        totalEmissiveRadiance = uChaseCol * (0.25 + 2.5 * dash + 1.5 * uBeatPulse) * uChaseLevel;
      }` });
    }
    // fixture emitters: clone per mesh so each group can flash on its own
    const FIX = {};
    for (const o of meshes) {
      const mn = o.material && o.material.name;
      if (!EMISSIVE_FIX.includes(mn) || mn === 'SM_Deck_EdgeLED' || mn === 'TR_Canopy_LED') continue;
      const m = o.material.clone();
      m.emissive.setRGB(1, 1, 1); m.emissiveIntensity = 0.3;
      o.material = m;
      FIX[o.name] = m;
      o.layers.enable(1);
    }
    // layer 1 = things that emit light (rendered into the environment cube and the deck mirror)
    for (const o of meshes) {
      const mn = o.material && o.material.name;
      if (SCREENS.includes(mn) || mn === 'SM_Deck_EdgeLED' || mn === 'TR_Canopy_LED') o.layers.enable(1);
    }
    // layer 3 = the exterior as seen in the wet plaza and the lake: the red bowl, the lattice, the roof title
    for (const o of meshes) {
      const mn = o.material && o.material.name;
      if (o === outerWall || /^ST_Steel_(Main|Column|Ring)$|^RT_Title$|^ST_Bowl_TopFascia$/.test(mn)) o.layers.enable(3);
    }
    // shadows: only the deck wash casts; the throne, columns, statues and the box drop contact shadows
    for (const o of meshes) {
      if (/^TH_|^SM_Col|^BS_Beast|^SM_Box|^AX_/.test(o.name)) o.castShadow = true;
      if (/^SM_|^TH_|^FL_|^BS_Plinth|^AU_/.test(o.name)) o.receiveShadow = true;
    }

    /* average colours of the LED artwork (for the bounce light) */
    function texAvg(tex) {
      try {
        const img = tex && tex.image; if (!img) return [0.3, 0.3, 0.3];
        const c = document.createElement('canvas'); c.width = 16; c.height = 16;
        const g = c.getContext('2d'); g.drawImage(img, 0, 0, 16, 16);
        const d = g.getImageData(0, 0, 16, 16).data; let r = 0, gg = 0, b = 0;
        const lin = (v) => Math.pow(v / 255, 2.2);
        for (let i = 0; i < d.length; i += 4) { r += lin(d[i]); gg += lin(d[i + 1]); b += lin(d[i + 2]); }
        const n = d.length / 4; return [r / n, gg / n, b / n];
      } catch (e) { return [0.3, 0.3, 0.3]; }
    }
    const artAvgBox = texAvg(MATS.LD_Screen_Long && MATS.LD_Screen_Long.emissiveMap);
    const artAvgTower = [0, 1, 2, 3].map((q) => texAvg(towerMats[q] && towerMats[q].emissiveMap));

    /* ── fixture positions from the baked fixture meshes ─────────────── */
    function components(mesh, mergeDist) {
      const g = mesh.geometry; const pa = g.attributes.position; const n = pa.count;
      const key = new Map(); const canon = new Int32Array(n);
      for (let i = 0; i < n; i++) {
        const k = Math.round(pa.getX(i) * 200) + ',' + Math.round(pa.getY(i) * 200) + ',' + Math.round(pa.getZ(i) * 200);
        let c = key.get(k); if (c === undefined) { c = i; key.set(k, i); } canon[i] = c;
      }
      const par = new Int32Array(n); for (let i = 0; i < n; i++) par[i] = i;
      const find = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
      const uni = (a, b) => { a = find(a); b = find(b); if (a !== b) par[a] = b; };
      const idx = g.index ? g.index.array : null;
      const tri = idx ? idx.length : n;
      for (let i = 0; i < tri; i += 3) {
        const a = canon[idx ? idx[i] : i], b = canon[idx ? idx[i + 1] : i + 1], c = canon[idx ? idx[i + 2] : i + 2];
        uni(a, b); uni(a, c);
      }
      const acc = new Map();
      const v = new V3();
      for (let i = 0; i < n; i++) {
        const r = find(canon[i]);
        let a = acc.get(r); if (!a) { a = [0, 0, 0, 0]; acc.set(r, a); }
        v.fromBufferAttribute(pa, i).applyMatrix4(mesh.matrixWorld);
        a[0] += v.x; a[1] += v.y; a[2] += v.z; a[3]++;
      }
      let pts = [...acc.values()].map((a) => new V3(a[0] / a[3], a[1] / a[3], a[2] / a[3]));
      // merge parts of the same fixture
      const md = mergeDist || 0.5;
      const out = [];
      for (const p of pts) {
        let hit = null;
        for (const q of out) if (q.p.distanceTo(p) < md) { hit = q; break; }
        if (hit) { hit.p.multiplyScalar(hit.n).add(p).multiplyScalar(1 / (hit.n + 1)); hit.n++; } else out.push({ p: p.clone(), n: 1 });
      }
      return out.map((o) => o.p);
    }
    const fx = (name, md) => (NODES[name] && NODES[name].isMesh ? components(NODES[name], md) : []);
    const quadOf = (p) => { const bx = p.x, by = -p.z; return bx >= 0 ? (by >= 0 ? 0 : 1) : (by < 0 ? 2 : 3); };   // NE SE SW NW
    const towerUp = [[], [], [], []];
    for (const k of TOWER_KEYS) for (const p of fx('LT_TowerUp_' + k, 1.1)) towerUp[quadOf(p)].push(p);
    const laserEm = [[], [], [], []];
    for (const p of fx('LT_Laser_40', 0.4)) laserEm[quadOf(p)].push(p);
    const deckFx = fx('LT_DeckStrobe_80', 0.4);
    const boomFx = fx('LB_Head_Lens_Group', 0.5);
    const rigAll = fx('LT_RoofWash_480', 0.35);
    const floodFx = fx('ST_RoofFloodlight_Lens', 1.2);
    console.log('[kob] fixtures ' + JSON.stringify({ towerUp: towerUp.map((a) => a.length), lasers: laserEm.map((a) => a.length), deck: deckFx.length, boom: boomFx.length, rig: rigAll.length, floods: floodFx.length }));
    // fall back to synthetic positions if a fixture mesh is missing
    for (let q = 0; q < 4; q++) {
      const cx = [42, 42, -42, -42][q], cy = [54, -54, -54, 54][q];
      if (towerUp[q].length < 4) { towerUp[q] = []; for (let k = 0; k < 15; k++) towerUp[q].push(B([cx + Math.cos(k) * 6, cy + Math.sin(k) * 6, 0.5])); }
      if (laserEm[q].length < 2) { laserEm[q] = []; for (let k = 0; k < 10; k++) laserEm[q].push(B([cx, cy + (k - 5) * 0.8, 24.8])); }
    }
    const angSort = (a, b) => Math.atan2(a.z, a.x) - Math.atan2(b.z, b.x);
    rigAll.sort(angSort);
    const rigFx = rigAll.filter((_, i) => i % 5 === 0);
    floodFx.sort(angSort);

    /* ── crowd: sample the actual seat geometry ──────────────────────── */
    function sampleSurface(mesh, count, minNy, lift, out, rnd, kinds, R, phoneP) {
      const g = mesh.geometry; const pa = g.attributes.position; const idx = g.index ? g.index.array : null;
      const tris = (idx ? idx.length : pa.count) / 3;
      const a = new V3(), b = new V3(), c = new V3(), e1 = new V3(), e2 = new V3(), nn = new V3();
      const cdf = new Float32Array(tris); let total = 0;
      const M = mesh.matrixWorld;
      for (let t = 0; t < tris; t++) {
        const i0 = idx ? idx[t * 3] : t * 3, i1 = idx ? idx[t * 3 + 1] : t * 3 + 1, i2 = idx ? idx[t * 3 + 2] : t * 3 + 2;
        a.fromBufferAttribute(pa, i0).applyMatrix4(M); b.fromBufferAttribute(pa, i1).applyMatrix4(M); c.fromBufferAttribute(pa, i2).applyMatrix4(M);
        e1.subVectors(b, a); e2.subVectors(c, a); nn.crossVectors(e1, e2);
        const area = nn.length() * 0.5;
        const ny = area > 0 ? Math.abs(nn.y) / (area * 2) : 0;
        total += ny > minNy ? area : 0;
        cdf[t] = total;
      }
      if (total <= 0) return;
      for (let k = 0; k < count; k++) {
        const x = R() * total;
        let lo = 0, hi = tris - 1;
        while (lo < hi) { const mid = (lo + hi) >> 1; if (cdf[mid] < x) lo = mid + 1; else hi = mid; }
        const t = lo;
        const i0 = idx ? idx[t * 3] : t * 3, i1 = idx ? idx[t * 3 + 1] : t * 3 + 1, i2 = idx ? idx[t * 3 + 2] : t * 3 + 2;
        a.fromBufferAttribute(pa, i0).applyMatrix4(M); b.fromBufferAttribute(pa, i1).applyMatrix4(M); c.fromBufferAttribute(pa, i2).applyMatrix4(M);
        let u = R(), v = R(); if (u + v > 1) { u = 1 - u; v = 1 - v; }
        out.push(a.x + (b.x - a.x) * u + (c.x - a.x) * v, a.y + (b.y - a.y) * u + (c.y - a.y) * v + lift + (R() - 0.5) * 0.35, a.z + (b.z - a.z) * u + (c.z - a.z) * v);
        rnd.push(R()); kinds.push(R() < phoneP ? 1 : 0);
      }
    }
    const crowdPos = [], crowdR = [], crowdK = [];
    let bowlEnd = 0;
    {
      const R = KOB.rng(P.seed * 31 + 5);
      const bowlN = Math.round(68000 * (allocTier === 'ultra' ? 1.3 : 1) * P.crowd);
      const seatMeshes = [];
      if (NODES.BW_Bowl_Seats) NODES.BW_Bowl_Seats.traverse((o) => { if (o.isMesh) seatMeshes.push(o); });
      for (const m of seatMeshes) sampleSurface(m, Math.round(bowlN / seatMeshes.length), 0.5, 1.2, crowdPos, crowdR, crowdK, R, 0.22);
      bowlEnd = crowdR.length;
      const blocks = Object.keys(NODES).filter((n) => /^AU_Block_(East|West|North|South)_[AB]$/.test(n));
      const per = Math.round(11304 * Math.min(1, P.crowd) / Math.max(1, blocks.length));
      for (const n of blocks) NODES[n].traverse((o) => { if (o.isMesh) sampleSurface(o, per, 0.8, 1.1, crowdPos, crowdR, crowdK, R, 0.15); });
    }
    // silhouettes: every in-field stick + (higher tiers) a share of the lower bowl, nearest rows first
    const peopleStick = [], peopleR = [], peopleBase = [];
    {
      for (let i = bowlEnd; i < crowdR.length; i++) { peopleStick.push(crowdPos[i * 3], crowdPos[i * 3 + 1], crowdPos[i * 3 + 2]); peopleR.push(crowdR[i]); peopleBase.push(0.72); }
      KOB.peopleInfield = peopleR.length;
      if (AQ.bowlPeople) {
        const Rb = KOB.rng(91);
        for (let i = 0; i < bowlEnd; i++) {
          const y = crowdPos[i * 3 + 1];
          if (y > 26 || Rb() > 0.55) continue;            // lower tiers only: that's where the camera gets close
          peopleStick.push(crowdPos[i * 3], y, crowdPos[i * 3 + 2]); peopleR.push(crowdR[i]); peopleBase.push(y - 1.2 - 0.42);
        }
      }
      // shuffle the light-stick arrays so a draw-range prefix is a uniform subset (tiered crowd density)
      const Rs = KOB.rng(1234);
      for (let i = crowdR.length - 1; i > 0; i--) {
        const j = Math.floor(Rs() * (i + 1));
        let t = crowdR[i]; crowdR[i] = crowdR[j]; crowdR[j] = t; t = crowdK[i]; crowdK[i] = crowdK[j]; crowdK[j] = t;
        for (let c = 0; c < 3; c++) { t = crowdPos[i * 3 + c]; crowdPos[i * 3 + c] = crowdPos[j * 3 + c]; crowdPos[j * 3 + c] = t; }
      }
    }

    /* ── lights ──────────────────────────────────────────────────────────
       three.js lights: a faint hemisphere, the deck wash (the one static shadow caster) and the house
       floods. Every show light – the LED box (analytic area light), corner towers, fireworks, flames,
       strobes, follow / hunt / statue / throne spots – goes through the cheap custom loop. */
    scene.add(new THREE.HemisphereLight(0x1a2233, 0x060606, 0.05));
    const towerCentres = [];
    for (let i = 0; i < 4; i++) {
      const c = new V3(); let n = 0;
      for (const o of towerPanels[i]) { const bb = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld); c.add(bb.getCenter(new V3())); n++; }
      if (n) c.multiplyScalar(1 / n); else c.copy(B([[42, 42, -42, -42][i], [54, -54, -54, 54][i], 13.7]));
      towerCentres.push(c);
    }
    // deck wash from the box underside (casts the contact shadows on the deck – rendered once)
    const deckWash = new THREE.SpotLight(0xfff0dd, 0, 0, Math.PI * 0.42, 0.7, 2);
    deckWash.position.set(0, 13.2, 0); deckWash.target.position.set(0, 3.3, 0);
    deckWash.castShadow = true;
    deckWash.shadow.mapSize.set(2048, 2048); deckWash.shadow.camera.near = 2; deckWash.shadow.camera.far = 40; deckWash.shadow.bias = -0.0004;
    scene.add(deckWash, deckWash.target);
    const floods = new THREE.DirectionalLight(0xe8f0ff, 0); floods.position.set(30, 200, 60); scene.add(floods);
    scene.traverse((o) => { if (o.isLight) o.layers.enableAll(); });
    // custom-rig geometry
    const throneSrc = B([6.5, 0, 3.6]), throneAim = B([-2, 0, 10]), throneDir = throneAim.clone().sub(throneSrc).normalize();
    const STATUES = [['BS_Beast_Eagle', [26.3, 99.5]], ['BS_Beast_Lion', [-25.75, 97.7]], ['BS_Beast_Whale', [25.0, -98.6]], ['BS_Beast_Elephant', [-26.1, -99.0]]];
    const statueAim = STATUES.map(([n, xy]) => B([xy[0], xy[1], 14.5]));
    const statueSrc = STATUES.map(([n, xy]) => B([xy[0], xy[1] - Math.sign(xy[1]) * 7.5, 6.9]));
    const statueDir = statueSrc.map((s, i) => statueAim[i].clone().sub(s).normalize());
    const KLp = U.uKLPos.value, KLc = U.uKLCol.value, KLd = U.uKLDir.value;
    let kln = 0;
    const klPoint = (p, r, g, b, I, range) => { if (I <= 0 || kln >= KL_MAX) return; KLp[kln].set(p.x, p.y, p.z, range); KLc[kln].set(r * I, g * I, b * I, -2); kln++; };
    const klSpot = (p, d, r, g, b, I, range, outer, inner) => { if (I <= 0 || kln >= KL_MAX) return; KLp[kln].set(p.x, p.y, p.z, range); KLc[kln].set(r * I, g * I, b * I, Math.cos(outer)); KLd[kln].set(d.x, d.y, d.z, Math.cos(inner)); kln++; };

    /* ── effects ─────────────────────────────────────────────────────── */
    const ctx = { THREE, U, G, scene, quality: allocTier, frame: 0, fwDensity: P.fireworks, pk: Q.pk, laserRays: Q.laserRays };
    const world = KOB.makeWorld(THREE, ctx, AQ);
    const beams = KOB.fx.makeBeams(THREE, ctx);
    const towerAz = towerCentres.map((c) => Math.atan2(-c.z, c.x));
    // keep per-tower blocks even so beam i belongs to tower floor(i / per)
    const perTower = Math.min(...towerUp.map((a) => a.length));
    const tu = beams.add('towerUp', towerUp.map((a) => a.slice(0, perTower)).flat(), { half: 1.6, r0: 0.18, slew: 1.6, maxLen: 480 });
    tu.per = perTower; tu.towerAz = towerAz;
    beams.add('deck', deckFx.length ? deckFx : Array.from({ length: 40 }, (_, i) => B([33.5 * Math.cos(i / 40 * 6.283), 49.5 * Math.sin(i / 40 * 6.283), 0.8])), { half: 1.9, r0: 0.14, slew: 3.0, maxLen: 420 });
    beams.add('boom', boomFx, { half: 2.6, r0: 0.14, slew: 3.0, maxLen: 260 });
    beams.add('rig', rigFx, { half: 8.0, r0: 0.2, slew: 1.5, maxLen: 50, inten: 0.35 });
    beams.add('ring', floodFx.filter((_, i) => i % 2 === 0), { half: 1.3, r0: 0.3, slew: 1.2, maxLen: 600, inten: 1.3 });
    const followSrc = [B([128, 24, 51]), B([128, -24, 51])];
    beams.add('follow', followSrc, { half: 1.1, r0: 0.25, slew: 1.4, maxLen: 300, inten: 1.2 });
    const huntSrc = boomFx.length >= 6 ? [0, 1, 2, 3, 4, 5].map((k) => boomFx[Math.floor(k * boomFx.length / 6)]) : [B([24, 35, 34]), B([24, -35, 34]), B([-24, 35, 34]), B([-24, -35, 34]), B([0, 35, 34]), B([0, -35, 34])];
    const huntG = beams.add('hunt', huntSrc.slice(0, 4), { half: 2.0, r0: 0.18, slew: 1.8, maxLen: 260, inten: 1.2 });
    huntG.activeN = Q.hunters;
    const plazaG = beams.add('plaza', world.searchlights, { half: 1.1, r0: 0.5, slew: 0.8, maxLen: 1150, inten: 2.4, noTrace: true });
    const stG = beams.add('statue', statueSrc, { half: 17, r0: 0.25, slew: 9, maxLen: 9, inten: 0.4 });
    stG.aim = statueAim;
    const thG = beams.add('throne', [B([6.5, 0, 3.6])], { half: 12, r0: 0.2, slew: 9, maxLen: 9, inten: 0.35 });
    thG.aim = [B([-2, 0, 10])];
    huntG.colFn = (i, St) => { if (St.chapter !== 5) return [1, 0.95, 0.88]; let k = 0; for (let j = 0; j < 4; j++) if (St.tower.on[j] > 0) k = j; return KOB.TOWER_COL[k]; };
    // beam targets for follow / hunt spots
    const tmpT = new V3();
    ctx.target = function (name, pat, i, t, out) {
      // the follow spots pick up the singer whenever he is on the deck, the throne otherwise
      if (pat === 'throne' && performer.visible) return out.copy(performer.chest).add(tmpT.set(Math.sin(t * 0.7 + i) * 0.25, 0, Math.cos(t * 0.6 + i) * 0.25));
      if (pat === 'throne') return out.copy(B([-2 + Math.sin(t * 0.4 + i) * 1.2, Math.cos(t * 0.3 + i * 2) * 2.5, 8.5]));
      if (pat === 'statues') { const k = (i + Math.floor(t / (2 * KOB.BAR))) % 4; return out.copy(statueAim[k]); }
      if (pat === 'towers') {
        let k = 0; const on = S.tower.on; for (let j = 0; j < 4; j++) if (on[j] > 0) k = j;
        const c = towerCentres[k];
        return out.copy(c).add(tmpT.set(Math.sin(t * 1.3 + i) * 5, Math.sin(t * 0.9 + i * 2) * 7, Math.cos(t * 1.1 + i) * 5));
      }
      // hunting the stands
      const th = (i * 1.7 + t * 0.35 * (i % 2 ? 1 : -1)) + Math.sin(t * 0.7 + i) * 0.6;
      return KOB.fx.bowlPoint(THREE, th, 0.25 + 0.3 * (0.5 + 0.5 * Math.sin(t * 0.5 + i * 1.3)), out);
    };
    beams.build();

    const ringEm = floodFx.filter((_, i) => i % 4 === 1);
    const lasers = KOB.fx.makeLasers(THREE, ctx, { towers: laserEm, towerAz, ring: ringEm.length ? ringEm : [B([67, 0, 70]), B([-67, 0, 70]), B([0, 98, 42]), B([0, -98, 42])] });
    const pools = KOB.fx.makePools(THREE, ctx);
    const fireworks = KOB.fx.makeFireworks(THREE, ctx, pools);
    const pyro = KOB.fx.makePyro(THREE, ctx, pools);
    const crowd = KOB.fx.makeCrowd(THREE, ctx, new Float32Array(crowdPos), new Float32Array(crowdR), new Float32Array(crowdK));
    const people = KOB.fx.makePeople(THREE, ctx, new Float32Array(peopleStick), peopleR, peopleBase);
    const outPeople = KOB.fx.makePeople(THREE, ctx, world.fanStick, world.fanR, world.fanBase);
    const performer = KOB.fx.makePerformer(THREE, ctx);
    const kinetic = KOB.fx.makeKinetic(THREE, ctx);
    world.group.attach(outPeople.mesh);
    /* drone fleets: the show's own over the Nest (follows the programme unless you take it over)
       and a custom fleet out in the night sky – both fly entirely on the GPU */
    // every fleet always flies at full strength: points are nearly free on the GPU, and a thinned
    // fleet can't spell a word
    const droneN = Math.round(2200 * Math.max(0.5, P.drones));
    const fleetA = KOB.fx.makeFleet(THREE, ctx, droneN, { seed: 11, size: 0.9 });
    const fleetB = KOB.fx.makeFleet(THREE, ctx, droneN, { seed: 23, size: 0.85 });
    const drones = { points: fleetA.points };
    // (no 'claws' in the programme: three tall red columns read as light pillars among the fireworks)
    const SHOW_FORMS = ['crown', 'title', 'eye', 'sphere', 'heart', 'kob', 'rings'];
    const SHAPE_SCALE = { crown: 62, title: 80, eye: 66, sphere: 52, claws: 56, kob: 74, rings: 58, heart: 58 };
    const shapeCache = {};
    const beastImgs = {};
    ['eagle', 'lion', 'elephant', 'whale'].forEach((b, q) => { const m = towerMats[q] && towerMats[q].emissiveMap; if (m && m.image) beastImgs[b] = m.image; });
    const shapeOf = (name, text) => { const k = name + '|' + (text || ''); return shapeCache[k] || (shapeCache[k] = KOB.fx.droneShape(name, droneN, { titleImg: titleTex && titleTex.image, text, beasts: beastImgs })); };
    const frameAt = (bCentre, faceTowardsB, scale) => {
      const centre = B(bCentre), tgt = B(faceTowardsB);
      const face = new V3(tgt.x - centre.x, 0, tgt.z - centre.z).normalize();
      const up = new V3(0, 1, 0), right = new V3().crossVectors(up, face).normalize();
      return { centre, face, up, right, scale };
    };
    // where the custom fleet can fly (Blender coords) and which way it faces
    const FLEET_SPOTS = {
      behind: { c: [-140, 260, 150], look: [352, -236, 20], view: { p: [352, -236, 6], g: [-40, 90, 80], f: 26 } },
      lake:   { c: [330, -150, 78], look: [540, -300, 20], view: { p: [540, -300, 22], g: [240, -70, 58], f: 30 } },
      crown:  { c: [0, 0, 205], look: [352, -236, 20], view: { p: [300, -200, 40], g: [0, 0, 150], f: 26 } },
    };
    const venueFrame = (name) => ({ centre: B([0, 0, 128]), right: new V3(0, 0, -1), up: new V3(0, 1, 0), face: new V3(1, 0, 0), scale: SHAPE_SCALE[name] || 76 });
    const custom = { venue: { follow: true, shape: 'crown', text: '', color: null, effect: 1 } };
    let venueIdx = -1, fleetSnap = true;
    const haze = KOB.fx.makeHaze(THREE, ctx, 140, 90);
    const hazeTotal = 230;
    // build 12: twenty more set pieces (kob-sfx.js) – their pyro lives in the pyro emitters
    const sfx = KOB.makeSFX(THREE, ctx, { beasts: beastImgs });
    const SFX = {};
    KOB.SFX_LIST.forEach((e) => { SFX[e.id] = e; });
    // fire on water: two rows of jets on the lake's near bank, chasing towards the camera
    const LAKE_FIRE = [];
    for (let y = -96; y >= -292; y -= 14) { const x = KOB.WORLD.lakeX(y), hw = KOB.WORLD.lakeHW(y); LAKE_FIRE.push(B([x + hw - 4.5, y, 0.2])); }
    // iron-flower stations on the lake's far bank, between the opening camera and the Nest
    const IRON_POS = [B([250, -110, 2.0]), B([238, -160, 2.0])];
    // the deck's corners (fire tornadoes) and its rim (ring of fire), chase order round the edge
    const DECK_CORNER = [[29.5, 45.5], [29.5, -45.5], [-29.5, -45.5], [-29.5, 45.5]].map(([x, y]) => B([x, y, 3.3]));
    const RING_POS = [];
    {
      const hx = 33.6, hy = 49.6, per = 4 * (hx + hy), n = 36;
      const stair = (x, y) => (Math.abs(Math.abs(y) - hy) < 0.5 && (Math.abs(x) < 10 || Math.abs(Math.abs(x) - 20) < 5)) || (Math.abs(Math.abs(x) - hx) < 0.5 && Math.abs(y) < 12);
      for (let k = 0; k < n; k++) {
        let d = (k + 0.5) / n * per, x, y;
        if (d < 2 * hy) { x = hx; y = -hy + d; } else if ((d -= 2 * hy) < 2 * hx) { x = hx - d; y = hy; } else if ((d -= 2 * hx) < 2 * hy) { x = -hx; y = hy - d; } else { d -= 2 * hy; x = -hx + d; y = -hy; }
        if (!stair(x, y)) RING_POS.push(B([x, y, 3.25]));
      }
    }
    console.log('[kob] gpu "' + (KOB.gpu || '?') + '" → tier ' + quality + ' · people ' + people.count);
    console.log('[kob] crowd lights', crowd.count, 'beams', beams.groups.reduce((s, g) => s + g.n, 0));

    /* ── environment: one static night probe (the show's reflections come from the analytic LED
       box light, so no per-frame cube camera – that used to spike every 8th frame) ──────────── */
    {
      const c = document.createElement('canvas'); c.width = 128; c.height = 64;
      const g = c.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 0, 64);
      gr.addColorStop(0, '#05070d'); gr.addColorStop(0.42, '#0d0f16'); gr.addColorStop(0.5, '#2a1712'); gr.addColorStop(0.56, '#0b0909'); gr.addColorStop(1, '#030303');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 64);
      const t = new THREE.CanvasTexture(c); t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace;
      const pm = new THREE.PMREMGenerator(renderer);
      scene.environment = pm.fromEquirectangular(t).texture;
      pm.dispose(); t.dispose();
    }
    const mirrorCam = new THREE.PerspectiveCamera();
    let mirrorRT = null;
    // two mirror planes: the glossy deck inside the bowl, the wet plaza + lake outside it
    let MIRROR_Y = 3.3;
    const mF = new V3(), mU = new V3(), mT = new V3();
    function updateMirror() {
      const p = camera.position;
      const outside = Math.hypot(p.x / 166, p.z / 184) > 1 || p.y > 140;
      MIRROR_Y = outside ? 0 : 3.3;
      U.uMirrorY.value = MIRROR_Y;
      mirrorCam.copy(camera, false);
      mirrorCam.layers.set(1);
      // outside: the bowl, lattice, landmarks and lamp heads (3) + fireworks (4); every beam (2) only on ultra
      if (outside) { mirrorCam.layers.enable(3); if (Q.groundFx) mirrorCam.layers.enable(4); if (Q.mirrorBeams) mirrorCam.layers.enable(2); }
      else if (Q.mirrorBeams) mirrorCam.layers.enable(2);
      mirrorCam.position.set(p.x, 2 * MIRROR_Y - p.y, p.z);
      mF.set(0, 0, -1).applyQuaternion(camera.quaternion);
      mU.set(0, 1, 0).applyQuaternion(camera.quaternion);
      mF.y = -mF.y; mU.y = -mU.y;
      mirrorCam.up.copy(mU);
      mirrorCam.lookAt(mT.copy(mirrorCam.position).add(mF));
      mirrorCam.updateMatrixWorld();
      mirrorCam.projectionMatrix.copy(camera.projectionMatrix);
      mirrorCam.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
      U.uMirrorVP.value.multiplyMatrices(mirrorCam.projectionMatrix, mirrorCam.matrixWorldInverse);
      renderer.setRenderTarget(mirrorRT);
      renderer.setClearColor(0x000000, 1);
      renderer.clear();
      renderer.render(scene, mirrorCam);
      U.uMirror.value = mirrorRT.texture;
    }

    /* ── post ────────────────────────────────────────────────────────── */
    const post = KOB.makePost(THREE, renderer, { msaa: Q.msaa, noiseTex });
    let RW = 2, RH = 2;
    // show mode with cinematic bars renders only the visible 2.2:1 picture (the bars cover the rest)
    let cropped = false, cropTok = 0;
    const canCrop = () => P.letterbox && (!P.capture || P.crop) && window.innerWidth / window.innerHeight >= 1.3;
    function setCrop(on, delay) {
      const tok = ++cropTok;
      const apply = () => { if (tok !== cropTok) return; const c = on && canCrop(); if (c !== cropped) { cropped = c; resize(); } };
      if (delay) setTimeout(apply, delay); else apply();
    }
    function resize() {
      const cw = window.innerWidth, wh = window.innerHeight;
      if (cropped && !canCrop()) cropped = false;
      const ch = cropped ? Math.min(wh, Math.round(cw / 2.2)) : wh;
      // render scale: device pixels, capped by the tier's pixel budget (a 4K / retina screen no
      // longer renders 8–15 M pixels), then scaled by the adaptive factor
      const budget = Math.sqrt(Q.maxPx / Math.max(1, cw * ch));
      const sc = P.scale || Math.min(DPR, budget) * dynScale;
      RW = Math.max(2, Math.round(cw * sc)); RH = Math.max(2, Math.round(ch * sc));
      renderer.setSize(RW, RH, false);
      canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px'; canvas.style.top = ((wh - ch) / 2) + 'px';
      camera.aspect = cw / ch;
      post.msaa = Q.msaa;
      post.setSize(RW, RH);
      if (mirrorRT) mirrorRT.dispose();
      mirrorRT = new THREE.WebGLRenderTarget(Math.max(2, RW >> 2), Math.max(2, RH >> 2), { type: THREE.HalfFloatType });
      U.uMirror.value = mirrorRT.texture;
    }
    // apply a tier's runtime features (never recompiles anything)
    function applyTier(name, noResize) {
      quality = name; Q = QP[name];
      ctx.pk = Q.pk; ctx.laserRays = Q.laserRays;
      beams.thin = Q.beamThin; huntG.activeN = Q.hunters;
      crowd.points.geometry.setDrawRange(0, Math.round(crowd.count * Math.min(1, Q.crowdK)));
      people.mesh.geometry.instanceCount = Math.round((Q.bowlPeople ? people.count : KOB.peopleInfield) * Q.people);
      haze.mesh.geometry.instanceCount = Math.round(hazeTotal * Q.haze);

      world.setTier(Q);
      sfx.setTier(Q);
      outPeople.mesh.geometry.instanceCount = Math.round(outPeople.count * Q.outPeople);
      document.body.classList.toggle('fx-blur', name === 'ultra' || name === 'high');
      if (!noResize) resize();
    }
    applyTier(quality, true);
    resize();
    window.addEventListener('resize', resize);

    /* ── camera: director + free ─────────────────────────────────────── */
    const keys = KOB.CAMERA_KEYS.map((k) => ({ t: k.t, p: B(k.p), g: B(k.g), f: k.f, hh: k.hh, cut: k.cut }));
    const NK = keys.length;
    const TOTAL = KOB.TOTAL;
    function keyAt(i) { // cyclic access with time offsets (last key == first key + TOTAL)
      const n = NK - 1;
      const w = Math.floor(i / n), j = ((i % n) + n) % n;
      const k = keys[j];
      return { t: k.t + w * TOTAL, p: k.p, g: k.g, f: k.f, hh: k.hh, cut: k.cut };
    }
    const tA = new V3(), tB = new V3();
    function tangent(i, field, out) {
      const k = keyAt(i), kp = keyAt(i - 1), kn = keyAt(i + 1);
      const hasPrev = !k.cut && kp.t < k.t - 1e-4;
      const hasNext = !kn.cut && kn.t > k.t + 1e-4;
      if (field === 'f' || field === 'hh') {
        if (hasPrev && hasNext) return (kn[field] - kp[field]) / (kn.t - kp.t);
        if (hasNext) return (kn[field] - k[field]) / (kn.t - k.t);
        if (hasPrev) return (k[field] - kp[field]) / (k.t - kp.t);
        return 0;
      }
      if (hasPrev && hasNext) return out.subVectors(kn[field], kp[field]).multiplyScalar(1 / (kn.t - kp.t));
      if (hasNext) return out.subVectors(kn[field], k[field]).multiplyScalar(1 / (kn.t - k.t));
      if (hasPrev) return out.subVectors(k[field], kp[field]).multiplyScalar(1 / (k.t - kp.t));
      return out.set(0, 0, 0);
    }
    function director(t, outP, outG) {
      t = ((t % TOTAL) + TOTAL) % TOTAL;
      let i = 0;
      for (let k = 0; k < NK - 1; k++) if (keys[k].t <= t) i = k;
      const a = keys[i], b = keys[i + 1];
      const h = Math.max(1e-4, b.t - a.t);
      const s = (t - a.t) / h;
      const s2 = s * s, s3 = s2 * s;
      const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
      const herm = (field, out) => {
        const m0 = tangent(i, field, tA), m1 = tangent(i + 1, field, tB);
        return out.copy(a[field]).multiplyScalar(h00).addScaledVector(m0, h10 * h).addScaledVector(b[field], h01).addScaledVector(m1, h11 * h);
      };
      herm('p', outP); herm('g', outG);
      const f = a.f * h00 + tangent(i, 'f') * h10 * h + b.f * h01 + tangent(i + 1, 'f') * h11 * h;
      const hh = a.hh * h00 + b.hh * h01 + (tangent(i, 'hh') * h10 + tangent(i + 1, 'hh') * h11) * h;
      return { f, hh: Math.max(0, hh) };
    }
    const nz = (x) => Math.sin(x) * 0.55 + Math.sin(x * 2.31 + 1.7) * 0.3 + Math.sin(x * 5.13 + 0.3) * 0.15;
    function fovFor(lens) {
      const hf = 2 * Math.atan(18 / lens);
      const asp = camera.aspect;
      return asp >= 1 ? 2 * Math.atan(Math.tan(hf / 2) / asp) * 180 / Math.PI : Math.min(100, 2 * Math.atan(Math.tan(hf / 2) / Math.max(asp, 0.75)) * 180 / Math.PI);
    }

    const controls = new libs.OrbitControls(camera, canvas);
    controls.enableDamping = true; controls.dampingFactor = 0.07;
    controls.screenSpacePanning = true; controls.minDistance = 2; controls.maxDistance = 1600;
    controls.zoomSpeed = 1.1; controls.rotateSpeed = 0.6;
    controls.enabled = false;

    // viewpoints: pos / tgt in three.js (glTF) space, posB / tgtB in Blender space
    const VIEWS = KOB.VIEWS_B.map((v) => ({ name: v.name, cn: v.cn, posB: v.p, tgtB: v.g, lens: v.f, pos: B(v.p).toArray(), tgt: B(v.g).toArray() }));

    /* ── customisation: signs and drones (driven by the control deck, URL and saved settings) ── */
    U.uTickTex.value = world.signMask;
    // custom fleets: any number up to 3, each placed on the map (Blender x, y), altitude, size, facing
    const fleets = new Map();
    const fleetFrame = (o, scale) => {
      const ang = o.angle == null ? Math.atan2(-236 - o.y, 352 - o.x) : o.angle * Math.PI / 180;
      return frameAt([o.x, o.y, o.alt], [o.x + Math.cos(ang) * 100, o.y + Math.sin(ang) * 100, o.alt], scale);
    };
    function orderFleet(id, snap, dur) {
      const F = fleets.get(id); if (!F) return;
      const o = F.o;
      const shape = o.shape === 'text' ? shapeOf('text', o.text || '万兽之王') : shapeOf(o.shape);
      const scale = o.size * (o.shape === 'text' ? Math.min(1.35, 0.55 + 0.11 * [...(o.text || '')].length) : 0.8);
      // never let the lowest drones of a formation sink towards the ground or behind the roof line
      if (shape.minY == null) shape.minY = shape.pts.reduce((m, p) => Math.min(m, p[1]), 1e9);
      const fr = fleetFrame(o, scale);
      const floor = Math.hypot(o.x / 180, o.y / 200) < 1.25 ? 92 : 30;
      if (o.alt + shape.minY * scale < floor) fr.centre.y += floor - (o.alt + shape.minY * scale);
      // beast portraits keep the colours of their artwork
      F.fleet.order(shape, fr, fxT, { dur: snap ? 0 : (dur || 5), col: shape.cols ? null : (o.color || shape.col), lift: 16 });
      F.fleet.setLook(o.on ? 1 : 0, o.effect);
    }
    function applyVenue() {
      const v = custom.venue;
      if (v.follow) { venueIdx = -1; return; }
      const shape = v.shape === 'text' ? shapeOf('text', v.text || '万兽之王') : shapeOf(v.shape);
      const fr = venueFrame(v.shape); if (v.shape === 'text') fr.scale = Math.min(95, 40 + 9 * [...(v.text || '')].length);
      fleetA.order(shape, fr, fxT, { dur: 4.5, col: shape.cols ? null : (v.color || shape.col) });
    }
    const pool = [fleetB];
    const customApi = {
      state: custom,
      addSign(id, o) { world.addSign(id, o, fxT); },
      updateSign(id, o) { world.updateSign(id, o, fxT); },
      removeSign(id) { world.removeSign(id); },
      setTicker(o) { world.setTicker(o); if (o.color) U.uTickCol.value.set(o.color[0], o.color[1], o.color[2]); },
      addFleet(id, o) {
        if (fleets.has(id) || fleets.size >= 3) return false;
        let fl = pool.find((p) => ![...fleets.values()].some((F) => F.fleet === p));
        if (!fl) { fl = KOB.fx.makeFleet(THREE, ctx, droneN, { seed: 23 + pool.length * 17, size: 0.85 }); pool.push(fl); }
        fl.points.visible = true;
        fleets.set(id, { fleet: fl, o: Object.assign({ shape: 'text', text: '万兽之王', color: [1, 0.62, 0.22], effect: 1, on: true, x: -96, y: -98, alt: 118, size: 100, angle: null }, o) });
        orderFleet(id, false, 6);
        return true;
      },
      updateFleet(id, o) {
        const F = fleets.get(id); if (!F) return;
        const moved = ['shape', 'text', 'x', 'y', 'alt', 'size', 'angle'].some((k) => k in o && o[k] !== F.o[k]);
        const recol = o.color && String(o.color) !== String(F.o.color);
        const reform = ['shape', 'text'].some((k) => k in o && o[k] !== F.o[k]);
        Object.assign(F.o, o);
        if (moved) orderFleet(id, false, reform ? 5 : 3.5);
        else if (recol) F.fleet.setColour(o.color, fxT);
        F.fleet.setLook(F.o.on ? 1 : 0, F.o.effect);
      },
      removeFleet(id) { const F = fleets.get(id); if (!F) return; F.fleet.setLook(0, 0); F.fleet.points.visible = false; fleets.delete(id); },
      setVenue(o) { Object.assign(custom.venue, o); if ('follow' in o || 'shape' in o || 'text' in o) applyVenue(); else if (o.color && !custom.venue.follow) fleetA.setColour(o.color, fxT); },
      // fly the camera to look at an item, framed with the Nest behind it where possible
      watch(kind, id) {
        let x, y, z, size;
        if (kind === 'sign') { const sg = world.signs.get(id); if (!sg) return; x = sg.o.x; y = sg.o.y; z = sg.o.lift + sg.o.height * 0.6; size = sg.o.height * 5.3 * 1.2; }
        else if (kind === 'fleet') { const F = fleets.get(id); if (!F) return; x = F.o.x; y = F.o.y; z = F.o.alt; size = F.o.size * 1.6; }
        else { app.flyTo(0); return; }
        const ang = kind === 'sign' ? (world.signs.get(id).o.angle == null ? Math.atan2(-236 - y, 352 - x) : world.signs.get(id).o.angle * Math.PI / 180)
          : (fleets.get(id).o.angle == null ? Math.atan2(-236 - y, 352 - x) : fleets.get(id).o.angle * Math.PI / 180);
        const d = Math.max(40, size * 1.25);
        app.flyToPose(B([x + Math.cos(ang) * d, y + Math.sin(ang) * d, Math.max(4, z * 0.35 + 3)]), B([x, y, z]), 28);
      },
      // for the dashboard map: the camera in Blender coordinates
      camera() { const p = camera.position; const d = camera.getWorldDirection(new V3()); return { x: p.x, y: -p.z, z: p.y, yaw: Math.atan2(-d.z, d.x), fov: 2 * Math.atan(Math.tan(camera.fov * Math.PI / 360) * camera.aspect) }; },
      fleetList: () => fleets,
    };

    /* ── runtime state ───────────────────────────────────────────────── */
    const app = {
      mode: 'play', paused: false, VIEWS, flyKeys: new Set(), custom: customApi,
    };
    let showT = P.chapter ? KOB.CHAPTERS[Math.round(P.chapter) - 1].t : (P.t || 0) % TOTAL;
    let fxT = 1000;
    let lastShow = showT;
    let S = KOB.makeState();
    let events = KOB.buildEvents(P.seed, P.fireworks);
    events.forEach((e) => { e.fireT = e.type === 'firework' ? e.t - (e.kind === 'comet' ? 2.2 : 1.8 + (e.h - 90) / 80 * 0.9) : e.t; });
    events.sort((a, b) => a.fireT - b.fireT);
    let shake = 0;
    let lens = 30;
    const camPos = new V3(), camTgt = new V3(), dirP = new V3(), dirG = new V3();
    let blend = null;          // free → play blend
    let fly = null;            // free-mode viewpoint flight
    let viewIdx = -1;
    let idleT = 0;
    const prevVP = new THREE.Matrix4();
    let fade = 0;

    /* events ---------------------------------------------------------- */
    const flameV = (b) => B(b);
    function fireEvent(e, tf, distTo) {
      switch (e.type) {
        case 'firework': {
          const tb = fireworks.launch(tf, e, B);
          if (KOBAudio.isOn()) { const d = camera.position.distanceTo(B([e.from[0], e.from[1], e.h])); KOBAudio.fx('launch', 0, 0, 0.6); KOBAudio.fx('boom', tb - tf, d, 1); }
          break;
        }
        case 'flames': {
          let list = [];
          if (e.idx) list = e.idx.map((k) => KOB.FLAME_POS[k]);
          else if (e.which === 'front') list = KOB.FLAME_POS.slice(0, 8);
          else if (e.which === 'back') list = KOB.FLAME_POS.slice(8);
          else list = KOB.FLAME_POS;
          for (const p of list) pyro.add(tf, e.dur || 1, 'flame', flameV(p), 230);
          shake += 0.25;
          if (KOBAudio.isOn()) KOBAudio.fx('whoosh', 0, camera.position.distanceTo(flameV(list[0])) * 0.3, 0.9);
          break;
        }
        case 'towerFlames': for (const p of KOB.TOWER_FLAME_POS[e.tower]) pyro.add(tf, e.dur || 1, 'flame', flameV(p), 230); shake += 0.2; if (KOBAudio.isOn()) KOBAudio.fx('whoosh', 0, 30, 0.8); break;
        case 'co2': {
          const list = e.which === 'front' ? KOB.CO2_POS.slice(0, 6) : KOB.CO2_POS;
          for (const p of list) pyro.add(tf, 0.9, 'co2', flameV(p), 110);
          if (KOBAudio.isOn()) KOBAudio.fx('hiss', 0, 20, 0.9);
          break;
        }
        case 'confetti': pyro.burstConfetti(tf, e.n || 3000, B); if (KOBAudio.isOn()) KOBAudio.fx('cheer', 0, 0, 0.8); break;
        case 'gerbRing': {
          for (let k = 0; k < 16; k++) {
            const a = k / 16 * Math.PI * 2;
            const p = B([28 * Math.cos(a) * 1.0, 40 * Math.sin(a), 41.6]);
            pyro.add(tf, 2.6, 'gerb', p, 120, { dir: new V3(p.x, 25, p.z).normalize() });
          }
          break;
        }
        case 'lakeFire': {
          const n = LAKE_FIRE.length;
          for (let k = 0; k < n; k++) pyro.add(tf + (e.pat === 'all' ? (k % 2) * 0.12 : k * 0.11), e.pat === 'all' ? 0.8 : 0.5, 'flame', LAKE_FIRE[k], 150);
          if (KOBAudio.isOn()) KOBAudio.fx('whoosh', 0, camera.position.distanceTo(LAKE_FIRE[0]) * 0.3, 0.8);
          break;
        }
        case 'iron': for (const p of IRON_POS) pyro.add(tf, e.dur || 8, 'iron', p, 0); break;
        case 'vortex': {
          const list = e.corner == null ? DECK_CORNER : [DECK_CORNER[e.corner]];
          for (const p of list) pyro.add(tf, e.dur || 2.8, 'vortex', p, 260);
          shake += 0.2;
          if (KOBAudio.isOn()) KOBAudio.fx('whoosh', 0, 25, 0.9);
          break;
        }
        case 'fireRing': {
          // two laps of fire chasing round the deck rim
          const n = RING_POS.length;
          for (let lap = 0; lap < 2; lap++) for (let k = 0; k < n; k++) pyro.add(tf + (lap * n + k) * 0.04, 0.42, 'flame', RING_POS[k], 170);
          shake += 0.25;
          if (KOBAudio.isOn()) KOBAudio.fx('whoosh', 0, 20, 0.9);
          break;
        }
        case 'statueGerbs': {
          const idx = e.pair === 'north' ? [0, 1] : [2, 3];
          for (const k of idx) for (let s = -1; s <= 1; s += 2) {
            const p = statueSrc[k].clone().add(new V3(s * 7, -0.2, 0));
            pyro.add(tf, e.dur || 3, 'fountain', p, 220);
          }
          break;
        }
      }
    }
    function processEvents(t0, t1, tf) {
      // events whose fire time falls in (t0, t1]; handles the loop wrap
      const run = (a, b) => { for (const e of events) { if (e.fireT > a && e.fireT <= b) fireEvent(e, tf - (b - e.fireT)); } };
      if (t1 >= t0) run(t0, t1); else { run(t0, TOTAL); run(-1, t1); }
    }

    /* manual triggers (FX desk) --------------------------------------- */
    let manual = { strobe: 0, lasers: 0, surge: 0 };
    app.trigger = function (k) {
      const tf = fxT;
      const R = Math.random;
      if (k === 'fireworks') {
        const kinds = ['peony', 'chrys', 'willow', 'ring', 'glitter', 'brocade', 'palm'];
        const cols = Object.values(KOB.COLORS);
        for (let i = 0; i < 9; i++) { const a = R() * Math.PI * 2; const from = R() < 0.5 ? [150 * Math.cos(a), 168 * Math.sin(a), 72] : [(R() - 0.5) * 100, (R() - 0.5) * 160, 1]; fireEvent({ type: 'firework', from, h: 100 + R() * 60, kind: kinds[i % kinds.length], col: cols[Math.floor(R() * cols.length)], n: 200 }, tf + i * 0.18); }
      } else if (k === 'flames') fireEvent({ type: 'flames', which: 'all', dur: 1.6 }, tf);
      else if (k === 'co2') fireEvent({ type: 'co2', which: 'all' }, tf);
      else if (k === 'confetti') fireEvent({ type: 'confetti', n: 4000 }, tf);
      else if (k === 'waterfall') manual.waterfall = 6;
      else if (k === 'strobe') manual.strobe = 1.2;
      else if (k === 'lasers') manual.lasers = 8;
      else if (k === 'surge') manual.surge = 8;
      else if (SFX[k]) {
        // the build-12 set pieces: shots fire now, cues run for a while from the desk
        if (k === 'shock') sfxShock.push(tf);
        else if (k === 'lakeFire') fireEvent({ type: 'lakeFire', pat: R() < 0.5 ? 'all' : 'chase' }, tf);
        else if (k === 'iron') fireEvent({ type: 'iron', dur: 7 }, tf);
        else if (k === 'vortex') fireEvent({ type: 'vortex', dur: 3 }, tf);
        else if (k === 'fireRing') fireEvent({ type: 'fireRing' }, tf);
        else {
          if (k === 'holo') sfxBeast = (sfxBeast + 1) % 4;
          if (k === 'city') sfxCityWave = tf;
          sfxMan[k] = SFX_RUN;
        }
      }
      shake += 0.15;
    };

    /* modes ------------------------------------------------------------ */
    app.setMode = function (m) {
      if (m === app.mode) return;
      app.mode = m;
      ui.setMode(m);
      if (m === 'free') {
        controls.target.copy(camTgt);
        controls.enabled = true;
        controls.update();
        idleT = 0; fly = null;
        if (app.paused) app.togglePause();
        ui.toast('Explore · the show keeps running');
        setCrop(false);
      } else {
        setCrop(true, 1400);
        controls.enabled = false;
        blend = { t0: performance.now(), p: camera.position.clone(), g: controls.target.clone(), f: lens };
        viewIdx = -1; ui.setView(-1);
        ui.toast('Back to the show');
      }
    };
    app.togglePause = function () { app.paused = !app.paused; ui.setPaused(app.paused); };
    app.seek = function (t) { const old = showT; showT = ((t % TOTAL) + TOTAL) % TOTAL; resetFx(); preroll(5); lastShow = showT; };
    app.chapterStep = function (d) { const c = KOB.chapterAt(showT); const n = Math.min(KOB.CHAPTERS.length - 1, Math.max(0, c + d)); app.seek(KOB.CHAPTERS[n].t + 0.01); };
    app.flyTo = function (i, immediate) {
      const v = VIEWS[i]; if (!v) return;
      if (app.mode !== 'free') app.setMode('free');
      app.tour(false);
      viewIdx = i; ui.setView(i);
      const p = new V3(...v.pos), g = new V3(...v.tgt);
      if (immediate) { camera.position.copy(p); controls.target.copy(g); lens = v.lens; fly = null; controls.update(); return; }
      fly = { t0: performance.now(), dur: 2600, p0: camera.position.clone(), g0: controls.target.clone(), f0: lens, p1: p, g1: g, f1: v.lens };
    };
    // fly the free camera to an arbitrary pose (used by the deck's "watch it" buttons)
    app.flyToPose = function (p, g, lensMm) {
      if (app.mode !== 'free') app.setMode('free');
      viewIdx = -1; ui.setView(-1);
      fly = { t0: performance.now(), dur: 3200, p0: camera.position.clone(), g0: controls.target.clone(), f0: lens, p1: p.clone(), g1: g.clone(), f1: lensMm || 30 };
    };
    app.toggleSound = function () { const on = KOBAudio.enable(!KOBAudio.isOn()); ui.setSound(on); if (on) KOBAudio.setVolume(P.volume); };
    const QUAL_ORDER = ['auto', 'low', 'medium', 'high', 'ultra'];
    let autoQ = P.quality === 'auto';
    app.setQuality = function (name) {
      autoQ = name === 'auto';
      dynScale = 1;
      applyTier(autoQ ? detected : name);
      ui.setQuality(name, quality); ui.toast('Quality · ' + (autoQ ? 'auto (' + quality + ')' : name));
    };
    app.cycleQuality = function () {
      const cur = autoQ ? 'auto' : quality;
      const next = QUAL_ORDER[(QUAL_ORDER.indexOf(cur) + 1) % QUAL_ORDER.length];
      autoQ = next === 'auto';
      dynScale = 1;
      applyTier(autoQ ? detected : next);
      ui.setQuality(next, quality); ui.toast('Quality · ' + (autoQ ? 'auto (' + quality + ')' : next));
    };

    /* build-12 set pieces run from the desk --------------------------- */
    const SFX_RUN = 14;
    const sfxMan = {}, sfxShock = [];
    let sfxBeast = 0, sfxCityWave = -1e3;     // the first press shows the lion, then the others in turn
    const sfxEnv = (id) => { const r = sfxMan[id]; return r > 0 ? Math.min(1, (SFX_RUN - r) / 1.2) * Math.min(1, r / 1.8) : 0; };
    app.sfxLevel = function (id) {
      if (!S || !S.sfx) return 0;
      if (SFX[id] && SFX[id].type === 'shot') return 0;
      if (id === 'hyper') return Math.max(S.lasers.hyper, sfxEnv(id));
      if (id === 'blimp' || id === 'lotus' || id === 'flies') return 1;     // always out there; the desk turns them up
      return Math.max(S.sfx[id] || 0, sfxEnv(id));
    };
    function stepSfx(dt) {
      const X = S.sfx;
      for (const id in sfxMan) sfxMan[id] = Math.max(0, sfxMan[id] - dt);
      for (const id of ['halo', 'ball', 'holo', 'rain', 'snow', 'galaxy', 'card', 'lanterns', 'aurora', 'proj', 'city']) X[id] = Math.max(X[id], sfxEnv(id));
      const ballM = sfxEnv('ball'); if (ballM > 0) X.ballDrop = Math.max(X.ballDrop, Math.min(1, (SFX_RUN - sfxMan.ball) / 3));
      if (sfxEnv('holo') > 0) { X.holoBeast = sfxBeast; X.holoReveal = Math.max(X.holoReveal, Math.min(1, (SFX_RUN - sfxMan.holo) / 3)); }
      // ambient outside rigs: the desk turns them up
      X.lotus = 1 + 0.8 * sfxEnv('lotus'); X.flies = 1 + 1.2 * sfxEnv('flies');
      X.blimp = sfxEnv('blimp');
      S.lasers.hyper = Math.max(S.lasers.hyper, sfxEnv('hyper'));
      // shockwave: the two most recent rings, cue or desk (fx clock)
      const cue = (h) => (h > -1e2 ? fxT - (showT - h) : -1e3);
      const list = [cue(X.shockA), cue(X.shockB)];
      for (let i = sfxShock.length - 1; i >= 0; i--) { if (fxT - sfxShock[i] > 5 || sfxShock[i] > fxT + 1) sfxShock.splice(i, 1); else list.push(sfxShock[i]); }
      list.sort((a, b) => b - a);
      U.uShock.value.set(list[0], list[1], 1, 0);
      U.uCity.value.set(X.city, Math.max(cue(X.cityWave), sfxCityWave), 0, 0);
      sfx.setCardText(world.signText());
      sfx.update(X, dt, fxT, camera, world.ticker.text);
    }

    /* the tour: fly to each set piece in turn, fire it and caption it (Explore mode; any touch
       of the camera, a key or the 演出 tab ends it) */
    const TOUR_HOLD = { shot: 8, level: 10 };
    let tour = null;
    app.tourOn = () => !!tour;
    app.tour = function (on) {
      if (on == null) on = !tour;
      if (!on) { if (tour) { tour = null; ui.tour(null); } return; }
      if (app.mode !== 'free') app.setMode('free');
      tour = { i: -1 };
      tourNext();
    };
    app.tourSkip = () => { if (tour) tourNext(); };
    function tourNext() {
      const prev = KOB.SFX_LIST[tour.i];
      if (prev && sfxMan[prev.id] > 1.8) sfxMan[prev.id] = 1.8;      // let the last one fade, not linger
      const e = KOB.SFX_LIST[++tour.i];
      if (!e) { tour = null; ui.tour(null); ui.toast('特效巡礼结束 · Tour complete'); return; }
      Object.assign(tour, { t: 0, shots: 0, hold: TOUR_HOLD[e.type] });
      if (e.id === 'blimp') {
        // meet the blimp on its low pass: wait ahead of it on its orbit, then follow it by
        const a = sfx.blimpAngle() + 0.62;
        app.flyToPose(new V3(262 * Math.cos(a), 34, -262 * Math.sin(a)), new V3(180 * Math.cos(a - 0.3), 70, -180 * Math.sin(a - 0.3)), 24);
      } else {
        const v = e.v;
        app.flyToPose(B(v.slice(0, 3)), B(v.slice(3, 6)), v[6]);
      }
      if (e.type === 'level') app.trigger(e.id);                         // ramps up while the camera flies in
      ui.tour(e, tour.i, KOB.SFX_LIST.length);
    }
    function stepTour(dt) {
      if (!tour) return;
      if (app.mode !== 'free') { app.tour(false); return; }
      const e = KOB.SFX_LIST[tour.i];
      tour.t += dt;
      // one-off shots go off once the camera has arrived, and again for a second look
      if (e.type === 'shot' && tour.shots < 2 && tour.t > (tour.shots ? (e.id === 'iron' ? 99 : 5.2) : 2.9)) { app.trigger(e.id); tour.shots++; }
      if (e.id === 'blimp' && !fly) controls.target.lerp(sfx.parts.blimp.position, Math.min(1, dt * 3));
      ui.tourProgress(tour.t / tour.hold);
      if (tour.t > tour.hold) tourNext();
    }

    function resetFx() {
      fleetSnap = true;
      for (const k in sfxMan) sfxMan[k] = 0;
      sfxShock.length = 0; sfxCityWave = -1e3;
      for (const k in pools) pools[k].clear();
      pyro.clear();
      fireworks.shells.length = 0;
    }

    /* ── per-frame show update (no rendering) ────────────────────────── */
    const ledAvg = [0, 0, 0];
    const tmpC = new THREE.Color();
    const sceneAvg = (s, out, beast) => {
      if (s === 8) { const a = artAvgTower[beast || 0]; out[0] = a[0] * 0.9; out[1] = a[1] * 0.9; out[2] = a[2] * 0.9; return out; }
      const A = S.palA, Bc = S.palB, C = S.palC, bp = S.beatPulse;
      let r, g, b;
      switch (s) {
        case 0: r = A[0] * 0.05; g = A[1] * 0.05; b = A[2] * 0.05; break;
        case 1: r = (A[0] + Bc[0]) * 0.22; g = (A[1] + Bc[1]) * 0.22; b = (A[2] + Bc[2]) * 0.22; break;
        case 2: r = Bc[0] * 0.18 + (A[0] + C[0]) * 0.14; g = Bc[1] * 0.18 + (A[1] + C[1]) * 0.14; b = Bc[2] * 0.18 + (A[2] + C[2]) * 0.14; break;
        case 3: r = A[0] * 0.2 + C[0] * 0.15 * bp; g = A[1] * 0.2 + C[1] * 0.15 * bp; b = A[2] * 0.2 + C[2] * 0.15 * bp; break;
        case 4: r = artAvgBox[0] * 1.2; g = artAvgBox[1] * 1.2; b = artAvgBox[2] * 1.2; break;
        case 5: r = 0.3; g = 0.09; b = 0.015; break;
        case 6: r = Bc[0] * 0.12; g = Bc[1] * 0.12; b = Bc[2] * 0.12; break;
        default: r = 0.85; g = 0.8; b = 0.74;
      }
      out[0] = r; out[1] = g; out[2] = b; return out;
    };
    const sa = [0, 0, 0], sb = [0, 0, 0];
    const LED_GAIN = 3.2;
    // pooled per-frame light lists (no allocations in the frame loop)
    const VL_MAX = 18;
    const vlPool = Array.from({ length: VL_MAX }, () => ({ p: new V3(), c: [0, 0, 0], s: 1 }));
    const vlights = [];
    const vlAdd = (p, r, g, b, s) => { if (vlights.length >= VL_MAX) return; const o = vlPool[vlights.length]; o.p.copy(p); o.c[0] = r; o.c[1] = g; o.c[2] = b; o.s = s; vlights.push(o); };
    const dynPool = Array.from({ length: 6 }, () => ({ p: new V3(), c: [0, 0, 0], w: 0 }));
    let dynN = 0;
    const dynAdd = (p, r, g, b, w) => { if (dynN >= 6) return; const o = dynPool[dynN++]; o.p.copy(p); o.c[0] = r; o.c[1] = g; o.c[2] = b; o.w = w; };
    const heatPool = Array.from({ length: 6 }, () => [0, 0, 0, 0]);
    const heat = [];
    const projV = new V3(), tmpV = new V3(), fwCol = new THREE.Color(), WHITE = new THREE.Color(1, 1, 1);
    const recent = [];
    const flameC = [new V3(), new V3()];
    // static emitter descriptors for the level-driven pyro
    const fountainE = Array.from({ length: 10 }, (_, k) => ({ kind: 'fountain', acc: 0, pos: B([33.6, -40 + k * (80 / 9), 3.3]) }));
    const fallE = [
      { kind: 'waterfall', acc: 0, a: B([19.8, -32.4, 13.4]), b: B([19.8, 32.4, 13.4]), out: new V3(1, 0, 0), k: 900 },
      { kind: 'waterfall', acc: 0, a: B([-19.8, -32.4, 13.4]), b: B([-19.8, 32.4, 13.4]), out: new V3(-1, 0, 0), k: 700 },
      { kind: 'waterfall', acc: 0, a: B([-19.5, 32.8, 13.4]), b: B([19.5, 32.8, 13.4]), out: new V3(0, 0, -1), k: 450 },
      { kind: 'waterfall', acc: 0, a: B([-19.5, -32.8, 13.4]), b: B([19.5, -32.8, 13.4]), out: new V3(0, 0, 1), k: 450 },
    ];
    const emberE = { kind: 'embers', acc: 0 }, titleE = { kind: 'titleEmbers', acc: 0 };
    const boxVL = [B([27, 0, 23.7]), B([-27, 0, 23.7]), B([0, 40, 23.7]), B([0, -40, 23.7])], boxVLk = [24, 18, 13, 13];
    const titleVL = B([0, 0, 48]), domeVL = B([0, 0, 95]), strobeVL = B([36, 0, 9]);
    const FIXN = { tu: TOWER_KEYS.map((k) => 'LT_TowerUp_' + k), bc: ['NE', 'SE', 'SW', 'NW'].map((k) => 'TW_Beacon_' + k) };
    const fixSet = (name, col, k) => { const m = FIX[name]; if (m) { m.emissive.setRGB(col[0], col[1], col[2]); m.emissiveIntensity = k; } };
    const C_WARM = [1, 0.95, 0.9], C_LASER = [0.3, 1, 0.4], C_WASH = [1, 0.9, 0.8], C_FLOOD = [1, 0.97, 0.9], C_BEACON = [1, 0.6, 0.2];
    const gHunt = beams.groups.find((g) => g.name === 'hunt'), gFollow = beams.groups.find((g) => g.name === 'follow');

    const CLOUD_Y = 700;
    const skyGroups = beams.groups.filter((g) => g.name === 'plaza' || g.name === 'ring' || g.name === 'towerUp');
    let spotN = 0;
    function stepShow(dt) {
      // clocks
      const run = app.mode === 'free' || !app.paused;
      const sdt = run ? dt * P.speed : 0;
      lastShow = showT;
      showT += sdt;
      if (showT >= TOTAL) { if (P.loop) showT -= TOTAL; else { showT = TOTAL - 0.001; app.paused = true; ui.setPaused(true); } }
      fxT += sdt;
      ctx.frame++;
      KOB.showState(showT, S);
      app.state = S;

      // manual overrides decay
      for (const k in manual) manual[k] = Math.max(0, manual[k] - dt);
      if (manual.strobe > 0) { S.strobe = Math.max(S.strobe, (Math.floor(fxT * 14) % 2) ? 1 : 0); S.blinder = Math.max(S.blinder, manual.strobe > 1 ? 1 : 0); }
      if (manual.lasers > 0) { S.lasers.crowdFan = Math.max(S.lasers.crowdFan, 1); S.lasers.fieldSheet = Math.max(S.lasers.fieldSheet, 1); S.lasers.tunnel = Math.max(S.lasers.tunnel, 0.8); if (!S.lasers.colFan) S.lasers.colFan = KOB.COLORS.green; }
      if (manual.surge > 0) { S.crowd.surge = Math.max(S.crowd.surge, 1); S.crowd.W[0] = 1; S.crowd.W[1] = 1; S.crowd.level += 0.4; }
      if (manual.waterfall > 0) S.waterfall = 1;

      if (run) processEvents(lastShow, showT, fxT);

      // the corner beast that woke most recently (drives the main-wall gallery and hunt colours)
      let lastTower = 0; for (let j = 0; j < 4; j++) if (S.tower.on[j] > 0) lastTower = j;

      // LED radiance estimate
      sceneAvg(S.led.sceneA, sa, lastTower); sceneAvg(S.led.sceneB, sb, lastTower);
      const cov = Math.min(1, Math.max(0, S.led.ignite));
      const lv = S.led.level * LED_GAIN;
      for (let c = 0; c < 3; c++) ledAvg[c] = ((sa[c] + (sb[c] - sa[c]) * S.led.mix) * cov * lv) + S.led.strobe * 0.9 * lv + (S.led.ignite < 0 ? sa[c] * S.led.standby * LED_GAIN : 0);

      // shared uniforms
      U.uTime.value = fxT;
      U.uBeatPulse.value = S.beatPulse;
      U.uBar.value = S.barPhase;
      U.uPalA.value.fromArray(S.palA); U.uPalB.value.fromArray(S.palB); U.uPalC.value.fromArray(S.palC);
      U.uLedAvg.value.fromArray(ledAvg);
      U.uBoxL.value.fromArray(ledAvg);
      U.uHaze.value = P.haze;
      const cr = S.crowd;
      U.uCrowdA.value.fromArray(cr.A); U.uCrowdB.value.fromArray(cr.B); U.uCrowdC.value.fromArray(cr.C);
      U.uCrowdW.value.fromArray(cr.W); U.uCrowdLevel.value = cr.level * 2.4; U.uCrowdSurge.value = cr.surge; U.uWaveSpeed.value = cr.wave;
      U.uQuad.value.fromArray(cr.quad); U.uPhones.value = cr.phones * 1.6;
      U.uSeatGlow.value = 0.016;
      U.uShowGlow.value = 0.35 + 0.35 * S.energy + (ledAvg[0] + ledAvg[1] + ledAvg[2]) * 0.05;
      U.uFans.value = 0.7 + 0.3 * S.crowd.level;
      U.uFac.value.set(S.facade.level, S.facade.mode, 0, 0); U.uFacA.value.fromArray(S.facade.colA); U.uFacB.value.fromArray(S.facade.colB);
      U.uFo.value.set(S.fountain.level, S.fountain.mode, S.fountain.height, 0); U.uFoA.value.fromArray(S.fountain.colA); U.uFoB.value.fromArray(S.fountain.colB);

      // LED materials
      ledU.uLedLevel.value = lv; ledU.uIgnite.value = S.led.ignite; ledU.uSceneA.value = S.led.sceneA; ledU.uSceneB.value = S.led.sceneB; ledU.uSceneMix.value = S.led.mix;
      ledU.uStrobe.value = S.led.strobe; ledU.uStandby.value = S.led.standby;
      if (towerMats[lastTower]) ledU.uBeastTex.value = towerMats[lastTower].emissiveMap;
      world.setScreen(titleTex, towerMats[lastTower] && towerMats[lastTower].emissiveMap, S.chapter === 5 || S.chapter === 6 ? 1 : 0);
      ledU.uBeastCol.value.fromArray(KOB.TOWER_COL[lastTower]);
      floorU.uFloor.value = S.floor * 1.6;
      for (let i = 0; i < 4; i++) { const m = towerMats[i]; if (!m) continue; const u = m.userData.u; u.uTowerOn.value = S.tower.on[i]; u.uTowerFlash.value = S.tower.flash[i]; u.uTowerLevel.value = 2.4; }
      titleU.uTitleOn.value = S.title; titleU.uTitleFlare.value = S.titleFlare;
      chaseU.uChaseCol.value.fromArray(S.palA); chaseU.uChaseLevel.value = S.deckEdge * 1.4;
      if (MATS.TR_Membrane_PTFE) MATS.TR_Membrane_PTFE.emissive.setRGB(S.palA[0], S.palA[1], S.palA[2]).multiplyScalar(0.025 * S.canopy * (0.6 + 0.4 * S.beatPulse) + 0.004);
      // fixtures glow with their beams
      for (let i = 0; i < 4; i++) fixSet(FIXN.tu[i], C_WARM, 0.3 + 6 * S.beams.towerUp.level * S.beams.towerUp.towerMask[i]);
      fixSet('LT_DeckStrobe_80', S.beams.deck.col, 0.3 + 5 * S.beams.deck.level + 30 * S.strobe);
      fixSet('LT_RoofWash_480', S.palA, 0.3 + 4 * S.beams.rig.level);
      fixSet('LT_Laser_40', C_LASER, 0.2 + 3 * Math.max(S.lasers.crowdFan, S.lasers.fieldSheet));
      fixSet('LT_FaceWash_Top_120', C_WASH, 0.4 + 2 * S.led.level);
      fixSet('LT_FaceWash_Bottom_120', C_WASH, 0.4 + 2 * S.led.level);
      fixSet('LB_Head_Lens_Group', S.beams.boom.col, 0.4 + 6 * S.beams.boom.level);
      fixSet('ST_RoofFloodlight_Lens', C_FLOOD, 0.15 + 8 * Math.max(S.floods, S.beams.ring.level * 0.6));
      fixSet('BD_Edge_Lamps', S.palC, 0.5 + 3 * S.beatPulse);
      for (let i = 0; i < 4; i++) fixSet(FIXN.bc[i], C_BEACON, 1 + 6 * S.tower.on[i]);

      // three.js lights
      deckWash.intensity = 250 + 900 * S.led.level;
      deckWash.color.setRGB(1, 0.9, 0.78);
      floods.intensity = 1.6 * S.floods;

      // effects
      performer.update(showT, S, camera.position);
      kinetic.set(S.kinetic.level, S.kinetic.mode);
      beams.update(S, dt, fxT);
      // where the sky beams meet the cloud deck (lit pools on the clouds)
      spotN = 0;
      for (const g of skyGroups) {
        for (let i = 0; i < g.n && spotN < 12; i++) {
          const j = g.off + i, I = beams.aP.array[j * 4 + 3], dy = g.cur[i * 3 + 1];
          if (I < 0.05 || dy < 0.3) continue;
          const o = g.origins[i], t = (CLOUD_Y - o.y) / dy;
          const sp = postP.spots[spotN], sc = postP.spotC[spotN];
          sp[0] = o.x + g.cur[i * 3] * t; sp[1] = o.z + g.cur[i * 3 + 2] * t; sp[2] = 18 + t * Math.tan(g.half * Math.PI / 180) * 1.6;
          const k = I * (g.name === 'plaza' ? 0.05 : 0.02), cc = beams.aC.array;
          sc[0] = cc[j * 3] * k; sc[1] = cc[j * 3 + 1] * k; sc[2] = cc[j * 3 + 2] * k;
          spotN++;
        }
      }
      postP.spotN = spotN;
      stepSfx(dt);
      lasers.update(S, fxT);
      // fleets
      if (custom.venue.follow) {
        const D = S.drones, target = (D.k > 0 ? D.formation + 1 : D.formation) % SHOW_FORMS.length;
        if (target !== venueIdx || fleetSnap) { venueIdx = target; const nm = SHOW_FORMS[target]; fleetA.order(shapeOf(nm), venueFrame(nm), fxT, { dur: fleetSnap ? 0 : 4.2 }); }
        fleetA.setLook(D.level, 1);
      } else fleetA.setLook(1, custom.venue.effect);
      if (fleetSnap) { for (const id of fleets.keys()) orderFleet(id, true); fleetSnap = false; }
      world.tick(fxT);
      U.uTick.value.x += ((world._ticker ? 1 : 0) - U.uTick.value.x) * Math.min(1, dt * 2);

      // continuous pyro
      const fdt = sdt;
      if (fdt > 0) {
        pyro.update(fxT, fdt);
        if (S.fountains > 0) for (const e of fountainE) pyro.continuous(e, 130 * S.fountains, fxT, fdt);
        if (S.waterfall > 0) for (const e of fallE) pyro.continuous(e, e.k * S.waterfall, fxT, fdt);
        pyro.continuous(emberE, 40 * S.embers, fxT, fdt);
        if (S.titleEmbers > 0) pyro.continuous(titleE, 60 * S.titleEmbers, fxT, fdt);
      }
      fireworks.prune(fxT);

      /* custom light rig ------------------------------------------------- */
      kln = 0; vlights.length = 0; dynN = 0;
      // corner towers
      for (let i = 0; i < 4; i++) {
        const on = S.tower.on[i]; if (on <= 0) continue;
        const c = KOB.TOWER_COL[i], a = artAvgTower[i];
        klPoint(towerCentres[i], a[0] * 0.6 + c[0] * 0.4, a[1] * 0.6 + c[1] * 0.4, a[2] * 0.6 + c[2] * 0.4, on * 520 * (1 + S.tower.flash[i]), 120);
      }
      // fireworks: the most recent bursts
      recent.length = 0;
      for (let i = fireworks.shells.length - 1; i >= 0 && recent.length < Q.fw; i--) { const sh = fireworks.shells[i]; if (fxT >= sh.t && fxT - sh.t < 2.6) recent.push(sh); }
      for (const sh of recent) {
        const age = fxT - sh.t;
        const k = (age < 0.08 ? age / 0.08 : Math.exp(-(age - 0.08) * 1.6)) * sh.power;
        fwCol.setRGB(sh.col[0] * 0.7 + 0.3, sh.col[1] * 0.7 + 0.3, sh.col[2] * 0.7 + 0.3).lerp(WHITE, 0.45);
        klPoint(sh.pos, fwCol.r, fwCol.g, fwCol.b, 7000 * k, 600);
        vlAdd(sh.pos, fwCol.r * k * 2.5, fwCol.g * k * 2.5, fwCol.b * k * 2.5, 0.6);
        dynAdd(sh.pos, fwCol.r * k, fwCol.g * k, fwCol.b * k, 350);
      }
      // flame clusters (two groups) + heat shimmer
      heat.length = 0;
      const fl = pyro.flames;
      if (fl.length) {
        const half = Math.ceil(fl.length / 2);
        for (let g = 0; g < 2; g++) {
          const i0 = g * half, i1 = Math.min(fl.length, i0 + half), n = i1 - i0;
          if (n <= 0) continue;
          const c = flameC[g].set(0, 0, 0);
          for (let i = i0; i < i1; i++) c.add(fl[i].pos);
          c.multiplyScalar(1 / n); c.y += 5;
          const nn = Math.min(n, 4);      // a row of twenty jets must not turn the air orange
          klPoint(c, 1, 0.54, 0.19, 2600 * Math.min(3, n) * (0.85 + 0.15 * Math.sin(fxT * 40)), 70);
          vlAdd(c, 0.7 * nn, 0.24 * nn, 0.04 * nn, 1);
          dynAdd(c, 1.0, 0.42, 0.1, 35 * Math.min(4, n));
        }
        for (let i = 0; i < fl.length && heat.length < 6; i++) {
          const e = fl[i];
          projV.copy(e.pos); projV.y += 7; projV.project(camera);
          if (projV.z < 1 && Math.abs(projV.x) < 1.3 && Math.abs(projV.y) < 1.3) {
            const d = camera.position.distanceTo(e.pos), hp = heatPool[heat.length];
            hp[0] = projV.x * 0.5 + 0.5; hp[1] = projV.y * 0.5 + 0.5; hp[2] = Math.min(0.25, 6 / Math.max(d, 1)); hp[3] = 1;
            heat.push(hp);
          }
        }
      }
      // strobes / blinders at the stage front
      const sbk = Math.max(S.strobe, S.blinder * 0.8);
      klPoint(strobeVL, 1, 1, 1, 16000 * sbk, 150);
      // throne uplight, statue uplights
      klSpot(throneSrc, throneDir, 1, 0.76, 0.48, 2600 * S.beams.throne * (0.85 + 0.3 * S.beatPulse), 26, 0.42, 0.17);
      if (S.beams.statue > 0) for (let i = 0; i < 4; i++) klSpot(statueSrc[i], statueDir[i], 1, 0.85, 0.63, 4000 * S.beams.statue, 32, 0.62, 0.3);
      // follow spots + moving-head hunters, coupled to their beams
      if (S.beams.follow.level > 0) for (let i = 0; i < gFollow.n; i++) { beams.dirOf(gFollow, i, tmpV); klSpot(gFollow.origins[i], tmpV, 1, 0.96, 0.9, 40000 * S.beams.follow.level, 290, 0.035, 0.022); }
      if (S.beams.hunt.level > 0) for (let i = 0; i < Math.min(gHunt.n, Q.hunters); i++) {
        beams.dirOf(gHunt, i, tmpV);
        const col = gHunt.colFn ? gHunt.colFn(i, S, fxT) : C_WARM;
        klSpot(gHunt.origins[i], tmpV, col[0], col[1], col[2], 14000 * S.beams.hunt.level, 250, 0.05, 0.03);
      }
      U.uKLN.value = kln;

      // smoke lighting from the same dynamic lights
      for (let i = 0; i < 6; i++) {
        if (i < dynN) { const v = dynPool[i]; U.uDynPos.value[i].set(v.p.x, v.p.y, v.p.z, v.w); U.uDynCol.value[i].set(v.c[0], v.c[1], v.c[2]); }
        else { U.uDynPos.value[i].set(0, -1000, 0, 0); U.uDynCol.value[i].set(0, 0, 0); }
      }
      // in-scatter sources: the LED box faces, towers, title, dome, strobe
      for (let i = 0; i < 4; i++) vlAdd(boxVL[i], ledAvg[0] * boxVLk[i], ledAvg[1] * boxVLk[i], ledAvg[2] * boxVLk[i], 0.9);
      for (let i = 0; i < 4; i++) { const on = S.tower.on[i] * 6 * (1 + S.tower.flash[i]); if (on <= 0) continue; const tc = KOB.TOWER_COL[i]; vlAdd(towerCentres[i], tc[0] * on, tc[1] * on, tc[2] * on, 1); }
      if (S.title > 0) vlAdd(titleVL, 14 * S.title * (1 + S.titleFlare * 3), 4.5 * S.title, 0.8 * S.title, 1);
      { const e = 0.6 + 0.6 * S.energy; vlAdd(domeVL, S.palA[0] * 11 * e + ledAvg[0] * 8, S.palA[1] * 11 * e + ledAvg[1] * 8, S.palA[2] * 11 * e + ledAvg[2] * 8, 1.6); }
      if (sbk > 0) vlAdd(strobeVL, sbk * 17, sbk * 16.5, sbk * 15.6, 1);
      shake = Math.min(1.5, shake + S.blinder * dt * 2);
      shake *= Math.exp(-dt * 3.5);

      // pools upload
      for (const k in pools) pools[k].flush();
      if (KOBAudio.isOn()) KOBAudio.sync(showT, run, P.speed, S.energy, Math.min(1, S.crowd.level * 0.6 + S.crowd.surge * 0.5));
    }

    /* ── camera update ───────────────────────────────────────────────── */
    const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
    const fwd = new V3(), right = new V3(), upv = new V3(0, 1, 0);
    function stepCamera(dt, now) {
      const d = director(showT, dirP, dirG);
      const sh = P.shake;
      // handheld drift (always on, scaled per key)
      const hh = d.hh * sh, tt = fxT;
      dirP.x += nz(tt * 0.37) * hh; dirP.y += nz(tt * 0.29 + 3.1) * hh * 0.7; dirP.z += nz(tt * 0.33 + 7.7) * hh;
      dirG.x += nz(tt * 0.31 + 1.3) * hh * 1.6; dirG.y += nz(tt * 0.27 + 5.2) * hh * 1.2; dirG.z += nz(tt * 0.35 + 9.4) * hh * 1.6;
      // impact shake
      const s = shake * sh;
      dirG.x += nz(tt * 13.1) * s * 0.6; dirG.y += nz(tt * 11.7 + 4) * s * 0.6;

      if (app.mode === 'play') {
        if (blend) {
          const k = ease(Math.min(1, (now - blend.t0) / 2600));
          camPos.copy(blend.p).lerp(dirP, k); camTgt.copy(blend.g).lerp(dirG, k); lens = blend.f + (d.f - blend.f) * k;
          if (k >= 1) blend = null;
        } else { camPos.copy(dirP); camTgt.copy(dirG); lens = d.f; }
        camera.position.copy(camPos);
        camera.up.set(0, 1, 0);
        camera.lookAt(camTgt);
        camera.rotateZ(nz(tt * 0.21 + 2) * 0.004 * sh * (d.hh / 0.25));
      } else {
        // free camera: orbit + fly + viewpoint flights
        if (fly) {
          const k = ease(Math.min(1, (now - fly.t0) / fly.dur));
          const lift = Math.sin(Math.PI * k) * Math.min(60, fly.p0.distanceTo(fly.p1) * 0.25);
          camera.position.copy(fly.p0).lerp(fly.p1, k); camera.position.y += lift;
          controls.target.copy(fly.g0).lerp(fly.g1, k);
          lens = fly.f0 + (fly.f1 - fly.f0) * k;
          if (k >= 1) fly = null;
        }
        const K = app.flyKeys;
        if (K.size) {
          const sp = (K.has('shift') ? 90 : 24) * dt;
          camera.getWorldDirection(fwd); right.crossVectors(fwd, upv).normalize();
          const mv = new V3();
          if (K.has('w')) mv.add(fwd); if (K.has('s')) mv.sub(fwd);
          if (K.has('d')) mv.add(right); if (K.has('a')) mv.sub(right);
          if (K.has('e')) mv.y += 1; if (K.has('q')) mv.y -= 1;
          if (mv.lengthSq() > 0) { mv.normalize().multiplyScalar(sp); camera.position.add(mv); controls.target.add(mv); fly = null; idleT = 0; }
        }
        controls.update();
        if (camera.position.y < 1.2) { const dy = 1.2 - camera.position.y; camera.position.y += dy; controls.target.y += dy; }
        camTgt.copy(controls.target);
        // gentle breathing even in free mode so it never looks like a static render
        camera.rotateZ(nz(tt * 0.21 + 2) * 0.0015 * sh);
        // free mode is locked: it never hands the camera back to the show by itself
        idleT += dt;
      }
      camera.fov = fovFor(lens);
      // dynamic near plane: precision where it matters without a logarithmic depth buffer
      camera.near = Math.min(2.5, Math.max(0.4, camera.position.y * 0.04));
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      const vfov = camera.fov * Math.PI / 180;
      U.uPxWorld.value = 2 * Math.tan(vfov / 2) / RH;
      U.uPxScale.value = RH / (2 * Math.tan(vfov / 2));
    }

    /* ── render ──────────────────────────────────────────────────────── */
    let lastVP = null;
    const curVP = new THREE.Matrix4();
    const postP = { prevVP: null, exposure: 1, bloom: 1, flare: 1, grain: 1, haze: 1, dof: true, dofTaps: 20, mblur: true, focus: 50, aperture: 0.05, maxCoc: 8, fogCol: [0, 0, 0], ledAvg, skyGlow: [0, 0, 0], vlights, heat, time: 0, fade: 1, flash: 0,
      shaft: 0, shaftPos: [0.5, 0.5],
      cityFog: [0.0105, 0.0078, 0.006], cloudY: CLOUD_Y, spots: Array.from({ length: 12 }, () => [0, 0, 1]), spotC: Array.from({ length: 12 }, () => [0, 0, 0]), spotN: 0 };
    let lastRF = 0;
    const shaftV = new V3(), boxCentre = new V3(0, 23.7, 0);
    function renderFrame(now) {
      renderer.info.reset();
      world.update(S, camera.position);
      if (Q.mirrorEvery && (ctx.frame % Q.mirrorEvery === 0 || !U.uMirror.value)) { U.uMirrorK.value = 1; updateMirror(); }
      else if (!Q.mirrorEvery) U.uMirrorK.value = 0;
      curVP.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      if (!lastVP) lastVP = curVP.clone();
      const ev = S.ev + P.ev;
      // fade in from black over ~1.6 s of wall time, whatever the frame rate
      fade = Math.min(1, fade + (lastRF ? Math.min(0.1, (now - lastRF) / 1000) : 0) / 1.6); lastRF = now;
      const sg = 0.02 + S.energy * 0.02;
      const pp = postP;
      pp.prevVP = lastVP; pp.exposure = 0.55 * Math.pow(2, ev); pp.bloom = P.bloom; pp.flare = P.flare * Q.flare; pp.grain = P.grain; pp.haze = P.haze;
      pp.dof = P.dof; pp.dofTaps = Q.dofTaps; pp.mblur = P.mblur && Q.mblur;
      pp.focus = camera.position.distanceTo(camTgt);
      pp.aperture = (app.mode === 'play' ? 0.05 : 0.025) * RH / 1080; pp.maxCoc = Math.max(2, 8 * RH / 1080);
      pp.fogCol[0] = 0.0035 + ledAvg[0] * 0.003; pp.fogCol[1] = 0.0038 + ledAvg[1] * 0.003; pp.fogCol[2] = 0.006 + ledAvg[2] * 0.003;
      pp.skyGlow[0] = ledAvg[0] * sg + 0.01; pp.skyGlow[1] = ledAvg[1] * sg + 0.006; pp.skyGlow[2] = ledAvg[2] * sg + 0.008;
      pp.time = fxT; pp.fade = P.capture ? 1 : ease(fade);
      // god-ray key light: whichever source is brightest on screen right now
      pp.shaft = 0;
      if (Q.shafts) {
        let best = 0;
        const consider = (p, I) => {
          if (I <= 0) return;
          shaftV.copy(p).project(camera);
          if (shaftV.z > 1 || Math.abs(shaftV.x) > 1.6 || Math.abs(shaftV.y) > 1.6) return;
          const k = I * (1 - Math.max(0, Math.max(Math.abs(shaftV.x), Math.abs(shaftV.y)) - 1) / 0.6);
          if (k > best) { best = k; pp.shaftPos[0] = shaftV.x * 0.5 + 0.5; pp.shaftPos[1] = shaftV.y * 0.5 + 0.5; }
        };
        consider(boxCentre, (ledAvg[0] + ledAvg[1] + ledAvg[2]) * 1.2);
        consider(titleVL, S.title * (1 + S.titleFlare * 2) * 0.8);
        pp.shaft = Math.min(1, best) * 0.55 * P.flare;
      }
      post.render(scene, camera, pp);
      lastVP.copy(curVP);
      for (const k in pools) pools[k].uploaded();
    }

    /* ── UI + input ──────────────────────────────────────────────────── */
    const ui = KOB.makeUI(app);
    ui.setQuality(P.quality === 'auto' ? 'auto' : quality, quality);
    ui.setSound(false);
    const markActive = () => { idleT = 0; };
    ['pointerdown', 'wheel', 'pointermove'].forEach((ev) => canvas.addEventListener(ev, (e) => { if (ev !== 'pointermove' || e.buttons) markActive(); if (ev === 'pointerdown' || ev === 'wheel') { fly = null; app.tour(false); } }, { passive: true }));
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'q', 'e', 'shift'].includes(k)) { app.flyKeys.add(k); app.tour(false); }
      markActive();
      if (!KOBAudio.isOn() && P.audio && app._audioTried !== true) { app._audioTried = true; app.toggleSound(); }
    });
    window.addEventListener('keyup', (e) => app.flyKeys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => app.flyKeys.clear());
    if (P.audio) canvas.addEventListener('pointerdown', () => { if (!KOBAudio.isOn() && !app._audioTried) { app._audioTried = true; app.toggleSound(); } }, { once: true });

    /* ── preroll: simulate the last few seconds so nothing starts empty ─ */
    function preroll(sec) {
      const step = 1 / 20;
      const target = showT;
      const saveMode = app.mode, savePause = app.paused;
      app.paused = false;
      showT = ((target - sec) % TOTAL + TOTAL) % TOTAL;
      fxT -= sec;
      lastShow = showT;
      for (let t = 0; t < sec - 1e-6; t += step) stepShow(step);
      showT = target; lastShow = target;
      app.paused = savePause; app.mode = saveMode;
    }

    /* ── main loop ───────────────────────────────────────────────────────
       Adaptive quality (auto): sustained slow frames first lower the render scale in small steps,
       then drop to the next tier's cheaper features. Every change has a cool-down, and the RT
       re-allocation is the only hitch it can cause – no shader is ever recompiled. */
    let last = performance.now();
    const ft = new Float32Array(90); let ftI = 0, ftN = 0;
    let adaptCool = 4, goodT = 0, statT = 0, minDt = 1;
    const frameMin = P.fps > 0 ? 1 / P.fps : 0;
    let capAcc = 0;
    function loop(now) {
      requestAnimationFrame(loop);
      let dt = (now - last) / 1000; last = now;
      if (dt > 0.25) dt = 0.25;
      if (frameMin) { capAcc += dt; if (capAcc < frameMin * 0.92) return; dt = Math.min(0.25, capAcc); capAcc = 0; }
      stepShow(dt);
      stepTour(dt);
      stepCamera(dt, now);
      renderFrame(now);
      ui.frame(showT, 0, dt);
      // frame-time window
      ft[ftI] = dt; ftI = (ftI + 1) % ft.length; ftN = Math.min(ft.length, ftN + 1);
      minDt = Math.min(minDt * 1.002 + 0.00001, dt);
      statT += dt; adaptCool -= dt;
      if (statT > 0.5 && ftN >= 30) {
        statT = 0;
        let sum = 0; for (let i = 0; i < ftN; i++) sum += ft[i];
        const avg = sum / ftN;
        const target = frameMin || Math.max(1 / 60, minDt);        // display refresh (or the fps cap)
        if (autoQ && !P.scale && adaptCool <= 0 && document.visibilityState === 'visible') {
          if (avg > target * 1.4) {
            goodT = 0; adaptCool = 3;
            if (dynScale > 0.74) { dynScale = Math.max(0.72, dynScale * 0.88); resize(); }
            else { const ti = TIERS.indexOf(quality); if (ti > 0) { dynScale = 0.9; applyTier(TIERS[ti - 1]); ui.setQuality('auto', quality); adaptCool = 5; } }
            ftN = 0;
          } else if (avg < target * 1.12) {
            goodT += 0.5;
            if (goodT > 8 && dynScale < 1) { dynScale = Math.min(1, dynScale * 1.06); resize(); adaptCool = 6; goodT = 0; ftN = 0; }
          } else goodT = 0;
        }
        if (P.stats) $('#stats').textContent = `${(1 / avg).toFixed(0)} fps · ${RW}×${RH} · ${renderer.info.render.calls} calls · ${(renderer.info.render.triangles / 1e6).toFixed(2)}M tris · lights ${kln}\nshow ${showT.toFixed(1)}s · ch ${S.chapter + 1} · tier ${quality}${autoQ ? ' (auto)' : ''} ×${dynScale.toFixed(2)} · ${KOB.gpu || ''}`;
      }
    }

    /* ── public handle ───────────────────────────────────────────────── */
    window.__viewer = {
      THREE, scene, camera, controls, renderer, VIEWS, params: P, app, post, beams, lasers, pools, crowd, people, drones, pyro, fireworks, NODES, MATS, U, world, performer, fleetA, fleetB, sfx, custom: customApi,
      get quality() { return quality; }, setQuality: (q) => { autoQ = q === 'auto'; applyTier(autoQ ? detected : q); },
      flyTo: (i, immediate) => app.flyTo(i, immediate),
      setMode: (m) => app.setMode(m),
      seek: (t) => app.seek(t),
      get showTime() { return showT; },
      get state() { return S; },
      director,
      // advance the show by dt without rendering (profiling aid)
      step(dt) { stepShow(dt); stepCamera(dt, performance.now()); },
      // debugging aid: hide effect systems by name (beams, flares, lasers, crowd, drones, haze, streak, fire, smoke, confetti, venue)
      hide(list) {
        const M = { beams: beams.mesh, flares: beams.flares, lasers: lasers.mesh, hits: lasers.hits, crowd: crowd.points, people: people.mesh, drones: fleetA.points, fleet: fleetB.points, haze: haze.mesh, streak: pools.streak.mesh, fire: pools.fire.mesh, smoke: pools.smoke.mesh, confetti: pools.confetti.mesh, venue: root };
        for (const k in M) M[k].visible = !list.includes(k);
      },
      // GPU timing: render n frames of show time t, forcing completion each frame (gl.readPixels)
      bench(t, n, o) {
        o = o || {};
        this.renderAt(t, Object.assign({ warm: 2 }, o));
        const gl = renderer.getContext(); const px = new Uint8Array(4);
        const sync = () => { renderer.setRenderTarget(null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
        sync();
        const parts = { scene: 0, mirror: 0, post: 0, cpu: 0 };
        let t0 = performance.now();
        for (let i = 0; i < n; i++) { const a = performance.now(); stepShow(1 / 60); stepCamera(1 / 60, a); parts.cpu += performance.now() - a; renderFrame(a); sync(); }
        const total = (performance.now() - t0) / n;
        return { ms: +total.toFixed(1), cpu: +(parts.cpu / n).toFixed(2), calls: renderer.info.render.calls, tris: renderer.info.render.triangles, size: [RW, RH] };
      },
      // deterministic frame capture: render show time t (play) or a viewpoint (free)
      renderAt(t, o) {
        o = o || {};
        const warm = o.warm == null ? 5 : o.warm;
        if (o.mode === 'free') { app.mode = 'free'; ui.setMode('free'); controls.enabled = true; }
        else { app.mode = 'play'; ui.setMode('play'); controls.enabled = false; blend = null; }
        resetFx();
        showT = ((t - warm) % TOTAL + TOTAL) % TOTAL; lastShow = showT; fxT = 1000 + t - warm;
        const step = 1 / (o.fps || 20);
        app.paused = false;
        if (o.quality) applyTier(o.quality);
        if (o.trigger) for (const k of o.trigger) app.trigger(k);
        for (let k = 0; k < Math.round(warm / step); k++) { stepShow(step); }
        showT = ((t % TOTAL) + TOTAL) % TOTAL; lastShow = showT;
        if (o.mode === 'free' && o.view != null) app.flyTo(o.view, true);
        if (o.mode === 'free' && o.pos) { camera.position.set(...o.pos); controls.target.set(...o.tgt); lens = o.lens || 30; controls.update(); }
        // previous camera for motion blur (1/60 s earlier), then the frame itself
        const savedT = showT; showT = savedT - 1 / 60; lastShow = showT;
        stepCamera(1 / 60, performance.now());
        lastVP = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        stepShow(1 / 60); showT = savedT; stepCamera(1 / 60, performance.now());
        if (o.mode === 'free') idleT = 0;
        if (o.hide) window.__viewer.hide(o.hide);
        renderer.shadowMap.needsUpdate = true;
        renderFrame(performance.now());
        ui.frame(showT, 0);
        return canvas.toDataURL('image/jpeg', o.q || 0.9);
      },
    };
    // flyTo needs the viewer before the UI references it
    app.flyKeys = app.flyKeys || new Set();

    /* ── go ──────────────────────────────────────────────────────────── */
    bootUI.boot(0.88, 'Compiling shaders…');
    preroll(4);
    if (P.mode === 'free') {
      app.setMode('free');
      if (P.view != null) app.flyTo(Math.round(P.view), true);
      else { camera.position.copy(dirP.lengthSq() ? dirP : B([360, -160, 40])); controls.target.copy(B([0, 0, 30])); controls.update(); }
    }
    stepCamera(0, performance.now());
    // compile every program now (behind the boot screen) instead of hitching on first sight
    try { if (renderer.compileAsync) await renderer.compileAsync(scene, camera); else renderer.compile(scene, camera); } catch (e) { console.warn(e); }
    renderFrame(performance.now());   // post, mirror and shadow programs
    // boot benchmark (auto): time a few frames from a heavy vantage point and settle the tier
    if (autoQ && !P.capture && !P.scale) {
      bootUI.boot(0.94, 'Calibrating for this GPU…');
      const gl = renderer.getContext(), px = new Uint8Array(4);
      const sp = camera.position.clone(), sq = camera.quaternion.clone();
      const measure = () => {
        camera.position.copy(B([78, -6, 24])); camera.lookAt(B([0, 0, 22])); camera.updateMatrixWorld();
        for (let i = 0; i < 2; i++) { renderFrame(performance.now()); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }
        const t0 = performance.now();
        for (let i = 0; i < 4; i++) { stepShow(1 / 60); renderFrame(performance.now()); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }
        return (performance.now() - t0) / 4;
      };
      let ms = measure();
      for (let k = 0; k < 2 && ms > 26 && TIERS.indexOf(quality) > 0; k++) { applyTier(TIERS[TIERS.indexOf(quality) - 1]); ms = measure(); }
      if (ms < 7 && quality === 'medium') { applyTier('high'); ms = measure(); if (ms > 15) applyTier('medium'); }
      console.log('[kob] boot benchmark ' + ms.toFixed(1) + ' ms → tier ' + quality);
      camera.position.copy(sp); camera.quaternion.copy(sq); camera.updateMatrixWorld();
      stepCamera(0, performance.now());
    }
    ui.setQuality(autoQ ? 'auto' : quality, quality);
    window.__ready = true;
    if (P.capture) { document.body.classList.remove('is-booting'); if (P.crop) setCrop(true); return; }
    // entry gate: one click gives the browser permission to play sound, and starts the show
    // from its opening shot instead of somewhere in the middle
    if (P.gate) {
      bootUI.boot(1, 'Ready');
      const withSound = await ui.gate();
      if (withSound && !KOBAudio.isOn()) app.toggleSound();
      if (P.mode === 'play' && !P.chapter && !P.t) { showT = 0; resetFx(); preroll(3); lastShow = showT; }
    }
    fade = 0; lastRF = 0;          // the show fades up from black once the curtain lifts
    ui.ready(); ui.setMode(app.mode);
    if (app.mode === 'play') setCrop(true);
    last = performance.now(); requestAnimationFrame(loop);
  }
})();
