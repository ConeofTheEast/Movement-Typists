/*
 * main.js: GAME SHELL (menu, loop, input, DOM UI)
 */
(function () {
  'use strict';
  const SEHS = window.SEHS;
  const C = SEHS.content;
  const Audio = SEHS.Audio;
  const W = 1280, H = 720;

  const $ = (id) => document.getElementById(id);
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const stage = $('stage');

  // ---------------- settings ----------------
  const settings = { sound: true, reduce: false, labels: false };
  try {
    const s = JSON.parse(localStorage.getItem('kinetic-escape-settings') || '{}');
    Object.assign(settings, s);
  } catch (e) { /* storage unavailable */ }
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches && settings.reduce == null) settings.reduce = true;
  function saveSettings() { try { localStorage.setItem('kinetic-escape-settings', JSON.stringify(settings)); } catch (e) { /* ignore */ } }

  // ---------------- sizing ----------------
  let scale = 1;
  function resize() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const w = Math.min(vw, (vh * 16) / 9);
    const h = (w * 9) / 16;
    stage.style.width = w + 'px';
    stage.style.height = h + 'px';
    stage.style.fontSize = (w / W) * 16 + 'px';
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    scale = Math.max(1, Math.min(1.5, (w * dpr) / W));
    canvas.width = Math.round(W * scale);
    canvas.height = Math.round(H * scale);
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------------- UI ----------------
  const ui = {
    show(id) { $(id).classList.remove('hidden'); },
    hide(id) { $(id).classList.add('hidden'); },

    showDecision(d) {
      if (d.side === 'dd-left' || d.side === 'dd-right') { this.hide('toast'); clearTimeout(this._tt); }
      $('d-title').textContent = d.title + (d.stages > 1 ? `: STEP ${d.stage + 1}/${d.stages}` : '') + (d.reask ? ' · TRY AGAIN' : '');
      $('d-kind').textContent = d.kindText || (d.kind === 'movement' ? 'CHOOSE THE MOVEMENT' : 'CHOOSE THE CONTRACTION');
      $('d-prompt').textContent = d.prompt;
      const box = $('d-options');
      box.innerHTML = '';
      d.options.forEach((opt, i) => {
        const b = document.createElement('button');
        b.className = 'opt';
        b.innerHTML = `<kbd>${i + 1}</kbd><span>${opt}</span>`;
        b.addEventListener('click', (e) => { e.stopPropagation(); Audio.select(); game.level.choose(i); });
        box.appendChild(b);
      });
      this.setTimer(1, 0);
      // the door panel sits low and to the right so the hands, knees and door edge stay visible
      $('decision').classList.toggle('right', d.side === 'right');
      // Drone Defense: a narrow side panel opposite the threat drone
      $('decision').classList.toggle('dd', d.side === 'dd-left' || d.side === 'dd-right');
      $('decision').classList.toggle('dd-left', d.side === 'dd-left');
      $('decision').classList.toggle('dd-right', d.side === 'dd-right');
      $('decision').classList.toggle('notimer', !!d.noTimer);
      $('decision').classList.remove('jam');
      this.show('decision');
      $('decision').classList.remove('urgent');
    },
    hideDecision() { this.hide('decision'); },
    setTimer(frac, secs) {
      $('d-timer-fill').style.width = frac * 100 + '%';
      $('d-secs').textContent = secs.toFixed(1) + 's';
      $('decision').classList.toggle('urgent', frac < 0.35);
    },

    toast(st, plane, o) {
      const s = st.success;
      const con = C.CONTRACTIONS[s.contraction];
      const names = s.agonists.map((id) => C.MUSCLES[id].name).join(', ');
      const planeLine = st.kind === 'movement'
        ? `<div class="t-sub">${plane.name} · ${C.axisName(plane.id || 'sagittal')}</div>`
        : `<div class="t-sub">${con.def}</div>`;
      const deeper = s.deeper ? `<div class="t-deep">${s.deeper}</div>` : '';
      $('toast').innerHTML = `<div class="t-head">✔ ${s.headline}</div>${planeLine}<div class="t-body">${s.detail}</div>${deeper}<div class="t-mus"><span class="chip" style="--c:${con.color}">${con.letter}</span>${names}: ${C.contractionLabel(s.contraction).toLowerCase()}</div>`;
      $('toast').classList.toggle('left', !!(o && o.side === 'left'));
      this.show('toast');
      clearTimeout(this._tt);
      this._tt = setTimeout(() => this.hide('toast'), s.deeper ? 5200 : 3600);
    },

    showFail(info, stats) {
      this.hide('toast');
      const st = info.st;
      const s = st.success;
      const con = C.CONTRACTIONS[s.contraction];
      const pl = C.PLANES.sagittal;
      $('f-head').textContent = info.headline;
      // `as` in content.js: which animation was acted out (e.g. Isotonic is shown as Concentric)
      $('f-choice').textContent = info.choice + (info.shownAs ? ` (shown as ${info.shownAs})` : '');
      $('f-explain').textContent = info.explain;
      const names = s.agonists.map((id) => C.MUSCLES[id].name).join(', ');
      $('f-correct').innerHTML = `<b>${st.correct}</b>: ${s.detail}${s.deeper ? `<br><span class="dim">${s.deeper}</span>` : ''}<br><span class="dim">${st.kind === 'movement' ? `${pl.name} · axis: ${C.axisAllNames('sagittal')}` : con.def}</span><br><span class="chip" style="--c:${con.color}">${con.letter}</span> ${names}: ${C.contractionLabel(s.contraction).toLowerCase()}`;
      $('fail').classList.toggle('plane', info.kind === 'plane');
      // hybrid damage system: fatal -> checkpoint; partial -> -1 energy, same question again
      const fail = $('fail');
      fail.classList.toggle('partial', !info.fatal && !info.shutdown);
      fail.classList.toggle('shutdown', !!info.shutdown);
      const en = info.energy != null ? info.energy : 0;
      if (info.shutdown) {
        $('f-kicker').textContent = 'POWER FAILURE · ENERGY 0/5';
        $('f-cost').textContent = 'Energy ran out, so the android shut down. Reboot at this hazard with energy refilled to 5/5.';
        $('btn-retry').textContent = 'Reboot at checkpoint (R)';
      } else if (info.fatal) {
        $('f-kicker').textContent = 'ANDROID DESTROYED · FATAL';
        $('f-cost').textContent = `Fatal: reboot at this hazard (checkpoint). Energy unchanged: ${en}/5.`;
        $('btn-retry').textContent = 'Reboot at this hazard (R)';
      } else {
        $('f-kicker').textContent = info.kind === 'plane' ? 'MALFUNCTION · −1 ENERGY' : 'PART DAMAGED · −1 ENERGY';
        $('f-cost').textContent = `−1 energy · try again. Energy ${en}/5. The same question comes back.`;
        $('btn-retry').textContent = 'Try again (R)';
      }
      clearTimeout(this._ft);
      this._ft = setTimeout(() => this.show('fail'), 350);
    },

    // Drone Defense fail card: same DOM as the sagittal card, real-time wording
    showFailDD(info) {
      this.hide('toast');
      const st = info.st, s = st.success;
      const con = C.CONTRACTIONS[s.contraction];
      const pl = C.PLANES.transverse;
      const DU = C.DRONE_UI.card;
      $('f-head').textContent = info.kind === 'plane' ? DU.planeTitle : info.kind === 'timeout' && info.headline !== DU.timeoutTitle ? `${DU.timeoutTitle}: ${info.headline}` : info.headline;
      $('f-choice').textContent = info.choice + (info.shownAs ? ` (shown as ${info.shownAs})` : '');
      $('f-explain').textContent = info.explain;
      const names = s.agonists.map((id) => (C.MUSCLES[id] ? C.MUSCLES[id].name : id)).join(', ');
      $('f-correct').innerHTML = `<b>${st.correct}</b>: ${s.detail}${s.deeper ? `<br><span class="dim">${s.deeper}</span>` : ''}<br><span class="dim">${st.kind === 'movement' ? `${pl.name} · axis: ${C.axisAllNames('transverse')}` : con.def}</span><br><span class="chip" style="--c:${con.color}">${con.letter}</span> ${names}: ${C.contractionLabel(s.contraction).toLowerCase()}`;
      const fail = $('fail');
      fail.classList.toggle('plane', info.kind === 'plane');
      fail.classList.toggle('partial', !info.shutdown);
      fail.classList.toggle('shutdown', !!info.shutdown);
      const en = `${info.energy}/${info.max}`;
      if (info.shutdown) {
        $('f-kicker').textContent = `${C.DRONE_UI.wave.shutdown} · ENERGY 0/${info.max}`;
        $('f-cost').textContent = `Energy ran out, so the android shut down. Watch the replay, then the wave restarts with full energy. ${DU.reask}`;
        $('btn-retry').textContent = 'Replay, then restart wave (Enter)';
      } else {
        const ally = info.damage === 'ally' && info.allyName;
        $('f-kicker').textContent = info.kind === 'plane' ? 'MALFUNCTION · −1 ENERGY' : ally ? `${C.DRONE_UI.card.allyHit.replace('{name}', info.allyName)} · CUT THEM FREE!` : info.kind === 'timeout' ? `${DU.timeoutTitle} · −1 ENERGY` : 'PART DAMAGED · −1 ENERGY';
        $('f-cost').textContent = `${ally ? `${info.allyName} is being towed away: click them or press R to cut the net (+1 energy). ` : ''}Energy ${en}. ${DU.reask}`;
        $('btn-retry').textContent = 'Watch the replay ▶ (Enter)';
      }
      clearTimeout(this._ft);
      this._ft = setTimeout(() => this.show('fail'), 350);
    },

    // generic Drone Defense card (wave summary, WAVE FAILED)
    ddCard(c) {
      $('dd-kicker').textContent = c.kicker || '';
      $('dd-kicker').className = 'kicker ' + (c.kickerClass || '');
      $('dd-title').textContent = c.title || '';
      $('dd-body').innerHTML = c.html || '';
      const row = $('dd-btns');
      row.innerHTML = '';
      this._ddPrimary = null;
      (c.buttons || []).forEach((b) => {
        const el = document.createElement('button');
        el.className = b.primary ? 'primary' : 'ghost';
        el.textContent = b.label;
        const fn = () => { this.hideCard(); if (b.act === 'menu') toMenu(); else if (typeof b.act === 'function') b.act(); };
        el.addEventListener('click', fn);
        if (b.primary) this._ddPrimary = fn;
        row.appendChild(el);
      });
      this.show('ddcard');
    },
    hideCard() { this.hide('ddcard'); this._ddPrimary = null; },
    rescueWrong(msg) {
      $('d-prompt').textContent = msg;
      const d = $('decision');
      d.classList.add('jam');
      d.querySelectorAll('.opt').forEach((b) => { b.disabled = true; });
    },

    showWin(stats) {
      const acc = stats.decisions ? Math.round((stats.correct / stats.decisions) * 100) : 0;
      const first = stats.firstTries ? Math.round((stats.firstTryCorrect / stats.firstTries) * 100) : 0;
      $('w-stats').innerHTML = `
        <div><b>${first}%</b><span>first-try accuracy</span></div>
        <div><b>${acc}%</b><span>accuracy (incl. re-asks)</span></div>
        <div><b>${stats.energyLeft}/5</b><span>energy remaining</span></div>
        <div><b>${stats.friendsSaved}</b><span>friends saved</span></div>
        <div><b>${stats.partials}</b><span>partial hits taken</span></div>
        <div><b>${stats.shutdowns}</b><span>shutdowns</span></div>
        <div><b>${stats.reboots}</b><span>reboots</span></div>
        <div><b>${stats.best}</b><span>best streak</span></div>`;
      const errs = [];
      if (stats.plane) errs.push(`<li><b>${stats.plane}</b> plane error(s): picked a frontal/transverse movement. Review: sagittal = flexion/extension about the frontal axis.</li>`);
      if (stats.wrongSagittal) errs.push(`<li><b>${stats.wrongSagittal}</b> flexion/extension mix-up(s). Review: flexion decreases the joint angle, extension increases it.</li>`);
      if (stats.contraction) errs.push(`<li><b>${stats.contraction}</b> contraction-type error(s). Review: concentric shortens, eccentric lengthens under tension, isometric stays the same length.</li>`);
      if (stats.timeout) errs.push(`<li><b>${stats.timeout}</b> timeout(s).</li>`);
      $('w-review').innerHTML = errs.length ? `<h3>Review targets</h3><ul>${errs.join('')}</ul>` : '<h3>Flawless escape. No review targets.</h3>';
      this.show('win');
      game.state = 'won';
    },

    // Energy bar: 5 cyan cells, lost cells dark, flash on change.
    energy(n) {
      if (this._en === n) return;
      const prev = this._en;
      this._en = n;
      const cells = $('energy-cells').children;
      for (let i = 0; i < cells.length; i++) cells[i].classList.toggle('off', i >= n);
      $('energy-txt').textContent = `${n}/5`;
      if (prev == null) return;
      const box = $('energy');
      box.classList.remove('gain', 'loss');
      void box.offsetWidth; // restart the CSS animation
      box.classList.add(n > prev ? 'gain' : 'loss');
      clearTimeout(this._et);
      this._et = setTimeout(() => box.classList.remove('gain', 'loss'), 900);
    },

    hud(level) {
      if (level.kind === 'drone') { this.hudDrone(level); return; }
      const p = Math.min(1, Math.max(0, level.scrollX / level.exitX));
      $('prog-fill').style.width = p * 100 + '%';
      const s = level.stats;
      const ax = C.axisName('sagittal');
      if (this._ax !== ax) { this._ax = ax; $('plane-tag').innerHTML = `<b>SAGITTAL PLANE</b> · <span class="ax">${ax}</span> ⊙`; }
      this.energy(level.energy);
      $('hud-stats').innerHTML = `<span>HAZARD <b>${Math.min(level.cur + 1, level.obs.length)}/${level.obs.length}</b></span><span>CORRECT <b>${s.correct}</b></span><span>STREAK <b>${s.streak}</b></span>`;
      const list = $('monitor-list');
      if (level.jammed()) { list.innerHTML = `<li class="jam">${level.mode === 'decide' ? 'SENSORS JAMMED: YOU DECIDE' : 'SENSORS JAMMED'}</li>`; return; }
      const act = level.android.activeList(0.25).slice(0, 6);
      list.innerHTML = act.length
        ? act.map((m) => {
          const con = C.CONTRACTION_BY_ID[m.mode];
          return `<li><span class="chip" style="--c:${con.color}">${con.letter}</span><span class="mn">${C.MUSCLES[m.id].name}</span><span class="mb"><i style="width:${m.q * 100}%;background:${con.color}"></i></span></li>`;
        }).join('')
        : '<li class="idle">idle</li>';
    },
  };

  // Drone Defense HUD: energy/repair/wave/scrap/combo/allies are drawn on the
  // canvas by the level; the DOM keeps the rotating axis tag and the monitor.
  ui.hudDrone = function (level) {
    const ax = C.axisName('transverse');
    const jam = level.jamT > 0;
    const key = ax + (jam ? '#' : '');
    if (this._ax !== key) { this._ax = key; $('plane-tag').innerHTML = `<b>TRANSVERSE PLANE</b> · <span class="ax">${jam ? ax.replace(/[aeiou]/g, '#') : ax}</span> ⊙`; }
    const list = $('monitor-list');
    if (level.jammed()) { list.innerHTML = `<li class="jam">${level.mode === 'decide' ? 'SENSORS JAMMED: YOU DECIDE' : 'SENSORS JAMMED'}</li>`; return; }
    const act = level.rig.activeList(0.25).slice(0, 6);
    list.innerHTML = act.length
      ? act.map((m) => {
        const con = C.CONTRACTION_BY_ID[m.mode];
        const nm = C.MUSCLES[m.id] ? C.MUSCLES[m.id].name : m.id.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
        return `<li><span class="chip" style="--c:${con.color}">${con.letter}</span><span class="mn">${nm}${m.both ? '' : ` (${m.side})`}</span><span class="mb"><i style="width:${m.q * 100}%;background:${con.color}"></i></span></li>`;
      }).join('')
      : '<li class="idle">idle</li>';
  };

  // ---------------- game ----------------
  const game = {
    state: 'menu', // menu | briefing | play | paused | failed | won
    fx: new SEHS.FX(),
    ui,
    level: null,
    paused: false,
  };
  window.game = game; // handy for debugging / automated playtests

  if (SEHS.Sprites) SEHS.Sprites.load('sagittal');
  game.fx.reduce = settings.reduce;
  Audio.setMuted(!settings.sound);
  game.level = new SEHS.SagittalLevel(game);
  game.level.setAttract(true);

  function buildMenu() {
    const box = $('levels');
    box.innerHTML = '';
    C.LEVELS.forEach((lv) => {
      const card = document.createElement('div');
      card.className = `level ${lv.status}`;
      const badge = lv.status === 'playable' ? 'PLAYABLE' : lv.status === 'design' ? 'IN DESIGN' : 'PAUSED';
      let extra = '', playLbl = 'Play ▶';
      if (lv.id === 'transverse' && SEHS.DroneDefense) {
        const sv = SEHS.DroneDefense.SaveIO.load();
        if (sv.wave > 1) { playLbl = `Continue (wave ${sv.wave}) ▶`; extra = '<button class="ghost small" data-act="fresh">New defense</button>'; }
        if (sv.bestWave) extra += `<div class="lv-best">BEST WAVE ${sv.bestWave}</div>`;
      }
      card.innerHTML = `<div class="badge">${badge}</div><div class="lv-plane">${lv.tag}</div><h3>${lv.title}</h3><p>${lv.blurb}</p>
        <div class="lv-btns"><button class="ghost small" data-act="tut">📘 Tutorial</button>${lv.status === 'playable' ? `<button class="primary small" data-act="play">${playLbl}</button>` : ''}</div>${extra ? `<div class="lv-btns">${extra}</div>` : ''}`;
      card.querySelector('[data-act="tut"]').addEventListener('click', () => { Audio.init(); openTutorial(lv.id, false); });
      const pb = card.querySelector('[data-act="play"]');
      if (pb) pb.addEventListener('click', () => { Audio.init(); openTutorial(lv.id, true); });
      const fb = card.querySelector('[data-act="fresh"]');
      if (fb) fb.addEventListener('click', () => { if (window.confirm('Start a new defense from wave 1? Scrap and upgrades reset; your Fault Log and Calibration are kept.')) { Audio.init(); openTutorial(lv.id, true, { fresh: true }); } });
      box.appendChild(card);
    });
    $('opt-sound').checked = settings.sound;
    $('opt-reduce').checked = settings.reduce;
    $('opt-labels').checked = settings.labels;
  }

  // The tutorial / review section runs at the outset of every game.
  const tutorial = new SEHS.Tutorial();
  function openTutorial(levelId, preplay, startOpts) {
    ui.hide('menu');
    game.state = 'briefing';
    tutorial.show(levelId, {
      preplay,
      onStart: () => startLevel(levelId, startOpts),
      onClose: () => { ui.show('menu'); game.state = 'menu'; },
    });
  }

  function startLevel(levelId, opts) {
    Audio.init();
    ui.hide('tutorial'); ui.hide('fail'); ui.hide('win'); ui.hide('menu'); ui.hide('ddcard');
    if (game.level && game.level.destroy) game.level.destroy();
    const drone = levelId === 'transverse' && SEHS.DroneDefense;
    game.level = drone ? new SEHS.DroneDefense(game, opts) : new SEHS.SagittalLevel(game);
    if (SEHS.Sprites && !drone) SEHS.Sprites.load('sagittal');
    $('hud').classList.toggle('drone', !!drone);
    ui._en = null; ui._ax = null;
    if (!drone) ui.energy(game.level.energy);
    ui.show('hud');
    game.state = 'play';
    game.paused = false;
  }

  function toMenu() {
    clearTimeout(ui._ft); // a pending fail card must not pop up over the menu
    ['fail', 'win', 'pause', 'hud', 'decision', 'toast', 'tutorial', 'ddcard', 'workshop'].forEach((id) => ui.hide(id));
    if (game.level && game.level.destroy) game.level.destroy();
    if (game.level && game.level.wsHandle) { try { game.level.wsHandle.close(); } catch (e) { /* ignore */ } }
    $('hud').classList.remove('drone');
    ui._ax = null;
    game.level = new SEHS.SagittalLevel(game);
    game.level.setAttract(true);
    game.state = 'menu';
    game.paused = false;
    buildMenu();
    ui.show('menu');
  }

  function togglePause() {
    if (game.state !== 'play') return;
    game.paused = !game.paused;
    game.paused ? ui.show('pause') : ui.hide('pause');
  }

  // buttons
  $('btn-pause-tut').addEventListener('click', () => {
    ui.hide('pause');
    game.state = 'briefing';
    tutorial.show((game.level && game.level.planeId) || 'sagittal', { preplay: false, onClose: () => { game.state = 'play'; ui.show('pause'); } });
  });
  // Fail-card action: fatal / shutdown -> checkpoint reboot; partial -> rewind and re-ask.
  function retry() {
    if ($('fail').classList.contains('hidden')) return;
    ui.hide('fail');
    game.level.retry();
    game.state = 'play';
  }
  $('btn-retry').addEventListener('click', retry);
  $('btn-fail-menu').addEventListener('click', toMenu);
  $('btn-again').addEventListener('click', startLevel);
  $('btn-win-menu').addEventListener('click', toMenu);
  $('btn-resume').addEventListener('click', togglePause);
  $('btn-pause-menu').addEventListener('click', toMenu);
  $('pause-btn').addEventListener('click', togglePause);
  $('opt-sound').addEventListener('change', (e) => { settings.sound = e.target.checked; Audio.setMuted(!settings.sound); saveSettings(); });
  $('opt-reduce').addEventListener('change', (e) => { settings.reduce = e.target.checked; game.fx.reduce = settings.reduce; saveSettings(); });
  $('opt-labels').addEventListener('change', (e) => { settings.labels = e.target.checked; saveSettings(); });

  window.addEventListener('keydown', (e) => {
    const lvl = game.level;
    if (game.state === 'play' && !game.paused && (lvl.acceptsChoice ? lvl.acceptsChoice() : lvl.mode === 'decide')) {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 4) { Audio.select(); game.level.choose(n - 1); e.preventDefault(); return; }
    }
    if (game.state === 'briefing' || game.state === 'workshop') return; // tutorial / workshop have focus
    if (!$('ddcard').classList.contains('hidden')) { if (e.key === 'Enter' && ui._ddPrimary) { e.preventDefault(); ui._ddPrimary(); } return; }
    if (game.state === 'play' && !game.paused && lvl.onKey && $('fail').classList.contains('hidden') && lvl.onKey(e)) { e.preventDefault(); return; }
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') togglePause();
    if (e.key === 'l' || e.key === 'L') { settings.labels = !settings.labels; $('opt-labels').checked = settings.labels; saveSettings(); }
    if (e.key === 'm' || e.key === 'M') { settings.sound = !settings.sound; $('opt-sound').checked = settings.sound; Audio.setMuted(!settings.sound); saveSettings(); }
    if (e.key === 'Enter' && game.state === 'menu') { Audio.init(); openTutorial('sagittal', true); }
    if ((e.key === 'r' || e.key === 'R' || e.key === 'Enter') && !$('fail').classList.contains('hidden')) { e.preventDefault(); retry(); }
  });

  // pointer: Drone Defense targeting (click / tap a drone or a netted ally)
  canvas.addEventListener('pointerdown', (e) => {
    const lv = game.level;
    if (game.state !== 'play' || game.paused || !lv || !lv.onPointer) return;
    const r = canvas.getBoundingClientRect();
    lv.onPointer(((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H);
  });

  // ---------------- loop ----------------
  let last = performance.now();
  let hudT = 0;
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 1 / 20) dt = 1 / 20;
    const lv = game.level;
    if (!game.paused && !(game.state === 'briefing' && lv.mode !== 'attract')) lv.update(dt);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    lv.draw(ctx, { labels: settings.labels });
    if (game.state === 'play') {
      hudT -= dt;
      if (hudT <= 0) { hudT = 0.1; ui.hud(lv); }
    }
    requestAnimationFrame(frame);
  }

  buildMenu();
  requestAnimationFrame(frame);
})();
