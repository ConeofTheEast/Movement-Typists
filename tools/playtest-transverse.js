/*
 * tools/playtest-transverse.js: headless playtest for Drone Defense (§4.13)
 *
 *   node tools/playtest-transverse.js <outDir> <threats> <choices> [flags]
 *     threats: comma list of DRONE_THREATS ids, `all` (all 14), or `waves`
 *              (no forced threats: play real waves, see --waves)
 *     choices: comma list applied to EVERY threat in turn:
 *              correct | wrong | wrong2 | plane | timeout
 *              wrong  = 1st in-plane distractor shown (contraction: 1st wrong option)
 *              wrong2 = 2nd one; plane = an out-of-plane option (contraction
 *              threats have none, so `wrong` is used and logged)
 *   flags:
 *     --wave N       start at wave N (e.g. --wave 5 for the Warden)
 *     --waves N      `waves` mode: play N waves (one forced freeze each, then
 *                    the wave is ended), with the workshop between waves
 *     --workshop     answer the exam terminal and buy/launch via Workshop.debug
 *     --boss         drive the Warden chain on a boss wave (answers correct)
 *     --shutdown     drain energy to 1 then answer wrong: shutdown -> WAVE FAILED
 *     --nocrew       net every ally and let the windows run out: NO CREW
 *     --rescue       net one ally and cut it free (wrong answer first, then right)
 *     --reduce       reduced flashing / shake setting
 *     --shots N      outcome frames per freeze (default 3)
 *
 * Screenshots: each freeze (decide), outcome frames, each fail card, replay,
 * cards and the workshop. Prints a final JSON state and `no errors`; exits 1
 * on any page error. Requires Playwright + Chromium.
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const argv = process.argv.slice(2);
const flag = (k) => argv.includes('--' + k);
const val = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const pos = []; for (let i = 0; i < argv.length; i++) { if (argv[i].startsWith('--')) { if (['wave', 'waves', 'shots'].includes(argv[i].slice(2))) i++; continue; } pos.push(argv[i]); }
const OUT = path.resolve(pos[0] || 'playtest-dd');
fs.mkdirSync(OUT, { recursive: true });
const ALL = ['netterOnAlly_left', 'netterOnAlly_right', 'crossSwat', 'backhandSwat', 'diveBehind', 'spineTwist', 'palmShield', 'palmCatch', 'discWindup', 'discThrow', 'discSnap', 'tetherPull', 'heavyCatch', 'hipPivot'];
const threats = (pos[1] || 'crossSwat') === 'all' ? ALL : (pos[1] || 'crossSwat') === 'waves' ? [] : (pos[1] || 'crossSwat').split(',');
const choices = (pos[2] || 'correct').split(',');
const SHOTS = +val('shots', 3);

(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  pg.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message + '\n' + e.stack));
  pg.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await pg.addInitScript(({ reduce }) => {
    try {
      localStorage.removeItem('kinetic-escape-drone-v1');
      localStorage.setItem('kinetic-escape-settings', JSON.stringify({ sound: false, reduce, labels: false }));
    } catch (e) { /* ignore */ }
  }, { reduce: flag('reduce') });
  await pg.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await pg.waitForTimeout(600);
  await pg.screenshot({ path: OUT + '/00-menu.png' });
  await pg.evaluate(() => {
    const card = [...document.querySelectorAll('.level')].find((c) => /Drone Defense/.test(c.textContent));
    card.querySelector('[data-act="play"]').click();
  });
  await pg.waitForTimeout(500);
  await pg.screenshot({ path: OUT + '/01-tutorial.png' });
  await pg.click('#tut-skip');
  await pg.waitForTimeout(300);
  const ok = await pg.evaluate(() => !!(game.level && game.level.kind === 'drone'));
  if (!ok) { console.log('drone level did not start'); process.exit(1); }
  if (val('wave')) await pg.evaluate((n) => game.level.debug.setWave(n), +val('wave'));
  await pg.screenshot({ path: OUT + '/02-intro.png' });

  const st = () => pg.evaluate(() => game.level.debug.state());
  const mode = () => pg.evaluate(() => game.level.mode);
  const waitMode = async (ms, max = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < max) { const m = await mode(); if (ms.includes(m)) return m; await pg.waitForTimeout(40); } return 'TIMEOUT:' + (await mode()); };
  const visible = (id) => pg.evaluate((id) => !document.getElementById(id).classList.contains('hidden'), id);
  const shot = (name) => pg.screenshot({ path: `${OUT}/${name}.png` });
  const log = (...a) => console.log(...a);
  const heal = () => pg.evaluate(() => { const L = game.level; L.energy = L.maxEnergy; L.damage = {}; L.allies.forEach((a) => { if (a.state === 'netted') { L.freeAlly(a, true); } }); });

  // play past the intro
  await pg.evaluate(() => game.level.debug.skip(3));
  await pg.waitForTimeout(200);

  // one freeze: force (optional), answer, screenshot the outcome and card
  async function freeze(id, choice, tag) {
    if (id) {
      const r = await pg.evaluate((id) => game.level.debug.forceThreat(id), id);
      if (!r) { log('could not force', id, JSON.stringify(await st())); return 'noforce'; }
    }
    const m = await waitMode(['decide']);
    if (m !== 'decide') { log('no decide for', id, m); return m; }
    await pg.waitForTimeout(500);
    await shot(`${tag}-decide`);
    const info = await pg.evaluate((choice) => {
      const L = game.level, F = L.freeze, s = F.st, o = F.options;
      const C = window.SEHS.content;
      const inplane = o.filter((x) => x !== s.correct && (s.kind === 'contraction' || C.planeOf(x) === 'transverse'));
      const plane = o.filter((x) => s.kind === 'movement' && C.planeOf(x) !== 'transverse');
      let pick = null, note = '';
      if (choice === 'correct') pick = s.correct;
      else if (choice === 'wrong') pick = inplane[0];
      else if (choice === 'wrong2') { pick = inplane[1]; if (!pick) { pick = inplane[0]; note = ' (no 2nd in-plane option: used 1st)'; } }
      else if (choice === 'plane') { pick = plane[0]; if (!pick) { pick = inplane[0]; note = ' (contraction threat: no plane option, used wrong)'; } }
      const tag = `${F.id} [${o.join(' | ')}]${F.reask ? ' (re-ask)' : ''}`;
      if (choice === 'timeout') { F.timer = 0.01; return 'timeout / ' + tag; }
      L.choose(o.indexOf(pick));
      return pick + ' / ' + tag + note;
    }, choice);
    log('chose', info);
    for (let f = 0; f < SHOTS; f++) { await pg.waitForTimeout(f === 0 ? 250 : 450); await shot(`${tag}-act${f}`); }
    const after = await waitMode(['failed', 'resume', 'play', 'lost'], 9000);
    if (after === 'failed') {
      await pg.waitForTimeout(500);
      await shot(`${tag}-fail`);
      const fc = await pg.evaluate(() => ({ kicker: document.getElementById('f-kicker').textContent, head: document.getElementById('f-head').textContent, energy: game.level.energy }));
      log('  fail card', JSON.stringify(fc));
      await pg.click('#btn-retry');
      await pg.waitForTimeout(700);
      await shot(`${tag}-replay`);
      const m2 = await waitMode(['play', 'lost', 'resume'], 6000);
      log('  after replay', m2, 'reask', JSON.stringify((await st()).reask));
    } else log('  outcome ->', after);
    await waitMode(['play', 'lost'], 4000);
    return after;
  }

  let n = 0;
  for (const id of threats) {
    for (const ch of choices) {
      await heal();
      await pg.evaluate(() => { game.level.reask = []; game.level.debug.skip(0.6); });
      await freeze(id, ch, `t${String(n).padStart(2, '0')}-${id}-${ch}`);
      n++;
    }
  }

  if (flag('rescue')) {
    await heal();
    await pg.evaluate(() => { const L = game.level; const a = L.allies[0]; const d = L.spawnDrone('netter', 0, { at: [a.x + 30, a.y - 40] }); d.hp = d.maxHp = 60; L.netAlly(a, d); });
    await pg.evaluate(() => game.level.debug.skip(0.5));
    await shot('r0-netted');
    await pg.evaluate(() => { const L = game.level; L.startRescue(L.allies.find((a) => a.state === 'netted')); });
    await pg.waitForTimeout(300);
    await shot('r1-rescue-prompt');
    log('rescue wrong ->', await pg.evaluate(() => game.level.debug.rescue(false)));
    await pg.waitForTimeout(300);
    await shot('r2-rescue-jammed');
    await pg.waitForTimeout(2200);
    log('rescue right ->', await pg.evaluate(() => game.level.debug.rescue(true)));
    await pg.waitForTimeout(400);
    await shot('r3-rescued');
  }

  if (flag('boss')) {
    await heal();
    const isBoss = await pg.evaluate(() => game.level.cfg.boss);
    if (!isBoss) await pg.evaluate(() => game.level.debug.setWave(5));
    await pg.evaluate(() => { game.level.debug.skip(3); game.level.debug.wardenNow(); game.level.warden.phaseT = 99; game.level.debug.skip(1.5); });
    await pg.waitForTimeout(400);
    await shot('b00-warden');
    await pg.evaluate(() => { game.level.warden.phaseT = 0; });
    for (let i = 0; i < 12; i++) {
      const s = await st();
      if (s.warden && (s.warden.dead || s.warden.phase >= 3)) break;
      await pg.evaluate(() => { const L = game.level; if (L.warden) L.warden.phaseT = Math.min(L.warden.phaseT, 0.05); L.energy = L.maxEnergy; });
      const r = await freeze(null, i === 1 ? 'wrong' : 'correct', `b${String(i + 1).padStart(2, '0')}`);
      if (String(r).startsWith('TIMEOUT')) break;
      log('  warden', JSON.stringify((await st()).warden));
    }
    await waitMode(['play'], 4000);
    for (let f = 0; f < 4; f++) { await pg.waitForTimeout(450); await shot(`b9${f}-finale`); }
    await pg.evaluate(() => game.level.debug.skip(3));
    log('warden end', JSON.stringify((await st()).warden));
  }

  if (flag('shutdown')) {
    await pg.evaluate(() => { game.level.energy = 1; });
    await freeze('crossSwat', 'wrong', 's0-shutdown');
    await pg.waitForTimeout(1200);
    const lost = await visible('ddcard');
    await shot('s1-wave-failed');
    log('shutdown card', lost, JSON.stringify(await st()));
    if (lost) { await pg.keyboard.press('Enter'); await pg.waitForTimeout(400); log('restarted', JSON.stringify(await st())); }
  }

  if (flag('nocrew')) {
    await pg.evaluate(() => { const L = game.level; L.debug.skip(3); L.reask = []; L.freezesDone = 99; });
    log('netAll', JSON.stringify(await pg.evaluate(() => game.level.debug.netAll())));
    await pg.evaluate(() => game.level.debug.skip(0.4));
    await shot('n0-all-netted');
    await pg.evaluate(() => game.level.debug.skip(16));
    await pg.waitForTimeout(1300);
    await shot('n1-no-crew');
    log('nocrew card', await visible('ddcard'), JSON.stringify(await st()));
    await pg.keyboard.press('Enter');
    await pg.waitForTimeout(400);
    log('restarted', JSON.stringify(await st()));
  }

  const nW = +val('waves', 0);
  for (let w = 0; w < nW; w++) {
    await heal();
    await pg.evaluate(() => game.level.debug.skip(4));
    await waitMode(['play'], 5000);
    await pg.waitForTimeout(400);
    const s0 = await st();
    await shot(`w${w}-realtime`);
    // let the real-time combat run a little in the browser loop
    await pg.waitForTimeout(2500);
    await shot(`w${w}-realtime2`);
    const pool = await pg.evaluate(() => game.level.cfg.pool);
    if (!s0.freeze && pool.length && !(await pg.evaluate(() => game.level.cfg.boss))) await freeze(pool[w % pool.length], 'correct', `w${w}-freeze`);
    await pg.evaluate(() => game.level.debug.endWave());
    await waitMode(['summary'], 8000);
    await pg.waitForTimeout(500);
    await shot(`w${w}-summary`);
    log(`wave ${s0.wave} cleared`, JSON.stringify(await st()));
    const hasWk = await pg.evaluate(() => !!(window.SEHS.Workshop && window.SEHS.Workshop.open));
    await pg.keyboard.press('Enter');
    await pg.waitForTimeout(600);
    if (hasWk && (await mode()) === 'workshop') {
      await shot(`w${w}-workshop`);
      if (flag('workshop')) {
        const r = await pg.evaluate(async () => {
          const D = window.SEHS.Workshop.debug, out = [];
          for (let i = 0; i < 6; i++) { out.push(D.answer(i % 3 !== 2)); D.next && D.next(); }
          D.grant && D.grant(200);
          out.push(D.buy && D.buy('pecMajorActuator'));
          out.push(D.toggle && D.toggle('pecMajorActuator'));
          return JSON.stringify(D.state ? D.state() : out).slice(0, 400);
        });
        log('  workshop', r);
        await pg.waitForTimeout(300);
        await shot(`w${w}-workshop2`);
      }
      await pg.evaluate(() => window.SEHS.Workshop.debug.launch());
      await pg.waitForTimeout(500);
      log('  launched ->', JSON.stringify(await pg.evaluate(() => ({ mode: game.level.mode, wave: game.level.wave, swatDmg: game.level.eff.swatDmg, dmgMul: game.level.eff.dmgMul }))));
    }
  }

  await pg.waitForTimeout(600);
  await shot('zz-end');
  const fin = await st();
  console.log('final', JSON.stringify(fin));
  console.log(errs.join('\n') || 'no errors');
  await b.close();
  if (errs.length) process.exit(1);
})();
