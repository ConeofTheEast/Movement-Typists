/*
 * tutorial.js: TUTORIAL / REVIEW SECTION shown at the start of every game
 * -----------------------------------------------------------------
 * Pages (built from js/content.js):
 *   1 Planes & axes   2 Movements in this plane   3 Contraction types
 *   4 Muscles         5 How to play
 * The demo canvas animates each definition:
 *   side view  (sagittal) uses the real muscled android rig
 *   back view  (frontal)  and  top view (transverse) use simple figures
 */
(function () {
  'use strict';
  const SEHS = window.SEHS;
  const C = SEHS.content;
  const { mk, lerpPose, jitterPose } = SEHS.Pose;
  const Android = SEHS.Android;
  const $ = (id) => document.getElementById(id);
  const ease = (t) => { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
  const D2R = Math.PI / 180;
  const MODE = { c: '#ff6a3d', e: '#4ea8ff', i: '#ffc53d' };
  const CW = 520, CH = 440;

  // ------------------------------------------------------------------
  // Timeline: 'loop' = out, hold, back, hold.  'oneway' = out, hold, restart.
  // returns { k: 0..1 position, dir: 'out' | 'back' | 'hold' }
  // ------------------------------------------------------------------
  function phase(t, dur, kind) {
    const p = (t % dur) / dur;
    if (kind === 'oneway') {
      if (p < 0.72) return { k: ease(p / 0.72), dir: 'out' };
      return { k: 1, dir: 'hold' };
    }
    if (kind === 'hold') return { k: 1, dir: 'hold' };
    if (p < 0.38) return { k: ease(p / 0.38), dir: 'out' };
    if (p < 0.52) return { k: 1, dir: 'hold' };
    if (p < 0.9) return { k: 1 - ease((p - 0.52) / 0.38), dir: 'back' };
    return { k: 0, dir: 'hold' };
  }

  // ------------------------------------------------------------------
  // SIDE-VIEW DEMOS (android rig). mus maps per phase direction.
  // ------------------------------------------------------------------
  const STAND = mk({ lean: 4, legs: [0, 3, 0], armN: [4, 10], armF: [-4, 10] });
  const SIDE = {
    idle: { a: STAND, b: STAND, kind: 'hold', joints: ['hip', 'knee', 'ankle', 'shoulder', 'elbow'], caption: () => '⊙ marks the axis at each joint. It points straight out of the screen, so every movement you see happens in the plane of the screen.' },
    Flexion: {
      a: STAND, b: mk({ lean: 4, legN: [70, 95, 10], legF: [0, 3, 0], armN: [20, 130], armF: [-4, 10] }),
      angle: ['knee', 'elbow'], joints: ['hip', 'knee', 'elbow'],
      out: { iliopsoas: ['c', 0.9], hamstrings: ['c', 0.9], biceps_brachii: ['c', 0.9], brachialis: ['c', 0.8] },
      back: { iliopsoas: ['e', 0.5], hamstrings: ['e', 0.4], biceps_brachii: ['e', 0.5], brachialis: ['e', 0.4] },
      label: { out: 'angle DECREASES → FLEXION', back: 'angle increases (returning = extension)' },
    },
    Extension: {
      a: mk({ lean: 28, legs: [85, 100, 25], arms: [60, 120] }), b: mk({ lean: 6, legs: [0, 2, 0], armN: [95, 2], armF: [90, 4] }),
      angle: ['knee', 'elbow'], joints: ['hip', 'knee', 'elbow'],
      out: { quadriceps: ['c', 1], gluteus_maximus: ['c', 1], triceps_brachii: ['c', 0.9], deltoid_anterior: ['c', 0.5] },
      back: { quadriceps: ['e', 0.8], gluteus_maximus: ['e', 0.7], triceps_brachii: ['e', 0.4] },
      label: { out: 'angle INCREASES → EXTENSION', back: 'angle decreases (returning = flexion)' },
    },
    Hyperextension: {
      a: STAND, b: mk({ lean: -16, legs: [8, 3, 0], armN: [-60, 10], armF: [-55, 10], head: -20 }),
      angle: ['shoulder'], joints: ['shoulder', 'hip'],
      out: { deltoid_posterior: ['c', 1], latissimus_dorsi: ['c', 0.9] },
      back: { deltoid_posterior: ['e', 0.4] },
      label: { out: 'moving BEYOND the anatomical position → HYPEREXTENSION', back: 'returning to anatomical position' },
    },
    Dorsiflexion: {
      a: mk({ lean: 4, legN: [28, 30, -8], legF: [0, 3, 0] }), b: mk({ lean: 4, legN: [28, 30, 24], legF: [0, 3, 0] }),
      angle: ['ankle'], joints: ['ankle'],
      out: { tibialis_anterior: ['c', 1] }, back: { tibialis_anterior: ['e', 0.5] },
      label: { out: 'toes pulled up toward the shin → DORSIFLEXION', back: 'returning' },
    },
    Plantarflexion: {
      a: STAND, b: mk({ lean: 4, legs: [0, 0, -30], armN: [4, 10], armF: [-4, 10] }),
      angle: ['ankle'], joints: ['ankle'],
      out: { gastrocnemius: ['c', 1], soleus: ['c', 1] }, back: { gastrocnemius: ['e', 0.7], soleus: ['e', 0.7] },
      label: { out: 'toes point away from the shin → PLANTARFLEXION', back: 'heels lower (calf muscles lengthen under tension)' },
    },
    // ---- contraction demos (biceps curl with a dumbbell) ----
    concentric: {
      a: STAND, b: mk({ lean: 4, legs: [0, 3, 0], armN: [8, 135], armF: [-4, 10] }), kind: 'oneway', dumbbell: true,
      angle: ['elbow'], joints: ['elbow'], out: { biceps_brachii: ['c', 1], brachialis: ['c', 0.9], brachioradialis: ['c', 0.7] },
      hold: { biceps_brachii: ['i', 0.5] },
      caption: () => 'CONCENTRIC: the biceps SHORTENS while lifting the weight. Muscle force is greater than the resistance. Concentric is a type of ISOTONIC contraction.',
    },
    eccentric: {
      a: mk({ lean: 4, legs: [0, 3, 0], armN: [8, 135], armF: [-4, 10] }), b: STAND, kind: 'oneway', dumbbell: true,
      angle: ['elbow'], joints: ['elbow'], out: { biceps_brachii: ['e', 1], brachialis: ['e', 0.9], brachioradialis: ['e', 0.7] },
      hold: {},
      caption: () => 'ECCENTRIC: the biceps LENGTHENS while still working, lowering the weight slowly (braking). Eccentric is a type of ISOTONIC contraction.',
    },
    isometric: {
      a: mk({ lean: 4, legs: [0, 3, 0], armN: [8, 90], armF: [-4, 10] }), b: mk({ lean: 4, legs: [0, 3, 0], armN: [8, 90], armF: [-4, 10] }), kind: 'hold', dumbbell: true, tremble: true,
      angle: ['elbow'], joints: ['elbow'], hold: { biceps_brachii: ['i', 1], brachialis: ['i', 1], brachioradialis: ['i', 0.7] },
      caption: () => 'ISOMETRIC (static): the biceps works hard but does NOT change length. The elbow stays at 90°, because muscle force equals the resistance.',
    },
    isotonic: {
      a: STAND, b: mk({ lean: 4, legs: [0, 3, 0], armN: [8, 135], armF: [-4, 10] }), dumbbell: true,
      angle: ['elbow'], joints: ['elbow'],
      out: { biceps_brachii: ['c', 1], brachialis: ['c', 0.9] }, back: { biceps_brachii: ['e', 1], brachialis: ['e', 0.9] }, hold: { biceps_brachii: ['i', 0.6] },
      label: { out: 'lifting: CONCENTRIC (shortening)', back: 'lowering: ECCENTRIC (lengthening)' },
      pre: 'ISOTONIC = the muscle changes length and the joint moves.',
    },
    landing: {
      a: mk({ lean: 12, legs: [30, 22, 5], arms: [50, 30] }), b: mk({ lean: 30, legs: [82, 100, 28], arms: [30, 40] }), kind: 'oneway',
      angle: ['knee'], joints: ['knee', 'hip'], out: { quadriceps: ['e', 1], gluteus_maximus: ['e', 1], soleus: ['e', 0.7] }, hold: { quadriceps: ['i', 0.5] },
      caption: () => 'LANDING: the knees bend (flexion), but the quadriceps are working while they LENGTHEN to brake the fall. That is an ECCENTRIC contraction.',
    },
  };

  function jointAngle(r, j) {
    const N = r.N;
    const pick = {
      knee: [N.shank.P, N.thigh.P, N.shank.D],
      elbow: [N.fore.P, N.upper.P, N.fore.D],
      hip: [N.thigh.P, r.torso.D, N.thigh.D],
      shoulder: [N.upper.P, r.torso.P, N.upper.D],
      ankle: [N.foot.P, N.shank.P, N.toe],
    }[j];
    return pick;
  }
  function drawAngle(ctx, c, a, b) {
    const a1 = Math.atan2(a[1] - c[1], a[0] - c[0]);
    const a2 = Math.atan2(b[1] - c[1], b[0] - c[0]);
    let d = a2 - a1;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const deg = Math.round(Math.abs(d) / D2R);
    ctx.save();
    ctx.strokeStyle = '#ffe680'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(c[0], c[1], 30, a1, a1 + d, d < 0); ctx.stroke();
    const mid = a1 + d / 2;
    const tx = c[0] + Math.cos(mid) * 52, ty = c[1] + Math.sin(mid) * 52;
    ctx.font = '800 18px ui-monospace, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(5,10,16,0.85)';
    ctx.fillRect(tx - 28, ty - 12, 56, 24);
    ctx.fillStyle = '#ffe680';
    ctx.fillText(deg + '°', tx, ty);
    ctx.restore();
    return deg;
  }

  // ------------------------------------------------------------------
  // BACK-VIEW (frontal plane) figure. Params in degrees / px.
  // ------------------------------------------------------------------
  const FRONT = {
    idle: { kind: 'hold', f: () => ({}), joints: ['shL', 'shR', 'hipL', 'hipR'], caption: () => 'Viewed from behind, the screen is the FRONTAL plane. ⊙ marks the sagittal (anteroposterior) axis pointing out of the screen.' },
    Abduction: { f: (k) => ({ armL: 90 * k, armR: 90 * k, legL: 22 * k, legR: 22 * k }), joints: ['shL', 'shR', 'hipL', 'hipR'],
      mus: { out: { deltoid: 'c', glutmed: 'c' }, back: { deltoid: 'e', glutmed: 'e' } },
      label: { out: 'limbs move AWAY from the midline → ABDUCTION (deltoid, gluteus medius: concentric)', back: 'lowering under control (deltoid working eccentrically)' } },
    Adduction: { f: (k) => ({ armL: 165 - 115 * k, armR: 165 - 115 * k, bar: true }), joints: ['shL', 'shR'],
      mus: { out: { lats: 'c' }, back: { lats: 'e' } },
      label: { out: 'pulling the bar down: arms move TOWARD the midline → ADDUCTION (latissimus dorsi: concentric)', back: 'returning (latissimus dorsi working eccentrically)' } },
    'Lateral flexion': { f: (k) => ({ trunk: 24 * k }), joints: ['spine'], mus: { out: { obliqueR: 'c' }, back: {} },
      label: { out: 'trunk bends SIDEWAYS → LATERAL FLEXION', back: 'returning upright' } },
    Elevation: { f: (k) => ({ elev: 14 * k }), joints: ['shL', 'shR'], label: { out: 'shoulders move UP → ELEVATION', back: 'shoulders move down (depression)' } },
    Depression: { f: (k) => ({ elev: 14 - 22 * k }), joints: ['shL', 'shR'], label: { out: 'shoulders move DOWN → DEPRESSION', back: 'returning' } },
    Inversion: { f: (k) => ({ legR: 10, footR: 26 * k, zoomFeet: true }), joints: ['ankR'], label: { out: 'sole turns INWARD → INVERSION (tibialis anterior)', back: 'returning' } },
    Eversion: { f: (k) => ({ legR: 10, footR: -22 * k, zoomFeet: true }), joints: ['ankR'], label: { out: 'sole turns OUTWARD → EVERSION (fibularis longus)', back: 'returning' } },
    'Radial deviation': { f: (k) => ({ armR: 30, handR: 22 * k }), joints: ['wrR'], label: { out: 'hand tilts toward the THUMB side → RADIAL DEVIATION', back: 'returning' } },
    'Ulnar deviation': { f: (k) => ({ armR: 30, handR: -28 * k }), joints: ['wrR'], label: { out: 'hand tilts toward the LITTLE-FINGER side → ULNAR DEVIATION', back: 'returning' } },
  };

  function drawFront(ctx, P, dir, mus, t) {
    const cx = CW / 2;
    const hipY = 232, shY = 132 - (P.elev || 0);
    const tr = (P.trunk || 0) * D2R;
    const col = (m) => (m ? MODE[m] : '#9b2d38');
    const rot = (x, y) => { const dx = x - cx, dy = y - hipY; return [cx + dx * Math.cos(tr) - dy * Math.sin(tr), hipY + dx * Math.sin(tr) + dy * Math.cos(tr)]; };
    const joints = {};
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // legs
    const leg = (side) => {
      const sgn = side === 'L' ? -1 : 1;
      const a = (P['leg' + side] || 0) * D2R;
      const hip = [cx + sgn * 26, hipY + 6];
      const knee = [hip[0] + sgn * Math.sin(a) * 90, hip[1] + Math.cos(a) * 90];
      const ank = [knee[0] + sgn * Math.sin(a) * 82, knee[1] + Math.cos(a) * 82];
      joints['hip' + side] = hip; joints['ank' + side] = ank;
      // muscles: gluteus medius (lateral hip), adductors (inner thigh)
      blob(ctx, [hip[0] + sgn * 14, hip[1] - 8], [hip[0] + sgn * 10 + sgn * Math.sin(a) * 30, hip[1] + Math.cos(a) * 30], 16, col(mus.glutmed));
      bone(ctx, hip, knee, 11); bone(ctx, knee, ank, 9);
      // foot seen from behind: heel + sole line, tilts with inversion/eversion
      const fa = (P['foot' + side] || 0) * D2R * -sgn;
      ctx.save(); ctx.translate(ank[0], ank[1] + 10); ctx.rotate(fa);
      ctx.fillStyle = '#59636e'; ctx.strokeStyle = '#161b22'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(-14, -8, 28, 16, 5); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-14, 8); ctx.lineTo(14, 8); ctx.stroke();
      ctx.restore();
      joint(ctx, hip, 7); joint(ctx, knee, 6); joint(ctx, ank, 5);
    };
    leg('L'); leg('R');
    // trunk
    const shL = rot(cx - 52, shY), shR = rot(cx + 52, shY);
    joints.shL = shL; joints.shR = shR; joints.spine = [cx, hipY - 30];
    ctx.fillStyle = '#4f5964'; ctx.strokeStyle = '#161b22'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(...rot(cx - 30, hipY + 10)); ctx.lineTo(...rot(cx + 30, hipY + 10)); ctx.lineTo(...rot(cx + 46, shY + 4)); ctx.lineTo(...rot(cx - 46, shY + 4)); ctx.closePath(); ctx.fill(); ctx.stroke();
    for (let y = hipY - 4; y > shY + 6; y -= 12) { const c = rot(cx, y); ctx.fillStyle = '#8d98a3'; ctx.beginPath(); ctx.arc(c[0], c[1], 5, 0, Math.PI * 2); ctx.fill(); }
    blob(ctx, rot(cx + 30, hipY - 10), rot(cx + 38, hipY - 60), 14, col(mus.obliqueR));
    blob(ctx, rot(cx - 30, hipY - 10), rot(cx - 38, hipY - 60), 14, col(mus.obliqueL));
    // lats
    blob(ctx, rot(cx - 20, hipY - 40), rot(cx - 46, shY + 20), 18, col(mus.lats));
    blob(ctx, rot(cx + 20, hipY - 40), rot(cx + 46, shY + 20), 18, col(mus.lats));
    // head (from behind)
    const hc = rot(cx, shY - 40);
    ctx.fillStyle = '#6b7682'; ctx.beginPath(); ctx.arc(hc[0], hc[1], 26, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3d4650'; ctx.beginPath(); ctx.arc(hc[0] - 24, hc[1], 7, 0, Math.PI * 2); ctx.arc(hc[0] + 24, hc[1], 7, 0, Math.PI * 2); ctx.fill();
    // arms
    const arm = (side) => {
      const sgn = side === 'L' ? -1 : 1;
      const a = (P['arm' + side] || 0) * D2R + tr * sgn * 0;
      const base = side === 'L' ? shL : shR;
      const dir = [sgn * Math.sin(a), Math.cos(a)];
      const rd = [dir[0] * Math.cos(tr) - dir[1] * Math.sin(tr), dir[0] * Math.sin(tr) + dir[1] * Math.cos(tr)];
      const el = [base[0] + rd[0] * 72, base[1] + rd[1] * 72];
      const wr = [el[0] + rd[0] * 66, el[1] + rd[1] * 66];
      joints['wr' + side] = wr;
      bone(ctx, base, el, 10); bone(ctx, el, wr, 8);
      // deltoid on the shoulder cap
      blob(ctx, [base[0] - sgn * 6, base[1] - 6], [base[0] + rd[0] * 34 + sgn * 4, base[1] + rd[1] * 34], 22, col(mus.deltoid));
      // hand: tilts toward thumb (radial = lateral in anatomical position) / little finger
      const ha = Math.atan2(rd[1], rd[0]) - Math.PI / 2 + sgn * (P['hand' + side] || 0) * D2R * -1;
      ctx.save(); ctx.translate(wr[0], wr[1]); ctx.rotate(ha);
      ctx.fillStyle = '#7d8893'; ctx.strokeStyle = '#161b22'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(-9, 0, 18, 26, 5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.arc(sgn * 11, 8, 4, 0, Math.PI * 2); ctx.fill(); // thumb (lateral)
      ctx.restore();
      joint(ctx, base, 8); joint(ctx, el, 6);
    };
    arm('L'); arm('R');
    if (P.bar) {
      const wl = joints.wrL, wr = joints.wrR;
      ctx.strokeStyle = '#cfd8e0'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(wl[0] - 20, wl[1] + 12); ctx.lineTo(wr[0] + 20, wr[1] + 12); ctx.stroke();
      ctx.strokeStyle = '#7a8a9c'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx, (wl[1] + wr[1]) / 2 + 12); ctx.lineTo(cx, 0); ctx.stroke();
    }
    ctx.restore();
    return joints;
  }

  // ------------------------------------------------------------------
  // TOP-DOWN (transverse plane) figure
  // ------------------------------------------------------------------
  const TOP = {
    idle: { kind: 'hold', f: () => ({}), joints: ['c'], caption: () => 'Looking down from above, the screen is the TRANSVERSE plane. ⊙ marks the longitudinal (vertical) axis pointing out of the screen.' },
    Rotation: { f: (k) => ({ trunk: 45 * k }), joints: ['c'], mus: { out: { oblique: 'c' }, back: { oblique: 'e' } }, label: { out: 'trunk turns about its long axis → ROTATION (obliques)', back: 'turning back' } },
    'Medial rotation': { f: (k) => ({ fore: -70 * k }), joints: ['elR'], mus: { out: { subscap: 'c' }, back: {} }, label: { out: 'elbow bent 90°: forearm swings IN toward the body → MEDIAL ROTATION at the shoulder', back: 'returning' } },
    'Lateral rotation': { f: (k) => ({ fore: 60 * k }), joints: ['elR'], mus: { out: { infra: 'c' }, back: {} }, label: { out: 'elbow bent 90°: forearm swings OUT, away from the body → LATERAL ROTATION', back: 'returning' } },
    'Horizontal abduction': { f: (k) => ({ hArm: 90 * k }), joints: ['shR'], mus: { out: { pdelt: 'c' }, back: { pec: 'c' } }, label: { out: 'raised arm swings OUT to the side → HORIZONTAL ABDUCTION (posterior deltoid)', back: 'swinging back in = horizontal adduction (pectoralis major)' } },
    'Horizontal adduction': { f: (k) => ({ hArm: 90 - 90 * k }), joints: ['shR'], mus: { out: { pec: 'c' }, back: { pdelt: 'c' } }, label: { out: 'raised arm swings IN across the chest → HORIZONTAL ADDUCTION (pectoralis major)', back: 'swinging out = horizontal abduction' } },
    Pronation: { f: (k) => ({ palm: 180 * k, hang: true }), joints: ['hand'], mus: { out: { pron: 'c' }, back: { sup: 'c' } }, label: { out: 'palm turns to face BACKWARD/DOWN → PRONATION (pronator teres)', back: 'turning back = supination' } },
    Supination: { f: (k) => ({ palm: 180 - 180 * k, hang: true }), joints: ['hand'], mus: { out: { sup: 'c' }, back: { pron: 'c' } }, label: { out: 'palm turns to face FORWARD/UP → SUPINATION (supinator, biceps brachii)', back: 'turning back = pronation' } },
  };

  function drawTop(ctx, P, dir, mus) {
    const Z = 1.25;
    const cx = CW / 2, cy = 225;
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(Z, Z); ctx.translate(-cx, -cy);
    const out = drawTopInner(ctx, P, dir, mus, cx, cy);
    ctx.restore();
    for (const k in out) out[k] = [cx + (out[k][0] - cx) * Z, cy + (out[k][1] - cy) * Z];
    return out;
  }
  function drawTopInner(ctx, P, dir, mus, cx, cy) {
    const col = (m) => (m ? MODE[m] : '#9b2d38');
    const tr = (P.trunk || 0) * D2R;
    const joints = { c: [cx, cy] };
    ctx.save();
    ctx.lineCap = 'round';
    // forward arrow
    ctx.fillStyle = 'rgba(160,220,255,0.5)'; ctx.font = '700 9px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('▲ FRONT', cx, 120);
    // hips (fixed)
    ctx.fillStyle = '#3a434d'; ctx.beginPath(); ctx.ellipse(cx, cy + 8, 48, 26, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(tr);
    // shoulders / trunk
    ctx.fillStyle = '#4f5964'; ctx.strokeStyle = '#161b22'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, 0, 92, 34, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    blob(ctx, [-50, 4], [-20, 22], 14, col(mus.oblique)); blob(ctx, [50, 4], [20, 22], 14, col(mus.oblique));
    blob(ctx, [24, -16], [66, -14], 18, col(mus.pec)); // pectoralis (front)
    blob(ctx, [60, 18], [86, 10], 14, col(mus.pdelt)); // posterior deltoid
    const shR = [86, 0], shL = [-86, 0];
    // left arm hanging (seen end-on)
    ctx.fillStyle = '#7d8893'; ctx.beginPath(); ctx.arc(shL[0] - 8, 0, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // right arm
    if (P.hang) {
      // arm hanging straight down: we look down its long axis at the hand
      ctx.fillStyle = '#7d8893'; ctx.beginPath(); ctx.arc(shR[0] + 8, 0, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      const hp = [shR[0] + 70, 0];
      ctx.strokeStyle = 'rgba(200,220,235,0.35)'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(shR[0] + 22, 0); ctx.lineTo(hp[0] - 30, 0); ctx.stroke(); ctx.setLineDash([]);
      ctx.save(); ctx.translate(hp[0], hp[1]); ctx.rotate((P.palm || 0) * D2R);
      ctx.fillStyle = '#5b6672'; ctx.strokeStyle = '#161b22';
      ctx.beginPath(); ctx.roundRect(-34, -11, 68, 22, 8); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffb347'; ctx.fillRect(-30, -11, 60, 6); // palm side faces "forward" when supinated
      ctx.fillStyle = '#7d8893'; ctx.beginPath(); ctx.arc(-38, -2, 7, 0, Math.PI * 2); ctx.fill(); // thumb
      ctx.restore();
      blob(ctx, [hp[0] - 26, 26], [hp[0] + 6, 30], 12, col(mus.pron));
      blob(ctx, [hp[0] - 26, -30], [hp[0] + 6, -26], 12, col(mus.sup));
      ctx.fillStyle = '#ffb347'; ctx.font = '700 12px system-ui'; ctx.fillText('palm', hp[0], -40);
      joints.hand = rotp(hp, tr, cx, cy);
    } else if (P.fore != null) {
      // upper arm hanging (end-on), elbow bent 90°: forearm points forward
      const el = [shR[0] + 6, 4];
      ctx.fillStyle = '#7d8893'; ctx.beginPath(); ctx.arc(el[0], el[1], 13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      blob(ctx, [56, -6], [80, -4], 12, col(mus.subscap));
      blob(ctx, [60, 20], [84, 14], 12, col(mus.infra));
      const a = (-90 + (P.fore || 0)) * D2R;
      const w = [el[0] + Math.cos(a) * 110, el[1] + Math.sin(a) * 110];
      bone(ctx, el, w, 10);
      ctx.fillStyle = '#7d8893'; ctx.beginPath(); ctx.arc(w[0], w[1], 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      joints.elR = rotp(el, tr, cx, cy);
    } else {
      // arm raised in front (shoulder flexed 90°), swings horizontally
      const a = (-90 + (P.hArm || 0)) * D2R;
      const el = [shR[0] + Math.cos(a) * 52, Math.sin(a) * 52];
      const w = [shR[0] + Math.cos(a) * 98, Math.sin(a) * 98];
      bone(ctx, shR, el, 12); bone(ctx, el, w, 10);
      ctx.fillStyle = '#7d8893'; ctx.beginPath(); ctx.arc(w[0], w[1], 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      joint(ctx, shR, 9);
    }
    joints.shR = rotp(shR, tr, cx, cy);
    // head with visor facing front
    ctx.fillStyle = '#6b7682'; ctx.strokeStyle = '#161b22'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, -4, 30, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#56e0ff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, -4, 26, -2.4, -0.74); ctx.stroke();
    ctx.restore();
    ctx.restore();
    return joints;
  }
  function rotp(p, a, cx, cy) { return [cx + p[0] * Math.cos(a) - p[1] * Math.sin(a), cy + p[0] * Math.sin(a) + p[1] * Math.cos(a)]; }

  // shared primitives
  function bone(ctx, a, b, w) {
    ctx.strokeStyle = '#1a2028'; ctx.lineWidth = w + 4; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    ctx.strokeStyle = '#aab5c0'; ctx.lineWidth = w; ctx.stroke();
  }
  function joint(ctx, c, r) {
    ctx.fillStyle = '#4c5763'; ctx.strokeStyle = '#c7d0d9'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(c[0], c[1], r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  function blob(ctx, a, b, w, color) {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L, ny = dx / L, k = w * 0.67;
    ctx.save();
    ctx.globalAlpha = 0.92;
    if (color !== '#9b2d38') { ctx.shadowColor = color; ctx.shadowBlur = 14; }
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]);
    ctx.bezierCurveTo(a[0] + dx * 0.25 + nx * k, a[1] + dy * 0.25 + ny * k, a[0] + dx * 0.75 + nx * k, a[1] + dy * 0.75 + ny * k, b[0], b[1]);
    ctx.bezierCurveTo(a[0] + dx * 0.75 - nx * k, a[1] + dy * 0.75 - ny * k, a[0] + dx * 0.25 - nx * k, a[1] + dy * 0.25 - ny * k, a[0], a[1]);
    ctx.fill();
    ctx.restore();
  }
  function axisGlyph(ctx, c, t) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 6);
    ctx.save();
    ctx.strokeStyle = `rgba(120,230,255,${0.55 + 0.4 * pulse})`; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.arc(c[0], c[1], 17 + 3 * pulse, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#bff4ff'; ctx.beginPath(); ctx.arc(c[0], c[1], 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // ==================================================================
  class Tutorial {
    constructor() {
      this.el = $('tutorial');
      this.canvas = $('tut-canvas');
      this.ctx = this.canvas.getContext('2d');
      this.android = new Android();
      this.opened = false;
      this.t = 0;
      $('tut-prev').addEventListener('click', () => this.go(this.page - 1));
      $('tut-next').addEventListener('click', () => {
        if (this.page < this.pages.length - 1) this.go(this.page + 1);
        else this.finish();
      });
      $('tut-close').addEventListener('click', () => this.close());
      $('tut-skip').addEventListener('click', () => this.finish(true));
      this.el.addEventListener('click', (e) => {
        const d = e.target.closest('[data-demo]');
        if (d) { this.setDemo(d.dataset.view || this.view, d.dataset.demo); this.markActive(d); }
        const m = e.target.closest('[data-muscle]');
        if (m) { this.focusMuscle = m.dataset.muscle; this.setDemo('side', 'idle'); this.focusMuscle = m.dataset.muscle; this.markActive(m); }
      });
    }

    show(levelId, opts) {
      this.level = levelId;
      this.opts = opts || {};
      this.plane = C.PLANES[levelId];
      this.T = C.TUTORIALS[levelId];
      this.view = levelId === 'sagittal' ? 'side' : levelId === 'frontal' ? 'front' : 'top';
      this.pages = [
        { id: 'planes', title: 'Planes & axes' },
        { id: 'moves', title: `Movements: ${this.plane.name.toLowerCase()}` },
        { id: 'contractions', title: 'Contraction types' },
        { id: 'muscles', title: 'Muscles' },
        { id: 'play', title: 'How to play' },
      ];
      const lv = C.LEVELS.find((l) => l.id === levelId);
      this.lv = lv;
      $('tut-kicker').textContent = `TUTORIAL & REVIEW · ${lv.title.toUpperCase()} · ${lv.tag}`;
      $('tut-print').href = `review-sheet.html?level=${levelId}`;
      $('tut-skip').classList.toggle('hidden', !(this.opts.preplay && lv.status === 'playable'));
      this.el.classList.remove('hidden');
      this.opened = true;
      this.go(0);
      if (!this.raf) { this.last = performance.now(); this.raf = requestAnimationFrame((n) => this.loop(n)); }
    }

    close() {
      this.el.classList.add('hidden');
      this.opened = false;
      if (this.opts.onClose) this.opts.onClose();
    }

    finish(skipped) {
      const playable = this.lv.status === 'playable';
      this.el.classList.add('hidden');
      this.opened = false;
      if (playable && this.opts.preplay && this.opts.onStart) this.opts.onStart(skipped);
      else if (this.opts.onClose) this.opts.onClose();
    }

    go(i) {
      this.page = Math.max(0, Math.min(this.pages.length - 1, i));
      const pg = this.pages[this.page];
      $('tut-title').textContent = pg.title;
      $('tut-nav').innerHTML = this.pages.map((p, k) => `<button class="${k === this.page ? 'on' : ''}" data-page="${k}">${k + 1}. ${p.title}</button>`).join('');
      $('tut-nav').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => this.go(+b.dataset.page)));
      $('tut-prev').disabled = this.page === 0;
      const last = this.page === this.pages.length - 1;
      const playable = this.lv.status === 'playable';
      $('tut-next').textContent = last ? (playable && this.opts.preplay ? 'Start the game ▶' : 'Done') : 'Next ▶';
      this.focusMuscle = null;
      $('tut-content').innerHTML = this['page_' + pg.id]();
      $('tut-content').scrollTop = 0;
      const first = $('tut-content').querySelector('[data-demo]');
      if (pg.id === 'contractions') this.setDemo('side', 'isotonic');
      else if (pg.id === 'moves' && first) { this.setDemo(first.dataset.view || this.view, first.dataset.demo); this.markActive(first); }
      else this.setDemo(this.view, 'idle');
    }

    markActive(el) {
      $('tut-content').querySelectorAll('.active').forEach((n) => n.classList.remove('active'));
      el.classList.add('active');
    }

    // ---------------- pages ----------------
    page_planes() {
      const cards = ['sagittal', 'frontal', 'transverse'].map((id) => {
        const p = C.PLANES[id];
        const cur = id === this.level;
        return `<div class="pcard ${cur ? 'cur' : ''}">
          ${cur ? '<span class="tag">THIS GAME</span>' : ''}
          ${SEHS.diagrams.planeSVG(id)}
          <h4>${p.name}${p.altName ? ` <small>(${p.altName})</small>` : ''}</h4>
          <div class="kv"><b>Divides the body into:</b> ${p.divides}</div>
          <div class="kv"><b>Axis:</b> ${C.AXIS_NAMES[id].join(' / ')}</div>
          <div class="kv mv">${p.movements.join(' · ')}</div>
        </div>`;
      }).join('');
      return `<p class="lead">Every movement happens in a <b>PLANE</b> (a flat surface the body part moves along) and turns about an <b>AXIS</b> (the line it rotates around). The axis passes through the joint at <b>90°</b> to the plane.</p>
        <div class="pcards">${cards}</div>
        <div class="callout warn">⚠ Watch the names: textbooks use different names for the same axis, and the game swaps between them. The <b>transverse AXIS</b> is another name for the frontal axis. It is <b>not</b> the transverse PLANE.</div>
        <div class="callout">${this.T.camera}</div>`;
    }

    page_moves() {
      const card = (m, view) => `<button class="mv-card" data-demo="${m}"${view ? ` data-view="${view}"` : ''}>
          <b>${m}</b><span>${C.MOVEMENT_DEFS[m]}.</span><i>e.g. ${C.MOVEMENT_EXAMPLES[m]}</i><em>▶ show me</em></button>`;
      const others = ['sagittal', 'frontal', 'transverse'].filter((id) => id !== this.level).map((id) => `<div><b>${C.PLANES[id].name}</b> <small>(${C.AXIS_NAMES[id].join(' / ')})</small><br>${C.PLANES[id].movements.join(' · ')}</div>`).join('');
      let cross = '';
      if (this.T.crossPlane) {
        const x = this.T.crossPlane;
        cross = `<h5 class="sub">${x.title}</h5><div class="callout">${x.text}</div><div class="mv-grid">${x.demos.map((m) => card(m, 'top')).join('')}</div>`;
      }
      return `<p class="lead">In the <b>${this.plane.name.toLowerCase()}</b> joints move about the <b>${C.AXIS_NAMES[this.level].join(' / ')}</b>. Click a movement to see it.</p>
        <div class="mv-grid">${this.T.demos.map((m) => card(m)).join('')}</div>
        ${cross}
        <h5 class="sub">Movements from the OTHER planes${this.level === 'sagittal' ? ' (choosing these in Factory Escape causes a malfunction)' : ''}</h5>
        <div class="others">${others}</div>`;
    }

    page_contractions() {
      const K = C.CONTRACTIONS;
      const leaf = (k) => `<button class="node leaf" data-demo="${k}" data-view="side" style="--c:${K[k].color}">
          <span class="chip" style="--c:${K[k].color}">${K[k].letter}</span><b>${K[k].name}</b><span>${K[k].def}</span><i>e.g. ${K[k].example}</i></button>`;
      return `<p class="lead">A muscle can produce force in three ways. Click each type to see it in a biceps curl. In the game, the colours show which type is happening.</p>
        <div class="tree">
          <div class="node root">Muscle contraction</div>
          <div class="branches">
            <div class="branch">
              <button class="node mid" data-demo="isotonic" data-view="side"><b>ISOTONIC</b><span>${C.ISOTONIC.def}</span><em>▶ show a full curl</em></button>
              <div class="leaves">${leaf('concentric')}${leaf('eccentric')}</div>
            </div>
            <div class="branch">
              <div class="node mid static"><b>STATIC</b><span>The muscle stays the same length and the joint does not move.</span></div>
              <div class="leaves">${leaf('isometric')}</div>
            </div>
          </div>
        </div>
        <button class="mv-card wide" data-demo="landing" data-view="side"><b>Real-world example: landing from a jump</b><span>The knees FLEX, but the quadriceps are working while they lengthen, so it is ECCENTRIC. Movement type and contraction type are two different questions!</span><em>▶ show me</em></button>`;
    }

    page_muscles() {
      const ids = C.LEVEL_MUSCLES[this.level];
      const onRig = this.level === 'sagittal';
      const rows = ids.map((id) => {
        const m = C.MUSCLES[id];
        return `<tr ${onRig ? `data-muscle="${id}" class="click"` : ''}><td><b>${m.name}</b></td><td>${m.where}</td><td>${m.action}</td></tr>`;
      }).join('');
      return `<p class="lead">${onRig ? 'These are the muscles built into the android. <b>Click a row</b> to find the muscle on the android.' : 'These muscles drive the movements in this plane.'}</p>
        <table class="mtable"><tr><th>Muscle</th><th>Where</th><th>Main action</th></tr>${rows}</table>`;
    }

    page_play() {
      const st = this.lv.status;
      const note = st === 'playable' ? '' : st === 'design' ? '<div class="callout warn">This level is still being built. Use this tutorial as review for now.</div>' : '<div class="callout warn">This level is PAUSED in development. Use this tutorial as review only.</div>';
      return `${note}<ul class="play">${this.T.play.map((p) => `<li>${p}</li>`).join('')}</ul>
        <div class="callout">The axis name in the top-left corner switches between its different names every few seconds. Learn all of them.</div>
        ${st === 'playable' ? '<p class="dim"><kbd>1</kbd>–<kbd>4</kbd> choose · <kbd>P</kbd> pause / reference · <kbd>L</kbd> muscle labels · <kbd>M</kbd> sound · <kbd>R</kbd> reboot</p>' : ''}`;
    }

    // ---------------- demo canvas ----------------
    setDemo(view, key) {
      const table = view === 'side' ? SIDE : view === 'front' ? FRONT : TOP;
      if (!table[key]) { view = this.view; key = 'idle'; }
      this.demo = { view, key, def: (view === 'side' ? SIDE : view === 'front' ? FRONT : TOP)[key], t: 0 };
      this.android.reset();
    }

    loop(now) {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      if (this.opened && this.demo) { this.demo.t += dt; this.t += dt; this.drawDemo(dt); }
      this.raf = requestAnimationFrame((n) => this.loop(n));
    }

    drawDemo(dt) {
      const ctx = this.ctx;
      const d = this.demo, def = d.def;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const g = ctx.createLinearGradient(0, 0, 0, CH);
      g.addColorStop(0, '#0d1620'); g.addColorStop(1, '#16212d');
      ctx.fillStyle = g; ctx.fillRect(0, 0, CW, CH);
      // grid = "the plane of the screen"
      ctx.strokeStyle = 'rgba(86,224,255,0.06)'; ctx.lineWidth = 1;
      for (let x = 0; x < CW; x += 26) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CH); ctx.stroke(); }
      for (let y = 0; y < CH; y += 26) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CW, y); ctx.stroke(); }
      ctx.fillStyle = 'rgba(120,200,240,0.55)'; ctx.font = '700 11px ui-monospace, monospace';
      const vname = d.view === 'side' ? 'SIDE VIEW · SCREEN = SAGITTAL PLANE' : d.view === 'front' ? 'BACK VIEW · SCREEN = FRONTAL PLANE' : 'TOP VIEW · SCREEN = TRANSVERSE PLANE';
      ctx.fillText(vname, 12, 20);

      const ph = phase(d.t, def.kind === 'oneway' ? 2.6 : 3.6, def.kind);
      let caption = '';
      if (d.view === 'side') caption = this.drawSide(ctx, def, ph, dt);
      else {
        const P = def.f(ph.k);
        const m = def.mus ? (ph.dir === 'out' ? def.mus.out : ph.dir === 'back' ? def.mus.back : {}) || {} : {};
        const joints = d.view === 'front' ? drawFront(ctx, P, ph.dir, m, d.t) : drawTop(ctx, P, ph.dir, m, d.t);
        (def.joints || []).forEach((j) => joints[j] && axisGlyph(ctx, joints[j], this.t));
        caption = def.caption ? def.caption() : `${d.key}: ${ph.dir === 'back' ? def.label.back : def.label.out}`;
      }
      $('tut-caption').innerHTML = caption;
    }

    drawSide(ctx, def, ph, dt) {
      const S = 1.0;
      let p = lerpPose(def.a, def.b, ph.k);
      if (def.tremble) p = jitterPose(p, 0.8, ['elN']);
      const musKey = ph.dir === 'out' ? 'out' : ph.dir === 'back' ? 'back' : 'hold';
      p.mus = def[musKey] || (musKey === 'hold' ? def.hold : null) || null;
      if (this.focusMuscle) p.mus = { [this.focusMuscle]: ['c', 1] };
      this.android.update(p, dt);
      const hipX = 255 / S;
      const floor = 428 / S;
      const hipY = floor - Android.lowestRel(p);
      ctx.save();
      ctx.scale(S, S);
      ctx.strokeStyle = '#7a8a9c'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, floor); ctx.lineTo(CW / S, floor); ctx.stroke();
      const r = this.android.draw(ctx, p, hipX, hipY, {
        highlight: { joints: def.joints || [], arrows: false },
        neutral: !!this.focusMuscle,
        labels: this.focusMuscle ? 'all' : null,
        labelOnly: this.focusMuscle,
      });
      if (def.dumbbell) {
        const f = r.N.fore, h = r.N.hand;
        ctx.save(); ctx.translate(h[0], h[1]); ctx.rotate(Math.atan2(f.u[1], f.u[0]));
        ctx.fillStyle = '#2b3138'; ctx.fillRect(-4, -26, 8, 52);
        ctx.fillStyle = '#4a525c'; ctx.fillRect(-12, -36, 24, 14); ctx.fillRect(-12, 22, 24, 14);
        ctx.restore();
      }
      let degTxt = '';
      if (!this.focusMuscle) (def.angle || []).forEach((j) => { const pts = jointAngle(r, j); const deg = drawAngle(ctx, pts[0], pts[1], pts[2]); degTxt += `${j} angle <b>${deg}°</b> · `; });
      ctx.restore();
      if (this.focusMuscle) {
        const m = C.MUSCLES[this.focusMuscle];
        return `<b>${m.name}</b>: ${m.where}. Main action: ${m.action}.`;
      }
      if (def.caption) return def.caption();
      const lbl = ph.dir === 'back' ? def.label.back : def.label.out;
      return `${def.pre ? def.pre + '<br>' : ''}${degTxt}${lbl}`;
    }
  }

  SEHS.Tutorial = Tutorial;
})();
