(window.KOB_FILES = window.KOB_FILES || {}).sfx = '12';
/* ═══════════════════════════════════════════════════════════════════
   KING OF BEASTS — special effects, build 12
   Twenty more set pieces, eleven in the bowl and nine outside. Every one is ADDED effect geometry
   (the venue model is untouched) and almost all of them animate entirely on the GPU: the CPU sets
   a level and a few frame vectors, nothing is re-uploaded per frame. A rig at level 0 is hidden,
   so an idle effect costs nothing.
   The pyro-based ones (ring of fire, fire tornado, fire on water, iron flowers) live in the pyro
   emitters (kob-fx.js); the card stunt and shockwave flash ride on the crowd shader, the city
   light show on the city shader. This file owns the rest and the shared catalogue.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const KOB = (window.KOB = window.KOB || {});

  /* ── catalogue (drives the effects desk) ─────────────────────────── */
  // type 'level': a cue the show runs (and the desk can run for a while); 'shot': a one-off
  // d / de: one-line caption for the tour; v: its vantage point (Blender x, y, z · target · lens mm)
  KOB.SFX_LIST = [
    { id: 'halo',     where: 'in',  type: 'level', cn: '光环',     en: 'Halo hoops',      icon: 'M3 13a9 3.6 0 1 0 18 0a9 3.6 0 1 0-18 0M6 8.5a6 2.4 0 1 0 12 0a6 2.4 0 1 0-12 0', d: '三道巨型光环绕主屏升降、倾斜、追光', de: 'Three giant LED hoops rise, tilt and chase round the main screen', v: [0, -98, 26, 0, 0, 26, 20] },
    { id: 'ball',     where: 'in',  type: 'level', cn: '镜球',     en: 'Mirror ball',     icon: 'M12 2v5M7 12a5 5 0 1 0 10 0a5 5 0 1 0-10 0M7 12h10M12 7c-2 1.5-2 8.5 0 10M12 7c2 1.5 2 8.5 0 10M3 19l2-1.5M21 19l-2-1.5M2.5 13.5h1.5M20 13.5h1.5', d: '镜面球从屏底降下，光斑爬满整个看台', de: 'A mirror ball drops from the screen and throws spots across the stands', v: [10, -34, 7, 0, 0, 12, 26] },
    { id: 'holo',     where: 'in',  type: 'level', cn: '全息巨兽', en: 'Hologram beast',  icon: 'M12 3l6.5 3.6v6.8L12 17l-6.5-3.6V6.6zM12 10.4v6.6M5.5 6.6l6.5 3.8 6.5-3.8M4 21h16', d: '光点拼出的巨兽悬在屋顶之上，始终面向你', de: 'A beast of light hovers over the roof, always turned to you', v: [0, -280, 60, 0, 0, 72, 55] },
    { id: 'shock',    where: 'in',  type: 'shot',  cn: '冲击波',   en: 'Shockwave',       icon: 'M10.5 12a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0M6.5 12a5.5 5.5 0 0 1 11 0M6.5 12a5.5 5.5 0 0 0 11 0M2.5 12a9.5 9.5 0 0 1 19 0M2.5 12a9.5 9.5 0 0 0 19 0', d: '光环从舞台冲出掠过人海，荧光棒随之闪亮', de: 'Rings of light race over the crowd; light sticks flash as each passes', v: [0, -120, 120, 0, 0, 0, 22] },
    { id: 'rain',     where: 'in',  type: 'level', cn: '光之雨',   en: 'Light rain',      icon: 'M5 3v5M9 5v7M13 3v8M17 6v6M21 3v4M5 12v1.5M9 16v2M13 15v2.5M17 16v1.5M21 11v2', d: '光滴沿两百根灯管落下', de: 'Drops of light run down two hundred LED tubes', v: [0, -88, 12, 0, 0, 20, 22] },
    { id: 'fireRing', where: 'in',  type: 'shot',  cn: '火环',     en: 'Ring of fire',    icon: 'M3.5 16a8.5 3.8 0 1 0 17 0a8.5 3.8 0 1 0-17 0M7 13.5c-.6-2.2 1.2-3.2.6-5.8 1.8 1 2.8 3 2.2 5.4M14.2 13.2c-.4-2 1-3.2.6-5.6 1.8 1 2.6 3.2 2 5.6', d: '火焰沿舞台边缘追逐两圈', de: 'Flames chase twice round the stage edge', v: [40, -75, 30, 0, 0, 3, 26] },
    { id: 'vortex',   where: 'in',  type: 'shot',  cn: '火龙卷',   en: 'Fire tornado',    icon: 'M3 4h18M5.5 8h13M8 12h9M9.5 16h5M11 20h2', d: '舞台四角卷起火龙卷', de: 'Fire tornadoes twist up from the stage corners', v: [55, -80, 12, 29.5, -45.5, 12, 28] },
    { id: 'snow',     where: 'in',  type: 'level', cn: '金箔雪',   en: 'Gold snow',       icon: 'M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M10 4.5l2 1.5 2-1.5M10 19.5l2-1.5 2 1.5', d: '金箔在光束中飘落闪烁', de: 'Gold leaf drifts down, glinting in the beams', v: [25, -70, 14, 0, 0, 20, 24] },
    { id: 'hyper',    where: 'in',  type: 'level', cn: '激光沙漏', en: 'Laser hourglass', icon: 'M4 3h16M4 21h16M6 3l12 18M18 3L6 21M10 3l4 18M14 3l-4 18', d: '两组激光交叉成旋转的沙漏', de: 'Two laser sets cross into a turning hourglass', v: [0, -100, 10, 0, 0, 26, 18] },
    { id: 'card',     where: 'in',  type: 'level', cn: '看台字幕', en: 'Card stunt',      icon: 'M3 5h18v14H3zM6 9h2.5M11 9h2M15.5 9h2.5M6 12.5h4.5M13 12.5h5M6 16h2M10.5 16h7.5', d: '每个座位亮灯，拼出灯牌文字环绕全场', de: 'Every seat lights up to spell the sign round the bowl', v: [0, -60, 120, 0, 120, 25, 22] },
    { id: 'galaxy',   where: 'in',  type: 'level', cn: '星河',     en: 'Galaxy',          icon: 'M12 12c.8-.9 2.2-.5 2.3.8.2 1.8-2 2.9-3.6 2-2.3-1.2-2-4.6.2-5.8 3-1.6 6.6.4 6.8 3.8.2 4.2-4.4 6.6-8.2 4.8C5.4 15.8 5 10.4 8.4 7.6', d: '屋顶开口里旋转的螺旋星河', de: 'A spiral galaxy turning in the roof opening', v: [0, -120, 140, 0, 0, 55, 22] },
    { id: 'lanterns', where: 'out', type: 'level', cn: '孔明灯',   en: 'Sky lanterns',    icon: 'M8 6h8l1.2 9H6.8zM10 15v2h4v-2M12 17v3.5M9.2 6l.8-2.2h4l.8 2.2', d: '孔明灯从广场和湖岸冉冉升起', de: 'Sky lanterns rise from the plaza and the lakeside', v: [320, -280, 15, 0, 0, 70, 24] },
    { id: 'aurora',   where: 'out', type: 'level', cn: '极光',     en: 'Aurora',          icon: 'M3 17c3-8 5-8 7-3s4 5 6-1 3-5 5-4M6 14V9M10 13V6M14 13V5M18 11V7M3 21h18', d: '绿紫极光垂挂在鸟巢后方的夜空', de: 'Green-violet aurora curtains behind the Nest', v: [150, -300, 15, -300, 300, 250, 18] },
    { id: 'lakeFire', where: 'out', type: 'shot',  cn: '水上火焰', en: 'Fire on water',   icon: 'M12 14.5c-2.5 0-4-1.6-4-3.8 0-2.6 2.5-3.6 2.5-7.2 2 1.3 5.5 4 5.5 7.2 0 2.2-1.5 3.8-4 3.8zM3 18.5c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0', d: '龙形水系沿岸喷出一排火焰', de: 'A row of flame jets along the lake shore', v: [360, -120, 10, 300, -190, 6, 26] },
    { id: 'lotus',    where: 'out', type: 'level', cn: '莲花灯',   en: 'Lotus lights',    icon: 'M12 5.5c2 2 2 6 0 9-2-3-2-7 0-9zM12 14.5c-3 0-6-2-7-5 3 0 5 1 7 5zM12 14.5c3 0 6-2 7-5-3 0-5 1-7 5zM4 18.5c2.7-1.2 5.3-1.2 8 0s5.3 1.2 8 0', d: '莲花灯顺着湖水漂流', de: 'Lotus lamps drifting down the lake', v: [262, -330, 7, 270, -200, 0, 26] },
    { id: 'proj',     where: 'out', type: 'level', cn: '地面投影', en: 'Plaza mapping',   icon: 'M2 16l10-5 10 5-10 5zM7 16l5-2.5 5 2.5-5 2.5zM12 2v6M9 5.5L12 8l3-2.5', d: '鸟巢四周的广场变成投影画布', de: 'The plaza round the Nest becomes one projection canvas', v: [0, -430, 230, 0, 0, 0, 24] },
    { id: 'flies',    where: 'out', type: 'level', cn: '萤火',     en: 'Fireflies',       icon: 'M5 8m-1.2 0a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0-2.4 0M11 4.5m-.9 0a.9 .9 0 1 0 1.8 0a.9 .9 0 1 0-1.8 0M17.5 9m-1.4 0a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0-2.8 0M8.5 15m-.9 0a.9 .9 0 1 0 1.8 0a.9 .9 0 1 0-1.8 0M15 16.5m-1.2 0a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0-2.4 0M5 20m-.7 0a.7 .7 0 1 0 1.4 0a.7 .7 0 1 0-1.4 0M20 19.5m-.8 0a.8 .8 0 1 0 1.6 0a.8 .8 0 1 0-1.6 0', d: '湖岸与树下的点点萤火', de: 'Fireflies along the banks and under the trees', v: [332, -205, 2.5, 322, -60, 1.5, 26] },
    { id: 'city',     where: 'out', type: 'level', cn: '城市灯光', en: 'City light show', icon: 'M3 21V11h4v10M7 21V5h5v16M12 21V9h4v12M16 21v-8h5v8M9 8.5h1M9 12h1M9 15.5h1M14 12.5h.5M18.5 16h.5', d: '城市天际线随演出变色，光波由鸟巢扩散', de: 'The skyline takes the show colours as a wave rolls out from the Nest', v: [420, -640, 230, 0, 0, 30, 20] },
    { id: 'blimp',    where: 'out', type: 'level', cn: '飞艇',     en: 'LED blimp',       icon: 'M3 11c0-2.5 4-4.5 9-4.5s9 2 9 4.5-4 4.5-9 4.5-9-2-9-4.5zM10 15.5v2h4v-2M8 11h8M21 9l1.5-1.5M21 13l1.5 1.5', d: '六十米 LED 飞艇环绕鸟巢，侧面滚动跑马灯', de: 'A 60 m LED blimp circles the Nest, the ticker scrolling on its flanks', v: [0, -430, 60, 0, 0, 80, 22] },
    { id: 'iron',     where: 'out', type: 'shot',  cn: '打铁花',   en: 'Iron flowers',    icon: 'M12 21v-4M12 17L5.5 8M12 17l6.5-9M12 17L9 3.5M12 17l3-13.5M12 17l-9-4M12 17l9-4', d: '湖对岸的传统打铁花', de: 'Traditional molten-iron flowers across the lake', v: [200, -95, 6, 244, -135, 10, 28] },
  ];

  const VS = '#include <common>\n#include <logdepthbuf_pars_vertex>\n';
  const ENER = 'min((px * px) / (s * s), 1.0)';     // sub-pixel points keep their energy, not their size

  KOB.makeSFX = function (THREE, ctx, o) {
    const { U, G, scene } = ctx;
    const V3 = THREE.Vector3;
    const api = { parts: {} };
    const ptsMat = (vert, extra, frag) => new THREE.ShaderMaterial({ uniforms: Object.assign({}, U, extra || {}), vertexShader: vert, fragmentShader: frag || G.pointFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const points = (attrs, mat, order) => {
      const g = new THREE.BufferGeometry();
      const n = attrs[Object.keys(attrs)[0]].n;
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      for (const k in attrs) g.setAttribute(k, new THREE.BufferAttribute(attrs[k].a, attrs[k].s));
      const p = new THREE.Points(g, mat);
      p.frustumCulled = false; p.renderOrder = order || 6; p.visible = false;
      scene.add(p);
      return p;
    };
    const attr = (n, s) => ({ n, s, a: new Float32Array(n * s) });
    const R = KOB.rng(1212);
    const gauss = () => (R() + R() + R() - 1.5) / 1.5;

    /* ═══ IN THE BOWL ═══════════════════════════════════════════════ */

    /* 1 · halo hoops: three giant LED hoops around the box, rising, tilting and chasing */
    const uHalo = { value: new THREE.Vector4() };
    {
      const H = 2400, N = 3 * H, a = attr(N, 3);
      for (let i = 0; i < N; i++) a.a.set([Math.floor(i / H), (i % H) / H, R()], i * 3);
      const p = points({ aH: a }, ptsMat(/* glsl */`${VS}
        attribute vec3 aH;
        uniform float uTime; uniform float uBeatPulse; uniform float uPxScale; uniform vec3 uPalA; uniform vec3 uPalB;
        uniform vec4 uHalo;   // level, mode (0 chase · 1 beat), -, -
        varying vec3 vCol;
        void main(){
          float k = aH.x, a = aH.y * 6.2831853;
          float A = 30.0 + k * 2.4, Bm = 45.5 + k * 3.0;
          vec3 q = vec3(A * cos(a), 0.0, -Bm * sin(a));
          float ph = uTime * (0.21 + 0.06 * k) + k * 2.1;
          vec3 ax = vec3(cos(ph), 0.0, sin(ph));
          float tl = 0.09 + 0.05 * sin(uTime * 0.37 + k * 1.7);
          q = q * cos(tl) + cross(ax, q) * sin(tl) + ax * dot(ax, q) * (1.0 - cos(tl));
          q.y += 22.0 + 6.0 * sin(uTime * 0.41 + k * 2.094) + (k - 1.0) * 4.5;
          vec4 mv = viewMatrix * vec4(q, 1.0);
          gl_Position = projectionMatrix * mv;
          float px = 0.5 * uPxScale / max(-mv.z, 0.1);
          float s = clamp(px, 1.5, 24.0);
          gl_PointSize = s;
          float dir = mod(k, 2.0) > 0.5 ? -1.0 : 1.0;
          float chase = pow(0.5 + 0.5 * sin(a * 7.0 - uTime * 3.2 * dir + k * 2.0), 6.0);
          float f = uHalo.y > 0.5 ? 0.45 + 0.55 * uBeatPulse + 0.4 * chase : 0.35 + 0.9 * chase;
          vec3 c = mix(mix(uPalA, uPalB, 0.25 * k), vec3(1.0, 0.92, 0.8), 0.25 + 0.45 * chase);
          vCol = c * f * 13.0 * mix(1.0, 0.45, smoothstep(4.0, 14.0, px)) * uHalo.x * ${ENER};
          #include <logdepthbuf_vertex>
        }`, { uHalo }));
      p.layers.enable(1);                       // the glossy deck reflects them
      api.parts.halo = p;
    }

    /* 2 · mirror ball: drops out of the LED box over the singer, throws a galaxy of spots
       crawling round the stands */
    const uBall = { value: new THREE.Vector4() };   // level, drop, rotation, -
    const ball = new THREE.Group(); ball.visible = false; scene.add(ball);
    {
      const geo = new THREE.SphereGeometry(2.6, 56, 36);
      const m = new THREE.ShaderMaterial({
        uniforms: Object.assign({}, U, { uBall }),
        vertexShader: `${VS} varying vec3 vN; varying vec3 vW;
          void main(){ vN = normal; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w;
          #include <logdepthbuf_vertex>
          }`,
        fragmentShader: /* glsl */`
          #include <common>
          #include <logdepthbuf_pars_fragment>
          uniform float uTime; uniform vec3 uPalA; uniform vec3 uPalB; uniform vec4 uBall;
          varying vec3 vN; varying vec3 vW;
          ${G.noise}
          void main(){
            #include <logdepthbuf_fragment>
            vec3 n = normalize(vN);
            float lon = atan(n.z, n.x) + uBall.z, lat = asin(clamp(n.y, -1.0, 1.0));
            vec2 g = vec2(lon / 6.2831853 * 64.0, lat / 3.14159265 * 32.0);
            vec2 id = floor(g), fr = fract(g);
            float tile = step(0.09, fr.x) * step(fr.x, 0.91) * step(0.09, fr.y) * step(fr.y, 0.91);
            float h = kHash21(id + 7.0);
            vec3 V = normalize(cameraPosition - vW);
            // each mirror catches the follow spot as it turns past: sharp, short glints
            float glint = pow(max(0.0, sin(uTime * 1.9 + h * 50.0 + id.x * 0.41)), 22.0);
            float face = max(dot(n, V), 0.0);
            // silver mirrors: each one shows a patch of the lit bowl (warm stage below, stands and
            // show colours around, dark roof above)
            vec3 R = reflect(-V, n);
            vec3 env = mix(vec3(0.5, 0.42, 0.34), mix(uPalA, uPalB, h) * 0.9, smoothstep(-0.2, 0.3, R.y)) * mix(1.0, 0.12, smoothstep(0.3, 0.9, R.y));
            env *= 0.18 + 0.5 * kHash21(id + 3.0);
            vec3 col = (env + vec3(1.0, 0.95, 0.86) * glint * 14.0 * (0.3 + 0.7 * face)) * tile + vec3(0.01) * (1.0 - tile);
            gl_FragColor = vec4(col * (0.25 + 0.75 * uBall.x), 1.0);
          }`,
      });
      const sph = new THREE.Mesh(geo, m); ball.add(sph); ball.userData.sph = sph;
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 6), new THREE.MeshBasicMaterial({ color: 0x050505 }));
      ball.add(cable); ball.userData.cable = cable;
      // the spots thrown onto the seating (azimuth, fraction up the bowl, random, size)
      const N = 2400, d = attr(N, 4);
      for (let i = 0; i < N; i++) d.a.set([R() * 6.2832, 0.03 + 0.94 * Math.sqrt(R()), R(), 0.7 + 0.6 * R()], i * 4);
      api.parts.ballDots = points({ aD: d }, ptsMat(/* glsl */`${VS}
        attribute vec4 aD;
        uniform float uTime; uniform float uPxScale; uniform vec3 uPalA; uniform vec4 uBall;
        varying vec3 vCol;
        float ellR(float a, float b, float th){ float c = cos(th) / a, s = sin(th) / b; return 1.0 / sqrt(c * c + s * s); }
        void main(){
          float th = aD.x + uBall.z * 1.0;
          float ri = ellR(61.5, 106.0, th), ro = ellR(142.6, 164.7, th);
          float r = ri + (ro - ri) * aD.y;
          vec3 p = vec3(r * cos(th), 2.0 + 53.0 * aD.y + 1.1, -r * sin(th));
          vec4 mv = viewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float px = 1.7 * aD.w * uPxScale / max(-mv.z, 0.1);
          float s = clamp(px, 1.8, 40.0);
          gl_PointSize = s;
          float tw = 0.65 + 0.35 * sin(uTime * (3.0 + 4.0 * aD.z) + aD.z * 40.0);
          vec3 c = mix(vec3(1.0, 0.95, 0.88), uPalA, 0.18 * step(0.7, aD.z));
          vCol = c * tw * 13.0 * mix(1.0, 0.4, smoothstep(6.0, 24.0, px)) * uBall.x * smoothstep(0.6, 1.0, uBall.y) * ${ENER};
          #include <logdepthbuf_vertex>
        }`, { uBall }), 7);
    }

    /* 3 · hologram beast: the king (or any of the four) projected above the canopy, built from
       ~9 000 light points that keep the tower art's colours, scan-lined, flickering, revealed
       bottom-up and always turned to the camera */
    const uHolo = { value: new THREE.Vector4() };     // level, reveal, glitch, scale
    const uHoloC = { value: new V3(0, 72, 0) }, uHoloR = { value: new V3(1, 0, 0) }, uHoloF = { value: new V3(0, 0, 1) };
    const BEASTS = ['eagle', 'lion', 'elephant', 'whale'];
    const holoGeos = [];
    {
      const N = 12000;
      BEASTS.forEach((b) => {
        const sh = KOB.fx.droneShape(b, N, { beasts: o.beasts });
        const lp = attr(N, 3), lc = attr(N, 3), lr = attr(N, 1);
        for (let i = 0; i < N; i++) {
          const q = sh.pts[i]; lp.a.set([q[0], q[1], q[2] * 4], i * 3);
          const c = sh.cols ? sh.cols[i] : sh.col; lc.a.set(c, i * 3); lr.a[i] = R();
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(lp.a, 3));
        g.setAttribute('aC', new THREE.BufferAttribute(lc.a, 3)); g.setAttribute('aR', new THREE.BufferAttribute(lr.a, 1));
        holoGeos.push(g);
      });
      const m = ptsMat(/* glsl */`${VS}
        attribute vec3 aC; attribute float aR;
        uniform float uTime; uniform float uPxScale;
        uniform vec4 uHolo; uniform vec3 uHoloC; uniform vec3 uHoloR; uniform vec3 uHoloF;
        varying vec3 vCol;
        ${G.noise}
        void main(){
          vec3 lp = position;
          float yN = lp.y * 0.5 + 0.5;
          // glitch: a few horizontal slices jump sideways for a frame or two
          float slice = floor(lp.y * 16.0), tk = floor(uTime * 11.0);
          float gl = step(0.965, kHash11(slice * 1.7 + tk)) * uHolo.z;
          lp.x += gl * (kHash11(slice * 3.1 + tk) - 0.5) * 0.14;
          lp.z += sin(uTime * 1.3 + aR * 6.2831) * 0.03;
          // reveal: a scan front climbs the figure; unrevealed points rise away as dust
          float front = uHolo.y * 1.15 - yN;
          float vis = smoothstep(0.0, 0.05, front);
          float lift = (1.0 - vis) * (0.2 + aR * 0.6);
          vec3 w = uHoloC + (uHoloR * lp.x + vec3(0.0, 1.0, 0.0) * (lp.y + lift) + uHoloF * lp.z) * uHolo.w;
          vec4 mv = viewMatrix * vec4(w, 1.0);
          gl_Position = projectionMatrix * mv;
          float px = 0.5 * uPxScale / max(-mv.z, 0.1);
          float s = clamp(px, 1.5, 18.0);
          gl_PointSize = s;
          float edge = exp(-kSq(front / 0.025));
          float scan = 0.7 + 0.3 * sin(lp.y * 70.0 - uTime * 6.0);
          float band = 1.0 + 0.8 * exp(-kSq((fract(uTime * 0.18) * 2.4 - 0.2 - yN) / 0.03));
          float lum = dot(aC, vec3(0.3, 0.55, 0.15));
          vec3 col = mix(aC, vec3(0.35, 0.85, 1.0) * lum * 1.6, 0.4);
          float flick = 0.86 + 0.14 * kHash11(floor(uTime * 24.0));
          vCol = (col * vis * scan * band * flick + vec3(0.55, 0.95, 1.0) * edge * 2.4) * uHolo.x * 7.0 * mix(1.0, 0.5, smoothstep(4.0, 12.0, px)) * ${ENER};
          #include <logdepthbuf_vertex>
        }`, { uHolo, uHoloC, uHoloR, uHoloF });
      const p = new THREE.Points(holoGeos[1], m);
      p.frustumCulled = false; p.renderOrder = 7; p.visible = false;
      scene.add(p);
      api.parts.holo = p;
    }

    /* 4 · shockwave: rings of light race across the deck and the field on the drops (the crowd's
       light sticks flash as each ring passes them – see the crowd shader) */
    {
      const m = new THREE.ShaderMaterial({
        uniforms: U,
        vertexShader: `${VS} varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w;
          #include <logdepthbuf_vertex>
          }`,
        fragmentShader: /* glsl */`
          #include <common>
          #include <logdepthbuf_pars_fragment>
          uniform float uTime; uniform vec3 uPalA; uniform vec4 uShock;
          varying vec3 vW;
          float ring(float d, float t0){
            float a = uTime - t0;
            if (a < 0.0 || a > 3.4) return 0.0;
            float x = (d - a * 36.0) / (2.4 + a * 1.8);
            return exp(-x * x) * exp(-a * 0.7);
          }
          void main(){
            #include <logdepthbuf_fragment>
            float d = length(vec2(vW.x, vW.z / 1.55));
            float r = ring(d, uShock.x) + ring(d, uShock.y) * 0.8;
            float grid = 0.45 + 0.55 * smoothstep(0.75, 1.0, abs(sin(d * 1.4)));
            float inside = 1.0 - smoothstep(0.93, 1.0, length(vec2(vW.x / 61.5, vW.z / 106.0)));
            vec3 c = mix(uPalA, vec3(1.0, 0.9, 0.74), 0.55);
            gl_FragColor = vec4(c * r * grid * inside * 9.0 * uShock.z, 1.0);
          }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
      });
      const field = new THREE.Mesh(new THREE.PlaneGeometry(126, 214).rotateX(-Math.PI / 2), m);
      field.position.y = 1.72;                      // just over the in-field crowd (its blocks top out at 1.67)
      const deck = new THREE.Mesh(new THREE.PlaneGeometry(66, 98).rotateX(-Math.PI / 2), m);
      deck.position.y = 4.06;                       // on the deck's raised apron ring (4.0)
      for (const x of [field, deck]) { x.frustumCulled = false; x.renderOrder = 3; x.visible = false; scene.add(x); }
      api.parts.shock = [field, deck];
    }

    /* 5 · light rain: two hundred pixel tubes round the stage, drops of light falling down them */
    const uRain = { value: new THREE.Vector4() };
    {
      const T = 200, ROWS = 32, N = T * ROWS, a = attr(N, 4);
      for (let t = 0; t < T; t++) { const ang = (t + (t % 2) * 0.5) / T * 6.2832, ring = t % 2, ph = R(), sp = R(); for (let j = 0; j < ROWS; j++) a.a.set([ang + ring * 20, j / (ROWS - 1), ph, sp], (t * ROWS + j) * 4); }
      const p = points({ aT: a }, ptsMat(/* glsl */`${VS}
        attribute vec4 aT;
        uniform float uTime; uniform float uPxScale; uniform vec3 uPalB; uniform vec4 uRain;
        varying vec3 vCol;
        void main(){
          float ring = step(10.0, aT.x), ang = aT.x - ring * 20.0;
          vec3 q = vec3((29.0 + ring * 2.6) * cos(ang), 36.0 - aT.y * 31.0, -(45.0 + ring * 3.0) * sin(ang));
          float head = uRain.y > 0.5 ? fract(uTime * 0.55 + ang / 6.2831853 * 2.0) : fract(uTime * (0.5 + 0.35 * aT.w) + aT.z);
          float dh = head * 1.12 - aT.y;
          float tail = dh >= 0.0 ? exp(-dh * 16.0) : 0.0;
          vec4 mv = viewMatrix * vec4(q, 1.0);
          gl_Position = projectionMatrix * mv;
          float px = 0.48 * uPxScale / max(-mv.z, 0.1);
          float s = clamp(px, 1.5, 22.0);
          gl_PointSize = s;
          vec3 c = mix(vec3(0.62, 0.9, 1.0), uPalB, 0.35);
          vCol = c * (0.08 + tail * 12.0) * mix(1.0, 0.45, smoothstep(4.0, 14.0, px)) * uRain.x * ${ENER};
          #include <logdepthbuf_vertex>
        }`, { uRain }));
      p.layers.enable(1);
      api.parts.rain = p;
    }

    /* 6 · gold snow: metallic flakes drifting down through the light, glinting as they turn */
    const uSnow = { value: new THREE.Vector4() };
    {
      const N = 9000, a = attr(N, 4);
      for (let i = 0; i < N; i++) { const r = Math.sqrt(R()), th = R() * 6.2832; a.a.set([r * 88 * Math.cos(th), -r * 128 * Math.sin(th), R(), R()], i * 4); }
      api.parts.snow = points({ aS: a }, ptsMat(/* glsl */`${VS}
        attribute vec4 aS;
        uniform float uTime; uniform float uPxScale; uniform vec4 uSnow;
        varying vec3 vCol;
        void main(){
          float H = 44.0, fall = 1.0 + 0.7 * aS.w;
          float y = 46.0 - mod(uTime * fall + aS.z * H, H);
          vec3 p = vec3(aS.x + sin(uTime * 0.5 + aS.w * 20.0) * 1.6, y, aS.y + cos(uTime * 0.43 + aS.w * 13.0) * 1.6);
          vec4 mv = viewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float px = 0.38 * uPxScale / max(-mv.z, 0.1);
          float s = clamp(px, 1.4, 12.0);
          gl_PointSize = s;
          float glint = pow(abs(sin(uTime * (1.8 + 2.6 * aS.w) + aS.w * 40.0)), 14.0);
          vec3 c = mix(vec3(1.0, 0.66, 0.26), vec3(0.92, 0.94, 1.0), step(0.82, fract(aS.w * 7.3)));
          vCol = c * (1.2 + 16.0 * glint) * mix(1.0, 0.5, smoothstep(4.0, 12.0, px)) * uSnow.x * smoothstep(1.0, 3.5, y) * ${ENER};
          #include <logdepthbuf_vertex>
        }`, { uSnow }), 6);
    }

    /* 7 · galaxy: a two-armed spiral of ten thousand stars turning in the roof opening – the
       descent camera flies down through it */
    const uGal = { value: new THREE.Vector4() };
    {
      const N = 11000, a = attr(N, 4);
      for (let i = 0; i < N; i++) {
        const dust = R() < 0.22, r = dust ? Math.sqrt(R()) : Math.pow(R(), 0.8);
        a.a.set([r, dust ? R() * 2 : (i % 2), dust ? gauss() * 3 : gauss(), R()], i * 4);
      }
      api.parts.galaxy = points({ aG: a }, ptsMat(/* glsl */`${VS}
        attribute vec4 aG;
        uniform float uTime; uniform float uPxScale; uniform vec3 uPalA; uniform vec4 uGal;
        varying vec3 vCol;
        void main(){
          float r = aG.x, R = 3.0 + r * 58.0;
          float th = aG.y * 3.14159265 + r * 5.4 + uTime * 0.16 + aG.z * (0.32 + 0.3 * (1.0 - r));
          vec3 p = vec3(R * cos(th), 55.0 + aG.z * (1.0 - r) * 2.2 + sin(aG.w * 40.0) * 0.5, -R * sin(th));
          vec4 mv = viewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float big = step(0.965, aG.w);
          float px = (0.34 + big * 0.6) * uPxScale / max(-mv.z, 0.1);
          float s = clamp(px, 1.3, 26.0);
          gl_PointSize = s;
          vec3 arm = mix(vec3(0.32, 0.5, 1.0), vec3(0.85, 0.35, 1.0), fract(aG.w * 13.7));
          arm = mix(arm, uPalA, 0.2);
          vec3 c = mix(vec3(1.0, 0.8, 0.5), arm, smoothstep(0.06, 0.3, r));
          float tw = 0.75 + 0.25 * sin(uTime * (2.0 + aG.w * 5.0) + aG.w * 60.0);
          vCol = c * (0.7 + 2.6 * exp(-r * 7.0) + big * 1.5) * tw * 6.0 * mix(1.0, 0.5, smoothstep(4.0, 12.0, px)) * uGal.x * ${ENER};
          #include <logdepthbuf_vertex>
        }`, { uGal }), 7);
    }

    /* 8 · card stunt: the bowl's light sticks spell one picture wrapped round the stands */
    {
      const c = document.createElement('canvas'); c.width = 2048; c.height = 256;
      const g = c.getContext('2d');
      const CNF = '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", sans-serif';
      const draw = (text) => {
        const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#1c0403'); gr.addColorStop(1, '#3a0804');
        g.fillStyle = gr; g.fillRect(0, 0, 2048, 256);
        const seg = 2048 / 3;
        for (let k = 0; k < 3; k++) {
          g.save(); g.translate(seg * k + seg / 2, 132);
          g.textAlign = 'center'; g.textBaseline = 'middle';
          let fs = 190; g.font = `900 ${fs}px ${CNF}`;
          fs = Math.min(fs, fs * (seg * 0.8) / Math.max(1, g.measureText(text).width)); g.font = `900 ${fs}px ${CNF}`;
          const tg = g.createLinearGradient(0, -fs / 2, 0, fs / 2); tg.addColorStop(0, '#fff6dc'); tg.addColorStop(0.5, '#ffc04a'); tg.addColorStop(1, '#ff7a1a');
          g.fillStyle = tg; g.fillText(text, 0, 0);
          g.restore();
          // a crown between the words
          g.fillStyle = '#ffd36a'; const x = seg * k + 34, y = 128;
          g.beginPath(); g.moveTo(x - 22, y + 16); g.lineTo(x - 22, y - 12); g.lineTo(x - 10, y + 2); g.lineTo(x, y - 20); g.lineTo(x + 10, y + 2); g.lineTo(x + 22, y - 12); g.lineTo(x + 22, y + 16); g.closePath(); g.fill();
        }
      };
      draw('万兽之王');
      // a wristband on every seat: a dense grid of pixels over the seating (the light sticks alone
      // are too sparse to spell a word)
      const COLS = 720, ROWS = 44, N = COLS * ROWS, a = attr(N, 3);
      for (let i = 0; i < COLS; i++) for (let j = 0; j < ROWS; j++) a.a.set([(i + 0.5 + (R() - 0.5) * 0.5) / COLS * 6.2832, 0.03 + 0.94 * (j + 0.5 + (R() - 0.5) * 0.4) / ROWS, R()], (i * ROWS + j) * 3);
      api.parts.card = points({ aC: a }, ptsMat(/* glsl */`${VS}
        attribute vec3 aC;
        uniform float uTime; uniform float uPxScale; uniform vec4 uCard; uniform sampler2D uCardTex;
        varying vec3 vCol;
        float ellR(float a, float b, float th){ float c = cos(th) / a, s = sin(th) / b; return 1.0 / sqrt(c * c + s * s); }
        void main(){
          float th = aC.x, ri = ellR(61.5, 106.0, th), ro = ellR(142.6, 164.7, th);
          float r = ri + (ro - ri) * aC.y;
          vec3 p = vec3(r * cos(th), 2.0 + 53.0 * aC.y + 2.4, -r * sin(th));     // held up over the heads
          vec4 mv = viewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float px = 0.85 * uPxScale / max(-mv.z, 0.1);
          float s = clamp(px, 1.5, 16.0);
          gl_PointSize = s;
          vec3 tx = texture2D(uCardTex, vec2(fract(-th / 6.2831853 + uCard.y), aC.y)).rgb;
          float tw = 0.85 + 0.15 * sin(uTime * 3.0 + aC.z * 50.0);
          vCol = tx * tx * 44.0 * mix(1.0, 0.3, smoothstep(3.0, 12.0, px)) * tw * uCard.x * ${ENER};
          #include <logdepthbuf_vertex>
        }`, { }), 6);
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.NoColorSpace; tex.wrapS = THREE.RepeatWrapping; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
      U.uCardTex.value = tex;
      api.cardText = '万兽之王';
      api.setCardText = (t) => { t = String(t || '').trim().slice(0, 10) || '万兽之王'; if (t === api.cardText) return; api.cardText = t; draw(t); tex.needsUpdate = true; };
    }

    /* ═══ OUTSIDE ═══════════════════════════════════════════════════ */
    const W = KOB.WORLD;
    const lakeX = W.lakeX, lakeHW = W.lakeHW;

    /* 9 · sky lanterns: warm paper lanterns released from the plaza and the lake promenade,
       drifting up and away over the Nest */
    const uLan = { value: new THREE.Vector4() };     // level (density), -, -, -
    {
      const N = 2600, a = attr(N, 4), b = attr(N, 2);
      for (let i = 0; i < N; i++) {
        let x, y;
        if (R() < 0.45) { const e = 1.02 + R() * 0.3, th = R() * 6.2832; x = e * W.plaza[0] * Math.cos(th); y = e * W.plaza[1] * Math.sin(th); }
        else { y = -330 + R() * 300; const side = R() < 0.7 ? 1 : -1; x = lakeX(y) + side * (lakeHW(y) + 4 + R() * 40); }
        a.a.set([x, -y, R(), R()], i * 4); b.a.set([R(), 0.85 + R() * 0.4], i * 2);
      }
      const frag = /* glsl */`
        #include <common>
        #include <logdepthbuf_pars_fragment>
        varying vec3 vCol; varying float vBig;
        void main(){
          #include <logdepthbuf_fragment>
          vec2 d = gl_PointCoord - 0.5;
          float glow = exp(-dot(d, d) * 18.0);
          // close up: a paper body, wider at the top, brightest round the flame at its mouth
          float w = 0.25 + 0.06 * (-d.y);
          float body = smoothstep(w, w - 0.04, abs(d.x)) * smoothstep(0.42, 0.36, abs(d.y + 0.02));
          float flame = exp(-(d.x * d.x * 90.0 + (d.y - 0.3) * (d.y - 0.3) * 60.0));
          float a = mix(glow, body * (0.45 + 0.55 * smoothstep(-0.4, 0.4, d.y)) + flame * 0.9 + glow * 0.12, vBig);
          gl_FragColor = vec4(vCol * a, 1.0);
        }`;
      const p = points({ aL: a, aL2: b }, ptsMat(/* glsl */`${VS}
        attribute vec4 aL; attribute vec2 aL2;
        uniform float uTime; uniform float uPxScale; uniform vec4 uLan;
        varying vec3 vCol; varying float vBig;
        void main(){
          float P = 210.0;
          float age = mod(uTime + aL.z * P, P);
          float vz = 1.0 + 0.7 * aL.w;
          vec3 p = vec3(aL.x - age * 0.55 + sin(age * 0.21 + aL.w * 9.0) * 3.0, 1.8 + age * vz, aL.y - age * 0.38 + cos(age * 0.17 + aL.z * 7.0) * 3.0);
          vec4 mv = viewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float px = 1.5 * aL2.y * uPxScale / max(-mv.z, 0.1);
          float s = clamp(px, 1.4, 40.0);
          gl_PointSize = s;
          vBig = smoothstep(6.0, 14.0, s);
          float flick = 0.82 + 0.18 * sin(uTime * 9.0 + aL.w * 50.0) * sin(uTime * 5.3 + aL.z * 30.0);
          float dens = clamp((uLan.x - aL2.x) * 12.0, 0.0, 1.0);
          float life = smoothstep(0.0, 4.0, age) * (1.0 - smoothstep(150.0, 210.0, age));
          vCol = vec3(1.0, 0.5, 0.17) * 8.0 * mix(1.0, 0.45, vBig) * flick * dens * life * ${ENER};
          if (dens * life <= 0.0) gl_Position = vec4(0.0, 0.0, -2.0, 1.0);
          #include <logdepthbuf_vertex>
        }`, { uLan }, frag), 6);
      p.layers.enable(3);
      api.parts.lanterns = p;
    }

    /* 10 · aurora: green-to-violet curtains hung over the north-west sky, folding slowly */
    const uAur = { value: new THREE.Vector4() };
    {
      const pos = [], aa = [], idx = [];
      const curtain = (rad, p0, p1, z0, z1, layer, segs) => {
        const base = pos.length / 3, rows = 6;
        for (let i = 0; i <= segs; i++) {
          const u = i / segs, ph = p0 + (p1 - p0) * u;
          for (let j = 0; j <= rows; j++) {
            const v = j / rows;
            pos.push(rad * Math.cos(ph), z0 + (z1 - z0) * v, -rad * Math.sin(ph));
            aa.push(u, v, layer);
          }
        }
        for (let i = 0; i < segs; i++) for (let j = 0; j < rows; j++) { const k = base + i * (rows + 1) + j; idx.push(k, k + rows + 1, k + 1, k + 1, k + rows + 1, k + rows + 2); }
      };
      curtain(2700, 1.4, 3.75, 430, 1350, 0, 220);
      curtain(3400, 1.95, 3.2, 520, 1200, 1, 120);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aA', new THREE.Float32BufferAttribute(aa, 3)); g.setIndex(idx);
      const m = new THREE.ShaderMaterial({
        uniforms: Object.assign({}, U, { uAur }),
        vertexShader: /* glsl */`${VS}
          attribute vec3 aA;
          uniform float uTime;
          varying vec3 vA;
          void main(){
            vA = aA;
            vec3 p = position;
            vec2 dir = normalize(p.xz);
            float u = aA.x + aA.z * 0.37;
            float fold = sin(u * 19.0 + uTime * 0.06) * 160.0 + sin(u * 47.0 - uTime * 0.09) * 60.0;
            p.xz += dir * (fold + aA.y * 160.0);
            // the lower hem rises and falls along the curtain
            p.y += (sin(u * 11.0 + uTime * 0.05) * 150.0 + sin(u * 29.0 - uTime * 0.07) * 60.0 + 120.0) * (1.0 - 0.6 * aA.y);
            gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
            #include <logdepthbuf_vertex>
          }`,
        fragmentShader: /* glsl */`
          #include <common>
          #include <logdepthbuf_pars_fragment>
          uniform float uTime; uniform sampler2D uNoiseTex; uniform vec4 uAur;
          varying vec3 vA;
          float kSq(float x){ return x * x; }
          void main(){
            #include <logdepthbuf_fragment>
            float u = vA.x + vA.z * 0.41, v = vA.y, t = uTime;
            float n1 = texture2D(uNoiseTex, vec2(u * 7.0 + t * 0.004, 0.13 + vA.z * 0.4)).r;
            float n2 = texture2D(uNoiseTex, vec2(u * 31.0 - t * 0.011, 0.61)).g;
            float n3 = texture2D(uNoiseTex, vec2(u * 3.0 + t * 0.002, 0.83)).b;
            // fine striations ride on soft folded ribbons; the lower hem is the brightest part
            float rays = 0.4 + 0.6 * pow(clamp(n1 * 0.7 + n2 * 0.55, 0.0, 1.3), 2.0);
            float ribbon = smoothstep(0.4, 0.8, texture2D(uNoiseTex, vec2(u * 2.2 - t * 0.003, 0.37 + vA.z * 0.2)).a);
            float hem = smoothstep(0.0, 0.04 + 0.05 * n2, v - 0.06 * n3);
            float fall = exp(-v * (3.6 + 1.2 * n1)) + 0.25 * exp(-kSq((v - 0.12) / 0.06));
            vec3 cg = vec3(0.1, 1.0, 0.45), cv = vec3(0.5, 0.14, 0.95), cr = vec3(0.95, 0.12, 0.35);
            vec3 col = mix(cg, cv, smoothstep(0.16, 0.66, v));
            col = mix(col, cr, smoothstep(0.7, 1.0, v) * 0.6);
            float ends = smoothstep(0.0, 0.14, vA.x) * smoothstep(1.0, 0.86, vA.x);
            float I = hem * fall * rays * ends * (0.08 + 0.92 * ribbon) * (0.8 + 0.2 * sin(t * 0.23 + u * 9.0));
            I *= vA.z > 0.5 ? 0.55 : 1.0;
            gl_FragColor = vec4(col * I * 0.9 * uAur.x, 1.0);
          }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 1; mesh.visible = false;
      mesh.layers.enable(3);
      scene.add(mesh);
      api.parts.aurora = mesh;
    }

    /* 11 · lotus lights: a flotilla of lotus lamps drifting down the dragon lake */
    const uLotus = { value: new THREE.Vector4(1, 0, 0, 0) };
    {
      const N = 1500, a = attr(N, 4);
      for (let i = 0; i < N; i++) {
        const near = R() < 0.6;
        a.a.set([near ? -420 + R() * 470 : -760 + R() * 1740, (R() * 2 - 1) * 0.86, R(), R()], i * 4);
      }
      const p = points({ aF: a }, ptsMat(/* glsl */`${VS}
        attribute vec4 aF;
        uniform float uTime; uniform float uPxScale; uniform vec4 uLotus;
        varying vec3 vCol;
        void main(){
          float y = aF.x + uTime * (0.35 + 0.3 * aF.w);
          y = -770.0 + mod(y + 770.0, 1760.0);
          float xc = 300.0 + 42.0 * sin(y / 150.0 + 0.6);
          float hw = 0.5 * (62.0 + 16.0 * sin(y * 0.011 + 1.3));
          float x = xc + aF.y * hw * 0.88 + sin(uTime * 0.13 + aF.z * 20.0) * 1.5;
          vec3 p = vec3(x, 0.55 + 0.05 * sin(uTime * 1.3 + aF.z * 30.0), -y);
          vec4 mv = viewMatrix * vec4(p, 1.0);
          mv.xyz *= 1.0 - 1.5 / max(length(mv.xyz), 3.0);   // clear of the water's depth offset at grazing angles
          gl_Position = projectionMatrix * mv;
          float px = 0.95 * uPxScale / max(-mv.z, 0.1);
          float s = clamp(px, 1.4, 26.0);
          gl_PointSize = s;
          vec3 c = mix(vec3(1.0, 0.36, 0.42), vec3(1.0, 0.62, 0.22), step(0.4, aF.z));
          float flick = 0.85 + 0.15 * sin(uTime * 7.0 + aF.w * 40.0);
          float gap = smoothstep(12.0, 18.0, abs(y + 640.0));     // none under the road bridge
          vCol = c * 11.0 * mix(1.0, 0.35, smoothstep(4.0, 16.0, px)) * flick * gap * uLotus.x * ${ENER};
          #include <logdepthbuf_vertex>
        }`, { uLotus }), 6);
      p.layers.enable(3);
      api.parts.lotus = p;
    }

    /* 12 · plaza mapping: the paving round the Nest becomes one projection surface – ripples
       rolling out from the bowl, a turning sunburst, LED pavers, spiral arms */
    const uProj = { value: new THREE.Vector4() };
    {
      const pos = [], ee = [], idx = [];
      const S = 220, Rr = 12, e0 = 1.03, e1 = 1.62;
      for (let i = 0; i <= S; i++) {
        const th = i / S * 6.2832;
        for (let j = 0; j <= Rr; j++) { const e = e0 + (e1 - e0) * j / Rr; pos.push(e * 160 * Math.cos(th), 0.1, -e * 178 * Math.sin(th)); ee.push(e, th); }
      }
      for (let i = 0; i < S; i++) for (let j = 0; j < Rr; j++) { const k = i * (Rr + 1) + j; idx.push(k, k + 1, k + Rr + 1, k + 1, k + Rr + 2, k + Rr + 1); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aE', new THREE.Float32BufferAttribute(ee, 2)); g.setIndex(idx);
      const m = new THREE.ShaderMaterial({
        uniforms: Object.assign({}, U, { uProj }),
        vertexShader: `${VS} attribute vec2 aE; varying vec2 vE; varying vec3 vW;
          void main(){ vE = aE; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w;
          #include <logdepthbuf_vertex>
          }`,
        fragmentShader: /* glsl */`
          #include <common>
          #include <logdepthbuf_pars_fragment>
          uniform float uTime; uniform float uBeatPulse; uniform vec3 uPalA; uniform vec3 uPalB; uniform vec4 uProj;
          varying vec2 vE; varying vec3 vW;
          ${G.noise}
          float pattern(float m, float e, float th, vec2 b, float t){
            if (m < 0.5) return pow(0.5 + 0.5 * sin(e * 70.0 - t * 3.0), 10.0) + 0.3 * pow(0.5 + 0.5 * sin(e * 190.0 - t * 5.0), 18.0);
            if (m < 1.5) return pow(0.5 + 0.5 * sin(th * 24.0 + t * 0.7), 14.0) * 0.9 + pow(0.5 + 0.5 * sin(e * 46.0 - t * 2.0), 16.0) * 0.7;
            if (m < 2.5) {
              vec2 q = b / 6.0, id = floor(q), fr = fract(q);
              float tile = step(0.08, fr.x) * step(fr.x, 0.92) * step(0.08, fr.y) * step(fr.y, 0.92);
              float w = pow(0.5 + 0.5 * sin(length(id) * 0.5 - t * 3.2), 6.0);
              return tile * (0.12 + w * (0.5 + 0.5 * kHash21(id)));
            }
            return pow(0.5 + 0.5 * sin(th * 8.0 + e * 40.0 - t * 2.2), 12.0);
          }
          void main(){
            #include <logdepthbuf_fragment>
            float e = vE.x, th = vE.y, t = uTime;
            vec2 b = vec2(vW.x, -vW.z);
            float pat = pattern(uProj.y, e, th, b, t);
            float fade = smoothstep(1.03, 1.1, e) * (1.0 - smoothstep(1.4, 1.62, e));
            vec3 c = mix(uPalA, uPalB, 0.5 + 0.5 * sin(th * 2.0 + t * 0.3));
            c = mix(c, vec3(1.0, 0.86, 0.6), 0.3);
            gl_FragColor = vec4(c * pat * fade * (0.55 + 0.25 * uBeatPulse) * uProj.x, 1.0);
          }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6,
      });
      const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 2; mesh.visible = false;
      scene.add(mesh);
      api.parts.proj = mesh;
    }

    /* 13 · fireflies along the lake banks and under the plaza trees */
    const uFly = { value: new THREE.Vector4(1, 0, 0, 0) };
    {
      const N = 4000, a = attr(N, 4);
      for (let i = 0; i < N; i++) {
        let x, y;
        if (R() < 0.62) { y = -470 + R() * 560; const side = R() < 0.65 ? 1 : -1; x = lakeX(y) + side * (lakeHW(y) + 2 + R() * 34); }
        else { const e = 1.15 + R() * 0.35, th = R() * 6.2832; x = e * W.plaza[0] * Math.cos(th); y = e * W.plaza[1] * Math.sin(th); }
        a.a.set([x, -y, R(), R()], i * 4);
      }
      const p = points({ aF: a }, ptsMat(/* glsl */`${VS}
        attribute vec4 aF;
        uniform float uTime; uniform float uPxScale; uniform vec4 uFly;
        varying vec3 vCol;
        void main(){
          float t = uTime, ph = aF.z * 6.2831853;
          vec3 p = vec3(aF.x + sin(t * 0.31 + ph * 3.0) * 3.0 + sin(t * 0.83 + ph) * 0.8,
                        0.7 + aF.w * 2.6 + sin(t * 0.52 + ph * 5.0) * 0.6,
                        aF.y + cos(t * 0.27 + ph * 2.0) * 3.0 + cos(t * 0.71 + ph * 4.0) * 0.8);
          vec4 mv = viewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float px = 0.3 * uPxScale / max(-mv.z, 0.1);
          float s = clamp(px, 1.4, 10.0);
          gl_PointSize = s;
          float blink = smoothstep(0.3, 0.9, sin(t * (0.7 + 0.6 * aF.w) + ph * 7.0));
          vCol = vec3(0.6, 1.0, 0.28) * blink * 26.0 * mix(1.0, 0.5, smoothstep(4.0, 10.0, px)) * uFly.x * ${ENER};
          #include <logdepthbuf_vertex>
        }`, { uFly }), 6);
      p.layers.enable(3);
      api.parts.flies = p;
    }

    /* 14 · LED blimp: a sixty-metre airship circling the Nest, the ticker's words scrolling
       along both flanks, nav lights blinking */
    const uBlimp = { value: new THREE.Vector4(1, 0, 0, 0) };   // banner level, flash, -, -
    const blimp = new THREE.Group(); blimp.visible = false; scene.add(blimp);
    const bc = document.createElement('canvas'); bc.width = 2048; bc.height = 128;
    const bannerTex = new THREE.CanvasTexture(bc); bannerTex.colorSpace = THREE.NoColorSpace; bannerTex.wrapS = THREE.RepeatWrapping; bannerTex.minFilter = THREE.LinearFilter; bannerTex.generateMipmaps = false;
    let bannerText = null;
    const drawBanner = (text) => {
      const g = bc.getContext('2d');
      g.fillStyle = '#000'; g.fillRect(0, 0, 2048, 128);
      const CNF = '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      const line = String(text || '万兽之王').trim() + '  ✦  ';
      let fs = 92; g.font = `900 ${fs}px ${CNF}`;
      const w1 = g.measureText(line).width, reps = Math.max(1, Math.floor(2048 / (w1 + 40)));
      if (reps === 1) { fs = Math.min(fs, fs * 1900 / w1); g.font = `900 ${fs}px ${CNF}`; }
      const tg = g.createLinearGradient(0, 20, 0, 108); tg.addColorStop(0, '#ffffff'); tg.addColorStop(0.5, '#ffd27a'); tg.addColorStop(1, '#ff6a1a');
      g.fillStyle = tg;
      for (let k = 0; k < reps; k++) g.fillText(line, 2048 * (k + 0.5) / reps, 66);
      bannerTex.needsUpdate = true;
    };
    {
      const body = new THREE.SphereGeometry(1, 64, 32); body.scale(30, 7.2, 7.2);
      const m = new THREE.ShaderMaterial({
        uniforms: Object.assign({}, U, { uBlimp, uBanner: { value: bannerTex } }),
        vertexShader: `${VS} varying vec3 vL; varying vec3 vN; varying vec3 vW;
          void main(){ vL = position / vec3(30.0, 7.2, 7.2); vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w;
          #include <logdepthbuf_vertex>
          }`,
        fragmentShader: /* glsl */`
          #include <common>
          #include <logdepthbuf_pars_fragment>
          uniform float uTime; uniform vec3 uCityAmb; uniform float uShowGlow; uniform vec3 uPalA; uniform vec4 uBlimp; uniform sampler2D uBanner;
          varying vec3 vL; varying vec3 vN; varying vec3 vW;
          void main(){
            #include <logdepthbuf_fragment>
            vec3 N = normalize(vN), V = normalize(cameraPosition - vW);
            // dark silver envelope: city sky above, the show's glow from below, a cool rim
            vec3 col = vec3(0.05, 0.052, 0.058) * (uCityAmb * 40.0 * (0.6 + 0.4 * N.y) + vec3(1.0, 0.5, 0.25) * uShowGlow * 0.35 * max(-N.y, 0.0));
            col += vec3(0.5, 0.6, 0.8) * pow(1.0 - max(dot(N, V), 0.0), 4.0) * 0.012;
            // panel seams
            col *= 0.85 + 0.15 * step(0.04, abs(fract(vL.x * 9.0) - 0.5));
            // LED banners on both flanks
            if (abs(vL.x) < 0.62 && abs(vL.y) < 0.5 && abs(vL.z) > 0.3) {
              float u = vL.x / 1.24 + 0.5; if (vL.z < 0.0) u = 1.0 - u;
              float v = vL.y + 0.5;
              vec2 uv = vec2(fract(u * 0.55 + uTime * 0.045), v);
              vec3 tx = texture2D(uBanner, uv).rgb;
              vec2 cell = fract(vec2(u * 260.0, v * 36.0)) - 0.5;
              float led = smoothstep(0.5, 0.15, length(cell));
              float frame = smoothstep(0.62, 0.6, abs(vL.x)) * smoothstep(0.5, 0.47, abs(vL.y));
              vec3 bg = uPalA * 0.03;
              col += (tx * 4.0 * (1.0 + uBlimp.y * 1.5) + bg) * led * frame * uBlimp.x;
            }
            gl_FragColor = vec4(col, 1.0);
          }`,
      });
      blimp.add(new THREE.Mesh(body, m));
      const fins = new THREE.Mesh(new THREE.BoxGeometry(9, 14, 0.4).translate(-26, 0, 0), m);
      const fins2 = new THREE.Mesh(new THREE.BoxGeometry(9, 0.4, 14).translate(-26, 0, 0), m);
      const gond = new THREE.Mesh(new THREE.BoxGeometry(9, 2.2, 3).translate(4, -7.6, 0), m);
      blimp.add(fins, fins2, gond);
      blimp.children.forEach((c) => { c.frustumCulled = false; c.layers.enable(3); });
      // nav lights: port red, starboard green, tail and belly strobes
      const ng = new THREE.BufferGeometry();
      ng.setAttribute('position', new THREE.Float32BufferAttribute([2, 0, -7.4, 2, 0, 7.4, -30.6, 0, 0, 4, -8.8, 0], 3));
      const nc = new THREE.BufferAttribute(new Float32Array(16), 4).setUsage(THREE.DynamicDrawUsage);
      ng.setAttribute('aCol', nc);
      const nav = new THREE.Points(ng, ptsMat(G.dotVert, { uSize: { value: 0.9 } }));
      nav.frustumCulled = false; nav.renderOrder = 7; nav.layers.enable(3);
      blimp.add(nav);
      blimp.userData.nav = nc;
      api.parts.blimp = blimp;
    }

    /* ── per-frame ────────────────────────────────────────────────── */
    const tmp = new V3(), up = new V3(0, 1, 0);
    let ballRot = 0, holoIdx = 1, blimpA = 2.4;
    const show = (obj, on) => { obj.visible = on; return on; };
    // X: levels this frame (show cue merged with the desk), t: fx clock
    api.update = function (X, dt, t, cam, ticker) {
      // halo
      if (show(api.parts.halo, X.halo > 0.002)) uHalo.value.set(X.halo, X.haloMode, 0, 0);
      // mirror ball
      if (show(ball, X.ball > 0.002)) {
        ballRot += dt * 0.55;
        const y = 16.4 - 5.4 * X.ballDrop;                  // out of the box underside (13.6) to 11.0
        ball.position.set(0, y, 0);
        const cab = ball.userData.cable, top = 13.62 - (y + 2.6);
        cab.visible = top > 0.05; cab.scale.y = Math.max(0.01, top); cab.position.y = 2.6 + top / 2;
        ball.userData.sph.rotation.y = ballRot;
        uBall.value.set(X.ball, X.ballDrop, ballRot, 0);
      }
      api.parts.ballDots.visible = ball.visible && X.ballDrop > 0.6;
      // hologram
      if (show(api.parts.holo, X.holo > 0.002)) {
        const bi = X.holoBeast | 0;
        if (bi !== holoIdx && holoGeos[bi]) { holoIdx = bi; api.parts.holo.geometry = holoGeos[bi]; }
        // turn to the camera (about the vertical), unless we are right under it
        tmp.set(cam.position.x, 0, cam.position.z);
        if (tmp.lengthSq() > 4) { tmp.normalize(); uHoloF.value.lerp(tmp, Math.min(1, dt * 3)).normalize(); }
        uHoloR.value.crossVectors(up, uHoloF.value).normalize();
        uHolo.value.set(X.holo, X.holoReveal, 0.6 + 0.4 * Math.max(0, Math.sin(t * 0.7)), 22);
      }
      // shockwave floor rings (U.uShock is owned by main)
      const sh = U.uShock.value, live = (t - sh.x < 3.5 && t >= sh.x) || (t - sh.y < 3.5 && t >= sh.y);
      for (const m of api.parts.shock) m.visible = live && sh.z > 0;
      if (show(api.parts.rain, X.rain > 0.002)) uRain.value.set(X.rain, X.rainMode, 0, 0);
      if (show(api.parts.snow, X.snow > 0.002)) uSnow.value.set(X.snow, 0, 0, 0);
      if (show(api.parts.galaxy, X.galaxy > 0.002)) uGal.value.set(X.galaxy, 0, 0, 0);
      U.uCard.value.set(X.card, t * 0.004, 0, 0);
      api.parts.card.visible = X.card > 0.002;
      // outside
      if (show(api.parts.lanterns, X.lanterns > 0.002)) uLan.value.set(X.lanterns, 0, 0, 0);
      if (show(api.parts.aurora, X.aurora > 0.002)) uAur.value.set(X.aurora, 0, 0, 0);
      if (show(api.parts.lotus, X.lotus > 0.002)) uLotus.value.set(X.lotus, 0, 0, 0);
      if (show(api.parts.proj, X.proj > 0.002)) uProj.value.set(X.proj, X.projMode, 0, 0);
      if (show(api.parts.flies, X.flies > 0.002)) uFly.value.set(X.flies, 0, 0, 0);
      // blimp: a slow orbit; the desk brings it down low over the plaza for a pass
      if (show(blimp, X.blimpOn > 0)) {
        if (ticker !== bannerText) { bannerText = ticker; drawBanner(ticker); }
        const k = X.blimp;
        const Rb = 232 - 52 * k, hb = 108 - 40 * k + 5 * Math.sin(t * 0.2);
        blimpA += dt * (13 + 5 * k) / Rb;
        const c = Math.cos(blimpA), s = Math.sin(blimpA);
        blimp.position.set(Rb * c, hb, -Rb * s);
        blimp.rotation.set(0, Math.atan2(c, -s), Math.sin(t * 0.3) * 0.015);
        uBlimp.value.set(1, k, 0, 0);
        const nav = blimp.userData.nav, A = nav.array, strobe = (t % 1.6) < 0.06 ? 1 : 0, belly = ((t + 0.8) % 1.6) < 0.06 ? 1 : 0;
        A.set([6, 0.12, 0.08, 1, 0.1, 5, 0.6, 1, 12 * strobe, 12 * strobe, 12 * strobe, strobe ? 1.4 : 0, 9 * belly, 0.6 * belly, 0.3 * belly, belly ? 1.2 : 0]);
        nav.needsUpdate = true;
      }
    };
    api.setTier = function (Q) {
      const k = Math.max(0.5, Q.pk || 1);
      const dr = (p, n) => p.geometry.setDrawRange(0, Math.round(n * k));
      dr(api.parts.snow, 9000); dr(api.parts.galaxy, 11000); dr(api.parts.lanterns, 2600); dr(api.parts.flies, 4000);
    };
    api.beasts = BEASTS;
    api.blimpAngle = () => blimpA;     // the tour flies ahead of it
    return api;
  };
})();
