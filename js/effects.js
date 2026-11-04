/*
 * effects.js: VFX + AUDIO (owned by the "vfx-audio" agent)
 * Particles, explosions, electric arcs, screen crack, glitch, and a tiny
 * WebAudio synth (no audio files needed). Everything respects
 * fx.reduce (reduced flashing / shake for photosensitive players).
 */
(function () {
  'use strict';
  const SEHS = (window.SEHS = window.SEHS || {});
  const rand = (a, b) => a + Math.random() * (b - a);
  const TAU = Math.PI * 2;
  const MAX_PARTS = 900; // hard cap on live particles (per-frame cost)

  class FX {
    constructor() {
      this.parts = [];
      this.arcs = [];
      this.shake = 0;
      this.flash = 0;
      this.flashColor = '255,255,255';
      this.crack = null;
      this.crackT = 0;
      this.glitch = 0;
      this.reduce = false;
      this.buf = document.createElement('canvas');
      this.shutT = -1;      // shutdown timer (-1 = off)
      this.shutDur = 1.4;
    }

    // ---- shutdown state (read by the engine) ----
    // shutdownActive: the collapse animation is still running.
    // shutdownProgress: 0..1 through the animation (stays 1 while held black).
    // shutdownDone: animation finished; screen is held near-black until
    // clearShutdown() or reset().
    get shutdownActive() { return this.shutT >= 0 && this.shutT < this.shutDur; }
    get shutdownProgress() { return this.shutT < 0 ? 0 : Math.min(1, this.shutT / this.shutDur); }
    get shutdownDone() { return this.shutT >= this.shutDur; }

    reset() {
      this.parts.length = 0;
      this.arcs.length = 0;
      this.shake = 0; this.flash = 0; this.crack = null; this.glitch = 0;
      this.shutT = -1;
    }

    addShake(v) { this.shake = Math.max(this.shake, this.reduce ? v * 0.25 : v); }
    doFlash(v, color) { this.flash = Math.max(this.flash, this.reduce ? v * 0.3 : v); this.flashColor = color || '255,255,255'; }

    sparks(x, y, n, o) {
      o = o || {};
      for (let i = 0; i < n; i++) {
        const a = o.dir != null ? o.dir + rand(-o.spread || -0.6, o.spread || 0.6) : rand(0, TAU);
        const v = rand(o.vmin || 150, o.vmax || 520);
        this.parts.push({ t: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(0.25, 0.6), age: 0, col: o.col || (Math.random() < 0.5 ? '#fff6c2' : '#ffb347'), g: o.g != null ? o.g : 900 });
      }
    }

    dust(x, y, n) {
      for (let i = 0; i < n; i++) this.parts.push({ t: 'smoke', x: x + rand(-15, 15), y, vx: rand(-60, 60), vy: rand(-60, -10), r: rand(4, 8), gr: 30, life: rand(0.4, 0.8), age: 0, col: '150,150,150', a: 0.35 });
    }

    embers(x, y, w) {
      this.parts.push({ t: 'ember', x: x + rand(0, w), y, vx: rand(-15, 15), vy: rand(-120, -50), life: rand(0.8, 1.8), age: 0, r: rand(1.5, 3) });
    }

    debris(x, y, n, power) {
      for (let i = 0; i < n; i++) {
        const a = rand(-Math.PI, 0);
        const v = rand(200, 700) * power;
        this.parts.push({ t: 'debris', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: rand(0, TAU), vr: rand(-12, 12), s: rand(4, 11), life: rand(1, 2), age: 0, col: Math.random() < 0.5 ? '#8a96a2' : '#5b6672', g: 1400 });
      }
    }

    explosion(x, y, power, o) {
      o = o || {};
      power = power || 1;
      const up = o.fromBelow;
      for (let i = 0; i < 26 * power; i++) {
        const a = up ? rand(-Math.PI * 0.85, -Math.PI * 0.15) : rand(0, TAU);
        const v = rand(80, 420) * power;
        this.parts.push({ t: 'fire', x: x + rand(-20, 20) * power, y: y + rand(-10, 10), vx: Math.cos(a) * v * 0.6, vy: Math.sin(a) * v * (up ? 1.5 : 1), r: rand(10, 24) * power, gr: 40 * power, life: rand(0.5, 1.1), age: 0 });
      }
      for (let i = 0; i < 14 * power; i++) {
        const a = up ? rand(-Math.PI * 0.8, -Math.PI * 0.2) : rand(0, TAU);
        const v = rand(40, 180) * power;
        this.parts.push({ t: 'smoke', x: x + rand(-25, 25), y: y + rand(-15, 15), vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, r: rand(14, 26) * power, gr: 50, life: rand(1.2, 2.2), age: 0, col: '40,40,46', a: 0.6 });
      }
      this.sparks(x, y, 40 * power, up ? { dir: -Math.PI / 2, spread: 1.1, vmax: 900 * power } : { vmax: 700 * power });
      this.debris(x, y, Math.round(10 * power), power);
      this.parts.push({ t: 'ring', x, y, r: 10, vr: 900 * power, life: 0.35, age: 0 });
      this.addShake(16 * power);
      this.doFlash(0.4, '255,220,170');
    }

    // Small localised blast for a single destroyed body part (head, shins,
    // knees). o.dir biases the debris (-1 = left, +1 = right), o.color tints
    // the metal chunks (CSS colour). Flash is capped at 0.2.
    partialExplosion(x, y, power, o) {
      o = o || {};
      power = Math.max(0.2, Math.min(1, power || 0.5));
      const dir = o.dir || 0;
      for (let i = 0; i < 14 * power + 4; i++) {
        const a = rand(0, TAU), v = rand(40, 240) * power;
        this.parts.push({ t: 'fire', x: x + rand(-10, 10), y: y + rand(-8, 8), vx: Math.cos(a) * v * 0.6 + dir * 40, vy: Math.sin(a) * v, r: rand(8, 16) * power + 4, gr: 30 * power, life: rand(0.35, 0.7), age: 0 });
      }
      // lingering smoke that drifts up after the blast
      for (let i = 0; i < 8; i++) {
        this.parts.push({ t: 'smoke', x: x + rand(-10, 10), y: y + rand(-8, 8), vx: rand(-25, 25) + dir * 20, vy: rand(-70, -25), r: rand(6, 12) * (0.6 + power * 0.6), gr: 22, life: rand(1.4, 2.4), age: 0, col: '96,96,104', a: 0.5 });
      }
      this.sparks(x, y, Math.round(18 * power + 6), { vmax: 480 * power + 120, vmin: 90 });
      // metal chunks, biased toward dir
      const lo = dir < 0 ? -Math.PI : dir > 0 ? -Math.PI * 0.55 : -Math.PI * 0.9;
      const hi = dir < 0 ? -Math.PI * 0.45 : dir > 0 ? 0 : -Math.PI * 0.1;
      for (let i = 0; i < Math.round(6 * power + 3); i++) {
        const a = rand(lo, hi), v = rand(160, 460) * (0.5 + power * 0.6);
        this.parts.push({ t: 'debris', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: rand(0, TAU), vr: rand(-14, 14), s: rand(3, 8), life: rand(0.9, 1.6), age: 0, col: o.color || (Math.random() < 0.5 ? '#9aa6b2' : '#5b6672'), g: 1300 });
      }
      this.parts.push({ t: 'ring', x, y, r: 6, vr: 380 * power + 120, life: 0.25, age: 0 });
      // a few late sparks crackling from the wound
      for (let i = 0; i < 4; i++) this.parts.push({ t: 'delay', x, y, life: 0.25 + i * 0.22, age: 0, n: 3 });
      this.addShake(6 * power + 2);
      this.doFlash(Math.min(0.2, 0.12 + 0.08 * power), '255,225,180');
    }

    // Cheap per-frame emitter for a damaged part: thin grey smoke and an
    // occasional spark. Call once per frame (about 60 fps assumed);
    // o.rate scales emission (default 1), o.spark (0..1) spark chance scale.
    smokeTrail(x, y, o) {
      o = o || {};
      const rate = o.rate != null ? o.rate : 1;
      if (Math.random() < 0.35 * rate) {
        this.parts.push({ t: 'smoke', x: x + rand(-3, 3), y: y + rand(-2, 2), vx: rand(-10, 10) + (o.wind || -20), vy: rand(-55, -30), r: rand(2.5, 4), gr: 14, life: rand(0.7, 1.1), age: 0, col: '140,140,148', a: 0.34 });
      }
      if (Math.random() < 0.035 * (o.spark != null ? o.spark : 1) * rate) {
        this.sparks(x, y, 2 + Math.floor(Math.random() * 3), { vmin: 60, vmax: 260 });
      }
    }

    // Cyan sparkle burst for +1 energy cell (friends saved).
    energyGain(x, y) {
      for (let i = 0; i < 18; i++) {
        const a = rand(0, TAU), v = rand(40, 170);
        this.parts.push({ t: 'sparkle', x: x + rand(-6, 6), y: y + rand(-6, 6), vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, g: -40, s: rand(3, 7), life: rand(0.6, 1.1), age: 0, ph: rand(0, TAU) });
      }
      this.sparks(x, y, 10, { col: '#9ff4ff', vmin: 120, vmax: 360, g: 200 });
      this.parts.push({ t: 'ring', x, y, r: 4, vr: 220, life: 0.45, age: 0, col: '#6fe8ff' });
      this.parts.push({ t: 'ring', x, y, r: 2, vr: 130, life: 0.6, age: 0, col: '#c8faff' });
    }

    // Blast door hits the floor. (x, y) = centre of the door's bottom edge on
    // the floor line, width = door width. Dust wall + floor sparks + shake.
    doorSlam(x, y, width) {
      width = width || 70;
      const half = width / 2;
      for (let i = 0; i < 22; i++) {
        const side = i % 2 ? 1 : -1;
        this.parts.push({ t: 'smoke', x: x + side * rand(0, half), y: y - rand(0, 10), vx: side * rand(80, 320), vy: rand(-90, -15), r: rand(7, 15), gr: 34, life: rand(0.7, 1.3), age: 0, col: '150,145,135', a: 0.42 });
      }
      // dust wall rising off the door face
      for (let i = 0; i < 8; i++) {
        this.parts.push({ t: 'smoke', x: x + rand(-half, half), y: y - rand(0, 30), vx: rand(-20, 20), vy: rand(-140, -60), r: rand(8, 14), gr: 26, life: rand(0.8, 1.2), age: 0, col: '130,126,118', a: 0.35 });
      }
      // sparks skidding along the floor line, both ways
      this.sparks(x - half, y - 2, 14, { dir: Math.PI + 0.12, spread: 0.18, vmin: 250, vmax: 700, g: 500 });
      this.sparks(x + half, y - 2, 14, { dir: -0.12, spread: 0.18, vmin: 250, vmax: 700, g: 500 });
      this.debris(x, y - 4, 5, 0.45);
      this.addShake(18);
      this.doFlash(0.12, '255,235,200');
    }

    // Door edge pressing on the hands: call once per frame while straining.
    // Small sparks and grit flakes at (x, y).
    doorStrain(x, y) {
      if (Math.random() < 0.22) {
        this.sparks(x + rand(-6, 6), y, 1 + Math.floor(Math.random() * 2), { dir: Math.random() < 0.5 ? Math.PI * 0.85 : Math.PI * 0.15, spread: 0.5, vmin: 80, vmax: 260, g: 700 });
      }
      if (Math.random() < 0.12) {
        this.parts.push({ t: 'debris', x: x + rand(-8, 8), y, vx: rand(-30, 30), vy: rand(-20, 30), rot: rand(0, TAU), vr: rand(-8, 8), s: rand(1.5, 3), life: rand(0.5, 0.9), age: 0, col: '#8a8070', g: 900 });
      }
    }

    // Energy 0: CRT power-off. Screen dims, the picture collapses to a bright
    // horizontal line, then to a dot, then holds near-black until
    // clearShutdown()/reset(). Drawn by drawScreen().
    shutdown(dur) {
      this.shutDur = dur || 1.4;
      this.shutT = 0;
    }
    clearShutdown() { this.shutT = -1; }

    arc(x1, y1, x2, y2, life, color) {
      this.arcs.push({ x1, y1, x2, y2, life: life || 0.15, age: 0, color: color || '170,220,255' });
    }

    makeCrack(cx, cy, W, H) {
      const lines = [];
      const n = 9 + Math.floor(Math.random() * 4);
      const walk = (x, y, ang, len, depth) => {
        const pts = [[x, y]];
        let d = 0, total = 0;
        const segs = [];
        while (d < len) {
          const step = rand(14, 36);
          ang += rand(-0.35, 0.35);
          x += Math.cos(ang) * step; y += Math.sin(ang) * step;
          d += step;
          pts.push([x, y]);
          if (depth < 2 && Math.random() < 0.13) segs.push([x, y, ang + rand(-0.9, 0.9), len * rand(0.2, 0.45), depth + 1]);
          if (x < -50 || y < -50 || x > W + 50 || y > H + 50) break;
        }
        for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        lines.push({ pts, total, start: depth * 0.15 });
        segs.forEach((s) => walk.apply(null, s));
      };
      for (let i = 0; i < n; i++) walk(cx, cy, (i / n) * TAU + rand(-0.25, 0.25), rand(300, 1000), 0);
      // concentric shatter rings
      const rings = [];
      for (const R of [26, 58, 96]) {
        const pts = [];
        const m = 14;
        for (let i = 0; i <= m; i++) {
          const a = (i / m) * TAU;
          const rr = R * rand(0.8, 1.2);
          pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
        }
        rings.push(pts);
      }
      this.crack = { cx, cy, lines, rings };
      this.crackT = 0;
    }

    update(dt) {
      this.shake = Math.max(0, this.shake - dt * 30);
      this.flash = Math.max(0, this.flash - dt * 2.2);
      if (this.shutT >= 0 && this.shutT < this.shutDur) this.shutT = Math.min(this.shutDur, this.shutT + dt);
      if (this.crack) this.crackT = Math.min(1, this.crackT + dt * 1.6);
      const ps = this.parts;
      if (ps.length > MAX_PARTS) ps.splice(0, ps.length - MAX_PARTS);
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.age += dt;
        if (p.age >= p.life) {
          ps.splice(i, 1);
          if (p.t === 'delay') this.sparks(p.x + rand(-4, 4), p.y + rand(-4, 4), p.n, { vmin: 60, vmax: 260 });
          continue;
        }
        if (p.t === 'delay') continue;
        if (p.t === 'ring') { p.r += p.vr * dt; continue; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.g) p.vy += p.g * dt;
        if (p.t === 'fire') { p.vx *= 0.95; p.vy = p.vy * 0.94 - 30 * dt; p.r += p.gr * dt; }
        if (p.t === 'smoke') { p.vx *= 0.97; p.vy *= 0.97; p.r += p.gr * dt; }
        if (p.t === 'debris') p.rot += p.vr * dt;
      }
      for (let i = this.arcs.length - 1; i >= 0; i--) {
        const a = this.arcs[i];
        a.age += dt;
        if (a.age >= a.life) this.arcs.splice(i, 1);
      }
    }

    // world-space particles (drawn with the camera transform)
    drawWorld(ctx) {
      ctx.save();
      for (const p of this.parts) {
        const k = p.age / p.life;
        if (p.t === 'spark') {
          ctx.strokeStyle = p.col;
          ctx.globalAlpha = 1 - k;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.025, p.y - p.vy * 0.025); ctx.stroke();
        } else if (p.t === 'fire') {
          const col = k < 0.15 ? '255,250,220' : k < 0.4 ? '255,200,80' : k < 0.7 ? '255,110,40' : '120,40,30';
          ctx.globalAlpha = (1 - k) * 0.9;
          ctx.fillStyle = `rgb(${col})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
        } else if (p.t === 'smoke') {
          ctx.globalAlpha = (1 - k) * p.a;
          ctx.fillStyle = `rgb(${p.col})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
        } else if (p.t === 'debris') {
          ctx.globalAlpha = 1 - k * k;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.fillStyle = p.col; ctx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * 0.66);
          ctx.restore();
        } else if (p.t === 'ember') {
          ctx.globalAlpha = 1 - k;
          ctx.fillStyle = '#ffa040';
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
        } else if (p.t === 'ring') {
          ctx.globalAlpha = 1 - k;
          ctx.strokeStyle = p.col || '#fff2d0';
          ctx.lineWidth = 6 * (1 - k);
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.stroke();
        } else if (p.t === 'sparkle') {
          // 4-point star; slow twinkle (static in reduced mode)
          const tw = this.reduce ? 1 : 0.6 + 0.4 * Math.sin(p.ph + p.age * 14);
          ctx.globalAlpha = (1 - k) * tw;
          const s = p.s * (1 - k * 0.5);
          ctx.strokeStyle = '#8ff0ff'; ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(p.x - s, p.y); ctx.lineTo(p.x + s, p.y);
          ctx.moveTo(p.x, p.y - s); ctx.lineTo(p.x, p.y + s);
          ctx.stroke();
          ctx.fillStyle = '#e8feff';
          ctx.fillRect(p.x - 1.2, p.y - 1.2, 2.4, 2.4);
        }
      }
      ctx.globalAlpha = 1;
      for (const a of this.arcs) drawBolt(ctx, a.x1, a.y1, a.x2, a.y2, a.color, 1 - a.age / a.life);
      ctx.restore();
    }

    // screen-space post effects (after camera transform is removed)
    drawScreen(ctx, W, H) {
      if (this.crack) this.drawCrack(ctx, W, H);
      if (this.glitch > 0.01) this.drawGlitch(ctx, W, H, this.reduce ? this.glitch * 0.35 : this.glitch);
      if (this.flash > 0.01) {
        ctx.fillStyle = `rgba(${this.flashColor},${Math.min(0.85, this.flash)})`;
        ctx.fillRect(0, 0, W, H);
      }
      if (this.shutT >= 0) this.drawShutdown(ctx, W, H);
    }

    // CRT power-off. Phases of p (0..1):
    // 0-0.3 dim, 0.3-0.65 vertical collapse, 0.65-0.85 line shrinks to a dot,
    // 0.85-1 dot fades. Held at near-black afterwards.
    drawShutdown(ctx, W, H) {
      const p = this.shutdownProgress;
      const BLACK = 'rgb(2,3,5)';
      const glowCap = this.reduce ? 0.3 : 0.85; // bright line counts as a flash
      const ease = (t) => t * t * (3 - 2 * t);
      ctx.save();
      if (p < 0.3) {
        ctx.fillStyle = `rgba(2,3,5,${ease(p / 0.3) * 0.55})`;
        ctx.fillRect(0, 0, W, H);
      } else if (p < 0.65) {
        const k = ease((p - 0.3) / 0.35);
        const sh = Math.max(2, H * (1 - k));
        // squash the current frame vertically toward the centre line
        const cv = ctx.canvas, b = this.buf;
        if (b.width !== cv.width || b.height !== cv.height) { b.width = cv.width; b.height = cv.height; }
        const bx = b.getContext('2d');
        bx.setTransform(1, 0, 0, 1, 0, 0);
        bx.clearRect(0, 0, b.width, b.height);
        bx.drawImage(cv, 0, 0);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = BLACK;
        ctx.fillRect(0, 0, cv.width, cv.height);
        const sy = cv.height / H;
        ctx.globalAlpha = 0.45 * (1 - k * 0.5);
        ctx.drawImage(b, 0, 0, cv.width, cv.height, 0, (H / 2 - sh / 2) * sy, cv.width, sh * sy);
        ctx.restore(); ctx.save();
        // brightening band
        ctx.fillStyle = `rgba(210,240,255,${Math.min(glowCap, 0.15 + k * 0.7)})`;
        ctx.fillRect(0, H / 2 - sh / 2, W, sh);
      } else if (p < 0.85) {
        const k = ease((p - 0.65) / 0.2);
        ctx.fillStyle = BLACK;
        ctx.fillRect(0, 0, W, H);
        const lw = Math.max(6, W * (1 - k));
        ctx.fillStyle = `rgba(220,245,255,${glowCap})`;
        ctx.fillRect(W / 2 - lw / 2, H / 2 - 1.5, lw, 3);
        ctx.fillStyle = `rgba(150,220,255,${glowCap * 0.25})`;
        ctx.fillRect(W / 2 - lw / 2, H / 2 - 6, lw, 12);
      } else {
        const k = (p - 0.85) / 0.15;
        ctx.fillStyle = BLACK;
        ctx.fillRect(0, 0, W, H);
        if (k < 1) {
          ctx.globalAlpha = (1 - k) * glowCap;
          ctx.fillStyle = '#dff6ff';
          ctx.beginPath(); ctx.arc(W / 2, H / 2, 4 * (1 - k) + 1, 0, TAU); ctx.fill();
        }
      }
      ctx.restore();
    }

    drawCrack(ctx, W, H) {
      const c = this.crack, T = this.crackT;
      ctx.save();
      // impact point
      const g = ctx.createRadialGradient(c.cx, c.cy, 0, c.cx, c.cy, 60);
      g.addColorStop(0, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(c.cx, c.cy, 60, 0, TAU); ctx.fill();
      for (const pass of [0, 1]) {
        ctx.strokeStyle = pass ? 'rgba(235,245,255,0.9)' : 'rgba(0,0,0,0.55)';
        ctx.lineWidth = pass ? 1.4 : 3;
        for (const ln of c.lines) {
          const reveal = Math.max(0, (T - ln.start) / (1 - ln.start));
          let left = ln.total * reveal;
          if (left <= 0) continue;
          ctx.beginPath();
          ctx.moveTo(ln.pts[0][0] + (pass ? 0 : 1), ln.pts[0][1] + (pass ? 0 : 1));
          for (let i = 1; i < ln.pts.length && left > 0; i++) {
            const p0 = ln.pts[i - 1], p1 = ln.pts[i];
            const d = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
            const f = Math.min(1, left / d);
            ctx.lineTo(p0[0] + (p1[0] - p0[0]) * f + (pass ? 0 : 1), p0[1] + (p1[1] - p0[1]) * f + (pass ? 0 : 1));
            left -= d;
          }
          ctx.stroke();
        }
        if (T > 0.3) {
          ctx.globalAlpha = Math.min(1, (T - 0.3) * 2);
          for (const ring of c.rings) {
            ctx.beginPath();
            ring.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }
      }
      ctx.restore();
    }

    drawGlitch(ctx, W, H, k) {
      const cv = ctx.canvas;
      const b = this.buf;
      if (b.width !== cv.width || b.height !== cv.height) { b.width = cv.width; b.height = cv.height; }
      const bx = b.getContext('2d');
      bx.setTransform(1, 0, 0, 1, 0, 0);
      bx.clearRect(0, 0, b.width, b.height);
      bx.drawImage(cv, 0, 0);
      const sx = cv.width / W, sy = cv.height / H;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const slices = Math.floor(2 + k * 12);
      for (let i = 0; i < slices; i++) {
        const y = Math.random() * cv.height;
        const h = (4 + Math.random() * 34 * k) * sy;
        const dx = (Math.random() - 0.5) * 120 * k * sx;
        ctx.drawImage(b, 0, y, cv.width, h, dx, y, cv.width, h);
      }
      ctx.restore();
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < 3 * k; i++) {
        ctx.fillStyle = Math.random() < 0.5 ? `rgba(255,0,70,${0.18 * k})` : `rgba(0,220,255,${0.18 * k})`;
        ctx.fillRect(0, Math.random() * H, W, 4 + Math.random() * 20);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgba(255,255,255,${0.35 * k})`;
      for (let i = 0; i < 160 * k; i++) ctx.fillRect(Math.random() * W, Math.random() * H, 2, 1);
      ctx.restore();
    }
  }

  function drawBolt(ctx, x1, y1, x2, y2, color, alpha) {
    const segs = 8;
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    for (const [w, a] of [[6, 0.25], [2, 1]]) {
      ctx.strokeStyle = `rgba(${color},${a})`;
      ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(x1, y1);
      for (let i = 1; i < segs; i++) {
        const t = i / segs;
        ctx.lineTo(x1 + (x2 - x1) * t + rand(-9, 9), y1 + (y2 - y1) * t + rand(-9, 9));
      }
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---------------- tiny WebAudio synth ----------------
  const Audio = (function () {
    let ac = null, master = null, muted = false;
    function init() {
      try {
        if (!ac) {
          ac = new (window.AudioContext || window.webkitAudioContext)();
          master = ac.createGain();
          master.gain.value = 0.45;
          master.connect(ac.destination);
        }
        if (ac.state === 'suspended') ac.resume();
      } catch (e) { ac = null; }
    }
    function ok() { return ac && !muted; }
    function tone(f, dur, type, vol, f2, delay) {
      if (!ok()) return;
      const t0 = ac.currentTime + (delay || 0);
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(f, t0);
      if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(master);
      o.start(t0); o.stop(t0 + dur + 0.05);
    }
    function noise(dur, vol, freq, ftype, delay) {
      if (!ok()) return;
      const t0 = ac.currentTime + (delay || 0);
      const len = Math.floor(ac.sampleRate * dur);
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = ac.createBufferSource();
      src.buffer = buf;
      const f = ac.createBiquadFilter();
      f.type = ftype || 'lowpass';
      f.frequency.value = freq || 1000;
      const g = ac.createGain();
      g.gain.setValueAtTime(vol || 0.3, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f); f.connect(g); g.connect(master);
      src.start(t0); src.stop(t0 + dur);
    }
    // filtered noise with attack and a filter sweep (f -> f2)
    function noiseSweep(dur, vol, f, f2, ftype, attack, delay, q) {
      if (!ok()) return;
      const t0 = ac.currentTime + (delay || 0);
      const len = Math.floor(ac.sampleRate * dur);
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = ac.createBufferSource();
      src.buffer = buf;
      const fl = ac.createBiquadFilter();
      fl.type = ftype || 'bandpass';
      if (q) fl.Q.value = q;
      fl.frequency.setValueAtTime(f, t0);
      if (f2) fl.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + dur);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + (attack || 0.05));
      g.gain.setValueAtTime(vol, t0 + Math.max(attack || 0.05, dur * 0.6));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(fl); fl.connect(g); g.connect(master);
      src.start(t0); src.stop(t0 + dur);
    }
    // groaning metal: low saw with slow wobble through a resonant lowpass
    function creak(dur, vol, f, delay) {
      if (!ok()) return;
      const t0 = ac.currentTime + (delay || 0);
      const o = ac.createOscillator(), lfo = ac.createOscillator(), lg = ac.createGain();
      const fl = ac.createBiquadFilter(), g = ac.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f, t0);
      o.frequency.linearRampToValueAtTime(f * 0.8, t0 + dur);
      lfo.frequency.value = 9; lg.gain.value = f * 0.12;
      lfo.connect(lg); lg.connect(o.frequency);
      fl.type = 'lowpass'; fl.frequency.value = 520; fl.Q.value = 8;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.12);
      g.gain.setValueAtTime(vol, t0 + dur * 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(fl); fl.connect(g); g.connect(master);
      o.start(t0); lfo.start(t0); o.stop(t0 + dur + 0.05); lfo.stop(t0 + dur + 0.05);
    }
    return {
      init,
      get muted() { return muted; },
      setMuted(v) { muted = !!v; },
      heartbeat() { tone(62, 0.13, 'sine', 0.7, 40); tone(52, 0.15, 'sine', 0.5, 35, 0.17); },
      tick() { tone(1500, 0.03, 'square', 0.05); },
      slow() { tone(320, 0.7, 'sawtooth', 0.08, 60); noise(0.6, 0.12, 500); },
      select() { tone(880, 0.06, 'square', 0.08); },
      good() { tone(523, 0.1, 'triangle', 0.25); tone(784, 0.14, 'triangle', 0.25, null, 0.08); tone(1046, 0.25, 'triangle', 0.2, null, 0.16); },
      whoosh() { noise(0.35, 0.3, 900, 'bandpass'); },
      thud() { tone(90, 0.2, 'sine', 0.5, 40); noise(0.12, 0.25, 600); },
      clank() { tone(660, 0.12, 'square', 0.12, 330); noise(0.08, 0.2, 3000, 'highpass'); },
      boom() { noise(1.4, 0.9, 380); tone(70, 0.9, 'sine', 0.8, 25); },
      crunch() { noise(0.3, 0.6, 1800); tone(140, 0.2, 'square', 0.15, 50); },
      zap() { noise(0.6, 0.35, 4000, 'highpass'); tone(95, 0.6, 'sawtooth', 0.25, 50); },
      grind() { noise(0.25, 0.35, 2500, 'bandpass'); tone(180, 0.25, 'sawtooth', 0.1, 120); },
      glitch() { for (let i = 0; i < 7; i++) tone(rand(150, 2200), 0.05, 'square', 0.12, null, i * 0.05); noise(0.5, 0.3, 3000, 'bandpass'); },
      crack() { noise(0.25, 0.6, 5000, 'highpass'); tone(2400, 0.15, 'triangle', 0.1, 900); },
      fail() { tone(220, 0.4, 'sawtooth', 0.2, 110); tone(165, 0.6, 'sawtooth', 0.2, 80, 0.35); },
      // hydraulic door descending (~1 s)
      hiss() { noiseSweep(1.0, 0.22, 3200, 1800, 'bandpass', 0.08, 0, 0.8); tone(120, 1.0, 'sawtooth', 0.04, 95); },
      // heavy metal door slam: deeper and longer than thud
      slam() { tone(55, 1.1, 'sine', 0.85, 26); noise(1.0, 0.75, 320); tone(170, 0.7, 'square', 0.07, 110); tone(297, 0.6, 'triangle', 0.08, 260); noise(0.08, 0.3, 2500, 'highpass'); },
      // low groaning metal creak (~0.8 s)
      strain() { creak(0.8, 0.22, 78); noiseSweep(0.8, 0.06, 900, 600, 'bandpass', 0.15, 0, 4); },
      // small partial explosion: lighter than boom
      pop() { noise(0.45, 0.5, 900); tone(130, 0.3, 'sine', 0.45, 55); noise(0.12, 0.2, 4000, 'highpass', 0.05); },
      // shutdown: descending sine sweep then a click
      powerDown() { tone(700, 1.2, 'sine', 0.28, 45); tone(350, 1.2, 'triangle', 0.08, 30); noise(0.03, 0.35, 3500, 'highpass', 1.25); tone(1400, 0.03, 'square', 0.06, null, 1.25); },
      // +1 energy cell: bright rising arpeggio
      energyUp() { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.14, 'triangle', 0.18, null, i * 0.055)); tone(2093, 0.3, 'sine', 0.08, null, 0.22); },
      // friend android tripping: soft double clank
      stumble() { tone(300, 0.1, 'triangle', 0.12, 200); noise(0.1, 0.12, 1400); tone(240, 0.12, 'triangle', 0.08, 160, 0.13); noise(0.1, 0.08, 1000, 'lowpass', 0.13); },
      win() { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.3, 'triangle', 0.2, null, i * 0.1)); },
    };
  })();

  SEHS.FX = FX;
  SEHS.Audio = Audio;
  SEHS.drawBolt = drawBolt;
})();
