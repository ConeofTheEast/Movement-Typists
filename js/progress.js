/*
 * progress.js: Drone Defense long-term progress (GAME_DESIGN §4.11, §4.12).
 * Movement Codex + mastery, confusion matrix, ally levels, wave contracts,
 * cosmetics, class seed, and the teacher-friendly session report.
 *
 * Load AFTER js/content.js and js/workshop.js (for SEHS.DroneSave). Uses
 * SEHS.AndroidTop / SEHS.TopPose for the codex demos when present. Plain
 * script, no modules, works from file://. Every public call is guarded: a
 * bad argument or a missing content field never throws into the engine.
 *
 *   SEHS.Progress.onFreeze({ threatId, action, kind, choice, correct, firstTry,
 *       timeMs, allyName, wave, assist, result? }) -> { newlyMastered:[key], unlocked:[cosmeticId], allyLevelUp, toasts:[text] }
 *   SEHS.Progress.onRescue({ move, correct, allyName, wave? }) -> { allyLevelUp, unlocked }
 *   SEHS.Progress.contractsFor(wave)       -> [{ id, name, desc, scrap }] ×2 (deterministic: wave + seed)
 *   SEHS.Progress.pickContract(id|null)    -> optional: only that contract counts this wave
 *   SEHS.Progress.onWaveEnd({ wave, cleared, alliesNetted, energyLost, freezes,
 *       firstTryStreakMax, assist, boss?, alliesTaken?, netterKills?, planeErrors? })
 *                                          -> { completed:[{ id, name, scrap }], unlocked:[cosmeticId], stats }
 *   SEHS.Progress.allyLevel(name)          -> { level, xp, next, prev, title, perk (raw object), perkText, perks,
 *                                             unlockBanter, type, typeName, name, max }  (name: 'WRENCH', 'wrench', "UNIT-07 'Wrench'")
 *   SEHS.Progress.cosmetic()               -> { visor, trail, visorColor, trailColor, visorName, trailName }
 *   SEHS.Progress.equip(id)                -> true when equipped
 *   SEHS.Progress.setSeed(code) / getSeed() / rng(salt) (seeded fn or null)
 *   SEHS.Progress.mastery(action)          -> { key, name, status, streak, need, mastered, review, ... }
 *   SEHS.Progress.openCodex(rootEl, { onClose, tab, action }) / openReport(rootEl, { onClose })
 *   SEHS.Progress.reportText()             -> the plain-text report block
 *   SEHS.Progress.debug.{ state, reset, fakeFreeze(n), unlockAll }
 *
 * Storage (separate from the defense save so "New defense" never wipes it):
 *   localStorage 'kinetic-escape-drone-progress-v1' -> lifetime learning data
 *   sessionStorage 'kinetic-escape-drone-session-v1' -> this session (report, class seed)
 * Both fall back to memory when storage is blocked. Nothing is ever uploaded.
 *
 * Curriculum text (action names, definitions, examples, muscles) comes only
 * from SEHS.content (CODEX, or PLANES / MOVEMENT_DEFS / CONTRACTIONS as a
 * fallback). Action keys are slugs of the action name ('horizontal_adduction').
 */
(function () {
  'use strict';
  const SEHS = (window.SEHS = window.SEHS || {});
  const C = () => SEHS.content || {};
  const KEY = 'kinetic-escape-drone-progress-v1';
  const SKEY = 'kinetic-escape-drone-session-v1';
  const slug = (s) => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const isObj = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : null);
  const cap = (s) => { s = String(s || ''); return s ? s[0].toUpperCase() + s.slice(1) : s; };
  const fmt = (s, o) => String(s == null ? '' : s).replace(/\{(\w+)\}/g, (m, k) => (o && o[k] != null ? o[k] : m));
  const warn = (where, e) => { try { console.warn('[progress] ' + where, e); } catch (x) { /* ignore */ } };
  const list = (x) => (Array.isArray(x) ? x : isObj(x) ? Object.keys(x).map((k) => Object.assign({ id: k }, isObj(x[k]) ? x[k] : {})) : []);

  // ---------------------------------------------------------------------------
  // Content accessors with built-in fallbacks
  // ---------------------------------------------------------------------------
  function masteryNeed() { const m = C().MASTERY; return Math.max(1, num(m && m.firstTryStreak, 3) | 0); }
  function label(status) {
    const L = (C().MASTERY || {}).labels;
    const d = { locked: 'NOT MET YET', learning: 'PRACTISING', mastered: 'MASTERED', review: 'REVIEW' };
    if (isObj(L) && L[status]) return String(L[status]);
    return d[status] || String(status).toUpperCase();
  }
  // REPORT_TEXT lookup; 'labels.bestWave' style paths reach nested groups.
  function rt(k, d) {
    let v = C().REPORT_TEXT;
    String(k).split('.').forEach((p) => { v = v && typeof v === 'object' ? v[p] : undefined; });
    return v != null && typeof v !== 'object' ? String(v) : d;
  }
  function planeName(p) { const P = (C().PLANES || {})[p]; return P ? P.name : p || ''; }
  const CONTRACTION_KEYS = ['concentric', 'eccentric', 'isometric'];

  // Threat lookups (droneUse / muscles fallback, threatId -> action)
  function threats() { return C().DRONE_THREATS || {}; }
  function muscleName(m) {
    const M = C().MUSCLES || {};
    if (M[m] && M[m].name) return M[m].name;
    return String(m).replace(/_/g, ' ');
  }
  function fallbackEntry(name, kind) {
    const c = C(), key = slug(name), T = threats();
    const ths = Object.keys(T).filter((id) => slug(T[id].action || T[id].correct) === key);
    const ag = [], joints = [];
    ths.forEach((id) => {
      ((T[id].success || {}).agonists || []).forEach((m) => { if (ag.indexOf(m) < 0) ag.push(m); });
      (T[id].joints || []).forEach((j) => { if (joints.indexOf(j) < 0) joints.push(j); });
    });
    let def = '', ex = '';
    if (kind === 'contraction') {
      const k = (c.CONTRACTIONS || {})[key] || {};
      def = k.def || ''; ex = k.example || '';
    } else {
      def = (c.MOVEMENT_DEFS || {})[name] || '';
      ex = (c.MOVEMENT_EXAMPLES || {})[name] || '';
    }
    const pl = kind === 'movement' ? ((c.PLANES || {}).transverse || {}).name || '' : '';
    return {
      key, id: key, name, kind, plane: pl, joint: cap(joints.join(', ')), definition: cap(def), example: ex,
      droneUse: ths.map((id) => T[id].title).filter(Boolean).join(' · '), musclesPrime: ag.map(muscleName), threats: ths,
    };
  }
  let actCache = null, actSig = '';
  function actions() {
    const c = C();
    const codex = list(c.CODEX);
    const sig = codex.length + ':' + !!c.PLANES + ':' + !!c.CONTRACTIONS;
    if (actCache && sig === actSig) return actCache;
    const out = [], seen = {};
    const tm = (((c.PLANES || {}).transverse || {}).movements) || ['Medial rotation', 'Lateral rotation', 'Rotation', 'Pronation', 'Supination', 'Horizontal abduction', 'Horizontal adduction'];
    const cn = CONTRACTION_KEYS.map((k) => (((c.CONTRACTIONS || {})[k] || {}).name) || cap(k));
    const fbs = tm.map((n) => fallbackEntry(n, 'movement')).concat(cn.map((n) => fallbackEntry(n, 'contraction')));
    codex.forEach((e) => {
      if (!isObj(e)) return;
      const key = slug(e.name || e.id);
      if (!key || seen[key]) return;
      const fb = fbs.find((f) => f.key === key || f.key === slug(e.id)) || {};
      const kind = e.kind || e.type || (CONTRACTION_KEYS.indexOf(key) >= 0 ? 'contraction' : fb.kind || 'movement');
      const mus = Array.isArray(e.musclesPrime) ? e.musclesPrime : typeof e.musclesPrime === 'string' ? [e.musclesPrime] : fb.musclesPrime || [];
      const entry = {
        key, id: e.id || key, name: e.name || fb.name || e.id, kind: kind === 'contraction' ? 'contraction' : 'movement',
        plane: e.plane ? planeName(e.plane) : fb.plane || '', joint: e.joint || fb.joint || '', definition: e.definition || fb.definition || '',
        example: e.example || fb.example || '', droneUse: e.droneUse || fb.droneUse || '', musclesPrime: mus.map(muscleName), threats: fb.threats || [],
      };
      seen[key] = 1; seen[slug(e.id)] = 1;
      out.push(entry);
    });
    fbs.forEach((f) => { if (!seen[f.key]) { seen[f.key] = 1; out.push(f); } });
    // movements first, then contractions (stable within each group)
    actCache = out.filter((a) => a.kind === 'movement').concat(out.filter((a) => a.kind === 'contraction'));
    actSig = sig;
    return actCache;
  }
  function actionByKey(k) { k = slug(k); return actions().find((a) => a.key === k || slug(a.id) === k) || null; }
  function resolveKey(action, threatId) {
    let k = slug(action);
    if (!k && threatId) { const t = threats()[threatId]; if (t) k = slug(t.action || t.correct); }
    if (!k) return null;
    const a = actionByKey(k);
    return a ? a.key : k;
  }
  function actionName(k) { const a = actionByKey(k); return a ? a.name : cap(String(k).replace(/_/g, ' ')); }

  // Allies
  function allyTypes() { return C().ALLY_TYPES || {}; }
  function roster() { return Array.isArray(C().ALLY_ROSTER) ? C().ALLY_ROSTER : []; }
  function resolveAlly(name) {
    if (name == null || name === '') return null;
    if (isObj(name)) name = name.id || name.name || name.unit;
    const raw = String(name), s = slug(raw);
    const q = (raw.match(/'([^']+)'/) || [])[1];
    const R = roster();
    let hit = R.find((r) => slug(r.id) === s || slug(r.name) === s || slug(r.unit) === s || (q && slug(r.name) === slug(q)));
    if (!hit) hit = R.find((r) => s.indexOf(slug(r.unit)) >= 0 && r.unit);
    if (hit) return { key: slug(hit.id || hit.name), name: hit.name || raw, unit: hit.unit || '', type: hit.type || 'mechanic', visor: hit.visor || '#56e0ff' };
    const types = Object.keys(allyTypes());
    let type = types.find((t) => s.indexOf(t) >= 0);
    if (!type) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; type = types.length ? types[Math.abs(h) % types.length] : 'mechanic'; }
    const nm = q ? q.toUpperCase() : raw.toUpperCase();
    return { key: slug(q || raw), name: nm, unit: (raw.match(/UNIT-\d+/) || [''])[0], type, visor: '#56e0ff' };
  }
  const FALLBACK_LEVELS = [{ xp: 30, perk: '', title: 'TRUSTED' }, { xp: 90, perk: '', title: 'VETERAN' }, { xp: 180, perk: '', title: 'LEGEND' }];
  // Perk objects ({ repairMul: 1.15 }) -> short UI text. Units per content.js.
  const PERK_TEXT = {
    repairMul: (v) => 'repair ×' + v, healEvery: (v) => 'heals every ' + v + ' s', turretRate: (v) => 'turret fire rate ×' + v,
    warnEarly: (v) => v + ' s early warning',
  };
  function perkText(p) {
    if (p == null || p === '') return '';
    if (typeof p !== 'object') return String(p);
    if (p.text || p.desc) return String(p.text || p.desc);
    return Object.keys(p).map((k) => (PERK_TEXT[k] ? PERK_TEXT[k](p[k]) : k + ' ' + p[k])).join(', ');
  }
  const firstLine = (b) => (Array.isArray(b) ? b[0] || '' : b || '');
  function levelsFor(type) {
    const L = C().ALLY_LEVELS;
    const a = L && Array.isArray(L[type]) && L[type].length ? L[type] : FALLBACK_LEVELS;
    return a.map((x, i) => ({ xp: num(x && x.xp, FALLBACK_LEVELS[Math.min(i, 2)].xp), perk: (x && x.perk) || '', title: (x && x.title) || FALLBACK_LEVELS[Math.min(i, 2)].title, unlockBanter: (x && x.unlockBanter) || '' }))
      .sort((a, b) => a.xp - b.xp);
  }
  const XP = { freeze: 10, firstTry: 5, rescue: 8 };

  // Contracts. Content supplies { id, name, desc, scrap } (optionally goal /
  // minWave); the rule is engine-owned and looked up by id (or a keyword in
  // the id). A goal is { stat, min } / { stat, max }, an array of them, or
  // (engine-only) a test(stats) function. boss: true = offered on Warden waves only.
  const STRIKE = { swing: ['horizontal_abduction', 'horizontal_adduction'], rot: ['medial_rotation', 'lateral_rotation'], palm: ['pronation', 'supination'], con: CONTRACTION_KEYS };
  // every first-try freeze whose answer is in `keys` was right (and there was at least one)
  const allFirst = (keys) => (s) => { let n = 0, bad = 0; keys.forEach((k) => { const a = s.byAct[k]; if (a) { n += a.n; bad += a.n - a.ok; } }); return n > 0 && bad === 0; };
  const GOALS = {
    noNet: { goal: { stat: 'alliesNetted', max: 0 } },
    firstTry5: { goal: { stat: 'firstTryStreakMax', min: 5 }, minWave: 2 },
    noTimeout: { goal: [{ stat: 'timeouts', max: 0 }, { stat: 'freezes', min: 1 }] },
    cleanPlane: { goal: [{ stat: 'planeErrors', max: 0 }, { stat: 'freezes', min: 1 }] },
    rescueAll: { test: (s) => s.alliesNetted > 0 && (s.alliesTaken != null ? s.alliesTaken === 0 : s.rescueOk + s.netterKills >= s.alliesNetted) },
    bossFlawless: { test: (s) => s.boss && s.wrong === 0 && s.freezes > 0, boss: true },
    quickDraw: { goal: { stat: 'quick', min: 3 } },
    contractionAce: { test: allFirst(STRIKE.con), minWave: 4 },
    midlineMaster: { test: allFirst(STRIKE.swing) },
    rotatorPro: { test: allFirst(STRIKE.rot), minWave: 6 },
    palmReader: { test: allFirst(STRIKE.palm), minWave: 3 },
    ironFrame: { goal: { stat: 'energyLost', max: 0 } },
    codexStudy: { goal: { stat: 'studied', min: 1 } },
    // built-in fallbacks
    no_netted: { goal: { stat: 'alliesNetted', max: 0 } },
    no_damage: { goal: { stat: 'energyLost', max: 0 } },
    first_try_3: { goal: { stat: 'firstTryStreakMax', min: 3 } },
    no_timeouts: { goal: [{ stat: 'timeouts', max: 0 }, { stat: 'freezes', min: 1 }] },
    contraction_ace: { goal: { stat: 'contractionFirstTry', min: 1 }, minWave: 4 },
    variety_3: { goal: { stat: 'distinctActions', min: 3 }, minWave: 2 },
    rescue_1: { goal: { stat: 'rescueOk', min: 1 } },
    perfect: { goal: [{ stat: 'wrong', max: 0 }, { stat: 'firstTryOk', min: 2 }] },
  };
  const GOAL_WORDS = [
    [/perfect|flawless/, 'perfect'], [/net/, 'no_netted'], [/energy|damage|hit|untouch|cell|shield|iron/, 'no_damage'],
    [/time|hesit/, 'no_timeouts'], [/plane/, 'cleanPlane'], [/quick|fast|speed/, 'quickDraw'], [/contract|isometric|eccentric|concentric/, 'contraction_ace'],
    [/variet|differ|reper|mix/, 'variety_3'], [/rescue|cut|free/, 'rescue_1'], [/streak|row|first|combo/, 'first_try_3'],
  ];
  const FALLBACK_CONTRACTS = [
    { id: 'no_netted', name: 'SAFETY NET', desc: 'No ally gets netted this wave.', scrap: 40 },
    { id: 'no_damage', name: 'UNTOUCHED', desc: 'Lose no energy cells this wave.', scrap: 50 },
    { id: 'first_try_3', name: 'SHARP MIND', desc: 'Answer 3 freezes in a row right on the first try.', scrap: 40 },
    { id: 'no_timeouts', name: 'NO HESITATION', desc: 'No freeze runs out of time this wave.', scrap: 30 },
    { id: 'contraction_ace', name: 'CONTRACTION ACE', desc: 'Answer a contraction freeze right on the first try.', scrap: 30 },
    { id: 'variety_3', name: 'FULL REPERTOIRE', desc: 'Win freezes with 3 different actions.', scrap: 40 },
    { id: 'rescue_1', name: 'NO ONE LEFT BEHIND', desc: 'Cut a netted ally free with a correct answer.', scrap: 30 },
    { id: 'perfect', name: 'FLAWLESS', desc: 'Every freeze right on the first try (at least 2).', scrap: 60 },
  ];
  const isBossWave = (w) => w > 0 && w % 5 === 0;
  function contractDefs() {
    const src = list(C().CONTRACTS);
    const use = src.length ? src : FALLBACK_CONTRACTS;
    const out = [];
    use.forEach((c) => {
      if (!isObj(c) || !c.id) return;
      let rule = c.goal ? { goal: c.goal, minWave: c.minWave } : GOALS[c.id] || GOALS[slug(c.id)];
      if (!rule) { const s = slug(c.id) + ' ' + slug(c.name); const w = GOAL_WORDS.find((g) => g[0].test(s)); rule = w ? GOALS[w[1]] : null; }
      if (!rule) return;
      out.push({ id: c.id, name: c.name || c.id, desc: c.desc || '', scrap: Math.max(0, num(c.scrap, 30) | 0), goal: rule.goal, test: rule.test,
        boss: !!(c.boss || rule.boss), minWave: num(c.minWave, num(rule.minWave, 1)) });
    });
    return out;
  }
  function goalMet(c, st) {
    try { if (typeof c.test === 'function') return !!c.test(st); } catch (e) { return false; }
    const goal = c.goal;
    const gs = Array.isArray(goal) ? goal : [goal];
    return gs.every((g) => {
      if (!isObj(g) || !g.stat) return false;
      const v = num(st[g.stat], 0);
      if (g.min != null && v < g.min) return false;
      if (g.max != null && v > g.max) return false;
      return true;
    });
  }

  // Cosmetics. Content: [{ id, name, slot|type: 'visor'|'trail', color, desc, unlock }].
  // unlock: none = starter; { mastered:n } | { action:'Pronation' } | { contracts:n }
  // | { waves:n } | { streak:n } | { allyLevel:n } | { rescues:n }, a 'key:value'
  // string, an action name, or a sentence ("Master 3 actions") parsed by keyword.
  const FALLBACK_COSMETICS = [
    { id: 'visor_cyan', slot: 'visor', name: 'Factory cyan', color: '#56e0ff' },
    { id: 'visor_amber', slot: 'visor', name: 'Amber alert', color: '#ffc53d', unlock: { mastered: 1 } },
    { id: 'visor_green', slot: 'visor', name: 'Field green', color: '#4dffa0', unlock: { mastered: 3 } },
    { id: 'visor_pink', slot: 'visor', name: 'Scout pink', color: '#ff7ad9', unlock: { contracts: 3 } },
    { id: 'visor_violet', slot: 'visor', name: 'Ultraviolet', color: '#b48cff', unlock: { mastered: 6 } },
    { id: 'visor_gold', slot: 'visor', name: 'Gold standard', color: '#ffd36b', unlock: { mastered: 10 } },
    { id: 'trail_none', slot: 'trail', name: 'No trail', color: null },
    { id: 'trail_ion', slot: 'trail', name: 'Ion trail', color: '#56e0ff', unlock: { streak: 5 } },
    { id: 'trail_ember', slot: 'trail', name: 'Ember trail', color: '#ff6a3d', unlock: { mastered: 2 } },
    { id: 'trail_frost', slot: 'trail', name: 'Frost trail', color: '#bff4ff', unlock: { waves: 5 } },
    { id: 'trail_aurora', slot: 'trail', name: 'Aurora trail', color: '#4dffa0', unlock: { contracts: 8 } },
  ];
  function parseUnlock(u) {
    if (u == null || u === '' || u === true || u === 'default' || u === 'start' || u === 'starter') return null;
    if (typeof u === 'number') return { mastered: u };
    if (isObj(u)) return u;
    const s = String(u).trim();
    const kv = s.match(/^(\w+)\s*[:=]\s*(.+)$/);
    if (kv) { const v = +kv[2]; return { [kv[1]]: isNaN(v) ? kv[2].trim() : v }; }
    if (actionByKey(s)) return { action: s };
    const n = +((s.match(/(\d+)/) || [])[1] || 1);
    const l = s.toLowerCase();
    if (/contract/.test(l)) return { contracts: n };
    if (/wave/.test(l)) return { waves: n };
    if (/streak|row/.test(l)) return { streak: n };
    if (/rescue/.test(l)) return { rescues: n };
    if (/ally|level/.test(l)) return { allyLevel: n };
    if (/all/.test(l) && /master/.test(l)) return { mastered: actions().length };
    if (/master/.test(l)) { const a = actions().find((x) => l.indexOf(x.name.toLowerCase()) >= 0); return a ? { action: a.key } : { mastered: n }; }
    return { mastered: n };
  }
  function cosmetics() {
    const src = list(C().COSMETICS);
    const use = src.length ? src : FALLBACK_COSMETICS;
    const out = [];
    use.forEach((c, i) => {
      if (!isObj(c) || !c.id) return;
      const slot = String(c.slot || c.type || c.kind || (/trail/i.test(c.id) ? 'trail' : 'visor')).toLowerCase().indexOf('trail') >= 0 ? 'trail' : 'visor';
      out.push({ id: c.id, slot, name: c.name || c.id, color: c.color || c.colour || c.hex || null, desc: c.desc || '', unlock: parseUnlock(c.unlock != null ? c.unlock : c.req != null ? c.req : c.requires), order: i });
    });
    if (!out.some((c) => c.slot === 'visor' && !c.unlock)) out.unshift(Object.assign({ order: -1, desc: '', unlock: null }, FALLBACK_COSMETICS[0]));
    if (!out.some((c) => c.slot === 'trail' && !c.unlock)) out.push(Object.assign({ order: -1, desc: '', unlock: null }, FALLBACK_COSMETICS[6]));
    return out;
  }
  function unlockText(c) {
    if (c.desc && c.unlock) return c.desc;
    const u = c.unlock;
    if (!u) return 'Starter';
    if (u.all) return 'Unlock everything';
    if (u.action || u.master) return 'Master ' + actionName(u.action || u.master);
    if (u.mastered != null) return u.mastered >= actions().length ? 'Master every action' : 'Master ' + u.mastered + ' action' + (u.mastered === 1 ? '' : 's');
    if (u.contracts != null) return 'Complete ' + u.contracts + ' contract' + (u.contracts === 1 ? '' : 's');
    if (u.waves != null) return 'Clear ' + u.waves + ' wave' + (u.waves === 1 ? '' : 's');
    if (u.streak != null) return u.streak + ' first-try freezes in a row';
    if (u.rescues != null) return 'Rescue allies ' + u.rescues + ' times';
    if (u.allyLevel != null) return 'Raise an ally to level ' + u.allyLevel;
    if (u.type && /boss|warden/i.test(u.type)) { const n = num(u.count, 1); return n > 1 ? 'Destroy ' + n + ' Wardens' : 'Destroy the Warden'; }
    if (u.type) { const n = num(u.count, 1); return cap(String(u.type)) + ' ×' + n; }
    return c.desc || 'Keep playing';
  }

  // ---------------------------------------------------------------------------
  // STORAGE
  // ---------------------------------------------------------------------------
  function fresh() {
    return {
      v: 1, created: Date.now(),
      actions: {},      // key -> { seen, ok, wrong, firstTry, firstTryOk, timeouts, streak, best, mastered, masteredAt, recent:[1,0,1] }
      confusion: {},    // key -> { chosenLabel: n }   (wrong, non-timeout answers)
      allies: {},       // allyKey -> { xp, name, type }
      rescues: { n: 0, ok: 0 },
      totals: { freezes: 0, firstTry: 0, firstTryOk: 0, timeouts: 0, assistFreezes: 0, waves: 0, run: 0, bestStreak: 0, contracts: 0, planeErrors: 0, wardens: 0 },
      contracts: { done: {} },  // id -> times completed
      cosmetics: { unlocked: [], equipped: { visor: null, trail: null } },
      student: { name: '' },
    };
  }
  function freshSession() {
    return { start: Date.now(), seed: '', classCode: '', freezes: 0, firstTry: 0, firstTryOk: 0, timeouts: 0, assist: false, assistFreezes: 0,
      waves: 0, wavesFailed: 0, contracts: 0, rescues: 0, rescuesOk: 0, actions: {}, confusion: {}, bestWave: 0, planeErrors: 0, wardens: 0, correct: 0 };
  }
  let mem = null, memS = null, persistent = true;
  function store(kind) {
    try {
      const s = kind === 'session' ? window.sessionStorage : window.localStorage;
      if (!s) return null;
      s.setItem('__ke_p', '1'); s.removeItem('__ke_p');
      return s;
    } catch (e) { return null; }
  }
  function normalize(raw) {
    const s = fresh();
    if (!isObj(raw)) return s;
    s.created = num(raw.created, s.created);
    if (isObj(raw.actions)) for (const k in raw.actions) {
      const a = raw.actions[k]; if (!isObj(a)) continue;
      s.actions[k] = { seen: num(a.seen, 0), ok: num(a.ok, 0), wrong: num(a.wrong, 0), firstTry: num(a.firstTry, 0), firstTryOk: num(a.firstTryOk, 0),
        timeouts: num(a.timeouts, 0), streak: num(a.streak, 0), best: num(a.best, 0), mastered: !!a.mastered, masteredAt: num(a.masteredAt, 0),
        recent: Array.isArray(a.recent) ? a.recent.map((x) => (x ? 1 : 0)).slice(-3) : [] };
    }
    if (isObj(raw.confusion)) for (const k in raw.confusion) if (isObj(raw.confusion[k])) {
      s.confusion[k] = {};
      for (const c in raw.confusion[k]) s.confusion[k][c] = num(raw.confusion[k][c], 0);
    }
    if (isObj(raw.allies)) for (const k in raw.allies) if (isObj(raw.allies[k])) s.allies[k] = { xp: Math.max(0, num(raw.allies[k].xp, 0)), name: String(raw.allies[k].name || k), type: String(raw.allies[k].type || 'mechanic') };
    if (isObj(raw.rescues)) { s.rescues.n = num(raw.rescues.n, 0); s.rescues.ok = num(raw.rescues.ok, 0); }
    if (isObj(raw.totals)) for (const k in s.totals) s.totals[k] = num(raw.totals[k], 0);
    if (isObj(raw.contracts) && isObj(raw.contracts.done)) for (const k in raw.contracts.done) s.contracts.done[k] = num(raw.contracts.done[k], 0);
    if (isObj(raw.cosmetics)) {
      if (Array.isArray(raw.cosmetics.unlocked)) s.cosmetics.unlocked = raw.cosmetics.unlocked.filter((x) => typeof x === 'string');
      if (isObj(raw.cosmetics.equipped)) ['visor', 'trail'].forEach((k) => { const v = raw.cosmetics.equipped[k]; s.cosmetics.equipped[k] = typeof v === 'string' ? v : null; });
    }
    if (isObj(raw.student)) s.student.name = String(raw.student.name || '').slice(0, 60);
    return s;
  }
  function load() {
    let raw = mem;
    const ls = store('local');
    persistent = !!ls;
    try { if (ls) raw = ls.getItem(KEY) || mem; } catch (e) { persistent = false; }
    let o = null;
    try { o = raw ? JSON.parse(raw) : null; } catch (e) { o = null; }
    return normalize(o);
  }
  function loadSession() {
    let raw = memS;
    const ss = store('session');
    try { if (ss) raw = ss.getItem(SKEY) || memS; } catch (e) { /* memory */ }
    let o = null;
    try { o = raw ? JSON.parse(raw) : null; } catch (e) { o = null; }
    const s = freshSession();
    if (isObj(o)) for (const k in s) if (o[k] != null && typeof o[k] === typeof s[k]) s[k] = o[k];
    return s;
  }
  let st = load();
  let ses = loadSession();
  function save() {
    let j; try { j = JSON.stringify(st); } catch (e) { return false; }
    mem = j;
    const ls = store('local');
    if (!ls) { persistent = false; return false; }
    try { ls.setItem(KEY, j); persistent = true; return true; } catch (e) { persistent = false; return false; }
  }
  function saveSession() {
    let j; try { j = JSON.stringify(ses); } catch (e) { return; }
    memS = j;
    const ss = store('session');
    try { if (ss) ss.setItem(SKEY, j); } catch (e) { /* memory only */ }
  }

  // ---------------------------------------------------------------------------
  // MODEL
  // ---------------------------------------------------------------------------
  function blankAct() { return { seen: 0, ok: 0, wrong: 0, firstTry: 0, firstTryOk: 0, timeouts: 0, streak: 0, best: 0, mastered: false, masteredAt: 0, recent: [] }; }
  function isTimeout(e) { return !e.correct && (e.timeout === true || e.result === 'timeout' || e.choice == null || e.choice === -1 || e.choice === 'timeout'); }
  function choiceLabel(ch) {
    if (ch == null || typeof ch === 'number') return null;
    const s = String(isObj(ch) ? ch.text || ch.label || '' : ch).trim();
    if (!s) return null;
    const a = actionByKey(s);
    return a ? a.name : s.slice(0, 48);
  }
  // Mastery status for one action. mastered is a badge (kept once earned);
  // review = any error in the last 3 attempts (shown next to the badge).
  function mastery(action) {
    const key = resolveKey(action);
    const a = (key && st.actions[key]) || blankAct();
    const need = masteryNeed();
    const review = a.recent.indexOf(0) >= 0;
    let status = 'locked';
    if (a.mastered) status = 'mastered';
    else if (a.seen) status = review && a.streak === 0 ? 'review' : 'learning';
    return { key, name: actionName(key), status, label: label(status), streak: Math.min(a.streak, need), need, mastered: a.mastered, review: a.seen > 0 && review,
      seen: a.seen, firstTry: a.firstTry, firstTryOk: a.firstTryOk, accuracy: pct(a.firstTryOk, a.firstTry), timeouts: a.timeouts };
  }
  function masteredCount() { return actions().filter((a) => st.actions[a.key] && st.actions[a.key].mastered).length; }
  function maxAllyLevel() { let m = 0; for (const k in st.allies) m = Math.max(m, allyLevel(k).level); return m; }
  function wardens() { const sv = droneSave(); return Math.max(st.totals.wardens | 0, (sv && sv.lifetime && sv.lifetime.wardens) | 0); }
  function unlockMet(u) {
    if (!u) return true;
    if (u.type) {
      const n = num(u.count, num(u.n, num(u.value, 1)));
      switch (String(u.type).toLowerCase()) {
        case 'mastery': if (!u.action && !u.master) return masteredCount() >= n; break;
        case 'boss': case 'warden': return wardens() >= n;
        case 'contracts': case 'contract': return st.totals.contracts >= n;
        case 'waves': case 'wave': return st.totals.waves >= n;
        case 'streak': return st.totals.bestStreak >= n;
        case 'rescues': case 'rescue': return st.rescues.ok >= n;
        case 'allylevel': case 'ally': return maxAllyLevel() >= n;
        default: break;
      }
    }
    if (u.all) return masteredCount() >= actions().length;
    if (u.action || u.master) { const k = resolveKey(u.action || u.master); return !!(st.actions[k] && st.actions[k].mastered); }
    if (u.mastered != null) return masteredCount() >= u.mastered;
    if (u.contracts != null) return st.totals.contracts >= u.contracts;
    if (u.waves != null) return st.totals.waves >= u.waves;
    if (u.streak != null) return st.totals.bestStreak >= u.streak;
    if (u.rescues != null) return st.rescues.ok >= u.rescues;
    if (u.allyLevel != null) return maxAllyLevel() >= u.allyLevel;
    return false;
  }
  // Re-checks every cosmetic; returns ids that became unlocked now.
  function checkUnlocks() {
    const got = [];
    cosmetics().forEach((c) => {
      if (st.cosmetics.unlocked.indexOf(c.id) >= 0) return;
      if (unlockMet(c.unlock)) { st.cosmetics.unlocked.push(c.id); if (c.unlock) got.push(c.id); }
    });
    return got;
  }
  function isUnlocked(id) { return st.cosmetics.unlocked.indexOf(id) >= 0; }

  // wave tracker for contracts (in memory)
  let wt = null;
  function tracker(wave) {
    wave = wave | 0;
    if (wt && wave && !wt.wave) wt.wave = wave;
    if (!wt || (wave && wt.wave && wt.wave !== wave)) wt = { wave, freezes: 0, wrong: 0, firstTryOk: 0, timeouts: 0, run: 0, firstTryStreakMax: 0, contractionFirstTry: 0, acts: {}, rescueOk: 0, rescues: 0,
      planeErrors: 0, quick: 0, byAct: {}, missed: {}, studied: 0 };
    return wt;
  }
  // actions missed in the current or the previous wave (for "codexStudy")
  let lastMissed = {};
  function studied(key) {
    if (!key) return;
    const w = tracker(0);
    if (w.missed[key] || lastMissed[key]) { w.studied++; delete lastMissed[key]; delete w.missed[key]; }
  }
  let active = null; // { wave, ids:[...], picked }

  function bump(obj, k, kind) {
    const a = obj[k] || (obj[k] = { seen: 0, ok: 0, firstTry: 0, firstTryOk: 0, kind });
    return a;
  }

  function onFreeze(e) {
    const out = { newlyMastered: [], unlocked: [], allyLevelUp: null, toasts: [] };
    try {
      e = e || {};
      const key = resolveKey(e.action, e.threatId);
      if (!key) return out;
      const correct = !!e.correct, firstTry = e.firstTry !== false, assist = !!e.assist, timeout = isTimeout(e);
      const act = actionByKey(key);
      const kind = e.kind || (act && act.kind) || 'movement';
      const a = st.actions[key] || (st.actions[key] = blankAct());
      const chMove = typeof e.choice === 'string' ? e.choice : null;
      const mp = C().MOVEMENT_PLANE || {};
      const planeErr = !correct && (e.result === 'plane' || (kind === 'movement' && chMove && mp[chMove] && mp[chMove] !== 'transverse'));
      if (planeErr) { st.totals.planeErrors++; ses.planeErrors++; }
      a.seen++;
      if (correct) a.ok++; else a.wrong++;
      if (timeout) a.timeouts++;
      if (firstTry) { a.firstTry++; if (correct) a.firstTryOk++; }
      a.recent.push(correct ? 1 : 0); while (a.recent.length > 3) a.recent.shift();
      if (!correct) a.streak = 0;
      else if (firstTry && !assist) { a.streak++; a.best = Math.max(a.best, a.streak); }
      if (!a.mastered && a.streak >= masteryNeed()) {
        a.mastered = true; a.masteredAt = Date.now(); out.newlyMastered.push(key);
        out.toasts.push(fmt((C().MASTERY || {}).badgeEarned || 'MASTERY BADGE: {action}', { action: actionName(key).toUpperCase() }));
      }
      // confusion matrix: action -> what was chosen instead
      const ch = !correct && !timeout ? choiceLabel(e.choice) : null;
      if (ch && slug(ch) !== key) {
        const m = st.confusion[key] || (st.confusion[key] = {}); m[ch] = (m[ch] | 0) + 1;
        const sm = ses.confusion[key] || (ses.confusion[key] = {}); sm[ch] = (sm[ch] | 0) + 1;
      }
      // totals + session
      const T = st.totals;
      T.freezes++; if (timeout) T.timeouts++; if (assist) T.assistFreezes++;
      if (firstTry) { T.firstTry++; if (correct) T.firstTryOk++; }
      if (correct && firstTry) { T.run++; T.bestStreak = Math.max(T.bestStreak, T.run); } else if (!correct) T.run = 0;
      ses.freezes++; if (correct) ses.correct++; if (timeout) ses.timeouts++; if (assist) { ses.assist = true; ses.assistFreezes++; }
      if (firstTry) { ses.firstTry++; if (correct) ses.firstTryOk++; }
      const sa = bump(ses.actions, key, kind); sa.seen++; if (correct) sa.ok++; if (firstTry) { sa.firstTry++; if (correct) sa.firstTryOk++; }
      // wave tracker
      const w = tracker(e.wave);
      w.freezes++;
      if (!correct) { w.wrong++; w.run = 0; }
      if (timeout) w.timeouts++;
      if (correct && firstTry) { w.firstTryOk++; w.run++; w.firstTryStreakMax = Math.max(w.firstTryStreakMax, w.run); if (kind === 'contraction') w.contractionFirstTry++; }
      if (correct) w.acts[key] = 1; else w.missed[key] = 1;
      if (planeErr) w.planeErrors++;
      if (correct && num(e.timeMs, 1e9) < 5000) w.quick++;
      if (firstTry) { const b = w.byAct[key] || (w.byAct[key] = { n: 0, ok: 0 }); b.n++; if (correct) b.ok++; }
      // ally XP
      if (correct && e.allyName) out.allyLevelUp = giveXp(e.allyName, XP.freeze + (firstTry ? XP.firstTry : 0));
      out.unlocked = checkUnlocks();
      save(); saveSession();
    } catch (err) { warn('onFreeze', err); }
    return out;
  }
  function giveXp(name, n) {
    const al = resolveAlly(name);
    if (!al) return null;
    const before = allyLevel(al.key).level;
    const r = st.allies[al.key] || (st.allies[al.key] = { xp: 0, name: al.name, type: al.type });
    r.xp += n; r.name = al.name; r.type = al.type;
    const after = allyLevel(al.key);
    return after.level > before ? { name: al.name, key: al.key, level: after.level, title: after.title, perk: after.perk, perkText: after.perkText, unlockBanter: after.unlockBanter, banter: firstLine(after.unlockBanter) } : null;
  }
  function onRescue(e) {
    const out = { allyLevelUp: null, unlocked: [] };
    try {
      if (!isObj(e)) return out;
      st.rescues.n++; ses.rescues++;
      const w = tracker(e.wave);
      w.rescues++;
      if (e.correct) { st.rescues.ok++; ses.rescuesOk++; w.rescueOk++; if (e.allyName) out.allyLevelUp = giveXp(e.allyName, XP.rescue); }
      out.unlocked = checkUnlocks();
      save(); saveSession();
    } catch (err) { warn('onRescue', err); }
    return out;
  }
  function allyLevel(name) {
    try {
      const al = st.allies[slug(name)] ? Object.assign({ key: slug(name) }, st.allies[slug(name)]) : resolveAlly(name);
      if (!al) return { level: 0, xp: 0, next: null, title: '', perk: '', perks: [], max: 3 };
      const rec = st.allies[al.key] || { xp: 0 };
      const lv = levelsFor(al.type);
      let level = 0; lv.forEach((x) => { if (rec.xp >= x.xp) level++; });
      const cur = level ? lv[level - 1] : null;
      const tn = (allyTypes()[al.type] || {}).name || cap(al.type);
      return { name: al.name, key: al.key, type: al.type, typeName: tn, level, xp: rec.xp, next: lv[level] ? lv[level].xp : null, prev: cur ? cur.xp : 0,
        title: cur ? cur.title : tn.toUpperCase(), perk: cur ? cur.perk : null, perkText: cur ? perkText(cur.perk) : '', perks: lv.slice(0, level).map((x) => x.perk).filter(Boolean),
        unlockBanter: cur ? cur.unlockBanter : '', max: lv.length, levels: lv };
    } catch (err) { warn('allyLevel', err); return { level: 0, xp: 0, next: null, title: '', perk: '', perks: [], max: 3 }; }
  }

  // ---------------------------------------------------------------------------
  // SEED (class code). Session only.
  // ---------------------------------------------------------------------------
  function hashStr(s) {
    let h = 1779033703 ^ s.length;
    for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function cleanSeed(code) { return String(code == null ? '' : code).toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 16); }
  function setSeed(code) { try { ses.seed = cleanSeed(code); if (ses.seed) ses.classCode = ses.seed; saveSession(); } catch (e) { warn('setSeed', e); } return ses.seed; }
  function getSeed() { return ses.seed || ''; }
  function rng(salt) {
    if (!ses.seed) return null;
    return mulberry32(hashStr(ses.seed + (salt == null ? '' : '|' + salt)));
  }

  // ---------------------------------------------------------------------------
  // CONTRACTS
  // ---------------------------------------------------------------------------
  function pub(c) { return { id: c.id, name: c.name, desc: c.desc, scrap: c.scrap }; }
  function contractsFor(wave) {
    try {
      wave = Math.max(1, wave | 0);
      const pool = contractDefs().filter((c) => wave >= c.minWave && (!c.boss || isBossWave(wave)));
      const r = mulberry32(hashStr('contracts|' + (ses.seed || '') + '|' + wave));
      for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
      const pick = pool.slice(0, 2);
      if (!active || active.wave !== wave) { active = { wave, ids: pick.map((c) => c.id), picked: null }; tracker(wave); }
      return pick.map(pub);
    } catch (e) { warn('contractsFor', e); return []; }
  }
  function pickContract(id) {
    if (!active) return false;
    active.picked = id && active.ids.indexOf(id) >= 0 ? id : null;
    return true;
  }
  function onWaveEnd(o) {
    const out = { completed: [], unlocked: [] };
    try {
      o = o || {};
      const wave = Math.max(1, o.wave | 0);
      if (!active || active.wave !== wave) contractsFor(wave);
      const w = tracker(wave);
      const nz = (v, d) => (v == null ? d : Array.isArray(v) ? v.length : num(+v, d));
      const stats = {
        cleared: !!o.cleared, alliesNetted: nz(o.alliesNetted, 0), energyLost: nz(o.energyLost, 0),
        freezes: Math.max(nz(o.freezes, 0), w.freezes), firstTryStreakMax: Math.max(nz(o.firstTryStreakMax, 0), w.firstTryStreakMax),
        timeouts: w.timeouts, wrong: w.wrong, firstTryOk: w.firstTryOk, contractionFirstTry: w.contractionFirstTry,
        distinctActions: Object.keys(w.acts).length, rescueOk: w.rescueOk, rescues: w.rescues, assist: !!o.assist,
        planeErrors: Math.max(w.planeErrors, nz(o.planeErrors, 0)), quick: w.quick, byAct: w.byAct, studied: w.studied,
        boss: o.boss != null ? !!o.boss : isBossWave(wave), alliesTaken: o.alliesTaken != null ? nz(o.alliesTaken, 0) : o.draggedOff != null ? nz(o.draggedOff, 0) : null,
        netterKills: nz(o.netterKills, 0),
      };
      lastMissed = Object.assign({}, w.missed);
      if (stats.cleared && stats.boss) { st.totals.wardens++; ses.wardens++; }
      if (stats.cleared) {
        const defs = contractDefs();
        const ids = active.picked ? [active.picked] : active.ids;
        ids.forEach((id) => {
          const c = defs.find((d) => d.id === id);
          if (c && goalMet(c, stats)) {
            out.completed.push({ id: c.id, name: c.name, scrap: c.scrap });
            st.contracts.done[c.id] = (st.contracts.done[c.id] | 0) + 1;
            st.totals.contracts++; ses.contracts++;
          }
        });
        st.totals.waves++; ses.waves++;
        ses.bestWave = Math.max(ses.bestWave, wave);
      } else ses.wavesFailed++;
      if (o.assist) ses.assist = true;
      out.stats = stats;
      out.unlocked = checkUnlocks();
      active = null; wt = null;
      save(); saveSession();
    } catch (e) { warn('onWaveEnd', e); }
    return out;
  }

  // ---------------------------------------------------------------------------
  // COSMETICS
  // ---------------------------------------------------------------------------
  function equipped(slot) {
    const all = cosmetics().filter((c) => c.slot === slot);
    const id = st.cosmetics.equipped[slot];
    return all.find((c) => c.id === id && (isUnlocked(c.id) || !c.unlock)) || all.find((c) => !c.unlock) || all[0] || null;
  }
  function cosmetic() {
    try {
      const v = equipped('visor'), t = equipped('trail');
      return { visor: v ? v.id : null, trail: t ? t.id : null, visorColor: v ? v.color : null, trailColor: t ? t.color : null, visorName: v ? v.name : '', trailName: t ? t.name : '' };
    } catch (e) { warn('cosmetic', e); return { visor: null, trail: null, visorColor: null, trailColor: null }; }
  }
  function equip(id) {
    try {
      const c = cosmetics().find((x) => x.id === id);
      if (!c) return false;
      if (c.unlock && !isUnlocked(c.id)) { checkUnlocks(); if (!isUnlocked(c.id)) return false; }
      st.cosmetics.equipped[c.slot] = c.id;
      save();
      return true;
    } catch (e) { warn('equip', e); return false; }
  }

  // ---------------------------------------------------------------------------
  // REPORT DATA
  // ---------------------------------------------------------------------------
  function droneSave() { try { return SEHS.DroneSave && SEHS.DroneSave.load ? SEHS.DroneSave.load() : null; } catch (e) { return null; } }
  function mcqByTopic(since) {
    const sv = droneSave(), T = C().MCQ_TOPICS || {};
    const out = {};
    Object.keys(T).forEach((k) => { out[k] = { topic: k, name: T[k], n: 0, ok: 0, life: 0, lifeOk: 0 }; });
    ((sv && sv.log) || []).forEach((e) => {
      if (!e || (e.source && e.source !== 'mcq') || !e.topic) return;
      const r = out[e.topic] || (out[e.topic] = { topic: e.topic, name: T[e.topic] || e.topic, n: 0, ok: 0, life: 0, lifeOk: 0 });
      r.life++; if (e.correct) r.lifeOk++;
      if (num(e.t, 0) >= since) { r.n++; if (e.correct) r.ok++; }
    });
    return Object.keys(out).map((k) => out[k]);
  }
  function confusedPairs(src, n) {
    const arr = [];
    for (const k in src) for (const c in src[k]) arr.push({ action: actionName(k), chose: c, n: src[k][c] });
    return arr.sort((a, b) => b.n - a.n || a.action.localeCompare(b.action)).slice(0, n || 3);
  }
  function reportData() {
    const sv = droneSave();
    const rows = actions().map((a) => {
      const m = mastery(a.key), s = ses.actions[a.key] || { firstTry: 0, firstTryOk: 0, seen: 0 };
      return { key: a.key, name: a.name, kind: a.kind, status: m.status, label: m.label, streak: m.streak, need: m.need,
        sFt: s.firstTry, sOk: s.firstTryOk, sPct: pct(s.firstTryOk, s.firstTry), lFt: m.firstTry, lOk: m.firstTryOk, lPct: m.accuracy };
    });
    let cal = {};
    try { if (sv && SEHS.Workshop && SEHS.Workshop.calibration) cal = SEHS.Workshop.calibration(sv); } catch (e) { cal = {}; }
    const out = {
      name: st.student.name, classCode: ses.classCode || ses.seed || '', date: new Date(), start: new Date(ses.start),
      wavesCleared: ses.waves, wavesFailed: ses.wavesFailed, bestWave: Math.max(sv ? sv.bestWave | 0 : 0, ses.bestWave | 0),
      freezes: ses.freezes, firstTry: ses.firstTry, firstTryOk: ses.firstTryOk, firstPct: pct(ses.firstTryOk, ses.firstTry),
      timeouts: ses.timeouts, assist: ses.assist, rescues: ses.rescues, rescuesOk: ses.rescuesOk, contracts: ses.contracts,
      movements: rows.filter((r) => r.kind === 'movement'), contractions: rows.filter((r) => r.kind === 'contraction'),
      mcq: mcqByTopic(ses.start).map((r) => Object.assign(r, { cal: cal[r.topic] != null ? Math.round(cal[r.topic] * 100) : null })),
      confused: confusedPairs(ses.confusion, 3), confusedLife: confusedPairs(st.confusion, 3),
      faults: sv ? sv.faultLog.length : 0, mastered: masteredCount(), total: actions().length,
      correct: ses.correct, freezePct: pct(ses.correct, ses.freezes), planeErrors: ses.planeErrors, wardens: ses.wardens,
      minutes: Math.max(0, Math.round((Date.now() - ses.start) / 60000)),
    };
    const mq = out.mcq.reduce((a, r) => [a[0] + r.ok, a[1] + r.n], [0, 0]);
    out.mcqOk = mq[0]; out.mcqN = mq[1]; out.mcqPct = pct(mq[0], mq[1]);
    out.next = nextSteps(out);
    return out;
  }
  function pairLine(c) { return fmt(rt('confusedPairLine', 'Chose {chosen} when the answer was {correct} (×{n})'), { chosen: c.chose, correct: c.action, n: c.n }); }
  // "What to review next": at most 4 short, teacher-readable pointers.
  function nextSteps(d) {
    const out = [];
    const acts = d.movements.concat(d.contractions).filter((r) => r.sFt > 0 && (r.status === 'review' || (r.sPct != null && r.sPct < 70)))
      .sort((a, b) => a.sPct - b.sPct).slice(0, 2);
    acts.forEach((r) => out.push('Revise ' + r.name + ' (' + r.sOk + '/' + r.sFt + ' first try): open it in the Movement Codex.'));
    const cp = (d.confused[0] || d.confusedLife[0]);
    if (cp && cp.n >= 2) out.push('Compare ' + cp.action + ' with ' + cp.chose + ' (mixed up ×' + cp.n + ').');
    const weak = d.mcq.filter((r) => r.n >= 2 && pct(r.ok, r.n) < 60).sort((a, b) => a.ok / a.n - b.ok / b.n)[0];
    if (weak) out.push('Exam topic to revisit: ' + weak.name + ' (' + weak.ok + '/' + weak.n + ').');
    if (d.planeErrors) out.push('Check the plane first: ' + d.planeErrors + ' answer' + (d.planeErrors === 1 ? ' was' : 's were') + ' in the wrong plane.');
    if (d.timeouts >= 2) out.push(d.timeouts + ' timeouts: try Practice mode to think each freeze through.');
    return out.slice(0, 4);
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function dateStr(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
  function fr(ok, n) { return n ? ok + '/' + n + ' (' + pct(ok, n) + '%)' : '-'; }
  function reportText() {
    try {
      const d = reportData();
      const L = [], lb = (k, dflt) => rt('labels.' + k, dflt);
      L.push('KINETIC ESCAPE · DRONE DEFENSE · ' + rt('title', 'SESSION REPORT'));
      L.push('Student: ' + (d.name || '-') + ' | Class: ' + (d.classCode || '-') + ' | ' + dateStr(d.date) + ' | ' + lb('timePlayed', 'Time played') + ': ' + d.minutes + ' min');
      L.push('Waves cleared: ' + d.wavesCleared + (d.wavesFailed ? ' (' + d.wavesFailed + ' failed)' : '') + ' | ' + lb('bestWave', 'Best wave') + ': ' + (d.bestWave || '-') +
        ' | Freezes: ' + d.freezes + ' | ' + lb('firstTry', 'First-try correct') + ': ' + fr(d.firstTryOk, d.firstTry));
      L.push(lb('planeErrors', 'Wrong-plane answers') + ': ' + d.planeErrors + ' | ' + lb('timeouts', 'Timeouts') + ': ' + d.timeouts + ' | ' + lb('mcqAccuracy', 'Exam terminal accuracy') + ': ' + fr(d.mcqOk, d.mcqN) +
        ' | ' + rt('assistUsed', 'Assist (practice) mode used') + ': ' + (d.assist ? 'YES' : 'no'));
      const line = (r) => '  ' + r.name + ': ' + fr(r.sOk, r.sFt) + (r.lFt > r.sFt ? ' [all time ' + fr(r.lOk, r.lFt) + ']' : '') + ' ' + r.label;
      L.push('TRANSVERSE MOVEMENTS (first try, this session):');
      d.movements.forEach((r) => L.push(line(r)));
      L.push('CONTRACTIONS (first try, this session):');
      d.contractions.forEach((r) => L.push(line(r)));
      L.push('EXAM TOPICS (this session):');
      d.mcq.forEach((r) => L.push('  ' + r.name + ': ' + fr(r.ok, r.n) + (r.cal != null ? ' | calibration ' + r.cal + '%' : '')));
      const cp = d.confused.length ? d.confused : d.confusedLife;
      L.push(rt('headings.confusions', 'Most-confused pairs').toUpperCase() + (d.confused.length || !cp.length ? '' : ' (all time)') + ':');
      if (cp.length) cp.forEach((c) => L.push('  ' + pairLine(c))); else L.push('  ' + rt('noConfusions', 'No repeated mix-ups.'));
      L.push(lb('mastered', 'Mastered') + ': ' + d.mastered + '/' + d.total + ' | Fault Log: ' + d.faults + ' item' + (d.faults === 1 ? '' : 's') + ' | Contracts: ' + d.contracts);
      if (d.next.length) { L.push(rt('headings.nextSteps', 'What to review next').toUpperCase() + ':'); d.next.forEach((x) => L.push('  - ' + x)); }
      return L.join('\n');
    } catch (e) { warn('reportText', e); return 'Report unavailable.'; }
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
      const ua = navigator.userActivation;
      if (ua && !ua.hasBeenActive) return;
      const A = SEHS.Audio; if (A && typeof A[name] === 'function') A[name](arg);
    } catch (e) { /* optional */ }
  }
  function wantsReduce(o) {
    if (o && o.reduce != null) return !!o.reduce;
    try {
      return !!(window.game && window.game.fx && window.game.fx.reduce) || !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { return false; }
  }

  // ---------------- top-down demo canvases ----------------
  // a/b: TopPose LIB name or [threatId, key]; joints: ⊙ highlight targets.
  const DEMOS = {
    horizontal_adduction: { a: ['crossSwat', 'stage'], b: ['crossSwat', 'success'], joints: ['shoulderR'] },
    horizontal_abduction: { a: ['backhandSwat', 'stage'], b: ['backhandSwat', 'success'], joints: ['shoulderR'] },
    rotation: { a: 'twistR', b: 'twistL', joints: ['trunk'] },
    medial_rotation: { a: ['discThrow', 'stage'], b: ['discThrow', 'success'], joints: ['shoulderR'], launcher: 'R' },
    lateral_rotation: { a: ['discWindup', 'stage'], b: ['discWindup', 'success'], joints: ['shoulderR'], launcher: 'R' },
    pronation: { a: 'palmUp', b: 'palmDown', joints: ['foreR'] },
    supination: { a: 'palmDown', b: 'palmUp', joints: ['foreR'] },
    concentric: { a: ['discSnap', 'stage'], b: ['discSnap', 'success'], joints: ['shoulderR'], launcher: 'R' },
    eccentric: { a: ['heavyCatch', 'stage'], b: ['heavyCatch', 'success'], joints: ['shoulderR'] },
    isometric: { a: ['tetherPull', 'success'], b: ['tetherPull', 'success'], joints: ['shoulderR'], tremble: true },
  };
  function pose(spec) {
    const P = SEHS.TopPose;
    if (!P) return null;
    if (Array.isArray(spec)) return P.threat(spec[0], spec[1]);
    const L = P.LIB[spec];
    if (!L) return P.mk();
    const o = P.clone(L); o.mus = L.mus; return o;
  }
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  function makeDemo(canvas, key, opts) {
    const AT = SEHS.AndroidTop, P = SEHS.TopPose;
    const spec = DEMOS[key];
    if (!AT || !P || !spec || !canvas.getContext) return null;
    const d = { canvas, key, spec, rig: new AT(), t: opts.offset || 0, scale: opts.scale || 0.52, cy: opts.cy || 0.6, dim: !!opts.dim, A: pose(spec.a), B: pose(spec.b), last: -1 };
    d.rig.update(d.A, 0.016);
    return d;
  }
  const CYCLE = 3.4;
  function drawDemo(d, dt, reduce, playing) {
    const cv = d.canvas, ctx = cv.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = cv.clientWidth || 160, hh = cv.clientHeight || 130;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(hh * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(hh * dpr); }
    const P = SEHS.TopPose, sp = d.spec;
    let p, alpha = 1;
    if (!playing) { p = P.clone(d.B); p.mus = d.B.mus; d.rig.update(p, 0.2); }
    else {
      d.t = (d.t + dt) % CYCLE;
      const t = d.t;
      if (t < 0.5) p = P.lerp(d.A, d.A, 0);
      else if (t < 1.5) p = P.lerp(d.A, d.B, ease((t - 0.5) / 1.0));
      else p = P.lerp(d.B, d.B, 1);
      if (t >= 1.5) p.mus = d.B.mus;
      if (sp.tremble && !reduce) p = P.jitter(p, 0.9, ['R.rot', 'R.el']);
      if (t > CYCLE - 0.45) alpha = Math.max(0.15, (CYCLE - t) / 0.45);
      if (t < 0.15) alpha = 0.15 + (t / 0.15) * 0.85;
      if (d.last > t) d.rig.reset(); // new loop: no antagonist glow on the return
      d.last = t;
      d.rig.update(p, Math.max(0.001, dt));
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, hh);
    const cx = w / 2, cy = hh * d.cy, R = Math.min(w, hh) * 0.46;
    // the transverse plane: faint ring + crosshair
    ctx.strokeStyle = 'rgba(86,224,255,0.14)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([3, 5]);
    ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = d.dim ? 0.35 : alpha;
    try {
      d.rig.draw(ctx, p, cx, cy, { scale: d.scale, reduce: !!reduce, neutral: d.dim, highlight: d.dim ? null : { joints: sp.joints, arcs: true }, launcher: sp.launcher || null });
    } catch (e) { /* demo is optional */ }
    ctx.globalAlpha = 1;
  }

  function allyCanvas(cv, al) {
    const AT = SEHS.AndroidTop, P = SEHS.TopPose;
    if (!AT || !P || !cv.getContext) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = 64, hh = 64;
    cv.width = w * dpr; cv.height = hh * dpr;
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    try { const r = new AT(); const p = pose('guard'); r.update(p, 0.1); r.draw(ctx, p, w / 2, hh * 0.58, { scale: 0.55, visor: al.visor, allyRole: al.visor, reduce: true }); } catch (e) { /* optional */ }
  }

  // ---------------------------------------------------------------------------
  // UI: shared overlay frame
  // ---------------------------------------------------------------------------
  let U = null; // open overlay state
  function mount(rootEl, kind, opts) {
    if (U) close();
    opts = opts || {};
    let root = rootEl || document.body, fixed = root === document.body;
    try { const r = root.getBoundingClientRect(); if (r.width < 640 || r.height < 420) fixed = true; } catch (e) { fixed = true; }
    if (fixed) root = document.body;
    const reduce = wantsReduce(opts);
    const el = h('div', { class: 'pg pg-k-' + kind + (fixed ? ' pg-fixed' : '') + (reduce ? ' pg-reduce' : ''), role: 'dialog', 'aria-modal': 'true' });
    el.appendChild(h('div', { class: 'pg-bg', 'aria-hidden': 'true' }));
    U = { el, kind, root, fixed, reduce, onClose: opts.onClose, prevFocus: document.activeElement, demos: [], raf: 0, lastT: 0, tab: null };
    el.addEventListener('keydown', (e) => e.stopPropagation());
    window.addEventListener('keydown', onKey, true);
    return U;
  }
  function onKey(e) {
    if (!U) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (!U.el.contains(e.target)) e.stopPropagation();
  }
  function close() {
    if (!U) return;
    const u = U; U = null;
    window.removeEventListener('keydown', onKey, true);
    cancelAnimationFrame(u.raf);
    if (u.el.parentNode) u.el.parentNode.removeChild(u.el);
    const pr = document.getElementById('pg-print'); if (pr) pr.remove();
    try { if (u.prevFocus && u.prevFocus.focus) u.prevFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    if (typeof u.onClose === 'function') { try { u.onClose(); } catch (e) { warn('onClose', e); } }
  }
  function header(kicker, title, tabs, extra) {
    const closeBtn = h('button', { class: 'pg-close', 'aria-label': 'Close (Esc)', title: 'Close (Esc)', onclick: () => { snd('scrapCoin'); close(); } }, [h('span', { text: '✕' }), h('kbd', { text: 'Esc' })]);
    U.closeBtn = closeBtn;
    return h('header', { class: 'pg-head' }, [
      h('div', { class: 'pg-brand' }, [h('div', { class: 'pg-kicker', text: kicker }), h('h2', { class: 'pg-title', text: title })]),
      tabs || h('div', { class: 'pg-spacer' }), extra || null, closeBtn,
    ]);
  }
  function startLoop() {
    const tick = (now) => {
      if (!U) return;
      const dt = Math.min(0.1, (now - (U.lastT || now)) / 1000);
      U.lastT = now;
      U.acc = (U.acc || 0) + dt;
      if (U.acc >= 1 / 30) {
        const step = U.acc; U.acc = 0;
        U.demos.forEach((d) => {
          if (!d.canvas.isConnected || d.canvas.offsetParent === null) return;
          const playing = !U.reduce || d.canvas.closest('.pg-hot');
          drawDemo(d, step, U.reduce, !!playing);
        });
        if (U.axisEls && now - (U.axisT || 0) > 1000) {
          U.axisT = now;
          const nm = axisName();
          U.axisEls.forEach((x) => { if (x.textContent !== nm) x.textContent = nm; });
        }
      }
      U.raf = requestAnimationFrame(tick);
    };
    U.raf = requestAnimationFrame(tick);
  }
  function axisName() { try { return C().axisName ? C().axisName('transverse') : ''; } catch (e) { return ''; } }
  function axisTag() { const s = h('span', { class: 'pg-axis-n', text: axisName() }); (U.axisEls || (U.axisEls = [])).push(s); return h('span', { class: 'pg-axis', title: 'The axis points out of the screen' }, [h('b', { text: '⊙' }), s]); }

  // ---------------------------------------------------------------------------
  // UI: Codex
  // ---------------------------------------------------------------------------
  function openCodex(rootEl, opts) {
    try {
      opts = opts || {};
      mount(rootEl, 'codex', opts);
      const tabs = [['codex', 'CODEX'], ['badges', 'BADGES'], ['allies', 'ALLIES']];
      U.tabBtns = {};
      const nav = h('nav', { class: 'pg-tabs', role: 'tablist', 'aria-label': 'Codex sections' });
      tabs.forEach(([id, name]) => {
        const b = h('button', { class: 'pg-tab', role: 'tab', id: 'pg-tab-' + id, 'aria-controls': 'pg-pane-' + id, onclick: () => setTab(id, true) }, [h('span', { class: 'pg-tab-l', text: name }), h('span', { class: 'pg-tab-s' })]);
        U.tabBtns[id] = b; nav.appendChild(b);
      });
      nav.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        const ids = tabs.map((t) => t[0]);
        const i = (ids.indexOf(U.tab) + (e.key === 'ArrowRight' ? 1 : ids.length - 1)) % ids.length;
        setTab(ids[i], true); U.tabBtns[ids[i]].focus(); e.preventDefault();
      });
      const mc = masteredCount(), tot = actions().length;
      const meter = h('div', { class: 'pg-meter', role: 'status', 'aria-label': mc + ' of ' + tot + ' mastered' }, [h('b', { text: mc + '/' + tot }), h('span', { text: label('mastered') })]);
      U.el.appendChild(header(rt('codexKicker', 'DRONE DEFENSE'), rt('codexTitle', 'MOVEMENT CODEX'), nav, meter));
      U.panes = {};
      const main = h('main', { class: 'pg-main' });
      tabs.forEach(([id]) => { const p = h('section', { class: 'pg-pane', id: 'pg-pane-' + id, role: 'tabpanel', 'aria-labelledby': 'pg-tab-' + id }); U.panes[id] = p; main.appendChild(p); });
      U.main = main;
      U.el.appendChild(main);
      U.root.appendChild(U.el);
      U.sel = actionByKey(opts.action) ? actionByKey(opts.action).key : (actions()[0] || {}).key;
      if (opts.action) studied(U.sel);
      // narrow screens stack the detail under the grid: jump straight to it
      if (opts.action) setTimeout(() => { try { if (U && U.detail && U.detail.getBoundingClientRect().top > window.innerHeight * 0.6) U.detail.scrollIntoView({ block: 'start' }); } catch (e) { /* ignore */ } }, 0);
      setTab(opts.tab && U.panes[opts.tab] ? opts.tab : 'codex');
      startLoop();
      main.tabIndex = -1;
      setTimeout(() => { if (U && U.main) U.main.focus({ preventScroll: true }); }, 30);
      return { el: U.el, close, tab: (t) => setTab(t) };
    } catch (e) { warn('openCodex', e); close(); return null; }
  }
  function setTab(id, user) {
    if (!U || !U.panes || !U.panes[id]) return false;
    U.tab = id;
    for (const k in U.tabBtns) {
      const on = k === id, b = U.tabBtns[k];
      b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1;
      U.panes[k].hidden = !on;
    }
    U.demos = []; U.axisEls = [];
    const p = U.panes[id];
    p.textContent = '';
    if (id === 'codex') renderCodex(p);
    else if (id === 'badges') renderBadges(p);
    else renderAllies(p);
    U.tabBtns.badges.lastChild.textContent = st.cosmetics.unlocked.length ? String(cosmetics().filter((c) => isUnlocked(c.id) || !c.unlock).length) + '/' + cosmetics().length : '';
    U.tabBtns.codex.lastChild.textContent = masteredCount() + '/' + actions().length;
    U.main.scrollTop = 0;
    if (user) snd('scrapCoin');
    return true;
  }
  function statusChip(m) {
    return h('span', { class: 'pg-chip s-' + m.status }, [h('i', { 'aria-hidden': 'true' }), m.label]);
  }
  function pips(m) {
    return h('span', { class: 'pg-pips', 'aria-label': m.streak + ' of ' + m.need + ' first-try in a row' }, Array.from({ length: m.need }, (_, i) => h('i', { class: i < m.streak || m.mastered ? 'on' : '' })));
  }
  function renderCodex(p) {
    const wrap = h('div', { class: 'pg-codex' });
    const grid = h('div', { class: 'pg-grid-wrap' });
    const groups = [['movement', rt('codexMovements', 'TRANSVERSE MOVEMENTS')], ['contraction', rt('codexContractions', 'CONTRACTION TYPES')]];
    U.cards = {};
    groups.forEach(([kind, title]) => {
      const items = actions().filter((a) => a.kind === kind);
      if (!items.length) return;
      const g = h('div', { class: 'pg-grid' });
      items.forEach((a, i) => {
        const m = mastery(a.key);
        const cv = h('canvas', { class: 'pg-demo', 'aria-hidden': 'true' });
        const card = h('button', { class: 'pg-card s-' + m.status + (a.key === U.sel ? ' sel' : ''), 'data-key': a.key, 'aria-pressed': a.key === U.sel ? 'true' : 'false',
          'aria-label': a.name + ', ' + m.label + (m.accuracy != null ? ', first-try ' + m.accuracy + '%' : ''),
          onclick: () => select(a.key, true), onmouseenter: () => card.classList.add('pg-hot'), onmouseleave: () => card.classList.remove('pg-hot'),
          onfocus: () => card.classList.add('pg-hot'), onblur: () => card.classList.remove('pg-hot') }, [
          h('div', { class: 'pg-demo-box' }, [cv, m.mastered ? h('span', { class: 'pg-medal', 'aria-hidden': 'true', text: '★' }) : null]),
          h('div', { class: 'pg-card-name', text: a.name }),
          h('div', { class: 'pg-card-row' }, [statusChip(m), pips(m)]),
          h('div', { class: 'pg-acc' }, [h('i', { style: 'width:' + (m.accuracy || 0) + '%' }), h('span', { text: m.accuracy != null ? m.accuracy + '% first try' : 'not answered yet' })]),
        ]);
        U.cards[a.key] = card;
        g.appendChild(card);
        const d = makeDemo(cv, a.key, { offset: (i * 0.53) % CYCLE, scale: 0.55, dim: m.status === 'locked' });
        if (d) U.demos.push(d);
      });
      grid.appendChild(h('section', { class: 'pg-group' }, [h('h3', { class: 'pg-h', text: title }), g]));
    });
    grid.appendChild(h('p', { class: 'pg-note', text: fmt(rt('masteryRule', 'MASTERED = {n} first-try correct answers in a row in freezes (practice/assist answers do not count). One wrong answer resets the run.'), { n: masteryNeed() }) }));
    U.detail = h('aside', { class: 'pg-detail', 'aria-live': 'polite' });
    wrap.appendChild(grid); wrap.appendChild(U.detail);
    p.appendChild(wrap);
    renderDetail();
  }
  function select(key, user) {
    if (!U || !U.cards) return;
    U.sel = key;
    for (const k in U.cards) { U.cards[k].classList.toggle('sel', k === key); U.cards[k].setAttribute('aria-pressed', k === key ? 'true' : 'false'); }
    renderDetail();
    if (user) {
      studied(key);
      snd('lockOn');
      if (U.detail && window.matchMedia && window.matchMedia('(max-width: 820px)').matches) { try { U.detail.scrollIntoView({ block: 'start', behavior: U.reduce ? 'auto' : 'smooth' }); } catch (e) { /* ignore */ } }
    }
  }
  function renderDetail() {
    const dEl = U.detail; if (!dEl) return;
    U.demos = U.demos.filter((x) => !x.big);
    dEl.textContent = '';
    const a = actionByKey(U.sel); if (!a) return;
    const m = mastery(a.key);
    const cv = h('canvas', { class: 'pg-demo-big', 'aria-hidden': 'true' });
    const conf = st.confusion[a.key] || {};
    const confTop = Object.keys(conf).sort((x, y) => conf[y] - conf[x]).slice(0, 2);
    const row = (lab, val, cls) => (val ? h('div', { class: 'pg-dl ' + (cls || '') }, [h('dt', { text: lab }), h('dd', { text: val })]) : null);
    dEl.appendChild(h('div', { class: 'pg-d-head' }, [
      h('div', {}, [h('div', { class: 'pg-kicker', text: (a.kind === 'contraction' ? rt('contraction', 'CONTRACTION') : (a.plane || '').toUpperCase()) }), h('h3', { class: 'pg-d-title', text: a.name })]),
      statusChip(m),
    ]));
    dEl.appendChild(h('div', { class: 'pg-demo-box big pg-hot' }, [cv, a.kind === 'movement' ? axisTag() : null]));
    dEl.appendChild(h('p', { class: 'pg-def', text: a.definition }));
    dEl.appendChild(h('dl', { class: 'pg-dls' }, [
      row(rt('joint', 'Joint'), a.joint),
      row(rt('example', 'Sport example'), a.example),
      row(rt('droneUse', 'In Drone Defense'), m.status === 'locked' ? rt('lockedUse', 'Meet it in a freeze to log this.') : a.droneUse, m.status === 'locked' ? 'dim' : ''),
      row(rt('muscles', 'Prime movers'), (a.musclesPrime || []).join(', ')),
    ]));
    const st2 = h('div', { class: 'pg-d-stats' }, [
      h('div', {}, [h('b', { text: m.accuracy != null ? m.accuracy + '%' : '-' }), h('span', { text: 'first-try accuracy' })]),
      h('div', {}, [h('b', { text: m.firstTryOk + '/' + m.firstTry }), h('span', { text: 'first-try correct' })]),
      h('div', {}, [pips(m), h('span', { text: m.mastered ? label('mastered') : m.streak + '/' + m.need + ' in a row' })]),
    ]);
    dEl.appendChild(st2);
    if (confTop.length) dEl.appendChild(h('p', { class: 'pg-conf' }, [h('b', { text: 'Mixed up with: ' }), confTop.map((c) => c + ' ×' + conf[c]).join(', ')]));
    const d = makeDemo(cv, a.key, { scale: 1.12, cy: 0.62, dim: false });
    if (d) { d.big = true; U.demos.push(d); }
  }

  // ---------------- badges & cosmetics ----------------
  function renderBadges(p) {
    const acts = actions();
    const badges = h('div', { class: 'pg-badges' }, acts.map((a) => {
      const m = mastery(a.key);
      return h('div', { class: 'pg-badge s-' + m.status, role: 'img', 'aria-label': a.name + ': ' + m.label }, [
        h('div', { class: 'pg-hex' }, [h('span', { text: m.mastered ? '★' : m.streak + '/' + m.need })]),
        h('b', { text: a.name }), h('span', { text: m.label }),
      ]);
    }));
    p.appendChild(h('div', { class: 'pg-pane-head' }, [h('h3', { class: 'pg-h', text: rt('badgesTitle', 'MASTERY BADGES') }), h('p', { class: 'pg-sub', text: masteredCount() + ' of ' + acts.length + ' earned. Badges unlock visor colours and strike trails.' })]));
    p.appendChild(badges);
    const cur = cosmetic();
    ['visor', 'trail'].forEach((slot) => {
      const items = cosmetics().filter((c) => c.slot === slot);
      const g = h('div', { class: 'pg-cos-grid' });
      items.forEach((c) => {
        const open = !c.unlock || isUnlocked(c.id), on = cur[slot] === c.id;
        const sw = h('span', { class: 'pg-sw pg-sw-' + slot + (c.color ? '' : ' none'), style: c.color ? '--c:' + c.color : null, 'aria-hidden': 'true' });
        g.appendChild(h('div', { class: 'pg-cos' + (open ? '' : ' locked') + (on ? ' on' : '') }, [
          sw,
          h('div', { class: 'pg-cos-t' }, [h('b', { text: c.name }), h('span', { text: open ? (on ? 'Equipped' : c.unlock ? 'Unlocked' : 'Starter') : '🔒 ' + unlockText(c) })]),
          h('button', { class: 'pg-btn sm' + (on ? ' on' : ''), disabled: !open || on || null, 'aria-label': (on ? 'Equipped: ' : 'Equip ') + c.name,
            onclick: () => { if (equip(c.id)) { snd('upgradeBuy'); setTab('badges'); } } }, [on ? 'EQUIPPED' : open ? 'EQUIP' : 'LOCKED']),
        ]));
      });
      p.appendChild(h('div', { class: 'pg-pane-head' }, [h('h3', { class: 'pg-h', text: slot === 'visor' ? rt('visors', 'VISORS') : rt('trails', 'STRIKE TRAILS') })]));
      p.appendChild(g);
    });
    const done = Object.keys(st.contracts.done);
    p.appendChild(h('div', { class: 'pg-pane-head' }, [h('h3', { class: 'pg-h', text: rt('contractsTitle', 'CONTRACTS') }), h('p', { class: 'pg-sub', text: st.totals.contracts + ' completed in total.' })]));
    if (done.length) {
      const defs = contractDefs();
      p.appendChild(h('ul', { class: 'pg-contracts' }, done.map((id) => { const c = defs.find((x) => x.id === id) || { name: id }; return h('li', {}, [h('b', { text: c.name }), h('span', { text: '×' + st.contracts.done[id] })]); })));
    } else p.appendChild(h('p', { class: 'pg-empty', text: 'No contracts completed yet. Each wave offers two optional goals.' }));
  }

  // ---------------- allies ----------------
  function renderAllies(p) {
    p.appendChild(h('div', { class: 'pg-pane-head' }, [h('h3', { class: 'pg-h', text: rt('alliesTitle', 'CREW LEVELS') }), h('p', { class: 'pg-sub', text: 'Allies gain XP when you win a freeze that protects them, and when you cut them free.' })]));
    const keys = roster().map((r) => slug(r.id || r.name));
    Object.keys(st.allies).forEach((k) => { if (keys.indexOf(k) < 0) keys.push(k); });
    const g = h('div', { class: 'pg-allies' });
    keys.forEach((k) => {
      const r = roster().find((x) => slug(x.id || x.name) === k);
      const al = r ? { key: k, name: r.name, unit: r.unit, type: r.type, visor: r.visor } : Object.assign({ key: k, visor: '#56e0ff', unit: '' }, st.allies[k]);
      const L = allyLevel(k);
      const span = L.next != null ? L.next - L.prev : 1, into = L.next != null ? L.xp - L.prev : 1;
      const cv = h('canvas', { class: 'pg-ally-cv', 'aria-hidden': 'true', style: 'width:64px;height:64px' });
      allyCanvas(cv, al);
      const perks = h('ol', { class: 'pg-perks' }, (L.levels || []).map((lv, i) => h('li', { class: i < L.level ? 'on' : '' }, [
        h('span', { class: 'pg-perk-l', text: 'L' + (i + 1) }), h('span', { class: 'pg-perk-t' }, [h('b', { text: lv.title || '' }), perkText(lv.perk) ? h('span', { text: ' · ' + perkText(lv.perk) }) : null]),
        i >= L.level ? h('span', { class: 'pg-perk-x', text: lv.xp + ' XP' }) : null,
      ])));
      g.appendChild(h('article', { class: 'pg-ally', style: '--v:' + al.visor }, [
        h('div', { class: 'pg-ally-top' }, [cv, h('div', {}, [
          h('div', { class: 'pg-ally-name' }, [h('b', { text: al.name }), h('span', { text: al.unit || '' })]),
          h('div', { class: 'pg-ally-role', text: L.typeName + ' · ' + L.title }),
          h('div', { class: 'pg-lvl' }, [h('span', { class: 'pg-pips' }, Array.from({ length: L.max }, (_, i) => h('i', { class: i < L.level ? 'on' : '' }))), h('span', { text: 'LEVEL ' + L.level })]),
        ])]),
        h('div', { class: 'pg-xp', role: 'img', 'aria-label': L.xp + ' XP' + (L.next != null ? ' of ' + L.next : '') }, [h('i', { style: 'width:' + Math.round(Math.min(1, into / span) * 100) + '%' }), h('span', { text: L.next != null ? L.xp + ' / ' + L.next + ' XP' : L.xp + ' XP · MAX' })]),
        perks,
        firstLine(L.unlockBanter) ? h('p', { class: 'pg-quote', text: '“' + firstLine(L.unlockBanter) + '”' }) : null,
      ]));
    });
    p.appendChild(g);
  }

  // ---------------------------------------------------------------------------
  // UI: Report
  // ---------------------------------------------------------------------------
  function openReport(rootEl, opts) {
    try {
      opts = opts || {};
      mount(rootEl, 'report', opts);
      const d = reportData();
      U.el.appendChild(header(rt('kicker', 'FOR YOUR TEACHER'), rt('title', 'SESSION REPORT'), null, null));
      const main = h('main', { class: 'pg-main pg-rep' });
      U.main = main;
      // identity row
      const nameIn = h('input', { type: 'text', class: 'pg-in', id: 'pg-name', maxlength: '60', autocomplete: 'off', value: d.name || '', placeholder: 'e.g. AB',
        oninput: (e) => { st.student.name = e.target.value.slice(0, 60); save(); refreshText(); } });
      const codeIn = h('input', { type: 'text', class: 'pg-in', id: 'pg-code', maxlength: '16', autocomplete: 'off', value: d.classCode || '', placeholder: rt('classCodePlaceholder', 'e.g. 10B'),
        oninput: (e) => { ses.classCode = cleanSeed(e.target.value); saveSession(); refreshText(); } });
      main.appendChild(h('div', { class: 'pg-id' }, [
        h('label', { class: 'pg-field', for: 'pg-name' }, [h('span', { text: rt('namePrompt', 'Your name or initials (optional):').toUpperCase() }), nameIn]),
        h('label', { class: 'pg-field', for: 'pg-code' }, [h('span', { text: rt('classCodePrompt', 'Class code (optional):').toUpperCase() }), codeIn]),
        h('div', { class: 'pg-field' }, [h('span', { text: 'DATE' }), h('b', { class: 'pg-date', text: dateStr(d.date) })]),
      ]));
      // headline tiles
      const lb = (k, dflt) => rt('labels.' + k, dflt).toUpperCase();
      const tone = (p) => (p == null ? '' : p >= 80 ? 'good' : p < 50 ? 'warn' : '');
      const tile = (v, l, cls) => h('div', { class: 'pg-tile ' + (cls || '') }, [h('b', { text: String(v) }), h('span', { text: l })]);
      main.appendChild(h('div', { class: 'pg-tiles' }, [
        tile(d.wavesCleared, 'WAVES CLEARED' + (d.wavesFailed ? ' · ' + d.wavesFailed + ' FAILED' : '')),
        tile(d.bestWave || '-', lb('bestWave', 'Best wave')),
        tile(d.freezes, 'FREEZES ANSWERED'),
        tile(d.firstPct != null ? d.firstPct + '%' : '-', lb('firstTry', 'First-try correct'), tone(d.firstPct)),
        tile(d.planeErrors, lb('planeErrors', 'Wrong-plane answers'), d.planeErrors ? 'warn' : ''),
        tile(d.timeouts, lb('timeouts', 'Timeouts'), d.timeouts ? 'warn' : ''),
        tile(d.mcqPct != null ? d.mcqPct + '%' : '-', lb('mcqAccuracy', 'Exam terminal accuracy'), tone(d.mcqPct)),
        tile(d.mastered + '/' + d.total, lb('mastered', 'Mastered')),
        tile(d.faults, 'FAULT LOG ITEMS', d.faults ? 'warn' : ''),
        tile(d.assist ? 'YES' : 'NO', rt('assistUsed', 'Assist (practice) mode used').toUpperCase(), d.assist ? 'amber' : ''),
        tile(d.minutes + ' min', lb('timePlayed', 'Time played')),
        tile(d.contracts, 'CONTRACTS DONE'),
      ]));
      // action tables
      const actTable = (title, rows) => h('section', { class: 'pg-sec' }, [
        h('h3', { class: 'pg-h', text: title }),
        h('table', { class: 'pg-tbl' }, [
          h('thead', {}, [h('tr', {}, [h('th', { text: 'Action' }), h('th', { text: 'This session' }), h('th', { text: 'All time' }), h('th', { text: 'Status' })])]),
          h('tbody', {}, rows.map((r) => h('tr', { class: 's-' + r.status }, [
            h('td', { text: r.name }),
            h('td', {}, [bar(r.sPct), h('span', { text: r.sFt ? r.sOk + '/' + r.sFt : '-' })]),
            h('td', { class: 'dim', text: r.lFt ? r.lOk + '/' + r.lFt + ' (' + r.lPct + '%)' : '-' }),
            h('td', {}, [h('span', { class: 'pg-chip s-' + r.status }, [h('i'), r.label])]),
          ]))),
        ]),
      ]);
      main.appendChild(h('div', { class: 'pg-cols' }, [
        actTable('TRANSVERSE MOVEMENTS · FIRST TRY', d.movements),
        h('div', {}, [
          actTable('CONTRACTIONS · FIRST TRY', d.contractions),
          h('section', { class: 'pg-sec' }, [
            h('h3', { class: 'pg-h', text: rt('headings.topics', 'Exam topics').toUpperCase() }),
            h('table', { class: 'pg-tbl' }, [
              h('thead', {}, [h('tr', {}, [h('th', { text: 'Topic' }), h('th', { text: 'This session' }), h('th', { text: 'All time' }), h('th', { text: 'Calib.' })])]),
              h('tbody', {}, d.mcq.map((r) => h('tr', {}, [
                h('td', { text: r.name }),
                h('td', {}, [bar(pct(r.ok, r.n)), h('span', { text: r.n ? r.ok + '/' + r.n : '-' })]),
                h('td', { class: 'dim', text: r.life ? r.lifeOk + '/' + r.life : '-' }),
                h('td', { text: r.cal != null ? r.cal + '%' : '-' }),
              ]))),
            ]),
          ]),
        ]),
      ]));
      // review targets
      const cp = d.confused.length ? d.confused : d.confusedLife;
      const revCols = h('div', { class: 'pg-cols' });
      main.appendChild(revCols);
      revCols.appendChild(h('section', { class: 'pg-sec pg-review' }, [
        h('h3', { class: 'pg-h', text: rt('headings.confusions', 'Most-confused pairs').toUpperCase() + (d.confused.length || !cp.length ? '' : ' (ALL TIME)') }),
        cp.length ? h('ol', { class: 'pg-pairs' }, cp.map((c) => h('li', {}, [h('span', { class: 'pg-arrow', text: 'Answer ' }), h('b', { text: c.action }), h('span', { class: 'pg-arrow', text: ' · chose ' }), h('b', { class: 'bad', text: c.chose }), h('em', { text: ' ×' + c.n })])))
          : h('p', { class: 'pg-empty', text: rt('noConfusions', 'No repeated mix-ups.') }),
      ]));
      if (d.next.length) revCols.appendChild(h('section', { class: 'pg-sec pg-next' }, [
        h('h3', { class: 'pg-h', text: rt('headings.nextSteps', 'What to review next').toUpperCase() }),
        h('ul', { class: 'pg-next-l' }, d.next.map((x) => h('li', { text: x }))),
      ]));
      // copy block
      U.txt = h('textarea', { class: 'pg-txt', readonly: true, rows: '6', 'aria-label': 'Plain-text report', spellcheck: 'false' });
      U.copyMsg = h('span', { class: 'pg-copy-msg', role: 'status', 'aria-live': 'polite' });
      main.appendChild(h('section', { class: 'pg-sec pg-copy' }, [
        h('h3', { class: 'pg-h', text: rt('copyHeading', 'PASTE INTO GOOGLE CLASSROOM') }), U.txt,
      ]));
      U.el.appendChild(main);
      U.el.appendChild(h('footer', { class: 'pg-foot' }, [
        h('p', { class: 'pg-privacy', text: rt('privacy', 'Privacy: this report stays on this device. Nothing is uploaded; your name is saved only in this browser.') }),
        U.copyMsg,
        h('button', { class: 'pg-btn', onclick: () => doPrint() }, ['PRINT']),
        h('button', { class: 'pg-btn primary', onclick: () => doCopy() }, [rt('copy', 'Copy report').toUpperCase()]),
      ]));
      U.root.appendChild(U.el);
      refreshText();
      setTimeout(() => { if (U && nameIn) nameIn.focus({ preventScroll: true }); }, 30);
      return { el: U.el, close, copy: doCopy, text: reportText };
    } catch (e) { warn('openReport', e); close(); return null; }
  }
  function bar(p) { return h('span', { class: 'pg-bar' + (p == null ? ' none' : p >= 80 ? ' good' : p < 50 ? ' warn' : ''), 'aria-hidden': 'true' }, [h('i', { style: 'width:' + (p || 0) + '%' })]); }
  function refreshText() { if (U && U.txt) U.txt.value = reportText(); }
  function doCopy() {
    const text = reportText();
    const done = (ok) => { if (!U || !U.copyMsg) return; U.copyMsg.textContent = ok ? rt('copied', 'Copied!') + ' Paste it into Google Classroom.' : rt('copyFail', 'Select the text box and copy it (Ctrl+C).'); U.copyMsg.className = 'pg-copy-msg ' + (ok ? 'ok' : 'bad'); if (ok) snd('questionRight'); };
    const fallback = () => {
      let ok = false;
      try {
        const ta = (U && U.txt) || h('textarea', { style: 'position:fixed;left:-9999px;top:0' }, []);
        if (!ta.isConnected) document.body.appendChild(ta);
        ta.value = text; ta.focus(); ta.select();
        ok = document.execCommand && document.execCommand('copy');
        if (!U || ta !== U.txt) ta.remove();
      } catch (e) { ok = false; }
      done(!!ok);
      return !!ok;
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext !== false) {
        return navigator.clipboard.writeText(text).then(() => { done(true); return true; }, () => fallback());
      }
    } catch (e) { /* fall back */ }
    return Promise.resolve(fallback());
  }
  function doPrint() {
    try {
      let pr = document.getElementById('pg-print');
      if (pr) pr.remove();
      pr = h('div', { id: 'pg-print' });
      const clone = U.el.cloneNode(true);
      clone.querySelectorAll('canvas, .pg-close, .pg-foot button, .pg-copy, .pg-bg').forEach((x) => x.remove());
      // inputs: print their values as text
      const ins = U.el.querySelectorAll('input');
      clone.querySelectorAll('input').forEach((x, i) => { const s = h('b', { class: 'pg-date', text: (ins[i] && ins[i].value) || '-' }); x.replaceWith(s); });
      clone.className = 'pg pg-k-report pg-printable';
      pr.appendChild(clone);
      document.body.appendChild(pr);
      document.documentElement.classList.add('pg-printing');
      const end = () => { document.documentElement.classList.remove('pg-printing'); const x = document.getElementById('pg-print'); if (x) x.remove(); window.removeEventListener('afterprint', end); };
      window.addEventListener('afterprint', end);
      window.print();
      setTimeout(() => { if (!window.matchMedia || !window.matchMedia('print').matches) end(); }, 1500);
    } catch (e) { warn('print', e); }
  }

  // ---------------------------------------------------------------------------
  // DEBUG
  // ---------------------------------------------------------------------------
  const debug = {
    state() { return JSON.parse(JSON.stringify({ progress: st, session: ses, active, tracker: wt, persistent, actions: actions().map((a) => a.key) })); },
    reset() {
      st = fresh(); ses = freshSession(); active = null; wt = null; mem = null; memS = null;
      try { const ls = store('local'); if (ls) ls.removeItem(KEY); } catch (e) { /* ignore */ }
      try { const ss = store('session'); if (ss) ss.removeItem(SKEY); } catch (e) { /* ignore */ }
      return true;
    },
    // n simulated freezes over every threat id (deterministic), ~70% right first time
    fakeFreeze(n, o) {
      o = o || {};
      const r = mulberry32(hashStr('fake|' + (o.salt || 0)));
      const ids = Object.keys(threats());
      const acts = actions();
      const res = [];
      for (let i = 0; i < (n | 0); i++) {
        let action, threatId = null, kind = 'movement';
        if (ids.length) { threatId = ids[Math.floor(r() * ids.length)]; const t = threats()[threatId]; action = t.action || t.correct; kind = t.kind || kind; }
        else { const a = acts[Math.floor(r() * acts.length)]; action = a.name; kind = a.kind; }
        const correct = r() < (o.rate != null ? o.rate : 0.7);
        const t = threats()[threatId] || {};
        const wrongs = (t.distractors || []).concat(t.planeWrong ? [t.planeWrong[0]] : []);
        const choice = correct ? action : r() < 0.15 ? null : wrongs[Math.floor(r() * wrongs.length)] || 'Flexion';
        const roster0 = roster();
        res.push(onFreeze({ threatId, action, kind, choice, correct, firstTry: true, timeMs: 2000 + r() * 5000, allyName: roster0.length ? roster0[Math.floor(r() * roster0.length)].name : 'WRENCH', wave: o.wave || 1, assist: !!o.assist }));
      }
      return res;
    },
    unlockAll() {
      actions().forEach((a) => { const x = st.actions[a.key] || (st.actions[a.key] = blankAct()); x.mastered = true; x.masteredAt = x.masteredAt || Date.now(); x.streak = Math.max(x.streak, masteryNeed()); });
      roster().forEach((r) => { const k = slug(r.id || r.name); const lv = levelsFor(r.type); st.allies[k] = { xp: lv[lv.length - 1].xp, name: r.name, type: r.type }; });
      st.cosmetics.unlocked = cosmetics().map((c) => c.id);
      save();
      return true;
    },
  };

  SEHS.Progress = {
    KEY, SESSION_KEY: SKEY,
    get persistent() { return persistent; },
    onFreeze, onRescue, contractsFor, pickContract, onWaveEnd, activeContracts: () => (active ? contractDefs().filter((c) => active.ids.indexOf(c.id) >= 0).map(pub) : []),
    allyLevel, cosmetic, equip, cosmetics: () => cosmetics().map((c) => Object.assign({ unlocked: !c.unlock || isUnlocked(c.id), how: unlockText(c) }, c)),
    setSeed, getSeed, rng,
    mastery, actions: () => actions().slice(), masteredCount,
    openCodex, openReport, close, isOpen: () => !!U,
    reportText, reportData,
    debug,
  };
})();
