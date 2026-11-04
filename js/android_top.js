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

  // ---------------- dimensions (unscaled px at scale 1) ----------------
  const DIM = {
    shX: 42, // shoulder joint centre, half-width
    upper: 29, fore: 26, hand: 10,
    ribW: 27, ribD: 16, // ribcage half-width / half-depth
    pelW: 24, pelD: 13, pelZ: -46,
    hipX: 11, kneeZ: -74, ankleZ: -100, foot: 24, heel: 6,
    headR: 13, headZ: 16, headY: 2,
  };
  const PERSP = 0.0016; // perspective: k(z) = 1 + z * PERSP

  const SIDES = ['L', 'R'];
  const SGN = { L: -1, R: 1 };
  const POSE_KEYS = ['facing', 'trunk', 'head', 'slump', 'stance',
    'shElevL', 'shHAbdL', 'shRotL', 'elL', 'foreL',
    'shElevR', 'shHAbdR', 'shRotR', 'elR', 'foreR',
    'hipRotL', 'hipRotR'];
  const BASE = {
    facing: 0, trunk: 0, head: 0, slump: 0, stance: 24,
    shElevL: 20, shHAbdL: 0, shRotL: 0, elL: 20, foreL: 0,
    shElevR: 20, shHAbdR: 0, shRotR: 0, elR: 20, foreR: 0,
    hipRotL: 0, hipRotR: 0,
  };

  // ---------------- pose helpers ----------------
  // mk({ ...keys, armL: [elev, hAbd, rot, el, fore], armR: [...], arms: [...]
  //      (mirrored to both), hipRot: n (both), mus }) -> full pose
  function mk(o) {
    const p = Object.assign({}, BASE);
    if (!o) return p;
    const arm = (s, a) => {
      if (!a) return;
      ['shElev', 'shHAbd', 'shRot', 'el', 'fore'].forEach((k, i) => { if (a[i] != null) p[k + s] = a[i]; });
    };
    arm('L', o.arms); arm('R', o.arms);
    arm('L', o.armL); arm('R', o.armR);
    if (o.hipRot != null) { p.hipRotL = o.hipRot; p.hipRotR = o.hipRot; }
    for (const k of POSE_KEYS) if (o[k] !== undefined) p[k] = o[k];
    if (o.mus) p.mus = o.mus;
    return p;
  }
  function clone(a) { return Object.assign({}, a); }
  function lerp(a, b, t) {
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const o = {};
    for (const k of POSE_KEYS) {
      const va = a[k] != null ? a[k] : BASE[k], vb = b[k] != null ? b[k] : BASE[k];
      let d = vb - va;
      if (k === 'facing') d = ((d + 540) % 360) - 180; // shortest turn
      o[k] = va + d * t;
    }
    o.mus = t < 0.5 ? a.mus : b.mus;
    return o;
  }
  function jitter(p, amt, keys) {
    const o = clone(p);
    (keys || POSE_KEYS).forEach((k) => { if (k !== 'facing' && k !== 'stance' && k !== 'slump') o[k] += (Math.random() - 0.5) * 2 * amt; });
    return o;
  }

  // Named library. Arms: [elevation, horizontal ab(+)/ad(-)duction,
  // lateral(+)/medial(-) rotation, elbow flexion, supination(+)/pronation(-)]
  const GUARD = [24, -12, -18, 112, -25];
  const LIB = {
    idle: mk({ arms: GUARD, hipRot: 6, stance: 26 }),
    // horizontal ADDUCTION swat (right arm sweeps across the chest; pec major)
    crossSwatPrep: mk({ trunk: -28, armR: [90, 75, 0, 18, 0], armL: GUARD, stance: 28 }),
    crossSwat: mk({ trunk: 24, armR: [90, -38, 0, 12, 0], armL: GUARD, stance: 28 }),
    // horizontal ABDUCTION backhand (right arm sweeps out; posterior deltoid)
    backhandPrep: mk({ trunk: 24, armR: [90, -42, 0, 30, -20], armL: GUARD, stance: 28 }),
    backhand: mk({ trunk: -22, armR: [90, 88, 0, 6, -20], armL: GUARD, stance: 28 }),
    // trunk (spine) rotation about the longitudinal axis
    twistL: mk({ trunk: 45, head: 8, arms: GUARD, stance: 28 }),
    twistR: mk({ trunk: -45, head: -8, arms: GUARD, stance: 28 }),
    // shoulder LATERAL rotation wind-up, then MEDIAL rotation throw (right)
    windup: mk({ trunk: -14, armR: [12, 10, 75, 90, 10], armL: GUARD, stance: 28 }),
    throw: mk({ trunk: 14, armR: [12, -5, -70, 90, 10], armL: GUARD, stance: 28 }),
    // radio-ulnar joint: elbows at 90, forearms forward
    palmUp: mk({ arms: [10, 0, 0, 90, 88] }),
    palmDown: mk({ arms: [10, 0, 0, 90, -88] }),
    // hip MEDIAL rotation pivot (feet and knees turn in)
    pivotIn: mk({ arms: GUARD, hipRotL: -30, hipRotR: -40, stance: 28 }),
    // isometric brace: arms out wide holding tethers
    brace: mk({ arms: [88, 70, 0, 14, -10], stance: 32, mus: {
      deltoid_posterior: ['i', 0.9], infraspinatus: ['i', 0.6], latissimus_dorsi: ['i', 0.5],
      obliques: ['i', 0.5], gluteus_maximus: ['i', 0.5], triceps_brachii: ['i', 0.4],
    } }),
    // eccentric: arms forward under load, giving way into horizontal abduction
    catchLower: mk({ arms: [80, 38, 0, 30, 70], stance: 30, mus: {
      pectoralis_major: ['e', 0.85], deltoid_anterior: ['e', 0.6], biceps_brachii: ['e', 0.45], subscapularis: ['e', 0.3],
    } }),
    // concentric pull-in: elbows driven back and out (horizontal abduction + elbow flexion)
    netRip: mk({ arms: [82, 62, 10, 105, -10], trunk: 0, stance: 30, mus: {
      deltoid_posterior: ['c', 1], latissimus_dorsi: ['c', 0.75], biceps_brachii: ['c', 0.8], infraspinatus: ['c', 0.5],
    } }),
    stunned: mk({ trunk: 16, head: 28, slump: 0.35, armL: [14, 30, 20, 35, 30], armR: [22, -10, -30, 55, -40], hipRotL: 18, hipRotR: -12, stance: 30 }),
    shutdown: mk({ trunk: 6, head: -12, slump: 1, arms: [4, 0, 0, 8, 0], hipRot: 18, stance: 22 }),
  };

  // ---------------- small vector helpers ----------------
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const lin = (a, ka, b, kb) => [a[0] * ka + b[0] * kb, a[1] * ka + b[1] * kb, a[2] * ka + b[2] * kb];
  // rotate about z (counter-clockwise seen from above; x right, y forward)
  const rotZ = (v, ang) => { const c = Math.cos(ang), s = Math.sin(ang); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]]; };

  // ---------------- 3D skeleton ----------------
  // Returns everything in the PELVIS frame (3D) + a projector to screen.
  function solve(p, x, y, sc) {
    sc = sc || 1;
    const tr = (p.trunk || 0) * D2R;
    const sl = p.slump || 0;
    const T = (v) => rotZ(v, tr); // thorax frame -> pelvis frame
    const fa = (p.facing || 0) * D2R;
    const Rv = [Math.cos(fa), -Math.sin(fa)], Fv = [-Math.sin(fa), -Math.cos(fa)];
    const proj = (P) => {
      const k = sc * (1 + P[2] * PERSP);
      return [x + (P[0] * Rv[0] + P[1] * Fv[0]) * k, y + (P[0] * Rv[1] + P[1] * Fv[1]) * k];
    };
    // screen direction of a pelvis-frame horizontal vector
    const projDir = (v) => [v[0] * Rv[0] + v[1] * Fv[0], v[0] * Rv[1] + v[1] * Fv[1]];
    const R = { p, sc, tr, fa, T, proj, projDir, x, y, L: {}, R: {} };
    for (const s of SIDES) {
      const g = SGN[s];
      const A = R[s];
      A.g = g;
      // ----- arm -----
      const e = p['shElev' + s] * D2R, h = p['shHAbd' + s] * D2R, r = p['shRot' + s] * D2R;
      const el = p['el' + s] * D2R, fo = p['fore' + s] * D2R;
      // thorax-frame vectors
      let d = [0, Math.sin(e), -Math.cos(e)];
      let a = [0, Math.cos(e), Math.sin(e)];
      d = rotZ(d, -g * h); a = rotZ(a, -g * h);
      const b = mul(cross(d, a), g);
      const a2 = lin(a, Math.cos(r), b, Math.sin(r));
      const b2 = mul(cross(d, a2), g);
      const u = lin(d, Math.cos(el), a2, Math.sin(el));
      const nSup = lin(a2, Math.cos(el), d, -Math.sin(el));
      const n = lin(nSup, Math.sin(fo), b2, -Math.cos(fo)); // palm normal
      const th = lin(b2, Math.sin(fo), nSup, Math.cos(fo)); // thumb direction
      // shoulder: protracts a little in horizontal adduction and in a slump
      const prot = Math.max(0, -p['shHAbd' + s]) * 0.06 + sl * 5;
      const shT = [g * (DIM.shX - prot * 0.4 - sl * 3), prot, -sl * 4];
      A.sh = T(shT);
      A.d = T(d); A.a = T(a2); A.b = T(b2); A.u = T(u); A.n = T(n); A.th = T(th);
      A.el = add(A.sh, mul(A.d, DIM.upper));
      A.wr = add(A.el, mul(A.u, DIM.fore));
      A.hand = add(A.wr, mul(A.u, DIM.hand * 0.55));
      A.clav = T([g * 6, 13 + sl * 3, -3 - sl * 3]); // sternoclavicular end
      A.scap = T([g * 19, -13 + sl * 2, -8]);
      // ----- leg -----
      const hr = (8 + p['hipRot' + s]) * D2R; // 8 deg natural toe-out
      const fd = [g * Math.sin(hr), Math.cos(hr), 0];
      A.fd = fd;
      A.hip = [g * DIM.hipX, 1, DIM.pelZ - 4];
      const st = p.stance != null ? p.stance : 24;
      A.ankle = [g * st, 2, DIM.ankleZ];
      A.heel = add(A.ankle, mul(fd, -DIM.heel));
      A.toe = add(A.ankle, mul(fd, DIM.foot));
      A.knee = [g * (DIM.hipX + st) * 0.5 + fd[0] * 11, 2 + fd[1] * 11, DIM.kneeZ];
      // greater trochanter swings with hip rotation (back = lateral rotation)
      const ga = (p['hipRot' + s]) * D2R;
      A.troch = [g * (DIM.hipX + 6 * Math.cos(ga) * 0.9) , 1 - 6 * Math.sin(ga), DIM.pelZ - 6];
    }
    R.head = { c: T([0, DIM.headY + sl * 10, DIM.headZ - sl * 10]), ang: tr + (p.head || 0) * D2R, r: DIM.headR };
    R.neck = T([0, -1 + sl * 4, 4]);
    R.core = T([0, 9, -6]);
    R.sternum = T([0, 14, -6]);
    return R;
  }

  // ---------------- muscles ----------------
  // k: length change per radian of each joint param (moment-arm model);
  //    'trunkS' = trunk * side sign. Negative k = that param shortens it.
  // pts(A, R): 3D attachment points (origin -> [via] -> insertion).
  // grp: damage group, layer: draw order bucket, deep: drawn faint.
  const MUSCLES = [
    { id: 'gluteus_maximus', grp: 'legs', layer: 'hip', w: 12, belly: [0.05, 0.9], k: { hipRot: -0.14 },
      pts: (A) => [[A.g * 5, -DIM.pelD - 1, DIM.pelZ + 4], add(A.troch, [0, -3, 0])] },
    { id: 'hip_rotators', grp: 'legs', layer: 'hip', w: 6, deep: true, belly: [0.1, 0.9], k: { hipRot: -0.32 },
      pts: (A) => [[A.g * 3, -8, DIM.pelZ - 4], A.troch] },
    { id: 'gluteus_medius', grp: 'legs', layer: 'hip', w: 8, belly: [0.05, 0.85], k: { hipRot: 0.2 },
      pts: (A) => [[A.g * (DIM.pelW - 2), 4, DIM.pelZ + 8], add(A.troch, [A.g * 1, 3, 0])] },
    { id: 'latissimus_dorsi', grp: 'torso', layer: 'back', w: 11, belly: [0.0, 0.82], k: { shElev: 0.28, shRot: 0.08, shHAbd: 0.04 },
      pts: (A, R) => [[A.g * 5, -DIM.pelD + 1, DIM.pelZ + 10], R.T([A.g * (DIM.ribW - 1), -8, -24]), add(add(A.sh, mul(A.d, 6)), mul(A.a, 1))] },
    { id: 'obliques', grp: 'torso', layer: 'trunk', w: 8, belly: [0.05, 0.85], k: { trunkS: -0.3 },
      pts: (A, R) => [R.T([A.g * (DIM.ribW - 2), 5, -22]), [-A.g * 3, DIM.pelD, DIM.pelZ + 6]] },
    { id: 'subscapularis', grp: 'torso', layer: 'scap', w: 7, deep: true, belly: [0.05, 0.8], k: { shRot: 0.32, shHAbd: 0.03 },
      pts: (A) => [add(A.scap, R0(A, [0, 4, 0])), add(A.sh, mul(A.a, 4.5))] },
    { id: 'infraspinatus', grp: 'torso', layer: 'scap', w: 9, belly: [0.0, 0.78], k: { shRot: -0.32, shHAbd: -0.04 },
      pts: (A) => [add(A.scap, R0(A, [0, -2, 1])), add(A.sh, mul(A.a, -5))] },
    { id: 'pectoralis_major', grp: 'torso', layer: 'chest', w: 14, belly: [0.0, 0.84], k: { shHAbd: 0.32, shRot: 0.1 },
      pts: (A, R) => [add(R.sternum, R0(A, [A.g * 4, 2, 2])), add(add(A.sh, mul(A.d, 7)), mul(A.a, 3))] },
    { id: 'deltoid_anterior', grp: 'arm', layer: 'delt', w: 9, belly: [0.0, 0.92], k: { shHAbd: 0.22, shRot: 0.04, shElev: -0.18 },
      pts: (A) => [add(A.clav, sub(A.sh, A.clav).map((v) => v * 0.72)), add(add(A.sh, mul(A.d, 13)), mul(A.a, 3.5))] },
    { id: 'deltoid_posterior', grp: 'arm', layer: 'delt', w: 9, belly: [0.0, 0.92], k: { shHAbd: -0.3, shRot: -0.05, shElev: 0.12 },
      pts: (A) => [add(A.scap, add(mul(sub(A.sh, A.scap), 0.62), [0, 0, 6])), add(add(A.sh, mul(A.d, 13)), mul(A.a, -3.5))] },
    { id: 'biceps_brachii', grp: 'arm', layer: 'upper', w: 8, belly: [0.18, 0.88], k: { el: -0.38, fore: -0.12, shElev: -0.04 },
      pts: (A) => [add(A.sh, mul(A.a, 3)), add(add(A.sh, mul(A.d, DIM.upper * 0.9)), mul(A.a, 4.5)), add(add(A.el, mul(A.u, 4)), mul(A.n, 1.5))] },
    { id: 'triceps_brachii', grp: 'arm', layer: 'upper', w: 9, belly: [0.12, 0.86], k: { el: 0.38, shElev: 0.06 },
      pts: (A) => [add(A.sh, mul(A.a, -3)), add(add(A.sh, mul(A.d, DIM.upper * 0.92)), mul(A.a, -4.5)), add(A.el, add(mul(A.u, -2.5), mul(A.a, -1.5)))] },
    { id: 'pronator_teres', grp: 'arm', layer: 'fore', w: 6, belly: [0.08, 0.85], k: { fore: 0.3, el: -0.05 },
      pts: (A) => [add(A.el, add(mul(A.b, -4), mul(A.a, 1.5))), add(add(A.el, mul(A.u, DIM.fore * 0.5)), add(mul(A.th, 3), mul(A.n, 1)))] },
    { id: 'supinator', grp: 'arm', layer: 'fore', w: 6, belly: [0.08, 0.85], k: { fore: -0.3 },
      pts: (A) => [add(A.el, add(mul(A.b, 4), mul(A.a, -1))), add(add(A.el, mul(A.u, DIM.fore * 0.32)), add(mul(A.th, 3), mul(A.n, -2)))] },
  ];
  // thorax-frame offset with side mirroring (A.g) is already applied by callers
  function R0(A, v) { return v; }
  const MUS_BY_ID = {};
  MUSCLES.forEach((m) => { MUS_BY_ID[m.id] = m; });

  function lenRatio(m, p, s) {
    let L = 1;
    const g = SGN[s];
    for (const key in m.k) {
      let v;
      if (key === 'trunkS') v = (p.trunk || 0) - BASE.trunk; else v = (p[key + s] != null ? p[key + s] : BASE[key + s]) - BASE[key + s];
      if (key === 'trunkS') L += m.k[key] * g * v * D2R;
      else L += m.k[key] * v * D2R;
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

  const DMG_PARTS = ['head', 'armL', 'armR', 'torso', 'legs'];
  function dmgOf(d, part) {
    if (!d) return 0;
    if (Array.isArray(d)) return d.indexOf(part) >= 0 ? 1 : 0;
    if (typeof d.has === 'function') return d.has(part) ? 1 : 0;
    const v = d[part];
    return v === true ? 1 : v > 0 ? Math.min(1, v) : 0;
  }
  function hash1(i) { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

  // ---------------- static helpers ----------------
  function handPos(p, x, y, side, scale) {
    const R = solve(p, x || 0, y || 0, scale || 1);
    return R.proj(R[side === 'L' ? 'L' : 'R'].hand);
  }
  // part: 'head' | 'torso' (= 'chest') | 'pelvis' | 'core'
  //       'armX' (= hand) 'handX' 'wristX' 'elbowX' 'shoulderX' 'upperX' 'foreX'
  //       'hipX' 'kneeX' 'footX' 'legX' (= knee) 'legs' (between knees)  X = L | R
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
      case 'pelvis': return R.proj([0, 0, DIM.pelZ]);
      case 'legs': return R.proj(mid(R.L.knee, R.R.knee));
      case 'arm': case 'hand': return R.proj(A.hand);
      case 'wrist': return R.proj(A.wr);
      case 'fore': case 'forearm': return R.proj(mid(A.el, A.wr));
      case 'elbow': return R.proj(A.el);
      case 'upper': return R.proj(mid(A.sh, A.el));
      case 'shoulder': case 'sh': return R.proj(A.sh);
      case 'hip': return R.proj(A.hip);
      case 'knee': case 'leg': return R.proj(A.knee);
      case 'foot': return R.proj(mid(A.ankle, A.toe));
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
      const R = solve(p, x, y, sc);
      R.sparks = [];
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      const part = (name, fn) => {
        const d = dmgOf(o.damage, name);
        if (!d) { fn(); return; }
        this.drawDamaged(ctx, R, name, d, o, fn);
      };
      this.drawShadow(ctx, R);
      part('legs', () => { this.drawLegs(ctx, R, o); this.drawLayer(ctx, R, o, 'hip'); });
      part('torso', () => this.drawTrunk(ctx, R, o));
      // arms: lower arm first
      const order = SIDES.slice().sort((s1, s2) => (R[s1].hand[2] + R[s1].el[2]) - (R[s2].hand[2] + R[s2].el[2]));
      for (const s of order) part('arm' + s, () => this.drawArm(ctx, R, s, o));
      part('head', () => this.drawHead(ctx, R, o));
      if (o.highlight) this.drawHighlights(ctx, R, o.highlight);
      if (o.labels) this.drawLabels(ctx, R, o);
      ctx.restore();
      return R;
    }

    // ---------- damage (mirrors android.js: char, twitch, embers, sparks) ----------
    drawDamaged(ctx, R, name, d, o, fn) {
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
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = 1.4;
        ctx.beginPath();
        const n = red ? 3 : 5;
        for (let i = 0; i < n; i++) {
          const a = hash1(sf + i * 9.1 + k) * TAU, L = (4 + 7 * hash1(sf + i * 3.3)) * sc * 1.4;
          ctx.moveTo(q[0], q[1]); ctx.lineTo(q[0] + Math.cos(a) * L, q[1] + Math.sin(a) * L);
        }
        ctx.stroke();
        ctx.fillStyle = '#fff6d8';
        ctx.beginPath(); ctx.arc(q[0], q[1], 2 * sc, 0, TAU); ctx.fill();
        ctx.restore();
      }
    }

    damagePts(R, name) {
      const P = R.proj;
      if (name === 'head') return [P(add(R.head.c, [-4, 3, 0])), P(add(R.head.c, [3, -4, 0]))];
      if (name === 'torso') return [P(R.T([-12, 6, -8])), P(R.T([10, -6, -8])), P(R.T([2, 10, -20]))];
      if (name === 'legs') return [P(R.L.knee), P(R.R.knee), P(R.L.toe), P(R.R.toe)];
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
    drawLegs(ctx, R, o) {
      const P = R.proj, sc = R.sc;
      for (const s of SIDES) {
        const A = R[s];
        // foot plate (wedge pointing where the foot points)
        const side = [A.fd[1], -A.fd[0], 0]; // perpendicular (horizontal)
        const hw = 4.5;
        const pts = [
          add(A.heel, mul(side, hw * 0.8)), add(A.ankle, mul(side, hw)), add(add(A.toe, mul(A.fd, -4)), mul(side, hw * 0.85)),
          A.toe, add(add(A.toe, mul(A.fd, -4)), mul(side, -hw * 0.85)), add(A.ankle, mul(side, -hw)), add(A.heel, mul(side, -hw * 0.8)),
        ].map(P);
        this.poly(ctx, pts, col('#59636e'), col('#1a2028'), 2);
        // toe cap light (shows which way the foot points)
        const tc = P(add(A.toe, mul(A.fd, -3.5)));
        ctx.fillStyle = col('#8d98a3');
        ctx.beginPath(); ctx.arc(tc[0], tc[1], 2.2 * sc, 0, TAU); ctx.fill();
        // shank (short, foreshortened) + thigh
        this.bone(ctx, P(A.knee), P(A.ankle), 4.5 * sc);
        this.bone(ctx, P(A.hip), P(A.knee), 6 * sc);
        this.joint(ctx, P(A.ankle), 3.2 * sc);
        // kneecap: plate on the FRONT of the knee, faces where the knee points
        const kc = P(A.knee);
        this.joint(ctx, kc, 4.2 * sc);
        const pat = P(add(A.knee, mul(A.fd, 4.5)));
        ctx.fillStyle = col('#c7d0d9'); ctx.strokeStyle = col('#1a2028'); ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(pat[0], pat[1], 2.8 * sc, 0, TAU); ctx.fill(); ctx.stroke();
      }
      // pelvis plate
      const pel = this.hEllipse(R, [0, 0, DIM.pelZ], DIM.pelW, DIM.pelD, 0, 24);
      this.poly(ctx, pel, col('#4f5964'), col('#161b22'), 2.2);
      for (const s of SIDES) this.joint(ctx, P(R[s].hip), 4.4 * sc);
      // pelvis heading tick (anterior superior iliac spines + pubis)
      const f0 = P([0, DIM.pelD - 3, DIM.pelZ]), f1 = P([0, DIM.pelD + 4, DIM.pelZ]);
      ctx.strokeStyle = col('#8d98a3'); ctx.lineWidth = 2.2 * sc;
      ctx.beginPath(); ctx.moveTo(f0[0], f0[1]); ctx.lineTo(f1[0], f1[1]); ctx.stroke();
    }

    // ---------- trunk ----------
    drawTrunk(ctx, R, o) {
      const P = R.proj, sc = R.sc, T = R.T;
      // ribcage shell (translucent so pelvis / hip muscles show through)
      const rib = this.hEllipse(R, [0, 0, -14], DIM.ribW, DIM.ribD, R.tr, 32);
      this.poly(ctx, rib, CHR ? 'rgba(40,30,25,0.82)' : 'rgba(40,55,70,0.78)', col('#1b222b'), 2.2);
      // ribs: arcs around the front of the shell
      ctx.strokeStyle = col('#9aa5b1'); ctx.lineWidth = 1.3 * sc;
      for (let i = 0; i < 4; i++) {
        const k = 0.45 + i * 0.16;
        ctx.beginPath();
        for (let j = 0; j <= 12; j++) {
          const t = Math.PI * (0.12 + 0.76 * j / 12);
          const q = P(T([Math.cos(t) * DIM.ribW * k * 1.05, Math.sin(t) * DIM.ribD * k * 1.05 - 1, -10]));
          j ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]);
        }
        ctx.stroke();
      }
      this.drawLayer(ctx, R, o, 'back');
      // spine: vertebrae along the back midline (dorsal ridge)
      for (let i = 0; i < 4; i++) {
        const c = P(T([0, -4 - i * 3.6, -6 + i * 0.5]));
        ctx.fillStyle = col('#8d98a3');
        ctx.beginPath(); ctx.arc(c[0], c[1], 2.4 * sc, 0, TAU); ctx.fill();
        ctx.strokeStyle = col('#1b222b'); ctx.lineWidth = 1.1; ctx.stroke();
      }
      const s0 = P(T([0, -2, -4])), s1 = P(T([0, -DIM.ribD - 1, -6]));
      ctx.strokeStyle = col('#aab5c0'); ctx.lineWidth = 1.2 * sc;
      ctx.beginPath(); ctx.moveTo(s0[0], s0[1]); ctx.lineTo(s1[0], s1[1]); ctx.stroke();
      this.drawLayer(ctx, R, o, 'trunk');
      // scapulae (back of the ribcage) with rotator cuff
      this.drawLayer(ctx, R, o, 'scap', 'deep');
      for (const s of SIDES) {
        const A = R[s], g = A.g;
        const sp = [T([g * 9, -15, -6]), T([g * 26, -12, -4]), T([g * 20, -9, -10])];
        // keep the plate attached to the scapula point (which moves with slump)
        const off = sub(A.scap, T([g * 19, -13, -8]));
        this.poly(ctx, sp.map((v) => P(add(v, off))), col('#5a6470'), col('#1b222b'), 1.6);
      }
      this.drawLayer(ctx, R, o, 'scap', 'top');
      // clavicles
      for (const s of SIDES) this.bone(ctx, P(R[s].clav), P(R[s].sh), 3.4 * sc);
      // allies: role badge on the upper back
      if (o.allyRole) {
        const b = P(T([0, -9, -2]));
        ctx.save();
        ctx.translate(b[0], b[1]); ctx.rotate(-R.fa - R.tr + Math.PI / 4);
        ctx.fillStyle = o.allyRole; ctx.strokeStyle = '#0b0f15'; ctx.lineWidth = 1.5;
        const z = 4.4 * sc;
        ctx.fillRect(-z, -z, 2 * z, 2 * z); ctx.strokeRect(-z, -z, 2 * z, 2 * z);
        ctx.restore();
      }
      this.drawLayer(ctx, R, o, 'chest');
      this.drawCore(ctx, P(R.core), o.status || 'ok', sc, o);
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
    }

    drawHand(ctx, R, A, o) {
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
      const fwd = R.projDir(rotZ([0, 1, 0], h.ang));
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
      ctx.fillStyle = col('#3d4650');
      for (const sy of [-1, 1]) { ctx.beginPath(); ctx.arc(-r * 0.05, sy * r * 0.82, r * 0.24, 0, TAU); ctx.fill(); ctx.stroke(); }
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
      ctx.fillStyle = vc;
      ctx.beginPath(); ctx.arc(-r * 1.3, -r * 0.55, 2.2 * sc, 0, TAU); ctx.fill();
      ctx.restore();
    }

    // ---------- muscles ----------
    drawLayer(ctx, R, o, layer, sub2, side) {
      for (const m of MUSCLES) {
        if (m.layer !== layer) continue;
        if (sub2 === 'deep' && !m.deep) continue;
        if (sub2 === 'top' && m.deep) continue;
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
      const alpha = m.deep ? 0.55 : 1;
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
      if (!o.reduce && q > 0.24 && !m.deep) { ctx.shadowColor = modeCol; ctx.shadowBlur = 14 * q * Math.max(0.6, sc); }
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
  SEHS.TopPose = { mk, lerp, clone, jitter, BASE, KEYS: POSE_KEYS, LIB };
})();
