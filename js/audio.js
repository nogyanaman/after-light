/* ============================================================================
   AFTER LIGHT · audio.js
   Generative Neo-Classical & Celestial Ambient Score Engine + Streamed Score
   ("Adrift Among Infinite Stars") + UI & Scroll Cues.
   Note: Firework launch & explosion sounds are played 100% by the original
   real outdoor recordings (audio/boom.ogg, audio/fw1..fw8.ogg) in fireworks.js.
   ========================================================================== */

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

const SCORE_URL = './assets/adrift-among-infinite-stars-trimmed.mp3';
const GESTURES = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown', 'wheel'];

const mayStart = () => {
  const ua = typeof navigator !== 'undefined' && navigator.userActivation;
  return !ua || ua.hasBeenActive;
};

const CHORDS = [
  {
    name: 'Dm9',
    bass: 73.42,
    fifth: 110.00,
    pad: [146.83, 220.00, 261.63, 329.63],
    melody: [293.66, 329.63, 349.23, 440.00, 523.25, 587.33, 659.25, 698.46, 880.00],
  },
  {
    name: 'Bbmaj7#11',
    bass: 58.27,
    fifth: 87.31,
    pad: [116.54, 174.61, 220.00, 261.63],
    melody: [261.63, 293.66, 329.63, 349.23, 440.00, 523.25, 587.33, 659.25, 783.99],
  },
  {
    name: 'Fmaj9',
    bass: 65.41,
    fifth: 98.00,
    pad: [130.81, 196.00, 246.94, 329.63],
    melody: [261.63, 329.63, 349.23, 392.00, 440.00, 523.25, 659.25, 698.46, 783.99],
  },
  {
    name: 'Am11',
    bass: 55.00,
    fifth: 82.41,
    pad: [110.00, 164.81, 220.00, 293.66],
    melody: [246.94, 293.66, 329.63, 392.00, 440.00, 493.88, 587.33, 659.25, 880.00],
  },
];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.muted = false;
    this.volume = 0.78;
    this.active = 0;
    this.maxActive = 26;
    this.lastBreak = 0;
    this.listenerPos = { x: 0, y: 0, z: 0 };
    this.noise2s = null;
    this.noise6s = null;
    this._chordIdx = 0;
    this._genTimer = null;
    this._arpTimer = null;
  }

  prime() {
    this.ready = true;
    if (!this._scoreEl && typeof Audio !== 'undefined') {
      const el = (this._scoreEl = new Audio());
      el.loop = true;
      el.preload = 'auto';
      el.volume = this.muted ? 0 : Math.min(1, 0.45 * this.volume);
      el.addEventListener('error', () => this._scoreFallback());
      el.src = SCORE_URL;
    }
    if (!this.ctx) {
      try { this.unlock(false); } catch (e) {}
    }
  }

  warm() {
    this.prime();
    try { this._fillBuffers(); } catch (e) {}
  }

  _scoreFallback() {
    const el = this._scoreEl;
    if (!el || this._scoreBlob) return;
    this._scoreBlob = true;
    const at = el.currentTime || 0;
    fetch(SCORE_URL)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error('score fetch failed'))))
      .then((blob) => {
        el.src = URL.createObjectURL(blob);
        if (at > 0) { try { el.currentTime = at; } catch (e) {} }
        if (this._wantScorePlay) this._playScore();
      })
      .catch(() => {});
  }

  _wake() {
    const ctx = this.ctx;
    if (ctx && !this._paused && ctx.state !== 'running' && ctx.state !== 'closed') {
      ctx.resume()?.catch?.(() => {});
    }
  }

  _playScore() {
    const el = this._scoreEl;
    if (el && el.paused && !this._paused) {
      const p = el.play();
      if (p && p.then) p.then(() => { if (!mayStart()) this._wake(); }, () => {});
    }
    this._startGenerativeComposer();
  }

  _listen() {
    if (this._listening || typeof window === 'undefined') return;
    this._listening = true;
    const again = () => this._resumeAll();
    for (const type of GESTURES) window.addEventListener(type, again, { capture: true, passive: true });
  }

  _resumeAll() {
    if (!this._wantScorePlay || this._paused) return;
    if (mayStart()) this._wake();
    this._playScore();
  }

  unlock(resume = true) {
    if (!this._scoreEl && typeof Audio !== 'undefined') this.prime();
    if (this.ctx) {
      if (resume && mayStart()) this._wake();
      this._wireScore();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC({ latencyHint: 'interactive' }));

    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -10;
    this.limiter.knee.value = 20;
    this.limiter.ratio.value = 8;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.25;

    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;

    this.tilt = ctx.createBiquadFilter();
    this.tilt.type = 'highshelf';
    this.tilt.frequency.value = 4800;
    this.tilt.gain.value = -2.5;

    this.verb = ctx.createConvolver();
    this.verbGain = ctx.createGain();
    this.verbGain.gain.value = this.muted ? 0 : 0.36 * this.volume;

    this.delayL = ctx.createDelay(2.0);
    this.delayR = ctx.createDelay(2.0);
    this.delayL.delayTime.value = 0.42;
    this.delayR.delayTime.value = 0.63;
    this.delayFB = ctx.createGain();
    this.delayFB.gain.value = 0.30;
    this.delayLP = ctx.createBiquadFilter();
    this.delayLP.type = 'lowpass';
    this.delayLP.frequency.value = 2200;
    this.delayOut = ctx.createGain();
    this.delayOut.gain.value = 0.20;

    this.delayL.connect(this.delayR);
    this.delayR.connect(this.delayLP);
    this.delayLP.connect(this.delayFB);
    this.delayFB.connect(this.delayL);
    this.delayL.connect(this.delayOut);
    this.delayR.connect(this.delayOut);
    this.delayOut.connect(this.master);
    this.delayOut.connect(this.verb);

    this.genBus = ctx.createGain();
    this.genBus.gain.value = 0.55;
    this.genFilter = ctx.createBiquadFilter();
    this.genFilter.type = 'lowpass';
    this.genFilter.frequency.value = 3200;
    this.genFilter.Q.value = 0.55;
    this.genBus.connect(this.genFilter);
    this.genFilter.connect(this.master);
    this.genFilter.connect(this.verb);

    this.master.connect(this.tilt);
    this.tilt.connect(this.limiter);
    this.limiter.connect(ctx.destination);
    this.verbGain.connect(this.limiter);
    this.verb.connect(this.verbGain);

    this._wireScore();
    this._buffersDue = true;
  }

  _fillBuffers() {
    if (!this._buffersDue || !this.ctx) return;
    this._buffersDue = false;
    this.verb.buffer = this._impulse(this.ctx, 3.8, 2.3);
    this.noise2s = this._noise(this.ctx, 2);
    this.noise6s = this._noise(this.ctx, 6);
  }

  _wireScore() {
    const ctx = this.ctx;
    if (!ctx || !this._scoreEl || this._scoreSrc) return;
    try {
      this._scoreSrc = ctx.createMediaElementSource(this._scoreEl);
      this._scoreLP = ctx.createBiquadFilter();
      this._scoreLP.type = 'lowpass';
      this._scoreLP.frequency.value = 14000;
      this._scoreLP.Q.value = 0.45;
      this._scoreGain = ctx.createGain();
      this._scoreGain.gain.value = (this._scoreBase || 0.62) * 0.55;
      this._scoreSrc.connect(this._scoreLP);
      this._scoreLP.connect(this._scoreGain);
      this._scoreGain.connect(this.master);
    } catch (e) {}
  }

  _startGenerativeComposer() {
    if (this._genRunning || !this.ctx) return;
    this._genRunning = true;
    this._fillBuffers();

    this._voiceWarmPadChord(CHORDS[this._chordIdx], 7.8);
    setTimeout(() => {
      if (!this._paused && !this.muted) this._voiceFeltPianoNote(CHORDS[0].melody[3], 0.048, 3.6);
    }, 320);

    const chordLoop = () => {
      if (!this._genRunning) return;
      if (!this._paused && this.ctx && this.ctx.state === 'running') {
        this._chordIdx = (this._chordIdx + 1) % CHORDS.length;
        const ch = CHORDS[this._chordIdx];
        this._voiceWarmPadChord(ch, 7.6);
      }
      this._genTimer = setTimeout(chordLoop, 7200);
    };
    this._genTimer = setTimeout(chordLoop, 7200);

    const motifLoop = () => {
      if (!this._genRunning) return;
      const nextMs = 1650 + Math.random() * 1550;
      if (!this._paused && !this.muted && this.ctx && this.ctx.state === 'running') {
        const ch = CHORDS[this._chordIdx];
        const m = ch.melody;
        const n1 = m[Math.floor(Math.random() * m.length)];
        this._voiceFeltPianoNote(n1, 0.038 + Math.random() * 0.016, 3.2 + Math.random() * 1.4);

        if (Math.random() < 0.55) {
          const idx2 = clamp(m.indexOf(n1) + (Math.random() < 0.6 ? 2 : -1), 0, m.length - 1);
          const delay2 = 280 + Math.random() * 220;
          setTimeout(() => {
            if (!this._paused && !this.muted) {
              this._voiceFeltPianoNote(m[idx2], 0.030, 2.9);
            }
          }, delay2);
        }
      }
      this._arpTimer = setTimeout(motifLoop, nextMs);
    };
    this._arpTimer = setTimeout(motifLoop, 1200);
  }

  _voiceWarmPadChord(chord, dur = 7.6) {
    const ctx = this.ctx;
    if (!ctx || !this.genBus) return;
    const t0 = ctx.currentTime + 0.02;

    const bassFreqs = [chord.bass, chord.fifth];
    bassFreqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const sub = ctx.createOscillator();
      osc.type = idx === 0 ? 'sine' : 'triangle';
      sub.type = 'sine';
      osc.frequency.setValueAtTime(f, t0);
      sub.frequency.setValueAtTime(f * 0.5, t0);

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(300, t0);
      lp.frequency.linearRampToValueAtTime(540, t0 + dur * 0.45);
      lp.frequency.linearRampToValueAtTime(240, t0 + dur);

      const g = ctx.createGain();
      const peak = idx === 0 ? 0.042 : 0.024;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(peak, t0 + dur * 0.34);
      g.gain.linearRampToValueAtTime(peak * 0.72, t0 + dur * 0.72);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 1.4);

      osc.connect(lp);
      sub.connect(lp);
      lp.connect(g);
      g.connect(this.genBus);

      osc.start(t0);
      sub.start(t0);
      osc.stop(t0 + dur + 1.5);
      sub.stop(t0 + dur + 1.5);
    });

    chord.pad.forEach((f, i) => {
      const o1 = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      o1.type = 'sine';
      o2.type = 'triangle';
      o1.frequency.setValueAtTime(f * 0.9985, t0);
      o2.frequency.setValueAtTime(f * 1.0018, t0);

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(840 + i * 160, t0);
      lp.frequency.linearRampToValueAtTime(1480 + i * 200, t0 + dur * 0.5);
      lp.frequency.linearRampToValueAtTime(700 + i * 100, t0 + dur);

      const g = ctx.createGain();
      const peak = 0.018 / (1 + i * 0.18);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(peak, t0 + dur * 0.38);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 1.6);

      o1.connect(lp);
      o2.connect(lp);
      lp.connect(g);
      g.connect(this.genBus);

      o1.start(t0);
      o2.start(t0);
      o1.stop(t0 + dur + 1.7);
      o2.stop(t0 + dur + 1.7);
    });
  }

  _voiceFeltPianoNote(freq, gain = 0.042, dur = 3.2) {
    const ctx = this.ctx;
    if (!ctx || !this.genBus) return;
    const t0 = ctx.currentTime + 0.01;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.linearRampToValueAtTime(gain, t0 + 0.028);
    env.gain.exponentialRampToValueAtTime(gain * 0.38, t0 + 0.42);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(Math.min(3800, freq * 4.8), t0);
    lp.frequency.exponentialRampToValueAtTime(Math.max(380, freq * 1.3), t0 + dur * 0.78);

    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const o3 = ctx.createOscillator();
    o1.type = 'sine';
    o2.type = 'triangle';
    o3.type = 'sine';
    o1.frequency.setValueAtTime(freq, t0);
    o2.frequency.setValueAtTime(freq * 1.0009, t0);
    o3.frequency.setValueAtTime(freq * 2.0, t0);

    const g2 = ctx.createGain(); g2.gain.value = 0.25;
    const g3 = ctx.createGain(); g3.gain.value = 0.06;

    o1.connect(lp);
    o2.connect(g2); g2.connect(lp);
    o3.connect(g3); g3.connect(lp);
    lp.connect(env);
    env.connect(this.genBus);
    if (this.delayL) env.connect(this.delayL);

    o1.start(t0); o2.start(t0); o3.start(t0);
    o1.stop(t0 + dur + 0.05);
    o2.stop(t0 + dur + 0.05);
    o3.stop(t0 + dur + 0.05);
  }

  _voiceCelestialHarmonic(freq, gain = 0.022, dur = 3.0) {
    const ctx = this.ctx;
    if (!ctx || !this.genBus) return;
    const t0 = ctx.currentTime + 0.01;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    o1.type = 'sine';
    o2.type = 'sine';
    o1.frequency.setValueAtTime(freq, t0);
    o2.frequency.setValueAtTime(freq * 1.5, t0);
    const g2 = ctx.createGain(); g2.gain.value = 0.20;

    o1.connect(g);
    o2.connect(g2); g2.connect(g);
    g.connect(this.genBus);
    if (this.delayR) g.connect(this.delayR);

    o1.start(t0); o2.start(t0);
    o1.stop(t0 + dur + 0.05);
    o2.stop(t0 + dur + 0.05);
  }

  startScore(targetGain = 0.65, fadeSec = 1.4) {
    this.unlock();
    this._listen();
    this._wantScorePlay = true;
    this._scoreStarted = true;
    this._scoreBase = targetGain;

    if (this._scoreEl) {
      this._scoreEl.volume = this.muted ? 0 : Math.min(1, targetGain * 0.55 * this.volume);
    }
    this._playScore();

    if (this._scoreGain && this.ctx) {
      const t = this.ctx.currentTime;
      this._scoreGain.gain.cancelScheduledValues(t);
      this._scoreGain.gain.setValueAtTime(Math.max(0.03, this._scoreGain.gain.value), t);
      this._scoreGain.gain.exponentialRampToValueAtTime(Math.max(0.01, targetGain * 0.55), t + fadeSec);
    }
    this._fillBuffers();
  }

  setScoreLevel(targetGain = 0.62, fadeSec = 1.6) {
    this._scoreBase = targetGain;
    if (this._scoreGain && this.ctx) {
      this._scoreGain.gain.setTargetAtTime(Math.max(0.001, targetGain * 0.55), this.ctx.currentTime, fadeSec / 3);
    }
    if (this._scoreEl) {
      this._scoreEl.volume = this.muted ? 0 : Math.min(1, targetGain * 0.55 * this.volume);
      if (this._wantScorePlay) this._playScore();
    }
  }

  _noise(ctx, sec) {
    const n = Math.floor(ctx.sampleRate * sec);
    const b = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      last = 0.72 * last + 0.28 * w;
      d[i] = last * 1.15;
    }
    return b;
  }

  _impulse(ctx, sec, decay) {
    const n = Math.floor(ctx.sampleRate * sec);
    const b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < n; i++) {
        const t = i / n;
        const sparse = Math.random() < 0.0026 * (1 - t) ? (Math.random() * 2 - 1) * 3 : 0;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * 0.55 + sparse * Math.pow(1 - t, 1.4);
      }
    }
    return b;
  }

  /* Firework sounds are handled 100% by the original real .ogg recordings in fireworks.js */
  launch() {}
  break_() {}

  scrollEnergy(p, vel) {
    if (!this.ctx) return;
    this._fillBuffers();
    const ctx = this.ctx;
    if (!this._scrollG) {
      const n = ctx.createBufferSource();
      n.buffer = this.noise6s;
      n.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 1.2;
      bp.frequency.value = 440;
      const g = ctx.createGain();
      g.gain.value = 0.0001;
      n.connect(bp);
      bp.connect(g);
      g.connect(this.master);
      g.connect(this.verb);
      n.start();
      this._scrollG = g;
      this._scrollF = bp;
    }
    const e = Math.min(1, vel / 65);
    const target = 0.0006 + e * 0.045;
    this._scrollG.gain.setTargetAtTime(Math.max(0.0001, target), ctx.currentTime, 0.11);
    this._scrollF.frequency.setTargetAtTime(320 + p * 1650 + e * 900, ctx.currentTime, 0.12);
    if (this.genFilter) {
      this.genFilter.frequency.setTargetAtTime(2200 + p * 2600 + e * 1200, ctx.currentTime, 0.18);
    }
    if (this._scoreStarted && this._scoreGain && this._scoreLP) {
      const base = (this._scoreBase || 0.62) * 0.55;
      this._scoreGain.gain.setTargetAtTime(base + p * 0.06 + e * 0.04, ctx.currentTime, 0.18);
      this._scoreLP.frequency.setTargetAtTime(11000 + p * 5000 + e * 2500, ctx.currentTime, 0.2);
    }
  }

  endScroll() {
    if (this._scrollG && this.ctx) {
      this._scrollG.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.35);
    }
    if (this.genFilter && this.ctx) {
      this.genFilter.frequency.setTargetAtTime(4200, this.ctx.currentTime, 0.5);
    }
  }

  stepCue(stepIdx) {
    if (!this.ctx || this.muted) return;
    this._fillBuffers();
    this._chordIdx = stepIdx % CHORDS.length;
    const ch = CHORDS[this._chordIdx];
    this._voiceWarmPadChord(ch, 6.8);
    this._voiceFeltPianoNote(ch.melody[2], 0.046, 3.4);
  }

  ui(kind) {
    if (!this.ctx || this.muted) return;
    const ch = CHORDS[this._chordIdx] || CHORDS[0];
    const mapIdx = { cam: 2, drawer: 1, modal: 0, lens: 4, relaunch: 5, open: 6 }[kind] ?? 3;
    const f = ch.melody[mapIdx % ch.melody.length] || 523.25;
    this._voiceCelestialHarmonic(f, 0.025, 1.45);
  }

  setVolume(v) {
    this.volume = clamp(v, 0, 1);
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.05);
    }
    if (this.verbGain && this.ctx) {
      this.verbGain.gain.setTargetAtTime(this.muted ? 0 : 0.36 * this.volume, this.ctx.currentTime, 0.05);
    }
    if (this._scoreEl && !this._scoreSrc) {
      this._scoreEl.volume = this.muted ? 0 : Math.min(1, (this._scoreBase || 0.62) * 0.55 * this.volume);
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.06);
    }
    if (this.verbGain && this.ctx) {
      this.verbGain.gain.setTargetAtTime(this.muted ? 0 : 0.36 * this.volume, this.ctx.currentTime, 0.06);
    }
    if (this._scoreEl && !this._scoreSrc) {
      this._scoreEl.volume = this.muted ? 0 : Math.min(1, (this._scoreBase || 0.62) * 0.55 * this.volume);
    }
    return !this.muted;
  }

  setPaused(p) {
    this._paused = !!p;
    if (!this.ctx) return;
    if (p) {
      if (!this._held) this._wasRunning = this.ctx.state === 'running';
      this._held = true;
      this.ctx.suspend?.()?.catch?.(() => {});
      this._scoreEl?.pause();
    } else {
      this._held = false;
      if (!this._wasRunning) return;
      this.ctx.resume?.()?.catch?.(() => {});
      if (this._wantScorePlay || this._scoreStarted) this._playScore();
    }
  }

  update() {}
  setListener(pos, mat) {
    if (!this.ctx) return;
    this.listenerPos = pos;
    const L = this.ctx.listener;
    if (L.positionX) {
      L.positionX.value = pos.x; L.positionY.value = pos.y; L.positionZ.value = pos.z;
      const f = [mat.elements[8], mat.elements[9], mat.elements[10]];
      const u = [mat.elements[4], mat.elements[5], mat.elements[6]];
      L.forwardX.value = -f[0]; L.forwardY.value = -f[1]; L.forwardZ.value = -f[2];
      L.upX.value = u[0]; L.upY.value = u[1]; L.upZ.value = u[2];
    } else if (L.setPosition) {
      L.setPosition(pos.x, pos.y, pos.z);
      L.setOrientation(-mat.elements[8], -mat.elements[9], -mat.elements[10],
                        mat.elements[4], mat.elements[5], mat.elements[6]);
    }
  }
}
