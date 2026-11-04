/*
 * tools/playtest.js: automated branch playtest (owned by the playtest-qa agent)
 *
 *   node tools/playtest.js <outDir> <hazards> <choices>
 *     hazards: comma list of gap,laser,crate,drop,zipline (course is built in that order)
 *     choices: comma list, one per decision: correct | wrong | wrong2 | plane | timeout
 *              (the last value repeats for remaining decisions)
 *
 *   e.g. node tools/playtest.js out gap,laser,crate,drop,zipline correct
 *        node tools/playtest.js out zipline correct,wrong2
 *
 * Saves a screenshot at each decision and ~6 frames of each outcome, prints the
 * final mode, and exits non-zero if the page logged any errors.
 * Requires Playwright + Chromium (preinstalled in Claude Code cloud sessions).
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const OUT = path.resolve(process.argv[2] || 'playtest-out');
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
  await pg.click('.level.playable');
  await pg.waitForTimeout(200);
  await pg.screenshot({ path: OUT + '/01-brief.png' });
  await pg.click('#btn-start');
  const types = (process.argv[3] || 'gap').split(',');
  const choices = (process.argv[4] || 'correct').split(',');
  await pg.evaluate(({ types }) => {
    const L = game.level;
    L.obs = []; let x = 900;
    types.forEach((t, i) => { const ob = L.makeOb(t, x, i); L.obs.push(ob); x = ob.end + 1100; });
    L.exitX = x + 200; L.restartAt(0);
  }, { types });
  const waitMode = async (m, max = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < max) { const mode = await pg.evaluate(() => game.level.mode); if (m.includes(mode)) return mode; await pg.waitForTimeout(40); } return 'TIMEOUT'; };
  let n = 0;
  for (let i = 0; i < 8; i++) {
    const m = await waitMode(['decide', 'won', 'failed']);
    if (m !== 'decide') { console.log('end mode', m); break; }
    await pg.waitForTimeout(1200);
    await pg.screenshot({ path: `${OUT}/d${n}-decide.png` });
    const choice = choices[Math.min(n, choices.length - 1)];
    const info = await pg.evaluate(({ choice }) => {
      const d = game.level.decision; const st = d.st; let pick;
      if (choice === 'correct') pick = st.correct;
      else if (choice === 'wrong') pick = st.kind === 'movement' ? st.sagittalWrong : d.options.find(o => o !== st.correct);
      else if (choice === 'wrong2') pick = d.options.filter(o => o !== st.correct).pop();
      else if (choice === 'plane') pick = d.options.find(o => o !== st.correct && o !== st.sagittalWrong);
      else pick = null;
      const tag = d.ob.type + ' stage ' + d.ob.stage;
      if (pick == null) { d.timer = 0.01; return 'timeout / ' + tag; }
      game.level.choose(d.options.indexOf(pick)); return pick + ' / ' + tag;
    }, { choice });
    console.log('chose', info);
    for (let k = 0; k < 6; k++) { await pg.waitForTimeout(300); await pg.screenshot({ path: `${OUT}/d${n}-act${k}.png` }); }
    n++;
  }
  await pg.waitForTimeout(1800);
  await pg.screenshot({ path: `${OUT}/zz-end.png` });
  console.log('final mode', await pg.evaluate(() => game.level.mode));
  console.log(errs.join('\n') || 'no errors');
  await b.close();
  if (errs.length) process.exit(1);
})();
