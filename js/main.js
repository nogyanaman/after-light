/* ============================================================================
   AFTER LIGHT · main.js
   Orchestrator: Stage 1 threshold → Stage 2 descent → Stage 3 the sky →
   Stage 4 HUD.
   - Preloads NewsFireworks at boot so the original .ogg firework recordings
     unlock on the very first click
   - Clean 3D celestial & constellation choreography across the 4 scroll messages
   - Clean four-corner Main Screen HUD with live firework processing bar,
     FPS-reactive + continuously flowing sparkline, and extended news summaries
   ========================================================================== */
import * as THREE from 'three';
import { TOKENS, CREATOR, deviceTier, prefersReducedMotion, clamp, lerp, smoothstep, rand } from './tokens.js';
import { ARCHETYPES, ARCHETYPE_BY_ID, pickArchetype } from './archetypes.js';
import { Stage } from './stage.js';
import { FireworkSystem } from './fireworks.js';
import { AudioEngine } from './audio.js';
import { LiveStream } from './wikipedia.js';
import { PatternField } from './patterns.js';
import { CalloutLayer } from './callouts.js';
import { Threshold } from './loader.js';
import {
  bindNewsStage,
  fireNewsShell,
  setNewsSound,
  setNewsVolume,
  setNewsPaused,
  setNewsQuality,
  loadNewsFireworks,
  latestShot,
  bestCameraTarget,
  activeLights,
  syncNewsCamera,
  updateNewsPlates,
} from './news-fx.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

/* ───────────────────────────── editorial lexicon ───────────────────────── */
const LENS = {
  'CONFLICT & FRONTLINES': {
    color: '#D94B58',
    words: ['war','conflict','strike','attack','offensive','battle','military',
      'missile','drone','shelling','airstrike','frontline','siege','invasion','rebel','militant',
      'insurgency','coup','gunfire','shooting','massacre','terrorist','armed','troops','soldier',
      'genocide','ceasefire','killing','killed in','warfare','bombing'],
  },
  'EARTH & CATACLYSM': {
    color: '#3FBF7F',
    words: ['earthquake','flood','floods','wildfire','hurricane','typhoon',
      'cyclone','tornado','storm','volcano','eruption','tsunami','landslide','avalanche','drought',
      'cold wave','heat wave','winter of','storm season','cyclone season','blizzard','glacial',
      'famine','epidemic','pandemic','outbreak','heatwave','blizzard','monsoon','disaster','quake',
      'wildfires','fires','climate','contamination','leak','spill','collapse of a dam'],
  },
  'SUDDEN TRAGEDY': {
    color: '#F2764B',
    words: ['crash','collision','derail','derailment','sinking','capsized',
      'explosion','fire at','accident','plane','airliner','flight','train','rail','ferry','ship',
      'bus','mine','building collapse','bridge collapse','drain','industrial','gas','chemical',
      'tragedy','disaster at','incident'],
  },
  'NOTABLE PASSINGS': {
    color: '#DCE8E2',
    words: ['dies','died','death of','death','obituary','obit','passing',
      'passes away','deaths in','funeral','mourning','killed','assassinated','suicide','d.]'],
  },
};

const REJECT = [
  /^(list of|deaths in|timeline of|prelude to|outline of|index of|glossary of)/i,
  /\b(world series|super bowl|world cup|championship|grand prix|tour de|album|single|concert tour|film|episode|season premiere|election|referendum|opinion poll|by-election)\b/i,
  /\b(military exercise|training exercise|naval exercise|war game)\b/i,
  /\b(banking crisis|financial crisis|debt crisis|budget|trade deficit)\b/i,
  /\(disambiguation\)/i,
];

const BAD = /earthquake|flood|wildfire|\bfire\b|hurricane|typhoon|cyclone|tornado|tsunami|landslide|avalanche|volcan|eruption|drought|famine|epidemic|outbreak|pandemic|heatwave|heat wave|cold wave|blizzard|monsoon|oil spill|dam collapse|collapse|derail|capsiz|\bsank\b|sinking|explosion|\bblast\b|airstrike|air strike|shelling|missile|massacre|invasion|offensive|\bbattle\b|\bwar\b|wars\b|conflict|ceasefire|insurgent|militant|attack|shooting|\bkilled\b|\bdeaths?\b|\bdied\b|\bdies\b|\bdead\b|casualt|\btoll\b|disaster|fatalit|injur|\bstruck\b|evacuat|emergency|tragedy|wreck|\bquake\b|\bstorm\b|surge|fatal crash|loss of life|missing/i;
const isBadNews = (title, summary) => BAD.test(`${title} ${summary}`);

function isRecent(title, summary, seedLens) {
  const years = [...(title + ' ' + summary).matchAll(/\b(19|20)\d{2}\b/g)].map(m => +m[0]);
  if (years.some(y => y >= 2025)) return true;
  if (/\b(ongoing|since (january|february|march|april|may|june|july|august|september|october|november|december) 20\d\d)\b/i.test(summary || '')) return true;
  if (seedLens === 'NOTABLE PASSINGS') {
    const lead = (summary || '').split('.')[0];
    if (/\b(was an?|was the|were an?|served as)\b/i.test(lead) &&
        !/\b(is an?|is the|are an?|serves as)\b/i.test(lead)) return true;
  }
  return false;
}

function classify(title, summary, seedLens) {
  const t = title.toLowerCase();
  const s = (summary || '').toLowerCase();
  if (/\(\s*(d\.|died|death)/.test(title) || /^deaths in |^list of deaths/.test(t)) return 'NOTABLE PASSINGS';
  let best = null, bestScore = 0;
  for (const key of Object.keys(LENS)) {
    const cfg = LENS[key];
    let score = 0;
    for (const w of cfg.words) {
      if (t.includes(w)) score += 3;
      if (s.includes(w)) score += 1;
    }
    if (lensBoost(key, t, s)) score += 4;
    if (score > bestScore) { bestScore = score; best = key; }
  }
  if (!best || bestScore < 3) best = (seedLens && LENS[seedLens]) ? seedLens : 'SUDDEN TRAGEDY';
  return best;
}
function lensBoost(key, t, s) {
  if (key === 'NOTABLE PASSINGS') return /\bdies\b|\bdied\b|\bdeath\b|obituar|\bage of \d+/.test(t + ' ' + s);
  if (key === 'EARTH & CATACLYSM') return /earthquake|flood|wildfire|hurricane|typhoon|cyclone|avalanche|outbreak|epidemic/.test(t + ' ' + s);
  if (key === 'CONFLICT & FRONTLINES') return /war\b|airstrike|shelling|massacre|invasion|frontline/.test(t + ' ' + s);
  if (key === 'SUDDEN TRAGEDY') return /\bcrash|derail|capsiz|sank|explosion|collision/.test(t + ' ' + s);
  return false;
}
const CACHE_KEY = 'afterlight.corpus.v1';

const lensColor = (l) => (LENS[l] ? LENS[l].color : TOKENS.ember);

/* Retain up to 2 sentences (~340 chars) so the news summary is fuller and more visible */
function oneSentence(text) {
  if (!text) return '';
  let s = text.replace(/\s+/g, ' ').trim();
  s = s.replace(/^(This article|This is a list).*?\.\s*/i, '');
  s = s.replace(/\s*\((?![^)]*d\.)[^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
  const sentences = s.match(/[^.!?]+[.!?]+(?=\s|$)/g);
  if (sentences && sentences.length) {
    let combined = sentences[0].trim();
    if (sentences.length > 1 && combined.length < 210) {
      const next = sentences[1].trim();
      if ((combined + ' ' + next).length <= 345) {
        combined = combined + ' ' + next;
      }
    }
    s = combined;
  }
  if (s.length > 340) s = s.slice(0, 337).replace(/\s+\S*$/, '') + '…';
  return s;
}
const cleanTitle = (t) => t.replace(/\s*\([^)]*\)$/, '').replace(/_/g, ' ').trim();

const CHAPTER_STOPS = [0.11, 0.365, 0.62, 0.865];

/* ───────────────────────────────── the app ─────────────────────────────── */
class Interspace {
  constructor() {
    const q = new URLSearchParams(location.search);
    this.tier = q.get('tier') || deviceTier();
    this.reduced = prefersReducedMotion();
    this.state = 'THRESHOLD';
    this.paused = false;
    this.dispatches = [];
    this.live = [];
    this._recentDispatchIds = [];
    this.lens = 'ALL';
    this.lastInput = performance.now();
    this.fps = 60; this.frames = 0; this.fpsAcc = 0; this.fpsWall = performance.now(); this._gaps = [];
    this._fpsWaveHist = new Array(34).fill(0);
    this.elapsed = 0; this.lastT = performance.now();
    this.nextLaunchAt = 0;
    this._shotSeq = 0;
    this._activeShot = null;
    this._lastFireAt = 0;
    this.running = false;
    this._descentPointer = { x: 0, y: 0 };
    this.audio = new AudioEngine();
    this.audio.prime();
    this.callouts = new CalloutLayer($('#callouts'));
    this.boot();
  }

  /* ─────────────────────────── stage 0 · boot ──────────────────────────── */
  async boot() {
    const t0 = performance.now();
    const tick = () => new Promise(r => setTimeout(() => requestAnimationFrame(r), 0));
    await tick(); await tick();
    const check = async (id, fn, budget = 2400) => {
      this.threshold?.setCheck(id, 'active', 'checking…');
      await tick();
      const s = performance.now();
      let detail = '', ok = true;
      try {
        const late = new Promise((_, rej) => setTimeout(() => rej(new Error('budget')), budget));
        detail = (await Promise.race([fn(), late])) || `${(performance.now() - s).toFixed(1)} ms`;
      } catch (e) {
        ok = false;
        detail = e?.message === 'budget' ? 'timeout' : 'fallback';
        if (e?.message !== 'budget') console.warn('[boot]', id, e);
      }
      this.threshold?.setCheck(id, ok ? 'ok' : 'warn', detail);
      await tick();
      return ok;
    };

    this.threshold = new Threshold({
      onIgnite: (ev) => this.ignite(ev),
      onSkip: () => { this.ignited = true; this.stage?.clearHoverConstellation(); this.skip(); },
      onAimMove: (nx, ny) => this.stage?.updateHoverConstellation(nx, ny),
      onAimLeave: () => this.stage?.clearHoverConstellation(),
    });

    await check('device', () => {
      const cores = navigator.hardwareConcurrency || '?';
      const dpr = (window.devicePixelRatio || 1).toFixed(1).replace(/\.0$/, '');
      return `${cores}t · ${window.innerWidth}×${window.innerHeight}@${dpr}x`;
    });

    await check('webgl', () => {
      const s = performance.now();
      this.initGraphics();
      const gl2 = this.stage.renderer.capabilities.isWebGL2 ? 'gl2' : 'gl1';
      const slots = (this.fx.pool.count / 1000).toFixed(0);
      return `${gl2} · ${slots}k · ${(performance.now() - s).toFixed(0)}ms`;
    });

    await check('shaders', () => {
      const s = performance.now();
      this.stage.renderer.compile(this.stage.scene, this.stage.camera);
      const ms = (performance.now() - s).toFixed(1);
      const progs = this.stage.renderer.info?.programs?.length;
      this.lastT = performance.now();
      if (!this.running) this.startLoop();
      requestAnimationFrame(() => $('#sky')?.classList.add('is-lit'));
      return progs ? `${progs} prog · ${ms}ms` : `${ms}ms`;
    });

    await check('audio', async () => {
      this.audio.warm();
      await loadNewsFireworks().then(() => {
        bindNewsStage(this.stage);
        setNewsSound(!this.audio.muted);
        setNewsVolume(this.audio.volume);
      }).catch(() => {});
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return 'no webaudio';
      const tmp = this.audio.ctx || new AC();
      const sr = tmp.sampleRate ? (tmp.sampleRate / 1000).toFixed(1).replace(/\.0$/, '') + 'kHz' : 'pcm';
      if (!this.audio.ctx) tmp.close?.().catch?.(() => {});
      return `${sr} · ready`;
    });

    await check('archive', async () => {
      const s = performance.now();
      await this.loadArchive();
      return `${this.dispatches.length} docs · ${(performance.now() - s).toFixed(1)}ms`;
    });

    await check('stream', () => {
      this.openStream();
      this.pattern = new PatternField(this.stage.camera);
      this.pattern.show(false);
      this.stage.onResizeExtra = () => this.pattern?.resize();
      const sse = 'EventSource' in window ? 'sse' : 'cached';
      return `${sse} · ${this.pattern.count} vtx`;
    });

    this.registerProbes();
    const total = ((performance.now() - t0) / 1000).toFixed(2);
    this.threshold.finish(total, ARCHETYPES.length, this.dispatches.length);
    if (!this.running) this.startLoop();
    if (this._pendingSkip) {
      this._pendingSkip = false;
      this.enterSky({ fromSkip: true });
    } else if (this._pendingIgnite) {
      const ev = this._pendingIgnite === true ? null : this._pendingIgnite;
      this._pendingIgnite = null;
      this.ignite(ev);
    }
  }

  registerProbes() {
    const T = this.threshold;
    if (!T) return;
    const gl = () => this.stage?.renderer?.getContext?.() || null;
    T.si = T.sources.length;

    T.addSource(() => {
      const r = this.stage?.renderer;
      const c = gl();
      if (!r || !c) return null;
      const dbg = c.getExtension('WEBGL_debug_renderer_info');
      const name = dbg ? c.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : null;
      const tex = c.getParameter(c.MAX_TEXTURE_SIZE);
      const units = c.getParameter(c.MAX_TEXTURE_IMAGE_UNITS);
      const chip = name ? String(name).replace(/^ANGLE \(|\)$/g, '').split(',')[0].slice(0, 26) : '';
      return `${r.capabilities.isWebGL2 ? 'gl2' : 'gl1'} · ${tex}px tex · ${units} samplers${chip ? ' · ' + chip : ''}`;
    });
  }

  initGraphics() {
    this.stage = new Stage($('#sky'), this.tier);
    this.fx = new FireworkSystem(this.stage.scene, { tier: this.tier });
    this.fx.onBreak = (b) => this.onBreak(b);
    this.fx.onLaunch = (b) => this.audio.launch(b, this.stage.camera.position);
    this.stage.fx = this.fx;
    bindNewsStage(this.stage);
    this.archetypeCount = ARCHETYPES.length;
    this.bloomBoost = 0;
    window.__INTERSPACE__ = this;
  }

  async loadArchive() {
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 3500);
      let r;
      try {
        r = await fetch('./data/dispatches.seed.json', { cache: 'force-cache', signal: ac.signal });
      } finally { clearTimeout(t); }
      if (!r.ok) throw new Error(r.status);
      const raw = await r.json();
      this.dispatches = raw.map((d, i) => this.normalize(d, i)).filter(Boolean);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(raw)); } catch {}
      this.archiveSource = 'fetched';
    } catch (e) {
      let restored = 0;
      try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
        if (Array.isArray(cached) && cached.length) {
          this.dispatches = cached.map((d, i) => this.normalize(d, i)).filter(Boolean);
          restored = this.dispatches.length;
        }
      } catch {}
      if (!restored) {
        console.warn('[archive] using inline fallback', e);
        this.dispatches = FALLBACK.map((d, i) => this.normalize(d, i)).filter(Boolean);
        this.archiveSource = 'inline';
      } else {
        this.archiveSource = 'local cache';
      }
    }
    this.syncNote = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC · cached archive';
    this.renderArchive();
  }

  normalize(d, i) {
    if (!d || !d.title) return null;
    const title = cleanTitle(d.title);
    if (!title) return null;
    const sum = oneSentence(d.summary || '');
    if (sum.length < 40) return null;
    if (REJECT.some(re => re.test(title) || re.test(sum))) return null;
    if (!isRecent(title, sum, d.lens)) return null;
    const lens = classify(title, sum, d.lens);
    const saysDeath = /\bdied\b|\bdies\b|\bdeath\b|\bkilled\b|assassinat|murder|passed away|found dead|fatal/i.test(title + ' ' + sum);
    if (!(isBadNews(title, sum) || (lens === 'NOTABLE PASSINGS' && saysDeath))) return null;
    return {
      id: 'd' + i + '-' + title.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 18),
      title, summary: sum, url: d.url || ('https://en.wikipedia.org/wiki/' + encodeURIComponent(d.title.replace(/ /g, '_'))),
      lens,
      seed: Math.random(), at: null,
    };
  }

  openStream() {
    this.stream = new LiveStream({
      onDispatch: (d) => this.addDispatch(d),
      onStatus: (s) => { this.streamStatus = s; this.paintSync(); },
    });
    this.stream.connect();
  }

  addDispatch(raw) {
    const n = this.normalize(raw, this.dispatches.length + Math.floor(Math.random() * 1e6));
    if (!n) return false;
    if (this.dispatches.some(d => d.title.toLowerCase() === n.title.toLowerCase())) return false;
    this.dispatches.unshift(n);
    if (this.dispatches.length > 420) this.dispatches.length = 420;
    n.at = performance.now();
    this.renderArchive();
    this.paintSync();
    this.toast('LIVE DISPATCH · ' + n.lens.toLowerCase());
    if (this.state === 'SKY' && !this.paused && !document.hidden) {
      const nowWall = Date.now();
      if (nowWall - (this._lastLiveWall || 0) > 2400) {
        this._lastLiveAt = this.elapsed;
        this._lastLiveWall = nowWall;
        this.launchDispatch(n, { delay: 0.05, live: true, hero: true });
      }
    }
    return true;
  }

  /* ───────────────────────── stage 1 → 2 · enter ───────────────────────── */
  ignite(ev) {
    if (this.state !== 'THRESHOLD') return;
    if (!this._scoreCued) {
      this._scoreCued = true;
      this.audio.setVolume(0.78);
      this.audio.startScore(0.65, 1.2);
    }
    if (!this.stage) {
      this._pendingIgnite = ev || true;
      return;
    }
    if (this.ignited) return;
    this.ignited = true;
    this.stage.setStarCalm(0, 1200);
    this.stage.setStarLevel(0.96, 1200);

    loadNewsFireworks().then(() => {
      bindNewsStage(this.stage);
      setNewsSound(!this.audio.muted);
      setNewsVolume(this.audio.volume);
    });

    this.stage.camera.updateMatrixWorld();
    const pt = ev?.touches?.[0] || ev;
    const hasXY = typeof pt?.clientX === 'number' && typeof pt?.clientY === 'number';
    let ndcX = 0, ndcY = 0, picked = null;
    if (hasXY) {
      const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
      ndcX = (pt.clientX / w) * 2 - 1;
      ndcY = 1 - (pt.clientY / h) * 2;
      picked = this.stage.constellationAt(ndcX, ndcY, 0.16);
    }

    if (picked?.constellation) {
      this.beginPatternHandoff(picked.constellation, ndcX, ndcY);
      return;
    }

    if (hasXY) {
      this.stage.triggerStarConnect(ndcX, ndcY, {
        count: 14, maxRadius: 0.34, duration: 2.2, palette: 'click',
      });
    }

    this.beginHandoff(true);
  }

  beginPatternHandoff(constellation, ndcX, ndcY) {
    if (this._shuttered) return;
    this._shuttered = true;
    this._entryPose = {
      pos: this.stage.camera.position.clone(),
      look: this.stage.lookAt.clone(),
      t: this.elapsed,
    };
    this.selectedPattern = constellation.name;

    this.stage.triggerStarConnect(ndcX, ndcY, {
      count: 14, maxRadius: 0.40, duration: 2.6, palette: 'click',
    });

    const holdMs = this.reduced ? 0 : 420;
    const fadeMs = this.reduced ? 0 : 380;

    const landed = () => {
      this._entryPose = {
        pos: this.stage.camera.position.clone(),
        look: this.stage.lookAt.clone(),
        t: this.elapsed,
      };
      const open = () => this.enterDescent({ immediate: true });
      if (!holdMs) { open(); return; }
      this._fadeT = setTimeout(() => {
        this.stage.releaseHoverConstellation?.();
      }, holdMs);
      this._openT = setTimeout(open, holdMs + fadeMs);
    };

    const flew = this.stage.focusConstellation(constellation, {
      duration: this.reduced ? 1 : 1200,
      onDone: landed,
    });
    if (!flew) { landed(); return; }
    this.threshold?.dissolve(this.reduced ? 200 : 780);
  }

  beginHandoff(immediate = true) {
    if (this._shuttered) return;
    this._shuttered = true;
    this._entryPose = {
      pos: this.stage.camera.position.clone(),
      look: this.stage.lookAt.clone(),
      t: this.elapsed,
    };
    this.threshold?.dissolve(780);
    this.enterDescent({ immediate });
  }

  skip() {
    if (this.state !== 'THRESHOLD') return;
    this.ignited = true;
    this._shuttered = true;
    this._scoreCued = true;
    this.audio.setVolume(0.78);
    this.audio.startScore(0.65, 1.0);
    if (!this.stage) { this._pendingSkip = true; return; }
    this.threshold?.dissolve(this.reduced ? 150 : 520);
    this.enterSky({ fromSkip: true });
  }

  /* ─────────────── stage 2 · the 4 scroll chapters (3D sky movement) ──── */
  enterDescent({ immediate = false } = {}) {
    this.state = 'DESCENT';
    document.body.classList.add('can-scroll');
    $('#scene-bg')?.remove();
    document.documentElement.classList.remove('al-copy', 'al-scenes');

    this.stage.setMode('LOCKED');
    this.pattern?.show(false);
    this._patternOff = true;

    this.scrollP = 0;
    this._scrollDir = 1;
    this._gliding = false;
    this._descentReady = true;
    this._lastStepIdx = -1;

    const track = $('#intro-track');
    track?.classList.add('is-active', 'is-ready');

    this._onUserWheel = (e) => {
      if (this.state !== 'DESCENT') return;
      if (Math.abs(e.deltaY) > 0.5) {
        this._scrollDir = e.deltaY > 0 ? 1 : -1;
      }
      this._cancelActiveGlide();
      this.stage.notifyUserInput();
      clearTimeout(this._snapT);
      this._snapT = setTimeout(() => this.settleChapter(), 420);
    };
    this._onUserTouch = (e) => {
      if (this.state !== 'DESCENT') return;
      const y = e.touches?.[0]?.clientY;
      if (typeof y === 'number') {
        if (this._lastTouchY != null && Math.abs(this._lastTouchY - y) > 2) {
          this._scrollDir = (this._lastTouchY - y) > 0 ? 1 : -1;
        }
        this._lastTouchY = y;
      }
      this._cancelActiveGlide();
      clearTimeout(this._snapT);
      this._snapT = setTimeout(() => this.settleChapter(), 450);
    };

    window.addEventListener('wheel', this._onUserWheel, { passive: true });
    window.addEventListener('touchstart', this._onUserTouch, { passive: true });
    window.addEventListener('touchmove', this._onUserTouch, { passive: true });

    this._onDescentMove = (e) => {
      if (this.state !== 'DESCENT') return;
      const nx = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
      const ny = 1 - (e.clientY / Math.max(1, window.innerHeight)) * 2;
      this._descentPointer.x = nx;
      this._descentPointer.y = ny;
      this.stage.updateHoverConstellation(nx, ny);
    };
    window.addEventListener('pointermove', this._onDescentMove, { passive: true });

    $$('.ic-pip').forEach((btn) => btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const ch = Number(btn.dataset.chapter || 0);
      this.gotoChapter(ch);
      this.audio.ui('cam');
    }));

    this._onDescentScroll = () => {
      if (this.state !== 'DESCENT' || this._gliding) return;
      clearTimeout(this._snapT);
      this._snapT = setTimeout(() => this.settleChapter(), 420);
    };
    window.addEventListener('scroll', this._onDescentScroll, { passive: true });

    this._onDescentResize = () => {
      if (this.state !== 'DESCENT') return;
      const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      if (max <= 0) return;
      this._cancelActiveGlide();
      clearTimeout(this._snapT);
      const stop = CHAPTER_STOPS[clamp(this._lastStepIdx ?? 0, 0, 3)];
      window.scrollTo(0, Math.round(stop * max));
    };
    window.addEventListener('resize', this._onDescentResize, { passive: true });

    this._onDescentKey = (e) => {
      if (this.state !== 'DESCENT') return;
      if (e.key === 'Escape') {
        this.audio.ui('cam');
        this.enterSky({ fromSkip: true });
        return;
      }
      if (['ArrowDown', 'PageDown', ' '].includes(e.key)) {
        e.preventDefault();
        const cur = clamp(this._lastStepIdx ?? 0, 0, 3);
        if (cur >= 3) {
          const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
          this.glideTo(max, 560);
        } else {
          this.gotoChapter(cur + 1);
        }
      } else if (['ArrowUp', 'PageUp'].includes(e.key)) {
        e.preventDefault();
        const cur = clamp(this._lastStepIdx ?? 0, 0, 3);
        this.gotoChapter(Math.max(0, cur - 1));
      }
    };
    window.addEventListener('keydown', this._onDescentKey);
    this.updateDescent(0.016);
  }

  _cancelActiveGlide() {
    if (this._glideRaf) {
      cancelAnimationFrame(this._glideRaf);
      this._glideRaf = 0;
    }
    this._gliding = false;
  }

  glideTo(top, ms = 480) {
    const from = window.scrollY;
    const d = top - from;
    this._cancelActiveGlide();
    if (Math.abs(d) < 2) return;
    this._gliding = true;
    const t0 = performance.now();
    const step = () => {
      if (this.state !== 'DESCENT' || !this._gliding) {
        this._gliding = false;
        return;
      }
      const k = clamp((performance.now() - t0) / ms, 0, 1);
      const ease = 1 - Math.pow(1 - k, 4);
      window.scrollTo(0, from + d * ease);
      if (k < 1) {
        this._glideRaf = requestAnimationFrame(step);
      } else {
        window.scrollTo(0, top);
        this._gliding = false;
        this._glideRaf = 0;
      }
    };
    this._glideRaf = requestAnimationFrame(step);
  }

  gotoChapter(ch) {
    const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    if (max <= 0) return;
    const stop = CHAPTER_STOPS[clamp(ch, 0, 3)];
    this.glideTo(Math.round(stop * max), 540);
  }

  settleChapter() {
    if (this.state !== 'DESCENT' || this._gliding) return;
    const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    if (max <= 0) return;
    const raw = clamp(window.scrollY / max, 0, 1);

    if (raw > 0.895 && this._scrollDir >= 0) {
      this.glideTo(max, 520);
      return;
    }

    let targetStop = CHAPTER_STOPS[0];
    if (this._scrollDir >= 0) {
      for (let i = 0; i < CHAPTER_STOPS.length; i++) {
        if (raw <= CHAPTER_STOPS[i] + 0.042) {
          targetStop = CHAPTER_STOPS[i];
          break;
        }
        targetStop = CHAPTER_STOPS[Math.min(3, i + 1)];
      }
    } else {
      for (let i = CHAPTER_STOPS.length - 1; i >= 0; i--) {
        if (raw >= CHAPTER_STOPS[i] - 0.042) {
          targetStop = CHAPTER_STOPS[i];
          break;
        }
        targetStop = CHAPTER_STOPS[Math.max(0, i - 1)];
      }
    }

    const top = Math.round(targetStop * max);
    if (Math.abs(window.scrollY - top) < 12) return;
    this.glideTo(top, 460);
  }

  updateDescent(dt = 0.016) {
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const raw = clamp(window.scrollY / max, 0, 1);
    if (this.scrollP == null) this.scrollP = raw;
    const k = dt > 0 ? 1 - Math.pow(0.00035, dt) : 1;
    this.scrollP += (raw - this.scrollP) * k;
    const p = this.scrollP;

    this.introCamera(p, this.elapsed);
    this.revealCaptions(p);
    this.audio.scrollEnergy(p, this.scrollVelocity || 0);
    if (raw >= 0.988 && p >= 0.972) this.enterSky({ fromSkip: false });
  }

  introCamera(p, elapsed) {
    const cam = this.stage.camera;
    const eye = this._eye || (this._eye = new THREE.Vector3());
    const look = this._look || (this._look = new THREE.Vector3());

    const KEYS = [
      { p: 0.00,  x:   0, y:  5.0, z: 52, lookX:   0, lookY: 28, lookZ: -80, fov: 46 },
      { p: 0.25,  x:  28, y: 15.0, z: 58, lookX:  -8, lookY: 33, lookZ: -82, fov: 49 },
      { p: 0.50,  x: -34, y: 28.0, z: 42, lookX:   6, lookY: 39, lookZ: -74, fov: 51 },
      { p: 0.75,  x:  18, y: 20.0, z: 36, lookX:  -4, lookY: 42, lookZ: -84, fov: 44 },
      { p: 1.00,  x:   0, y: 14.0, z: 24, lookX:   0, lookY: 33, lookZ: -76, fov: 43 },
    ];
    let i = 0;
    while (i < KEYS.length - 2 && p > KEYS[i + 1].p) i++;
    const a0 = KEYS[i], a1 = KEYS[i + 1];
    const t = smoothstep(a0.p, a1.p, clamp(p, 0, 1));

    const breath = prefersReducedMotion() ? 0 : 1;
    const px = (this._descentPointer?.x || 0) * 6 * breath;
    const py = (this._descentPointer?.y || 0) * 3.5 * breath;

    eye.set(
      lerp(a0.x, a1.x, t) + Math.sin(elapsed * 0.28) * 2.4 * breath + px,
      lerp(a0.y, a1.y, t) + Math.sin(elapsed * 0.21 + 1.1) * 1.1 * breath + py,
      lerp(a0.z, a1.z, t) + Math.cos(elapsed * 0.19) * 1.8 * breath
    );
    look.set(
      lerp(a0.lookX, a1.lookX, t) - px * 0.6,
      lerp(a0.lookY, a1.lookY, t) + py * 0.5,
      lerp(a0.lookZ, a1.lookZ, t)
    );
    this.stage._targetFov = lerp(a0.fov, a1.fov, t);

    const e = this._entryPose;
    if (e) {
      const k = smoothstep(0, 0.28, p);
      eye.lerpVectors(e.pos, eye, k);
      look.lerpVectors(e.look, look, k);
    }
    cam.position.copy(eye);
    this.stage.lookAt.copy(look);
    cam.lookAt(look);
  }

  revealCaptions(p) {
    const steps = $$('.ic-step');
    const u = p * 4;
    const idx = this._descentReady ? clamp(Math.floor(u + 0.12), 0, 3) : -1;

    if (idx >= 0 && idx !== this._lastStepIdx) {
      this._lastStepIdx = idx;
      if (idx > 0) this.audio.stepCue(idx);

      const waveX = [-0.28, 0.32, -0.18, 0.24][idx] || 0;
      const waveY = [0.16, 0.22, 0.12, 0.26][idx] || 0.18;
      this.stage?.triggerStarConnect(waveX, waveY, {
        count: 15, maxRadius: 0.38, duration: 2.8,
      });
    }

    steps.forEach((el, i) => {
      const on = i === idx;
      if (on !== el.classList.contains('is-on')) el.classList.toggle('is-on', on);
      const local = u - i;
      if (local > -0.35 && local < 1.25) {
        const inK = i === 0 ? 1 : smoothstep(-0.22, 0.08, local);
        const outK = smoothstep(0.76, 1.02, local);
        const op = clamp(inK * (1 - outK), 0, 1);
        const yShift = (1 - inK) * 34 - outK * 30;
        const scale = 0.965 + 0.035 * inK + outK * 0.02;
        el.style.opacity = op.toFixed(3);
        el.style.transform = `translate3d(0, calc(-50% + ${yShift.toFixed(1)}px), 0) scale(${scale.toFixed(4)})`;
      } else {
        el.style.opacity = '0';
      }
    });

    $$('.ic-pip').forEach((pip, i) => pip.classList.toggle('is-on', i === Math.max(0, idx)));
    const hint = $('#intro-hint');
    if (hint) hint.style.opacity = p > 0.03 ? '0' : '';
  }

  /* ───────────────────────── stage 2 → 3 · the sky ─────────────────────── */
  enterSky({ fromSkip = false } = {}) {
    if (this.state === 'SKY') return;
    this.state = 'SKY';
    this._gaps = [];
    $('#scene-bg')?.remove();

    const veil = $('#veil');
    if (veil && fromSkip) {
      veil.style.transitionDuration = '220ms';
      veil.style.opacity = '0.72';
      clearTimeout(this._veilT);
      this._veilT = setTimeout(() => {
        veil.style.transitionDuration = '780ms';
        veil.style.opacity = '0';
      }, 230);
    }

    if (this._onDescentMove) {
      window.removeEventListener('pointermove', this._onDescentMove);
      this._onDescentMove = null;
    }
    if (this._onDescentKey) {
      window.removeEventListener('keydown', this._onDescentKey);
      this._onDescentKey = null;
    }
    if (this._onDescentScroll) {
      window.removeEventListener('scroll', this._onDescentScroll);
      this._onDescentScroll = null;
    }
    if (this._onDescentResize) {
      window.removeEventListener('resize', this._onDescentResize);
      this._onDescentResize = null;
    }
    if (this._onUserWheel) {
      window.removeEventListener('wheel', this._onUserWheel);
      this._onUserWheel = null;
    }
    if (this._onUserTouch) {
      window.removeEventListener('touchstart', this._onUserTouch);
      window.removeEventListener('touchmove', this._onUserTouch);
      this._onUserTouch = null;
    }
    clearTimeout(this._snapT);
    this._cancelActiveGlide();

    this.audio.endScroll();
    this.audio.setScoreLevel(0.68, 1.6);

    this.fx?.clear?.();
    this.callouts?.clear?.();

    this.stage.setStarCalm(0, 1400);
    this.stage.setStarLevel(0.92, 1400);
    bindNewsStage(this.stage);
    loadNewsFireworks().then(() => {
      bindNewsStage(this.stage);
      setNewsSound(!this.audio.muted);
      setNewsVolume(this.audio.volume);
      setNewsPaused(this.paused);
    });

    this.stage.directRender = false;
    this.stage.bloom.strength = 0.68;
    this.stage.bloom.threshold = 0.54;
    this.stage.bloom.radius = 0.42;

    const track = $('#intro-track');
    track?.classList.add('is-done');
    document.body.classList.remove('can-scroll');
    document.body.classList.add('sky-locked');
    window.scrollTo(0, 0);

    this.pattern?.show(false);
    const pf = this.pattern;
    if (pf) setTimeout(() => { pf.dispose(); if (this.pattern === pf) this.pattern = null; }, 1600);

    this.stage.setMode('AUTO');
    const li = $('#mf-linkedin');
    if (li) { li.textContent = CREATOR.name; li.href = CREATOR.linkedin; }
    const mfVer = $('#mf-ver');
    if (mfVer) mfVer.textContent = `AFTER LIGHT · ${ARCHETYPES.length} archetypes · ${this.fx.pool.count.toLocaleString()}-particle pool`;
    $('#hud').classList.add('is-live');
    $('#hud').setAttribute('aria-hidden', 'false');
    this.bindHud();
    addEventListener('afterlight:focus', (e) => {
      const p = e.detail?.pos; if (!p) return;
      this.setCamera?.('AUTO', { silent: false });
      this.stage.flyTo(new THREE.Vector3(p[0], p[1], p[2]));
      this.audio.ui('lens');
    });
    this.setCamera?.('AUTO', { silent: true });
    this.announceManifesto();

    clearTimeout(this._seedT);
    this._seed = { n: 0 };
    this.firstShellFired = true;
    const d1 = this.pickDispatch();
    const d2 = this.pickDispatch();
    const d3 = this.pickDispatch();
    this._lastLiveWall = Date.now();
    if (d1) this.launchDispatch(d1, { delay: 0.08, hero: true, live: true, x: -28, y: 38, z: -76 });
    if (d2) this.launchDispatch(d2, { delay: 0.92, hero: false, live: true, x: 24, y: 42, z: -82 });
    if (d3) this.launchDispatch(d3, { delay: 1.85, hero: true, live: true, x: 2, y: 45, z: -72 });

    this._seeded = true;
    this.nextLaunchAt = this.elapsed + rand(3.6, 5.0);
    this.scheduleCadence();
  }

  pickDispatch(fresh) {
    const q = this.stream?.take();
    if (q) {
      const n = this.normalize(q, this.dispatches.length + 7919);
      if (n && !this.dispatches.some(d => d.title.toLowerCase() === n.title.toLowerCase())) {
        n.at = performance.now();
        this.dispatches.unshift(n);
        if (this.dispatches.length > 420) this.dispatches.length = 420;
        this.renderArchive(); this.paintSync();
        this._recentDispatchIds.push(n.id);
        if (this._recentDispatchIds.length > 14) this._recentDispatchIds.shift();
        return n;
      }
    }
    if (fresh === 'live') return null;
    const pool = this.lens === 'ALL' ? this.dispatches : this.dispatches.filter(d => d.lens === this.lens);
    const baseSrc = (pool.length ? pool : this.dispatches).slice(0, 90);
    if (!baseSrc.length) return null;

    const unseen = baseSrc.filter(d => !this._recentDispatchIds.includes(d.id));
    const src = unseen.length ? unseen : baseSrc;
    const r = Math.random();
    const idx = r < 0.45 ? Math.floor(Math.pow(Math.random(), 2.0) * src.length)
                         : Math.floor(Math.random() * src.length);
    const picked = src[Math.min(idx, src.length - 1)] || null;
    if (picked) {
      this._recentDispatchIds.push(picked.id);
      if (this._recentDispatchIds.length > Math.min(16, Math.max(4, baseSrc.length - 1))) {
        this._recentDispatchIds.shift();
      }
    }
    return picked;
  }

  scheduleCadence() {
    clearTimeout(this._cad);
    const gap = (this.state === 'SKY' ? rand(3.5, 4.9) : rand(4.5, 6.2)) * 1000;
    this._cad = setTimeout(() => {
      if (!this.paused && !document.hidden && this.state === 'SKY' && this._seeded !== false) {
        const liveOne = this.pickDispatch('live');
        const wall = Date.now();
        if (liveOne) {
          this._lastLiveAt = this.elapsed;
          this._lastLiveWall = wall;
          this.launchDispatch(liveOne, { delay: 0.04, live: true, hero: true });
        } else if (wall - (this._lastLiveWall || 0) > 3100) {
          const nextBadNews = this.pickDispatch();
          if (nextBadNews) {
            this._lastLiveWall = wall;
            this.launchDispatch(nextBadNews, { delay: 0.04, live: true });
          }
        }
      }
      this.scheduleCadence();
    }, gap);
  }

  launchDispatch(d, o = {}) {
    d.shotAt = this.elapsed;

    if (this.state === 'SKY' && !o.noNews) {
      this._shotSeq = (this._shotSeq || 0) + 1;
      const seqNum = this._shotSeq;
      const shot = fireNewsShell(d, {
        delay: o.delay ?? 0,
        hero: !!o.hero,
        live: !!o.live,
        x: o.x,
        y: o.y,
        z: o.z,
        onLaunch: (rec) => {
          this._lastFireAt = this.elapsed;
          this._activeShot = {
            seq: seqNum,
            label: (rec?.label || d.lens.split(' ')[0]).toUpperCase(),
            inches: rec?.inches || 4,
            stage: 'ASCENDING',
            startedAt: this.elapsed,
          };
        },
        onBreak: (info) => {
          this.bloomBoost = Math.max(this.bloomBoost || 0, 0.65);
          if (this._activeShot && this._activeShot.seq === seqNum) {
            this._activeShot.stage = 'BURNING';
            this._activeShot.breakAt = this.elapsed;
            this._activeShot.life = (info?.life || 3.4) * 0.58;
          }
        },
      });
      this.live.push({
        dispatch: d,
        born: this.elapsed,
        burst: {
          arch: {
            name: shot?.label || d.lens.split(' ')[0],
            caliber: shot?.inches || 4,
            emitter: o.live ? 'LIVE FEED' : 'RECENT · VERIFIED',
          },
        },
      });
      if (this.live.length > 18) this.live.splice(0, this.live.length - 18);
      this.updateNowTicker(d);
      this.renderLive();
      return shot;
    }

    const arch = o.silent
      ? (pickArchetype('NOTABLE PASSINGS').id === null ? ARCHETYPE_BY_ID['silent-lantern-white'] : pickArchetype('NOTABLE PASSINGS'))
      : pickArchetype(d.lens);
    const b = this.fx.launch(arch, {
      dispatch: d, delay: o.delay ?? 0,
      x: o.x ?? rand(-95, 95), z: o.z ?? rand(-140, -35),
      altitudeScale: o.altitudeScale ?? (o.hero ? rand(1.0, 1.12) : rand(0.84, 1.14)),
    });
    return b;
  }

  onBreak(b) {
    if (this.state === 'SKY') return;
    const d = b.dispatch;
    if (!d) return;
    this.live.push({ dispatch: d, burst: b, born: this.elapsed });
    this.callouts.spawn({
      dispatch: d, burst: b, color: lensColor(d.lens),
      onOpen: () => { window.open(d.url, '_blank', 'noopener'); this.audio.ui('open'); },
    });
    this.updateNowTicker(d, b);
    this.renderLive();
  }

  updateNowTicker(d) {
    this._nowDispatch = d;
  }

  /* Live firework processing bar & status readout on the main screen */
  updateFireworkLine() {
    const bar = $('#hud-pulse-bar');
    const seqEl = $('#hud-seq');
    if (!bar && !seqEl) return;

    const seqStr = String(Math.max(1, this._shotSeq || 1)).padStart(2, '0');
    const shot = this._activeShot;
    const tInfo = bestCameraTarget();
    const burningList = activeLights();
    const label = shot?.label || 'CHRYSANTHEMUM';
    const cal = shot?.inches || 4;

    let pct = 16;
    let statusText = `FW-${seqStr} · STANDBY · MORTAR READY`;

    if (tInfo && tInfo.kind === 'shell') {
      const p = clamp(tInfo.progress || 0, 0, 1);
      pct = 8 + p * 36;
      statusText = `FW-${seqStr} · ASCENDING · ${cal}" ${label}`;
    } else if (burningList.length > 0) {
      const b = burningList[burningList.length - 1];
      const visLife = Math.max(0.8, (b.life || 3.4) * 0.58);
      const p = clamp((b.age || 0) / visLife, 0, 1);
      pct = 44 + p * 56;
      statusText = `FW-${seqStr} · ${cal}" ${label} · BURNING`;
    } else if (shot && this.elapsed - (shot.startedAt || 0) < 3.6) {
      const p = clamp((this.elapsed - (shot.startedAt || 0)) / 3.4, 0, 1);
      pct = 12 + p * 88;
      statusText = `FW-${seqStr} · ${cal}" ${label} · ${shot.stage || 'ACTIVE'}`;
    } else {
      const waitElapsed = Math.max(0, this.elapsed - (this._lastFireAt || 0));
      const cycle = clamp((waitElapsed % 4.2) / 4.2, 0, 1);
      pct = 10 + cycle * 32;
      statusText = `FW-${seqStr} · ${this._shotSeq || 0} IGNITED · MORTAR READY`;
    }

    if (bar) bar.style.width = `${clamp(pct, 6, 100).toFixed(1)}%`;
    if (seqEl && seqEl.textContent !== statusText) seqEl.textContent = statusText;
  }

  launchAtPointer(clientX, clientY) {
    const W = Math.max(1, window.innerWidth), H = Math.max(1, window.innerHeight);
    const nx = typeof clientX === 'number' ? (clientX / W) * 2 - 1 : (Math.random() - 0.5) * 1.2;
    const ny = typeof clientY === 'number' ? 1 - (clientY / H) * 2 : (Math.random() - 0.3) * 0.8;
    const res = this.stage.triggerStarConnect(nx, ny, {
      count: 16,
      maxRadius: 0.34,
      duration: 2.8,
      palette: 'click',
    });
    this.audio.ui('lens');
    if (res?.constellation && res.constellation !== 'ASTERISM') {
      this.toast(`CONSTELLATION · ${res.constellation}`, { ms: 2000 });
    } else {
      this.toast('CELESTIAL PATTERN · STAR ALIGNMENT', { ms: 1800 });
    }
    this.noteInput();
  }

  /* ───────────────────────────── stage 4 · HUD ─────────────────────────── */
  bindHud() {
    if (this._hudBound) return;
    this._hudBound = true;
    const CAM_CAPTION = {
      WIDE: 'hold the whole sky',
      DRONE: 'circle the shells',
      AUTO: 'ride the next break',
    };
    this.setCamera = (mode, { silent = false } = {}) => {
      if (!CAM_CAPTION[mode]) return;
      const slider = $('#cam-slider');
      slider?.setAttribute('data-mode', mode);
      $$('.cam-opt').forEach(b => {
        const on = b.dataset.mode === mode;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-checked', String(on));
      });
      const cap = $('#cam-caption');
      if (cap && cap.textContent !== CAM_CAPTION[mode]) cap.textContent = CAM_CAPTION[mode];
      this.stage.setMode(mode);
      if (mode === 'AUTO') {
        const a = latestShot();
        if (a) this.stage.flyTo(new THREE.Vector3(a[0], a[1], a[2]));
      }
      if (!silent) {
        this.audio.ui('cam');
        this.noteInput();
        const label = mode === 'WIDE' ? 'WIDE HORIZON' : mode === 'DRONE' ? 'AERIAL DRONE ORBIT' : 'AUTO FLY TO BURST';
        this.toast(`CAMERA · ${label}`, { ms: 2000 });
      }
    };

    const modeFromX = (clientX) => {
      const slider = $('#cam-slider');
      if (!slider) return null;
      const r = slider.getBoundingClientRect();
      const i = clamp(Math.floor(((clientX - r.left) / r.width) * 3), 0, 2);
      return ['WIDE', 'DRONE', 'AUTO'][i];
    };
    $$('.cam-opt').forEach(btn =>
      btn.addEventListener('click', () => this.setCamera(btn.dataset.mode)));

    const slider = $('#cam-slider');
    if (slider) {
      let dragging = false;
      slider.addEventListener('pointerdown', (e) => {
        dragging = true;
        slider.setPointerCapture?.(e.pointerId);
        const m = modeFromX(e.clientX);
        if (m) this.setCamera(m);
      });
      slider.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        const m = modeFromX(e.clientX);
        if (m && m !== this.stage.mode) this.setCamera(m);
      });
      const endDrag = (e) => {
        if (!dragging) return;
        dragging = false;
        slider.releasePointerCapture?.(e.pointerId);
      };
      slider.addEventListener('pointerup', endDrag);
      slider.addEventListener('pointercancel', endDrag);
      slider.setAttribute('data-mode', 'AUTO');
    }

    const sb = $('#sound-btn');
    sb.addEventListener('click', () => {
      const on = this.audio.toggleMute();
      setNewsSound(on);
      sb.setAttribute('aria-pressed', String(!!on));
      $('#snd-waves').style.display = on ? '' : 'none';
      $('#snd-mute').style.display = on ? 'none' : '';
      this.noteInput();
    });
    $('#drawer-btn').addEventListener('click', () => this.toggleDrawer());
    $('#dr-close').addEventListener('click', () => this.toggleDrawer(false));
    $('#mf-close').addEventListener('click', () => this.toggleManifesto(false));
    const syncLensUI = (nextLens, fireOne = false) => {
      this.lens = nextLens;
      $$('.lens').forEach(x => x.classList.toggle('is-on', x.dataset.lens === nextLens));
      this.renderArchive();
      this.audio.ui('lens');
      if (fireOne && this.state === 'SKY') {
        const d = this.pickDispatch();
        if (d) this.launchDispatch(d, { delay: 0.08, hero: true });
      }
    };
    $$('.lens').forEach(b => b.addEventListener('click', () => syncLensUI(b.dataset.lens, true)));

    let drag = null;
    window.addEventListener('pointerdown', (e) => {
      if (this.state !== 'SKY' || e.button !== 0) return;
      if ($('#drawer')?.classList.contains('is-open') || $('#manifesto')?.classList.contains('is-open')) return;
      if (e.target.closest?.('.hud-el, .callout, .newsplate, #drawer, #manifesto, button, a')) return;
      drag = { x: e.clientX, y: e.clientY, moved: 0, id: e.pointerId };
      this.noteInput();
    }, { passive: true });

    window.addEventListener('pointermove', (e) => {
      if (this.state === 'SKY' && !drag) {
        const nx = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
        const ny = 1 - (e.clientY / Math.max(1, window.innerHeight)) * 2;
        this.stage.updateHoverConstellation(nx, ny);
      }
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.x = e.clientX; drag.y = e.clientY;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      if (drag.moved > 5) this.stage.orbitBy(dx, dy);
    }, { passive: true });

    window.addEventListener('pointerup', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dragged = drag.moved > 10;
      drag = null;
      if (!dragged && this.state === 'SKY') this.launchAtPointer(e.clientX, e.clientY);
      this.noteInput();
    }, { passive: true });

    window.addEventListener('wheel', (e) => {
      if (this.state !== 'SKY') return;
      if ($('#drawer')?.classList.contains('is-open') || $('#manifesto')?.classList.contains('is-open')) return;
      if (e.target.closest?.('.hud-el, #drawer, #manifesto')) return;
      e.preventDefault();
      this.stage.zoomBy(e.deltaY);
    }, { passive: false });

    $('#mf-vol').addEventListener('input', (e) => {
      const v = e.target.value / 100;
      this.audio.setVolume(v);
      setNewsVolume(v);
    });
    $('#mf-rm').addEventListener('change', (e) => this.setReducedMotion(e.target.checked));
    $('#mf-pause').addEventListener('change', (e) => this.setPaused(e.target.checked));

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && this.state === 'SKY' && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) {
        e.preventDefault(); this.toggleManifesto(); this.noteInput();
      }
      if (e.key === 'Escape') { this.toggleManifesto(false); this.toggleDrawer(false); }
      if (e.key.toLowerCase() === 'm') { $('#sound-btn').click(); }
      if (this.state === 'SKY' && !/INPUT|TEXTAREA/.test(document.activeElement.tagName) &&
          ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        const s2 = e.shiftKey ? 64 : 26;
        this.stage.orbitBy(
          e.key === 'ArrowLeft' ? -s2 : e.key === 'ArrowRight' ? s2 : 0,
          e.key === 'ArrowUp' ? -s2 : e.key === 'ArrowDown' ? s2 : 0);
        this.noteInput();
      }
      if (e.key.toLowerCase() === 'l' && this.state === 'SKY' && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) {
        this.launchAtPointer();
      }
      if (e.key >= '1' && e.key <= '3' && this.state === 'SKY') {
        const modes = ['WIDE', 'DRONE', 'AUTO'];
        const m = modes[+e.key - 1];
        const opt = document.querySelector(`.cam-opt[data-mode="${m}"]`);
        if (opt) opt.click();
      }
      this.noteInput();
    });

    ['pointermove', 'pointerdown', 'wheel', 'keydown', 'touchstart'].forEach(ev =>
      window.addEventListener(ev, () => { this.lastInput = performance.now(); this.noteInput(); }, { passive: true }));
  }

  noteInput() {
    $('#hud').classList.remove('is-idle');
    this.lastInput = performance.now();
  }

  setReducedMotion(on) {
    this.reduced = on;
    this.fx.stretch = on ? 0.02 : 0.055;
    this.stage.bloom.strength = on ? 0.42 : 0.68;
    document.documentElement.style.setProperty('--reduced', on ? '1' : '0');
    this.toast(on ? 'REDUCED MOTION · LANTERN' : 'FULL MOTION');
  }
  setPaused(on) {
    this.paused = on;
    this.fx.setPaused(on);
    this.audio.setPaused(on);
    setNewsPaused(on);
    this.toast(on ? 'SKY PAUSED' : 'SKY RESUMED');
  }

  toggleDrawer(force) {
    const d = $('#drawer');
    const open = force === undefined ? !d.classList.contains('is-open') : force;
    d.classList.toggle('is-open', open);
    d.setAttribute('aria-hidden', String(!open));
    $('#drawer-btn').setAttribute('aria-expanded', String(open));
    this.audio.ui('drawer');
    if (open) { this.renderLive(); this.renderArchive(); }
  }
  toggleManifesto(force) {
    const m = $('#manifesto');
    const open = force === undefined ? !m.classList.contains('is-open') : force;
    m.classList.toggle('is-open', open);
    m.setAttribute('aria-hidden', String(!open));
    this.audio.ui('modal');
  }

  /* ────────────────────────── editorial rendering ──────────────────────── */
  renderLive() {
    const ul = $('#live-list');
    const now = this.elapsed;
    for (let i = this.live.length - 1; i >= 0; i--) {
      if (now - this.live[i].born > 26) this.live.splice(i, 1);
    }
    $('#live-empty').style.display = this.live.length ? 'none' : '';
    ul.innerHTML = this.live.slice(-14).reverse().map(({ dispatch: d, burst: b }) => `
      <li class="dr-item" style="--accent:${lensColor(d.lens)}">
        <span class="dr-item-lens">${esc(d.lens)}</span>
        <span class="dr-item-title">${esc(d.title)}</span>
        <span class="dr-item-act">IGNITE IN SKY</span>
        <span class="dr-item-sum">${esc(d.summary)}</span>
        <span class="dr-item-time">${esc(b.arch.name.toUpperCase())} · ${b.arch.caliber}" · ${b.arch.emitter}</span>
      </li>`).join('');
    ul.querySelectorAll('.dr-item').forEach((li, i) => {
      const rec = this.live.slice(-14).reverse()[i];
      li.addEventListener('click', (e) => {
        if (e.target.classList.contains('dr-item-act')) {
          this.launchDispatch(rec.dispatch, { delay: 0.2 });
          this.audio.ui('relaunch');
          this.toast('RE-LAUNCHED · ' + rec.dispatch.title.slice(0, 34));
        } else {
          window.open(rec.dispatch.url, '_blank', 'noopener');
        }
      });
    });
  }

  renderArchive() {
    const ul = $('#archive-list');
    const list = this.lens === 'ALL' ? this.dispatches : this.dispatches.filter(d => d.lens === this.lens);
    const recent = list.slice(0, 120);
    $('#archive-note').textContent = `${recent.length} of ${this.dispatches.length} entries · ${this.lens.toLowerCase()}`;
    ul.innerHTML = recent.map(d => `
      <li class="dr-item" style="--accent:${lensColor(d.lens)}" data-id="${esc(d.id)}">
        <span class="dr-item-lens">${esc(d.lens)}</span>
        <span class="dr-item-title">${esc(d.title)}</span>
        <span class="dr-item-act">IGNITE ↑</span>
        <span class="dr-item-sum">${esc(d.summary)}</span>
      </li>`).join('');
    ul.querySelectorAll('.dr-item').forEach((li) => {
      const id = li.dataset.id;
      const d = this.dispatches.find(x => x.id === id);
      if (!d) return;
      li.addEventListener('click', (e) => {
        if (e.target.classList.contains('dr-item-act')) {
          this.launchDispatch(d, { delay: 0.2, hero: true });
          this.audio.ui('relaunch');
          this.toast('IGNITED · ' + d.title.slice(0, 34));
          if (window.innerWidth < 900) this.toggleDrawer(false);
        } else {
          window.open(d.url, '_blank', 'noopener');
        }
      });
    });
  }

  paintSync() {
    const el = $('#sync-note');
    const st = this.stream?.status || 'offline';
    if (el) {
      el.textContent = 'last sync — ' + (this.stream?.lastSync
        ? new Date(this.stream.lastSync).toUTCString().slice(17, 25) + ' UTC'
        : 'cached') + ' · ' + st;
    }
    $('#dot-live')?.classList.toggle('is-stale', st !== 'live');
  }

  toast(msg, { ms = 2600, hint = false } = {}) {
    const t = $('#toast');
    if (!t) return;
    t.innerHTML = msg;
    t.classList.toggle('is-hint', hint);
    t.classList.add('is-on');
    clearTimeout(this._toast);
    this._toast = setTimeout(() => t.classList.remove('is-on'), ms);
  }

  announceManifesto() {
    if (this._manifestoAnnounced) return;
    this._manifestoAnnounced = true;
    setTimeout(() => {
      if (this.state === 'SKY') this.toast('MANIFESTO <span class="kbd">SPACE</span>', { ms: 6200, hint: true });
    }, 2600);
  }

  /* ─────────────────────────── the frame loop ──────────────────────────── */
  startLoop() {
    this.running = true;
    this._prof = { raw: [], post: [] };
    const loop = () => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      const now = performance.now();
      let dt = (now - this.lastT) / 1000;
      this.lastT = now;
      if (this._prof) {
        const P = this._prof;
        P.raw.push(now - (P.last || now)); P.last = now;
        if (P.raw.length > 240) P.raw.shift();
      }
      this._frameMs = dt * 1000;
      if (dt > 0.1) dt = 0.1;

      if (document.hidden) return;
      if (this.paused) { this.stage.render(); return; }

      this.frames++;
      const gaps = this._gaps || (this._gaps = []);
      gaps.push(this._frameMs);
      if (gaps.length > 40) gaps.shift();

      /* Record instantaneous FPS + frame-time variation into rolling spark history */
      const instFps = clamp(1000 / Math.max(4, this._frameMs), 20, 144);
      const hist = this._fpsWaveHist || (this._fpsWaveHist = new Array(34).fill(0));
      if (this.frames % 2 === 0) {
        const deltaSignal = clamp((instFps - this.fps) / 12 + (this.fps - 60) / 35, -2.6, 2.6);
        hist.push(deltaSignal);
        if (hist.length > 34) hist.shift();
      }

      if (now - this.fpsWall >= 250) {
        let sum = 0;
        for (let i = 0; i < gaps.length; i++) sum += gaps[i];
        const mean = sum / Math.max(1, gaps.length);
        const prevFps = this.fps;
        this.fps = clamp(Math.round(1000 / Math.max(1, mean)), 24, 144);
        if (this.fps !== prevFps) {
          hist.push(clamp((this.fps - prevFps) * 0.45, -2.8, 2.8));
          if (hist.length > 34) hist.shift();
        }
        this.fpsWall = now; this.frames = 0;
        const n = $('#fps-num');
        if (n) n.textContent = String(this.fps);
        this.stage.adapt(this.fps);
        setNewsQuality(clamp((this.fps - 16) / 40, 0.55, 1));
        this.fpsAcc = 0;
      }

      const rdt = this.reduced ? dt * 0.55 : dt;
      this.elapsed += rdt;
      this.paintSpark();

      if (this.state === 'DESCENT') {
        const y = window.scrollY;
        this.scrollVelocity = Math.abs(y - (this._lastY ?? y));
        this._lastY = y;
        this.updateDescent(rdt);
      }

      if (this.bloomBoost > 0) {
        this.bloomBoost = Math.max(0, this.bloomBoost - dt * 0.85);
        const e = this.bloomBoost * this.bloomBoost;
        const b = this.stage.bloom;
        const skyMode = this.state === 'SKY';
        b.strength = (skyMode ? 0.68 : 0.52) + e * 0.28;
        b.threshold = (skyMode ? 0.54 : 0.72) - e * 0.18;
        b.radius = 0.36 + e * 0.10;
      }

      this.fx.update(rdt, this.elapsed);
      if (this.state === 'SKY') {
        const lights = activeLights();
        this.stage.syncPools(lights);
        this.stage.trackAutoTarget(bestCameraTarget(), rdt);
        this.updateFireworkLine();
      }
      this.stage.update(rdt, this.elapsed);
      this.stage.camera.updateMatrixWorld();
      syncNewsCamera(this.stage.camera);
      updateNewsPlates(this.stage.camera, rdt);
      this.audio.setListener(this.stage.camera.position, this.stage.camera.matrixWorld);
      this.callouts.update(dt, this.stage, this.elapsed);

      if (this.state === 'SKY') {
        if (this.elapsed - (this._liveTick || 0) > 4) { this._liveTick = this.elapsed; this.renderLive(); }
        if (!this.callouts.hovering && performance.now() - this.lastInput > 45000)
          $('#hud').classList.add('is-idle');
        this.fx.wind = 0.7 + Math.sin(this.elapsed * 0.07) * 0.35;
      }

      this.stage.render();
      if (this._prof) this._prof.post.push(performance.now() - now);
      if (this._prof && this._prof.post.length > 240) this._prof.post.shift();
    };
    this.raf = requestAnimationFrame(loop);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { this.audio.setPaused(true); setNewsPaused(true); }
      else { this.lastT = performance.now(); if (!this.paused) { this.audio.setPaused(false); setNewsPaused(false); } }
    });
  }

  /* Live & FPS-reactive sparkline:
     - Shifts baseline, frequency, and ripple height dynamically as FPS changes
     - Continuously travels and undulates live even when FPS is constant */
  paintSpark() {
    const el = $('#fps-spark');
    if (!el) return;
    if (!this._sparkLine) {
      el.innerHTML = `<svg viewBox="0 0 70 16" width="70" height="16" preserveAspectRatio="none">
        <polyline fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" points=""/>
        <circle class="hb-dot" cx="67" cy="9" r="1.8" fill="#FFFDF8" stroke="currentColor" stroke-width="1"/></svg>`;
      this._sparkLine = el.querySelector('polyline');
      this._sparkDot = el.querySelector('.hb-dot');
    }
    const fpsNorm = clamp((this.fps || 60) / 60, 0.4, 2.2);
    const speed = 1.05 + fpsNorm * 0.65;
    const t = this.elapsed * speed;
    const hist = this._fpsWaveHist || [];
    const N = 34;
    const pts = [];
    let lastY = 9.5;
    const baseLevel = clamp(10.8 - (fpsNorm - 1.0) * 1.6, 8.2, 12.2);

    for (let i = 0; i < N; i++) {
      const u = i / (N - 1);
      const x = u * 67;
      const ph = ((u * (1.45 + fpsNorm * 0.28) - t) % 1 + 1) % 1;
      const pWave = 1.35 * Math.exp(-Math.pow((ph - 0.22) / 0.048, 2));
      const qDip  = -1.45 * Math.exp(-Math.pow((ph - 0.34) / 0.019, 2));
      const rPeak = (5.8 + fpsNorm * 1.1) * Math.exp(-Math.pow((ph - 0.38) / 0.023, 2));
      const sDip  = -2.3 * Math.exp(-Math.pow((ph - 0.42) / 0.021, 2));
      const tWave = 2.0 * Math.exp(-Math.pow((ph - 0.58) / 0.056, 2));
      /* Continuous live carrier wave + real FPS history deflection */
      const liveRipple = Math.sin(u * 9.5 - this.elapsed * 4.6) * 0.55
                       + Math.cos(u * 5.2 - this.elapsed * 2.9) * 0.35;
      const fpsJitter = (hist[i] || 0) * 1.15;
      const y = clamp(
        baseLevel - (pWave + qDip + rPeak + sDip + tWave + liveRipple + fpsJitter),
        1.4,
        14.6
      );
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      if (i === N - 1) lastY = y;
    }
    this._sparkLine.setAttribute('points', pts.join(' '));
    if (this._sparkDot) {
      this._sparkDot.setAttribute('cy', lastY.toFixed(1));
    }
  }
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const FALLBACK = [
  { title: '2026 Adamuz rail disaster', summary: 'In 2026, two high-speed passenger trains derailed and collided near Adamuz in southern Spain. Emergency crews responded across the province of Córdoba following widespread casualties and service disruption.', url: 'https://en.wikipedia.org/wiki/Adamuz_rail_disaster', lens: 'SUDDEN TRAGEDY' },
  { title: 'Afghanistan–Pakistan border conflict', summary: 'An ongoing armed conflict between Afghanistan and Pakistan along the Durand Line involving cross-border shelling and airstrikes. Clashes have displaced thousands of residents across border districts.', url: 'https://en.wikipedia.org/wiki/Afghanistan%E2%80%93Pakistan_skirmishes', lens: 'CONFLICT & FRONTLINES' },
  { title: 'Iran–Israel conflict', summary: 'An ongoing armed conflict involving Iran, Israel, and allied forces across the Middle East. The confrontation has included long-range missile exchanges, aerial strikes, and regional maritime disruptions.', url: 'https://en.wikipedia.org/wiki/Iran%E2%80%93Israel_conflict', lens: 'CONFLICT & FRONTLINES' },
  { title: '2025 Uganda Ebola outbreak', summary: 'An outbreak of Sudan ebolavirus disease reported in Uganda in 2025. Public health authorities initiated contact tracing, isolation wards, and ring vaccination protocols to contain transmission.', url: 'https://en.wikipedia.org/wiki/Ebola', lens: 'EARTH & CATACLYSM' },
  { title: '2025 California wildfires', summary: 'A destructive series of wind-driven wildfires across Southern California in 2025 fueled by severe drought and Santa Ana winds. Thousands of structures were damaged and mass evacuations were ordered.', url: 'https://en.wikipedia.org/wiki/2025_California_wildfires', lens: 'EARTH & CATACLYSM' },
  { title: '2025 Myanmar earthquake', summary: 'A major strike-slip earthquake struck central Myanmar in 2025 causing widespread structural collapse and infrastructure damage. Rescue operations extended across Mandalay and surrounding regions.', url: 'https://en.wikipedia.org/wiki/2025_Myanmar_earthquake', lens: 'EARTH & CATACLYSM' },
];

const app = new Interspace();
window.INTERSPACE = app;
