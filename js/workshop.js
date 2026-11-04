/*
 * workshop.js: Drone Defense workshop (exam terminal, upgrade bay, loadout)
 * plus the Drone Defense save system. GAME_DESIGN §4.6, §4.10, §4.13.
 *
 * Load AFTER js/content.js (and js/effects.js + js/drones.js for sound and
 * drone icons; both are optional and guarded). Plain script, works from file://.
 *
 *   SEHS.DroneSave.load()            -> save object (normalised; unknown ids dropped)
 *   SEHS.DroneSave.save(s)           -> true if written to localStorage
 *   SEHS.DroneSave.reset(opts)       -> fresh save (opts.keepLearning keeps the
 *                                       Fault Log, Calibration, seenAt, stats)
 *   SEHS.DroneSave.persistent        -> false when storage is unavailable
 *
 *   SEHS.Workshop.open(rootEl, { save, wave, intel, title, reduce, onDone })
 *       -> handle { close(), el, debug }. onDone(save) fires on LAUNCH.
 *   SEHS.Workshop.effects(save)      -> merged fx object (active loadout +
 *                                       Calibration bonuses), read by the level
 *   SEHS.Workshop.powerBudget(save) / powerUsed(save) / calibration(save)
 *   SEHS.Workshop.onWaveCleared(save, n), addFault(save, idOrTopicOrIds), addScrap
 *
 * Fault Log spacing (§4.6b, revised 2026-11-04). Spacing runs on its own clock,
 * `svisit`, which advances only on a workshop visit that follows a newly
 * cleared wave (save.lifetime.waves went up). A "Workshop first" visit before
 * retrying a failed wave is a RETRY visit: it can still serve due faults, but
 * it never advances the clock, so failing a wave cannot compress the spacing
 * (box 1/2/3 = due after 1/2/4 counted visits). Rule chosen for clearing: a
 * fault clears only if at least 2 waves have been CLEARED since it was logged
 * (fault.aw = lifetime.waves when added). A correct box-3 answer before that
 * keeps it at box 3, due on the next counted visit. (Calendar-day rule not
 * used: classes replay on the same day and clocks on shared Chromebooks drift.)
 * open() takes opts.retry (true/false) to override the automatic detection.
 *
 * OVERCLOCK (§4.6a, revised): the toggle unlocks once ANY topic's Calibration
 * is >= 60%; when on, it applies only to items whose topic is >= 60% (snapshot
 * taken when the visit opens). Other items run untimed at normal scrap and say
 * why. The toggle's title + a small caption explain the lock.
 *   SEHS.Workshop.debug.answer(true|false|index), next(), tab(name), buy(id),
 *       toggle(id), setLevel(id, l), overclock(on), grant(scrap), launch(), state()
 *
 * Curriculum text (stems, options, upgrade names, UI strings) comes only from
 * SEHS.content. Numbers (costs, power, effects) are engine-owned (§4.6d).
 */
(function () {
  'use strict';
  const SEHS = (window.SEHS = window.SEHS || {});
  const C = () => SEHS.content || {};
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const fmt = (s, o) => String(s == null ? '' : s).replace(/\{(\w+)\}/g, (m, k) => (o && o[k] != null ? o[k] : m));

  // ---------------------------------------------------------------------------
  // Upgrade table (GAME_DESIGN §4.6d). Effects are ABSOLUTE values per level
  // (not cumulative). Every number below is taken from the spec. The only
  // invented key is `allyEarly` (allyUplink L3 "newcomers arrive one wave
  // earlier"): 1 = newcomers arrive one wave earlier, default 0.
  // Categories (UI grouping only): strike / core / crew.
  // ---------------------------------------------------------------------------
  const DEFAULT_FX = {
    freezeBonus: 0, sweepArc: 60, spinDmg: 2, pulseDmg: 1, pulseRadius: 60, swatDmg: 1, swatKnock: 40,
    windupMul: 1, discDmg: 2, discPierce: 0, backhandReach: 0, netCutWindow: 8, turnRate: 1,
    allySlots: 4, allyEarly: 0, maxEnergy: 5, medicHealEvery: 60, repairMul: 1, turretDmg: 1,
    turretRate: 2.5, earlyWarning: 0, comboKeep: 3,
  };
  const MAX_ENERGY_CAP = 8;
  const lv = (cost, power, effect) => ({ cost, power, effect });
  const UPGRADE_DEFS = [
    { id: 'pecMajorActuator', cat: 'strike', levels: [lv(60, 1, { swatDmg: 2, swatKnock: 70 }), lv(130, 2, { swatDmg: 3, swatKnock: 100 }), lv(220, 3, { swatDmg: 4, swatKnock: 130 })] },
    { id: 'rearDeltGuard', cat: 'strike', levels: [lv(40, 1, { backhandReach: 20, netCutWindow: 10 }), lv(90, 2, { backhandReach: 35, netCutWindow: 12 }), lv(160, 3, { backhandReach: 50, netCutWindow: 14 })] },
    { id: 'obliqueDrive', cat: 'strike', levels: [lv(60, 1, { sweepArc: 80, spinDmg: 2 }), lv(130, 2, { sweepArc: 100, spinDmg: 3 }), lv(220, 3, { sweepArc: 120, spinDmg: 3 })] },
    { id: 'pronatorCoil', cat: 'strike', levels: [lv(40, 1, { pulseDmg: 2, pulseRadius: 75 }), lv(90, 2, { pulseDmg: 3, pulseRadius: 90 }), lv(160, 3, { pulseDmg: 4, pulseRadius: 105 })] },
    { id: 'infraspinatusSpring', cat: 'strike', levels: [lv(40, 1, { windupMul: 0.8 }), lv(90, 2, { windupMul: 0.65 }), lv(160, 3, { windupMul: 0.5 })] },
    { id: 'subscapularisLauncher', cat: 'strike', levels: [lv(60, 1, { discDmg: 3, discPierce: 0 }), lv(130, 2, { discDmg: 4, discPierce: 1 }), lv(220, 3, { discDmg: 5, discPierce: 2 })] },
    { id: 'rotatorCuffServos', cat: 'core', levels: [lv(80, 2, { freezeBonus: 1 }), lv(160, 3, { freezeBonus: 2 }), lv(260, 4, { freezeBonus: 3 })] },
    { id: 'glutePivot', cat: 'core', levels: [lv(40, 1, { turnRate: 1.25 }), lv(90, 2, { turnRate: 1.5 }), lv(160, 3, { turnRate: 1.8 })] },
    { id: 'reinforcedFrame', cat: 'core', levels: [lv(100, 2, { maxEnergy: 6 }), lv(200, 3, { maxEnergy: 7 }), lv(320, 4, { maxEnergy: 8 })] },
    { id: 'spindleSensors', cat: 'core', levels: [lv(40, 1, { earlyWarning: 60 }), lv(90, 2, { earlyWarning: 120 }), lv(160, 3, { earlyWarning: 180 })] },
    { id: 'tendonCapacitor', cat: 'core', levels: [lv(40, 1, { comboKeep: 4.5 }), lv(90, 2, { comboKeep: 6 }), lv(160, 3, { comboKeep: 8 })] },
    { id: 'allyUplink', cat: 'crew', levels: [lv(100, 2, { allySlots: 5 }), lv(200, 3, { allySlots: 6 }), lv(320, 4, { allySlots: 6, allyEarly: 1 })] },
    { id: 'medicProtocol', cat: 'crew', levels: [lv(60, 1, { medicHealEvery: 45 }), lv(130, 2, { medicHealEvery: 35 }), lv(220, 3, { medicHealEvery: 25 })] },
    { id: 'mechanicTorque', cat: 'crew', levels: [lv(60, 1, { repairMul: 1.15 }), lv(130, 2, { repairMul: 1.3 }), lv(220, 3, { repairMul: 1.45 })] },
    { id: 'engineerTurret', cat: 'crew', levels: [lv(60, 1, { turretDmg: 1, turretRate: 2.0 }), lv(130, 2, { turretDmg: 2, turretRate: 1.6 }), lv(220, 3, { turretDmg: 2, turretRate: 1.2 })] },
  ];
  const DEF = {};
  UPGRADE_DEFS.forEach((d) => { DEF[d.id] = d; });
  (function assertIds() {
    const t = C().UPGRADE_TEXT;
    if (!t || typeof console === 'undefined') return;
    const a = Object.keys(t).sort().join(','), b = Object.keys(DEF).sort().join(',');
    if (a !== b) console.warn('[workshop] UPGRADE_TEXT ids differ from engine ids', a, b);
  })();
  const CATS = [
    { id: 'strike', label: 'STRIKE SYSTEMS' },
    { id: 'core', label: 'CORE FRAME' },
    { id: 'crew', label: 'CREW SUPPORT' },
  ];
  // Effect labels for the upgrade cards (UI text, not curriculum).
  const FX_LABEL = {
    freezeBonus: ['Freeze timer', (v) => '+' + v + ' s'],
    sweepArc: ['Spin sweep', (v) => v + '°'],
    spinDmg: ['Spin damage', (v) => v],
    pulseDmg: ['Palm pulse damage', (v) => v],
    pulseRadius: ['Pulse radius', (v) => v + ' px'],
    swatDmg: ['Swat damage', (v) => v],
    swatKnock: ['Knockback', (v) => v + ' px'],
    windupMul: ['Disc wind-up', (v) => '×' + v],
    discDmg: ['Disc damage', (v) => v],
    discPierce: ['Disc pierce', (v) => v],
    backhandReach: ['Backhand reach', (v) => '+' + v + ' px'],
    netCutWindow: ['Rescue window', (v) => v + ' s'],
    turnRate: ['Turn rate', (v) => '×' + v],
    allySlots: ['Ally slots', (v) => v],
    allyEarly: ['Newcomers early', (v) => (v ? 'yes' : 'no')],
    maxEnergy: ['Energy cells', (v) => v],
    medicHealEvery: ['Medic heal', (v) => 'every ' + v + ' s'],
    repairMul: ['Repair speed', (v) => '×' + v],
    turretDmg: ['Turret damage', (v) => v],
    turretRate: ['Turret fires', (v) => 'every ' + v + ' s'],
    earlyWarning: ['Early warning', (v) => '+' + v + ' px'],
    comboKeep: ['Combo hold', (v) => v + ' s'],
  };

  // Terminal rules (§4.6a / §4.6b)
  const RULES = {
    perVisit: 6, maxFaultsPerVisit: 2, scrapByDiff: { 1: 10, 2: 18, 3: 30 }, streakStep: 0.2, streakCap: 5,
    faultClearBonus: 25, overclockMul: 1.5, overclockSecs: 25, overclockCal: 0.6, faultClearWaves: 2, seenCooldown: 8, calibWindow: 10,
    calibFull: 5, optimisedAt: 0.8, budgetCap: 14, faultDueByBox: { 1: 1, 2: 2, 3: 4 }, logCap: 500,
  };
  const topics = () => Object.keys(C().MCQ_TOPICS || {});
  const bank = () => C().MCQ_BANK || [];
  const bankById = () => { const m = {}; bank().forEach((q) => { m[q.id] = q; }); return m; };

  // ---------------------------------------------------------------------------
  // SAVE (§4.10). Every storage call is wrapped; on failure the game runs from
  // an in-memory copy and `persistent` turns false ("progress not saved").
  // ---------------------------------------------------------------------------
  const KEY = 'kinetic-escape-drone-v1';
  let memCopy = null;
  function fresh() {
    return {
      v: 1,
      wave: 1,                  // next wave to play
      bestWave: 0,              // all-time highest wave cleared (record; survives New defense)
      highestWaveCleared: 0,    // this defense run (drives the POWER BUDGET)
      scrap: 0,
      streak: 0,                // terminal streak, persists across visits until a wrong answer
      upgrades: {},             // id -> owned level 1..3
      loadout: {},              // id -> active level 1..owned
      faultLog: [],             // [{ id, box 1..3, due: svisit, added: svisit, last: svisit, aw: lifetime.waves when added }]
      visit: 0,                 // workshop visits (incremented on every open; seenAt cooldown)
      svisit: 0,                // spacing clock: counted visits only (after a newly cleared wave)
      svisitWaves: 0,           // lifetime.waves at the last counted visit
      seenAt: {},               // mcqId -> visit last answered
      attempts: {},             // mcqId -> times answered (lifetime)
      calib: {},                // topic -> [1,0,...] last 10 terminal answers
      reaskQueue: [],
      threatStats: {},
      lifetime: { waves: 0, rescues: 0, wardens: 0, playMs: 0, mcqAnswered: 0, mcqCorrect: 0, scrapEarned: 0, faultsCleared: 0 },
      log: [],                  // [{ t, visit, wave, source:'mcq', id, topic, difficulty, choice, correct, rtMs, attempt, fault, overclock }]
    };
  }
  function isObj(o) { return o && typeof o === 'object' && !Array.isArray(o); }
  function num(v, d) { return typeof v === 'number' && isFinite(v) ? v : d; }
  function normalize(raw) {
    const s = fresh();
    if (!isObj(raw)) return s;
    const byId = bankById(), hasBank = bank().length > 0;
    const okQ = (id) => !hasBank || !!byId[id];
    s.wave = Math.max(1, num(raw.wave, 1) | 0);
    s.bestWave = Math.max(0, num(raw.bestWave, 0) | 0);
    s.highestWaveCleared = Math.max(0, num(raw.highestWaveCleared, 0) | 0);
    s.scrap = Math.max(0, Math.round(num(raw.scrap, 0)));
    s.streak = Math.max(0, num(raw.streak, 0) | 0);
    s.visit = Math.max(0, num(raw.visit, 0) | 0);
    // older saves kept fault due dates in raw visits: start the clock there
    s.svisit = Math.max(0, num(raw.svisit, s.visit) | 0);
    if (isObj(raw.upgrades)) for (const id in raw.upgrades) if (DEF[id]) { const l = clamp(num(raw.upgrades[id], 0) | 0, 0, 3); if (l) s.upgrades[id] = l; }
    if (isObj(raw.loadout)) for (const id in raw.loadout) if (s.upgrades[id]) { const l = clamp(num(raw.loadout[id], 0) | 0, 0, s.upgrades[id]); if (l) s.loadout[id] = l; }
    if (Array.isArray(raw.faultLog)) {
      const seen = {};
      raw.faultLog.forEach((f) => {
        if (!isObj(f) || typeof f.id !== 'string' || !okQ(f.id) || seen[f.id]) return;
        seen[f.id] = 1;
        s.faultLog.push({ id: f.id, box: clamp(num(f.box, 1) | 0, 1, 3), due: num(f.due, s.svisit + 1) | 0, added: num(f.added, 0) | 0, last: num(f.last, 0) | 0, aw: num(f.aw, -99) | 0 });
      });
    }
    if (isObj(raw.seenAt)) for (const id in raw.seenAt) if (okQ(id)) s.seenAt[id] = num(raw.seenAt[id], 0) | 0;
    if (isObj(raw.attempts)) for (const id in raw.attempts) if (okQ(id)) s.attempts[id] = num(raw.attempts[id], 0) | 0;
    const tp = topics();
    if (isObj(raw.calib)) for (const t in raw.calib) {
      if (tp.length && tp.indexOf(t) < 0) continue;
      if (Array.isArray(raw.calib[t])) s.calib[t] = raw.calib[t].map((x) => (x ? 1 : 0)).slice(-RULES.calibWindow);
    }
    if (Array.isArray(raw.reaskQueue)) s.reaskQueue = raw.reaskQueue.filter((x) => typeof x === 'string');
    if (isObj(raw.threatStats)) s.threatStats = raw.threatStats;
    if (isObj(raw.lifetime)) for (const k in s.lifetime) s.lifetime[k] = num(raw.lifetime[k], 0);
    s.svisitWaves = Math.max(0, num(raw.svisitWaves, s.lifetime.waves) | 0);
    if (Array.isArray(raw.log)) s.log = raw.log.filter(isObj).slice(-RULES.logCap);
    return s;
  }
  function storage() {
    try {
      const ls = window.localStorage;
      if (!ls) return null;
      const k = '__ke_probe';
      ls.setItem(k, '1'); ls.removeItem(k);
      return ls;
    } catch (e) { return null; }
  }
  const DroneSave = {
    KEY,
    persistent: true,
    fresh,
    normalize,
    load() {
      let raw = memCopy;
      try {
        const ls = storage();
        DroneSave.persistent = !!ls;
        if (ls) raw = ls.getItem(KEY) || memCopy;
      } catch (e) { DroneSave.persistent = false; }
      let obj = null;
      try { obj = raw ? JSON.parse(raw) : null; } catch (e) { obj = null; }
      return normalize(obj);
    },
    save(s) {
      if (!s) return false;
      let json;
      try { s.savedAt = Date.now(); json = JSON.stringify(s); } catch (e) { return false; }
      memCopy = json;
      try {
        const ls = storage();
        if (!ls) { DroneSave.persistent = false; return false; }
        ls.setItem(KEY, json);
        DroneSave.persistent = true;
        return true;
      } catch (e) { DroneSave.persistent = false; return false; }
    },
    // reset() = Reset all. reset({ keepLearning: true }) = New defense:
    // wave, scrap, upgrades, loadout and this run's waves reset; the Fault Log,
    // Calibration, seenAt, threatStats, best wave and stats are kept.
    reset(opts) {
      const n = fresh();
      if (opts && opts.keepLearning) {
        const old = DroneSave.load();
        ['bestWave', 'faultLog', 'visit', 'svisit', 'svisitWaves', 'seenAt', 'attempts', 'calib', 'threatStats', 'lifetime', 'log'].forEach((k) => { n[k] = old[k]; });
      }
      DroneSave.save(n);
      return n;
    },
  };

  // ---------------------------------------------------------------------------
  // MODEL: calibration, power, effects
  // ---------------------------------------------------------------------------
  function calibration(save) {
    const out = {};
    topics().forEach((t) => {
      const a = ((save && save.calib && save.calib[t]) || []).slice(-RULES.calibWindow);
      const n = a.length;
      out[t] = n ? r3((a.reduce((x, y) => x + y, 0) / n) * Math.min(1, n / RULES.calibFull)) : 0;
    });
    return out;
  }
  function optimised(save) {
    const cal = calibration(save), ks = Object.keys(cal);
    return ks.length > 0 && ks.every((k) => cal[k] >= RULES.optimisedAt);
  }
  function baseBudget(save) { return Math.min(RULES.budgetCap, 4 + Math.floor(0.75 * ((save && save.highestWaveCleared) | 0))); }
  function powerBudget(save) { return baseBudget(save) + (optimised(save) ? 1 : 0); }
  function powerOf(id, l) { const d = DEF[id]; return d && l > 0 ? d.levels[l - 1].power : 0; }
  function powerUsed(save) {
    let u = 0;
    const lo = (save && save.loadout) || {};
    for (const id in lo) u += powerOf(id, lo[id] | 0);
    return u;
  }
  function power(save) {
    const used = powerUsed(save), budget = powerBudget(save);
    return { used, budget, base: baseBudget(save), optimised: optimised(save), over: used > budget };
  }
  // The merged effect object the level reads. Upgrade keys are the §4.6d keys
  // (absolute values). Calibration bonuses (§4.6e) are folded into the time /
  // rate keys directly; damage-style bonuses are separate multipliers:
  //   freezeBonus += 1.0·cal(planes_axes)            (seconds)
  //   dmgMul       = 1 + 0.3·cal(joint_actions)       (swat, backhand, disc, spin)
  //   pullMul      = 1 − 0.3·cal(contractions)        (tether pull, Ram shove)
  //   holdMul      = 0.7 if cal(contractions) ≥ 0.8   (success hold duration)
  //   comboKeep   ×= 1 + 0.5·cal(agonist_antagonist); overdriveTime = 4 + 2·cal
  //   critChance   = 0.2·cal(muscle_actions)          (×2 damage)
  //   repairMul   ×= 1 + 0.2·cal(joints_levers); turretRate /= 1 + 0.2·cal (s per shot)
  function effects(save) {
    const fx = Object.assign({}, DEFAULT_FX);
    const lo = (save && save.loadout) || {};
    UPGRADE_DEFS.forEach((d) => {
      const l = Math.min(lo[d.id] | 0, ((save && save.upgrades) || {})[d.id] | 0);
      if (l > 0) Object.assign(fx, d.levels[l - 1].effect);
    });
    fx.maxEnergy = Math.min(MAX_ENERGY_CAP, fx.maxEnergy);
    const cal = calibration(save);
    const g = (t) => cal[t] || 0;
    fx.upgradeFreezeBonus = fx.freezeBonus;
    fx.freezeBonus = r3(fx.freezeBonus + 1.0 * g('planes_axes'));
    fx.dmgMul = r3(1 + 0.3 * g('joint_actions'));
    fx.pullMul = r3(1 - 0.3 * g('contractions'));
    fx.holdMul = g('contractions') >= 0.8 ? 0.7 : 1;
    fx.comboKeep = r3(fx.comboKeep * (1 + 0.5 * g('agonist_antagonist')));
    fx.overdriveTime = r3(4 + 2 * g('agonist_antagonist'));
    fx.critChance = r3(0.2 * g('muscle_actions'));
    fx.repairMul = r3(fx.repairMul * (1 + 0.2 * g('joints_levers')));
    fx.turretRate = r3(fx.turretRate / (1 + 0.2 * g('joints_levers')));
    fx.calib = cal;
    fx.power = power(save);
    return fx;
  }
  function calibBonusText(t, c) {
    const pct = (v) => Math.round(v * 100) + '%';
    switch (t) {
      case 'planes_axes': return '+' + c.toFixed(1) + ' s freeze timer';
      case 'joint_actions': return '×' + (1 + 0.3 * c).toFixed(2) + ' strike damage';
      case 'contractions': return '−' + pct(0.3 * c) + ' pull and shove' + (c >= 0.8 ? ', faster holds' : '');
      case 'agonist_antagonist': return '×' + (1 + 0.5 * c).toFixed(2) + ' combo time, OVERDRIVE ' + (4 + 2 * c).toFixed(1) + ' s';
      case 'muscle_actions': return pct(0.2 * c) + ' crit chance';
      case 'joints_levers': return '×' + (1 + 0.2 * c).toFixed(2) + ' repair and turret';
      default: return '';
    }
  }
  function calibInfo(save) {
    const cal = calibration(save), T = C().MCQ_TOPICS || {};
    const links = ((C().DRONE_UI || {}).workshop || {}).calibLinks || {};
    return topics().map((t) => ({
      topic: t, name: T[t] || t, cal: cal[t], pct: Math.round(cal[t] * 100),
      attempts: ((save.calib || {})[t] || []).length, link: links[t] || '', bonus: calibBonusText(t, cal[t]),
    }));
  }

  // ---------------------------------------------------------------------------
  // MODEL: question picker (§4.6a)
  // ---------------------------------------------------------------------------
  function diffBand(wave) { return wave <= 2 ? [1, 2] : wave <= 6 ? [1, 2, 3] : [2, 3]; }
  function shuffle(a, rng) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  // Presented copy: options shuffled unless fixedOrder; answer and whyWrong remapped.
  function present(q, rng, fault) {
    rng = rng || Math.random;
    const order = q.fixedOrder ? [0, 1, 2, 3] : shuffle([0, 1, 2, 3], rng);
    return {
      id: q.id, q, order, fault: fault || null,
      options: order.map((i) => q.options[i]),
      answer: order.indexOf(q.answer),
      whyWrong: order.map((i) => (q.whyWrong || [])[i] || null),
    };
  }
  // ctx: { wave, used: Set, faultsTaken, rng }. Returns a presented item or null.
  function pickNext(save, ctx) {
    const rng = ctx.rng || Math.random;
    const byId = bankById();
    const used = ctx.used || (ctx.used = new Set());
    // 1. due Fault Log items (max 2 per visit), most overdue first
    if ((ctx.faultsTaken | 0) < RULES.maxFaultsPerVisit) {
      const due = save.faultLog.filter((f) => f.due <= save.svisit && byId[f.id] && !used.has(f.id))
        .sort((a, b) => a.due - b.due || a.box - b.box);
      if (due.length) {
        ctx.faultsTaken = (ctx.faultsTaken | 0) + 1;
        used.add(due[0].id);
        return present(byId[due[0].id], rng, due[0]);
      }
    }
    // 2. new items: 50% from the weakest topic, the rest weighted toward weak topics
    const inLog = {};
    save.faultLog.forEach((f) => { inLog[f.id] = 1; });
    const band = diffBand(ctx.wave || save.wave || 1);
    const cal = calibration(save);
    const tp = topics();
    let topic = null;
    if (tp.length) {
      if (rng() < 0.5) {
        const min = Math.min.apply(null, tp.map((t) => cal[t]));
        const weakest = tp.filter((t) => cal[t] === min);
        topic = weakest[Math.floor(rng() * weakest.length)];
      } else {
        const w = tp.map((t) => 1.25 - cal[t]);
        let x = rng() * w.reduce((a, b) => a + b, 0);
        topic = tp[tp.length - 1];
        for (let i = 0; i < tp.length; i++) { x -= w[i]; if (x <= 0) { topic = tp[i]; break; } }
      }
    }
    const free = bank().filter((q) => !used.has(q.id) && !inLog[q.id]);
    const unseen = (q) => save.seenAt[q.id] == null;
    const cooled = (q) => save.seenAt[q.id] != null && save.visit - save.seenAt[q.id] >= RULES.seenCooldown;
    const inBand = (q) => band.indexOf(q.difficulty) >= 0;
    const tiers = [
      (q) => unseen(q) && inBand(q), (q) => cooled(q) && inBand(q), (q) => unseen(q), (q) => cooled(q),
    ];
    const tryPool = (pool) => {
      for (const f of tiers) {
        const c = pool.filter(f);
        if (c.length) return c[Math.floor(rng() * c.length)];
      }
      return null;
    };
    let q = (topic && tryPool(free.filter((x) => x.topic === topic))) || tryPool(free);
    if (!q) {
      // pool ran dry: oldest-seen first (fault-log items allowed as a last resort)
      const rest = bank().filter((x) => !used.has(x.id)).sort((a, b) => (save.seenAt[a.id] || 0) - (save.seenAt[b.id] || 0));
      q = rest.find((x) => !inLog[x.id]) || rest[0] || null;
    }
    if (!q) return null;
    used.add(q.id);
    return present(q, rng, null);
  }
  function pickQuestions(save, wave, n, rng) {
    const ctx = { wave, used: new Set(), faultsTaken: 0, rng };
    const out = [];
    for (let i = 0; i < (n || RULES.perVisit); i++) { const it = pickNext(save, ctx); if (!it) break; out.push(it); }
    return out;
  }

  // ---------------------------------------------------------------------------
  // MODEL: answering, scrap, Fault Log (§4.6a / §4.6b)
  // Streak multiplier = 1 + 0.2·min(streak, 5) using the streak BEFORE this
  // answer (1st correct ×1.0, 2nd ×1.2 … 6th+ ×2.0). Wrong resets the streak.
  // ---------------------------------------------------------------------------
  function streakMul(streak) { return r3(1 + RULES.streakStep * Math.min(streak | 0, RULES.streakCap)); }
  function scrapFor(difficulty, streak, overclock) {
    return Math.round((RULES.scrapByDiff[difficulty] || 10) * streakMul(streak) * (overclock ? RULES.overclockMul : 1));
  }
  // chosen = presented option index (0..3) or -1 for a timeout.
  function answerItem(save, item, chosen, ctx) {
    ctx = ctx || {};
    const q = item.q;
    const correct = chosen === item.answer;
    const res = { id: q.id, topic: q.topic, difficulty: q.difficulty, correct, chosen, answer: item.answer, timeout: chosen < 0,
      scrap: 0, base: 0, mult: 1, streak: 0, faultAdded: false, faultCleared: false, faultBox: 0, faultDue: 0 };
    if (correct) {
      res.mult = streakMul(save.streak);
      res.base = scrapFor(q.difficulty, save.streak, ctx.overclock);
      res.scrap = res.base;
      save.streak += 1;
    } else {
      save.streak = 0;
    }
    res.streak = save.streak;
    // Fault Log
    const fi = save.faultLog.findIndex((f) => f.id === q.id);
    if (fi >= 0) {
      const f = save.faultLog[fi];
      f.last = save.svisit;
      if (correct) {
        const waited = (save.lifetime.waves | 0) - (f.aw | 0);
        if (f.box >= 3 && waited >= RULES.faultClearWaves) {
          save.faultLog.splice(fi, 1);
          res.faultCleared = true;
          res.scrap += RULES.faultClearBonus;
          save.lifetime.faultsCleared += 1;
        } else if (f.box >= 3) {
          // right, but too soon after it was logged: hold at box 3 (§4.6b revised)
          f.due = save.svisit + 1;
          res.faultBox = 3; res.faultDue = f.due; res.faultHeld = RULES.faultClearWaves - waited;
        } else {
          f.box += 1;
          f.due = save.svisit + RULES.faultDueByBox[f.box];
          res.faultBox = f.box; res.faultDue = f.due;
        }
      } else {
        f.box = 1; f.due = save.svisit + RULES.faultDueByBox[1];
        res.faultBox = 1; res.faultDue = f.due;
      }
    } else if (!correct) {
      save.faultLog.push({ id: q.id, box: 1, due: save.svisit + RULES.faultDueByBox[1], added: save.svisit, last: save.svisit, aw: save.lifetime.waves | 0 });
      res.faultAdded = true; res.faultBox = 1; res.faultDue = save.svisit + 1;
    }
    save.scrap += res.scrap;
    save.lifetime.scrapEarned += res.scrap;
    save.lifetime.mcqAnswered += 1;
    if (correct) save.lifetime.mcqCorrect += 1;
    save.seenAt[q.id] = save.visit;
    save.attempts[q.id] = (save.attempts[q.id] | 0) + 1;
    const arr = save.calib[q.topic] || (save.calib[q.topic] = []);
    arr.push(correct ? 1 : 0);
    while (arr.length > RULES.calibWindow) arr.shift();
    save.log.push({ t: Date.now(), visit: save.visit, wave: ctx.wave || save.wave, source: 'mcq', id: q.id, topic: q.topic,
      difficulty: q.difficulty, choice: chosen >= 0 ? item.order[chosen] : -1, correct, result: correct ? 'correct' : chosen < 0 ? 'timeout' : 'wrong',
      rtMs: Math.round(ctx.rtMs || 0), attempt: save.attempts[q.id], fault: item.fault ? 1 : 0, overclock: !!ctx.overclock });
    while (save.log.length > RULES.logCap) save.log.shift();
    return res;
  }
  // Wrong freeze answers in waves add a fault (§4.6b). idOrTopic: an MCQ id
  // (used directly), an array of MCQ ids (e.g. the items whose `action` tag
  // matches the missed action: one not already logged is picked), or a topic.
  function addFault(save, idOrTopic, rng) {
    rng = rng || Math.random;
    const byId = bankById();
    if (Array.isArray(idOrTopic)) {
      const ok = idOrTopic.filter((x) => typeof x === 'string' && byId[x]);
      if (!ok.length) return null;
      const fresh1 = ok.filter((x) => !save.faultLog.some((f) => f.id === x));
      const pool = fresh1.length ? fresh1 : ok;
      idOrTopic = pool[Math.floor(rng() * pool.length)];
    }
    let id = byId[idOrTopic] ? idOrTopic : null;
    if (!id) {
      const inLog = {};
      save.faultLog.forEach((f) => { inLog[f.id] = 1; });
      const c = bank().filter((q) => q.topic === idOrTopic && !inLog[q.id]);
      if (!c.length) return null;
      id = c[Math.floor(rng() * c.length)].id;
    }
    const ex = save.faultLog.find((f) => f.id === id);
    if (ex) { ex.box = 1; ex.due = save.svisit + 1; return ex; }
    const f = { id, box: 1, due: save.svisit + 1, added: save.svisit, last: save.svisit, aw: (save.lifetime && save.lifetime.waves) | 0 };
    save.faultLog.push(f);
    return f;
  }
  function addScrap(save, n) { save.scrap = Math.max(0, save.scrap + Math.round(n)); save.lifetime.scrapEarned += Math.max(0, Math.round(n)); return save.scrap; }
  // Call when a wave is cleared (flat +20 scrap, §4.6a). Returns { newRecord }.
  function onWaveCleared(save, n) {
    const newRecord = n > save.bestWave;
    save.highestWaveCleared = Math.max(save.highestWaveCleared, n);
    save.bestWave = Math.max(save.bestWave, n);
    save.wave = n + 1;
    save.lifetime.waves += 1;
    addScrap(save, 20);
    return { newRecord };
  }

  // ---------------------------------------------------------------------------
  // MODEL: buying and loadout
  // ---------------------------------------------------------------------------
  function fits(save, id, l) { return powerUsed(save) - powerOf(id, save.loadout[id] | 0) + powerOf(id, l) <= powerBudget(save); }
  function buy(save, id) {
    const d = DEF[id];
    if (!d) return { ok: false, reason: 'unknown' };
    const l = save.upgrades[id] | 0;
    if (l >= 3) return { ok: false, reason: 'max' };
    const cost = d.levels[l].cost;
    if (save.scrap < cost) return { ok: false, reason: 'scrap', cost };
    save.scrap -= cost;
    save.upgrades[id] = l + 1;
    // auto-slot a new build / bump a slotted one when the budget allows
    let slotted = false;
    if (fits(save, id, l + 1) && (!save.loadout[id] || save.loadout[id] === l)) { save.loadout[id] = l + 1; slotted = true; }
    return { ok: true, id, level: l + 1, cost, slotted };
  }
  function setLevel(save, id, l) {
    const own = save.upgrades[id] | 0;
    if (!DEF[id] || !own) return { ok: false, reason: 'notOwned' };
    l = clamp(l | 0, 0, own);
    if (!l) { delete save.loadout[id]; return { ok: true, id, level: 0 }; }
    if (!fits(save, id, l)) return { ok: false, reason: 'power' };
    save.loadout[id] = l;
    return { ok: true, id, level: l };
  }
  function toggle(save, id) {
    if (save.loadout[id]) return setLevel(save, id, 0);
    const own = save.upgrades[id] | 0;
    if (!own) return { ok: false, reason: 'notOwned' };
    for (let l = own; l >= 1; l--) if (fits(save, id, l)) return setLevel(save, id, l);
    return { ok: false, reason: 'power' };
  }
  function upgradeText(id) {
    const t = (C().UPGRADE_TEXT || {})[id] || {};
    return { name: t.name || id, muscle: t.muscle || '', desc: t.desc || '' };
  }

  // ---------------------------------------------------------------------------
  // UI helpers
  // ---------------------------------------------------------------------------
  function h(tag, attrs, kids) {
    const el = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v; // static, engine-authored markup only
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (k === 'style') el.setAttribute('style', v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    (kids || []).forEach((c) => { if (c != null && c !== false) el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c); });
    return el;
  }
  function snd(name, arg) {
    try {
      // No sound before the first user gesture (browsers block AudioContext then).
      const ua = navigator.userActivation;
      if (ua && !ua.hasBeenActive) return null;
      const A = SEHS.Audio; if (A && typeof A[name] === 'function') return A[name](arg); } catch (e) { /* audio is optional */ }
    return null;
  }
  const GEAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M10.3 1.5h3.4l.5 2.6c.7.2 1.3.5 1.9.9l2.3-1.4 2.4 2.4-1.4 2.3c.4.6.7 1.2.9 1.9l2.6.5v3.4l-2.6.5c-.2.7-.5 1.3-.9 1.9l1.4 2.3-2.4 2.4-2.3-1.4c-.6.4-1.2.7-1.9.9l-.5 2.6h-3.4l-.5-2.6c-.7-.2-1.3-.5-1.9-.9l-2.3 1.4-2.4-2.4 1.4-2.3c-.4-.6-.7-1.2-.9-1.9l-2.6-.5v-3.4l2.6-.5c.2-.7.5-1.3.9-1.9L3.2 6l2.4-2.4 2.3 1.4c.6-.4 1.2-.7 1.9-.9zM12 8a4 4 0 100 8 4 4 0 000-8z"/></svg>';
  const BOLT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13.5 1 4 13.5h6.2L9 23l10-13h-6.3z"/></svg>';
  const DRONE_NAME = { scout: 'GNAT', netter: 'NETTER', diver: 'HORNET', lancer: 'LANCER', tether: 'LEECH', swarm: 'MIDGES', spotter: 'SPOTTER', heavy: 'RAM', crawler: 'SNARE', jammer: 'JAMMER', warden: 'THE WARDEN' };
  const SIDE_WORD = { N: 'NORTH', E: 'EAST', S: 'SOUTH', W: 'WEST' };
  const DIFF_WORD = { 1: 'RECALL', 2: 'APPLY', 3: 'ANALYSE' };

  // ---------------------------------------------------------------------------
  // UI: the overlay
  // ---------------------------------------------------------------------------
  let S = null; // the open workshop state

  function open(rootEl, opts) {
    if (S) close();
    opts = opts || {};
    const UI = C().DRONE_UI || {};
    const W = UI.workshop || {}, T = UI.terminal || {};
    const save = opts.save || DroneSave.load();
    const wave = Math.max(1, (opts.wave || save.wave || 1) | 0);
    save.visit += 1;
    // spacing clock: only a visit after a newly cleared wave counts (retry visits don't)
    const lw = save.lifetime.waves | 0;
    const counted = opts.retry === true ? false : opts.retry === false ? true : (save.svisit === 0 || lw > (save.svisitWaves | 0));
    if (counted) { save.svisit += 1; save.svisitWaves = lw; }
    save.wave = wave;
    DroneSave.save(save);
    let reduce = !!opts.reduce;
    try {
      if (opts.reduce == null) {
        reduce = !!(window.game && window.game.fx && window.game.fx.reduce) ||
          !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      }
    } catch (e) { /* ignore */ }

    // A letterboxed stage on a phone can be ~390×220 px: too small to read.
    // Then the overlay mounts on <body> as a fixed full-viewport layer.
    let root = rootEl || document.body;
    let fixed = root === document.body;
    try { const rr = root.getBoundingClientRect(); if (rr.width < 640 || rr.height < 420) fixed = true; } catch (e) { /* ignore */ }
    if (fixed) root = document.body;
    S = {
      root, fixed, save, wave, intel: opts.intel, onDone: opts.onDone, W, T, UI, reduce,
      tab: 'terminal', idx: 0, cur: null, phase: 'question', ctx: { wave, used: new Set(), faultsTaken: 0 },
      visit: { scrap: 0, right: 0, wrong: 0, added: 0, cleared: 0, results: [] }, overclock: false,
      shownScrap: save.scrap, qStart: 0, timerLeft: RULES.overclockSecs, raf: 0, lastT: 0, ambient: null, closed: false,
      counted, cal: calibration(save),
    };
    build(opts);
    S.ambient = snd('workshopAmbient', 0.8);
    nextQuestion(true);
    renderAll();
    window.addEventListener('keydown', onKey, true);
    S.loop = requestAnimationFrame(tick);
    setTimeout(() => { if (S && S.qCard) S.qCard.focus({ preventScroll: true }); }, 30);
    return { el: S.el, close, debug: Workshop.debug };
  }

  function close() {
    if (!S) return;
    window.removeEventListener('keydown', onKey, true);
    cancelAnimationFrame(S.loop);
    try { if (S.ambient && S.ambient.stop) S.ambient.stop(0.6); } catch (e) { /* ignore */ }
    if (S.el && S.el.parentNode) S.el.parentNode.removeChild(S.el);
    S.closed = true;
    S = null;
  }

  function build(opts) {
    const W = S.W, T = S.T;
    const el = h('div', { class: 'ws' + (S.reduce ? ' ws-reduce' : '') + (S.fixed ? ' ws-fixed' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': W.title || 'WORKSHOP' });
    S.el = el;
    el.appendChild(h('div', { class: 'ws-bg', 'aria-hidden': 'true' }));

    // header
    const tabs = ['terminal', 'upgrades', 'loadout'];
    const tabNames = W.tabs || ['TERMINAL', 'UPGRADES', 'LOADOUT'];
    S.tabBtns = {};
    const nav = h('nav', { class: 'ws-tabs', role: 'tablist', 'aria-label': 'Workshop steps' });
    tabs.forEach((t, i) => {
      const b = h('button', { class: 'ws-tab', role: 'tab', id: 'ws-tab-' + t, 'aria-controls': 'ws-pane-' + t, 'data-tab': t, onclick: () => setTab(t, true) },
        [h('span', { class: 'ws-tab-n', text: String(i + 1) }), h('span', { class: 'ws-tab-l', text: tabNames[i] }), h('span', { class: 'ws-tab-s' })]);
      S.tabBtns[t] = b;
      nav.appendChild(b);
    });
    nav.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const i = tabs.indexOf(S.tab) + (e.key === 'ArrowRight' ? 1 : -1);
      setTab(tabs[(i + 3) % 3], true);
      S.tabBtns[S.tab].focus();
      e.preventDefault(); e.stopPropagation();
    });
    S.scrapEl = h('b', { class: 'ws-scrap-n', text: String(S.save.scrap) });
    const scrap = h('div', { class: 'ws-scrap', role: 'status', 'aria-label': 'Scrap' }, [h('span', { class: 'ws-gear', html: GEAR }), S.scrapEl, h('span', { class: 'ws-scrap-l', text: 'SCRAP' })]);
    S.scrapBox = scrap;
    const title = S.wave > 1 ? 'WAVE ' + (S.wave - 1) + ' CLEARED' : 'PRE-FLIGHT CHECK';
    el.appendChild(h('header', { class: 'ws-head' }, [
      h('div', { class: 'ws-brand' }, [
        h('div', { class: 'ws-kicker', text: (W.title || 'WORKSHOP') + ' · VISIT ' + S.save.visit + (S.counted ? '' : ' · RETRY'), title: S.counted ? '' : 'Retry visit: the Fault Log spacing clock does not advance until you clear a wave.' }),
        h('h2', { class: 'ws-title', text: opts.title || title }),
      ]),
      nav, scrap,
    ]));

    // body
    const main = h('main', { class: 'ws-main' });
    S.main = main;
    S.panes = {};
    tabs.forEach((t) => {
      const p = h('section', { class: 'ws-pane ws-pane-' + t, id: 'ws-pane-' + t, role: 'tabpanel', 'aria-labelledby': 'ws-tab-' + t });
      S.panes[t] = p;
      main.appendChild(p);
    });
    buildTerminal(S.panes.terminal);
    S.side = h('aside', { class: 'ws-side', 'aria-label': W.intelTitle || 'SCOUT INTEL' });
    el.appendChild(h('div', { class: 'ws-body' }, [main, S.side]));

    // footer: power + launch
    S.powerTxt = h('span', { class: 'ws-pow-t' });
    S.powerCells = h('div', { class: 'ws-pow-cells', 'aria-hidden': 'true' });
    S.powerMsg = h('span', { class: 'ws-pow-m', 'aria-live': 'polite' });
    S.launchBtn = h('button', { class: 'ws-launch', onclick: () => launch() }, [h('span', { text: 'LAUNCH WAVE ' + S.wave }), h('span', { class: 'ws-launch-arrow', text: '▶' })]);
    el.appendChild(h('footer', { class: 'ws-foot' }, [
      h('div', { class: 'ws-pow' }, [h('span', { class: 'ws-bolt', html: BOLT }), S.powerTxt, S.powerCells, S.powerMsg]),
      DroneSave.persistent ? null : h('span', { class: 'ws-unsaved', text: (S.UI.hud || {}).notSaved || 'progress not saved' }),
      S.launchBtn,
    ]));
    S.fxLayer = h('div', { class: 'ws-fx', 'aria-hidden': 'true' });
    el.appendChild(S.fxLayer);
    el.addEventListener('keydown', (e) => e.stopPropagation());
    S.root.appendChild(el);
    renderIntel();
  }

  // ---------------- terminal ----------------
  function buildTerminal(p) {
    const T = S.T;
    S.dots = h('ol', { class: 'ws-dots', 'aria-label': 'Questions this visit' });
    for (let i = 0; i < RULES.perVisit; i++) S.dots.appendChild(h('li', { class: 'ws-dot' }));
    S.streakSegs = h('div', { class: 'ws-streak-segs', 'aria-hidden': 'true' });
    for (let i = 0; i < RULES.streakCap; i++) S.streakSegs.appendChild(h('i'));
    S.streakTxt = h('span', { class: 'ws-streak-t' });
    S.ocInput = h('input', { type: 'checkbox', class: 'ws-oc-in', onchange: (e) => setOverclock(e.target.checked) });
    S.ocWhy = h('span', { class: 'ws-oc-why', id: 'ws-oc-why' });
    S.ocInput.setAttribute('aria-describedby', 'ws-oc-why');
    S.ocLabel = h('label', { class: 'ws-oc', title: T.overclockDesc || '' }, [S.ocInput, h('span', { class: 'ws-oc-sw', 'aria-hidden': 'true' }), h('span', { class: 'ws-oc-l' }, [T.overclock || 'OVERCLOCK', S.ocWhy])]);
    p.appendChild(h('div', { class: 'ws-term-top' }, [
      h('div', { class: 'ws-term-title' }, [h('h3', { text: T.title || 'EXAM TERMINAL' }), h('p', { class: 'ws-sub', text: T.subtitle || '' })]),
      S.dots,
      h('div', { class: 'ws-streak', title: 'Next correct answer pays this multiplier' }, [S.streakSegs, S.streakTxt]),
      S.ocLabel,
    ]));
    S.qWrap = h('div', { class: 'ws-qwrap' });
    p.appendChild(S.qWrap);
  }

  function nextQuestion(first) {
    if (!first) S.idx += 1;
    if (S.fxLayer) S.fxLayer.textContent = '';
    if (S.idx >= RULES.perVisit) { S.phase = 'summary'; S.cur = null; renderTerminal(); return; }
    S.cur = pickNext(S.save, S.ctx);
    if (!S.cur) { S.phase = 'summary'; renderTerminal(); return; }
    S.phase = 'question';
    S.qStart = performance.now();
    S.timerLeft = RULES.overclockSecs;
    renderTerminal();
  }

  function renderTerminal() {
    const T = S.T, wrap = S.qWrap;
    wrap.textContent = '';
    const oc = ocInfo();
    S.ocInput.checked = S.overclock;
    S.ocInput.disabled = !oc.any || S.idx > 0 || S.phase !== 'question';
    S.ocLabel.classList.toggle('on', S.overclock);
    S.ocLabel.classList.toggle('locked', S.ocInput.disabled);
    S.ocLabel.classList.toggle('gated', !oc.any);
    S.ocLabel.title = oc.any ? (S.T.overclockDesc || '') + ' Works on topics at ' + oc.need + '%+ calibration: ' + oc.open.join(', ') + '.' : oc.why;
    S.ocWhy.textContent = oc.any ? '' : ' 🔒 ' + oc.need + '% CAL';
    renderDots();
    renderStreak();
    if (S.phase === 'summary') { renderSummary(wrap); return; }
    const it = S.cur, q = it.q;
    const topicName = (C().MCQ_TOPICS || {})[q.topic] || q.topic;
    const ocOn = ocActive();
    const worth = scrapFor(q.difficulty, S.save.streak, ocOn);
    const ocOff = S.overclock && !ocOn;
    const meta = h('div', { class: 'ws-q-meta' }, [
      h('span', { class: 'ws-q-num', text: 'QUESTION ' + (S.idx + 1) + ' / ' + RULES.perVisit }),
      h('span', { class: 'ws-topic', text: topicName }),
      h('span', { class: 'ws-diff d' + q.difficulty, title: 'Difficulty ' + q.difficulty }, [h('i'), h('i'), h('i'), h('span', { text: DIFF_WORD[q.difficulty] || '' })]),
      it.fault ? h('span', { class: 'ws-fault-tag', text: (T.faultTag || 'FAULT LOG') + ' · BOX ' + it.fault.box }) : null,
      ocOff ? h('span', { class: 'ws-oc-off', text: 'OVERCLOCK OFF: ' + topicName + ' ' + Math.round((S.cal[q.topic] || 0) * 100) + '% < ' + Math.round(RULES.overclockCal * 100) + '%' }) : null,
      h('span', { class: 'ws-worth' }, [h('span', { class: 'ws-gear', html: GEAR }), '+' + worth]),
    ]);
    const letters = T.letters || ['A', 'B', 'C', 'D'];
    S.optBtns = it.options.map((txt, i) => h('button', { class: 'ws-opt', 'data-i': String(i), 'aria-label': letters[i] + '. ' + txt, onclick: () => answer(i) },
      [h('span', { class: 'ws-letter', text: letters[i] }), h('span', { class: 'ws-opt-t', text: txt }), h('span', { class: 'ws-opt-k', 'aria-hidden': 'true', text: String(i + 1) }), h('span', { class: 'ws-mark', 'aria-hidden': 'true' })]));
    S.timerFill = h('i');
    S.timerTxt = h('span');
    S.stamp = h('div', { class: 'ws-stamp', 'aria-hidden': 'true' });
    S.qCard = h('article', { class: 'ws-q' + (it.fault ? ' is-fault' : ''), tabindex: '-1', 'aria-labelledby': 'ws-stem' }, [
      meta,
      h('p', { class: 'ws-stem', id: 'ws-stem' }, [h('b', { text: (S.idx + 1) + '.' }), h('span', { text: q.stem })]),
      h('div', { class: 'ws-opts', role: 'group', 'aria-label': 'Options' }, S.optBtns),
      ocOn ? h('div', { class: 'ws-qtimer' }, [S.timerFill, S.timerTxt]) : null,
      h('p', { class: 'ws-hint', text: 'Click an option, or press 1–4 / A–D.' }),
      S.stamp,
    ]);
    S.fb = h('div', { class: 'ws-fb', 'aria-live': 'polite' });
    wrap.appendChild(S.qCard);
    wrap.appendChild(S.fb);
    if (!S.reduce) { S.qCard.classList.add('enter'); }
  }

  function renderDots() {
    [].forEach.call(S.dots.children, (d, i) => {
      const r = S.visit.results[i];
      d.className = 'ws-dot' + (r ? (r.correct ? ' ok' : ' bad') : '') + (i === S.idx && S.phase !== 'summary' ? ' cur' : '') + (r && (r.faultCleared) ? ' cleared' : '');
      d.textContent = r ? (r.correct ? '✓' : '✗') : String(i + 1);
    });
  }
  function renderStreak() {
    const st = S.save.streak;
    [].forEach.call(S.streakSegs.children, (s, i) => { s.className = i < Math.min(st, RULES.streakCap) ? 'on' : ''; });
    const m = streakMul(st);
    S.streakTxt.textContent = fmt(S.T.streak || 'STREAK ×{n}', { n: m.toFixed(1) });
    S.streakTxt.parentNode.classList.toggle('hot', st >= RULES.streakCap);
  }

  function answer(i) {
    if (!S || S.phase !== 'question' || !S.cur) return null;
    const T = S.T, it = S.cur;
    const rt = performance.now() - S.qStart;
    const ocOn = ocActive();
    const res = answerItem(S.save, it, i, { overclock: ocOn, rtMs: rt, wave: S.wave });
    S.phase = 'feedback';
    S.visit.results[S.idx] = res;
    S.visit.scrap += res.scrap;
    if (res.correct) S.visit.right++; else S.visit.wrong++;
    if (res.faultAdded) S.visit.added++;
    if (res.faultCleared) S.visit.cleared++;
    DroneSave.save(S.save);

    // mark options
    S.optBtns.forEach((b, k) => {
      b.disabled = true;
      if (k === it.answer) { b.classList.add('is-correct'); b.lastChild.textContent = '✓'; }
      else if (k === i) { b.classList.add('is-wrong'); b.lastChild.textContent = '✗'; }
      else b.classList.add('is-dim');
    });
    S.qCard.classList.add('answered', res.correct ? 'was-right' : 'was-wrong');
    const letters = T.letters || ['A', 'B', 'C', 'D'];
    const head = h('div', { class: 'ws-fb-head ' + (res.correct ? 'ok' : 'bad') }, [
      h('span', { class: 'ws-verdict', text: res.correct ? (T.correct || 'CORRECT') : res.timeout ? 'TIME UP' : (T.wrong || 'INCORRECT') }),
      res.correct ? h('span', { class: 'ws-gain' }, [h('span', { class: 'ws-gear', html: GEAR }), fmt(T.scrapEarned || '+{n} SCRAP', { n: res.scrap }),
        res.mult > 1 ? h('small', { text: ' ×' + res.mult.toFixed(1) + ' streak' }) : null, ocOn ? h('small', { text: ' ×1.5 overclock' }) : null]) :
        h('span', { class: 'ws-correct-was', text: 'Correct answer: ' + letters[it.answer] + '. ' + it.options[it.answer] }),
    ]);
    const body = [head, h('div', { class: 'ws-fb-row' }, [h('div', { class: 'ws-fb-l', text: T.explainLabel || 'Explanation' }), h('p', { text: it.q.explain })])];
    if (!res.correct && i >= 0 && it.whyWrong[i]) body.push(h('div', { class: 'ws-fb-row why' }, [h('div', { class: 'ws-fb-l', text: (T.whyWrongLabel || 'Why your answer is wrong') + ' (' + letters[i] + ')' }), h('p', { text: it.whyWrong[i] })]));
    if (res.faultAdded) body.push(h('div', { class: 'ws-fb-note', text: T.faultAdded || 'Added to the Fault Log.' }));
    else if (!res.correct && it.fault) body.push(h('div', { class: 'ws-fb-note', text: 'Back to box 1 of the Fault Log. It returns after your next cleared wave.' }));
    else if (res.correct && it.fault && res.faultHeld) body.push(h('div', { class: 'ws-fb-note ok', text: 'Right! Fault Log box 3 of 3. It clears after ' + res.faultHeld + ' more cleared wave' + (res.faultHeld === 1 ? '' : 's') + ', so it comes back once more.' }));
    else if (res.correct && it.fault && !res.faultCleared) body.push(h('div', { class: 'ws-fb-note ok', text: 'Fault Log box ' + res.faultBox + ' of 3. It returns after ' + RULES.faultDueByBox[res.faultBox] + ' more cleared wave' + (RULES.faultDueByBox[res.faultBox] === 1 ? '' : 's') + '.' }));
    const last = S.idx + 1 >= RULES.perVisit;
    S.nextBtn = h('button', { class: 'ws-next', onclick: () => nextQuestion(false) }, [last ? 'Visit summary' : 'Next question', h('kbd', { text: 'Enter' })]);
    body.push(h('div', { class: 'ws-fb-foot' }, [S.nextBtn]));
    body.forEach((b) => S.fb.appendChild(b));
    S.fb.classList.add('show');

    if (res.correct) {
      snd('questionRight');
      flyScrap(S.optBtns[it.answer], res.scrap);
      if (!S.reduce) burst(S.optBtns[it.answer], '#4dffa0');
    } else {
      snd('questionWrong');
      if (!S.reduce) { S.qCard.classList.add('shake'); }
    }
    if (res.faultCleared) {
      S.stamp.textContent = T.faultCleared || 'FAULT CLEARED +25';
      S.stamp.classList.add('show');
    }
    renderDots(); renderStreak(); renderHeader(); renderPower(); renderStatus();
    S.nextBtn.focus({ preventScroll: true });
    setTimeout(() => { try { if (S && S.fb) S.fb.scrollIntoView({ block: 'nearest', behavior: S.reduce ? 'auto' : 'smooth' }); } catch (e) { /* ignore */ } }, 60);
    return res;
  }

  function renderSummary(wrap) {
    const T = S.T, v = S.visit;
    const stat = (n, l, cls) => h('div', { class: 'ws-stat ' + (cls || '') }, [h('b', { text: String(n) }), h('span', { text: l })]);
    wrap.appendChild(h('article', { class: 'ws-q ws-summary', tabindex: '-1' }, [
      h('div', { class: 'ws-kicker', text: T.summary || 'VISIT SUMMARY' }),
      h('h3', { text: v.right + ' / ' + v.results.length + ' correct' }),
      h('div', { class: 'ws-stats' }, [
        stat('+' + v.scrap, 'SCRAP EARNED', 'gold'), stat('×' + streakMul(S.save.streak).toFixed(1), 'STREAK'),
        stat(v.added, 'FAULTS ADDED', v.added ? 'warn' : ''), stat(v.cleared, 'FAULTS CLEARED', v.cleared ? 'good' : ''),
      ]),
      h('p', { class: 'ws-sub', text: fmt(T.summaryLine || '', { scrap: v.scrap, streak: streakMul(S.save.streak).toFixed(1), added: v.added, cleared: v.cleared }) }),
      h('p', { class: 'ws-sub', text: 'Fault Log: ' + S.save.faultLog.length + ' item' + (S.save.faultLog.length === 1 ? '' : 's') + ' waiting for review.' }),
      h('div', { class: 'ws-fb-foot' }, [h('button', { class: 'ws-next', onclick: () => setTab('upgrades', true) }, ['Go to the upgrade bay', h('span', { text: '▶' })])]),
    ]));
    S.qCard = wrap.firstChild;
    renderTabs();
  }

  // OVERCLOCK gate: per topic, Calibration >= 60% (snapshot at visit open)
  function ocInfo() {
    const need = Math.round(RULES.overclockCal * 100), T = C().MCQ_TOPICS || {};
    const cal = (S && S.cal) || {};
    const ks = Object.keys(cal);
    const open = ks.filter((k) => cal[k] >= RULES.overclockCal - 1e-9).map((k) => T[k] || k);
    let best = null;
    ks.forEach((k) => { if (!best || cal[k] > cal[best]) best = k; });
    const why = 'OVERCLOCK is locked: it unlocks for a topic once its Calibration reaches ' + need + '%.' +
      (best ? ' Your best is ' + (T[best] || best) + ' at ' + Math.round(cal[best] * 100) + '%.' : '') + ' Answer more terminal questions to raise it.';
    return { any: open.length > 0, open, need, why };
  }
  function ocActive() {
    if (!S || !S.overclock || !S.cur) return false;
    return (S.cal[S.cur.q.topic] || 0) >= RULES.overclockCal - 1e-9;
  }
  function setOverclock(on) {
    if (!S || S.idx > 0 || S.phase !== 'question') return false;
    if (on && !ocInfo().any) { flashMsg(ocInfo().why); return false; }
    S.overclock = !!on;
    S.timerLeft = RULES.overclockSecs;
    S.qStart = performance.now();
    renderTerminal();
    return true;
  }

  // ---------------- upgrades ----------------
  function renderUpgrades() {
    const p = S.panes.upgrades, W = S.W;
    p.textContent = '';
    p.appendChild(h('div', { class: 'ws-pane-head' }, [h('h3', { text: 'UPGRADE BAY' }), h('p', { class: 'ws-sub', text: 'Spend scrap on anatomy upgrades. New builds go straight into the loadout if there is power for them.' })]));
    S.cards = {};
    CATS.forEach((cat) => {
      const grid = h('div', { class: 'ws-grid' });
      UPGRADE_DEFS.filter((d) => d.cat === cat.id).forEach((d) => {
        const t = upgradeText(d.id), own = S.save.upgrades[d.id] | 0, nx = d.levels[own];
        const pips = h('div', { class: 'ws-pips', 'aria-label': 'Level ' + own + ' of 3' }, [0, 1, 2].map((k) => h('i', { class: k < own ? 'on' : '' })));
        const fxList = h('ul', { class: 'ws-fxl' });
        Object.keys(d.levels[0].effect).forEach((k) => {
          if (k === 'allyEarly' && own < 2) return;
          const lab = FX_LABEL[k] || [k, (v) => v];
          const curV = own ? d.levels[own - 1].effect[k] : DEFAULT_FX[k];
          const nxV = nx ? nx.effect[k] : null;
          fxList.appendChild(h('li', {}, [h('span', { text: lab[0] }), h('b', {}, [String(lab[1](curV)), nx && nxV !== curV ? h('em', { text: ' → ' + lab[1](nxV) }) : null])]));
        });
        const can = nx && S.save.scrap >= nx.cost;
        const btnTxt = !nx ? (W.maxed || 'MAX') : (own ? (W.upgrade || 'UPGRADE') : (W.build || 'BUILD'));
        const btn = h('button', { class: 'ws-buy' + (can ? ' can' : ''), disabled: !nx || null, 'aria-disabled': nx && !can ? 'true' : null,
          title: nx && !can ? (W.notEnough || 'Not enough scrap.') : '', 'aria-label': btnTxt + ' ' + t.name + (nx ? ', ' + nx.cost + ' scrap' : ''), onclick: () => uiBuy(d.id) },
        [h('span', { text: btnTxt }), nx ? h('span', { class: 'ws-cost' }, [h('span', { class: 'ws-gear', html: GEAR }), String(nx.cost)]) : null]);
        const pw = nx ? nx.power : d.levels[2].power;
        const card = h('article', { class: 'ws-card cat-' + d.cat + (own ? ' owned' : '') + (own >= 3 ? ' maxed' : '') + (S.save.loadout[d.id] ? ' active' : ''), 'data-id': d.id }, [
          h('div', { class: 'ws-card-top' }, [h('span', { class: 'ws-muscle', text: t.muscle }), h('span', { class: 'ws-pw', title: 'Power at ' + (nx ? 'next level' : 'max level') }, [h('span', { class: 'ws-bolt', html: BOLT }), pw + ' PWR'])]),
          h('h4', { text: t.name }),
          h('p', { class: 'ws-desc', text: t.desc }),
          fxList,
          h('div', { class: 'ws-card-foot' }, [pips, S.save.loadout[d.id] ? h('span', { class: 'ws-on-tag', text: 'ACTIVE L' + S.save.loadout[d.id] }) : null, btn]),
        ]);
        S.cards[d.id] = card;
        grid.appendChild(card);
      });
      p.appendChild(h('section', { class: 'ws-cat cat-' + cat.id }, [h('h4', { class: 'ws-cat-h', text: cat.label }), grid]));
    });
  }
  function uiBuy(id) {
    if (!S) return { ok: false, reason: 'closed' };
    const r = buy(S.save, id);
    if (!r.ok) {
      const c = S.cards && S.cards[id];
      if (c && !S.reduce) { c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake'); }
      if (r.reason === 'scrap') flashMsg((S.W.notEnough || 'Not enough scrap.') + ' Need ' + r.cost + '.');
      return r;
    }
    DroneSave.save(S.save);
    snd('upgradeBuy');
    renderAll();
    const c = S.cards[id];
    if (c) {
      c.classList.add('bought');
      if (!S.reduce) burst(c, getCatColor(DEF[id].cat));
      const btn = c.querySelector('.ws-buy');
      if (btn && !btn.disabled) btn.focus({ preventScroll: true });
    }
    bumpScrap(-r.cost);
    return r;
  }
  function getCatColor(cat) { return cat === 'core' ? '#ffc53d' : cat === 'crew' ? '#4dffa0' : '#56e0ff'; }

  // ---------------- loadout ----------------
  function gauge(info) {
    const R = 34, L = Math.PI * R; // semicircle length
    const c = info.cal;
    const col = c >= RULES.optimisedAt ? '#4dffa0' : c >= 0.5 ? '#56e0ff' : c > 0 ? '#ffc53d' : '#3a4a5c';
    const tickA = Math.PI * (1 - RULES.optimisedAt);
    const tx = 40 + Math.cos(tickA) * R, ty = 42 - Math.sin(tickA) * R;
    const tx2 = 40 + Math.cos(tickA) * (R + 7), ty2 = 42 - Math.sin(tickA) * (R + 7);
    const svg = '<svg viewBox="0 0 80 48" aria-hidden="true">' +
      '<path d="M6 42 A34 34 0 0 1 74 42" fill="none" stroke="#1a2735" stroke-width="8" stroke-linecap="round"/>' +
      '<path class="ws-g-arc" d="M6 42 A34 34 0 0 1 74 42" fill="none" stroke="' + col + '" stroke-width="8" stroke-linecap="round" stroke-dasharray="' + (L * c).toFixed(1) + ' ' + (L + 2).toFixed(1) + '"' + (c > 0 ? '' : ' visibility="hidden"') + ' style="filter:drop-shadow(0 0 3px ' + col + ')"/>' +
      '<line x1="' + tx.toFixed(1) + '" y1="' + ty.toFixed(1) + '" x2="' + tx2.toFixed(1) + '" y2="' + ty2.toFixed(1) + '" stroke="#e6eef6" stroke-width="1.5"/>' +
      '</svg>';
    return h('div', { class: 'ws-gauge' + (c >= RULES.optimisedAt ? ' opt' : ''), role: 'img', 'aria-label': info.name + ' calibration ' + info.pct + '%' }, [
      h('div', { class: 'ws-g-dial' }, [h('span', { html: svg }), h('b', { class: 'ws-g-pct', text: info.pct + '%' })]),
      h('div', { class: 'ws-g-txt' }, [
        h('div', { class: 'ws-g-name', text: info.name }),
        h('div', { class: 'ws-g-link', text: info.link }),
        h('div', { class: 'ws-g-bonus', text: info.bonus }),
        h('div', { class: 'ws-g-n', text: info.attempts + '/' + RULES.calibWindow + ' answers' + (info.attempts < RULES.calibFull ? ' · full credit at ' + RULES.calibFull : '') }),
      ]),
    ]);
  }
  function renderLoadout() {
    const p = S.panes.loadout, W = S.W, sv = S.save;
    p.textContent = '';
    const pw = power(sv);
    const owned = UPGRADE_DEFS.filter((d) => sv.upgrades[d.id]);
    const list = h('div', { class: 'ws-slots', role: 'group', 'aria-label': 'Loadout' });
    if (!owned.length) list.appendChild(h('p', { class: 'ws-empty', text: 'No upgrades built yet. Earn scrap in the terminal, then build in the upgrade bay.' }));
    owned.forEach((d) => {
      const t = upgradeText(d.id), own = sv.upgrades[d.id], act = sv.loadout[d.id] | 0;
      const lvBtns = h('div', { class: 'ws-lv', role: 'group', 'aria-label': t.name + ' level' }, [1, 2, 3].map((l) => h('button', {
        class: 'ws-lv-b' + (l === act ? ' on' : ''), disabled: l > own || null, 'aria-pressed': l === act ? 'true' : 'false',
        title: l > own ? 'Not built' : 'Run at L' + l + ' (' + powerOf(d.id, l) + ' power)', onclick: () => uiSetLevel(d.id, l === act ? 0 : l),
      }, ['L' + l, h('small', { text: '⚡' + powerOf(d.id, l) })])));
      const row = h('div', { class: 'ws-slot cat-' + d.cat + (act ? ' on' : ''), 'data-id': d.id }, [
        h('button', { class: 'ws-switch', role: 'switch', 'aria-checked': act ? 'true' : 'false', 'aria-label': t.name, onclick: () => uiToggle(d.id) }, [h('i')]),
        h('div', { class: 'ws-slot-t' }, [h('b', { text: t.name }), h('span', { text: t.muscle })]),
        lvBtns,
      ]);
      list.appendChild(row);
    });
    const info = calibInfo(sv);
    const optTag = h('span', { class: 'ws-opt-tag' + (pw.optimised ? ' on' : ''), text: pw.optimised ? (W.optimised || 'OPTIMISED: +1 POWER') : 'All gauges ≥ ' + Math.round(RULES.optimisedAt * 100) + '% = +1 POWER' });
    p.appendChild(h('div', { class: 'ws-lo' }, [
      h('div', { class: 'ws-lo-l' }, [
        h('div', { class: 'ws-pane-head' }, [h('h3', { text: 'LOADOUT' }), h('p', { class: 'ws-sub', text: 'Switch systems on within the POWER BUDGET. Lower levels cost less power. Budget grows as you clear waves.' })]),
        list,
      ]),
      h('div', { class: 'ws-lo-r' }, [
        h('div', { class: 'ws-pane-head' }, [h('h3', { text: W.calibration || 'CALIBRATION' }), optTag]),
        h('div', { class: 'ws-gauges' }, info.map(gauge)),
      ]),
    ]));
  }
  function uiToggle(id) {
    if (!S) return { ok: false, reason: 'closed' };
    const r = toggle(S.save, id);
    afterLoadout(id, r);
    return r;
  }
  function uiSetLevel(id, l) {
    if (!S) return { ok: false, reason: 'closed' };
    const r = setLevel(S.save, id, l);
    afterLoadout(id, r);
    return r;
  }
  function afterLoadout(id, r) {
    if (r.ok) {
      DroneSave.save(S.save);
      snd(r.level ? 'lockOn' : 'scrapCoin');
      renderAll();
      const row = S.panes.loadout.querySelector('.ws-slot[data-id="' + id + '"] .ws-switch');
      if (row && S.tab === 'loadout') row.focus({ preventScroll: true });
    } else if (r.reason === 'power') {
      flashMsg('Not enough power. Switch something off first.');
      const row = S.panes.loadout.querySelector('.ws-slot[data-id="' + id + '"]');
      if (row && !S.reduce) { row.classList.remove('shake'); void row.offsetWidth; row.classList.add('shake'); }
      S.powerCells.classList.remove('deny'); void S.powerCells.offsetWidth; S.powerCells.classList.add('deny');
    }
  }

  // ---------------- intel (pinned side panel) ----------------
  function renderIntel() {
    const W = S.W, side = S.side;
    side.textContent = '';
    let intel = S.intel;
    if (Array.isArray(intel)) intel = { drones: intel };
    const has = intel && intel.signal !== false && (intel.drones || []).length;
    side.appendChild(h('div', { class: 'ws-side-h' }, [h('span', { class: 'ws-radar', 'aria-hidden': 'true' }), h('h3', { text: W.intelTitle || 'SCOUT INTEL' }), h('span', { class: 'ws-sub', text: 'WAVE ' + S.wave })]));
    if (!has) {
      side.appendChild(h('div', { class: 'ws-nosig' }, [h('div', { class: 'ws-static', 'aria-hidden': 'true' }), h('b', { text: (S.UI.hud || {}).noSignal || 'NO SIGNAL' }), h('p', { text: W.intelNoSignal || '' })]));
      renderStatus();
      return;
    }
    if (intel.warden) side.appendChild(h('div', { class: 'ws-warden', text: (S.UI.wave || {}).wardenInbound || 'WARDEN INBOUND' }));
    const names = Object.assign({}, DRONE_NAME, C().DRONE_NAMES || {});
    const list = h('ul', { class: 'ws-drones' });
    const newLines = [];
    (intel.drones || []).forEach((d) => {
      const type = typeof d === 'string' ? d : d.type;
      const isNew = !!(d.isNew || d.new);
      const cv = h('canvas', { width: '48', height: '48', class: 'ws-dicon', 'aria-hidden': 'true' });
      drawDrone(cv, type);
      list.appendChild(h('li', { class: isNew ? 'new' : '' }, [cv, h('span', { class: 'ws-dname', text: String(names[type] || type).toUpperCase() }), d.count != null ? h('b', { text: '×' + d.count }) : null, isNew ? h('em', { text: 'NEW' }) : null]));
      if (isNew && W.intelNew && W.intelNew[type]) newLines.push(W.intelNew[type]);
    });
    side.appendChild(list);
    newLines.forEach((t) => side.appendChild(h('p', { class: 'ws-newline', text: t })));
    // compass rose
    let sides = intel.sides || {};
    if (Array.isArray(sides)) { const o = {}; sides.forEach((s) => { o[s] = 1; }); sides = o; }
    const ks = ['N', 'E', 'S', 'W'];
    const max = Math.max.apply(null, ks.map((k) => +sides[k] || 0));
    if (max > 0) {
      const top = ks.filter((k) => (+sides[k] || 0) === max);
      const ang = { N: -90, E: 0, S: 90, W: 180 };
      let svg = '<svg viewBox="-8 -8 136 136" aria-hidden="true"><circle cx="60" cy="60" r="50" fill="none" stroke="#2a3a4c"/><circle cx="60" cy="60" r="28" fill="none" stroke="#1d2a38"/>';
      ks.forEach((k) => {
        const w = (+sides[k] || 0) / max, a = ang[k] * Math.PI / 180;
        const r0 = 12, r1 = 14 + 34 * w, sp = 0.5;
        const p = (rr, aa) => (60 + Math.cos(aa) * rr).toFixed(1) + ' ' + (60 + Math.sin(aa) * rr).toFixed(1);
        if (w > 0) svg += '<path d="M' + p(r0, a - sp) + ' L' + p(r1, a - sp * 0.6) + ' A' + r1 + ' ' + r1 + ' 0 0 1 ' + p(r1, a + sp * 0.6) + ' L' + p(r0, a + sp) + ' Z" fill="' + (w === 1 ? '#ff4058' : '#56e0ff') + '" fill-opacity="' + (0.25 + 0.6 * w).toFixed(2) + '"/>';
        svg += '<text x="' + (60 + Math.cos(a) * 60).toFixed(1) + '" y="' + (64 + Math.sin(a) * 60).toFixed(1) + '" text-anchor="middle" font-size="10" font-weight="700" fill="' + (w === 1 ? '#ffb3bd' : '#8fa3b8') + '">' + k + '</text>';
      });
      svg += '<circle cx="60" cy="60" r="5" fill="#56e0ff"/></svg>';
      side.appendChild(h('div', { class: 'ws-compass' }, [h('span', { html: svg }), h('p', { text: fmt(W.intelSides || 'Most drones from the {side}', { side: top.map((k) => SIDE_WORD[k]).join(' + ') }) })]));
    }
    if (intel.contraction) side.appendChild(h('p', { class: 'ws-newline amber', text: W.intelContraction || 'Expect contraction threats.' }));
    renderStatus();
  }
  // Camp status (bottom of the side panel): Fault Log, record, next budget step.
  function renderStatus() {
    if (!S.statusEl) S.statusEl = h('div', { class: 'ws-status' });
    const el = S.statusEl, sv = S.save, T = S.T;
    el.textContent = '';
    const due = sv.faultLog.filter((f) => f.due <= sv.svisit + 1).length;
    const hw = sv.highestWaveCleared | 0, b = baseBudget(sv);
    let step = null;
    if (b < RULES.budgetCap) { for (let k = hw + 1; k < hw + 6; k++) if (baseBudget({ highestWaveCleared: k }) > b) { step = k; break; } }
    const row = (label, val, cls) => h('div', { class: 'ws-st-row ' + (cls || '') }, [h('span', { text: label }), h('b', { text: String(val) })]);
    el.appendChild(h('h4', { text: 'CAMP STATUS' }));
    el.appendChild(row(T.faultTag || 'FAULT LOG', sv.faultLog.length + (sv.faultLog.length ? ' (' + due + ' due next visit)' : ''), sv.faultLog.length ? 'warn' : ''));
    el.appendChild(row('BEST WAVE', sv.bestWave || '-'));
    if (step) el.appendChild(row('NEXT POWER', 'clear wave ' + step + ': ' + (b + 1)));
    el.appendChild(row('ANSWERED', sv.lifetime.mcqAnswered ? sv.lifetime.mcqCorrect + '/' + sv.lifetime.mcqAnswered : '-'));
    S.side.appendChild(el);
  }
  function drawDrone(cv, type) {
    const ctx = cv.getContext && cv.getContext('2d');
    if (!ctx) return;
    try {
      const A = SEHS.DroneArt;
      if (A && typeof A.draw === 'function') {
        const r = (typeof A.radius === 'function' && A.radius(type)) || 20;
        A.draw(ctx, type, 24, 24, -Math.PI / 2, 0.4, { scale: Math.min(1.2, 17 / r), reduce: true });
        return;
      }
    } catch (e) { /* fall through to glyph */ }
    ctx.strokeStyle = '#56e0ff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(24, 24, 10, 0, Math.PI * 2); ctx.stroke();
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(24 + x * 13, 24 + y * 13, 5, 0, Math.PI * 2); ctx.stroke(); });
  }

  // ---------------- shared rendering ----------------
  function renderTabs() {
    const v = S.visit;
    for (const t in S.tabBtns) {
      const b = S.tabBtns[t], on = t === S.tab;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
      S.panes[t].hidden = !on;
    }
    S.tabBtns.terminal.lastChild.textContent = S.phase === 'summary' ? 'DONE' : (v.results.length) + '/' + RULES.perVisit;
    const afford = UPGRADE_DEFS.filter((d) => (S.save.upgrades[d.id] | 0) < 3 && S.save.scrap >= d.levels[S.save.upgrades[d.id] | 0].cost).length;
    S.tabBtns.upgrades.lastChild.textContent = afford ? afford + ' READY' : '';
    S.tabBtns.upgrades.classList.toggle('ping', afford > 0);
    const pw = power(S.save);
    S.tabBtns.loadout.lastChild.textContent = pw.used + '/' + pw.budget;
  }
  function renderHeader() {
    animateScrap();
    renderTabs();
  }
  function renderPower() {
    const pw = power(S.save), W = S.W;
    S.powerTxt.textContent = fmt(W.power || 'POWER {used}/{budget}', { used: pw.used, budget: pw.budget });
    const cells = Math.max(pw.budget, pw.used);
    S.powerCells.textContent = '';
    // colour each used cell by the upgrade that spends it
    const owners = [];
    UPGRADE_DEFS.forEach((d) => { const l = S.save.loadout[d.id] | 0; for (let k = 0; k < powerOf(d.id, l); k++) owners.push(d.cat); });
    for (let i = 0; i < cells; i++) {
      const cls = [i < pw.used ? 'on' : '', i >= pw.budget ? 'over' : '', i === pw.budget - 1 && pw.optimised ? 'bonus' : '', owners[i] ? 'cat-' + owners[i] : ''].join(' ');
      S.powerCells.appendChild(h('i', { class: cls }));
    }
    S.powerCells.parentNode.classList.toggle('over', pw.over);
    S.launchBtn.disabled = pw.over;
    S.launchBtn.title = pw.over ? (W.overBudget || '') : '';
    if (pw.over) S.powerMsg.textContent = W.overBudget || 'Over the power budget.';
    else if (!S.msgUntil || performance.now() > S.msgUntil) S.powerMsg.textContent = pw.optimised ? (W.optimised || 'OPTIMISED: +1 POWER') : '';
  }
  function flashMsg(t) {
    S.powerMsg.textContent = t;
    S.msgUntil = performance.now() + 2500;
    S.powerMsg.classList.remove('flash'); void S.powerMsg.offsetWidth; S.powerMsg.classList.add('flash');
  }
  function renderAll() {
    renderTabs();
    if (S.statusEl) renderStatus();
    if (S.tab === 'upgrades' || !S.cards) renderUpgrades();
    if (S.tab === 'loadout' || !S.panes.loadout.firstChild) renderLoadout();
    renderPower();
    animateScrap();
  }
  function setTab(t, user) {
    if (!S || !S.panes[t]) return false;
    S.tab = t;
    if (t === 'upgrades') renderUpgrades();
    if (t === 'loadout') renderLoadout();
    renderTabs();
    renderPower();
    S.main.scrollTop = 0;
    if (user) snd('scrapCoin');
    if (t === 'terminal' && S.qCard) S.qCard.focus({ preventScroll: true });
    return true;
  }

  // scrap counter count-up + flying coins
  function animateScrap() {
    if (!S) return;
    S.targetScrap = S.save.scrap;
    if (S.reduce) { S.shownScrap = S.save.scrap; S.scrapEl.textContent = String(S.save.scrap); }
  }
  function bumpScrap(delta) {
    S.scrapBox.classList.remove('up', 'down'); void S.scrapBox.offsetWidth;
    S.scrapBox.classList.add(delta >= 0 ? 'up' : 'down');
    const f = h('span', { class: 'ws-delta ' + (delta >= 0 ? 'up' : 'down'), text: (delta >= 0 ? '+' : '−') + Math.abs(delta) });
    S.scrapBox.appendChild(f);
    setTimeout(() => f.remove(), 1200);
  }
  function rectIn(el) {
    const a = el.getBoundingClientRect(), b = S.el.getBoundingClientRect();
    return { x: a.left - b.left + a.width / 2, y: a.top - b.top + a.height / 2, w: a.width, h: a.height };
  }
  function flyScrap(fromEl, amount) {
    if (!S || !fromEl) return;
    if (S.reduce) { bumpScrap(amount); return; }
    const a = rectIn(fromEl), b = rectIn(S.scrapEl);
    const n = Math.min(10, 3 + Math.round(amount / 8));
    for (let i = 0; i < n; i++) {
      const c = h('span', { class: 'ws-coin', html: GEAR });
      const sx = a.x + (Math.random() - 0.5) * a.w * 0.6, sy = a.y + (Math.random() - 0.5) * 20;
      c.style.transform = 'translate(' + sx + 'px,' + sy + 'px) scale(0.6)';
      S.fxLayer.appendChild(c);
      const delay = 60 + i * 55;
      setTimeout(() => {
        c.style.transition = 'transform 0.55s cubic-bezier(.5,-0.4,.7,1), opacity 0.55s';
        c.style.transform = 'translate(' + b.x + 'px,' + b.y + 'px) scale(1)';
      }, delay);
      setTimeout(() => {
        c.remove();
        if (!S) return;
        snd('scrapCoin');
        S.scrapBox.classList.remove('tick'); void S.scrapBox.offsetWidth; S.scrapBox.classList.add('tick');
      }, delay + 560);
    }
    setTimeout(() => { if (S) bumpScrap(amount); }, 120);
  }
  function burst(el, col) {
    if (!S || !el) return;
    const a = rectIn(el);
    const ring = h('span', { class: 'ws-ring', style: 'left:' + a.x + 'px;top:' + a.y + 'px;border-color:' + col + ';width:' + a.w + 'px;height:' + a.h + 'px' });
    S.fxLayer.appendChild(ring);
    setTimeout(() => ring.remove(), 700);
    for (let i = 0; i < 12; i++) {
      const s = h('span', { class: 'ws-spark', style: 'left:' + a.x + 'px;top:' + a.y + 'px;background:' + col });
      S.fxLayer.appendChild(s);
      const ang = (i / 12) * Math.PI * 2, d = 60 + Math.random() * 60;
      requestAnimationFrame(() => { s.style.transform = 'translate(' + Math.cos(ang) * d + 'px,' + Math.sin(ang) * d * 0.6 + 'px)'; s.style.opacity = '0'; });
      setTimeout(() => s.remove(), 700);
    }
  }

  function tick(now) {
    if (!S) return;
    const dt = Math.min(0.1, (now - (S.lastT || now)) / 1000);
    S.lastT = now;
    // scrap counter ease
    if (S.shownScrap !== S.save.scrap) {
      const d = S.save.scrap - S.shownScrap;
      const step = Math.sign(d) * Math.max(1, Math.ceil(Math.abs(d) * Math.min(1, dt * 6)));
      S.shownScrap = Math.abs(step) >= Math.abs(d) ? S.save.scrap : S.shownScrap + step;
      S.scrapEl.textContent = String(S.shownScrap);
    }
    // overclock timer (runs only while the terminal tab is visible)
    if (S.overclock && S.phase === 'question' && S.tab === 'terminal' && S.timerFill && ocActive()) {
      S.timerLeft = Math.max(0, S.timerLeft - dt);
      S.timerFill.style.width = (S.timerLeft / RULES.overclockSecs * 100).toFixed(2) + '%';
      S.timerTxt.textContent = Math.ceil(S.timerLeft) + ' s';
      S.timerFill.parentNode.classList.toggle('urgent', S.timerLeft < 6);
      if (S.timerLeft <= 0) answer(-1);
    }
    S.loop = requestAnimationFrame(tick);
  }

  function onKey(e) {
    if (!S) return;
    const k = e.key;
    const ae = document.activeElement;
    const onBtn = ae && (ae.tagName === 'BUTTON' || ae.tagName === 'INPUT') && S.el.contains(ae);
    let handled = false;
    if (S.tab === 'terminal') {
      if (S.phase === 'question' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const map = { 1: 0, 2: 1, 3: 2, 4: 3, a: 0, b: 1, c: 2, d: 3 };
        const i = map[k.toLowerCase()];
        if (i != null) { answer(i); handled = true; }
      } else if (S.phase === 'feedback' && k === 'Enter' && !onBtn) { nextQuestion(false); handled = true; }
    }
    if (handled) { e.preventDefault(); e.stopPropagation(); }
    // Keep game hotkeys (pause, mute...) out while the workshop is open. Keys
    // aimed inside the overlay are stopped when they bubble out of it (so our
    // own listeners still run); stray keys (focus on body) are stopped here.
    else if (!S.el.contains(e.target)) e.stopPropagation();
  }

  function launch() {
    if (!S) return { ok: false, reason: 'closed' };
    const pw = power(S.save);
    if (pw.over) {
      flashMsg(S.W.overBudget || 'Over the power budget.');
      if (!S.reduce) { S.launchBtn.classList.remove('shake'); void S.launchBtn.offsetWidth; S.launchBtn.classList.add('shake'); }
      return { ok: false, reason: 'power' };
    }
    const save = S.save, cb = S.onDone;
    save.wave = S.wave;
    DroneSave.save(save);
    snd('waveStart');
    close();
    if (typeof cb === 'function') cb(save);
    return { ok: true, wave: save.wave };
  }

  // ---------------------------------------------------------------------------
  // Debug hooks for headless tests (§4.13)
  // ---------------------------------------------------------------------------
  const debug = {
    // true/false = answer correctly / pick the first wrong option; a number =
    // presented option index; -1 = timeout. Advances first if feedback is up.
    answer(x) {
      if (!S) return null;
      if (S.tab !== 'terminal') setTab('terminal');
      if (S.phase === 'feedback') nextQuestion(false);
      if (S.phase !== 'question') return null;
      let i = x;
      if (x === true) i = S.cur.answer;
      else if (x === false) i = [0, 1, 2, 3].find((k) => k !== S.cur.answer);
      return answer(i | 0);
    },
    next() { if (S && S.phase === 'feedback') { nextQuestion(false); return true; } return false; },
    tab(t) { return setTab(t); },
    buy(id) { return uiBuy(id); },
    toggle(id) { return uiToggle(id); },
    setLevel(id, l) { return uiSetLevel(id, l); },
    overclock(on) { return setOverclock(on); },
    grant(n) { if (!S) return 0; addScrap(S.save, n); DroneSave.save(S.save); renderAll(); return S.save.scrap; },
    launch() { return launch(); },
    close() { close(); },
    state() {
      if (!S) return { open: false };
      return {
        open: true, tab: S.tab, phase: S.phase, index: S.idx, wave: S.wave, overclock: S.overclock, overclockActive: ocActive(), overclockGate: ocInfo(), countedVisit: S.counted,
        current: S.cur ? { id: S.cur.id, topic: S.cur.q.topic, difficulty: S.cur.q.difficulty, answer: S.cur.answer, options: S.cur.options.slice(), fault: S.cur.fault ? Object.assign({}, S.cur.fault) : null } : null,
        visit: JSON.parse(JSON.stringify(S.visit)), power: power(S.save), effects: effects(S.save),
        save: JSON.parse(JSON.stringify(S.save)), persistent: DroneSave.persistent,
      };
    },
  };

  const Workshop = {
    open, close, isOpen: () => !!S,
    UPGRADES: UPGRADE_DEFS.map((d) => Object.assign({ id: d.id, cat: d.cat, levels: d.levels }, upgradeText(d.id))),
    DEFAULT_FX, RULES,
    effects, powerBudget, powerUsed, power, calibration, calibInfo, optimised,
    pickQuestions, pickNext, present, answerItem, scrapFor, streakMul, diffBand,
    buy, toggle, setLevel, addFault, addScrap, onWaveCleared,
    debug,
  };
  SEHS.DroneSave = DroneSave;
  SEHS.Workshop = Workshop;
})();
