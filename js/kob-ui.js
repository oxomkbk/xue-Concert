(window.KOB_FILES = window.KOB_FILES || {}).ui = '12';
/* ═══════════════════════════════════════════════════════════════════
   KING OF BEASTS — interface
   Two modes: SHOW (directed, autoplay) and EXPLORE (free camera, show keeps
   running). The way back to the show is a pulsing pill + Space + idle timer.
   Layout: the top band and the dock sit inside the cinematic bars when they are tall enough
   (--bar is set here); otherwise they float over the picture on a soft scrim.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const KOB = (window.KOB = window.KOB || {});
  const $ = (s) => document.querySelector(s);
  const fmt = (s) => { s = Math.max(0, Math.floor(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  const pad2 = (i) => String(i).padStart(2, '0');

  KOB.makeUI = function (app) {
    const body = document.body;
    const P = KOB.params;
    if (!P.ui) body.classList.add('ui-off');
    if (P.stats) body.classList.add('show-stats');
    let mode = 'play';

    /* letterbox geometry → CSS (--bar) ------------------------------------- */
    function layout() {
      const W = window.innerWidth, H = window.innerHeight;
      const bar = mode === 'play' && P.letterbox && W / H >= 1.3 ? Math.max(0, Math.round((H - W / 2.2) / 2)) : 0;
      // same numbers as the CSS tokens: margin, control and dock heights
      const phone = W <= 640;
      const m = phone ? 12 : Math.min(32, Math.max(14, W * 0.022)), ctl = 36, dock = 44;
      // a band snaps into its bar when the bar can hold the controls with breathing room,
      // otherwise it floats over the picture at the standard margin
      const topH = bar >= ctl + 20 ? bar : ctl + 2 * m;
      const botH = bar >= dock + 20 ? bar : dock + 2 * m;
      body.style.setProperty('--bar', bar + 'px');
      body.style.setProperty('--top-h', topH + 'px');
      body.style.setProperty('--bot-h', botH + 'px');
      body.classList.toggle('in-bars', bar >= dock + 20);
    }
    window.addEventListener('resize', layout);
    layout();

    /* chapters on the timeline -------------------------------------------- */
    const chHost = $('#tlChapters');
    const chEls = KOB.CHAPTERS.map((c, i) => {
      const el = document.createElement('div');
      el.className = 'tl__ch';
      el.style.width = ((c.end - c.t) / KOB.TOTAL * 100) + '%';
      el.innerHTML = `<b>${pad2(i + 1)}</b>`;
      chHost.appendChild(el);
      return el;
    });
    $('#chTot').textContent = pad2(KOB.CHAPTERS.length);
    const track = $('#tlTrack'), tip = $('#tlTip');
    const tipB = tip.querySelector('b'), tipS = tip.querySelector('span');
    let scrubbing = false;
    const timeAt = (e) => {
      const r = track.getBoundingClientRect();
      const k = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      let t = k * KOB.TOTAL;
      for (const c of KOB.CHAPTERS) if (Math.abs(t - c.t) < KOB.TOTAL * 0.012) t = c.t;   // snap to chapter starts
      return { t, x: k * r.width };
    };
    track.addEventListener('pointerdown', (e) => { scrubbing = true; track.setPointerCapture(e.pointerId); app.seek(timeAt(e).t); });
    track.addEventListener('pointermove', (e) => {
      const { t, x } = timeAt(e);
      const c = KOB.CHAPTERS[KOB.chapterAt(t)];
      tipB.textContent = `${pad2(c.index + 1)} · ${c.name}`;
      tipS.textContent = `${c.cn} · ${fmt(t)}`;
      tip.style.left = Math.min(Math.max(x, 70), track.clientWidth - 70) + 'px';
      if (scrubbing) app.seek(t);
    });
    track.addEventListener('pointerup', () => { scrubbing = false; });

    /* modes ------------------------------------------------------------------ */
    document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => app.setMode(b.dataset.mode)));
    $('#btnResume').addEventListener('click', () => app.setMode('play'));
    $('#btnPause').addEventListener('click', () => app.togglePause());

    /* viewpoints ------------------------------------------------------------- */
    const vHost = $('#viewList');
    const vEls = app.VIEWS.map((v, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'vrow';
      b.innerHTML = `<i>${pad2(i + 1)}</i><b>${v.name}</b><small>${v.cn}</small>`;
      b.addEventListener('click', () => app.flyTo(i));
      vHost.appendChild(b);
      return b;
    });

    /* fx desk ---------------------------------------------------------------- */
    // the build-12 set pieces, grouped by where they play
    {
      const more = $('#fxMore');
      [['in', '场内', 'In the bowl'], ['out', '场外', 'Outside']].forEach(([w, cn, en]) => {
        const h = document.createElement('h4'); h.className = 'fxh'; h.innerHTML = `<span>${cn}</span><small>${en}</small>`;
        const grid = document.createElement('div'); grid.className = 'fx';
        (KOB.SFX_LIST || []).filter((e) => e.where === w).forEach((e) => {
          const b = document.createElement('button'); b.type = 'button'; b.dataset.fx = e.id; b.title = `${e.en} ${e.cn}`;
          b.innerHTML = `<svg viewBox="0 0 24 24"><path d="${e.icon}"/></svg><small>${e.cn}</small>`;
          grid.appendChild(b);
        });
        more.append(h, grid);
      });
      // live state: a lit dot on every set piece that is running right now (cue or desk)
      const lv = [...more.querySelectorAll('[data-fx]')].filter((b) => (KOB.SFX_LIST.find((e) => e.id === b.dataset.fx) || {}).type === 'level');
      setInterval(() => {
        if (!document.body.classList.contains('deck-open') || !app.sfxLevel) return;
        for (const b of lv) b.classList.toggle('on', app.sfxLevel(b.dataset.fx) > 0.05);
      }, 250);
    }
    document.querySelectorAll('[data-fx]').forEach((b) => b.addEventListener('click', () => {
      app.trigger(b.dataset.fx);
      b.classList.add('hit'); setTimeout(() => b.classList.remove('hit'), 160);
    }));

    // the tour: the main module flies and fires, this side shows the caption card
    $('#btnTour').addEventListener('click', () => app.tour(!app.tourOn()));
    $('#tcStop').addEventListener('click', () => app.tour(false));
    $('#tcSkip').addEventListener('click', () => app.tourSkip());

    $('#buildStamp').textContent = 'Build ' + (window.KOB_BUILD || '?') + ' · 万兽之王 Live';
    /* tools ------------------------------------------------------------------ */
    $('#btnSound').addEventListener('click', () => app.toggleSound());
    // picture quality lives in a small popover behind the sliders icon
    const menu = $('#menu'), bSet = $('#btnSettings');
    const closeMenu = () => { menu.classList.remove('on'); bSet.classList.remove('is-open'); };
    bSet.addEventListener('click', (e) => { e.stopPropagation(); const on = !menu.classList.contains('on'); menu.classList.toggle('on', on); bSet.classList.toggle('is-open', on); });
    menu.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => { app.setQuality(b.dataset.q); closeMenu(); }));
    document.addEventListener('pointerdown', (e) => { if (!e.target.closest('.settings')) closeMenu(); });
    $('#reveal').addEventListener('click', () => { body.classList.remove('ui-hidden'); wake(); });
    $('#btnFull').addEventListener('click', () => {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
      else document.exitFullscreen?.();
    });
    $('#btnHide').addEventListener('click', () => { body.classList.add('ui-hidden'); closeMenu(); });

    /* control deck: rail + sliding sheet ------------------------------------- */
    const railBtns = [...document.querySelectorAll('.rail [data-tab]')], tabEls = [...document.querySelectorAll('#deck .tab')];
    let deckTab = null;
    function openTab(name) {
      deckTab = name;
      body.classList.toggle('deck-open', !!name);
      railBtns.forEach((b) => b.classList.toggle('is-on', b.dataset.tab === name));
      tabEls.forEach((t) => t.classList.toggle('is-on', t.dataset.tab === name));
    }
    railBtns.forEach((b) => b.addEventListener('click', () => openTab(deckTab === b.dataset.tab ? null : b.dataset.tab)));
    document.querySelectorAll('#deck .close').forEach((b) => b.addEventListener('click', () => openTab(null)));

    /* keyboard --------------------------------------------------------------- */
    window.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (body.classList.contains('is-booting')) return;
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      const k = e.key.toLowerCase();
      // Explore is locked: only the 演出 tab or the 回到演出 button leave it, never a key or a timer
      if (k === ' ') { e.preventDefault(); if (app.mode === 'play') app.setMode('free'); else ui.toast('自由模式已锁定 · 点「回到演出」返回'); }
      else if (k === 'escape' && deckTab) openTab(null);
      else if (k === 'h') { body.classList.toggle('ui-hidden'); closeMenu(); }
      else if (k === 'm') app.toggleSound();
      else if (k === 'f') $('#btnFull').click();
      else if (k === 'arrowright' && app.mode === 'play') app.chapterStep(1);
      else if (k === 'arrowleft' && app.mode === 'play') app.chapterStep(-1);
      else if (k === 'k' && app.mode === 'play') app.togglePause();
      else if (/^[0-9]$/.test(k) && app.mode === 'free' && !app.flyKeys.has('shift')) app.flyTo(k === '0' ? 9 : Number(k) - 1);
    });
    // buttons must not keep keyboard focus: Space is the global show/explore toggle
    document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('button'); if (b) b.blur(); }, true);

    /* auto-hide in show mode -------------------------------------------------- */
    let stillT = 0;
    const wake = () => { stillT = 0; if (body.classList.contains('idle')) body.classList.remove('idle'); };
    ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((ev) => window.addEventListener(ev, wake, { passive: true }));

    /* chapter lower third: in on every chapter change, out after a while ------ */
    let lowerT = 0;
    const lower = $('#lower');
    const card = $('#card');

    let toastT = 0;
    const ui = {
      toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 1800); },
      setMode(m) {
        mode = m;
        body.classList.toggle('mode-play', m === 'play');
        body.classList.toggle('mode-free', m === 'free');
        layout(); wake();
        if (m === 'play') { lower.classList.add('show'); lowerT = 0; if (deckTab === 'views') openTab(null); }
        else if (!deckTab) openTab('views');
      },
      setPaused(p) { body.classList.toggle('paused', p); },
      setSound(on) { $('#btnSound').classList.toggle('is-on', on); $('#soundLbl').textContent = on ? 'SOUND ON' : 'SOUND OFF'; },
      setQuality(q, active) {
        $('#qualityLbl').textContent = String(active || q).toUpperCase();
        document.querySelectorAll('#menu [data-q]').forEach((b) => b.classList.toggle('is-on', b.dataset.q === q));
      },
      setView(i) {
        vEls.forEach((el, k) => el.classList.toggle('is-on', k === i));
        $('#exView').textContent = i >= 0 ? `${app.VIEWS[i].name} ${app.VIEWS[i].cn}` : 'Free camera';
        if (i >= 0) vEls[i].scrollIntoView({ block: 'nearest' });
      },
      boot(p, msg) { const b = $('#bootBar'); if (b) b.style.width = Math.round(p * 100) + '%'; if (msg) $('#bootMsg').textContent = msg; },
      fail(msg) { $('#bootErrText').textContent = msg; $('#boot').classList.add('is-error'); },
      // entry gate: resolves with true (sound) / false (silent)
      gate() {
        return new Promise((res) => {
          const boot = $('#boot');
          boot.classList.add('is-ready');
          const go = (snd) => { window.removeEventListener('keydown', onKey); res(snd); };
          const onKey = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(true); } };
          $('#btnEnter').addEventListener('click', () => go(true), { once: true });
          $('#btnSilent').addEventListener('click', () => go(false), { once: true });
          window.addEventListener('keydown', onKey);
          setTimeout(() => $('#btnEnter').focus({ preventScroll: true }), 50);
        });
      },
      ready() { body.classList.remove('is-booting'); wake(); },
      lastCh: -1,
      frame(t, idleK, dt) {
        // touch the DOM only when something visible changed (layout / style work every frame
        // competes with the WebGL frame on weaker machines)
        const sec = Math.floor(t);
        if (sec !== ui._sec) {
          ui._sec = sec;
          $('#clock').textContent = fmt(t);
          $('#tlTime').firstChild.textContent = fmt(t);
        }
        const k = Math.round(t / KOB.TOTAL * 1000) / 1000;
        if (k !== ui._k) {
          ui._k = k;
          $('#tlFill').style.transform = 'scaleX(' + k + ')';
          $('#tlHead').style.transform = 'translateX(' + (k * track.clientWidth) + 'px)';
        }
        const ch = KOB.chapterAt(t);
        if (ch !== ui.lastCh) {
          ui.lastCh = ch;
          chEls.forEach((el, i) => el.classList.toggle('is-on', i === ch));
          const c = KOB.CHAPTERS[ch];
          $('#chIdx').textContent = pad2(ch + 1);
          $('#chName').textContent = c.name;
          $('#chCn').textContent = c.cn;
          $('#liveCh').textContent = pad2(ch + 1) + ' · ' + c.name;
          $('#exNow').textContent = pad2(ch + 1) + ' · ' + c.name;
          lower.classList.remove('swap'); void lower.offsetWidth; lower.classList.add('swap');
          lower.classList.add('show'); lowerT = 0;
        }
        dt = dt || 0;
        lowerT += dt;
        if (lowerT > 7 && lower.classList.contains('show')) lower.classList.remove('show');
        // title cards
        const open = P.titles && mode === 'play' && t > 0.6 && t < 7.4;
        const close = P.titles && mode === 'play' && t > 127.6 && t < 134.4;
        if (open !== ui._open) {
          ui._open = open; card.classList.toggle('open', open);
          if (!open && mode === 'play') { lower.classList.add('show'); lowerT = 0; }
        }
        // the chapter lower third waits for the opening card to clear
        if (open) { lower.classList.remove('show'); lowerT = 0; }
        if (close !== ui._close) { ui._close = close; card.classList.toggle('close', close); }
        // auto-hide the chrome in show mode
        if (deckTab) stillT = 0;
        if (P.autohide > 0 && mode === 'play') { stillT += dt; if (stillT > P.autohide && !body.classList.contains('idle')) body.classList.add('idle'); }
        const ik = Math.round(idleK * 200) / 200;
        if (ik !== ui._ik) {
          ui._ik = ik;
          const ring = $('#idleRing');
          if (ring) ring.style.strokeDashoffset = String(119.4 * (1 - ik));
          $('#resumeHint').textContent = '点击返回';
        }
      },
    };
    ui.tour = (e, i, n) => {
      body.classList.toggle('touring', !!e);
      $('#btnTour b').textContent = e ? '结束巡礼' : '特效巡礼';
      if (!e) return;
      if (i === 0) openTab(null);              // clear the view for the tour (entering Explore opens the camera list)
      const cap = $('#tourCap');
      $('#tcIdx').textContent = pad2(i + 1) + ' / ' + n;
      $('#tcWhere').textContent = e.where === 'in' ? '场内 · In the bowl' : '场外 · Outside';
      $('#tcCn').textContent = e.cn; $('#tcEn').textContent = e.en;
      $('#tcDesc').textContent = e.d + ' — ' + e.de;
      cap.classList.remove('swap'); void cap.offsetWidth; cap.classList.add('swap');
      const b = document.querySelector('[data-fx="' + e.id + '"]');
      if (b) { b.classList.add('hit'); setTimeout(() => b.classList.remove('hit'), 300); }
    };
    let tcK = -1;
    ui.tourProgress = (k) => { k = Math.round(Math.min(1, k) * 200) / 200; if (k !== tcK) { tcK = k; $('#tcFill').style.transform = 'scaleX(' + k + ')'; } };
    ui.openTab = openTab;
    ui.deck = KOB.makeDeck(app, ui);
    return ui;
  };
})();
