(window.KOB_FILES = window.KOB_FILES || {}).post = '12';
/* ═══════════════════════════════════════════════════════════════════
   KING OF BEASTS — camera / lens pipeline
   scene (HDR, MSAA, depth) → atmosphere + in-scatter → DOF → motion blur
   → bloom pyramid + anamorphic streak → filmic tonemap, grade, grain
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const KOB = (window.KOB = window.KOB || {});

  KOB.makePost = function (THREE, renderer, opts) {
    const G = KOB.GLSL;
    const quadGeo = new THREE.BufferGeometry();
    quadGeo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    quadGeo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    const quad = new THREE.Mesh(quadGeo);
    quad.frustumCulled = false;
    const qcam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const pass = (frag, uniforms) => new THREE.ShaderMaterial({ vertexShader: G.fsVert, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
    function draw(mat, target) { quad.material = mat; renderer.setRenderTarget(target); renderer.render(quad, qcam); }

    const HF = THREE.HalfFloatType;
    const rt = (w, h, o) => new THREE.WebGLRenderTarget(Math.max(1, w | 0), Math.max(1, h | 0), Object.assign({ type: HF, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false }, o || {}));

    let W = 2, H = 2;
    let sceneRT, atmosRT, dofRT, lensRT, down = [], up = [], streakA, streakB, shaftRT;
    const LEVELS = 7;

    const vl = []; for (let i = 0; i < 18; i++) vl.push(new THREE.Vector4());
    const vc = []; for (let i = 0; i < 18; i++) vc.push(new THREE.Vector3());
    const spots = []; for (let i = 0; i < 12; i++) spots.push(new THREE.Vector4());
    const spotC = []; for (let i = 0; i < 12; i++) spotC.push(new THREE.Vector3());

    const mAtmos = pass(G.atmosFrag, {
      tColor: { value: null }, tDepth: { value: null }, uNear: { value: 1 }, uFar: { value: 5000 }, uNoiseTex: { value: opts.noiseTex || null },
      uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() }, uCamPos: { value: new THREE.Vector3() },
      uTime: { value: 0 }, uHaze: { value: 1 }, uFogCol: { value: new THREE.Vector3(0.012, 0.012, 0.016) },
      uLedAvg: { value: new THREE.Vector3() }, uSkyGlow: { value: new THREE.Vector3() },
      uVL: { value: vl }, uVC: { value: vc }, uVN: { value: 0 },
      uCityFog: { value: new THREE.Vector3(0.01, 0.008, 0.006) }, uCloudY: { value: 700 },
      uSpot: { value: spots }, uSpotC: { value: spotC }, uSpotN: { value: 0 },
    });
    const mDof = pass(G.dofFrag, {
      tColor: { value: null }, tDepth: { value: null }, uNear: { value: 1 }, uFar: { value: 5000 }, uTexel: { value: new THREE.Vector2() },
      uFocus: { value: 50 }, uAperture: { value: 0.02 }, uMaxCoc: { value: 9 }, uTaps: { value: 20 },
    });
    const mLens = pass(G.lensFrag, {
      tColor: { value: null }, tDof: { value: null }, tDepth: { value: null }, uNear: { value: 1 }, uFar: { value: 5000 },
      uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() }, uCamPos: { value: new THREE.Vector3() },
      uPrevVP: { value: new THREE.Matrix4() }, uMBlur: { value: 0.5 }, uDofOn: { value: 1 }, uMaxCoc: { value: 9 },
    });
    const mDown = pass(G.downFrag, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uFirst: { value: 0 } });
    const mUp = pass(G.upFrag, { tSrc: { value: null }, tPrev: { value: null }, uTexel: { value: new THREE.Vector2() }, uRadius: { value: 1 }, uMixPrev: { value: 1 } });
    const mThresh = pass(G.threshFrag, { tSrc: { value: null }, uT: { value: 2.5 } });
    const mShaft = pass(G.shaftFrag, { tSrc: { value: null }, uLight: { value: new THREE.Vector2(0.5, 0.5) }, uT: { value: 1.2 }, uLen: { value: 0.85 } });
    const mStreak = pass(G.streakBlurFrag, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uStep: { value: 1 } });
    const heat = []; for (let i = 0; i < 6; i++) heat.push(new THREE.Vector4());
    const mFinal = pass(G.finalFrag, {
      tColor: { value: null }, tBloom: { value: null }, tGlow: { value: null }, tStreak: { value: null }, tDirt: { value: dirtTexture() },
      tShaft: { value: null }, uShaft: { value: 0 },
      uExposure: { value: 1 }, uBloom: { value: 1 }, uFlare: { value: 1 }, uGrain: { value: 1 }, uTime: { value: 0 },
      uRes: { value: new THREE.Vector2() }, uCA: { value: 0.006 }, uVignette: { value: 0.38 },
      uHeat: { value: heat }, uFade: { value: 1 }, uFlash: { value: 0 },
    });
    const black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); black.needsUpdate = true;

    function dirtTexture() {
      const c = document.createElement('canvas'); c.width = c.height = 512;
      const g = c.getContext('2d');
      g.fillStyle = '#000'; g.fillRect(0, 0, 512, 512);
      const R = KOB.rng(99);
      for (let i = 0; i < 70; i++) {
        const x = R() * 512, y = R() * 512, r = 6 + R() * 60, a = 0.04 + R() * 0.16;
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      }
      g.strokeStyle = 'rgba(255,255,255,.05)'; g.lineWidth = 3;
      for (let i = 0; i < 12; i++) { g.beginPath(); g.moveTo(R() * 512, R() * 512); g.bezierCurveTo(R() * 512, R() * 512, R() * 512, R() * 512, R() * 512, R() * 512); g.stroke(); }
      const t = new THREE.CanvasTexture(c);
      return t;
    }

    const api = { scale: 1, msaa: opts.msaa || 0, enabled: true };
    api.setSize = function (w, h) {
      W = Math.max(2, Math.round(w)); H = Math.max(2, Math.round(h));
      for (const r of [sceneRT, atmosRT, dofRT, lensRT, streakA, streakB, shaftRT, ...down, ...up]) if (r) r.dispose();
      const dt = new THREE.DepthTexture(W, H, THREE.FloatType);
      dt.format = THREE.DepthFormat;
      sceneRT = rt(W, H, { depthBuffer: true, depthTexture: dt, samples: api.msaa });
      atmosRT = rt(W, H);
      dofRT = rt(W / 2, H / 2);
      lensRT = rt(W, H);
      down = []; up = [];
      let w2 = W / 2, h2 = H / 2;
      for (let i = 0; i < LEVELS; i++) { down.push(rt(w2, h2)); up.push(rt(w2, h2)); w2 /= 2; h2 /= 2; }
      streakA = rt(W / 4, H / 8); streakB = rt(W / 4, H / 8);
      shaftRT = rt(W / 4, H / 4);
      mFinal.uniforms.uRes.value.set(W, H);
      mDof.uniforms.uTexel.value.set(2 / W, 2 / H);
      api.sceneRT = sceneRT;
    };
    api.size = () => ({ w: W, h: H });
    api.targets = () => ({ sceneRT, atmosRT, dofRT, lensRT, down, up, streakA });

    const invProj = new THREE.Matrix4();
    api.render = function (scene, camera, P) {
      // P: { prevVP, exposure, bloom, flare, grain, haze, dof, mblur, focus, aperture, fogCol, ledAvg, skyGlow, vlights:[{p,c,s}], heat:[], time, fade, flash }
      renderer.setRenderTarget(sceneRT);
      renderer.setClearColor(0x000000, 1);
      renderer.clear(true, true, false);
      renderer.render(scene, camera);

      const near = camera.near, far = camera.far;
      invProj.copy(camera.projectionMatrixInverse);

      // atmosphere
      const ua = mAtmos.uniforms;
      ua.tColor.value = sceneRT.texture; ua.tDepth.value = sceneRT.depthTexture; ua.uNear.value = near; ua.uFar.value = far;
      ua.uInvProj.value.copy(invProj); ua.uCamWorld.value.copy(camera.matrixWorld); ua.uCamPos.value.copy(camera.position);
      ua.uTime.value = P.time; ua.uHaze.value = P.haze;
      ua.uFogCol.value.set(P.fogCol[0], P.fogCol[1], P.fogCol[2]);
      ua.uLedAvg.value.set(P.ledAvg[0], P.ledAvg[1], P.ledAvg[2]);
      ua.uSkyGlow.value.set(P.skyGlow[0], P.skyGlow[1], P.skyGlow[2]);
      const L = P.vlights; const n = Math.min(18, L.length);
      for (let i = 0; i < n; i++) { vl[i].set(L[i].p.x, L[i].p.y, L[i].p.z, L[i].s); vc[i].set(L[i].c[0], L[i].c[1], L[i].c[2]); }
      ua.uVN.value = n;
      if (P.cityFog) ua.uCityFog.value.set(P.cityFog[0], P.cityFog[1], P.cityFog[2]);
      ua.uCloudY.value = P.cloudY || 700;
      const sn = Math.min(12, P.spotN || 0);
      for (let i = 0; i < sn; i++) { spots[i].set(P.spots[i][0], P.spots[i][1], P.spots[i][2], 0); spotC[i].set(P.spotC[i][0], P.spotC[i][1], P.spotC[i][2]); }
      ua.uSpotN.value = sn;
      draw(mAtmos, atmosRT);

      // depth of field (half res gather)
      const useDof = P.dof && (P.dofTaps || 0) > 0;
      if (useDof) {
        const ud = mDof.uniforms;
        ud.tColor.value = atmosRT.texture; ud.tDepth.value = sceneRT.depthTexture; ud.uNear.value = near; ud.uFar.value = far;
        ud.uFocus.value = P.focus; ud.uAperture.value = P.aperture; ud.uMaxCoc.value = P.maxCoc || 8; ud.uTaps.value = P.dofTaps;
        draw(mDof, dofRT);
      }
      // motion blur + dof composite
      const ul = mLens.uniforms;
      ul.tColor.value = atmosRT.texture; ul.tDof.value = useDof ? dofRT.texture : atmosRT.texture; ul.tDepth.value = sceneRT.depthTexture; ul.uNear.value = near; ul.uFar.value = far;
      ul.uInvProj.value.copy(invProj); ul.uCamWorld.value.copy(camera.matrixWorld); ul.uCamPos.value.copy(camera.position);
      ul.uPrevVP.value.copy(P.prevVP); ul.uMBlur.value = P.mblur ? 0.4 : 0; ul.uDofOn.value = useDof ? 1 : 0;
      let lensOut = atmosRT;
      if (useDof || P.mblur) { draw(mLens, lensRT); lensOut = lensRT; }

      // bloom pyramid
      let src = lensOut.texture, sw = W, sh = H;
      for (let i = 0; i < LEVELS; i++) {
        mDown.uniforms.tSrc.value = src; mDown.uniforms.uTexel.value.set(1 / sw, 1 / sh); mDown.uniforms.uFirst.value = i === 0 ? 1 : 0;
        draw(mDown, down[i]);
        src = down[i].texture; sw = down[i].width; sh = down[i].height;
      }
      for (let i = LEVELS - 1; i >= 0; i--) {
        const s = i === LEVELS - 1 ? down[i] : up[i + 1];
        mUp.uniforms.tSrc.value = s.texture; mUp.uniforms.uTexel.value.set(1 / s.width, 1 / s.height);
        mUp.uniforms.tPrev.value = down[i].texture; mUp.uniforms.uMixPrev.value = 1; mUp.uniforms.uRadius.value = 1;
        draw(mUp, up[i]);
      }
      // anamorphic streak
      if (P.flare > 0) {
        mThresh.uniforms.tSrc.value = down[1].texture; mThresh.uniforms.uT.value = 4.0;
        draw(mThresh, streakA);
        let a = streakA, b = streakB;
        for (const st of [1, 3, 8, 18]) {
          mStreak.uniforms.tSrc.value = a.texture; mStreak.uniforms.uTexel.value.set(1 / a.width, 1 / a.height); mStreak.uniforms.uStep.value = st;
          draw(mStreak, b); const t = a; a = b; b = t;
        }
        mFinal.uniforms.tStreak.value = a.texture;
      } else mFinal.uniforms.tStreak.value = black;

      // god rays from the key light of the moment
      if (P.shaft > 0) {
        mShaft.uniforms.tSrc.value = down[1].texture; mShaft.uniforms.uLight.value.set(P.shaftPos[0], P.shaftPos[1]);
        draw(mShaft, shaftRT);
        mFinal.uniforms.tShaft.value = shaftRT.texture; mFinal.uniforms.uShaft.value = P.shaft;
      } else { mFinal.uniforms.tShaft.value = black; mFinal.uniforms.uShaft.value = 0; }
      const uf = mFinal.uniforms;
      uf.tColor.value = lensOut.texture; uf.tBloom.value = up[0].texture; uf.tGlow.value = up[3].texture;
      uf.uExposure.value = P.exposure; uf.uBloom.value = P.bloom; uf.uFlare.value = P.flare; uf.uGrain.value = P.grain; uf.uTime.value = P.time;
      uf.uFade.value = P.fade; uf.uFlash.value = P.flash || 0;
      for (let i = 0; i < 6; i++) { const h = P.heat[i]; if (h) heat[i].set(h[0], h[1], h[2], h[3]); else heat[i].set(0, 0, 0, 0); }
      draw(mFinal, null);
    };
    return api;
  };
})();
