(window.KOB_FILES = window.KOB_FILES || {}).fx = '12';
/* ═══════════════════════════════════════════════════════════════════
   KING OF BEASTS — effects warehouse
   beams · lasers · particle pools · fireworks · pyro · crowd · drones · haze
   Everything here is ADDED effect geometry; the venue model is untouched.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const KOB = (window.KOB = window.KOB || {});
  const FX = (KOB.fx = {});

  /* ── venue helpers (three coords; symmetric so z sign is irrelevant) ── */
  const ellR = (a, b, th) => 1 / Math.sqrt((Math.cos(th) / a) ** 2 + (Math.sin(th) / b) ** 2);
  function bowlHeight(x, z) {
    const th = Math.atan2(z, x);
    const r = Math.hypot(x, z);
    const ri = ellR(61.5, 106, th), ro = ellR(142.6, 164.7, th);
    const s = (r - ri) / (ro - ri);
    if (s < 0) return 0.3;
    if (s > 1) return r < ro + 18 ? 56 : 0;
    return 2 + 53 * s;
  }
  function roofUnder(x, z) {
    const e = Math.hypot(x / 67.6, z / 98.2);
    if (e < 1) return 1e9;
    const th = Math.atan2(z, x);
    return 41 + 28 * Math.cos(th) ** 2 + Math.min(1, (e - 1) * 2) * 2;
  }
  FX.bowlHeight = bowlHeight;
  FX.roofUnder = roofUnder;
  // point on the seating (Blender azimuth th, fraction s up the bowl) → three Vector3
  FX.bowlPoint = function (THREE, th, s, out) {
    const ri = ellR(61.5, 106, th), ro = ellR(142.6, 164.7, th);
    const r = ri + (ro - ri) * s;
    out = out || new THREE.Vector3();
    return out.set(r * Math.cos(th), 2 + 53 * s + 1.4, -r * Math.sin(th));
  };
  // march a ray against deck / ground / seating / roof underside; returns length
  function traceLen(o, d, maxL) {
    const dx = d.x, dy = d.y, dz = d.z;
    let tMax = maxL || 420;
    if (dy < -1e-3) {
      // ground or deck plane
      let tg = (o.y - 0.4) / -dy;
      const hx = o.x + dx * tg, hz = o.z + dz * tg;
      if (Math.abs(hx) < 33 && Math.abs(hz) < 49 && o.y > 3.3) tg = (o.y - 3.3) / -dy;
      tMax = Math.min(tMax, tg);
    }
    const steps = 26;
    let prev = 0;
    for (let i = 1; i <= steps; i++) {
      const t = tMax * (i / steps) ** 1.35;
      const x = o.x + dx * t, y = o.y + dy * t, z = o.z + dz * t;
      const r2 = x * x + z * z;
      if (r2 > 3600 && y < bowlHeight(x, z)) {
        // refine
        let a = prev, b = t;
        for (let k = 0; k < 5; k++) { const m = (a + b) / 2; const xm = o.x + dx * m, ym = o.y + dy * m, zm = o.z + dz * m; if (ym < bowlHeight(xm, zm)) b = m; else a = m; }
        return b;
      }
      if (y > 38 && y < 75 && y > roofUnder(x, z) && Math.hypot(x / 160, z / 178) < 1) return t;
      if (r2 > 160 * 160 + 180 * 180 && y < 74 && y > 0) return t; // shell
      prev = t;
    }
    return tMax;
  }
  FX.traceLen = traceLen;

  /* ── geometry helpers ─────────────────────────────────────────────── */
  function instQuad(THREE, xs, ys) {
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([xs[0], ys[0], 0, xs[1], ys[0], 0, xs[1], ys[1], 0, xs[0], ys[1], 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    return g;
  }
  function coneGeo(THREE, radial, rings) {
    const pos = [], idx = [];
    for (let j = 0; j <= rings; j++) {
      const t = j / rings;
      for (let i = 0; i < radial; i++) {
        const a = (i / radial) * Math.PI * 2;
        pos.push(Math.cos(a), t, Math.sin(a));
      }
    }
    for (let j = 0; j < rings; j++) for (let i = 0; i < radial; i++) {
      const a = j * radial + i, b = j * radial + ((i + 1) % radial), c = a + radial, d = b + radial;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    return g;
  }
  function iattr(THREE, g, name, n, size) {
    const a = new THREE.InstancedBufferAttribute(new Float32Array(n * size), size);
    a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute(name, a);
    return a;
  }
  function shader(THREE, U, vert, frag, extra, opts) {
    const m = new THREE.ShaderMaterial(Object.assign({
      uniforms: Object.assign({}, U, extra || {}),
      vertexShader: vert, fragmentShader: frag,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,   // billboards are wound from cross(dir, toCam): never cull them
    }, opts || {}));
    return m;
  }
  FX.shader = shader;

  /* ═══ BEAMS ═════════════════════════════════════════════════════════ */
  FX.makeBeams = function (THREE, ctx) {
    const { U, G, scene } = ctx;
    const groups = [];
    let N = 0;
    const api = { groups, mesh: null, flares: null, thin: 0 };
    api.add = function (name, origins, o) {
      const g = Object.assign({ name, origins, n: origins.length, off: N, half: 2.5, r0: 0.16, slew: 2.6, maxLen: 420, inten: 1, thin: /towerUp|deck|boom|rig/.test(name) }, o || {});
      g.cur = new Float32Array(g.n * 3);
      g.len = new Float32Array(g.n).fill(30);
      g.azO = origins.map((p) => Math.atan2(-p.z, p.x));
      g.rnd = origins.map((_, i) => KOB.rng(1000 + i * 31 + N)());
      for (let i = 0; i < g.n; i++) { g.cur[i * 3 + 1] = 1; }
      groups.push(g);
      N += g.n;
      return g;
    };
    api.build = function () {
      const geo = coneGeo(THREE, 16, 6);
      api.aO = iattr(THREE, geo, 'aO', N, 3);
      api.aD = iattr(THREE, geo, 'aD', N, 3);
      api.aP = iattr(THREE, geo, 'aP', N, 4);
      api.aC = iattr(THREE, geo, 'aC', N, 3);
      geo.instanceCount = N;
      const mat = shader(THREE, U, G.beamVert, G.beamFrag, {}, { side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false; mesh.renderOrder = 5;
      mesh.layers.enable(2);
      scene.add(mesh);
      api.mesh = mesh;
      // lens glints share the very same per-instance buffers
      const fg = instQuad(THREE, [-1, 1], [-1, 1]);
      for (const k of ['aO', 'aD', 'aP', 'aC']) fg.setAttribute(k, api[k]);
      fg.instanceCount = N;
      const fm = shader(THREE, U, G.flareVert, G.flareFrag);
      const fl = new THREE.Mesh(fg, fm);
      fl.frustumCulled = false; fl.renderOrder = 8;
      scene.add(fl);
      api.flares = fl;
      for (const g of groups) for (let i = 0; i < g.n; i++) {
        const o = g.origins[i];
        api.aO.array.set([o.x, o.y, o.z], (g.off + i) * 3);
      }
      api.aO.needsUpdate = true;
    };

    const tmp = new THREE.Vector3(), cur = new THREE.Vector3(), tgt = new THREE.Vector3(), tmp2 = new THREE.Vector3();
    // Blender spherical → three direction
    const sph = (az, el, out) => out.set(Math.cos(el) * Math.cos(az), Math.sin(el), -Math.cos(el) * Math.sin(az));
    const nz = (x) => Math.sin(x) * 0.5 + Math.sin(x * 2.17 + 1.3) * 0.3 + Math.sin(x * 4.31 + 2.1) * 0.2;

    function desired(g, i, S, t, out) {
      const st = S.beams[g.name];
      const pat = st ? st.pat : 'down';
      const az0 = g.azO[i], r = g.rnd[i];
      const o = g.origins[i];
      switch (g.name) {
        case 'towerUp': {
          const k = i % g.per, tw = Math.floor(i / g.per);
          const tAz = g.towerAz[tw];
          if (pat === 'sky') return sph(tAz + (k - g.per / 2) * 0.16 + Math.sin(t * 0.32 + k * 0.9 + tw) * 0.55, 1.18 + 0.22 * Math.sin(t * 0.47 + k * 0.7), out);
          // fan in the tangential plane, scissoring
          const spread = 0.55 + 0.3 * Math.sin(t * 1.05 + tw);
          const a = ((k / (g.per - 1)) * 2 - 1) * spread;
          sph(tAz, 0, tmp2); // outward
          out.set(0, 1, 0).multiplyScalar(Math.cos(a));
          const tg = sph(tAz + Math.PI / 2, 0, tmp);
          out.addScaledVector(tg, Math.sin(a)).addScaledVector(tmp2, 0.18);
          return out.normalize();
        }
        case 'deck': {
          if (pat === 'curtain') return out.set(Math.cos(az0) * 0.05, 1, -Math.sin(az0) * 0.05).normalize();
          if (pat === 'ballyhoo') return sph(az0 + (nz(t * 0.55 + r * 40) * 1.6), 1.0 + 0.42 * nz(t * 0.6 + r * 17), out);
          if (pat === 'cross') { const s = i % 2 ? 1 : -1; return sph(az0 + s * 0.9 + Math.sin(t * 0.8) * 0.2, 1.05 + 0.1 * Math.sin(t * 1.6), out); }
          return sph(az0 + Math.sin(t * 0.7 + i * 0.37) * 0.35, 1.22 + 0.16 * Math.sin(t * 1.25 + i * 0.4), out);
        }
        case 'boom': {
          const azS = Math.atan2(-o.z, o.x);
          if (pat === 'down') return sph(azS, -1.22 + 0.16 * Math.sin(t * 0.9 + i * 0.3), out);
          if (pat === 'fanOut') { const k = (i % 8) - 3.5; return sph(azS + k * 0.08 * (1 + 0.7 * Math.sin(t * 1.3)), -0.32 + 0.12 * Math.sin(t * 2.1 + Math.floor(i / 8)), out); }
          if (pat === 'sweep') return sph(azS + Math.sin(t * 0.85 + Math.floor(i / 10) * 0.6) * 0.85, -0.26 + 0.08 * Math.sin(t * 0.6 + i), out);
          return sph(azS + nz(t * 0.5 + r * 30) * 1.4, -0.5 + 0.45 * nz(t * 0.45 + r * 11), out);
        }
        case 'rig': return sph(az0 + Math.sin(t * 0.6 + r * 9) * 0.3, -1.25 + 0.18 * Math.sin(t * 0.8 + r * 20), out);
        case 'ring': {
          if (pat === 'crown') { tgt.set(0, 230, 0).sub(o).normalize(); return out.copy(tgt); }
          return sph(az0 + Math.sin(t * 0.22 + i * 0.5) * 0.7, 1.12 + 0.24 * Math.sin(t * 0.35 + i * 1.3), out);
        }
        case 'follow': case 'hunt': {
          const T = ctx.target(g.name, pat, i, t, tgt);
          return out.copy(T).sub(o).normalize();
        }
        case 'plaza': {
          // sky trackers on the plaza: most lean in over the Nest (a cathedral of light), every third leans out
          const lean = i % 3 === 0 ? 0 : Math.PI;
          return sph(az0 + lean + Math.sin(t * 0.16 + i * 1.7) * 0.5 * (i % 2 ? 1 : -1), 1.2 + 0.18 * Math.sin(t * 0.23 + i * 0.8), out);
        }
        case 'statue': return out.copy(g.aim[i]).sub(o).normalize();
        case 'throne': return out.copy(g.aim[i]).sub(o).normalize();
      }
      return out.set(0, -1, 0);
    }

    function intensityOf(g, i, S, t) {
      const st = S.beams[g.name];
      let lv = typeof st === 'number' ? st : st ? st.level : 0;
      if (lv <= 0) return 0;
      const bp = S.beatPulse, r = g.rnd[i];
      switch (g.name) {
        case 'towerUp': {
          const tw = Math.floor(i / g.per);
          const m = st.towerMask ? st.towerMask[tw] : 1;
          return lv * m * (0.75 + 0.35 * bp);
        }
        case 'deck': {
          if (st.pat === 'curtain') { const ph = (i / g.n + t * 0.6) % 1; return lv * (0.25 + 1.2 * Math.exp(-((ph - 0.5) ** 2) * 60) + 0.4 * bp); }
          return lv * (0.55 + 0.6 * bp * ((i + S.bar) % 2));
        }
        case 'boom': return lv * (0.5 + 0.7 * (st.pat === 'fanOut' ? bp : 0.5));
        case 'rig': { const k = i / g.n; return lv * (0.25 + 0.75 * smoothstep(k - 0.1, k, S.rig * 1.1)) * (0.7 + 0.3 * Math.sin(t * 2 + r * 30)); }
        case 'ring': return lv * (0.75 + 0.25 * Math.sin(t * 3 + i));
        case 'follow': return lv;
        case 'hunt': return lv * (0.8 + 0.2 * bp);
        default: return lv;
      }
    }
    const smoothstep = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };

    api.update = function (S, dt, t) {
      const O = api.aO.array, D = api.aD.array, P = api.aP.array, C = api.aC.array;
      for (const g of groups) {
        const st = S.beams[g.name];
        const col = st && st.col ? st.col : [1, 0.9, 0.8];
        const maxA = g.slew * Math.max(dt, 1 / 120);
        for (let i = 0; i < g.n; i++) {
          const j = g.off + i;
          let I = intensityOf(g, i, S, t) * g.inten;
          if (api.thin && g.thin && (i % api.thin) !== 0) I = 0;
          if (g.activeN != null && i >= g.activeN) I = 0;
          desired(g, i, S, t, tgt);
          cur.set(g.cur[i * 3], g.cur[i * 3 + 1], g.cur[i * 3 + 2]);
          const ang = cur.angleTo(tgt);
          if (ang > maxA && dt < 0.5) cur.lerp(tgt, maxA / ang).normalize(); else cur.copy(tgt);
          g.cur[i * 3] = cur.x; g.cur[i * 3 + 1] = cur.y; g.cur[i * 3 + 2] = cur.z;
          D[j * 3] = cur.x; D[j * 3 + 1] = cur.y; D[j * 3 + 2] = cur.z;
          // length: re-trace a slice of beams per frame
          if (g.noTrace) g.len[i] = g.maxLen;
          else if (((j + ctx.frame) % 3) === 0 || dt > 0.2) g.len[i] = traceLen(g.origins[i], cur, g.maxLen);
          const L = Math.max(2, g.len[i]);
          const r1 = g.r0 + Math.tan(g.half * Math.PI / 180) * L;
          P[j * 4] = L; P[j * 4 + 1] = g.r0; P[j * 4 + 2] = r1; P[j * 4 + 3] = I;
          const cc = g.colFn ? g.colFn(i, S, t) : col;
          C[j * 3] = cc[0]; C[j * 3 + 1] = cc[1]; C[j * 3 + 2] = cc[2];
        }
      }
      api.aD.needsUpdate = true; api.aP.needsUpdate = true; api.aC.needsUpdate = true;
    };
    api.dirOf = function (g, i, out) { return out.set(g.cur[i * 3], g.cur[i * 3 + 1], g.cur[i * 3 + 2]); };
    return api;
  };

  /* ═══ LASERS ════════════════════════════════════════════════════════ */
  FX.makeLasers = function (THREE, ctx, E) {
    const { U, G, scene } = ctx;
    const MAX = ctx.quality === 'low' ? 700 : 1500;
    const geo = instQuad(THREE, [0, 1], [-1, 1]);
    const aA = iattr(THREE, geo, 'aA', MAX, 3), aB = iattr(THREE, geo, 'aB', MAX, 3), aC = iattr(THREE, geo, 'aC', MAX, 3), aW = iattr(THREE, geo, 'aW', MAX, 2);
    geo.instanceCount = MAX;
    const mat = shader(THREE, U, G.laserVert, G.laserFrag);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false; mesh.renderOrder = 6; mesh.layers.enable(2);
    scene.add(mesh);
    // hit dots
    const HMAX = 900;
    const hg = new THREE.BufferGeometry();
    const hp = new THREE.BufferAttribute(new Float32Array(HMAX * 3), 3).setUsage(THREE.DynamicDrawUsage);
    const hc = new THREE.BufferAttribute(new Float32Array(HMAX * 4), 4).setUsage(THREE.DynamicDrawUsage);
    hg.setAttribute('position', hp); hg.setAttribute('aCol', hc);
    const hm = shader(THREE, U, G.dotVert, G.pointFrag, { uSize: { value: 0.55 } });
    const hits = new THREE.Points(hg, hm);
    hits.frustumCulled = false; hits.renderOrder = 7;
    scene.add(hits);

    let n = 0, nh = 0;
    const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), d = new THREE.Vector3();
    const tu = new THREE.Vector3(), tw2 = new THREE.Vector3(), Y_UP = new THREE.Vector3(0, 1, 0);
    function seg(a, b, col, I, w, hit) {
      if (n >= MAX || I <= 0.001) return;
      const k3 = n * 3, A3 = aA.array, B3 = aB.array, C3 = aC.array;
      A3[k3] = a.x; A3[k3 + 1] = a.y; A3[k3 + 2] = a.z; B3[k3] = b.x; B3[k3 + 1] = b.y; B3[k3 + 2] = b.z;
      C3[k3] = col[0]; C3[k3 + 1] = col[1]; C3[k3 + 2] = col[2];
      aW.array[n * 2] = w || 0.035; aW.array[n * 2 + 1] = I;
      n++;
      if (hit && nh < HMAX) { const H = hp.array, C4 = hc.array, k3 = nh * 3, k4 = nh * 4; H[k3] = b.x; H[k3 + 1] = b.y; H[k3 + 2] = b.z; C4[k4] = col[0] * I * 0.5; C4[k4 + 1] = col[1] * I * 0.5; C4[k4 + 2] = col[2] * I * 0.5; C4[k4 + 3] = 1; nh++; }
    }
    const bowl = (th, s, out) => FX.bowlPoint(THREE, th, s, out);
    const api = { mesh, hits };
    api.update = function (S, t) {
      n = 0; nh = 0;
      const Z = S.lasers;
      const I0 = 10;
      // per-tower crowd fans (green over the crowd)
      if (Z.crowdFan > 0) {
        for (let tw = 0; tw < 4; tw++) {
          if (!Z.towerMask[tw]) continue;
          const em = E.towers[tw];
          const tAz = E.towerAz[tw];
          const col = Z.colFan || KOB.TOWER_COL[tw];
          for (let e = 0; e < 2; e++) {
            const o = em[(e * 5) % em.length];
            const rays = ctx.laserRays || 9;
            const scan = Math.sin(t * 0.9 + tw * 1.7 + e) * 0.55;
            for (let k = 0; k < rays; k++) {
              const th = tAz + scan + (k / (rays - 1) - 0.5) * 1.1;
              const s = 0.18 + 0.5 * (0.5 + 0.5 * Math.sin(t * 1.4 + e * 2 + k * 0.25));
              bowl(th, s, v1);
              seg(o, v1, col, Z.crowdFan * I0 * (0.6 + 0.6 * S.beatPulse), 0.03, true);
            }
          }
        }
      }
      // blue sheet over the field: near-horizontal rays crossing the bowl
      if (Z.fieldSheet > 0) {
        for (let tw = 0; tw < 4; tw++) {
          const o = E.towers[tw][1 % E.towers[tw].length];
          const tAz = E.towerAz[tw] + Math.PI;
          for (let k = 0; k < 14; k++) {
            const th = tAz + (k / 13 - 0.5) * 1.2 + Math.sin(t * 0.4 + tw) * 0.12;
            bowl(th, 0.06 + 0.02 * Math.sin(t * 2 + k), v1);
            seg(o, v1, Z.colSheet, Z.fieldSheet * I0 * 0.55, 0.03, true);
          }
        }
      }
      // scanning tunnel from the two front towers toward the main stand
      if (Z.tunnel > 0) {
        for (const tw of [0, 1]) {
          const o = E.towers[tw][4 % E.towers[tw].length];
          const axis = v3.set(140, 38, (tw ? 1 : -1) * 12).sub(o).normalize();
          const u = tu.crossVectors(axis, Y_UP).normalize();
          const w = tw2.crossVectors(axis, u);
          const half = 0.11 + 0.04 * Math.sin(t * 0.8);
          for (let k = 0; k < 18; k++) {
            const a = k / 18 * Math.PI * 2 + t * 1.6 * (tw ? 1 : -1);
            d.copy(axis).multiplyScalar(Math.cos(half)).addScaledVector(u, Math.sin(half) * Math.cos(a)).addScaledVector(w, Math.sin(half) * Math.sin(a)).normalize();
            const L = traceLen(o, d, 260);
            v1.copy(o).addScaledVector(d, L);
            seg(o, v1, Z.colTunnel, Z.tunnel * I0 * 0.8, 0.03, L < 255);
          }
        }
      }
      // red mirror bounces off the roof steel
      if (Z.bounce > 0) {
        for (let tw = 0; tw < 4; tw++) {
          const o = E.towers[tw][7 % E.towers[tw].length];
          for (let k = 0; k < 5; k++) {
            const th = E.towerAz[tw] + (k - 2) * 0.32 + Math.sin(t * 0.5 + k + tw) * 0.15;
            const rr = ellR(67.6, 98.2, th);
            v1.set(rr * Math.cos(th), 41 + 28 * Math.cos(th) ** 2 - 1, -rr * Math.sin(th));
            seg(o, v1, Z.colBounce, Z.bounce * I0 * 0.9, 0.035, true);
            // reflected leg toward the opposite stand
            const th2 = th + Math.PI + Math.sin(t * 0.7 + k) * 0.4;
            bowl(th2, 0.35 + 0.3 * Math.sin(t + k), v2);
            seg(v1, v2, Z.colBounce, Z.bounce * I0 * 0.6, 0.035, true);
          }
        }
      }
      // violet sheet slicing the roof line, from emitters on the inner ring
      if (Z.roofSlice > 0) {
        for (let e = 0; e < E.ring.length; e += 3) {
          const o = E.ring[e];
          const az = Math.atan2(-o.z, o.x) + Math.PI;
          for (let k = 0; k < 4; k++) {
            const th = az + (k / 3 - 0.5) * 0.7 + Math.sin(t * 0.3 + e) * 0.2;
            const rr = ellR(67.6, 98.2, th);
            v1.set(rr * Math.cos(th), o.y + 2 + Math.sin(t * 0.9 + k) * 3, -rr * Math.sin(th));
            seg(o, v1, Z.colRoof, Z.roofSlice * I0 * 0.5, 0.025, false);
          }
        }
      }
      // aerial array into the sky
      if (Z.skyFan > 0) {
        for (let e = 1; e < E.ring.length; e += 3) {
          const o = E.ring[e];
          const az = Math.atan2(-o.z, o.x);
          for (let k = 0; k < 4; k++) {
            const a = az + (k - 2) * 0.12 + Math.sin(t * 0.6 + e) * 0.4;
            const el = 1.0 + 0.3 * Math.sin(t * 0.5 + k * 0.6 + e);
            d.set(Math.cos(el) * Math.cos(a), Math.sin(el), -Math.cos(el) * Math.sin(a));
            v1.copy(o).addScaledVector(d, 520);
            seg(o, v1, Z.colSky, Z.skyFan * I0 * 0.8, 0.03, false);
          }
        }
      }
      // "liquid sky": every tower lays a dense, waving laser ceiling over the crowd
      if (Z.ceiling > 0) {
        for (let tw = 0; tw < 4; tw++) {
          const o = E.towers[tw][3 % E.towers[tw].length];
          const tAz = E.towerAz[tw] + Math.PI;
          const rays = Math.round((ctx.laserRays || 9) * 2.6);
          for (let k = 0; k < rays; k++) {
            const th = tAz + (k / (rays - 1) - 0.5) * 1.5;
            bowl(th, 0.36 + 0.07 * Math.sin(t * 1.3 - k * 0.32 + tw), v1);
            seg(o, v1, Z.colCeiling, Z.ceiling * I0 * 0.42 * (0.75 + 0.4 * S.beatPulse), 0.022, false);
          }
        }
      }
      // the finale cone: a spinning rainbow of beams from the top of the LED box up through the roof
      if (Z.cone > 0) {
        const N = 40;
        v3.set(0, 34.5, 0);
        const spin = t * 0.9, half = 0.32 + 0.1 * Math.sin(t * 0.7);
        for (let k = 0; k < N; k++) {
          const a = k / N * Math.PI * 2 + spin;
          d.set(Math.sin(half) * Math.cos(a), Math.cos(half), Math.sin(half) * Math.sin(a));
          v1.copy(v3).addScaledVector(d, 320);
          const h = (k / N + t * 0.08) % 1;
          const col = h < 0.33 ? [1, 0.15 + h * 2.4, 0.1] : h < 0.66 ? [0.15, 1, 0.3 + (h - 0.33) * 2] : [0.3 + (h - 0.66) * 2, 0.2, 1];
          seg(v3, v1, col, Z.cone * I0 * 0.6 * (0.7 + 0.5 * S.beatPulse), 0.03, false);
        }
      }
      // the hourglass: two counter-twisted sets of beams from the deck edge to the roof rim
      // (a hyperboloid lattice that breathes and turns on the music)
      if (Z.hyper > 0) {
        const N = 26, spin = t * 0.32, tw = 1.15 + 0.25 * Math.sin(t * 0.45);
        for (let s2 = 0; s2 < 2; s2++) {
          const sg = s2 ? 1 : -1, col = s2 ? Z.colHyperB : Z.colHyperA;
          for (let k = 0; k < N; k++) {
            const a0 = (k + s2 * 0.5) / N * Math.PI * 2 + spin * sg, a1 = a0 + tw * sg;
            v1.set(32 * Math.cos(a0), 4.4, -48 * Math.sin(a0));
            const rr = ellR(67.6, 98.2, a1);
            v2.set(rr * Math.cos(a1), 39.5 + 28 * Math.cos(a1) ** 2, -rr * Math.sin(a1));
            seg(v1, v2, col, Z.hyper * I0 * 0.34 * (0.8 + 0.4 * S.beatPulse), 0.022, true);
          }
        }
      }
      for (let i = n; i < MAX; i++) aW.array[i * 2 + 1] = 0;
      for (let i = nh; i < HMAX; i++) hc.array[i * 4 + 3] = 0;
      aA.needsUpdate = aB.needsUpdate = aC.needsUpdate = aW.needsUpdate = true;
      hp.needsUpdate = hc.needsUpdate = true;
      api.count = n;
    };
    return api;
  };

  /* ═══ KINETIC LIGHTS ════════════════════════════════════════════════
     A field of glowing orbs hanging over the in-field crowd on (invisible) winches. They ripple
     out from the stage, spiral, drop on the beat and roll in waves, in the show palette. Each orb
     is a point sprite; the whole choreography runs in the vertex shader. */
  FX.makeKinetic = function (THREE, ctx) {
    const { U } = ctx;
    const pos = [], meta = [];
    const rings = [[40, 57, 52], [47, 68, 60], [54, 79, 68], [61, 90, 76]];
    rings.forEach(([a, b, n], ri) => {
      for (let i = 0; i < n; i++) {
        const th = (i + (ri % 2) * 0.5) / n * Math.PI * 2;
        const x = a * Math.cos(th), y = b * Math.sin(th);
        if (Math.abs(x) < 36 && Math.abs(y) < 52) continue;      // keep clear of the stage
        pos.push(x, 0, -y); meta.push(ri / (rings.length - 1), th);
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aM', new THREE.Float32BufferAttribute(meta, 2));
    const vert = /* glsl */`
    #include <common>
    #include <logdepthbuf_pars_vertex>
    attribute vec2 aM;
    uniform float uTime; uniform float uBeatPulse; uniform float uPxScale; uniform vec3 uPalA; uniform vec3 uPalB;
    uniform vec2 uKin;     // level, mode
    varying vec3 vCol;
    void main(){
      vec3 p = position;
      float r = length(p.xz), ang = aM.y, ring = aM.x, m = uKin.y, f;
      if (m < 0.5) f = 0.5 + 0.5 * sin(r * 0.16 - uTime * 2.2);                          // ripple from the stage
      else if (m < 1.5) f = 0.5 + 0.5 * sin(ang * 3.0 - uTime * 1.6 + ring * 2.5);       // spiral
      else if (m < 2.5) f = 0.15 + 0.85 * uBeatPulse * step(0.5, fract(ang * 1.2732 + floor(uTime / 0.46875) * 0.25)); // beat drops by sector
      else f = 0.5 + 0.5 * sin(p.x * 0.09 - uTime * 1.8) * cos(p.z * 0.05 + uTime * 0.7); // rolling waves
      p.y = 36.0 - f * 14.0 - ring * 2.0;
      vec4 mv = viewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      float px = 1.3 * uPxScale / max(-mv.z, 0.1);
      float s = clamp(px, 2.0, 56.0);
      gl_PointSize = s;
      vec3 c = mix(uPalA, mix(uPalB, vec3(1.0), 0.3), f);
      vCol = c * (0.6 + 1.8 * f) * 7.0 * uKin.x * min((px * px) / (s * s), 1.0);
      if (uKin.x <= 0.0) gl_Position = vec4(0.0, 0.0, -2.0, 1.0);
      #include <logdepthbuf_vertex>
    }`;
    const uni = { uKin: { value: new THREE.Vector2(0, 0) } };
    const mat = new THREE.ShaderMaterial({ uniforms: Object.assign({}, U, uni), vertexShader: vert, fragmentShader: KOB.GLSL.pointFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const pts = new THREE.Points(g, mat);
    pts.frustumCulled = false; pts.renderOrder = 6; pts.layers.enable(1);
    ctx.scene.add(pts);
    return { points: pts, set(level, mode) { uni.uKin.value.set(level, mode); }, count: pos.length / 3 };
  };

  /* ═══ PARTICLE POOLS ════════════════════════════════════════════════ */
  function makePool(THREE, ctx, o) {
    const geo = o.geo;
    const attrs = {};
    for (const k in o.layout) attrs[k] = iattr(THREE, geo, k, o.size, o.layout[k]);
    geo.instanceCount = o.size;
    // everything starts dead
    const T = attrs.aT.array; for (let i = 0; i < o.size; i++) { T[i * 4] = -1e6; T[i * 4 + 1] = 0.001; }
    const mesh = new THREE.Mesh(geo, o.mat);
    mesh.frustumCulled = false; mesh.renderOrder = o.order || 4;
    if (o.layer1) mesh.layers.enable(2);
    if (o.layer) mesh.layers.enable(o.layer);
    ctx.scene.add(mesh);
    let next = 0, segA = -1, segB = -1;
    const segs = [];
    const pool = {
      mesh, attrs, size: o.size,
      spawn() {
        const i = next;
        next = (next + 1) % o.size;
        if (segA < 0) { segA = i; segB = i + 1; }
        else if (i === segB) segB++;
        else { segs.push(segA, segB); segA = i; segB = i + 1; }
        return i;
      },
      set(name, i, a, b, c, d) {
        const at = attrs[name], s = at.itemSize, arr = at.array, k = i * s;
        arr[k] = a; if (s > 1) arr[k + 1] = b; if (s > 2) arr[k + 2] = c; if (s > 3) arr[k + 3] = d;
      },
      flush() {
        if (segA >= 0) { segs.push(segA, segB); segA = -1; }
        if (!segs.length) return;
        for (const k in attrs) {
          const at = attrs[k], sz = at.itemSize, Rg = at.updateRanges;
          if (at._full) { at.needsUpdate = true; continue; }
          // several simulation steps may run before an upload (pre-roll, warm-up): extend the
          // pending ranges when contiguous; only a pathological backlog falls back to a full upload
          for (let j = 0; j < segs.length; j += 2) {
            const a = segs[j] * sz, c = (segs[j + 1] - segs[j]) * sz;
            const last = Rg[Rg.length - 1];
            if (last && last.start + last.count === a) last.count += c;
            else at.addUpdateRange(a, c);
          }
          if (Rg.length > 8) { Rg.length = 0; at._full = true; }
          at.needsUpdate = true;
        }
        segs.length = 0;
      },
      uploaded() { for (const k in attrs) attrs[k]._full = false; },
      clear() {
        const T = attrs.aT.array; for (let i = 0; i < o.size; i++) T[i * 4] = -1e6;
        if (attrs.aT.updateRanges) attrs.aT.updateRanges.length = 0;
        attrs.aT._full = true;
        attrs.aT.needsUpdate = true;
      },
    };
    return pool;
  }

  FX.makePools = function (THREE, ctx) {
    const { U, G } = ctx;
    const Q = ctx.quality;
    const sStreak = Q === 'ultra' ? 90000 : Q === 'low' ? 26000 : 60000;
    const streak = makePool(THREE, ctx, {
      size: sStreak, geo: instQuad(THREE, [0, 1], [-1, 1]),
      layout: { aP0: 3, aV0: 3, aT: 4, aC: 3, aS: 4 },
      mat: shader(THREE, U, G.streakVert, G.streakFrag), order: 9, layer1: true, layer: 4,
    });
    const fire = makePool(THREE, ctx, {
      size: Q === 'low' ? 2500 : 5000, geo: instQuad(THREE, [-1, 1], [-1, 1]),
      layout: { aP0: 3, aV0: 3, aT: 4, aS: 4, aC: 4 },
      mat: shader(THREE, U, G.spriteVert, G.fireFrag), order: 8, layer1: true,
    });
    const smokeMat = shader(THREE, U, G.spriteVert, G.smokeFrag, {}, {
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    const smoke = makePool(THREE, ctx, {
      size: Q === 'low' ? 1800 : 3600, geo: instQuad(THREE, [-1, 1], [-1, 1]),
      layout: { aP0: 3, aV0: 3, aT: 4, aS: 4, aC: 4 }, mat: smokeMat, order: 3,
    });
    const confetti = makePool(THREE, ctx, {
      size: Q === 'low' ? 6000 : 14000, geo: instQuad(THREE, [-0.5, 0.5], [-0.5, 0.5]),
      layout: { aP0: 3, aV0: 3, aT: 4, aS: 4 },
      mat: shader(THREE, U, G.confettiVert, G.confettiFrag, {}, { blending: THREE.NormalBlending, transparent: false, depthWrite: true, side: THREE.DoubleSide }), order: 2,
    });
    return { streak, fire, smoke, confetti };
  };

  // helpers to spawn one particle of each kind (all times in fx clock)
  FX.spark = function (P, t0, p, v, life, drag, gscale, col, size, trail, type) {
    const i = P.spawn();
    P.set('aP0', i, p.x, p.y, p.z); P.set('aV0', i, v.x, v.y, v.z);
    P.set('aT', i, t0, life, drag, gscale); P.set('aC', i, col[0], col[1], col[2]);
    P.set('aS', i, size, trail, type, Math.random());
  };
  FX.sprite = function (P, t0, p, v, life, drag, buoy, s0, s1, col, a) {
    const i = P.spawn();
    P.set('aP0', i, p.x, p.y, p.z); P.set('aV0', i, v.x, v.y, v.z);
    P.set('aT', i, t0, life, drag, buoy); P.set('aS', i, s0, s1, Math.random(), Math.random());
    P.set('aC', i, col[0], col[1], col[2], a);
  };

  /* ═══ FIREWORKS ═════════════════════════════════════════════════════ */
  FX.makeFireworks = function (THREE, ctx, pools) {
    const shells = [];   // { burstT, pos(V3), col, kind } for lights + sound
    const v = new THREE.Vector3(), p = new THREE.Vector3(), q = new THREE.Vector3();
    const R = Math.random;
    const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
    const rn = new THREE.Vector3(), rt1 = new THREE.Vector3(), rt2 = new THREE.Vector3(), rup = new THREE.Vector3(0, 1, 0.3), cp = new THREE.Vector3(), cv = new THREE.Vector3();
    // analytic position of a dragged star (matches the streak shader) – used to seed split stars
    const starAt = (p0, v0, k, gs, t, out) => { const e = Math.exp(-k * t); const g = -9.81 * gs; return out.set(p0.x + v0.x * (1 - e) / k, p0.y + v0.y * (1 - e) / k + g * (t / k - (1 - e) / (k * k)), p0.z + v0.z * (1 - e) / k); };
    function randDir(out) {
      const u = R() * 2 - 1, a = R() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      return out.set(s * Math.cos(a), u, s * Math.sin(a));
    }
    const api = { shells };
    // launch now (fx clock tf) a shell that bursts at tf + rise
    api.launch = function (tf, ev, B) {
      const from = B(ev.from), burst = B([ev.from[0] * 0.92 + (R() - 0.5) * 10, ev.from[1] * 0.92 + (R() - 0.5) * 10, ev.h]);
      const rise = ev.kind === 'comet' ? 2.2 : 1.8 + (ev.h - 90) / 80 * 0.9;
      const tb = tf + rise;
      const dh = burst.y - from.y;
      const gs = (2 * dh / (rise * rise)) / 9.81;
      v.set((burst.x - from.x) / rise, 2 * dh / rise, (burst.z - from.z) / rise);
      // rising comet with a long tail
      // rising shell: a thin, short, flickering tail (not a pole of light)
      FX.spark(pools.streak, tf, from, v, rise, 0, gs, [0.45, 0.27, 0.12], 0.08, 0.05, 2);
      for (let k = 0; k < 12; k++) {
        const tt = R() * rise * 0.95;
        p.set(from.x + v.x * tt, from.y + v.y * tt - 0.5 * gs * 9.81 * tt * tt, from.z + v.z * tt);
        q.set((R() - 0.5) * 3, (R() - 0.5) * 3 - 2, (R() - 0.5) * 3);
        FX.spark(pools.streak, tf + tt, p, q, 0.45 + R() * 0.35, 1.4, 1, [0.8, 0.45, 0.18], 0.045, 0.04, 3);
      }
      if (ev.kind === 'comet') {
        for (let k = 0; k < (ev.n || 60); k++) { randDir(q).multiplyScalar(8 + R() * 6); q.y += 4; FX.spark(pools.streak, tb, burst, q, 1.1 + R() * 0.6, 1.5, 0.8, ev.col, 0.06, 0.05, 2); }
        shells.push({ t: tb, pos: burst.clone(), col: ev.col, power: 0.35 });
        return tb;
      }
      const n = Math.round((ev.n || 180) * ctx.fwDensity * (0.55 + 0.45 * (ctx.pk || 1)));
      const col = ev.col, kind = ev.kind;
      // shells are built like the real thing: an outer shell of stars and, for the round shells, an
      // inner pistil of a contrasting colour; stars of one shell share a speed, so the sphere is crisp
      const PISTIL = [[1.0, 0.86, 0.55], [1.0, 0.95, 0.9], [0.25, 1.0, 0.45], [1.0, 0.25, 0.6], [0.5, 0.75, 1.0]];
      const pistil = PISTIL[Math.floor(R() * PISTIL.length)];
      const STAR = 2.0;   // star colour gain (HDR, before exposure)
      let normal = null;
      if (kind === 'ring') {
        normal = randDir(rn).setY(0.5 + R()).normalize();
        rt1.crossVectors(normal, rup).normalize(); rt2.crossVectors(normal, rt1);
      }
      const base = kind === 'willow' ? 30 : kind === 'brocade' ? 36 : kind === 'palm' ? 40 : 46;
      const speedJit = kind === 'chrys' ? 0.06 : 0.035;
      // even directions (a spiral lattice on the sphere) instead of clumpy random ones
      const fib = (k, N, out) => { const y = 1 - 2 * (k + 0.5) / N, r = Math.sqrt(1 - y * y), a = k * 2.39996 + rot; return out.set(r * Math.cos(a), y, r * Math.sin(a)); };
      const rot = R() * 6.283;
      for (let k = 0; k < n; k++) {
        if (kind === 'ring') {
          const a = (k / n) * Math.PI * 2;
          q.copy(rt1).multiplyScalar(Math.cos(a)).addScaledVector(rt2, Math.sin(a)).multiplyScalar(base * (0.98 + R() * 0.04));
        } else if (kind === 'crossette') {
          if (k > 22) break;
          fib(k, 23, q).multiplyScalar(base * 0.8);
        } else if (kind === 'palm') {
          if (k > 12) break;
          randDir(q); q.y = Math.abs(q.y) * 0.6 + 0.2; q.normalize().multiplyScalar(base);
        } else {
          fib(k, n, q).multiplyScalar(base * (1 - speedJit + R() * speedJit * 2));
        }
        const c = mul(col, STAR);
        if (kind === 'peony') FX.spark(pools.streak, tb, burst, q, 1.7 + R() * 0.3, 1.5, 0.32, c, 0.2, 0.035, 0);
        else if (kind === 'chrys') FX.spark(pools.streak, tb, burst, q, 1.9 + R() * 0.3, 1.5, 0.36, c, 0.17, 0.06, 2);
        else if (kind === 'willow') FX.spark(pools.streak, tb, burst, q, 3.2 + R() * 0.8, 2.0, 0.6, [2.0, 1.25, 0.42], 0.15, 0.07, 2);
        else if (kind === 'brocade') FX.spark(pools.streak, tb, burst, q, 2.8 + R() * 0.6, 1.7, 0.5, [2.1, 1.4, 0.6], 0.16, 0.06, 2);
        else if (kind === 'glitter') FX.spark(pools.streak, tb, burst, q, 2.2 + R() * 0.5, 1.5, 0.4, [1.5, 1.45, 1.3], 0.13, 0.02, 1);
        else if (kind === 'ring') FX.spark(pools.streak, tb, burst, q, 1.8 + R() * 0.25, 1.5, 0.28, c, 0.2, 0.035, 0);
        else if (kind === 'crossette') {
          // comet that splits into four after 0.9 s
          FX.spark(pools.streak, tb, burst, q, 0.95, 1.2, 0.35, [1.5, 1.05, 0.55], 0.13, 0.05, 2);
          starAt(burst, q, 1.2, 0.35, 0.9, cp);
          starAt(burst, q, 1.2, 0.35, 0.89, cv); cv.sub(cp).multiplyScalar(-100);
          for (let sct = 0; sct < 4; sct++) {
            const a = sct * Math.PI / 2 + R() * 0.3;
            rt1.set(-cv.z, 0, cv.x).normalize(); rt2.crossVectors(cv, rt1).normalize();
            const vv = rn.copy(rt1).multiplyScalar(Math.cos(a) * 16).addScaledVector(rt2, Math.sin(a) * 16).addScaledVector(cv, 0.3);
            FX.spark(pools.streak, tb + 0.9, cp, vv, 1.3 + R() * 0.3, 1.6, 0.45, c, 0.13, 0.035, 0);
          }
        }
        else if (kind === 'spider') FX.spark(pools.streak, tb, burst, q.multiplyScalar(1.3), 1.1 + R() * 0.3, 1.0, 0.2, [1.6, 1.3, 0.8], 0.1, 0.06, 2);
        else if (kind === 'palm') {
          FX.spark(pools.streak, tb, burst, q, 2.2, 1.4, 0.6, [1.3, 0.85, 0.38], 0.2, 0.08, 2);
          for (let s2 = 0; s2 < 12; s2++) FX.spark(pools.streak, tb + R() * 2, burst.clone().addScaledVector(q, 0.6 + R() * 0.6), q.clone().multiplyScalar(0.15), 0.9, 1.0, 0.4, c, 0.08, 0.04, 1);
        }
      }
      // the pistil: a smaller, contrasting inner shell
      if (kind === 'peony' || kind === 'chrys' || kind === 'ring') {
        const np = Math.round(n * 0.32);
        for (let k = 0; k < np; k++) {
          fib(k, np, q).multiplyScalar(base * 0.48 * (0.97 + R() * 0.06));
          FX.spark(pools.streak, tb + 0.03, burst, q, 1.35 + R() * 0.25, 1.6, 0.3, mul(pistil, STAR), 0.12, 0.03, 0);
        }
      }
      // crackle: tiny white pops scattered through the shell as the stars burn out (glitter / brocade)
      if (kind === 'glitter' || kind === 'brocade') for (let k = 0; k < n * 0.2; k++) {
        fib(k * 7 % n, n, q).multiplyScalar(base * 0.55);
        p.copy(burst).addScaledVector(q, 0.8 + R() * 0.5);
        FX.spark(pools.streak, tb + 1.0 + R() * 1.1, p, q.multiplyScalar(0.04), 0.3 + R() * 0.25, 1, 0.3, [1.4, 1.35, 1.25], 0.07, 0.015, 1);
      }
      shells.push({ t: tb, pos: burst.clone(), col, power: kind === 'willow' || kind === 'brocade' ? 1.2 : 1 });
      return tb;
    };
    api.prune = function (tf) { while (shells.length && tf - shells[0].t > 4) shells.shift(); if (shells.length > 64) shells.splice(0, shells.length - 64); };
    return api;
  };

  /* ═══ PYRO / ATMOSPHERIC EMITTERS ═══════════════════════════════════ */
  FX.makePyro = function (THREE, ctx, pools) {
    const emitters = [];    // { t0, t1, kind, pos(V3), rate, acc }
    const p = new THREE.Vector3(), v = new THREE.Vector3();
    const R = Math.random;
    const api = { emitters, flames: [] };
    api.add = function (tf, dur, kind, pos, rate, extra) { emitters.push(Object.assign({ t0: tf, t1: tf + dur, kind, pos, rate, acc: 0 }, extra || {})); };
    api.burstConfetti = function (tf, n, B) {
      const cannons = [[33.5, -30, 3.3], [33.5, 0, 3.3], [33.5, 30, 3.3], [0, 49.5, 3.3], [0, -49.5, 3.3], [-33.5, 0, 3.3]].map(B);
      n = Math.round(n * (ctx.pk || 1));
      for (let k = 0; k < n; k++) {
        const c = cannons[k % cannons.length];
        const out = new THREE.Vector3(c.x, 0, c.z).normalize();
        v.set(out.x * 7 + (R() - 0.5) * 9, 24 + R() * 14, out.z * 7 + (R() - 0.5) * 9);
        const i = pools.confetti.spawn();
        pools.confetti.set('aP0', i, c.x, c.y, c.z); pools.confetti.set('aV0', i, v.x, v.y, v.z);
        pools.confetti.set('aT', i, tf + R() * 0.35, 14 + R() * 6, 0, 0); pools.confetti.set('aS', i, R(), R(), 0, 0);
      }
    };
    function emit(e, tf, dt) {
      e.acc += e.rate * dt * (ctx.pk || 1);
      let n = Math.floor(e.acc); e.acc -= n;
      if (n > 400) n = 400;
      for (let k = 0; k < n; k++) {
        const tt = tf - R() * dt;
        switch (e.kind) {
          case 'flame': {
            p.set(e.pos.x + (R() - 0.5) * 0.4, e.pos.y + 0.3, e.pos.z + (R() - 0.5) * 0.4);
            v.set((R() - 0.5) * 1.2, 19 + R() * 7, (R() - 0.5) * 1.2);
            FX.sprite(pools.fire, tt, p, v, 0.7 + R() * 0.35, 1.25, 3, 0.55, 2.3 + R() * 1.1, [1, 1, 1], 1.4);
            if (R() < 0.12) { v.y *= 0.8; FX.sprite(pools.smoke, tt + 0.6, p.setY(p.y + 9), v.multiplyScalar(0.3), 5 + R() * 3, 0.8, 1.2, 2.5, 9, [0.25, 0.22, 0.2], 0.35); }
            if (R() < 0.3) { v.set((R() - 0.5) * 4, 8 + R() * 8, (R() - 0.5) * 4); FX.spark(pools.streak, tt, p, v, 1.5 + R() * 1.5, 0.8, 0.25, [1, 0.45, 0.12], 0.04, 0.12, 3); }
            break;
          }
          case 'vortex': {
            // fire tornado: three flame arms wound round a turning axis, flung out tangentially
            const ang = tt * 7.5 + (k % 3) * 2.0944, r = 1.0 + R() * 0.6;
            p.set(e.pos.x + Math.cos(ang) * r, e.pos.y + 0.3, e.pos.z + Math.sin(ang) * r);
            v.set(-Math.sin(ang) * 6.5 + Math.cos(ang) * 1.2, 15 + R() * 7, Math.cos(ang) * 6.5 + Math.sin(ang) * 1.2);
            FX.sprite(pools.fire, tt, p, v, 0.85 + R() * 0.4, 1.1, 3, 0.4, 1.7 + R() * 0.8, [1, 1, 1], 1.05);
            if (R() < 0.22) { v.set(-Math.sin(ang) * 9, 10 + R() * 9, Math.cos(ang) * 9); FX.spark(pools.streak, tt, p, v, 1.0 + R() * 0.8, 0.9, 0.3, [1, 0.5, 0.15], 0.045, 0.05, 3); }
            break;
          }
          case 'co2': {
            p.set(e.pos.x + (R() - 0.5) * 0.3, e.pos.y + 0.2, e.pos.z + (R() - 0.5) * 0.3);
            v.set((R() - 0.5) * 2.4, 22 + R() * 7, (R() - 0.5) * 2.4);
            FX.sprite(pools.smoke, tt, p, v, 1.7 + R() * 0.8, 2.6, -0.8, 0.45, 3.6 + R() * 1.6, [1.0, 1.02, 1.08], 0.5);
            break;
          }
          case 'fountain': {
            v.set((R() - 0.5) * 2.2, 7 + R() * 3.5, (R() - 0.5) * 2.2);
            FX.spark(pools.streak, tt, e.pos, v, 1.3 + R() * 0.6, 0.35, 1, [1, 0.72, 0.4], 0.028, 0.07, 3);
            break;
          }
          case 'gerb': {
            v.copy(e.dir).multiplyScalar(14 + R() * 6).add(p.set((R() - 0.5) * 3, (R() - 0.5) * 3, (R() - 0.5) * 3));
            FX.spark(pools.streak, tt, e.pos, v, 1.2 + R() * 0.8, 0.9, 0.7, [1, 0.78, 0.45], 0.035, 0.1, 3);
            break;
          }
          case 'waterfall': {
            const a = e.a, b = e.b, f = R();
            p.set(a.x + (b.x - a.x) * f, a.y, a.z + (b.z - a.z) * f);
            v.copy(e.out).multiplyScalar(0.4 + R() * 0.6); v.y = -R() * 1.0;
            FX.spark(pools.streak, tt, p, v, 1.6 + R() * 0.4, 0.25, 1, [1, 0.74, 0.42], 0.026, 0.09, 3);
            break;
          }
          case 'embers': {
            p.set((R() - 0.5) * 110, R() * 14 + 1, (R() - 0.5) * 140);
            v.set((R() - 0.5) * 1.2, 1.2 + R() * 2.2, (R() - 0.5) * 1.2);
            FX.spark(pools.streak, tt, p, v, 4 + R() * 3, 0.15, -0.06, [1, 0.42, 0.1], 0.04, 0.25, 3);
            break;
          }
          case 'titleEmbers': {
            p.set((R() - 0.5) * 22, 46, (R() - 0.5) * 72);
            v.set((R() - 0.5) * 2, 2.5 + R() * 3, (R() - 0.5) * 2);
            FX.spark(pools.streak, tt, p, v, 3 + R() * 3, 0.2, -0.08, [1, 0.5, 0.14], 0.07, 0.3, 3);
            break;
          }
        }
      }
    }
    // iron flowers (打铁花): molten iron struck against a cold board explodes into a tree of
    // sparks – bursts, not a stream
    function ironStrike(e, ts) {
      const n = Math.round(210 * (ctx.pk || 1));
      const yaw = R() * 6.283, lean = 0.12 + R() * 0.22;
      for (let k = 0; k < n; k++) {
        const a = R() * 6.283, el = 0.8 + R() * 0.72, sp = 11 + R() * 15;
        v.set(Math.cos(el) * Math.cos(a) * sp + Math.cos(yaw) * lean * sp, Math.sin(el) * sp, Math.cos(el) * Math.sin(a) * sp + Math.sin(yaw) * lean * sp);
        FX.spark(pools.streak, ts + R() * 0.04, e.pos, v, 0.9 + R() * 1.2, 0.55, 1, R() < 0.3 ? [2.0, 1.7, 1.2] : [1.9, 0.95, 0.32], 0.15, 0.04, 3);
      }
      p.copy(e.pos); p.y += 0.6;
      FX.sprite(pools.fire, ts, p, v.set(0, 3, 0), 0.25, 1, 0, 0.9, 3.4, [1, 1, 1], 1.2);
    }
    api.update = function (tf, dt) {
      api.flames.length = 0;
      for (let i = emitters.length - 1; i >= 0; i--) {
        const e = emitters[i];
        if (tf > e.t1 + 0.05) { emitters.splice(i, 1); continue; }
        if (tf < e.t0) continue;
        if (e.kind === 'iron') {
          if (e.next == null) e.next = e.t0;
          while (e.next <= tf && e.next <= e.t1) { ironStrike(e, e.next); e.next += 0.16 + R() * 0.26; }
          continue;
        }
        if (e.kind === 'flame' || e.kind === 'vortex') api.flames.push(e);
        emit(e, tf, dt);
      }
    };
    // level-driven emitters (fountains, waterfalls, embers): the caller owns a persistent
    // descriptor { kind, acc, … } so nothing is allocated per frame
    api.continuous = function (e, rate, tf, dt) {
      if (rate <= 0) return;
      e.rate = rate;
      emit(e, tf, dt);
    };
    api.clear = function () { emitters.length = 0; };
    return api;
  };

  /* ═══ CROWD LIGHT STICKS ════════════════════════════════════════════ */
  FX.makeCrowd = function (THREE, ctx, pos, rnd, kind) {
    const { U, G } = ctx;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aR', new THREE.BufferAttribute(rnd, 1));
    g.setAttribute('aK', new THREE.BufferAttribute(kind, 1));
    const m = shader(THREE, U, G.crowdVert, G.pointFrag, { uSize: { value: 0.34 } });
    const pts = new THREE.Points(g, m);
    pts.frustumCulled = false; pts.renderOrder = 6;
    ctx.scene.add(pts);
    return { points: pts, count: pos.length / 3 };
  };

  /* ═══ PEOPLE ════════════════════════════════════════════════════════
     Dark figures under every in-field light stick (and the lower bowl on higher tiers), one arm
     raised to the stick, rim-lit by the stage. Opaque + alpha-tested so they occlude properly and
     benefit from early-z; figures smaller than ~2.5 px are collapsed in the vertex shader. */
  FX.makePeople = function (THREE, ctx, stick, rnd, baseY) {
    const { U, G } = ctx;
    const n = baseY.length;
    const geo = instQuad(THREE, [-0.5, 0.5], [0, 1]);
    const aP = new THREE.InstancedBufferAttribute(stick, 3);
    const aR = new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2);
    for (let i = 0; i < n; i++) { aR.array[i * 2] = rnd[i]; aR.array[i * 2 + 1] = baseY[i]; }
    geo.setAttribute('aP', aP); geo.setAttribute('aR', aR);
    geo.instanceCount = n;
    const mat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: G.peopleVert, fragmentShader: G.peopleFrag, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false; mesh.renderOrder = 1;
    ctx.scene.add(mesh);
    return { mesh, count: n };
  };

  /* ═══ THE PERFORMER ════════════════════════════════════════════════
     One camera-facing card drawn as a signed-distance figure (long coat, mic, pose blends),
     dark against the LED wall with a rim of its light, warmed from the front by the follow spots.
     Rendered into the deck mirror too, so he stands in his own reflection. */
  FX.makePerformer = function (THREE, ctx) {
    const { U } = ctx;
    const vert = /* glsl */`
    #include <common>
    #include <logdepthbuf_pars_vertex>
    uniform vec3 uPos; uniform float uVis;
    varying vec2 vQ; varying vec3 vW;
    void main(){
      vec3 toCam = cameraPosition - uPos;
      vec3 rt = normalize(vec3(toCam.z, 0.0, -toCam.x));
      vec2 q = vec2(position.x * 1.5, position.y * 2.3);
      vec3 w = uPos + rt * q.x + vec3(0.0, q.y, 0.0);
      vQ = q; vW = w;
      gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
      if (uVis <= 0.0) gl_Position = vec4(0.0, 0.0, -2.0, 1.0);
      #include <logdepthbuf_vertex>
    }`;
    const frag = /* glsl */`
    #include <common>
    #include <logdepthbuf_pars_fragment>
    uniform float uTime; uniform float uBeatPulse; uniform vec3 uLedAvg;
    uniform vec4 uPose;      // sing, raise, point, bow weights
    uniform float uWalk; uniform float uFollow; uniform float uFacing; uniform float uClip;
    varying vec2 vQ; varying vec3 vW;
    float seg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
    float figure(vec2 p){
      float t = uTime, bob = uBeatPulse * 0.02;
      float bow = uPose.w;
      // bow: fold forward at the hips (rotate the upper body)
      vec2 hip = vec2(0.0, 0.98);
      vec2 pu = p - hip; float ba = bow * 0.9; pu = mat2(cos(ba), sin(ba), -sin(ba), cos(ba)) * pu; vec2 pb = pu + hip;
      vec2 q = mix(p, pb, step(hip.y - 0.05, p.y) * bow);
      q.y -= bob;
      float st = sin(t * 5.2) * 0.13 * uWalk;
      // legs + shoes
      float d = seg(p, vec2(-0.09, 0.95), vec2(-0.1 + st, 0.06)) - 0.07;
      d = min(d, seg(p, vec2(0.09, 0.95), vec2(0.11 - st, 0.06)) - 0.07);
      d = min(d, seg(p, vec2(-0.1 + st, 0.04), vec2(-0.02 + st, 0.04)) - 0.045);
      d = min(d, seg(p, vec2(0.11 - st, 0.04), vec2(0.19 - st, 0.04)) - 0.045);
      // long coat: shoulders to the knees, flaring, swinging a little
      float sway = sin(t * 1.7) * 0.02 + st * 0.2;
      float yy = clamp((1.44 - q.y) / 0.92, 0.0, 1.0);
      float hw = mix(0.21, 0.33, yy * yy);
      float coat = max(abs(q.x - sway * yy) - hw, max(q.y - 1.46, 0.52 - q.y));
      d = min(d, coat - 0.01);
      d = min(d, seg(q, vec2(-0.17, 1.42), vec2(0.17, 1.42)) - 0.07);
      // head, neck, hair
      d = min(d, length(q - vec2(0.01, 1.69)) - 0.105);
      d = min(d, length((q - vec2(0.0, 1.75)) * vec2(1.0, 1.4)) - 0.11);
      d = min(d, seg(q, vec2(0.0, 1.5), vec2(0.0, 1.6)) - 0.05);
      // mic arm (right): mic at the mouth while singing, high when raised
      vec2 sh = vec2(0.19, 1.41), sl = vec2(-0.19, 1.41);
      vec2 handR = mix(vec2(0.07, 1.62), vec2(0.26, 2.08), uPose.y);
      vec2 elbR = mix(vec2(0.27, 1.2), vec2(0.28, 1.74), uPose.y);
      d = min(d, seg(q, sh, elbR) - 0.05); d = min(d, seg(q, elbR, handR) - 0.042);
      d = min(d, seg(q, handR, handR + mix(vec2(-0.05, 0.07), vec2(0.0, 0.16), uPose.y)) - 0.022);
      // free arm (left): out to the side singing, up when raised, straight out pointing, down when bowing
      vec2 handL = vec2(-0.5, 1.2 + sin(t * 1.3) * 0.05) * uPose.x + vec2(-0.3, 2.06) * uPose.y + vec2(-0.66, 1.5) * uPose.z + vec2(-0.12, 0.85) * uPose.w;
      vec2 elbL = vec2(-0.36, 1.2) * uPose.x + vec2(-0.32, 1.74) * uPose.y + vec2(-0.42, 1.45) * uPose.z + vec2(-0.2, 1.12) * uPose.w;
      d = min(d, seg(q, sl, elbL) - 0.05); d = min(d, seg(q, elbL, handL) - 0.042);
      return d;
    }
    void main(){
      #include <logdepthbuf_fragment>
      vec2 p = vec2(vQ.x * uFacing, vQ.y);
      if (vQ.y < uClip) discard;                  // below the deck while the lift is down
      float d = figure(p);
      if (d > 0.0) discard;
      vec2 e = vec2(0.006, 0.0);
      vec2 gr = normalize(vec2(figure(p + e.xy) - figure(p - e.xy), figure(p + e.yx) - figure(p - e.yx)) + 1e-5);
      float rim = smoothstep(-0.05, 0.0, d);
      float top = smoothstep(0.6, 2.0, p.y);
      vec3 col = vec3(0.006, 0.005, 0.006);
      col += uLedAvg * rim * (0.12 + 0.12 * max(gr.y, 0.0)) * (0.5 + top);
      // follow spots from the main stand: a warm key on the side facing them
      float key = clamp(0.5 + 0.5 * gr.x * uFacing, 0.0, 1.0) * (1.0 - rim * 0.5);
      col += vec3(1.0, 0.86, 0.7) * uFollow * 0.05 * (0.35 + key) * (0.6 + 0.4 * top);
      // a hint of the white shirt and the mic's chrome
      gl_FragColor = vec4(col, 1.0);
    }`;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    const uni = { uPos: { value: new THREE.Vector3() }, uVis: { value: 0 }, uPose: { value: new THREE.Vector4(1, 0, 0, 0) }, uWalk: { value: 0 }, uFollow: { value: 0 }, uFacing: { value: 1 }, uClip: { value: -10 } };
    const mat = new THREE.ShaderMaterial({ uniforms: Object.assign({}, U, uni), vertexShader: vert, fragmentShader: frag, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false; mesh.renderOrder = 1;
    mesh.layers.enable(1);
    ctx.scene.add(mesh);
    const st = {};
    const pose = [0, 0, 0, 0];
    const api = { mesh, pos: uni.uPos.value, visible: false, chest: new THREE.Vector3() };
    api.update = function (showT, S, camPos) {
      KOB.performerAt(showT, st);
      api.visible = st.vis > 0;
      uni.uVis.value = st.vis;
      // the deck surface is at Blender z 3.3; the lift carries him from below
      uni.uPos.value.set(st.x, st.z, -st.y);
      uni.uClip.value = 3.3 - st.z;                // clip what is still under the deck
      for (let i = 0; i < 4; i++) pose[i] = 0;
      pose[st.prevPose] += 1 - st.poseK; pose[st.pose] += st.poseK;
      uni.uPose.value.set(pose[0], pose[1], pose[2], pose[3]);
      uni.uWalk.value = st.walk;
      uni.uFollow.value = S.beams.follow.level;
      // he faces the main stand (+X); seen from behind, the card mirrors so the mic hand stays right
      uni.uFacing.value = camPos.x >= st.x ? 1 : -1;
      api.chest.set(st.x, st.z + 1.35, -st.y);
    };
    return api;
  };

  /* ═══ DRONES ════════════════════════════════════════════════════════
     A fleet lives on the GPU: each drone carries where it came from (aA) and where it is going
     (aB); the vertex shader flies it with a staggered ease and a lift, adds the hover bob and
     paints the light effect. The CPU only writes the two position buffers when a new formation
     is ordered, so a fleet of a thousand costs nothing per frame. */
  const CNF = '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", sans-serif';
  // formations as points in a local frame: x right, y up, z depth, all roughly within [-1, 1]
  FX.droneShape = function (name, N, opts) {
    opts = opts || {};
    const R = KOB.rng(4242 + (name.length * 97));
    // drones placed like a real show: a crisp outline (one drone per cell along every edge) plus an
    // even fill of the inside; image formations keep each pixel's colour. Assignment is shuffled so
    // any subset of the fleet still covers the whole picture.
    const canvasPts = (draw, w, h, img) => {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.strokeStyle = '#fff';
      draw(g, w, h);
      const d = g.getImageData(0, 0, w, h).data;
      const lum = (x, y) => { const i = (y * w + x) * 4; return d[i] * 0.3 + d[i + 1] * 0.55 + d[i + 2] * 0.15; };
      const TH = img ? 58 : 110;
      const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && lum(x, y) > TH;
      const edge = (x, y) => on(x, y) && (!on(x - 1, y) || !on(x + 1, y) || !on(x, y - 1) || !on(x, y + 1));
      const sampleCells = (target, test, pick) => {
        let lo = 1, hi = 48, best = [];
        for (let it = 0; it < 16; it++) {
          const cs = (lo + hi) / 2, list = [];
          for (let y = 0; y < h; y += cs) for (let x = 0; x < w; x += cs) { const p = pick(Math.floor(x), Math.floor(y), Math.max(1, Math.floor(cs))); if (p) list.push(p); }
          best = list;
          if (list.length > target) lo = cs; else hi = cs;
          if (Math.abs(list.length - target) < target * 0.03) break;
        }
        return best;
      };
      const nEdge = Math.round(N * (img ? 0.22 : 0.42)), nFill = N - nEdge;
      const edges = sampleCells(nEdge, edge, (x0, y0, cs) => { for (let y = y0; y < Math.min(h, y0 + cs); y++) for (let x = x0; x < Math.min(w, x0 + cs); x++) if (edge(x, y)) return [x, y]; return null; });
      const fill = sampleCells(nFill, on, (x0, y0, cs) => { const x = Math.min(w - 1, x0 + (cs >> 1)), y = Math.min(h - 1, y0 + (cs >> 1)); return on(x, y) && !edge(x, y) ? [x, y] : null; });
      let pts = edges.concat(fill);
      if (!pts.length) pts = [[w / 2, h / 2]];
      // shuffle, then repeat if the picture needs fewer drones than the fleet has
      for (let i = pts.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const t = pts[i]; pts[i] = pts[j]; pts[j] = t; }
      const out = [], cols = img ? [] : null;
      for (let i = 0; i < N; i++) {
        const p = pts[i % pts.length], dup = i >= pts.length;
        out.push([(p[0] / w * 2 - 1) + (dup ? (R() - 0.5) * 0.006 : 0), -(p[1] / h * 2 - 1) * h / w, (R() - 0.5) * 0.02]);
        if (cols) { const k = (p[1] * w + p[0]) * 4, m = 1.5 / Math.max(0.25, Math.max(d[k], d[k + 1], d[k + 2]) / 255); cols.push([Math.pow(d[k] / 255, 2.2) * m, Math.pow(d[k + 1] / 255, 2.2) * m, Math.pow(d[k + 2] / 255, 2.2) * m]); }
      }
      return cols ? { pts: out, cols } : out;
    };
    switch (name) {
      case 'crown': return { pts: canvasPts((g, w, h) => {
        g.lineWidth = 9; g.lineJoin = 'round'; g.beginPath();
        const y0 = h * 0.74, y1 = h * 0.3;
        g.moveTo(w * 0.15, y0); g.lineTo(w * 0.15, y1 + 30); g.lineTo(w * 0.32, h * 0.52); g.lineTo(w * 0.5, y1 - 10); g.lineTo(w * 0.68, h * 0.52); g.lineTo(w * 0.85, y1 + 30); g.lineTo(w * 0.85, y0); g.closePath(); g.stroke();
        g.beginPath(); g.moveTo(w * 0.15, y0 - 18); g.lineTo(w * 0.85, y0 - 18); g.stroke();
        [[0.15, y1 + 22], [0.5, y1 - 18], [0.85, y1 + 22]].forEach(([x, y]) => { g.beginPath(); g.arc(w * x, y, 11, 0, 7); g.fill(); });
      }, 320, 200), col: [1.0, 0.6, 0.15] };
      case 'heart': return { pts: canvasPts((g, w, h) => {
        g.lineWidth = 10; g.beginPath();
        for (let i = 0; i <= 120; i++) { const t = i / 120 * Math.PI * 2; const x = 16 * Math.sin(t) ** 3, y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t); const px = w / 2 + x * w / 40, py = h * 0.46 - y * w / 40; if (i) g.lineTo(px, py); else g.moveTo(px, py); }
        g.stroke(); g.globalAlpha = 0.5; g.fill();
      }, 320, 260), col: [1.0, 0.12, 0.3] };
      case 'eye': return { pts: canvasPts((g, w, h) => {
        g.lineWidth = 7; g.beginPath(); g.moveTo(w * 0.08, h / 2); g.quadraticCurveTo(w / 2, h * 0.02, w * 0.92, h / 2); g.quadraticCurveTo(w / 2, h * 0.98, w * 0.08, h / 2); g.stroke();
        g.beginPath(); g.arc(w / 2, h / 2, h * 0.24, 0, 7); g.stroke(); g.beginPath(); g.ellipse(w / 2, h / 2, h * 0.06, h * 0.2, 0, 0, 7); g.fill();
      }, 320, 180), col: [1.0, 0.75, 0.2] };
      case 'claws': return { pts: canvasPts((g, w, h) => {
        g.lineCap = 'round';
        for (let k = 0; k < 3; k++) { g.lineWidth = 18 - k * 2; g.beginPath(); g.moveTo(w * (0.25 + k * 0.2), h * 0.1); g.quadraticCurveTo(w * (0.4 + k * 0.2), h * 0.5, w * (0.3 + k * 0.2), h * 0.92); g.stroke(); }
      }, 260, 240), col: [1.0, 0.1, 0.05] };
      case 'star': return { pts: canvasPts((g, w, h) => {
        g.lineWidth = 9; g.lineJoin = 'round'; g.beginPath();
        for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? h * 0.2 : h * 0.46; const x = w / 2 + Math.cos(a) * r, y = h * 0.53 + Math.sin(a) * r; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
        g.stroke(); g.globalAlpha = 0.45; g.fill();
      }, 320, 300), col: [1.0, 0.85, 0.35] };
      case 'note': return { pts: canvasPts((g, w, h) => {
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `900 ${h * 0.9}px "Segoe UI Symbol", "Noto Sans Symbols", "Apple Symbols", sans-serif`;
        g.fillText('♫', w / 2, h * 0.52);
      }, 300, 300), col: [0.4, 0.8, 1.0] };
      case 'eagle': case 'lion': case 'elephant': case 'whale': {
        const im = opts.beasts && opts.beasts[name];
        if (im) { const r = canvasPts((g, w, h) => { g.drawImage(im, 0, 0, w, h); }, 300, 300, true); return { pts: r.pts, cols: r.cols, col: [1, 0.7, 0.3] }; }
        return FX.droneShape('crown', N, opts);
      }
      case 'sphere': return { pts: Array.from({ length: N }, (_, i) => { const y = 1 - (i + 0.5) / N * 2, r = Math.sqrt(1 - y * y), a = i * 2.39996; return [Math.cos(a) * r * 0.62, y * 0.62, Math.sin(a) * r * 0.62]; }), col: [0.3, 0.7, 1.0], spin: 0.25 };
      case 'rings': return { pts: Array.from({ length: N }, (_, i) => { const k = i % 3, a = (i / N) * Math.PI * 2 * 3; const c = Math.cos(a) * 0.6, s2 = Math.sin(a) * 0.6; return k === 0 ? [c, s2, 0] : k === 1 ? [c, 0, s2] : [0, c, s2]; }), col: [1.0, 0.55, 0.15], spin: 0.4 };
      case 'title': if (opts.titleImg) return { pts: canvasPts((g, w, h) => {
        g.save(); g.translate(w / 2, h / 2); g.rotate(Math.PI / 2); g.drawImage(opts.titleImg, -h / 2, -w / 2, h, w); g.restore();
        const d = g.getImageData(0, 0, w, h); for (let i = 0; i < d.data.length; i += 4) { const a = d.data[i + 3]; d.data[i] = d.data[i + 1] = d.data[i + 2] = a > 100 ? 255 : 0; d.data[i + 3] = 255; } g.putImageData(d, 0, 0);
      }, 400, 110), col: [1.0, 0.25, 0.08] };
      // falls through to text
      default: {
        const text = (name === 'title' ? '万兽之王' : name === 'kob' ? 'KING OF BEASTS' : String(opts.text || name)).slice(0, 16);
        const latin = /^[\x00-\x7f]*$/.test(text);
        return { pts: canvasPts((g, w, h) => {
          g.textAlign = 'center'; g.textBaseline = 'middle';
          // CJK at 700: complex characters keep air between their strokes
          let fs = 150; const face = latin ? '"Barlow Condensed", "Arial Narrow", Impact, sans-serif' : CNF, wt = latin ? 900 : 700;
          g.font = `${wt} ${fs}px ${face}`;
          const lines = latin && text.length > 9 && text.includes(' ') ? [text.slice(0, text.lastIndexOf(' ', 9) > 0 ? text.lastIndexOf(' ', 9) : 9), text.slice((text.lastIndexOf(' ', 9) > 0 ? text.lastIndexOf(' ', 9) : 9)).trim()] : [text];
          const mw = Math.max(...lines.map((l) => g.measureText(l).width));
          fs = Math.min(fs, fs * (w * 0.92) / Math.max(1, mw), (h * 0.86) / lines.length / 1.05);
          g.font = `${wt} ${fs}px ${face}`;
          lines.forEach((l, i) => g.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * fs * 1.05));
        }, 680, 260), col: opts.col || [1.0, 0.85, 0.6] };
      }
    }
  };

  FX.makeFleet = function (THREE, ctx, N, o) {
    const { U } = ctx;
    o = o || {};
    const vert = /* glsl */`
    #include <common>
    #include <logdepthbuf_pars_vertex>
    attribute vec3 aA; attribute vec3 aB; attribute vec4 aD;      // delay, phase, random, x across the formation
    attribute vec3 aCA; attribute vec3 aCB;                         // colour: from → to (per drone)
    uniform float uTime; uniform float uPxScale; uniform float uBeatPulse;
    uniform vec3 uCentre; uniform vec3 uAxis;                       // spin axis
    uniform vec4 uMove;   // t0, duration, lift, spin rate
    uniform vec4 uFx;     // level, effect, size, prev effect
    uniform vec3 uColA; uniform vec3 uColB;                         // previous → new colour
    varying vec3 vCol;
    vec3 hue(float h){ return clamp(abs(fract(h + vec3(0.0, 0.667, 0.333)) * 6.0 - 3.0) - 1.0, 0.0, 1.0); }
    vec3 rotY(vec3 p, float a){ float c = cos(a), s = sin(a); return vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c); }
    void main(){
      float k0 = clamp((uTime - uMove.x) / max(uMove.y, 1e-3) * 1.6 - aD.x * 0.6, 0.0, 1.0);
      float k = k0 * k0 * (3.0 - 2.0 * k0);
      vec3 p = mix(aA, aB, k);
      if (uMove.w != 0.0) p = rotY(p, uTime * uMove.w);
      // 'burst': every four seconds the formation blooms outward like a shell and gathers again
      float burst = 0.0;
      if (uFx.y > 3.5) { float ph = fract(uTime / 4.0 + aD.z * 0.04); burst = smoothstep(0.0, 0.12, ph) * (1.0 - smoothstep(0.12, 0.9, ph)); p += p * burst * (0.45 + aD.z * 0.4); }
      p += vec3(sin(uTime * 0.9 + aD.y) * 0.25, sin(uTime * 1.1 + aD.y * 1.3) * 0.3 + sin(3.14159 * k) * uMove.z, cos(uTime * 0.8 + aD.y * 0.7) * 0.25);
      p += uCentre;
      vec4 mv = viewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      float px = uFx.z * uPxScale / max(-mv.z, 0.1);
      float sz = clamp(px, 1.6, 48.0);
      gl_PointSize = sz;
      // light effect: 0 steady twinkle, 1 wave, 2 sparkle, 3 rainbow
      float e = uFx.y;
      vec3 c = mix(aCA, aCB, k);
      float L = 0.75 + 0.25 * sin(uTime * 3.0 + aD.y);
      if (e > 0.5 && e < 1.5) L *= 0.35 + 0.65 * (0.5 + 0.5 * sin(aD.w * 9.0 - uTime * 2.6 + p.y * 0.04));
      else if (e > 1.5 && e < 2.5) L *= 0.55 + (sin(uTime * 17.0 + aD.y * 7.0) > 0.92 ? 3.0 : 0.0) + 0.4 * uBeatPulse;
      else if (e > 2.5 && e < 3.5) c = mix(c, hue(aD.w * 0.8 - uTime * 0.25), 0.85);
      else if (e > 3.5) { L *= 0.8 + 2.2 * burst; c = mix(c, vec3(1.0, 0.92, 0.7), burst * 0.6); }
      // in flight the fleet glows white-hot
      c = mix(c, vec3(1.0, 0.95, 0.85), sin(3.14159 * k) * 0.5);
      vCol = c * 9.0 * uFx.x * L * min((px * px) / (sz * sz), 1.0);
      if (uFx.x <= 0.0) gl_Position = vec4(0.0, 0.0, -2.0, 1.0);
      #include <logdepthbuf_vertex>
    }`;
    const g = new THREE.BufferGeometry();
    const A = new Float32Array(N * 3), Bp = new Float32Array(N * 3), D = new Float32Array(N * 4), CA = new Float32Array(N * 3).fill(0.8), CB = new Float32Array(N * 3).fill(0.8);
    const R = KOB.rng(o.seed || 4242);
    for (let i = 0; i < N; i++) D.set([R(), R() * 100, R(), 0], i * 4);
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    const aA = new THREE.BufferAttribute(A, 3).setUsage(THREE.DynamicDrawUsage), aB = new THREE.BufferAttribute(Bp, 3).setUsage(THREE.DynamicDrawUsage), aD = new THREE.BufferAttribute(D, 4).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aA', aA); g.setAttribute('aB', aB); g.setAttribute('aD', aD);
    const aCA = new THREE.BufferAttribute(CA, 3).setUsage(THREE.DynamicDrawUsage), aCB = new THREE.BufferAttribute(CB, 3).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aCA', aCA); g.setAttribute('aCB', aCB);
    const uni = {
      uCentre: { value: new THREE.Vector3() }, uAxis: { value: new THREE.Vector3(0, 1, 0) },
      uMove: { value: new THREE.Vector4(-100, 1, 0, 0) }, uFx: { value: new THREE.Vector4(0, 0, o.size || 1.1, 0) },
      uColA: { value: new THREE.Vector3(1, 0.6, 0.2) }, uColB: { value: new THREE.Vector3(1, 0.6, 0.2) },
    };
    const mat = new THREE.ShaderMaterial({ uniforms: Object.assign({}, U, uni), vertexShader: vert, fragmentShader: KOB.GLSL.pointFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const pts = new THREE.Points(g, mat);
    pts.frustumCulled = false; pts.renderOrder = 6;
    pts.layers.enable(4);   // the fleets also float in the lake
    ctx.scene.add(pts);
    const api = { points: pts, uni, N, shape: null, key: '' };
    const cur = new THREE.Vector3();
    let spinRate = 0;
    // where each drone is right now (for a mid-flight re-order), in the fleet frame
    function current(i, t, out) {
      const m = uni.uMove.value;
      const k0 = Math.min(1, Math.max(0, (t - m.x) / Math.max(m.y, 1e-3) * 1.6 - D[i * 4] * 0.6));
      const k = k0 * k0 * (3 - 2 * k0);
      out.set(A[i * 3] + (Bp[i * 3] - A[i * 3]) * k, A[i * 3 + 1] + (Bp[i * 3 + 1] - A[i * 3 + 1]) * k, A[i * 3 + 2] + (Bp[i * 3 + 2] - A[i * 3 + 2]) * k);
      if (spinRate) { const a = t * spinRate, c = Math.cos(a), s = Math.sin(a); out.set(out.x * c + out.z * s, out.y, -out.x * s + out.z * c); }
      return out;
    }
    // frame: centre (three), right / up / facing unit vectors (three), scale in metres
    api.order = function (shape, frame, t, opts) {
      opts = opts || {};
      const dur = opts.dur == null ? 4.5 : opts.dur;
      const newCentre = frame.centre;
      const oc = uni.uCentre.value;
      const ns = shape.spin || 0, ua = -t * ns, uc = Math.cos(ua), us = Math.sin(ua);
      const c = opts.col || shape.col, useImg = !!shape.cols && !opts.col;
      const m0 = uni.uMove.value;
      for (let i = 0; i < N; i++) {
        // colour: where this drone's colour is now → its new colour
        const k0 = Math.min(1, Math.max(0, (t - m0.x) / Math.max(m0.y, 1e-3) * 1.6 - D[i * 4] * 0.6)), kc = k0 * k0 * (3 - 2 * k0);
        for (let j = 0; j < 3; j++) CA[i * 3 + j] = CA[i * 3 + j] + (CB[i * 3 + j] - CA[i * 3 + j]) * kc;
        const tc = useImg ? shape.cols[i % shape.cols.length] : c;
        CB[i * 3] = tc[0]; CB[i * 3 + 1] = tc[1]; CB[i * 3 + 2] = tc[2];
        current(i, t, cur);
        cur.add(oc).sub(newCentre);
        // the shader spins the whole mix: pre-rotate the start back so nobody jumps
        if (ns) cur.set(cur.x * uc + cur.z * us, cur.y, -cur.x * us + cur.z * uc);
        A[i * 3] = cur.x; A[i * 3 + 1] = cur.y; A[i * 3 + 2] = cur.z;
        const p = shape.pts[i % shape.pts.length], sc = frame.scale;
        Bp[i * 3] = (frame.right.x * p[0] + frame.up.x * p[1] + frame.face.x * p[2]) * sc;
        Bp[i * 3 + 1] = (frame.right.y * p[0] + frame.up.y * p[1] + frame.face.y * p[2]) * sc;
        Bp[i * 3 + 2] = (frame.right.z * p[0] + frame.up.z * p[1] + frame.face.z * p[2]) * sc;
        D[i * 4 + 3] = p[0] * 0.5 + 0.5;
      }
      uni.uCentre.value.copy(newCentre);
      spinRate = shape.spin || 0;
      uni.uMove.value.set(t, dur, dur > 0.2 ? (opts.lift == null ? 10 : opts.lift) : 0, spinRate);
      if (dur <= 0.2) CA.set(CB);
      aA.needsUpdate = aB.needsUpdate = aD.needsUpdate = aCA.needsUpdate = aCB.needsUpdate = true;
      api.shape = shape; api.frame = frame;
    };
    api.setLook = function (level, effect) { uni.uFx.value.x = level; if (effect != null) uni.uFx.value.y = effect; };
    // recolour in place: the same formation re-ordered with no lift, so only the colour blends
    api.setColour = function (c, t) { if (api.shape) api.order(api.shape, api.frame, t, { dur: 1.2, lift: 0, col: c }); };
    return api;
  };

  /* ═══ HAZE FIELD (persistent drifting smoke banks, deck fog) ════════ */
  FX.makeHaze = function (THREE, ctx, n, deckN) {
    const { U, G } = ctx;
    const vert = /* glsl */`
    #include <common>
    #include <logdepthbuf_pars_vertex>
    attribute vec4 aB; attribute vec4 aS;
    uniform float uTime; uniform float uFog;
    varying vec2 vUv; varying float vLife; varying vec4 vC; varying float vSeed; varying vec3 vW;
    void main(){
      float period = aS.z;
      float ph = fract((uTime + aS.w * period) / period);
      vec3 P = aB.xyz + vec3(cos(aB.w), 0.0, sin(aB.w)) * (ph - 0.5) * aS.y + vec3(0.0, sin(uTime * 0.05 + aS.w * 9.0) * 1.5, 0.0);
      vec4 mv = viewMatrix * vec4(P, 1.0);
      float rot = aS.w * 6.28 + uTime * 0.02 * (aS.w - 0.5);
      vec2 q = mat2(cos(rot), -sin(rot), sin(rot), cos(rot)) * position.xy;
      mv.xy += q * aS.x;
      gl_Position = projectionMatrix * mv;
      vUv = position.xy; vLife = ph; vSeed = aS.w; vW = P;
      float near = smoothstep(6.0, 40.0, -mv.z);
      vC = vec4(0.42, 0.42, 0.45, (aB.y < 8.0 ? 0.06 * uFog : 0.016) * near);
      #include <logdepthbuf_vertex>
    }`;
    const geo = instQuad(THREE, [-1, 1], [-1, 1]);
    const total = n + deckN;
    const aB = iattr(THREE, geo, 'aB', total, 4), aS = iattr(THREE, geo, 'aS', total, 4);
    const R = KOB.rng(77);
    for (let i = 0; i < total; i++) {
      let x, y, z, s;
      if (i < n) {
        const a = R() * Math.PI * 2, r = Math.sqrt(R());
        x = Math.cos(a) * r * 95; z = Math.sin(a) * r * 135; y = 6 + R() * 34; s = 22 + R() * 26;
      } else {
        // low fog: a thin layer hugging the deck (top 3.2 m) and the field, never at eye height
        x = (R() - 0.5) * 62; z = (R() - 0.5) * 94; y = 3.5 + R() * 0.6; s = 6 + R() * 6;
        if (R() < 0.45) { x = (R() - 0.5) * 100; z = (R() - 0.5) * 150; y = 0.5 + R() * 0.6; if (Math.abs(x) < 34 && Math.abs(z) < 50) x += Math.sign(x || 1) * 36; }
      }
      aB.array.set([x, y, z, R() * Math.PI * 2], i * 4);
      aS.array.set([s, 18 + R() * 30, 30 + R() * 40, R()], i * 4);
    }
    geo.instanceCount = total;
    const mat = shader(THREE, U, vert, G.smokeFrag, { uFog: { value: 1 } }, {
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false; mesh.renderOrder = 2;
    ctx.scene.add(mesh);
    return { mesh, mat };
  };
})();
