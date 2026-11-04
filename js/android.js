/*
 * android.js: ANATOMICAL ANDROID RIG (side view / sagittal plane)
 * -----------------------------------------------------------------
 * Owned by the "anatomy-animator" agent.
 *
 * Conventions (all angles in DEGREES inside a pose):
 *   lean    trunk forward lean (+ = top of trunk forward)
 *   rot     whole-body roll about the hip (+ = forward roll)
 *   hipX    hip flexion (+) / extension (-), thigh relative to trunk
 *   kneeX   knee flexion (+). Negative = hyperextension (damage state)
 *   ankleX  dorsiflexion (+) / plantarflexion (-)
 *   shX     shoulder flexion (+) / extension (-), arm relative to trunk
 *   elX     elbow flexion (+)
 *   X = N (near side, drawn in front) or F (far side, drawn dimmed)
 *
 * Muscles are drawn between ORIGIN -> (via point) -> INSERTION attached
 * to bone segments, so they stretch/shorten with the skeleton. Belly
 * width swells in small steps with activation and shortening; colour
 * shows the contraction type (concentric / eccentric / isometric).
 */
(function () {
  'use strict';
  const SEHS = (window.SEHS = window.SEHS || {});
  const D2R = Math.PI / 180;
  const S = 1.6; // global scale of the android
  const DIM = { torso: 60, neck: 9, headR: 15, thigh: 47, shank: 45, foot: 21, heel: 7, upper: 33, fore: 30, hand: 9, shoulderT: 0.86 };
  const POSE_KEYS = ['lean', 'rot', 'hipN', 'kneeN', 'ankleN', 'hipF', 'kneeF', 'ankleF', 'shN', 'elN', 'shF', 'elF', 'head'];
  const BASE = { lean: 4, rot: 0, hipN: 0, kneeN: 4, ankleN: 0, hipF: 0, kneeF: 4, ankleF: 0, shN: 4, elN: 12, shF: -4, elF: 12, head: 0 };

  // ---------------- pose helpers ----------------
  function mk(o) {
    const p = Object.assign({}, BASE);
    if (!o) return p;
    if (o.legs) { [p.hipN, p.kneeN, p.ankleN] = o.legs; [p.hipF, p.kneeF, p.ankleF] = o.legs; }
    if (o.legN) [p.hipN, p.kneeN, p.ankleN] = o.legN;
    if (o.legF) [p.hipF, p.kneeF, p.ankleF] = o.legF;
    if (o.arms) { [p.shN, p.elN] = o.arms; [p.shF, p.elF] = o.arms; }
    if (o.armN) [p.shN, p.elN] = o.armN;
    if (o.armF) [p.shF, p.elF] = o.armF;
    for (const k of ['lean', 'rot', 'head']) if (o[k] !== undefined) p[k] = o[k];
    if (o.mus) p.mus = o.mus;
    if (o.lenMul) p.lenMul = o.lenMul;
    return p;
  }
  function clonePose(a) {
    const o = Object.assign({}, a);
    if (a.lenMul) o.lenMul = Object.assign({}, a.lenMul);
    return o;
  }
  function lerpPose(a, b, t) {
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const o = {};
    for (const k of POSE_KEYS) o[k] = a[k] + (b[k] - a[k]) * t;
    o.mus = t < 0.5 ? a.mus : b.mus;
    if (a.lenMul || b.lenMul) {
      o.lenMul = {};
      const keys = new Set(Object.keys(a.lenMul || {}).concat(Object.keys(b.lenMul || {})));
      keys.forEach((k) => {
        const va = a.lenMul && a.lenMul[k] != null ? a.lenMul[k] : 1;
        const vb = b.lenMul && b.lenMul[k] != null ? b.lenMul[k] : 1;
        o.lenMul[k] = va + (vb - va) * t;
      });
    }
    return o;
  }
  function jitterPose(p, amt, keys) {
    const o = clonePose(p);
    (keys || POSE_KEYS).forEach((k) => { if (k !== 'rot') o[k] += (Math.random() - 0.5) * 2 * amt; });
    return o;
  }

  // ---------------- skeleton / kinematics ----------------
  function seg(P, ang, L) {
    const u = [Math.sin(ang), Math.cos(ang)];
    return { P, u, n: [Math.cos(ang), -Math.sin(ang)], L, ang, D: [P[0] + u[0] * L, P[1] + u[1] * L] };
  }
  const SIDE_OFF = { N: { hip: [2, 0], sh: [2, 0] }, F: { hip: [-3, 1], sh: [-4, 1] } };

  function rig(p, hx, hy) {
    const lp = (p.lean + p.rot) * D2R;
    const lm = p.lenMul || {};
    const tu = [Math.sin(lp), -Math.cos(lp)];
    const tn = [Math.cos(lp), Math.sin(lp)];
    const TL = DIM.torso * S;
    const torso = { P: [hx, hy], u: tu, n: tn, L: TL, D: [hx + tu[0] * TL, hy + tu[1] * TL] };
    // torso-frame point: f = forward (anterior) offset, up = distance up the trunk (unscaled units)
    const tp = (f, up) => [hx + tn[0] * f * S + tu[0] * up * S, hy + tn[1] * f * S + tu[1] * up * S];
    const R = { torso, lp, tp, N: {}, F: {} };
    for (const s of ['N', 'F']) {
      const L = R[s];
      const ho = SIDE_OFF[s].hip;
      const hp = tp(ho[0], ho[1]);
      const legM = lm['leg' + s] != null ? lm['leg' + s] : 1;
      L.thigh = seg(hp, p['hip' + s] * D2R - lp, DIM.thigh * S * legM);
      L.shank = seg(L.thigh.D, L.thigh.ang - p['knee' + s] * D2R, DIM.shank * S * legM);
      L.foot = seg(L.shank.D, L.shank.ang + Math.PI / 2 + p['ankle' + s] * D2R, DIM.foot * S * legM);
      L.heel = [L.foot.P[0] - L.foot.u[0] * DIM.heel * S, L.foot.P[1] - L.foot.u[1] * DIM.heel * S];
      L.toe = L.foot.D;
      const so = SIDE_OFF[s].sh;
      const sp0 = [torso.P[0] + tu[0] * TL * DIM.shoulderT, torso.P[1] + tu[1] * TL * DIM.shoulderT];
      const sp = [sp0[0] + tn[0] * so[0] * S, sp0[1] + tn[1] * so[0] * S + so[1] * S];
      const armM = lm['arm' + s] != null ? lm['arm' + s] : 1;
      L.upper = seg(sp, p['sh' + s] * D2R - lp, DIM.upper * S * armM);
      L.fore = seg(L.upper.D, L.upper.ang + p['el' + s] * D2R, DIM.fore * S * armM);
      L.hand = [L.fore.D[0] + L.fore.u[0] * DIM.hand * S * 0.7, L.fore.D[1] + L.fore.u[1] * DIM.hand * S * 0.7];
      L.torso = torso;
    }
    const ha = lp + (p.head || 0) * D2R;
    const hc = [torso.D[0] + tu[0] * (DIM.neck + DIM.headR) * S, torso.D[1] + tu[1] * (DIM.neck + DIM.headR) * S];
    R.head = { c: hc, ang: ha, r: DIM.headR * S };
    R.headTop = [hc[0] + tu[0] * DIM.headR * S, hc[1] + tu[1] * DIM.headR * S];
    R.pelvisLow = tp(0, -9);
    return R;
  }

  function at(sg, t, off) {
    return [sg.P[0] + sg.u[0] * sg.L * t + sg.n[0] * off * S, sg.P[1] + sg.u[1] * sg.L * t + sg.n[1] * off * S];
  }
  function lowestRel(p) {
    const r = rig(p, 0, 0);
    let m = r.pelvisLow[1];
    for (const s of ['N', 'F']) {
      const L = r[s];
      m = Math.max(m, L.heel[1], L.toe[1], L.foot.P[1], L.shank.P[1]);
    }
    return m;
  }
  function handRel(p, side) {
    return rig(p, 0, 0)[side || 'N'].hand;
  }
  function headTopRel(p) {
    const r = rig(p, 0, 0);
    return Math.min(r.headTop[1], r.head.c[1] - r.head.r);
  }

  // ---------------- muscle definitions ----------------
  // pts: [segment, t along bone (0 = proximal joint), offset (+ anterior / - posterior)]
  // belly: fraction of pts[0]->pts[1] covered by the fleshy belly (rest is tendon)
  const MUSCLES = [
    // lower limb (deep -> superficial)
    { id: 'soleus', limb: 'leg', w: 6, pts: [['shank', 0.25, -3], ['shank', 0.8, -4.5], ['foot', -0.33, -1]], belly: [0.05, 0.95] },
    { id: 'gastrocnemius', limb: 'leg', w: 10, pts: [['thigh', 0.94, -4], ['shank', 0.6, -6.5], ['foot', -0.35, -1]], belly: [0.1, 0.96] },
    { id: 'tibialis_anterior', limb: 'leg', w: 6, pts: [['shank', 0.12, 4], ['shank', 0.8, 4], ['foot', 0.42, 1]], belly: [0.05, 0.92] },
    { id: 'hamstrings', limb: 'leg', w: 10, pts: [['torso', -0.03, -8], ['thigh', 0.9, -6], ['shank', 0.1, -4]], belly: [0.14, 0.9] },
    { id: 'quadriceps', limb: 'leg', w: 13, pts: [['torso', 0.0, 7], ['thigh', 1.0, 7], ['shank', 0.13, 5]], belly: [0.12, 0.86] },
    { id: 'iliopsoas', limb: 'leg', w: 6, pts: [['torso', 0.32, 2], ['thigh', 0.15, 2]], belly: [0.12, 0.8] },
    { id: 'gluteus_maximus', limb: 'leg', w: 12, pts: [['torso', 0.1, -10], ['thigh', 0.3, -5]], belly: [0.04, 0.9] },
    // upper limb
    { id: 'latissimus_dorsi', limb: 'arm', w: 10, pts: [['torso', 0.3, -9], ['upper', 0.15, 0]], belly: [0.0, 0.85] },
    { id: 'pectoralis_major', limb: 'arm', w: 10, pts: [['torso', 0.72, 8], ['upper', 0.2, 3]], belly: [0.0, 0.85] },
    { id: 'brachialis', limb: 'arm', w: 6, pts: [['upper', 0.5, 3], ['fore', 0.1, 2]], belly: [0.05, 0.85] },
    { id: 'brachioradialis', limb: 'arm', w: 6, pts: [['upper', 0.78, 4], ['fore', 0.85, 2]], belly: [0.05, 0.6] },
    { id: 'biceps_brachii', limb: 'arm', w: 9, pts: [['upper', -0.03, 3], ['upper', 0.95, 6], ['fore', 0.12, 3]], belly: [0.18, 0.88] },
    { id: 'triceps_brachii', limb: 'arm', w: 10, pts: [['upper', -0.03, -3], ['upper', 0.95, -5], ['fore', -0.08, -2]], belly: [0.12, 0.86] },
    { id: 'deltoid_posterior', limb: 'arm', w: 9, pts: [['torso', 0.93, -6], ['upper', 0.42, -3]], belly: [0.0, 0.95] },
    { id: 'deltoid_anterior', limb: 'arm', w: 9, pts: [['torso', 0.92, 6], ['upper', 0.42, 3]], belly: [0.0, 0.95] },
  ];
  const LEG_MUSCLES = MUSCLES.filter((m) => m.limb === 'leg');
  const ARM_MUSCLES = MUSCLES.filter((m) => m.limb === 'arm');

  function musclePoints(m, R, s) {
    const L = R[s];
    return m.pts.map(([sg, t, off]) => at(L[sg], t, off));
  }
  function pathLen(pts) {
    let d = 0;
    for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    return d;
  }

  // ---------------- colour helpers ----------------
  function hex(c) {
    const n = parseInt(c.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(a, b, t) {
    const A = hex(a), B = hex(b);
    return `rgb(${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(A[1] + (B[1] - A[1]) * t)},${Math.round(A[2] + (B[2] - A[2]) * t)})`;
  }
  function mixHex(a, b, t) {
    const A = hex(a), B = hex(b);
    const h = (v) => Math.round(v).toString(16).padStart(2, '0');
    return '#' + h(A[0] + (B[0] - A[0]) * t) + h(A[1] + (B[1] - A[1]) * t) + h(A[2] + (B[2] - A[2]) * t);
  }
  const MODE_COLOR = { c: '#ff6a3d', e: '#4ea8ff', i: '#ffc53d' };
  const MUSCLE_BASE = '#9b2d38';
  const DARK = '#0b0f15';

  // ---------------- sprite skin (optional, see js/sprites.js) ----------------
  // Draws an image part so that its pivot (proximal joint) lands on A and its
  // tip (distal joint) lands on B: rotation + uniform scale from the bone.
  function drawPart(ctx, part, A, B, dim) {
    const img = part.img;
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const P = [part.pivot[0] * iw, part.pivot[1] * ih], T = [part.tip[0] * iw, part.tip[1] * ih];
    const li = Math.hypot(T[0] - P[0], T[1] - P[1]) || 1;
    const ls = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const rot = Math.atan2(B[1] - A[1], B[0] - A[0]) - Math.atan2(T[1] - P[1], T[0] - P[0]);
    ctx.save();
    ctx.translate(A[0], A[1]);
    ctx.rotate(rot);
    const k = ls / li;
    ctx.scale(k, k);
    if (dim) { ctx.globalAlpha *= 1 - dim * 0.35; ctx.filter = `brightness(${(1 - dim * 0.75).toFixed(2)})`; }
    ctx.drawImage(img, -P[0], -P[1]);
    ctx.restore();
    if (SEHS.Sprites && SEHS.Sprites.debug) {
      ctx.fillStyle = '#0f0'; ctx.fillRect(A[0] - 2, A[1] - 2, 4, 4);
      ctx.fillStyle = '#f0f'; ctx.fillRect(B[0] - 2, B[1] - 2, 4, 4);
    }
  }

  // ---------------- Android class ----------------
  class Android {
    constructor() {
      this.state = {};
      const r = rig(mk(), 0, 0);
      for (const m of MUSCLES) {
        for (const s of ['N', 'F']) {
          const L = pathLen(musclePoints(m, r, s));
          this.state[m.id + s] = { rest: L, len: L, disp: 0, q: 0, mode: 'c' };
        }
      }
      this.time = 0;
    }

    reset() {
      for (const k in this.state) { this.state[k].disp = 0; this.state[k].q = 0; }
    }

    update(p, dt) {
      this.time += dt;
      const r = rig(p, 0, 0);
      for (const m of MUSCLES) {
        for (const s of ['N', 'F']) {
          const st = this.state[m.id + s];
          const L = pathLen(musclePoints(m, r, s));
          const rate = dt > 0.0001 ? (L - st.len) / dt / st.rest : 0;
          st.len = L;
          let target = 0, mode = st.mode;
          const ov = p.mus && (p.mus[m.id + ':' + s] || p.mus[m.id]);
          if (ov) { mode = ov[0]; target = ov[1]; }
          else if (rate < -0.05) { target = Math.min(1, -rate * 0.9); mode = 'c'; }
          if (target > 0.02) st.mode = mode;
          st.disp += (target - st.disp) * Math.min(1, dt * 9);
          // swelling happens in small visible increments
          st.q = Math.round(st.disp * 8) / 8;
        }
      }
    }

    // Near-side muscles sorted by activation (for the HUD monitor)
    activeList(min) {
      const out = [];
      for (const m of MUSCLES) {
        const st = this.state[m.id + 'N'];
        if (st.q >= (min || 0.25)) out.push({ id: m.id, q: st.q, mode: st.mode });
      }
      return out.sort((a, b) => b.q - a.q);
    }

    // Screen positions of named near-side joints (for FX + highlights)
    joints(p, x, y) {
      const r = rig(p, x, y);
      const N = r.N;
      return {
        hip: N.thigh.P, knee: N.shank.P, ankle: N.foot.P, toe: N.toe, heel: N.heel,
        shoulder: N.upper.P, elbow: N.fore.P, hand: N.hand, head: r.head.c,
        kneeF: r.F.shank.P, ankleF: r.F.foot.P, handF: r.F.hand, chest: r.tp(2, DIM.torso * 0.6),
      };
    }

    draw(ctx, p, x, y, o) {
      o = o || {};
      const r = rig(p, x, y);
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      // far side (dimmed, behind)
      this.drawArm(ctx, r, 'F', o, 0.55);
      this.drawLeg(ctx, r, 'F', o, 0.55);
      // trunk and head
      this.drawTorso(ctx, r, o);
      this.drawHead(ctx, r, o);
      // near side
      this.drawLeg(ctx, r, 'N', o, 0);
      this.drawArm(ctx, r, 'N', o, 0);
      if (o.highlight) this.drawHighlights(ctx, r, o.highlight);
      if (o.labels) this.drawLabels(ctx, r, o);
      ctx.restore();
      return r;
    }

    bone(ctx, a, b, w, dim) {
      ctx.strokeStyle = mix('#1a2028', DARK, dim);
      ctx.lineWidth = w + 3;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      ctx.strokeStyle = mix('#aab5c0', DARK, dim);
      ctx.lineWidth = w;
      ctx.stroke();
      ctx.strokeStyle = mix('#e3e9ef', DARK, dim);
      ctx.lineWidth = Math.max(1, w * 0.25);
      ctx.stroke();
    }

    joint(ctx, c, rad, dim) {
      ctx.fillStyle = mix('#4c5763', DARK, dim);
      ctx.beginPath(); ctx.arc(c[0], c[1], rad, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = mix('#c7d0d9', DARK, dim);
      ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = mix('#1b222b', DARK, dim);
      ctx.beginPath(); ctx.arc(c[0], c[1], rad * 0.4, 0, Math.PI * 2); ctx.fill();
    }

    drawLeg(ctx, r, s, o, dim) {
      const L = r[s];
      const sk = o.skin;
      if (sk && sk.thigh && sk.shank && sk.foot) {
        drawPart(ctx, sk.thigh, L.thigh.P, L.thigh.D, dim);
        drawPart(ctx, sk.shank, L.shank.P, L.shank.D, dim);
        drawPart(ctx, sk.foot, L.foot.P, L.toe, dim);
        for (const m of LEG_MUSCLES) this.drawMuscle(ctx, m, r, s, o, dim);
        return;
      }
      this.bone(ctx, L.thigh.P, L.thigh.D, 6.5 * S, dim);
      this.bone(ctx, L.shank.P, L.shank.D, 5.5 * S, dim);
      // foot
      ctx.fillStyle = mix('#59636e', DARK, dim);
      ctx.strokeStyle = mix('#1a2028', DARK, dim);
      ctx.lineWidth = 2;
      const f = L.foot, hl = L.heel, toe = L.toe;
      ctx.beginPath();
      ctx.moveTo(hl[0] + f.n[0] * 5 * S, hl[1] + f.n[1] * 5 * S);
      ctx.lineTo(f.P[0] + f.n[0] * 6 * S, f.P[1] + f.n[1] * 6 * S);
      ctx.lineTo(toe[0] + f.n[0] * 2 * S, toe[1] + f.n[1] * 2 * S);
      ctx.lineTo(toe[0] - f.n[0] * 2 * S + f.u[0] * 2, toe[1] - f.n[1] * 2 * S + f.u[1] * 2);
      ctx.lineTo(hl[0] - f.n[0] * 2 * S, hl[1] - f.n[1] * 2 * S);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      this.joint(ctx, L.thigh.P, 5 * S, dim);
      this.joint(ctx, L.shank.P, 4.2 * S, dim);
      this.joint(ctx, L.foot.P, 3.4 * S, dim);
      for (const m of LEG_MUSCLES) this.drawMuscle(ctx, m, r, s, o, dim);
    }

    drawArm(ctx, r, s, o, dim) {
      const L = r[s];
      const sk = o.skin;
      if (sk && sk.upper_arm && sk.forearm && sk.hand) {
        drawPart(ctx, sk.upper_arm, L.upper.P, L.upper.D, dim);
        drawPart(ctx, sk.forearm, L.fore.P, L.fore.D, dim);
        for (const m of ARM_MUSCLES) this.drawMuscle(ctx, m, r, s, o, dim);
        const f = L.fore;
        drawPart(ctx, sk.hand, f.D, [f.D[0] + f.u[0] * DIM.hand * S, f.D[1] + f.u[1] * DIM.hand * S], dim);
        return;
      }
      this.bone(ctx, L.upper.P, L.upper.D, 5 * S, dim);
      this.bone(ctx, L.fore.P, L.fore.D, 4.2 * S, dim);
      for (const m of ARM_MUSCLES) this.drawMuscle(ctx, m, r, s, o, dim);
      // hand (fist)
      ctx.fillStyle = mix('#7d8893', DARK, dim);
      ctx.strokeStyle = mix('#1a2028', DARK, dim);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(L.hand[0], L.hand[1], 4.6 * S, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      this.joint(ctx, L.upper.P, 4.6 * S, dim);
      this.joint(ctx, L.fore.P, 3.6 * S, dim);
    }

    drawTorso(ctx, r, o) {
      const tp = r.tp;
      const status = o.status || 'ok';
      if (o.skin && o.skin.torso) {
        drawPart(ctx, o.skin.torso, r.torso.P, r.torso.D, 0);
        this.drawCore(ctx, tp(3, 44), status);
        return;
      }
      // pelvis
      ctx.fillStyle = '#4f5964';
      ctx.strokeStyle = '#161b22';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      const pel = [[-13, 4], [9, 7], [12, -6], [3, -12], [-12, -9]];
      pel.forEach((q, i) => { const pt = tp(q[0], q[1]); i ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1]); });
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // spine
      for (let d = 6; d < DIM.torso * 0.98; d += 6.5) {
        const c = tp(-7, d);
        ctx.fillStyle = '#8d98a3';
        ctx.beginPath(); ctx.arc(c[0], c[1], 2.8 * S, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#1b222b'; ctx.lineWidth = 1.2; ctx.stroke();
      }
      // chest shell (translucent)
      ctx.fillStyle = 'rgba(40,55,70,0.75)';
      ctx.strokeStyle = '#1b222b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const shell = [[-8, 26], [6, 24], [11, 36], [11, 52], [6, 58], [-8, 58]];
      shell.forEach((q, i) => { const pt = tp(q[0], q[1]); i ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1]); });
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // ribs
      ctx.strokeStyle = '#9aa5b1';
      ctx.lineWidth = 1.6 * S * 0.7;
      for (let i = 0; i < 5; i++) {
        const d = 30 + i * 5.5;
        const a = tp(-7, d), b = tp(4, d + 3), c = tp(10, d - 1);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(b[0], b[1], c[0], c[1]); ctx.stroke();
      }
      // abdomen mesh
      ctx.strokeStyle = 'rgba(120,200,255,0.25)';
      ctx.lineWidth = 1;
      for (let d = 8; d < 26; d += 4) {
        const a = tp(-6, d), b = tp(8, d);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
      this.drawCore(ctx, tp(3, 44), status);
      // neck
      const n0 = r.torso.D;
      const tu = r.torso.u;
      for (let i = 0; i < 2; i++) {
        const c = [n0[0] + tu[0] * (3 + i * 5) * S, n0[1] + tu[1] * (3 + i * 5) * S];
        ctx.fillStyle = '#7f8a95';
        ctx.beginPath(); ctx.arc(c[0], c[1], 3.4 * S, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#1b222b'; ctx.lineWidth = 1.4; ctx.stroke();
      }
    }

    drawCore(ctx, core, status) {
      const pulse = 0.6 + 0.4 * Math.sin(this.time * (status === 'ok' ? 4 : 18));
      const cc = status === 'ok' ? '#56e0ff' : status === 'warn' ? '#ffb020' : '#ff3040';
      ctx.save();
      ctx.shadowColor = cc; ctx.shadowBlur = 14 * pulse;
      ctx.fillStyle = cc;
      ctx.globalAlpha = 0.5 + 0.5 * pulse;
      ctx.beginPath(); ctx.arc(core[0], core[1], 4.2 * S, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    drawHead(ctx, r, o) {
      const h = r.head;
      const status = o.status || 'ok';
      const vcol = o.visor && status === 'ok' ? o.visor : status === 'ok' ? '#56e0ff' : status === 'warn' ? '#ffb020' : '#ff3040';
      if (o.skin && o.skin.head) {
        drawPart(ctx, o.skin.head, r.torso.D, r.headTop, 0);
        // status light over the sprite's eye so failures still read clearly
        ctx.save();
        ctx.translate(h.c[0], h.c[1]); ctx.rotate(h.ang);
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = vcol; ctx.globalAlpha = 0.7;
        ctx.beginPath(); ctx.ellipse(h.r * 0.68, -h.r * 0.08, h.r * 0.22, h.r * 0.15, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        return;
      }
      ctx.save();
      ctx.translate(h.c[0], h.c[1]);
      ctx.rotate(h.ang);
      const R = h.r;
      // skull
      ctx.fillStyle = '#6b7682';
      ctx.strokeStyle = '#161b22';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(0, 0, R * 0.92, R, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      // jaw
      ctx.fillStyle = '#56616c';
      ctx.beginPath();
      ctx.moveTo(-R * 0.2, R * 0.55); ctx.lineTo(R * 0.85, R * 0.45); ctx.lineTo(R * 0.7, R * 0.95); ctx.lineTo(-R * 0.1, R * 0.95);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // ear module
      ctx.fillStyle = '#3d4650';
      ctx.beginPath(); ctx.arc(-R * 0.2, 0, R * 0.32, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      // visor
      const vc = vcol;
      ctx.fillStyle = '#0d1a22';
      ctx.beginPath();
      ctx.moveTo(R * 0.25, -R * 0.45); ctx.lineTo(R * 0.98, -R * 0.3); ctx.lineTo(R * 0.98, R * 0.22); ctx.lineTo(R * 0.25, R * 0.18);
      ctx.closePath(); ctx.fill();
      ctx.save();
      ctx.shadowColor = vc; ctx.shadowBlur = o.reduce ? 0 : 10;
      ctx.fillStyle = vc;
      const blink = status === 'ok' ? 1 : 0.4 + 0.6 * Math.abs(Math.sin(this.time * 20));
      ctx.globalAlpha = blink;
      ctx.beginPath(); ctx.ellipse(R * 0.68, -R * 0.08, R * 0.2, R * 0.13, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(R * 0.3, -R * 0.12, R * 0.62, R * 0.07);
      ctx.restore();
      // antenna
      ctx.strokeStyle = '#9aa5b1'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-R * 0.3, -R * 0.9); ctx.lineTo(-R * 0.55, -R * 1.45); ctx.stroke();
      ctx.fillStyle = vc;
      ctx.beginPath(); ctx.arc(-R * 0.55, -R * 1.45, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    drawMuscle(ctx, m, r, s, o, dim) {
      const st = this.state[m.id + s];
      const pts = musclePoints(m, r, s);
      const A0 = pts[0], B0 = pts[1];
      const a = [A0[0] + (B0[0] - A0[0]) * m.belly[0], A0[1] + (B0[1] - A0[1]) * m.belly[0]];
      const b = [A0[0] + (B0[0] - A0[0]) * m.belly[1], A0[1] + (B0[1] - A0[1]) * m.belly[1]];
      // tendons
      ctx.strokeStyle = mix('#e6dccb', DARK, dim);
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(A0[0], A0[1]); ctx.lineTo(a[0], a[1]);
      ctx.moveTo(b[0], b[1]); ctx.lineTo(B0[0], B0[1]);
      if (pts[2]) ctx.lineTo(pts[2][0], pts[2][1]);
      ctx.stroke();
      // belly
      const ratio = st.len / st.rest;
      const q = st.q;
      const shorten = Math.max(-0.3, Math.min(0.4, 1 - ratio));
      const w = m.w * S * (0.8 + 0.6 * shorten + 0.34 * q);
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      const k = w * 0.667;
      const c1 = [a[0] + dx * 0.25, a[1] + dy * 0.25];
      const c2 = [a[0] + dx * 0.75, a[1] + dy * 0.75];
      const modeCol = o.neutral ? '#dfe6ee' : MODE_COLOR[st.mode] || MODE_COLOR.c;
      let fill = q > 0.01 ? mixHex(MUSCLE_BASE, modeCol, 0.18 + 0.68 * q) : MUSCLE_BASE;
      if (dim) fill = mixHex(fill, DARK, dim);
      ctx.save();
      if (!dim && q > 0.24 && !o.reduce) { ctx.shadowColor = modeCol; ctx.shadowBlur = 16 * q; }
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.bezierCurveTo(c1[0] + nx * k, c1[1] + ny * k, c2[0] + nx * k, c2[1] + ny * k, b[0], b[1]);
      ctx.bezierCurveTo(c2[0] - nx * k, c2[1] - ny * k, c1[0] - nx * k, c1[1] - ny * k, a[0], a[1]);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = mix('#3a0e14', DARK, dim);
      ctx.lineWidth = 1.2;
      ctx.stroke();
      // striations (muscle fibre direction)
      ctx.strokeStyle = dim ? 'rgba(0,0,0,0.25)' : `rgba(255,${q > 0.2 ? 230 : 170},${q > 0.2 ? 200 : 170},${0.18 + 0.25 * q})`;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      for (const f of [-0.22, 0, 0.22]) {
        const off = f * w;
        ctx.moveTo(a[0] + dx * 0.15 + nx * off, a[1] + dy * 0.15 + ny * off);
        ctx.lineTo(a[0] + dx * 0.85 + nx * off, a[1] + dy * 0.85 + ny * off);
      }
      ctx.stroke();
      st._mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      st._n = [nx, ny];
    }

    drawHighlights(ctx, r, hl) {
      const L = r.N;
      const map = { hip: L.thigh.P, knee: L.shank.P, ankle: L.foot.P, shoulder: L.upper.P, elbow: L.fore.P };
      const t = this.time;
      ctx.save();
      for (const j of hl.joints || []) {
        const c = map[j];
        if (!c) continue;
        const pulse = 0.5 + 0.5 * Math.sin(t * 6);
        const R = (15 + 4 * pulse) * S * 0.8;
        ctx.strokeStyle = `rgba(120,230,255,${0.5 + 0.4 * pulse})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 4]);
        ctx.beginPath(); ctx.arc(c[0], c[1], R, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        // axis glyph: a dot in a ring = an axis pointing out of the screen (frontal axis)
        ctx.fillStyle = '#bff4ff';
        ctx.beginPath(); ctx.arc(c[0], c[1], 2.6, 0, Math.PI * 2); ctx.fill();
        // rotation arrows in the plane of the screen (= sagittal plane)
        if (hl.arrows !== false) {
          ctx.strokeStyle = 'rgba(191,244,255,0.85)';
          ctx.lineWidth = 2;
          const a0 = -2.3, a1 = -0.85, AR = R + 9;
          ctx.beginPath(); ctx.arc(c[0], c[1], AR, a0, a1); ctx.stroke();
          for (const [ang, dir] of [[a0, -1], [a1, 1]]) {
            const px = c[0] + Math.cos(ang) * AR, py = c[1] + Math.sin(ang) * AR;
            const tx = -Math.sin(ang) * dir, ty = Math.cos(ang) * dir;
            ctx.beginPath();
            ctx.moveTo(px + tx * 7, py + ty * 7);
            ctx.lineTo(px - ty * 4, py + tx * 4);
            ctx.lineTo(px + ty * 4, py - tx * 4);
            ctx.closePath();
            ctx.fillStyle = 'rgba(191,244,255,0.85)';
            ctx.fill();
          }
        }
      }
      ctx.restore();
    }

    drawLabels(ctx, r, o) {
      const names = SEHS.content.MUSCLES;
      ctx.save();
      ctx.font = '600 11px system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      for (const m of MUSCLES) {
        const st = this.state[m.id + 'N'];
        if (!st._mid) continue;
        if (o.labels === 'active' && st.q < 0.2) continue;
        if (o.labelOnly && o.labelOnly !== m.id) continue;
        const nm = names[m.id] ? names[m.id].name : m.id;
        const dir = m.pts[0][2] + m.pts[1][2] >= 0 ? 1 : -1;
        const ox = st._mid[0] + st._n[0] * 0 + (dir > 0 ? 34 : -34);
        const oy = st._mid[1];
        ctx.strokeStyle = 'rgba(220,235,245,0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(st._mid[0], st._mid[1]); ctx.lineTo(ox, oy); ctx.stroke();
        const tw = ctx.measureText(nm).width + 8;
        const bx = dir > 0 ? ox : ox - tw;
        ctx.fillStyle = 'rgba(8,14,20,0.82)';
        ctx.fillRect(bx, oy - 8, tw, 16);
        ctx.fillStyle = st.q > 0.2 ? MODE_COLOR[st.mode] : '#dfe6ee';
        ctx.fillText(nm, bx + 4, oy);
      }
      ctx.restore();
    }
  }

  Android.rig = rig;
  Android.lowestRel = lowestRel;
  Android.handRel = handRel;
  Android.headTopRel = headTopRel;
  Android.MUSCLES = MUSCLES;
  Android.S = S;

  SEHS.Android = Android;
  SEHS.Pose = { mk, lerpPose, clonePose, jitterPose, BASE, KEYS: POSE_KEYS };
})();
