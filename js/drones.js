/*
 * drones.js: Drone Defense art, FX and audio (owned by the "vfx-audio" agent)
 *
 * Load AFTER js/effects.js. Everything is drawn in code (no image/audio files)
 * and works from file://.
 *
 *   SEHS.DroneArt.draw(ctx, type, x, y, angle, t, opts)
 *   SEHS.DroneArt.drawNet(ctx, x, y, r, t, opts)
 *   SEHS.DroneArt.drawTether(ctx, x1, y1, x2, y2, t, tension)
 *   SEHS.DroneArt.radius(type)            -> body radius in px (hit-testing)
 *   SEHS.Arena.drawGround(ctx, W, H, t, opts)
 *   SEHS.Arena.drawTransport(ctx, x, y, angle, repair01, t, opts)
 *   SEHS.Arena.drawTurret(ctx, x, y, angle, t, opts)
 *   SEHS.Arena.drawSpawnWarning(ctx, x, y, angle, t, opts)
 *   SEHS.FX.prototype: droneExplode, empPulse, swatTrail, discTrail, netBurst,
 *                      shieldFlash, comboText, scrapPickup (top-down, no gravity)
 *   SEHS.Audio: droneHum, droneZap, droneBoom, netFire, netRip, swat, discThrow,
 *               empPulse, lockOn, waveStart, waveClear, scrapCoin, upgradeBuy,
 *               workshopAmbient, questionRight, questionWrong, bossWarning
 *
 * Top-down convention: angle 0 = facing +x (screen right), radians, clockwise
 * on screen (canvas y down). Light comes from the top-left of the SCREEN, so
 * shadows always fall down-right whatever the drone heading.
 */
(function () {
  'use strict';
  const SEHS = (window.SEHS = window.SEHS || {});
  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, k) => a + (b - a) * k;
  const fract = (v) => v - Math.floor(v);

  // deterministic RNG for cached static art
  function mulberry(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------------------------------------------------------------------------
  // Cached glow sprites (replace shadowBlur: one drawImage per glow)
  // ---------------------------------------------------------------------------
  const glowCache = {};
  function glow(rgb) {
    let c = glowCache[rgb];
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, `rgba(${rgb},1)`);
    gr.addColorStop(0.25, `rgba(${rgb},0.55)`);
    gr.addColorStop(0.6, `rgba(${rgb},0.15)`);
    gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    glowCache[rgb] = c;
    return c;
  }
  function drawGlow(ctx, x, y, r, rgb, a) {
    if (a <= 0.005) return;
    const pa = ctx.globalAlpha;
    ctx.globalAlpha = pa * a;
    ctx.drawImage(glow(rgb), x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = pa;
  }

  function devScale(ctx) {
    try { const m = ctx.getTransform(); return clamp(Math.hypot(m.a, m.b) || 1, 1, 2); } catch (e) { return 1; }
  }

  // ---------------------------------------------------------------------------
  // DRONE ART
  // ---------------------------------------------------------------------------
  const HULL = '#2b333d', HULL2 = '#3c4652', EDGE = '#5d6b7b', DARK = '#151a20';
  const RED = '#ff3040', HAZ = '#f5c400';

  // r = body radius; rotors: [angle, dist(×r), size(×r)]
  const SPEC = {
    scout:  { r: 20, rotors: [[0.785, 0.95, 0.42], [-0.785, 0.95, 0.42], [2.356, 0.95, 0.42], [-2.356, 0.95, 0.42]], spin: 70 },
    swarm:  { r: 10, rotors: [[1.571, 0.85, 0.55], [-1.571, 0.85, 0.55]], spin: 90 },
    netter: { r: 24, rotors: [[0.87, 1.0, 0.4], [-0.87, 1.0, 0.4], [2.27, 1.0, 0.4], [-2.27, 1.0, 0.4]], spin: 55 },
    tether: { r: 23, rotors: [[1.05, 0.98, 0.44], [-1.05, 0.98, 0.44], [Math.PI, 0.98, 0.44]], spin: 60 },
    heavy:  { r: 34, rotors: [0, 1, 2, 3, 4, 5].map((i) => [i * TAU / 6 + Math.PI / 6, 0.95, 0.32]), spin: 40, duct: true },
    jammer: { r: 26, rotors: [[0.785, 1.0, 0.38], [-0.785, 1.0, 0.38], [2.356, 1.0, 0.38], [-2.356, 1.0, 0.38]], spin: 55 },
    warden: { r: 60, rotors: [[0.785, 0.98, 0.36], [-0.785, 0.98, 0.36], [2.356, 0.98, 0.36], [-2.356, 0.98, 0.36]], spin: 32, duct: true },
  };
  const TYPE_SEED = { scout: 0.1, swarm: 0.53, netter: 0.31, tether: 0.77, heavy: 0.2, jammer: 0.64, warden: 0.9 };

  // gradient lit from the screen's top-left regardless of heading
  function litGrad(ctx, R, angle, cLight, cDark) {
    const lx = Math.cos(-angle) * -0.707 - Math.sin(-angle) * -0.707;
    const ly = Math.sin(-angle) * -0.707 + Math.cos(-angle) * -0.707;
    const g = ctx.createLinearGradient(lx * R, ly * R, -lx * R, -ly * R);
    g.addColorStop(0, cLight);
    g.addColorStop(1, cDark);
    return g;
  }

  function rotorPos(S, R, i) {
    const r = S.rotors[i];
    return [Math.cos(r[0]) * r[1] * R, Math.sin(r[0]) * r[1] * R, r[2] * R];
  }

  // silhouette path (shadow + hit flash)
  function silhouette(ctx, type, S, R) {
    ctx.beginPath();
    const body = type === 'heavy' ? 0.62 : type === 'warden' ? 0.85 : type === 'swarm' ? 0.6 : 0.55;
    ctx.moveTo(R * body, 0); ctx.arc(0, 0, R * body, 0, TAU);
    for (let i = 0; i < S.rotors.length; i++) {
      const p = rotorPos(S, R, i);
      ctx.moveTo(p[0] + p[2], p[1]); ctx.arc(p[0], p[1], p[2], 0, TAU);
    }
    if (type === 'netter') { ctx.rect(R * 0.2, -R * 0.28, R * 0.95, R * 0.56); }
    if (type === 'warden') { ctx.moveTo(-R * 0.8, 0); ctx.arc(-R * 1.1, 0, R * 0.32, 0, TAU); ctx.moveTo(-R * 1.3, 0); ctx.arc(-R * 1.5, 0, R * 0.22, 0, TAU); }
  }

  function arm(ctx, x2, y2, w) {
    ctx.lineWidth = w;
    ctx.strokeStyle = DARK;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.lineWidth = w * 0.5;
    ctx.strokeStyle = HULL2;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(x2, y2); ctx.stroke();
  }

  function rotor(ctx, x, y, rr, a, duct, slow, reduce) {
    // motion disc
    ctx.fillStyle = slow ? 'rgba(150,170,190,0.05)' : 'rgba(170,195,220,0.13)';
    ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill();
    if (duct) {
      ctx.lineWidth = Math.max(2, rr * 0.2);
      ctx.strokeStyle = DARK;
      ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.stroke();
      ctx.lineWidth = Math.max(1, rr * 0.08);
      ctx.strokeStyle = EDGE;
      ctx.beginPath(); ctx.arc(x, y, rr * 0.98, Math.PI * 0.9, Math.PI * 1.65); ctx.stroke();
    } else {
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(200,220,240,0.22)';
      ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.stroke();
    }
    // blades + blur ghosts
    const ghosts = slow || reduce ? 1 : 3;
    for (let g = ghosts - 1; g >= 0; g--) {
      const aa = a - g * 0.32;
      ctx.strokeStyle = g === 0 ? 'rgba(215,228,240,0.85)' : `rgba(200,215,230,${0.32 - g * 0.09})`;
      ctx.lineWidth = Math.max(1.2, rr * 0.16);
      const c = Math.cos(aa) * rr * 0.92, s = Math.sin(aa) * rr * 0.92;
      ctx.beginPath(); ctx.moveTo(x - c, y - s); ctx.lineTo(x + c, y + s); ctx.stroke();
    }
    ctx.fillStyle = '#7d8a99';
    ctx.beginPath(); ctx.arc(x, y, Math.max(1.4, rr * 0.18), 0, TAU); ctx.fill();
  }

  function eye(ctx, x, y, r, on, rgb) {
    rgb = rgb || '255,48,64';
    if (on > 0.05) drawGlow(ctx, x, y, r * 4.2, rgb, 0.75 * on);
    ctx.fillStyle = '#1a0c10';
    ctx.beginPath(); ctx.arc(x, y, r * 1.35, 0, TAU); ctx.fill();
    ctx.fillStyle = on > 0.5 ? `rgb(${rgb})` : '#5a1820';
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    if (on > 0.5) { ctx.fillStyle = '#ffe0e0'; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, TAU); ctx.fill(); }
  }

  function rivets(ctx, pts, r) {
    ctx.fillStyle = '#8796a6';
    ctx.beginPath();
    for (const p of pts) { ctx.moveTo(p[0] + r, p[1]); ctx.arc(p[0], p[1], r, 0, TAU); }
    ctx.fill();
  }

  function hazardBand(ctx, x, y, w, h, n) {
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = HAZ; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#16181b';
    const step = w / n;
    ctx.beginPath();
    for (let i = -1; i <= n + 1; i++) {
      const sx = x + i * step;
      ctx.moveTo(sx, y + h); ctx.lineTo(sx + step * 0.5, y + h); ctx.lineTo(sx + step * 0.5 + h, y); ctx.lineTo(sx + h, y);
    }
    ctx.fill();
    ctx.restore();
  }

  function polyPath(ctx, n, r, rot) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = rot + (i / n) * TAU;
      i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
  }

  const BODY = {
    scout(ctx, R, ang, t, st) {
      ctx.fillStyle = litGrad(ctx, R * 0.6, ang, '#7a8796', '#2a323b');
      ctx.beginPath(); ctx.ellipse(0, 0, R * 0.62, R * 0.4, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = DARK; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = RED; ctx.fillRect(-R * 0.45, -R * 0.06, R * 0.5, R * 0.12);
      eye(ctx, R * 0.38, 0, R * 0.13, st.eye);
    },
    swarm(ctx, R, ang, t, st) {
      ctx.fillStyle = litGrad(ctx, R, ang, '#7f8c9b', '#2a323b');
      ctx.beginPath(); ctx.moveTo(R * 0.9, 0); ctx.lineTo(-R * 0.6, -R * 0.55); ctx.lineTo(-R * 0.3, 0); ctx.lineTo(-R * 0.6, R * 0.55); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = DARK; ctx.lineWidth = 1; ctx.stroke();
      eye(ctx, R * 0.3, 0, R * 0.2, st.eye);
    },
    netter(ctx, R, ang, t, st) {
      // folded net pod (amber) slung at the nose
      ctx.fillStyle = litGrad(ctx, R, ang, '#e0a63a', '#6b4512');
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(R * 0.15, -R * 0.3, R * 0.95, R * 0.6, R * 0.25) : ctx.rect(R * 0.15, -R * 0.3, R * 0.95, R * 0.6); ctx.fill();
      ctx.strokeStyle = '#3a2608'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.save(); ctx.beginPath(); ctx.rect(R * 0.2, -R * 0.26, R * 0.75, R * 0.52); ctx.clip();
      ctx.strokeStyle = 'rgba(60,35,5,0.75)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = -4; i <= 6; i++) { const sx = R * 0.2 + i * R * 0.16; ctx.moveTo(sx, -R * 0.3); ctx.lineTo(sx + R * 0.5, R * 0.3); ctx.moveTo(sx + R * 0.5, -R * 0.3); ctx.lineTo(sx, R * 0.3); }
      ctx.stroke(); ctx.restore();
      ctx.fillStyle = '#120c06'; ctx.beginPath(); ctx.arc(R * 1.07, 0, R * 0.16, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#8a8f96'; ctx.lineWidth = 1.5; ctx.stroke();
      // body
      ctx.fillStyle = litGrad(ctx, R * 0.6, ang, '#7a8796', '#2a323b');
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-R * 0.55, -R * 0.38, R * 0.85, R * 0.76, R * 0.18) : ctx.rect(-R * 0.55, -R * 0.38, R * 0.85, R * 0.76); ctx.fill();
      ctx.strokeStyle = DARK; ctx.lineWidth = 1.5; ctx.stroke();
      hazardBand(ctx, -R * 0.5, -R * 0.08, R * 0.5, R * 0.16, 3);
      eye(ctx, R * 0.12, -R * 0.2, R * 0.1, st.eye);
    },
    tether(ctx, R, ang, t, st) {
      ctx.fillStyle = litGrad(ctx, R * 0.6, ang, '#7a8796', '#2a323b');
      polyPath(ctx, 6, R * 0.5, 0); ctx.fill();
      ctx.strokeStyle = DARK; ctx.lineWidth = 1.5; ctx.stroke();
      // winch drum
      ctx.fillStyle = '#20262e'; ctx.beginPath(); ctx.arc(-R * 0.15, 0, R * 0.22, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#c45a2a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(-R * 0.15, 0, R * 0.15, t * 3, t * 3 + 4.5); ctx.stroke();
      eye(ctx, R * 0.32, 0, R * 0.12, st.eye);
    },
    heavy(ctx, R, ang, t, st) {
      // hex frame struts
      ctx.strokeStyle = DARK; ctx.lineWidth = R * 0.16;
      polyPath(ctx, 6, R * 0.95, Math.PI / 6); ctx.stroke();
      ctx.strokeStyle = HULL2; ctx.lineWidth = R * 0.07;
      ctx.stroke();
      // armoured core
      ctx.fillStyle = litGrad(ctx, R * 0.7, ang, '#8695a6', '#2c343d');
      polyPath(ctx, 6, R * 0.64, 0); ctx.fill();
      ctx.strokeStyle = DARK; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      polyPath(ctx, 6, R * 0.42, 0); ctx.fill();
      hazardBand(ctx, -R * 0.5, -R * 0.07, R * 0.5, R * 0.14, 4);
      const rp = [];
      for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; rp.push([Math.cos(a) * R * 0.53, Math.sin(a) * R * 0.53]); }
      rivets(ctx, rp, 1.4);
      // dent / scratch
      ctx.strokeStyle = 'rgba(160,175,190,0.35)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-R * 0.2, R * 0.3); ctx.lineTo(R * 0.05, R * 0.18); ctx.lineTo(R * 0.12, R * 0.34); ctx.stroke();
      eye(ctx, R * 0.36, 0, R * 0.11, st.eye);
    },
    jammer(ctx, R, ang, t, st) {
      ctx.fillStyle = litGrad(ctx, R * 0.6, ang, '#7a8796', '#2a323b');
      ctx.beginPath(); ctx.arc(0, 0, R * 0.55, 0, TAU); ctx.fill();
      ctx.strokeStyle = DARK; ctx.lineWidth = 1.5; ctx.stroke();
      // dish
      ctx.fillStyle = litGrad(ctx, R * 0.42, ang, '#c9d2dc', '#4a5562');
      ctx.beginPath(); ctx.arc(-R * 0.05, 0, R * 0.42, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(30,36,44,0.6)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(-R * 0.05, 0, R * 0.28, 0, TAU); ctx.moveTo(-R * 0.05 + R * 0.14, 0); ctx.arc(-R * 0.05, 0, R * 0.14, 0, TAU); ctx.stroke();
      const fa = st.stunned ? 0 : t * 2.4;
      ctx.strokeStyle = '#2a2f36'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-R * 0.05, 0); ctx.lineTo(-R * 0.05 + Math.cos(fa) * R * 0.4, Math.sin(fa) * R * 0.4); ctx.stroke();
      drawGlow(ctx, -R * 0.05, 0, R * 0.35, '180,140,255', st.stunned ? 0.1 : 0.55 + 0.25 * Math.sin(t * 5));
      ctx.fillStyle = '#d9c4ff'; ctx.beginPath(); ctx.arc(-R * 0.05, 0, R * 0.07, 0, TAU); ctx.fill();
      eye(ctx, R * 0.46, 0, R * 0.09, st.eye);
    },
    warden(ctx, R, ang, t, st) {
      // segmented tail (sways)
      const sw = Math.sin(t * 1.6) * R * 0.1;
      const segs = [[-R * 1.1, sw * 0.6, R * 0.3], [-R * 1.48, sw * 1.4, R * 0.21], [-R * 1.76, sw * 2.2, R * 0.13]];
      ctx.strokeStyle = DARK; ctx.lineWidth = R * 0.12;
      ctx.beginPath(); ctx.moveTo(-R * 0.6, 0); for (const s of segs) ctx.lineTo(s[0], s[1]); ctx.stroke();
      for (const s of segs) {
        ctx.fillStyle = litGrad(ctx, s[2], ang, '#5f6b79', '#1b2027');
        ctx.beginPath(); ctx.arc(s[0], s[1], s[2], 0, TAU); ctx.fill();
        ctx.strokeStyle = DARK; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = RED; ctx.beginPath(); ctx.arc(s[0], s[1], s[2] * 0.22, 0, TAU); ctx.fill();
      }
      // mandibles
      ctx.fillStyle = '#2a3038';
      for (const sgn of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(R * 0.55, sgn * R * 0.3); ctx.quadraticCurveTo(R * 1.15, sgn * R * 0.45, R * 1.08, sgn * R * 0.08); ctx.lineTo(R * 0.85, sgn * R * 0.2); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#69788a'; ctx.lineWidth = 1.2; ctx.stroke();
      }
      // core
      ctx.fillStyle = litGrad(ctx, R * 0.7, ang, '#76848f', '#20262d');
      polyPath(ctx, 8, R * 0.62, Math.PI / 8); ctx.fill();
      ctx.strokeStyle = DARK; ctx.lineWidth = 2.5; ctx.stroke();
      // rotating armour plates (ring of 8 segments)
      const rot = st.stunned ? t * 0.1 : t * 0.7;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 8; i++) {
        const a0 = rot + (i / 8) * TAU, a1 = a0 + TAU / 8 - 0.16;
        ctx.fillStyle = i % 2 ? '#4a5563' : '#3b4450';
        ctx.beginPath(); ctx.arc(0, 0, R * 0.84, a0, a1); ctx.arc(0, 0, R * 0.67, a1, a0, true); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = DARK; ctx.stroke();
        if (i % 2 === 0) {
          const am = (a0 + a1) / 2;
          ctx.fillStyle = RED; ctx.beginPath(); ctx.arc(Math.cos(am) * R * 0.755, Math.sin(am) * R * 0.755, 1.8, 0, TAU); ctx.fill();
        }
      }
      ctx.strokeStyle = 'rgba(150,165,180,0.45)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(0, 0, R * 0.84, Math.PI * 1.0, Math.PI * 1.5); ctx.stroke();
      // inner core + giant eye
      ctx.fillStyle = '#12161b';
      ctx.beginPath(); ctx.arc(0, 0, R * 0.42, 0, TAU); ctx.fill();
      hazardBand(ctx, -R * 0.38, -R * 0.06, R * 0.3, R * 0.12, 3);
      const er = R * 0.2;
      drawGlow(ctx, R * 0.15, 0, er * 4, '255,40,50', st.eye * 0.9);
      ctx.fillStyle = st.eye > 0.5 ? '#ff2d3c' : '#5a1820';
      ctx.beginPath(); ctx.arc(R * 0.15, 0, er, 0, TAU); ctx.fill();
      ctx.fillStyle = '#1a0306';
      const look = Math.sin(t * 0.9) * er * 0.25;
      ctx.beginPath(); ctx.ellipse(R * 0.15 + er * 0.2, look, er * 0.18, er * 0.75, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,220,220,0.9)'; ctx.beginPath(); ctx.arc(R * 0.08, -er * 0.4, er * 0.16, 0, TAU); ctx.fill();
    },
  };

  const DroneArt = {
    SPEC,
    radius(type) { return (SPEC[type] || SPEC.scout).r; },

    draw(ctx, type, x, y, angle, t, opts) {
      opts = opts || {};
      const S = SPEC[type] || SPEC.scout;
      if (!SPEC[type]) type = 'scout';
      const sc = opts.scale || 1;
      const R = S.r * sc;
      const reduce = !!opts.reduce;
      const stunned = !!opts.stunned;
      const seed = (opts.seed != null ? opts.seed : 0) + TYPE_SEED[type];
      // blinking sensor eye (~0.8 Hz, never strobes)
      let eyeOn = fract(t * 0.8 + seed * 7.3) < 0.82 ? 1 : 0.15;
      if (stunned) eyeOn = fract(t * 1.3 + seed) < 0.2 ? 0.5 : 0.05;
      const st = { eye: eyeOn, stunned, reduce };
      const spin = (stunned ? 4 : S.spin) * t;
      const hover = stunned || reduce ? 0 : Math.sin(t * 3 + seed * 9) * 0.6;

      ctx.save();
      ctx.translate(x, y);

      // elite aura (under everything)
      if (opts.elite) {
        const p = reduce ? 0.75 : 0.65 + 0.25 * Math.sin(t * 4);
        ctx.globalCompositeOperation = 'lighter';
        drawGlow(ctx, 0, 0, R * 2.0, '255,70,210', 0.95 * p);
        drawGlow(ctx, 0, 0, R * 1.2, '255,150,235', 0.35 * p);
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = `rgba(255,140,235,${0.85 * p})`;
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 5]);
        ctx.lineDashOffset = -t * 20;
        ctx.beginPath(); ctx.arc(0, 0, R * 1.45, 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
      }

      // jammer interference rings (world space, unrotated)
      if (type === 'jammer' && !stunned) {
        const n = reduce ? 2 : 3;
        ctx.lineWidth = 1.6;
        for (let i = 0; i < n; i++) {
          const k = fract(t * 0.55 + i / n);
          const rr = R * (1.1 + k * 3.2);
          ctx.strokeStyle = `rgba(180,140,255,${(1 - k) * 0.55})`;
          ctx.beginPath();
          const m = 40;
          for (let j = 0; j <= m; j++) {
            const a = (j / m) * TAU;
            const w = rr + Math.sin(a * 9 + t * 8 + i) * 2.2 * (1 - k);
            j ? ctx.lineTo(Math.cos(a) * w, Math.sin(a) * w) : ctx.moveTo(Math.cos(a) * w, Math.sin(a) * w);
          }
          ctx.stroke();
        }
      }

      // ground shadow (top-left light -> down-right offset)
      const so = Math.max(4, R * 0.35) + hover;
      ctx.save();
      ctx.translate(so, so * 1.25);
      ctx.rotate(angle);
      ctx.fillStyle = 'rgba(0,0,0,0.38)';
      silhouette(ctx, type, S, R * 0.95);
      ctx.fill();
      ctx.restore();

      // tether cable + claw trails behind (drawn under body)
      ctx.save();
      ctx.translate(-hover * 0.5, -hover);
      ctx.rotate(angle);
      if (type === 'tether') {
        const sway = Math.sin(t * 2.2 + seed * 5) * R * 0.45;
        const cx = -R * 2.3, cy = sway;
        ctx.strokeStyle = '#0d1014'; ctx.lineWidth = 3.4;
        ctx.beginPath(); ctx.moveTo(-R * 0.3, 0); ctx.quadraticCurveTo(-R * 1.3, -sway * 0.5, cx, cy); ctx.stroke();
        ctx.strokeStyle = '#c45a2a'; ctx.lineWidth = 1.4; ctx.stroke();
        const open = 0.35 + 0.25 * Math.sin(t * 3 + seed);
        const ca = Math.atan2(cy + sway * 0.5, cx + R * 1.3) + Math.PI;
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(ca + Math.PI);
        ctx.fillStyle = '#3a4350'; ctx.beginPath(); ctx.arc(0, 0, R * 0.2, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#a7b3c0'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
        for (const off of [-1, 0, 1]) {
          const a = Math.PI + off * (0.5 + open);
          ctx.beginPath(); ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(Math.cos(a) * R * 0.45, Math.sin(a) * R * 0.45, Math.cos(a - off * 0.6) * R * 0.6, Math.sin(a - off * 0.6) * R * 0.6);
          ctx.stroke();
        }
        ctx.lineCap = 'butt';
        ctx.restore();
      }

      // arms + rotors
      const armW = Math.max(2.4, R * (S.duct ? 0.18 : 0.14));
      for (let i = 0; i < S.rotors.length; i++) {
        const p = rotorPos(S, R, i);
        if (type !== 'heavy') arm(ctx, p[0], p[1], armW);
      }
      for (let i = 0; i < S.rotors.length; i++) {
        const p = rotorPos(S, R, i);
        rotor(ctx, p[0], p[1], p[2], spin * (i % 2 ? -1 : 1) + i, S.duct, stunned, reduce);
      }
      // body
      // red nav LEDs on the arms (reads as "hostile" at a glance)
      if (type !== 'swarm') {
        ctx.fillStyle = stunned ? '#4a1a20' : '#ff4a55';
        ctx.beginPath();
        for (let i = 0; i < S.rotors.length; i++) {
          const p = rotorPos(S, R, i), lr = Math.max(1.6, R * 0.06);
          const px = p[0] * 0.55, py = p[1] * 0.55;
          ctx.moveTo(px + lr, py); ctx.arc(px, py, lr, 0, TAU);
        }
        ctx.fill();
      }
      BODY[type](ctx, R, angle, t, st);

      // hit flash overlay
      if (opts.hit > 0) {
        ctx.fillStyle = `rgba(255,255,255,${clamp(opts.hit, 0, 1) * (reduce ? 0.3 : 0.85)})`;
        silhouette(ctx, type, S, R);
        ctx.fill();
      }
      ctx.restore();

      // stunned: orbiting cyan sparks
      if (stunned) {
        ctx.strokeStyle = '#8ff0ff'; ctx.lineWidth = 1.6;
        for (let i = 0; i < 3; i++) {
          const a = t * 3 + (i / 3) * TAU;
          const sx = Math.cos(a) * R * 0.9, sy = Math.sin(a) * R * 0.5 - R * 0.3;
          ctx.beginPath(); ctx.moveTo(sx - 3, sy - 3); ctx.lineTo(sx + 1, sy); ctx.lineTo(sx - 1, sy + 1); ctx.lineTo(sx + 3, sy + 4); ctx.stroke();
        }
      }

      // HP ring
      if (opts.hp != null) {
        const hp = clamp(opts.hp, 0, 1);
        const rr = R * (type === 'warden' ? 1.12 : 1.38) + 5;
        const lw = type === 'warden' ? 5 : 3;
        ctx.lineWidth = lw + 2;
        ctx.strokeStyle = 'rgba(8,10,14,0.75)';
        ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.stroke();
        ctx.lineWidth = lw;
        ctx.strokeStyle = hp > 0.5 ? '#7dff9a' : hp > 0.25 ? '#ffb020' : '#ff3040';
        ctx.beginPath(); ctx.arc(0, 0, rr, -Math.PI / 2, -Math.PI / 2 + hp * TAU); ctx.stroke();
      }

      // lock-on reticle
      if (opts.targeted) {
        const pulse = reduce ? 0 : Math.sin(t * 6) * 2;
        const rr = R * (type === 'warden' ? 1.25 : 1.55) + 10 + pulse;
        const rot = reduce ? 0 : t * 1.2;
        ctx.save();
        ctx.rotate(rot);
        ctx.strokeStyle = 'rgba(10,10,10,0.7)'; ctx.lineWidth = 5;
        for (let pass = 0; pass < 2; pass++) {
          ctx.beginPath();
          for (let i = 0; i < 4; i++) {
            const a = (i / 4) * TAU + Math.PI / 4;
            ctx.moveTo(Math.cos(a - 0.32) * rr, Math.sin(a - 0.32) * rr);
            ctx.arc(0, 0, rr, a - 0.32, a + 0.32);
          }
          for (let i = 0; i < 4; i++) {
            const a = (i / 4) * TAU;
            ctx.moveTo(Math.cos(a) * (rr - 7), Math.sin(a) * (rr - 7));
            ctx.lineTo(Math.cos(a) * (rr + 6), Math.sin(a) * (rr + 6));
          }
          ctx.stroke();
          ctx.strokeStyle = HAZ; ctx.lineWidth = 2.4;
        }
        ctx.restore();
      }
      ctx.restore();
    },

    // capture net over an ally. opts: { open 0..1 (deploy scale), struggle 0..1,
    // charged (bool: electric crackle), reduce }
    drawNet(ctx, x, y, r, t, opts) {
      opts = opts || {};
      const open = opts.open != null ? clamp(opts.open, 0, 1) : 1;
      if (open <= 0.01) return;
      const st = opts.struggle || 0;
      const rr = r * (0.3 + 0.7 * open);
      ctx.save();
      ctx.translate(x, y);
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath(); ctx.arc(3, 4, rr, 0, TAU); ctx.fill();
      // mesh
      ctx.save();
      ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.clip();
      ctx.fillStyle = 'rgba(224,170,70,0.10)'; ctx.fillRect(-rr, -rr, rr * 2, rr * 2);
      const s = Math.max(5, rr / 3.6);
      const h = s * Math.sqrt(3);
      const wob = Math.sin(t * 9) * st * 2.2;
      ctx.translate(wob, Math.cos(t * 7) * st * 1.5);
      ctx.rotate(Math.sin(t * 0.7) * 0.05);
      ctx.beginPath();
      const nI = Math.ceil(rr / h) + 1, nJ = Math.ceil(rr / (s * 1.5)) + 1;
      for (let j = -nJ; j <= nJ; j++) {
        for (let i = -nI; i <= nI; i++) {
          const cx = i * h + (j & 1 ? h / 2 : 0), cy = j * s * 1.5;
          for (let k = 0; k < 6; k++) {
            const a = Math.PI / 6 + (k / 6) * TAU;
            const px = cx + Math.cos(a) * s, py = cy + Math.sin(a) * s;
            k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
          }
          ctx.closePath();
        }
      }
      ctx.strokeStyle = 'rgba(20,12,4,0.65)'; ctx.lineWidth = 3; ctx.stroke();
      ctx.strokeStyle = '#e0ae52'; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.restore();
      // rim rope + weights
      ctx.strokeStyle = '#1a1206'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.stroke();
      ctx.strokeStyle = '#f0c060'; ctx.lineWidth = 2.5; ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + Math.sin(t * 2) * 0.03;
        const wx = Math.cos(a) * rr, wy = Math.sin(a) * rr;
        ctx.fillStyle = '#2b2f35'; ctx.beginPath(); ctx.arc(wx, wy, 3.6, 0, TAU); ctx.fill();
        ctx.fillStyle = i % 2 ? RED : '#7d8894'; ctx.beginPath(); ctx.arc(wx - 0.8, wy - 0.8, 1.6, 0, TAU); ctx.fill();
      }
      // electric crackle along the rim
      if (opts.charged) {
        const n = opts.reduce ? 1 : 3;
        ctx.strokeStyle = 'rgba(255,90,90,0.85)'; ctx.lineWidth = 1.5;
        for (let i = 0; i < n; i++) {
          const a0 = fract(t * (opts.reduce ? 0.4 : 1.7) + i / n) * TAU;
          ctx.beginPath();
          for (let k = 0; k <= 5; k++) {
            const a = a0 + k * 0.12, j = (k % 2 ? 1 : -1) * 3;
            const px = Math.cos(a) * (rr + j), py = Math.sin(a) * (rr + j);
            k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
          }
          ctx.stroke();
        }
      }
      ctx.restore();
    },

    // tension 0 (slack, wavy) .. 1 (taut, hot, vibrating)
    drawTether(ctx, x1, y1, x2, y2, t, tension) {
      const k = clamp(tension || 0, 0, 1);
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      const n = Math.max(8, Math.min(40, Math.round(len / 10)));
      const sag = (1 - k) * Math.min(60, len * 0.18);
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        const env = Math.sin(u * Math.PI);
        const off = env * (sag * Math.sin(t * 1.8 + u * 2.5) + sag * 0.4 * Math.sin(u * 9 - t * 3)) +
          env * k * k * 1.6 * Math.sin(t * 70 + u * 30);
        pts.push([x1 + dx * u + nx * off, y1 + dy * u + ny * off]);
      }
      ctx.save();
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const path = () => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); };
      // shadow
      ctx.save(); ctx.translate(3, 4); path(); ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 4; ctx.stroke(); ctx.restore();
      path();
      ctx.strokeStyle = '#0c0f13'; ctx.lineWidth = 4.5; ctx.stroke();
      const r = Math.round(lerp(150, 255, k)), g = Math.round(lerp(160, 110, k)), b = Math.round(lerp(170, 60, k));
      ctx.strokeStyle = `rgb(${r},${g},${b})`; ctx.lineWidth = 2; ctx.stroke();
      // braid marks
      ctx.setLineDash([2, 7]); ctx.lineDashOffset = -t * 30 * k;
      ctx.strokeStyle = 'rgba(20,20,20,0.6)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.setLineDash([]);
      if (k > 0.75) {
        const a = (k - 0.75) * 4;
        drawGlow(ctx, x2, y2, 14, '255,120,60', 0.6 * a);
        drawGlow(ctx, (x1 + x2) / 2, (y1 + y2) / 2, 18, '255,120,60', 0.25 * a);
      }
      // clamps
      ctx.fillStyle = '#5d6b7b';
      for (const p of [pts[0], pts[pts.length - 1]]) { ctx.beginPath(); ctx.arc(p[0], p[1], 3.2, 0, TAU); ctx.fill(); }
      ctx.restore();
    },
  };

  // ---------------------------------------------------------------------------
  // ARENA
  // ---------------------------------------------------------------------------
  const groundCache = { key: '', canvas: null, puddles: [], lights: [] };
  const lightSprite = { c: null };
  function getLightSprite() {
    if (lightSprite.c) return lightSprite.c;
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, 'rgba(255,200,130,0.9)');
    gr.addColorStop(0.2, 'rgba(255,180,100,0.55)');
    gr.addColorStop(0.55, 'rgba(240,140,70,0.18)');
    gr.addColorStop(1, 'rgba(220,120,60,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    lightSprite.c = c;
    return c;
  }
  const mistSprite = { c: null };
  function getMist() {
    if (mistSprite.c) return mistSprite.c;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(170,190,210,0.55)');
    gr.addColorStop(1, 'rgba(170,190,210,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    mistSprite.c = c;
    return c;
  }

  function buildGround(W, H, opts, res) {
    const c = document.createElement('canvas');
    c.width = Math.round(W * res); c.height = Math.round(H * res);
    const g = c.getContext('2d');
    g.scale(res, res);
    const R = mulberry(opts.seed || 7);
    const rr = (a, b) => a + R() * (b - a);
    const cx = opts.cx != null ? opts.cx : W / 2, cy = opts.cy != null ? opts.cy : H / 2 + 20;
    const clear = opts.clearR != null ? opts.clearR : Math.min(W, H) * 0.36;
    const canopyH = opts.canopy === false ? 0 : 92;
    const inClear = (x, y, pad) => Math.hypot(x - cx, y - cy) < clear + (pad || 0);

    // base earth
    g.fillStyle = '#15191c'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 260; i++) {
      const x = rr(0, W), y = rr(0, H), r = rr(20, 90);
      g.fillStyle = R() < 0.5 ? 'rgba(40,36,30,0.18)' : 'rgba(30,38,44,0.18)';
      g.beginPath(); g.ellipse(x, y, r, r * rr(0.4, 0.9), rr(0, TAU), 0, TAU); g.fill();
    }
    // concrete slabs (a pad under the camp + broken slabs)
    const slab = (x, y, w, h, a, col) => {
      g.save(); g.translate(x, y); g.rotate(a);
      g.fillStyle = col || '#20262c'; g.fillRect(-w / 2, -h / 2, w, h);
      g.strokeStyle = 'rgba(8,10,12,0.8)'; g.lineWidth = 2; g.strokeRect(-w / 2, -h / 2, w, h);
      g.strokeStyle = 'rgba(120,130,140,0.12)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(-w / 2, -h / 2 + 1); g.lineTo(w / 2, -h / 2 + 1); g.moveTo(-w / 2 + 1, -h / 2); g.lineTo(-w / 2 + 1, h / 2); g.stroke();
      // cracks
      g.strokeStyle = 'rgba(6,8,10,0.7)';
      for (let k = 0; k < 3; k++) {
        let px = rr(-w / 2, w / 2), py = rr(-h / 2, h / 2), a2 = rr(0, TAU);
        g.beginPath(); g.moveTo(px, py);
        for (let s = 0; s < 5; s++) { a2 += rr(-0.6, 0.6); px += Math.cos(a2) * rr(6, 16); py += Math.sin(a2) * rr(6, 16); g.lineTo(px, py); }
        g.stroke();
      }
      // stains
      for (let k = 0; k < 4; k++) { g.fillStyle = 'rgba(10,12,14,0.25)'; g.beginPath(); g.arc(rr(-w / 2, w / 2), rr(-h / 2, h / 2), rr(4, 16), 0, TAU); g.fill(); }
      g.restore();
    };
    // camp pad: grid of slabs
    const pw = 100;
    for (let i = -3; i <= 3; i++) for (let j = -2; j <= 2; j++) {
      const x = cx + i * pw, y = cy + j * pw;
      if (Math.hypot(x - cx, y - cy) > clear * 1.05 || R() < 0.12) continue;
      slab(x + rr(-3, 3), y + rr(-3, 3), pw - 4, pw - 4, rr(-0.02, 0.02), R() < 0.5 ? '#1f252b' : '#222930');
    }
    for (let i = 0; i < 7; i++) {
      const x = rr(0, W), y = rr(canopyH, H);
      if (inClear(x, y, 60)) continue;
      slab(x, y, rr(60, 140), rr(40, 100), rr(-0.6, 0.6));
    }
    // gravel
    for (let i = 0; i < 2200; i++) {
      const v = Math.floor(rr(40, 110));
      g.fillStyle = `rgba(${v},${v},${v + 6},${rr(0.15, 0.45)})`;
      g.fillRect(rr(0, W), rr(0, H), rr(1, 2.2), rr(1, 2.2));
    }
    // tyre tracks
    for (let k = 0; k < 3; k++) {
      const x0 = rr(-50, W * 0.3), y0 = rr(H * 0.3, H + 40);
      const x3 = rr(W * 0.7, W + 50), y3 = rr(canopyH + 40, H * 0.8);
      const c1 = [rr(W * 0.2, W * 0.5), rr(0, H)], c2 = [rr(W * 0.5, W * 0.8), rr(0, H)];
      for (const off of [-14, 14]) {
        g.save(); g.translate(0, off);
        g.beginPath(); g.moveTo(x0, y0); g.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], x3, y3);
        g.strokeStyle = 'rgba(8,9,10,0.35)'; g.lineWidth = 9; g.stroke();
        g.setLineDash([3, 4]); g.strokeStyle = 'rgba(70,72,74,0.22)'; g.lineWidth = 7; g.stroke(); g.setLineDash([]);
        g.restore();
      }
    }
    // oil stains (iridescent rim)
    for (let i = 0; i < 6; i++) {
      const x = rr(60, W - 60), y = rr(canopyH + 20, H - 30), r = rr(10, 26);
      g.fillStyle = 'rgba(5,6,8,0.55)';
      g.beginPath(); g.ellipse(x, y, r, r * 0.7, rr(0, 3), 0, TAU); g.fill();
      g.strokeStyle = 'rgba(120,90,180,0.18)'; g.lineWidth = 1.5; g.stroke();
    }
    // puddles
    const puddles = [];
    for (let i = 0; i < 6; i++) {
      const x = rr(40, W - 40), y = rr(canopyH + 30, H - 30);
      if (inClear(x, y, -40)) continue;
      const p = { x, y, rx: rr(24, 60), ry: rr(12, 28), a: rr(-0.4, 0.4) };
      puddles.push(p);
      g.save(); g.translate(x, y); g.rotate(p.a);
      g.fillStyle = 'rgba(8,10,12,0.6)'; g.beginPath(); g.ellipse(1, 2, p.rx + 3, p.ry + 3, 0, 0, TAU); g.fill();
      const pg = g.createLinearGradient(-p.rx, -p.ry, p.rx, p.ry);
      pg.addColorStop(0, '#1a2a3a'); pg.addColorStop(1, '#0a121b');
      g.fillStyle = pg; g.beginPath(); g.ellipse(0, 0, p.rx, p.ry, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(140,170,200,0.18)'; g.lineWidth = 1.2;
      g.beginPath(); g.ellipse(0, 0, p.rx, p.ry, 0, Math.PI * 1.05, Math.PI * 1.6); g.stroke();
      g.restore();
    }
    // scrap (kept out of the camp clearing)
    const shadowed = (x, y, a, fn) => {
      g.save(); g.translate(x + 4, y + 5); g.rotate(a); g.fillStyle = 'rgba(0,0,0,0.4)'; fn(true); g.restore();
      g.save(); g.translate(x, y); g.rotate(a); fn(false); g.restore();
    };
    const scraps = [];
    for (let i = 0; i < 46; i++) {
      const x = rr(10, W - 10), y = rr(canopyH - 10, H - 8);
      if (inClear(x, y, 30)) continue;
      scraps.push([x, y, R(), rr(0, TAU), rr(0.7, 1.3)]);
    }
    for (const [x, y, kind, a, s] of scraps) {
      if (kind < 0.18) { // tyre
        const r = 14 * s;
        shadowed(x, y, a, (sh) => {
          g.beginPath(); g.arc(0, 0, r, 0, TAU);
          if (sh) { g.fill(); return; }
          g.fillStyle = '#101214'; g.fill();
          g.strokeStyle = '#272b30'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, r * 0.75, 0, TAU); g.stroke();
          g.fillStyle = '#4a525b'; g.beginPath(); g.arc(0, 0, r * 0.38, 0, TAU); g.fill();
          g.strokeStyle = 'rgba(120,130,140,0.3)'; g.lineWidth = 1.5; g.beginPath(); g.arc(0, 0, r - 1, Math.PI, Math.PI * 1.5); g.stroke();
        });
      } else if (kind < 0.42) { // metal plate
        const w = 26 * s, h = 16 * s;
        shadowed(x, y, a, (sh) => {
          g.beginPath(); g.moveTo(-w / 2, -h / 2); g.lineTo(w / 2, -h / 2 + 3); g.lineTo(w / 2 - 4, h / 2); g.lineTo(-w / 2 + 2, h / 2 - 2); g.closePath();
          if (sh) { g.fill(); return; }
          g.fillStyle = R() < 0.5 ? '#46505b' : '#3a434d'; g.fill();
          g.strokeStyle = '#1a1f24'; g.lineWidth = 1; g.stroke();
          g.fillStyle = 'rgba(140,70,30,0.55)'; g.beginPath(); g.arc(rr(-w / 3, w / 3), rr(-h / 4, h / 4), rr(2, 5), 0, TAU); g.fill();
        });
      } else if (kind < 0.6) { // pipe
        const L = 46 * s, w = 7 * s;
        shadowed(x, y, a, (sh) => {
          g.beginPath(); g.rect(-L / 2, -w / 2, L, w);
          if (sh) { g.fill(); return; }
          g.fillStyle = '#4b555f'; g.fill();
          g.fillStyle = 'rgba(190,200,210,0.25)'; g.fillRect(-L / 2, -w / 2, L, w * 0.3);
          g.fillStyle = '#121518'; g.beginPath(); g.ellipse(L / 2, 0, 2, w / 2, 0, 0, TAU); g.fill();
        });
      } else if (kind < 0.74) { // barrel
        const r = 10 * s;
        shadowed(x, y, 0, (sh) => {
          g.beginPath(); g.arc(0, 0, r, 0, TAU);
          if (sh) { g.fill(); return; }
          g.fillStyle = R() < 0.5 ? '#6b5512' : '#5a2a22'; g.fill();
          g.strokeStyle = '#1c1a14'; g.lineWidth = 1.5; g.stroke();
          g.beginPath(); g.arc(0, 0, r * 0.7, 0, TAU); g.strokeStyle = 'rgba(0,0,0,0.35)'; g.stroke();
          g.fillStyle = '#1a1a1a'; g.beginPath(); g.arc(r * 0.35, -r * 0.2, r * 0.16, 0, TAU); g.fill();
          g.strokeStyle = 'rgba(255,230,160,0.25)'; g.beginPath(); g.arc(0, 0, r - 1.5, Math.PI * 1.05, Math.PI * 1.5); g.stroke();
        });
      } else if (kind < 0.86) { // girder
        const L = 60 * s, w = 9 * s;
        shadowed(x, y, a, (sh) => {
          g.beginPath(); g.rect(-L / 2, -w / 2, L, w);
          if (sh) { g.fill(); return; }
          g.fillStyle = '#5a3a24'; g.fill();
          g.fillStyle = '#3a2618'; g.fillRect(-L / 2, -1, L, 2);
          g.strokeStyle = '#1a120c'; g.lineWidth = 1; g.strokeRect(-L / 2, -w / 2, L, w);
        });
      } else { // crushed car block
        const w = 52 * s, h = 34 * s;
        shadowed(x, y, a, (sh) => {
          g.beginPath(); g.rect(-w / 2, -h / 2, w, h);
          if (sh) { g.fill(); return; }
          const cols = ['#3d2a2a', '#26323e', '#3a3a2a', '#2e2e34'];
          g.fillStyle = cols[Math.floor(R() * cols.length)]; g.fill();
          g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 1.2;
          for (let k = 1; k < 5; k++) { g.beginPath(); g.moveTo(-w / 2, -h / 2 + (h * k) / 5 + rr(-2, 2)); g.lineTo(w / 2, -h / 2 + (h * k) / 5 + rr(-2, 2)); g.stroke(); }
          g.strokeStyle = 'rgba(160,170,180,0.25)'; g.strokeRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2);
          g.fillStyle = 'rgba(130,180,220,0.25)'; g.fillRect(rr(-w / 3, 0), rr(-h / 3, 0), 10, 5);
        });
      }
    }
    // light poles (positions returned for dynamic pools)
    const lights = opts.lights || [
      [cx - clear * 1.02, cy - clear * 0.55], [cx + clear * 1.05, cy - clear * 0.45],
      [cx - clear * 0.85, cy + clear * 0.8], [cx + clear * 0.95, cy + clear * 0.75],
    ];
    // fence + canopy along top edge
    if (canopyH) {
      // dark under-canopy shade
      const sg = g.createLinearGradient(0, 0, 0, canopyH + 70);
      sg.addColorStop(0, 'rgba(0,0,0,0.75)'); sg.addColorStop(0.6, 'rgba(0,0,0,0.35)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = sg; g.fillRect(0, 0, W, canopyH + 70);
      // chain-link fence (broken in places)
      const fy = canopyH + 18;
      g.strokeStyle = 'rgba(150,160,170,0.35)'; g.lineWidth = 1;
      g.beginPath();
      for (let x = 0; x < W; x += 6) { if (fract(x * 0.0037) < 0.12) continue; g.moveTo(x, fy - 2); g.lineTo(x + 3, fy + 2); }
      g.stroke();
      g.strokeStyle = 'rgba(160,170,180,0.4)'; g.beginPath(); g.moveTo(0, fy); g.lineTo(W, fy); g.stroke();
      for (let x = 10; x < W; x += 48) { g.fillStyle = '#0b0d0f'; g.fillRect(x + 2, fy - 1, 5, 5); g.fillStyle = '#6a7480'; g.fillRect(x, fy - 3, 5, 5); }
      // tree crowns
      const crowns = [];
      for (let x = -30; x < W + 40; x += rr(26, 46)) crowns.push([x, rr(-10, canopyH * 0.55), rr(30, 52)]);
      for (let x = -20; x < W + 40; x += rr(40, 70)) crowns.push([x, rr(canopyH * 0.3, canopyH * 0.75), rr(26, 40)]);
      for (const [x, y, r] of crowns) { g.fillStyle = 'rgba(0,0,0,0.5)'; g.beginPath(); g.arc(x + 9, y + 12, r, 0, TAU); g.fill(); }
      for (const [x, y, r] of crowns) {
        g.fillStyle = '#0a1710'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
        for (let k = 0; k < 6; k++) {
          const a = rr(0, TAU), d = rr(0, r * 0.6), r2 = r * rr(0.3, 0.55);
          g.fillStyle = k < 3 ? '#10251a' : '#143021';
          g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, r2, 0, TAU); g.fill();
        }
        // top-left moonlit highlights
        g.fillStyle = 'rgba(70,120,95,0.28)';
        for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(x - r * 0.35 + rr(-6, 6), y - r * 0.35 + rr(-6, 6), r * rr(0.15, 0.3), 0, TAU); g.fill(); }
      }
    }
    for (const [lx, ly] of lights) {
      // pole base (lamp head drawn dynamically)
      g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(lx + 2, ly + 3, 12, 12);
      g.fillStyle = '#3a434d'; g.fillRect(lx - 5, ly - 5, 10, 10);
      g.strokeStyle = '#151a1f'; g.strokeRect(lx - 5, ly - 5, 10, 10);
      hazardBandG(g, lx - 5, ly + 5, 10, 3);
      // cable to the camp
      g.strokeStyle = 'rgba(10,12,14,0.8)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(lx, ly); g.quadraticCurveTo((lx + cx) / 2 + 20, (ly + cy) / 2 - 30, lx + (cx - lx) * 0.6, ly + (cy - ly) * 0.6); g.stroke();
    }
    // moonlight tint + vignette
    g.fillStyle = 'rgba(40,70,120,0.08)'; g.fillRect(0, 0, W, H);
    const vg = g.createRadialGradient(cx, cy, Math.min(W, H) * 0.3, cx, cy, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    return { canvas: c, puddles, lights };
  }
  function hazardBandG(g, x, y, w, h) {
    g.fillStyle = HAZ; g.fillRect(x, y, w, h);
    g.fillStyle = '#111';
    for (let i = 0; i < w; i += 4) g.fillRect(x + i, y, 2, h);
  }

  function lightLevel(i, t, reduce) {
    const base = 0.85 + 0.08 * Math.sin(t * 1.3 + i * 2.1) + 0.05 * Math.sin(t * 3.7 + i);
    if (reduce) return base;
    // one faulty lamp sputters occasionally (local, < 3 Hz on average)
    if (i === 1) {
      const c = fract(t * 0.23);
      if (c > 0.9) return base * (fract(t * 2.5) < 0.5 ? 0.35 : 0.9);
    }
    return base;
  }

  const Arena = {
    clearCache() { groundCache.key = ''; groundCache.canvas = null; },
    // returns cached layout info (lights, puddles) after the first draw
    layout() { return { lights: groundCache.lights, puddles: groundCache.puddles }; },

    // opts: { seed, cx, cy (camp centre), clearR, canopy (false = none),
    //         lights [[x,y],...], rain 0..1, mist 0..1, reduce }
    drawGround(ctx, W, H, t, opts) {
      opts = opts || {};
      const res = devScale(ctx);
      const key = [W, H, res, opts.seed || 7, opts.cx, opts.cy, opts.clearR, opts.canopy, JSON.stringify(opts.lights || null)].join('|');
      if (groundCache.key !== key) {
        const b = buildGround(W, H, opts, res);
        groundCache.key = key; groundCache.canvas = b.canvas; groundCache.puddles = b.puddles; groundCache.lights = b.lights;
      }
      ctx.drawImage(groundCache.canvas, 0, 0, W, H);
      const reduce = !!opts.reduce;
      // warm work-light pools
      const ls = getLightSprite();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      groundCache.lights.forEach(([lx, ly], i) => {
        const L = lightLevel(i, t, reduce);
        const r = 230;
        ctx.globalAlpha = 0.24 * L;
        ctx.drawImage(ls, lx - r, ly - r, r * 2, r * 2);
      });
      ctx.restore();
      // puddle shimmer + reflected lamps
      ctx.save();
      for (const p of groundCache.puddles) {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
        ctx.beginPath(); ctx.ellipse(0, 0, p.rx, p.ry, 0, 0, TAU); ctx.clip();
        let near = 0;
        groundCache.lights.forEach(([lx, ly], i) => { const d = Math.hypot(lx - p.x, ly - p.y); if (d < 320) near = Math.max(near, (1 - d / 320) * lightLevel(i, t, reduce)); });
        if (near > 0) drawGlow(ctx, -p.rx * 0.2, -p.ry * 0.1, p.rx * 0.9, '255,190,120', near * 0.6);
        ctx.strokeStyle = 'rgba(170,200,230,0.22)'; ctx.lineWidth = 1;
        ctx.beginPath();
        for (let k = 0; k < 3; k++) {
          const yy = -p.ry + ((k + 1) / 4) * p.ry * 2;
          const ph = t * (reduce ? 0.3 : 0.9) + k * 1.7 + p.x * 0.01;
          ctx.moveTo(-p.rx, yy + Math.sin(ph) * 2);
          for (let xx = -p.rx; xx <= p.rx; xx += 10) ctx.lineTo(xx, yy + Math.sin(ph + xx * 0.12) * 1.6);
        }
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
      // lamp heads
      groundCache.lights.forEach(([lx, ly], i) => {
        const L = lightLevel(i, t, reduce);
        drawGlow(ctx, lx, ly, 26, '255,200,130', 0.8 * L);
        ctx.fillStyle = '#20262c'; ctx.fillRect(lx - 7, ly - 4, 14, 8);
        ctx.fillStyle = `rgba(255,${Math.round(200 + 40 * L)},160,${0.5 + 0.5 * L})`;
        ctx.fillRect(lx - 5, ly - 2, 10, 4);
      });
      // mist
      if (opts.mist > 0) {
        const m = getMist();
        ctx.save();
        for (let i = 0; i < 7; i++) {
          const sp = reduce ? 4 : 10;
          const x = fract(i * 0.37 + t * sp / W * (0.5 + (i % 3) * 0.25)) * (W + 500) - 250;
          const y = H * (0.1 + 0.8 * fract(i * 0.61)) + Math.sin(t * 0.2 + i) * 20;
          const r = 180 + (i % 3) * 70;
          ctx.globalAlpha = 0.12 * opts.mist;
          ctx.drawImage(m, x - r, y - r * 0.6, r * 2, r * 1.2);
        }
        ctx.restore();
      }
      // rain (top-down: short slanted streaks + splash rings)
      if (opts.rain > 0) {
        const n = Math.round((reduce ? 60 : 140) * clamp(opts.rain, 0, 1));
        ctx.save();
        ctx.strokeStyle = 'rgba(170,200,230,0.28)'; ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const h1 = fract(Math.sin(i * 12.9898) * 43758.5453), h2 = fract(Math.sin(i * 78.233) * 12543.123);
          const ph = fract(t * 2.2 + h1);
          const x = h2 * W + ph * 30, y = fract(h1 + t * 0.9) * H;
          ctx.moveTo(x, y); ctx.lineTo(x + 5, y + 12);
        }
        ctx.stroke();
        ctx.strokeStyle = 'rgba(170,200,230,0.22)';
        ctx.beginPath();
        for (let i = 0; i < n / 3; i++) {
          const h1 = fract(Math.sin(i * 39.17) * 9375.31), h2 = fract(Math.sin(i * 11.3) * 2713.7);
          const k = fract(t * 1.6 + h1);
          const x = h2 * W, y = fract(h1 * 7.1 + Math.floor(t * 1.6 + h1) * 0.31) * H, r = 1 + k * 5;
          ctx.moveTo(x + r, y); ctx.ellipse(x, y, r, r * 0.6, 0, 0, TAU);
        }
        ctx.globalAlpha = 0.8;
        ctx.stroke();
        ctx.restore();
      }
    },

    // wrecked hauler from above, front = +x. ~210 x 86 px at scale 1.
    // opts: { scale, reduce }
    drawTransport(ctx, x, y, angle, repair01, t, opts) {
      opts = opts || {};
      const rp = clamp(repair01 || 0, 0, 1);
      const s = opts.scale || 1;
      const reduce = !!opts.reduce;
      const L = 210, Wd = 86;
      const done = rp >= 0.999;
      ctx.save();
      ctx.translate(x, y); ctx.rotate(angle); ctx.scale(s, s);
      const toWorldLight = (lx, ly) => [Math.cos(-angle) * lx - Math.sin(-angle) * ly, Math.sin(-angle) * lx + Math.cos(-angle) * ly];
      const sh = toWorldLight(9, 12);
      // headlight cones (under the truck so they read as ground light)
      if (done) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (const sy of [-Wd * 0.32, Wd * 0.32]) {
          const g = ctx.createRadialGradient(L / 2, sy, 4, L / 2, sy, 230);
          g.addColorStop(0, 'rgba(255,245,210,0.45)'); g.addColorStop(1, 'rgba(255,240,200,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.moveTo(L / 2, sy); ctx.lineTo(L / 2 + 230, sy - 80); ctx.lineTo(L / 2 + 230, sy + 80); ctx.closePath(); ctx.fill();
        }
        ctx.restore();
      }
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(-L / 2 + sh[0], -Wd / 2 + sh[1], L, Wd);
      // wheels (6). Rear-left one is off until 20% repaired.
      const wheels = [[-L * 0.36, -1], [-L * 0.36, 1], [-L * 0.12, -1], [-L * 0.12, 1], [L * 0.3, -1], [L * 0.3, 1]];
      wheels.forEach(([wx, side], i) => {
        if (i === 0 && rp < 0.2) {
          // lying on the ground beside the truck
          ctx.save(); ctx.translate(wx - 30, -Wd / 2 - 34); ctx.rotate(0.4);
          ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.arc(4, 5, 15, 0, TAU); ctx.fill();
          ctx.fillStyle = '#111316'; ctx.beginPath(); ctx.arc(0, 0, 15, 0, TAU); ctx.fill();
          ctx.fillStyle = '#58616b'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAU); ctx.fill();
          ctx.restore();
          ctx.fillStyle = '#4a525b'; ctx.fillRect(wx - 4, side * Wd / 2 - 3 - (side < 0 ? 4 : 0), 8, 6); // bare hub
          return;
        }
        ctx.fillStyle = '#0f1114'; ctx.fillRect(wx - 16, side * (Wd / 2) - 9 + side * 3, 32, 18);
        ctx.fillStyle = 'rgba(80,88,96,0.6)';
        for (let k = -12; k <= 12; k += 6) ctx.fillRect(wx + k - 1, side * (Wd / 2) - 9 + side * 3, 2, 18);
      });
      // chassis + exposed frame
      ctx.fillStyle = '#1b2026'; ctx.fillRect(-L / 2, -Wd / 2, L, Wd);
      ctx.strokeStyle = '#0a0c0f'; ctx.lineWidth = 2; ctx.strokeRect(-L / 2, -Wd / 2, L, Wd);
      ctx.strokeStyle = '#3a434d'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(-L / 2 + 4, -Wd * 0.28); ctx.lineTo(L * 0.18, -Wd * 0.28); ctx.moveTo(-L / 2 + 4, Wd * 0.28); ctx.lineTo(L * 0.18, Wd * 0.28); ctx.stroke();
      ctx.lineWidth = 3;
      ctx.beginPath(); for (let k = 0; k < 7; k++) { const fx = -L / 2 + 12 + k * 22; ctx.moveTo(fx, -Wd / 2 + 4); ctx.lineTo(fx, Wd / 2 - 4); } ctx.stroke();
      // cargo-bed panels: 3 x 2, each snaps in at its own repair threshold
      const cols = 3, pw = (L * 0.68) / cols, ph = Wd / 2 - 3;
      const bx0 = -L / 2 + 2;
      const panels = [];
      for (let i = 0; i < cols; i++) for (let j = 0; j < 2; j++) panels.push([i, j]);
      const order = [0, 3, 1, 4, 2, 5];
      let activeSlot = null;
      order.forEach((pi, n) => {
        const [i, j] = panels[pi];
        const th = 0.08 + n * 0.12; // 0.08 .. 0.68
        const k = clamp((rp - (th - 0.08)) / 0.08, 0, 1);
        const sx = bx0 + i * pw + 1, sy = j ? 2 : -Wd / 2 + 1;
        // ground spot (scattered)
        const gx = sx + (j ? 10 : -6) + (i - 1) * 14, gy = j ? Wd / 2 + 24 + i * 6 : -Wd / 2 - 44 - i * 4;
        const ga = (j ? 0.5 : -0.35) + i * 0.3;
        if (k <= 0) {
          drawPanel(ctx, gx, gy, pw - 2, ph, ga, 0.75, true);
        } else {
          const e = k * k * (3 - 2 * k);
          const px = lerp(gx, sx, e), py = lerp(gy, sy, e), pa = lerp(ga, 0, e);
          const lift = Math.sin(e * Math.PI) * 0.12;
          drawPanel(ctx, px, py, pw - 2, ph, pa, 1 + lift, false, lift);
          if (k < 1) activeSlot = [sx + pw / 2, sy + ph / 2];
        }
        if (!activeSlot && k <= 0 && rp > 0 && rp < 1) activeSlot = [sx + pw / 2, sy + ph / 2];
      });
      // cab
      const cabX = L * 0.18, cabW = L / 2 - cabX;
      ctx.fillStyle = '#2c343d'; ctx.fillRect(cabX, -Wd / 2, cabW, Wd);
      // hood: open (engine visible) until 80 %
      const hoodK = clamp((rp - 0.72) / 0.08, 0, 1);
      ctx.fillStyle = '#20262c'; ctx.fillRect(cabX + cabW * 0.45, -Wd * 0.4, cabW * 0.5, Wd * 0.8);
      // engine block
      ctx.fillStyle = '#3d454f'; ctx.fillRect(cabX + cabW * 0.5, -Wd * 0.25, cabW * 0.38, Wd * 0.5);
      ctx.strokeStyle = '#151a1f'; ctx.lineWidth = 1;
      for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(cabX + cabW * 0.52, -Wd * 0.2 + k * Wd * 0.13); ctx.lineTo(cabX + cabW * 0.86, -Wd * 0.2 + k * Wd * 0.13); ctx.stroke(); }
      if (rp < 0.5) drawGlow(ctx, cabX + cabW * 0.7, 0, 22, '255,90,40', 0.5 * (1 - rp * 2) * (0.8 + 0.2 * Math.sin(t * 3)));
      if (hoodK > 0) {
        const hx = lerp(cabX + cabW * 0.45 + 40, cabX + cabW * 0.45, hoodK * hoodK * (3 - 2 * hoodK));
        ctx.fillStyle = litGrad(ctx, 40, angle, '#5a6878', '#2a323b');
        ctx.fillRect(hx, -Wd * 0.42, cabW * 0.52, Wd * 0.84);
        ctx.strokeStyle = '#0d1014'; ctx.lineWidth = 1.5; ctx.strokeRect(hx, -Wd * 0.42, cabW * 0.52, Wd * 0.84);
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; for (let k = 0; k < 3; k++) ctx.fillRect(hx + 4 + k * 8, -Wd * 0.3, 3, Wd * 0.6);
      }
      // roof + windshield
      ctx.fillStyle = litGrad(ctx, 40, angle, '#5d6a79', '#2a323b');
      ctx.fillRect(cabX + 2, -Wd * 0.42, cabW * 0.4, Wd * 0.84);
      ctx.fillStyle = done ? '#16324a' : '#0d1a26';
      ctx.fillRect(cabX + cabW * 0.36, -Wd * 0.38, 7, Wd * 0.76);
      if (rp < 0.55) { // cracked windshield
        ctx.strokeStyle = 'rgba(200,220,240,0.6)'; ctx.lineWidth = 0.8;
        ctx.beginPath(); const wx = cabX + cabW * 0.36 + 3.5;
        ctx.moveTo(wx, -6); ctx.lineTo(wx - 2, -16); ctx.moveTo(wx, -6); ctx.lineTo(wx + 2, 6); ctx.lineTo(wx - 1, 16); ctx.moveTo(wx, -6); ctx.lineTo(wx + 3, -12); ctx.stroke();
      }
      // bumper hazard stripes
      hazardBand(ctx, L / 2 - 5, -Wd / 2, 5, Wd, 1);
      ctx.save(); ctx.translate(L / 2 - 5, -Wd / 2); ctx.rotate(Math.PI / 2); hazardBand(ctx, 0, -5, Wd, 5, 8); ctx.restore();
      // LED status strip along the side: fills with repair (progress readout)
      const nLed = 12;
      for (let k = 0; k < nLed; k++) {
        const on = k < Math.floor(rp * nLed + 0.001);
        const lx = -L / 2 + 10 + k * ((L * 0.62) / nLed), ly = -Wd / 2 - 1;
        if (on) drawGlow(ctx, lx + 3, ly + 1, 8, '86,224,255', 0.6);
        ctx.fillStyle = on ? '#8ff0ff' : '#14202a';
        ctx.fillRect(lx, ly - 1, 6, 3);
      }
      // headlights / tail lights / roof beacon
      for (const sy of [-Wd * 0.32, Wd * 0.32]) {
        ctx.fillStyle = done ? '#fff6d8' : '#3a3a30';
        ctx.fillRect(L / 2 - 4, sy - 5, 4, 10);
        if (done) drawGlow(ctx, L / 2, sy, 16, '255,240,200', 0.9);
        ctx.fillStyle = done ? '#ff3040' : '#3a1418';
        ctx.fillRect(-L / 2, sy - 4, 3, 8);
        if (done) drawGlow(ctx, -L / 2, sy, 12, '255,48,64', 0.7);
      }
      if (done) {
        const ba = t * (reduce ? 1.5 : 4);
        const bx = cabX + cabW * 0.2, by = 0;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(255,170,40,0.22)';
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.arc(bx, by, 120, ba - 0.25, ba + 0.25); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.arc(bx, by, 120, ba + Math.PI - 0.25, ba + Math.PI + 0.25); ctx.closePath(); ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#ffb020'; ctx.beginPath(); ctx.arc(bx, by, 5, 0, TAU); ctx.fill();
      } else {
        ctx.fillStyle = '#4a3a10'; ctx.beginPath(); ctx.arc(cabX + cabW * 0.2, 0, 5, 0, TAU); ctx.fill();
      }
      // repair work: welding sparkle on the panel being fitted
      if (activeSlot && rp > 0 && rp < 1) {
        const [wx, wy] = activeSlot;
        const fl = reduce ? 0.6 : 0.5 + 0.5 * Math.abs(Math.sin(t * 9.0));
        drawGlow(ctx, wx, wy, 20, '160,230,255', 0.55 * fl);
        ctx.strokeStyle = '#e8faff'; ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let k = 0; k < 5; k++) {
          const a = fract(Math.sin(k * 3.3 + Math.floor(t * 8)) * 43758) * TAU, d = 4 + fract(t * 3 + k * 0.3) * 10;
          ctx.moveTo(wx + Math.cos(a) * d * 0.4, wy + Math.sin(a) * d * 0.4); ctx.lineTo(wx + Math.cos(a) * d, wy + Math.sin(a) * d);
        }
        ctx.stroke();
      }
      // engine smoke while badly damaged (procedural puffs, no particles)
      if (rp < 0.6) {
        const amt = 1 - rp / 0.6;
        for (let k = 0; k < 5; k++) {
          const ph = fract(t * 0.35 + k / 5);
          const px = cabX + cabW * 0.7 - ph * 70 + Math.sin(ph * 6 + k) * 6, py = -ph * 40 + Math.cos(ph * 5 + k) * 8;
          ctx.fillStyle = `rgba(60,62,68,${0.35 * amt * (1 - ph)})`;
          ctx.beginPath(); ctx.arc(px, py, 6 + ph * 18, 0, TAU); ctx.fill();
        }
      }
      ctx.restore();
    },

    // ally auto-turret (cyan = friendly). opts: { fire 0..1 (muzzle flash) }
    drawTurret(ctx, x, y, angle, t, opts) {
      opts = opts || {};
      ctx.save();
      ctx.translate(x, y);
      // scan arc
      ctx.fillStyle = 'rgba(86,224,255,0.07)';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 90, angle - 0.35, angle + 0.35); ctx.closePath(); ctx.fill();
      // tripod
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.arc(4, 6, 15, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#151a1f'; ctx.lineWidth = 4;
      ctx.beginPath(); for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + (i / 3) * TAU; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 18, Math.sin(a) * 18); } ctx.stroke();
      ctx.strokeStyle = '#5d6b7b'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#2a323b'; ctx.beginPath(); ctx.arc(0, 0, 11, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#0d1014'; ctx.lineWidth = 1.5; ctx.stroke();
      // head
      ctx.rotate(angle);
      ctx.fillStyle = '#20262c'; ctx.fillRect(6, -5, 20, 3); ctx.fillRect(6, 2, 20, 3);
      ctx.fillStyle = '#9aa5b1'; ctx.fillRect(22, -5, 4, 3); ctx.fillRect(22, 2, 4, 3);
      ctx.fillStyle = litGrad(ctx, 10, angle, '#7d8b9b', '#2c343d');
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-9, -8, 18, 16, 4) : ctx.rect(-9, -8, 18, 16); ctx.fill();
      ctx.strokeStyle = '#0d1014'; ctx.lineWidth = 1.5; ctx.stroke();
      const led = 0.6 + 0.4 * Math.sin(t * 3);
      drawGlow(ctx, 3, 0, 10, '86,224,255', 0.7 * led);
      ctx.fillStyle = '#8ff0ff'; ctx.beginPath(); ctx.arc(3, 0, 2.6, 0, TAU); ctx.fill();
      ctx.fillStyle = '#56e0ff'; ctx.fillRect(-8, -1, 4, 2);
      if (opts.fire > 0) {
        const f = clamp(opts.fire, 0, 1) * (opts.reduce ? 0.5 : 1);
        drawGlow(ctx, 30, -3.5, 12 * f + 4, '255,230,160', f);
        drawGlow(ctx, 30, 3.5, 12 * f + 4, '255,230,160', f);
      }
      ctx.restore();
    },

    // edge-of-screen incoming warning. angle = direction the drones will travel
    // (pointing into the arena). opts: { label, count, color 'r,g,b' }
    drawSpawnWarning(ctx, x, y, angle, t, opts) {
      opts = opts || {};
      const rgb = opts.color || '255,176,32';
      ctx.save();
      ctx.translate(x, y);
      // edge glow
      drawGlow(ctx, 0, 0, 70, '255,60,40', 0.25 + 0.1 * Math.sin(t * 4));
      ctx.rotate(angle);
      // 3 chevrons marching inward (~1.5 Hz sweep)
      for (let i = 0; i < 3; i++) {
        const a = 0.25 + 0.75 * fract(t * 1.5 - i * 0.28);
        const cx = 6 + i * 16;
        ctx.beginPath();
        ctx.moveTo(cx - 6, -16); ctx.lineTo(cx + 8, 0); ctx.lineTo(cx - 6, 16);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(10,8,6,0.8)'; ctx.lineWidth = 9; ctx.stroke();
        ctx.strokeStyle = `rgba(${rgb},${a})`; ctx.lineWidth = 5; ctx.stroke();
      }
      ctx.rotate(-angle);
      // warning badge
      ctx.fillStyle = 'rgba(10,8,6,0.85)';
      ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(13, 9); ctx.lineTo(-13, 9); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = `rgb(${rgb})`; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.fillStyle = `rgb(${rgb})`;
      ctx.font = '900 14px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('!', 0, 1);
      if (opts.label || opts.count) {
        const txt = (opts.count ? opts.count + 'x ' : '') + (opts.label || '');
        ctx.font = '700 12px ui-monospace, monospace';
        const w = ctx.measureText(txt).width + 12;
        const ox = clamp(Math.cos(angle) * 60, -60, 60), oy = clamp(Math.sin(angle) * 60, -60, 60) + 24;
        ctx.fillStyle = 'rgba(10,8,6,0.85)'; ctx.fillRect(ox - w / 2, oy - 9, w, 18);
        ctx.strokeStyle = `rgba(${rgb},0.8)`; ctx.lineWidth = 1; ctx.strokeRect(ox - w / 2, oy - 9, w, 18);
        ctx.fillStyle = `rgb(${rgb})`; ctx.fillText(txt, ox, oy + 1);
      }
      ctx.restore();
    },
  };

  function drawPanel(ctx, x, y, w, h, a, sc, onGround, lift) {
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2); ctx.rotate(a); ctx.scale(sc, sc);
    const so = onGround ? 3 : 2 + (lift || 0) * 60;
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(-w / 2 + so, -h / 2 + so * 1.2, w, h);
    ctx.fillStyle = onGround ? '#323b45' : '#43505d';
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.strokeStyle = '#10141a'; ctx.lineWidth = 1.5; ctx.strokeRect(-w / 2, -h / 2, w, h);
    ctx.strokeStyle = 'rgba(160,175,190,0.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-w / 2 + 1, -h / 2 + 1); ctx.lineTo(w / 2 - 1, -h / 2 + 1); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); for (let k = 1; k < 4; k++) { ctx.moveTo(-w / 2 + (w * k) / 4, -h / 2 + 3); ctx.lineTo(-w / 2 + (w * k) / 4, h / 2 - 3); } ctx.stroke();
    rivets(ctx, [[-w / 2 + 3, -h / 2 + 3], [w / 2 - 3, -h / 2 + 3], [-w / 2 + 3, h / 2 - 3], [w / 2 - 3, h / 2 - 3]], 1.2);
    if (onGround) { ctx.fillStyle = 'rgba(140,70,30,0.45)'; ctx.beginPath(); ctx.arc(w * 0.15, h * 0.1, 4, 0, TAU); ctx.fill(); }
    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // FX additions (extend the existing SEHS.FX particle system)
  // Base particles (spark/fire/smoke/ring/sparkle) are reused with g = 0 for
  // the top-down view; drone-specific shapes live in fx._dp, updated/drawn by
  // wrapped update()/drawWorld()/reset(), so a single fx.update + fx.drawWorld
  // call per frame still covers everything.
  // ---------------------------------------------------------------------------
  const MAX_DP = 320;
  if (SEHS.FX && !SEHS.FX.prototype.droneExplode) {
    const P = SEHS.FX.prototype;
    const dp = (fx) => fx._dp || (fx._dp = []);
    const push = (fx, p) => { const l = dp(fx); if (l.length >= MAX_DP) l.shift(); l.push(p); return p; };
    const oUpdate = P.update, oDraw = P.drawWorld, oReset = P.reset;

    P.update = function (dt) {
      oUpdate.call(this, dt);
      const l = this._dp;
      if (!l) return;
      for (let i = l.length - 1; i >= 0; i--) {
        const p = l[i];
        p.age += dt;
        if (p.t === 'bolt') {
          if (p.age < 0.28) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - 5 * dt; p.vy *= 1 - 5 * dt; }
          else {
            const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
            p.sp = Math.min(2200, (p.sp || 200) + 2600 * dt);
            if (d < p.sp * dt + 6) {
              l.splice(i, 1);
              this.parts.push({ t: 'ring', x: p.tx, y: p.ty, r: 2, vr: 90, life: 0.25, age: 0, col: '#ffd27a' });
              if (p.cb) { try { p.cb(); } catch (e) { /* caller bug: keep FX alive */ } }
              continue;
            }
            p.x += (dx / d) * p.sp * dt; p.y += (dy / d) * p.sp * dt;
          }
          p.rot += p.vr * dt;
          continue;
        }
        if (p.age >= p.life) { l.splice(i, 1); continue; }
        if (p.vx != null) {
          p.x += p.vx * dt; p.y += p.vy * dt;
          const dr = p.drag != null ? p.drag : 2.5;
          p.vx *= Math.max(0, 1 - dr * dt); p.vy *= Math.max(0, 1 - dr * dt);
        }
        if (p.vr) { p.rot += p.vr * dt; p.vr *= Math.max(0, 1 - 1.2 * dt); }
        if (p.t === 'text') p.y -= 34 * dt;
      }
    };

    P.drawWorld = function (ctx) {
      oDraw.call(this, ctx);
      const l = this._dp;
      if (!l || !l.length) return;
      const reduce = this.reduce;
      ctx.save();
      for (const p of l) {
        if (p.age < 0 && p.t !== 'bolt') continue; // delayed spawn
        const k = Math.min(1, p.age / p.life);
        if (p.t === 'chunk') {
          ctx.globalAlpha = 1 - k * k;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.fillStyle = p.col; ctx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * 0.66);
          ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(-p.s / 2, -p.s / 3, p.s, 1.2);
          ctx.restore();
        } else if (p.t === 'rotor') {
          ctx.globalAlpha = 1 - k * k;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.strokeStyle = 'rgba(200,215,230,0.35)'; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.moveTo(-p.len, 0); ctx.lineTo(p.len, 0); ctx.stroke();
          ctx.rotate(-0.35);
          ctx.strokeStyle = '#d7e4f0'; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.moveTo(-p.len, 0); ctx.lineTo(p.len, 0); ctx.stroke();
          ctx.fillStyle = '#7d8a99'; ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, TAU); ctx.fill();
          ctx.restore();
        } else if (p.t === 'star') {
          ctx.globalAlpha = 1 - k;
          const r = p.r * (0.5 + k * 0.9);
          ctx.fillStyle = k < 0.4 ? '#fffbe6' : '#ffd060';
          ctx.beginPath();
          for (let i = 0; i < 16; i++) {
            const a = p.rot + (i / 16) * TAU, rr = i % 2 ? r * 0.38 : r;
            i ? ctx.lineTo(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr) : ctx.moveTo(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr);
          }
          ctx.closePath(); ctx.fill();
        } else if (p.t === 'trail') {
          const pts = p.pts, n = pts.length;
          if (n < 2) continue;
          ctx.lineCap = 'round';
          for (let i = 1; i < n; i++) {
            const u = i / (n - 1);
            // trail head (end of the list) appears first, tail fades first
            const vis = clamp((u - k * 1.1) * 3, 0, 1);
            if (vis <= 0) continue;
            ctx.globalAlpha = vis * (1 - k) * 0.35;
            ctx.strokeStyle = p.glow; ctx.lineWidth = p.w * u * 2.4 + 2;
            ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1]); ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
            ctx.globalAlpha = vis * (1 - k);
            ctx.strokeStyle = p.col; ctx.lineWidth = p.w * u + 1;
            ctx.stroke();
          }
          ctx.lineCap = 'butt';
        } else if (p.t === 'ghost') {
          ctx.globalAlpha = (1 - k) * 0.55;
          ctx.strokeStyle = p.col; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.stroke();
          ctx.globalAlpha = (1 - k) * 0.18; ctx.fillStyle = p.col; ctx.fill();
        } else if (p.t === 'shock') {
          const e = 1 - Math.pow(1 - k, 3);
          const r = p.R * e;
          ctx.globalAlpha = (1 - k) * (reduce ? 0.12 : 0.22);
          ctx.fillStyle = '#56e0ff';
          ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
          ctx.globalAlpha = (1 - k) * (reduce ? 0.6 : 0.95);
          ctx.strokeStyle = '#bff6ff'; ctx.lineWidth = (reduce ? 4 : 8) * (1 - k) + 1;
          ctx.stroke();
          ctx.strokeStyle = '#56e0ff'; ctx.lineWidth = 2;
          ctx.beginPath();
          const m = 36;
          for (let i = 0; i <= m; i++) {
            const a = (i / m) * TAU, j = r * 0.9 + (i % 2 ? 5 : -5) * (1 - k) * (reduce ? 0.4 : 1);
            i ? ctx.lineTo(p.x + Math.cos(a) * j, p.y + Math.sin(a) * j) : ctx.moveTo(p.x + Math.cos(a) * j, p.y + Math.sin(a) * j);
          }
          ctx.stroke();
        } else if (p.t === 'shield') {
          ctx.globalAlpha = (1 - k) * 0.9;
          const r = p.r + k * 8;
          ctx.strokeStyle = '#8ff0ff'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(p.x, p.y, r, p.a - 0.9, p.a + 0.9); ctx.stroke();
          // hex cells along the arc
          ctx.lineWidth = 1.2; ctx.strokeStyle = '#56e0ff';
          ctx.beginPath();
          for (let i = -3; i <= 3; i++) {
            const a = p.a + i * 0.26, cx = p.x + Math.cos(a) * (r - 7), cy = p.y + Math.sin(a) * (r - 7);
            for (let v = 0; v < 6; v++) {
              const b = (v / 6) * TAU + a;
              v ? ctx.lineTo(cx + Math.cos(b) * 6, cy + Math.sin(b) * 6) : ctx.moveTo(cx + Math.cos(b) * 6, cy + Math.sin(b) * 6);
            }
            ctx.closePath();
          }
          ctx.globalAlpha = (1 - k) * 0.55; ctx.stroke();
        } else if (p.t === 'shard') {
          ctx.globalAlpha = 1 - k;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.strokeStyle = '#e0ae52'; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(p.s, 0); ctx.moveTo(0, 0); ctx.lineTo(-p.s * 0.5, p.s * 0.85); ctx.moveTo(0, 0); ctx.lineTo(-p.s * 0.5, -p.s * 0.85); ctx.stroke();
          ctx.restore();
        } else if (p.t === 'text') {
          // pop: overshoot then settle; fade in last 35 %
          const ps = k < 0.12 ? (k / 0.12) * 1.35 : k < 0.22 ? lerp(1.35, 1, (k - 0.12) / 0.1) : 1;
          ctx.globalAlpha = k > 0.65 ? 1 - (k - 0.65) / 0.35 : 1;
          ctx.save(); ctx.translate(p.x, p.y); ctx.scale(ps, ps);
          if (!reduce) ctx.rotate(Math.sin(p.age * 18) * 0.04 * (1 - k));
          ctx.font = `900 ${p.size}px system-ui, sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.lineJoin = 'round';
          ctx.strokeStyle = '#0a0a0c'; ctx.lineWidth = 7; ctx.strokeText(p.str, 0, 0);
          ctx.fillStyle = p.col; ctx.fillText(p.str, 0, 0);
          if (p.sub) {
            ctx.font = `800 ${Math.round(p.size * 0.42)}px system-ui, sans-serif`;
            ctx.lineWidth = 4; ctx.strokeText(p.sub, 0, p.size * 0.72);
            ctx.fillStyle = '#ffffff'; ctx.fillText(p.sub, 0, p.size * 0.72);
          }
          ctx.restore();
        } else if (p.t === 'bolt') {
          ctx.globalAlpha = 1;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.fillStyle = '#c9a24a';
          ctx.beginPath();
          for (let v = 0; v < 6; v++) { const b = (v / 6) * TAU; v ? ctx.lineTo(Math.cos(b) * 5, Math.sin(b) * 5) : ctx.moveTo(5, 0); }
          ctx.closePath(); ctx.fill();
          ctx.strokeStyle = '#3a2a0a'; ctx.lineWidth = 1; ctx.stroke();
          ctx.fillStyle = '#2a1e08'; ctx.beginPath(); ctx.arc(0, 0, 1.8, 0, TAU); ctx.fill();
          ctx.fillStyle = '#ffe9a8'; ctx.fillRect(-3, -4, 3, 1.2);
          ctx.restore();
        }
      }
      ctx.restore();
    };

    P.reset = function () {
      oReset.call(this);
      if (this._dp) this._dp.length = 0;
    };

    // ---- public FX ----

    // Juicy drone pop. size: ~0.5 (swarm) .. 1 (scout) .. 2.5 (warden)
    P.droneExplode = function (x, y, size) {
      const s = clamp(size || 1, 0.3, 3);
      for (let i = 0; i < Math.round(10 * s + 4); i++) {
        const a = rand(0, TAU), v = rand(30, 200) * s;
        this.parts.push({ t: 'fire', x: x + rand(-6, 6) * s, y: y + rand(-6, 6) * s, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: rand(6, 13) * s, gr: 26 * s, life: rand(0.3, 0.6), age: 0 });
      }
      for (let i = 0; i < Math.round(6 * s + 3); i++) {
        const a = rand(0, TAU), v = rand(15, 70) * s;
        this.parts.push({ t: 'smoke', x: x + rand(-8, 8) * s, y: y + rand(-8, 8) * s, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 15, r: rand(8, 14) * s, gr: 28 * s, life: rand(0.8, 1.5), age: 0, col: '48,50,58', a: 0.55 });
      }
      this.sparks(x, y, Math.round(18 * s + 6), { vmin: 120, vmax: 520 * Math.sqrt(s), g: 0 });
      this.sparks(x, y, 6, { vmin: 80, vmax: 300, g: 0, col: '#ff6a3d' });
      push(this, { t: 'star', x, y, r: 26 * s, rot: rand(0, TAU), life: 0.16, age: 0 });
      this.parts.push({ t: 'ring', x, y, r: 6 * s, vr: 420 * s, life: 0.3, age: 0, col: '#ffd27a' });
      // rotor blades spinning off
      const nr = s >= 2 ? 4 : s >= 0.8 ? 3 : 1;
      for (let i = 0; i < nr; i++) {
        const a = rand(0, TAU), v = rand(220, 420);
        push(this, { t: 'rotor', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 2.2, rot: rand(0, TAU), vr: rand(25, 40) * (Math.random() < 0.5 ? -1 : 1), len: rand(5, 8) * Math.min(1.6, Math.sqrt(s)), life: rand(0.8, 1.2), age: 0 });
      }
      for (let i = 0; i < Math.round(5 * s + 2); i++) {
        const a = rand(0, TAU), v = rand(120, 380) * Math.sqrt(s);
        push(this, { t: 'chunk', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 3, rot: rand(0, TAU), vr: rand(-14, 14), s: rand(3, 7) * Math.sqrt(s), col: Math.random() < 0.3 ? '#ff3040' : Math.random() < 0.5 ? '#8a96a2' : '#4a5562', life: rand(0.7, 1.2), age: 0 });
      }
      this.addShake(3 + 3 * s);
      this.doFlash(Math.min(0.18, 0.05 * s), '255,220,170');
    };

    // Palm-down slam: cyan shockwave ring
    P.empPulse = function (x, y, radius) {
      const R = radius || 160;
      push(this, { t: 'shock', x, y, R, life: 0.55, age: 0 });
      push(this, { t: 'shock', x, y, R: R * 0.6, life: 0.4, age: -0.08 });
      this.parts.push({ t: 'ring', x, y, r: 4, vr: R * 2.4, life: 0.35, age: 0, col: '#e8feff' });
      this.sparks(x, y, this.reduce ? 10 : 22, { vmin: R * 1.2, vmax: R * 2.6, g: 0, col: '#9ff4ff' });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + rand(-0.3, 0.3);
        this.arc(x, y, x + Math.cos(a) * R * 0.55, y + Math.sin(a) * R * 0.55, 0.14, '120,235,255');
      }
      this.addShake(7);
      this.doFlash(0.15, '120,230,255');
    };

    // Swat arc trail. points: [[x,y],...] or [{x,y},...] ordered tail -> head
    P.swatTrail = function (points, o) {
      o = o || {};
      const pts = (points || []).map((p) => (Array.isArray(p) ? [p[0], p[1]] : [p.x, p.y]));
      if (pts.length < 2) return;
      push(this, { t: 'trail', pts, w: o.width || 9, col: o.col || '#e8feff', glow: o.glow || '#56e0ff', life: o.life || 0.32, age: 0 });
      const h = pts[pts.length - 1];
      this.sparks(h[0], h[1], 5, { vmin: 60, vmax: 220, g: 0, col: '#bff6ff' });
    };

    // Disc throw: pass an array of points for a trail, or (x, y[, r]) per
    // frame to leave spinning-disc afterimages.
    P.discTrail = function (a, b, c) {
      if (Array.isArray(a)) {
        const pts = a.map((p) => (Array.isArray(p) ? [p[0], p[1]] : [p.x, p.y]));
        if (pts.length < 2) return;
        push(this, { t: 'trail', pts, w: 5, col: '#fff1c2', glow: '#ffb020', life: 0.4, age: 0 });
        return;
      }
      push(this, { t: 'ghost', x: a, y: b, r: c || 9, col: '#ffc53d', life: 0.25, age: 0 });
      if (Math.random() < 0.4) this.sparks(a, b, 1, { vmin: 30, vmax: 120, g: 0, col: '#ffd27a' });
    };

    // Net torn apart (ally freed)
    P.netBurst = function (x, y, r) {
      r = r || 30;
      for (let i = 0; i < 18; i++) {
        const a = rand(0, TAU), v = rand(140, 360);
        push(this, { t: 'shard', x: x + Math.cos(a) * r * 0.5, y: y + Math.sin(a) * r * 0.5, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 3.2, rot: rand(0, TAU), vr: rand(-16, 16), s: rand(4, 8), life: rand(0.6, 1), age: 0 });
      }
      this.sparks(x, y, 12, { vmin: 100, vmax: 360, g: 0, col: '#ffd27a' });
      this.parts.push({ t: 'ring', x, y, r: r * 0.8, vr: 260, life: 0.3, age: 0, col: '#e0ae52' });
      this.addShake(3);
    };

    // A drone shot blocked by the shield. angle = direction from (x,y) to the hit
    P.shieldFlash = function (x, y, angle, r) {
      r = r || 34;
      push(this, { t: 'shield', x, y, a: angle || 0, r, life: 0.4, age: 0 });
      const hx = x + Math.cos(angle || 0) * r, hy = y + Math.sin(angle || 0) * r;
      this.sparks(hx, hy, 10, { dir: angle || 0, spread: 1.1, vmin: 80, vmax: 320, g: 0, col: '#bff6ff' });
      this.addShake(2);
    };

    // "x3 COMBO" pop. n = combo count. o: { label, sub }
    P.comboText = function (x, y, n, o) {
      o = o || {};
      const col = n >= 8 ? '#ff7ad9' : n >= 5 ? '#ff6a3d' : n >= 3 ? '#ffb020' : '#ffe066';
      const size = Math.min(56, 30 + n * 3);
      push(this, { t: 'text', x, y, str: o.label || 'x' + n + ' COMBO', sub: o.sub || null, col, size, life: 1.1, age: 0 });
      if (n >= 3) this.sparks(x, y, Math.min(20, 4 + n * 2), { vmin: 80, vmax: 280, g: 0, col });
    };

    // Plain floating text using the same pop (e.g. "+15 SCRAP", "FREED!")
    P.popText = function (x, y, str, col, size) {
      push(this, { t: 'text', x, y, str, col: col || '#ffe066', size: size || 26, life: 1, age: 0 });
    };

    // Scrap bolts burst out then home to the HUD counter.
    // o: { n (default 5), tx, ty (default fx.hudTarget or top-left), onArrive }
    P.scrapPickup = function (x, y, o) {
      o = o || {};
      const n = Math.min(12, o.n || 5);
      const tgt = this.hudTarget || { x: 60, y: 40 };
      const tx = o.tx != null ? o.tx : tgt.x, ty = o.ty != null ? o.ty : tgt.y;
      for (let i = 0; i < n; i++) {
        const a = rand(0, TAU), v = rand(120, 300);
        push(this, { t: 'bolt', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, tx, ty, rot: rand(0, TAU), vr: rand(-10, 10), age: -i * 0.03, life: 9, cb: o.onArrive || null });
      }
      this.parts.push({ t: 'ring', x, y, r: 3, vr: 120, life: 0.25, age: 0, col: '#ffd27a' });
    };
  }

  // ---------------------------------------------------------------------------
  // AUDIO additions. effects.js keeps its AudioContext private, so drones.js
  // runs a second tiny context that is created/resumed whenever
  // SEHS.Audio.init() is called (wrapped below) and honours SEHS.Audio.muted.
  // Loops (droneHum, workshopAmbient) go through loopBus, which is silenced on
  // setMuted(true) and restored on setMuted(false).
  // ---------------------------------------------------------------------------
  const A = SEHS.Audio;
  if (A && !A.droneZap) {
    let ac = null, master = null, loopBus = null, noiseBuf = null;
    function init() {
      try {
        if (!ac) {
          const Ctor = window.AudioContext || window.webkitAudioContext;
          if (!Ctor) return;
          ac = new Ctor();
          master = ac.createGain(); master.gain.value = 0.45; master.connect(ac.destination);
          loopBus = ac.createGain(); loopBus.gain.value = A.muted ? 0 : 1; loopBus.connect(master);
          const len = ac.sampleRate * 2;
          noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
          const d = noiseBuf.getChannelData(0);
          for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        }
        if (ac.state === 'suspended') ac.resume();
      } catch (e) { ac = null; }
    }
    const ok = () => ac && !A.muted;
    const oInit = A.init, oMute = A.setMuted;
    A.init = function () { oInit.apply(A, arguments); init(); };
    A.setMuted = function (v) {
      oMute.call(A, v);
      if (loopBus) loopBus.gain.setTargetAtTime(v ? 0 : 1, ac.currentTime, 0.05);
    };

    function tone(f, dur, type, vol, f2, delay, dest) {
      if (!ok()) return;
      const t0 = ac.currentTime + (delay || 0);
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(f, t0);
      if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(dest || master);
      o.start(t0); o.stop(t0 + dur + 0.05);
    }
    function noise(dur, vol, f, ftype, delay, f2, q, attack) {
      if (!ok()) return;
      const t0 = ac.currentTime + (delay || 0);
      const src = ac.createBufferSource();
      src.buffer = noiseBuf;
      const fl = ac.createBiquadFilter();
      fl.type = ftype || 'lowpass';
      if (q) fl.Q.value = q;
      fl.frequency.setValueAtTime(f || 1000, t0);
      if (f2) fl.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + dur);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol || 0.3, t0 + (attack || 0.005));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(fl); fl.connect(g); g.connect(master);
      src.start(t0, Math.random() * 1.2); src.stop(t0 + dur + 0.02);
    }
    const NOOP = { stop() {}, setVolume() {}, setPitch() {} };

    // generic loop: oscillators + optional noise, all into one gain on loopBus
    function makeLoop(build, vol) {
      if (!ac) init();
      if (!ac) return NOOP;
      const out = ac.createGain();
      out.gain.setValueAtTime(0.0001, ac.currentTime);
      out.gain.exponentialRampToValueAtTime(vol, ac.currentTime + 0.4);
      out.connect(loopBus);
      const nodes = [];
      const oscs = [];
      build(out, nodes, oscs);
      let stopped = false;
      return {
        stop(fade) {
          if (stopped) return; stopped = true;
          const f = fade != null ? fade : 0.3, t = ac.currentTime;
          out.gain.cancelScheduledValues(t);
          out.gain.setValueAtTime(Math.max(0.0001, out.gain.value), t);
          out.gain.exponentialRampToValueAtTime(0.0001, t + f);
          nodes.forEach((n) => { try { n.stop(t + f + 0.05); } catch (e) { /* already stopped */ } });
          setTimeout(() => { try { out.disconnect(); } catch (e) { /* gone */ } }, (f + 0.2) * 1000);
        },
        setVolume(v) { if (!stopped) out.gain.setTargetAtTime(Math.max(0.0001, vol * v), ac.currentTime, 0.1); },
        setPitch(k) { if (!stopped) oscs.forEach(([o, f]) => o.frequency.setTargetAtTime(f * k, ac.currentTime, 0.1)); },
      };
    }

    const HUM = {
      scout: [190, 'sawtooth', 22, 900], swarm: [330, 'square', 30, 1400], netter: [150, 'sawtooth', 18, 700],
      tether: [160, 'sawtooth', 16, 750], heavy: [72, 'sawtooth', 11, 420], jammer: [125, 'square', 7, 600],
      warden: [52, 'sawtooth', 8, 300],
    };

    Object.assign(A, {
      // Looping rotor hum. Returns { stop(fade), setVolume(0..1), setPitch(k) }
      droneHum(type, vol) {
        const h = HUM[type] || HUM.scout;
        return makeLoop((out, nodes, oscs) => {
          const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = h[3]; fl.Q.value = 2;
          const trem = ac.createGain(); trem.gain.value = 0.6;
          const lfo = ac.createOscillator(), lg = ac.createGain();
          lfo.frequency.value = h[2]; lg.gain.value = 0.4;
          lfo.connect(lg); lg.connect(trem.gain);
          fl.connect(trem); trem.connect(out);
          [1, 1.012].forEach((m) => {
            const o = ac.createOscillator(); o.type = h[1]; o.frequency.value = h[0] * m;
            o.connect(fl); o.start(); nodes.push(o); oscs.push([o, h[0] * m]);
          });
          if (type === 'warden' || type === 'heavy') {
            const sub = ac.createOscillator(); sub.type = 'sine'; sub.frequency.value = h[0] / 2;
            sub.connect(trem); sub.start(); nodes.push(sub); oscs.push([sub, h[0] / 2]);
          }
          if (type === 'jammer') {
            const wob = ac.createOscillator(), wg = ac.createGain();
            wob.frequency.value = 5; wg.gain.value = 60;
            wob.connect(wg); wg.connect(fl.frequency); wob.start(); nodes.push(wob);
            const n = ac.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
            const nf = ac.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 2400; nf.Q.value = 3;
            const ng = ac.createGain(); ng.gain.value = 0.25;
            n.connect(nf); nf.connect(ng); ng.connect(out); n.start(); nodes.push(n);
          }
          lfo.start(); nodes.push(lfo);
        }, (vol || 1) * (type === 'swarm' ? 0.03 : 0.06));
      },
      droneZap() { tone(1400, 0.12, 'square', 0.09, 260); noise(0.12, 0.2, 3500, 'highpass'); },
      // lighter, sillier than boom: pop + cartoon pitch drop + tinkling bits
      droneBoom() {
        noise(0.4, 0.55, 1400, 'lowpass', 0, 300);
        tone(240, 0.28, 'sine', 0.5, 55);
        tone(900, 0.22, 'triangle', 0.12, 180, 0.02);
        for (let i = 0; i < 4; i++) tone(rand(1800, 3600), 0.06, 'triangle', 0.05, null, 0.12 + i * rand(0.04, 0.08));
      },
      netFire() { noise(0.22, 0.35, 500, 'bandpass', 0, 2600, 1.5); tone(220, 0.18, 'square', 0.08, 90); tone(600, 0.1, 'sawtooth', 0.05, 1400, 0.05); },
      netRip() {
        for (let i = 0; i < 6; i++) noise(0.05, 0.3, rand(2000, 4500), 'highpass', i * rand(0.025, 0.05));
        noise(0.3, 0.2, 1800, 'bandpass', 0.05, 600, 1);
        tone(520, 0.12, 'triangle', 0.08, 900, 0.2);
      },
      swat() {
        noise(0.18, 0.4, 600, 'bandpass', 0, 2600, 1.2, 0.08);
        noise(0.1, 0.55, 2200, 'lowpass', 0.15);
        tone(170, 0.16, 'sine', 0.5, 60, 0.15);
        tone(1300, 0.06, 'square', 0.06, 700, 0.15);
      },
      discThrow() {
        tone(320, 0.35, 'sawtooth', 0.06, 1000);
        noise(0.35, 0.22, 800, 'bandpass', 0, 3500, 3, 0.05);
        tone(2400, 0.2, 'triangle', 0.06, 2600, 0.08);
      },
      empPulse() {
        tone(140, 0.7, 'sine', 0.6, 28);
        tone(2200, 0.45, 'sine', 0.1, 90);
        noise(0.6, 0.35, 5000, 'lowpass', 0, 160);
        tone(70, 0.5, 'square', 0.05, 40, 0.02);
      },
      lockOn() { tone(1320, 0.05, 'square', 0.07); tone(1760, 0.08, 'square', 0.07, null, 0.07); },
      // two-cycle rising/falling alarm siren (~1.6 s)
      waveStart() {
        if (!ok()) return;
        const t0 = ac.currentTime;
        const o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain(), fl = ac.createBiquadFilter();
        o.type = 'sawtooth'; o2.type = 'square';
        fl.type = 'lowpass'; fl.frequency.value = 2200;
        for (const [osc, m] of [[o, 1], [o2, 1.5]]) {
          osc.frequency.setValueAtTime(480 * m, t0);
          for (let i = 0; i < 2; i++) {
            osc.frequency.linearRampToValueAtTime(880 * m, t0 + i * 0.8 + 0.4);
            osc.frequency.linearRampToValueAtTime(480 * m, t0 + i * 0.8 + 0.8);
          }
        }
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.09, t0 + 0.05);
        g.gain.setValueAtTime(0.09, t0 + 1.4);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.65);
        o.connect(fl); o2.connect(fl); fl.connect(g); g.connect(master);
        o.start(t0); o2.start(t0); o.stop(t0 + 1.7); o2.stop(t0 + 1.7);
      },
      waveClear() {
        [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'triangle', 0.2, null, i * 0.09));
        [523, 659, 784, 1046, 1318].forEach((f) => tone(f, 0.9, 'triangle', 0.09, null, 0.4));
        tone(130.8, 1.0, 'sawtooth', 0.06, null, 0.4);
        tone(2093, 0.5, 'sine', 0.06, null, 0.45);
      },
      scrapCoin() { tone(1568, 0.06, 'square', 0.06); tone(2093, 0.14, 'square', 0.06, null, 0.06); },
      upgradeBuy() {
        tone(300, 0.25, 'sawtooth', 0.07, 900);
        [880, 1109, 1319, 1760].forEach((f, i) => tone(f, 0.16, 'triangle', 0.13, null, 0.15 + i * 0.06));
        tone(90, 0.15, 'sine', 0.4, 50, 0.42); noise(0.08, 0.2, 2500, 'highpass', 0.42);
      },
      // Workshop loop: low machine hum + slow filtered synth pad.
      workshopAmbient(vol) {
        return makeLoop((out, nodes, oscs) => {
          const hum = ac.createOscillator(); hum.type = 'sine'; hum.frequency.value = 55;
          const hg = ac.createGain(); hg.gain.value = 0.5; hum.connect(hg); hg.connect(out); hum.start(); nodes.push(hum);
          const h2 = ac.createOscillator(); h2.type = 'triangle'; h2.frequency.value = 110;
          const h2g = ac.createGain(); h2g.gain.value = 0.12; h2.connect(h2g); h2g.connect(out); h2.start(); nodes.push(h2);
          const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 700; fl.Q.value = 1;
          const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 380;
          lfo.connect(lg); lg.connect(fl.frequency); lfo.start(); nodes.push(lfo);
          const pg = ac.createGain(); pg.gain.value = 0.16; fl.connect(pg); pg.connect(out);
          [220, 261.6, 329.6, 392, 493.9].forEach((f, i) => {
            [1, 1.004].forEach((m) => {
              const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f * m * (i === 4 ? 0.5 : 1);
              o.connect(fl); o.start(); nodes.push(o); oscs.push([o, o.frequency.value]);
            });
          });
        }, (vol || 1) * 0.12);
      },
      questionRight() { tone(880, 0.1, 'triangle', 0.22); tone(1320, 0.22, 'triangle', 0.22, null, 0.09); tone(1760, 0.18, 'sine', 0.07, null, 0.16); },
      questionWrong() { tone(140, 0.38, 'square', 0.1); tone(147, 0.38, 'square', 0.1); tone(110, 0.25, 'sawtooth', 0.08, 70, 0.2); },
      // ominous double horn
      bossWarning() {
        for (let i = 0; i < 2; i++) {
          const d = i * 0.85;
          tone(55, 0.75, 'sawtooth', 0.22, 52, d); tone(58.3, 0.75, 'sawtooth', 0.2, 55, d);
          tone(110, 0.7, 'square', 0.05, 104, d);
          noise(0.7, 0.12, 300, 'lowpass', d, 120);
        }
        tone(880, 0.12, 'square', 0.04, null, 1.7); tone(660, 0.2, 'square', 0.04, null, 1.82);
      },
    });
  }

  SEHS.DroneArt = DroneArt;
  SEHS.Arena = Arena;
})();
