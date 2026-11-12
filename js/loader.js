/* ============================================================================
   AFTER LIGHT · loader.js
   Stage 1 — THE THRESHOLD.
   ----------------------------------------------------------------------------
   · Under the tagline: a console line that types itself (STATUS, below).
   · Top-right: real-time visitor device & system preflight checks showing
     which checks have passed, which is running, and how many remain.
   · Bottom-left: "working" + the appearing feed. It prints LINES (below) one
     at a time, in order: short notes on what this build is assembling. When
     they run out, the WAITING lines repeat slowly until the visitor clicks.
     The measured numbers live in the checks (top-right) and the boot line.
   · Bottom-right: the processing line. Boot sequence ID, a progress bar that
     walks toward the real state of the checks in small steps, and SKIP [ESC].
   · In the sky: an armillary of three rings, on its own small canvas.
   · The pointer: the reticle is the page's cursor image (styles.css), so it
     cannot trail the pointer. This file only moves the constellation name
     that rides beside it.
   ========================================================================== */

const DEFAULT_CHECKS = [
  { id: 'device',  label: 'hw · viewport' },
  { id: 'webgl',   label: 'gl2 · instanced' },
  { id: 'shaders', label: 'glsl · bloom' },
  { id: 'audio',   label: 'pcm · audio' },
  { id: 'archive', label: 'json · corpus' },
  { id: 'stream',  label: 'sse · topology' },
];

/* The appearing text, bottom-left. One line per tick, top to bottom, once.
   To change what the first page says, edit these strings. Keep each line
   true to the build: this page also says that nothing here is invented. */
const LINES = [
  'opening the archive',
  'reading cached dispatches',
  'parsing sourced summaries',
  'discarding list pages and timelines',
  'checking every date against today',
  'weighing strontium against copper',
  'copper is the difficult one',
  'holding the flame under 1200 °C',
  'resolving 589 nanometres of sodium',
  'the sky is still empty',
  'taking the floor and horizon away',
  'matching the fog to the dark',
  'distance is the only depth cue',
  'allocating the particle pool',
  'eighty to a hundred thousand slots',
  'all of them asleep',
  'compiling emitters',
  'no shell breaks the same way twice',
  'placing the listener with you',
  'setting the speed of sound to 343',
  'tuning the low-pass for distance',
  'listening to the wikimedia stream',
  'filtering bots, keeping people',
  'filtering canaries',
  'an edit to an old war is not news',
  'holding the queue at forty',
  'one shell every five to seven seconds',
  'not a metronome. a breath',
  'scattering the stars at random',
  'thirteen thousand, most of them faint',
  'placing fifty-seven constellations',
  'the named stars go in first',
  'any constellation is a way in',
  'so is the dark between them',
  'assigning calibers in inches',
  'nothing here is scaled by a body count',
  'checking the reduced-motion setting',
  'warming the limiter',
  'leaving the sky unnumbered',
  'except frames per second',
  'that one is about the machine',
];

/* Shown after LINES, then repeated at a slower pace for as long as the
   visitor stays on this page. */
const WAITING = [
  'waiting for you',
  'the sky reads the world',
  'still waiting',
  'one click and it starts',
  'almost there',
];

/* The console line under the tagline. It types one entry, holds it, erases it
   and moves to the next. Each entry is read off this page at the moment it is
   typed; one with nothing to report yet returns null and is passed over. */
const STATUS = [
  (t) => (t.ready ? 'after light · ready' : 'after light · starting'),
  (t) => `${t.passedCount} / ${t.checkItems.size} checks passed`,
  (t) => (t.ready ? `${t.archetypes} archetypes loaded` : null),
  (t) => (t.ready ? `${t.dispatches} dispatches cached` : null),
  (t) => (t.ready ? `ready in ${t.totalSec} s` : null),
];

export class Threshold {
  constructor({ onIgnite, onSkip, onAimMove, onAimLeave }) {
    this.root = document.getElementById('loader-threshold');
    this.liveEl = document.getElementById('lt-live');
    this.fieldEl = document.getElementById('lt-field');
    this.feedEl = document.getElementById('lt-feed');
    this.logEl = document.getElementById('lt-log');
    this.checksCountEl = document.getElementById('lt-checks-count');
    this.arcFillEl = document.getElementById('lt-arc-fill');
    this.metaUtcEl = document.getElementById('lt-meta-utc');
    this.metaViewEl = document.getElementById('lt-meta-view');
    this.metaVecEl = document.getElementById('lt-meta-vec');
    this.aimEl = document.getElementById('lt-aim');
    this.aimNameEl = document.getElementById('lt-aim-name');
    this.hintEl = document.getElementById('lt-ignite-hint');
    this.bootEl = document.getElementById('lt-boot');
    this.barEl = document.getElementById('lt-bar');
    this.hintEl = document.getElementById('lt-ignite-hint');
    this.skipBtn = document.getElementById('lt-skip');
    this.onIgnite = onIgnite;
    this.onSkip = onSkip;
    this.onAimMove = onAimMove;
    this.onAimLeave = onAimLeave;

    this.startedAt = performance.now();
    this.done = false;
    this.ready = false;
    this.igniting = false;
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.bootId = this.makeBootId();
    this.bootEl.textContent = `${this.bootId} · linking`;

    /* The feed is a script: LINES once, in order, then WAITING on repeat.
       `sources` and `si` are not read by the feed any more. They stay because
       main.js (registerProbes) still writes to both. */
    this.sources = [];
    this.si = 0;
    this.feedRows = [];
    this._line = 0;
    this._wait = 0;

    this.checkItems = new Map();
    this.passedCount = 0;
    this.barGoal = 0;
    this._status = 0;
    this.initChecks(DEFAULT_CHECKS);

    this.startFeed();
    this.startLive();
    this.startBar();
    this.startField();
    this.startTelemetry();
    this.bindAim();
    this.bindClick();

    this.skipBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.done || this.igniting) return;
      this.onSkip?.();
      this.skip();
    });
    this._onEsc = (e) => {
      if (e.key === 'Escape' && !this.done && !this.igniting) {
        this.onSkip?.();
        this.skip();
      }
    };
    window.addEventListener('keydown', this._onEsc);
  }

  makeBootId() {
    const h = '0123456789ABCDEF';
    let s = 'SEQ-';
    for (let i = 0; i < 4; i++) s += h[Math.floor(Math.random() * 16)];
    return s;
  }

  /* ── right-sky astronomical crescent preflight checks ─────────────────── */
  initChecks(list) {
    if (!this.logEl) return;
    this.logEl.innerHTML = '';
    this.checkItems.clear();
    this.passedCount = 0;
    if (this.arcFillEl) {
      this._arcLen = this.arcFillEl.getTotalLength?.() || 165;
      this.arcFillEl.style.strokeDasharray = this._arcLen.toFixed(2);
      this.arcFillEl.style.strokeDashoffset = this._arcLen.toFixed(2);
    }
    for (const item of list) {
      const li = document.createElement('li');
      li.dataset.state = 'wait';
      li.innerHTML = `<div class="lt-node-main"><i class="lt-node-star"></i><b>${esc(item.label)}</b></div><span>queued</span>`;
      this.logEl.appendChild(li);
      this.checkItems.set(item.id, { li, state: 'wait' });
    }
    this.updateChecksCounter();
  }

  setCheck(id, state, detail = '') {
    const rec = this.checkItems.get(id);
    if (!rec) return;
    const prev = rec.state;
    rec.state = state;
    rec.li.dataset.state = state;
    const sp = rec.li.querySelector('span');
    if (sp) {
      sp.textContent = detail || (state === 'active' ? 'checking…' : state === 'ok' ? 'passed' : 'queued');
    }
    if (prev !== 'ok' && state === 'ok') this.passedCount++;
    else if (prev === 'ok' && state !== 'ok') this.passedCount = Math.max(0, this.passedCount - 1);

    if (state === 'active' || state === 'ok') {
      const label = rec.li.querySelector('b')?.textContent || id;
      this.bootEl.textContent = `${this.bootId} · ${label}`;
    }
    this.updateChecksCounter();
  }

  updateChecksCounter() {
    const total = this.checkItems.size || 1;
    const done = Array.from(this.checkItems.values()).filter(c => c.state === 'ok' || c.state === 'warn').length;
    const left = Math.max(0, total - done);
    if (this.arcFillEl) {
      const len = this._arcLen || 165;
      this.arcFillEl.style.strokeDashoffset = (len * (1 - done / total)).toFixed(2);
      this.arcFillEl.classList.toggle('is-done', left === 0);
    }
    if (this.checksCountEl && !this.igniting) {
      if (left === 0) {
        this.checksCountEl.textContent = `${done} / ${total} PASSED`;
        this.checksCountEl.classList.add('is-done');
      } else {
        this.checksCountEl.textContent = `${done} / ${total} · ${left} LEFT`;
        this.checksCountEl.classList.remove('is-done');
      }
    }
    /* What the processing line is walked toward (startBar): the share of the
       checks that have finished, and nothing ahead of that. */
    this.barGoal = (done / total) * 100;
  }

  /* ── bottom-right processing line ─────────────────────────────────────── */
  startBar() {
    if (!this.barEl) return;
    let shown = 0;
    const tick = () => {
      if (this.done || this.igniting) return;
      if (shown < this.barGoal) {
        shown = this.reduced ? this.barGoal : Math.min(this.barGoal, shown + 5 + Math.random() * 9);
        this.barEl.style.width = shown.toFixed(0) + '%';
      }
      if (shown < 100) this._barT = setTimeout(tick, 150);
    };
    tick();
  }

  /* ── the console line under the tagline ───────────────────────────────── */
  startLive() {
    const el = this.liveEl;
    if (!el) return;
    const caret = el.querySelector('.lt-caret');
    const show = (txt) => { el.textContent = txt; if (caret) el.appendChild(caret); };
    if (this.reduced) {                       // no typing: one line, kept current
      this._liveStill = () => show(STATUS[0](this) + '…');
      this._liveStill();
      return;
    }
    const next = () => {
      for (let n = 0; n < STATUS.length; n++) {
        const txt = STATUS[this._status++ % STATUS.length](this);
        if (txt) return txt;
      }
      return '';
    };
    let full = '', i = 0;
    const type = () => {
      if (this.done || this.igniting) return;
      i++;
      show(full.slice(0, i) + (i < full.length ? '' : '…'));
      this._liveT = i < full.length
        ? setTimeout(type, 26 + Math.random() * 40)
        : setTimeout(erase, 1500);
    };
    const erase = () => {
      if (this.done || this.igniting) return;
      i -= 3;
      if (i > 0) { show(full.slice(0, i)); this._liveT = setTimeout(erase, 16); return; }
      show('');
      this._liveT = setTimeout(cycle, 220);
    };
    const cycle = () => {
      if (this.done || this.igniting) return;
      full = next(); i = 0;
      type();
    };
    cycle();
  }

  /* ── the instrument in the sky: an armillary of three rings ─────────────
     Line work only, on its own small canvas (.lt-field in styles.css decides
     where it sits and how large it is). Three rings turn slowly about one
     centre; the outer one carries a graduated limb and a single sight. */
  startField() {
    const cv = this.fieldEl;
    const ctx = cv && cv.getContext ? cv.getContext('2d') : null;
    if (!ctx || !('ResizeObserver' in window)) return;
    const ink = (a) => `rgba(143,182,212,${a})`;
    const TIP = 0.22;                          // how far the rings are tipped toward the eye
    const RINGS = [
      { r: 1.00, tilt: -0.34, roll: 0.00, spin: 0.020, a: 0.21 },
      { r: 0.71, tilt: 0.52, roll: 0.60, spin: -0.014, a: 0.15 },
      { r: 0.44, tilt: -0.95, roll: 1.20, spin: 0.026, a: 0.11 },
    ];
    let side = 0, dpr = 1;
    const draw = (t) => {
      if (!side) return;
      const R = side * 0.47;
      ctx.setTransform(dpr, 0, 0, dpr, (side * dpr) / 2, (side * dpr) / 2);
      ctx.clearRect(-side / 2, -side / 2, side, side);
      ctx.lineWidth = 0.7;
      for (const g of RINGS) {
        ctx.save();
        ctx.rotate(g.roll + t * g.spin);
        ctx.beginPath();
        ctx.ellipse(0, 0, R * g.r, R * g.r * (TIP + Math.abs(Math.sin(g.tilt)) * 0.55), 0, 0, Math.PI * 2);
        ctx.strokeStyle = ink(g.a);
        ctx.stroke();
        ctx.restore();
      }
      /* the limb: 72 ticks on the outer circle, a longer one every 15° */
      ctx.beginPath();
      for (let n = 0; n < 72; n++) {
        const ang = (n / 72) * Math.PI * 2 - Math.PI / 2 + t * 0.02;
        const r0 = R * (n % 6 === 0 ? 0.90 : 0.945);
        const y = Math.sin(ang) * r0 * TIP;
        ctx.moveTo(Math.cos(ang) * r0, y);
        ctx.lineTo(Math.cos(ang) * R * 1.005, y);
      }
      ctx.strokeStyle = ink(0.20);
      ctx.lineWidth = 0.8;
      ctx.stroke();
      /* the sight: one dot riding the limb, and the line it is read along */
      const ang = -Math.PI / 2 + t * 0.09;
      const sx = Math.cos(ang) * R, sy = Math.sin(ang) * R * TIP;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(sx, sy);
      ctx.strokeStyle = ink(0.10);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(sx, sy, 1.8, 0, Math.PI * 2);
      ctx.fillStyle = ink(0.55);
      ctx.fill();
    };
    const clock = () => (this.reduced ? 0 : performance.now() / 1000);
    /* fires once when observation starts, then whenever the canvas is resized */
    this._fieldRO = new ResizeObserver(() => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      side = cv.clientWidth;
      cv.width = cv.height = Math.round(side * dpr);
      draw(clock());
    });
    this._fieldRO.observe(cv);
    if (this.reduced) return;
    let last = 0;
    const loop = (now) => {
      if (this.done || this.igniting) return;
      if (now - last >= 33) { last = now; draw(now / 1000); }      // the rings are slow: 30 fps is plenty
      this._fieldRaf = requestAnimationFrame(loop);
    };
    this._fieldRaf = requestAnimationFrame(loop);
  }

  /** Leaving this page (a click, SKIP, or the dissolve): stop everything it
      runs by itself and give the pointer back. */
  release() {
    clearTimeout(this._t);
    clearTimeout(this._barT);
    clearTimeout(this._liveT);
    cancelAnimationFrame(this._fieldRaf);
    this._fieldRO?.disconnect();
    this.stopTelemetry();
    window.removeEventListener('keydown', this._onEsc);
    if (this._onAimMove) this.root.removeEventListener('pointermove', this._onAimMove);
    this.root.classList.remove('has-reticle', 'has-target');
  }

  /* Backward-compatible fallback hook */
  logLine(label, ms, ok) {
    for (const [id, rec] of this.checkItems) {
      const txt = rec.li.querySelector('b')?.textContent || '';
      if (txt === label || id === label) {
        this.setCheck(id, ok ? 'ok' : 'warn', `${ms.toFixed(1)} ms`);
        return;
      }
    }
  }

  /* ── left-corner live working feed ────────────────────────────────────── */
  pushCustomLine(text) {
    if (this.done || !text) return;
    this.feedRows.push({ text, el: null });
    if (this.feedRows.length > 5) this.feedRows.shift();
    this.paintFeed();
  }

  /** Kept so main.js (registerProbes) runs unchanged. Probes are collected
      here but the feed no longer prints them. */
  addSource(fn) { this.sources.push(fn); return this; }

  /* ── left-corner live working feed ────────────────────────────────────── */
  startFeed() {
    const WORK = () => 560 + Math.random() * 240;     // pace of the build notes
    const WAIT = () => 1800 + Math.random() * 800;    // pace once it is waiting
    /* Prints the next line and returns the pause before the one after it
       (0 = nothing left to print). */
    const pushNext = () => {
      if (this._line < LINES.length) {
        this.pushCustomLine(LINES[this._line++]);
        return this._line < LINES.length ? WORK() : WAIT();
      }
      if (!WAITING.length) return 0;
      this.pushCustomLine(WAITING[this._wait++ % WAITING.length]);
      return WAIT();
    };
    this._pushFeedLine = pushNext;
    const loop = () => {
      if (this.done) return;
      const gap = pushNext();
      if (gap) this._t = setTimeout(loop, gap);
    };
    loop();                         // first line on the first frame
  }

  paintFeed() {
    const ul = this.feedEl;
    const n = this.feedRows.length;

    for (let i = 0; i < n; i++) {
      const row = this.feedRows[i];
      if (!row.el) {
        const li = document.createElement('li');
        li.textContent = row.text;
        li.dataset.age = String(n - 1 - i);
        row.el = li;
        li.addEventListener('animationend', () => {
          li.style.animation = 'none';
          li.style.removeProperty('opacity');
        }, { once: true });
        ul.appendChild(li);
      } else {
        row.el.dataset.age = String(n - 1 - i);
      }
    }

    /* Rows leave from the top, where they are already the dimmest thing on
       screen, and the list closes up. No FLIP transforms: measuring and
       re-transforming five rows on every tick is how a feed ends up with two
       lines printed on top of each other when the frame budget is tight. */
    const keep = new Set(this.feedRows.map(r => r.el));
    for (const child of Array.from(ul.children)) {
      if (!keep.has(child)) child.remove();
    }

    const last = this.feedRows[this.feedRows.length - 1];
    if (last && last.el && !last._in) {
      last._in = true;
      last.el.style.animation = 'none';
      void last.el.offsetWidth;
      last.el.style.animation = '';
    }
  }

  finish(totalSec, archetypes, dispatches) {
    this.totalSec = totalSec;
    this.archetypes = archetypes;
    this.dispatches = dispatches;
    /* The processing line closes on the checks it has been naming. The time
       and the two counts are typed under the tagline instead (STATUS). A phone
       gets the short form: an ellipsis beside SKIP would hide the half that
       matters. */
    const two = (n) => String(n).padStart(2, '0');
    const total = this.checkItems.size;
    const tally = this.passedCount === total ? two(total) : `${two(this.passedCount)} of ${two(total)}`;
    this.bootEl.textContent = window.innerWidth < 720
      ? `${this.bootId} · ${tally} passed`
      : `${this.bootId} · ${tally} checks passed · ignition ready`;
    this.ready = true;
    this._liveStill?.();
    this.hintEl?.classList.add('is-ready');
  }

  startTelemetry() {
    const tick = () => {
      if (this.done || this.igniting) return;
      if (this.metaUtcEl) {
        this.metaUtcEl.textContent = new Date().toISOString().slice(11, 19);
      }
    };
    tick();
    this._metaT = setInterval(tick, 1000);
  }

  stopTelemetry() {
    if (this._metaT) {
      clearInterval(this._metaT);
      this._metaT = null;
    }
  }

  skip() {
    if (this.done) return;
    this.done = true;
    this.release();
    this.onAimLeave?.();
    this.feedEl.style.opacity = '.25';
    this.bootEl.textContent = `${this.bootId} · ${this.totalSec ?? '0.00'}s · skipped`;
  }

  /** Flip the aim label inboard when it would run under the checks column. */
  _placeAimLabel(viewportW, mx) {
    if (!this.aimNameEl) return;
    this.aimEl.classList.remove('is-flip-x');
    const labelW = this.aimNameEl.offsetWidth || 0;
    if (mx + 26 + labelW > viewportW - 272) this.aimEl.classList.add("is-flip-x");
  }

  bindAim() {
    if (!this.aimEl || this.reduced || !window.matchMedia('(pointer: fine)').matches) return;
    this.root.classList.add('has-reticle');      // the page cursor becomes the reticle
    let raf = 0, mx = 0, my = 0;
    this._onAimMove = (e) => {
      if (this.done || this.igniting) return;
      mx = e.clientX; my = e.clientY;
      /* the name rides the pointer, so it is moved here and not a frame later */
      this.aimEl.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (this.done || this.igniting) return;
        const w = Math.max(1, window.innerWidth);
        const h = Math.max(1, window.innerHeight);
        const nx = (mx / w) * 2 - 1;
        const ny = 1 - (my / h) * 2;
        this.aimEl.classList.add('is-active');
        this.aimEl.classList.remove('is-flip-x');
        const az = Math.round(((mx / w) - 0.5) * 90);
        const el = Math.round((1 - (my / h)) * 90);
        const azStr = `${az >= 0 ? '+' : ''}${az}°`;
        if (this.metaViewEl) this.metaViewEl.textContent = `${azStr} AZ`;
        if (this.metaVecEl) this.metaVecEl.textContent = `${el.toFixed(1)}° EL`;
        const hit = this.onAimMove?.(nx, ny);
        if (hit && hit.constellation) {
          if (this.aimNameEl) {
            this.aimNameEl.textContent = hit.star
              ? `${hit.constellation} · ${hit.star}`
              : hit.constellation;
          }
          this.aimEl.classList.add('has-constellation');
          this.root.classList.add('has-target');
          this._placeAimLabel(w, mx);
          /* the hint becomes an instruction for the thing under the cursor:
             a pattern can be selected, and selecting it flies you in */
          if (this.hintEl && this._hintPattern !== hit.constellation) {
            this._hintPattern = hit.constellation;
            this.hintEl.classList.add('is-pattern');
            this.hintEl.innerHTML =
              `<span class="lt-hint-dot"></span>CLICK TO ENTER ${hit.constellation}`;
          }
        } else {
          if (this.aimNameEl) this.aimNameEl.textContent = '';
          this.aimEl.classList.remove('has-constellation');
          this.root.classList.remove('has-target');
          this._placeAimLabel(w, mx);
          if (this.hintEl?.classList.contains('is-pattern')) {
            this._hintPattern = null;
            this.hintEl.classList.remove('is-pattern');
            this.hintEl.innerHTML =
              '<span class="lt-hint-dot"></span>CLICK ANYWHERE TO ENTER';
          }
        }
      });
    };
    this.root.addEventListener('pointermove', this._onAimMove, { passive: true });
    this.root.addEventListener('pointerleave', () => {
      this.aimEl?.classList.remove('is-active', 'has-constellation');
      this.root.classList.remove('has-target');
      if (this.aimNameEl) this.aimNameEl.textContent = '';
      this.onAimLeave?.();
    });
  }

  bindClick() {
    const fire = (e) => {
      if (this.done || this.igniting) return;
      if (e && e.target && e.target.closest && e.target.closest('#lt-skip')) return;
      this.igniting = true;
      this.release();
      this.aimEl?.classList.remove('is-active');
      this.onAimLeave?.();
      this.root.classList.add('is-igniting');
      this.hintEl?.classList.remove('is-ready');
      this.hintEl && (this.hintEl.style.opacity = '0');

      this.onIgnite?.(e);
    };
    this.root.addEventListener('pointerdown', fire);
    this.root.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fire(e); }
    });
    this.root.addEventListener('touchstart', fire, { passive: true });
    this.root.setAttribute('role', 'button');
    this.root.setAttribute('tabindex', '0');
    this.root.setAttribute('aria-label', 'Click anywhere to enter');
  }

  dissolve(ms = 1100) {
    const el = this.root;
    if (!el || el.dataset.leaving) return;
    el.dataset.leaving = '1';
    el.classList.add('is-out');
    el.style.transitionDuration = ms + 'ms';
    this.release();
    this.done = true;
    setTimeout(() => el.remove(), ms + 90);
  }
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
