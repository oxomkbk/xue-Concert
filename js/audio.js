(window.KOB_FILES = window.KOB_FILES || {}).audio = '12';
/* ═══════════════════════════════════════════════════════════════════
   KING OF BEASTS — procedural stadium soundtrack (WebAudio)
   128 BPM, A minor (i–VI–III–VII). Locked to the show clock so beats land on
   the lighting cues; crowd roar follows the show energy; fireworks arrive
   late by distance / 343 m·s⁻¹.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const A = {};
  window.KOBAudio = A;
  const BEAT = 60 / 128, BAR = BEAT * 4;
  let ctx = null, master, comp, music, duck, sfx, crowdGain, wet, noiseBuf, crowdSrc, crowdFilt;
  let enabled = false, vol = 0.8;
  let anchorCtx = 0, anchorShow = 0, speed = 1, playing = true;
  let schedUntil = 0;
  const live = [];
  const ROOTS = [57, 53, 48, 55];               // A3 F3 C3 G3 (midi)
  const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
  const LEAD = [69, 72, 76, 74, 72, 69, 67, 69, 64, 67, 69, 72, 74, 72, 69, 67];
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function section(t) {
    // energy flags by show time (seconds)
    return {
      heart: t < 31.875,
      kick: t >= 22.5,
      four: t >= 31.875 && !(t >= 71.25 && t < 80.625),
      clap: t >= 31.875 && !(t >= 71.25 && t < 80.625),
      hats: t >= 31.875 && !(t >= 71.25 && t < 76),
      hat16: t >= 95.625 && t < 118.125,
      bass: t >= 31.875,
      pad: true,
      padOpen: Math.min(1, 0.15 + Math.max(0, (t - 11) / 20)),
      lead: (t >= 43.125 && t < 52.5) || (t >= 80.625 && t < 95.625) || (t >= 95.625 && t < 118.125),
      quiet: t >= 118.125 ? Math.max(0.35, 1 - (t - 118) / 20) : 1,
    };
  }
  const DROPS = [31.875, 43.125, 52.5, 95.625, 106.875, 116.25];
  const RISERS = [[28.125, 31.875], [48.75, 52.5], [91.875, 95.625], [112.5, 116.25]];

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = vol;
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.22;
    master.connect(comp); comp.connect(ctx.destination);
    // stadium reverb
    const conv = ctx.createConvolver();
    const len = ctx.sampleRate * 3.2, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) { const k = i / len; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - k, 2.6) * (i < 1200 ? i / 1200 : 1); } }
    conv.buffer = ir;
    wet = ctx.createGain(); wet.gain.value = 0.32;
    wet.connect(conv); conv.connect(master);
    music = ctx.createGain(); music.gain.value = 0.55;
    duck = ctx.createGain(); duck.gain.value = 1;
    music.connect(duck); duck.connect(master); duck.connect(wet);
    sfx = ctx.createGain(); sfx.gain.value = 0.9; sfx.connect(master); sfx.connect(wet);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    // crowd bed
    crowdSrc = ctx.createBufferSource(); crowdSrc.buffer = noiseBuf; crowdSrc.loop = true;
    crowdFilt = ctx.createBiquadFilter(); crowdFilt.type = 'bandpass'; crowdFilt.frequency.value = 900; crowdFilt.Q.value = 0.5;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    crowdGain = ctx.createGain(); crowdGain.gain.value = 0;
    crowdSrc.connect(crowdFilt); crowdFilt.connect(lp); lp.connect(crowdGain); crowdGain.connect(master); crowdGain.connect(wet);
    crowdSrc.start();
  }

  const track = (node, t) => { live.push({ node, t }); if (live.length > 800) live.splice(0, 200); return node; };
  const env = (g, t, a, peak, d, sus, r) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * sus), t + a + d); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d + r); };
  function osc(type, f, t, dur, out) { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.connect(out); o.start(t); o.stop(t + dur + 0.05); return track(o, t); }
  function noise(t, dur, out) { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.connect(out); s.start(t, Math.random()); s.stop(t + dur + 0.05); return track(s, t); }

  function kick(t, g) {
    const o = ctx.createOscillator(); const e = ctx.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    env(e, t, 0.002, 1.0 * g, 0.08, 0.5, 0.25);
    o.connect(e); e.connect(music); o.start(t); o.stop(t + 0.45); track(o, t);
    duck.gain.setValueAtTime(0.4, t); duck.gain.linearRampToValueAtTime(1, t + 0.2);
  }
  function clap(t, g) {
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 0.8;
    const e = ctx.createGain(); env(e, t, 0.001, 0.5 * g, 0.03, 0.3, 0.18);
    f.connect(e); e.connect(music); e.connect(wet); noise(t, 0.25, f);
  }
  function hat(t, g, open) {
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7500;
    const e = ctx.createGain(); env(e, t, 0.001, 0.16 * g, 0.02, 0.2, open ? 0.15 : 0.04);
    f.connect(e); e.connect(music); noise(t, 0.2, f);
  }
  function bass(t, midi, dur, g) {
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(180, t + dur); f.Q.value = 6;
    const e = ctx.createGain(); env(e, t, 0.005, 0.32 * g, 0.06, 0.6, dur * 0.6);
    f.connect(e); e.connect(music);
    osc('sawtooth', mtof(midi - 24), t, dur, f); osc('sawtooth', mtof(midi - 24) * 1.006, t, dur, f);
    const s = ctx.createGain(); env(s, t, 0.005, 0.35 * g, 0.1, 0.8, dur * 0.7); s.connect(music); osc('sine', mtof(midi - 24), t, dur, s);
  }
  function pad(t, chord, dur, open, g) {
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(400 + open * 3800, t); f.Q.value = 1.2;
    const e = ctx.createGain(); e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(0.07 * g, t + 0.25); e.gain.linearRampToValueAtTime(0.06 * g, t + dur - 0.1); e.gain.linearRampToValueAtTime(0.0001, t + dur + 0.4);
    f.connect(e); e.connect(music); e.connect(wet);
    for (const m of chord) for (const d of [-0.11, 0, 0.12]) osc('sawtooth', mtof(m) * Math.pow(2, d / 12), t, dur + 0.4, f);
  }
  function lead(t, midi, dur, g) {
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 3200; f.Q.value = 2;
    const e = ctx.createGain(); env(e, t, 0.01, 0.09 * g, 0.1, 0.6, dur);
    f.connect(e); e.connect(music); e.connect(wet);
    osc('square', mtof(midi), t, dur + 0.2, f); osc('sawtooth', mtof(midi + 12) * 1.003, t, dur + 0.2, f);
  }
  function riser(t0, t1) {
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 3;
    f.frequency.setValueAtTime(300, t0); f.frequency.exponentialRampToValueAtTime(9000, t1);
    const e = ctx.createGain(); e.gain.setValueAtTime(0.0001, t0); e.gain.exponentialRampToValueAtTime(0.35, t1); e.gain.linearRampToValueAtTime(0.0001, t1 + 0.05);
    f.connect(e); e.connect(music); e.connect(wet); noise(t0, t1 - t0, f);
  }
  function impact(t, g) {
    const o = ctx.createOscillator(); const e = ctx.createGain();
    o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(28, t + 1.2);
    env(e, t, 0.003, 0.9 * g, 0.3, 0.4, 1.6);
    o.connect(e); e.connect(sfx); o.start(t); o.stop(t + 2.2); track(o, t);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800;
    const n = ctx.createGain(); env(n, t, 0.002, 0.5 * g, 0.2, 0.3, 1.0); f.connect(n); n.connect(sfx); noise(t, 1.5, f);
  }

  function schedule(fromShow, toShow) {
    // musical grid events between show times [from, to)
    const b0 = Math.ceil(fromShow / (BEAT / 4) - 1e-6), b1 = Math.floor(toShow / (BEAT / 4));
    for (let q = b0; q <= b1; q++) {
      const ts = q * BEAT / 4;
      if (ts < fromShow || ts >= toShow) continue;
      const at = anchorCtx + (ts - anchorShow) / speed;
      if (at < ctx.currentTime - 0.01) continue;
      const S = section(ts);
      const sixteenth = q % 4, beat = Math.floor(q / 4), inBar = beat % 4;
      const bar = Math.floor(ts / BAR);
      const g = S.quiet;
      if (sixteenth === 0) {
        if (S.four || (S.kick && inBar % 2 === 0)) kick(at, g * (S.four ? 1 : 0.8));
        else if (S.heart && (inBar === 0)) { kick(at, 0.55); }
        if (S.clap && (inBar === 1 || inBar === 3)) clap(at, g);
        if (inBar === 0 && S.pad) pad(at, CHORDS[bar % 4], BAR, S.padOpen, g);
      }
      if (S.heart && sixteenth === 3 && inBar === 0) kick(at, 0.4);
      if (S.hats && sixteenth === 2) hat(at, g, inBar === 3);
      if (S.hat16 && sixteenth % 2 === 1) hat(at, g * 0.6, false);
      if (S.bass && sixteenth === 2) bass(at, ROOTS[bar % 4], BEAT * 0.45, g);
      if (S.lead && sixteenth % 2 === 0) {
        const i = Math.floor(q / 2) % 16;
        if (i % 3 !== 2) lead(at, LEAD[(i + bar * 3) % 16], BEAT * 0.4, g);
      }
      for (const d of DROPS) if (Math.abs(ts - d) < 1e-3) impact(at, 1);
      for (const r of RISERS) if (Math.abs(ts - r[0]) < 1e-3) riser(at, anchorCtx + (r[1] - anchorShow) / speed);
      // snare roll into drops
      for (const d of DROPS) if (ts >= d - BAR && ts < d && S.clap !== undefined) { const k = (ts - (d - BAR)) / BAR; if (sixteenth % (k > 0.5 ? 1 : 2) === 0) clap(at, 0.35 + k * 0.6); }
    }
  }

  function flushFuture() {
    const now = ctx.currentTime;
    for (const l of live) if (l.t > now + 0.01) { try { l.node.stop(now); } catch (e) { /* already stopped */ } }
    live.length = 0;
    duck.gain.cancelScheduledValues(now); duck.gain.setValueAtTime(1, now);
  }

  A.enable = function (on) {
    if (on) { init(); if (!ctx) return false; ctx.resume(); enabled = true; master.gain.setTargetAtTime(vol, ctx.currentTime, 0.2); A._resync = true; }
    else if (ctx) { enabled = false; master.gain.setTargetAtTime(0, ctx.currentTime, 0.1); flushFuture(); }
    return enabled;
  };
  A.isOn = () => enabled;
  A.setVolume = (v) => { vol = v; if (ctx && enabled) master.gain.setTargetAtTime(v, ctx.currentTime, 0.1); };

  // called every frame with the authoritative show clock
  A.sync = function (showT, isPlaying, spd, energy, crowd) {
    if (!ctx || !enabled) return;
    const now = ctx.currentTime;
    const expect = anchorShow + (now - anchorCtx) * speed;
    if (A._resync || Math.abs(expect - showT) > 0.12 || spd !== speed || isPlaying !== playing) {
      flushFuture();
      anchorCtx = now + 0.05; anchorShow = showT; speed = spd; playing = isPlaying;
      schedUntil = showT; A._resync = false;
    }
    if (crowdGain) {
      crowdGain.gain.setTargetAtTime((0.05 + 0.22 * crowd) * (isPlaying ? 1 : 0.6), now, 0.3);
      crowdFilt.frequency.setTargetAtTime(700 + 600 * crowd, now, 0.5);
    }
    if (!isPlaying) return;
    const ahead = anchorShow + (now + 0.3 - anchorCtx) * speed;
    if (ahead > schedUntil) {
      if (ahead < showT) schedUntil = showT;
      schedule(schedUntil, ahead);
      schedUntil = ahead;
    }
  };

  // one-shot effects: type, seconds from now, distance (m) for the speed-of-sound delay
  A.fx = function (type, inSec, dist, gain) {
    if (!ctx || !enabled) return;
    const t = ctx.currentTime + Math.max(0, inSec || 0) + (dist || 0) / 343;
    const g = (gain == null ? 1 : gain) / (1 + (dist || 0) / 160);
    if (type === 'boom') {
      const o = ctx.createOscillator(), e = ctx.createGain();
      o.frequency.setValueAtTime(70 + Math.random() * 30, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.6);
      env(e, t, 0.002, 0.8 * g, 0.15, 0.35, 0.9); o.connect(e); e.connect(sfx); o.start(t); o.stop(t + 1.4); track(o, t);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2400;
      const n = ctx.createGain(); env(n, t, 0.001, 0.7 * g, 0.08, 0.2, 0.7); f.connect(n); n.connect(sfx); noise(t, 1.0, f);
      // crackle tail
      for (let i = 0; i < 14; i++) { const tc = t + 0.9 + Math.random() * 1.4; const hf = ctx.createBiquadFilter(); hf.type = 'highpass'; hf.frequency.value = 3000; const ce = ctx.createGain(); env(ce, tc, 0.001, 0.12 * g, 0.01, 0.1, 0.03); hf.connect(ce); ce.connect(sfx); noise(tc, 0.06, hf); }
    } else if (type === 'whoosh') {
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.9; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(140, t + 1.1);
      const e = ctx.createGain(); env(e, t, 0.03, 0.9 * g, 0.4, 0.5, 0.6); f.connect(e); e.connect(sfx); noise(t, 1.4, f);
    } else if (type === 'hiss') {
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500;
      const e = ctx.createGain(); env(e, t, 0.01, 0.4 * g, 0.5, 0.4, 0.5); f.connect(e); e.connect(sfx); noise(t, 1.2, f);
    } else if (type === 'launch') {
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 4; f.frequency.setValueAtTime(800, t); f.frequency.exponentialRampToValueAtTime(3200, t + 1.6);
      const e = ctx.createGain(); env(e, t, 0.05, 0.08 * g, 0.6, 0.6, 0.8); f.connect(e); e.connect(sfx); noise(t, 1.8, f);
    } else if (type === 'cheer') {
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 0.4;
      const e = ctx.createGain(); e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(0.5 * g, t + 0.6); e.gain.exponentialRampToValueAtTime(0.0001, t + 4);
      f.connect(e); e.connect(master); e.connect(wet); noise(t, 4.2, f);
    }
  };
})();
