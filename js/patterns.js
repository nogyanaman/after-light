/* ============================================================================
   AFTER LIGHT · patterns.js
   Stage 2 — the four messages. One field of nodes, four states, no cuts.

   The four messages are not four scenes. They are four states of ONE system:
   the same 1,144 nodes, the same 3,293 edges, the same identity, morphed by a
   single scroll clock. Node #417 in "the record of it" is the same node that
   falls inward in "everything falls inward" — which is what makes the four
   backgrounds read as connected rather than as four separate animations.

     00  CONSTELLATION  nodes drift around their homes, linked to near neighbours
     01  CIRCUIT        they snap to the exact lattice: an orthogonal record
     02  RUPTURE        pushed out from three fracture centres, links stretch thin
     03  VORTEX         spiral inward, links become radial spokes
     04  SINGULARITY    collapse to a point and drain away

   The clock is `t = p × 4`, so each quarter of the track is one morph and each
   message names exactly what the field is doing while you are reading it:

     p 0.00–0.25  constellation → circuit    "The record of it, laid out in plates."
     p 0.25–0.50  circuit → rupture          "It breaks. Small pieces…"
     p 0.50–0.75  rupture → vortex           "Everything falls inward."
     p 0.75–1.00  vortex → singularity       "The sky takes over from here."

   All of it is one draw call for the lines and one for the nodes: positions are
   evaluated in the vertex shader, so the CPU touches two uniforms per frame and
   nothing else.
   ----------------------------------------------------------------------------
   Driven by ONE normalized clock p ∈ [0,1] from the scroll track (the field itself
   is only ever shown on the threshold; the messages run without it).
   ========================================================================== */
import * as THREE from 'three';
import { clamp, lerp, smoothstep, prefersReducedMotion } from './tokens.js';

const COLS = 44;
const ROWS = 26;

/* Shared GLSL: node identity and the four-state morph.
   Both the line pass and the point pass call nodePos(), which is what keeps
   the edges glued to the nodes through every transition. */
const FIELD_GLSL = /* glsl */`
  uniform float uP;        // 0..1 scroll clock
  uniform float uTime;
  uniform float uAspect;
  uniform float uFade;
  uniform float uEnergy;   // scroll velocity, 0..1
  uniform float uSize;
  uniform vec2  uPointer;  // normalized pointer (-1..1)

  float hash1(float n){ return fract(sin(n * 127.1) * 43758.5453123); }
  vec2  hash2(float n){ return vec2(hash1(n), hash1(n * 1.371)); }

  const float COLS = ${COLS}.0;
  const float ROWS = ${ROWS}.0;

  /* where node i sits on the jittered lattice */
  vec2 latticeHome(float id){
    float ix = mod(id, COLS);
    float iy = floor(id / COLS);
    vec2 g = vec2((ix + 0.5) / COLS, (iy + 0.5) / ROWS) * 2.0 - 1.0;
    vec2 j = (hash2(id * 1.7 + 0.3) - 0.5) * vec2(2.0 / COLS, 2.0 / ROWS) * 0.88;
    return g + j;
  }

  /* the un-jittered cell centre — the lattice snaps to this in state 01 */
  vec2 latticeCell(float id){
    float ix = mod(id, COLS);
    float iy = floor(id / COLS);
    return vec2((ix + 0.5) / COLS, (iy + 0.5) / ROWS) * 2.0 - 1.0;
  }

  /* three fracture centres, chosen by node so the plate breaks in three places */
  vec2 fractureCentre(float id){
    float k = floor(hash1(id * 5.13) * 3.0);
    if (k < 1.0) return vec2(-0.62,  0.42);
    if (k < 2.0) return vec2( 0.58,  0.18);
    return vec2(-0.05, -0.62);
  }

  /* ── the four states ──────────────────────────────────────────────────── */
  vec2 nodeState0(float id, vec2 home, float h1, float h2, float t){
    return home + vec2(sin(t * 0.21 + h1 * 6.2831),
                       cos(t * 0.17 + h2 * 6.2831)) * (0.010 + 0.012 * h1);
  }
  vec2 nodeState1(float id, vec2 home, float h1, float h2, float t){
    // a printed record: exact lattice, a very slight settle
    vec2 c = latticeCell(id);
    return c + vec2(sin(t * 0.09 + h2 * 6.2831), 0.0) * 0.0016;
  }
  vec2 nodeState2(float id, vec2 home, float h1, float h2, float t){
    vec2 fc = fractureCentre(id);
    vec2 d = home - fc;
    float r = max(length(d), 0.0001);
    vec2 dir = d / r;
    float push = 0.10 + 0.34 * h2 + 0.10 * (1.0 - smoothstep(0.0, 1.2, r));
    vec2 p = home + dir * push;
    // shards keep trembling after they let go
    return p + vec2(sin(t * 1.6 + h1 * 12.0), cos(t * 1.9 + h2 * 12.0)) * 0.0045;
  }
  vec2 nodeState3(float id, vec2 home, float h1, float h2, float t){
    float r = length(home);
    float a = atan(home.y, home.x);
    // inner nodes wind tighter than outer ones — that is what makes it a vortex
    float aa = a + 1.15 + 2.9 / (r + 0.50) + (0.20 + 0.25 * h1);
    float rr = mix(r, pow(r, 1.42) * 0.62, 1.0) * (0.92 + 0.10 * h2);
    return vec2(cos(aa), sin(aa)) * rr;
  }

  /* collapse: everything the vortex gathered, drained to a point */
  vec2 nodeState4(float id, vec2 home, float h1, float h2, float t){
    float r = length(home);
    float a = atan(home.y, home.x);
    float aa = a + 2.4 + 3.6 / (r + 0.40) + h1 * 0.9;
    float rr = r * (0.045 + 0.05 * h2);
    return vec2(cos(aa), sin(aa)) * rr;
  }

  /* how far the singularity has taken over, 0 → 1 across the last quarter */
  float collapseAmt(){ return clamp(uP * 4.0 - 3.0, 0.0, 1.0); }

  /* chain the states so p → one continuous morph, never a cut */
  vec2 nodePos(float id, float t){
    vec2 home = latticeHome(id);
    float h1 = hash1(id * 3.1 + 0.7);
    float h2 = hash1(id * 7.7 + 1.3);
    vec2 p = nodeState0(id, home, h1, h2, t);
    p = mix(p, nodeState1(id, home, h1, h2, t), clamp(uP * 4.0 - 0.0, 0.0, 1.0));
    p = mix(p, nodeState2(id, home, h1, h2, t), clamp(uP * 4.0 - 1.0, 0.0, 1.0));
    p = mix(p, nodeState3(id, home, h1, h2, t), clamp(uP * 4.0 - 2.0, 0.0, 1.0));
    p = mix(p, nodeState4(id, home, h1, h2, t), collapseAmt());
    /* Aspect compensation only ever *widens* the field. Multiplying x by an
       aspect below 1 (any portrait phone) used to squeeze the whole lattice
       into a narrow vertical column; on tall screens the field instead keeps
       its full width and lets the lattice stretch, which reads as a grid
       filling the frame rather than as streaks in the middle of it. */
    float ax = max(uAspect, 1.0);
    float ay = min(1.0, max(uAspect, 0.35) * 1.35);   // keep cells square-ish on tall screens
    vec2 scaled = p * vec2(ax, ay);
    // Subtle magnetic field tilt around cursor in screen space
    vec2 m = uPointer * vec2(ax, ay);
    vec2 md = scaled - m;
    float mr = length(md);
    if (mr > 0.001 && mr < 0.52) {
      float push = (1.0 - smoothstep(0.0, 0.52, mr)) * 0.045 * (1.0 - collapseAmt());
      scaled += (md / mr) * push;
    }
    return scaled;
  }

  /* per-state colour: cool bone → ember → rupture magenta → white core */
  vec3 fieldColour(){
    vec3 c0 = vec3(0.72, 0.80, 0.94);
    vec3 c1 = vec3(1.00, 0.70, 0.34);
    vec3 c2 = vec3(1.00, 0.50, 0.60);
    vec3 c3 = vec3(1.00, 0.94, 0.87);
    vec3 c4 = vec3(1.00, 0.86, 0.62);
    vec3 c = c0;
    c = mix(c, c1, clamp(uP * 4.0 - 0.0, 0.0, 1.0));
    c = mix(c, c2, clamp(uP * 4.0 - 1.0, 0.0, 1.0));
    c = mix(c, c3, clamp(uP * 4.0 - 2.0, 0.0, 1.0));
    c = mix(c, c4, collapseAmt());
    return c;
  }

  /* a clearing in the middle so the message always has somewhere to sit */
  float centreClear(vec2 p){
    float d = length(p * vec2(0.66, 1.0));
    return mix(0.16, 1.0, smoothstep(0.14, 0.62, d));
  }

  /* a slow scan line sweeping the field, plus a flash on every state change */
  float fieldPulse(vec2 p, float t){
    float scan = exp(-pow((p.y - (sin(uTime * 0.13) * 0.85)) * 3.4, 2.0));
    float edge = exp(-pow(fract(uP * 4.0) * 7.0, 2.0)) * 0.38;
    return 1.0 + scan * 0.34 + edge + uEnergy * 0.22;
  }
`;

/* the fragment stages only need the colour of the current morph */
const FIELD_FRAG_GLSL = /* glsl */`
  uniform float uP;
  float collapseAmt(){ return clamp(uP * 4.0 - 3.0, 0.0, 1.0); }
  vec3 fieldColour(){
    vec3 c0 = vec3(0.72, 0.80, 0.94);
    vec3 c1 = vec3(1.00, 0.70, 0.34);
    vec3 c2 = vec3(1.00, 0.50, 0.60);
    vec3 c3 = vec3(1.00, 0.94, 0.87);
    vec3 c4 = vec3(1.00, 0.86, 0.62);
    vec3 c = c0;
    c = mix(c, c1, clamp(uP * 4.0 - 0.0, 0.0, 1.0));
    c = mix(c, c2, clamp(uP * 4.0 - 1.0, 0.0, 1.0));
    c = mix(c, c3, clamp(uP * 4.0 - 2.0, 0.0, 1.0));
    c = mix(c, c4, collapseAmt());
    return c;
  }
`;

export class PatternField {
  /**
   * @param {THREE.PerspectiveCamera} camera  the field rides the camera
   */
  constructor(camera, { reduced = prefersReducedMotion() } = {}) {
    this.camera = camera;
    this.reduced = reduced;
    this.p = 0;
    this.energy = 0;
    this.fade = 0;
    this.targetFade = 0;
    this.targetDim = 1;
    this.dim = 1;

    const count = COLS * ROWS;
    this.count = count;

    /* ── the connectivity, built once ─────────────────────────────────────
       right, down, and one hashed diagonal per cell. Every state re-weights
       these same edges; none of them are ever rebuilt. */
    const edges = [];
    const addEdge = (a, b, type) => {
      const seed = ((Math.sin(a * 12.9898 + b * 78.233) * 43758.5453) % 1 + 1) % 1;
      edges.push(a, b, type, seed);
    };
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const i = y * COLS + x;
        if (x < COLS - 1) addEdge(i, i + 1, 0);
        if (y < ROWS - 1) addEdge(i, i + COLS, 1);
        if (x < COLS - 1 && y < ROWS - 1) addEdge(i, i + COLS + 1, 2);
      }
    }
    const segN = edges.length / 4;

    const aA = new Float32Array(segN * 2);
    const aB = new Float32Array(segN * 2);
    const aEnd = new Float32Array(segN * 2);
    const aType = new Float32Array(segN * 2);
    const aSeed = new Float32Array(segN * 2);
    for (let s = 0; s < segN; s++) {
      const a = edges[s * 4], b = edges[s * 4 + 1], type = edges[s * 4 + 2], seed = edges[s * 4 + 3];
      aA[s * 2] = a; aA[s * 2 + 1] = a;
      aB[s * 2] = b; aB[s * 2 + 1] = b;
      aEnd[s * 2] = 0; aEnd[s * 2 + 1] = 1;
      aType[s * 2] = type; aType[s * 2 + 1] = type;
      aSeed[s * 2] = seed; aSeed[s * 2 + 1] = seed;
    }

    this.uniforms = {
      uP: { value: 0 },
      uTime: { value: 0 },
      uAspect: { value: 1.7 },
      uFade: { value: 0 },
      uEnergy: { value: 0 },
      uSize: { value: 1 },
      uPointer: { value: new THREE.Vector2(9, 9) },
    };

    /* ── lines ───────────────────────────────────────────────────────────── */
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(segN * 2 * 3), 3));
    lg.setAttribute('aA', new THREE.BufferAttribute(aA, 1));
    lg.setAttribute('aB', new THREE.BufferAttribute(aB, 1));
    lg.setAttribute('aEnd', new THREE.BufferAttribute(aEnd, 1));
    lg.setAttribute('aType', new THREE.BufferAttribute(aType, 1));
    lg.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1));
    this.lines = new THREE.LineSegments(lg, new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: FIELD_GLSL + /* glsl */`
        attribute float aA; attribute float aB; attribute float aEnd;
        attribute float aType; attribute float aSeed;
        varying float vA; varying vec2 vP;
        void main(){
          vec3 pa = vec3(nodePos(aA, uTime), 0.0);
          vec3 pb = vec3(nodePos(aB, uTime), 0.0);
          vec3 p  = mix(pa, pb, aEnd);
          vP = p.xy;

          /* how visible this edge is, per state */
          float a0 = (aType < 1.5 ? 0.32 : 0.46) * step(0.50, aSeed);
          float a1 = (aType < 1.5 ? 0.58 : 0.03);
          float a2 = 0.52;
          float a3 = 0.60;
          float a = a0;
          a = mix(a, a1, clamp(uP * 4.0 - 0.0, 0.0, 1.0));
          a = mix(a, a2, clamp(uP * 4.0 - 1.0, 0.0, 1.0));
          a = mix(a, a3, clamp(uP * 4.0 - 2.0, 0.0, 1.0));

          /* rupture: a stretched link goes thin, the way a real one would */
          float len = length(pb.xy - pa.xy);
          a *= mix(1.0, 1.0 / (1.0 + len * 5.2), clamp(uP * 4.0 - 1.0, 0.0, 1.0));
          /* vortex: links to the inside brighten as they are pulled in */
          a *= 1.0 + clamp(uP * 4.0 - 2.0, 0.0, 1.0) * 0.55 * (1.0 - smoothstep(0.0, 0.9, length(p.xy)));
          /* singularity: the whole field drains away and the sky takes over */
          a *= 1.0 - collapseAmt() * 0.94;

          vA = a * uFade * centreClear(p.xy) * fieldPulse(p.xy, uTime);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: FIELD_FRAG_GLSL + /* glsl */`
        varying float vA; varying vec2 vP;
        void main(){
          vec3 c = fieldColour();
          // the centre of the field runs hotter than its edges
          c = mix(c, c * 1.35 + vec3(0.10, 0.05, 0.0), 1.0 - smoothstep(0.0, 1.1, length(vP)));
          gl_FragColor = vec4(c * vA, vA);
          if (gl_FragColor.r + gl_FragColor.g + gl_FragColor.b < 0.002) discard;
        }`,
      transparent: true, depthTest: false, depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 999;

    /* ── nodes ───────────────────────────────────────────────────────────── */
    const ids = new Float32Array(count);
    for (let i = 0; i < count; i++) ids[i] = i;
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    pg.setAttribute('aId', new THREE.BufferAttribute(ids, 1));
    this.nodes = new THREE.Points(pg, new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: FIELD_GLSL + /* glsl */`
        attribute float aId;
        varying float vA; varying vec2 vP;
        void main(){
          vec3 p = vec3(nodePos(aId, uTime), 0.0);
          vP = p.xy;
          float tw = 0.72 + 0.55 * sin(uTime * (0.7 + fract(aId * 0.37) * 2.1) + aId * 2.4);
          float sz = mix(1.8, 3.3, clamp(uP * 4.0 - 1.0, 0.0, 1.0));
          sz = mix(sz, 2.3, clamp(uP * 4.0 - 2.0, 0.0, 1.0));
          sz = mix(sz, 1.4, collapseAmt());
          float nearM = 1.0 - smoothstep(0.0, 0.45, length(p.xy - uPointer * vec2(uAspect, 1.0)));
          gl_PointSize = sz * uSize * (0.68 + tw * 0.72 + nearM * 0.55);
          vA = uFade * centreClear(p.xy) * fieldPulse(p.xy, uTime) * (0.44 + tw * 0.34 + nearM * 0.28)
               * (1.0 - collapseAmt() * 0.94);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: FIELD_FRAG_GLSL + /* glsl */`
        varying float vA; varying vec2 vP;
        void main(){
          vec2 uv = gl_PointCoord * 2.0 - 1.0;
          float d = dot(uv, uv);
          if (d > 1.0) discard;
          float core = pow(max(1.0 - d, 0.0), 2.2);
          vec3 c = fieldColour() + vec3(0.16) * core;
          gl_FragColor = vec4(c * core * vA, core * vA);
        }`,
      transparent: true, depthTest: false, depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    this.nodes.frustumCulled = false;
    this.nodes.renderOrder = 1000;

    /* ── both ride the camera, so the field is screen-space ──────────────── */
    this.dist = 12;
    this.plane = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    this.plane.frustumCulled = false;
    this.plane.position.z = -this.dist;
    this.plane.add(this.lines, this.nodes);
    camera.add(this.plane);
    this.group = this.plane;
    this.resize();
  }

  /** Keep the field exactly filling the frame, whatever the aspect. */
  resize() {
    const cam = this.camera;
    if (!cam) return;
    const h = 2 * Math.tan((cam.fov * Math.PI / 180) / 2) * this.dist;
    const w = h * cam.aspect;
    this.plane.scale.set(w / 2, h / 2, 1);
    this.uniforms.uAspect.value = cam.aspect;
    this.uniforms.uSize.value = Math.max(0.7, Math.min(1.8, window.innerHeight / 900));
  }

  /** Fade the field in (1) or out (0). */
  show(on = true) { this.targetFade = on ? 1 : 0; }

  /**
   * Hold the field back by a factor (1 = full strength). The scroll chapters
   * dim it to a third: the constellation web is the subject of the threshold
   * and the background of the messages, and at full strength it fights the
   * headline instead of sitting behind it.
   */
  setDim(v = 1) { this.targetDim = clamp(v, 0, 1); }

  setPointer(ndcX, ndcY) {
    this.uniforms.uPointer.value.set(ndcX, ndcY);
  }

  update(p, elapsed, energy = 0, dt = 0.016) {
    this.p = p;
    this.uniforms.uP.value = p;
    this.uniforms.uTime.value = elapsed;
    this.uniforms.uEnergy.value = clamp(energy, 0, 1);
    const rate = this.reduced ? 6 : 2.1;
    const step = Math.min(0.05, Math.max(0.001, dt || 0.016));
    this.fade += (this.targetFade - this.fade) * Math.min(1, rate * step);
    this.dim += ((this.targetDim ?? 1) - this.dim) * Math.min(1, 2.2 * step);
    /* Crisp enough to read clearly behind the scroll chapters while leaving the
       centre halo open for the headline. */
    this.uniforms.uFade.value = this.fade * 0.78 * this.dim;
    this.lines.visible = this.nodes.visible = this.fade > 0.004;
  }

  dispose() {
    if (this.plane) {
      this.plane.parent?.remove(this.plane);
      this.plane.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
      });
    }
    this.plane = null;
  }
}
