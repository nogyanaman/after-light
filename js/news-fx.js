/* ═══════════════════════════════════════════════════════════════════════════
   INTERSPACE · news-fx.js

   Mounts NewsFireworks directly into the Stage's 3D scene and camera loop.
   One real-time bad-news dispatch = one handcrafted 3D shell = one compact,
   minimalist message box showing time, title, and fuller visible summary,
   tethered tightly beside the burst and retiring strictly while the firework
   is still visibly glowing in the sky.
   ═══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

let lib = null;
let booting = null;
let layer = null;
let _hostStage = null;
const plates = [];

export function bindNewsStage(stage) {
  _hostStage = stage || null;
  if (lib && _hostStage) {
    lib.init({ scene: _hostStage.scene, camera: _hostStage.camera, externalLoop: true });
  }
}

export function loadNewsFireworks() {
  if (lib) return Promise.resolve(lib);
  if (booting) return booting;
  booting = import('../fireworks.js')
    .then((m) => {
      lib = m.default || m.NewsFireworks;
      if (_hostStage) {
        lib?.init?.({ scene: _hostStage.scene, camera: _hostStage.camera, externalLoop: true });
      } else {
        lib?.init?.({ zIndex: 8 });
      }
      lib?.warm?.();
      return lib;
    })
    .catch(() => null);
  return booting;
}

export function setNewsSound(on) {
  try { lib?.setSound?.(!!on); } catch {}
}
export function setNewsVolume(v) {
  try { lib?.setVolume?.(v); } catch {}
}
export function setNewsPaused(p) {
  try { lib?.setPaused?.(!!p); } catch {}
}
export function setNewsQuality(q) {
  try { lib?.setQuality?.(q); } catch {}
}

export function syncNewsCamera(camera) {
  if (!camera) return;
  camera.getWorldDirection(_fwd);
  _right.crossVectors(_fwd, _worldUp).normalize();
  _up.crossVectors(_right, _fwd).normalize();
  _camPos.copy(camera.position);
  _camFov = camera.fov;
  _camAspect = innerWidth / Math.max(1, innerHeight);
  if (!lib) return;
  _v2.copy(camera.position).addScaledVector(_fwd, 90);
  lib.setView(camera.position, _v2, camera.fov);
}

const _v2 = new THREE.Vector3();
const _fwd = new THREE.Vector3(0, 0.18, -0.98);
const _right = new THREE.Vector3(1, 0, 0);
const _up = new THREE.Vector3(0, 1, 0);
const _worldUp = new THREE.Vector3(0, 1, 0);
const _camPos = new THREE.Vector3(0, 3.2, 54);
let _camFov = 46;
let _camAspect = 16 / 9;

const FAMILY = {
  'CONFLICT & FRONTLINES': [
    'crossette', 'titanChrys', 'shellShells', 'salute', 'streaker',
    'doublePeony', 'dahlia', 'warimono', 'beadChrys',
  ],
  'EARTH & CATACLYSM': [
    'giantWillow', 'palm', 'coconut', 'giantSaturn', 'brocade',
    'cometBurst', 'chrys', 'diadem', 'doubleRing',
  ],
  'SUDDEN TRAGEDY': [
    'strobe', 'crackleFlower', 'ghost', 'spider', 'serpent',
    'colorChange', 'gogetters', 'pistil', 'glitter', 'ring',
  ],
  'NOTABLE PASSINGS': [
    'kamuro', 'willow', 'waterfall', 'fallingLeaves', 'webWillow',
    'horsetail', 'spiral', 'peony',
  ],
};

const _recentShells = [];
function shellFor(d) {
  const fam = FAMILY[d?.lens] || FAMILY['SUDDEN TRAGEDY'];
  const fresh = fam.filter((k) => !_recentShells.includes(k));
  const pool = fresh.length ? fresh : fam;
  const picked = pool[Math.floor(Math.random() * pool.length)];
  _recentShells.push(picked);
  if (_recentShells.length > 6) _recentShells.shift();
  return picked;
}

let _laneCursor = 0;
const ARENA_LANES = [
  { xMin: -52, xMax: -22, yMin: 32, yMax: 45, zMin: -88, zMax: -64 },
  { xMin: -14, xMax:  14, yMin: 35, yMax: 49, zMin: -94, zMax: -68 },
  { xMin:  22, xMax:  52, yMin: 32, yMax: 45, zMin: -88, zMax: -64 },
];

function pickBreak(key) {
  let bestLane = (_laneCursor + 1) % ARENA_LANES.length;
  let bestScore = -1;
  for (let l = 0; l < ARENA_LANES.length; l++) {
    const idx = (_laneCursor + 1 + l) % ARENA_LANES.length;
    const laneMidX = (ARENA_LANES[idx].xMin + ARENA_LANES[idx].xMax) * 0.5;
    let minDist = Infinity;
    for (const p of plates) {
      if (!p.dead) minDist = Math.min(minDist, Math.abs(p.anchor.x - laneMidX));
    }
    if (minDist > bestScore) {
      bestScore = minDist;
      bestLane = idx;
    }
  }
  _laneCursor = bestLane;
  const L = ARENA_LANES[bestLane];
  const x = L.xMin + Math.random() * (L.xMax - L.xMin);
  const y = L.yMin + Math.random() * (L.yMax - L.yMin);
  const z = L.zMin + Math.random() * (L.zMax - L.zMin);
  return { x, y, z, spread: lib?.spread?.(key) || 22 };
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
const rgb = (hex) => {
  const h = String(hex).replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
function accentOf(colors) {
  let best = colors?.[0] || '#ffc46b', bestS = -1;
  for (const c of colors || []) {
    const [r, g, b] = rgb(c);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const score = (mx ? (mx - mn) / mx : 0) * 1.6 + (mx / 255) * 0.6;
    if (score > bestS) { bestS = score; best = c; }
  }
  return best;
}

function ensureLayer() {
  if (layer && document.body.contains(layer)) return layer;
  layer = document.createElement('div');
  layer.id = 'news-layer';
  document.body.appendChild(layer);
  return layer;
}

function openDispatchUrl(dispatch) {
  const url = dispatch?.url || (
    dispatch?.title
      ? 'https://en.wikipedia.org/wiki/' + encodeURIComponent(String(dispatch.title).replace(/ /g, '_'))
      : 'https://en.wikipedia.org/wiki/Portal:Current_events'
  );
  try {
    const w = window.open(url, '_blank', 'noopener,noreferrer');
    if (w) return;
  } catch {}
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function spawnPlate(dispatch, info) {
  const MAX = innerWidth / Math.max(1, innerHeight) < 0.85 ? 1 : 2;
  while (plates.length >= MAX) retire(plates[0], false);

  const accent = accentOf(info.colors);
  const [ar, ag, ab] = rgb(accent);
  const articleUrl = dispatch?.url || (
    dispatch?.title
      ? 'https://en.wikipedia.org/wiki/' + encodeURIComponent(String(dispatch.title).replace(/ /g, '_'))
      : 'https://en.wikipedia.org/wiki/Portal:Current_events'
  );

  const el = document.createElement('a');
  el.className = 'newsplate';
  el.href = articleUrl;
  el.target = '_blank';
  el.rel = 'noopener noreferrer';
  el.style.setProperty('--fx', accent);
  el.style.setProperty('--fx-soft', `rgba(${ar},${ag},${ab},.20)`);
  el.style.setProperty('--fx-edge', `rgba(${ar},${ag},${ab},.64)`);
  el.style.setProperty('--fx-glow', `rgba(${ar},${ag},${ab},.34)`);

  const clock = new Date().toISOString().slice(11, 16) + ' UTC';
  el.innerHTML = `
    <div class="np-time"><i class="np-dot"></i><span>${clock}</span></div>
    <h3 class="np-title">${esc(dispatch.title)}</h3>
    <p class="np-sum">${esc(dispatch.summary)}</p>
    <i class="np-leader" aria-hidden="true"></i>
    <i class="np-pin" aria-hidden="true"></i>`;
  el.style.opacity = '0';
  ensureLayer().appendChild(el);

  const now = performance.now();
  /* Visible starlight in burstVS fades out between 55% and 65% of info.life
     (because info.life is sized to the longest outlier particle). Cap the
     card's visible life to 58% of info.life (~1.8s - 2.3s) so the news box
     is strictly on screen ONLY while the firework is visibly bright! */
  const visibleLife = clamp((info.life || 3.4) * 0.58, 1.75, 2.35);
  const p = {
    burstId: info.id,
    el,
    leadEl: el.querySelector('.np-leader'),
    pinEl: el.querySelector('.np-pin'),
    dispatch,
    articleUrl,
    anchor: new THREE.Vector3(...info.origin),
    color: accent,
    spread: info.spread || 18,
    born: now,
    totalLife: visibleLife,
    dies: now + visibleLife * 1000,
    pos: new THREE.Vector2(innerWidth / 2, innerHeight / 2),
    target: new THREE.Vector2(innerWidth / 2, innerHeight / 2),
    w: el.offsetWidth || 308,
    h: el.offsetHeight || 118,
    alpha: 0.30,
    hot: false,
    dead: false,
    placed: false,
  };
  plates.push(p);

  el.addEventListener('pointerenter', () => {
    p.hot = true;
    el.classList.add('is-hot');
    document.body.classList.add('is-reading');
  });
  el.addEventListener('pointerleave', () => {
    p.hot = false;
    el.classList.remove('is-hot');
    document.body.classList.remove('is-reading');
  });
  el.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
  });
  el.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openDispatchUrl(dispatch);
  });

  return p;
}

function retire(p, instant = false) {
  if (!p || p.dead) return;
  p.dead = true;
  const i = plates.indexOf(p);
  if (i >= 0) plates.splice(i, 1);
  p.el.classList.add('is-out');
  p.el.style.opacity = '0';
  const el = p.el;
  setTimeout(() => el.remove(), instant ? 50 : 260);
}

const _p = new THREE.Vector3();
export function updateNewsPlates(camera, rawDt = 0.016) {
  const dt = Math.min(0.05, Math.max(0.004, rawDt));
  lib?.step?.(dt);

  if (!plates.length || !camera) return;
  const W = innerWidth, H = innerHeight;
  const now = performance.now();
  const snaps = lib?.burning?.() || [];
  const topSafe = 64;
  const botSafe = H - 76;

  for (let i = plates.length - 1; i >= 0; i--) {
    const c = plates[i];
    c.w = c.el.offsetWidth || c.w || 308;
    c.h = c.el.offsetHeight || c.h || 118;

    let remain = (c.dies - now) / 1000;
    let burning = false;
    for (const b of snaps) {
      if (
        (c.burstId && b.id === c.burstId) ||
        (Math.abs(b.x - c.anchor.x) < 2 && Math.abs(b.y - c.anchor.y) < 2 && Math.abs(b.z - c.anchor.z) < 2)
      ) {
        burning = true;
        // Visible stars fade out at ~58% of b.life; sync card remaining time to visible stars
        const visEnd = b.life * 0.58;
        remain = Math.min(remain, visEnd - b.age);
        break;
      }
    }
    if (!c.hot && ((!burning && now - c.born > 250) || remain <= 0.05)) {
      retire(c);
      continue;
    }
    c._remain = remain;

    _p.copy(c.anchor).project(camera);
    const behind = _p.z > 1;
    c._onScreen = !behind && Math.abs(_p.x) < 1.12 && Math.abs(_p.y) < 1.12;
    const ax = (_p.x * 0.5 + 0.5) * W;
    const ay = (-_p.y * 0.5 + 0.5) * H;
    c._ax = ax;
    c._ay = ay;

    const preferRight = ax < W * 0.54;
    const sideDir = preferRight ? 1 : -1;
    const tetherGap = 28;
    let tx = ax + sideDir * (c.w * 0.5 + tetherGap);
    let ty = ay - 14;

    if (tx - c.w * 0.5 < 16) {
      tx = ax + (c.w * 0.5 + tetherGap);
    } else if (tx + c.w * 0.5 > W - 16) {
      tx = ax - (c.w * 0.5 + tetherGap);
    }
    tx = clamp(tx, c.w * 0.5 + 16, W - c.w * 0.5 - 16);
    ty = clamp(ty, topSafe + c.h * 0.5, botSafe - c.h * 0.5);
    c.target.set(tx, ty);
  }

  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < plates.length; i++) {
      const c = plates[i];
      if (c.dead || c.hot) continue;
      for (let j = 0; j < i; j++) {
        const o = plates[j];
        if (o.dead) continue;
        const minX = (c.w + o.w) * 0.5 + 14;
        const minY = (c.h + o.h) * 0.5 + 12;
        const dx = c.target.x - o.target.x;
        const dy = c.target.y - o.target.y;
        const ox = minX - Math.abs(dx);
        const oy = minY - Math.abs(dy);
        if (ox > 0 && oy > 0) {
          const sy = dy >= 0 ? 1 : -1;
          c.target.y = clamp(c.target.y + sy * oy, topSafe + c.h * 0.5, botSafe - c.h * 0.5);
        }
      }
    }
  }

  for (let i = 0; i < plates.length; i++) {
    const c = plates[i];
    if (c.dead) continue;
    if (!c.placed) {
      c.pos.copy(c.target);
      c.placed = true;
    } else if (!c.hot) {
      const k = Math.min(1, dt * 13);
      c.pos.x += (c.target.x - c.pos.x) * k;
      c.pos.y += (c.target.y - c.pos.y) * k;
    }

    let want = 1;
    const ageMs = now - c.born;
    if (ageMs < 140) want = 0.25 + 0.75 * (ageMs / 140);
    // Smoothly fade out the card during the final 0.55s of visible starlight
    if (!c.hot && c._remain < 0.55) want = Math.max(0, (c._remain - 0.05) / 0.50);
    if (!c._onScreen && !c.hot) want = 0;
    if (c.hot) want = 1;
    c.alpha += (want - c.alpha) * Math.min(1, dt * 18);

    const leftPx = c.pos.x - c.w * 0.5;
    const topPx = c.pos.y - c.h * 0.5;
    c.el.style.transform = `translate3d(${leftPx.toFixed(1)}px,${topPx.toFixed(1)}px,0)`;
    c.el.style.opacity = c.alpha.toFixed(3);
    c.el.style.zIndex = String(c.hot ? 65 : 40 + i);
    c.el.style.pointerEvents = c.alpha > 0.2 ? 'auto' : 'none';

    const ax = c._ax, ay = c._ay;
    const nearX = clamp(ax, leftPx + 8, leftPx + c.w - 8);
    const nearY = clamp(ay, topPx + 8, topPx + c.h - 8);
    const dx = ax - nearX;
    const dy = ay - nearY;
    const len = Math.hypot(dx, dy);
    const ang = (Math.atan2(-dx, dy) * 180) / Math.PI;

    if (c.leadEl) {
      c.leadEl.style.left = `${(nearX - leftPx).toFixed(1)}px`;
      c.leadEl.style.top = `${(nearY - topPx).toFixed(1)}px`;
      c.leadEl.style.height = `${Math.max(0, len).toFixed(1)}px`;
      c.leadEl.style.transform = `rotate(${ang.toFixed(1)}deg)`;
      c.leadEl.style.opacity = (c.alpha * clamp((150 - len) / 85, 0.28, 0.92)).toFixed(2);
    }
    if (c.pinEl) {
      c.pinEl.style.left = `${(ax - leftPx).toFixed(1)}px`;
      c.pinEl.style.top = `${(ay - topPx).toFixed(1)}px`;
      c.pinEl.style.opacity = (c.alpha * 0.94).toFixed(2);
    }
  }
}

export function fireNewsShell(dispatch, opts = {}) {
  if (!dispatch) return null;
  const key = opts.type || shellFor(dispatch);
  const label = lib?.labels?.[key] || key.replace(/([A-Z])/g, ' $1').trim();
  const caliberRoll = opts.hero ? 1.25 + Math.random() * 0.16 : 1.05 + Math.random() * 0.22;
  const inches = Math.max(3, Math.round(caliberRoll * 3.5));

  const rec = {
    dispatch,
    key,
    label,
    inches,
    at: performance.now(),
  };
  const delay = Math.max(0, (opts.delay || 0) * 1000);

  const fire = () => loadNewsFireworks().then((L) => {
    if (!L) return;
    let x = opts.x, y = opts.y, z = opts.z;
    if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number') {
      const brk = pickBreak(key);
      x = brk.x; y = brk.y; z = brk.z;
    }
    rec.pos = [x, y, z];
    if (opts.onLaunch) opts.onLaunch(rec);
    L.blast(key, {
      x,
      y,
      z,
      exact: true,
      fuse: opts.fuse ?? (1.02 + Math.random() * 0.20),
      caliber: caliberRoll,
      lifeScale: 1.08 + Math.random() * 0.14,
      onBreak: (info) => {
        const plate = spawnPlate(dispatch, info);
        if (opts.onBreak) opts.onBreak(info, plate);
      },
    });
  });

  if (delay) setTimeout(fire, delay);
  else fire();
  return rec;
}

export function bestCameraTarget() {
  const targets = lib?.activeTargets?.() || [];
  if (!targets.length) return null;
  const shells = targets.filter((t) => t.kind === 'shell');
  if (shells.length) return shells[shells.length - 1];
  return targets[targets.length - 1];
}

export function latestShot() {
  const t = bestCameraTarget();
  if (t) return [t.x, t.y, t.z];
  for (let i = plates.length - 1; i >= 0; i--) {
    if (!plates[i].dead) return plates[i].anchor.toArray();
  }
  return null;
}

export function activeLights() {
  const snaps = lib?.burning?.() || [];
  return snaps.map((b) => {
    const match = plates.find((p) => !p.dead && p.burstId === b.id);
    return match ? { ...b, color: match.color } : b;
  });
}

export function clearNewsPlates() {
  plates.slice().forEach((p) => retire(p, true));
}
