/* ================================================================
   NewsFireworks — drop-in 3D fireworks + synchronized per-shell audio.
   One blast per call, exactly where you say, with distinct per-shell
   recorded + synthesized firework sound in tight visual sync.
   46 real shell types. Can share the host Stage scene/camera/loop
   (zero duplicate WebGLRenderer / EffectComposer overhead) or run
   standalone in its own overlay canvas.
   ================================================================ */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const G = 9.8;
const WIND = new THREE.Vector3(0.85, 0, 0.2);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function sparkTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.14, 'rgba(255,252,245,0.92)');
  g.addColorStop(0.32, 'rgba(255,244,225,0.52)');
  g.addColorStop(0.62, 'rgba(255,235,210,0.16)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/* ── Audio Engine: Authentic Real-Life Outdoor Pyrotechnic Acoustics ─────── */
let actx = null;
let masterGain = null;
let masterComp = null;
let reverbNode = null;
let reverbGain = null;
let echoDelayL = null;
let echoDelayR = null;
let echoFilter = null;
let echoGain = null;
let soundOn = true;
let masterVol = 0.85;
let paused = false;

// Pre-fetched raw ArrayBuffers + decoded AudioBuffers for all 9 real outdoor firework recordings
const rawAudioBytes = {};
const realBufs = {};
let rawPreloadStarted = false;

const SAMPLE_FILES = ['boom', 'fw1', 'fw2', 'fw3', 'fw4', 'fw5', 'fw6', 'fw7', 'fw8'];

// Exact measured acoustic transient offsets from waveform analysis of audio/*.ogg
const SAMPLE_META = {
  boom: { offset: 0.606, dur: 0.96 }, // 0.606s is the exact outdoor concussion shockwave onset; 0.00..0.58s is the real mortar launch + ascent whistle!
  fw1:  { offset: 0.002, dur: 1.48 }, // crisp single peony/dahlia break + distant pop
  fw2:  { offset: 0.002, dur: 1.84 }, // break + dense outdoor time-rain crackle cloud (0.70..1.65s)
  fw3:  { offset: 0.002, dur: 2.18 }, // break + long cascading willow/glitter crackle rain (0.85..2.15s)
  fw4:  { offset: 0.001, dur: 1.49 }, // razor-sharp immediate snap + multi-pop cluster at 1.15s
  fw5:  { offset: 0.005, dur: 1.84 }, // deep resonant palm/brocade thump + rolling valley echo
  fw6:  { offset: 0.004, dur: 2.19 }, // wide kamuro/willow canopy break + shimmering tail
  fw7:  { offset: 0.002, dur: 1.49 }, // symmetrical ring/pistil break + rapid sub-break pops
  fw8:  { offset: 0.004, dur: 1.84 }, // high-velocity chrysanthemum break + sparkling tail
};

function preloadRawAudio() {
  if (rawPreloadStarted || typeof fetch === 'undefined') return;
  rawPreloadStarted = true;
  for (const name of SAMPLE_FILES) {
    const relPath = './audio/' + name + '.ogg';
    fetch(relPath)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()))
      .then((ab) => {
        rawAudioBytes[name] = ab;
        if (actx && !realBufs[name]) {
          actx.decodeAudioData(ab.slice(0)).then((b) => { realBufs[name] = b; }).catch(() => {});
        }
      })
      .catch(() => {});
  }
}
function decodeLoadedAudio() {
  if (!actx) return;
  preloadRawAudio();
  for (const name of SAMPLE_FILES) {
    if (!realBufs[name] && rawAudioBytes[name]) {
      const copy = rawAudioBytes[name].slice(0);
      actx.decodeAudioData(copy).then((b) => { realBufs[name] = b; }).catch(() => {});
    }
  }
}

function buildOutdoorImpulse(ctx, sec = 2.8, decay = 2.5) {
  const n = Math.floor(ctx.sampleRate * sec);
  const b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const w = Math.random() * 2 - 1;
      // Low-pass filter the reverb tail so outdoor night air absorbs high frequencies naturally
      lp = 0.82 * lp + 0.18 * w;
      const env = Math.pow(1 - t, decay);
      d[i] = lp * env * 0.52;
    }
  }
  return b;
}

function ensureAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!actx) {
    actx = new AC({ latencyHint: 'interactive' });
    masterComp = actx.createDynamicsCompressor();
    masterComp.threshold.value = -8;
    masterComp.knee.value = 14;
    masterComp.ratio.value = 6;
    masterComp.attack.value = 0.002;
    masterComp.release.value = 0.24;

    masterGain = actx.createGain();
    masterGain.gain.value = soundOn ? masterVol : 0;

    // Open-air night valley slapback echo (190ms & 340ms low-passed reflections off distant terrain)
    echoDelayL = actx.createDelay(1.0);
    echoDelayR = actx.createDelay(1.0);
    echoDelayL.delayTime.value = 0.185;
    echoDelayR.delayTime.value = 0.335;
    echoFilter = actx.createBiquadFilter();
    echoFilter.type = 'lowpass';
    echoFilter.frequency.value = 780;
    echoGain = actx.createGain();
    echoGain.gain.value = 0.22;

    reverbNode = actx.createConvolver();
    reverbNode.buffer = buildOutdoorImpulse(actx, 2.8, 2.5);
    reverbGain = actx.createGain();
    reverbGain.gain.value = 0.28;

    masterGain.connect(masterComp);
    masterGain.connect(echoDelayL);
    echoDelayL.connect(echoFilter);
    echoDelayL.connect(echoDelayR);
    echoDelayR.connect(echoFilter);
    echoFilter.connect(echoGain);
    echoGain.connect(masterComp);

    masterGain.connect(reverbNode);
    reverbNode.connect(reverbGain);
    reverbGain.connect(masterComp);
    masterComp.connect(actx.destination);
  }
  if (actx.state === 'suspended' && !paused) {
    actx.resume().catch(() => {});
  }
  decodeLoadedAudio();
  return actx;
}
['pointerdown', 'pointerup', 'click', 'touchend', 'keydown', 'wheel'].forEach(ev => addEventListener(ev, ensureAudio, { passive: true }));

function makeSpatialBus(origin, gainVal = 1.0) {
  const g = actx.createGain();
  g.gain.value = gainVal;
  let panVal = 0;
  if (origin && camera) {
    const v = origin.clone().project(camera);
    if (Number.isFinite(v.x)) panVal = clamp(v.x * 0.72, -0.85, 0.85);
  }
  if (actx.createStereoPanner) {
    const panner = actx.createStereoPanner();
    panner.pan.value = panVal;
    g.connect(panner);
    panner.connect(masterGain);
  } else {
    g.connect(masterGain);
  }
  return g;
}

/** Play a slice of a real outdoor firework recording with natural distance air-absorption EQ. */
function playRealSlice(name, bus, t0, { rate = 1.0, gain = 0.75, lpHz = 12000, hpHz = 28, startOffset = null, maxDur = null } = {}) {
  const buf = realBufs[name];
  if (!buf) return;
  const meta = SAMPLE_META[name] || { offset: 0, dur: buf.duration };
  const offset = startOffset !== null ? startOffset : meta.offset;
  const startOff = Math.min(Math.max(0, offset), Math.max(0, buf.duration - 0.08));
  const src = actx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = clamp(rate, 0.45, 2.2);

  let node = src;
  if (hpHz > 32) {
    const hp = actx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(hpHz, t0);
    node.connect(hp);
    node = hp;
  }
  const lp = actx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(clamp(lpHz, 350, 16000), t0);
  node.connect(lp);

  const g = actx.createGain();
  g.gain.setValueAtTime(gain, t0);
  if (maxDur) {
    g.gain.setValueAtTime(gain, t0 + maxDur * 0.72);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + maxDur);
  }
  lp.connect(g);
  g.connect(bus);
  if (maxDur) {
    src.start(t0, startOff, maxDur * src.playbackRate.value + 0.04);
  } else {
    src.start(t0, startOff);
  }
}

/* ── 46 Shell Acoustic Recipes Built Strictly from Real Outdoor Recordings ── */
const SHELL_VOICE = {
  // Concussion & Ground Effects
  salute:        { main: 'boom', layer: 'fw4', boomRate: 0.78, mainRate: 0.94, boomGain: 1.05, layerGain: 0.72 },
  mine:          { main: 'fw5',  layer: 'fw4', boomRate: 0.96, mainRate: 1.02, boomGain: 0.68, layerGain: 0.65 },
  candle:        { main: 'fw7',  layer: 'fw1', boomRate: 1.25, mainRate: 1.22, boomGain: 0.42, layerGain: 0.55 },

  // Weeping Willows, Kamuro & Brocades (deep warm canopy boom + long real shimmering tail)
  willow:        { main: 'fw6',  layer: 'fw5', boomRate: 0.84, mainRate: 0.90, boomGain: 0.78, layerGain: 0.62, tailSample: 'fw3', tailDelay: 0.22 },
  giantWillow:   { main: 'fw6',  layer: 'fw5', boomRate: 0.70, mainRate: 0.78, boomGain: 0.98, layerGain: 0.75, tailSample: 'fw3', tailDelay: 0.25 },
  kamuro:        { main: 'fw6',  layer: 'fw1', boomRate: 0.80, mainRate: 0.85, boomGain: 0.84, layerGain: 0.65, tailSample: 'fw3', tailDelay: 0.24 },
  brocade:       { main: 'fw5',  layer: 'fw6', boomRate: 0.82, mainRate: 0.88, boomGain: 0.82, layerGain: 0.66, tailSample: 'fw2', tailDelay: 0.28 },
  webWillow:     { main: 'fw6',  layer: 'fw3', boomRate: 0.86, mainRate: 0.86, boomGain: 0.72, layerGain: 0.68 },

  // Palms, Coconuts & Cascades (heavy fibrous thump + frond expansion)
  palm:          { main: 'fw5',  layer: 'fw2', boomRate: 0.86, mainRate: 0.92, boomGain: 0.85, layerGain: 0.64, crackle: true },
  coconut:       { main: 'fw5',  layer: 'fw1', boomRate: 0.74, mainRate: 0.82, boomGain: 0.96, layerGain: 0.70 },
  horsetail:     { main: 'fw6',  layer: 'fw5', boomRate: 0.92, mainRate: 0.95, boomGain: 0.64, layerGain: 0.58 },
  waterfall:     { main: 'fw3',  layer: 'fw6', boomRate: 0.95, mainRate: 0.92, boomGain: 0.56, layerGain: 0.62 },
  cometBurst:    { main: 'fw5',  layer: 'fw8', boomRate: 0.78, mainRate: 0.84, boomGain: 0.88, layerGain: 0.66 },

  // Crackle, Time-Rain & Chrysanthemums (punchy break + delayed real titanium crackle cloud)
  crackleFlower: { main: 'fw4',  layer: 'fw2', boomRate: 0.94, mainRate: 1.00, boomGain: 0.78, layerGain: 0.76, crackle: true },
  fallingLeaves: { main: 'fw2',  layer: 'fw3', boomRate: 0.90, mainRate: 0.92, boomGain: 0.66, layerGain: 0.74, crackle: true },
  glitter:       { main: 'fw8',  layer: 'fw3', boomRate: 0.94, mainRate: 0.98, boomGain: 0.74, layerGain: 0.70, crackle: true },
  chrys:         { main: 'fw8',  layer: 'fw2', boomRate: 0.90, mainRate: 0.96, boomGain: 0.80, layerGain: 0.68, crackle: true },
  titanChrys:    { main: 'fw8',  layer: 'fw3', boomRate: 0.72, mainRate: 0.82, boomGain: 0.96, layerGain: 0.78, crackle: true },
  streaker:      { main: 'fw4',  layer: 'fw8', boomRate: 0.98, mainRate: 1.08, boomGain: 0.78, layerGain: 0.68 },
  beadChrys:     { main: 'fw8',  layer: 'fw1', boomRate: 0.92, mainRate: 1.00, boomGain: 0.76, layerGain: 0.64 },

  // Splitting & Multi-Break Shells
  crossette:     { main: 'fw7',  layer: 'fw4', boomRate: 1.06, mainRate: 1.12, boomGain: 0.70, layerGain: 0.65 },
  shellShells:   { main: 'fw8',  layer: 'fw7', boomRate: 0.88, mainRate: 0.98, boomGain: 0.82, layerGain: 0.68 },
  doublePeony:   { main: 'fw1',  layer: 'fw7', boomRate: 0.86, mainRate: 0.94, boomGain: 0.84, layerGain: 0.68, dualBreak: true },

  // Tourbillion, Go-Getters, Fish & Spiral
  serpent:       { main: 'fw7',  layer: 'fw2', boomRate: 0.96, mainRate: 1.04, boomGain: 0.72, layerGain: 0.64 },
  gogetters:     { main: 'fw8',  layer: 'fw7', boomRate: 0.98, mainRate: 1.06, boomGain: 0.70, layerGain: 0.64 },
  fish:          { main: 'fw4',  layer: 'fw7', boomRate: 1.04, mainRate: 1.12, boomGain: 0.65, layerGain: 0.62 },
  spiral:        { main: 'fw8',  layer: 'fw6', boomRate: 0.90, mainRate: 0.96, boomGain: 0.76, layerGain: 0.64 },

  // Strobe, Ghost, Colour-Change & Rainbow
  strobe:        { main: 'fw8',  layer: 'fw3', boomRate: 0.94, mainRate: 1.02, boomGain: 0.75, layerGain: 0.68, crackle: true },
  colorChange:   { main: 'fw1',  layer: 'fw8', boomRate: 0.90, mainRate: 0.96, boomGain: 0.78, layerGain: 0.65 },
  ghost:         { main: 'fw6',  layer: 'fw8', boomRate: 0.88, mainRate: 0.92, boomGain: 0.76, layerGain: 0.64 },
  rainbow:       { main: 'fw8',  layer: 'fw1', boomRate: 0.88, mainRate: 0.95, boomGain: 0.80, layerGain: 0.66 },

  // Peonies, Dahlias, Rings & 3D Geometric Pattern Shells
  peony:         { main: 'fw1',  layer: 'fw7', boomRate: 0.92, mainRate: 0.98, boomGain: 0.78, layerGain: 0.62 },
  dahlia:        { main: 'fw5',  layer: 'fw1', boomRate: 0.78, mainRate: 0.86, boomGain: 0.92, layerGain: 0.68 },
  pistil:        { main: 'fw7',  layer: 'fw1', boomRate: 0.90, mainRate: 0.98, boomGain: 0.78, layerGain: 0.64, dualBreak: true },
  diadem:        { main: 'fw1',  layer: 'fw6', boomRate: 0.88, mainRate: 0.94, boomGain: 0.80, layerGain: 0.64 },
  warimono:      { main: 'fw4',  layer: 'fw7', boomRate: 0.94, mainRate: 1.04, boomGain: 0.82, layerGain: 0.68 },
  spider:        { main: 'fw4',  layer: 'fw8', boomRate: 0.96, mainRate: 1.10, boomGain: 0.80, layerGain: 0.68 },
  ring:          { main: 'fw7',  layer: 'fw1', boomRate: 0.98, mainRate: 1.04, boomGain: 0.74, layerGain: 0.60 },
  doubleRing:    { main: 'fw7',  layer: 'fw8', boomRate: 0.92, mainRate: 1.00, boomGain: 0.78, layerGain: 0.64, dualBreak: true },
  giantSaturn:   { main: 'fw5',  layer: 'fw7', boomRate: 0.72, mainRate: 0.82, boomGain: 0.96, layerGain: 0.74, dualBreak: true },
  heart:         { main: 'fw7',  layer: 'fw1', boomRate: 1.00, mainRate: 1.06, boomGain: 0.72, layerGain: 0.58 },
  starShape:     { main: 'fw8',  layer: 'fw7', boomRate: 0.98, mainRate: 1.04, boomGain: 0.74, layerGain: 0.60 },
  smiley:        { main: 'fw7',  layer: 'fw1', boomRate: 1.02, mainRate: 1.08, boomGain: 0.70, layerGain: 0.58 },
  cube:          { main: 'fw1',  layer: 'fw7', boomRate: 0.92, mainRate: 1.00, boomGain: 0.78, layerGain: 0.62 },
  halfhalf:      { main: 'fw1',  layer: 'fw8', boomRate: 0.90, mainRate: 0.96, boomGain: 0.78, layerGain: 0.64, dualBreak: true },
  fanBouquet:    { main: 'fw5',  layer: 'fw8', boomRate: 0.90, mainRate: 0.98, boomGain: 0.78, layerGain: 0.64 },
};

/** Real outdoor mortar launch thud + ascending shell air-rush (from boom.ogg 0.00..0.58s). */
function playLaunchSound(mortarPos, cfg, fuse, dist) {
  if (!soundOn || paused || !ensureAudio()) return;
  if (actx.state === 'suspended') actx.resume().catch(() => {});
  decodeLoadedAudio();
  const t0 = actx.currentTime;
  const dur = clamp(fuse, 0.45, 2.2);
  const distAtten = clamp(1.10 - dist / 600, 0.48, 1.0);
  const bus = makeSpatialBus(mortarPos, distAtten * 0.72);

  // 1) Real mortar tube thud (low-passed onset of fw5.ogg)
  playRealSlice('fw5', bus, t0, {
    startOffset: 0.004,
    maxDur: 0.26,
    rate: 0.64 + Math.random() * 0.08,
    gain: 0.42,
    lpHz: 340,
  });

  // 2) Real ascending shell air-whistle & lift charge rush (boom.ogg 0.02s..0.56s)
  const ascentRate = clamp(0.54 / dur, 0.48, 1.15);
  playRealSlice('boom', bus, t0 + 0.01, {
    startOffset: 0.02,
    maxDur: Math.min(dur * 0.94, 0.95),
    rate: ascentRate * (0.95 + Math.random() * 0.1),
    gain: 0.52,
    lpHz: 4200,
    hpHz: 140,
  });
}

/** Real outdoor firework explosion synchronized to the exact visual break frame (zero synth beeps). */
function boom(dist, cfg, origin) {
  if (!soundOn || paused || cfg?._silent || !ensureAudio()) return;
  if (actx.state === 'suspended') actx.resume().catch(() => {});
  decodeLoadedAudio();

  cfg = cfg || {};
  const key = cfg._key || 'peony';
  const V = SHELL_VOICE[key] || SHELL_VOICE.peony;
  const snd = cfg.snd || [1, 1, 1];
  const sGain = snd[0] || 1;
  const inches = Math.max(2, Math.round((cfg.caliber || 1) * 3));
  const sizeScale = clamp(inches / 4.2, 0.72, 1.45);
  const distAtten = clamp(1.15 - dist / 580, 0.52, 1.0);
  const lpDist = clamp(15000 - dist * 14, 5200, 15500);

  const jitter = 0.94 + Math.random() * 0.12;
  const t0 = actx.currentTime;
  const bus = makeSpatialBus(origin, distAtten * clamp(sGain * 0.92, 0.55, 1.2));

  // 1) Real outdoor concussion shockwave (boom.ogg starting at 0.606s peak onset)
  const boomRate = (V.boomRate || 0.90) * clamp(1.08 - (sizeScale - 1) * 0.18, 0.64, 1.32) * jitter;
  playRealSlice('boom', bus, t0, {
    startOffset: SAMPLE_META.boom.offset,
    rate: boomRate,
    gain: (V.boomGain || 0.80) * 0.82,
    lpHz: lpDist,
  });

  // 2) Deep sub-bass chest thump reinforcement (65Hz -> 26Hz physical air displacement)
  const sub = actx.createOscillator();
  const subG = actx.createGain();
  sub.type = 'sine';
  const f0 = clamp(68 * boomRate, 38, 86);
  sub.frequency.setValueAtTime(f0, t0);
  sub.frequency.exponentialRampToValueAtTime(22, t0 + 0.34);
  subG.gain.setValueAtTime(0.0001, t0);
  subG.gain.linearRampToValueAtTime((V.boomGain || 0.80) * 0.42, t0 + 0.005);
  subG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.36);
  sub.connect(subG).connect(bus);
  sub.start(t0);
  sub.stop(t0 + 0.38);

  // 3) Primary shell character recording (fw1..fw8)
  const mainRate = (V.mainRate || 0.98) * jitter;
  playRealSlice(V.main || 'fw1', bus, t0 + 0.004, {
    rate: mainRate,
    gain: (V.layerGain || 0.65) * 0.88,
    lpHz: lpDist,
  });

  // 4) Secondary outdoor texture layer (offset by 18-32ms for real 3D acoustic width)
  if (V.layer) {
    playRealSlice(V.layer, bus, t0 + 0.022 + Math.random() * 0.012, {
      rate: mainRate * (0.92 + Math.random() * 0.14),
      gain: (V.layerGain || 0.62) * 0.58,
      lpHz: lpDist * 0.92,
    });
  }

  // 5) Dual-break inner shell snap (for doublePeony, pistil, doubleRing, giantSaturn, halfhalf)
  if (V.dualBreak) {
    playRealSlice('fw7', bus, t0 + 0.068, {
      startOffset: 0.002,
      maxDur: 0.65,
      rate: mainRate * 1.18,
      gain: 0.54,
      lpHz: lpDist,
    });
  }

  // 6) Long willow/kamuro/brocade shimmering tail recording
  if (V.tailSample) {
    playRealSlice(V.tailSample, bus, t0 + (V.tailDelay || 0.24), {
      startOffset: 0.85,
      rate: 0.88 + Math.random() * 0.12,
      gain: 0.56,
      lpHz: lpDist * 0.88,
    });
  }

  // 7) Synchronized real outdoor titanium crackle cloud (aligned with visual cracklePts at t0 + 0.46s!)
  if (V.crackle || cfg.crackle) {
    playRealSlice('fw2', bus, t0 + 0.44, {
      startOffset: 0.72,
      rate: 0.94 + Math.random() * 0.14,
      gain: 0.68,
      lpHz: lpDist,
    });
    playRealSlice('fw3', bus, t0 + 0.52, {
      startOffset: 1.28,
      rate: 0.96 + Math.random() * 0.16,
      gain: 0.64,
      lpHz: lpDist,
    });
  }
}

/** Real outdoor 4-way crossette split pops (`b.age > 0.95`). */
function playCrossetteSplitSound(origin, dist) {
  if (!soundOn || paused || !ensureAudio()) return;
  if (actx.state === 'suspended') actx.resume().catch(() => {});
  decodeLoadedAudio();
  const t0 = actx.currentTime;
  const distAtten = clamp(1.12 - dist / 580, 0.48, 1.0);
  const bus = makeSpatialBus(origin, distAtten * 0.82);

  for (let s = 0; s < 4; s++) {
    const st = t0 + s * 0.036 + Math.random() * 0.012;
    playRealSlice(s % 2 === 0 ? 'fw4' : 'fw7', bus, st, {
      startOffset: 0.002,
      maxDur: 0.42,
      rate: 1.18 + s * 0.08,
      gain: 0.52,
      lpHz: 12500,
    });
  }
}

/** Real outdoor sub-break pop for `shellShells` (5 mini-shells) & `_double` breaks. */
function playSubBreakSound(origin, dist, idx = 0) {
  if (!soundOn || paused || !ensureAudio()) return;
  if (actx.state === 'suspended') actx.resume().catch(() => {});
  decodeLoadedAudio();
  const t0 = actx.currentTime;
  const distAtten = clamp(1.12 - dist / 580, 0.48, 1.0);
  const bus = makeSpatialBus(origin, distAtten * 0.76);

  playRealSlice('boom', bus, t0, {
    startOffset: SAMPLE_META.boom.offset,
    maxDur: 0.58,
    rate: 1.16 + (idx % 4) * 0.06,
    gain: 0.52,
    lpHz: 11000,
  });
  playRealSlice(idx % 2 === 0 ? 'fw7' : 'fw4', bus, t0 + 0.004, {
    startOffset: 0.002,
    maxDur: 0.68,
    rate: 1.12 + (idx % 5) * 0.07,
    gain: 0.58,
    lpHz: 12000,
  });
}

const C = (h) => new THREE.Color(h);
const SHELLS = {
  peony:        { label:'Peony', pattern:'sphere', stars:1400, trails:0, speed:23, speedSd:2.6, life:1.9, drag:1.1, size:1.45, a:C('#e8362a'), b:C('#ff7a1a'), glitter:.5, heatRate:2.6, h:[42,56], desc:'Spherical colour stars, no streamer. White ignition -> red/orange.' },
  chrys:        { label:'Chrysanthemum', pattern:'sphere', stars:1050, trails:7, trailDt:.03, trailAlpha:.74, speed:25, speedSd:2.2, life:2.2, drag:1.0, size:1.4, a:C('#3f8cff'), b:C('#eaf4ff'), crackle:true, glitter:.55, heatRate:6, h:[46,60], desc:'Dense sphere with trailing sparks and delayed crackle.' },
  willow:       { label:'Gold Willow', pattern:'sphere', stars:650, trails:8, trailDt:.05, trailAlpha:.6, speed:20, speedSd:2.6, life:3.1, drag:1.25, size:1.5, a:C('#ffb84d'), b:C('#d9822e'), glitter:.8, droop:1.0, h:[48,62], grav:.95, desc:'Charcoal gold streamers that brake, hang and droop.' },
  brocade:      { label:'Brocade Crown', pattern:'sphere', stars:800, trails:6, trailDt:.045, trailAlpha:.62, speed:21, speedSd:2.0, life:3.4, drag:1.15, size:1.6, a:C('#ffcf7d'), b:C('#c9862f'), glitter:.6, droop:.5, h:[48,62], desc:'Heavy gold brocade: dense, slow-falling, long trails.' },
  kamuro:       { label:'Kamuro', pattern:'sphere', stars:700, trails:10, trailDt:.055, trailAlpha:.55, speed:19, speedSd:2.2, life:3.8, drag:1.3, size:1.45, a:C('#ffe3ae'), b:C('#d9a54f'), glitter:.7, droop:1.4, h:[48,64], grav:.95, desc:'Japanese hanging-hair willow: very long drooping trails.' },
  dahlia:       { label:'Dahlia', pattern:'sphere', stars:280, trails:1, trailDt:.04, speed:31, speedSd:1.6, life:2.0, drag:.82, size:3.1, a:C('#ff5a3c'), b:C('#ffd23c'), glitter:.3, caliber:1.15, h:[46,60], desc:'Few, very large stars. Big calibre, bold and sparse.' },
  strobe:       { label:'Strobe Peony', pattern:'sphere', stars:950, trails:0, speed:22, speedSd:2.3, life:2.2, drag:1.05, size:1.5, a:C('#ff3d81'), b:C('#ffd9ec'), strobe:1, glitter:.2, h:[44,58], desc:'Strobe composition: stars blink hard on/off as they fall.' },
  smiley:       { label:'Smiley Face', pattern:'smiley', stars:800, trails:0, speed:29, speedSd:.6, life:2.0, drag:1.0, size:1.35, a:C('#ffd23c'), b:C('#ffe97a'), glitter:.2, decay:.9, h:[48,58], desc:'Pattern shell: ring face, two eyes and a smile — best viewed head-on.' },
  glitter:      { label:'Glitter Chrysanthemum', pattern:'sphere', stars:1100, trails:3, trailDt:.04, trailAlpha:.5, speed:22, speedSd:2.4, life:2.6, drag:1.1, size:1.3, a:C('#ffe9a8'), b:C('#fff6da'), glitter:1.0, crackle:true, crackleN:160, h:[44,58], desc:'Gold glitter: mid-life aluminium-flake flashes (brief, sparse).' },
  palm:         { label:'Palm Tree', pattern:'palm', stars:240, trails:3, trailDt:.035, speed:24, speedSd:2.0, life:2.4, drag:.95, size:2.3, a:C('#fff3d6'), b:C('#ffb84d'), crackle:true, glitter:.6, h:[48,62], desc:'Thick comets arc up and over like palm fronds.' },
  coconut:      { label:'Coconut Palm', pattern:'palm', stars:110, trails:5, trailDt:.05, speed:26, speedSd:1.6, life:2.9, drag:.9, size:4.2, a:C('#ffe9c4'), b:C('#e8a33d'), glitter:.5, caliber:1.2, h:[52,66], desc:'Huge few fronds, giant stars, long hang time.' },
  crossette:    { label:'Crossette', pattern:'sphere', stars:170, trails:1, trailDt:.025, speed:21, speedSd:1.4, life:.85, drag:.9, size:2.0, a:C('#37e0a0'), b:C('#eafff5'), split:1, glitter:.3, burstAt:.97, h:[44,58], desc:'Stars split into four sub-stars mid-flight.' },
  ring:         { label:'Saturn Ring', pattern:'ring', ring:.62, stars:900, trails:0, speed:23, speedSd:1.0, life:1.7, drag:1.05, size:1.55, decay:1.2, a:C('#8fa2ff'), b:C('#ffb84d'), glitter:.4, h:[46,60], desc:'Tilted ring around a coloured core sphere.' },
  doubleRing:   { label:'Double Ring', pattern:'doublering', stars:950, trails:0, speed:24, speedSd:.8, life:1.9, drag:1.0, size:1.55, decay:1.2, a:C('#ff4d6d'), b:C('#4dc9ff'), glitter:.35, h:[46,60], desc:'Two concentric rings at different speeds and colours.' },
  heart:        { label:'Heart', pattern:'heart', stars:650, trails:0, speed:27, speedSd:.7, life:1.8, drag:1.0, size:1.4, decay:.9, a:C('#ff2e63'), b:C('#ff7aa2'), glitter:.25, h:[48,58], desc:'Pattern shell: stars placed on a heart card, expands in shape.' },
  starShape:    { label:'Star Shell', pattern:'star', stars:650, trails:0, speed:27, speedSd:.7, life:1.8, drag:1.0, size:1.4, decay:.9, a:C('#ffd23c'), b:C('#fff3b0'), glitter:.3, h:[48,58], desc:'Five-point star pattern shell, randomly tilted in 3D.' },
  spider:       { label:'Spider', pattern:'sphere', stars:170, trails:10, trailDt:.06, trailAlpha:.82, speed:38, speedSd:1.8, life:1.5, drag:.5, size:2.6, a:C('#ffe9c4'), b:C('#ffb84d'), glitter:.3, h:[50,64], desc:'Very fast long-streak stars that race out and stop dead.' },
  horsetail:    { label:'Horsetail', pattern:'horsetail', stars:420, trails:3, trailDt:.04, speed:15, speedSd:2.0, life:2.8, drag:1.2, size:1.7, a:C('#ffb84d'), b:C('#ff8a3c'), glitter:.5, h:[50,64], desc:'Stars thrown out then pour downward in one falling tail.' },
  waterfall:    { label:'Waterfall', pattern:'waterfall', stars:500, trails:2, trailDt:.05, speed:9, speedSd:1.5, life:4.6, drag:.85, size:1.25, a:C('#ffe9c4'), b:C('#d9b26a'), glitter:.7, h:[54,66], grav:1.08, desc:'Low-energy burst: stars rain slowly for ~4 seconds.' },
  colorChange:  { label:'Colour-Change Peony', pattern:'sphere', stars:1150, trails:1, trailDt:.03, speed:22, speedSd:2.2, life:2.2, drag:1.05, size:1.45, a:C('#ffd76a'), b:C('#ffe9a8'), shift:'#3f8cff', glitter:.35, heatRate:5, h:[44,58], desc:'Gold stars that chemically change to blue mid-flight.' },
  pistil:       { label:'Pistil Peony', pattern:'pistil', stars:1200, trails:1, trailDt:.03, speed:23, speedSd:2.2, life:2.0, drag:1.05, size:1.45, a:C('#3f8cff'), b:C('#ff4d6d'), glitter:.4, h:[44,58], desc:'Blue sphere with a tight contrasting pink core (pistil).' },
  doublePeony:  { label:'Double Peony', pattern:'double', stars:1300, trails:1, trailDt:.03, speed:24, speedSd:2.0, life:2.1, drag:1.0, size:1.4, a:C('#37e0a0'), b:C('#ffd23c'), glitter:.4, h:[46,60], desc:'Shell-in-shell look: inner gold sphere inside an outer green one.' },
  serpent:      { label:'Tourbillion', pattern:'sphere', stars:520, trails:5, trailDt:.04, trailAlpha:.55, speed:21, speedSd:3.0, life:2.4, drag:1.0, size:1.6, a:C('#ff8a3c'), b:C('#ffd23c'), glitter:.4, turb:1.2, spin:5.5, h:[44,58], desc:'Spinning star tubes: the whole star field corkscrews as it expands.' },
  fish:         { label:'Swimming Fish', pattern:'sphere', stars:420, trails:2, trailDt:.03, speed:18, speedSd:4.5, life:2.2, drag:1.1, size:1.3, a:C('#7de0ff'), b:C('#eaf9ff'), glitter:.5, turb:2.6, h:[42,56], desc:'Erratic darting stars with strong random turbulence.' },
  crackleFlower:{ label:'Crackle Flower', pattern:'sphere', stars:900, trails:1, trailDt:.03, speed:22, speedSd:2.4, life:1.9, drag:1.1, size:1.4, a:C('#fff6da'), b:C('#ffd76a'), crackle:true, crackleN:460, glitter:.5, snd:[1,.9,3], h:[44,58], desc:'Sphere that erupts into a loud delayed titanium crackle cloud.' },
  salute:       { label:'Titanium Salute', pattern:'sphere', stars:110, trails:0, speed:30, speedSd:3.0, life:.8, drag:1.0, size:2.0, a:C('#ffffff'), b:C('#e8ecff'), glitter:.15, flash:2.4, caliber:1.3, burstAt:.92, snd:[1.9,.55,0], h:[54,66], desc:'Mostly flash and concussion: huge white bang, few stars. Loud, low boom.' },
  mine:         { label:'Mine', pattern:'mine', stars:650, trails:3, trailDt:.03, speed:30, speedSd:4.0, life:1.7, drag:1.0, size:1.8, a:C('#ff5a3c'), b:C('#ffd23c'), glitter:.5, snd:[1.25,1.25,1], desc:'Ground effect: fan of stars fired straight up from the mortar. Instant.' },
  candle:       { label:'Roman Candle', pattern:'candle', stars:130, trails:2, trailDt:.03, speed:13, speedSd:1.6, life:1.25, drag:1.0, size:1.7, a:C('#ff4d6d'), b:C('#37e0a0'), glitter:.4, snd:[.7,1.3,0], desc:'Six small coloured bursts fired one after another from the ground.' },
  fanBouquet:   { label:'Fan Bouquet', pattern:'fan', stars:700, trails:2, trailDt:.035, speed:24, speedSd:2.0, life:2.0, drag:1.05, size:1.5, a:C('#c77dff'), b:C('#ff7aa2'), glitter:.4, h:[44,58], desc:'Stars in an upward fan/plume instead of a sphere.' },
  fallingLeaves:{ label:'Time Rain', pattern:'sphere', stars:420, trails:4, trailDt:.05, trailAlpha:.5, speed:14, speedSd:1.6, life:3.6, drag:1.5, size:2.3, a:C('#ffe9a8'), b:C('#fff6da'), glitter:.9, crackle:true, crackleN:120, caliber:.9, h:[48,60], grav:.8, desc:'Large slow stars shedding glitter gradually with a sizzle (crackle).' },
  cometBurst:   { label:'Giant Comets', pattern:'sphere', stars:64, trails:8, trailDt:.06, speed:22, speedSd:1.6, life:2.6, drag:.95, size:5.0, a:C('#fff3d6'), b:C('#ffb84d'), glitter:.3, caliber:1.1, h:[48,62], desc:'A few enormous comet stars with thick streaming tails.' },
  streaker:     { label:'Grand Chrysanthemum', pattern:'sphere', stars:430, trails:16, trailDt:.016, trailAlpha:.86, speed:33, speedSd:1.7, life:1.7, drag:.6, size:1.5, palette:[C('#7dff5a'),C('#ff5a8a'),C('#ffb84d')], glitter:.25, h:[48,62], desc:'Photo-style long-exposure look: very long thin straight streaks, green/pink/gold.' },
  rainbow:      { label:'Rainbow Peony', pattern:'sphere', stars:1200, trails:0, speed:24, speedSd:2.4, life:2.0, drag:1.05, size:1.45, palette:[C('#ff5a8a'),C('#7dff5a'),C('#ffb84d'),C('#3f8cff'),C('#c77dff')], glitter:.4, h:[44,58], desc:'Every star a different colour of the spectrum, mixed through one sphere.' },
  beadChrys:    { label:'Golden Bead', pattern:'sphere', stars:700, trails:10, trailDt:.03, trailAlpha:.7, speed:27, speedSd:2.0, life:2.1, drag:.85, size:2.3, a:C('#ffc46b'), b:C('#ff9a3c'), glitter:.5, h:[46,60], desc:'Gold spokes ending in bright beads, like the classic display photograph.' },
  webWillow:    { label:'Spider Web Willow', pattern:'sphere', stars:380, trails:14, trailDt:.045, trailAlpha:.5, speed:17, speedSd:2.2, life:4.2, drag:1.45, size:1.1, a:C('#ffe3c2'), b:C('#ffb98a'), glitter:.55, droop:1.6, grav:.85, h:[50,64], desc:'Hundreds of fine hair-like fronds that sweep out and rain down slowly.' },
  giantWillow:  { label:'Giant Gold Willow', pattern:'sphere', stars:900, trails:9, trailDt:.05, trailAlpha:.62, speed:26, speedSd:2.4, life:4.0, drag:1.2, size:2.0, a:C('#ffd98a'), b:C('#e8a33d'), glitter:.7, droop:1.2, grav:.95, caliber:1.45, h:[58,74], desc:'GIANT calibre: a huge slow willow that fills the sky and hangs for seconds.' },
  titanChrys:   { label:'Titan Chrysanthemum', pattern:'sphere', stars:1500, trails:8, trailDt:.032, trailAlpha:.72, speed:30, speedSd:2.2, life:2.6, drag:1.05, size:1.8, a:C('#ff7847'), b:C('#ffe9a8'), crackle:true, glitter:.6, caliber:1.4, h:[56,72], desc:'GIANT calibre: an enormous dense trailing sphere with delayed crackle.' },
  cube:         { label:'Cube Shell', pattern:'cube', stars:900, trails:0, speed:30, speedSd:.6, life:2.0, drag:1.0, size:1.35, a:C('#3f8cff'), b:C('#7db4ff'), glitter:.2, decay:.9, caliber:1.1, h:[48,60], desc:'TRUE 3D pattern shell: a cube of stars expanding in space — orbit to see it turn.' },
  spiral:       { label:'Spiral Galaxy', pattern:'spiral', stars:850, trails:1, trailDt:.03, trailAlpha:.5, speed:28, speedSd:.6, life:2.2, drag:1.0, size:1.3, palette:[C('#ffd23c'),C('#3f8cff'),C('#fff3d6')], glitter:.3, decay:.9, h:[48,60], desc:'TRUE 3D two-arm spiral of stars in a tilted plane.' },
  warimono:     { label:'Warimono Sphere', pattern:'hollow', stars:1100, trails:2, trailDt:.03, trailAlpha:.55, speed:26, speedSd:.4, life:2.0, drag:1.05, size:1.4, a:C('#ff4d6d'), b:C('#ff8fab'), glitter:.25, h:[48,62], desc:'Japanese perfect break: identical stars form a crisp hollow sphere, exact from every angle.' },
  diadem:       { label:'Diadem', pattern:'diadem', stars:1000, trails:3, trailDt:.035, trailAlpha:.6, speed:24, speedSd:2.2, life:2.2, drag:1.05, size:1.45, a:C('#3f8cff'), b:C('#ffd23c'), glitter:.4, h:[46,60], desc:'Blue sphere with a gold centre cluster that hangs almost motionless (pistil family).' },
  halfhalf:     { label:'Half-and-Half', pattern:'halfhalf', stars:1100, trails:0, speed:23, speedSd:2.2, life:2.0, drag:1.05, size:1.45, a:C('#e8362a'), b:C('#37e0a0'), glitter:.35, h:[44,58], desc:'One hemisphere red, the other green — the split rotates with the shell, fully 3D.' },
  gogetters:    { label:'Go-Getters', pattern:'sphere', stars:420, trails:4, trailDt:.035, trailAlpha:.6, speed:20, speedSd:2.6, life:2.6, drag:.95, size:1.7, a:C('#7dff5a'), b:C('#eaffea'), glitter:.4, turb:2.6, h:[44,58], desc:'Self-propelled stars that suddenly dart off in random directions under their own power.' },
  ghost:        { label:'Ghost Shell', pattern:'sphere', stars:1000, trails:2, trailDt:.04, trailAlpha:.5, speed:23, speedSd:2.4, life:2.8, drag:1.05, size:1.45, a:C('#ffd23c'), b:C('#ffe97a'), shift:'#3f8cff', heatRate:3, glitter:.4, h:[46,60], desc:'Colour sweeps across the whole shell as it burns: gold melts into blue.' },
  shellShells:  { label:'Shell of Shells', pattern:'sphere', stars:500, trails:1, trailDt:.03, speed:22, speedSd:2.4, life:1.6, drag:1.05, size:1.5, a:C('#c77dff'), b:C('#ff7aa2'), glitter:.4, shells:5, h:[50,64], desc:'The first break scatters five mini-shells that all break again together.' },
  giantSaturn:  { label:'Giant Saturn', pattern:'sphere', ring:.55, stars:1200, trails:2, trailDt:.035, trailAlpha:.55, speed:28, speedSd:2.0, life:2.4, drag:1.05, size:1.8, a:C('#ffe9a8'), b:C('#ff9a3c'), glitter:.5, caliber:1.45, h:[58,74], desc:'GIANT calibre Saturn: huge gold sphere with a ring, visible from far away.' },
};

for (const k in SHELLS) {
  SHELLS[k] = Object.assign({
    pattern: 'sphere', trails: 0, trailDt: 0.03, speedSd: 2, crackle: false, strobe: 0, glitter: 0.3,
    heatRate: 9, droop: 0, turb: 0, grav: 1, h: [44, 60], caliber: 1, flash: 1, burstAt: 1, snd: [1, 1, 1],
  }, SHELLS[k]);
}

function gauss() {
  let u = 0, v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const SHELL_KEYS = Object.keys(SHELLS);

const burstVS = /* glsl */`
  attribute vec3 aVel; attribute vec3 aCol; attribute vec4 aMisc; // x:rand y:life z:size w:trailIdx
  attribute float aDelay; attribute float aDrag; attribute float aBright;
  uniform float uAge,uGrav,uDroop,uStrobe,uTime,uTrailDt,uGlitter,uHeatRate,uTurb,uDecay,uTrailAlpha,uSpin,uMaxTrail;
  uniform vec3 uSpinAxis;
  uniform vec3 uWind;
  varying vec3 vCol; varying float vI; varying float vHeat; varying float vGlit; varying float vShiftF;
  varying float vTrailFrac; varying float vLr;
  float hash(float n){ return fract(sin(n)*43758.5453123); }
  void main(){
    float rnd=aMisc.x, life=aMisc.y, trail=aMisc.w;
    float trailFrac = trail / max(1.0, uMaxTrail);
    vTrailFrac = trailFrac;
    float age = uAge - trail*uTrailDt - aDelay;
    float t = max(age, 0.);
    float lr = clamp(age/max(life,0.001), 0., 1.);
    vLr = lr;
    float k = aDrag;
    float e = 1. - exp(-k*t);
    vec3 p = position + aVel*(e/k);
    p = position + (p - position) * smoothstep(0.006, 0.055, age);
    p.y += (uGrav/k)*(e/k) - (uGrav/k)*t;
    p.y -= uDroop * 0.42 * max(0.0, t - 0.30) * max(0.0, t - 0.30);
    p += uWind * (t - e/k) * (0.25 + k*0.18);
    if(uSpin != 0.0){
      vec3 rel = p - position; float ang = uSpin * age * exp(-age*0.3); float ca = cos(ang), sa = sin(ang);
      p = position + rel*ca + cross(uSpinAxis, rel)*sa + uSpinAxis*dot(uSpinAxis, rel)*(1.0-ca);
    }
    p += vec3(sin(t*2.3+rnd*41.0), sin(t*1.8+rnd*29.0)*.5, cos(t*2.0+rnd*53.0)) * uTurb * min(t,1.6) * step(0.4,k);
    vShiftF = smoothstep(0.30, 0.66, lr);
    float dim  = mix(1.0, 0.62, smoothstep(0.14, 0.76, lr));
    float fade = 1.0 - smoothstep(0.72, 1.0, lr);
    float burn = dim * fade * (0.92 + 0.48*exp(-age*3.2));
    burn *= 0.66 + 0.34*exp(-age*uDecay);
    float flick = 0.92 + 0.16*hash(rnd*371.0 + floor(uTime*18.0 + rnd*31.0));
    float isGlit = step(1.0-uGlitter*0.36, fract(rnd*7.31));
    float spike = hash(rnd*733.0 + floor(uTime*(12.0+fract(rnd*3.7)*16.0) + rnd*97.0));
    float glitEnv = smoothstep(0.28, 0.50, lr) * (1.0 - smoothstep(0.82, 0.99, lr));
    vGlit = isGlit * glitEnv * smoothstep(0.85, 0.98, spike);
    float intensity = burn * flick + vGlit * 1.45 * burn;
    if(lr >= 1.0) intensity = 0.0;
    if(uStrobe > .5 && age > 0.28){
      float ph = fract(age*1.9 + rnd*13.7);
      intensity = (ph < 0.46 ? 1.45 : 0.04) * (1.0 - smoothstep(0.82,1.0,lr));
      vGlit = ph < 0.46 ? 0.75 : 0.0;
    }
    // Continuous silky incandescent filament along each star's streamer tail
    float isHead = step(trail, 0.5);
    float trailFade = mix(pow(1.0 - trailFrac, 1.15) * 0.82, 1.0, isHead);
    vI = age < 0.0 ? 0.0 : intensity * trailFade * aBright;
    vHeat = exp(-age*uHeatRate);
    vCol = aCol;
    vec4 mv = modelViewMatrix * vec4(p,1.);
    float taperSz = mix(1.0 - trailFrac * 0.48, 1.22, isHead);
    float sz = aMisc.z * taperSz * (1.10 - 0.28*lr) * (0.92 + 0.36*vHeat) * (1.0 + vGlit*.72);
    gl_PointSize = (age < 0.0 || vI <= 0.001) ? 0.0 : clamp(sz * (520. / max(1.,-mv.z)), 2.8, 32.0);
    gl_Position = projectionMatrix * mv;
  }`;

const burstFS = /* glsl */`
  varying vec3 vCol; varying float vI; varying float vHeat; varying float vGlit; varying float vShiftF;
  varying float vTrailFrac; varying float vLr;
  uniform vec3 uShiftCol; uniform float uShiftAmt;
  void main(){
    if(vI <= 0.001) discard;
    vec2 uv = gl_PointCoord - .5;
    float r2 = dot(uv,uv)*4.;
    if(r2 > 1.0) discard;
    float r = sqrt(r2);

    // Handcrafted 3-layer star: incandescent core + saturated chemical corona + soft optical bloom halo + 4-ray head glint
    float core   = exp(-r2 * 28.0);
    float corona = exp(-r2 * 6.8) * 0.84;
    float halo   = pow(max(0.0, 1.0 - r), 2.35) * 0.46;
    float headMask = clamp(1.0 - vTrailFrac * 2.5, 0.0, 1.0);
    float crossGlint = (exp(-abs(uv.x)*26.0)*exp(-abs(uv.y)*4.2) + exp(-abs(uv.y)*26.0)*exp(-abs(uv.x)*4.2)) * 0.36 * headMask * (0.45 + vGlit);
    float disc = core * 1.35 + corona + halo + crossGlint;

    // Chemical shift + warm 1500K charcoal-gold cooling along streamer tails & late embers
    vec3 baseCol = mix(vCol, uShiftCol, vShiftF * uShiftAmt * (1.0 - clamp(vHeat, 0., 1.)));
    vec3 charcoalCol = vec3(1.0, 0.54, 0.20);
    float tailCool = clamp(vTrailFrac * 0.48 + smoothstep(0.66, 0.98, vLr) * 0.52, 0.0, 0.78);
    vec3 chemCol = mix(baseCol, charcoalCol, tailCool);
    vec3 richCol = max(chemCol * 1.72, chemCol + vec3(0.08));

    vec3 hotCol  = vec3(1.0, 0.985, 0.94);
    vec3 glitCol = vec3(1.0, 0.96, 0.84);
    float whiteMix = clamp(core * 0.82 * headMask + vHeat * 0.58 * headMask, 0., 1.);
    vec3 col = mix(richCol, hotCol * 1.95, whiteMix);
    col = mix(col, glitCol * 2.15, clamp(vGlit * (core + corona * 0.5), 0., 1.));
    float a = clamp(disc * vI, 0., 1.);
    gl_FragColor = vec4(col * a, a);
  }`;

const smokeVS = /* glsl */`
  attribute vec3 aVel; uniform float uAge; varying float vA; varying float vLit;
  void main(){
    vec3 p = position + aVel*(1.-exp(-uAge*.45))/.45 + vec3(1.6,0.,.35)*uAge*.35;
    vLit = exp(-uAge*1.8);
    vA = .028 * smoothstep(0.,.18,uAge) * exp(-uAge*0.75);
    vec4 mv=modelViewMatrix*vec4(p,1.);
    gl_PointSize=min(14.+uAge*9., 64.)*(190./max(1.,-mv.z));
    gl_Position=projectionMatrix*mv;
  }`;

const smokeFS = /* glsl */`
  uniform vec3 uCol; uniform sampler2D uMap; varying float vA; varying float vLit;
  void main(){
    float a=texture2D(uMap,gl_PointCoord).a;
    vec3 col = mix(vec3(.04,.05,.075), uCol*0.95, vLit);
    gl_FragColor=vec4(col, a*vA);
  }`;

const launchVS = /* glsl */`
  attribute float aSize; attribute float aAlpha; varying float vA;
  void main(){
    vA=aAlpha; vec4 mv=modelViewMatrix*vec4(position,1.);
    gl_PointSize=aSize*(340./max(1.,-mv.z));
    gl_Position=projectionMatrix*mv;
  }`;

const launchFS = /* glsl */`
  varying float vA; uniform vec3 uCol;
  void main(){
    vec2 uv=gl_PointCoord-.5; float r2=dot(uv,uv)*4.;
    if(r2 > 1.0) discard;
    float core = exp(-r2*14.0);
    float halo = pow(max(0.0, 1.0 - sqrt(r2)), 2.0) * 0.72;
    float d = core + halo;
    vec3 col = mix(uCol * 2.2, vec3(1.0, 0.98, 0.92) * 2.6, core * 0.7);
    gl_FragColor=vec4(col * d * vA, clamp(d * vA, 0.0, 1.0));
  }`;

let renderer = null;
let scene = null;
let rootGroup = null;
let camera = null;
let composer = null;
let clock = null;
let inited = false;
let hostMode = false;
let externalLoop = false;
let idleCleared = false;
let qualityScale = 1.0;
let nextBurstId = 1;

let view = null; // {pos:Vector3, tgt:Vector3, fov}
const burstHooks = [];
const shells = [];
const bursts = [];
const flashes = [];
const pendingTimers = new Set();
const sparkTex = sparkTexture();

function scheduleTimeout(fn, ms) {
  const id = setTimeout(() => {
    pendingTimers.delete(id);
    if (!paused) fn();
  }, ms);
  pendingTimers.add(id);
  return id;
}

// Base shared ShaderMaterials so clones share compiled WebGLProgram
const baseBurstMat = new THREE.ShaderMaterial({
  vertexShader: burstVS,
  fragmentShader: burstFS,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});
const baseSmokeMat = new THREE.ShaderMaterial({
  vertexShader: smokeVS,
  fragmentShader: smokeFS,
  transparent: true,
  depthWrite: false,
  blending: THREE.NormalBlending,
});
const baseLaunchMat = new THREE.ShaderMaterial({
  vertexShader: launchVS,
  fragmentShader: launchFS,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});

function makeBurstUniforms(cfg, spinAxis) {
  return {
    uAge: { value: 0 },
    uGrav: { value: G * (cfg.grav ?? 1) },
    uDroop: { value: cfg.droop || 0 },
    uStrobe: { value: cfg.strobe },
    uTime: { value: 0 },
    uWind: { value: cfg._wind || WIND },
    uTrailDt: { value: 0.011 },
    uMaxTrail: { value: Math.max(1, cfg._actualTrails || cfg.trails || 6) },
    uGlitter: { value: cfg.glitter ?? 0.4 },
    uHeatRate: { value: cfg.heatRate || 9 },
    uTurb: { value: cfg.turb ?? 0 },
    uDecay: { value: cfg.decay ?? 1.05 },
    uTrailAlpha: { value: cfg.trailAlpha ?? 0.68 },
    uSpin: { value: cfg.spin || (['heart', 'star', 'smiley', 'cube', 'spiral'].includes(cfg.pattern) ? 0.3 : 0) },
    uSpinAxis: { value: spinAxis },
    uShiftCol: { value: cfg.shift ? new THREE.Color(cfg.shift) : new THREE.Color(0) },
    uShiftAmt: { value: cfg.shift ? 1 : 0 },
  };
}

function makeBurst(origin, cfg, scale = 1, inherit = null) {
  // Keep expansion velocity bounded so giant shells fit gracefully in frame and match spread()
  const velScale = clamp(scale, 0.65, 1.38);
  const PBOOST = 1.75 * qualityScale;
  const starN = Math.max(32, Math.round(cfg.stars * PBOOST));
  const isPatternShell = ['heart', 'star', 'smiley', 'cube', 'spiral', 'ring', 'doublering'].includes(cfg.pattern);
  const trails = isPatternShell ? Math.max(5, cfg.trails || 0) : Math.max(10, (cfg.trails || 0) + 6);
  cfg._actualTrails = trails;
  const count = starN * (trails + 1);
  const pos = new Float32Array(count * 3);
  const vel = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const misc = new Float32Array(count * 4);
  const delay = new Float32Array(count);
  const dragA = new Float32Array(count);
  const brightA = new Float32Array(count);

  const rndDir = () => {
    const u = Math.random() * 2 - 1;
    const th = Math.random() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    return new THREE.Vector3(r * Math.cos(th), u, r * Math.sin(th));
  };
  const bx = rndDir();
  const by = new THREE.Vector3().crossVectors(bx, rndDir()).normalize();
  const bz = new THREE.Vector3().crossVectors(bx, by);
  const sectorAxis = rndDir();
  const spinAxis = rndDir();
  const camX = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const camY = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  const camZ = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 2);
  const tilt = new THREE.Euler(Math.random() * 1.4, Math.random() * Math.PI, Math.random() * 1.4);
  const asym = new THREE.Vector3(0.99 + Math.random() * 0.02, 0.99 + Math.random() * 0.02, 0.99 + Math.random() * 0.02);

  let ptr = 0;
  let maxStarLife = 1.4;
  for (let i = 0; i < starN; i++) {
    let dir;
    let sp = Math.max(6, cfg.speed + gauss() * cfg.speedSd * 0.5);
    let forceColor = null;
    const ringStars = cfg.pattern === 'doublering' ? starN : (cfg.ring ? starN * cfg.ring : 0);
    if (i < ringStars) {
      const a = (i / Math.max(ringStars, 1)) * Math.PI * 2;
      dir = new THREE.Vector3(Math.cos(a), (Math.random() - 0.5) * 0.07, Math.sin(a)).applyEuler(tilt);
      sp = cfg.speed * (1 + (Math.random() - 0.5) * 0.05);
      if (cfg.pattern === 'doublering') { sp *= (i % 2 ? 0.78 : 1.08); forceColor = i % 2 ? cfg.b : cfg.a; }
    } else if (cfg.pattern === 'smiley') {
      let hx, hy;
      const r = Math.random();
      if (r < 0.52) { const a = Math.random() * Math.PI * 2; hx = Math.cos(a); hy = Math.sin(a); }
      else if (r < 0.78) { const side = r < 0.65 ? -1 : 1, a = Math.random() * Math.PI * 2; hx = side * 0.36 + Math.cos(a) * 0.11; hy = 0.34 + Math.sin(a) * 0.11; }
      else { const a = Math.PI * (1.15 + Math.random() * 0.7); hx = Math.cos(a) * 0.55; hy = Math.sin(a) * 0.55 - 0.05; }
      const lenS = Math.max(0.25, Math.hypot(hx, hy));
      dir = camX.clone().multiplyScalar(hx).add(camY.clone().multiplyScalar(hy)).add(camZ.clone().multiplyScalar((Math.random() - 0.5) * 0.08)).normalize();
      sp = cfg.speed * lenS;
    } else if (cfg.pattern === 'cube') {
      const ax3 = Math.floor(Math.random() * 3), sg = Math.random() < 0.5 ? -1 : 1;
      const pc = [Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1]; pc[ax3] = sg;
      const p3 = bx.clone().multiplyScalar(pc[0]).add(by.clone().multiplyScalar(pc[1])).add(bz.clone().multiplyScalar(pc[2]));
      dir = p3.clone().normalize(); sp = cfg.speed * p3.length() * 0.62;
    } else if (cfg.pattern === 'spiral') {
      const arm = Math.random() < 0.5 ? 0 : Math.PI, a4 = Math.random() * Math.PI * 4, r4 = 0.15 + 0.85 * (a4 / (Math.PI * 4));
      const px = Math.cos(a4 + arm) * r4, py = Math.sin(a4 + arm) * r4;
      dir = bx.clone().multiplyScalar(px).add(by.clone().multiplyScalar(py)).add(bz.clone().multiplyScalar((Math.random() - 0.5) * 0.14)).normalize();
      sp = cfg.speed * Math.max(0.25, Math.hypot(px, py));
    } else if (cfg.pattern === 'hollow') {
      dir = rndDir(); sp = cfg.speed;
    } else if (cfg.pattern === 'diadem') {
      dir = rndDir(); if (Math.random() < 0.28) { sp *= 0.13; forceColor = cfg.b; }
    } else if (cfg.pattern === 'halfhalf') {
      dir = rndDir(); forceColor = dir.dot(sectorAxis) > 0 ? cfg.a : cfg.b;
    } else if (cfg.pattern === 'heart' || cfg.pattern === 'star') {
      let hx, hy;
      if (cfg.pattern === 'heart') {
        const a = (i / cfg.stars) * Math.PI * 2;
        hx = 16 * Math.pow(Math.sin(a), 3) / 17;
        hy = (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 17;
      } else {
        const seg = i % 10, f = Math.random(), ang0 = seg * Math.PI / 5 - Math.PI / 2;
        const r0 = seg % 2 ? 0.42 : 1.0, r1 = (seg + 1) % 2 ? 0.42 : 1.0, ang1 = (seg + 1) * Math.PI / 5 - Math.PI / 2;
        hx = Math.cos(ang0) * r0 * (1 - f) + Math.cos(ang1) * r1 * f;
        hy = Math.sin(ang0) * r0 * (1 - f) + Math.sin(ang1) * r1 * f;
      }
      const len = Math.max(0.25, Math.hypot(hx, hy));
      dir = camX.clone().multiplyScalar(hx).add(camY.clone().multiplyScalar(hy)).add(camZ.clone().multiplyScalar((Math.random() - 0.5) * 0.08)).normalize();
      sp = cfg.speed * len;
    } else if (cfg.pattern === 'horsetail') {
      dir = rndDir(); dir.x *= 0.45; dir.z *= 0.45; dir.y = -(Math.abs(dir.y) * 0.75 + 0.15); dir.normalize(); sp *= 0.8 + Math.random() * 0.35;
    } else if (cfg.pattern === 'waterfall') {
      dir = rndDir(); sp = cfg.speed * (0.35 + Math.random() * 0.5);
    } else if (cfg.pattern === 'fan') {
      dir = new THREE.Vector3((Math.random() - 0.5) * 1.7, 0.35 + Math.random() * 0.95, (Math.random() - 0.5) * 1.7).normalize();
    } else if (cfg.pattern === 'mine') {
      dir = new THREE.Vector3((Math.random() - 0.5) * 0.55, 1, (Math.random() - 0.5) * 0.55).normalize(); sp *= 0.7 + Math.random() * 0.65;
    } else if (cfg.palm || cfg.pattern === 'palm') {
      const a = Math.random() * Math.PI * 2, up = 0.55 + Math.random() * 0.6;
      dir = new THREE.Vector3(Math.cos(a) * 0.8, up, Math.sin(a) * 0.8).normalize();
    } else {
      // Fibonacci golden-spiral sphere with slight organic jitter so 3D crowns have handcrafted symmetry & depth
      const golden = Math.PI * (3 - Math.sqrt(5));
      const fy = 1 - ((i + 0.5) / starN) * 2;
      const fr = Math.sqrt(Math.max(0, 1 - fy * fy));
      const theta = golden * i + (Math.random() - 0.5) * 0.14;
      dir = new THREE.Vector3(
        fr * Math.cos(theta) * asym.x + (Math.random() - 0.5) * 0.08,
        fy * asym.y + (Math.random() - 0.5) * 0.08,
        fr * Math.sin(theta) * asym.z + (Math.random() - 0.5) * 0.08
      ).normalize();
      // Handcrafted inner pistil / core bouquet on spherical shells for multi-layered 3D depth
      if (cfg.pattern === 'pistil' && i % 3 === 0) { sp *= 0.46; forceColor = cfg.b; }
      else if (cfg.pattern === 'double' && i % 2 === 0) { sp *= 0.58; forceColor = cfg.b; }
      else if (!cfg._sub && i % 5 === 0) { sp *= 0.52; forceColor = cfg.b || cfg.a; }
    }

    const v = dir.multiplyScalar(sp * velScale);
    if (['heart', 'star', 'smiley', 'cube', 'spiral', 'ring', 'doublering'].includes(cfg.pattern))
      v.addScaledVector(rndDir(), sp * velScale * 0.055);
    if (inherit) v.add(inherit);
    const minV = Math.max(2.8, cfg.speed * 0.16);
    if (v.lengthSq() < minV * minV) v.setLength(minV);

    const useB = Math.random() < 0.42;
    let base = (forceColor || (useB ? cfg.b : cfg.a) || (cfg.palette && cfg.palette[0]) || new THREE.Color('#ffffff')).clone();
    if (cfg.palette && !forceColor) base = cfg.palette[Math.floor(Math.random() * cfg.palette.length)].clone();
    if (cfg.split) base.copy(cfg.a);
    base.offsetHSL((Math.random() - 0.5) * 0.015, 0, (Math.random() - 0.5) * 0.08);

    const isPattern = ['heart', 'star', 'smiley', 'ring', 'doublering', 'cube', 'spiral'].includes(cfg.pattern);
    const isDust = !isPattern && !cfg._sub && Math.random() < 0.34;
    let starScale = 0.6 + Math.pow(Math.random(), 1.6) * 1.5;
    if (isDust) starScale = 0.32 + Math.random() * 0.25;
    if (isPattern) starScale = 0.45 + Math.random() * 0.25;
    const baseLife = cfg._sub ? cfg.life : Math.max(2.65, cfg.life * 1.28);
    let starLife = Math.min(4.85 * (cfg._lifeScale || 1), Math.max(0.8, baseLife * (0.72 + starScale * 0.42) * (0.88 + Math.random() * 0.28)) * Math.min(1.22, velScale));
    let starDrag = THREE.MathUtils.clamp(cfg.drag * (1.12 / (0.75 + starScale * 0.35)) * (0.94 + Math.random() * 0.12), 0.5, 1.8);
    if (isPattern) { starDrag = cfg.drag; starLife = cfg.life * (0.92 + Math.random() * 0.16) * Math.min(1.18, velScale); }
    let starBright = (0.8 + Math.random() * 0.7) * (0.85 + starScale * 0.25);
    if (isDust) {
      starDrag = 1.7 + Math.random() * 0.5;
      starBright = 0.35 + Math.random() * 0.25;
      starLife = Math.min(starLife * 1.15, cfg.life * 1.25);
      base.lerp(new THREE.Color(1, 1, 1), 0.6);
    }
    if (isDust && !isPattern) v.multiplyScalar(1.18);
    if (starLife > maxStarLife) maxStarLife = starLife;

    const off = dir.clone().multiplyScalar(Math.random() * (isPattern ? 0.15 : 1.1));
    for (let t = 0; t <= trails; t++) {
      pos.set([origin.x + off.x, origin.y + off.y, origin.z + off.z], ptr * 3);
      vel.set([v.x, v.y, v.z], ptr * 3);
      col.set([base.r, base.g, base.b], ptr * 3);
      misc.set([Math.random(), starLife, cfg.size * starScale, t], ptr * 4);
      delay[ptr] = Math.random() * 0.035;
      dragA[ptr] = starDrag;
      brightA[ptr] = starBright;
      ptr++;
    }
  }

  // Crackle cloud: synchronized with audio crackle window (0.48s .. 1.85s)
  let cracklePts = null;
  if (cfg.crackle) {
    const n = Math.round((cfg.crackleN || 240) * 1.35 * qualityScale);
    const cp = new Float32Array(n * 3);
    const cv = new Float32Array(n * 3);
    const cc = new Float32Array(n * 3);
    const cm = new Float32Array(n * 4);
    const cd = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      const d = new THREE.Vector3(s * Math.cos(th), u, s * Math.sin(th));
      const host = cfg.speed * (0.35 + Math.random() * 0.6);
      const cr = (cfg.speed / Math.max(cfg.drag, 0.4)) * 0.55 * Math.cbrt(Math.random());
      cp.set([origin.x + d.x * cr, origin.y + d.y * cr, origin.z + d.z * cr], i * 3);
      cv.set([d.x * host, d.y * host, d.z * host], i * 3);
      cc.set([1, 0.98, 0.92], i * 3);
      cm.set([Math.random(), 0.26 + Math.random() * 0.28, 0.95, 0], i * 4);
      cd[i] = 0.48 + Math.random() * 1.25;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(cp, 3));
    g.setAttribute('aVel', new THREE.BufferAttribute(cv, 3));
    g.setAttribute('aCol', new THREE.BufferAttribute(cc, 3));
    g.setAttribute('aMisc', new THREE.BufferAttribute(cm, 4));
    g.setAttribute('aDelay', new THREE.BufferAttribute(cd, 1));
    g.setAttribute('aDrag', new THREE.BufferAttribute(new Float32Array(n).fill(1.7), 1));
    g.setAttribute('aBright', new THREE.BufferAttribute(new Float32Array(n).fill(1), 1));
    cracklePts = g;
    maxStarLife = Math.max(maxStarLife, 2.1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aVel', new THREE.BufferAttribute(vel, 3));
  geo.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aMisc', new THREE.BufferAttribute(misc, 4));
  geo.setAttribute('aDelay', new THREE.BufferAttribute(delay, 1));
  geo.setAttribute('aDrag', new THREE.BufferAttribute(dragA, 1));
  geo.setAttribute('aBright', new THREE.BufferAttribute(brightA, 1));

  const mat = baseBurstMat.clone();
  mat.uniforms = makeBurstUniforms(cfg, spinAxis);
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  rootGroup.add(points);

  const parts = [{ geo, mat, points }];
  if (cracklePts) {
    const m2 = baseBurstMat.clone();
    m2.uniforms = makeBurstUniforms(cfg, spinAxis);
    const p2 = new THREE.Points(cracklePts, m2);
    p2.frustumCulled = false;
    rootGroup.add(p2);
    parts.push({ geo: cracklePts, mat: m2, points: p2 });
  }

  let smoke = null, smokeMat = null, sGeo = null;
  if (cfg._smoke && !cfg._sub) {
    const sGeo0 = new THREE.BufferGeometry();
    const sn = 12;
    const sp2 = new Float32Array(sn * 3);
    const sv = new Float32Array(sn * 3);
    for (let i = 0; i < sn; i++) {
      sp2.set([origin.x + (Math.random() - 0.5) * 3, origin.y + (Math.random() - 0.5) * 3, origin.z + (Math.random() - 0.5) * 3], i * 3);
      sv.set([(Math.random() - 0.5) * 2.4, (Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 2.4], i * 3);
    }
    sGeo0.setAttribute('position', new THREE.BufferAttribute(sp2, 3));
    sGeo0.setAttribute('aVel', new THREE.BufferAttribute(sv, 3));
    const smokeMat0 = baseSmokeMat.clone();
    smokeMat0.uniforms = {
      uAge: { value: 0 },
      uCol: { value: cfg.a || (cfg.palette && cfg.palette[0]) || new THREE.Color('#ffffff') },
      uMap: { value: sparkTex },
    };
    smoke = new THREE.Points(sGeo0, smokeMat0);
    smoke.frustumCulled = false;
    rootGroup.add(smoke);
    smokeMat = smokeMat0;
    sGeo = sGeo0;
  }

  const primaryColor = (cfg.a || (cfg.palette && cfg.palette[0]) || new THREE.Color('#ffc46b')).clone();
  let glowSprite = null, glowMat = null;
  if (!cfg._silent && !cfg._warm) {
    const flashMat = new THREE.SpriteMaterial({
      map: sparkTex, color: 0xfffaf0, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.92,
    });
    const flash = new THREE.Sprite(flashMat);
    flash.position.copy(origin);
    flash.scale.setScalar(5);
    rootGroup.add(flash);
    flashes.push({ sprite: flash, mat: flashMat, age: 0, maxR: cfg.speed * 0.72 * (cfg.flash || 1) });
    if (!cfg._sub) {
      const tintMat = new THREE.SpriteMaterial({
        map: sparkTex, color: primaryColor.getHex(), transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.75,
      });
      const tintFlash = new THREE.Sprite(tintMat);
      tintFlash.position.copy(origin);
      tintFlash.scale.setScalar(8);
      rootGroup.add(tintFlash);
      flashes.push({ sprite: tintFlash, mat: tintMat, age: 0, maxR: cfg.speed * 1.15 * (cfg.flash || 1), decay: 8.5 });

      // Sustained volumetric chemical aura sprite that glows with the stars throughout the burst
      glowMat = new THREE.SpriteMaterial({
        map: sparkTex,
        color: primaryColor.clone().lerp(new THREE.Color(0xffffff), 0.18).getHex(),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0.42,
      });
      glowSprite = new THREE.Sprite(glowMat);
      glowSprite.position.copy(origin);
      glowSprite.scale.setScalar(Math.min(22, cfg.speed * 0.85));
      rootGroup.add(glowSprite);
    }
  }

  // Exact visible burst lifetime matched to star burnout (3.2s - 5.2s so firework and newsplate shine together)
  const extraLife = cfg.split ? 1.35 : cfg.shells ? 1.15 : cfg._double ? 0.85 : 0.25;
  const burstLife = cfg._warm ? 0.05 : clamp((maxStarLife + extraLife) * (cfg._lifeScale || 1), 3.2, 5.2);
  const bId = cfg._id || ++nextBurstId;
  const burst = {
    id: bId, origin: origin.clone(), cfg, parts, smoke, smokeMat, sGeo,
    glowSprite, glowMat, primaryColor,
    age: 0, life: burstLife, splitDone: !cfg.split,
  };
  bursts.push(burst);

  const trueSpread = ((cfg.speed || 20) * velScale) / Math.max(0.45, cfg.drag || 1);
  if (!cfg._reported && !cfg._sub && !cfg._warm) {
    cfg._reported = true;
    const info = {
      id: bId,
      key: cfg._key,
      label: cfg.label,
      giant: (cfg.caliber || 1) >= 1.55,
      inches: Math.max(2, Math.round((cfg.caliber || 1) * 3)),
      life: burst.life,
      spread: trueSpread,
      origin: [origin.x, origin.y, origin.z],
      colors: shellColors(cfg),
    };
    if (typeof cfg._onBreak === 'function') {
      try { cfg._onBreak(info); } catch (e) {}
    }
    for (const fn of burstHooks) {
      try { fn(info); } catch (e) {}
    }
  }

  const dist = camera ? camera.position.distanceTo(origin) : 180;
  if (!cfg._warm && !cfg._silent) {
    if (cfg._sub) {
      playSubBreakSound(origin, dist, cfg._subIdx || 0);
    } else {
      boom(dist, cfg, origin);
    }
  }
  return burst;
}

function separateTarget(target) {
  const t = target.clone();
  const occupied = [
    ...shells.map((sh) => sh.target),
    ...bursts.filter((b) => b.age < 2.2 && !b.cfg?._warm).map((b) => b.origin),
  ];
  for (const o of occupied) {
    const d = t.distanceTo(o);
    if (d < 46) {
      const away = t.clone().sub(o);
      away.y = Math.max(away.y, 0);
      if (away.lengthSq() < 0.01) away.set(Math.random() - 0.5, 0.2, Math.random() - 0.5);
      away.normalize().multiplyScalar(46 - d + 2);
      t.add(away);
      t.x = THREE.MathUtils.clamp(t.x, -125, 125);
      t.y = THREE.MathUtils.clamp(t.y, 36, 94);
      t.z = THREE.MathUtils.clamp(t.z, -165, 55);
    }
  }
  return t;
}

function report(opts, cfg, key, classScale, origin, fuse, burstLife) {
  if (typeof opts.track !== 'function') return;
  try {
    opts.track({
      id: cfg._id,
      key,
      label: cfg.label,
      giant: classScale >= 1.6,
      inches: Math.max(2, Math.round(cfg.caliber * 3)),
      origin: [origin.x, origin.y, origin.z],
      fuse,
      burstLife,
      spread: (cfg.speed || 20) / Math.max(0.45, cfg.drag || 1),
      colors: shellColors(cfg),
    });
  } catch (e) {}
}

function shellColors(cfg) {
  const list = cfg.palette ? cfg.palette.slice(0, 4) : [cfg.a, cfg.b].filter(Boolean);
  return list.map((c) => '#' + c.getHexString());
}

function launch(target, typeKey, opts = {}) {
  const cfg0 = SHELLS[typeKey] || SHELLS.peony;
  const cfg = { ...cfg0 };
  cfg._key = typeKey;
  cfg._id = opts.id || ++nextBurstId;
  cfg._onBreak = opts.onBreak || null;

  const roll = Math.random();
  const classScale = opts.caliber
    ? clamp(opts.caliber, 0.75, 1.45) * (0.97 + Math.random() * 0.06)
    : roll < 0.60 ? 0.92 + Math.random() * 0.16 : roll < 0.88 ? 1.15 + Math.random() * 0.18 : 1.35 + Math.random() * 0.25;
  const className = classScale >= 1.35 ? 'GIANT CALIBRE' : classScale >= 1.15 ? 'LARGE CALIBRE' : '';
  cfg.caliber = clamp((cfg.caliber || 1) * classScale, 0.75, 1.65);
  if (classScale > 1.15) cfg.size = (cfg.size || 1.5) * (1 + (classScale - 1) * 0.35);

  target = target.clone();
  if (!opts.exact) target.y *= (0.94 + Math.random() * 0.12) * (classScale >= 1.35 ? 1.08 : 1);

  cfg.speed *= 0.94 + Math.random() * 0.12;
  cfg.life *= 0.92 + Math.random() * 0.16;
  cfg.stars = Math.round(cfg.stars * (0.9 + Math.random() * 0.2));
  if (opts.lifeScale && opts.lifeScale > 1) cfg._lifeScale = opts.lifeScale;

  cfg._double = !cfg.shells && !cfg.split && Math.random() < 0.14;
  if (!cfg.shift && Math.random() < 0.18) cfg.shift = ['#3f8cff', '#37e0a0', '#ff5a8a', '#c77dff'][Math.floor(Math.random() * 4)];
  if (!cfg.crackle && Math.random() < 0.12) { cfg.crackle = true; cfg.crackleN = 140; }
  cfg._wind = WIND.clone().multiplyScalar(0.4 + Math.random() * 1.1);

  const HEAVY = ['willow', 'giantWillow', 'brocade', 'kamuro', 'webWillow', 'fallingLeaves', 'palm', 'coconut', 'horsetail', 'waterfall'];
  cfg._smoke = opts.smoke ?? (HEAVY.includes(typeKey) ? Math.random() < 0.85 : Math.random() < 0.28);
  const inches = Math.max(2, Math.round(cfg.caliber * 3));
  const infoEl = document.getElementById('shellInfo');
  if (infoEl) {
    infoEl.textContent = cfg.label.toUpperCase() + ' · ' + inches + '-INCH' +
      (className ? ' · ' + className : '') +
      (cfg._double ? ' · DOUBLE BREAK' : '') +
      (cfg.shells ? ' · SHELL OF SHELLS' : '') + ' — ' + cfg.desc;
  }

  if (cfg.pattern === 'mine') {
    makeBurst(new THREE.Vector3(target.x * 0.85, 1, target.z * 0.85), cfg, cfg.caliber || 1);
    return cfg;
  }
  if (cfg.pattern === 'candle') {
    const cOrigin = new THREE.Vector3(target.x * 0.85, 22, target.z * 0.85);
    report(opts, cfg, typeKey, classScale, cOrigin, 0.06, 3.6);
    const cols = [cfg.a, cfg.b, new THREE.Color('#ffd23c'), new THREE.Color('#3f8cff')];
    for (let k = 0; k < 6; k++) {
      scheduleTimeout(() => {
        const subPos = new THREE.Vector3(target.x * 0.85 + (Math.random() - 0.5) * 4, 16 + k * 8.5, target.z * 0.85 + (Math.random() - 0.5) * 4);
        makeBurst(
          subPos,
          { ...cfg, pattern: 'sphere', a: cols[k % cols.length], _reported: k > 0, _sub: k > 0, _subIdx: k },
          (cfg.caliber || 1) * 0.78
        );
      }, k * 460);
    }
    return cfg;
  }

  if (!opts.exact) target = separateTarget(target);
  const mortar = new THREE.Vector3(target.x * 0.88 + (Math.random() - 0.5) * 4, 0, target.z * 0.92 + (Math.random() - 0.5) * 4);
  const fuse = clamp(opts.fuse ?? (1.08 + Math.random() * 0.24), 0.75, 1.55);
  const vy = (target.y - mortar.y + 0.5 * G * fuse * fuse) / fuse;
  const vel = new THREE.Vector3((target.x - mortar.x) / fuse, vy, (target.z - mortar.z) / fuse);
  const bp = target.clone();
  report(opts, cfg, typeKey, classScale, bp, fuse, 3.6 * (cfg._lifeScale || 1));

  const N = 108;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(N), 1));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(N), 1));

  const launchCol = (cfg.a || (cfg.palette && cfg.palette[0]) || new THREE.Color('#ffc46b')).clone().lerp(new THREE.Color(1, 0.88, 0.66), 0.42);
  const mat = baseLaunchMat.clone();
  mat.uniforms = { uCol: { value: launchCol } };
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  rootGroup.add(pts);

  const fm = new THREE.SpriteMaterial({
    map: sparkTex, color: launchCol.getHex(), transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9,
  });
  const fs = new THREE.Sprite(fm);
  fs.position.copy(mortar);
  fs.position.y = 1.2;
  fs.scale.setScalar(2);
  rootGroup.add(fs);
  flashes.push({ sprite: fs, mat: fm, age: 0, maxR: 8 });

  shells.push({
    pos: mortar.clone(), vel, target: target.clone(), cfg, geo, mat, pts,
    debris: [], age: 0, fuse, trunk: cfg.pattern === 'palm',
  });
  const dist = camera ? camera.position.distanceTo(mortar) : 180;
  playLaunchSound(mortar, cfg, fuse, dist);
  return cfg;
}

/* ── Embed Engine (Shared Host Scene OR Standalone Fallback) ─────────────── */
function init(opts = {}) {
  preloadRawAudio();
  if (opts.scene && opts.camera) {
    if (!rootGroup) rootGroup = new THREE.Group();
    if (scene !== opts.scene) {
      if (scene && rootGroup.parent === scene) scene.remove(rootGroup);
      scene = opts.scene;
      scene.add(rootGroup);
    }
    camera = opts.camera;
    hostMode = true;
    externalLoop = !!opts.externalLoop;
    if (!clock) clock = new THREE.Clock();
    inited = true;
    return;
  }
  if (inited) return;
  inited = true;
  hostMode = false;
  const cv = document.createElement('canvas');
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:' + (opts.zIndex ?? 9999);
  cv.style.mixBlendMode = 'screen';
  document.body.appendChild(cv);
  renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  scene = new THREE.Scene();
  rootGroup = new THREE.Group();
  scene.add(rootGroup);
  camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.5, 2000);
  camera.position.set(0, 30, 150);
  camera.lookAt(0, 40, 0);
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.65, 0.32, 0.45);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  clock = new THREE.Clock();
  addEventListener('resize', () => {
    if (hostMode) return;
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
  });
  animate();
}

function step(rawDt) {
  if (!inited || paused) return;
  const dt = Math.min(rawDt ?? (clock ? clock.getDelta() : 0.016), 0.05);
  const t = clock ? clock.elapsedTime : performance.now() / 1000;

  if (!hostMode && view && camera) {
    camera.position.copy(view.pos);
    camera.lookAt(view.tgt);
    if (Math.abs(camera.fov - view.fov) > 0.01) {
      camera.fov = view.fov;
      camera.updateProjectionMatrix();
    }
  }

  for (let i = flashes.length - 1; i >= 0; i--) {
    const f = flashes[i];
    f.age += dt;
    if (f.age < 0) { f.mat.opacity = 0; continue; }
    const k = f.decay || 18;
    f.sprite.scale.setScalar(3 + f.maxR * (1 - Math.exp(-f.age * 14)));
    f.mat.opacity = 0.92 * Math.exp(-f.age * k);
    if (f.age > (f.decay ? 0.52 : 0.32)) {
      rootGroup.remove(f.sprite);
      f.mat.dispose();
      flashes.splice(i, 1);
    }
  }

  for (let i = shells.length - 1; i >= 0; i--) {
    const s = shells[i];
    s.vel.y -= G * dt;
    s.pos.addScaledVector(s.vel, dt);
    s.pos.x += Math.sin(s.pos.y * 0.35 + s.target.x) * 0.006;
    s.pos.z += Math.cos(s.pos.y * 0.3 + s.target.z) * 0.006;
    for (let n = 0; n < 3 && s.debris.length < 85; n++) {
      s.debris.push({
        p: s.pos.clone(),
        v: new THREE.Vector3((Math.random() - 0.5) * 1.2, -Math.random() * 1.5, (Math.random() - 0.5) * 1.2),
        age: 0,
        life: 0.18 + Math.random() * 0.24,
        size: 0.7 + Math.random() * 0.7,
      });
    }
    const pa = s.geo.attributes.position.array;
    const sa = s.geo.attributes.aSize.array;
    const aa = s.geo.attributes.aAlpha.array;
    pa.set([s.pos.x, s.pos.y, s.pos.z], 0);
    sa[0] = s.trunk ? 5.2 : 2.9;
    aa[0] = 1;
    for (let j = 1; j < 108; j++) {
      const d = s.debris[j - 1];
      if (!d) {
        aa[j] = 0;
        pa.set([s.pos.x, s.pos.y, s.pos.z], j * 3);
        continue;
      }
      d.age += dt;
      d.v.y -= G * 0.55 * dt;
      d.p.addScaledVector(d.v, dt);
      pa.set([d.p.x, d.p.y, d.p.z], j * 3);
      sa[j] = d.size;
      aa[j] = Math.max(0, 1 - d.age / d.life) * 0.7;
    }
    s.debris = s.debris.filter((d) => d.age < d.life);
    s.geo.attributes.position.needsUpdate = true;
    s.geo.attributes.aSize.needsUpdate = true;
    s.geo.attributes.aAlpha.needsUpdate = true;
    s.age += dt;
    if (s.age >= s.fuse) {
      makeBurst(s.pos.clone(), s.cfg, s.cfg.caliber || 1, s.vel.clone().multiplyScalar(0.08));
      if (s.cfg.shells) {
        const bp2 = s.pos.clone();
        const n2 = s.cfg.shells;
        for (let q = 0; q < n2; q++) {
          scheduleTimeout(() => {
            makeBurst(
              bp2.clone().add(new THREE.Vector3((Math.random() - 0.5) * 26, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 26)),
              { ...s.cfg, shells: 0, _double: false, stars: 260, pattern: 'sphere', _reported: true, _sub: true, _subIdx: q },
              (s.cfg.caliber || 1) * 0.52
            );
          }, 460 + q * 45 + Math.random() * 90);
        }
      }
      if (s.cfg._double) {
        const bp = s.pos.clone();
        const bc = { ...s.cfg, _double: false, crackle: false, stars: Math.round(s.cfg.stars * 0.45), _reported: true, _sub: true, _subIdx: 1 };
        scheduleTimeout(() => {
          makeBurst(
            bp.clone().add(new THREE.Vector3((Math.random() - 0.5) * 10, -3 - Math.random() * 4, (Math.random() - 0.5) * 10)),
            bc,
            (bc.caliber || 1) * 0.62
          );
        }, 380 + Math.random() * 220);
      }
      rootGroup.remove(s.pts);
      s.geo.dispose();
      s.mat.dispose();
      shells.splice(i, 1);
    }
  }

  for (let i = bursts.length - 1; i >= 0; i--) {
    const b = bursts[i];
    b.age += dt;
    b.parts.forEach((p) => {
      p.mat.uniforms.uAge.value = b.age;
      p.mat.uniforms.uTime.value = t;
    });
    if (b.glowSprite && b.glowMat) {
      const lr = clamp(b.age / Math.max(0.1, b.life), 0, 1);
      const expand = 1.0 + 1.35 * (1.0 - Math.exp(-b.age * 2.2));
      b.glowSprite.scale.setScalar(Math.min(28, (b.cfg.speed || 22) * 0.95 * expand));
      b.glowSprite.position.y = b.origin.y - b.age * 1.2;
      const env = Math.sin(Math.min(1, b.age / 0.14) * Math.PI * 0.5) * Math.pow(Math.max(0, 1 - lr), 1.45);
      b.glowMat.opacity = 0.26 * env;
    }
    if (b.smokeMat) {
      b.smokeMat.uniforms.uAge.value = b.age;
      if (b.smokeGone || b.age > 3.2) {
        rootGroup.remove(b.smoke);
        b.smokeMat.dispose();
        b.smoke = null;
        b.smokeMat = null;
        b.smokeGone = true;
      }
    }
    if (b.cfg.split && !b.splitDone && b.age > 0.95) {
      b.splitDone = true;
      const dist = camera ? camera.position.distanceTo(b.origin) : 180;
      playCrossetteSplitSound(b.origin, dist);
      for (let s = 0; s < 4; s++) {
        const a = (s / 4) * Math.PI * 2;
        const c = new THREE.Vector3(Math.cos(a), 0.35, Math.sin(a)).multiplyScalar(
          b.cfg.speed * 0.55 * (1 - Math.exp(-b.cfg.drag * 0.95)) / b.cfg.drag
        );
        makeBurst(
          b.origin.clone().add(c),
          {
            ...SHELLS.peony, a: b.cfg.a, stars: 130, trails: 1, trailDt: 0.03,
            life: 1.3, speed: 12, speedSd: 1.6, size: 1.4,
            _reported: true, _sub: true, _silent: true,
          },
          0.8
        );
      }
    }
    if (b.age > b.life) {
      b.parts.forEach((p) => {
        rootGroup.remove(p.points);
        p.geo.dispose();
        p.mat.dispose();
      });
      if (b.glowSprite) {
        rootGroup.remove(b.glowSprite);
        b.glowMat.dispose();
        b.glowSprite = null;
      }
      if (b.smoke) {
        rootGroup.remove(b.smoke);
        b.smokeMat.dispose();
      }
      if (b.sGeo) b.sGeo.dispose();
      bursts.splice(i, 1);
    }
  }
}

function animate() {
  if (externalLoop) return;
  requestAnimationFrame(animate);
  if (paused) return;
  const dt = clock ? Math.min(clock.getDelta(), 0.05) : 0.016;
  step(dt);
  if (!hostMode && composer && renderer) {
    if (shells.length || bursts.length || flashes.length) {
      idleCleared = false;
      composer.render();
    } else if (!idleCleared) {
      renderer.clear();
      idleCleared = true;
    }
  }
}

let warmed = false;
function warm() {
  init();
  ensureAudio();
  if (warmed) return;
  warmed = true;
  try {
    makeBurst(
      new THREE.Vector3(0, -4000, 0),
      { ...SHELLS.peony, stars: 6, trails: 0, life: 0.04, palette: null, _warm: true, _reported: true, _silent: true, _smoke: false },
      0.18
    );
  } catch (e) {}
}

function randomKey() {
  return SHELL_KEYS[Math.floor(Math.random() * SHELL_KEYS.length)];
}

function blast(type, opts = {}) {
  init();
  ensureAudio();
  const key = (!type || type === 'random' || !SHELLS[type]) ? randomKey() : type;
  const cfg = SHELLS[key];
  const x = opts.x ?? (Math.random() - 0.5) * 170;
  const z = opts.z ?? (Math.random() - 0.5) * 80 - 10;
  const y = opts.y ?? (cfg.h[0] + Math.random() * (cfg.h[1] - cfg.h[0])) + 26;
  const launchedCfg = launch(new THREE.Vector3(x, y, z), key, opts);
  return {
    id: launchedCfg._id,
    key,
    label: cfg.label,
    inches: Math.max(2, Math.round((launchedCfg.caliber || 1) * 3)),
  };
}

function celebrate(n = 4, gapMs = 380) {
  const used = [];
  for (let i = 0; i < n; i++) scheduleTimeout(() => used.push(blast()), i * gapMs);
  return used;
}

const NewsFireworks = {
  init,
  warm,
  blast,
  celebrate,
  step,
  setView(pos, tgt, fov) {
    view = view || { pos: new THREE.Vector3(), tgt: new THREE.Vector3(), fov: 46 };
    view.pos.set(pos.x, pos.y, pos.z);
    view.tgt.set(tgt.x, tgt.y, tgt.z);
    view.fov = fov || 46;
  },
  clearView() { view = null; },
  onBurst(fn) {
    if (typeof fn === 'function') burstHooks.push(fn);
    return () => {
      const i = burstHooks.indexOf(fn);
      if (i >= 0) burstHooks.splice(i, 1);
    };
  },
  setSound(v) {
    soundOn = !!v;
    if (masterGain && actx) {
      masterGain.gain.setTargetAtTime(soundOn ? masterVol : 0, actx.currentTime, 0.04);
    }
  },
  setVolume(v) {
    masterVol = clamp(v, 0, 1);
    if (masterGain && actx) {
      masterGain.gain.setTargetAtTime(soundOn ? masterVol : 0, actx.currentTime, 0.04);
    }
  },
  setPaused(p) {
    paused = !!p;
    if (rootGroup) rootGroup.visible = !paused;
    if (actx) {
      if (paused && actx.state === 'running') actx.suspend?.().catch(() => {});
      else if (!paused && actx.state === 'suspended') actx.resume?.().catch(() => {});
    }
  },
  setQuality(q) {
    qualityScale = clamp(q, 0.45, 1.0);
  },
  burning() {
    return bursts
      .filter((b) => !b.cfg?._warm && !b.cfg?._sub)
      .map((b) => ({
        id: b.id,
        x: b.origin.x,
        y: b.origin.y,
        z: b.origin.z,
        age: b.age,
        life: b.life,
        color: b.primaryColor ? [b.primaryColor.r, b.primaryColor.g, b.primaryColor.b] : [1, 0.78, 0.42],
        spread: ((b.cfg?.speed || 22) * clamp(b.cfg?.caliber || 1, 0.7, 1.4)) / Math.max(0.45, b.cfg?.drag || 1),
      }));
  },
  activeTargets() {
    const out = [];
    for (const s of shells) {
      out.push({
        kind: 'shell',
        id: s.cfg?._id || 0,
        x: s.pos.x,
        y: s.pos.y,
        z: s.pos.z,
        targetX: s.target.x,
        targetY: s.target.y,
        targetZ: s.target.z,
        age: s.age,
        life: Math.max(0.1, s.fuse),
        progress: clamp(s.age / Math.max(0.1, s.fuse), 0, 1),
      });
    }
    for (const b of bursts) {
      if (b.cfg?._warm || b.cfg?._sub) continue;
      out.push({
        kind: 'burst',
        id: b.id,
        x: b.origin.x,
        y: b.origin.y,
        z: b.origin.z,
        age: b.age,
        life: Math.max(0.1, b.life),
        progress: clamp(b.age / Math.max(0.1, b.life), 0, 1),
        spread: ((b.cfg?.speed || 22) * clamp(b.cfg?.caliber || 1, 0.7, 1.4)) / Math.max(0.45, b.cfg?.drag || 1),
      });
    }
    return out;
  },
  types: SHELL_KEYS.slice(),
  palette(key) { const c = SHELLS[key]; return c ? shellColors(c) : ['#ffc46b']; },
  spread(key) { const c = SHELLS[key]; return c ? (c.speed || 20) / Math.max(0.45, c.drag || 1) : 22; },
  labels: Object.fromEntries(SHELL_KEYS.map((k) => [k, SHELLS[k].label])),
};

export default NewsFireworks;
if (typeof window !== 'undefined') window.NewsFireworks = NewsFireworks;
