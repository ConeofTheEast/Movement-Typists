/*
 * transverse.js: LEVEL 3 "DRONE DEFENSE" (transverse plane, top-down)
 * -----------------------------------------------------------------
 * Owned by the "game-engineer" agent. Spec: docs/GAME_DESIGN.md §4.
 *
 * The screen IS the transverse plane (camera straight down, the longitudinal
 * axis points out of the screen ⊙). The android guards a scrapyard camp while
 * its allies repair a wrecked transport. Routine drones are handled by labelled
 * automatic transverse actions (muscles glow). Dangerous drones trigger a
 * THREAT FREEZE: time dilates, the threat drone (and ally) slide into a fixed
 * staged position (THREAT_STAGE) and the student picks the action:
 *   correct         -> success action, drone destroyed, combo + scrap
 *   wrong, in-plane -> the android performs EXACTLY the chosen option
 *                      (TopPose.threat(id, option)) and misses; the ally is
 *                      netted or the android takes partial damage (-1 cell)
 *   wrong plane     -> malfunction (limb lifts out of the plane), crack,
 *                      glitch, -1 cell, the drone is driven off by a flare
 *   timeout         -> hesitation (white trembling muscles), threat lands
 * Every miss: fail card -> 1.5 s ghost replay of the correct action -> the
 * threat id goes into the re-ask queue (no rewind in real time).
 * Energy 0 = shutdown -> WAVE FAILED -> same wave restarts (re-asks kept).
 * All allies dragged off = NO CREW -> same.
 *
 * Lifecycle (same as SagittalLevel): constructor(game), update(dt),
 * draw(ctx, opts), choose(i), retry(). Debug hooks: level.debug (§4.13).
 * Optional collaborators (guarded with typeof): SEHS.Workshop, SEHS.DroneSave.
 */
(function () {
  'use strict';
  const SEHS = window.SEHS;
  const C = SEHS.content;
  const Audio = SEHS.Audio;
  const TopPose = SEHS.TopPose;
  const AndroidTop = SEHS.AndroidTop;
  const DroneArt = SEHS.DroneArt;
  const Arena = SEHS.Arena;

  const W = 1280, H = 720;
  const AX = 640, AY = 380;         // android pelvis centre (guard post)
  const D2R = Math.PI / 180, TAU = Math.PI * 2;
  const TRUCK = { x: 640, y: 628, scale: 1.62 };
  const SPAWN_R = 720;
  const BASE_CAM = { Z: 1.1, cx: 640, cy: 366, sx: 640, sy: 360 };
  const BASE_FX = {
    freezeBonus: 0, sweepArc: 60, spinDmg: 2, pulseDmg: 1, pulseRadius: 60, swatDmg: 1, swatKnock: 40, windupMul: 1,
    discDmg: 2, discPierce: 0, backhandReach: 0, netCutWindow: 8, turnRate: 1, allySlots: 4, maxEnergy: 5,
    medicHealEvery: 60, repairMul: 1, turretDmg: 1, turretRate: 2.5, earlyWarning: 0, comboKeep: 3,
  };

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const ease = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const easeOut = (t) => { t = clamp(t, 0, 1); return 1 - (1 - t) * (1 - t); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  // bearings: θ = degrees clockwise from the android's front (screen-up)
  const polar = (th, d) => [AX + d * Math.sin(th * D2R), AY - d * Math.cos(th * D2R)];
  const bearing = (x, y) => Math.atan2(x - AX, -(y - AY)) / D2R;
  const angDiff = (a, b) => ((((a - b) % 360) + 540) % 360) - 180;
  const fill = (s, o) => String(s).replace(/\{(\w+)\}/g, (m, k) => (o[k] != null ? o[k] : m));
  const UI = C.DRONE_UI;

  // ---------------- drone roster (§4.7) ----------------
  // art: closest SEHS.DroneArt type; overlay: extra silhouette drawn here so
  // every type stays distinct without relying on colour.
  const DT = {
    scout: { art: 'scout', speed: 95, hp: 1, size: 1, name: 'GNAT' },
    netter: { art: 'netter', speed: 70, hp: 2, size: 1, name: 'NETTER' },
    diver: { art: 'swarm', scale: 2.5, speed: 60, hp: 2, size: 1, overlay: 'diver', name: 'HORNET' },
    lancer: { art: 'scout', scale: 1.1, speed: 50, hp: 2, size: 1, overlay: 'lancer', name: 'LANCER' },
    tether: { art: 'tether', speed: 55, hp: 3, size: 1.1, name: 'LEECH' },
    swarm: { art: 'swarm', speed: 110, hp: 1, size: 0.5, name: 'MIDGE' },
    spotter: { art: 'scout', scale: 1.05, speed: 40, hp: 2, size: 0.9, overlay: 'spotter', name: 'SPOTTER' },
    heavy: { art: 'heavy', scale: 1.15, speed: 45, hp: 6, size: 1.6, name: 'RAM' },
    crawler: { art: null, speed: 40, hp: 2, size: 0.7, overlay: 'crawler', name: 'SNARE' },
    jammer: { art: 'jammer', speed: 60, hp: 4, size: 1.2, name: 'JAMMER' },
    warden: { art: 'warden', scale: 1.2, speed: 30, hp: 99, size: 2.6, name: 'THE WARDEN' },
  };
  const radiusOf = (type) => (type === 'crawler' ? 13 : DroneArt.radius(DT[type].art) * (DT[type].scale || 1));

  // ---------------- waves (§4.9) ----------------
  const POOL_ADD = {
    1: ['netterOnAlly_left', 'netterOnAlly_right'],
    2: ['crossSwat', 'backhandSwat', 'diveBehind'],
    3: ['palmShield', 'palmCatch'],
    4: ['tetherPull', 'spineTwist'],
    6: ['discWindup', 'discThrow'],
    7: ['heavyCatch'],
    8: ['hipPivot'],
    9: ['discSnap'],
  };
  const TYPE_ADD = { 1: ['scout', 'netter'], 2: ['diver'], 3: ['lancer'], 4: ['tether', 'swarm'], 6: ['spotter'], 7: ['heavy'], 8: ['crawler'], 9: ['jammer'] };
  const TYPE_W = { scout: 3, netter: 2.6, diver: 2.6, lancer: 1.8, tether: 1.3, swarm: 1, spotter: 1, heavy: 1, crawler: 1.3, jammer: 0.7 };
  const WAVE_TABLE = {
    1: { drones: 14, every: 8.5, sides: { N: 1 }, target: 3 },
    2: { drones: 18, every: 7.0, sides: { N: 1, E: 0.7, W: 0.7 }, target: 3 },
    3: { drones: 20, every: 6.5, sides: { N: 1.6, E: 1, W: 1, S: 0.6 }, target: 4 },
    4: { drones: 22, every: 6.0, sides: { N: 1, E: 1, W: 1, S: 1 }, target: 4 },
    5: { drones: 12, every: 8.0, sides: { N: 1, E: 1, W: 1, S: 1 }, target: 6 },
    6: { drones: 24, every: 5.6, sides: { N: 1, E: 1, W: 1, S: 1 }, target: 5 },
    7: { drones: 26, every: 5.3, sides: { N: 1, E: 1, W: 1, S: 1.6 }, target: 5 },
    8: { drones: 28, every: 5.0, sides: { N: 1, E: 1, W: 1, S: 1 }, target: 5 },
    9: { drones: 30, every: 4.7, sides: { N: 1, E: 1, W: 1, S: 1 }, target: 6 },
    10: { drones: 16, every: 6.0, sides: { N: 1, E: 1, W: 1, S: 1 }, target: 6 },
  };
  const SIDE_RANGE = { N: [-45, 45], E: [45, 135], S: [135, 225], W: [-135, -45] };
  const SIDE_NAME = { N: 'NORTH', E: 'EAST', S: 'SOUTH', W: 'WEST' };

  function waveCfg(n) {
    const boss = n % 5 === 0;
    const base = WAVE_TABLE[Math.min(n, 10)] || WAVE_TABLE[9];
    const unlock = Math.min(n, 9);
    let pool = [], types = [];
    for (let k = 1; k <= unlock; k++) { if (POOL_ADD[k]) pool = pool.concat(POOL_ADD[k]); if (TYPE_ADD[k]) types = types.concat(TYPE_ADD[k]); }
    const cfg = {
      n, boss, types, pool,
      drones: base.drones, every: base.every, sides: base.sides, target: base.target,
      timerBase: Math.max(5, 9 - 0.4 * (n - 1)), speedMul: 1,
      need: boss ? 120 : 160 + 25 * (n - 1),
      sub: n <= 10 ? UI.subsystems[n - 1] : UI.endlessSubsystems[(n - 11) % UI.endlessSubsystems.length],
      eliteChance: n >= 6 ? Math.min(0.4, 0.1 + 0.02 * n) : 0,
      newTypes: TYPE_ADD[n] && n > 1 ? TYPE_ADD[n].slice() : [],
    };
    if (n >= 11) {
      cfg.drones = 30 + 2 * (n - 10);
      cfg.every = Math.max(3.4, 4.7 - 0.05 * (n - 10));
      cfg.speedMul = Math.min(1.5, 1 + 0.03 * (n - 10));
      cfg.target = Math.min(8, 6 + Math.floor((n - 10) / 3));
      cfg.timerBase = Math.max(5, 5.5 - 0.1 * (n - 10));
      if (boss) cfg.drones = 16 + (n - 10);
    }
    return cfg;
  }

  // ---------------- threat staging (engine-owned, §4.4a) ----------------
  // type: drone type staged; th/d: staged bearing/distance; ally: which ally
  // slides into view and where; joints: ⊙ highlight targets on the rig;
  // key/from/to: the questioned pose angle (live readout); hit: success
  // contact time (s); side: decision panel side (opposite the drone).
  const THREAT_STAGE = {
    netterOnAlly_left: { type: 'netter', th: -65, d: 130, ally: { prefer: 'kite', side: 'L', at: [-72, 255] }, joints: ['shoulderL'], key: 'L.hz', side: 'right', limbPt: 'handL' },
    netterOnAlly_right: { type: 'netter', th: 30, d: 120, ally: { prefer: 'bolt', side: 'R', at: [40, 250] }, joints: ['shoulderL'], key: 'L.hz', side: 'left', limbPt: 'handL' },
    crossSwat: { type: 'diver', th: -25, d: 115, joints: ['shoulderR'], key: 'R.hz', side: 'right', limbPt: 'handR' },
    backhandSwat: { type: 'diver', th: 95, d: 115, joints: ['shoulderR'], key: 'R.hz', side: 'left', limbPt: 'handR' },
    diveBehind: { type: 'diver', th: 165, d: 115, joints: ['trunk'], key: 'trunk', side: 'left', limbPt: 'handR' },
    spineTwist: { type: 'swarm', th: 0, d: 135, arc: [-50, 50], joints: ['trunk'], key: 'trunk', side: 'left', limbPt: 'handR' },
    palmShield: { type: 'lancer', th: 150, d: 260, joints: ['foreR'], key: 'R.pr', side: 'left', limbPt: 'handR', zoomOn: 'handR', inset: 'handR', insetLabel: 'RIGHT HAND' },
    palmCatch: { type: 'lancer', th: 25, d: 260, joints: ['foreR'], key: 'R.pr', side: 'left', limbPt: 'handR', zoomOn: 'handR', inset: 'handR', insetLabel: 'RIGHT HAND' },
    discWindup: { type: 'spotter', th: -15, d: 380, joints: ['shoulderR'], key: 'R.rot', side: 'right', limbPt: 'handR', inset: 'elbowR', insetLabel: 'RIGHT ARM' },
    discThrow: { type: 'spotter', th: -15, d: 380, joints: ['shoulderR'], key: 'R.rot', side: 'right', limbPt: 'handR', inset: 'elbowR', insetLabel: 'RIGHT ARM' },
    discSnap: { type: 'spotter', th: -15, d: 380, joints: ['shoulderR'], key: 'R.rot', side: 'right', limbPt: 'handR', elite: true, inset: 'elbowR', insetLabel: 'RIGHT ARM' },
    tetherPull: { type: 'tether', th: 95, d: 210, ally: { prefer: 'bolt', side: 'R', at: [125, 150], helper: true }, joints: ['shoulderR'], key: 'R.rot', side: 'left', limbPt: 'wristR' },
    heavyCatch: { type: 'heavy', th: 15, d: 100, joints: ['shoulderR'], key: 'R.hz', side: 'left', limbPt: 'handR' },
    hipPivot: { type: 'crawler', th: 60, d: 70, joints: ['hipR'], key: 'hipR', side: 'left', limbPt: 'toeR', zoomOn: 'feet' },
  };
  // which threats a drone's trigger can serve (§4.4c trigger column)
  function compatible(type, th, ally) {
    const a = Math.abs(th);
    switch (type) {
      case 'netter': return ally ? [ally.x < AX ? 'netterOnAlly_left' : 'netterOnAlly_right'] : [];
      case 'diver': return th >= -70 && th <= -10 ? ['crossSwat'] : th >= 70 && th <= 125 ? ['backhandSwat'] : a > 125 ? ['diveBehind'] : [];
      case 'lancer': return a > 90 ? ['palmShield'] : ['palmCatch'];
      case 'tether': return ['tetherPull'];
      case 'swarm': return ['spineTwist'];
      case 'spotter': return ['discThrow', 'discWindup'];
      case 'heavy': return a <= 60 ? ['heavyCatch'] : [];
      case 'crawler': return ['hipPivot'];
      default: return [];
    }
  }
  // Warden phases (§4.8). Warden II+ uses tier-3 substitutes.
  const WARDEN_PHASES = [['diveBehind', 'crossSwat'], ['tetherPull', 'discThrow'], ['palmShield', 'spineTwist']];
  const WARDEN_SUB = { crossSwat: 'heavyCatch', discThrow: 'discSnap', spineTwist: 'hipPivot' };
  const PLATE_NAMES = ['FRONT', 'LEFT', 'RIGHT'];

  // auto-action labels: the transverse movement names (curriculum names come from content)
  const MV = {};
  C.PLANES.transverse.movements.forEach((m) => { MV[m] = m.toUpperCase(); });
  const mvName = (m) => MV[m] || String(m).toUpperCase();

  // ally work spots (§4.1; nudged so the HUD never covers them)
  const SPOTS = {
    R1: { x: 548, y: 548, face: 180 }, R2: { x: 734, y: 548, face: 180 },
    FL: { x: 330, y: 430, face: -40 }, FR: { x: 950, y: 430, face: 40 },
    X1: { x: 400, y: 600, face: 120 }, X2: { x: 880, y: 600, face: -120 },
  };
  const DEFAULT_SPOT = { wrench: 'R1', patch: 'R2', kite: 'FL', bolt: 'FR', torque: 'X1', salve: 'X2' };
  const ROLE_RATE = { mechanic: 1.0, medic: 0.3, scout: 0.3, engineer: 0.3 };
  const TURRET = { x: 1010, y: 478 };

  // ---------------- save fallback (DroneSave is optional) ----------------
  const SAVE_KEY = 'kinetic-escape-drone-v1';
  const LOG_KEY = 'kinetic-escape-drone-log-v1';
  function freshSave() { return { v: 1, wave: 1, bestWave: 0, scrap: 0, upgrades: {}, loadout: {}, faultLog: [], visit: 0, seenAt: {}, calib: {}, reaskQueue: [], threatStats: {}, lifetime: { waves: 0, rescues: 0, wardens: 0, playMs: 0 } }; }
  const SaveIO = {
    load(given) {
      const S = SEHS.DroneSave;
      let s = given || null;
      if (s) { /* normalise below */ } else if (S && typeof S.load === 'function') { try { s = S.load(); } catch (e) { s = null; } }
      else { try { s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { s = null; } }
      const f = freshSave();
      s = Object.assign(f, s || {});
      s.lifetime = Object.assign(freshSave().lifetime, s.lifetime || {});
      s.reaskQueue = (s.reaskQueue || []).filter((id) => C.DRONE_THREATS[id]);
      s.threatStats = s.threatStats || {};
      return s;
    },
    save(s) {
      const S = SEHS.DroneSave;
      if (S && typeof S.save === 'function') { try { S.save(s); return true; } catch (e) { return false; } }
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); return true; } catch (e) { return false; }
    },
  };
  function workshopAPI() { return typeof SEHS.Workshop === 'object' && SEHS.Workshop && typeof SEHS.Workshop.open === 'function' ? SEHS.Workshop : null; }
  function effectsFor(save) {
    const out = Object.assign({}, BASE_FX);
    const Wk = SEHS.Workshop;
    if (Wk && typeof Wk.effects === 'function') {
      try { const e = Wk.effects(save); if (e && typeof e === 'object') for (const k in e) if (e[k] != null) out[k] = e[k]; } catch (err) { /* run on defaults */ }
    }
    out.maxEnergy = clamp(Math.round(out.maxEnergy || 5), 1, 8);
    return out;
  }
  // calibration lookups (Workshop.effects may provide them under several names)
  // Workshop.effects() already folds the Calibration bonuses into its keys
  // (freezeBonus, repairMul, turretRate, comboKeep) and exposes dmgMul, pullMul,
  // holdMul, overdriveTime and critChance, which the level applies itself.
  const effN = (fx, k, def) => (typeof fx[k] === 'number' && isFinite(fx[k]) ? fx[k] : def);

  // =====================================================================
  class DroneDefense {
    constructor(game, opts) {
      opts = opts || {};
      this.game = game;
      this.kind = 'drone';
      this.planeId = 'transverse';
      this.fx = game.fx;
      this.rig = new AndroidTop();
      this.allyRig = new AndroidTop();
      this.ghostRig = new AndroidTop();
      this.time = 0;
      this.save = SaveIO.load();
      if (opts.fresh) {
        const DS = SEHS.DroneSave;
        if (DS && typeof DS.reset === 'function') { try { this.save = SaveIO.load.call(null, DS.reset({ keepLearning: true })); } catch (e) { /* keep loaded save */ } }
        else { const keep = this.save; this.save = Object.assign(freshSave(), { faultLog: keep.faultLog, calib: keep.calib, threatStats: keep.threatStats, seenAt: keep.seenAt, visit: keep.visit, lifetime: keep.lifetime, bestWave: keep.bestWave }); }
      }
      this.saveOk = SaveIO.save(this.save);
      this.reask = this.save.reaskQueue.slice();
      this.seen = {};           // threat id -> last time served this session
      this.optionSets = {};     // threat id -> option set (re-asks reuse it)
      this.labels = true;
      this.uid = 1;
      this.stats = {
        log: [], freezes: 0, correct: 0, firstTries: 0, firstTryCorrect: 0, plane: 0, inplane: 0, contraction: 0, timeout: 0,
        rescues: 0, rescueTries: 0, kills: 0, comboBest: 0, shutdowns: 0, noCrew: 0, wavesCleared: 0, partials: 0, chips: 0, wardens: 0,
        startMs: Date.now(),
      };
      this.debugFast = false;
      this.buildDebug();
      this.startWave(opts.wave || this.save.wave || 1);
    }

    // ---------------- wave lifecycle ----------------
    startWave(n) {
      this.wave = n;
      this.cfg = waveCfg(n);
      this.eff = effectsFor(this.save);
      this.maxEnergy = this.eff.maxEnergy;
      this.energy = this.maxEnergy;
      this.damage = {};
      this.repair = 0;
      this.waveT = 0;
      this.sinceFreeze = 0;
      this.freezesDone = 0;
      this.mode = 'intro';
      this.modeT = 0;
      this.ts = 1;
      this.camK = 0;
      this.cam = null;
      this.hitStop = 0;
      this.freeze = null;
      this.act = null;
      this.rescue = null;
      this.failInfo = null;
      this.sysFail = 0;
      this.powerFail = 0;
      this.drones = [];
      this.discs = [];
      this.beams = [];
      this.floaters = [];
      this.bubbles = [];
      this.selected = null;
      this.action = null;
      this.pending = null;
      this.cd = { L: 0, R: 0, palm: 0, hip: 0 };
      this.combo = 0; this.comboT = 0; this.overdrive = 0;
      this.hooked = null; this.snareT = 0; this.jamT = 0;
      this.pl = { x: AX, y: AY, ox: 0, oy: 0, pose: TopPose.clone(TopPose.LIB.guard), status: 'ok', mal: null, neutral: false };
      this.rig.reset();
      this.fx.reset();
      if (this.fx.clearShutdown) this.fx.clearShutdown();
      this.fx.hudTarget = { x: 1084, y: 28 };
      this.ws = { kills: 0, freezes: 0, correct: 0, wrong: 0, rescues: 0, comboBest: 0, scrap: 0, netted: 0, hits: 0 };
      this.windupDone = false;
      // spawn plan
      this.spawnQueue = this.buildSpawnQueue();
      this.spawnT = 2.5;
      this.spawned = 0;
      this.nextSpawn = null;
      this.planNextSpawn();
      // allies
      this.setupAllies();
      this.turret = { build: 0, cd: 1, ang: -Math.PI / 2, fire: 0, built: false };
      this.banterT = rand(6, 10);
      // boss
      this.warden = null;
      if (this.cfg.boss) this.wardenT = 14;
      this.lastHeal = 0;
      this.introLine = pick(UI.wave.introLines);
      Audio.waveStart && Audio.waveStart();
      this.save.wave = n;
      this.persist();
    }

    restartWave() {
      this.stats.log.push({ t: Date.now(), wave: this.wave, source: 'wave', id: 'restart', result: 'restart' });
      this.startWave(this.wave);
    }

    persist() {
      this.save.reaskQueue = this.reask.slice();
      this.save.lifetime.playMs = (this.save.lifetime.playMs || 0) + (Date.now() - (this._lastPersist || this.stats.startMs));
      this._lastPersist = Date.now();
      this.saveOk = SaveIO.save(this.save);
      try { localStorage.setItem(LOG_KEY, JSON.stringify(this.stats.log.slice(-500))); } catch (e) { /* ignore */ }
    }

    buildSpawnQueue() {
      const cfg = this.cfg;
      const types = cfg.types.slice();
      const wsum = types.reduce((s, t) => s + TYPE_W[t], 0);
      const q = [];
      // new types appear early so the scout intel promise holds
      cfg.newTypes.forEach((t) => { q.push(t); q.push(t); });
      while (q.length < cfg.drones) {
        let r = Math.random() * wsum, t = types[0];
        for (const k of types) { r -= TYPE_W[k]; if (r <= 0) { t = k; break; } }
        q.push(t);
      }
      const head = q.splice(0, cfg.newTypes.length * 2);
      shuffle(q);
      // keep the new types within the first third of the wave
      head.forEach((t, i) => q.splice(Math.min(q.length, 1 + i * 2), 0, t));
      if (this.wave <= 2) { const i = q.indexOf('netter'); if (i > 1) { q.splice(i, 1); q.splice(1, 0, 'netter'); } }
      return q;
    }

    sideBearing() {
      const s = this.cfg.sides;
      const keys = Object.keys(s);
      let tot = keys.reduce((a, k) => a + s[k], 0), r = Math.random() * tot, k0 = keys[0];
      for (const k of keys) { r -= s[k]; if (r <= 0) { k0 = k; break; } }
      const [a, b] = SIDE_RANGE[k0];
      return angDiff(rand(a, b), 0);
    }

    planNextSpawn() {
      const type = this.spawnQueue.length ? this.spawnQueue.shift() : pick(this.cfg.types);
      let th = this.sideBearing();
      if (type === 'crawler') th = rand(-120, 120);
      const every = this.spawnQueue.length || this.endless ? this.cfg.every : this.cfg.every * 1.5;
      this.nextSpawn = { type, th, at: this.waveT + this.spawnT };
      // a quick opening so the camp is busy from the start, then the wave's pace
      this.spawned = (this.spawned || 0) + 1;
      this.spawnT = every * rand(0.8, 1.15) * (this.spawned <= 3 ? 0.45 : 1);
    }

    // ---------------- allies ----------------
    setupAllies() {
      const slots = clamp(Math.round(this.eff.allySlots || 4), 1, 6);
      const early = (this.eff.allySlots || 4) >= 6 ? 1 : 0;
      const roster = C.ALLY_ROSTER.filter((a) => a.arrives - early <= this.wave).slice(0, slots);
      const prev = this.allies || [];
      this.allies = roster.map((r) => {
        const spot = SPOTS[DEFAULT_SPOT[r.id] || 'X1'];
        const was = prev.find((p) => p.id === r.id);
        return {
          id: r.id, name: r.name, unit: r.unit, type: r.type, visor: r.visor, spotId: DEFAULT_SPOT[r.id],
          spot, x: spot.x, y: spot.y, face: spot.face, state: 'work', pauseT: 0, netT: 0, netter: null, anim: rand(0, 6),
          healT: 0, returned: !!(was && was.state === 'taken'), staged: false, shake: 0,
        };
      });
      const meds = this.allies.filter((a) => a.type === 'medic');
      meds.forEach((m, i) => { m.healT = (this.eff.medicHealEvery || 60) * (1 - i / Math.max(1, meds.length) * 0.5); });
      this.allies.forEach((a) => {
        if (a.returned) setTimeout(() => this.say(a, pick(C.DRONE_BANTER.events.returned)), 2600);
      });
    }

    allyWorking(a) { return a.state === 'work' && a.pauseT <= 0; }
    campAllies() { return this.allies.filter((a) => a.state !== 'taken'); }

    repairRate() {
      let r = 0;
      const lev = 1;
      for (const a of this.allies) if (this.allyWorking(a)) r += ROLE_RATE[a.type] || 0.3;
      return r * (this.eff.repairMul || 1) * lev;
    }

    say(a, text, dur) {
      if (!a || !text || this.mode === 'decide' || this.mode === 'ramp') return;
      this.bubbles = this.bubbles.filter((b) => b.ally !== a);
      this.bubbles.push({ ally: a, text, t: 0, dur: dur || 3.2 });
    }

    netAlly(a, netter) {
      if (!a || a.state === 'taken' || a.state === 'netted') return;
      a.state = 'netted';
      a.netT = this.eff.netCutWindow || 8;
      a.netMax = a.netT;
      a.netter = netter;
      a.staged = false;
      if (netter) { netter.st = 'tow'; netter.ally = a; netter.towDir = this.awayDir(a.x, a.y); }
      this.fx.netBurst && this.fx.popText(a.x, a.y - 34, fill(UI.hud.netted, { s: Math.ceil(a.netT) }), '#ffb020', 20);
      Audio.netFire && Audio.netFire();
      this.breakCombo();
      this.ws.netted++;
      this.say(a, pick(C.DRONE_BANTER.events.netted), 2.4);
    }

    awayDir(x, y) {
      let dx = x - AX, dy = y - AY;
      const l = Math.hypot(dx, dy) || 1;
      return [dx / l, dy / l];
    }

    freeAlly(a, viaKill) {
      if (!a || a.state !== 'netted') return;
      a.state = 'run';
      if (a.netter && !a.netter.dead) { a.netter.ally = null; if (!viaKill) this.killDrone(a.netter, { silent: false, noCombo: true }); }
      a.netter = null;
      this.fx.netBurst(a.x, a.y, 26);
      Audio.netRip && Audio.netRip();
      this.gainEnergy(1, a.x, a.y);
      this.ws.rescues++;
      this.save.lifetime.rescues = (this.save.lifetime.rescues || 0) + 1;
      this.say(a, pick(C.DRONE_BANTER.events.rescued));
      if (this.rescue && this.rescue.ally === a) this.closeRescue();
    }

    takeAlly(a) {
      a.state = 'taken';
      this.fx.popText(clamp(a.x, 80, W - 80), clamp(a.y, 120, H - 80), fill(UI.hud.taken, { unit: a.unit }), '#ff5a5a', 24);
      if (a.netter && !a.netter.dead) { a.netter.retreat = true; a.netter.ally = null; }
      a.netter = null;
      if (this.rescue && this.rescue.ally === a) this.closeRescue();
      if (this.campAllies().length === 0) this.noCrew();
    }

    updateAllies(wdt) {
      for (const a of this.allies) {
        a.anim += wdt;
        a.shake = Math.max(0, a.shake - wdt);
        if (a.state === 'taken') continue;
        if (a.state === 'netted') {
          a.netT -= wdt;
          if (a.netT <= 0) { this.takeAlly(a); continue; }
          if (!a.netter || a.netter.dead) { this.freeAlly(a, true); continue; }
          continue;
        }
        if (a.staged) continue;
        if (a.pauseT > 0) a.pauseT -= wdt;
        if (a.state === 'run') {
          const d = dist(a.x, a.y, a.spot.x, a.spot.y);
          if (d < 4) { a.state = 'work'; a.x = a.spot.x; a.y = a.spot.y; }
          else { const s = Math.min(d, 150 * wdt); a.x += ((a.spot.x - a.x) / d) * s; a.y += ((a.spot.y - a.y) / d) * s; }
        }
        // medic heals (staggered)
        if (a.type === 'medic' && this.allyWorking(a) && this.mode === 'play') {
          a.healT -= wdt;
          if (a.healT <= 0) {
            a.healT = this.eff.medicHealEvery || 60;
            if (this.energy < this.maxEnergy) { this.gainEnergy(1, a.x, a.y); this.say(a, pick(C.DRONE_BANTER.events.heal)); }
          }
        }
      }
      // turret (BOLT builds it over 20 s, then it shoots small stuff)
      const bolt = this.allies.find((a) => a.type === 'engineer');
      const T = this.turret;
      if (bolt && this.allyWorking(bolt) && T.build < 1) { T.build = Math.min(1, T.build + wdt / 20); if (T.build >= 1 && !T.built) { T.built = true; this.say(bolt, C.DRONE_BANTER.byAlly.bolt[0]); } }
      if (T.built) {
        T.fire = Math.max(0, T.fire - wdt * 6);
        T.cd -= wdt;
        let best = null, bd = 220;
        for (const d of this.drones) {
          if (d.dead || d.staged || (d.type !== 'scout' && d.type !== 'swarm')) continue;
          const dd = dist(d.x, d.y, TURRET.x, TURRET.y);
          if (dd < bd) { bd = dd; best = d; }
        }
        if (best) {
          const ta = Math.atan2(best.y - TURRET.y, best.x - TURRET.x);
          T.ang += angDiff(ta / D2R, T.ang / D2R) * D2R * Math.min(1, wdt * 10);
          if (T.cd <= 0) {
            T.cd = this.eff.turretRate || 2.5; T.fire = 1;
            this.beams.push({ x1: TURRET.x + Math.cos(T.ang) * 26, y1: TURRET.y + Math.sin(T.ang) * 26, x2: best.x, y2: best.y, t: 0, life: 0.12, col: '143,240,255', w: 2 });
            this.damageDrone(best, this.eff.turretDmg || 1, { noStop: true, src: 'turret' });
          }
        }
      }
      // banter
      this.banterT -= wdt;
      if (this.banterT <= 0 && this.mode === 'play') {
        this.banterT = rand(14, 22);
        const live = this.allies.filter((a) => this.allyWorking(a));
        if (live.length) { const a = pick(live); const lines = C.DRONE_BANTER.byAlly[a.id] || []; if (lines.length) this.say(a, pick(lines)); }
      }
      for (const b of this.bubbles) b.t += wdt;
      this.bubbles = this.bubbles.filter((b) => b.t < b.dur);
    }

    // ---------------- drones ----------------
    edgeSpawnPoint(th) {
      // first point just outside the visible arena along the bearing
      const sx = Math.sin(th * D2R), sy = -Math.cos(th * D2R);
      let t = SPAWN_R;
      if (Math.abs(sx) > 1e-3) t = Math.min(t, ((sx > 0 ? W + 40 : -40) - AX) / sx);
      if (Math.abs(sy) > 1e-3) t = Math.min(t, ((sy > 0 ? H + 40 : -40) - AY) / sy);
      return [AX + sx * t, AY + sy * t];
    }

    spawnDrone(type, th, o) {
      o = o || {};
      const p = o.at || this.edgeSpawnPoint(th);
      const spec = DT[type];
      const elite = !!o.elite || (type !== 'warden' && Math.random() < this.cfg.eliteChance);
      const d = {
        uid: this.uid++, type, x: p[0], y: p[1], ang: Math.atan2(AY - p[1], AX - p[0]), hp: spec.hp + (elite ? 2 : 0), elite,
        st: 'in', t: 0, stT: 0, hit: 0, seed: Math.random() * 10, kx: 0, ky: 0, staged: false, retreat: false, dead: false,
        orbitDir: Math.random() < 0.5 ? 1 : -1, orbitT: rand(3, 6), callT: 8, holdT: 0, r: radiusOf(type), proxy: !!o.proxy,
      };
      d.maxHp = d.hp;
      if (type === 'crawler') d.foot = th >= 0 ? 'R' : 'L';
      this.drones.push(d);
      return d;
    }

    spawnSwarm(th, o) {
      o = o || {};
      const pack = { th, formed: false, members: [] };
      for (let i = 0; i < 5; i++) {
        const p = this.edgeSpawnPoint(th + (i - 2) * 6);
        const d = this.spawnDrone('swarm', th, { at: [p[0] + rand(-20, 20), p[1] + rand(-20, 20)], elite: o.elite && i === 2, proxy: o.proxy });
        d.pack = pack; d.slot = i;
        pack.members.push(d);
      }
      return pack;
    }

    updateSpawns(wdt) {
      if (this.mode !== 'play' && this.mode !== 'intro') return;
      const ns = this.nextSpawn;
      if (!ns || this.waveT < ns.at) return;
      const alive = this.drones.filter((d) => !d.dead && d.type !== 'warden').length;
      if (alive >= 9 + Math.floor(this.wave / 2)) { ns.at += 1.5; return; }
      if (ns.type === 'swarm') this.spawnSwarm(ns.th);
      else this.spawnDrone(ns.type, ns.th);
      if (ns.type === 'scout' && this.wave >= 2) this.spawnDrone('scout', ns.th + rand(-25, 25)); // gnats come in pairs
      this.planNextSpawn();
    }

    validAllyTarget(a) { return a && (a.state === 'work' || a.state === 'run') && !a.staged; }

    nearestAlly(x, y, filter) {
      let best = null, bd = 1e9;
      for (const a of this.allies) {
        if (!this.validAllyTarget(a) || (filter && !filter(a))) continue;
        const d = dist(a.x, a.y, x, y);
        if (d < bd) { bd = d; best = a; }
      }
      return best;
    }

    moveTo(d, tx, ty, speed, wdt) {
      const dx = tx - d.x, dy = ty - d.y, l = Math.hypot(dx, dy);
      if (l < 0.5) return 0;
      const s = Math.min(l, speed * wdt);
      d.x += (dx / l) * s; d.y += (dy / l) * s;
      const ta = Math.atan2(dy, dx);
      d.ang += angDiff(ta / D2R, d.ang / D2R) * D2R * Math.min(1, wdt * 8);
      return l - s;
    }

    faceAndroid(d, wdt) {
      const ta = Math.atan2(AY - d.y, AX - d.x);
      d.ang += angDiff(ta / D2R, d.ang / D2R) * D2R * Math.min(1, wdt * 6);
    }

    updateDrones(wdt) {
      const sp = this.cfg.speedMul;
      this.marked = false;
      this.jamT = Math.max(0, this.jamT - wdt);
      for (const d of this.drones) {
        if (d.dead) continue;
        d.t += wdt; d.stT += wdt;
        d.hit = Math.max(0, d.hit - wdt * 5);
        if (d.kx || d.ky) { d.x += d.kx * wdt; d.y += d.ky * wdt; d.kx *= Math.max(0, 1 - wdt * 6); d.ky *= Math.max(0, 1 - wdt * 6); if (Math.abs(d.kx) + Math.abs(d.ky) < 2) { d.kx = 0; d.ky = 0; } }
        if (d.staged) continue;
        const spd = DT[d.type].speed * sp;
        const dA = dist(d.x, d.y, AX, AY);
        const th = bearing(d.x, d.y);
        if (d.retreat) {
          const [ux, uy] = this.awayDir(d.x, d.y);
          d.x += ux * 260 * wdt; d.y += uy * 260 * wdt;
          d.ang = Math.atan2(uy, ux);
          if (d.x < -120 || d.x > W + 120 || d.y < -120 || d.y > H + 120) d.dead = true;
          continue;
        }
        switch (d.type) {
          case 'scout': {
            if (!this.validAllyTarget(d.ally)) d.ally = pick(this.allies.filter((a) => this.validAllyTarget(a))) || null;
            if (!d.ally) { if (this.moveTo(d, ...polar(th, 200), spd, wdt) < 2) d.retreat = true; break; }
            if (this.moveTo(d, d.ally.x, d.ally.y - 4, spd, wdt) < 22) {
              d.ally.pauseT = 2; d.ally.shake = 0.5;
              this.fx.popText(d.ally.x, d.ally.y - 30, 'BUMP!', '#ffb020', 18);
              d.retreat = true;
            }
            break;
          }
          case 'netter': {
            if (d.st === 'tow') {
              const a = d.ally;
              if (!a || a.state !== 'netted') { d.retreat = true; break; }
              d.x += d.towDir[0] * 30 * wdt; d.y += d.towDir[1] * 30 * wdt;
              d.ang = Math.atan2(d.towDir[1], d.towDir[0]);
              a.x = d.x - d.towDir[0] * 16; a.y = d.y - d.towDir[1] * 16;
              break;
            }
            if (!this.validAllyTarget(d.ally)) { d.ally = this.nearestAlly(d.x, d.y); if (d.st === 'charge') d.st = 'in'; }
            const a = d.ally;
            if (!a) { this.moveTo(d, ...polar(th, 220), spd, wdt); break; }
            if (d.st === 'charge') {
              d.chargeT -= wdt;
              const ta = Math.atan2(a.y - d.y, a.x - d.x);
              d.ang += angDiff(ta / D2R, d.ang / D2R) * D2R * Math.min(1, wdt * 6);
              if (d.chargeT <= 0) this.netAlly(a, d);
              break;
            }
            const [ux, uy] = (() => { const dx = d.x - a.x, dy = d.y - a.y, l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; })();
            const rem = this.moveTo(d, a.x + ux * 90, a.y + uy * 90, spd, wdt);
            if (rem < 8 || dist(d.x, d.y, a.x, a.y) < 100) {
              d.st = 'charge'; d.chargeT = 1.2; d.chargeMax = 1.2;
              if (this.tryTrigger(d, { ally: a })) break;
            }
            break;
          }
          case 'diver': {
            if (d.st === 'in') { if (this.moveTo(d, ...polar(th, 280), spd * 2, wdt) < 6) { d.st = 'orbit'; d.orbitT = rand(2.5, 6); } break; }
            if (d.st === 'orbit') {
              const nth = th + d.orbitDir * (60 * sp / 280) / D2R * wdt;
              const p = polar(nth, 280);
              d.ang = Math.atan2(p[1] - d.y, p[0] - d.x);
              d.x = p[0]; d.y = p[1];
              d.orbitT -= wdt;
              if (d.orbitT <= 0) {
                d.st = 'dive';
                if (this.tryTrigger(d)) break;
              }
              break;
            }
            if (d.st === 'dive') {
              if (this.moveTo(d, AX, AY, 320 * sp, wdt) < 34) { this.chip(0.5, 'torso', d); d.st = 'recoil'; }
              break;
            }
            if (d.st === 'recoil') { if (this.moveTo(d, ...polar(th, 280), 200, wdt) < 8) { d.st = 'orbit'; d.orbitT = rand(4, 8); } }
            break;
          }
          case 'lancer': {
            if (d.st === 'in') { if (this.moveTo(d, ...polar(th, 260), spd, wdt) < 4) { d.st = 'charge'; d.chargeT = 2.5; d.chargeMax = 2.5; if (this.tryTrigger(d)) break; } break; }
            this.faceAndroid(d, wdt);
            if (d.st === 'charge') {
              d.chargeT -= wdt;
              if (d.chargeT <= 0) { this.lancerFire(d); d.st = 'cool'; d.stT = 0; }
            } else if (d.st === 'cool' && d.stT > 3.5) { d.st = 'charge'; d.chargeT = 2.5; d.chargeMax = 2.5; }
            break;
          }
          case 'tether': {
            if (d.st === 'in') { if (this.moveTo(d, ...polar(th, 220), spd, wdt) < 4) { d.st = 'aim'; d.stT = 0; } break; }
            this.faceAndroid(d, wdt);
            if (d.st === 'aim' && d.stT > 2) {
              d.st = 'hooked';
              if (this.tryTrigger(d)) break;
              if (!this.hooked) this.hooked = d;
              this.fx.popText(AX + 40, AY - 60, 'ARM HOOKED', '#ffb020', 18);
            }
            if (d.st === 'hooked' && this.hooked === d) {
              const [ux, uy] = (() => { const dx = d.x - AX, dy = d.y - AY, l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; })();
              const pull = 10 * effN(this.eff, 'pullMul', 1);
              const nx = this.pl.ox + ux * pull * wdt, ny = this.pl.oy + uy * pull * wdt;
              if (Math.hypot(nx, ny) < 40) { this.pl.ox = nx; this.pl.oy = ny; }
            }
            break;
          }
          case 'swarm': {
            const pk = d.pack;
            if (!pk) { this.moveTo(d, AX, AY, spd, wdt); break; }
            if (d.st === 'in') {
              const off = (d.slot - 2) * 25;
              const tgt = polar(pk.th + off, 150);
              const rem = this.moveTo(d, tgt[0], tgt[1], spd, wdt);
              d.inSlot = rem < 10;
              if (!pk.formed && pk.members.filter((m) => !m.dead).every((m) => m.inSlot)) {
                pk.formed = true;
                if (this.tryTrigger(d)) break;
                pk.members.forEach((m, i) => { if (!m.dead) { m.st = 'wait'; m.stT = -i * 0.4; } });
              }
              break;
            }
            if (d.st === 'wait') { this.faceAndroid(d, wdt); if (d.stT > 0.6) d.st = 'attack'; break; }
            if (d.st === 'attack') { if (this.moveTo(d, AX, AY, 170 * sp, wdt) < 26) { this.chip(0.5, 'torso', d); this.killDrone(d, { noCombo: true, quiet: true }); } }
            break;
          }
          case 'spotter': {
            if (d.st === 'in') { if (this.moveTo(d, ...polar(clamp(th, -110, 110), 410), spd * 1.6, wdt) < 4) { d.st = 'hover'; d.stT = 0; } break; }
            this.faceAndroid(d, wdt);
            this.marked = true;
            d.holdT += wdt;
            const p = polar(th + Math.sin(d.t * 0.5) * 4 * wdt, 410);
            d.x = p[0]; d.y = p[1];
            if (d.holdT > 3 && !d.tried) { d.tried = true; if (this.tryTrigger(d)) break; }
            d.callT -= wdt;
            if (d.callT <= 0) { d.callT = 8; for (let i = 0; i < 2; i++) this.spawnDrone('scout', th + (i ? 25 : -25)); this.fx.popText(d.x, d.y + 30, 'CALLING BACKUP', '#ff6a3d', 16); }
            break;
          }
          case 'heavy': {
            if (d.st === 'in' || d.st === 'back') { if (this.moveTo(d, ...polar(th, 300), d.st === 'back' ? 120 : spd, wdt) < 6) { d.st = 'wind'; d.stT = 0; } break; }
            if (d.st === 'wind') {
              this.faceAndroid(d, wdt);
              if (d.stT > 1.2) { d.st = 'ram'; if (this.tryTrigger(d)) break; }
              break;
            }
            if (d.st === 'ram') {
              if (this.moveTo(d, AX, AY, 180 * sp, wdt) < 52) {
                this.chip(1, 'torso', d, true);
                const [ux, uy] = this.awayDir(d.x, d.y);
                this.pl.ox = clamp(this.pl.ox - ux * 30, -40, 40); this.pl.oy = clamp(this.pl.oy - uy * 30, -40, 40);
                d.st = 'back';
              }
            }
            break;
          }
          case 'crawler': {
            const foot = AndroidTop.partPoint(this.pl.pose, AX + this.pl.ox, AY + this.pl.oy, 'foot' + d.foot, 1);
            if (d.st === 'clamp') { d.x = foot[0] + (d.foot === 'R' ? 10 : -10); d.y = foot[1]; this.snareT = Math.max(this.snareT, 0.2); break; }
            const rem = this.moveTo(d, foot[0] + (d.foot === 'R' ? 12 : -12), foot[1], spd, wdt);
            if (!d.tried && d.foot === 'R' && dist(d.x, d.y, foot[0], foot[1]) < 70) { d.tried = true; if (this.tryTrigger(d)) break; }
            if (rem < 4) { d.st = 'clamp'; this.snareT = 4; this.chip(0.5, 'legR', d); this.fx.popText(foot[0], foot[1] + 30, 'SNARED', '#ffb020', 18); }
            break;
          }
          case 'jammer': {
            if (d.st === 'in') { if (this.moveTo(d, ...polar(th, 180), spd, wdt) < 4) d.st = 'hover'; }
            else this.faceAndroid(d, wdt);
            if (dA < 160) this.jamT = 0.3;
            if (dA < 200 && !d.tried) {
              d.tried = true;
              if (this.canFreeze()) {
                this.fx.popText(d.x, d.y - 40, 'SIGNAL SCRAMBLED', '#ff7ad9', 20);
                const id = this.chooseThreat(this.cfg.pool);
                if (id) this.forceThreat(id, {});
              }
            }
            break;
          }
          case 'warden': this.updateWarden(d, wdt); break;
          default: break;
        }
      }
      this.drones = this.drones.filter((d) => !d.dead);
      if (this.selected && this.selected.dead) this.selected = null;
      if (this.hooked && this.hooked.dead) { this.hooked = null; }
      if (!this.hooked) { this.pl.ox *= Math.max(0, 1 - wdt * 1.5); this.pl.oy *= Math.max(0, 1 - wdt * 1.5); }
      this.snareT = Math.max(0, this.snareT - wdt);
    }

    lancerFire(d) {
      const front = Math.abs(bearing(d.x, d.y)) <= 90;
      const hand = AndroidTop.partPoint(this.pl.pose, AX + this.pl.ox, AY + this.pl.oy, 'handR', 1);
      const canShield = this.cd.palm <= 0 && !this.action && this.jamT <= 0;
      this.beams.push({ x1: d.x, y1: d.y, x2: hand[0], y2: hand[1], t: 0, life: 0.25, col: '255,90,90', w: 5 });
      if (canShield) {
        this.startAction({ kind: 'shield', side: 'R', front }, d, false);
        this.fx.shieldFlash(hand[0], hand[1], Math.atan2(d.y - hand[1], d.x - hand[0]), 26);
        this.fx.popText(hand[0], hand[1] - 36, 'BLOCKED', '#8ff0ff', 18);
      } else this.chip(0.5, 'armR', d);
    }

    // ---------------- damage / energy / combo ----------------
    damageDrone(d, dmg, o) {
      o = o || {};
      if (d.dead) return;
      if (d.type === 'warden') { this.fx.popText(d.x, d.y - 80, 'ARMOURED', '#9aa5b1', 18); this.fx.sparks(d.x, d.y, 6, { g: 0 }); return; }
      if (d.type === 'heavy' && o.swat) dmg *= 0.5;
      let crit = false;
      if (!o.noCrit && Math.random() < effN(this.eff, 'critChance', 0)) { dmg *= 2; crit = true; }
      d.hp -= dmg;
      d.hit = 1;
      if (o.kb) { d.kx += o.kb[0]; d.ky += o.kb[1]; }
      if (crit) this.fx.popText(d.x, d.y - 30, 'MUSCLE SURGE ×2', '#ff6a3d', 18);
      this.fx.sparks(d.x, d.y, 8, { g: 0, vmax: 320 });
      if (!o.noStop && !this.fx.reduce) this.hitStop = Math.max(this.hitStop, 0.06);
      Audio.droneZap && Audio.droneZap();
      if (d.hp <= 0) this.killDrone(d, o);
    }

    killDrone(d, o) {
      o = o || {};
      if (d.dead) return;
      d.dead = true;
      const sz = DT[d.type].size * (d.elite ? 1.2 : 1);
      this.fx.droneExplode(d.x, d.y, sz);
      if (!o.quiet) Audio.droneBoom && Audio.droneBoom();
      if (d.ally && d.ally.state === 'netted' && d.ally.netter === d) { d.ally.netter = null; this.freeAlly(d.ally, true); }
      if (this.hooked === d) this.hooked = null;
      this.stats.kills++; this.ws.kills++;
      if (!o.noCombo) this.addCombo(1, d.x, d.y);
    }

    addCombo(n, x, y, quiet) {
      const before = this.combo;
      this.combo += n;
      this.comboT = this.eff.comboKeep || 3;
      this.stats.comboBest = Math.max(this.stats.comboBest, this.combo);
      this.ws.comboBest = Math.max(this.ws.comboBest, this.combo);
      if (this.combo >= 2 && !quiet) this.fx.comboText(x != null ? x : AX, (y != null ? y : AY) - 40, this.combo);
      if (Math.floor(this.combo / 5) > Math.floor(before / 5)) {
        this.overdrive = effN(this.eff, 'overdriveTime', 4);
        if (!quiet) this.fx.popText(AX, AY - 120, UI.hud.overdrive, '#ff6a3d', 40);
        this.fx.doFlash(0.2, '255,120,60');
        const a = pick(this.allies.filter((q) => this.allyWorking(q)));
        if (a) this.say(a, pick(C.DRONE_BANTER.events.overdrive));
      }
    }
    breakCombo() { this.combo = 0; this.comboT = 0; }

    gainEnergy(n, x, y) {
      const ax = AX + this.pl.ox, ay = AY + this.pl.oy;
      if (this.energy >= this.maxEnergy) { this.fx.popText(ax, ay - 70, 'ENERGY FULL', '#aac8d7', 16); return; }
      this.energy = Math.min(this.maxEnergy, this.energy + n);
      this.fx.energyGain(ax, ay - 10);
      Audio.energyUp();
      this.fx.popText(ax, ay - 70, '+1 ENERGY', '#4dffa0', 24);
    }

    // real-time chip: ½ cell (spotter mark doubles it), sparks, no explosion
    chip(amount, part, src, heavy) {
      if (!(this.mode === 'play' || this.mode === 'intro')) return;
      if (this.marked) amount *= 2;
      this.energy = Math.max(0, this.energy - amount);
      const p = AndroidTop.partPoint(this.pl.pose, AX + this.pl.ox, AY + this.pl.oy, part === 'legR' ? 'footR' : part === 'armR' ? 'handR' : part, 1);
      this.fx.sparks(p[0], p[1], heavy ? 22 : 12, { g: 0, vmax: 420 });
      this.fx.addShake(heavy ? 8 : 4);
      this.fx.popText(p[0], p[1] - 40, amount >= 1 ? `−${amount} ENERGY` : '−½ ENERGY', '#ff6a6a', 20);
      Audio.pop();
      this.stats.chips++; this.ws.hits++;
      this.breakCombo();
      this.hitFlash = 0.35;
      if (this.energy <= 0) this.startShutdown();
    }

    // ---------------- director (§4.4a) ----------------
    canFreeze() {
      return this.mode === 'play' && !this.rescue && !this.cfg.boss && this.waveT >= 15 && this.sinceFreeze >= 12 && this.freezesDone < this.cfg.target;
    }

    chooseThreat(ids) {
      if (!ids.length) return null;
      const r = this.reask.find((id) => ids.includes(id));
      if (r) return r;
      const unseen = ids.filter((id) => this.seen[id] == null && !(this.save.threatStats[id] && this.save.threatStats[id].seen));
      if (unseen.length) return pick(unseen);
      // endless: 50% weighted toward the lowest-accuracy ids in this save
      if (this.wave >= 11 && Math.random() < 0.5) {
        const acc = (id) => { const s = this.save.threatStats[id]; return s && s.seen ? (s.firstTryCorrect || 0) / s.seen : 0; };
        return ids.slice().sort((a, b) => acc(a) - acc(b))[0];
      }
      return ids.slice().sort((a, b) => (this.seen[a] || 0) - (this.seen[b] || 0))[0];
    }

    tryTrigger(d, extra) {
      extra = extra || {};
      if (!this.canFreeze() && !(d.elite && this.mode === 'play' && !this.rescue && !this.cfg.boss && this.freezesDone < this.cfg.target && this.sinceFreeze >= 6)) return false;
      let ids = compatible(d.type, bearing(d.x, d.y), extra.ally).filter((id) => this.cfg.pool.includes(id));
      if (d.type === 'spotter') {
        if (d.elite && this.cfg.pool.includes('discSnap')) ids = ['discSnap'];
        else ids = ids.filter((id) => (this.windupDone ? id === 'discThrow' : id === 'discWindup'));
      }
      const id = this.chooseThreat(ids);
      if (!id) return false;
      return this.beginFreeze(id, d, extra);
    }

    updateDirector(wdt) {
      if (this.mode !== 'play') return;
      this.sinceFreeze += wdt;
      if (this.cfg.boss) return;
      if (!this.canFreeze()) return;
      if (this.reask.length && this.sinceFreeze >= 14) {
        const id = this.reask.find((q) => this.cfg.pool.includes(q)) || this.reask[0];
        this.forceThreat(id, { elite: true });
        return;
      }
      const expected = this.cfg.need / 1.3;
      if (this.freezesDone < (this.cfg.target * this.waveT) / expected - 1) {
        const id = this.chooseThreat(this.cfg.pool);
        if (id) this.forceThreat(id, { elite: true });
      }
    }

    // spawn a drone of the threat's type and stage it (re-asks, jammer, Warden, schedule, debug)
    forceThreat(id, o) {
      o = o || {};
      const S = THREAT_STAGE[id];
      if (!S) return false;
      let d;
      if (S.type === 'swarm') { const pk = this.spawnSwarm(S.th, { proxy: true, elite: o.elite }); d = pk.members[2]; }
      else {
        const at = o.from ? [o.from.x, o.from.y] : polar(S.th, Math.max(S.d + 260, 420));
        d = this.spawnDrone(S.type, S.th, { at, proxy: true, elite: o.elite || S.elite });
      }
      return this.beginFreeze(id, d, Object.assign({ forced: true }, o));
    }

    // ---------------- threat freeze (§4.4) ----------------
    buildOptions(st) {
      if (st.kind === 'contraction') {
        const base = (st.options || ['Concentric', 'Eccentric', 'Isometric']).slice();
        if (st.tier >= 3 && st.fail.Isotonic && !base.includes('Isotonic')) base.push('Isotonic');
        return shuffle(base);
      }
      const ds = st.distractors.slice();
      const pw = shuffle(st.planeWrong.slice());
      let opts;
      if (st.tier <= 1) opts = [st.correct, ds[0], pw[0], pw[1]];
      else if (st.tier === 2) opts = [st.correct, ds[0], pick(ds.slice(1)) || pw[1], pw[0]];
      else { opts = [st.correct].concat(ds.slice(0, 3)); let i = 0; while (opts.length < 4 && i < pw.length) opts.push(pw[i++]); }
      return shuffle(opts.filter((v, i, a) => v && a.indexOf(v) === i));
    }

    // the staged drone sits just beyond where the CORRECT action's hand ends
    // (physics-honest: the wrong options visibly fall short or go the other way)
    stagePositions(id) {
      const S = THREAT_STAGE[id];
      const st = TopPose.threat(id, 'stage'), sp = TopPose.threat(id, 'success');
      const r = radiusOf(S.type);
      const out = { drone: polar(S.th, S.d), members: null, ally: null };
      const beyond = (pose, side, extra) => {
        const h = AndroidTop.handPos(pose, AX, AY, side, 1);
        const s = AndroidTop.partPoint(pose, AX, AY, 'shoulder' + side, 1);
        const dx = h[0] - s[0], dy = h[1] - s[1], l = Math.hypot(dx, dy) || 1;
        return [h[0] + (dx / l) * (r + extra), h[1] + (dy / l) * (r + extra)];
      };
      switch (id) {
        case 'netterOnAlly_left': case 'netterOnAlly_right': out.drone = beyond(sp, 'L', 2); break;
        case 'crossSwat': case 'backhandSwat': case 'diveBehind': out.drone = beyond(sp, 'R', 2); break;
        case 'heavyCatch': out.drone = beyond(st, 'R', -4); break;
        case 'hipPivot': {
          const t = AndroidTop.partPoint(sp, AX, AY, 'toeR', 1), h = AndroidTop.partPoint(sp, AX, AY, 'heelR', 1);
          const dx = t[0] - h[0], dy = t[1] - h[1], l = Math.hypot(dx, dy) || 1;
          out.drone = [t[0] - (dy / l) * 2 + (dx / l) * 2, t[1] + (dx / l) * 2 + (dy / l) * 2];
          break;
        }
        case 'spineTwist': {
          out.members = [];
          for (let i = 0; i < 5; i++) {
            const k = 0.12 + (i / 4) * 0.8;
            out.members.push(beyond(TopPose.lerp(st, sp, k), 'R', 4));
          }
          out.drone = out.members[2];
          break;
        }
        default: break;
      }
      if (S.ally) {
        if (S.ally.helper) out.ally = polar(S.ally.at[0], S.ally.at[1]);
        else {
          const [ux, uy] = this.awayDir(out.drone[0], out.drone[1]);
          out.ally = [out.drone[0] + ux * 105, out.drone[1] + uy * 105];
        }
      }
      return out;
    }

    pickStageAlly(S) {
      const spec = S.ally;
      const pref = this.allies.find((a) => a.id === spec.prefer && this.validAllyTarget(a));
      if (pref) return pref;
      const side = this.nearestAlly(spec.side === 'L' ? 200 : 1080, 420, (a) => (spec.side === 'L' ? a.x < AX : a.x >= AX));
      return side || this.nearestAlly(AX, AY);
    }

    beginFreeze(id, d, o) {
      o = o || {};
      const st = C.DRONE_THREATS[id], S = THREAT_STAGE[id];
      if (!st || !S || !d) return false;
      let ally = null;
      if (S.ally) {
        ally = o.ally && this.validAllyTarget(o.ally) && S.ally.side === (o.ally.x < AX ? 'L' : 'R') ? o.ally : this.pickStageAlly(S);
        if (!ally && !S.ally.helper) { if (d.proxy) d.dead = true; return false; }
      }
      // a netter that was charging someone else lets go of that target
      const pos = this.stagePositions(id);
      const members = d.pack ? d.pack.members.filter((m) => !m.dead) : [d];
      members.forEach((m) => { m.staged = true; m.from = [m.x, m.y]; m.kx = 0; m.ky = 0; });
      if (d.pack && pos.members) members.forEach((m, i) => { m.stageAt = pos.members[i % 5]; });
      else d.stageAt = pos.drone;
      if (ally) { ally.staged = true; ally.from = [ally.x, ally.y]; ally.stageAt = pos.ally; }
      const reask = this.reask.includes(id) || !!o.reask;
      const options = reask && this.optionSets[id] ? shuffle(this.optionSets[id].slice()) : this.buildOptions(st);
      this.optionSets[id] = options.slice();
      let total = this.cfg.timerBase + (this.eff.freezeBonus || 0);
      if (o.boss) total = Math.max(4.5, total - 1);
      total = Math.min(12, total);
      if (this.debugTimer) total = this.debugTimer;
      // content names the ally the drawing normally uses (KITE / BOLT); when a
      // different ally stands in, the name follows the ally on screen
      const prefName = S.ally ? (C.ALLY_ROSTER.find((r) => r.id === S.ally.prefer) || {}).name : null;
      const nm = (s) => (s && prefName && ally && ally.name !== prefName ? String(s).replace(new RegExp('\\b' + prefName + '\\b', 'g'), ally.name) : s);
      const T = TopPose.THREATS[id] || {};
      this.freeze = {
        id, st, S, drone: d, members, ally, o, options, total, timer: total, reask, t: 0, nm,
        fromPose: TopPose.clone(this.pl.pose), fromOff: [this.pl.ox, this.pl.oy],
        stagePose: TopPose.threat(id, 'stage'), tOpts: T.opts || {}, beat: 0, lastSec: Math.ceil(total), boss: !!o.boss,
      };
      this.freeze.cam = this.freezeCam(id, pos, ally);
      this.action = null; this.pending = null;
      if (this.rescue) this.closeRescue();
      this.bubbles = [];
      if (this.fx._dp) this.fx._dp = this.fx._dp.filter((q) => q.t !== 'text'); // no stale pop text over the question
      this.seen[id] = this.time;
      this.mode = 'ramp';
      this.modeT = 0;
      Audio.lockOn && Audio.lockOn();
      return true;
    }

    // camera that fits the android, the threat drone and the ally inside the
    // half of the screen the decision panel leaves free
    freezeCam(id, pos, ally) {
      const S = THREAT_STAGE[id];
      const pts = [[AX - 62, AY - 62], [AX + 62, AY + 62]];
      const r = radiusOf(S.type) + 26;
      const add = (p, rr) => { pts.push([p[0] - rr, p[1] - rr]); pts.push([p[0] + rr, p[1] + rr]); };
      add(pos.drone, r);
      if (pos.members) pos.members.forEach((m) => add(m, 22));
      if (pos.ally) add(pos.ally, 34);
      if (S.zoomOn === 'feet') { pts.length = 0; add([AX + 10, AY + 4], 70); add(pos.drone, 30); }
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      pts.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
      const panelLeft = S.side === 'left';
      const fr = panelLeft ? { x0: 420, x1: W - 16, y0: 70, y1: H - 16 } : { x0: 16, x1: W - 420, y0: 70, y1: H - 16 };
      const Z = clamp(Math.min((fr.x1 - fr.x0) / (x1 - x0), (fr.y1 - fr.y0) / (y1 - y0)), 1, S.zoomOn === 'feet' ? 2.4 : 2.1);
      return { Z, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, sx: (fr.x0 + fr.x1) / 2, sy: (fr.y0 + fr.y1) / 2 };
    }

    updateRamp(dt) {
      const F = this.freeze;
      this.modeT += dt;
      const k = ease(this.modeT / 0.6);
      this.ts = lerp(1, 0.04, k);
      this.camK = k;
      for (const m of F.members) if (!m.dead && m.stageAt) { m.x = lerp(m.from[0], m.stageAt[0], k); m.y = lerp(m.from[1], m.stageAt[1], k); m.ang = Math.atan2(AY - m.y, AX - m.x); }
      if (F.S.type === 'netter' && F.ally) F.drone.ang = Math.atan2(F.ally.y - F.drone.y, F.ally.x - F.drone.x);
      if (F.ally && F.ally.stageAt) { F.ally.x = lerp(F.ally.from[0], F.ally.stageAt[0], k); F.ally.y = lerp(F.ally.from[1], F.ally.stageAt[1], k); }
      this.pl.ox = lerp(F.fromOff[0], 0, k); this.pl.oy = lerp(F.fromOff[1], 0, k);
      const p = TopPose.lerp(F.fromPose, F.stagePose, k);
      p.mus = F.stagePose.mus;
      this.pl.pose = p;
      if (this.modeT >= 0.6) this.enterDecide();
    }

    enterDecide() {
      const F = this.freeze;
      this.mode = 'decide';
      this.modeT = 0;
      this.ts = 0.02;
      this.camK = 1;
      this.stats.freezes++;
      this.game.ui.showDecision({
        title: fill(UI.freeze.banner, { title: F.nm(F.st.title) }),
        prompt: F.nm(F.st.prompt),
        kind: F.st.kind,
        options: F.options,
        reask: F.reask,
        side: F.S.side === 'left' ? 'dd-left' : 'dd-right',
      });
      Audio.slow();
    }

    tremKeys(F) {
      const keys = [];
      for (const j of F.S.joints) {
        if (j === 'shoulderL') keys.push('L.hz', 'L.rot');
        else if (j === 'shoulderR') keys.push('R.hz', 'R.rot');
        else if (j === 'trunk') keys.push('trunk');
        else if (j === 'foreR') keys.push('R.pr');
        else if (j === 'hipR') keys.push('hipR');
      }
      return keys;
    }

    updateDecide(dt) {
      const F = this.freeze;
      F.timer -= dt;
      this.ts = 0.02;
      const k = 1 - F.timer / F.total;
      const p = TopPose.jitter(F.stagePose, 0.5 + 2 * k, this.tremKeys(F));
      p.mus = F.stagePose.mus;
      this.pl.pose = p;
      F.beat -= dt;
      if (F.beat <= 0) { Audio.heartbeat(); F.beat = lerp(0.95, 0.32, k); }
      const sec = Math.ceil(F.timer);
      if (sec < F.lastSec) { F.lastSec = sec; Audio.tick(); }
      this.game.ui.setTimer(Math.max(0, F.timer / F.total), Math.max(0, F.timer));
      if (F.timer <= 0) this.resolve(null);
    }

    choose(i) {
      if (this.mode === 'decide' && this.freeze) { const opt = this.freeze.options[i]; if (opt) this.resolve(opt); return; }
      if (this.rescue) this.answerRescue(i);
    }
    acceptsChoice() { return this.mode === 'decide' || !!(this.rescue && this.mode === 'play'); }

    resolve(choice) {
      const F = this.freeze;
      if (this.mode !== 'decide' || !F) return;
      const st = F.st;
      this.game.ui.hideDecision();
      let result;
      if (choice == null) result = 'timeout';
      else if (choice === st.correct) result = 'correct';
      else if (st.kind === 'movement' && C.planeOf(choice) !== 'transverse') result = 'plane';
      else result = st.kind === 'contraction' ? 'contraction' : 'inplane';
      F.result = result; F.choice = choice;
      const rt = Math.round((F.total - Math.max(0, F.timer)) * 1000);
      this.stats.log.push({ t: Date.now(), wave: this.wave, source: 'threat', id: F.id, topic: st.kind === 'movement' ? 'joint_actions' : 'contractions', kind: st.kind, choice: choice || '(timeout)', correct: result === 'correct', answer: st.correct, result, rtMs: rt, reask: F.reask, assist: false, boss: F.boss });
      const ts = this.save.threatStats[F.id] || (this.save.threatStats[F.id] = { seen: 0, firstTryCorrect: 0, streak: 0 });
      if (!F.reask) { this.stats.firstTries++; ts.seen++; }
      if (result === 'correct') {
        this.stats.correct++; this.ws.correct++;
        if (!F.reask) { this.stats.firstTryCorrect++; ts.firstTryCorrect++; }
        ts.streak = (ts.streak || 0) + 1;
        this.reask = this.reask.filter((q) => q !== F.id);
        Audio.good();
        this.game.ui.toast(Object.assign({}, st, { success: Object.assign({}, st.success, { detail: F.nm(st.success.detail) }) }), C.PLANES.transverse, { side: F.S.side === 'left' ? 'left' : 'right' });
        this.startAct(this.actSuccess(F));
        return;
      }
      ts.streak = 0;
      this.ws.wrong++;
      if (result === 'timeout') this.stats.timeout++;
      else if (result === 'plane') this.stats.plane++;
      else if (result === 'contraction') this.stats.contraction++;
      else this.stats.inplane++;
      if (result === 'plane') {
        this.failInfo = Object.assign({ choice, st, kind: 'plane', damage: 'android' }, C.planeFailText(choice, st.limb, 'transverse'));
        this.startAct(this.actPlaneFail(F));
        return;
      }
      const txt = result === 'timeout' ? st.timeout : st.fail[choice];
      const asKey = result === 'timeout' ? (txt.as || 'timeout') : (txt.as || choice);
      this.failInfo = {
        headline: F.nm(txt.headline), explain: F.nm(txt.explain), choice: choice || 'No answer (time ran out)', st, kind: result,
        damage: txt.damage, part: txt.part || 'torso', shownAs: choice && txt.as ? txt.as : null, ally: F.ally,
      };
      this.startAct(this.actWrong(F, asKey, result === 'timeout', txt));
    }

    startAct(act) { this.mode = 'act'; this.act = act; this.actT = 0; this.ts = 0.1; }

    // ---- success: the action plays, the drone is destroyed, muscles glow ----
    actSuccess(F) {
      const self = this, id = F.id, st0 = F.stagePose, sp = TopPose.threat(id, 'success');
      const d = F.drone;
      const MOVE = { netterOnAlly_left: 0.25, netterOnAlly_right: 0.25, crossSwat: 0.28, backhandSwat: 0.28, diveBehind: 0.35, spineTwist: 0.5,
        palmShield: 0.25, palmCatch: 0.25, discWindup: 0.3, discThrow: 0.12, discSnap: 0.12, tetherPull: 2.2, heavyCatch: 1.0, hipPivot: 0.25 };
      const T = (MOVE[id] || 0.3) * (id === 'tetherPull' || id === 'heavyCatch' ? effN(this.eff, 'holdMul', 1) : 1);
      const side = F.S.limbPt.slice(-1);
      const handAt = (p) => AndroidTop.handPos(p, AX, AY, side, 1);
      let hitDone = false, extra = 0, endT = T + 1.1;
      const killed = new Set();
      const kill = (m, big) => {
        if (!m || m.dead || killed.has(m)) return;
        killed.add(m);
        if (!this.fx.reduce) this.hitStop = 0.06;
        this.killDrone(m, { noCombo: true });
        if (big) this.fx.addShake(8);
      };
      const trail = () => {
        const pts = [];
        for (let i = 0; i <= 8; i++) { const q = TopPose.lerp(st0, sp, i / 8); pts.push(id === 'hipPivot' ? AndroidTop.partPoint(q, AX, AY, 'toeR', 1) : handAt(q)); }
        this.fx.swatTrail(pts, { width: 10, life: 0.4 });
        Audio.swat && Audio.swat();
      };
      this.readout = this.makeReadout(F, st0, sp, F.st.correct, 'correct');
      this.floater(F.S.limbPt, mvName(F.st.correct), '#7dff9a');
      if (id === 'tetherPull') endT = T + 1.2;
      if (id === 'heavyCatch') endT = T + 1.6;
      if (id === 'discWindup') endT = 2.0;
      if (id === 'palmShield' || id === 'palmCatch' || id === 'discThrow' || id === 'discSnap') endT = T + 1.4;
      return {
        update(t, dt) {
          let p;
          if (id === 'tetherPull') {
            p = TopPose.jitter(sp, 0.8, ['R.rot']); p.mus = sp.mus;
            if (F.ally) { const mid = [lerp(d.x, AndroidTop.partPoint(st0, AX, AY, 'wristR', 1)[0], 0.5), lerp(d.y, AndroidTop.partPoint(st0, AX, AY, 'wristR', 1)[1], 0.5)]; F.ally.x = lerp(F.ally.x, mid[0] + 16, Math.min(1, dt * 2)); F.ally.y = lerp(F.ally.y, mid[1] + 22, Math.min(1, dt * 2)); }
            if (t > T && !hitDone) { hitDone = true; self.fx.sparks(lerp(d.x, AX + 40, 0.5), lerp(d.y, AY, 0.5), 18, { g: 0, col: '#ffd27a' }); Audio.netRip && Audio.netRip(); d.cut = true; d.kx = (d.x - AX) * 3; d.ky = (d.y - AY) * 3; }
            if (t > T + 0.45 && !extra) { extra = 1; kill(d, true); }
          } else if (id === 'heavyCatch') {
            if (t < T) { p = TopPose.lerp(st0, sp, t / T); p.mus = sp.mus; const h = handAt(p); d.x = h[0] + 26; d.y = h[1] - 36; d.speedBar = 1 - t / T; }
            else {
              const shove = TopPose.with(sp, { R: { hz: 25 }, mus: { 'pectoralis_major:R': ['c', 1], 'deltoid_anterior:R': ['c', 0.8] } });
              p = TopPose.lerp(sp, shove, (t - T) / 0.15); p.mus = shove.mus;
              if (!hitDone) { hitDone = true; d.kx = 260; d.ky = -380; self.floater('handR', 'CONCENTRIC SHOVE', '#ff6a3d'); }
              if (t > T + 0.4 && !extra) { extra = 1; kill(d, true); }
            }
          } else if (id === 'discWindup') {
            if (t < 0.9) { p = TopPose.lerp(st0, sp, t / T); p.mus = sp.mus; if (t > T && !hitDone) { hitDone = true; Audio.clank(); self.fx.sparks(handAt(sp)[0], handAt(sp)[1], 6, { g: 0 }); } }
            else {
              const thr = TopPose.threat('discThrow', 'success');
              p = TopPose.lerp(sp, thr, (t - 0.9) / 0.12); p.mus = thr.mus;
              if (!extra) { extra = 1; self.floater('handR', mvName('Medial rotation') + ' (AUTO THROW)', '#ffd27a'); self.launchDisc(handAt(thr), d, 99, { kill: true }); self.windupDone = true; }
            }
          } else {
            p = TopPose.lerp(st0, sp, easeOut(t / T)); p.mus = sp.mus;
            if (id === 'spineTwist') {
              F.members.forEach((m, i) => { if (t / T >= 0.12 + (i / 4) * 0.8) kill(m); });
              if (t >= T && !hitDone) { hitDone = true; trail(); }
            } else if (t >= T * 0.85 && !hitDone) {
              hitDone = true;
              if (id === 'palmShield' || id === 'palmCatch') {
                const h = handAt(sp);
                self.beams.push({ x1: d.x, y1: d.y, x2: h[0], y2: h[1], t: 0, life: 0.3, col: '255,90,90', w: 6 });
                self.fx.shieldFlash(h[0], h[1], Math.atan2(d.y - h[1], d.x - h[0]), 26);
                setTimeout(() => { self.beams.push({ x1: h[0], y1: h[1], x2: d.x, y2: d.y, t: 0, life: 0.35, col: '143,240,255', w: 7 }); }, 120);
              } else if (id === 'discThrow' || id === 'discSnap') {
                self.launchDisc(handAt(sp), d, 99, { kill: true });
                self.windupDone = false;
              } else { trail(); if (id === 'hipPivot') Audio.crunch(); kill(d, true); }
            }
            if ((id === 'palmShield' || id === 'palmCatch') && t > T + 0.55 && !extra) { extra = 1; kill(d, true); }
          }
          self.pl.pose = p;
          if (t >= endT) self.finishOutcome();
        },
        onEnd() {},
      };
    }

    // ---- wrong (in-plane / contraction) or timeout ----
    actWrong(F, asKey, timeout, txt) {
      const self = this, id = F.id, d = F.drone;
      const st0 = F.stagePose, endPose = TopPose.threat(id, asKey);
      const hes = timeout ? 0.9 : 0;
      const T = F.st.kind === 'contraction' ? (asKey === 'Eccentric' ? (timeout ? 0.4 : 1.2) : asKey === 'timeout' ? 0.5 : 0.5) : 0.32;
      const tc = hes + T + 0.12;
      let hit = false, endT = tc + 1.3, lunge = null;
      if (!timeout) this.floater(F.S.limbPt, mvName(asKey), '#ffb020');
      else this.floater(F.S.limbPt, UI.card.timeoutTitle, '#ff6a6a');
      this.readout = this.makeReadout(F, st0, endPose, timeout ? null : (F.choice || asKey), timeout ? 'timeout' : 'wrong');
      return {
        update(t, dt) {
          let p;
          self.pl.neutral = timeout && t < hes + 0.1 && F.st.kind === 'movement';
          if (t < hes) { p = TopPose.jitter(st0, 1.5 + t * 2.5, self.tremKeys(F)); p.mus = st0.mus; }
          else { p = TopPose.lerp(st0, endPose, easeOut((t - hes) / T)); p.mus = endPose.mus; }
          // contraction specifics: dragged / shoved / reeled
          if (!timeout && id === 'tetherPull' && asKey === 'Eccentric') self.pl.ox = lerp(0, 40, ease((t - hes) / T));
          if (!timeout && id === 'heavyCatch' && asKey === 'Isometric') { self.pl.oy = lerp(0, 60, ease((t - hes) / 0.6)); }
          if (id === 'tetherPull' && (asKey === 'Concentric') && t > hes) { const w = AndroidTop.partPoint(p, AX, AY, 'wristR', 1); d.x = lerp(d.x, w[0] + 30, Math.min(1, dt * 6)); d.y = lerp(d.y, w[1], Math.min(1, dt * 6)); }
          if (id === 'heavyCatch' && t > hes && t < tc) { const h = AndroidTop.handPos(p, AX, AY, 'R', 1); d.x = h[0] + 26; d.y = h[1] - 36 + self.pl.oy * 0.3; }
          self.pl.pose = p;
          if (t >= tc && !hit) {
            hit = true;
            if (txt.damage === 'ally' && F.ally) {
              // the net fires over the ally
              self.beams.push({ x1: d.x, y1: d.y, x2: F.ally.x, y2: F.ally.y, t: 0, life: 0.2, col: '255,200,80', w: 3 });
              d.staged = false;
              self.netAlly(F.ally, d);
              self.failInfo.allyName = F.ally.name;
            } else {
              lunge = { t: 0, from: [d.x, d.y] };
            }
          }
          if (lunge) {
            lunge.t += dt;
            const part = txt.part || 'torso';
            const tp = AndroidTop.partPoint(self.pl.pose, AX + self.pl.ox, AY + self.pl.oy, part === 'armR' ? 'handR' : part === 'legR' ? 'footR' : part, 1);
            const ranged = d.type === 'lancer' || d.type === 'spotter';
            if (ranged) {
              if (!lunge.fired) { lunge.fired = true; self.beams.push({ x1: d.x, y1: d.y, x2: tp[0], y2: tp[1], t: 0, life: 0.3, col: '255,90,90', w: 6 }); }
            } else if (d.type !== 'heavy' || !(asKey === 'Isometric')) {
              const k = ease(lunge.t / 0.14);
              const tx = lerp(lunge.from[0], tp[0], k * 0.8), ty = lerp(lunge.from[1], tp[1], k * 0.8);
              F.members.forEach((m) => { if (!m.dead) { m.x = lerp(m.x, tx + (m.x - d.x) * 0.3, 0.5); m.y = lerp(m.y, ty + (m.y - d.y) * 0.3, 0.5); } });
            }
            if (lunge.t >= 0.14 && !lunge.done) {
              lunge.done = true;
              if (id === 'spineTwist' && asKey === 'Horizontal adduction') F.members.slice(3).forEach((m) => self.killDrone(m, { noCombo: true }));
              self.partialHit(part, tp);
              if (id === 'tetherPull' && asKey === 'Concentric') self.killDrone(d, { noCombo: true });
              else F.members.forEach((m) => { if (!m.dead) { if (m.type === 'swarm') self.killDrone(m, { noCombo: true, quiet: true }); else { m.staged = false; m.retreat = true; } } });
            }
          }
          if (t >= endT) self.finishOutcome();
        },
      };
    }

    // ---- wrong plane: malfunction, crack, glitch (§4.4e shared rules) ----
    actPlaneFail(F) {
      const self = this, start = TopPose.clone(this.pl.pose);
      const part = { armL: 'armL', armR: 'armR', trunk: 'trunk', forearmR: 'forearmR', legR: 'legR' }[F.st.limb] || 'armR';
      let cracked = false, flare = false, sT = 0;
      Audio.glitch();
      this.pl.status = 'warn';
      this.floater(F.S.limbPt, String(F.choice).toUpperCase() + '?!', '#ff5a5a');
      return {
        update(t, dt) {
          const k = ease(t / 0.35);
          let p = TopPose.jitter(start, 2 + 10 * k * (t < 1.2 ? 1 : Math.max(0, 1 - (t - 1.2) * 2)), self.tremKeys(F));
          const mus = {};
          ['pectoralis_major', 'deltoid_anterior', 'deltoid_posterior', 'infraspinatus', 'subscapularis', 'biceps_brachii', 'triceps_brachii', 'obliques', 'gluteus_maximus', 'pronator_teres', 'supinator'].forEach((m) => { mus[m] = [Math.random() < 0.5 ? 'c' : 'e', Math.random()]; });
          p.mus = mus;
          self.pl.pose = p;
          self.pl.mal = { part, t: k };
          sT -= dt;
          if (sT <= 0 && t < 1.8 && self.lastRig && self.lastRig.sparks && self.lastRig.sparks.length) {
            sT = 0.07;
            const s = pick(self.lastRig.sparks);
            self.fx.sparks(s[0], s[1], 6, { vmax: 380, g: 0 });
          }
          if (t > 0.3 && !cracked) {
            cracked = true;
            const h = self.worldToScreen(...AndroidTop.partPoint(start, AX, AY, 'head', 1));
            self.fx.makeCrack(h[0], h[1], W, H);
            self.fx.doFlash(0.5, '255,60,60');
            self.fx.addShake(12);
            Audio.crack(); Audio.glitch();
            self.pl.status = 'fail';
            self.loseCell();
          }
          if (t > 0.7 && !flare) {
            flare = true;
            // a camp flare drives the threat drone off (no double punishment)
            const d = F.drone;
            self.beams.push({ x1: TRUCK.x, y1: TRUCK.y - 40, x2: d.x, y2: d.y, t: 0, life: 0.5, col: '255,140,60', w: 4 });
            self.fx.popText(d.x, d.y - 40, 'FLARE!', '#ffb347', 20);
            F.members.forEach((m) => { m.staged = false; m.retreat = true; });
          }
          self.fx.glitch = t < 0.3 ? 0.2 : Math.min(0.85, 0.2 + (t - 0.3));
          if (t > 1.3) self.sysFail = Math.min(1, (t - 1.3) * 2);
          if (t > 2.3) { self.fx.glitch = 0.25; self.finishOutcome(); }
        },
      };
    }

    loseCell() {
      this.energy = Math.max(0, this.energy - 1);
      this.stats.partials++;
      this.breakCombo();
      if (this.energy <= 0 && this.failInfo) this.failInfo.shutdown = true;
    }

    // freeze-outcome hit on one part: -1 cell + partial explosion (none if it was the last cell)
    partialHit(part, at) {
      this.damage[part] = 1;
      if (this.energy <= 1) { this.loseCell(); this.fx.sparks(at[0], at[1], 20, { g: 0 }); return; }
      this.fx.partialExplosion(at[0], at[1], 0.45, {});
      Audio.pop();
      this.loseCell();
    }

    finishOutcome() {
      const F = this.freeze;
      this.act = null;
      this.pl.neutral = false;
      if (F.result === 'correct') { this.endFreeze(true); return; }
      if (this.failInfo && this.failInfo.shutdown && !this.failInfo.shutPlayed) {
        this.failInfo.shutPlayed = true;
        this.stats.shutdowns++;
        this.startAct(this.actShutdown(true));
        return;
      }
      this.mode = 'failed';
      this.ts = 0;
      Audio.fail();
      const info = this.failInfo;
      info.energy = this.energy; info.max = this.maxEnergy;
      this.game.ui.showFailDD(info);
    }

    // fail-card button: ghost replay of the correct action, then back to real time
    retry() {
      if (this.mode === 'failed') {
        this.mode = 'replay'; this.modeT = 0;
        this.ghostRig.reset();
        this.sysFail = 0; this.fx.glitch = 0; this.fx.crack = null;
        this.pl.mal = null; this.pl.status = 'ok';
        Audio.whoosh();
        return;
      }
    }

    updateReplay(dt) {
      this.modeT += dt;
      const F = this.freeze;
      const k = ease((this.modeT - 0.15) / 1.0);
      const g = TopPose.lerp(F.stagePose, TopPose.threat(F.id, 'success'), k);
      g.mus = TopPose.threat(F.id, 'success').mus;
      this.ghostPose = g;
      this.ghostRig.update(g, dt * 0.6);
      if (this.modeT >= 1.6) { this.ghostPose = null; this.endFreeze(false); }
    }

    endFreeze(ok) {
      const F = this.freeze;
      if (!F) return;
      this.readout = null;
      if (F.ally && F.ally.state !== 'netted' && F.ally.state !== 'taken') { F.ally.staged = false; F.ally.state = 'run'; }
      F.members.forEach((m) => { if (!m.dead && m.staged) { m.staged = false; m.retreat = true; } });
      this.pl.mal = null; this.pl.status = 'ok'; this.sysFail = 0;
      this.fx.glitch = 0; this.fx.crack = null;
      this.freezesDone++;
      this.sinceFreeze = 0;
      this.ws.freezes++;
      if (ok) {
        this.addCombo(2, F.drone.x, F.drone.y);
        this.addScrap(5, F.drone.x, F.drone.y);
        const a = F.ally || pick(this.allies.filter((q) => this.allyWorking(q)));
        if (a && F.ally) this.say(a, pick(C.DRONE_BANTER.events.rescued));
      } else if (!F.boss && !this.reask.includes(F.id)) this.reask.push(F.id);
      if (F.boss) this.wardenChainResult(ok, F.id);
      this.freeze = null;
      if (this.failInfo && this.failInfo.shutdown) { this.failInfo = null; this.loseWave('shutdown'); return; }
      this.failInfo = null;
      this.mode = 'resume';
      this.modeT = 0;
    }

    addScrap(n, x, y, opts) {
      const Wk = SEHS.Workshop;
      if (Wk && typeof Wk.addScrap === 'function' && !opts) { try { Wk.addScrap(this.save, n); } catch (e) { this.save.scrap = (this.save.scrap || 0) + n; } }
      else if (!opts) this.save.scrap = (this.save.scrap || 0) + n;
      this.ws.scrap += n;
      const p = this.worldToScreen(x, y);
      this.fx.scrapPickup(x, y, { n: Math.min(8, n), tx: this.screenToWorld(1084, 28)[0], ty: this.screenToWorld(1084, 28)[1] });
      this.fx.popText(x, y - 30, `+${n} SCRAP`, '#ffd27a', 22);
      Audio.scrapCoin && setTimeout(() => Audio.scrapCoin(), 350);
      return p;
    }

    // live angle readout (mirrors the sagittal knee-angle overlay): describes
    // the joint that actually moved, and says so when it was not the one asked
    makeReadout(F, from, to, choice, kind) {
      const key = F.S.key;
      if (F.st.kind === 'contraction') {
        const a = TopPose.get(from, key), b = TopPose.get(to, key);
        const c = kind === 'correct' ? F.st.correct : kind === 'timeout' ? null : choice;
        const lens = { Isometric: 'length unchanged', Concentric: 'muscle shortens', Eccentric: 'muscle lengthens under tension', Isotonic: 'muscle shortens' };
        const lbl = key === 'R.hz' ? 'arm' : 'forearm';
        return { text: c ? `${lbl} ${Math.round(a)}° → ${Math.round(b)}°: ${lens[c] || ''} → ${String(c).toUpperCase()}` : `${lbl} ${Math.round(a)}° → ${Math.round(b)}°: no controlled contraction: the arm was simply pushed`, kind, t: 0 };
      }
      const keys = ['trunk', 'L.hz', 'R.hz', 'L.rot', 'R.rot', 'L.pr', 'R.pr', 'hipR', 'hipL'];
      let km = key, best = 0;
      for (const k of keys) { const dd = Math.abs(TopPose.get(to, k) - TopPose.get(from, k)); if (dd > best + 1) { best = dd; km = k; } }
      const a = TopPose.get(from, km), b = TopPose.get(to, km);
      if (best < 2) return { text: `${this.jointWord(key)} ${Math.round(a)}° → ${Math.round(b)}°: no movement`, kind, t: 0 };
      const raised = /\.rot$/.test(km) && TopPose.get(from, km[0] + '.fl') >= 60;
      let what;
      if (km.endsWith('.hz')) what = b > a ? `AWAY from the midline → ${mvName('Horizontal abduction')}` : `TOWARD the midline → ${mvName('Horizontal adduction')}`;
      else if (raised) what = `the arm rolls about its own long axis → ${b > a ? mvName('Lateral rotation') : mvName('Medial rotation')}`;
      else if (km.endsWith('.rot')) what = b > a ? `forearm swings OUT → ${mvName('Lateral rotation')}` : `forearm swings IN → ${mvName('Medial rotation')}`;
      else if (km.endsWith('.pr')) what = b > a ? `palm turns FORWARD → ${mvName('Supination')}` : `palm turns BACKWARD → ${mvName('Pronation')}`;
      else if (km === 'trunk') what = `${b > a ? 'turns right' : 'turns left'} → ${mvName('Rotation')}`;
      else what = b > a ? `toes turn OUT → ${mvName('Lateral rotation')}` : `toes turn IN → ${mvName('Medial rotation')}`;
      let tail = '';
      if (km !== key) tail = ` (${this.jointWord(key)} did not ${key.endsWith('.hz') ? 'sweep' : 'turn'})`;
      return { text: `${this.jointWord(km)} ${Math.round(a)}° → ${Math.round(b)}°: ${what}${tail}`, kind, t: 0 };
    }

    jointWord(k) { return k === 'trunk' ? 'trunk' : k.startsWith('hip') ? 'hip' : k.endsWith('.pr') ? 'forearm' : k.endsWith('.rot') ? (k[0] === 'L' ? 'left shoulder' : 'right shoulder') : 'arm'; }

    // ---------------- shutdown / NO CREW / wave end ----------------
    startShutdown() {
      if (this.mode === 'act' || this.mode === 'lost' || this.mode === 'shutdown') return;
      this.stats.shutdowns++;
      this.closeRescue();
      this.startAct(this.actShutdown(false));
    }

    actShutdown(fromFreeze) {
      const self = this, start = TopPose.clone(this.pl.pose);
      this.fx.glitch = 0; this.sysFail = 0;
      this.fx.shutdown(1.4);
      Audio.powerDown();
      this.pl.status = 'fail';
      let done = false;
      return {
        update(t) {
          self.ts = 0.05;
          const p = TopPose.lerp(start, TopPose.LIB.shutdown, ease(t / 0.9));
          p.mus = null;
          self.pl.pose = p;
          self.pl.neutral = true;
          self.powerFail = clamp((t - 0.3) / 0.4, 0, 1);
          if (t > 2.2 && !done) {
            done = true;
            self.pl.neutral = false;
            if (fromFreeze) {
              self.act = null;
              self.mode = 'failed'; self.ts = 0;
              const info = self.failInfo; info.energy = 0; info.max = self.maxEnergy;
              self.game.ui.showFailDD(info);
            } else self.loseWave('shutdown');
          }
        },
      };
    }

    noCrew() {
      if (this.mode === 'lost') return;
      this.stats.noCrew++;
      this.loseWave('nocrew');
    }

    loseWave(why) {
      this.mode = 'lost';
      this.act = null;
      this.ts = 0;
      this.closeRescue();
      this.game.ui.hideDecision();
      this.stats.log.push({ t: Date.now(), wave: this.wave, source: 'wave', id: why, result: 'failed' });
      this.persist();
      const crew = why === 'nocrew';
      this.lostWhy = why;
      const ui = this.game.ui;
      Audio.fail();
      setTimeout(() => {
        if (this.game.level !== this || this.mode !== 'lost') return;
        ui.ddCard({
          kicker: crew ? UI.wave.noCrew : `${UI.wave.shutdown} · ENERGY 0/${this.maxEnergy}`,
          kickerClass: 'red',
          title: crew ? UI.wave.noCrew : UI.wave.failed,
          html: `<p>${crew ? UI.wave.noCrewDetail : UI.wave.restart}</p>${this.reask.length ? `<p class="dim">Threats waiting to be asked again: <b>${this.reask.map((id) => C.DRONE_THREATS[id].title).join(', ')}</b></p>` : ''}`,
          buttons: [
            { label: 'Menu', act: 'menu' },
            workshopAPI() ? { label: 'Workshop first', act: () => this.openWorkshop(this.wave) } : null,
            { label: `Restart wave ${this.wave} (Enter)`, primary: true, act: () => this.restartWave() },
          ].filter(Boolean),
        });
      }, crew ? 900 : 300);
    }

    clearWave() {
      this.mode = 'clear';
      this.modeT = 0;
      this.closeRescue();
      this.drones.forEach((d) => { if (d.type !== 'warden') { d.staged = false; d.retreat = true; } });
      Audio.waveClear && Audio.waveClear();
      const a = pick(this.allies.filter((q) => q.state !== 'taken'));
      if (a) this.say(a, pick(C.DRONE_BANTER.events.waveClear));
      this.stats.wavesCleared++;
      const prevBest = this.save.bestWave || 0;
      this.newRecord = this.wave > prevBest;
      const Wk = SEHS.Workshop;
      if (Wk && typeof Wk.onWaveCleared === 'function') {
        // workshop owns the record keeping: best wave, next wave, +20 scrap
        try { const r = Wk.onWaveCleared(this.save, this.wave); if (r && r.newRecord != null) this.newRecord = r.newRecord; } catch (e) { /* fall through */ }
        this.addScrap(20, TRUCK.x, TRUCK.y - 40, { visualOnly: true });
      } else {
        this.save.bestWave = Math.max(prevBest, this.wave);
        this.save.wave = this.wave + 1;
        this.save.lifetime.waves = (this.save.lifetime.waves || 0) + 1;
        this.addScrap(20, TRUCK.x, TRUCK.y - 40);
      }
      this.kiteHome = this.allies.some((q) => q.id === 'kite' && q.state !== 'taken');
      this.persist();
    }

    showSummary() {
      this.mode = 'summary';
      const ws = this.ws, ui = this.game.ui;
      const wk = workshopAPI();
      const esc = this.wave === 10;
      const acc = ws.freezes ? Math.round((ws.correct / ws.freezes) * 100) : 100;
      ui.ddCard({
        kicker: fill(UI.wave.cleared, { subsystem: this.cfg.sub }) + (this.newRecord ? ` · ${UI.wave.newRecord}` : ''),
        kickerClass: 'green',
        title: esc ? UI.wave.escape : `Wave ${this.wave} cleared`,
        html: `${esc ? `<p>${UI.wave.escapeDetail}</p>` : `<p class="dim">${pick(UI.wave.outroLines)}</p>`}
          <div class="stats">
            <div><b>${ws.correct}/${ws.freezes}</b><span>threat freezes right (${acc}%)</span></div>
            <div><b>${ws.kills}</b><span>drones destroyed</span></div>
            <div><b>${ws.rescues}</b><span>allies rescued</span></div>
            <div><b>×${ws.comboBest}</b><span>best combo</span></div>
            <div><b>+${ws.scrap}</b><span>scrap earned (total ${this.save.scrap})</span></div>
            <div><b>${this.save.bestWave}</b><span>best wave${this.newRecord ? ' · NEW RECORD' : ''}</span></div>
            <div><b>${this.energy}/${this.maxEnergy}</b><span>energy left</span></div>
            <div><b>${this.reask.length}</b><span>threats to re-ask</span></div>
          </div>
          ${this.reask.length ? `<p class="dim">Coming back next wave: <b>${this.reask.map((id) => C.DRONE_THREATS[id].title).join(', ')}</b></p>` : ''}
          ${this.saveOk ? '' : `<p class="dim">${UI.hud.notSaved}</p>`}`,
        buttons: [
          { label: 'Menu', act: 'menu' },
          wk ? { label: `${UI.workshop.title} ▶ (Enter)`, primary: true, act: () => this.openWorkshop(this.wave + 1) }
            : { label: `Wave ${this.wave + 1} ▶ (Enter)`, primary: true, act: () => this.startWave(this.wave + 1) },
        ],
      });
    }

    scoutIntel(n) {
      const cfg = waveCfg(n);
      if (!this.kiteHome && !this.allies.some((a) => a.id === 'kite' && a.state !== 'taken')) return { signal: false, noSignal: true, wave: n, drones: [], text: UI.workshop.intelNoSignal };
      const counts = {};
      cfg.types.forEach((t) => { counts[t] = 0; });
      const q = waveCfg(n);
      const tmp = { cfg: q, wave: n };
      const list = this.buildSpawnQueue.call(tmp);
      list.forEach((t) => { counts[t] = (counts[t] || 0) + (t === 'swarm' ? 5 : 1); });
      const sides = cfg.sides; let main = 'N', mv = -1;
      for (const k in sides) if (sides[k] > mv) { mv = sides[k]; main = k; }
      const even = Object.keys(sides).length > 1 && Object.values(sides).every((v) => v === mv);
      return {
        signal: true, noSignal: false, wave: n, counts,
        drones: Object.keys(counts).filter((t) => counts[t] > 0).map((t) => ({ type: t, count: counts[t], isNew: cfg.newTypes.includes(t) })).concat(cfg.boss ? [{ type: 'warden', count: 1, isNew: n === 5 }] : []), newTypes: cfg.newTypes, newText: cfg.newTypes.map((t) => UI.workshop.intelNew[t]).filter(Boolean),
        sides, mainSide: even ? null : SIDE_NAME[main], sideText: even ? 'Drones from every side' : fill(UI.workshop.intelSides, { side: SIDE_NAME[main] }),
        contraction: cfg.pool.some((id) => C.DRONE_THREATS[id].kind === 'contraction'), warden: cfg.boss, boss: cfg.boss,
        wardenText: cfg.boss ? UI.wave.wardenInbound : null, subsystem: cfg.sub,
      };
    }

    openWorkshop(next) {
      const Wk = workshopAPI();
      if (!Wk) { this.startWave(next); return; }
      this.mode = 'workshop';
      this.game.ui.hideCard && this.game.ui.hideCard();
      this.game.state = 'workshop';
      this.save.wave = next;
      this.save.reaskQueue = this.reask.slice();
      this.persist();
      const root = document.getElementById('workshop');
      if (root) root.classList.remove('hidden');
      const done = (s) => {
        if (root) root.classList.add('hidden');
        if (s && typeof s === 'object') this.save = s;
        if (!this.save.lifetime) this.save.lifetime = freshSave().lifetime;
        this.game.state = 'play';
        this.startWave(this.save.wave || next);
      };
      try {
        this.wsHandle = Wk.open(root, { save: this.save, wave: next, intel: this.scoutIntel(next), reduce: this.fx.reduce, onDone: done });
      } catch (e) {
        console.warn('Workshop failed to open', e);
        done(this.save);
      }
    }

    // ---------------- The Warden (§4.8) ----------------
    spawnWarden() {
      const d = this.spawnDrone('warden', 0, { at: [AX, -160] });
      d.elite = false;
      d.st = 'in';
      const tier3 = this.wave >= 10;
      const chains = WARDEN_PHASES.map((ph) => {
        let c = ph.map((id) => (tier3 && WARDEN_SUB[id] ? WARDEN_SUB[id] : id));
        if (this.wave >= 15) c = c.concat([pick(['crossSwat', 'backhandSwat', 'palmCatch', 'discWindup', 'netterOnAlly_left'])]);
        return c;
      });
      this.warden = { d, phase: 0, chains, chain: chains[0].slice(), idx: 0, phaseT: 6, plates: [1, 1, 1], th: 0, finale: 0, dead: false };
      Audio.bossWarning && Audio.bossWarning();
      this.fx.popText(AX, 160, UI.wave.wardenInbound, '#ff5a5a', 40);
      this.allies.forEach((a, i) => setTimeout(() => { if (this.game.level === this && a.state !== 'taken') this.say(a, C.DRONE_BANTER.events.warden[0]); }, 400 + i * 250));
      this.wardenHum = Audio.droneHum ? Audio.droneHum('warden', 1) : null;
    }

    updateWarden(d, wdt) {
      const Wd = this.warden;
      if (!Wd) return;
      if (d.st === 'in') { if (this.moveTo(d, ...polar(0, 255), 70, wdt) < 4) { d.st = 'orbit'; Wd.th = 0; } d.ang = Math.PI / 2; return; }
      Wd.th += (30 / 255) / D2R * wdt;
      const p = polar(Wd.th, 255);
      d.x = p[0]; d.y = p[1];
      d.ang = Math.atan2(AY - d.y, AX - d.x);
      if (Wd.finale > 0) return;
      if (this.mode === 'play' && !this.rescue) {
        Wd.phaseT -= wdt;
        if (Wd.phaseT <= 0 && Wd.phase < 3) {
          const id = Wd.chain[Wd.idx];
          this.fx.popText(d.x, d.y + 90, Wd.idx === 0 ? `PHASE ${Wd.phase + 1}` : 'CHAIN!', '#ff5a5a', 26);
          if (!this.forceThreat(id, { boss: true, from: { x: d.x, y: d.y } })) Wd.phaseT = 2;
        }
      }
    }

    wardenChainResult(ok, id) {
      const Wd = this.warden;
      if (!Wd) return;
      if (!ok) {
        // plate re-seals; the phase repeats after 10 s with the failed id first
        const i = Wd.chain.indexOf(id);
        Wd.chain = Wd.chain.slice(Math.max(0, i));
        Wd.idx = 0;
        Wd.phaseT = 10;
        this.fx.popText(Wd.d.x, Wd.d.y - 90, `${PLATE_NAMES[Wd.phase]} PLATE RE-SEALED`, '#ffb020', 22);
        return;
      }
      Wd.idx++;
      if (Wd.idx < Wd.chain.length) { Wd.phaseT = 2; return; }
      Wd.plates[Wd.phase] = 0;
      this.fx.droneExplode(Wd.d.x + rand(-40, 40), Wd.d.y + rand(-40, 40), 1.6);
      this.fx.popText(Wd.d.x, Wd.d.y - 100, `${PLATE_NAMES[Wd.phase]} PLATE CRACKED`, '#ffd27a', 28);
      Audio.droneBoom && Audio.droneBoom();
      Wd.phase++;
      Wd.idx = 0;
      if (Wd.phase >= 3) { this.wardenFinale(); return; }
      Wd.chain = Wd.chains[Wd.phase].slice();
      Wd.phaseT = 9;
    }

    wardenFinale() {
      const Wd = this.warden;
      Wd.finale = 0.001;
      this.fx.popText(AX, 150, 'CORE EXPOSED', '#ff6a3d', 40);
    }

    updateFinale(dt) {
      const Wd = this.warden;
      if (!Wd || !Wd.finale || Wd.dead) return;
      Wd.finale += dt;
      this.slowmo = Wd.finale < 2.4 ? 0.3 : 0;
      const d = Wd.d;
      const steps = [0.4, 0.8, 1.15, 1.5];
      steps.forEach((s, i) => { if (Wd.finale >= s && !Wd['b' + i]) { Wd['b' + i] = 1; this.fx.droneExplode(d.x + rand(-60, 60), d.y + rand(-60, 60), 1.4 + i * 0.3); Audio.droneBoom && Audio.droneBoom(); } });
      if (Wd.finale >= 2.0 && !Wd.dead) {
        Wd.dead = true;
        this.fx.droneExplode(d.x, d.y, 3);
        this.fx.explosion(d.x, d.y, 1.2);
        Audio.boom();
        d.dead = true;
        this.stats.wardens++;
        this.save.lifetime.wardens = (this.save.lifetime.wardens || 0) + 1;
        this.fx.popText(AX, 170, UI.wave.wardenDown, '#7dff9a', 44);
        const cheer = this.allies.find((a) => a.state !== 'taken');
        if (cheer) this.say(cheer, C.DRONE_BANTER.events.wardenDown[0]);
        this.gainEnergy(1);
        this.addCombo(5, d.x, d.y, true);
        if (this.wardenHum) { try { this.wardenHum.stop(1); } catch (e) { /* ignore */ } this.wardenHum = null; }
      }
    }

    // ---------------- rescue (§4.5) ----------------
    startRescue(a) {
      if (this.mode !== 'play' || !a || a.state !== 'netted' || this.rescue) return false;
      if (a.lockT && this.time < a.lockT) { this.fx.popText(a.x, a.y - 40, UI.rescueLockout, '#ffb020', 18); return false; }
      this.rescue = { ally: a };
      this.newRescueQuestion();
      return true;
    }

    newRescueQuestion() {
      const R = this.rescue;
      const movs = Object.keys(C.MOVEMENT_PLANE).filter((m) => C.PLANES[C.MOVEMENT_PLANE[m]]);
      const mv = pick(movs);
      const ids = ['sagittal', 'frontal', 'transverse'];
      R.mv = mv;
      R.correct = C.PLANES[C.MOVEMENT_PLANE[mv]].name;
      R.options = shuffle(ids.map((id) => C.PLANES[id].name));
      R.locked = false;
      this.game.ui.showDecision({
        title: `RESCUE ${R.ally.name}`,
        kindText: 'CHOOSE THE PLANE',
        prompt: fill(UI.rescuePrompt, { movement: mv.toUpperCase() }) + ` (${R.ally.name}: ${Math.ceil(R.ally.netT)} s left)`,
        options: R.options,
        side: R.ally.x < AX ? 'dd-right' : 'dd-left',
        noTimer: true,
      });
    }

    answerRescue(i) {
      const R = this.rescue;
      if (!R || R.locked) return;
      const choice = R.options[i];
      if (!choice) return;
      const ok = choice === R.correct;
      this.stats.rescueTries++;
      this.stats.log.push({ t: Date.now(), wave: this.wave, source: 'rescue', id: R.mv, topic: 'planes_axes', kind: 'plane', choice, correct: ok, result: ok ? 'correct' : 'plane', rtMs: 0, reask: false, assist: false });
      const a = R.ally;
      if (ok) {
        Audio.questionRight ? Audio.questionRight() : Audio.good();
        this.stats.rescues++;
        const h = AndroidTop.handPos(this.pl.pose, AX + this.pl.ox, AY + this.pl.oy, 'R', 1);
        this.fx.discTrail([h, [lerp(h[0], a.x, 0.5) + 30, lerp(h[1], a.y, 0.5) - 30], [a.x, a.y]]);
        this.fx.popText(a.x, a.y - 50, fill(UI.rescueCorrect, { name: a.name }), '#7dff9a', 22);
        this.closeRescue();
        this.freeAlly(a, false);
      } else {
        Audio.questionWrong ? Audio.questionWrong() : Audio.fail();
        R.locked = true;
        a.lockT = this.time + 2;
        this.game.ui.rescueWrong(fill(UI.rescueWrong, { movement: R.mv, plane: C.PLANES[C.MOVEMENT_PLANE[R.mv]].name.toLowerCase() }));
        setTimeout(() => { if (this.rescue === R && a.state === 'netted' && this.game.level === this) this.newRescueQuestion(); }, 2000);
      }
    }

    closeRescue() {
      if (!this.rescue) return;
      this.rescue = null;
      if (this.mode !== 'decide') this.game.ui.hideDecision();
    }

    // ---------------- real-time auto actions (§4.2c) ----------------
    // returns { kind, side } or null for a drone at its current spot
    planAction(d) {
      if (!d || d.dead || d.staged || d.type === 'warden') return null;
      const ox = AX + this.pl.ox, oy = AY + this.pl.oy;
      const dd = dist(d.x, d.y, ox, oy);
      const th = angDiff(Math.atan2(d.x - ox, -(d.y - oy)) / D2R, 0);
      const a = Math.abs(th);
      const free = (s) => this.cd[s] <= 0 && !(s === 'R' && this.hooked);
      if (d.type === 'crawler') return dd <= 70 && this.cd.hip <= 0 ? { kind: 'stomp', side: th >= 0 ? 'R' : 'L', th } : null;
      const melee = 140, reach = melee + (this.eff.backhandReach || 0);
      if (dd <= melee && a <= 25 && this.cd.palm <= 0) { const s = th >= 0 ? 'R' : 'L'; if (free(s)) return { kind: 'pulse', side: s, th }; }
      if (dd <= melee && a > 25 && a <= 70) { const s = th < 0 ? 'R' : 'L'; if (free(s)) return { kind: 'cross', side: s, th }; }
      if (dd <= reach && a > 70 && a <= 125) { const s = th > 0 ? 'R' : 'L'; if (free(s)) return { kind: 'backhand', side: s, th }; }
      if (dd <= 160 && a > 125 && free('L') && free('R') && this.snareT <= 0) return { kind: 'spin', side: th > 0 ? 'R' : 'L', th };
      if (dd > melee * 0.85 && dd <= 460 && (a <= 120 || dd > 160) && this.snareT <= 0) {
        const s = th >= 0 ? (free('R') ? 'R' : 'L') : (free('L') ? 'L' : 'R');
        if (free(s)) return { kind: 'disc', side: s, th };
      }
      return null;
    }

    autoTarget() {
      if (this.selected && !this.selected.dead && this.planAction(this.selected)) return { d: this.selected, chosen: true };
      let best = null, bd = 1e9;
      for (const d of this.drones) {
        if (d.dead || d.staged || d.retreat || d.type === 'warden') continue;
        if (!this.planAction(d)) continue;
        let near = dist(d.x, d.y, AX, AY) * 0.6;
        for (const a of this.allies) if (a.state !== 'taken') near = Math.min(near, dist(d.x, d.y, a.x, a.y));
        if (d.ally && d.ally.state === 'netted') near -= 200; // free towed allies first
        if (d.st === 'charge' || d.st === 'dive' || d.st === 'ram') near -= 80;
        if (near < bd) { bd = near; best = d; }
      }
      return best ? { d: best, chosen: false } : null;
    }

    actionPoses(kind, side, th) {
      const base = TopPose.clone(this.restPose());
      const other = side === 'R' ? 'L' : 'R';
      const sg = side === 'R' ? 1 : -1;
      const W = (o) => TopPose.with(base, o);
      switch (kind) {
        case 'pulse': return { keys: [[0, base], [0.1, W({ [side]: { fl: 90, hz: 0, rot: 0, el: 8, pr: 0 } })], [0.2, W({ [side]: { fl: 90, hz: 0, el: 8, pr: -88 } })], [0.5, base]], hit: 0.2, dur: 0.5, label: mvName('Pronation') };
        case 'cross': return { keys: [[0, base], [0.09, W({ trunk: 12 * -sg, [side]: { fl: 90, hz: 80, rot: 0, el: 12, pr: 0 } })], [0.22, W({ trunk: 12 * sg, [side]: { fl: 90, hz: -30, el: 10 } })], [0.5, base]], hit: 0.2, dur: 0.5, label: mvName('Horizontal adduction'), cd: 0.55 };
        case 'backhand': return { keys: [[0, base], [0.09, W({ trunk: -12 * sg, [side]: { fl: 90, hz: -20, rot: 0, el: 20, pr: 0 } })], [0.22, W({ trunk: 15 * sg, [side]: { fl: 90, hz: 100, el: 8 } })], [0.5, base]], hit: 0.2, dur: 0.5, label: mvName('Horizontal abduction'), cd: 0.55 };
        case 'spin': return { keys: [[0, base], [0.1, W({ trunk: -10 * sg, [side]: { fl: 90, hz: 0, el: 12 }, [other]: { fl: 0, el: 90 } })], [0.32, W({ trunk: 50 * sg, head: 10 * sg, [side]: { fl: 90, hz: 115, el: 8 }, [other]: { fl: 0, el: 90 } })], [0.75, base]], hit: 0.3, dur: 0.75, label: `${mvName('Rotation')} + ${mvName('Horizontal abduction')}`, cd: 1.1 };
        case 'disc': {
          const aim = clamp(th, -60, 60);
          const wm = this.eff.windupMul || 1;
          const tW = 0.1 + 0.25 * wm;
          return { keys: [[0, base], [0.1, W({ trunk: aim, [side]: { fl: 0, hz: 0, rot: 0, el: 90, pr: 0 } })], [tW, W({ trunk: aim, [side]: { fl: 0, rot: 60, el: 90, pr: 0 } })], [tW + 0.1, W({ trunk: aim, [side]: { fl: 0, rot: -40, el: 90 } })], [tW + 0.45, base]], hit: tW + 0.08, dur: tW + 0.45, label: mvName('Lateral rotation'), label2: mvName('Medial rotation'), label2At: tW, cd: 1.3 * wm };
        }
        case 'shield': return { keys: [[0, base], [0.12, W({ R: { fl: 0, hz: 0, rot: 0, el: 0, pr: th ? 90 : -90 } })], [0.7, W({ R: { fl: 0, el: 0, pr: th ? 90 : -90 } })], [1.0, base]], hit: 0.1, dur: 1.0, label: th ? mvName('Supination') : mvName('Pronation') };
        case 'stomp': { const out = (side === 'R') === (th >= 0); const k = 'hip' + side; return { keys: [[0, base], [0.15, W({ [k]: out ? 40 : -35 })], [0.6, base]], hit: 0.15, dur: 0.6, label: (out ? mvName('Lateral rotation') : mvName('Medial rotation')) + ' (HIP)' }; }
        default: return null;
      }
    }

    restPose() {
      const p = TopPose.clone(TopPose.LIB.guard);
      p.trunk = 3 * Math.sin(this.time * 0.9);
      p.head = 6 * Math.sin(this.time * 0.5);
      if (this.hooked) { p.R = { fl: 0, hz: 0, rot: 40, el: 90, pr: 0 }; }
      return p;
    }

    startAction(plan, d, focus) {
      const A = this.actionPoses(plan.kind, plan.side, plan.kind === 'shield' ? (plan.front ? 1 : 0) : plan.th);
      if (!A) return;
      const od = this.overdrive > 0 ? 0.5 : 1;
      if (plan.kind === 'pulse' || plan.kind === 'shield') this.cd.palm = 1.0 * od;
      else if (plan.kind === 'spin') { this.cd.L = 1.1 * od; this.cd.R = 1.1 * od; }
      else if (plan.kind === 'stomp') this.cd.hip = 0.9 * od;
      else this.cd[plan.side] = (A.cd || 0.55) * od;
      this.action = { plan, A, t: 0, d, focus, hit: false, l2: false };
      if (plan.kind === 'disc' && Math.abs(plan.th) > 60 && this.labels) this.floater('head', mvName('Rotation') + ' (TRUNK)', '#bff4ff', 0.8);
      if (this.labels) this.floater(plan.kind === 'stomp' ? 'foot' + plan.side : 'hand' + plan.side, A.label, '#bff4ff', 0.8);
    }

    sampleKeys(keys, t) {
      for (let i = 1; i < keys.length; i++) {
        if (t <= keys[i][0]) { const [t0, p0] = keys[i - 1], [t1, p1] = keys[i]; return TopPose.lerp(p0, p1, ease((t - t0) / Math.max(1e-3, t1 - t0))); }
      }
      return TopPose.clone(keys[keys.length - 1][1]);
    }

    updateAction(wdt) {
      const ac = this.action;
      ac.t += wdt;
      const { plan, A } = ac;
      const p = this.sampleKeys(A.keys, ac.t);
      this.pl.pose = p;
      if (A.label2 && !ac.l2 && ac.t >= A.label2At) { ac.l2 = true; if (this.labels) this.floater('hand' + plan.side, A.label2, '#ffd27a', 0.8); }
      if (!ac.hit && ac.t >= A.hit) { ac.hit = true; this.actionHit(ac); }
      if (ac.t >= A.dur) this.action = null;
    }

    dmgMul(focus) {
      return (focus ? 1.25 : 1) * effN(this.eff, 'dmgMul', 1) * (this.overdrive > 0 ? 1.25 : 1);
    }

    actionHit(ac) {
      const { plan, d, focus } = ac;
      const E = this.eff, m = this.dmgMul(focus);
      const ox = AX + this.pl.ox, oy = AY + this.pl.oy;
      const hand = AndroidTop.handPos(this.pl.pose, ox, oy, plan.side, 1);
      switch (plan.kind) {
        case 'pulse': {
          const R = E.pulseRadius || 60;
          this.fx.empPulse(hand[0], hand[1], R);
          Audio.empPulse && Audio.empPulse();
          for (const q of this.drones) if (!q.dead && !q.staged && q.type !== 'warden' && dist(q.x, q.y, hand[0], hand[1]) <= R + q.r) this.damageDrone(q, (E.pulseDmg || 1) * m, {});
          break;
        }
        case 'cross': case 'backhand': {
          const pts = [];
          for (let i = 0; i <= 6; i++) pts.push(AndroidTop.handPos(this.sampleKeys(ac.A.keys, 0.09 + (i / 6) * 0.13), ox, oy, plan.side, 1));
          this.fx.swatTrail(pts, { width: 9 });
          Audio.swat && Audio.swat();
          if (d && !d.dead && dist(d.x, d.y, ox, oy) <= 165 + (E.backhandReach || 0)) {
            const [ux, uy] = this.awayDir(d.x, d.y);
            const kb = E.swatKnock || 40;
            this.damageDrone(d, (E.swatDmg || 1) * m, { swat: true, kb: [ux * kb * 5, uy * kb * 5] });
          }
          break;
        }
        case 'spin': {
          const pts = [];
          for (let i = 0; i <= 8; i++) pts.push(AndroidTop.handPos(this.sampleKeys(ac.A.keys, 0.1 + (i / 8) * 0.22), ox, oy, plan.side, 1));
          this.fx.swatTrail(pts, { width: 11 });
          Audio.swat && Audio.swat();
          const half = (E.sweepArc || 60) / 2;
          for (const q of this.drones) {
            if (q.dead || q.staged || q.type === 'warden') continue;
            if (dist(q.x, q.y, ox, oy) <= 175 && Math.abs(angDiff(bearing(q.x, q.y), plan.th)) <= half + 10) this.damageDrone(q, (E.spinDmg || 2) * m, { swat: true });
          }
          break;
        }
        case 'disc': if (d && !d.dead) { this.launchDisc(hand, d, (E.discDmg || 2) * m, { pierce: E.discPierce || 0 }); Audio.discThrow && Audio.discThrow(); } break;
        case 'stomp': {
          const f = AndroidTop.partPoint(this.pl.pose, ox, oy, 'toe' + plan.side, 1);
          Audio.crunch();
          this.fx.sparks(f[0], f[1], 10, { g: 0 });
          for (const q of this.drones) if (!q.dead && q.type === 'crawler' && dist(q.x, q.y, f[0], f[1]) < 46) this.damageDrone(q, 2 * m, {});
          break;
        }
        default: break;
      }
    }

    launchDisc(from, d, dmg, o) {
      o = o || {};
      this.discs.push({ x: from[0], y: from[1], target: d, tx: d.x, ty: d.y, dmg, pierce: o.pierce || 0, kill: !!o.kill, t: 0, hits: new Set(), spin: 0 });
    }

    updateDiscs(dt) {
      for (const c of this.discs) {
        c.t += dt; c.spin += dt * 30;
        if (c.target && !c.target.dead) { c.tx = c.target.x; c.ty = c.target.y; }
        const dx = c.tx - c.x, dy = c.ty - c.y, l = Math.hypot(dx, dy);
        const s = Math.min(l, 900 * dt);
        if (l > 0.1) { c.x += (dx / l) * s; c.y += (dy / l) * s; }
        this.fx.discTrail(c.x, c.y, 8);
        for (const q of this.drones) {
          if (q.dead || c.hits.has(q) || q.type === 'warden' || (q.staged && q !== c.target)) continue;
          if (dist(q.x, q.y, c.x, c.y) < q.r + 8) {
            c.hits.add(q);
            if (c.kill && q === c.target) { if (!this.fx.reduce) this.hitStop = 0.06; this.killDrone(q, { noCombo: true }); this.fx.addShake(6); }
            else if (!c.kill) this.damageDrone(q, c.dmg, {});
            if (q === c.target || c.hits.size > c.pierce) { c.dead = true; break; }
          }
        }
        if (l < 4 || c.t > 1.5) c.dead = true;
      }
      this.discs = this.discs.filter((c) => !c.dead);
    }

    updateCombat(wdt) {
      const od = this.overdrive > 0 ? 2 : 1;
      for (const k in this.cd) this.cd[k] = Math.max(0, this.cd[k] - wdt * od);
      if (this.action) { this.updateAction(wdt); return; }
      this.pl.pose = TopPose.lerp(this.pl.pose, this.restPose(), Math.min(1, wdt * 10));
      if (this.jamT > 0 && !this.focusReq) { this.pending = null; return; }
      if (this.focusReq) {
        const tgt = this.selected && !this.selected.dead ? this.selected : (this.autoTarget() || {}).d;
        const plan = tgt && this.planAction(tgt);
        this.focusReq = false;
        if (plan) { this.startAction(plan, tgt, true); this.pending = null; return; }
        if (tgt) this.fx.popText(AX, AY - 80, 'OUT OF REACH', '#9aa5b1', 16);
      }
      const at = this.autoTarget();
      if (!at) { this.pending = null; return; }
      if (!this.pending || this.pending.d !== at.d) this.pending = { d: at.d, delay: at.chosen ? 0.12 : 0.35 };
      this.pending.delay -= wdt;
      if (this.pending.delay <= 0) {
        const plan = this.planAction(at.d);
        if (plan) this.startAction(plan, at.d, false);
        this.pending = null;
      }
    }

    floater(part, text, col, life) {
      const p = AndroidTop.partPoint(this.pl.pose, AX + this.pl.ox, AY + this.pl.oy, part === 'foot' + 'R' ? 'footR' : part, 1);
      // stack on top of labels that are still rising nearby
      let y = p[1];
      for (const f of this.floaters) if (f.t < 0.6 && Math.abs(f.x - p[0]) < 140 && Math.abs(f.y - y) < 20) y = f.y - 22;
      this.floaters.push({ x: p[0], y, text, col: col || '#bff4ff', t: 0, life: life || 1.4, part });
    }

    // ---------------- input ----------------
    onKey(e) {
      if (this.mode !== 'play' && this.mode !== 'intro') return false;
      const k = e.key;
      if (k === 'a' || k === 'A' || k === 'ArrowLeft') { this.cycleTarget(-1); return true; }
      if (k === 'd' || k === 'D' || k === 'ArrowRight' || k === 'Tab') { this.cycleTarget(1); return true; }
      if (k === ' ' || k === 'Spacebar') { this.focusReq = true; return true; }
      if (k === 'r' || k === 'R') {
        const net = this.allies.filter((a) => a.state === 'netted').sort((a, b) => a.netT - b.netT)[0];
        if (net) this.startRescue(net);
        return true;
      }
      return false;
    }

    cycleTarget(dir) {
      const list = this.drones.filter((d) => !d.dead && !d.staged && !d.retreat && d.type !== 'warden' && d.x > -20 && d.x < W + 20 && d.y > -20 && d.y < H + 20);
      if (!list.length) return;
      const b = (d) => (bearing(d.x, d.y) + 360) % 360;
      list.sort((p, q) => b(p) - b(q));
      let i = this.selected ? list.indexOf(this.selected) : -1;
      i = i < 0 ? (dir > 0 ? 0 : list.length - 1) : (i + dir + list.length) % list.length;
      this.selected = list[i];
      Audio.lockOn && Audio.lockOn();
    }

    onPointer(sx, sy) {
      if (this.mode !== 'play' && this.mode !== 'intro') return false;
      const [x, y] = this.screenToWorld(sx, sy);
      for (const a of this.allies) if (a.state === 'netted' && dist(a.x, a.y, x, y) < 36) { this.startRescue(a); return true; }
      let best = null, bd = 1e9;
      for (const d of this.drones) {
        if (d.dead || d.staged || d.type === 'warden') continue;
        const dd = dist(d.x, d.y, x, y);
        if (dd < d.r + 22 && dd < bd) { bd = dd; best = d; }
      }
      if (best) { this.selected = best; Audio.lockOn && Audio.lockOn(); return true; }
      return false;
    }

    // ---------------- camera ----------------
    camParams() {
      const k = this.camK;
      const c = (this.freeze && this.freeze.cam) || this.lastCam || { Z: 1, cx: 640, cy: 360, sx: 640, sy: 360 };
      if (this.freeze && this.freeze.cam) this.lastCam = this.freeze.cam;
      const e = ease(k);
      // real-time camera: a slight zoom on the camp so the rig reads on a projector
      const B = BASE_CAM;
      return { Z: lerp(B.Z, c.Z, e), cx: lerp(B.cx, c.cx, e), cy: lerp(B.cy, c.cy, e), sx: lerp(B.sx, c.sx, e), sy: lerp(B.sy, c.sy, e) };
    }
    worldToScreen(x, y) { const c = this.camParams(); return [(x - c.cx) * c.Z + c.sx, (y - c.cy) * c.Z + c.sy]; }
    screenToWorld(x, y) { const c = this.camParams(); return [(x - c.sx) / c.Z + c.cx, (y - c.sy) / c.Z + c.cy]; }

    // ---------------- main update ----------------
    update(dt) {
      this.time += dt;
      this.hitFlash = Math.max(0, (this.hitFlash || 0) - dt);
      const m = this.mode;
      let wdt = 0;
      if (m === 'intro') { this.modeT += dt; wdt = dt; if (this.modeT > 2.6) { this.mode = 'play'; this.modeT = 0; } }
      else if (m === 'play') { this.ts = this.rescue ? 0.5 : 1; wdt = dt * this.ts; }
      else if (m === 'ramp') { this.updateRamp(dt); wdt = dt * this.ts; }
      else if (m === 'decide') { this.updateDecide(dt); wdt = dt * 0.02; }
      else if (m === 'act') { this.actT += dt; this.act.update(this.actT, dt); wdt = dt * (this.ts || 0.1); }
      else if (m === 'replay') { this.updateReplay(dt); }
      else if (m === 'resume') {
        this.modeT += dt;
        const k = ease(this.modeT / 0.5);
        this.ts = lerp(0.1, 1, k); this.camK = 1 - k;
        wdt = dt * this.ts;
        if (this.modeT >= 0.5) { this.mode = 'play'; this.camK = 0; this.ts = 1; }
      } else if (m === 'clear') { this.modeT += dt; wdt = dt; if (this.modeT > 2.8) this.showSummary(); }
      if (this.slowmo) wdt *= this.slowmo;
      if (this.hitStop > 0) { this.hitStop -= dt; wdt = 0; }

      if (wdt > 0) {
        const live = m === 'play' || m === 'intro' || m === 'resume' || m === 'clear';
        if (live) {
          this.waveT += wdt;
          this.updateSpawns(wdt);
          if (this.cfg.boss && !this.warden && m === 'play') { this.wardenT -= wdt; if (this.wardenT <= 0) this.spawnWarden(); }
        }
        this.updateDrones(wdt);
        this.updateAllies(wdt);
        this.updateDiscs(wdt);
        if (live && m !== 'clear') this.updateCombat(wdt);
        else if (m === 'clear') this.pl.pose = TopPose.lerp(this.pl.pose, this.restPose(), Math.min(1, wdt * 6));
        if (m === 'play') {
          const rate = this.repairRate();
          this.repair = Math.min(this.cfg.need, this.repair + rate * wdt);
          this.comboT -= wdt;
          if (this.comboT <= 0 && this.combo > 0) this.combo = 0;
          this.overdrive = Math.max(0, this.overdrive - wdt);
          this.updateDirector(wdt);
          const bossOk = !this.cfg.boss || (this.warden && this.warden.dead);
          if (this.repair >= this.cfg.need && bossOk && this.mode === 'play') this.clearWave();
          if (this.campAllies().length === 0 && this.mode === 'play') this.noCrew();
        }
      }
      if (this.warden && this.warden.finale && !this.warden.dead) this.updateFinale(dt);
      else this.slowmo = 0;
      for (const b of this.beams) b.t += dt;
      this.beams = this.beams.filter((b) => b.t < b.life);
      for (const f of this.floaters) f.t += dt;
      this.floaters = this.floaters.filter((f) => f.t < f.life);
      if (this.readout) this.readout.t += dt;
      const slow = m === 'decide' || m === 'ramp' || m === 'failed' || m === 'replay';
      this.fx.update(slow ? dt * 0.15 : dt);
      this.rig.update(this.pl.pose, m === 'decide' ? dt * 0.5 : dt);
      if (this.rescue && this.rescue.ally.state !== 'netted') this.closeRescue();
      if (this.rescue && this.mode === 'play') this.game.ui.rescueTick && this.game.ui.rescueTick(Math.max(0, this.rescue.ally.netT), this.rescue.ally.netMax || 8);
    }

    jammed() {
      const F = this.freeze;
      if (this.pl.neutral) return true;
      if (F && (this.mode === 'decide' || this.mode === 'ramp')) return F.st.kind === 'contraction' || !!F.tOpts.neutralStage;
      return false;
    }

    tension() {
      if (this.mode === 'decide' && this.freeze) return 0.35 + 0.65 * (1 - this.freeze.timer / this.freeze.total);
      if (this.mode === 'ramp') return 0.35 * ease(this.modeT / 0.6);
      if (this.mode === 'act' && this.freeze) return 0.2;
      return 0;
    }

    destroy() {
      if (this.wardenHum) { try { this.wardenHum.stop(0.3); } catch (e) { /* ignore */ } this.wardenHum = null; }
    }

    // ======================================================================
    // RENDERING
    // ======================================================================
    draw(ctx, opts) {
      opts = opts || {};
      const fx = this.fx, reduce = fx.reduce;
      const tension = this.tension();
      const F = this.freeze;
      ctx.save();
      ctx.fillStyle = '#05080a';
      ctx.fillRect(0, 0, W, H);
      const c = this.camParams();
      let sx = 0, sy = 0;
      const shakeAmt = fx.shake + (reduce ? 0 : tension * tension * 2);
      if (shakeAmt > 0) { sx = rand(-shakeAmt, shakeAmt); sy = rand(-shakeAmt, shakeAmt); }
      ctx.translate(c.sx + sx, c.sy + sy);
      ctx.scale(c.Z, c.Z);
      ctx.translate(-c.cx, -c.cy);

      Arena.drawGround(ctx, W, H, this.time, { seed: 7, cx: AX, cy: AY + 30, clearR: 310, canopy: true, rain: 0.3, mist: 0.55, reduce });
      Arena.drawTransport(ctx, TRUCK.x, TRUCK.y, 0, this.repair / this.cfg.need, this.time, { scale: TRUCK.scale, reduce });
      this.drawRepairSparks(ctx);
      const T = this.turret;
      if (T && T.build > 0) {
        ctx.save(); ctx.globalAlpha = 0.35 + 0.65 * T.build;
        Arena.drawTurret(ctx, TURRET.x, TURRET.y, T.ang, this.time, { fire: T.fire, reduce });
        ctx.restore();
        if (!T.built) this.worldText(ctx, `BUILDING ${Math.round(T.build * 100)}%`, TURRET.x, TURRET.y + 34, '#b48cff', 11);
      }
      const keyD = new Set(F ? F.members : []);
      const keyA = F && F.ally;
      // ground crawlers first, then allies, then fliers
      for (const d of this.drones) if (d.type === 'crawler' && !keyD.has(d)) this.drawDrone(ctx, d);
      for (const a of this.allies) if (a !== keyA) this.drawAlly(ctx, a);
      this.drawTargetLine(ctx);
      for (const d of this.drones) if (d.type !== 'crawler' && !keyD.has(d)) this.drawDrone(ctx, d);

      if (tension > 0.05) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'saturation';
        ctx.globalAlpha = Math.min(0.85, tension);
        ctx.fillStyle = 'rgb(128,128,128)';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.restore();
      }
      if (keyA) this.drawAlly(ctx, keyA);
      for (const d of keyD) if (d.type === 'crawler') this.drawDrone(ctx, d);
      this.drawAndroid(ctx, opts);
      for (const d of keyD) if (d.type !== 'crawler') this.drawDrone(ctx, d);
      this.drawDiscs(ctx);
      this.drawBeams(ctx);
      fx.drawWorld(ctx);
      if (this.ghostPose) this.drawGhost(ctx);
      this.drawFloaters(ctx);
      this.drawBubbles(ctx);
      ctx.restore();

      // ---- screen space ----
      this.drawTensionOverlay(ctx, tension);
      this.drawInset(ctx);
      this.drawChevrons(ctx);
      if (this.readout && (this.mode === 'act' || this.mode === 'replay' || this.mode === 'failed')) this.drawReadout(ctx);
      if (this.mode === 'replay') this.drawReplayTag(ctx);
      this.drawHUD(ctx);
      fx.drawScreen(ctx, W, H);
      if (this.hitFlash > 0) { ctx.fillStyle = `rgba(255,40,60,${this.hitFlash * (reduce ? 0.15 : 0.35)})`; ctx.fillRect(0, 0, W, H); }
      if (this.sysFail > 0) this.drawSystemFailure(ctx);
      if (this.powerFail > 0 && (this.mode === 'act' || this.mode === 'lost' || this.mode === 'failed')) this.drawPowerFailure(ctx);
      if (this.mode === 'intro') this.drawIntro(ctx);
      if (this.mode === 'clear') this.drawClear(ctx);
    }

    worldText(ctx, s, x, y, col, size, align) {
      ctx.save();
      ctx.font = `800 ${size || 13}px ui-monospace, monospace`;
      ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(4,7,10,0.9)'; ctx.lineJoin = 'round';
      ctx.strokeText(s, x, y);
      ctx.fillStyle = col || '#e8f4ff';
      ctx.fillText(s, x, y);
      ctx.restore();
    }

    drawRepairSparks(ctx) {
      if (this.fx.reduce || this.mode !== 'play') return;
      for (const a of this.allies) {
        if (!this.allyWorking(a) || a.spotId[0] !== 'R') continue;
        if (Math.random() < 0.12) this.fx.sparks(a.x + rand(-8, 8), a.y + 22, 2, { g: 0, vmin: 40, vmax: 160 });
      }
    }

    drawTargetLine(ctx) {
      const d = this.selected;
      if (!d || d.dead || this.freeze) return;
      ctx.save();
      ctx.setLineDash([6, 6]);
      ctx.lineDashOffset = -this.time * 30;
      ctx.strokeStyle = 'rgba(86,224,255,0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(AX + this.pl.ox, AY + this.pl.oy); ctx.lineTo(d.x, d.y); ctx.stroke();
      ctx.restore();
      const plan = this.planAction(d);
      this.worldText(ctx, plan ? 'IN REACH' : 'OUT OF REACH', d.x, d.y + d.r + 26, plan ? '#8ff0ff' : '#8a96a2', 11);
    }

    drawAndroid(ctx, opts) {
      const F = this.freeze, pl = this.pl, reduce = this.fx.reduce;
      const x = AX + pl.ox, y = AY + pl.oy;
      if (this.overdrive > 0) {
        const p = reduce ? 0.6 : 0.5 + 0.3 * Math.sin(this.time * 10);
        const g = ctx.createRadialGradient(x, y, 10, x, y, 110);
        g.addColorStop(0, `rgba(255,106,61,${0.35 * p})`); g.addColorStop(1, 'rgba(255,106,61,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 110, 0, TAU); ctx.fill();
      }
      // reach ring (melee range) while drones are close: helps reading the auto actions
      if (!F && this.mode === 'play') {
        ctx.save();
        ctx.strokeStyle = 'rgba(86,224,255,0.10)'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 7]);
        ctx.beginPath(); ctx.arc(x, y, 140, 0, TAU); ctx.stroke();
        ctx.restore();
      }
      const showHl = F && (this.mode === 'decide' || (this.mode === 'ramp' && this.modeT > 0.25));
      const tO = F ? F.tOpts : {};
      const launcher = tO.launcher || (this.action && this.action.plan.kind === 'disc' ? this.action.plan.side : null);
      const o = {
        scale: 1, status: pl.status, neutral: this.jammed(), damage: this.damage, reduce,
        highlight: showHl ? { joints: F.S.joints, arcs: true } : null,
        labels: opts.labels ? 'active' : null,
        malfunction: pl.mal, launcher, lockHand: tO.lockHand || null, feetBold: tO.feetBold || null,
      };
      this.lastRig = this.rig.draw(ctx, pl.pose, x, y, o);
      // damage smoke
      if (this.mode === 'play' || this.mode === 'act') {
        for (const part in this.damage) {
          const pp = AndroidTop.partPoint(pl.pose, x, y, part === 'armR' ? 'elbowR' : part === 'armL' ? 'elbowL' : part === 'legR' ? 'kneeR' : part, 1);
          this.fx.smokeTrail(pp[0], pp[1], { rate: 0.5, wind: 10 });
        }
      }

    }

    drawGhost(ctx) {
      const m = ctx.getTransform();
      const cv = this._ghostCv || (this._ghostCv = document.createElement('canvas'));
      if (cv.width !== ctx.canvas.width || cv.height !== ctx.canvas.height) { cv.width = ctx.canvas.width; cv.height = ctx.canvas.height; }
      const g = cv.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, cv.width, cv.height);
      g.setTransform(m);
      this.ghostRig.draw(g, this.ghostPose, AX, AY, { scale: 1, status: 'ok', reduce: this.fx.reduce, highlight: { joints: this.freeze.S.joints, arcs: false } });
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = 'rgba(86,224,255,0.45)';
      g.fillRect(0, 0, cv.width, cv.height);
      g.globalCompositeOperation = 'source-over';
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 0.82;
      ctx.drawImage(cv, 0, 0);
      ctx.restore();
    }

    allyPose(a) {
      const t = a.anim;
      if (a.state === 'netted') { const p = TopPose.clone(TopPose.LIB.stunned); p.trunk += 8 * Math.sin(t * 9); return p; }
      if (a.staged) return TopPose.mk({ arms: [90, -25, 0, 115, 0], head: 0, stance: 22 });
      if (a.state === 'run') return TopPose.mk({ arms: [10, 0, 0, 80, 0], trunk: 10 * Math.sin(t * 12), stance: 18 + 6 * Math.sin(t * 12) });
      if (a.pauseT > 0) return TopPose.clone(TopPose.LIB.stunned);
      switch (a.type) {
        case 'mechanic': return TopPose.mk({ armR: [70, 10 + 20 * Math.sin(t * 7), 0, 60, 0], armL: [60, -10, 0, 70, 0], trunk: 6 * Math.sin(t * 2) });
        case 'medic': return TopPose.mk({ arms: [55, 0, 0, 70 + 10 * Math.sin(t * 3), 0], trunk: 4 * Math.sin(t) });
        case 'scout': return TopPose.mk({ arms: [80, 0, 0, 100, 0], trunk: 25 * Math.sin(t * 0.7), head: 20 * Math.sin(t * 0.7) });
        case 'engineer': return TopPose.mk({ armR: [60, 20 * Math.sin(t * 5), 0, 70, 0], armL: [50, 0, 0, 80, 0] });
        default: return TopPose.mk({ arms: [10, 0, 0, 80, 0] });
      }
    }

    drawAlly(ctx, a) {
      if (a.state === 'taken') return;
      const reduce = this.fx.reduce;
      let face = a.face;
      if (a.state === 'run') face = Math.atan2(a.spot.x - a.x, -(a.spot.y - a.y)) / D2R;
      if (a.state === 'netted' || a.staged) face = bearing(a.x, a.y) + 180;
      const p = this.allyPose(a);
      p.facing = face;
      const jx = a.shake > 0 && !reduce ? rand(-2, 2) : 0;
      if (this.freeze && this.freeze.ally === a && this.mode === 'decide' && !reduce) { a.shake = 0.1; }
      this.allyRig.draw(ctx, p, a.x + jx, a.y, { scale: 0.6, visor: a.visor, allyRole: a.visor, status: a.state === 'netted' ? 'warn' : 'ok', reduce, neutral: false });
      if (a.state === 'netted') {
        DroneArt.drawNet(ctx, a.x, a.y, 26, this.time, { open: 1, struggle: 0.6, charged: true, reduce });
        // countdown ring
        const k = clamp(a.netT / (a.netMax || 8), 0, 1);
        ctx.save();
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.beginPath(); ctx.arc(a.x, a.y, 34, 0, TAU); ctx.stroke();
        ctx.strokeStyle = k > 0.4 ? '#ffb020' : '#ff3040';
        ctx.beginPath(); ctx.arc(a.x, a.y, 34, -Math.PI / 2, -Math.PI / 2 + k * TAU); ctx.stroke();
        ctx.restore();
        this.worldText(ctx, fill(UI.hud.netted, { s: Math.ceil(a.netT) }), a.x, a.y + 46, '#ffb020', 13);
        if (this.mode === 'play' && !this.rescue) this.worldText(ctx, 'CLICK or R: CUT FREE', a.x, a.y + 62, '#ffe066', 11);
        if (a.netter && !a.netter.dead) DroneArt.drawTether(ctx, a.netter.x, a.netter.y, a.x, a.y, this.time, 0.7);
      }
      // name + status light
      const col = a.state === 'netted' ? '#ffb020' : a.pauseT > 0 ? '#ffb020' : '#4dff88';
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(a.x - 26, a.y + 26, 3.5, 0, TAU); ctx.fill();
      if (a.state !== 'netted') this.worldText(ctx, a.name, a.x, a.y + 27, a.visor, 10);
      if (this.freeze && this.freeze.ally === a && (this.mode === 'decide' || this.mode === 'ramp')) this.worldText(ctx, a.name + '!', a.x + (reduce ? 0 : rand(-1.5, 1.5)), a.y - 40, '#ffb020', 16);
    }

    drawDrone(ctx, d) {
      const spec = DT[d.type], reduce = this.fx.reduce, t = this.time;
      const F = this.freeze;
      // under-layers
      if (d.type === 'jammer' && !d.dead) {
        ctx.save();
        ctx.strokeStyle = `rgba(255,122,217,${0.18 + 0.08 * Math.sin(t * 4)})`; ctx.lineWidth = 2; ctx.setLineDash([4, 6]);
        ctx.beginPath(); ctx.arc(d.x, d.y, 160, 0, TAU); ctx.stroke();
        ctx.restore();
      }
      if (d.type === 'lancer' && (d.st === 'charge' || (F && F.drone === d && (this.mode === 'decide' || this.mode === 'ramp')))) {
        const k = d.st === 'charge' && !d.staged ? 1 - d.chargeT / d.chargeMax : 0.85;
        const h = AndroidTop.handPos(this.pl.pose, AX + this.pl.ox, AY + this.pl.oy, 'R', 1);
        ctx.save();
        ctx.strokeStyle = `rgba(255,70,70,${0.25 + 0.5 * k})`; ctx.lineWidth = 1 + 3 * k; ctx.setLineDash([10, 6]);
        ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(lerp(d.x, h[0], 0.3 + 0.7 * k), lerp(d.y, h[1], 0.3 + 0.7 * k)); ctx.stroke();
        ctx.restore();
      }
      if (d.type === 'spotter' && (d.st === 'hover' || d.staged)) {
        const ta = Math.atan2(AY - d.y, AX - d.x);
        const L = dist(d.x, d.y, AX, AY) + 30;
        const sw = reduce ? 0 : Math.sin(t * 2) * 0.05;
        ctx.save();
        const g = ctx.createRadialGradient(d.x, d.y, 10, d.x, d.y, L);
        g.addColorStop(0, 'rgba(255,60,60,0.28)'); g.addColorStop(1, 'rgba(255,60,60,0.02)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.arc(d.x, d.y, L, ta - 0.09 + sw, ta + 0.09 + sw); ctx.closePath(); ctx.fill();
        ctx.restore();
        if (d.staged || d.holdT > 0) this.worldText(ctx, `LOCK ${Math.min(99, Math.round((d.staged ? 0.8 : clamp(d.holdT / 3, 0, 1)) * 100))}%`, d.x, d.y + d.r + 22, '#ff5a5a', 12);
      }
      if (d.type === 'tether' && (d.st === 'hooked' || d.staged) && !d.cut) {
        const w = AndroidTop.partPoint(this.pl.pose, AX + this.pl.ox, AY + this.pl.oy, 'wristR', 1);
        DroneArt.drawTether(ctx, d.x, d.y, w[0], w[1], t, d.staged ? 1 : 0.8);
      } else if (d.type === 'tether' && d.st === 'aim') {
        const w = AndroidTop.partPoint(this.pl.pose, AX, AY, 'wristR', 1);
        ctx.save(); ctx.strokeStyle = 'rgba(255,176,32,0.4)'; ctx.setLineDash([3, 6]); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(w[0], w[1]); ctx.stroke(); ctx.restore();
      }
      if (d.type === 'netter' && (d.st === 'charge' || (d.staged && F && F.ally))) {
        const k = d.staged ? 0.85 : 1 - d.chargeT / d.chargeMax;
        const pulse = reduce ? 0.6 : 0.5 + 0.5 * Math.sin(t * 14);
        ctx.save();
        ctx.strokeStyle = `rgba(255,200,80,${0.4 + 0.5 * pulse})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r + 8 + 10 * (1 - k), 0, TAU); ctx.stroke();
        const a = d.ally || (F && F.ally);
        if (a) { ctx.setLineDash([5, 5]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(a.x, a.y); ctx.stroke(); }
        ctx.restore();
      }
      if (d.type === 'diver' && (d.st === 'dive' || d.staged)) {
        // lock-on reticle on the android's chest
        const c = AndroidTop.partPoint(this.pl.pose, AX + this.pl.ox, AY + this.pl.oy, 'torso', 1);
        const rr = 20 + (reduce ? 0 : 3 * Math.sin(t * 10));
        ctx.save(); ctx.strokeStyle = 'rgba(255,48,64,0.85)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(c[0], c[1], rr, 0, TAU); ctx.stroke();
        for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; ctx.beginPath(); ctx.moveTo(c[0] + Math.cos(a) * (rr - 6), c[1] + Math.sin(a) * (rr - 6)); ctx.lineTo(c[0] + Math.cos(a) * (rr + 6), c[1] + Math.sin(a) * (rr + 6)); ctx.stroke(); }
        ctx.restore();
      }
      if (d.type === 'warden') this.drawWardenUnder(ctx, d);
      // body
      const hpFrac = d.maxHp > 1 && d.type !== 'warden' && d.hp < d.maxHp && !d.staged ? d.hp / d.maxHp : null;
      const sel = this.selected === d && !this.freeze;
      if (spec.art) DroneArt.draw(ctx, spec.art, d.x, d.y, d.ang, t, { hp: hpFrac, elite: d.elite, hit: d.hit, targeted: sel, reduce, seed: d.seed, scale: spec.scale || 1 });
      if (spec.overlay) this.drawOverlay(ctx, d, spec.overlay);
      if (!spec.art && sel) DroneArt.draw(ctx, 'swarm', -999, -999, 0, t, {});
      if (d.type === 'warden') this.drawWardenOver(ctx, d);
      if (d.type === 'heavy' && d.speedBar != null && d.staged) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(d.x - 30, d.y - 56, 60, 8);
        ctx.fillStyle = '#ff6a3d'; ctx.fillRect(d.x - 29, d.y - 55, 58 * d.speedBar, 6);
        this.worldText(ctx, 'RAM SPEED', d.x, d.y - 66, '#ffb3a0', 10);
      }
      if (sel && !spec.art) {
        ctx.save(); ctx.strokeStyle = '#56e0ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(d.x, d.y, d.r + 12, 0, TAU); ctx.stroke(); ctx.restore();
      }
    }

    drawOverlay(ctx, d, kind) {
      const t = this.time, reduce = this.fx.reduce;
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.ang);
      if (kind === 'diver') {
        // wasp abdomen + stinger + afterburner
        const burn = d.st === 'dive' || d.staged;
        if (burn) {
          const g = ctx.createRadialGradient(-34, 0, 2, -34, 0, burn ? 26 : 14);
          g.addColorStop(0, 'rgba(255,240,200,0.9)'); g.addColorStop(0.4, 'rgba(255,120,40,0.6)'); g.addColorStop(1, 'rgba(255,60,20,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(-40, 0, 30, 10, 0, 0, TAU); ctx.fill();
        }
        ctx.fillStyle = '#2b2a20'; ctx.strokeStyle = '#0d0f12'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(-20, 0, 14, 8, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#f5c400';
        for (let i = 0; i < 3; i++) ctx.fillRect(-29 + i * 7, -7, 3, 14);
        ctx.fillStyle = '#ff3040';
        ctx.beginPath(); ctx.moveTo(14, -4); ctx.lineTo(30, 0); ctx.lineTo(14, 4); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,60,60,0.9)'; ctx.beginPath(); ctx.ellipse(8, 0, 4, 7, 0, 0, TAU); ctx.fill();
      } else if (kind === 'lancer') {
        const ch = d.st === 'charge' ? 1 - d.chargeT / d.chargeMax : d.staged ? 0.9 : 0.2;
        ctx.strokeStyle = '#0d0f12'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(50, 0); ctx.stroke();
        ctx.strokeStyle = '#9aa5b1'; ctx.lineWidth = 3; ctx.stroke();
        const g = ctx.createRadialGradient(52, 0, 1, 52, 0, 8 + 14 * ch);
        g.addColorStop(0, 'rgba(255,230,230,1)'); g.addColorStop(0.4, `rgba(255,60,60,${0.5 + 0.4 * ch})`); g.addColorStop(1, 'rgba(255,0,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(52, 0, 8 + 14 * ch, 0, TAU); ctx.fill();
      } else if (kind === 'spotter') {
        ctx.fillStyle = '#151a20'; ctx.strokeStyle = '#5d6b7b'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(14, 0, 11, 0, TAU); ctx.fill(); ctx.stroke();
        const g = ctx.createRadialGradient(16, -2, 1, 14, 0, 10);
        g.addColorStop(0, '#ffe0e0'); g.addColorStop(0.4, '#ff3040'); g.addColorStop(1, '#40080c');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(14, 0, 8, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(14, 0, 5, -2.2, -1.2); ctx.stroke();
      } else if (kind === 'crawler') {
        const step = reduce ? 0 : Math.sin(t * 18 + d.seed) * 0.35;
        ctx.strokeStyle = '#0d0f12'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        const legs = () => { for (let s = -1; s <= 1; s += 2) for (let i = 0; i < 3; i++) { const a = s * (1.2 + i * 0.5) + (i % 2 ? step : -step) * s; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 6, Math.sin(a) * 6); ctx.lineTo(Math.cos(a) * 19 - 3, Math.sin(a) * 19); ctx.stroke(); } };
        ctx.globalAlpha = 0.45; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(3, 4, 13, 10, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
        legs(); ctx.strokeStyle = '#6a5a3a'; ctx.lineWidth = 2; legs();
        // claws
        for (let s = -1; s <= 1; s += 2) {
          ctx.fillStyle = '#8a3a2a'; ctx.strokeStyle = '#0d0f12'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.ellipse(16, s * 8, 6, 4, s * 0.4, 0, TAU); ctx.fill(); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(20, s * 6); ctx.lineTo(26, s * (3 + (d.st === 'clamp' ? 0 : 3 * Math.abs(step)))); ctx.stroke();
        }
        const g = ctx.createLinearGradient(-10, -10, 10, 10);
        g.addColorStop(0, '#6d7a86'); g.addColorStop(1, '#262d35');
        ctx.fillStyle = g; ctx.strokeStyle = '#0d0f12'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(0, 0, 12, 9, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#f5c400'; ctx.fillRect(-6, -2, 12, 4);
        ctx.fillStyle = d.hit > 0 ? '#fff' : '#ff3040'; ctx.beginPath(); ctx.arc(8, 0, 2.6, 0, TAU); ctx.fill();
        if (d.elite) { ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, 15, 12, 0, 0, TAU); ctx.stroke(); }
      }
      ctx.restore();
      if (kind === 'crawler' && d.maxHp > 1 && d.hp < d.maxHp) {
        ctx.save(); ctx.lineWidth = 3; ctx.strokeStyle = '#7dff9a';
        ctx.beginPath(); ctx.arc(d.x, d.y, 22, -Math.PI / 2, -Math.PI / 2 + TAU * d.hp / d.maxHp); ctx.stroke(); ctx.restore();
      }
    }

    drawWardenUnder(ctx, d) {
      // searchlight sweeping the camp
      const a = this.time * 0.4;
      const tx = AX + Math.cos(a) * 160, ty = AY + 60 + Math.sin(a * 1.3) * 90;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(tx, ty, 5, tx, ty, 90);
      g.addColorStop(0, 'rgba(255,240,200,0.18)'); g.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(tx, ty, 90, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,240,200,0.06)'; ctx.lineWidth = 60;
      ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.restore();
    }

    drawWardenOver(ctx, d) {
      const Wd = this.warden;
      if (!Wd) return;
      const R = radiusOf('warden') + 14;
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.ang);
      // 3 armour plates: front, left, right of its heading
      const arcs = [[0, 'FRONT'], [-2.1, 'LEFT'], [2.1, 'RIGHT']];
      arcs.forEach(([a0], i) => {
        const on = Wd.plates[i];
        ctx.lineWidth = 9; ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        ctx.beginPath(); ctx.arc(0, 0, R, a0 - 0.75, a0 + 0.75); ctx.stroke();
        ctx.lineWidth = 6;
        ctx.strokeStyle = on ? '#8a96a2' : '#ff5a3d';
        if (!on) ctx.setLineDash([6, 8]);
        ctx.beginPath(); ctx.arc(0, 0, R, a0 - 0.75, a0 + 0.75); ctx.stroke();
        ctx.setLineDash([]);
      });
      if (Wd.phase >= 3 && !Wd.dead) {
        const p = this.fx.reduce ? 0.7 : 0.5 + 0.5 * Math.sin(this.time * 12);
        const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 50);
        g.addColorStop(0, `rgba(255,240,200,${p})`); g.addColorStop(1, 'rgba(255,90,40,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 50, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }

    drawDiscs(ctx) {
      for (const c of this.discs) {
        ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.spin);
        ctx.fillStyle = '#ffc53d'; ctx.strokeStyle = '#3a2a08'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#fff4c8'; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.stroke();
        ctx.restore();
      }
    }

    drawBeams(ctx) {
      for (const b of this.beams) {
        const k = 1 - b.t / b.life;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(${b.col},${0.35 * k})`; ctx.lineWidth = b.w * 3;
        ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${0.9 * k})`; ctx.lineWidth = Math.max(1, b.w * 0.5);
        ctx.stroke();
        ctx.restore();
      }
    }

    drawFloaters(ctx) {
      for (const f of this.floaters) {
        const k = f.t / f.life;
        ctx.save();
        ctx.globalAlpha = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
        this.worldText(ctx, f.text, f.x, f.y - 46 - 26 * easeOut(k), f.col, 14);
        ctx.restore();
      }
    }

    drawBubbles(ctx) {
      if (this.mode === 'decide' || this.mode === 'ramp') return;
      ctx.save();
      ctx.font = '600 12px system-ui, sans-serif';
      for (const b of this.bubbles) {
        const a = b.ally;
        if (a.state === 'taken') continue;
        const k = b.t / b.dur;
        const words = b.text.split(' ');
        const lines = []; let line = '';
        for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > 200 && line) { lines.push(line); line = w; } else line = t; }
        if (line) lines.push(line);
        const bw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 16, bh = lines.length * 15 + 18;
        let bx = clamp(a.x - bw / 2, 8, W - bw - 8), by = a.y - 50 - bh;
        if (by < 64) by = a.y + 40;
        ctx.globalAlpha = k < 0.08 ? k / 0.08 : k > 0.85 ? (1 - k) / 0.15 : 1;
        ctx.fillStyle = 'rgba(10,16,24,0.92)'; ctx.strokeStyle = a.visor; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(bx, by, bw, bh, 7) : ctx.rect(bx, by, bw, bh); ctx.fill(); ctx.stroke();
        ctx.fillStyle = a.visor; ctx.font = '800 10px ui-monospace, monospace';
        ctx.fillText(a.name, bx + 8, by + 13);
        ctx.fillStyle = '#e8f1f8'; ctx.font = '600 12px system-ui, sans-serif';
        lines.forEach((l, i) => ctx.fillText(l, bx + 8, by + 28 + i * 15));
      }
      ctx.restore();
    }

    drawChevrons(ctx) {
      if (this.mode !== 'play') return;
      const ns = this.nextSpawn;
      const kite = this.allies.find((a) => a.type === 'scout' && this.allyWorking(a));
      if (!ns || !kite) return;
      const lead = 2 + (this.eff.earlyWarning || 0) / 100;
      const dt = ns.at - this.waveT;
      if (dt > lead || dt < 0) return;
      const sxn = Math.sin(ns.th * D2R), syn = -Math.cos(ns.th * D2R);
      const [ox, oy] = this.worldToScreen(AX, AY);
      let t = 2000;
      if (Math.abs(sxn) > 1e-3) t = Math.min(t, ((sxn > 0 ? W - 46 : 46) - ox) / sxn);
      if (Math.abs(syn) > 1e-3) t = Math.min(t, ((syn > 0 ? H - 46 : 76) - oy) / syn);
      const x = ox + sxn * t, y = oy + syn * t;
      Arena.drawSpawnWarning(ctx, x, y, Math.atan2(-syn, -sxn), this.time, { label: DT[ns.type].name, count: ns.type === 'swarm' ? 5 : 1 });
    }

    drawTensionOverlay(ctx, k) {
      if (k <= 0.01) return;
      const pulse = this.mode === 'decide' ? 0.5 + 0.5 * Math.sin(this.time * (4 + 8 * k)) : 0;
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.9);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, `rgba(${Math.round(60 + 140 * k * pulse * (this.fx.reduce ? 0.3 : 1))},0,0,${0.3 + 0.4 * k})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = `rgba(0,0,0,${0.1 * k})`;
      for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
      if (this.mode === 'decide' && this.freeze) {
        const left = this.freeze.S.side === 'left';
        ctx.save();
        ctx.font = '800 15px ui-monospace, monospace';
        ctx.textAlign = left ? 'right' : 'left';
        ctx.fillStyle = `rgba(160,230,255,${0.55 + 0.3 * pulse})`;
        ctx.fillText('◉ TIME DILATION ACTIVE', left ? W - 24 : 24, 92);
        ctx.font = '700 14px ui-monospace, monospace';
        ctx.fillStyle = 'rgba(191,244,255,0.85)';
        ctx.fillText(`⊙ ${C.axisName('transverse').toUpperCase()} points out of the screen`, left ? W - 24 : 24, 114);
        if (this.jammed()) { ctx.fillStyle = '#ffc53d'; ctx.fillText(`${UI.freeze.sensorsJammed}: muscles shown white`, left ? W - 24 : 24, 136); }
        ctx.restore();
      }
    }

    // magnifier for threats staged far away (palm shield, disc launcher): the
    // questioned joint is shown ×3 in a circular inset so it reads on a projector
    drawInset(ctx) {
      const F = this.freeze;
      if (!F || !F.S.inset) return;
      const m = this.mode;
      if (!(m === 'decide' || m === 'act' || m === 'replay' || m === 'failed' || (m === 'ramp' && this.modeT > 0.3))) return;
      const a = m === 'ramp' ? clamp((this.modeT - 0.3) / 0.3, 0, 1) : 1;
      const pl = this.pl, ax = AX + pl.ox, ay = AY + pl.oy;
      const foc = AndroidTop.partPoint(pl.pose, ax, ay, F.S.inset, 1);
      const fx0 = ax * 0.4 + foc[0] * 0.6, fy0 = ay * 0.4 + foc[1] * 0.6;
      const fs = this.worldToScreen(fx0, fy0), ds = this.worldToScreen(F.drone.x, F.drone.y);
      const left = F.S.side === 'left';
      const r = 118, Zi = 3.1;
      const cands = left ? [[560, 470], [1100, 470], [1100, 230], [560, 230], [830, 560]] : [[180, 330], [720, 470], [720, 230], [450, 560]];
      let best = cands[0], bs = -1;
      for (const c of cands) { const sc = Math.min(dist(c[0], c[1], fs[0], fs[1]), dist(c[0], c[1], ds[0], ds[1]) + 40); if (sc > bs) { bs = sc; best = c; } }
      const [cx, cy] = best;
      ctx.save();
      ctx.globalAlpha = a;
      // connector to the real joint
      ctx.strokeStyle = 'rgba(143,240,255,0.6)'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
      const ang = Math.atan2(fs[1] - cy, fs[0] - cx);
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r); ctx.lineTo(fs[0], fs[1]); ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(fs[0], fs[1], 22, 0, TAU); ctx.stroke();
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip();
      const bg = ctx.createRadialGradient(cx, cy, 10, cx, cy, r);
      bg.addColorStop(0, '#1a2633'); bg.addColorStop(1, '#0a1118');
      ctx.fillStyle = bg; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      ctx.strokeStyle = 'rgba(143,240,255,0.06)'; ctx.lineWidth = 1;
      for (let i = -r; i <= r; i += 24) { ctx.beginPath(); ctx.moveTo(cx + i, cy - r); ctx.lineTo(cx + i, cy + r); ctx.moveTo(cx - r, cy + i); ctx.lineTo(cx + r, cy + i); ctx.stroke(); }
      ctx.translate(cx, cy); ctx.scale(Zi, Zi); ctx.translate(-fx0, -fy0);
      // direction of the threat (beam / scanning line), drawn into the inset
      const dx = F.drone.x - fx0, dy = F.drone.y - fy0, dl = Math.hypot(dx, dy) || 1;
      ctx.strokeStyle = 'rgba(255,70,70,0.75)'; ctx.lineWidth = 2.2 / Zi * 2; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(fx0 + (dx / dl) * 12, fy0 + (dy / dl) * 12); ctx.lineTo(fx0 + (dx / dl) * 60, fy0 + (dy / dl) * 60); ctx.stroke();
      ctx.setLineDash([]);
      const showHl = m === 'decide';
      this.rig.draw(ctx, pl.pose, ax, ay, { scale: 1, status: pl.status, neutral: this.jammed(), damage: this.damage, reduce: this.fx.reduce, highlight: showHl ? { joints: F.S.joints, arcs: true } : null, malfunction: pl.mal, launcher: F.tOpts.launcher || null });
      if (this.ghostPose) this.ghostRig.draw(ctx, this.ghostPose, AX, AY, { scale: 1, status: 'ok', reduce: this.fx.reduce });
      ctx.restore();
      ctx.strokeStyle = '#8ff0ff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
      // label + threat arrow on the rim
      ctx.font = '800 13px ui-monospace, monospace'; ctx.textAlign = 'center';
      const lab = `ZOOM ×3 · ${F.S.insetLabel}`;
      const tw = ctx.measureText(lab).width + 14;
      ctx.fillStyle = 'rgba(6,12,18,0.92)'; ctx.fillRect(cx - tw / 2, cy - r - 12, tw, 22);
      ctx.fillStyle = '#8ff0ff'; ctx.textBaseline = 'middle'; ctx.fillText(lab, cx, cy - r - 1);
      const ta = Math.atan2(dy, dx);
      const tx = cx + Math.cos(ta) * (r - 4), ty = cy + Math.sin(ta) * (r - 4);
      ctx.fillStyle = '#ff5a5a';
      ctx.beginPath(); ctx.moveTo(tx + Math.cos(ta) * 14, ty + Math.sin(ta) * 14); ctx.lineTo(tx + Math.cos(ta + 2.4) * 10, ty + Math.sin(ta + 2.4) * 10); ctx.lineTo(tx + Math.cos(ta - 2.4) * 10, ty + Math.sin(ta - 2.4) * 10); ctx.closePath(); ctx.fill();
      ctx.font = '800 11px ui-monospace, monospace';
      ctx.fillStyle = '#ffb3b3';
      ctx.fillText(DT[F.drone.type].name, cx + Math.cos(ta) * (r + 34), cy + Math.sin(ta) * (r + 26));
      ctx.restore();
    }

    drawReadout(ctx) {
      const r = this.readout;
      const col = r.kind === 'correct' ? '#7dff9a' : r.kind === 'timeout' ? '#ff8a8a' : '#ffb020';
      ctx.save();
      ctx.font = '800 17px ui-monospace, monospace';
      const tw = ctx.measureText(r.text).width + 30;
      const x = clamp(W / 2 - tw / 2, 300, W - 210 - tw), y = H - 64;
      ctx.globalAlpha = Math.min(1, r.t * 4);
      ctx.fillStyle = 'rgba(6,12,18,0.88)'; ctx.strokeStyle = col; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, tw, 34, 6) : ctx.rect(x, y, tw, 34); ctx.fill(); ctx.stroke();
      ctx.fillStyle = col; ctx.textBaseline = 'middle';
      ctx.fillText(r.text, x + 15, y + 18);
      ctx.restore();
    }

    drawReplayTag(ctx) {
      ctx.save();
      ctx.fillStyle = 'rgba(4,20,30,0.55)'; ctx.fillRect(0, 64, W, 44);
      ctx.font = '900 24px ui-monospace, monospace'; ctx.textAlign = 'center';
      ctx.fillStyle = '#8ff0ff';
      ctx.fillText(`↻ ${UI.card.ghost.toUpperCase()}: ${String(this.freeze.st.correct).toUpperCase()}`, W / 2, 94);
      ctx.restore();
    }

    drawIntro(ctx) {
      const k = this.modeT;
      const a = k < 0.3 ? k / 0.3 : k > 2.1 ? Math.max(0, (2.6 - k) / 0.5) : 1;
      const BY = 214;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, BY - 92, W, 170);
      ctx.textAlign = 'center';
      ctx.font = '900 64px ui-monospace, monospace';
      ctx.fillStyle = this.cfg.boss ? '#ff5a5a' : '#e8f4ff';
      ctx.fillText(this.cfg.boss ? `WAVE ${this.wave} · ${UI.wave.wardenInbound}` : `WAVE ${this.wave}`, W / 2, BY - 18);
      ctx.font = '800 24px ui-monospace, monospace';
      ctx.fillStyle = '#ffd27a';
      ctx.fillText(fill(UI.wave.intro, { n: this.wave, subsystem: this.cfg.sub }).replace(/^WAVE \d+: /, ''), W / 2, BY + 22);
      ctx.font = '600 17px system-ui, sans-serif';
      ctx.fillStyle = '#bcd0de';
      ctx.fillText(this.introLine + '  ·  Click a drone or press A / D to target, SPACE to strike, R to cut a net.', W / 2, BY + 56);
      ctx.restore();
    }

    drawClear(ctx) {
      const a = Math.min(1, this.modeT * 2);
      const BY = 214;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(0,30,15,0.4)'; ctx.fillRect(0, BY - 70, W, 120);
      ctx.textAlign = 'center';
      ctx.font = '900 56px ui-monospace, monospace';
      ctx.fillStyle = '#7dff9a';
      ctx.fillText(fill(UI.wave.cleared, { subsystem: this.cfg.sub }), W / 2, BY + 6);
      if (this.newRecord) { ctx.font = '800 20px ui-monospace, monospace'; ctx.fillStyle = '#ffd27a'; ctx.fillText(UI.wave.newRecord, W / 2, BY + 38); }
      ctx.restore();
    }

    drawPowerFailure(ctx) {
      ctx.save();
      ctx.globalAlpha = this.powerFail;
      ctx.textAlign = 'center';
      ctx.font = '900 54px ui-monospace, monospace';
      ctx.fillStyle = '#ff5a5a';
      ctx.fillText(UI.wave.shutdown, W / 2, H / 2 - 30);
      ctx.font = '700 18px ui-monospace, monospace';
      ctx.fillStyle = '#ffc0c0';
      ctx.fillText(`ENERGY 0/${this.maxEnergy} · SHUTTING DOWN · ${UI.wave.failed}`, W / 2, H / 2 + 10);
      ctx.restore();
    }

    drawSystemFailure(ctx) {
      const k = this.sysFail;
      ctx.save();
      ctx.globalAlpha = k;
      ctx.fillStyle = 'rgba(40,0,0,0.45)';
      ctx.fillRect(0, H / 2 - 70, W, 140);
      ctx.textAlign = 'center';
      ctx.font = '900 64px ui-monospace, monospace';
      const jx = this.fx.reduce ? 0 : rand(-4, 4);
      ctx.fillStyle = 'rgba(0,255,255,0.6)'; ctx.fillText('SYSTEM FAILURE', W / 2 + jx - 3, H / 2 + 10);
      ctx.fillStyle = 'rgba(255,0,60,0.8)'; ctx.fillText('SYSTEM FAILURE', W / 2 + jx + 3, H / 2 + 10);
      ctx.fillStyle = '#fff'; ctx.fillText('SYSTEM FAILURE', W / 2 + jx, H / 2 + 10);
      ctx.font = '700 18px ui-monospace, monospace';
      ctx.fillStyle = '#ffb3b3';
      ctx.fillText('ERR 0x7A1 · PLANE VIOLATION · MOTION OUTSIDE THE TRANSVERSE PLANE', W / 2, H / 2 + 46);
      ctx.restore();
    }

    // ---------------- HUD (canvas; §4.1) ----------------
    drawHUD(ctx) {
      if (this.mode === 'workshop') return;
      ctx.save();
      const g = ctx.createLinearGradient(0, 0, 0, 62);
      g.addColorStop(0, 'rgba(3,6,10,0.85)'); g.addColorStop(1, 'rgba(3,6,10,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, 62);
      ctx.textBaseline = 'middle';
      // ENERGY (half cells)
      const n = this.maxEnergy;
      ctx.font = '800 12px ui-monospace, monospace'; ctx.fillStyle = '#bfefff';
      ctx.fillText('ENERGY', 18, 22);
      for (let i = 0; i < n; i++) {
        const x = 82 + i * 30, y = 14;
        ctx.fillStyle = '#16222d'; ctx.fillRect(x, y, 26, 16);
        const f = clamp(this.energy - i, 0, 1);
        if (f > 0) {
          ctx.fillStyle = this.energy <= 1.5 ? '#ff5a5a' : '#56e0ff';
          ctx.fillRect(x, y, 26 * (f >= 1 ? 1 : 0.5), 16);
        }
        ctx.strokeStyle = '#2c3d4e'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, 25, 15);
        ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.moveTo(x + 13, y + 2); ctx.lineTo(x + 13, y + 14); ctx.stroke();
      }
      ctx.fillStyle = '#e8f4ff'; ctx.font = '800 14px ui-monospace, monospace';
      const etxt = (this.energy % 1 ? this.energy.toFixed(1) : String(this.energy)) + '/' + n;
      ctx.fillText(etxt, 88 + n * 30, 22);
      if (this.marked) { ctx.fillStyle = '#ff5a5a'; ctx.font = '800 11px ui-monospace, monospace'; ctx.fillText('MARKED: HITS ×2', 18, 44); }
      else if (this.snareT > 0) { ctx.fillStyle = '#ffb020'; ctx.font = '800 11px ui-monospace, monospace'; ctx.fillText('SNARED: NO TURNING', 18, 44); }
      else if (this.hooked) { ctx.fillStyle = '#ffb020'; ctx.font = '800 11px ui-monospace, monospace'; ctx.fillText('RIGHT ARM HOOKED', 18, 44); }
      // REPAIR
      const rx = 440, rw = 400;
      const pct = this.repair / this.cfg.need;
      const rate = this.repairRate();
      const stalled = rate <= 0.001;
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(rx, 30, rw, 12);
      const rg = ctx.createLinearGradient(rx, 0, rx + rw, 0);
      rg.addColorStop(0, stalled ? '#555' : '#56e0ff'); rg.addColorStop(1, stalled ? '#777' : '#7dff9a');
      ctx.fillStyle = rg; ctx.fillRect(rx, 30, rw * pct, 12);
      ctx.strokeStyle = '#2c3d4e'; ctx.strokeRect(rx + 0.5, 30.5, rw - 1, 11);
      ctx.font = '800 13px ui-monospace, monospace'; ctx.fillStyle = stalled ? '#9aa5b1' : '#e8f4ff';
      ctx.fillText(fill(UI.hud.repair, { pct: Math.floor(pct * 100), subsystem: this.cfg.sub }), rx, 16);
      ctx.textAlign = 'right';
      ctx.fillStyle = stalled ? '#ff8a8a' : '#7dff9a';
      ctx.fillText(stalled ? UI.hud.stalled : `+${rate.toFixed(1)}/s`, rx + rw, 16);
      ctx.textAlign = 'left';
      if (this.warden && !this.warden.dead) {
        ctx.font = '800 12px ui-monospace, monospace'; ctx.fillStyle = '#ff8a6a';
        ctx.fillText(`THE WARDEN · PLATES ${this.warden.plates.filter(Boolean).length}/3${this.warden.phase >= 3 ? ' · CORE EXPOSED' : ''}`, rx, 54);
      }
      // WAVE / SCRAP / COMBO
      ctx.font = '900 16px ui-monospace, monospace'; ctx.fillStyle = '#e8f4ff';
      ctx.fillText(fill(UI.hud.wave, { n: this.wave }), 900, 22);
      ctx.fillStyle = '#ffd27a';
      ctx.fillText(fill(UI.hud.scrap, { n: this.save.scrap || 0 }), 1000, 22);
      if (this.combo > 0) {
        ctx.fillStyle = this.combo >= 5 ? '#ff6a3d' : '#ffe066';
        ctx.fillText(fill(UI.hud.combo, { n: this.combo }), 1124, 22);
        const keep = this.eff.comboKeep || 3;
        ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(1124, 34, 90, 4);
        ctx.fillStyle = '#ffe066'; ctx.fillRect(1124, 34, 90 * clamp(this.comboT / keep, 0, 1), 4);
      }
      if (this.overdrive > 0) { ctx.fillStyle = '#ff6a3d'; ctx.font = '900 13px ui-monospace, monospace'; ctx.fillText(`${UI.hud.overdrive} ${this.overdrive.toFixed(1)}s`, 1124, 50); }
      // ALLY ROSTER (bottom-right)
      const list = this.allies;
      const bx = W - 206, by0 = H - 14 - list.length * 30;
      list.forEach((a, i) => {
        const y = by0 + i * 30;
        const netted = a.state === 'netted', taken = a.state === 'taken';
        ctx.fillStyle = netted ? 'rgba(60,40,0,0.85)' : taken ? 'rgba(50,10,14,0.85)' : 'rgba(6,12,18,0.82)';
        ctx.fillRect(bx, y, 194, 26);
        ctx.fillStyle = a.visor; ctx.fillRect(bx, y, 4, 26);
        ctx.font = '800 12px ui-monospace, monospace'; ctx.fillStyle = a.visor;
        ctx.fillText(a.name, bx + 10, y + 9);
        ctx.font = '600 10px ui-monospace, monospace'; ctx.fillStyle = '#8fa3b3';
        ctx.fillText(`${a.unit} · ${C.ALLY_TYPES[a.type].name.toUpperCase()}`, bx + 10, y + 20);
        ctx.textAlign = 'right'; ctx.font = '800 11px ui-monospace, monospace';
        const shake = netted && !this.fx.reduce ? rand(-1, 1) : 0;
        ctx.fillStyle = netted ? '#ffb020' : taken ? '#ff5a5a' : a.pauseT > 0 ? '#ffb020' : '#4dff88';
        ctx.fillText(netted ? fill(UI.hud.netted, { s: Math.ceil(a.netT) }) : taken ? UI.hud.draggedOff : a.pauseT > 0 ? 'BUMPED' : a.state === 'run' ? 'RUNNING' : UI.hud.working, bx + 188 + shake, y + 13);
        ctx.textAlign = 'left';
      });
      ctx.restore();
    }

    // ---------------- debug hooks (§4.13; used by tools/playtest-transverse.js) ----------------
    buildDebug() {
      const self = this;
      this.debug = {
        forceThreat(id, o) {
          if (!THREAT_STAGE[id]) return false;
          if (self.mode === 'intro') { self.mode = 'play'; self.modeT = 0; }
          if (self.mode !== 'play') return false;
          if (self.rescue) self.closeRescue();
          self.waveT = Math.max(self.waveT, 16);
          return self.forceThreat(id, Object.assign({}, o || {}));
        },
        skip(sec, step) { step = step || 1 / 30; for (let t = 0; t < sec; t += step) self.update(step); return self.mode; },
        endWave() { self.repair = self.cfg.need; if (self.cfg.boss) { if (!self.warden) self.spawnWarden(); self.warden.dead = true; self.warden.d.dead = true; } return true; },
        setWave(n) { self.startWave(n); return self.wave; },
        setEnergy(n) { self.energy = n; return n; },
        timer(s) { self.debugTimer = s; },
        netAll() {
          self.allies.forEach((a) => {
            if (a.state === 'taken' || a.state === 'netted') return;
            const d = self.spawnDrone('netter', bearing(a.x, a.y), { at: [a.x + 30, a.y - 30] });
            d.ally = a; d.hp = d.maxHp = 60; self.netAlly(a, d);
          });
          return self.allies.map((a) => a.state);
        },
        rescue(correct) {
          const a = self.allies.find((q) => q.state === 'netted');
          if (!a) return 'none';
          if (!self.rescue) self.startRescue(a);
          if (!self.rescue) return 'blocked';
          const i = self.rescue.options.indexOf(self.rescue.correct);
          self.answerRescue(correct ? i : (i + 1) % 3);
          return a.state;
        },
        wardenNow() {
          if (!self.cfg.boss) return false;
          if (self.mode === 'intro') { self.mode = 'play'; self.modeT = 0; }
          if (!self.warden) self.spawnWarden();
          const d = self.warden.d; d.st = 'orbit'; const p = polar(0, 255); d.x = p[0]; d.y = p[1];
          self.warden.phaseT = 0;
          return true;
        },
        state() {
          const F = self.freeze;
          return {
            mode: self.mode, wave: self.wave, energy: self.energy, maxEnergy: self.maxEnergy, repair: Math.round(self.repair), need: self.cfg.need,
            freezes: self.freezesDone, target: self.cfg.target, drones: self.drones.length, allies: self.allies.map((a) => a.id + ':' + a.state),
            reask: self.reask.slice(), combo: self.combo, scrap: self.save.scrap, bestWave: self.save.bestWave, damage: Object.keys(self.damage),
            warden: self.warden ? { phase: self.warden.phase, idx: self.warden.idx, chain: self.warden.chain, plates: self.warden.plates, dead: self.warden.dead } : null,
            freeze: F ? { id: F.id, options: F.options, correct: F.st.correct, kind: F.st.kind, distractors: F.st.distractors, planeWrong: F.st.planeWrong || [], result: F.result || null } : null,
            rescue: self.rescue ? { ally: self.rescue.ally.id, options: self.rescue.options, correct: self.rescue.correct } : null,
            stats: { freezes: self.stats.freezes, correct: self.stats.correct, plane: self.stats.plane, inplane: self.stats.inplane, contraction: self.stats.contraction, timeout: self.stats.timeout, kills: self.stats.kills, rescues: self.stats.rescues, shutdowns: self.stats.shutdowns, noCrew: self.stats.noCrew, wavesCleared: self.stats.wavesCleared, log: self.stats.log.length },
          };
        },
      };
    }
  }

  SEHS.DroneDefense = DroneDefense;
  SEHS.DroneDefense.THREAT_STAGE = THREAT_STAGE;
  SEHS.DroneDefense.waveCfg = waveCfg;
  SEHS.DroneDefense.SaveIO = SaveIO;
})();
