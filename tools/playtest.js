/*
 * tools/playtest.js: automated branch playtest (owned by the playtest-qa agent)
 *
 *   node tools/playtest.js <outDir> <hazards> <choices> [--reask]
 *     hazards: comma list of gap,laser,crate,drop,zipline,door (course is built
 *              in exactly that order), or `menu` to keep the random course.
 *     choices: comma list, one per decision:
 *              correct | wrong | wrong2 | wrong3 | plane | timeout
 *              (the last value repeats for remaining decisions)
 *              wrong   = movement: the in-plane wrong answer;
 *                        contraction: 1st wrong option in content order
 *              wrong2/3 = 2nd / 3rd wrong option (contraction: content order,
 *                        movement: displayed order)
 *              plane   = an out-of-plane distractor; contraction questions
 *                        have none, so it is treated as `wrong` (logged)
 *     --reask: re-asks after a partial hit keep consuming <choices> (used to
 *              drain energy for the shutdown test). Without it the playtest
 *              answers `correct` on every re-ask so the run continues.
 *
 *   e.g. node tools/playtest.js out gap,laser,crate,drop,zipline,door correct
 *        node tools/playtest.js out zipline correct,wrong2
 *        node tools/playtest.js out laser wrong --reask
 *
 * Saves a screenshot at each decision, ~6 frames of each outcome and each
 * fail card. A partial fail card is answered with "Try again"; a shutdown card
 * reboots and continues; a fatal card reboots at the checkpoint and answers
 * `correct` (so every run also exercises the reboot). Prints the final mode and
 * exits non-zero if the page logged any errors.
 * Requires Playwright + Chromium (preinstalled in Claude Code cloud sessions).
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const REASK = process.argv.includes('--reask');
const OUT = path.resolve(args[0] || 'playtest-out');
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + e.stack));
  pg.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await pg.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await pg.waitForTimeout(800);
  await pg.screenshot({ path: OUT + '/00-menu.png' });
  await pg.click('.level.playable [data-act="play"]');
  await pg.waitForTimeout(400);
  await pg.screenshot({ path: OUT + '/01-tutorial.png' });
  await pg.click('#tut-skip');
  const types = (args[1] || 'gap').split(',');
  const choices = (args[2] || 'correct').split(',');
  if (types[0] !== 'menu') {
    // deterministic course: exactly the given hazards, fixed spacing
    await pg.evaluate(({ types }) => {
      const L = game.level;
      L.obs = []; let x = 900;
      types.forEach((t, i) => { const ob = L.makeOb(t, x, i); L.obs.push(ob); x = ob.end + 1100; });
      L.exitX = x + 200; L.restartAt(0);
    }, { types });
  } else {
    console.log('course', (await pg.evaluate(() => game.level.obs.map(o => o.type))).join(','));
  }
  const waitMode = async (m, max = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < max) { const mode = await pg.evaluate(() => game.level.mode); if (m.includes(mode)) return mode; await pg.waitForTimeout(40); } return 'TIMEOUT'; };
  let n = 0, k = 0, fails = 0, forceCorrect = false, endMode = null;
  for (let i = 0; i < 60; i++) {
    const m = await waitMode(['decide', 'won', 'failed']);
    if (m === 'failed') {
      await pg.waitForTimeout(700);
      await pg.screenshot({ path: `${OUT}/d${n - 1}-fail.png` });
      const info = await pg.evaluate(() => { const f = game.level.failInfo || {}; return { fatal: !!f.fatal, shutdown: !!f.shutdown, energy: game.level.energy, kicker: document.getElementById('f-kicker').textContent, btn: document.getElementById('btn-retry').textContent }; });
      console.log('fail card', JSON.stringify(info));
      fails++;
      if (fails > 12) { endMode = 'failed (gave up)'; break; }
      // "Reboot at this hazard" (fatal), "Try again" (partial) or "Reboot at checkpoint" (shutdown)
      await pg.click('#btn-retry');
      forceCorrect = !REASK || info.fatal;
      if (info.fatal) {
        await pg.waitForTimeout(300);
        const r = await pg.evaluate(() => ({ energy: game.level.energy, mode: game.level.mode, damage: Object.keys(game.level.damage).length }));
        console.log('rebooted at checkpoint', JSON.stringify(r));
      } else if (info.shutdown) {
        await pg.waitForTimeout(300);
        const e = await pg.evaluate(() => game.level.energy);
        console.log('rebooted after shutdown, energy', e);
      } else {
        await pg.waitForTimeout(250);
        await pg.screenshot({ path: `${OUT}/d${n - 1}-rewind.png` });
      }
      continue;
    }
    if (m !== 'decide') { endMode = m; break; }
    await pg.waitForTimeout(1200);
    await pg.screenshot({ path: `${OUT}/d${n}-decide.png` });
    let choice;
    if (forceCorrect) { choice = 'correct'; forceCorrect = false; }
    else { choice = choices[Math.min(k, choices.length - 1)]; k++; }
    const info = await pg.evaluate(({ choice }) => {
      const d = game.level.decision; const st = d.st; let pick; let note = '';
      if (choice === 'plane' && st.kind !== 'movement') { choice = 'wrong'; note = ' (no plane option on a contraction question: used wrong)'; }
      const wrongs = st.kind === 'movement'
        ? [st.sagittalWrong].concat(d.options.filter(o => o !== st.correct && o !== st.sagittalWrong))
        : (st.options || ['Concentric', 'Eccentric', 'Isometric']).filter(o => o !== st.correct);
      if (choice === 'correct') pick = st.correct;
      else if (choice === 'wrong') pick = wrongs[0];
      else if (choice === 'wrong2') pick = wrongs[1];
      else if (choice === 'wrong3') pick = wrongs[2];
      else if (choice === 'plane') pick = d.options.find(o => o !== st.correct && o !== st.sagittalWrong);
      else pick = null;
      const tag = d.ob.type + ' stage ' + d.ob.stage + (d.reask ? ' (re-ask)' : '') + ' [' + d.options.join(' | ') + ']';
      if (choice !== 'timeout' && pick == null) { pick = wrongs[wrongs.length - 1]; note += ' (option missing: used last wrong)'; }
      if (pick == null) { d.timer = 0.01; return 'timeout / ' + tag + note; }
      game.level.choose(d.options.indexOf(pick)); return pick + ' / ' + tag + note;
    }, { choice });
    console.log('chose', info);
    for (let f = 0; f < 6; f++) { await pg.waitForTimeout(300); await pg.screenshot({ path: `${OUT}/d${n}-act${f}.png` }); }
    n++;
  }
  await pg.waitForTimeout(1800);
  await pg.screenshot({ path: `${OUT}/zz-end.png` });
  const fin = await pg.evaluate(() => ({ mode: game.level.mode, energy: game.level.energy, friendsSaved: game.level.stats.friendsSaved, partials: game.level.stats.partials, shutdowns: game.level.stats.shutdowns }));
  console.log('end mode', endMode || fin.mode);
  console.log('final', JSON.stringify(fin));
  console.log(errs.join('\n') || 'no errors');
  await b.close();
  if (errs.length) process.exit(1);
})();
