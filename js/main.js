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
      $('d-title').textContent = d.title + (d.stages > 1 ? `: STEP ${d.stage + 1}/${d.stages}` : '');
      $('d-kind').textContent = d.kind === 'movement' ? 'CHOOSE THE MOVEMENT' : 'CHOOSE THE CONTRACTION';
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
      this.show('decision');
      $('decision').classList.remove('urgent');
    },
    hideDecision() { this.hide('decision'); },
    setTimer(frac, secs) {
      $('d-timer-fill').style.width = frac * 100 + '%';
      $('d-secs').textContent = secs.toFixed(1) + 's';
      $('decision').classList.toggle('urgent', frac < 0.35);
    },

    toast(st, plane) {
      const s = st.success;
      const con = C.CONTRACTIONS[s.contraction];
      const names = s.agonists.map((id) => C.MUSCLES[id].name).join(', ');
      const planeLine = st.kind === 'movement'
        ? `<div class="t-sub">${plane.name} · ${plane.axis}</div>`
        : `<div class="t-sub">${con.def}</div>`;
      $('toast').innerHTML = `<div class="t-head">✔ ${s.headline}</div>${planeLine}<div class="t-body">${s.detail}</div><div class="t-mus"><span class="chip" style="--c:${con.color}">${con.letter}</span>${names}: ${con.name.toLowerCase()}</div>`;
      this.show('toast');
      clearTimeout(this._tt);
      this._tt = setTimeout(() => this.hide('toast'), 3600);
    },

    showFail(info, stats) {
      this.hide('toast');
      const st = info.st;
      const s = st.success;
      const con = C.CONTRACTIONS[s.contraction];
      const pl = C.PLANES.sagittal;
      $('f-head').textContent = info.headline;
      $('f-choice').textContent = info.choice;
      $('f-explain').textContent = info.explain;
      const names = s.agonists.map((id) => C.MUSCLES[id].name).join(', ');
      $('f-correct').innerHTML = `<b>${st.correct}</b>: ${s.detail}<br><span class="dim">${st.kind === 'movement' ? `${pl.name} · ${pl.axis} (${pl.axisAlt})` : con.def}</span><br><span class="chip" style="--c:${con.color}">${con.letter}</span> ${names}: ${con.name.toLowerCase()}`;
      $('fail').classList.toggle('plane', info.kind === 'plane');
      setTimeout(() => this.show('fail'), 350);
    },

    showWin(stats) {
      const acc = stats.decisions ? Math.round((stats.correct / stats.decisions) * 100) : 0;
      $('w-stats').innerHTML = `
        <div><b>${acc}%</b><span>accuracy (incl. retries)</span></div>
        <div><b>${stats.correct}/${stats.decisions}</b><span>decisions correct</span></div>
        <div><b>${stats.best}</b><span>best streak</span></div>
        <div><b>${stats.reboots}</b><span>reboots</span></div>`;
      const errs = [];
      if (stats.plane) errs.push(`<li><b>${stats.plane}</b> plane error(s): picked a frontal/transverse movement. Review: sagittal = flexion/extension about the frontal axis.</li>`);
      if (stats.wrongSagittal) errs.push(`<li><b>${stats.wrongSagittal}</b> flexion/extension mix-up(s). Review: flexion decreases the joint angle, extension increases it.</li>`);
      if (stats.contraction) errs.push(`<li><b>${stats.contraction}</b> contraction-type error(s). Review: concentric shortens, eccentric lengthens under tension, isometric stays the same length.</li>`);
      if (stats.timeout) errs.push(`<li><b>${stats.timeout}</b> timeout(s).</li>`);
      $('w-review').innerHTML = errs.length ? `<h3>Review targets</h3><ul>${errs.join('')}</ul>` : '<h3>Flawless escape. No review targets.</h3>';
      this.show('win');
      game.state = 'won';
    },

    hud(level) {
      const p = Math.min(1, Math.max(0, level.scrollX / level.exitX));
      $('prog-fill').style.width = p * 100 + '%';
      const s = level.stats;
      $('hud-stats').innerHTML = `<span>HAZARD <b>${Math.min(level.cur + 1, level.obs.length)}/${level.obs.length}</b></span><span>CORRECT <b>${s.correct}</b></span><span>STREAK <b>${s.streak}</b></span>`;
      const list = $('monitor-list');
      const jam = level.mode === 'decide' && level.decision && level.decision.st.kind === 'contraction';
      const rideJam = level.mode === 'ride' && level.obs[level.cur] && level.obs[level.cur].stage === 1;
      if (jam || rideJam) { list.innerHTML = '<li class="jam">SENSORS JAMMED: YOU DECIDE</li>'; return; }
      const act = level.android.activeList(0.25).slice(0, 6);
      list.innerHTML = act.length
        ? act.map((m) => {
          const con = C.CONTRACTION_BY_ID[m.mode];
          return `<li><span class="chip" style="--c:${con.color}">${con.letter}</span><span class="mn">${C.MUSCLES[m.id].name}</span><span class="mb"><i style="width:${m.q * 100}%;background:${con.color}"></i></span></li>`;
        }).join('')
        : '<li class="idle">idle</li>';
    },
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

  game.fx.reduce = settings.reduce;
  Audio.setMuted(!settings.sound);
  game.level = new SEHS.SagittalLevel(game);
  game.level.setAttract(true);

  function buildMenu() {
    const box = $('levels');
    box.innerHTML = '';
    C.LEVELS.forEach((lv) => {
      const card = document.createElement('button');
      card.className = `level ${lv.status}`;
      const badge = lv.status === 'playable' ? 'PLAY' : lv.status === 'design' ? 'IN DESIGN' : 'PAUSED';
      card.innerHTML = `<div class="badge">${badge}</div><div class="lv-plane">${lv.tag}</div><h3>${lv.title}</h3><p>${lv.blurb}</p>`;
      if (lv.status === 'playable') card.addEventListener('click', () => { Audio.init(); openBriefing(); });
      else card.disabled = true;
      box.appendChild(card);
    });
    $('opt-sound').checked = settings.sound;
    $('opt-reduce').checked = settings.reduce;
    $('opt-labels').checked = settings.labels;
  }

  function openBriefing() {
    ui.hide('menu');
    ui.show('briefing');
    game.state = 'briefing';
  }

  function startLevel() {
    Audio.init();
    ui.hide('briefing'); ui.hide('fail'); ui.hide('win'); ui.hide('menu');
    game.level = new SEHS.SagittalLevel(game);
    ui.show('hud');
    game.state = 'play';
    game.paused = false;
  }

  function toMenu() {
    ['fail', 'win', 'pause', 'hud', 'decision', 'toast', 'briefing'].forEach((id) => ui.hide(id));
    game.level = new SEHS.SagittalLevel(game);
    game.level.setAttract(true);
    game.state = 'menu';
    game.paused = false;
    ui.show('menu');
  }

  function togglePause() {
    if (game.state !== 'play') return;
    game.paused = !game.paused;
    game.paused ? ui.show('pause') : ui.hide('pause');
  }

  // buttons
  $('btn-start').addEventListener('click', startLevel);
  $('btn-back').addEventListener('click', toMenu);
  $('btn-retry').addEventListener('click', () => { ui.hide('fail'); game.level.reboot(); game.state = 'play'; });
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
    if (game.state === 'play' && !game.paused && game.level.mode === 'decide') {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 4) { Audio.select(); game.level.choose(n - 1); e.preventDefault(); return; }
    }
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') togglePause();
    if (e.key === 'l' || e.key === 'L') { settings.labels = !settings.labels; $('opt-labels').checked = settings.labels; saveSettings(); }
    if (e.key === 'm' || e.key === 'M') { settings.sound = !settings.sound; $('opt-sound').checked = settings.sound; Audio.setMuted(!settings.sound); saveSettings(); }
    if (e.key === 'Enter' && game.state === 'briefing') startLevel();
    if (e.key === 'Enter' && game.state === 'menu') { Audio.init(); openBriefing(); }
    if ((e.key === 'r' || e.key === 'R') && !$('fail').classList.contains('hidden')) $('btn-retry').click();
  });

  // ---------------- loop ----------------
  let last = performance.now();
  let hudT = 0;
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 1 / 20) dt = 1 / 20;
    const lv = game.level;
    if (!game.paused && game.state !== 'briefing') lv.update(dt);
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
