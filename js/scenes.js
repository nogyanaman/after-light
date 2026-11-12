/* ============================================================================
   AFTER LIGHT · js/scenes.js
   THE FOUR ENVIRONMENTS, and the four messages that sit in them.

   Upgraded for seamless 3D-to-2D visual continuity:
   - SceneBackdrop renders with alpha transparency over the live 3D #sky canvas
     so the 13,000 3D stars, constellations, and wet-obsidian horizon remain
     continuously connected from Stage 1 (Threshold) through all 4 Scroll
     Chapters and into Stage 3 (The Sky).
   - As Chapter 04 completes (p: 0.84 -> 0.985), SceneBackdrop and DescentCopy
     dissolve directly into the live 3D sky with zero black cut.
   ========================================================================== */
import { clamp, lerp, smoothstep, prefersReducedMotion } from './tokens.js';

export const SCENES = [
  { id: 'record', name: 'THE RECORD', accent: '#8FB6D4', base: '#05060A', horizon: '#1A2233' },
  { id: 'plates', name: 'THE PLATES', accent: '#7A8CFF', base: '#070913', horizon: '#2B3978' },
  { id: 'break',  name: 'THE BREAK',  accent: '#FF6454', base: '#120508', horizon: '#7A2A32' },
  { id: 'sky',    name: 'THE SKY',    accent: '#74E8C0', base: '#050910', horizon: '#1F4E46' },
];

export class SceneBackdrop {
  constructor(canvas, { track = null, reduced = prefersReducedMotion() } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.track = track;
    this.reduced = reduced;

    this.p = 0;
    this.pSmooth = 0;
    this.t = 0;
    this.w = 1; this.h = 1; this.dpr = 1;

    this.stars = [];
    this.dust = [];
    this.ribbons = [];

    this.pointer = { x: 0.5, y: 0.42, k: 0, on: false };
    this.energy = 0;
    this._pPrev = 0;

    this._seedWorld();
    this.resize();
    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize, { passive: true });

    if (!reduced) {
      this._onMove = (e) => {
        const p = e.touches ? e.touches[0] : e;
        if (!p) return;
        this.pointer.x = p.clientX / Math.max(1, window.innerWidth);
        this.pointer.y = p.clientY / Math.max(1, window.innerHeight);
        this.pointer.on = true;
      };
      this._onLeave = () => { this.pointer.on = false; };
      window.addEventListener('pointermove', this._onMove, { passive: true });
      window.addEventListener('pointerdown', this._onMove, { passive: true });
      document.addEventListener('pointerleave', this._onLeave);
    }
  }

  _seedWorld() {
    const rnd = mulberry32(20261110);
    this.stars = Array.from({ length: this.reduced ? 120 : 280 }, () => ({
      x: rnd(), y: rnd(),
      z: 0.25 + rnd() * 0.75,
      r: 0.35 + rnd() * 1.15,
      tw: rnd() * Math.PI * 2,
      warm: rnd() < 0.22,
    }));
    this.dust = Array.from({ length: this.reduced ? 40 : 130 }, () => ({
      x: rnd(), y: rnd(), v: 0.014 + rnd() * 0.048,
      r: 0.65 + rnd() * 2.3, ph: rnd() * Math.PI * 2,
    }));
    this.ribbons = [
      { amp: 0.088, k: 1.1, y: 0.02, ph: 0.0, a: 1.0 },
      { amp: 0.058, k: 1.7, y: 0.06, ph: 1.9, a: 0.58 },
    ];
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.w = w; this.h = h; this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  setProgress(p) {
    this.p = clamp(p, 0, 1);
  }

  chapter() {
    const q = this.pSmooth * 4;
    return { index: Math.min(3, Math.floor(q)), local: clamp(q - Math.floor(q), 0, 1) };
  }

  update(dt = 0.016, elapsed = 0) {
    this.t = elapsed || (this.t + dt);
    // Keep pSmooth tightly synchronized to the smoothed scrollP from main.js
    const k = this.reduced ? 1 : Math.min(1, dt * 14.0);
    this.pSmooth += (this.p - this.pSmooth) * k;
    const want = this.pointer.on ? 1 : 0;
    this.pointer.k += (want - this.pointer.k) * Math.min(1, dt * 3.2);

    const v = Math.abs(this.p - this._pPrev) / Math.max(0.0001, dt);
    this._pPrev = this.p;
    this.energy += (Math.min(1, v * 5.5) - this.energy) * Math.min(1, dt * 6);
    this._draw();
  }

  _draw() {
    const ctx = this.ctx, w = this.w, h = this.h;
    const p = this.pSmooth;
    const q = p * 4;

    ctx.clearRect(0, 0, w, h);

    // Master envelope: smooth fade-in from Stage 1 and smooth dissolve into Stage 3 (Main Sky)
    const entryFade = smoothstep(0.0, 0.04, p + 0.025);
    const exitFade = 1 - smoothstep(0.85, 0.985, p);
    const masterAlpha = clamp(entryFade * exitFade, 0, 1);
    if (masterAlpha <= 0.002) return;

    ctx.save();
    ctx.globalAlpha = masterAlpha;

    const win = (i) => {
      const a = smoothstep(i - 0.38, i + 0.26, q);
      const b = 1 - smoothstep(i + 0.74, i + 1.38, q);
      return clamp(Math.min(a, b), 0, 1);
    };
    const w0 = clamp(1 - smoothstep(0.55, 1.35, q), 0, 1);
    const w1 = win(1), w2 = win(2), w3 = smoothstep(2.60, 3.32, q);

    // Translucent atmospheric wash so the 3D starfield & constellations in #sky shine through
    const base = mix4('#05070C', '#070A16', '#140509', '#050C12', w0, w1, w2, w3);
    ctx.fillStyle = rgba(base, 0.42);
    ctx.fillRect(0, 0, w, h);

    const wash = ctx.createLinearGradient(0, 0, 0, h);
    wash.addColorStop(0, rgba(mix4('#0A1018', '#141E52', '#2E0A14', '#0B2E28', w0, w1, w2, w3), 0.44));
    wash.addColorStop(0.55, 'rgba(0,0,0,0)');
    wash.addColorStop(1, rgba(mix4('#030408', '#050712', '#180409', '#04120F', w0, w1, w2, w3), 0.56));
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, w, h);

    this._drawField(ctx, w, h, w0, w1, w2, w3);

    if (w1 > 0.01 || w2 > 0.01) this._drawLattice(ctx, w, h, clamp(w1 * 1.0 + w2 * 0.42, 0, 1), q);
    if (w3 > 0.01) this._drawAurora(ctx, w, h, Math.min(1, w3 * (1 + this.energy * 0.35)));
    this._drawStars(ctx, w, h, w0, w1, w2, w3);
    if (w2 > 0.02) this._drawDust(ctx, w, h, w2);
    if (w2 > 0.02 || w3 < 0.6) this._drawFracture(ctx, w, h, clamp(w2 - w3 * 0.9, 0, 1), q);
    this._drawHorizon(ctx, w, h, w0, w1, w2, w3, q);

    if (!this.reduced && this.pointer.on) {
      const px = this.pointer.x * w, py = this.pointer.y * h;
      const r = Math.min(w, h) * (0.36 + 0.05 * Math.sin(this.t * 0.6));
      const acc = mix4('#8FB6D4', '#6E82FF', '#FF6454', '#74E8C0', w0, w1, w2, w3);
      const pg = ctx.createRadialGradient(px, py, 0, px, py, r);
      pg.addColorStop(0, rgba(acc, this.pointer.k * 0.16));
      pg.addColorStop(0.55, rgba(acc, this.pointer.k * 0.06));
      pg.addColorStop(1, rgba(acc, 0));
      ctx.fillStyle = pg;
      ctx.fillRect(0, 0, w, h);
    }

    const vig = ctx.createRadialGradient(w * 0.5, h * 0.52, Math.min(w, h) * 0.22,
                                         w * 0.5, h * 0.52, Math.max(w, h) * 0.82);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.48)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);

    ctx.restore();

    const ch = { index: Math.min(3, Math.max(0, Math.floor(this.p * 4))) };
    const s = SCENES[ch.index];
    if (this._lastScene !== s.id) {
      this._lastScene = s.id;
      document.documentElement.dataset.scene = s.id;
      document.documentElement.style.setProperty('--scene-accent', s.accent);
      document.documentElement.style.setProperty('--scene-base', s.base);
      window.dispatchEvent(new CustomEvent('al:scene', { detail: { ...s, index: ch.index, p } }));
    }
  }

  _drawField(ctx, w, h, w0, w1, w2, w3) {
    const t = this.reduced ? 0 : this.t;
    const q = w0 + w1 + w2 + w3 || 1;
    const accent = mix4('#8FB6D4', '#6E82FF', '#FF6454', '#74E8C0', w0, w1, w2, w3);

    const shear = (0.4 * w0 + 3.2 * w1 + 7.0 * w2 + 1.4 * w3) / q;
    const tumble = (0.0 * w0 + 0.12 * w1 + 0.32 * w2 + 0.06 * w3) / q;
    const opening = (0.24 * w0 + 0.32 * w1 + 0.18 * w2 + 0.66 * w3) / q;
    const gain = 1 - 0.35 * (w2 / q);

    const cx = w * 0.71;
    const cy = h * 0.42;
    const R = Math.min(w * 0.21, h * 0.31);

    ctx.save();
    ctx.lineWidth = 0.75;
    ctx.lineCap = 'butt';

    const minor = 36, major = minor * 5;
    const warp = (x, y) =>
      Math.sin(y * 0.0026 + t * 0.06) * shear + Math.sin(x * 0.0019 - t * 0.04) * shear * 0.6;
    ctx.strokeStyle = rgba(accent, 0.036 * gain);
    ctx.beginPath();
    for (let x = minor; x < w; x += minor) {
      for (let y = 0; y <= h; y += 40) {
        const px = x + warp(x, y);
        y === 0 ? ctx.moveTo(px, y) : ctx.lineTo(px, y);
      }
    }
    for (let y = minor; y < h; y += minor) {
      for (let x = 0; x <= w; x += 40) {
        const py = y + warp(x, y);
        x === 0 ? ctx.moveTo(x, py) : ctx.lineTo(x, py);
      }
    }
    ctx.stroke();

    ctx.strokeStyle = rgba(accent, 0.075 * gain);
    ctx.beginPath();
    for (let x = major; x < w; x += major) {
      for (let y = 0; y <= h; y += 40) {
        const px = x + warp(x, y);
        y === 0 ? ctx.moveTo(px, y) : ctx.lineTo(px, y);
      }
    }
    for (let y = major; y < h; y += major) {
      for (let x = 0; x <= w; x += 40) {
        const py = y + warp(x, y);
        x === 0 ? ctx.moveTo(x, py) : ctx.lineTo(x, py);
      }
    }
    ctx.stroke();

    ctx.save();
    ctx.translate(cx, cy);
    const rings = [
      { r: 1.00, tilt: -0.34 + tumble * 0.8, roll: 0.00 + t * 0.024, a: 0.26 },
      { r: 0.71, tilt: 0.52 - tumble * 1.1, roll: 0.60 - t * 0.018, a: 0.19 },
      { r: 0.44, tilt: -0.95 + tumble * 0.5, roll: 1.20 + t * 0.030, a: 0.14 },
    ];
    for (const ring of rings) {
      ctx.save();
      ctx.rotate(ring.roll);
      ctx.beginPath();
      ctx.ellipse(0, 0, R * ring.r, R * ring.r * (opening + Math.abs(Math.sin(ring.tilt)) * 0.55),
                  0, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(accent, ring.a * gain);
      ctx.stroke();
      ctx.restore();
    }

    ctx.beginPath();
    for (let i = 0; i < 72; i++) {
      const ang = (i / 72) * Math.PI * 2 - Math.PI / 2 + t * 0.022;
      const majorTick = i % 6 === 0;
      const r0 = R * (majorTick ? 0.90 : 0.945);
      const r1 = R * 1.005;
      ctx.moveTo(Math.cos(ang) * r0, Math.sin(ang) * r0 * opening);
      ctx.lineTo(Math.cos(ang) * r1, Math.sin(ang) * r0 * opening);
    }
    ctx.strokeStyle = rgba(accent, 0.24 * gain);
    ctx.lineWidth = 0.85;
    ctx.stroke();
    ctx.lineWidth = 0.75;

    {
      const ang = -Math.PI / 2 + t * 0.095;
      const dx = Math.cos(ang) * R;
      const dy = Math.sin(ang) * R * opening;
      ctx.beginPath();
      ctx.arc(dx, dy, 2.2, 0, 6.2832);
      ctx.fillStyle = rgba(accent, 0.72);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(dx, dy);
      ctx.strokeStyle = rgba(accent, 0.14);
      ctx.stroke();
    }
    ctx.restore();

    ctx.strokeStyle = rgba(accent, 0.11);
    ctx.beginPath();
    ctx.moveTo(0, cy); ctx.lineTo(w, cy);
    ctx.moveTo(cx, 0); ctx.lineTo(cx, h);
    ctx.stroke();

    ctx.strokeStyle = rgba(accent, 0.22);
    ctx.beginPath();
    for (let x = 0; x <= w; x += 64) { ctx.moveTo(x, cy - 3); ctx.lineTo(x, cy + 3); }
    for (let y = 0; y <= h; y += 64) { ctx.moveTo(cx - 3, y); ctx.lineTo(cx + 3, y); }
    ctx.stroke();

    const m = 26, len = 18;
    ctx.strokeStyle = rgba(accent, 0.20);
    ctx.beginPath();
    for (const [px, py, sx, sy] of [[m, m, 1, 1], [w - m, m, -1, 1], [m, h - m, 1, -1], [w - m, h - m, -1, -1]]) {
      ctx.moveTo(px, py); ctx.lineTo(px + len * sx, py);
      ctx.moveTo(px, py); ctx.lineTo(px, py + len * sy);
    }
    ctx.stroke();

    ctx.restore();
  }

  _drawStars(ctx, w, h, w0, w1, w2, w3) {
    const t = this.t;
    const density = clamp(w0 * 0.8 + w1 * 0.35 + w2 * 0.55 + w3 * 0.95, 0, 1.1);
    const sharp = clamp(0.35 + w3 * 0.65 - w1 * 0.3, 0, 1);
    for (const s of this.stars) {
      if (s.z > density * 1.05) continue;
      const drift = this.reduced ? 0 : t * 0.004 * s.z;
      const x = ((s.x + drift * 0.6) % 1) * w;
      const y = ((s.y + drift * 0.22) % 1) * h;
      const tw = 0.62 + 0.38 * Math.sin(t * 0.9 + s.tw);
      const a = Math.max(0.18, (0.14 + 0.45 * s.z) * tw * (0.45 + 0.55 * sharp));
      const rad = Math.max(0.8, s.r * (0.7 + 0.5 * sharp));
      ctx.fillStyle = s.warm
        ? `rgba(255,226,190,${a.toFixed(3)})`
        : `rgba(214,228,246,${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, 6.2832);
      ctx.fill();
    }
  }

  _drawLattice(ctx, w, h, amt, q) {
    const horizonY = this._horizonY(q);
    ctx.save();
    ctx.lineWidth = 1;
    const vx = w * 0.5;
    for (let i = -14; i <= 14; i++) {
      const x0 = vx + i * (w / 13);
      const a = amt * (0.095 + 0.085 * (1 - Math.abs(i) / 14));
      ctx.strokeStyle = `rgba(122,140,255,${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(vx + i * (w / 60), horizonY);
      ctx.lineTo(x0, h);
      ctx.stroke();
    }
    for (let i = 1; i <= 9; i++) {
      const f = (i / 9) ** 2.1;
      const y = horizonY + f * (h - horizonY);
      const a = amt * 0.23 * (1 - f * 0.55);
      ctx.strokeStyle = `rgba(206,216,236,${a.toFixed(3)})`;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    ctx.restore();
  }

  _drawAurora(ctx, w, h, amt) {
    const t = this.t;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    const bg = ctx.createRadialGradient(w * 0.56, h * 0.02, 0, w * 0.56, h * 0.02, Math.max(w, h) * 0.86);
    bg.addColorStop(0, `rgba(116,232,192,${(0.065 * amt).toFixed(3)})`);
    bg.addColorStop(0.42, `rgba(91,108,255,${(0.048 * amt).toFixed(3)})`);
    bg.addColorStop(1, 'rgba(30,48,120,0)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    for (const r of this.ribbons) {
      const A = (r.a === undefined ? 1 : r.a);
      const steps = 150;
      const top = -h * r.y;

      for (let i = 0; i < steps; i++) {
        const xn = i / (steps - 1);
        const x = xn * w;
        const sA = Math.sin(xn * 61.7 + r.ph * 3.1);
        const sB = Math.sin(xn * 143.3 - t * 0.23 + r.ph);
        const sC = Math.sin(xn * 23.9 + t * 0.09 + r.ph * 1.7);
        const reach = h * (r.amp * 2.2 + 0.10 * (0.5 + 0.5 * sA) + 0.07 * (0.5 + 0.5 * sB))
                    + h * 0.22 * (0.5 + 0.5 * sC);
        const width = (w / steps) * (1.7 + 0.9 * (0.5 + 0.5 * Math.sin(xn * 91.3 + r.ph)));
        const keepOut = 0.26 + 0.74 * smoothstep(0.26, 0.60, xn);
        const a = amt * A * keepOut * (0.45 + 0.55 * Math.pow(0.5 + 0.5 * sB, 2));
        if (a <= 0.004) continue;

        const g = ctx.createLinearGradient(0, top, 0, top + reach);
        g.addColorStop(0, `rgba(170,238,222,${(0.135 * a).toFixed(3)})`);
        g.addColorStop(0.16, `rgba(116,232,192,${(0.115 * a).toFixed(3)})`);
        g.addColorStop(0.58, `rgba(91,108,255,${(0.062 * a).toFixed(3)})`);
        g.addColorStop(1, 'rgba(91,108,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - width / 2, top, width, reach);
      }
    }
    ctx.restore();
  }

  _drawDust(ctx, w, h, amt) {
    const t = this.t;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const d of this.dust) {
      const y = ((d.y - t * d.v) % 1 + 1) % 1;
      const x = (d.x + Math.sin(t * 0.5 + d.ph) * 0.012) * w;
      const a = Math.max(0.24, amt * 0.54 * (0.35 + 0.65 * Math.sin(t * 1.4 + d.ph) ** 2));
      ctx.fillStyle = `rgba(255,108,84,${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y * h, d.r, 0, 6.2832);
      ctx.fill();
    }
    ctx.restore();
  }

  _drawFracture(ctx, w, h, amt, q) {
    if (amt < 0.01) return;
    const t = this.t;
    const centres = [[0.74, 0.46], [0.90, 0.64], [0.58, 0.24]];
    ctx.save();
    ctx.lineWidth = 1.1;
    ctx.lineCap = 'round';
    centres.forEach(([cx, cy], ci) => {
      const draw = clamp((q - 1 - ci * 0.13) / 0.55, 0, 1);
      if (draw <= 0) return;
      const spikes = 6;
      const unit = Math.min(w, h);
      for (let i = 0; i < spikes; i++) {
        const ang0 = (i / spikes) * Math.PI * 2 + ci * 0.83;
        const len = (0.12 + 0.26 * (((i * 37 + ci * 11) % 7) / 7)) * unit * draw;
        const pts = [[cx * w, cy * h]];
        let ang = ang0;
        let px = cx * w, py = cy * h;
        for (let k = 0; k < 3; k++) {
          ang += Math.sin(t * 0.55 + i * 1.7 + k * 2.3 + ci) * 0.42;
          const seg = len * (k === 0 ? 0.46 : k === 1 ? 0.33 : 0.21);
          px += Math.cos(ang) * seg;
          py += Math.sin(ang) * seg;
          pts.push([px, py]);
        }
        for (let k = 1; k < pts.length; k++) {
          const mx = (pts[k - 1][0] + pts[k][0]) / 2 / w;
          const nearCopy = 1 - smoothstep(0.16, 0.44, mx);
          const a = amt * (0.58 - k * 0.11) * draw * (1 - nearCopy * 0.88);
          if (a <= 0.002) continue;
          ctx.strokeStyle = `rgba(255,98,82,${a.toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(pts[k - 1][0], pts[k - 1][1]);
          ctx.lineTo(pts[k][0], pts[k][1]);
          ctx.stroke();
        }
      }
      const glow = ctx.createRadialGradient(cx * w, cy * h, 0, cx * w, cy * h, unit * 0.055);
      glow.addColorStop(0, `rgba(255,195,175,${(0.20 * amt * draw).toFixed(3)})`);
      glow.addColorStop(1, 'rgba(255,92,77,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx * w, cy * h, unit * 0.055, 0, 6.2832);
      ctx.fill();
    });
    ctx.restore();
  }

  _horizonY(q) {
    const a = lerp(0.78, 0.70, smoothstep(0, 1, q));
    const b = lerp(a, 0.735, smoothstep(1, 2, q));
    return lerp(b, 0.84, smoothstep(2, 3, q)) * this.h;
  }

  _traceY(xn, q, w0, w1, w2, w3, y0, h) {
    const t = this.t;
    const blip = (xn * 61.7) % 1;
    const flat = blip < 0.045 ? Math.sin(blip * 640) * h * 0.012 : 0;
    const stepQ = Math.round(Math.sin(xn * 9.0 + t * 0.22) * 4) / 4;
    const stepped = stepQ * h * 0.010;
    const spike = (xn * 47.3) % 1;
    const torn = (spike < 0.02 ? (1 - spike / 0.02) : 0) * h * 0.05
               + Math.sin(xn * 21 + t * 0.3) * h * 0.004;
    const breathe = Math.sin(xn * 5.1 + t * 0.18) * h * 0.016
                  + Math.sin(xn * 2.3 - t * 0.11) * h * 0.009;
    const e = 1 + this.energy * 1.35;
    return y0
      + (flat * w0 + stepped * w1 * (1 - w2 * 0.5)
         + torn * w2 * (1 - w3) + breathe * w3) * e;
  }

  _drawHorizon(ctx, w, h, w0, w1, w2, w3, q) {
    const y0 = this._horizonY(q);
    const col = mix4('#283C54', '#3A4CB4', '#94323C', '#24665A', w0, w1, w2, w3);
    ctx.save();
    ctx.lineWidth = 1.1;

    const N = 190;
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const xn = i / N;
      const y = this._traceY(xn, q, w0, w1, w2, w3, y0, h);
      i === 0 ? ctx.moveTo(0, y) : ctx.lineTo(xn * w, y);
    }
    ctx.strokeStyle = rgba(col, 0.72 + 0.26 * w3);
    ctx.stroke();

    if (w0 > 0.02) {
      ctx.strokeStyle = rgba(col, 0.56 * w0);
      for (let i = 0; i < 26; i++) {
        const xn = (i + 0.35) / 26;
        const y = this._traceY(xn, q, w0, w1, w2, w3, y0, h);
        const len = 4 + ((i * 37) % 5) * 2.2;
        ctx.beginPath();
        ctx.moveTo(xn * w, y);
        ctx.lineTo(xn * w, y + len);
        ctx.stroke();
      }
    }

    const g = ctx.createLinearGradient(0, y0, 0, Math.min(h, y0 + h * 0.17));
    g.addColorStop(0, rgba(col, 0.22 * (1 - w3 * 0.35)));
    g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, y0, w, Math.min(h - y0, h * 0.17));

    const stand = clamp(w1 * 0.7 + w2 * 0.3, 0, 1);
    if (stand > 0.02) {
      ctx.strokeStyle = rgba(col, 0.18 * stand);
      for (let i = 1; i < 13; i++) {
        const xn = i / 13;
        const drop = (0.03 + 0.09 * (((i * 29) % 7) / 7)) * h * stand;
        ctx.beginPath();
        ctx.moveTo(xn * w, this._traceY(xn, q, w0, w1, w2, w3, y0, h));
        ctx.lineTo(xn * w, this._traceY(xn, q, w0, w1, w2, w3, y0, h) + drop);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  dispose() {
    window.removeEventListener('resize', this._onResize);
    if (this._onMove) {
      window.removeEventListener('pointermove', this._onMove);
      window.removeEventListener('pointerdown', this._onMove);
      document.removeEventListener('pointerleave', this._onLeave);
    }
  }
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hex2rgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix4(a, b, c, d, wa, wb, wc, wd) {
  const A = hex2rgb(a), B_ = hex2rgb(b), C = hex2rgb(c), D = hex2rgb(d);
  const sum = wa + wb + wc + wd || 1;
  const out = [0, 1, 2].map(i =>
    Math.round((A[i] * wa + B_[i] * wb + C[i] * wc + D[i] * wd) / sum));
  return '#' + out.map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}
function rgba(hex, a) {
  const [r, g, b] = hex2rgb(hex);
  return `rgba(${r},${g},${b},${a.toFixed(3)})`;
}

/* ── the four messages (overlapping crossfade with zero dead-zones) ─────── */
const IN_LEAD = 0.22;
const OUT_START = 0.78;
const OUT_END = 0.99;
const WORD_STEP = 0.026;

export class DescentCopy {
  constructor({
    pin = document.querySelector('#intro-pin'),
    source = document.querySelector('#intro-caption'),
    reduced = prefersReducedMotion(),
  } = {}) {
    this.pin = pin;
    this.reduced = reduced;
    this.steps = [];
    this.chapter = -1;
    this._p = -1;
    this._ready = null;
    if (!pin || !source) return;
    this._build(source);
  }

  _build(source) {
    const el = (tag, cls, text) => {
      const n = document.createElement(tag);
      if (cls) n.className = cls;
      if (text != null) n.textContent = text;
      return n;
    };
    const root = el('div', 'al-descent');
    root.setAttribute('aria-live', 'polite');

    [...source.querySelectorAll('.ic-step')].forEach((step, i) => {
      const txt = step.querySelector('.ic-txt')?.textContent.trim() || '';
      const note = step.querySelector('.ic-note')?.textContent.trim() || '';
      const idx = (step.querySelector('b')?.textContent.trim() || String(i + 1)).padStart(2, '0');

      const art = el('article', 'al-step');
      art.dataset.i = idx;
      art.setAttribute('aria-hidden', 'true');

      const kicker = el('p', 'al-kicker');
      kicker.append(el('i', '', idx), el('span', 'al-scene-name', SCENES[i]?.name || ''));

      const line = el('p', 'al-line');
      const words = [];
      txt.split(/\s+/).filter(Boolean).forEach((w, wi) => {
        if (wi) line.append(' ');
        const s = el('span', 'al-word', w);
        words.push(s);
        line.append(s);
      });

      art.append(kicker, line);
      if (note) art.append(el('p', 'al-note', note));
      art._words = words;
      art._op = -1;
      root.append(art);
      this.steps.push(art);
    });

    this.seam = el('i', 'al-seam');
    this.seam.setAttribute('aria-hidden', 'true');
    root.append(this.seam);

    const meter = el('div', 'al-meter');
    this.count = el('span', 'al-meter-count', '01 / 04');
    this.count.setAttribute('aria-hidden', 'true');
    meter.append(this.count);
    root.append(meter);

    this.pin.append(root);
    this.root = root;
  }

  render(p, ready = true) {
    if (!this.root) return;
    if (ready !== this._ready) {
      this._ready = ready;
      this.root.classList.toggle('is-ready', !!ready);
    }
    p = clamp(p, 0, 1);
    if (Math.abs(p - this._p) < 1e-6) return;
    this._p = p;

    const u = p * 4;
    const idx = clamp(Math.floor(u + 0.12), 0, 3);
    if (idx !== this.chapter) {
      const first = this.chapter < 0;
      this.chapter = idx;
      this.steps.forEach((s, i) => s.classList.toggle('is-live', i === idx));
      document.documentElement.dataset.chapter = String(idx);
      if (this.count) this.count.textContent = `${String(idx + 1).padStart(2, '0')} / 04`;
      if (this.seam && !this.reduced && !first) {
        this.seam.classList.remove('is-sweeping');
        void this.seam.offsetWidth;
        this.seam.classList.add('is-sweeping');
      }
    }

    for (let i = 0; i < this.steps.length; i++) {
      const s = this.steps[i];
      const inK = i === 0 ? 1 : smoothstep(i - IN_LEAD, i + 0.04, u);
      const outK = smoothstep(i + OUT_START, i + OUT_END, u);
      const op = clamp(inK * (1 - outK), 0, 1);
      if (op === 0 && s._op === 0) continue;
      s._op = op;
      s.style.opacity = op.toFixed(4);
      s.style.visibility = op > 0.004 ? 'visible' : 'hidden';
      const liftY = (1 - inK) * 26 - outK * 22;
      const scale = 1 - (1 - inK) * 0.018 + outK * 0.012;
      s.style.transform = this.reduced
        ? 'none'
        : `translate3d(0, ${liftY.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
      s.setAttribute('aria-hidden', op > 0.5 ? 'false' : 'true');

      const ws = s._words;
      const span = Math.max(0.18, 1 - ws.length * WORD_STEP);
      for (let wi = 0; wi < ws.length; wi++) {
        const k = clamp((inK - wi * WORD_STEP) / span, 0, 1);
        ws[wi].style.opacity = (k * (1 - outK)).toFixed(3);
        ws[wi].style.transform = this.reduced
          ? 'none'
          : `translate3d(0, ${((1 - k) * 0.44).toFixed(3)}em, 0)`;
      }
    }
  }

  dispose() {
    this.root?.remove();
    this.root = null;
    this.steps = [];
  }
}
