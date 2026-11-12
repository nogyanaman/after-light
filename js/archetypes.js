/* ============================================================================
   INTERSPACE · archetypes.js
   56 firework archetypes authored from real pyrotechnic data.
   ----------------------------------------------------------------------------
   Each entry encodes REAL-WORLD factors, not decoration:
     · emitter  — the actual light-producing species (SrCl, BaCl, CuCl, Na…)
                  with its measured emission band and flame-stability window.
     · caliber  — shell diameter in inches; drives break radius & altitude via
                  the empirical shell laws in tokens.js (PHYSICS).
     · v0/drag  — stars leave the burst charge fast (v0) and decelerate hard
                  within ~0.4 s under exponential atmospheric drag, then fall.
     · burn     — real star burn time (2–8 s; willow/kamuro are longest).
     · asym     — 8–18% directional velocity variance: real shells never break
                  as perfect spheres (burst-charge + star packing variation).
     · kernel   — which motion kernel the GPU vertex shader runs for the stars.
   ----------------------------------------------------------------------------
   PLUGGING IN YOUR OWN REFERENCE MEDIA (images / video / audio):
   every archetype has a `media` slot. Call attachMedia(id, {...}) at runtime
   or edit the object below — the launcher will use your asset instead of the
   procedural synthesis, with zero other changes.
       import { attachMedia } from './archetypes.js';
       attachMedia('willow-nagaoka-gold', {
         image: '/assets/willow-01.jpg',      // used for sprite/canopy texture
         video: '/assets/willow-01.mp4',      // used as an overlay plate
         audio: '/assets/willow-break.wav',   // replaces procedural break
       });
   ========================================================================== */

export const KERNEL = {
  SPHERE: 0, RING: 1, PISTIL: 2, CROSSETTE: 3, WILLOW: 4, PALM: 5,
  STROBE: 6, CRACKLE: 7, GHOST: 8, DIADEM: 9, MULTIBREAK: 10,
  FALLINGLEAVES: 11, BROCADE: 12, SALUTE: 13, COMET: 14, EMBER: 15,
  SPIRAL: 16, SHARD: 17, SMOKE: 18,
};

const A = (o) => Object.assign({
  media: { image: null, video: null, audio: null },
  smoke: 0.35, trail: 0.6, glitter: 0.0, crackleAmt: 0.0, strobe: 0.0,
  pistil: 0.0, split: null, spin: 0.0, weight: 1.0, lens: null,
}, o);

/* ---------------------------------------------------------------------------
   Colour vocabulary — the exact chemical metal-salt tokens (Stage 5 palette)
   ------------------------------------------------------------------------ */
const C = {
  flash:    '#FFFDF8', // 5500K magnesium flash
  gold:     '#F3B35A', // strontium + carbon (charcoal gold willow)
  goldCool: '#8C421E',
  celadon:  '#DCE8E2', // titanium + barium silver crackle
  carmine:  '#D94B58', // lithium / strontium carmine
  carmCool: '#5E1922',
  violet:   '#7B8CDE', // copper compound nocturnal violet-blue
  sodium:   '#F0A93C', // sodium D-line amber
  coral:    '#F2764B', // calcium monochloride coral
  emerald:  '#3FBF7F', // barium chlorate emerald
  magenta:  '#9A5BC5', // Sr + Cu blend deep magenta/violet
};

export const ARCHETYPES = [
  /* ---------------- PEONY FAMILY (clean, tail-free spheres) --------------- */
  A({ id: 'peony-strontium-carmine', name: 'Strontium Carmine Peony', family: 'Peony', kernel: KERNEL.SPHERE,
      emitter: 'SrCl', nm: [605, 682], caliber: 6, stars: 900, burn: 3.4, v0: 62, drag: 1.8, grav: 8.4,
      colors: [C.flash, C.carmine], cool: C.carmCool, size: 1.0, asym: 0.10, note: 'Strontium carbonate. The most forgiving, most common red.' }),

  A({ id: 'peony-barium-emerald', name: 'Barium Emerald Peony', family: 'Peony', kernel: KERNEL.SPHERE,
      emitter: 'BaCl', nm: [505, 535], caliber: 6, stars: 860, burn: 3.2, v0: 60, drag: 1.85, grav: 8.4,
      colors: [C.flash, C.emerald], cool: '#1F6B46', size: 1.0, asym: 0.11, note: 'Barium chlorate. Bright, but easily contaminated by sodium.' }),

  A({ id: 'peony-copper-nocturne', name: 'Copper(I) Chloride Nocturne', family: 'Peony', kernel: KERNEL.SPHERE,
      emitter: 'CuCl', nm: [420, 460], caliber: 5, stars: 720, burn: 2.9, v0: 56, drag: 1.95, grav: 8.6,
      colors: [C.flash, C.violet], cool: '#263A6B', size: 0.95, asym: 0.14, weight: 0.45,
      note: 'Hardest colour in pyrotechnics — CuCl dissociates above ~1200 °C, so the flame window is only ~200 °C.' }),

  A({ id: 'peony-sodium-amber', name: 'Sodium Amber Peony', family: 'Peony', kernel: KERNEL.SPHERE,
      emitter: 'Na', nm: [589, 589], caliber: 6, stars: 880, burn: 3.0, v0: 58, drag: 1.9, grav: 8.4,
      colors: [C.flash, C.sodium], cool: '#8A4A12', size: 1.05, asym: 0.10, note: 'Sodium D-line at 589 nm. Blindingly efficient — trivial to make.' }),

  A({ id: 'peony-calcium-coral', name: 'Calcium Coral Peony', family: 'Peony', kernel: KERNEL.SPHERE,
      emitter: 'CaCl', nm: [591, 622], caliber: 5, stars: 800, burn: 3.1, v0: 57, drag: 1.9, grav: 8.5,
      colors: [C.flash, C.coral], cool: '#7A2E18', size: 1.0, asym: 0.11, note: 'Calcium monochloride. Sits between sodium amber and strontium red.' }),

  A({ id: 'peony-lithium-carmine', name: 'Lithium Carmine Peony', family: 'Peony', kernel: KERNEL.SPHERE,
      emitter: 'Li', nm: [670, 671], caliber: 6, stars: 840, burn: 3.6, v0: 61, drag: 1.75, grav: 8.2,
      colors: [C.flash, C.carmine], cool: C.carmCool, size: 1.05, asym: 0.12, note: 'Lithium salts give a deeper, colder carmine than strontium.' }),

  A({ id: 'peony-titanium-celadon', name: 'Titanium Celadon Peony', family: 'Peony', kernel: KERNEL.SPHERE,
      emitter: 'Ti', nm: [0, 0], caliber: 5, stars: 760, burn: 2.8, v0: 64, drag: 2.0, grav: 8.6,
      colors: [C.flash, C.celadon], cool: '#6E7A76', size: 1.0, asym: 0.09, note: 'Ti/Zr/Mg alloys: incandescent white-silver, no molecular emission band.' }),

  A({ id: 'peony-magnesium-flash', name: 'Magnesium Flash Peony', family: 'Peony', kernel: KERNEL.SPHERE,
      emitter: 'Ti', nm: [0, 0], caliber: 4, stars: 620, burn: 1.9, v0: 74, drag: 2.3, grav: 9.0,
      colors: [C.flash, C.flash], cool: '#C9C4B6', size: 1.25, asym: 0.08, note: '5500 K magnesium — HDR bloom above 3.0 for the first 0.15 s.' }),

  /* ---------------- CHRYSANTHEMUM (tailed stars) -------------------------- */
  A({ id: 'chrys-charcoal-gold', name: 'Charcoal Gold Chrysanthemum', family: 'Chrysanthemum', kernel: KERNEL.SPHERE,
      emitter: 'SrCl', nm: [605, 682], caliber: 8, stars: 1100, burn: 4.2, v0: 58, drag: 1.55, grav: 7.6,
      colors: [C.flash, C.gold], cool: C.goldCool, size: 1.1, trail: 0.95, smoke: 0.45, asym: 0.12,
      note: 'Charcoal-bearing "tailed" stars: a spark layer over the colour core.' }),

  A({ id: 'chrys-silver-titanium', name: 'Titanium Silver Chrysanthemum', family: 'Chrysanthemum', kernel: KERNEL.SPHERE,
      emitter: 'Ti', nm: [0, 0], caliber: 7, stars: 1000, burn: 3.8, v0: 60, drag: 1.7, grav: 8.0,
      colors: [C.flash, C.celadon], cool: '#5E6663', size: 1.05, trail: 0.9, asym: 0.10, note: 'Tails visually soften break asymmetry — forgiving on camera.' }),

  A({ id: 'chrys-carmine-tail', name: 'Carmine Tailed Chrysanthemum', family: 'Chrysanthemum', kernel: KERNEL.SPHERE,
      emitter: 'Li', nm: [670, 671], caliber: 8, stars: 1150, burn: 4.4, v0: 57, drag: 1.5, grav: 7.5,
      colors: [C.flash, C.carmine], cool: C.carmCool, size: 1.1, trail: 1.0, asym: 0.13, note: 'Long lithium-carmine tails, cooling to dried-lacquer crimson.' }),

  A({ id: 'chrys-violet-tail', name: 'Violet-Blue Tailed Chrysanthemum', family: 'Chrysanthemum', kernel: KERNEL.SPHERE,
      emitter: 'CuCl', nm: [420, 460], caliber: 7, stars: 980, burn: 3.6, v0: 55, drag: 1.75, grav: 8.0,
      colors: [C.flash, C.violet], cool: '#1E2C55', size: 1.05, trail: 0.9, weight: 0.5, asym: 0.15,
      note: 'Copper tails wash toward green if the flame runs hot — the classic blue failure mode.' }),

  /* ---------------- WILLOW · KAMURO · BROCADE ----------------------------- */
  A({ id: 'willow-nagaoka-gold', name: 'Nagaoka Gold Willow', family: 'Willow', kernel: KERNEL.WILLOW,
      emitter: 'C', nm: [0, 0], caliber: 12, stars: 1500, burn: 7.2, v0: 46, drag: 1.15, grav: 6.2,
      colors: [C.flash, C.gold], cool: C.goldCool, size: 1.35, trail: 1.0, smoke: 0.6, asym: 0.09, weight: 1.4,
      lens: 'EARTH & CATACLYSM',
      note: 'The memorial shell. Massive drooping amber canopy; fragments before it reaches the mirror.' }),

  A({ id: 'willow-blue', name: 'Blue Willow', family: 'Willow', kernel: KERNEL.WILLOW,
      emitter: 'CuCl', nm: [420, 460], caliber: 10, stars: 1200, burn: 6.4, v0: 44, drag: 1.2, grav: 6.4,
      colors: [C.flash, C.violet], cool: '#1B2950', size: 1.2, trail: 0.95, weight: 0.5, asym: 0.14,
      note: 'Rare and expensive: long-duration copper stars push the 1200 °C ceiling.' }),

  A({ id: 'kamuro-silver-gold', name: 'Kamuro', family: 'Willow', kernel: KERNEL.WILLOW,
      emitter: 'Ti', nm: [0, 0], caliber: 10, stars: 1300, burn: 6.8, v0: 48, drag: 1.2, grav: 6.3,
      colors: [C.flash, C.gold], cool: C.goldCool, size: 1.25, trail: 1.0, glitter: 0.45, smoke: 0.5, asym: 0.10,
      note: '"Boys\' haircut" — loose silvery-gold, long duration, slight twinkle. A feature shell.' }),

  A({ id: 'brocade-crown', name: 'Brocade Crown', family: 'Brocade', kernel: KERNEL.BROCADE,
      emitter: 'Ti', nm: [0, 0], caliber: 10, stars: 1400, burn: 5.6, v0: 52, drag: 1.35, grav: 7.0,
      colors: [C.flash, C.gold], cool: C.goldCool, size: 1.3, trail: 1.0, smoke: 0.85, glitter: 0.3, asym: 0.10,
      note: 'Thick woven gold crown lighting volumetric smoke spheres from within.' }),

  A({ id: 'brocade-crown-silver', name: 'Silver Brocade Crown', family: 'Brocade', kernel: KERNEL.BROCADE,
      emitter: 'Ti', nm: [0, 0], caliber: 9, stars: 1250, burn: 5.2, v0: 53, drag: 1.4, grav: 7.1,
      colors: [C.flash, C.celadon], cool: '#5B6360', size: 1.25, trail: 1.0, smoke: 0.8, asym: 0.09,
      note: 'Silver brocade: cooler incandescent body, heavier illuminated smoke.' }),

  A({ id: 'horsetail-gold', name: 'Gold Horsetail', family: 'Willow', kernel: KERNEL.PALM,
      emitter: 'C', nm: [0, 0], caliber: 8, stars: 320, burn: 5.0, v0: 42, drag: 1.3, grav: 6.8,
      colors: [C.flash, C.gold], cool: C.goldCool, size: 1.8, trail: 1.0, smoke: 0.5, asym: 0.16,
      note: 'Few, very thick comets that arc and droop like a horse\'s tail.' }),

  /* ---------------- DAHLIA · PISTIL · DIADEM ------------------------------ */
  A({ id: 'dahlia-carmine-celadon', name: 'Dahlia', family: 'Dahlia', kernel: KERNEL.SPHERE,
      emitter: 'SrCl', nm: [605, 682], caliber: 9, stars: 420, burn: 4.6, v0: 70, drag: 1.35, grav: 7.4,
      colors: [C.flash, C.carmine], cool: C.carmCool, size: 1.6, trail: 0.7, asym: 0.13,
      note: 'A peony with fewer, larger, longer-flying stars — a sparser, big-petal look.' }),

  A({ id: 'pistil-celadon-core', name: 'Carmine Peony · Celadon Pistil', family: 'Pistil', kernel: KERNEL.PISTIL,
      emitter: 'SrCl', nm: [605, 682], caliber: 8, stars: 1000, burn: 3.8, v0: 62, drag: 1.7, grav: 8.1,
      colors: [C.flash, C.carmine], cool: C.carmCool, pistil: 0.42, pistilColor: C.celadon, size: 1.15, asym: 0.10,
      note: 'Outer strontium shell with a slower, contrasting titanium-barium core.' }),

  A({ id: 'pistil-violet-gold', name: 'Violet Peony · Gold Pistil', family: 'Pistil', kernel: KERNEL.PISTIL,
      emitter: 'CuCl', nm: [420, 460], caliber: 8, stars: 950, burn: 3.9, v0: 60, drag: 1.7, grav: 8.1,
      colors: [C.flash, C.violet], cool: '#22305C', pistil: 0.38, pistilColor: C.gold, size: 1.15, weight: 0.5, asym: 0.14 }),

  A({ id: 'diadem-crown-gold', name: 'Diadem Crown', family: 'Diadem', kernel: KERNEL.DIADEM,
      emitter: 'C', nm: [0, 0], caliber: 9, stars: 900, burn: 5.0, v0: 54, drag: 1.4, grav: 7.2,
      colors: [C.flash, C.gold], cool: C.goldCool, size: 1.3, trail: 0.9, smoke: 0.55, asym: 0.12,
      note: 'Ring of crown spikes — a crown rather than a sphere.' }),

  /* ---------------- RING · SATURN · PATTERN ------------------------------- */
  A({ id: 'saturn-ring-violet', name: 'Tilted Saturn Ring · Violet', family: 'Ring', kernel: KERNEL.RING,
      emitter: 'CuCl', nm: [420, 460], caliber: 8, stars: 780, burn: 4.0, v0: 50, drag: 1.6, grav: 7.8,
      colors: [C.flash, C.violet], cool: '#23325E', size: 1.2, spin: 0.9, asym: 0.16, weight: 0.6,
      note: 'Planetary geometry at a random 3D Euler angle — the reveal shots orbit it.' }),

  A({ id: 'saturn-ring-gold', name: 'Saturn Ring · Gold & Carmine Core', family: 'Ring', kernel: KERNEL.RING,
      emitter: 'C', nm: [0, 0], caliber: 9, stars: 850, burn: 4.4, v0: 52, drag: 1.5, grav: 7.6,
      colors: [C.flash, C.gold], cool: C.goldCool, size: 1.25, spin: 1.1, pistil: 0.3, pistilColor: C.carmine, asym: 0.14 }),

  A({ id: 'ring-flat-celadon', name: 'Flat Ring Shell', family: 'Ring', kernel: KERNEL.RING,
      emitter: 'Ti', nm: [0, 0], caliber: 7, stars: 700, burn: 3.6, v0: 54, drag: 1.7, grav: 8.0,
      colors: [C.flash, C.celadon], cool: '#5F6865', size: 1.15, spin: 0.4, asym: 0.12, note: 'Near-planar ring — reads as a perfect circle only from one angle.' }),

  A({ id: 'spiral-pinwheel', name: 'Pinwheel Spiral', family: 'Pattern', kernel: KERNEL.SPIRAL,
      emitter: 'Ti', nm: [0, 0], caliber: 6, stars: 900, burn: 4.2, v0: 48, drag: 1.45, grav: 7.4,
      colors: [C.flash, C.sodium], cool: '#8A4A12', size: 1.1, spin: 2.4, trail: 0.9, asym: 0.15,
      note: 'Stars laid on a spiral: arms rotate outward as the burn progresses.' }),

  /* ---------------- CROSSETTE · MULTI-STAGE ------------------------------- */
  A({ id: 'crossette-quad', name: 'Quad Crossette Split', family: 'Crossette', kernel: KERNEL.CROSSETTE,
      emitter: 'SrCl', nm: [605, 682], caliber: 8, stars: 240, burn: 4.4, v0: 54, drag: 1.5, grav: 7.6,
      colors: [C.flash, C.carmine], cool: C.carmCool, size: 1.5, split: { t: 0.85, n: 4, impulse: 16 },
      crackleAmt: 0.35, trail: 0.85, asym: 0.14,
      note: 'Flash-burst chamber in a cross-shaped cavity splits each comet into four.' }),

  A({ id: 'crossette-hex-crackle', name: 'Hex Crossette · Bismuth Crackle', family: 'Crossette', kernel: KERNEL.CROSSETTE,
      emitter: 'BaCl', nm: [505, 535], caliber: 9, stars: 200, burn: 4.8, v0: 52, drag: 1.45, grav: 7.4,
      colors: [C.flash, C.emerald], cool: '#1F6B46', size: 1.55, split: { t: 0.9, n: 6, impulse: 18 },
      crackleAmt: 0.8, trail: 0.9, asym: 0.15,
      note: 'Six-way split; bismuth crackle micro-reports fire as the secondary stars light.' }),

  A({ id: 'multibreak-thousands', name: '"Thousands" Multi-Break', family: 'Multi-break', kernel: KERNEL.MULTIBREAK,
      emitter: 'SrCl', nm: [605, 682], caliber: 12, stars: 420, burn: 5.6, v0: 50, drag: 1.4, grav: 7.0,
      colors: [C.flash, C.gold], cool: C.goldCool, size: 1.4, split: { t: 1.5, n: 9, impulse: 24 },
      trail: 0.8, smoke: 0.55, asym: 0.16, weight: 0.9,
      note: 'A large shell carrying many smaller shells of the same size and type.' }),

  A({ id: 'multibreak-two-tone', name: 'Two-Break Variegated · Report', family: 'Multi-break', kernel: KERNEL.MULTIBREAK,
      emitter: 'BaCl', nm: [505, 535], caliber: 10, stars: 360, burn: 5.2, v0: 52, drag: 1.45, grav: 7.2,
      colors: [C.flash, C.emerald], cool: '#1F6B46', size: 1.35, split: { t: 1.3, n: 7, impulse: 22 },
      crackleAmt: 0.5, trail: 0.85, asym: 0.15 }),

  /* ---------------- STROBE · CRACKLE · GLITTER ---------------------------- */
  A({ id: 'strobe-pistil-white', name: 'White Strobe Pistil', family: 'Strobe', kernel: KERNEL.STROBE,
      emitter: 'Ti', nm: [0, 0], caliber: 7, stars: 850, burn: 4.6, v0: 50, drag: 1.6, grav: 7.8,
      colors: [C.flash, C.celadon], cool: '#5F6865', size: 1.15, strobe: 9.5, pistil: 0.35, pistilColor: C.flash, asym: 0.11,
      note: 'Alternating oxidiser/fuel layers make the star pulse rather than burn steadily.' }),

  A({ id: 'strobe-blue', name: 'Blue Strobe Pistil', family: 'Strobe', kernel: KERNEL.STROBE,
      emitter: 'CuCl', nm: [420, 460], caliber: 7, stars: 800, burn: 4.4, v0: 49, drag: 1.65, grav: 7.9,
      colors: [C.flash, C.violet], cool: '#1E2C55', size: 1.1, strobe: 8.0, pistil: 0.32, pistilColor: C.celadon, weight: 0.5, asym: 0.15 }),

  A({ id: 'crackle-titanium', name: 'Titanium Crackling Chrysanthemum', family: 'Crackle', kernel: KERNEL.CRACKLE,
      emitter: 'Ti', nm: [0, 0], caliber: 8, stars: 1100, burn: 4.0, v0: 58, drag: 1.7, grav: 8.0,
      colors: [C.flash, C.celadon], cool: '#6E7A76', size: 1.05, crackleAmt: 1.0, trail: 0.85, asym: 0.12,
      note: 'Erratic micro-strobe crackle at the outer tips of a dense sphere.' }),

  A({ id: 'glitter-antimony', name: 'Antimony Glitter Willow', family: 'Glitter', kernel: KERNEL.WILLOW,
      emitter: 'Sb', nm: [0, 0], caliber: 9, stars: 1150, burn: 5.8, v0: 47, drag: 1.25, grav: 6.6,
      colors: [C.flash, C.gold], cool: C.goldCool, size: 1.4, glitter: 1.0, trail: 1.0, smoke: 0.5, asym: 0.11,
      note: 'Antimony trisulfide: delayed white glitter sparks trailing behind the gold body.' }),

  A({ id: 'crackle-bismuth-coral', name: 'Bismuth Crackle Coral', family: 'Crackle', kernel: KERNEL.CRACKLE,
      emitter: 'CaCl', nm: [591, 622], caliber: 7, stars: 950, burn: 3.8, v0: 56, drag: 1.75, grav: 8.1,
      colors: [C.flash, C.coral], cool: '#7A2E18', size: 1.1, crackleAmt: 0.9, trail: 0.8, asym: 0.13 }),

  /* ---------------- GHOST / COLOUR-CHANGE (layered stars) ----------------- */
  A({ id: 'ghost-red-green', name: 'Ghost Shell · Carmine → Emerald', family: 'Ghost', kernel: KERNEL.GHOST,
      emitter: 'SrCl', nm: [605, 682], caliber: 8, stars: 980, burn: 4.8, v0: 56, drag: 1.6, grav: 7.8,
      colors: [C.carmine, C.emerald], cool: '#1F6B46', size: 1.15, ghost: 2, trail: 0.8, asym: 0.12,
      note: 'Layered star: outer strontium burns away to expose barium. Complex builds take ~40 days of layer/dry cycles.' }),

  A({ id: 'ghost-silver-blue', name: 'Glittering Silver → Blue', family: 'Ghost', kernel: KERNEL.GHOST,
      emitter: 'CuCl', nm: [420, 460], caliber: 8, stars: 940, burn: 4.6, v0: 55, drag: 1.62, grav: 7.9,
      colors: [C.celadon, C.violet], cool: '#1E2C55', size: 1.15, ghost: 2, glitter: 0.5, weight: 0.5, asym: 0.15 }),

  A({ id: 'ghost-gold-purple', name: 'Gold → Purple Chrysanthemum', family: 'Ghost', kernel: KERNEL.GHOST,
      emitter: 'C', nm: [0, 0], caliber: 9, stars: 1050, burn: 5.0, v0: 54, drag: 1.55, grav: 7.6,
      colors: [C.gold, C.magenta], cool: '#4A2260', size: 1.2, ghost: 2, trail: 0.9, asym: 0.12 }),

  /* ---------------- PALM · FALLING LEAVES · BOUQUET ----------------------- */
  A({ id: 'palm-gold-coral', name: 'Golden Palm', family: 'Palm', kernel: KERNEL.PALM,
      emitter: 'C', nm: [0, 0], caliber: 9, stars: 180, burn: 5.4, v0: 44, drag: 1.25, grav: 6.6,
      colors: [C.flash, C.gold], cool: C.goldCool, size: 2.1, trail: 1.0, smoke: 0.6, asym: 0.17,
      note: 'A handful of very thick comets — the sparsest, most sculptural break.' }),

  A({ id: 'falling-leaves-amber', name: 'Falling Leaves · Amber', family: 'Falling Leaves', kernel: KERNEL.FALLINGLEAVES,
      emitter: 'C', nm: [0, 0], caliber: 8, stars: 620, burn: 6.2, v0: 38, drag: 1.1, grav: 4.2,
      colors: [C.flash, C.sodium], cool: '#8A4A12', size: 1.45, trail: 1.0, flutter: 1.0, asym: 0.15,
      note: 'Slow, fluttering embers that sway as they fall — the longest-lived effect.' }),

  A({ id: 'falling-leaves-violet', name: 'Falling Leaves · Violet', family: 'Falling Leaves', kernel: KERNEL.FALLINGLEAVES,
      emitter: 'CuCl', nm: [420, 460], caliber: 8, stars: 560, burn: 6.0, v0: 37, drag: 1.15, grav: 4.4,
      colors: [C.flash, C.violet], cool: '#1E2C55', size: 1.4, trail: 1.0, flutter: 1.1, weight: 0.5, asym: 0.16 }),

  A({ id: 'bouquet-multi', name: 'Floral Bouquet', family: 'Bouquet', kernel: KERNEL.SPHERE,
      emitter: 'SrCl', nm: [605, 682], caliber: 6, stars: 700, burn: 3.6, v0: 58, drag: 1.8, grav: 8.2,
      colors: [C.flash, C.magenta], cool: '#4A2260', size: 1.1, trail: 0.7, asym: 0.12,
      note: 'Mixed strontium + copper stars read as lavender — the premium colour.' }),

  /* ---------------- GROUND MINE · COMET · SALUTE -------------------------- */
  A({ id: 'mine-ground-gold', name: 'Ground Gold Mine', family: 'Mine', kernel: KERNEL.PALM,
      emitter: 'Ti', nm: [0, 0], caliber: 6, stars: 420, burn: 4.0, v0: 60, drag: 1.5, grav: 8.4,
      colors: [C.flash, C.gold], cool: C.goldCool, size: 1.5, ground: true, trail: 0.95, smoke: 0.4, asym: 0.14,
      note: 'Fired from a canister at ground level — the only burst that starts below the horizon line.' }),

  A({ id: 'comet-rising-tail', name: 'Rising Comet Tail', family: 'Comet', kernel: KERNEL.COMET,
      emitter: 'Ti', nm: [0, 0], caliber: 5, stars: 260, burn: 2.4, v0: 30, drag: 0.9, grav: -6.0,
      colors: [C.flash, C.gold], cool: C.goldCool, size: 1.2, trail: 1.0, asym: 0.08,
      note: 'The mortar ascent itself: negative gravity, heavy spark tail, whistle.' }),

  A({ id: 'salute-titanium', name: 'Titanium Salute', family: 'Salute', kernel: KERNEL.SALUTE,
      emitter: 'Ti', nm: [0, 0], caliber: 6, stars: 420, burn: 0.85, v0: 84, drag: 2.6, grav: 9.2,
      colors: [C.flash, C.flash], cool: '#C9C4B6', size: 1.6, crackleAmt: 0.6, smoke: 0.7, asym: 0.08,
      note: 'Flash powder, not stars: a hard white flash then a chest-thumping report.' }),

  A({ id: 'flash-magnesium-singularity', name: '5500 K Magnesium Singularity', family: 'Salute', kernel: KERNEL.SALUTE,
      emitter: 'Ti', nm: [0, 0], caliber: 14, stars: 900, burn: 1.2, v0: 92, drag: 2.8, grav: 9.4,
      colors: [C.flash, C.flash], cool: C.flash, size: 2.2, smoke: 0.5, asym: 0.06, weight: 0.4,
      note: 'The vortex collapse at the end of the intro. HDR bloom > 3.0.' }),

  /* ---------------- REGIONAL / SPECIAL / MEMORIAL ------------------------- */
  A({ id: 'shikake-ice-calm', name: 'Shikake Ice Calm', family: 'Japanese', kernel: KERNEL.SPHERE,
      emitter: 'Ti', nm: [0, 0], caliber: 7, stars: 780, burn: 5.4, v0: 44, drag: 1.35, grav: 6.8,
      colors: [C.flash, C.celadon], cool: '#5F6865', size: 1.15, trail: 0.8, smoke: 0.4, asym: 0.09,
      note: 'Pale, slow, cold celadon — the Japanese "shikake" calm break.' }),

  A({ id: 'nishiki-brocade', name: 'Nishiki Brocade', family: 'Japanese', kernel: KERNEL.BROCADE,
      emitter: 'C', nm: [0, 0], caliber: 10, stars: 1350, burn: 5.8, v0: 50, drag: 1.3, grav: 6.9,
      colors: [C.flash, C.gold], cool: C.goldCool, size: 1.35, trail: 1.0, smoke: 0.8, glitter: 0.35, asym: 0.10,
      note: 'Multi-layered brocade: gold body with staggered burn-out across layers.' }),

  A({ id: 'warimono-dahlia', name: 'Warimono Split Dahlia', family: 'Japanese', kernel: KERNEL.SPHERE,
      emitter: 'SrCl', nm: [605, 682], caliber: 9, stars: 480, burn: 4.8, v0: 68, drag: 1.3, grav: 7.4,
      colors: [C.flash, C.carmine], cool: C.carmCool, size: 1.7, trail: 0.75, asym: 0.13,
      note: 'Japanese "warimono": perfectly separated, very large single stars.' }),

  A({ id: 'italian-ostras', name: 'Ostras · Weeping Gold', family: 'Italian', kernel: KERNEL.WILLOW,
      emitter: 'C', nm: [0, 0], caliber: 11, stars: 1400, burn: 7.0, v0: 45, drag: 1.1, grav: 6.1,
      colors: [C.flash, C.gold], cool: C.goldCool, size: 1.4, trail: 1.0, smoke: 0.6, asym: 0.09,
      note: 'Italian long-duration weeping gold — the melancholy shell of the Mediterranean repertoire.' }),

  A({ id: 'sicilian-crown-ring', name: 'Sicilian Crown Ring', family: 'Italian', kernel: KERNEL.DIADEM,
      emitter: 'Ti', nm: [0, 0], caliber: 9, stars: 880, burn: 5.2, v0: 52, drag: 1.4, grav: 7.2,
      colors: [C.flash, C.sodium], cool: '#8A4A12', size: 1.3, spin: 1.4, trail: 0.9, asym: 0.12 }),

  A({ id: 'chinese-dragon-scale', name: 'Dragon Scale', family: 'Chinese', kernel: KERNEL.GHOST,
      emitter: 'C', nm: [0, 0], caliber: 10, stars: 1200, burn: 5.4, v0: 54, drag: 1.45, grav: 7.4,
      colors: [C.gold, C.carmine], cool: C.carmCool, size: 1.25, ghost: 3, trail: 0.95, smoke: 0.55, asym: 0.13,
      note: 'Three-layer scale: gold → coral → carmine, each layer drying before the next.' }),

  A({ id: 'memorial-celadon-slow', name: 'Memorial Celadon Slow-Fall', family: 'Memorial', kernel: KERNEL.FALLINGLEAVES,
      emitter: 'Ti', nm: [0, 0], caliber: 8, stars: 700, burn: 7.4, v0: 32, drag: 1.0, grav: 3.4,
      colors: [C.flash, C.celadon], cool: '#5F6865', size: 1.5, flutter: 0.7, trail: 1.0, smoke: 0.35,
      lens: 'NOTABLE PASSINGS', weight: 1.6,
      note: 'Reserved for passings: pale, slow, almost weightless. It takes a long time to fall.' }),

  A({ id: 'vigil-ember-long', name: 'Vigil Long Ember', family: 'Memorial', kernel: KERNEL.EMBER,
      emitter: 'C', nm: [0, 0], caliber: 7, stars: 520, burn: 8.0, v0: 26, drag: 0.95, grav: 2.6,
      colors: [C.flash, C.gold], cool: C.goldCool, size: 1.55, trail: 1.0, smoke: 0.3,
      lens: 'NOTABLE PASSINGS', weight: 1.4,
      note: 'Low-altitude embers that drift for eight seconds. Grief has a longer burn time than news.' }),

  A({ id: 'silent-lantern-white', name: 'Silent Lantern', family: 'Memorial', kernel: KERNEL.SPHERE,
      emitter: 'Ti', nm: [0, 0], caliber: 6, stars: 820, burn: 5.0, v0: 40, drag: 1.3, grav: 5.4,
      colors: [C.flash, C.celadon], cool: '#5F6865', size: 1.3, trail: 0.85, silent: true,
      lens: 'NOTABLE PASSINGS', weight: 1.3,
      note: 'No report, no whistle. A pure white bloom that arrives without a sound.' }),

  A({ id: 'seismic-fracture-red', name: 'Seismic Fracture', family: 'Memorial', kernel: KERNEL.CROSSETTE,
      emitter: 'Li', nm: [670, 671], caliber: 10, stars: 300, burn: 5.0, v0: 58, drag: 1.4, grav: 7.2,
      colors: [C.flash, C.carmine], cool: C.carmCool, size: 1.6, split: { t: 0.7, n: 5, impulse: 20 },
      crackleAmt: 0.6, trail: 0.9, smoke: 0.5, lens: 'EARTH & CATACLYSM', weight: 1.2 }),

  A({ id: 'shockwave-concussion', name: 'Shockwave Concussion', family: 'Memorial', kernel: KERNEL.SALUTE,
      emitter: 'Ti', nm: [0, 0], caliber: 8, stars: 600, burn: 1.6, v0: 88, drag: 2.7, grav: 9.3,
      colors: [C.flash, C.celadon], cool: '#6E7A76', size: 1.9, crackleAmt: 0.8, smoke: 0.8,
      lens: 'SUDDEN TRAGEDY', weight: 0.8 }),

  A({ id: 'fronntline-sulphur', name: 'Frontline Sulphur', family: 'Memorial', kernel: KERNEL.CRACKLE,
      emitter: 'Na', nm: [589, 589], caliber: 9, stars: 1050, burn: 4.2, v0: 60, drag: 1.6, grav: 7.8,
      colors: [C.flash, C.sodium], cool: '#8A4A12', size: 1.1, crackleAmt: 1.0, trail: 0.9, smoke: 0.7,
      lens: 'CONFLICT & FRONTLINES', weight: 1.2,
      note: 'Harsh sodium-yellow with continuous crackle — the colour of flares and muzzle flash.' }),

  A({ id: 'iron-rain-long', name: 'Iron Rain', family: 'Memorial', kernel: KERNEL.WILLOW,
      emitter: 'C', nm: [0, 0], caliber: 11, stars: 1450, burn: 6.6, v0: 47, drag: 1.15, grav: 6.3,
      colors: [C.flash, C.gold], cool: C.goldCool, size: 1.35, trail: 1.0, glitter: 0.6, smoke: 0.6,
      lens: 'SUDDEN TRAGEDY', weight: 1.1, note: 'Iron/charcoal blackbody rain — long, heavy, warm.' }),

  A({ id: 'cobalt-vigil', name: 'Cobalt Vigil', family: 'Memorial', kernel: KERNEL.STROBE,
      emitter: 'CuCl', nm: [420, 460], caliber: 7, stars: 820, burn: 5.2, v0: 48, drag: 1.5, grav: 7.4,
      colors: [C.flash, C.violet], cool: '#1E2C55', size: 1.2, strobe: 6.5, pistil: 0.4, pistilColor: C.celadon,
      weight: 0.5, lens: 'SUDDEN TRAGEDY' }),

  A({ id: 'ash-lantern-low', name: 'Ash Lantern', family: 'Memorial', kernel: KERNEL.EMBER,
      emitter: 'C', nm: [0, 0], caliber: 6, stars: 460, burn: 7.0, v0: 24, drag: 0.9, grav: 2.4,
      colors: [C.flash, C.coral], cool: '#7A2E18', size: 1.5, trail: 1.0, smoke: 0.45,
      lens: 'SUDDEN TRAGEDY', weight: 1.0 }),

  A({ id: 'finale-colossal', name: 'Colossal Sky-Filling Finale', family: 'Finale', kernel: KERNEL.SPHERE,
      emitter: 'SrCl', nm: [605, 682], caliber: 16, stars: 2600, burn: 6.0, v0: 78, drag: 1.25, grav: 6.8,
      colors: [C.flash, C.gold], cool: C.goldCool, size: 1.6, trail: 1.0, smoke: 0.7, glitter: 0.5,
      pistil: 0.35, pistilColor: C.carmine, asym: 0.18, weight: 0.5,
      note: '16-inch: ~40 m break radius. The sky-filling shell that ends a display.' }),
];

export const ARCHETYPE_BY_ID = Object.fromEntries(ARCHETYPES.map(a => [a.id, a]));

/** Attach real reference media to an archetype (images / video / audio). */
export function attachMedia(id, media) {
  const a = ARCHETYPE_BY_ID[id];
  if (!a) { console.warn('[archetypes] unknown id', id); return false; }
  Object.assign(a.media, media);
  return true;
}

/** Weighted pick, optionally biased toward an editorial lens. */
export function pickArchetype(lens = null, rng = Math.random) {
  let pool = ARCHETYPES;
  if (lens) {
    const tuned = ARCHETYPES.filter(a => a.lens === lens);
    if (tuned.length) pool = rng() < 0.62 ? tuned : ARCHETYPES;   // 62% lens-matched
  }
  let total = 0;
  for (const a of pool) total += a.weight;
  let r = rng() * total;
  for (const a of pool) { r -= a.weight; if (r <= 0) return a; }
  return pool[pool.length - 1];
}

/** Derive concrete geometry from caliber using the empirical shell laws. */
export function shellGeometry(a) {
  return {
    radius: a.caliber * 2.5,                       // ≈2.5 m of break radius per inch
    altitude: Math.min(a.caliber * 28, 165),       // ≈28 m of altitude per inch, capped
    massHint: Math.pow(a.caliber, 2.2) / 100,      // relative shell mass for audio
  };
}
