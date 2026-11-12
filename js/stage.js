/* ============================================================================
   AFTER LIGHT · stage.js
   THE LIVING CELESTIAL OBSERVATORY & INFINITE OBSIDIAN MIRROR.
   - Deep cosmic nebula, Milky Way dust band, and reactive horizon aurora dome
   - Infinite wet-obsidian mirror plane with astronomical range rings & live
     specular light pools beneath active firework bursts
   - 13,000 stars + 57 recognized constellations + ambient constellation
     filaments + 3D drifting starlight motes
   - Critically-damped spring 3-camera director rig (WIDE / DRONE / AUTO)
     with smooth banking, target handover, and 3D orbital choreography
   ========================================================================== */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { clamp, lerp, prefersReducedMotion } from './tokens.js';

const VOID_COLOR = 0x05070E;
const FOG_COLOR = 0x04060C;
const FOG_DENSITY = 0.00095;

const GROUND_SHADER = {
  name: 'GroundShader',
  uniforms: { tDiffuse: { value: null }, uGround: { value: null } },
  vertexShader: `varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec3 uGround; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      gl_FragColor = vec4(c.rgb + uGround - c.rgb * uGround, c.a);
    }`,
};

const ACCENT = 0x6E82FF;
const ACCENT_PALE = 0xD8F3E9;
const ACCENT_FLASH = 0xF7F9FF;

const CONSTELLATIONS = [
  {
    name: 'ORION', az: 0, el: 12.5,
    stars: [
      ['BETELGEUSE', -2.8,  3.5, 3.5, 0.96],
      ['BELLATRIX',   2.4,  3.1, 2.7, 0.08],
      ['MEISSA',     -0.2,  5.2, 2.1, 0.14],
      ['ALNITAK',    -1.0,  0.1, 2.6, 0.06],
      ['ALNILAM',     0.0,  0.4, 2.8, 0.06],
      ['MINTAKA',     1.0,  0.7, 2.5, 0.06],
      ['SAIPH',      -2.2, -3.5, 2.4, 0.08],
      ['RIGEL',       2.7, -3.4, 3.7, 0.04],
    ],
    edges: [[2,0],[2,1],[0,1],[0,3],[1,5],[3,4],[4,5],[3,6],[5,7],[6,7]],
  },
  {
    name: 'URSA MAJOR', az: -12, el: 27,
    stars: [
      ['DUBHE',   2.6,  1.5, 3.0, 0.78],
      ['MERAK',   2.7, -0.7, 2.6, 0.15],
      ['PHECDA',  0.5, -1.2, 2.5, 0.16],
      ['MEGREZ',  0.2,  0.5, 2.1, 0.20],
      ['ALIOTH', -1.8,  0.9, 2.9, 0.14],
      ['MIZAR',  -3.6,  1.2, 2.6, 0.15],
      ['ALKAID', -5.4,  0.3, 2.8, 0.06],
    ],
    edges: [[0,1],[1,2],[2,3],[3,0],[3,4],[4,5],[5,6]],
  },
  {
    name: 'CASSIOPEIA', az: 13.5, el: 24.5,
    stars: [
      ['CAPH',      -3.2,  0.8, 2.6, 0.38],
      ['SCHEDAR',   -1.7, -0.9, 2.8, 0.80],
      ['GAMMA CAS',  0.0,  0.6, 2.7, 0.06],
      ['RUCHBAH',    1.6, -1.1, 2.4, 0.18],
      ['SEGIN',      3.1,  0.9, 2.2, 0.08],
    ],
    edges: [[0,1],[1,2],[2,3],[3,4]],
  },
  {
    name: 'LYRA', az: 1.5, el: 25.5,
    stars: [
      ['VEGA',      -1.4,  1.4, 3.8, 0.06],
      ['ZETA LYR',  -0.2,  0.4, 2.0, 0.22],
      ['SHELIAK',    0.2, -1.3, 2.4, 0.14],
      ['SULAFAT',    1.7, -1.4, 2.5, 0.12],
      ['DELTA LYR',  1.4,  0.3, 2.1, 0.72],
    ],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,1]],
  },
  {
    name: 'CYGNUS', az: 15.5, el: 13,
    stars: [
      ['DENEB',    1.4,  3.2, 3.5, 0.10],
      ['SADR',     0.2,  0.6, 2.7, 0.45],
      ['GIENAH',  -2.4, -0.6, 2.5, 0.76],
      ['FAWARIS',  2.7,  0.9, 2.4, 0.14],
      ['ALBIREO', -1.8, -2.9, 2.4, 0.84],
    ],
    edges: [[0,1],[1,4],[2,1],[1,3]],
  },
  {
    name: 'LEO', az: -14, el: 12,
    stars: [
      ['REGULUS',  -2.2, -1.4, 3.3, 0.08],
      ['ETA LEO',  -2.4,  0.2, 2.2, 0.15],
      ['ALGIEBA',  -1.3,  1.6, 2.8, 0.80],
      ['ADHAFERA', -0.4,  2.7, 2.3, 0.38],
      ['ZOSMA',     1.9,  0.9, 2.5, 0.20],
      ['DENEBOLA',  4.0, -0.5, 2.9, 0.18],
    ],
    edges: [[0,1],[1,2],[2,3],[2,4],[4,5],[0,4]],
  },
  {
    name: 'TAURUS', az: -15, el: 3.5,
    stars: [
      ['ALDEBARAN', 1.4, -0.5, 3.6, 0.94],
      ['HYADUM I',  0.1, -1.0, 2.2, 0.76],
      ['AIN',      -0.3,  0.5, 2.3, 0.78],
      ['ELNATH',    4.1,  2.9, 3.0, 0.06],
      ['TIANGUAN',  4.4, -0.7, 2.4, 0.08],
    ],
    edges: [[3,2],[2,1],[1,0],[0,4]],
  },
  {
    name: 'CANIS MAJOR', az: 0.5, el: 1.8,
    stars: [
      ['SIRIUS',    0.3,  2.1, 4.0, 0.04],
      ['MIRZAM',   -1.8,  1.2, 2.7, 0.06],
      ['MULIPHEIN', 1.9,  1.7, 2.1, 0.10],
      ['WEZEN',     0.5, -1.2, 2.9, 0.45],
      ['ADHARA',   -0.9, -2.5, 3.1, 0.05],
      ['ALUDRA',    2.2, -2.2, 2.6, 0.08],
    ],
    edges: [[1,0],[0,2],[0,3],[3,4],[3,5]],
  },
  {
    name: 'AQUILA', az: 14, el: 2.5,
    stars: [
      ['ALTAIR',    0.2,  0.7, 3.5, 0.18],
      ['TARAZED',  -0.5,  2.0, 2.6, 0.85],
      ['ALSHAIN',   0.8, -0.6, 2.3, 0.62],
      ['OKAB',     -2.8, -1.2, 2.4, 0.15],
      ['THETA AQL', 2.9, -1.6, 2.2, 0.14],
    ],
    edges: [[1,0],[0,2],[3,0],[0,4]],
  },
  {
    name: 'SCORPIUS', az: 23, el: 7.5,
    stars: [
      ['GRAFFIAS', -1.8,  2.6, 2.5, 0.08],
      ['DSCHUBBA', -1.9,  1.3, 2.6, 0.06],
      ['ANTARES',  -0.4,  0.3, 3.7, 0.98],
      ['EPSILON SCO',0.8, -1.6, 2.5, 0.82],
      ['SARGAS',    1.2, -3.2, 2.7, 0.42],
      ['SHAULA',    2.6, -2.5, 3.1, 0.06],
    ],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,5]],
  },
  {
    name: 'GEMINI', az: -24.5, el: 24.5,
    stars: [
      ['CASTOR',  -1.0,  2.2, 3.0, 0.12],
      ['POLLUX',   1.0,  1.4, 3.2, 0.80],
      ['MEBSUTA', -1.6, -0.1, 2.4, 0.78],
      ['TEJAT',   -2.2, -2.1, 2.3, 0.90],
      ['WASAT',    0.8, -0.5, 2.2, 0.36],
      ['ALHENA',   1.2, -2.4, 2.8, 0.14],
    ],
    edges: [[0,1],[0,2],[2,3],[1,4],[4,5]],
  },
  {
    name: 'URSA MINOR', az: -36.0, el: 32.3,
    stars: [
      ['POLARIS', 0.9, 3.0, 3.3, 0.30],
      ['δ UMi', 0.6, 1.0, 2.2, 0.20],
      ['ε UMi', 0.2, -0.4, 2.1, 0.24],
      ['ζ UMi', -0.4, -1.5, 2.2, 0.18],
      ['β UMi', -1.0, -2.7, 2.6, 0.44],
      ['γ UMi', -1.6, -1.9, 2.3, 0.62],
      ['η UMi', -1.5, -0.6, 1.9, 0.40]],
    edges: [[0,1], [1,2], [2,3], [3,4], [4,5], [5,6], [6,1]],
  },
  {
    name: 'CEPHEUS', az: -32.1, el: 40.0,
    stars: [
      ['α CEP', 1.8, 2.4, 2.9, 0.86],
      ['β CEP', 2.4, -0.6, 2.7, 0.12],
      ['γ CEP', 0.3, -2.6, 2.5, 0.74],
      ['δ CEP', -1.5, -0.2, 2.3, 0.66],
      ['ζ CEP', -1.9, 2.0, 2.2, 0.80],
      ['ι CEP', -0.2, 1.9, 1.9, 0.70]],
    edges: [[0,1], [1,2], [2,3], [3,4], [4,0]],
  },
  {
    name: 'DRACO', az: -36.0, el: 23.9,
    stars: [
      ['γ DRA', 3.4, 2.0, 2.5, 0.72],
      ['η DRA', 2.0, 0.6, 2.2, 0.55],
      ['ζ DRA', 0.9, -0.4, 2.2, 0.50],
      ['ι DRA', 0.0, 0.4, 1.9, 0.40],
      ['θ DRA', -1.0, 0.0, 2.0, 0.34],
      ['α DRA', -2.4, 0.9, 2.8, 0.58],
      ['ξ DRA', -2.0, -1.4, 1.9, 0.30]],
    edges: [[0,1], [1,2], [2,3], [3,4], [4,5], [5,6]],
  },
  {
    name: 'LYNX', az: -36.0, el: 15.2,
    stars: [
      ['α LYN', 2.6, 1.4, 2.7, 0.60],
      ['38 LYN', 1.2, 0.5, 2.0, 0.42],
      ['31 LYN', 0.0, -0.2, 2.1, 0.35],
      ['21 LYN', -1.2, -1.1, 1.9, 0.28],
      ['β LYN', -2.4, -2.3, 2.3, 0.48]],
    edges: [[0,1], [1,2], [2,3], [3,4]],
  },
  {
    name: 'PERSEUS', az: -19.9, el: 40.0,
    stars: [
      ['MIRFAK', 1.9, 1.3, 2.9, 0.52],
      ['ALGOL', 0.2, -0.5, 2.7, 0.22],
      ['ρ PER', 0.9, 1.6, 2.1, 0.70],
      ['δ PER', 0.6, -2.2, 2.4, 0.30],
      ['ε PER', 1.9, -1.9, 2.4, 0.20],
      ['ξ PER', 2.6, -0.2, 2.2, 0.40],
      ['ζ PER', 2.1, 1.9, 2.1, 0.78]],
    edges: [[0,1], [1,3], [3,4], [4,5], [5,0], [2,0]],
  },
  {
    name: 'ANDROMEDA', az: -25.0, el: 32.7,
    stars: [
      ['ALPHERATZ', 2.7, -0.9, 2.8, 0.16],
      ['MIRACH', 3.2, -0.1, 2.5, 0.68],
      ['δ AND', 1.4, -0.6, 2.1, 0.44],
      ['ALMACH', 0.0, -1.0, 2.6, 0.92],
      ['μ AND', 1.0, -1.0, 1.8, 0.30],
      ['ν AND', 1.9, -0.4, 1.8, 0.34]],
    edges: [[0,1], [1,2], [2,3], [0,5], [5,4]],
  },
  {
    name: 'CANES VENATICI', az: -21.8, el: 15.5,
    stars: [
      ['COR CAROLI', 0.4, 0.6, 2.6, 0.60],
      ['CHARA', -1.6, -0.6, 2.4, 0.86],
      ['β CVn', -1.1, 0.9, 2.6, 0.62]],
    edges: [[0,1], [1,2]],
  },
  {
    name: 'BOOTES', az: -29.1, el: 17.2,
    stars: [
      ['ARCTURUS', 0.4, -0.4, 3.8, 0.88],
      ['NEKKAR', 0.0, 2.0, 2.6, 0.86],
      ['SEGINUS', -0.4, 1.4, 2.3, 0.14],
      ['IZAR', 0.6, 2.2, 2.5, 0.66],
      ['MUFRID', -1.8, 0.4, 2.6, 0.70],
      ['δ BOO', -1.0, -1.4, 2.3, 0.30],
      ['ρ BOO', 1.9, 0.6, 2.0, 0.40]],
    edges: [[0,1], [1,2], [1,3], [3,6], [0,4], [4,5], [5,0]],
  },
  {
    name: 'CORONA BOREALIS', az: -36.0, el: 7.3,
    stars: [
      ['ALPHECCA', 0.0, 0.5, 3.0, 0.30],
      ['β CrB', 1.0, 0.9, 2.2, 0.52],
      ['γ CrB', 1.8, 0.4, 2.1, 0.48],
      ['δ CrB', 2.3, -0.5, 1.9, 0.56],
      ['ε CrB', 1.9, -1.3, 2.1, 0.66],
      ['θ CrB', 0.9, -1.5, 2.0, 0.70],
      ['ι CrB', 0.0, -1.2, 1.8, 0.74]],
    edges: [[0,1], [1,2], [2,3], [3,4], [4,5], [5,6]],
  },
  {
    name: 'HERCULES', az: -8.4, el: 40.0,
    stars: [
      ['KORNEPHOROS', 1.6, 2.0, 2.8, 0.72],
      ['π HER', 2.2, 0.6, 2.2, 0.30],
      ['ζ HER', 1.0, 0.2, 2.5, 0.62],
      ['ε HER', 0.6, -1.6, 2.4, 0.42],
      ['δ HER', 0.2, 0.9, 2.6, 0.50],
      ['ZETA HER B', -1.2, 1.3, 1.9, 0.40],
      ['μ HER', -0.2, -0.6, 2.0, 0.60]],
    edges: [[0,1], [1,2], [2,3], [3,4], [4,5], [5,2]],
  },
  {
    name: 'AURIGA', az: -3.4, el: 32.6,
    stars: [
      ['CAPELLA', 0.4, 1.5, 3.6, 0.68],
      ['MENKALINAN', 2.0, -0.2, 2.9, 0.42],
      ['MAHASIM', 1.7, -2.2, 2.4, 0.16],
      ['δ AUR', 0.0, -1.4, 2.2, 0.40],
      ['ζ AUR', -1.5, -2.3, 2.2, 0.60],
      ['AL ANZ', -2.0, -0.4, 2.3, 0.78]],
    edges: [[0,1], [1,2], [2,3], [3,4], [4,5], [5,0]],
  },
  {
    name: 'TRIANGULUM', az: 3.9, el: 40.0,
    stars: [
      ['α TRI', 1.4, 0.6, 2.6, 0.50],
      ['β TRI', 0.0, -0.8, 2.3, 0.34],
      ['γ TRI', 2.0, -0.9, 2.2, 0.10]],
    edges: [[0,1], [1,2], [2,0]],
  },
  {
    name: 'PISCES', az: -15.4, el: 20.6,
    stars: [
      ['ALRESCHA', -2.4, 0.4, 2.3, 0.36],
      ['ν PSC', -1.2, 0.9, 1.9, 0.30],
      ['η PSC', 0.4, 1.3, 2.0, 0.40],
      ['γ PSC', 1.6, 2.2, 2.2, 0.62],
      ['ω PSC', 2.6, 0.8, 1.8, 0.44],
      ['ι PSC', 2.2, -1.0, 1.9, 0.22],
      ['θ PSC', 0.9, -1.3, 1.9, 0.24],
      ['ε PSC', -0.6, -1.5, 1.8, 0.20]],
    edges: [[0,1], [1,2], [2,3], [3,4], [4,5], [5,6], [6,7], [7,0]],
  },
  {
    name: 'ARIES', az: -7.3, el: 15.7,
    stars: [
      ['HAMAL', -0.3, 1.1, 3.0, 0.84],
      ['SHERATAN', 1.0, 0.6, 2.6, 0.30],
      ['MESARTHIM', 2.3, 1.1, 2.5, 0.42],
      ['41 ARI', 1.6, -0.9, 1.9, 0.32]],
    edges: [[0,1], [1,2], [1,3]],
  },
  {
    name: 'CETUS', az: 25.8, el: 35.1,
    stars: [
      ['MENKAR', 3.6, 0.4, 2.8, 0.90],
      ['α CET', 2.4, -0.6, 2.3, 0.55],
      ['γ CET', 1.0, 0.9, 2.2, 0.18],
      ['MIRA', 0.0, 0.0, 2.7, 0.94],
      ['δ CET', -1.2, -0.9, 2.1, 0.24],
      ['β CET', -2.4, 0.2, 2.5, 0.78],
      ['η CET', -3.2, 1.3, 1.9, 0.50]],
    edges: [[0,1], [1,2], [2,3], [3,4], [4,5], [5,6]],
  },
  {
    name: 'OPHIUCHUS', az: 7.2, el: 8.4,
    stars: [
      ['RASALHAGUE', 0.6, 2.6, 3.0, 0.80],
      ['CEPHEI', 0.2, 1.4, 2.2, 0.44],
      ['ν OPH', 0.4, 0.2, 2.1, 0.36],
      ['SABIK', 0.0, -1.2, 2.6, 0.26],
      ['ζ OPH', 1.4, -1.6, 2.2, 0.10],
      ['δ OPH', -1.2, -0.8, 2.4, 0.24],
      ['υ OPH', -1.6, 1.1, 2.0, 0.30]],
    edges: [[0,1], [1,2], [2,3], [3,4], [3,5], [5,6], [6,1]],
  },
  {
    name: 'SERPENS', az: 23.8, el: 25.8,
    stars: [
      ['UNUKALHAI', 0.0, -1.4, 3.0, 0.88],
      ['ε SER', 0.8, -0.4, 2.2, 0.50],
      ['δ SER', 1.4, 0.8, 2.2, 0.46],
      ['α SER', 1.0, 2.0, 2.4, 0.78],
      ['β SER', -0.4, 2.2, 2.3, 0.30],
      ['μ SER', -1.5, 1.4, 2.0, 0.24]],
    edges: [[0,1], [1,2], [2,3], [3,4], [4,5]],
  },
  {
    name: 'LIBRA', az: -21.0, el: -1.9,
    stars: [
      ['ZUBENELGENUBI', 1.1, -0.6, 2.8, 0.62],
      ['ZUBENESHAMALI', -0.9, 1.0, 2.7, 0.24],
      ['γ LIB', -1.6, -1.4, 2.1, 0.46],
      ['σ LIB', 1.9, 1.3, 2.0, 0.58]],
    edges: [[0,1], [1,2], [2,3]],
  },
  {
    name: 'VIRGO', az: -23.1, el: 7.3,
    stars: [
      ['SPICA', 1.2, -2.4, 3.8, 0.18],
      ['PORRIMA', -0.6, 1.4, 2.4, 0.30],
      ['VINDEMIATRIX', -1.2, 2.4, 2.4, 0.52],
      ['ZAVIJAVA', 1.6, 1.6, 2.5, 0.56],
      ['ZANIAH', 2.0, 0.2, 2.2, 0.40],
      ['HEZE', 0.6, -0.4, 2.3, 0.22],
      ['ζ VIR', -1.8, -0.6, 1.9, 0.24]],
    edges: [[0,1], [1,2], [1,3], [3,4], [4,5], [5,0], [1,6]],
  },
  {
    name: 'CORVUS', az: -8.4, el: -1.2,
    stars: [
      ['ALGORAB', -0.8, 1.4, 2.6, 0.66],
      ['GIENAH', 1.2, 1.1, 2.7, 0.28],
      ['ALCHIBA', 0.9, -1.0, 2.4, 0.36],
      ['MINKAR', -1.0, -1.1, 2.3, 0.58],
      ['η CRV', 1.9, -1.5, 1.9, 0.44]],
    edges: [[0,1], [1,2], [2,3], [3,0], [2,4]],
  },
  {
    name: 'CRATER', az: -36.0, el: -8.0,
    stars: [
      ['ALKES', 0.0, 1.4, 2.7, 0.72],
      ['β CRT', 1.6, 0.9, 2.2, 0.50],
      ['γ CRT', 1.2, -0.8, 1.9, 0.36],
      ['δ CRT', 0.0, -1.2, 2.0, 0.28]],
    edges: [[0,1], [1,2], [2,3], [3,0]],
  },
  {
    name: 'HYDRA', az: -28.8, el: 1.2,
    stars: [
      ['ALPHARD', 3.0, 0.9, 3.2, 0.86],
      ['υ1 HYA', 1.8, -0.6, 2.0, 0.42],
      ['ν HYA', 0.6, -1.2, 1.9, 0.32],
      ['δ HYA', -0.8, -0.6, 2.2, 0.38],
      ['γ HYA', -2.0, 0.2, 2.2, 0.48],
      ['GIAUSAR', -3.2, 0.8, 2.0, 0.86]],
    edges: [[0,1], [1,2], [2,3], [3,4], [4,5]],
  },
  {
    name: 'SCUTUM', az: 36.0, el: 31.7,
    stars: [
      ['DENEB KAITOS', -2.2, 0.6, 2.6, 0.70],
      ['θ CET', -0.8, 0.0, 2.2, 0.44],
      ['ι CET', 0.6, -0.7, 2.0, 0.30],
      ['ζ CET', 1.9, 0.3, 2.1, 0.26]],
    edges: [[0,1], [1,2], [2,3]],
  },
  {
    name: 'CENTAURUS', az: -6.1, el: -8.0,
    stars: [
      ['RIGIL KENTAURUS', -1.4, -0.6, 3.9, 0.82],
      ['HADAR', -0.2, 0.9, 3.2, 0.14],
      ['MENKENT', 1.4, -1.2, 2.6, 0.74],
      ['δ CEN', -2.3, 1.3, 2.4, 0.16],
      ['ε CEN', -0.9, 2.0, 2.2, 0.10]],
    edges: [[0,1], [0,2], [0,3], [3,4]],
  },
  {
    name: 'CRUX', az: 36.0, el: 40.0,
    stars: [
      ['ACRUX', -1.1, -1.0, 3.2, 0.10],
      ['MIMOSA', 1.0, 0.4, 3.0, 0.08],
      ['GACRUX', -1.3, 1.1, 2.8, 0.94],
      ['IMAI', 0.9, -1.3, 2.6, 0.26],
      ['δ CRU', 1.6, 1.4, 1.9, 0.30]],
    edges: [[0,1], [2,3], [1,4]],
  },
  {
    name: 'CANIS MINOR', az: -6.6, el: 7.0,
    stars: [
      ['PROCYON', 0.0, -0.3, 3.6, 0.44],
      ['GIENAH CMi', 1.5, 1.0, 2.3, 0.52]],
    edges: [[0,1]],
  },
  {
    name: 'MONOCEROS', az: -5.4, el: 22.6,
    stars: [
      ['α MON', 1.6, -1.0, 2.3, 0.60],
      ['γ MON', 0.6, -0.2, 2.2, 0.74],
      ['δ MON', -0.6, 0.6, 2.3, 0.28],
      ['β MON', -1.8, 1.3, 2.4, 0.18]],
    edges: [[0,1], [1,2], [2,3]],
  },
  {
    name: 'LEPUS', az: -15.1, el: -8.0,
    stars: [
      ['ARNEB', -1.6, -0.4, 2.9, 0.84],
      ['NIHAL', -0.4, -1.6, 2.6, 0.60],
      ['ε LEP', 0.8, -1.0, 2.4, 0.50],
      ['μ LEP', 1.6, 0.6, 2.2, 0.44],
      ['ζ LEP', 0.2, 1.2, 2.0, 0.40]],
    edges: [[0,1], [1,2], [2,3], [3,4]],
  },
  {
    name: 'PUPPIS', az: 2.1, el: -8.0,
    stars: [
      ['NAOS', -2.0, 0.8, 3.4, 0.06],
      ['ρ PUP', -0.6, 0.0, 2.2, 0.62],
      ['π PUP', 0.6, -0.8, 2.4, 0.52],
      ['τ PUP', 1.8, 0.4, 2.2, 0.44]],
    edges: [[0,1], [1,2], [2,3]],
  },
  {
    name: 'VELA', az: 7.3, el: -0.9,
    stars: [
      ['SUHAIL', -1.6, -0.8, 3.4, 0.78],
      ['γ VEL', 0.8, 0.9, 2.6, 0.40],
      ['δ VEL', 1.4, -0.6, 2.4, 0.50],
      ['κ VEL', -0.2, 1.4, 2.2, 0.36]],
    edges: [[0,1], [1,2], [2,0], [1,3]],
  },
  {
    name: 'CARINA', az: 10.8, el: -8.0,
    stars: [
      ['CANOPUS', -1.2, -0.9, 3.9, 0.34],
      ['MIAPLACIDUS', 1.2, 0.4, 2.8, 0.16],
      ['ASPIDISKE', 0.4, -1.8, 2.6, 0.20],
      ['θ CAR', 2.0, 1.2, 2.2, 0.10],
      ['υ CAR', 0.0, 1.6, 2.0, 0.70]],
    edges: [[0,1], [0,2], [1,3], [1,4]],
  },
  {
    name: 'ERIDANUS', az: -27.0, el: -8.0,
    stars: [
      ['ACHERNAR', 2.8, -0.6, 3.8, 0.22],
      ['θ ERI', 1.6, 0.4, 2.3, 0.36],
      ['γ ERI', 0.4, 1.0, 2.5, 0.46],
      ['δ ERI', -0.8, 0.4, 2.4, 0.66],
      ['ε ERI', -2.0, -0.4, 2.6, 0.72],
      ['ζ ERI', -3.0, 0.8, 2.0, 0.30]],
    edges: [[0,1], [1,2], [2,3], [3,4], [4,5]],
  },
  {
    name: 'COLUMBA', az: -36.0, el: -0.6,
    stars: [
      ['PHACT', -1.4, 0.8, 2.6, 0.18],
      ['Wazn', 0.4, -1.2, 2.4, 0.66],
      ['δ COL', 1.2, 0.6, 2.0, 0.50]],
    edges: [[0,1], [1,2]],
  },
  {
    name: 'PISCIS AUSTRINUS', az: 36.0, el: 23.5,
    stars: [
      ['FOMALHAUT', 1.6, -0.2, 3.6, 0.30],
      ['δ PsA', 0.2, 0.9, 2.2, 0.42],
      ['γ PsA', -1.4, 1.0, 2.1, 0.48],
      ['ε PsA', -1.6, -0.9, 2.0, 0.40]],
    edges: [[0,1], [1,2], [2,3], [3,0]],
  },
  {
    name: 'CAPRICORNUS', az: 25.6, el: 16.5,
    stars: [
      ['DENEB ALGEDI', -1.8, 0.4, 2.9, 0.52],
      ['β CAP', 0.0, 1.1, 2.6, 0.70],
      ['ψ CAP', 1.4, 0.4, 2.2, 0.36],
      ['ω CAP', 1.0, -1.2, 2.0, 0.30],
      ['ζ CAP', -0.6, -1.0, 2.0, 0.40]],
    edges: [[0,1], [1,2], [2,3], [3,4]],
  },
  {
    name: 'DELPHINUS', az: 16.3, el: 7.2,
    stars: [
      ['SUALOCIN', 0.9, 0.8, 2.5, 0.10],
      ['ROTANEV', 0.4, -0.4, 2.3, 0.60],
      ['δ DEL', 1.4, -1.0, 2.1, 0.44],
      ['γ DEL', -0.4, 0.2, 2.2, 0.40],
      ['ε DEL', 2.0, 0.4, 2.0, 0.30]],
    edges: [[0,1], [1,2], [2,3], [3,0], [0,4]],
  },
  {
    name: 'SAGITTA', az: 7.3, el: 17.8,
    stars: [
      ['γ SGE', -0.8, 0.4, 2.1, 0.50],
      ['δ SGE', 0.4, 0.8, 1.9, 0.42],
      ['α SGE', 0.6, -0.6, 2.2, 0.66],
      ['β SGE', 1.7, 0.9, 2.0, 0.54]],
    edges: [[0,1], [1,3], [0,2], [2,3]],
  },
  {
    name: 'SAGITTARIUS', az: 28.7, el: 0.4,
    stars: [
      ['KAUS AUSTRALIS', -1.0, -1.4, 2.8, 0.62],
      ['KAUS MEDIA', -2.0, -0.4, 2.4, 0.66],
      ['KAUS BOREALIS', -1.2, 1.2, 2.4, 0.72],
      ['ALNASL', 0.4, 0.6, 2.6, 0.70],
      ['NUNKI', 1.2, -0.2, 2.9, 0.36],
      ['ASCELLA', 0.8, -1.2, 2.4, 0.44]],
    edges: [[0,1], [1,2], [2,3], [3,4], [4,0], [4,5]],
  },
  {
    name: 'AQUARIUS', az: 16.0, el: 40.0,
    stars: [
      ['SADALMELIK', -1.2, 1.3, 2.8, 0.66],
      ['SADALSAAUD', 1.2, 0.4, 2.6, 0.62],
      ['δ AQR', 0.8, -1.0, 2.2, 0.56],
      ['ζ AQR', -0.4, -1.2, 2.1, 0.50],
      ['η AQR', 1.6, 1.6, 2.1, 0.40]],
    edges: [[0,1], [1,2], [2,3], [3,0], [1,4]],
  },
  {
    name: 'ARA', az: 36.0, el: 15.4,
    stars: [
      ['β ARA', 0.8, 0.6, 2.4, 0.62],
      ['α ARA', -0.6, 1.0, 2.6, 0.70],
      ['γ ARA', -1.2, -0.8, 2.2, 0.40],
      ['ζ ARA', 0.6, -1.4, 2.0, 0.30]],
    edges: [[0,1], [1,3], [1,2], [2,3]],
  },
  {
    name: 'TRIANGULUM AUSTRALE', az: 27.3, el: -8.0,
    stars: [
      ['ATRIA', 1.4, -0.6, 3.0, 0.86],
      ['β TrA', 0.0, 0.9, 2.4, 0.30],
      ['γ TrA', -1.4, -0.6, 2.4, 0.14]],
    edges: [[0,1], [1,2], [2,0]],
  },
  {
    name: 'PAVO', az: 36.0, el: 1.4,
    stars: [
      ['PEACOCK', -1.2, 0.6, 2.9, 0.10],
      ['β PAV', 0.6, 1.2, 2.3, 0.44],
      ['δ PAV', 1.2, -0.8, 2.2, 0.62],
      ['η PAV', -0.6, -1.4, 2.0, 0.30]],
    edges: [[0,1], [1,2], [2,3]],
  },
  {
    name: 'GRUS', az: 36.0, el: -8.0,
    stars: [
      ['ALNAIR', -1.4, -0.8, 2.9, 0.10],
      ['β GRU', 0.2, 0.4, 2.6, 0.34],
      ['δ1 GRU', 1.4, 1.0, 2.2, 0.40],
      ['ε GRU', 1.2, -0.8, 2.1, 0.52]],
    edges: [[0,1], [1,2], [1,3]],
  },
  {
    name: 'PHOENIX', az: 18.7, el: -8.0,
    stars: [
      ['ANKAA', -0.8, -1.0, 2.9, 0.42],
      ['β PHO', 0.4, 0.4, 2.5, 0.56],
      ['γ PHO', 1.6, 1.0, 2.2, 0.50],
      ['δ PHO', 1.4, -1.0, 2.0, 0.36]],
    edges: [[0,1], [1,2], [1,3]],
  },
  {
    name: 'CORONA AUSTRALIS', az: 31.4, el: 9.0,
    stars: [
      ['β CrA', -1.2, 0.2, 1.9, 0.40],
      ['α CrA', 0.0, 0.8, 2.7, 0.30],
      ['γ CrA', 1.2, 0.2, 2.0, 0.44],
      ['ε CrA', 1.0, -1.0, 1.9, 0.30]],
    edges: [[0,1], [1,2], [2,3]],
  },
  {
    name: 'NORMA', az: 21.1, el: -0.9,
    stars: [
      ['γ2 Nor', -0.6, 0.8, 2.0, 0.66],
      ['ε Nor', 0.8, 0.2, 2.1, 0.24],
      ['η Nor', 0.4, -1.2, 1.9, 0.30]],
    edges: [[0,1], [1,2]],
  },
];

function hexToVec3(hex) {
  const h = String(hex || '#ffc46b').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16) || 0xffc46b;
  return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

export class Stage {
  constructor(canvas, tier) {
    this.tier = tier;
    this.clock = new THREE.Clock();
    this.elapsed = 0;
    this.paused = false;
    this.mode = 'WIDE';
    this.userHoldUntil = 0;
    this.quality = 1;

    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: tier === 'high', powerPreference: 'high-performance',
      stencil: false, alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, tier === 'high' ? 1.75 : 1.35));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.32;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this._voidDirect = new THREE.Color(VOID_COLOR);
    this._voidGraded = new THREE.Color(0x000000);
    this.scene.background = this._voidGraded;
    this.renderer.setClearColor(VOID_COLOR, 1);
    this.scene.fog = new THREE.FogExp2(FOG_COLOR, FOG_DENSITY);
    this.fogDensity = FOG_DENSITY;
    this.camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.5, 6000);
    this.camera.position.set(0, 3.2, 48);
    this.scene.add(this.camera);
    this.target = new THREE.Vector3(0, 3.2, 48);
    this.lookAt = new THREE.Vector3(0, 26, -80);
    this._smoothPos = new THREE.Vector3(0, 3.2, 48);
    this._smoothLook = new THREE.Vector3(0, 26, -80);
    this._posVel = new THREE.Vector3();
    this._lookVel = new THREE.Vector3();
    this._camRoll = 0;
    this._starGainT = 0;
    this._autoAz = -0.28;
    this._targetFov = 46;
    this._smoothTargetAnchor = new THREE.Vector3(0, 36, -75);
    this._hasTargetAnchor = false;

    this._initCosmicDome();
    this._initObsidianMirror();
    this._initStarField();
    this._initAmbientMotes();

    /* --- post ------------------------------------------------------------ */
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(Math.round(window.innerWidth * 0.5), Math.round(window.innerHeight * 0.5)), 0.72, 0.42, 0.52);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    const ground = new ShaderPass(GROUND_SHADER);
    ground.uniforms.uGround.value = new THREE.Vector3(
      ((VOID_COLOR >> 16) & 255) / 255, ((VOID_COLOR >> 8) & 255) / 255, (VOID_COLOR & 255) / 255);
    this.composer.addPass(ground);

    this.raycaster = new THREE.Raycaster();
    this.splineQueue = [];
    this._tmp = new THREE.Vector3();
    this._tmp2 = new THREE.Vector3();
    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
  }

  /* ── 1. Cosmic Nebula, Milky Way Dust Band & Reactive Aurora Sky Dome ─── */
  _initCosmicDome() {
    this.skyUniforms = {
      uTime: { value: 0 },
      uBurstPos: { value: new THREE.Vector3(0, 40, -75) },
      uBurstColor: { value: new THREE.Vector3(0.45, 0.55, 1.0) },
      uBurstGlow: { value: 0 },
    };
    const skyGeo = new THREE.SphereGeometry(2900, 48, 32);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uBurstPos;
        uniform vec3 uBurstColor;
        uniform float uBurstGlow;
        varying vec3 vWorldPos;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
            f.y
          );
        }
        float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
          for (int i = 0; i < 4; i++) {
            v += a * noise(p);
            p = rot * p * 2.04;
            a *= 0.5;
          }
          return v;
        }

        void main() {
          vec3 dir = normalize(vWorldPos);
          float y = clamp(dir.y, -0.2, 1.0);

          // Deep void zenith to subtle sapphire-indigo horizon airglow
          vec3 zenith = vec3(0.016, 0.022, 0.048);
          vec3 midSky = vec3(0.032, 0.046, 0.098);
          vec3 horizon = vec3(0.065, 0.092, 0.185);
          vec3 col = mix(horizon, midSky, smoothstep(-0.04, 0.26, y));
          col = mix(col, zenith, smoothstep(0.22, 0.82, y));

          // Diagonal Milky Way & celestial nebula dust band across the vault
          vec3 mwAxis = normalize(vec3(0.42, 0.72, 0.55));
          float mwPlane = abs(dot(dir, mwAxis));
          float mwBand = exp(-mwPlane * mwPlane * 11.5);
          vec2 uv = vec2(atan(dir.x, -dir.z) * 1.8, dir.y * 2.4);
          float n1 = fbm(uv * 2.2 + vec2(uTime * 0.004, -uTime * 0.002));
          float n2 = fbm(uv * 4.5 - vec2(uTime * 0.006, uTime * 0.003));
          float dustRift = smoothstep(0.36, 0.68, n2);
          vec3 nebulaCool = vec3(0.16, 0.24, 0.52);
          vec3 nebulaWarm = vec3(0.32, 0.22, 0.48);
          vec3 mwCol = mix(nebulaCool, nebulaWarm, n1) * (0.45 + 0.75 * n1) * (1.0 - 0.52 * dustRift);
          col += mwCol * mwBand * smoothstep(0.0, 0.22, y) * 0.42;

          // Subtle high-latitude celestial aurora ribbons near the northern horizon
          float aurY = smoothstep(0.02, 0.16, y) * (1.0 - smoothstep(0.18, 0.46, y));
          float aurWave = sin(dir.x * 5.5 + uTime * 0.18 + n1 * 2.8) * 0.5 + 0.5;
          float aurCurtain = pow(aurWave, 2.6) * fbm(vec2(dir.x * 8.0 + uTime * 0.08, y * 6.0));
          vec3 aurCol = mix(vec3(0.22, 0.68, 0.58), vec3(0.36, 0.42, 0.92), smoothstep(0.06, 0.34, y));
          col += aurCol * aurY * aurCurtain * 0.18;

          // Reactive atmospheric scattering from active firework bursts
          vec3 bDir = normalize(uBurstPos);
          float bDot = max(0.0, dot(dir, bDir));
          float scatter = pow(bDot, 4.5) * 0.28 + pow(bDot, 18.0) * 0.35;
          col += uBurstColor * scatter * uBurstGlow;

          // Horizon rim glow
          float rim = exp(-abs(dir.y) * 26.0);
          col += vec3(0.14, 0.22, 0.44) * rim * 0.24;

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.skyDome = new THREE.Mesh(skyGeo, skyMat);
    this.skyDome.frustumCulled = false;
    this.scene.add(this.skyDome);
  }

  /* ── 2. Infinite Wet-Obsidian Mirror & Astronomical Range Grid ─────────── */
  _initObsidianMirror() {
    const MAX_POOLS = 6;
    this._poolPos = Array.from({ length: MAX_POOLS }, () => new THREE.Vector3(0, -999, 0));
    this._poolCol = Array.from({ length: MAX_POOLS }, () => new THREE.Vector3(0, 0, 0));
    this._poolData = Array.from({ length: MAX_POOLS }, () => new THREE.Vector3(0, 1, 0)); // x=intensity, y=radius, z=age

    this.floorUniforms = {
      uTime: { value: 0 },
      uCamPos: { value: new THREE.Vector3() },
      uPoolPos: { value: this._poolPos },
      uPoolCol: { value: this._poolCol },
      uPoolData: { value: this._poolData },
    };

    const floorGeo = new THREE.PlaneGeometry(2400, 2400, 1, 1);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.ShaderMaterial({
      uniforms: this.floorUniforms,
      transparent: true,
      depthWrite: false,
      fog: false,
      vertexShader: `
        varying vec3 vWorld;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uCamPos;
        uniform vec3 uPoolPos[6];
        uniform vec3 uPoolCol[6];
        uniform vec3 uPoolData[6];
        varying vec3 vWorld;

        float hash21(vec2 p) {
          p = fract(p * vec2(234.34, 435.345));
          p += dot(p, p + 34.23);
          return fract(p.x * p.y);
        }

        void main() {
          // Center observatory grid around (0, 0, -75) where the fireworks rise
          vec2 center = vec2(0.0, -75.0);
          vec2 p = vWorld.xz - center;
          float r = length(p);
          float camDist = length(vWorld.xz - uCamPos.xz);

          // Exponential distance fade so the floor melts invisibly into the void
          float fogFade = exp(-0.000018 * camDist * camDist);
          if (fogFade < 0.004) discard;

          // Subtle micro-rippled wet-obsidian surface texture
          float ripple = sin(p.x * 0.35 + uTime * 0.4) * cos(p.y * 0.42 - uTime * 0.32);

          // Concentric astronomical range rings every 38 units + fine sub-rings
          float ringDist = abs(fract(r / 38.0 + 0.5) - 0.5) * 38.0;
          float majorRing = smoothstep(0.65, 0.0, ringDist) * smoothstep(12.0, 28.0, r) * smoothstep(260.0, 95.0, r);
          float subRingDist = abs(fract(r / 9.5 + 0.5) - 0.5) * 9.5;
          float minorRing = smoothstep(0.35, 0.0, subRingDist) * smoothstep(18.0, 35.0, r) * smoothstep(180.0, 70.0, r);

          // Azimuth radial spokes (12 spokes = every 30 degrees)
          float ang = atan(p.y, p.x);
          float spokeDist = abs(fract(ang * 12.0 / 6.2831853 + 0.5) - 0.5) * (6.2831853 / 12.0) * r;
          float spoke = smoothstep(0.55, 0.0, spokeDist) * smoothstep(22.0, 42.0, r) * smoothstep(230.0, 90.0, r);

          // Rotating astronomical radar/sweep meridian pulse
          float sweepAng = mod(ang - uTime * 0.14 + 3.14159, 6.2831853) - 3.14159;
          float sweep = exp(-abs(sweepAng) * 4.5) * smoothstep(18.0, 40.0, r) * smoothstep(220.0, 80.0, r);

          vec3 gridCol = vec3(0.34, 0.46, 0.88) * (majorRing * 0.22 + minorRing * 0.055 + spoke * 0.12 + sweep * 0.08);

          // Dynamic specular light pools reflected from 3D fireworks overhead
          vec3 reflCol = vec3(0.0);
          for (int i = 0; i < 6; i++) {
            float intensity = uPoolData[i].x;
            if (intensity > 0.005) {
              vec2 d = vWorld.xz - uPoolPos[i].xz;
              // Stretch reflection along view ray toward camera like real wet obsidian / water
              vec2 toCam = normalize(uCamPos.xz - uPoolPos[i].xz + vec2(0.0001));
              vec2 perp = vec2(-toCam.y, toCam.x);
              float along = dot(d, toCam);
              float across = dot(d, perp);
              float spread = max(16.0, uPoolData[i].y * 1.45);
              float ellip = sqrt((across * across) / (spread * spread * 0.55) + (along * along) / (spread * spread * 2.2));
              float pool = exp(-ellip * ellip * 1.65);
              float shimmer = 0.78 + 0.22 * sin(along * 0.55 - uTime * 3.2 + across * 0.4);
              reflCol += uPoolCol[i] * pool * intensity * shimmer * 0.55;
            }
          }

          // Faint reflected starlight glints on the obsidian crust
          vec2 cell = floor(vWorld.xz * 0.45);
          float spark = step(0.994, hash21(cell)) * (0.5 + 0.5 * sin(uTime * 1.8 + hash21(cell + 7.1) * 6.28));
          vec3 glintCol = vec3(0.65, 0.78, 1.0) * spark * 0.16 * smoothstep(220.0, 40.0, r);

          vec3 finalCol = gridCol + reflCol + glintCol + vec3(0.015, 0.022, 0.045) * (0.5 + 0.5 * ripple) * 0.25;
          float alpha = clamp((length(gridCol) * 1.3 + length(reflCol) * 0.85 + spark * 0.18 + 0.08) * fogFade, 0.0, 0.88);
          gl_FragColor = vec4(finalCol, alpha);
        }
      `,
    });
    this.obsidianMirror = new THREE.Mesh(floorGeo, floorMat);
    this.obsidianMirror.position.y = 0;
    this.obsidianMirror.visible = false;
    this.obsidianMirror.frustumCulled = false;
    this.scene.add(this.obsidianMirror);
  }

  /* ── 3. Starfield + 57 Constellations + Ambient Filaments ──────────────── */
  _initStarField() {
    const N = 13000;
    const pos = new Float32Array(N * 3);
    const sz = new Float32Array(N);
    const tint = new Float32Array(N);
    const phase = new Float32Array(N);

    const camOrigin = this.camera.position;
    const R_DOME = 2200;
    this._constellations = [];
    let si = 0;
    for (const c of CONSTELLATIONS) {
      const starsMeta = [];
      let cx = 0, cy = 0, cz = 0;
      for (const [starName, dAz, dEl, starSize, starTint] of c.stars) {
        const azRad = ((c.az + dAz) * Math.PI) / 180;
        const elRad = ((c.el + dEl) * Math.PI) / 180;
        const cosEl = Math.cos(elRad);
        const x = camOrigin.x + R_DOME * Math.sin(azRad) * cosEl;
        const y = camOrigin.y + R_DOME * Math.sin(elRad);
        const z = camOrigin.z - R_DOME * Math.cos(azRad) * cosEl;
        pos[si * 3] = x;
        pos[si * 3 + 1] = y;
        pos[si * 3 + 2] = z;
        sz[si] = starSize * 1.12;
        tint[si] = starTint;
        phase[si] = (si * 1.37) % 6.2831;
        starsMeta.push({ name: starName, x, y, z, size: starSize });
        cx += x; cy += y; cz += z;
        si++;
      }
      const nStars = Math.max(1, starsMeta.length);
      this._constellations.push({
        name: c.name,
        stars: starsMeta,
        edges: c.edges,
        center: new THREE.Vector3(cx / nStars, cy / nStars, cz / nStars),
      });
    }

    for (let i = si; i < N; i++) {
      const r = 2200, th = Math.random() * Math.PI * 2;
      const ph = Math.acos(Math.random() * 0.96 + 0.02);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = Math.abs(r * Math.cos(ph)) * 0.9 + 18;
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
      const mag = Math.random();
      sz[i] = 0.72 + Math.pow(mag, 3.6) * 2.9;
      tint[i] = Math.pow(Math.random(), 1.6);
      phase[i] = Math.random() * 6.2831;
    }

    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sg.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
    sg.setAttribute('aTint', new THREE.BufferAttribute(tint, 1));
    sg.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    this.stars = new THREE.Points(sg, new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uGain: { value: 0 }, uCalm: { value: 1 } },
      vertexShader: `attribute float aSize; attribute float aTint; attribute float aPhase;
        varying float vT; varying float vB; varying float vM;
        uniform float uTime; uniform float uCalm;
        void main(){
          vT = aTint;
          float rate = 0.5 + (1.0 - clamp(aSize/4.0,0.0,1.0)) * 2.4;
          float lively = 0.55 * sin(uTime * rate + aPhase);
          float steady = 0.09 * sin(uTime * rate * 0.14 + aPhase);
          vB = 0.76 + mix(lively, steady, uCalm);
          vM = mix(1.0, 0.18 + 0.82 * pow(clamp((aSize - 0.6) / 3.0, 0.0, 1.0), 1.2), uCalm);
          vec4 mv = modelViewMatrix * vec4(position,1.0);
          gl_PointSize = max(mix(1.6, 3.0, uCalm), aSize * (2500.0 / max(1.0, -mv.z)));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `varying float vT; varying float vB; varying float vM;
        uniform float uGain; uniform float uCalm;
        void main(){
          vec2 uv = gl_PointCoord * 2.0 - 1.0;
          float d = dot(uv, uv);
          if (d > 1.0) discard;
          float core = pow(max(1.0 - d, 0.0), 1.9);
          float halo = pow(max(1.0 - sqrt(d), 0.0), 2.4) * 0.52;
          vec3 cool = vec3(0.76, 0.87, 1.00);
          vec3 warm = vec3(1.00, 0.86, 0.65);
          vec3 c = mix(cool, warm, vT);
          float alpha = (core + halo) * (0.54 + vT * 0.34) * (0.50 + vB * 0.92) * uGain * vM;
          float hdr = 0.92 + core * 1.95 * (1.0 - uCalm * 0.75);
          gl_FragColor = vec4(c * hdr * mix(1.0, 0.28, uCalm), clamp(alpha, 0.0, 1.0));
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.stars.frustumCulled = false;
    this.scene.add(this.stars);

    // Subtle permanent astronomical constellation web across the sky dome so the sky always has sacred geometry depth
    const allEdges = [];
    for (const c of this._constellations) {
      for (const [u, v] of c.edges) {
        const a = c.stars[u], b = c.stars[v];
        if (a && b) {
          allEdges.push(a.x, a.y, a.z, b.x, b.y, b.z);
        }
      }
    }
    const cWebGeo = new THREE.BufferGeometry();
    cWebGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(allEdges), 3));
    this.constellationWeb = new THREE.LineSegments(cWebGeo, new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uGain: { value: 0.14 },
        uLookDir: { value: new THREE.Vector3(0, 0.2, -1) },
      },
      vertexShader: `
        varying float vFocus;
        uniform vec3 uLookDir;
        void main() {
          vec3 dir = normalize(position);
          vFocus = smoothstep(0.72, 0.985, dot(dir, uLookDir));
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying float vFocus;
        uniform float uGain;
        void main() {
          vec3 baseCol = mix(vec3(0.36, 0.48, 0.86), vec3(0.68, 0.86, 1.0), vFocus);
          float a = uGain * (0.28 + 0.72 * vFocus);
          gl_FragColor = vec4(baseCol, a);
        }
      `,
      transparent: true,
      depthWrite: false,
      fog: false,
      blending: THREE.AdditiveBlending,
    }));
    this.constellationWeb.frustumCulled = false;
    this.scene.add(this.constellationWeb);

    this._starPos = pos;
    this._starSz = sz;
    this._starCount = N;
    this._pvMatrix = new THREE.Matrix4();
    this._initStarConnections();
  }

  /* ── 4. 3D Volumetric Ambient Starlight Motes (Parallax Depth Layer) ──── */
  _initAmbientMotes() {
    const M = 420;
    const mPos = new Float32Array(M * 3);
    const mSeed = new Float32Array(M * 3);
    for (let i = 0; i < M; i++) {
      mPos[i * 3]     = (Math.random() - 0.5) * 260;
      mPos[i * 3 + 1] = 1.5 + Math.random() * 82;
      mPos[i * 3 + 2] = -185 + Math.random() * 235;
      mSeed[i * 3]     = Math.random() * 6.2831;
      mSeed[i * 3 + 1] = 0.6 + Math.random() * 1.8;
      mSeed[i * 3 + 2] = Math.random();
    }
    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.BufferAttribute(mPos, 3));
    mg.setAttribute('aSeed', new THREE.BufferAttribute(mSeed, 3));
    this.ambientMotes = new THREE.Points(mg, new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uGain: { value: 0.75 } },
      vertexShader: `
        attribute vec3 aSeed;
        uniform float uTime;
        varying float vAlpha;
        varying float vWarm;
        void main() {
          vec3 p = position;
          float t = uTime * 0.28 + aSeed.x;
          p.x += sin(t * 0.9 + aSeed.y) * 3.2;
          p.y += mod(uTime * (0.45 + aSeed.z * 0.55) + aSeed.x * 12.0, 82.0) - position.y + 1.5;
          p.z += cos(t * 0.7 + aSeed.x) * 2.6;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float dist = max(8.0, -mv.z);
          gl_PointSize = clamp((aSeed.y * 2.4) * (135.0 / dist), 1.2, 6.5);
          float pulse = 0.45 + 0.55 * sin(uTime * 1.6 + aSeed.x * 3.0);
          float heightFade = smoothstep(1.5, 10.0, p.y) * (1.0 - smoothstep(65.0, 82.0, p.y));
          vAlpha = pulse * heightFade * smoothstep(220.0, 35.0, dist);
          vWarm = aSeed.z;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform float uGain;
        varying float vAlpha;
        varying float vWarm;
        void main() {
          vec2 uv = gl_PointCoord * 2.0 - 1.0;
          float r2 = dot(uv, uv);
          if (r2 > 1.0) discard;
          float glow = pow(1.0 - r2, 2.2);
          vec3 col = mix(vec3(0.52, 0.68, 1.0), vec3(0.98, 0.82, 0.58), step(0.68, vWarm));
          gl_FragColor = vec4(col, glow * vAlpha * uGain * 0.42);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    this.ambientMotes.frustumCulled = false;
    this.scene.add(this.ambientMotes);
  }

  resize() {
    this.onResizeExtra?.();
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloom.setSize(Math.max(1, Math.round(w * 0.5)), Math.max(1, Math.round(h * 0.5)));
  }

  buildEnvironment() { return null; }

  /**
   * Synchronize active firework bursts with the wet-obsidian mirror light pools
   * and atmospheric sky scattering dome.
   */
  syncPools(lights = []) {
    let brightestGlow = 0;
    let brightestPos = null;
    let brightestCol = null;

    for (let i = 0; i < 6; i++) {
      const b = lights[i];
      if (b) {
        const life = Math.max(0.5, b.life || 3.5);
        const age = b.age || 0;
        const p = clamp(age / life, 0, 1);
        const env = Math.sin(Math.min(1, p * 4.5) * Math.PI * 0.5) * Math.pow(1 - p, 1.35);
        this._poolPos[i].set(b.x || 0, b.y || 38, b.z || -75);
        const colVec = hexToVec3(b.color || b.hex || '#7a94ff');
        this._poolCol[i].copy(colVec);
        this._poolData[i].set(env * 1.25, b.spread || 22, age);
        if (env > brightestGlow) {
          brightestGlow = env;
          brightestPos = this._poolPos[i];
          brightestCol = colVec;
        }
      } else {
        this._poolData[i].x *= 0.88;
      }
    }

    if (this.skyUniforms) {
      if (brightestPos && brightestCol) {
        this.skyUniforms.uBurstPos.value.lerp(brightestPos, 0.14);
        this.skyUniforms.uBurstColor.value.lerp(brightestCol, 0.14);
        this.skyUniforms.uBurstGlow.value = lerp(this.skyUniforms.uBurstGlow.value, brightestGlow, 0.16);
      } else {
        this.skyUniforms.uBurstGlow.value *= 0.94;
      }
    }
  }

  /* ── 5. 3 Distinct Cinematic Camera Shots with Critically-Damped Springs ── */
  setMode(mode) {
    const prev = this.mode;
    this.mode = mode;
    this.userHoldUntil = 0;
    this.resetView();
    this._camSwitchUntil = (this.elapsed || 0) + 1.8;

    // Seed smooth state from current camera pose so switching modes NEVER snaps
    this._smoothPos.copy(this.camera.position);

    if (mode === 'WIDE') {
      this._targetFov = 48;
    } else if (mode === 'DRONE') {
      if (prev !== 'DRONE') {
        const dx = this.camera.position.x;
        const dz = this.camera.position.z - (-75);
        this.orbit = Math.atan2(dx, dz);
      }
      this._targetFov = 52;
    } else if (mode === 'AUTO') {
      this._targetFov = 42;
      if (!this.flyTarget || prev !== 'AUTO') {
        this.flyTarget = this.camera.position.clone();
        this.flyLook = this.lookAt.clone();
      }
    }
  }

  notifyUserInput() { this.userHoldUntil = this.elapsed + 5.5; }

  orbitBy(dxPx, dyPx) {
    this.userYaw = (this.userYaw || 0) - dxPx * 0.0028;
    this.userPitch = clamp((this.userPitch || 0) + dyPx * 0.0019, -0.58, 0.56);
    this.notifyUserInput();
  }
  zoomBy(delta) {
    const f = delta > 0 ? 1.075 : 0.93;
    this.userZoom = clamp((this.userZoom || 1) * f, 0.45, 2.4);
    this.notifyUserInput();
  }
  resetView() { this.userYaw = 0; this.userPitch = 0; this.userZoom = 1; }

  applyUserView(dt) {
    if (this.elapsed > this.userHoldUntil) {
      const k = Math.pow(0.14, dt || 0.016);
      this.userYaw = (this.userYaw || 0) * k;
      this.userPitch = (this.userPitch || 0) * k;
      this.userZoom = 1 + ((this.userZoom || 1) - 1) * k;
      if (Math.abs(this.userYaw) < 1e-3) this.userYaw = 0;
      if (Math.abs(this.userPitch) < 1e-3) this.userPitch = 0;
      if (Math.abs(this.userZoom - 1) < 1e-3) this.userZoom = 1;
    }
    const yaw = this.userYaw || 0, pitch = this.userPitch || 0, zoom = this.userZoom || 1;
    if (!yaw && !pitch && zoom === 1) return;

    const up = this._up || (this._up = new THREE.Vector3(0, 1, 0));
    const off = this._off || (this._off = new THREE.Vector3());
    off.copy(this.camera.position).sub(this.lookAt);
    if (yaw) off.applyAxisAngle(up, yaw);
    if (pitch) {
      const right = this._right || (this._right = new THREE.Vector3());
      right.crossVectors(off, up).normalize();
      off.applyAxisAngle(right, pitch);
    }
    if (zoom !== 1) off.multiplyScalar(zoom);
    this.camera.position.copy(this.lookAt).add(off);
    if (this.camera.position.y < 1.2) this.camera.position.y = 1.2;
    this.camera.lookAt(this.lookAt);
  }

  /**
   * Smoothly tracks active targets across all 3 camera modes:
   * - Updates a smoothed center-of-interest anchor (`_smoothTargetAnchor`) so
   *   WIDE and DRONE also subtly acknowledge active fireworks without jerking
   * - Drives the full 3D FPV director chase choreography for AUTO mode
   */
  trackAutoTarget(tInfo, dt = 0.016) {
    const step = clamp(dt || 0.016, 0.001, 0.05);
    if (tInfo && typeof tInfo.x === 'number') {
      this._tmp2.set(tInfo.x, tInfo.y, tInfo.z);
      if (!this._hasTargetAnchor) {
        this._smoothTargetAnchor.copy(this._tmp2);
        this._hasTargetAnchor = true;
      } else {
        this._smoothTargetAnchor.lerp(this._tmp2, 1 - Math.pow(0.04, step));
      }
    } else {
      this._tmp2.set(Math.sin(this.elapsed * 0.24) * 18, 36 + Math.cos(this.elapsed * 0.19) * 5, -76);
      this._smoothTargetAnchor.lerp(this._tmp2, 1 - Math.pow(0.18, step));
    }

    if (this.mode !== 'AUTO') return;

    this._autoAz = (this._autoAz ?? -0.25) + step * 0.42;
    const az = Math.sin(this._autoAz) * 0.78 + Math.cos(this.elapsed * 0.19) * 0.25;
    const anchor = this._smoothTargetAnchor;

    if (!this.flyTarget) this.flyTarget = new THREE.Vector3();
    if (!this.flyLook) this.flyLook = new THREE.Vector3();

    if (!tInfo) {
      // Graceful figure-8 celestial patrol when waiting between shells
      const sx = Math.sin(this.elapsed * 0.34) * 38;
      const sy = 15 + Math.sin(this.elapsed * 0.52) * 9;
      const sz = 16 + Math.cos(this.elapsed * 0.27) * 22;
      this.flyTarget.set(sx, sy, sz);
      this.flyLook.set(sx * 0.32, 32 + Math.cos(this.elapsed * 0.38) * 7, -76);
      this._targetFov = 45 + Math.sin(this.elapsed * 0.44) * 4;
      this._fastTrack = false;
      return;
    }

    if (tInfo.kind === 'shell') {
      // Phase 1: Heroic low-angle ascent chase gliding upward alongside the rising mortar
      const p = clamp(tInfo.progress ?? 0, 0, 1);
      const standDist = lerp(46, 58, p);
      const spiralAz = az + p * 0.55;
      const camX = anchor.x + Math.sin(spiralAz) * standDist * 0.68;
      const camZ = anchor.z + Math.cos(spiralAz) * standDist;
      const camY = clamp(anchor.y * 0.52 + 3.2, 2.6, 28);
      this.flyTarget.set(camX, camY, camZ);
      this.flyLook.set(anchor.x, Math.max(6, anchor.y + 3.5), anchor.z);
      this._targetFov = lerp(44, 35, Math.sin(p * Math.PI * 0.5));
      this._fastTrack = true;
    } else {
      // Phase 2: 3D Corkscrew Crown Orbit & Dolly-Out on Break, then Ember Glide
      const age = tInfo.age ?? 0;
      const p = clamp(tInfo.progress ?? 0, 0, 1);
      const spreadScale = clamp((tInfo.spread || 22) / 22, 0.85, 1.42);
      const burstExpand = 1 - Math.exp(-age * 2.8);
      const emberGlide = Math.max(0, p - 0.52) * 28;
      const standDist = (lerp(58, 92, burstExpand) - emberGlide) * spreadScale;
      const orbitAngle = az + age * 0.32;
      const camX = anchor.x + Math.sin(orbitAngle) * standDist * 0.78;
      const camZ = anchor.z + Math.cos(orbitAngle) * standDist;
      const camY = clamp(anchor.y - 4 + Math.sin(this.elapsed * 0.65 + age) * 14, 5.5, 58);
      this.flyTarget.set(camX, camY, camZ);
      this.flyLook.set(anchor.x, Math.max(8, anchor.y - age * 1.6), anchor.z);
      this._targetFov = age < 0.95
        ? lerp(36, 52, 1 - Math.pow(1 - age / 0.95, 2.0))
        : lerp(52, 42, clamp((age - 0.95) / 2.6, 0, 1));
      this._fastTrack = age < 0.65;
    }
  }

  flyTo(pos) {
    if (this.mode !== 'AUTO' || !pos) return;
    this.trackAutoTarget({ kind: 'burst', x: pos.x, y: pos.y, z: pos.z, age: 0.35, progress: 0.1 }, 0.016);
  }

  /** Critically-damped spring helper for silky-smooth camera physics. */
  _springVec3(current, target, vel, omega, dt) {
    const f = 1 + 2 * dt * omega;
    const oo = omega * omega;
    const hoo = dt * oo;
    const hhoo = dt * hoo;
    const detInv = 1 / (f + hhoo);

    const dx = current.x - target.x;
    const dy = current.y - target.y;
    const dz = current.z - target.z;

    current.x = (f * current.x + dt * vel.x + hhoo * target.x) * detInv;
    current.y = (f * current.y + dt * vel.y + hhoo * target.y) * detInv;
    current.z = (f * current.z + dt * vel.z + hhoo * target.z) * detInv;

    vel.x = (vel.x - hoo * dx) * detInv;
    vel.y = (vel.y - hoo * dy) * detInv;
    vel.z = (vel.z - hoo * dz) * detInv;
  }

  updateCamera(dt) {
    const step = clamp(dt || 0.016, 0.001, 0.05);
    this._lastDt = step;
    const auto = this.elapsed > this.userHoldUntil;
    const reduced = prefersReducedMotion();

    // Smooth FOV zoom breathing
    const wantFov = this._targetFov || 46;
    if (Math.abs(this.camera.fov - wantFov) > 0.02) {
      this.camera.fov = lerp(this.camera.fov, wantFov, 1 - Math.pow(0.015, step));
      this.camera.updateProjectionMatrix();
    }

    if (this.mode === 'ZOOM' && this._zoom) {
      const z = this._zoom;
      z.t = Math.min(1, (performance.now() - z.t0) / (z.dur * 1000));
      const e = z.t < 0.5 ? 4 * z.t * z.t * z.t : 1 - Math.pow(-2 * z.t + 2, 3) / 2;
      this.camera.position.lerpVectors(z.fromPos, z.toPos, e);
      this.lookAt.lerpVectors(z.fromLook, z.toLook, e);
      this._smoothPos.copy(this.camera.position);
      this._smoothLook.copy(this.lookAt);
      this.camera.up.set(0, 1, 0);
      this.camera.lookAt(this.lookAt);
      if (z.t >= 1) {
        const done = z.onDone;
        this._zoom = null;
        this.mode = 'LOCKED';
        done?.();
      }
      return;
    }

    if (this.mode === 'LOCKED') {
      this.target.copy(this.camera.position);
      this._smoothPos.copy(this.camera.position);
      this.camera.getWorldDirection(this.lookAt).multiplyScalar(80).add(this.camera.position);
      this._smoothLook.copy(this.lookAt);
      return;
    }

    const t = this.elapsed;
    const anchor = this._smoothTargetAnchor;

    if (this.mode === 'WIDE') {
      // Shot 1: WIDE HORIZON — Sweeping Anamorphic Crane & Mirror Glide
      // Graceful figure-8 low crane arc across the wet-obsidian mirror
      const craneX = Math.sin(t * 0.22) * 28 + Math.cos(t * 0.11) * 10;
      const craneY = 5.4 + Math.sin(t * 0.31) * 3.2;
      const craneZ = 54 + Math.cos(t * 0.18) * 11;
      this.target.set(craneX, craneY, craneZ);

      // Gaze gently leans 28% toward the active firework cluster while keeping the wide horizon framed
      const lookX = lerp(0, anchor.x, 0.28) + Math.sin(t * 0.15) * 4;
      const lookY = lerp(31, clamp(anchor.y, 24, 44), 0.25);
      const lookZ = lerp(-76, anchor.z, 0.22);
      this._tmp.set(lookX, lookY, lookZ);

      this._targetFov = 48 + Math.sin(t * 0.26) * 2.5;
      this._springVec3(this._smoothPos, this.target, this._posVel, 1.85, step);
      this._springVec3(this._smoothLook, this._tmp, this._lookVel, 2.2, step);
    } else if (this.mode === 'DRONE') {
      // Shot 2: AERIAL DRONE ORBIT — 360° High-Altitude FPV Cinema Drone
      this.orbit = (this.orbit ?? -0.45) + (auto ? step * 0.34 : 0);
      const centerZ = lerp(-75, anchor.z, 0.35);
      const centerX = lerp(0, anchor.x, 0.35);
      const radiusBreath = 1 + Math.sin(t * 0.38) * 0.16;
      const rx = 98 * radiusBreath;
      const rz = 88 * radiusBreath;
      const droneY = 44 + Math.sin(t * 0.42) * 16 + Math.cos(this.orbit * 2) * 6;

      this.target.set(
        centerX + Math.sin(this.orbit) * rx,
        droneY,
        centerZ + Math.cos(this.orbit) * rz
      );
      this._tmp.set(
        lerp(0, anchor.x, 0.48),
        lerp(35, clamp(anchor.y, 26, 48), 0.42),
        lerp(-75, anchor.z, 0.45)
      );
      this._targetFov = 51 + Math.sin(t * 0.48) * 4.5;
      this._springVec3(this._smoothPos, this.target, this._posVel, 1.95, step);
      this._springVec3(this._smoothLook, this._tmp, this._lookVel, 2.5, step);
    } else if (this.mode === 'AUTO') {
      // Shot 3: AUTO FLY TO BURST — Dynamic Director Chase & 3D Corkscrew Flyby
      const omegaPos = this._fastTrack ? 2.65 : 1.75;
      const omegaLook = this._fastTrack ? 3.4 : 2.35;
      if (this.flyTarget) this._springVec3(this._smoothPos, this.flyTarget, this._posVel, omegaPos, step);
      if (this.flyLook) this._springVec3(this._smoothLook, this.flyLook, this._lookVel, omegaLook, step);
    }

    const br = reduced ? 0 : 1;
    this.camera.position.copy(this._smoothPos);
    this.camera.position.x += Math.sin(t * 0.42) * 0.45 * br;
    this.camera.position.y = Math.max(1.2, this.camera.position.y + Math.sin(t * 0.33 + 1.2) * 0.32 * br);
    this.lookAt.copy(this._smoothLook);

    // Subtle cinematic Dutch roll / aerodynamic banking proportional to lateral camera velocity
    const targetRoll = reduced
      ? 0
      : clamp(-this._posVel.x * 0.0018 + (this.mode === 'DRONE' ? Math.cos(this.orbit || 0) * 0.032 : 0), -0.065, 0.065);
    this._camRoll = lerp(this._camRoll || 0, targetRoll, 1 - Math.pow(0.02, step));
    this.camera.up.set(Math.sin(this._camRoll), Math.cos(this._camRoll), 0).normalize();

    this.camera.lookAt(this.lookAt);
    this.applyUserView(step);
  }

  setStarCalm(calm = 0, ms = 0) {
    this._calmFrom = this.stars?.material?.uniforms?.uCalm?.value ?? 1;
    this._calmTo = clamp(calm, 0, 1);
    this._calmMs = ms;
    this._calmAt = performance.now();
  }

  setStarLevel(level = 1, ms = 0) {
    this._starLevelFrom = this.stars?.material?.uniforms?.uGain?.value ?? 1;
    this._starLevel = clamp(level, 0, 1);
    this._starLevelMs = ms;
    this._starLevelAt = performance.now();
  }

  update(dt, elapsed) {
    this.elapsed = elapsed;
    if (this._starGainT < 1) {
      const step = Math.min(0.25, Math.max(0.001, dt || 0.016));
      this._starGainT = Math.min(1, this._starGainT + step / 2.2);
      const t = this._starGainT;
      this.stars.material.uniforms.uGain.value = t * t * (3 - 2 * t);
    } else if (this._starLevel != null) {
      const u = this.stars.material.uniforms.uGain;
      const want = this._starLevel;
      if (Math.abs(u.value - want) > 0.002) {
        const ms = this._starLevelMs || 0;
        if (ms > 0) {
          const k = clamp((performance.now() - this._starLevelAt) / ms, 0, 1);
          const e = k * k * (3 - 2 * k);
          u.value = lerp(this._starLevelFrom ?? 1, want, e);
        } else {
          u.value = want;
        }
      }
    }
    if (this._calmTo != null) {
      const ms = this._calmMs || 0;
      const k = ms > 0 ? clamp((performance.now() - this._calmAt) / ms, 0, 1) : 1;
      this.stars.material.uniforms.uCalm.value = lerp(this._calmFrom, this._calmTo, k * k * (3 - 2 * k));
      if (k >= 1) this._calmTo = null;
    }
    this.stars.material.uniforms.uTime.value = elapsed;
    if (this.skyUniforms) this.skyUniforms.uTime.value = elapsed;
    if (this.floorUniforms) {
      this.floorUniforms.uTime.value = elapsed;
      this.floorUniforms.uCamPos.value.copy(this.camera.position);
    }
    if (this.ambientMotes) {
      this.ambientMotes.material.uniforms.uTime.value = elapsed;
    }
    this.updateCamera(dt);
    if (this.constellationWeb) {
      this.camera.getWorldDirection(this.constellationWeb.material.uniforms.uLookDir.value);
    }
    this._updateStarConnections(dt);
  }

  render() {
    if (this.directRender) {
      this.scene.background = this._voidDirect;
      this.renderer.render(this.scene, this.camera);
    } else {
      this.scene.background = this._voidGraded;
      this.composer.render();
    }
  }

  adapt(fps) {
    if (this.fx) this.fx.setQuality(clamp((fps - 14) / 46, 0.28, 1));
  }

  project(v3) {
    const p = this._tmp.copy(v3).project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * window.innerWidth, y: (-p.y * 0.5 + 0.5) * window.innerHeight, z: p.z };
  }

  /* ── 3D Star-Connected Constellation Pulses ───────────────────────────── */
  _initStarConnections() {
    const HOVER_MAX_SEGS = 14;
    const HOVER_MAX_PTS = 8;
    const hLineGeo = new THREE.BufferGeometry();
    hLineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(HOVER_MAX_SEGS * 2 * 3), 3));
    hLineGeo.setAttribute('aWeight', new THREE.BufferAttribute(new Float32Array(HOVER_MAX_SEGS * 2), 1));
    hLineGeo.setDrawRange(0, 0);

    const hLineMat = new THREE.ShaderMaterial({
      uniforms: {
        uAlpha: { value: 0 },
        uGain: { value: 0 },
        uColor: { value: new THREE.Color(ACCENT_PALE) },
      },
      vertexShader: `attribute float aWeight; varying float vW;
        void main(){ vW = aWeight; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform float uAlpha; uniform float uGain; uniform vec3 uColor; varying float vW;
        void main(){ gl_FragColor = vec4(uColor, uAlpha * uGain * vW); }`,
      transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
    });
    this._hoverLines = new THREE.LineSegments(hLineGeo, hLineMat);
    this._hoverLines.frustumCulled = false;
    this.scene.add(this._hoverLines);

    const hPtGeo = new THREE.BufferGeometry();
    hPtGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(HOVER_MAX_PTS * 3), 3));
    hPtGeo.setAttribute('aWeight', new THREE.BufferAttribute(new Float32Array(HOVER_MAX_PTS), 1));
    hPtGeo.setDrawRange(0, 0);
    const hPtMat = new THREE.ShaderMaterial({
      uniforms: {
        uAlpha: { value: 0 },
        uGain: { value: 0 },
        uColor: { value: new THREE.Color(ACCENT) },
      },
      vertexShader: `attribute float aWeight; varying float vW;
        void main(){
          vW = aWeight;
          vec4 mv = modelViewMatrix * vec4(position,1.0);
          gl_PointSize = (6.5 + aWeight * 5.5) * (1250.0 / max(1.0, -mv.z));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `uniform float uAlpha; uniform float uGain; uniform vec3 uColor; varying float vW;
        void main(){
          vec2 uv = gl_PointCoord * 2.0 - 1.0;
          float r = length(uv);
          if (r > 1.0) discard;
          float core = exp(-r * r * 9.0);
          float halo = smoothstep(0.95, 0.55, r) * smoothstep(0.28, 0.56, r) * 0.45;
          gl_FragColor = vec4(mix(uColor, vec3(0.969, 0.976, 1.0), core), (core * 0.78 + halo) * uAlpha * uGain * vW);
        }`,
      transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
    });
    this._hoverPts = new THREE.Points(hPtGeo, hPtMat);
    this._hoverPts.frustumCulled = false;
    this.scene.add(this._hoverPts);
    this._hoverTargetAlpha = 0;

    const WAVE_MAX_SEGS = 56;
    const WAVE_MAX_PTS = 28;
    this._starWaves = [];
    for (let i = 0; i < 3; i++) {
      const lGeo = new THREE.BufferGeometry();
      lGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(WAVE_MAX_SEGS * 2 * 3), 3));
      lGeo.setAttribute('aOrder', new THREE.BufferAttribute(new Float32Array(WAVE_MAX_SEGS * 2), 1));
      lGeo.setDrawRange(0, 0);
      const lMat = new THREE.ShaderMaterial({
        uniforms: {
          uProgress: { value: 0 },
          uFade: { value: 0 },
          uColorA: { value: new THREE.Color(ACCENT) },
          uColorB: { value: new THREE.Color(ACCENT_PALE) },
        },
        vertexShader: `attribute float aOrder; varying float vO;
          void main(){ vO = aOrder; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform float uProgress; uniform float uFade; uniform vec3 uColorA; uniform vec3 uColorB; varying float vO;
          void main(){
            float head = clamp((uProgress - vO) * 5.2, 0.0, 1.0);
            float d = (uProgress - vO) * 5.4;
            float travel = exp(-d * d);
            vec3 col = mix(uColorB, uColorA, clamp(0.35 + travel * 0.65, 0.0, 1.0));
            float a = head * uFade * (0.48 + travel * 0.68);
            if (a <= 0.002) discard;
            gl_FragColor = vec4(col * (1.0 + travel * 0.75), a);
          }`,
        transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
      });
      const lines = new THREE.LineSegments(lGeo, lMat);
      lines.frustumCulled = false;
      lines.visible = false;
      this.scene.add(lines);

      const pGeo = new THREE.BufferGeometry();
      pGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(WAVE_MAX_PTS * 3), 3));
      pGeo.setAttribute('aOrder', new THREE.BufferAttribute(new Float32Array(WAVE_MAX_PTS), 1));
      pGeo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(WAVE_MAX_PTS), 1));
      pGeo.setDrawRange(0, 0);
      const pMat = new THREE.ShaderMaterial({
        uniforms: {
          uProgress: { value: 0 },
          uFade: { value: 0 },
          uColorA: { value: new THREE.Color(ACCENT_FLASH) },
          uColorB: { value: new THREE.Color(ACCENT) },
        },
        vertexShader: `attribute float aOrder; attribute float aSize;
          varying float vO; uniform float uProgress;
          void main(){
            vO = aOrder;
            float d = (uProgress - aOrder) * 4.2;
            float flash = exp(-d * d);
            vec4 mv = modelViewMatrix * vec4(position,1.0);
            gl_PointSize = (aSize * 6.8 + flash * 10.5) * (1250.0 / max(1.0, -mv.z));
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `uniform float uProgress; uniform float uFade; uniform vec3 uColorA; uniform vec3 uColorB; varying float vO;
          void main(){
            vec2 uv = gl_PointCoord * 2.0 - 1.0;
            float r = length(uv);
            if (r > 1.0) discard;
            float lit = clamp((uProgress - vO) * 6.0, 0.0, 1.0);
            float d = (uProgress - vO) * 4.2;
            float flash = exp(-d * d);
            float core = exp(-r * r * 7.5);
            float glint = exp(-abs(uv.x) * 16.0) * exp(-abs(uv.y) * 3.5)
                        + exp(-abs(uv.y) * 16.0) * exp(-abs(uv.x) * 3.5);
            vec3 col = mix(uColorB, uColorA, clamp(core * 0.8 + flash * 0.5, 0.0, 1.0));
            float a = lit * uFade * (core * (0.75 + flash * 0.9) + glint * 0.28 * (0.4 + flash));
            gl_FragColor = vec4(col, a);
          }`,
        transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
      });
      const pts = new THREE.Points(pGeo, pMat);
      pts.frustumCulled = false;
      pts.visible = false;
      this.scene.add(pts);

      this._starWaves.push({ lines, pts, active: false, age: 0, dur: 2.8, seq: 0 });
    }
    this._waveSeq = 0;
  }

  _findRecognizedConstellation(ndcX, ndcY, maxDist = 0.16) {
    if (!this._constellations?.length) return null;
    this.camera.updateMatrixWorld();
    this.camera.updateProjectionMatrix();
    this._pvMatrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    const m = this._pvMatrix.elements;
    const aspect = Math.max(0.5, window.innerWidth / Math.max(1, window.innerHeight));

    const projectPt = (x, y, z) => {
      const w = m[3] * x + m[7] * y + m[11] * z + m[15];
      if (w <= 0.001) return null;
      const invW = 1 / w;
      const pz = (m[2] * x + m[6] * y + m[10] * z + m[14]) * invW;
      if (pz < -1 || pz > 1) return null;
      return {
        px: (m[0] * x + m[4] * y + m[8] * z + m[12]) * invW,
        py: (m[1] * x + m[5] * y + m[9] * z + m[13]) * invW,
      };
    };

    let best = null;
    let bestDist2 = maxDist * maxDist;

    for (const c of this._constellations) {
      const pts = c.stars.map(s => {
        const p = projectPt(s.x, s.y, s.z);
        return p ? { ...s, px: p.px, py: p.py } : null;
      });
      if (pts.some(p => !p)) continue;

      let minD2 = Infinity;
      let nearestStar = null;
      let nearestStarD2 = Infinity;

      for (const s of pts) {
        const dx = (s.px - ndcX) * aspect;
        const dy = s.py - ndcY;
        const d2 = dx * dx + dy * dy;
        if (d2 < minD2) minD2 = d2;
        if (d2 < nearestStarD2) { nearestStarD2 = d2; nearestStar = s; }
      }

      for (const [u, v] of c.edges) {
        const a = pts[u], b = pts[v];
        const ax = a.px * aspect, ay = a.py;
        const bx = b.px * aspect, by = b.py;
        const cx = ndcX * aspect, cy = ndcY;
        const vx = bx - ax, vy = by - ay;
        const len2 = vx * vx + vy * vy || 1e-6;
        const t = Math.max(0, Math.min(1, ((cx - ax) * vx + (cy - ay) * vy) / len2));
        const px = ax + t * vx - cx;
        const py = ay + t * vy - cy;
        const d2 = px * px + py * py;
        if (d2 < minD2) minD2 = d2;
      }

      if (minD2 < bestDist2) {
        bestDist2 = minD2;
        best = {
          constellation: c,
          pts,
          nearestStar: nearestStarD2 < 0.015 ? nearestStar.name : null,
        };
      }
    }
    return best;
  }

  updateHoverConstellation(ndcX, ndcY) {
    if (!this._hoverLines || prefersReducedMotion()) return null;
    const hit = this._findRecognizedConstellation(ndcX, ndcY, 0.16);
    if (!hit) {
      this._hoverTargetAlpha = 0;
      this._lastHoverConstellation = null;
      this._lastHoverObj = null;
      return null;
    }

    const { constellation, pts, nearestStar } = hit;
    this._lastHoverObj = constellation;
    if (this._lastHoverConstellation !== constellation.name) {
      this._lastHoverConstellation = constellation.name;
      this._paintHover(constellation, pts);
    }

    this._hoverTargetAlpha = 0.55;
    return { constellation: constellation.name, star: nearestStar };
  }

  clearHoverConstellation() {
    this._hoverTargetAlpha = 0;
    this._lastHoverConstellation = null;
  }

  releaseHoverConstellation() {
    this._hoverTargetAlpha = 0;
    this._lastHoverConstellation = null;
  }

  _paintHover(constellation, pts = null) {
    if (!this._hoverLines) return;
    const world = constellation.stars;
    const at = (i) => (pts ? pts[i] : world[i]);

    const lPos = this._hoverLines.geometry.attributes.position.array;
    const lW = this._hoverLines.geometry.attributes.aWeight.array;
    const segCount = Math.min(14, constellation.edges.length);
    for (let i = 0; i < segCount; i++) {
      const [u, v] = constellation.edges[i];
      const a = at(u), b = at(v);
      if (!a || !b) continue;
      const o = i * 6;
      lPos[o] = a.x; lPos[o + 1] = a.y; lPos[o + 2] = a.z;
      lPos[o + 3] = b.x; lPos[o + 4] = b.y; lPos[o + 5] = b.z;
      lW[i * 2] = 0.88;
      lW[i * 2 + 1] = 0.88;
    }
    this._hoverLines.geometry.attributes.position.needsUpdate = true;
    this._hoverLines.geometry.attributes.aWeight.needsUpdate = true;
    this._hoverLines.geometry.setDrawRange(0, segCount * 2);

    const pPos = this._hoverPts.geometry.attributes.position.array;
    const pW = this._hoverPts.geometry.attributes.aWeight.array;
    const ptCount = Math.min(8, constellation.stars.length);
    for (let i = 0; i < ptCount; i++) {
      const s2 = at(i);
      if (!s2) continue;
      pPos[i * 3] = s2.x; pPos[i * 3 + 1] = s2.y; pPos[i * 3 + 2] = s2.z;
      pW[i] = Math.min(1.0, 0.45 + s2.size * 0.16);
    }
    this._hoverPts.geometry.attributes.position.needsUpdate = true;
    this._hoverPts.geometry.attributes.aWeight.needsUpdate = true;
    this._hoverPts.geometry.setDrawRange(0, ptCount);
  }

  constellationAt(ndcX, ndcY, radius = 0.20) {
    if (!this._constellations?.length) return null;
    this.camera.updateMatrixWorld();
    this._pvMatrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    return this._findRecognizedConstellation(ndcX, ndcY, radius);
  }

  flyToPose({ pos, look, duration = 1200, onDone = null }) {
    if (!pos || !look) return false;
    this.mode = 'ZOOM';
    this._zoom = {
      t: 0,
      t0: performance.now(),
      dur: Math.max(0.05, duration / 1000),
      fromPos: this.camera.position.clone(),
      fromLook: this.lookAt.clone(),
      toPos: pos.clone(),
      toLook: look.clone(),
      onDone,
    };
    return true;
  }

  focusConstellation(constellation, { duration = 1350, push = 0.76, onDone = null } = {}) {
    const c = constellation || this._lastHoverObj;
    if (!c || !c.stars?.length) return false;

    const centre = new THREE.Vector3();
    for (const st of c.stars) centre.add(this._tmp.set(st.x, st.y, st.z));
    centre.multiplyScalar(1 / c.stars.length);

    const from = this.camera.position.clone();
    const toCentre = centre.clone().sub(from);
    const dist = toCentre.length();
    if (dist < 1) return false;
    const dir = toCentre.clone().normalize();

    const side = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(dist * 0.035);
    const toPos = from.clone().addScaledVector(dir, dist * push).add(side);

    this.mode = 'ZOOM';
    this._zoom = {
      t: 0,
      t0: performance.now(),
      dur: Math.max(0.05, duration / 1000),
      fromPos: from,
      fromLook: this.lookAt.clone(),
      toPos,
      toLook: centre.clone(),
      onDone,
    };
    this._paintHover(c);
    this._hoverTargetAlpha = 1.05;
    this._lastHoverObj = c;
    this._lastHoverConstellation = c.name;
    return true;
  }

  _buildLocalAsterism(ndcX, ndcY) {
    this.camera.updateMatrixWorld();
    this.camera.updateProjectionMatrix();
    this._pvMatrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    const m = this._pvMatrix.elements;
    const aspect = Math.max(0.5, window.innerWidth / Math.max(1, window.innerHeight));

    const cands = [];
    const pos = this._starPos;
    const sz = this._starSz;
    const N = this._starCount || 0;
    for (let i = 0; i < N; i++) {
      const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
      const w = m[3] * x + m[7] * y + m[11] * z + m[15];
      if (w <= 0.1) continue;
      const invW = 1 / w;
      const pz = (m[2] * x + m[6] * y + m[10] * z + m[14]) * invW;
      if (pz < -1 || pz > 1) continue;
      const px = (m[0] * x + m[4] * y + m[8] * z + m[12]) * invW;
      const py = (m[1] * x + m[5] * y + m[9] * z + m[13]) * invW;
      const dx = (px - ndcX) * aspect;
      const dy = py - ndcY;
      const d2 = dx * dx + dy * dy;
      if (d2 < 0.085) {
        cands.push({ x, y, z, px, py, size: Math.max(2.2, sz[i] * 1.35), d2 });
      }
    }
    cands.sort((a, b) => a.d2 - b.d2);

    const picked = [];
    for (const c of cands) {
      if (picked.length >= 12) break;
      const tooClose = picked.some(o => Math.hypot((c.px - o.px) * aspect, c.py - o.py) < 0.028);
      if (!tooClose) picked.push(c);
    }

    if (picked.length < 7) {
      this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
      const fwd = this.raycaster.ray.direction.clone().normalize();
      const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
      const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
      const R = 1800;
      const baseCenter = this.camera.position.clone().addScaledVector(fwd, R);
      const offsets = [
        [0.0, 0.0, 3.2],
        [-0.055, 0.042, 2.7],
        [0.062, 0.035, 2.8],
        [-0.038, -0.058, 2.5],
        [0.052, -0.048, 2.6],
        [0.0, 0.095, 2.9],
        [-0.115, 0.015, 2.3],
        [0.118, -0.012, 2.4],
        [0.018, -0.105, 2.3],
      ];
      for (const [ox, oy, s] of offsets) {
        if (picked.length >= 11) break;
        const wp = baseCenter.clone()
          .addScaledVector(right, ox * R)
          .addScaledVector(up, oy * R);
        picked.push({ x: wp.x, y: wp.y, z: wp.z, px: ndcX + ox / aspect, py: ndcY + oy, size: s, d2: ox * ox + oy * oy });
      }
    }

    const edges = [];
    const inTree = new Set([0]);
    while (inTree.size < picked.length) {
      let bestU = -1, bestV = -1, bestD = Infinity;
      for (const u of inTree) {
        for (let v = 0; v < picked.length; v++) {
          if (inTree.has(v)) continue;
          const d = Math.hypot((picked[u].px - picked[v].px) * aspect, picked[u].py - picked[v].py);
          if (d < bestD) { bestD = d; bestU = u; bestV = v; }
        }
      }
      if (bestV >= 0) {
        inTree.add(bestV);
        edges.push([bestU, bestV]);
      } else break;
    }
    if (picked.length >= 5) {
      edges.push([1, 2]);
      edges.push([2, 4]);
    }

    return {
      constellation: { name: 'ASTERISM', stars: picked, edges },
      pts: picked,
    };
  }

  triggerStarConnect(ndcX, ndcY, opts = {}) {
    if (!this._starWaves?.length) return { count: 0 };
    let hit = this._findRecognizedConstellation(ndcX, ndcY, opts.maxRadius ?? 0.28);
    if (!hit) {
      hit = this._buildLocalAsterism(ndcX, ndcY);
    }
    if (!hit || !hit.pts?.length) return { count: 0 };

    const { constellation, pts } = hit;
    let wave = this._starWaves.find(w => !w.active);
    if (!wave) {
      wave = this._starWaves.reduce((a, b) => (a.seq < b.seq ? a : b));
    }
    wave.active = true;
    wave.age = 0;
    wave.dur = opts.duration ?? 2.4;
    wave.seq = ++this._waveSeq;

    wave.lines.material.uniforms.uColorA.value.setHex(ACCENT);
    wave.lines.material.uniforms.uColorB.value.setHex(ACCENT_PALE);
    wave.pts.material.uniforms.uColorA.value.setHex(ACCENT_FLASH);
    wave.pts.material.uniforms.uColorB.value.setHex(ACCENT);

    const n = pts.length;
    const depth = new Float32Array(n).fill(1e6);
    let root = 0, bestD2 = Infinity;
    const aspect = Math.max(0.5, window.innerWidth / Math.max(1, window.innerHeight));
    for (let i = 0; i < n; i++) {
      const dx = (pts[i].px - ndcX) * aspect;
      const dy = pts[i].py - ndcY;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) { bestD2 = d2; root = i; }
    }
    depth[root] = 0;
    const q = [root];
    const adj = Array.from({ length: n }, () => []);
    for (const [u, v] of constellation.edges) { adj[u].push(v); adj[v].push(u); }
    for (let h = 0; h < q.length; h++) {
      const u = q[h];
      for (const v of adj[u]) {
        if (depth[v] > depth[u] + 1) {
          depth[v] = depth[u] + 1;
          q.push(v);
        }
      }
    }
    let maxD = 1;
    for (let i = 0; i < n; i++) if (depth[i] < 1e5 && depth[i] > maxD) maxD = depth[i];

    const lPos = wave.lines.geometry.attributes.position.array;
    const lOrd = wave.lines.geometry.attributes.aOrder.array;
    const segCount = Math.min(56, constellation.edges.length);
    for (let i = 0; i < segCount; i++) {
      const [u, v] = constellation.edges[i];
      const a = pts[u], b = pts[v];
      const o = i * 6;
      lPos[o] = a.x; lPos[o + 1] = a.y; lPos[o + 2] = a.z;
      lPos[o + 3] = b.x; lPos[o + 4] = b.y; lPos[o + 5] = b.z;
      lOrd[i * 2] = ((depth[u] < 1e5 ? depth[u] : 1) / maxD) * 0.55;
      lOrd[i * 2 + 1] = ((depth[v] < 1e5 ? depth[v] : 1) / maxD) * 0.55;
    }
    wave.lines.geometry.attributes.position.needsUpdate = true;
    wave.lines.geometry.attributes.aOrder.needsUpdate = true;
    wave.lines.geometry.setDrawRange(0, segCount * 2);
    wave.lines.visible = true;

    const pPos = wave.pts.geometry.attributes.position.array;
    const pOrd = wave.pts.geometry.attributes.aOrder.array;
    const pSz = wave.pts.geometry.attributes.aSize.array;
    const ptCount = Math.min(28, n);
    for (let i = 0; i < ptCount; i++) {
      const a = pts[i];
      pPos[i * 3] = a.x; pPos[i * 3 + 1] = a.y; pPos[i * 3 + 2] = a.z;
      pOrd[i] = ((depth[i] < 1e5 ? depth[i] : 1) / maxD) * 0.55;
      pSz[i] = Math.min(3.4, a.size * 1.12);
    }
    wave.pts.geometry.attributes.position.needsUpdate = true;
    wave.pts.geometry.attributes.aOrder.needsUpdate = true;
    wave.pts.geometry.attributes.aSize.needsUpdate = true;
    wave.pts.geometry.setDrawRange(0, ptCount);
    wave.pts.visible = true;

    return { count: ptCount, constellation: constellation.name };
  }

  _updateStarConnections(dt) {
    if (this._hoverLines) {
      const cur = this._hoverLines.material.uniforms.uAlpha.value;
      const tgt = this._hoverTargetAlpha ?? 0;
      const next = lerp(cur, tgt, 1 - Math.pow(0.002, dt));
      const gain = this.stars?.material?.uniforms?.uGain?.value ?? 1;
      this._hoverLines.material.uniforms.uAlpha.value = next;
      this._hoverLines.material.uniforms.uGain.value = gain;
      this._hoverPts.material.uniforms.uAlpha.value = next * 1.45;
      this._hoverPts.material.uniforms.uGain.value = gain;
      const vis = next > 0.005;
      this._hoverLines.visible = vis;
      this._hoverPts.visible = vis;
    }

    if (!this._starWaves) return;
    for (const w of this._starWaves) {
      if (!w.active) continue;
      w.age += dt;
      const t = w.age / w.dur;
      if (t >= 1) {
        w.active = false;
        w.lines.visible = false;
        w.pts.visible = false;
        continue;
      }
      const prog = Math.min(1.25, t * 2.15);
      const fadeIn = Math.min(1, t / 0.12);
      const fadeOut = t < 0.45 ? 1 : Math.max(0, 1 - Math.pow((t - 0.45) / 0.55, 1.45));
      const fade = fadeIn * fadeOut;
      w.lines.material.uniforms.uProgress.value = prog;
      w.lines.material.uniforms.uFade.value = fade;
      w.pts.material.uniforms.uProgress.value = prog;
      w.pts.material.uniforms.uFade.value = fade;
    }
  }
}
