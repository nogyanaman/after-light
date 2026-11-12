/* ============================================================================
   INTERSPACE · tokens.js
   Exact colour tokens, chemistry constants and shared math.
   Never pure #000 / #fff / neon RGB — every value is a warm, material colour.
   ========================================================================== */

/* Put your own details here — one edit, used everywhere (manifesto footer). */
export const CREATOR = {
  name: 'the creator',
  linkedin: 'https://www.linkedin.com/in/naman-nogya/',
};

export const TOKENS = {
  // Stage 1 — Processing loader & audio gate
  carbon:        '#060608',   // Anodized Carbon
  carbonHi:      '#0B0B0F',
  filament:      '#FFF3D6',   // 2700K incandescent filament
  copperOxide:   '#C86D51',   // copper oxide outer glow
  titanium:      '#7A7D85',   // machined titanium telemetry
  warmBone:      '#ECEAE4',

  // Stage 2 — scroll intro
  venous:        '#120406',   // deep venous crimson / dried lacquer
  basalt:        '#090507',   // volcanic basalt
  smolder:       '#2A1215',   // smoldering iron specular
  alabaster:     '#F4EFEA',   // primary scroll typography
  wornAsh:       '#9E8C88',   // secondary metadata

  // Stage 3 — main sky
  zenith:        '#030407',   // abyssal indigo-black
  hazeline:      '#070910',   // nocturnal slate horizon haze
  wetObsidian:   '#040508',   // wet salt crust floor
  fresnelEdge:   '#101520',   // cool-blue fresnel edge
  starlight:     '#F2F3F7',   // callout headline

  // Stage 4 — UI
  glass:         'rgba(8, 9, 13, 0.68)',
  hairline:      'rgba(242, 243, 247, 0.11)',
  specular:      'rgba(255, 255, 255, 0.24)',
  champagne:     'rgba(244, 212, 166, 0.55)',
  pewter:        '#686C78',

  // Stage 5 — pyrotechnic chemical metal-salt palette
  ignition:      '#FFFDF8',   // 5500K magnesium flash, HDR > 3.0
  goldWillow:    '#F3B35A',   // strontium + carbon
  goldCool:      '#8C421E',   // cooling charcoal amber
  celadon:       '#DCE8E2',   // titanium + barium silver crackle
  carmine:       '#D94B58',   // lithium / strontium salt
  carmineCool:   '#5E1922',
  violetBlue:    '#7B8CDE',   // copper compound
  sodiumAmber:   '#F0A93C',   // sodium D-line 589nm
  calciumCoral:  '#F2764B',   // calcium monochloride
  emeraldBarium: '#3FBF7F',   // barium chlorate
  magentaDeep:   '#9A5BC5',   // Sr + Cu blend
  smoke:         '#14161F',   // illuminated smoke puff base
};

/* ---- Real pyrotechnic chemistry (measured emission data) ----------------
   Peak wavelengths & stability windows. Copper monochloride is the reason
   blue is rare: Cu–Cl dissociates (~384 kJ/mol) above ~1200 °C, so the
   usable flame window is only ~1000–1200 °C vs ~800 °C for SrCl.          */
export const CHEMISTRY = {
  SrCl:  { name: 'Strontium monochloride', nm: [605, 682], window_C: [900, 1700], difficulty: 'easy' },
  Li:    { name: 'Lithium (atomic)',       nm: [670, 671], window_C: [800, 1600], difficulty: 'easy' },
  CaCl:  { name: 'Calcium monochloride',   nm: [591, 622], window_C: [900, 1700], difficulty: 'easy' },
  Na:    { name: 'Sodium (D-line)',        nm: [589, 589], window_C: [800, 2000], difficulty: 'trivial' },
  BaCl:  { name: 'Barium monochloride',    nm: [505, 535], window_C: [1000, 1700], difficulty: 'moderate' },
  CuCl:  { name: 'Copper(I) chloride',     nm: [420, 460], window_C: [1000, 1200], difficulty: 'very hard' },
  Ti:    { name: 'Titanium / Zr / Mg',     nm: [0, 0],     window_C: [1800, 2600], difficulty: 'moderate' },
  C:     { name: 'Charcoal / iron blackbody', nm: [0, 0],  window_C: [1200, 2000], difficulty: 'trivial' },
  Sb:    { name: 'Antimony trisulfide (glitter)', nm: [0, 0], window_C: [900, 1500], difficulty: 'moderate' },
  Bi:    { name: 'Bismuth (crackle)',      nm: [0, 0],      window_C: [600, 900],  difficulty: 'easy' },
};

/* ---- Physics constants (SI, world units = metres) ---------------------- */
export const PHYSICS = {
  G: 9.81,               // gravity
  SOUND_SPEED: 343,      // m/s — acoustic delay = distance / 343
  // Empirical shell geometry: a display shell of caliber C (inches) breaks at
  // roughly radius ≈ 2.5·C metres (3" ≈ 7.5 m radius / ~50 ft diameter;
  // 12" ≈ 30 m radius / ~200 ft). Burst altitude ≈ 30·C metres, capped.
  radiusPerInch: 2.5,
  altitudePerInch: 28,
  // Exponential atmospheric drag: v(t) = v0 · e^(−k t)
  dragBase: 1.65,
  // Shell break asymmetry: 8–18% elliptical/directional variance (real shells
  // are never perfect spheres — burst charge and star packing vary).
  asymMin: 0.08, asymMax: 0.18,
};

/* ---- math helpers ------------------------------------------------------ */
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];

/** Fisher–Yates shuffle (used by the loader line engine so lines never repeat back-to-back). */
export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Hex → THREE-friendly linear-ish RGB triplet (0..1) with optional HDR boost. */
export function hexToRGB(hex, boost = 1) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return [((n >> 16) & 255) / 255 * boost, ((n >> 8) & 255) / 255 * boost, (n & 255) / 255 * boost];
}

/** Blend two hex colours in sRGB space. */
export function mixHex(a, b, t) {
  const A = hexToRGB(a), B = hexToRGB(b);
  const c = A.map((v, i) => Math.round(lerp(v, B[i], t) * 255));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}

/** Reduce motion preference. */
export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Device tier heuristic for particle budget. */
export function deviceTier() {
  const mem = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if ((mobile && mem <= 4) || cores <= 4) return 'low';
  if (mobile || cores <= 8 || mem <= 8) return 'mid';
  return 'high';
}
