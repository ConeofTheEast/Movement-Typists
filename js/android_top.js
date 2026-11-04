/*
 * android_top.js: ANATOMICAL ANDROID RIG, TOP-DOWN (bird's-eye) VIEW
 * -------------------------------------------------------------------
 * Owned by the "anatomy-animator" agent. Used by the transverse level
 * (Drone Defense): the screen IS the transverse plane and the longitudinal
 * axis points out of the screen (drawn as the ⊙ glyph).
 *
 * Same art language as js/android.js (titanium bones, graphite joints, cyan
 * core + visor, red muscles that swell in 1/8 steps and recolour by
 * contraction type c/e/i).
 *
 * The skeleton is solved in 3D (x = right, y = forward, z = up, origin at the
 * pelvis centre, shoulder height z = 0) and projected straight down with a
 * slight perspective (higher parts drawn a little bigger), so a hanging upper
 * arm is seen end-on and a forearm held forward is seen full length.
 *
 * Pose params (all angles in DEGREES; L / R = the android's left / right):
 *   facing     whole-body heading in the world. 0 = facing up the screen,
 *              + = counter-clockwise on screen (turning to its left).
 *   trunk      spine rotation of the thorax relative to the pelvis
 *              (+ = to the LEFT / counter-clockwise, - = to the right).
 *   head       neck rotation relative to the thorax (+ = left).
 *   slump      0..1 head drops forward, shoulders roll in (shutdown).
 *   stance     half-distance between the feet (unscaled px, default 24).
 *   shElevX    arm elevation (0 = hanging at the side, 90 = at shoulder
 *              height). Horizontal ab/adduction reads best at 90, shoulder
 *              rotation reads best at ~0-20 with the elbow at 90.
 *   shHAbdX    horizontal abduction (+) / adduction (-) of the upper arm,
 *              0 = pointing straight forward.
 *   shRotX     shoulder lateral (+) / medial (-) rotation about the humerus
 *              long axis (with the elbow at 90 the forearm swings out / in).
 *   elX        elbow flexion (+).
 *   foreX      radio-ulnar: supination (+) / pronation (-), -90..+90.
 *              +90 = palm up (cyan palm emitter), -90 = palm down (dark
 *              dorsum plate), 0 = thumb up.
 *   hipRotX    hip lateral (+) / medial (-) rotation (foot + kneecap turn).
 *
 * Muscle shortening is computed from the joint params with a moment-arm
 * model: length ratio = 1 + sum(k * delta angle in rad) (see MUSCLES[].k),
 * so it is always on the anatomically right side of each joint. The path
 * drawn on screen comes from the 3D attachment points.
 *
 * draw(ctx, pose, x, y, opts):  (x, y) = pelvis centre on screen
 *   scale (1 = ~110 px figure, shoulders ~90 px; allies ~0.6), status
 *   ('ok'|'warn'|'fail'), neutral (white muscles), damage {head, armL, armR,
 *   torso, legs} 0..1 (or true, or an Array/Set of names), reduce, visor
 *   (ally visor colour), allyRole (role badge colour), labels (true |
 *   'active'), highlight { joints: ['shoulderR', 'trunk', 'foreL', 'hipR',
 *   'elbowL', ...], arcs: true, dir: 'ccw'|'cw' }.
 *   Returns the rig; rig.sparks = [[x, y], ...] spark points (FX layer).
 */
(function () {
  'use strict';
  const SEHS = (window.SEHS = window.SEHS || {});
  const D2R = Math.PI / 180;
  const TAU = Math.PI * 2;

  // ---------------- dimensions (unscaled px at scale 1, GAME_DESIGN §4.1) ----------------
  // shoulder span 74, trunk 74 x 28, raised-arm length ~92 (shoulder -> fingertips)
  const DIM = {
    shX: 37, // shoulder joint centre, half-width
    upper: 40, fore: 36, hand: 14,
    ribW: 24, ribD: 14,
    pelW: 20, pelD: 10, pelZ: -46,
    hipX: 10, kneeZ: -74, ankleZ: -100, foot: 23, heel: 6,
    headR: 10.5, headZ: 16, headY: 1,
  };
  const PERSP = 0.0016; // perspective: k(z) = 1 + z * PERSP

  const SIDES = ['L', 'R'];
  const SGN = { L: -1, R: 1 };
  const ARM_KEYS = ['fl', 'hz', 'rot', 'el', 'pr'];
  const TOP_KEYS = ['facing', 'trunk', 'head', 'slump', 'stance', 'hipL', 'hipR'];
  const POSE_KEYS = TOP_KEYS.concat(ARM_KEYS.map((k) => 'L.' + k), ARM_KEYS.map((k) => 'R.' + k));
  const BASE = {
    facing: 0, trunk: 0, head: 0, slump: 0, stance: 21, hipL: 0, hipR: 0,
    L: { fl: 0, hz: 0, rot: 0, el: 20, pr: 0 },
    R: { fl: 0, hz: 0, rot: 0, el: 20, pr: 0 },
  };
  // legacy flat names (first WIP snapshot) -> spec names
  const LEGACY = { shElev: 'fl', shHAbd: 'hz', shRot: 'rot', el: 'el', fore: 'pr' };

  // ---------------- pose helpers ----------------
  function clone(a) {
    const o = Object.assign({}, a);
    o.L = Object.assign({}, a.L || BASE.L);
    o.R = Object.assign({}, a.R || BASE.R);
    return o;
  }
  // mk(overrides): full pose from BASE + overrides. Accepts
  //   spec keys: trunk, head, slump, stance, facing, hipL, hipR, L: {fl,hz,rot,el,pr}, R: {...}
  //   shorthands: arms / armL / armR = [fl, hz, rot, el, pr] or {fl,...}; hip = both hips
  //   legacy flat keys: shElevR, shHAbdR, shRotR, elR, foreR, hipRotR (and L)
  //   mus: { muscleId | 'muscleId:R': ['c'|'e'|'i', 0..1] }
  function mk(o) {
    const p = clone(BASE);
    if (!o) return p;
    const arm = (s, a) => {
      if (!a) return;
      if (Array.isArray(a)) ARM_KEYS.forEach((k, i) => { if (a[i] != null) p[s][k] = a[i]; });
      else ARM_KEYS.forEach((k) => { if (a[k] != null) p[s][k] = a[k]; });
    };
    arm('L', o.arms); arm('R', o.arms);
    arm('L', o.armL); arm('R', o.armR);
    arm('L', o.L); arm('R', o.R);
    for (const s of SIDES) {
      for (const lk in LEGACY) if (o[lk + s] != null) p[s][LEGACY[lk]] = o[lk + s];
      if (o['hipRot' + s] != null) p['hip' + s] = o['hipRot' + s];
    }
    if (o.hip != null) { p.hipL = o.hip; p.hipR = o.hip; }
    for (const k of TOP_KEYS) if (o[k] !== undefined) p[k] = o[k];
    if (o.mus) p.mus = o.mus;
    return p;
  }
  // with(pose, overrides): copy of an existing pose with overrides (same syntax as mk)
  function withPose(base, o) {
    const p = clone(base);
    if (!o) return p;
    const q = mk(Object.assign({}, o));
    // only copy what o actually set
    const arm = (s, a) => {
      if (!a) return;
      if (Array.isArray(a)) ARM_KEYS.forEach((k, i) => { if (a[i] != null) p[s][k] = a[i]; });
      else ARM_KEYS.forEach((k) => { if (a[k] != null) p[s][k] = a[k]; });
    };
    arm('L', o.arms); arm('R', o.arms); arm('L', o.armL); arm('R', o.armR); arm('L', o.L); arm('R', o.R);
    if (o.hip != null) { p.hipL = o.hip; p.hipR = o.hip; }
    for (const k of TOP_KEYS) if (o[k] !== undefined) p[k] = q[k];
    if ('mus' in o) p.mus = o.mus;
    return p;
  }
  function get(p, path) {
    if (path.length > 2 && path[1] === '.') { const a = p[path[0]] || BASE[path[0]]; return a[path.slice(2)] != null ? a[path.slice(2)] : BASE[path[0]][path.slice(2)]; }
    return p[path] != null ? p[path] : BASE[path];
  }
  function lerp(a, b, t) {
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const o = clone(BASE);
    for (const k of TOP_KEYS) {
      const va = get(a, k), vb = get(b, k);
      let d = vb - va;
      if (k === 'facing') d = ((d + 540) % 360) - 180; // shortest turn
      o[k] = va + d * t;
    }
    for (const s of SIDES) for (const k of ARM_KEYS) { const va = get(a, s + '.' + k), vb = get(b, s + '.' + k); o[s][k] = va + (vb - va) * t; }
    o.mus = t < 0.5 ? a.mus : b.mus;
    return o;
  }
  // isometric tremble: jitter(pose, deg, ['trunk', 'R.hz', ...]) (default: all angles)
  function jitter(p, amt, keys) {
    const o = clone(p);
    o.mus = p.mus;
    (keys || POSE_KEYS).forEach((k) => {
      if (k === 'facing' || k === 'stance' || k === 'slump') return;
      const j = (Math.random() - 0.5) * 2 * amt;
      if (k.length > 2 && k[1] === '.') o[k[0]][k.slice(2)] = get(p, k) + j; else o[k] = get(p, k) + j;
    });
    return o;
  }

  // ---------------- pose library ----------------
  // Arms: [fl (0 hanging / 90 raised), hz (+ horizontal abduction / - adduction),
  //        rot (+ lateral / - medial), el (elbow flexion), pr (+ supination / - pronation)]
  const HANG = [0, 0, 0, 12, 0]; // hanging, elbow nearly straight, palm to thigh
  const TUCK = [0, 0, 0, 90, 0]; // elbow tucked at 90, forearm forward, thumb up
  const GUARD = [8, 0, -22, 100, -20]; // relaxed guard: forearms forward-in
  const RAISED = [90, 0, 0, 10, 0]; // raised straight forward
  const LIB = {
    idle: mk({ arms: GUARD, hip: 6, stance: 22 }),
    guard: mk({ arms: GUARD, hip: 6, stance: 22 }),
    // horizontal ADDUCTION swat (right arm sweeps across the chest; pec major)
    crossSwatPrep: mk({ trunk: 20, armR: [90, 80, 0, 12, 0], armL: GUARD, stance: 24 }),
    crossSwat: mk({ trunk: -20, armR: [90, -30, 0, 10, 0], armL: GUARD, stance: 24 }),
    // horizontal ABDUCTION backhand (right arm sweeps out; posterior deltoid)
    backhandPrep: mk({ trunk: -20, armR: [90, -20, 0, 20, 0], armL: GUARD, stance: 24 }),
    backhand: mk({ trunk: 20, armR: [90, 100, 0, 8, 0], armL: GUARD, stance: 24 }),
    // trunk (spine) rotation about the longitudinal axis (+ = to the right)
    twistL: mk({ trunk: -50, head: -8, arms: GUARD, stance: 24 }),
    twistR: mk({ trunk: 50, head: 8, arms: GUARD, stance: 24 }),
    // shoulder LATERAL rotation wind-up, then MEDIAL rotation throw (right, elbow tucked)
    windup: mk({ armR: [0, 0, 60, 90, 0], armL: HANG }),
    throw: mk({ armR: [0, 0, -40, 90, 0], armL: HANG }),
    // radio-ulnar joint, elbows tucked at 90: palm up / palm down
    palmUp: mk({ arms: [0, 0, 0, 90, 88] }),
    palmDown: mk({ arms: [0, 0, 0, 90, -88] }),
    // hanging arm, elbow straight: palm faces forward / back (seen end-on)
    shieldFront: mk({ armR: [0, 0, 0, 0, 90], armL: HANG }),
    shieldBack: mk({ armR: [0, 0, 0, 0, -90], armL: HANG }),
    palmPulse: mk({ armR: [90, 0, 0, 8, -88], armL: GUARD }),
    // hip rotation pivots on the heels (feet + kneecaps turn)
    pivotIn: mk({ arms: GUARD, hipL: -30, hipR: -35, stance: 24 }),
    pivotOut: mk({ arms: GUARD, hipL: 35, hipR: 40, stance: 24 }),
    // isometric brace: arms out wide holding tethers
    brace: mk({ arms: [90, 75, 0, 12, 0], stance: 30, mus: {
      deltoid_posterior: ['i', 0.9], infraspinatus: ['i', 0.6], latissimus_dorsi: ['i', 0.5],
      obliques: ['i', 0.5], gluteus_maximus: ['i', 0.5], triceps_brachii: ['i', 0.4],
    } }),
    // eccentric: raised arms give way outward under load (pec major lengthens under tension)
    catchLower: mk({ arms: [90, 60, 0, 25, 0], stance: 28, mus: {
      pectoralis_major: ['e', 0.85], deltoid_anterior: ['e', 0.6], biceps_brachii: ['e', 0.3],
    } }),
    // concentric pull-in: elbows driven back and out (horizontal abduction + elbow flexion)
    netRip: mk({ arms: [90, 70, 0, 100, 0], stance: 28, mus: {
      deltoid_posterior: ['c', 1], infraspinatus: ['c', 0.5], latissimus_dorsi: ['c', 0.6], biceps_brachii: ['c', 0.8],
    } }),
    stunned: mk({ trunk: -16, head: -28, slump: 0.35, armL: [0, 0, 25, 40, 30], armR: [0, 0, -30, 55, -40], hipL: 18, hipR: -12, stance: 26 }),
    shutdown: mk({ trunk: -6, head: 12, slump: 1, arms: [0, 0, 0, 6, 0], hip: 18, stance: 21 }),
  };

  // ---------------- threat poses (GAME_DESIGN §4.4c / §4.4e) ----------------
  // THREATS[id] = { stage, success, timeout, wrong: { '<option>': pose }, opts }
  //   stage   = anticipation / freeze pose     success = end pose of the correct answer
  //   wrong   = end pose of each distractor (movement threats) or contraction option
  //   opts    = extra draw options to pass while this threat is on screen
  // Movement end poses carry no `mus` unless the spec names extra agonists, so
  // the muscles that shorten light up concentric automatically.
  const W = (base, o) => withPose(base, o);
  const roll = (base, side, deg) => W(base, { [side]: { rot: deg } });
  const THREATS = {};
  // no muscle lights (externally driven / limp movement)
  const LIMP = {};
  ['pectoralis_major', 'deltoid_anterior', 'deltoid_posterior', 'infraspinatus', 'subscapularis', 'latissimus_dorsi', 'biceps_brachii', 'triceps_brachii'].forEach((m) => { LIMP[m + ':R'] = ['c', 0]; });
  (function () {
    let st;
    // netter on the LEFT ally: raised L arm swings OUT (horizontal abduction)
    st = mk({ armL: [90, 0, 0, 10, 0], armR: TUCK });
    THREATS.netterOnAlly_left = { stage: st, timeout: st,
      success: W(st, { L: { hz: 80 }, mus: { 'deltoid_posterior:L': ['c', 1], 'infraspinatus:L': ['c', 0.75] } }),
      wrong: { 'Horizontal adduction': W(st, { L: { hz: -40 } }), 'Medial rotation': roll(st, 'L', -80), 'Lateral rotation': roll(st, 'L', 80) } };
    // netter on the RIGHT ally: L arm out to the side sweeps ACROSS (horizontal adduction); R hand busy
    st = mk({ armL: [90, 85, 0, 10, 0], armR: [0, 0, 0, 30, 0] });
    THREATS.netterOnAlly_right = { stage: st, timeout: st, opts: { lockHand: 'R' },
      success: W(st, { L: { hz: -35 }, mus: { 'pectoralis_major:L': ['c', 1], 'deltoid_anterior:L': ['c', 0.8] } }),
      wrong: { 'Horizontal abduction': W(st, { L: { hz: 120 } }), Rotation: W(st, { trunk: 60 }), 'Medial rotation': roll(st, 'L', -80), 'Lateral rotation': roll(st, 'L', 80) } };
    // diver front-left: R arm out to the side sweeps across (horizontal adduction)
    st = mk({ armR: [90, 80, 0, 10, 0], armL: HANG });
    THREATS.crossSwat = { stage: st, timeout: st,
      success: W(st, { R: { hz: -30 }, mus: { 'pectoralis_major:R': ['c', 1], 'deltoid_anterior:R': ['c', 0.8] } }),
      wrong: { 'Horizontal abduction': W(st, { R: { hz: 120 } }), Rotation: W(st, { trunk: -60 }), 'Medial rotation': roll(st, 'R', -80), 'Lateral rotation': roll(st, 'R', 80) } };
    // diver from the right: guarding R arm sweeps out (horizontal abduction)
    st = mk({ armR: [90, -20, 0, 20, 0], armL: TUCK });
    THREATS.backhandSwat = { stage: st, timeout: st,
      success: W(st, { R: { hz: 100 }, mus: { 'deltoid_posterior:R': ['c', 1], 'infraspinatus:R': ['c', 0.75] } }),
      wrong: { 'Horizontal adduction': W(st, { R: { hz: -40 } }), Rotation: W(st, { trunk: 60 }), 'Medial rotation': roll(st, 'R', -80), 'Lateral rotation': roll(st, 'R', 80) } };
    // diver behind: trunk rotation (+ the arm sweeps back)
    st = mk({ arms: [90, 0, 0, 15, 0], stance: 24 });
    THREATS.diveBehind = { stage: st, timeout: st,
      success: W(st, { trunk: 50, head: 10, R: { hz: 115 }, mus: { obliques: ['c', 1], 'deltoid_posterior:R': ['c', 0.85] } }),
      wrong: { 'Horizontal abduction': W(st, { R: { hz: 120 } }), 'Lateral rotation': W(st, { L: { rot: 80 }, R: { rot: 80 } }), 'Medial rotation': W(st, { L: { rot: -80 }, R: { rot: -80 } }) } };
    // midge arc: wound right, trunk sweeps left through the arc
    st = mk({ trunk: 50, head: 6, armR: [90, 0, 0, 10, 0], armL: [0, 0, -30, 100, 0], stance: 24 });
    THREATS.spineTwist = { stage: st, timeout: st,
      success: W(st, { trunk: -55, head: -6, mus: { obliques: ['c', 1] } }),
      wrong: { 'Horizontal adduction': W(st, { R: { hz: -40 } }), 'Horizontal abduction': W(st, { R: { hz: 60 } }), 'Lateral rotation': roll(st, 'R', 80) } };
    // lancer behind: hanging arm, palm to thigh -> pronation turns the palm back
    st = mk({ armR: [0, 0, 0, 0, 0], armL: HANG });
    THREATS.palmShield = { stage: st, timeout: st,
      success: W(st, { R: { pr: -90 }, mus: { 'pronator_teres:R': ['c', 1] } }),
      wrong: { Supination: W(st, { R: { pr: 90 } }), 'Lateral rotation': roll(st, 'R', 80), Rotation: W(st, { trunk: -60 }) } };
    // lancer in front: supination turns the palm forward
    THREATS.palmCatch = { stage: st, timeout: st,
      success: W(st, { R: { pr: 90 }, mus: { 'supinator:R': ['c', 1], 'biceps_brachii:R': ['c', 0.8] } }),
      wrong: { Pronation: W(st, { R: { pr: -90 } }), 'Medial rotation': roll(st, 'R', -80) } };
    // disc launcher: elbow tucked, forearm swings OUT to cock (lateral rotation)
    st = mk({ armR: TUCK, armL: HANG });
    THREATS.discWindup = { stage: st, timeout: st, opts: { launcher: 'R' },
      success: W(st, { R: { rot: 60 }, mus: { 'infraspinatus:R': ['c', 1] } }),
      wrong: { 'Medial rotation': W(st, { R: { rot: -75 } }), Pronation: W(st, { R: { pr: -85 } }), Supination: W(st, { R: { pr: 85 } }) } };
    // throw: cocked forearm snaps IN across the body (medial rotation)
    st = mk({ armR: [0, 0, 60, 90, 0], armL: HANG });
    const throwEnd = W(st, { R: { rot: -40 }, mus: { 'subscapularis:R': ['c', 1], 'pectoralis_major:R': ['c', 0.8], 'latissimus_dorsi:R': ['c', 0.7] } });
    THREATS.discThrow = { stage: st, timeout: st, opts: { launcher: 'R' },
      success: throwEnd,
      wrong: { 'Lateral rotation': W(st, { R: { rot: 90 } }), Pronation: W(st, { R: { pr: -85 } }), Supination: W(st, { R: { pr: 85 } }) } };
    // contraction: snap against the launcher spring (concentric subscapularis)
    THREATS.discSnap = { stage: st, opts: { launcher: 'R', neutralStage: true },
      success: throwEnd,
      timeout: W(st, { R: { rot: 88 }, mus: Object.assign({}, LIMP, { 'subscapularis:R': ['e', 0.35] }) }),
      wrong: { Eccentric: W(st, { R: { rot: 88 }, mus: { 'subscapularis:R': ['e', 0.9], 'pectoralis_major:R': ['e', 0.5], 'infraspinatus:R': ['c', 0], 'deltoid_posterior:R': ['c', 0] } }),
        Isometric: W(st, { mus: { 'subscapularis:R': ['i', 0.9], 'pectoralis_major:R': ['i', 0.5] } }) } };
    // contraction: tether yanks the forearm outward, hold it (isometric medial rotators)
    st = mk({ armR: TUCK, armL: HANG, stance: 26 });
    THREATS.tetherPull = { stage: st, opts: { neutralStage: true },
      success: W(st, { mus: { 'subscapularis:R': ['i', 0.95], 'pectoralis_major:R': ['i', 0.7] } }),
      timeout: W(st, { R: { rot: 70 }, mus: LIMP }),
      wrong: { Concentric: W(st, { R: { rot: -70 }, mus: { 'subscapularis:R': ['c', 1], 'pectoralis_major:R': ['c', 0.6] } }),
        Eccentric: W(st, { R: { rot: 70 }, mus: { 'subscapularis:R': ['e', 0.9], 'pectoralis_major:R': ['e', 0.5], 'infraspinatus:R': ['c', 0], 'deltoid_posterior:R': ['c', 0] } }) } };
    // hip pivot: heel pivot, toes swing OUT (hip lateral rotation)
    st = mk({ arms: GUARD, hipR: 0, hipL: 4, stance: 24 });
    THREATS.hipPivot = { stage: st, timeout: st, opts: { feetBold: 'R' },
      success: W(st, { hipR: 40, mus: { 'gluteus_maximus:R': ['c', 1], 'hip_rotators:R': ['c', 0.8] } }),
      wrong: { 'Medial rotation': W(st, { hipR: -35 }), Rotation: W(st, { trunk: 40 }) } };
    // contraction: Ram pushes the raised arm outward; give way under control (eccentric pec)
    st = mk({ armR: [90, 0, 0, 25, 0], armL: GUARD, stance: 28 });
    const ramConc = W(st, { R: { hz: -30 }, mus: { 'pectoralis_major:R': ['c', 1], 'deltoid_anterior:R': ['c', 0.8] } });
    THREATS.heavyCatch = { stage: st, opts: { neutralStage: true },
      success: W(st, { R: { hz: 70 }, mus: { 'pectoralis_major:R': ['e', 0.95], 'deltoid_anterior:R': ['e', 0.7], 'deltoid_posterior:R': ['c', 0], 'infraspinatus:R': ['c', 0] } }),
      timeout: W(st, { armR: [40, 40, 0, 35, 0], mus: LIMP }),
      wrong: { Concentric: ramConc, Isotonic: ramConc,
        Isometric: W(st, { facing: 30, mus: { 'pectoralis_major:R': ['i', 0.95], 'deltoid_anterior:R': ['i', 0.7] } }) } };
  })();
  // threat(id, key): key = 'stage' | 'success' | 'timeout' | option text
  // (the correct option text maps to 'success'). Returns a fresh copy.
  function threat(id, key) {
    const T = THREATS[id];
    if (!T) return mk();
    const p = T[key] || (T.wrong && T.wrong[key]) || ((SEHS.content && SEHS.content.DRONE_THREATS && SEHS.content.DRONE_THREATS[id] && SEHS.content.DRONE_THREATS[id].correct === key) ? T.success : null) || T.stage;
    const o = clone(p); o.mus = p.mus; return o;
  }
  // flat aliases in LIB: '<id>.stage', '<id>.success', '<id>.timeout', '<id>.<option>'
  for (const id in THREATS) {
    const T = THREATS[id];
    LIB[id + '.stage'] = T.stage; LIB[id + '.success'] = T.success; LIB[id + '.timeout'] = T.timeout;
    for (const k in T.wrong) LIB[id + '.' + k] = T.wrong[k];
  }

  // ---------------- small vector helpers ----------------
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const lin = (a, ka, b, kb) => [a[0] * ka + b[0] * kb, a[1] * ka + b[1] * kb, a[2] * ka + b[2] * kb];
  const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  // rotate about z (counter-clockwise seen from above; x right, y forward)
  const rotZ = (v, ang) => { const c = Math.cos(ang), s = Math.sin(ang); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]]; };
  // Rodrigues rotation of v about unit axis k
  const rotAx = (v, k, ang) => {
    const c = Math.cos(ang), s = Math.sin(ang), kv = cross(k, v), d = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];
    return [v[0] * c + kv[0] * s + k[0] * d * (1 - c), v[1] * c + kv[1] * s + k[1] * d * (1 - c), v[2] * c + kv[2] * s + k[2] * d * (1 - c)];
  };
  // axis that lifts horizontal direction h toward the camera (+z)
  const liftAxis = (h) => { const hh = [h[0], h[1], 0]; const l = Math.hypot(hh[0], hh[1]); return l < 0.15 ? null : norm(cross(hh, [0, 0, 1])); };

  // ---------------- 3D skeleton ----------------
  // Returns everything in the PELVIS frame (3D) + a projector to screen.
  // mal = { part, t } plane-error malfunction: the limb lifts out of the
  // transverse plane toward the camera (foreshortened).
  function solve(p, x, y, sc, mal) {
    sc = sc || 1;
    const tr = (p.trunk || 0) * D2R;
    const sl = p.slump || 0;
    const T = (v) => rotZ(v, -tr); // thorax frame -> pelvis frame (trunk + = clockwise / right)
    const fa = (p.facing || 0) * D2R; // clockwise on screen
    const Rv = [Math.cos(fa), Math.sin(fa)], Fv = [Math.sin(fa), -Math.cos(fa)];
    const proj = (P) => {
      const k = sc * (1 + P[2] * PERSP);
      return [x + (P[0] * Rv[0] + P[1] * Fv[0]) * k, y + (P[0] * Rv[1] + P[1] * Fv[1]) * k];
    };
    // screen direction of a pelvis-frame horizontal vector
    const projDir = (v) => [v[0] * Rv[0] + v[1] * Fv[0], v[0] * Rv[1] + v[1] * Fv[1]];
    const malPart = mal && mal.t > 0 ? String(mal.part || '') : '';
    const malT = malPart ? Math.min(1, mal.t) : 0;
    const R = { p, sc, tr, fa, T, proj, projDir, x, y, L: {}, R: {}, malPart, malT };
    for (const s of SIDES) {
      const g = SGN[s];
      const A = R[s];
      const P = p[s] || BASE[s];
      A.g = g;
      // ----- arm -----
      const e = P.fl * D2R, h = P.hz * D2R, r = P.rot * D2R;
      const el = P.el * D2R, fo = P.pr * D2R;
      // thorax-frame vectors: d = humerus, a = anterior surface, b = lateral
      let d = [0, Math.sin(e), -Math.cos(e)];
      let a = [0, Math.cos(e), Math.sin(e)];
      d = rotZ(d, -g * h); a = rotZ(a, -g * h);
      const b = mul(cross(d, a), g);
      const a2 = lin(a, Math.cos(r), b, Math.sin(r));
      const b2 = mul(cross(d, a2), g);
      let u = lin(d, Math.cos(el), a2, Math.sin(el));
      const nSup = lin(a2, Math.cos(el), d, -Math.sin(el));
      let n = lin(nSup, Math.sin(fo), b2, -Math.cos(fo)); // palm normal
      let th = lin(b2, Math.sin(fo), nSup, Math.cos(fo)); // thumb direction
      // shoulder: protracts a little in horizontal adduction and in a slump
      const prot = Math.max(0, -P.hz) * 0.05 + sl * 5;
      const shT = [g * (DIM.shX - prot * 0.4 - sl * 3), prot, -sl * 4];
      A.sh = T(shT);
      let D = T(d), Aa = T(a2), Bb = T(b2), U = T(u), N = T(n), TH = T(th);
      // plane-error malfunction: whole arm (armX) or hand/forearm (forearmX, handX) lifts
      if (malT && (malPart === 'arm' + s || malPart === 'upper' + s)) {
        const reach = add(mul(D, DIM.upper), mul(U, DIM.fore));
        const ax = liftAxis(reach) || liftAxis(T([g, 0.6, 0]));
        const ang = malT * 70 * D2R;
        [D, Aa, Bb, U, N, TH] = [D, Aa, Bb, U, N, TH].map((v) => rotAx(v, ax, ang));
      } else if (malT && (malPart === 'forearm' + s || malPart === 'hand' + s || malPart === 'fore' + s)) {
        const ax = liftAxis(Math.abs(U[2]) > 0.8 ? N : U) || liftAxis(T([0, 1, 0]));
        const ang = malT * 75 * D2R;
        [U, N, TH] = [U, N, TH].map((v) => rotAx(v, ax, ang));
      }
      A.d = D; A.a = Aa; A.b = Bb; A.u = U; A.n = N; A.th = TH;
      A.el = add(A.sh, mul(A.d, DIM.upper));
      A.wr = add(A.el, mul(A.u, DIM.fore));
      A.hand = add(A.wr, mul(A.u, DIM.hand * 0.55));
      // A hand hanging straight down is hidden under the shoulder from above,
      // so it is drawn as a call-out just outside the shoulder (as in the
      // tutorial's palm view) with a dashed leader. A.handVis = drawn centre.
      A.endOn = Math.abs(A.u[2]) > 0.8 && Math.abs(A.n[2]) < 0.5;
      A.handVis = A.endOn ? add(A.sh, add(T([g * 24, 0, 0]), [0, 0, -6])) : A.hand;
      A.clav = T([g * 5, 11 + sl * 3, -3 - sl * 3]); // sternoclavicular end
      A.scap = T([g * 16, -11 + sl * 2, -8]);
      // ----- leg: heel pivot, the toes swing with hip rotation -----
      const hip = p['hip' + s] != null ? p['hip' + s] : 0;
      const hr = (8 + hip) * D2R; // 8 deg natural toe-out
      const fd = [g * Math.sin(hr), Math.cos(hr), 0];
      A.fd = fd;
      A.hip = [g * DIM.hipX, 1, DIM.pelZ - 4];
      const st = p.stance != null ? p.stance : 21;
      A.heel = [g * st, 4, DIM.ankleZ];
      A.ankle = add(A.heel, mul(fd, DIM.heel));
      A.toe = add(A.ankle, mul(fd, DIM.foot));
      A.knee = [g * (DIM.hipX + st) * 0.5 + fd[0] * 14, 2 + fd[1] * 14, DIM.kneeZ];
      if (malT && (malPart === 'leg' + s)) {
        // leg lifts out of the plane (hip flexion / abduction): foot rises toward the camera
        const lift = malT;
        const sh = [g * 10 * lift, 10 * lift, 70 * lift];
        A.knee = add(A.knee, mul(sh, 0.6)); A.ankle = add(A.ankle, sh); A.heel = add(A.heel, sh); A.toe = add(A.toe, add(sh, [0, 0, 10 * lift]));
      }
      // greater trochanter swings with hip rotation (back = lateral rotation)
      const ga = hip * D2R;
      A.troch = [g * (DIM.hipX + 5.5 * Math.cos(ga)), 1 - 5.5 * Math.sin(ga), DIM.pelZ - 6];
    }
    R.head = { c: T([0, DIM.headY + sl * 10, DIM.headZ - sl * 10]), ang: tr + (p.head || 0) * D2R, r: DIM.headR };
    R.neck = T([0, -1 + sl * 4, 4]);
    R.core = T([0, -9.5, 0]);
    R.sternum = T([0, 12, -6]);
    return R;
  }

  // ---------------- muscles ----------------
  // k: length change per radian of each joint param (moment-arm model);
  //    'trunkS' = trunk * side sign. Negative k = that param shortens it.
  // pts(A, R): 3D attachment points (origin -> [via] -> insertion).
  // grp: damage group, layer: draw order bucket, deep: drawn faint.
  const MUSCLES = [
    { id: 'gluteus_maximus', grp: 'legs', layer: 'ghost', ghost: true, w: 8, belly: [0.05, 0.9], k: { hip: -0.14 },
      pts: (A) => [[A.g * 5, -DIM.pelD - 1, DIM.pelZ + 4], add(A.troch, [0, -3, 0])] },
    { id: 'hip_rotators', grp: 'legs', layer: 'ghost', ghost: true, w: 5, belly: [0.1, 0.9], k: { hip: -0.32 },
      pts: (A) => [[A.g * 3, -8, DIM.pelZ - 4], A.troch] },
    { id: 'gluteus_medius', grp: 'legs', layer: 'ghost', ghost: true, w: 6, belly: [0.05, 0.85], k: { hip: 0.2 },
      pts: (A) => [[A.g * (DIM.pelW - 2), 4, DIM.pelZ + 8], add(A.troch, [A.g * 1, 3, 0])] },
    { id: 'latissimus_dorsi', grp: 'torso', layer: 'back', w: 7, belly: [0.0, 0.82], k: { fl: 0.28, rot: 0.08 },
      pts: (A, R) => [R.T([A.g * 8, -DIM.ribD + 2, -30]), add(add(A.sh, mul(A.d, 6)), mul(A.a, 1))] },
    { id: 'obliques', grp: 'torso', layer: 'ghost', ghost: true, w: 7, belly: [0.05, 0.85], k: { trunkS: 0.3 },
      pts: (A, R) => [R.T([A.g * (DIM.ribW - 1), 3, -22]), [A.g * 7, DIM.pelD + 1, DIM.pelZ + 8]] },
    { id: 'subscapularis', grp: 'torso', layer: 'ghost', ghost: true, w: 5.5, belly: [0.05, 0.8], k: { rot: 0.32, hz: 0.03 },
      pts: (A) => [add(A.scap, [0, 4, 0]), add(A.sh, mul(A.a, 4.5))] },
    { id: 'infraspinatus', grp: 'torso', layer: 'scap', w: 6.5, belly: [0.0, 0.78], k: { rot: -0.32, hz: -0.04 },
      pts: (A) => [add(A.scap, [0, -2, 1]), add(A.sh, mul(A.a, -5))] },
    { id: 'pectoralis_major', grp: 'torso', layer: 'chest', w: 10, belly: [0.0, 0.84], k: { hz: 0.32, rot: 0.1 },
      pts: (A, R) => [add(R.sternum, R.T([A.g * 4, 2, 2])), add(add(A.sh, mul(A.d, 7)), mul(A.a, 3))] },
    { id: 'deltoid_anterior', grp: 'arm', layer: 'delt', w: 6.5, belly: [0.0, 0.92], k: { hz: 0.22, rot: 0.04, fl: -0.18 },
      pts: (A) => [add(A.clav, sub(A.sh, A.clav).map((v) => v * 0.72)), add(add(A.sh, mul(A.d, 13)), mul(A.a, 3.5))] },
    { id: 'deltoid_posterior', grp: 'arm', layer: 'delt', w: 6.5, belly: [0.0, 0.92], k: { hz: -0.3, rot: -0.05, fl: 0.12 },
      pts: (A) => [add(A.scap, add(mul(sub(A.sh, A.scap), 0.62), [0, 0, 6])), add(add(A.sh, mul(A.d, 13)), mul(A.a, -3.5))] },
    { id: 'biceps_brachii', grp: 'arm', layer: 'upper', w: 6, belly: [0.18, 0.88], k: { el: -0.38, pr: -0.12, fl: -0.04 },
      pts: (A) => [add(A.sh, mul(A.a, 3)), add(add(A.sh, mul(A.d, DIM.upper * 0.9)), mul(A.a, 4.5)), add(add(A.el, mul(A.u, 4)), mul(A.n, 1.5))] },
    { id: 'triceps_brachii', grp: 'arm', layer: 'upper', w: 6.5, belly: [0.12, 0.86], k: { el: 0.38, fl: 0.06 },
      pts: (A) => [add(A.sh, mul(A.a, -3)), add(add(A.sh, mul(A.d, DIM.upper * 0.92)), mul(A.a, -4.5)), add(A.el, add(mul(A.u, -2.5), mul(A.a, -1.5)))] },
    { id: 'pronator_teres', grp: 'arm', layer: 'fore', w: 4.5, belly: [0.08, 0.85], k: { pr: 0.3, el: -0.05 },
      pts: (A) => [add(A.el, add(mul(A.b, -4), mul(A.a, 1.5))), add(add(A.el, mul(A.u, DIM.fore * 0.5)), add(mul(A.th, 3), mul(A.n, 1)))] },
    { id: 'supinator', grp: 'arm', layer: 'fore', w: 4.5, belly: [0.08, 0.85], k: { pr: -0.3 },
      pts: (A) => [add(A.el, add(mul(A.b, 4), mul(A.a, -1))), add(add(A.el, mul(A.u, DIM.fore * 0.32)), add(mul(A.th, 3), mul(A.n, -2)))] },
  ];
  const MUS_BY_ID = {};
  MUSCLES.forEach((m) => { MUS_BY_ID[m.id] = m; });

  function lenRatio(m, p, s) {
    let L = 1;
    const g = SGN[s];
    for (const key in m.k) {
      let v;
      if (key === 'trunkS') v = g * (get(p, 'trunk') - BASE.trunk);
      else if (key === 'hip') v = get(p, 'hip' + s) - BASE['hip' + s];
      else v = get(p, s + '.' + key) - BASE[s][key];
      L += m.k[key] * v * D2R;
    }
    return Math.max(0.45, L);
  }

  // ---------------- colours (shared with android.js) ----------------
  function hex(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mixHex(a, b, t) {
    const A = hex(a), B = hex(b);
    const h = (v) => Math.round(v).toString(16).padStart(2, '0');
    return '#' + h(A[0] + (B[0] - A[0]) * t) + h(A[1] + (B[1] - A[1]) * t) + h(A[2] + (B[2] - A[2]) * t);
  }
  const MODE_COLOR = { c: '#ff6a3d', e: '#4ea8ff', i: '#ffc53d' };
  const MUSCLE_BASE = '#9b2d38';
  const CHAR = '#2a1a12';
  let CHR = 0; // charring of the part being drawn
  const col = (h) => (CHR ? mixHex(h, CHAR, 0.72 * CHR) : h);

  // damage parts (GAME_DESIGN §4.3); 'legs' is accepted as both legs
  const DMG_PARTS = ['head', 'armL', 'armR', 'torso', 'legL', 'legR'];
  function dmgOne(d, part) {
    if (Array.isArray(d)) return d.indexOf(part) >= 0 ? 1 : 0;
    if (typeof d.has === 'function') return d.has(part) ? 1 : 0;
    const v = d[part];
    return v === true ? 1 : v > 0 ? Math.min(1, v) : 0;
  }
  function dmgOf(d, part) {
    if (!d) return 0;
    const v = dmgOne(d, part);
    return part.slice(0, 3) === 'leg' ? Math.max(v, dmgOne(d, 'legs')) : v;
  }
  function hash1(i) { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

  // ---------------- static helpers ----------------
  function handPos(p, x, y, side, scale) {
    const R = solve(p, x || 0, y || 0, scale || 1);
    return R.proj(R[side === 'L' ? 'L' : 'R'].handVis);
  }
  // part: 'head' | 'torso' (= 'chest') | 'pelvis' | 'core'
  //       'armX' (= hand) 'handX' 'wristX' 'elbowX' 'shoulderX' 'upperX' 'foreX'
  //       'hipX' 'kneeX' 'footX' 'heelX' 'toeX' 'legX' (= knee) 'legs' (between knees)
  //       'trunk' (spine centre)   X = L | R
  function partPoint(p, x, y, part, scale) {
    const R = solve(p, x || 0, y || 0, scale || 1);
    part = String(part || 'torso');
    const side = /[a-z]L$/.test(part) ? 'L' : 'R';
    const A = R[side];
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    switch (part.replace(/([a-z])[LR]$/, '$1')) {
      case 'head': return R.proj(R.head.c);
      case 'core': return R.proj(R.core);
      case 'torso': case 'chest': return R.proj(R.T([0, 4, -8]));
      case 'trunk': case 'spine': return R.proj(R.T([0, 0, -10]));
      case 'pelvis': return R.proj([0, 0, DIM.pelZ]);
      case 'legs': return R.proj(mid(R.L.knee, R.R.knee));
      case 'arm': case 'hand': return R.proj(A.handVis);
      case 'wrist': return R.proj(A.wr);
      case 'fore': case 'forearm': return R.proj(mid(A.el, A.wr));
      case 'elbow': return R.proj(A.el);
      case 'upper': return R.proj(mid(A.sh, A.el));
      case 'shoulder': case 'sh': return R.proj(A.sh);
      case 'hip': return R.proj(A.hip);
      case 'knee': case 'leg': return R.proj(A.knee);
      case 'foot': return R.proj(mid(A.ankle, A.toe));
      case 'heel': return R.proj(A.heel);
      case 'toe': return R.proj(A.toe);
      default: return R.proj(R.T([0, 4, -8]));
    }
  }

  // ---------------- AndroidTop class ----------------
  class AndroidTop {
    constructor() {
      this.state = {};
      const p0 = mk();
      for (const m of MUSCLES) for (const s of SIDES) this.state[m.id + s] = { len: lenRatio(m, p0, s), disp: 0, q: 0, mode: 'c', auto: 0 };
      this.time = 0;
    }

    reset() { for (const k in this.state) { this.state[k].disp = 0; this.state[k].q = 0; } }

    update(p, dt) {
      this.time += dt;
      for (const m of MUSCLES) {
        for (const s of SIDES) {
          const st = this.state[m.id + s];
          const L = lenRatio(m, p, s);
          const rate = dt > 0.0001 ? (L - st.len) / dt : 0;
          st.len = L;
          st.auto = rate < -0.05 ? Math.min(1, -rate * 0.9) : 0;
        }
      }
      for (const m of MUSCLES) {
        for (const s of SIDES) {
          const st = this.state[m.id + s];
          let target = 0, mode = st.mode;
          const ov = p.mus && (p.mus[m.id + ':' + s] || p.mus[m.id]);
          if (ov) { mode = ov[0]; target = ov[1]; }
          else {
            target = st.auto;
            // trunk rotation: the external oblique of one side works with the
            // internal oblique of the other, so both sides fire together
            if (m.id === 'obliques') target = Math.max(target, this.state['obliques' + (s === 'L' ? 'R' : 'L')].auto);
            if (target > 0) mode = 'c';
          }
          if (target > 0.02) st.mode = mode;
          st.disp += (target - st.disp) * Math.min(1, dt * 9);
          st.q = Math.round(st.disp * 8) / 8;
        }
      }
    }

    // Muscles sorted by activation (max of both sides) for the HUD monitor
    activeList(min) {
      const out = [];
      for (const m of MUSCLES) {
        const a = this.state[m.id + 'L'], b = this.state[m.id + 'R'];
        const st = b.q >= a.q ? b : a;
        if (st.q >= (min || 0.25)) out.push({ id: m.id, q: st.q, mode: st.mode, side: st === b ? 'R' : 'L', both: Math.min(a.q, b.q) >= (min || 0.25) });
      }
      return out.sort((x, y) => y.q - x.q);
    }

    partPoint(p, x, y, part, scale) { return partPoint(p, x, y, part, scale); }

    draw(ctx, p, x, y, o) {
      o = o || {};
      const sc = o.scale || 1;
      const R = solve(p, x, y, sc, o.malfunction);
      R.sparks = [];
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      const part = (name, fn, fx) => {
        const d = dmgOf(o.damage, name);
        const wrap = () => this.malWrap(ctx, R, name, o, fn);
        if (!d) { wrap(); return; }
        this.drawDamaged(ctx, R, name, d, o, wrap, fx !== false);
      };
      this.drawShadow(ctx, R);
      for (const s of SIDES) part('leg' + s, () => this.drawFoot(ctx, R, s, o), false);
      this.drawPelvis(ctx, R, o);
      for (const s of SIDES) part('leg' + s, () => this.drawThigh(ctx, R, s, o));
      const trunkMal = R.malPart === 'trunk' || R.malPart === 'torso';
      const upper = () => {
        part('torso', () => this.drawTrunk(ctx, R, o));
        // arms: lower arm first
        const order = SIDES.slice().sort((s1, s2) => (R[s1].hand[2] + R[s1].el[2]) - (R[s2].hand[2] + R[s2].el[2]));
        for (const s of order) part('arm' + s, () => this.drawArm(ctx, R, s, o));
        part('head', () => this.drawHead(ctx, R, o));
      };
      if (trunkMal) this.malWrap(ctx, R, 'trunk', o, upper); else upper();
      if (o.highlight) this.drawHighlights(ctx, R, o.highlight);
      if (o.labels) this.drawLabels(ctx, R, o);
      ctx.restore();
      return R;
    }

    // ---------- plane-error malfunction (GAME_DESIGN §4.2a / §4.4e) ----------
    // opts.malfunction = { part, t }  part: 'armL'|'armR'|'forearmL'|'forearmR'|
    // 'handL'|'handR'|'legL'|'legR'|'trunk'; t = 0..1 progress. The limb is
    // lifted out of the screen plane in solve() (foreshortened); here it is
    // also scaled up toward the camera about its root joint, jitters, and
    // throws servo sparks (pushed to rig.sparks).
    malWrap(ctx, R, name, o, fn) {
      const mp = R.malPart, t = R.malT;
      const hit = t && (mp === name || (name === 'trunk' && (mp === 'torso')) ||
        (name.slice(0, 3) === 'arm' && (mp === 'forearm' + name.slice(-1) || mp === 'hand' + name.slice(-1) || mp === 'fore' + name.slice(-1))));
      if (!hit) { fn(); return; }
      const s = name.slice(-1);
      const fore = mp.slice(0, 4) === 'fore' || mp.slice(0, 4) === 'hand';
      let piv, tip;
      if (name === 'trunk') { piv = R.proj([0, 0, DIM.pelZ]); tip = R.proj(R.head.c); }
      else if (name.slice(0, 3) === 'leg') { piv = R.proj(R[s].hip); tip = R.proj(R[s].toe); }
      else if (fore) { piv = R.proj(R[s].el); tip = R.proj(R[s].hand); }
      else { piv = R.proj(R[s].sh); tip = R.proj(R[s].hand); }
      const red = !!o.reduce, tm = this.time;
      const boost = 1 + (name === 'trunk' ? 0.22 : 0.45) * t;
      const fr = Math.floor(tm * 30);
      const amp = (red ? 0.5 : 2.6) * t * R.sc;
      const jx = (hash1(fr + 1.3) - 0.5) * 2 * amp, jy = (hash1(fr + 2.9) - 0.5) * 2 * amp;
      ctx.save();
      ctx.translate(piv[0] + jx, piv[1] + jy);
      ctx.scale(boost, boost);
      ctx.translate(-piv[0], -piv[1]);
      fn();
      ctx.restore();
      // servo sparks at the root joint and the lifted tip
      const sf = Math.floor(tm * (red ? 5 : 16));
      if (hash1(sf + 7.7) < (red ? 0.35 : 0.8) * t) {
        const base = hash1(sf * 1.3) < 0.5 ? piv : [piv[0] + (tip[0] - piv[0]) * boost, piv[1] + (tip[1] - piv[1]) * boost];
        const q = [base[0] + jx, base[1] + jy];
        R.sparks.push(q);
        this.sparkBurst(ctx, q, sf, red, R.sc);
      }
    }

    sparkBurst(ctx, q, sf, red, sc) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = 1.4;
      ctx.beginPath();
      const n = red ? 3 : 6;
      for (let i = 0; i < n; i++) {
        const a = hash1(sf + i * 9.1) * TAU, L = (4 + 8 * hash1(sf + i * 3.3)) * sc * 1.4;
        ctx.moveTo(q[0], q[1]); ctx.lineTo(q[0] + Math.cos(a) * L, q[1] + Math.sin(a) * L);
      }
      ctx.stroke();
      ctx.fillStyle = '#fff6d8';
      ctx.beginPath(); ctx.arc(q[0], q[1], 2 * sc, 0, TAU); ctx.fill();
      ctx.restore();
    }

    // ---------- damage (mirrors android.js: char, twitch, embers, sparks) ----------
    drawDamaged(ctx, R, name, d, o, fn, fx) {
      const k = DMG_PARTS.indexOf(name) + 1;
      const t = this.time, red = !!o.reduce, sc = R.sc;
      const burst = hash1(Math.floor(t * 5) + k * 13.7) > (red ? 0.9 : 0.6);
      const fr = Math.floor(t * 30) + k * 7.3;
      const amp = (red ? 0.4 : burst ? 3.2 : 0.8) * d * sc;
      const jx = (hash1(fr) - 0.5) * 2 * amp, jy = (hash1(fr + 0.5) - 0.5) * 2 * amp;
      ctx.save();
      ctx.translate(jx, jy);
      if (burst && !red) ctx.globalAlpha *= 0.75 + 0.25 * hash1(fr + 3.1);
      CHR = d; fn(); CHR = 0;
      if (fx === false) { ctx.restore(); return; }
      const pts = this.damagePts(R, name);
      for (let i = 0; i < pts.length; i++) {
        const q = pts[i];
        const rad = (6 + 4 * hash1(k * 5 + i)) * sc * (0.6 + 0.4 * d);
        const gr = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], rad);
        gr.addColorStop(0, `rgba(12,6,3,${(0.55 * d).toFixed(2)})`);
        gr.addColorStop(1, 'rgba(12,6,3,0)');
        ctx.fillStyle = gr;
        ctx.beginPath(); ctx.arc(q[0], q[1], rad, 0, TAU); ctx.fill();
        const ember = red ? 0.6 : 0.45 + 0.55 * hash1(Math.floor(t * 12) + k * 3 + i);
        ctx.fillStyle = `rgba(255,${110 + Math.round(60 * ember)},40,${(0.75 * d * ember).toFixed(2)})`;
        ctx.beginPath(); ctx.arc(q[0] + rad * 0.2, q[1] - rad * 0.15, 1.4 * sc, 0, TAU); ctx.fill();
      }
      ctx.restore();
      const sf = Math.floor(t * (red ? 4 : 14));
      if (hash1(sf + k * 31) < (red ? 0.25 : 0.55) * d) {
        const p0 = pts[Math.floor(hash1(sf * 1.7 + k) * pts.length)];
        const q = [p0[0] + jx, p0[1] + jy];
        R.sparks.push(q);
        this.sparkBurst(ctx, q, sf + k, red, sc);
      }
    }

    damagePts(R, name) {
      const P = R.proj;
      if (name === 'head') return [P(add(R.head.c, [-4, 3, 0])), P(add(R.head.c, [3, -4, 0]))];
      if (name === 'torso') return [P(R.T([-12, 6, -8])), P(R.T([10, -6, -8])), P(R.T([2, 10, -20]))];
      if (name === 'legL' || name === 'legR') { const A = R[name.slice(-1)]; return [P(A.knee), P(A.ankle), P(A.toe)]; }
      const A = R[name.slice(-1)];
      return [P(A.sh), P(A.el), P(A.wr), P(A.hand)];
    }

    // ---------- primitives ----------
    bone(ctx, a, b, w) {
      ctx.strokeStyle = col('#1a2028'); ctx.lineWidth = w + 3;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      ctx.strokeStyle = col('#aab5c0'); ctx.lineWidth = w; ctx.stroke();
      ctx.strokeStyle = col('#e3e9ef'); ctx.lineWidth = Math.max(1, w * 0.25); ctx.stroke();
    }
    joint(ctx, c, rad) {
      ctx.fillStyle = col('#4c5763');
      ctx.beginPath(); ctx.arc(c[0], c[1], rad, 0, TAU); ctx.fill();
      ctx.strokeStyle = col('#c7d0d9'); ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = col('#1b222b');
      ctx.beginPath(); ctx.arc(c[0], c[1], rad * 0.4, 0, TAU); ctx.fill();
    }
    poly(ctx, pts, fill, stroke, lw) {
      ctx.beginPath();
      pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
      ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); }
    }
    // ellipse in a horizontal frame: centre c (3D), half-axes along unit dirs
    hEllipse(R, c, rx, ry, rot, n) {
      const out = [];
      n = n || 28;
      for (let i = 0; i < n; i++) {
        const t = (i / n) * TAU;
        out.push(R.proj(add(c, rotZ([Math.cos(t) * rx, Math.sin(t) * ry, 0], rot))));
      }
      return out;
    }

    drawShadow(ctx, R) {
      const c = R.proj([0, 4, DIM.ankleZ]);
      const r = 48 * R.sc;
      const g = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], r);
      g.addColorStop(0, 'rgba(0,0,0,0.42)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(c[0], c[1], r, 0, TAU); ctx.fill();
    }

    // ---------- legs + pelvis ----------
    drawFoot(ctx, R, s, o) {
      const P = R.proj, sc = R.sc;
      const A = R[s];
      const bold = o.feetBold === true || o.feetBold === s;
      // foot plate: boot wedge pointing where the foot points (heel = pivot)
      const side = [A.fd[1], -A.fd[0], 0]; // horizontal perpendicular (points to the foot's left)
      const hw = 5.2;
      const pts = [
        add(A.heel, mul(side, hw * 0.75)), add(A.ankle, mul(side, hw)), add(add(A.toe, mul(A.fd, -6)), mul(side, hw * 1.05)),
        add(add(A.toe, mul(A.fd, -1.5)), mul(side, hw * 0.6)), A.toe, add(add(A.toe, mul(A.fd, -1.5)), mul(side, -hw * 0.6)),
        add(add(A.toe, mul(A.fd, -6)), mul(side, -hw * 1.05)), add(A.ankle, mul(side, -hw)), add(A.heel, mul(side, -hw * 0.75)),
      ].map(P);
      this.poly(ctx, pts, col('#56606b'), bold ? '#dfe6ee' : col('#11161c'), bold ? 2.6 : 2);
      // toe cap (bright) so the foot direction reads at a glance
      const tc = [add(add(A.toe, mul(A.fd, -6)), mul(side, hw * 0.95)), add(add(A.toe, mul(A.fd, -1.5)), mul(side, hw * 0.55)), A.toe,
        add(add(A.toe, mul(A.fd, -1.5)), mul(side, -hw * 0.55)), add(add(A.toe, mul(A.fd, -6)), mul(side, -hw * 0.95))].map(P);
      this.poly(ctx, tc, col('#aab5c0'), col('#11161c'), 1.2);
      if (bold) {
        // blade on the OUTER edge of the forefoot + heel pivot ring
        const out = mul(side, -A.g); // lateral side of this foot
        const b0 = P(add(add(A.ankle, mul(A.fd, 9)), mul(out, hw * 1.15))), b1 = P(add(add(A.toe, mul(A.fd, -3)), mul(out, hw * 1.0)));
        ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = 2.6 * sc;
        ctx.beginPath(); ctx.moveTo(b0[0], b0[1]); ctx.lineTo(b1[0], b1[1]); ctx.stroke();
        const hp = P(A.heel);
        ctx.strokeStyle = 'rgba(191,244,255,0.9)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(hp[0], hp[1], 3.5 * sc, 0, TAU); ctx.stroke();
      }
      this.bone(ctx, P(A.knee), P(A.ankle), 4.2 * sc);
      this.joint(ctx, P(A.ankle), 3 * sc);
    }

    drawPelvis(ctx, R) {
      const P = R.proj, sc = R.sc;
      const pel = this.hEllipse(R, [0, 0, DIM.pelZ], DIM.pelW, DIM.pelD, 0, 24);
      this.poly(ctx, pel, '#4f5964', '#161b22', 2.2);
      const f0 = P([0, DIM.pelD - 4, DIM.pelZ]), f1 = P([0, DIM.pelD + 3, DIM.pelZ]);
      ctx.strokeStyle = '#8d98a3'; ctx.lineWidth = 2.2 * sc;
      ctx.beginPath(); ctx.moveTo(f0[0], f0[1]); ctx.lineTo(f1[0], f1[1]); ctx.stroke();
    }

    drawThigh(ctx, R, s) {
      const P = R.proj, sc = R.sc;
      const A = R[s];
      this.bone(ctx, P(A.hip), P(A.knee), 5.5 * sc);
      this.joint(ctx, P(A.hip), 4 * sc);
      // kneecap on the FRONT of the knee: faces where the knee points
      const kc = P(A.knee);
      this.joint(ctx, kc, 4 * sc);
      const pat = P(add(A.knee, mul(A.fd, 4.5)));
      ctx.fillStyle = col('#aab5c0'); ctx.strokeStyle = col('#1a2028'); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(pat[0], pat[1], 2.4 * sc, 0, TAU); ctx.fill(); ctx.stroke();
    }

    drawTrunk(ctx, R, o) {
      const P = R.proj, sc = R.sc, T = R.T;
      const sl = R.p.slump || 0;
      // shoulder yoke / thorax armour seen from above (opaque)
      const half = [[0, 13], [10, 12.5], [20, 10.5], [28, 7.5], [34, 3.5], [38, 0], [35, -4.5], [28, -8.5], [18, -13], [8, -14.5], [0, -14.5]];
      const ring = half.concat(half.slice(1, -1).reverse().map((q) => [-q[0], q[1]])).map((q) => P(T([q[0] * (1 - sl * 0.06), q[1] + sl * 2, -2])));
      const g0 = P(T([0, 4, 0])), g1 = P(T([0, -15, 0]));
      const gr = ctx.createLinearGradient(g0[0], g0[1], g1[0], g1[1]);
      gr.addColorStop(0, col('#5a6571')); gr.addColorStop(1, col('#363f49'));
      this.poly(ctx, ring, gr, col('#11161c'), 2.4);
      // ribs: arcs across the front of the chest
      ctx.strokeStyle = col('#8a96a2'); ctx.lineWidth = 1.2 * sc;
      for (let i = 0; i < 3; i++) {
        const yy = 4 + i * 3, xx = 20 - i * 3.5;
        ctx.beginPath();
        for (let j = 0; j <= 10; j++) {
          const t = -1 + 2 * j / 10;
          const q = P(T([t * xx, yy + (1 - t * t) * 3.5, -2]));
          j ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]);
        }
        ctx.stroke();
      }
      this.drawLayer(ctx, R, o, 'back');
      // spine: vertebrae down the back midline
      for (let i = 0; i < 4; i++) {
        const c = P(T([0, -4.5 - i * 3.6, 0]));
        ctx.fillStyle = col('#8d98a3');
        ctx.beginPath(); ctx.arc(c[0], c[1], 2.2 * sc, 0, TAU); ctx.fill();
        ctx.strokeStyle = col('#1b222b'); ctx.lineWidth = 1.1; ctx.stroke();
      }
      // scapulae (shoulder blades) on the upper back + rotator cuff
      for (const s of SIDES) {
        const A = R[s], g = A.g;
        const off = sub(A.scap, T([g * 16, -11, -8]));
        const sp = [T([g * 7, -13, 0]), T([g * 26, -8, 0]), T([g * 14, -5, 0])];
        this.poly(ctx, sp.map((v) => P(add(v, off))), col('#6a7581'), col('#1b222b'), 1.5);
      }
      this.drawLayer(ctx, R, o, 'scap');
      // power core (status light) on the upper back
      this.drawCore(ctx, P(R.core), o.status || 'ok', sc, o);
      // clavicles
      for (const s of SIDES) this.bone(ctx, P(R[s].clav), P(R[s].sh), 3.2 * sc);
      this.drawLayer(ctx, R, o, 'chest');
      // hidden (deep) muscles: x-ray ghosts that brighten when they work
      this.drawLayer(ctx, R, o, 'ghost');
      // neck
      const n = P(R.neck);
      ctx.fillStyle = col('#7f8a95');
      ctx.beginPath(); ctx.arc(n[0], n[1], 5 * sc, 0, TAU); ctx.fill();
      ctx.strokeStyle = col('#1b222b'); ctx.lineWidth = 1.4; ctx.stroke();
    }

    drawCore(ctx, c, status, sc, o) {
      const pulse = 0.6 + 0.4 * Math.sin(this.time * (status === 'ok' ? 4 : 18));
      const cc = status === 'ok' ? '#56e0ff' : status === 'warn' ? '#ffb020' : '#ff3040';
      ctx.save();
      if (!o.reduce) { ctx.shadowColor = cc; ctx.shadowBlur = 12 * pulse; }
      ctx.fillStyle = cc;
      ctx.globalAlpha = (0.5 + 0.5 * pulse) * (CHR ? 0.6 : 1);
      ctx.beginPath(); ctx.arc(c[0], c[1], 3.6 * sc, 0, TAU); ctx.fill();
      ctx.restore();
    }

    // ---------- arm ----------
    drawArm(ctx, R, s, o) {
      const A = R[s], P = R.proj, sc = R.sc;
      const sh = P(A.sh), el = P(A.el), wr = P(A.wr);
      const foreUp = (A.wr[2] + A.el[2]) / 2 > (A.sh[2] + A.el[2]) / 2 + 3;
      const upper = () => {
        this.bone(ctx, sh, el, 5 * sc);
        this.drawLayer(ctx, R, o, 'upper', null, s);
        this.joint(ctx, el, 3.6 * sc);
      };
      const fore = () => {
        this.bone(ctx, el, wr, 4.2 * sc);
        this.drawLayer(ctx, R, o, 'fore', null, s);
        this.drawHand(ctx, R, A, o);
      };
      if (foreUp) { upper(); fore(); } else { fore(); upper(); }
      // shoulder cap: joint + deltoids drawn on top
      this.joint(ctx, sh, 4.8 * sc);
      this.drawLayer(ctx, R, o, 'delt', null, s);
      if (o.launcher === s) this.drawLauncher(ctx, R, A);
      if (o.lockHand === s) this.drawLock(ctx, R, A);
    }

    // disc launcher strapped along the forearm (disc threats)
    drawLauncher(ctx, R, A) {
      const P = R.proj, sc = R.sc;
      const a = P(add(A.el, mul(A.u, DIM.fore * 0.3))), b = P(add(A.el, mul(A.u, DIM.fore * 0.95)));
      ctx.strokeStyle = col('#11161c'); ctx.lineWidth = 6.5 * sc;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      ctx.strokeStyle = col('#3a434d'); ctx.lineWidth = 4.5 * sc; ctx.stroke();
      const dc = P(add(add(A.el, mul(A.u, DIM.fore * 0.7)), mul(A.b, 3)));
      ctx.fillStyle = col('#ff9a3d'); ctx.strokeStyle = col('#2a1406'); ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(dc[0], dc[1], 4.6 * sc, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = col('#2a1406');
      ctx.beginPath(); ctx.arc(dc[0], dc[1], 1.4 * sc, 0, TAU); ctx.fill();
    }

    // busy hand: padlock glyph
    drawLock(ctx, R, A) {
      const c = R.proj(A.handVis), sc = R.sc;
      const x = c[0] + 9 * sc, y = c[1] - 9 * sc, z = 4.2 * sc;
      ctx.save();
      ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = 1.6 * Math.max(0.7, sc);
      ctx.beginPath(); ctx.arc(x, y - z * 0.45, z * 0.62, Math.PI, 0); ctx.stroke();
      ctx.fillStyle = '#ffd27a'; ctx.fillRect(x - z, y - z * 0.45, 2 * z, 1.5 * z);
      ctx.fillStyle = '#2a1406'; ctx.fillRect(x - z * 0.15, y, z * 0.3, z * 0.6);
      ctx.restore();
    }

    // Hand seen end-on (hanging arm, elbow straight): a cross-section bar with
    // the palm emitter on the side the palm faces (forward = supinated,
    // back = pronated, toward the thigh = mid-position) and the thumb nub.
    drawHandEndOn(ctx, R, A, o) {
      const c = R.proj(A.handVis);
      const w0 = R.proj(A.wr);
      ctx.strokeStyle = 'rgba(200,220,235,0.45)'; ctx.lineWidth = 1.2; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(w0[0], w0[1]); ctx.lineTo(c[0], c[1]); ctx.stroke(); ctx.setLineDash([]);
      const k = R.sc * (1 + A.hand[2] * PERSP);
      let nd = R.projDir(A.n); const nl = Math.hypot(nd[0], nd[1]) || 1; nd = [nd[0] / nl, nd[1] / nl];
      const ang = Math.atan2(nd[1], nd[0]); // +x = palm direction
      const Wd = 13 * k, Th = 6 * k;
      const pc = o.visor && (o.status || 'ok') === 'ok' ? o.visor : '#56e0ff';
      ctx.save();
      ctx.translate(c[0], c[1]); ctx.rotate(ang);
      // emitter glow fan out of the palm
      if (!CHR) {
        const gr = ctx.createLinearGradient(Th / 2, 0, Th / 2 + 18 * k, 0);
        gr.addColorStop(0, 'rgba(86,224,255,0.55)'); gr.addColorStop(1, 'rgba(86,224,255,0)');
        ctx.fillStyle = gr;
        ctx.beginPath(); ctx.moveTo(Th / 2, -Wd * 0.42); ctx.lineTo(Th / 2 + 18 * k, -Wd * 0.8); ctx.lineTo(Th / 2 + 18 * k, Wd * 0.8); ctx.lineTo(Th / 2, Wd * 0.42); ctx.closePath(); ctx.fill();
      }
      // dorsum half (dark) + palm half
      ctx.beginPath(); ctx.roundRect(-Th / 2, -Wd / 2, Th, Wd, 2 * k);
      ctx.fillStyle = col('#20272f'); ctx.fill();
      ctx.strokeStyle = col('#0b0f15'); ctx.lineWidth = 1.6; ctx.stroke();
      ctx.save();
      if (!o.reduce && !CHR) { ctx.shadowColor = pc; ctx.shadowBlur = 8; }
      ctx.fillStyle = CHR ? mixHex(pc, CHAR, 0.6 * CHR) : pc;
      ctx.fillRect(Th * 0.05, -Wd * 0.4, Th * 0.42, Wd * 0.8);
      ctx.restore();
      ctx.restore();
      // thumb on the radial side
      const thp = R.projDir(A.th), tl = Math.hypot(thp[0], thp[1]) || 1;
      const tq = [c[0] + thp[0] / tl * (Wd * 0.55 + 1.5 * k), c[1] + thp[1] / tl * (Wd * 0.55 + 1.5 * k)];
      ctx.fillStyle = col('#9aa5b1'); ctx.strokeStyle = col('#1a2028'); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(tq[0], tq[1], 2.3 * k, 0, TAU); ctx.fill(); ctx.stroke();
    }

    drawHand(ctx, R, A, o) {
      if (A.endOn) { this.drawHandEndOn(ctx, R, A, o); return; }
      const P = R.proj, sc = R.sc;
      const c = P(A.hand);
      const k = sc * (1 + A.hand[2] * PERSP);
      // in-screen hand long axis = forearm direction (fallback: thumb dir)
      let ux = R.projDir(A.u), ul = Math.hypot(ux[0], ux[1]);
      if (ul < 0.25) { ux = R.projDir(A.n[2] > 0 ? A.th : A.th); ul = Math.hypot(ux[0], ux[1]) || 1; }
      const ang = Math.atan2(ux[1], ux[0]);
      const along = Math.max(0.45, ul);
      const nz = A.n[2];
      const face = nz > 0.4 ? 'palm' : nz < -0.4 ? 'back' : 'edge';
      const L = DIM.hand * k * along, W = (face === 'edge' ? 3.8 : 8) * k;
      ctx.save();
      ctx.translate(c[0], c[1]); ctx.rotate(ang);
      // thumb (radial side): small nub, on the side the thumb points
      const thp = R.projDir(A.th);
      const thl = Math.hypot(thp[0], thp[1]);
      ctx.restore();
      if (thl > 0.3) {
        const tq = [c[0] + thp[0] * (W * 0.5 + 1.2 * k) - ux[0] / ul * L * 0.15, c[1] + thp[1] * (W * 0.5 + 1.2 * k) - ux[1] / ul * L * 0.15];
        ctx.fillStyle = col('#9aa5b1'); ctx.strokeStyle = col('#1a2028'); ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.ellipse(tq[0], tq[1], 2.6 * k, 2 * k, ang, 0, TAU); ctx.fill(); ctx.stroke();
      }
      ctx.save();
      ctx.translate(c[0], c[1]); ctx.rotate(ang);
      ctx.beginPath();
      ctx.roundRect(-L * 0.55, -W / 2, L * 1.1, W, Math.min(W / 2, 3 * k));
      if (face === 'palm') {
        ctx.fillStyle = col('#5b6672'); ctx.fill();
        ctx.strokeStyle = col('#1a2028'); ctx.lineWidth = 1.6; ctx.stroke();
        // finger grooves
        ctx.strokeStyle = col('#2a323b'); ctx.lineWidth = 0.9;
        ctx.beginPath();
        for (const f of [-0.25, 0, 0.25]) { ctx.moveTo(L * 0.25, f * W); ctx.lineTo(L * 0.52, f * W); }
        ctx.stroke();
        // cyan palm emitter
        const pc = o.visor && (o.status || 'ok') === 'ok' ? o.visor : '#56e0ff';
        ctx.save();
        if (!o.reduce && !CHR) { ctx.shadowColor = pc; ctx.shadowBlur = 10; }
        ctx.fillStyle = CHR ? mixHex(pc, CHAR, 0.6 * CHR) : pc;
        ctx.beginPath(); ctx.arc(-L * 0.08, 0, 2.9 * k, 0, TAU); ctx.fill();
        ctx.restore();
        ctx.strokeStyle = '#d8fbff'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(-L * 0.08, 0, 2.9 * k, 0, TAU); ctx.stroke();
      } else if (face === 'back') {
        // dorsum: dark armour plate, silver knuckle ridges, no light
        ctx.fillStyle = col('#20272f'); ctx.fill();
        ctx.strokeStyle = col('#0b0f15'); ctx.lineWidth = 1.8; ctx.stroke();
        ctx.strokeStyle = col('#aab5c0'); ctx.lineWidth = 1.5 * k;
        ctx.beginPath();
        ctx.moveTo(L * 0.3, -W * 0.36); ctx.lineTo(L * 0.3, W * 0.36);
        ctx.moveTo(-L * 0.2, -W * 0.3); ctx.lineTo(-L * 0.2, W * 0.3);
        ctx.stroke();
        ctx.fillStyle = col('#4c5763');
        ctx.fillRect(-L * 0.45, -W * 0.15, L * 0.2, W * 0.3);
      } else {
        // edge-on (mid-position, thumb up): narrow plate, palm edge faintly lit
        ctx.fillStyle = col('#7d8893'); ctx.fill();
        ctx.strokeStyle = col('#1a2028'); ctx.lineWidth = 1.4; ctx.stroke();
        const nd = R.projDir(A.n);
        const sideSign = (-Math.sin(ang) * nd[0] + Math.cos(ang) * nd[1]) >= 0 ? 1 : -1;
        ctx.strokeStyle = 'rgba(86,224,255,0.75)'; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(-L * 0.45, sideSign * W * 0.5); ctx.lineTo(L * 0.45, sideSign * W * 0.5); ctx.stroke();
      }
      ctx.restore();
      // thumb seen end-on from above (thumb pointing up)
      if (thl <= 0.3 && A.th[2] > 0) {
        ctx.fillStyle = col('#c7d0d9'); ctx.strokeStyle = col('#1a2028'); ctx.lineWidth = 1.2;
        const tq = [c[0] - ux[0] / ul * L * 0.2, c[1] - ux[1] / ul * L * 0.2];
        ctx.beginPath(); ctx.arc(tq[0], tq[1], 2.3 * k, 0, TAU); ctx.fill(); ctx.stroke();
      }
    }

    // ---------- head ----------
    drawHead(ctx, R, o) {
      const h = R.head, sc = R.sc;
      const c = R.proj(h.c);
      const k = sc * (1 + h.c[2] * PERSP);
      const r = h.r * k;
      const status = o.status || 'ok';
      const vc = o.visor && status === 'ok' ? o.visor : status === 'ok' ? '#56e0ff' : status === 'warn' ? '#ffb020' : '#ff3040';
      // screen angle of the face direction
      const fwd = R.projDir(rotZ([0, 1, 0], -h.ang));
      const ang = Math.atan2(fwd[1], fwd[0]);
      ctx.save();
      ctx.translate(c[0], c[1]); ctx.rotate(ang); // +x = facing
      // skull dome
      const g = ctx.createRadialGradient(-r * 0.25, -r * 0.2, r * 0.1, 0, 0, r);
      g.addColorStop(0, col('#8e99a5')); g.addColorStop(1, col('#5a6571'));
      ctx.fillStyle = g; ctx.strokeStyle = col('#161b22'); ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.ellipse(0, 0, r * 0.95, r * 0.86, 0, 0, TAU); ctx.fill(); ctx.stroke();
      // crest ridge (front to back)
      ctx.strokeStyle = col('#c7d0d9'); ctx.lineWidth = 1.6 * sc;
      ctx.beginPath(); ctx.moveTo(-r * 0.75, 0); ctx.lineTo(r * 0.35, 0); ctx.stroke();
      // ear modules
      ctx.fillStyle = col('#3d4650'); ctx.strokeStyle = col('#161b22'); ctx.lineWidth = 1.4;
      for (const sy of [-1, 1]) { ctx.beginPath(); ctx.roundRect(-r * 0.35, sy * r * 0.86 - r * 0.16, r * 0.55, r * 0.32, r * 0.1); ctx.fill(); ctx.stroke(); }
      // visor band on the front edge
      ctx.fillStyle = '#0d1a22';
      ctx.beginPath(); ctx.arc(0, 0, r * 0.98, -1.05, 1.05); ctx.arc(0, 0, r * 0.62, 1.0, -1.0, true); ctx.closePath(); ctx.fill();
      ctx.save();
      if (!o.reduce) { ctx.shadowColor = vc; ctx.shadowBlur = 10; }
      let blink = status === 'ok' ? 1 : 0.4 + 0.6 * Math.abs(Math.sin(this.time * 20));
      if (CHR && !o.reduce) blink *= hash1(Math.floor(this.time * 18)) < 0.3 * CHR ? 0.15 : 1;
      if ((R.p.slump || 0) > 0.7) blink *= 0.25;
      ctx.globalAlpha = blink;
      ctx.strokeStyle = vc; ctx.lineWidth = 3.2 * sc;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.82, -0.85, 0.85); ctx.stroke();
      // forward "nose" point of the visor so heading reads at a glance
      ctx.fillStyle = vc;
      ctx.beginPath(); ctx.moveTo(r * 1.22, 0); ctx.lineTo(r * 0.92, -r * 0.2); ctx.lineTo(r * 0.92, r * 0.2); ctx.closePath(); ctx.fill();
      ctx.restore();
      // antenna (points backward)
      ctx.strokeStyle = col('#9aa5b1'); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-r * 0.6, -r * 0.3); ctx.lineTo(-r * 1.3, -r * 0.55); ctx.stroke();
      ctx.fillStyle = col('#c7d0d9');
      ctx.beginPath(); ctx.arc(-r * 1.3, -r * 0.55, 1.8 * sc, 0, TAU); ctx.fill();
      // ally role badge: stripe on the back of the head
      if (o.allyRole) {
        ctx.fillStyle = o.allyRole; ctx.strokeStyle = '#0b0f15'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.roundRect(-r * 0.78, -r * 0.42, r * 0.42, r * 0.84, r * 0.12); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    }

    // ---------- muscles ----------
    drawLayer(ctx, R, o, layer, sub2, side) {
      for (const m of MUSCLES) {
        if (m.layer !== layer) continue;
        for (const s of side ? [side] : SIDES) {
          // arm-group muscles are drawn with their arm (damage + z-order)
          if (!side && m.grp === 'arm') continue;
          this.drawMuscle(ctx, m, R, s, o);
        }
      }
    }

    drawMuscle(ctx, m, R, s, o) {
      const A = R[s];
      const st = this.state[m.id + s];
      const pts = m.pts(A, R).map(R.proj);
      const sc = R.sc;
      const A0 = pts[0], B0 = pts[1];
      const a = [A0[0] + (B0[0] - A0[0]) * m.belly[0], A0[1] + (B0[1] - A0[1]) * m.belly[0]];
      const b = [A0[0] + (B0[0] - A0[0]) * m.belly[1], A0[1] + (B0[1] - A0[1]) * m.belly[1]];
      const alpha = m.ghost ? 0.28 + 0.72 * Math.min(1, st.q * 1.6) : 1;
      ctx.save();
      ctx.globalAlpha *= alpha;
      // tendons
      ctx.strokeStyle = col('#e6dccb'); ctx.lineWidth = 1.5 * Math.max(0.7, sc);
      ctx.beginPath();
      ctx.moveTo(A0[0], A0[1]); ctx.lineTo(a[0], a[1]);
      ctx.moveTo(b[0], b[1]); ctx.lineTo(B0[0], B0[1]);
      if (pts[2]) ctx.lineTo(pts[2][0], pts[2][1]);
      ctx.stroke();
      const q = st.q;
      const shorten = Math.max(-0.3, Math.min(0.4, 1 - st.len));
      const w = m.w * sc * (0.8 + 0.6 * shorten + 0.34 * q);
      let dx = b[0] - a[0], dy = b[1] - a[1];
      let len = Math.hypot(dx, dy);
      const modeCol = o.neutral ? '#dfe6ee' : MODE_COLOR[st.mode] || MODE_COLOR.c;
      let fill = q > 0.01 ? mixHex(MUSCLE_BASE, modeCol, 0.18 + 0.68 * q) : MUSCLE_BASE;
      if (CHR) fill = mixHex(fill, CHAR, 0.55 * CHR);
      if (!o.reduce && q > 0.24) { ctx.shadowColor = modeCol; ctx.shadowBlur = 14 * q * Math.max(0.6, sc); }
      ctx.beginPath();
      let nx, ny;
      if (len < w * 0.9) {
        // seen end-on (foreshortened): a round swelling
        const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2;
        ctx.ellipse(cx, cy, w * 0.55, w * 0.45, Math.atan2(dy, dx), 0, TAU);
        nx = 0; ny = -1; dx = dx || 1; len = len || 1;
      } else {
        nx = -dy / len; ny = dx / len;
        const k = w * 0.667;
        const c1 = [a[0] + dx * 0.25, a[1] + dy * 0.25], c2 = [a[0] + dx * 0.75, a[1] + dy * 0.75];
        ctx.moveTo(a[0], a[1]);
        ctx.bezierCurveTo(c1[0] + nx * k, c1[1] + ny * k, c2[0] + nx * k, c2[1] + ny * k, b[0], b[1]);
        ctx.bezierCurveTo(c2[0] - nx * k, c2[1] - ny * k, c1[0] - nx * k, c1[1] - ny * k, a[0], a[1]);
        ctx.closePath();
      }
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = col('#3a0e14'); ctx.lineWidth = 1.1;
      ctx.stroke();
      if (len >= w * 0.9) {
        ctx.strokeStyle = `rgba(255,${q > 0.2 ? 230 : 170},${q > 0.2 ? 200 : 170},${0.18 + 0.25 * q})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        for (const f of [-0.22, 0, 0.22]) {
          const off = f * w;
          ctx.moveTo(a[0] + dx * 0.15 + nx * off, a[1] + dy * 0.15 + ny * off);
          ctx.lineTo(a[0] + dx * 0.85 + nx * off, a[1] + dy * 0.85 + ny * off);
        }
        ctx.stroke();
      }
      ctx.restore();
      st._mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    }

    // ---------- highlights: dashed ring, ⊙ longitudinal-axis glyph, rotation arc ----------
    drawHighlights(ctx, R, hl) {
      const t = this.time, sc = R.sc;
      const alias = { spine: 'trunk', torso: 'trunk', shL: 'shoulderL', shR: 'shoulderR', radioulnarL: 'foreL', radioulnarR: 'foreR', forearmL: 'foreL', forearmR: 'foreR' };
      ctx.save();
      for (let j of hl.joints || []) {
        j = alias[j] || j;
        let c, rad = 16;
        if (j === 'trunk') { c = R.proj(R.T([0, 0, -10])); rad = 34; }
        else if (j === 'head' || j === 'neck') { c = R.proj(R.head.c); rad = 19; }
        else if (/^fore[LR]$/.test(j)) { c = partPoint(R.p, R.x, R.y, j, sc); rad = 13; }
        else c = partPoint(R.p, R.x, R.y, j, sc);
        if (!c) continue;
        const pulse = 0.5 + 0.5 * Math.sin(t * 6);
        const Rr = (rad + 3 * pulse) * sc;
        ctx.strokeStyle = `rgba(120,230,255,${0.5 + 0.4 * pulse})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 4]);
        ctx.beginPath(); ctx.arc(c[0], c[1], Rr, 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
        // ⊙: the longitudinal axis points straight out of the screen
        ctx.strokeStyle = '#bff4ff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(c[0], c[1], 5, 0, TAU); ctx.stroke();
        ctx.fillStyle = '#bff4ff';
        ctx.beginPath(); ctx.arc(c[0], c[1], 1.9, 0, TAU); ctx.fill();
        if (/^hip[LR]$/.test(j)) {
          // dashed line down the leg to the heel pivot
          const hp = R.proj(R[j.slice(-1)].heel);
          ctx.strokeStyle = 'rgba(191,244,255,0.7)'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
          ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(hp[0], hp[1]); ctx.stroke(); ctx.setLineDash([]);
        }
        if (hl.arcs !== false) {
          // rotation arc in the plane of the screen (= transverse plane)
          const AR = Rr + 7;
          const a0 = -2.4, a1 = -0.75;
          ctx.strokeStyle = 'rgba(191,244,255,0.88)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(c[0], c[1], AR, a0, a1); ctx.stroke();
          // dir 'ccw' -> head at a0, 'cw' -> head at a1, default both
          const heads = hl.dir === 'ccw' ? [[a0, -1]] : hl.dir === 'cw' ? [[a1, 1]] : [[a0, -1], [a1, 1]];
          for (const [ang, dir] of heads) {
            const px = c[0] + Math.cos(ang) * AR, py = c[1] + Math.sin(ang) * AR;
            const tx = -Math.sin(ang) * dir, ty = Math.cos(ang) * dir;
            ctx.beginPath();
            ctx.moveTo(px + tx * 7, py + ty * 7);
            ctx.lineTo(px - ty * 4, py + tx * 4);
            ctx.lineTo(px + ty * 4, py - tx * 4);
            ctx.closePath();
            ctx.fillStyle = 'rgba(191,244,255,0.88)';
            ctx.fill();
          }
        }
      }
      ctx.restore();
    }

    drawLabels(ctx, R, o) {
      const names = (SEHS.content && SEHS.content.MUSCLES) || {};
      ctx.save();
      ctx.font = `600 ${Math.round(11 * Math.max(0.8, Math.min(1, R.sc)))}px system-ui, sans-serif`;
      ctx.textBaseline = 'middle';
      const used = [];
      for (const m of MUSCLES) {
        if (o.labelOnly && o.labelOnly !== m.id) continue;
        const a = this.state[m.id + 'L'], b = this.state[m.id + 'R'];
        const st = o.labelSide ? this.state[m.id + o.labelSide] : b.q > a.q ? b : (a.q > b.q ? a : b);
        if (!st._mid) continue;
        if (o.labels === 'active' && st.q < 0.2) continue;
        const nm = names[m.id] ? names[m.id].name : m.id.replace(/_/g, ' ');
        const right = st._mid[0] >= R.x;
        const ox = st._mid[0] + (right ? 30 : -30);
        let oy = st._mid[1];
        for (const u of used) if (Math.abs(u[0] - ox) < 90 && Math.abs(u[1] - oy) < 15) oy = u[1] + 16 * (oy >= u[1] ? 1 : -1);
        used.push([ox, oy]);
        ctx.strokeStyle = 'rgba(220,235,245,0.6)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(st._mid[0], st._mid[1]); ctx.lineTo(ox, oy); ctx.stroke();
        const tw = ctx.measureText(nm).width + 8;
        const bx = right ? ox : ox - tw;
        ctx.fillStyle = 'rgba(8,14,20,0.82)';
        ctx.fillRect(bx, oy - 8, tw, 16);
        ctx.fillStyle = st.q > 0.2 ? (o.neutral ? '#ffffff' : MODE_COLOR[st.mode]) : '#dfe6ee';
        ctx.fillText(nm, bx + 4, oy);
      }
      ctx.restore();
    }
  }

  AndroidTop.solve = solve;
  AndroidTop.handPos = handPos;
  AndroidTop.partPoint = partPoint;
  AndroidTop.lenRatio = lenRatio;
  AndroidTop.MUSCLES = MUSCLES;
  AndroidTop.MUSCLE_IDS = MUSCLES.map((m) => m.id);
  AndroidTop.DAMAGE_PARTS = DMG_PARTS;
  AndroidTop.DIM = DIM;

  SEHS.AndroidTop = AndroidTop;
  SEHS.TopAndroid = AndroidTop; // alias used in GAME_DESIGN §4.2a
  SEHS.TopPose = { mk, with: withPose, lerp, clone, jitter, get, threat, BASE, KEYS: POSE_KEYS, ARM_KEYS, LIB, THREATS };
})();
