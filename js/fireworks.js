/* ============================================================================
   INTERSPACE · fireworks.js
   GPU-resident pyrotechnic system.
   ----------------------------------------------------------------------------
   · ONE InstancedBufferGeometry pool (80k–100k slots) allocated at init.
     A burst never allocates: it writes birth timestamps, origins, velocities
     and chemical colour uniforms into dormant slots. Zero runtime GC.
   · Two draw calls for the whole sky: the burst pass and its y<0 mirror twin
     (uMirror = -1.0 reflects in the vertex shader).
   · Physics integrated analytically:  v(t) = v0·e^(−k·t),  x(t) = v0(1−e^(−kt))/k
     so there is no per-frame state to store, only birth time + constants.
   · Blackbody cooling, strobe, crackle, glitter, curl-noise wind shear,
     velocity-stretched ribbon trails, and split staging (crossette / multi-
     break) sub-emitted at spawn time with analytically offset origins.
   ========================================================================== */
import * as THREE from 'three';
import { KERNEL, shellGeometry } from './archetypes.js';
import { hexToRGB, rand, clamp } from './tokens.js';

/* ---------------------------------------------------------------- shaders */
const VERT = /* glsl */`
precision highp float;

attribute vec4 aOriginLife;   // xyz = origin,        w = birth time
attribute vec4 aVelLife;      // xyz = initial vel,   w = life
attribute vec4 aColA;         // rgb = ignition colour, a = size
attribute vec4 aColB;         // rgb = chemical colour, a = seed
attribute vec4 aP1;           // x=type y=drag z=gravity w=strobeHz
attribute vec4 aP2;           // x=crackle y=splitT z=splitImpulse w=curl
attribute vec4 aP3;           // x=pistil y=glitter z=trail w=smoke
attribute vec4 aP4;           // x=spin y=flutter z=shard w=ghostSteps

uniform float uTime, uMirror, uWindAmp, uSizeScale, uStretch, uSoft, uFogD;

varying vec3  vCol;
varying float vAlpha, vHot, vShard, vSeed;
varying vec2  vUv;

/* cheap divergence-free-ish flow field — night breeze shear */
vec3 flow(vec3 p){
  return vec3(
    sin(p.y * 0.70 + uTime * 0.15) + cos(p.z * 0.50 - uTime * 0.11),
    sin(p.z * 0.62 + uTime * 0.12) * 0.35,
    cos(p.x * 0.70 - uTime * 0.13) + sin(p.y * 0.40 + uTime * 0.09));
}
float hash11(float n){ return fract(sin(n) * 43758.5453123); }

void main(){
  float t    = uTime - aOriginLife.w;
  float life = aVelLife.w;
  if (t < 0.0 || t > life || life <= 0.0) {          // dormant / dead slot
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);          // clipped
    vAlpha = 0.0; vCol = vec3(0.0); vHot = 0.0; vShard = aP4.z; vUv = vec2(0.5); vSeed = aColB.w;
    return;
  }
  float n    = t / life;
  float seed = aColB.w;
  float k    = max(aP1.y, 0.05);
  float g    = aP1.z;
  vec3  v0   = aVelLife.xyz;

  /* --- analytic drag + gravity ------------------------------------------- */
  vec3 disp = v0 * (1.0 - exp(-k * t)) / k;
  disp.y -= 0.5 * g * t * t;

  /* --- spin (rings, spirals, diadem arms) -------------------------------- */
  if (aP4.x > 0.001) {
    float a = aP4.x * t, s = sin(a), c = cos(a);
    disp.xz = mat2(c, -s, s, c) * disp.xz;
  }
  /* --- flutter (falling leaves, embers) ---------------------------------- */
  if (aP4.y > 0.001) {
    float ph = seed * 6.2831;
    disp.x += sin(t * 2.05 + ph)        * aP4.y * t * 0.55;
    disp.z += cos(t * 1.71 + ph * 1.3)  * aP4.y * t * 0.55;
    disp.y += sin(t * 3.10 + ph * 0.7)  * aP4.y * t * 0.18;
  }
  /* --- 3D curl-noise wind shear ------------------------------------------ */
  vec3 wind = flow(disp * 0.02 + seed) * aP2.w * t * uWindAmp * 0.55;

  vec3 pos = aOriginLife.xyz + disp + wind;

  /* --- mirror twin ------------------------------------------------------- */
  if (uMirror < 0.0) {
    pos.y = -pos.y;
    float rr = length(pos.xz);
    pos.y += sin(rr * 0.30 - uTime * 1.35) * 0.16 * exp(-t * 0.35);   // micro-ripple
  }

  /* --- blackbody thermal cooling ---------------------------------------- */
  float ignite = smoothstep(0.0, 0.055, n);                 // ~first 0.15 s
  vec3  chem   = aColB.rgb;
  vec3  col    = mix(aColA.rgb, chem, ignite);
  if (aP4.w > 1.0) {                                        // ghost shell: stepped
    float steps = aP4.w;
    col = mix(aColA.rgb, chem, floor(ignite * steps) / max(steps - 1.0, 1.0));
  }
  vec3 ember = chem * 0.30 + vec3(0.20, 0.085, 0.030);      // charcoal amber tail
  col = mix(col, ember, smoothstep(0.68, 1.0, n) * 0.88);

  /* --- strobe / crackle / glitter ---------------------------------------- */
  float strob = 1.0;
  if (aP1.w > 0.0) {
    float f = fract(t * aP1.w + seed);
    strob = 0.12 + 0.95 * smoothstep(0.42, 0.52, f) * (1.0 - smoothstep(0.62, 0.72, f) * 0.0);
  }
  float cr = 1.0;
  if (aP2.x > 0.0) {
    float f = hash11(floor(t * 24.0) + seed * 91.7);
    cr = mix(1.0, step(0.70, f), smoothstep(0.40, 1.0, n) * aP2.x);
  }
  float gl = 1.0;
  if (aP3.y > 0.0) {
    float f = hash11(floor(t * 30.0) * 1.37 + seed * 78.2);
    gl = mix(1.0, 0.30 + step(0.86, f) * 1.7, smoothstep(0.28, 0.92, n) * aP3.y);
  }

  float env   = smoothstep(0.0, 0.018, n) * pow(1.0 - n, 1.30);
  float hotB  = 1.0 + (1.0 - ignite) * 2.8;                 // HDR magnesium flash
  float bright = env * strob * cr * gl * hotB;

  float fadeM = 1.0;
  if (uMirror < 0.0) {
    vec3 Vv = normalize(cameraPosition - pos);
    float graz  = 1.0 - clamp(abs(Vv.y), 0.0, 1.0);
    float fres  = 0.30 + 0.70 * pow(graz, 2.6);
    float dist  = length(cameraPosition - pos);
    float far   = 1.0 - smoothstep(90.0, 900.0, dist) * 0.45;
    fadeM = (0.26 + 0.62 * fres) * far;
  }

  float fogD = length(cameraPosition - pos);
  float fogT = exp(-uFogD * uFogD * fogD * fogD);

  float size = aColA.a * uSizeScale * (0.55 + 0.80 * (1.0 - n * 0.55));

  /* --- velocity-stretched ribbon billboard (view space) ------------------- */
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  vec3 vel = v0 * exp(-k * t) + vec3(0.0, -g * t, 0.0);
  vec3 velView = (modelViewMatrix * vec4(vel, 0.0)).xyz;
  vec2 d2 = velView.xy;
  float sp = length(d2);
  vec2 dirN = sp > 0.0001 ? d2 / sp : vec2(1.0, 0.0);
  vec2 upV  = vec2(-dirN.y, dirN.x);
  float stretch = 1.0 + min(sp * uStretch, 3.4) * aP3.z;

  vec2 q = position.xy;                                     // plane is -0.5..0.5
  mv.xy += dirN * (q.y * size * stretch) + upV * (q.x * size);
  gl_Position = projectionMatrix * mv;

  vCol   = col;
  vAlpha = clamp(bright, 0.0, 6.0) * fadeM * fogT;
  vHot   = (1.0 - ignite);
  vShard = aP4.z;
  vSeed  = seed;
  vUv    = uv;
}`;

const FRAG = /* glsl */`
precision highp float;
varying vec3  vCol;
varying float vAlpha, vHot, vShard, vSeed;
varying vec2  vUv;
uniform float uSoft;

void main(){
  vec2 uv = vUv * 2.0 - 1.0;
  float r2 = dot(uv, uv);
  if (r2 > 1.0) discard;

  if (vShard > 0.5) {                        // crystalline shards (intro stage)
    float facet = 0.55 + 0.45 * step(0.0, uv.x * 0.72 + uv.y * 0.69);
    float edge  = smoothstep(1.0, 0.72, r2);
    gl_FragColor = vec4(vCol * (facet * 1.3 + vHot * 2.0), vAlpha * edge);
    return;
  }
  float core = pow(max(1.0 - r2, 0.0), 2.9);
  float halo = pow(max(1.0 - sqrt(r2), 0.0), 2.1);
  float a = (core * 1.06 + halo * 0.16) * vAlpha;
  vec3  c = vCol * (0.55 + vHot * 2.2) * (1.0 + core * 0.9);
  gl_FragColor = vec4(c, a * uSoft);
}`;

/* -------------------------------------------------------------- smoke pass */
const SMOKE_VERT = /* glsl */`
precision highp float;
attribute vec4 aOriginLife;
attribute vec4 aVelLife;
attribute vec4 aCol;       // rgb smoke tint, a = seed
attribute vec2 aSizeGrow;  // x = base size, y = grow
uniform float uTime, uMirror, uSizeScale, uFogD;
varying float vAlpha; varying vec3 vCol; varying vec2 vUv; varying float vSeed;
void main(){
  float t = uTime - aOriginLife.w, life = aVelLife.w;
  if (t < 0.0 || t > life) { gl_Position = vec4(0.0,0.0,2.0,1.0); vAlpha = 0.0; return; }
  float n = t / life;
  vec3 pos = aOriginLife.xyz + aVelLife.xyz * (1.0 - exp(-0.55 * t)) / 0.55;
  pos.y += 3.2 * t * 0.35;                                  // buoyant rise
  if (uMirror < 0.0) pos.y = -pos.y;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  float s = (aSizeGrow.x + aSizeGrow.y * n) * uSizeScale;
  mv.xy += position.xy * s;
  gl_Position = projectionMatrix * mv;
  float rise = smoothstep(0.0, 0.12, n) * (1.0 - smoothstep(0.45, 1.0, n));
  float sFog = exp(-uFogD * uFogD * dot(pos - cameraPosition, pos - cameraPosition));
  vAlpha = rise * 0.55 * (uMirror < 0.0 ? 0.5 : 1.0) * sFog;
  vCol = aCol.rgb; vUv = uv; vSeed = aCol.a;
}`;

const SMOKE_FRAG = /* glsl */`
precision highp float;
varying float vAlpha; varying vec3 vCol; varying vec2 vUv; varying float vSeed;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y);
}
void main(){
  vec2 uv = vUv * 2.0 - 1.0;
  float r2 = dot(uv, uv);
  if (r2 > 1.0) discard;
  float n = n2(uv * 2.6 + vSeed * 12.0) * 0.6 + n2(uv * 6.0 - vSeed * 5.0) * 0.4;
  float mask = (1.0 - sqrt(r2));
  gl_FragColor = vec4(vCol * (0.6 + n * 0.8), vAlpha * mask * (0.35 + n * 0.9));
}`;

/* ------------------------------------------------------------------ pools */
class Pool {
  constructor(count, material, mirrorMaterial) {
    const g = new THREE.InstancedBufferGeometry();
    const base = new THREE.PlaneGeometry(1, 1);
    g.index = base.index;
    g.attributes.position = base.attributes.position;
    g.attributes.uv = base.attributes.uv;
    g.instanceCount = count;
    this.count = count;
    this.geometry = g;
    this.material = material;
    this.mirrorMaterial = mirrorMaterial;
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.frustumCulled = false;
    this.mirrorMesh = new THREE.Mesh(g, mirrorMaterial);
    this.mirrorMesh.frustumCulled = false;
    this.cursor = 0;
    this.attrs = {};
    this.ranges = [];
  }
  add(name, itemSize) {
    const arr = new Float32Array(this.count * itemSize);
    const a = new THREE.InstancedBufferAttribute(arr, itemSize);
    a.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute(name, a);
    this.attrs[name] = a;
    return a;
  }
  dirty(start, n) {
    this.ranges.push([start, n]);
  }
  flush() {
    if (!this.ranges.length) return;
    let lo = Infinity, hi = -Infinity;
    for (const [s, n] of this.ranges) { lo = Math.min(lo, s); hi = Math.max(hi, s + n); }
    const start = lo, cnt = hi - lo;
    for (const k in this.attrs) {
      const a = this.attrs[k];
      if (a.addUpdateRange) { a.clearUpdateRanges?.(); a.addUpdateRange(start * a.itemSize, cnt * a.itemSize); }
      a.needsUpdate = true;
    }
    this.ranges.length = 0;
  }
}

/* ------------------------------------------------------- firework system */
export class FireworkSystem {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.tier = opts.tier || 'high';
    this.max = opts.maxParticles || { high: 100000, mid: 92000, low: 80000 }[this.tier];
    this.smokeMax = Math.round(this.max * 0.09);
    this.time = 0;
    this.wind = 1.0;
    this.bursts = [];
    this.pending = [];
    this.pools = [];
    this.idSeq = 1;
    this.onBreak = null;
    this.onLaunch = null;
    this.sizeScale = 1;
    this.stretch = 0.055;
    this.qualityScale = 1;
    this._paused = false;

    const uni = () => ({
      uTime: { value: 0 }, uMirror: { value: 1 }, uWindAmp: { value: 1.0 },
      uSizeScale: { value: 1 }, uStretch: { value: 0.055 }, uSoft: { value: 1.0 },
      uFogD: { value: 0.0011 },
    });
    this.uMain = uni();
    this.uMirror = uni(); this.uMirror.uMirror.value = -1;
    this.uSmoke = { uTime: { value: 0 }, uMirror: { value: 1 }, uSizeScale: { value: 1 }, uFogD: { value: 0.0011 } };
    this.uSmokeM = { uTime: { value: 0 }, uMirror: { value: -1 }, uSizeScale: { value: 1 }, uFogD: { value: 0.0011 } };

    const mkMat = (u, blending) => new THREE.ShaderMaterial({
      uniforms: u, vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false, depthTest: true,
      blending: blending || THREE.AdditiveBlending,
    });
    this.matMain = mkMat(this.uMain);
    this.matMirror = mkMat(this.uMirror);
    this.smokeMat = new THREE.ShaderMaterial({
      uniforms: this.uSmoke, vertexShader: SMOKE_VERT, fragmentShader: SMOKE_FRAG,
      transparent: true, depthWrite: false, blending: THREE.NormalBlending,
    });
    this.smokeMirror = new THREE.ShaderMaterial({
      uniforms: this.uSmokeM, vertexShader: SMOKE_VERT, fragmentShader: SMOKE_FRAG,
      transparent: true, depthWrite: false, blending: THREE.NormalBlending,
    });

    this.pool = new Pool(this.max, this.matMain, this.matMirror);
    ['aOriginLife', 'aVelLife', 'aColA', 'aColB', 'aP1', 'aP2', 'aP3', 'aP4']
      .forEach(n => this.pool.add(n, 4));

    this.smoke = new Pool(this.smokeMax, this.smokeMat, this.smokeMirror);
    this.smoke.add('aOriginLife', 4); this.smoke.add('aVelLife', 4);
    this.smoke.add('aCol', 4); this.smoke.add('aSizeGrow', 2);

    this.group = new THREE.Group();
    this.group.visible = false; // dormant until a shell is launched
    this.group.add(this.pool.mesh, this.smoke.mesh);
    scene.add(this.group);
  }

  /* ------------------------------------------------------------- helpers */
  alloc(n) {
    const p = this.pool;
    if (n > p.count) n = p.count;
    let start = p.cursor;
    if (start + n > p.count) start = 0;
    p.cursor = (start + n) % p.count;
    p.dirty(start, n);
    return start;
  }
  allocSmoke(n) {
    const p = this.smoke;
    if (n > p.count) n = p.count;
    let start = p.cursor;
    if (start + n > p.count) start = 0;
    p.cursor = (start + n) % p.count;
    p.dirty(start, n);
    return start;
  }
  write(i, o) {
    const a = this.pool.attrs, k = i * 4;
    const set = (name, x, y, z, w) => {
      const arr = a[name].array;
      arr[k] = x; arr[k + 1] = y; arr[k + 2] = z; arr[k + 3] = w;
    };
    set('aOriginLife', o.x, o.y, o.z, o.birth);
    set('aVelLife', o.vx, o.vy, o.vz, o.life);
    set('aColA', o.ca[0], o.ca[1], o.ca[2], o.size);
    set('aColB', o.cb[0], o.cb[1], o.cb[2], o.seed);
    set('aP1', o.type, o.drag, o.grav, o.strobe);
    set('aP2', o.crackle, o.splitT, o.splitI, o.curl);
    set('aP3', o.pistil, o.glitter, o.trail, o.smoke);
    set('aP4', o.spin, o.flutter, o.shard, o.ghost);
  }
  writeSmoke(i, s) {
    const a = this.smoke.attrs, k = i * 4;
    a.aOriginLife.array.set([s.x, s.y, s.z, s.birth], k);
    a.aVelLife.array.set([s.vx, s.vy, s.vz, s.life], k);
    a.aCol.array.set([s.c[0], s.c[1], s.c[2], s.seed], k);
    const k2 = i * 2;
    a.aSizeGrow.array[k2] = s.size; a.aSizeGrow.array[k2 + 1] = s.grow;
  }

  static sphereDir(i, n, out) {
    const gr = (1 + Math.sqrt(5)) / 2;
    const t = (i + 0.5) / n;
    const phi = Math.acos(1 - 2 * t);
    const theta = 2 * Math.PI * (i / gr);
    const j = 0.045;
    out[0] = Math.sin(phi) * Math.cos(theta) + (Math.random() - 0.5) * j;
    out[1] = Math.cos(phi) + (Math.random() - 0.5) * j;
    out[2] = Math.sin(phi) * Math.sin(theta) + (Math.random() - 0.5) * j;
    const l = Math.hypot(out[0], out[1], out[2]) || 1;
    out[0] /= l; out[1] /= l; out[2] /= l;
  }

  /* -------------------------------------------------------------- launch */
  launch(arch, o = {}) {
    const geo = shellGeometry(arch);
    const x = o.x ?? rand(-110, 110);
    const z = o.z ?? rand(-140, -10);
    const alt = geo.altitude * (o.altitudeScale ?? rand(0.9, 1.12));
    const ascentG = 20;
    const vUp = Math.sqrt(2 * ascentG * alt);
    const tLaunch = this.time + (o.delay ?? 0);
    const tBreak = tLaunch + vUp / ascentG;

    const id = this.idSeq++;
    const burst = {
      id, arch, x, z, y: alt, tLaunch, tBreak, broken: false,
      dispatch: o.dispatch || null, life: arch.burn + 2.6, born: tBreak,
      peak: 1, color: arch.colors[1],
    };
    this.pending.push(burst);
    this.bursts.push(burst);
    this.group.visible = !this._paused;

    const nComet = Math.round(34 * (this.tier === 'low' ? 0.5 : 1));
    const s = this.alloc(nComet);
    const hot = hexToRGB(arch.colors[0]), cool = hexToRGB(arch.colors[1]);
    for (let i = 0; i < nComet; i++) {
      this.write(s + i, {
        x: x + rand(-0.35, 0.35), y: rand(0.2, 1.6), z: z + rand(-0.35, 0.35),
        vx: rand(-0.6, 0.6), vy: vUp * rand(0.86, 1.0), vz: rand(-0.6, 0.6),
        birth: tLaunch + i * 0.012, life: (vUp / ascentG) * 1.02,
        ca: hot, cb: cool, size: rand(0.7, 1.5), seed: Math.random() * 10,
        type: KERNEL.COMET, drag: 0.35, grav: ascentG, strobe: 0,
        crackle: 0, splitT: 0, splitI: 0, curl: 0.35,
        pistil: 0, glitter: 0.15, trail: 1.0, smoke: 0.2,
        spin: 0, flutter: 0.1, shard: 0, ghost: 0,
      });
    }
    this.onLaunch?.(burst);
    return burst;
  }

  /* --------------------------------------------------------------- break */
  _break(b) {
    const arch = b.arch;
    const k = arch.kernel;
    const scale = (this.tier === 'low' ? 0.42 : this.tier === 'mid' ? 0.72 : 1) * this.qualityScale;
    let n = Math.max(60, Math.round(arch.stars * scale));
    const geo = shellGeometry(arch);
    const v0 = arch.v0;
    const asym = arch.asym ?? 0.12;

    const ax = 1 + rand(-asym, asym) * 0.7;
    const ay = 1 + rand(-asym, asym) * 0.7;
    const az = 1 + rand(-asym, asym) * 0.7;
    const bias = new THREE.Vector3(rand(-asym, asym), rand(-asym, asym) * 0.6, rand(-asym, asym));
    const tilt = new THREE.Euler(rand(0, 6.28), rand(0, 6.28), rand(0, 6.28));
    const q = new THREE.Quaternion().setFromEuler(tilt);

    const hot = hexToRGB(arch.colors[0]);
    const chem = hexToRGB(arch.colors[1]);
    const pistilC = arch.pistilColor ? hexToRGB(arch.pistilColor) : chem;

    const split = arch.split;
    let nPrim = n, nSec = 0;
    if (split) {
      nPrim = Math.max(24, Math.round(n / (split.n + 1)));
      nSec = nPrim * split.n;
    }
    const start = this.alloc(nPrim + nSec);
    const d = [0, 0, 0];
    const tmp = new THREE.Vector3();

    for (let i = 0; i < nPrim; i++) {
      let dvx, dvy, dvz, speed = v0;
      switch (k) {
        case KERNEL.RING: {
          const a = (i / nPrim) * Math.PI * 2 + rand(-0.03, 0.03);
          tmp.set(Math.cos(a), rand(-0.06, 0.06), Math.sin(a)).applyQuaternion(q);
          dvx = tmp.x; dvy = tmp.y; dvz = tmp.z; break;
        }
        case KERNEL.DIADEM: {
          const a = (i / nPrim) * Math.PI * 2;
          const spike = i % 7 === 0;
          tmp.set(Math.cos(a) * (spike ? 1.35 : 0.95), rand(-0.12, 0.12) + (spike ? 0.35 : 0), Math.sin(a) * (spike ? 1.35 : 0.95)).applyQuaternion(q);
          dvx = tmp.x; dvy = tmp.y; dvz = tmp.z; speed *= spike ? 1.15 : 1; break;
        }
        case KERNEL.SPIRAL: {
          const arm = i % 5, f = i / nPrim;
          const a = f * Math.PI * 3.4 + arm * (Math.PI * 2 / 5);
          const rad = 0.35 + f * 0.75;
          tmp.set(Math.cos(a) * rad, (f - 0.5) * 0.9, Math.sin(a) * rad).normalize().applyQuaternion(q);
          dvx = tmp.x; dvy = tmp.y; dvz = tmp.z; break;
        }
        case KERNEL.PALM: {
          FireworkSystem.sphereDir(i, nPrim, d);
          tmp.set(d[0], Math.abs(d[1]) * 0.55 + 0.35, d[2]).normalize();
          dvx = tmp.x; dvy = tmp.y; dvz = tmp.z; speed *= 0.92; break;
        }
        case KERNEL.FALLINGLEAVES:
        case KERNEL.EMBER: {
          FireworkSystem.sphereDir(i, nPrim, d);
          tmp.set(d[0] * 0.8, d[1] * 0.5 + 0.35, d[2] * 0.8).normalize();
          dvx = tmp.x; dvy = tmp.y; dvz = tmp.z; speed *= 0.55; break;
        }
        case KERNEL.SALUTE: {
          FireworkSystem.sphereDir(i, nPrim, d);
          dvx = d[0]; dvy = d[1]; dvz = d[2]; speed *= 1.0; break;
        }
        default: {
          FireworkSystem.sphereDir(i, nPrim, d);
          const r = Math.cbrt(Math.random());
          tmp.set(d[0] * r, d[1] * r * (k === KERNEL.WILLOW ? 0.82 : 1), d[2] * r);
          const inner = arch.pistil > 0 && Math.random() < arch.pistil;
          const f = inner ? 0.42 : 1.0;
          dvx = tmp.x * f; dvy = tmp.y * f; dvz = tmp.z * f;
          speed *= inner ? 0.52 : Math.pow(r, 0.22);
        }
      }
      let vx = dvx * speed * ax + bias.x * speed;
      let vy = dvy * speed * ay + bias.y * speed;
      let vz = dvz * speed * az + bias.z * speed;
      const jitter = 1 + rand(-0.07, 0.07);
      vx *= jitter; vy *= jitter; vz *= jitter;

      const inner = arch.pistil > 0 && Math.hypot(dvx, dvy, dvz) < 0.62;
      const life = arch.burn * rand(0.82, 1.18) * (inner ? 1.25 : 1);

      this.write(start + i, {
        x: b.x, y: b.y, z: b.z,
        vx, vy, vz, birth: b.tBreak + (k === KERNEL.SALUTE ? 0 : rand(0, 0.03)),
        life,
        ca: hot, cb: inner ? pistilC : chem,
        size: arch.size * rand(0.75, 1.3) * (k === KERNEL.PALM ? 1.4 : 1),
        seed: Math.random() * 10,
        type: k, drag: arch.drag * rand(0.9, 1.1), grav: arch.grav,
        strobe: arch.strobe ? arch.strobe * rand(0.9, 1.1) : 0,
        crackle: arch.crackleAmt || 0, splitT: 0, splitI: 0, curl: 0.5 + arch.smoke,
        pistil: inner ? 1 : 0, glitter: arch.glitter || 0,
        trail: arch.trail ?? 0.7, smoke: arch.smoke ?? 0.35,
        spin: arch.spin ? arch.spin * (Math.random() < 0.5 ? -1 : 1) : 0,
        flutter: arch.flutter || 0, shard: 0, ghost: arch.ghost || 0,
      });

      if (split) {
        const ts = split.t;
        const kd = arch.drag;
        const px = b.x + vx * (1 - Math.exp(-kd * ts)) / kd;
        const py = b.y + vy * (1 - Math.exp(-kd * ts)) / kd - 0.5 * arch.grav * ts * ts;
        const pz = b.z + vz * (1 - Math.exp(-kd * ts)) / kd;
        const rem = Math.hypot(vx, vy, vz) * Math.exp(-kd * ts);
        const up = Math.abs(vy / (rem || 1)) > 0.9 ? [1, 0, 0] : [0, 1, 0];
        const e1 = new THREE.Vector3(vx, vy, vz).normalize();
        const e2 = new THREE.Vector3().crossVectors(e1, new THREE.Vector3(...up)).normalize();
        const e3 = new THREE.Vector3().crossVectors(e1, e2).normalize();
        for (let s = 0; s < split.n; s++) {
          const a = (s / split.n) * Math.PI * 2 + rand(-0.12, 0.12);
          const dir = new THREE.Vector3()
            .addScaledVector(e2, Math.cos(a))
            .addScaledVector(e3, Math.sin(a))
            .addScaledVector(e1, k === KERNEL.MULTIBREAK ? 0.35 : 0.1)
            .normalize();
          const imp = split.impulse * rand(0.85, 1.15);
          const base = start + nPrim + i * split.n + s;
          this.write(base, {
            x: px, y: py, z: pz,
            vx: dir.x * imp + e1.x * rem, vy: dir.y * imp + e1.y * rem, vz: dir.z * imp + e1.z * rem,
            birth: b.tBreak + ts, life: Math.max(0.9, life - ts) * (k === KERNEL.MULTIBREAK ? 1.35 : 1),
            ca: hot, cb: chem,
            size: arch.size * (k === KERNEL.MULTIBREAK ? 0.85 : 1.0) * rand(0.8, 1.2),
            seed: Math.random() * 10,
            type: KERNEL.SPHERE,
            drag: arch.drag * 1.15, grav: arch.grav * 1.05,
            strobe: 0, crackle: arch.crackleAmt || 0, splitT: 0, splitI: 0, curl: 0.6,
            pistil: 0, glitter: arch.glitter || 0, trail: 0.9, smoke: 0.3,
            spin: 0, flutter: 0, shard: 0, ghost: arch.ghost || 0,
          });
        }
      }
    }

    const ns = Math.round((arch.smoke ?? 0.35) * 26 * scale) + 3;
    const ss = this.allocSmoke(Math.min(ns, this.smoke.count));
    const smokeTint = hexToRGB('#14161F').map((v, i) => v * 0.88 + chem[i] * 0.12);
    for (let i = 0; i < ns; i++) {
      FireworkSystem.sphereDir(i, ns, d);
      const sp = rand(1.4, 4.4);
      this.writeSmoke(ss + i, {
        x: b.x, y: b.y, z: b.z,
        vx: d[0] * sp, vy: d[1] * sp * 0.5 + 0.6, vz: d[2] * sp,
        birth: b.tBreak + rand(0, 0.25), life: rand(3.6, 6.4),
        c: smokeTint, seed: Math.random(), size: rand(9, 20), grow: rand(26, 46),
      });
    }

    if (k === KERNEL.WILLOW || k === KERNEL.FALLINGLEAVES || k === KERNEL.EMBER) {
      const ne = Math.round(arch.stars * 0.35 * scale);
      const es = this.alloc(Math.min(ne, this.pool.count));
      for (let i = 0; i < ne; i++) {
        FireworkSystem.sphereDir(i, ne, d);
        const sp = v0 * rand(0.35, 0.75);
        this.write(es + i, {
          x: b.x, y: b.y, z: b.z,
          vx: d[0] * sp, vy: d[1] * sp * 0.5, vz: d[2] * sp,
          birth: b.tBreak + rand(0.3, 1.4), life: arch.burn * rand(1.1, 1.6),
          ca: hot, cb: chem, size: arch.size * rand(0.5, 0.95), seed: Math.random() * 10,
          type: KERNEL.EMBER, drag: 1.0, grav: arch.grav * 0.45, strobe: 0,
          crackle: 0, splitT: 0, splitI: 0, curl: 1.1,
          pistil: 0, glitter: arch.glitter || 0.3, trail: 1.0, smoke: 0.1,
          spin: 0, flutter: 1.1, shard: 0, ghost: 0,
        });
      }
    }

    b.broken = true;
    this.pools.push({ x: b.x, z: b.z, born: b.tBreak, life: Math.min(arch.burn + 1.6, 7),
                      c: chem, r: geo.radius * 1.5, peak: clamp(arch.caliber / 10, 0.35, 1.4) });
    if (this.pools.length > 12) this.pools.shift();
    this.onBreak?.(b);
  }

  /* -------------------------------------------------------------- update */
  update(dt, elapsed) {
    this.time = elapsed;
    const hasWork = this.pending.length > 0 || this.bursts.length > 0;
    this.group.visible = hasWork && !this._paused;
    if (!hasWork) return;

    this.uMain.uTime.value = elapsed; this.uMirror.uTime.value = elapsed;
    this.uSmoke.uTime.value = elapsed; this.uSmokeM.uTime.value = elapsed;
    this.uMain.uWindAmp.value = this.wind; this.uMirror.uWindAmp.value = this.wind;
    this.uMain.uSizeScale.value = this.sizeScale; this.uMirror.uSizeScale.value = this.sizeScale;
    this.uSmoke.uSizeScale.value = this.sizeScale; this.uSmokeM.uSizeScale.value = this.sizeScale;
    this.uMain.uStretch.value = this.stretch; this.uMirror.uStretch.value = this.stretch;

    for (let i = this.pending.length - 1; i >= 0; i--) {
      if (elapsed >= this.pending[i].tBreak) { this._break(this.pending[i]); this.pending.splice(i, 1); }
    }
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      if (b.broken && elapsed > b.born + b.life) this.bursts.splice(i, 1);
    }
    for (let i = this.pools.length - 1; i >= 0; i--) {
      if (elapsed > this.pools[i].born + this.pools[i].life) this.pools.splice(i, 1);
    }
    this.pool.flush(); this.smoke.flush();
    this.group.visible = (this.pending.length > 0 || this.bursts.length > 0) && !this._paused;
  }

  clear() {
    this.pending.length = 0;
    this.bursts.length = 0;
    this.pools.length = 0;
    this.group.visible = false;
  }

  live() { return this.bursts.filter(b => b.broken); }

  setPaused(p) {
    this._paused = !!p;
    this.group.visible = !this._paused && (this.pending.length > 0 || this.bursts.length > 0);
  }

  setQuality(q) { this.qualityScale = Math.max(0.34, Math.min(1, q)); }
}
