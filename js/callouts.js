/* ============================================================================
   INTERSPACE · callouts.js
   Editorial cards that hang beside each burst: headline + exactly one sourced
   sentence. Positions are solved with a 2D force relaxation against a fixed
   anchor per burst, so cards never overlap and never drift far from their shell.
   Hovering a card freezes its decay (Zeigarnik: you finish reading, or the sky
   does not move on). Clicking opens the original Wikipedia article.
   ========================================================================== */
import * as THREE from 'three';
import { clamp } from './tokens.js';

const LIFE = 16.0;          // seconds a card stays fully legible
const FADE = 5.0;           // gentle fade tail after that
const MAX = 5;              // never more than five cards reading at once

export class CalloutLayer {
  constructor(root) {
    this.root = root;
    this.cards = [];
    this.hovering = false;
    this._v = new THREE.Vector3();
  }

  spawn({ dispatch, burst, color, onOpen }) {
    const el = document.createElement('article');
    el.className = 'callout';
    el.style.setProperty('--accent', color);
    el.innerHTML = `
      <i class="co-live"></i>
      <div class="co-lens"><span>${esc(dispatch.lens)}</span><em>${esc(burst.arch.family.toUpperCase())}</em></div>
      <h3 class="co-title">${esc(dispatch.title)}</h3>
      <p class="co-sum">${esc(dispatch.summary)}</p>
      <div class="co-foot"><span>${esc(burst.arch.caliber)}" · ${esc(burst.arch.emitter)}</span><span>READ →</span></div>`;
    el.addEventListener('click', onOpen);
    el.addEventListener('pointerenter', () => { this.hovering = true; c.hot = true; el.classList.add('is-hot'); });
    el.addEventListener('pointerleave', () => { this.hovering = false; c.hot = false; el.classList.remove('is-hot'); });
    el.style.transform = 'translate(-50%,-50%) translate3d(-9999px,-9999px,0)';
    this.root.appendChild(el);

    const c = {
      el, burst, dispatch, color,
      born: performance.now() / 1000, t: 0,
      anchor: new THREE.Vector3(burst.x, burst.y, burst.z),
      pos: new THREE.Vector2(window.innerWidth * 0.5, window.innerHeight * 0.5),
      vel: new THREE.Vector2(0, 0),
      aim: new THREE.Vector2(window.innerWidth * 0.5, window.innerHeight * 0.5),
      w: el.offsetWidth || 300, h: el.offsetHeight || 132,
      hot: false, dead: false, inFrame: false,
    };
    this.cards.push(c);
    while (this.cards.length > MAX + 2) this.retire(this.cards[0]);
    requestAnimationFrame(() => {
      c.w = el.offsetWidth || 300; c.h = el.offsetHeight || 132;
      if (!c.dead) el.classList.add('is-in');
    });
    return c;
  }

  retire(c, instant = false) {
    if (!c || c.dead) return;
    c.dead = true;
    c.el.classList.add('is-dead');
    const el = c.el;
    setTimeout(() => el.remove(), instant ? 40 : 900);
    const i = this.cards.indexOf(c);
    if (i >= 0) this.cards.splice(i, 1);
  }

  clear() {
    this.cards.slice().forEach(c => this.retire(c, true));
    this.hovering = false;
  }

  hottest() {
    let best = null, bestT = -1;
    for (const c of this.cards) {
      if (c.dead) continue;
      if (c.t > bestT) { bestT = c.t; best = c; }
    }
    return best ? best.anchor : null;
  }

  update(dt, stage, elapsed) {
    if (!this.cards.length) return;
    const W = window.innerWidth, H = window.innerHeight;
    const now = performance.now() / 1000;

    for (let i = this.cards.length - 1; i >= 0; i--) {
      const c = this.cards[i];
      c.t = now - c.born;
      if (!c.hot && c.t > LIFE + FADE) { this.retire(c); continue; }
      const b = c.burst;
      if (elapsed > b.born + b.life + 4) { this.retire(c); continue; }
      this.layout(c, stage, W, H, dt, now);
    }
  }

  layout(c, stage, W, H, dt) {
    this._v.copy(c.anchor).project(stage.camera);
    const behind = this._v.z > 1;
    const ax = clamp((this._v.x * 0.5 + 0.5) * W, 92, W - 92);
    const ay = clamp((-this._v.y * 0.5 + 0.5) * H, 96, H - 110);
    c.aim.set(ax, ay);

    const side = c.anchor.x >= 0 ? 1 : -1;
    const tx = clamp(ax + side * 210, c.w / 2 + 16, W - c.w / 2 - 16);
    const ty = clamp(ay + 26, c.h / 2 + 20, H - c.h / 2 - 40);

    c.vel.x += (tx - c.pos.x) * 5.4 * dt;
    c.vel.y += (ty - c.pos.y) * 5.4 * dt;

    for (const o of this.cards) {
      if (o === c || o.dead) continue;
      const dx = c.pos.x - o.pos.x, dy = c.pos.y - o.pos.y;
      const minX = (c.w + o.w) / 2 + 18, minY = (c.h + o.h) / 2 + 16;
      const adx = Math.abs(dx), ady = Math.abs(dy);
      if (adx < minX && ady < minY) {
        const push = 620 * dt;
        if (adx / minX < ady / minY) c.vel.x += Math.sign(dx || 1) * push;
        else c.vel.y += Math.sign(dy || 1) * push;
      }
    }
    if (c.pos.x < c.w / 2 + 14) c.vel.x += 900 * dt;
    if (c.pos.x > W - c.w / 2 - 14) c.vel.x -= 900 * dt;
    if (c.pos.y < c.h / 2 + 14) c.vel.y += 900 * dt;
    if (c.pos.y > H - c.h / 2 - 30) c.vel.y -= 900 * dt;

    c.vel.multiplyScalar(Math.pow(0.0022, dt));
    c.pos.x += c.vel.x * dt;
    c.pos.y += c.vel.y * dt;
    c.pos.x = clamp(c.pos.x, c.w / 2 + 12, Math.max(c.w / 2 + 12, W - c.w / 2 - 12));
    c.pos.y = clamp(c.pos.y, c.h / 2 + 12, Math.max(c.h / 2 + 12, H - c.h / 2 - 28));

    const age = c.t;
    let alpha = 1;
    if (!c.hot) alpha = age < LIFE ? 1 : 1 - (age - LIFE) / FADE;
    alpha = clamp(alpha, 0, 1) * (behind ? 0.35 : 1);

    c.el.style.transform =
      `translate(-50%,-50%) translate3d(${c.pos.x.toFixed(1)}px,${c.pos.y.toFixed(1)}px,0)` +
      (c.hot ? ' scale(1.025)' : '');
    c.el.style.opacity = alpha.toFixed(3);
    c.el.style.zIndex = String(c.hot ? 40 : 20 + Math.round(alpha * 10));
    const bar = c.el.querySelector('.co-live');
    if (bar) bar.style.transform = `scaleX(${Math.max(0, 1 - age / (LIFE + FADE)).toFixed(3)})`;
  }
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, ch =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
