# AFTER LIGHT

**Nothing here is invented.**

> New here? **`START-HERE.md`** has the quickstart, the file map and what to change before publishing. This document is the design rationale.

A complete, production-grade, zero-dependency 3D web app that renders real, current
Wikipedia dispatches — conflicts, cataclysms, sudden tragedies, notable passings — as
photorealistic asymmetric 3D fireworks inside an infinite void, with spatial
audio and curated editorial archives.

Static files only. No build step, no CDN, no API keys, no backend. Drop the folder on
any $0 static host (GitHub Pages, Netlify, Cloudflare Pages, S3) and it runs.

```
python3 -m http.server 8080     # then open http://localhost:8080
```

---

## The void

The environment is deliberately empty:

- **Background `0x020204`** — black, with two points of blue so it is a colour
  rather than a hole.
- **`THREE.FogExp2(0x020204, 0.0011)`** — the *same* colour, so depth is the
  only depth cue. A shell at 200 units keeps 95 % of its light, one at 1000
  units keeps 30 %, one at 2000 units is nearly gone.
- **No floor, no salt flat, no water reflections, no horizon line, no grid.**
  No mirror twin either: a reflection needs something to reflect in.
- The custom shaders (fireworks, smoke) apply the fog as **transmittance** —
  `exp(-ρ²d²)` on alpha — because mixing an additive pass *toward* the fog
  colour would add light instead of removing it.

## The five stages

| Stage | What happens |
|---|---|
| **1 · The Threshold** | Inline critical CSS paints immediately (FCP ≈ 80 ms), and the boot yields two frames before touching the GPU, so the first thing anyone sees is a running interface rather than a frozen one. The composition is four corners and a void: **logotype top-left**, the **system checks** top-right as a live crescent of six real preflights (device, WebGL, shader compile, audio, corpus, stream) with measured milliseconds, **boot ID + SKIP bottom-right**, and bottom-left a `WORKING` feed in which **every line is a live measurement** — frame cost, JS heap, requests and KB, GPU limits, normalised dispatch count, particle slots. No scripted flavour text, no fake percentage anywhere: each check has a time budget, and one that cannot answer reports `timeout` in its own row and the boot moves on. **Click anywhere** to ignite — or **select one of the 57 recognized star patterns** and the camera dives into it, which is the entry to the descent. |
| **2 · The Descent** | A **400vh** pinned track driven by one normalized clock `p ∈ [0,1]`: four messages dead centre, each chapter exactly **75vh** of scroll, each landing on a fixed stop when the wheel goes quiet. The arithmetic field that is the threshold's subject is retired at the dive, so behind the sentences there is only the real star field and the figure that was picked; the four beats are carried by the camera instead — hold, orbit, push-in, pull — which are the three vantages the sky later offers. At `p ≥ 0.93` the run ends inside black and hands the sky its first live shell. |
| **3 · The Sky** | Unscrollable. 62 archetypes hanging in nothing: no floor, no salt flat, no reflection, no horizon, no grid — exponential depth fog matched to the background colour, so distance is the only depth cue. Volumetric smoke, no mirror twin. |
| **4 · The HUD** | A bare **black** field with four things on it: the **AFTER LIGHT** wordmark top-left — the same display face and .21em tracking as the threshold's logotype, just at corner size — sitting on a hairline beside the device's **own live frame rate** (fps and average frame time, both measured from real inter-frame gaps — there is no name line, nothing on the sky is decorative, and the quality ladder scales the renderer down, to half resolution on very slow hardware, so a weak device prints a running rate rather than a stalled one); one round glass **sound icon** top-right that mutes/unmutes (no volume line — the only volume control is in the manifesto); a **three-name camera pill** bottom-left — one rounded glass rail, a filled chip that slides between **WIDE HORIZON / AERIAL DRONE ORBIT / AUTO FLY TO BURST** by click, drag or `1 2 3`, no icons, the mode sentence announced to screen readers only; and `DISPATCHES` alone bottom-right. No observatory readout, no instruction line, no corner frame, no news strip, no compass. The star field stays, but at 14 % of the entrance's gain: constellations belong to the threshold, the sky belongs to the shells. The manifesto has **no button** — it announces itself once as a notification after the sky opens (`Space` opens it, `Esc` closes it). 45 s idle → HUD drops to 10 %. |
| **5 · The Archive** | LIVE SKY LOG with re-launch; WORLD ARCHIVE filtered by five human-impact lenses. |

---

## Craft notes — the composition pass

The layout was rebuilt against the measurements in `creativity_playbook.md`
(200 award-winning sites, reverse-engineered). The rules that actually moved the
needle, and where each one landed:

| Lesson (from the 200) | Where it is applied |
|---|---|
| **Type is the layout** — 79 % set display type uppercase, 62 % track it *negatively*, and the winners run 300px headlines against 12px mono captions | `AFTER` / `LIGHT` set at `clamp(38px, 7.6vw, 124px)`, tracked `-0.045em`, weight 800 against weight 200. The 10px mono `WORKING` label is a 12:1 scale jump away from it. |
| **Weight polarity** (display 700–900, meta in mono) | Display grotesk for the argument, mono for every piece of metadata. |
| **Asymmetric editorial grid** — not a centred card grid | Four corners, deliberate void in the middle, plus corner registration marks so the emptiness reads as placed rather than defaulted. |
| **Masked line reveal** (96/200 do this) | `AFTER` and `LIGHT` rise from behind `overflow:hidden` masks, staggered 120 ms. The five descent captions do the same — mono numeral first, sentence 90 ms behind it. |
| **Texture is the new decoration** (43/200 run grain) | `#grain` — an inline `feTurbulence` tile at ~10 % `soft-light`, drifting on a 6-step cycle. It kills the gradient banding in the sky. |
| **Smooth/virtual scroll** (76/200 run Lenis) | The descent clock is *eased* (`scrollP += (raw - scrollP) * k`, ~90 ms lag) instead of inheriting raw wheel jumps, and the rig is driven from the render loop, so the camera keeps breathing when you stop scrolling. |
| **Entrance-first motion** (61/200 ship a branded preloader) | Every element of the threshold has a choreographed arrival: lines, rule, subtitle, index, status column — 120 ms apart. |

### Selecting a pattern (stage 1 → the first scroll)

Fifty-seven constellations are injected into the live star buffer at boot — the
eleven that sit centre-frame where the descent hands over, plus 46 more spread
across ±36° of azimuth and −8°…+40° of elevation, so patterns live at the **sides**
of the frame as well as the middle. Each is real: real IAU name, real Bayer
designation or proper name per star, and a hand-shaped figure.

Moving the cursor over one connects its own stars, names it (`ORION ·
BETELGEUSE`) and turns the hint into `CLICK TO ENTER ORION`. Clicking it does
not fire a shell — it flies the camera into the figure, and **that flight is the
transition into the first scroll chapter**:

1. **The dive** (1.45 s). The camera dollies 79 % of the way to the pattern's
   centroid, landing on the figure with a slight lateral drift so the flight
   reads as a move rather than a dolly on rails. The chosen figure is painted at
   full brightness for the whole flight.
2. **The hold** (0.82 s). Nothing moves. The star the visitor picked stays
   exactly where the flight put it.
3. **The fade** (0.62 s). The lit figure is released and dissolves while the
   first scroll chapter opens *from that same pose* — the descent rig inherits
   the zoomed position and pulls back only as the visitor scrolls. There is no
   retreat leg: flying in and then retreating read as a camera move that changed
   its mind.

From there the four chapters are one continuous camera move, not four shots. The
descent rig is keyed in radius / height / azimuth — **hold → orbit → push-in →
pull** — which are the same three vantages the sky later offers as *WIDE HORIZON /
DRONE / AUTO*, so the visitor has already been shown what the buttons do before
the buttons appear. The handover from the zoomed pose is eased over the first
third of the scroll (not the first tenth), so the dive's landing becomes the slow
beginning of the hold rather than a cut to a wide shot. **SKIP** skips the offer
entirely: it goes straight to the sky, because a visitor declining four messages
wants the thing itself, not the first of them.

## The news firework

The supplied library is not an overlay. The page hands it **the stage's own
camera** every frame (`setView` — position, look-at, fov), so its 46 shells are
3D objects in the interspace with real coordinates and real parallax.

- **One dispatch, one shell.** The lens picks the family; the shell leaves a
  mortar on the floor and climbs to 52–92 units before it breaks, so the whole
  ascent is on screen. Breaks are placed by where they will *appear*: a band
  0.40–0.52 of the frame, anywhere across 60% of the width, at three depths —
  a big random patch of sky, chosen so the card always has room above it.
- **The card's x is the burst's x.** The card is anchored to the projected break
  and follows it every frame; it never slides sideways to dodge a neighbour —
  separation is vertical only, so it stays welded to its own firework with a
  straight leader line into the core. Its height is set by the shell's real
  radius (`radius × 0.98 + 20 px`), so no scattered particle is hidden, and if a
  very wide shell would push the card off the top it takes the top of the frame
  and the gap is whatever remains.
- **It leaves 0.3 s before its last star**, timed from the library's own burst
  clock (`burning()`), so the caption is never on screen without its firework.
  Hovering freezes it; clicking opens the exact Wikipedia article; `FOCUS 3D`
  sends the camera to that break.
- **Smoke is the exception, not the rule.** Only the heavy charcoal shells
  (willow, brocade, kamuro, palm, horsetail, waterfall — 85% of them) carry it,
  and 28% of the ordinary ones. It is dimmer, lit for a moment, and gone in 2.2 s
  instead of hanging for the whole burst.
- **Arrival:** 2–4 real recent dispatches leave the mortars together (0.55 s
  apart) so the interspace is already full when the veil lifts; then one new
  sourced story every 8–12 s, live feed first, verified archive as the fallback.
- **The eye is yours:** drag orbits, the wheel dollies, arrows nudge; every
  manual input pauses the automatic camera for six seconds.

Only the bad news gets a shell: a catastrophe, an accident, an outbreak, or a
death reported as one.

## Coming out of the descent

The main screen is black, so the handover is made of black: a full-screen veil
dips to black for 280 ms at the last chapter and the sky rises out of it over
900 ms, the HUD arriving in the same black. Nothing cuts — the last thing the
descent shows is the field collapsing to a point, and the first thing the sky
shows is that point having become a night.

## The field behind the messages

There isn't one. The arithmetic field — the vertex lattice that is the threshold's
subject — is **retired at the moment of the dive**: it fades out as the camera
flies into the figure, and none of it is drawn again for the rest of the descent.
Behind the four sentences there is only the real star field and the figure the
visitor picked. A sentence with a lattice crawling behind it read as a diagram of
an argument rather than the argument itself.

The scrim under each message is a horizontal plate: a band that fades out at both
ends and both sides with a single ember hairline along its top edge, so the
sentence sits on a lit strip of sky instead of inside a smudge. All four messages
sit at the same place, on the same plate, at the same size.

## Four stops, equal

The descent track is **400vh**, which is four chapters of exactly **75vh** of
scroll each once the viewport is subtracted — the same gesture for every message,
and the first one is on screen the moment the dive lands. When the wheel goes
quiet for 150 ms the page settles itself onto the **centre of the nearest
chapter**, so a message is never left half in and half out: the stops are at
p = .125 / .375 / .625 / .875 and the settle glides to them on our own eased
rAF clock (not `behavior:'smooth'`, which a wheel cancels mid-flight). Any real
input cancels the glide. Past the fourth stop the only useful destination is the
end of the run, so the last flick finishes the descent instead of being pulled
back. The chapter pips (01–04) and `SKIP` are shortcuts to the same stops.


## The ignition

Click anywhere on the threshold and a single shell fires into the empty part of the sky
behind the page. It is a faithful port of the Nagaoka willow engine:

* mortar thud (125 → 32 Hz) plus a rising aerodynamic whistle (bandpass 360 → 1750 Hz, Q 5);
* break scheduled at `now + distance / 343` — the report genuinely arrives late;
* sub-bass shockwave (92 → 22 Hz), rolling thunder roar through a distance-driven low-pass
  (650 Hz + df·2400 → 130 Hz), and 34 delayed tip crackles from +1.05 s;
* 1,500 stars with 8-segment velocity-stretched ribbon trails, connected `LineSegments` for
  the weeping streaks, and 22 internally-lit volumetric smoke puffs;
* thermal ramp — 5500 K magnesium flash → chemistry → cooling charcoal ember;
* `assets/ignition.wav` ("Loud Fireworks, Bass Boosted") layered over the synthesis.

The blossom is placed by unprojecting the exact point where the reference photograph puts its
burst — 47 % width, 20 % height — so it opens in the emptiest part of the frame. The shutter
splits 1.2 s after the shell **actually** breaks, not on a wall-clock guess, so a slow machine
still sees the blossom it paid for.

**One constant switches the shell's chemistry** (`js/ignition.js`):

```js
export const BURST_PALETTE = 'IMAGE';   // ← 'IMAGE' or 'NAGAOKA'
```

* `IMAGE` — the pink-magenta chrysanthemum in `assets/reference-burst.png`, with the colour
  ramp sampled straight out of that photograph (flash `rgb(228,172,185)`, mid `rgb(191,95,125)`,
  cool `rgb(122,47,77)`), each re-scaled by the same HDR factors the gold shell uses.
* `NAGAOKA` — strontium + charcoal gold `#F3B35A` → copper-charcoal `#8C421E`.

---

## Architecture

```
index.html          inline critical CSS + #loader-threshold first in <body> + import map
styles.css          the full stylesheet (loads after first paint)
data/               dispatches.seed.json — 101 real, datable, sourced Wikipedia dispatches
vendor/             three.js r170 ESM + addons (fully vendored; zero network dependency)
js/
  tokens.js         exact colour tokens · real metal-salt chemistry · physics constants
  archetypes.js     62 firework archetypes + the media plug-in pipeline
  fireworks.js      the GPU particle system
  stage.js          the void, stars, camera rigs, bloom chain
  relic.js          stage 2 — the object, the shatter, the vortex
  audio.js          procedural pyrotechnics + spatial Web Audio graph
  wikipedia.js      live Wikimedia recent-change intake + editorial gate
  loader.js         stage 1 — threshold, line engine, telemetry, hold-to-ignite
  callouts.js       editorial cards with 2D force relaxation
  main.js           orchestrator, frame loop, pacing, HUD, drawers
  ignition.js       the single shell that opens the site + its spatial sound engine
assets/
  ignition.wav      "Loud Fireworks (Bass Boosted)" — the recording the brief asked for
  reference-burst.png   the reference photograph the IMAGE palette is sampled from
```

### The particle system (`js/fireworks.js`)

* **One** `InstancedBufferGeometry` pool of **80,000–100,000** slots allocated once at boot.
  A dispatch never allocates: it writes a birth timestamp, origin, velocity and chemical
  colour uniforms into dormant slots. There is no `scene.add(new Mesh())` on event arrival,
  anywhere.
* **Two draw calls** for the entire sky — the burst pass and the smoke pass.
* Physics is **analytic**, not simulated: `v(t) = v₀·e^(−k·t)`, `x(t) = v₀(1−e^(−kt))/k`, so a
  particle stores no per-frame state. Drag, gravity, spin, flutter and curl-noise wind shear
  are all evaluated from `t = now − birth`.
* Dirty attribute ranges are coalesced to a single `[lo, hi)` span and uploaded once per frame.
* Dormant slots early-out in the vertex shader at ~2 attribute reads each.
* `document.hidden` skips the render **and** suspends the `AudioContext`.

### Physics that is actually physics (`js/tokens.js`)

| Constant | Value | Source |
|---|---|---|
| Gravity | 9.81 m/s² | — |
| Speed of sound | 343 m/s | Δt = distance / 343 (audio really does arrive late) |
| Break radius | ≈ 2.5 m × caliber (inches) | 3″ ≈ 15 m across; 12″ ≈ 60 m across |
| Burst altitude | ≈ 28 m × caliber | — |
| Star drag | `v₀·e^(−1.65t)` | stars decelerate hard for ~0.4 s, then fall |
| Break asymmetry | 8–18 % elliptical + directional bias | real shells never break as spheres |

### Chemistry that is actually chemistry

Real molecular emitters with measured emission bands and flame-stability windows drive the
colour ramp `#FFFDF8` (5500 K magnesium flash) → metal salt → `#8C421E` (charcoal amber):

`SrCl` 605–682 nm · `Li` 670 nm · `CaCl` 591–622 nm · `Na` 589 nm (D-line) ·
`BaCl` 505–535 nm · **`CuCl` 420–460 nm — only a ~200 °C usable window**, because Cu–Cl
dissociates (~384 kJ/mol) above ~1200 °C. That is why blue shells are rare, and why
`peony-copper-nocturne` is weighted at 0.45 in the picker.

### 62 archetypes, not variations

26 families: peony, chrysanthemum, willow, brocade, dahlia, pistil, diadem, ring/Saturn,
spiral, crossette, multi-break, strobe, crackle, glitter, ghost (colour-change), palm, falling
leaves, bouquet, ground mine, comet, salute, Japanese *shikake*/*nishiki*/*warimono*, Italian
*ostras*, Chinese dragon-scale, nine memorial shells, and the 16″ colossal finale.
17 distinct motion kernels. Every entry carries caliber, emitter, star count, burn time,
drag, gravity, asymmetry, and audio profile.

---

## Plugging in your own reference media

Every archetype has a `media` slot. Point one at an image, video or audio file and it is used
in place of the procedural path — no other code changes.

```js
import { attachMedia } from './archetypes.js';

attachMedia('willow-nagaoka-gold', {
  image: '/assets/willow-01.jpg',     // canopy / sprite texture
  video: '/assets/willow-01.mp4',     // overlay plate
  audio: '/assets/willow-break.wav',  // replaces the procedural break
});
```

Or edit the `media` object directly inside `js/archetypes.js`. The audio path fetches,
decodes and caches the buffer on first use and falls back to synthesis if the fetch fails.

---

## Live data — and what happens without it

`stream.wikimedia.org/v2/stream/recentchange` (SSE, CORS-open) feeds the sky. The editorial
gate in `js/wikipedia.js` is deliberately strict:

* bots, canary events and non-`enwiki` wikis are dropped;
* namespaces, disambiguation, sport, elections and entertainment are dropped;
* **an edit to "World War II" can never fire** — an old article only passes if the edit is
  recent, non-minor, and carries a crash / death / attack / disaster keyword;
* the article's own one-sentence extract is re-checked before anything is queued;
* summary fetches are budgeted to 6 concurrent, out of politeness to Wikimedia.

Pacing is 3–5 dispatches every 8–12 s — a breath, not a metronome. If the stream is
unreachable the app keeps serving the cached archive and says so honestly with a last-sync
timestamp in the drawer footer. **Nothing is ever invented.**

The corpus itself has three sources, in order, and the feed says which one is in use: the
52 KB seed fetched from this site (`json · corpus · 96 docs`), the copy this browser already
normalised and kept in `localStorage` on an earlier visit (`· local cache`), or the inline
six-dispatch fallback (`· inline`) if neither is available. The fetch carries a 2.5 s budget,
so a cold connection costs the threshold nothing more than the row reading `timeout` — the
boot never waits on the network to finish.

---

## Audio

Fully procedural — there are no audio files. Each sound is derived from the shell's own
physics: mortar whistle (bandpassed noise + a glide that Doppler-drops as the shell climbs),
burst charge (broadband transient with an HF shelf scaled by break radius), sub-bass body
scaled by caliber, salute report, antimony glitter, bismuth crackle grains, strobe shimmer,
and a long star hiss for willows.

Spatialisation uses a `PannerNode` (HRTF, inverse distance) per event plus a distance-driven
low-pass that models air absorption; the event is scheduled at `now + distance / 343`.
Everything feeds a `DynamicsCompressor` acting as a master limiter into a convolution
reverb built from a sparse, diffuse impulse response.

---

## What is deliberately *not* here

* No casualty counts, death tolls or tragedy counters. Ever.
* No coordinates or maps.
* No persistent sidebars, no title lockup over the sky.
* No Day / Week / Month tabs — tragedy is not a period filter.
* No "Launch Constellation" button.
* No fake loading percentages.
* No dark patterns, no engagement traps, no invented news.

The only number on the sky is frames per second — and that one is about the machine,
so it is measured and never assumed:

* the rate is `frames / wall-clock`, sampled **four times a second** from
  `performance.now()`, *not* from the clamped simulation `dt` — a struggling
  machine reports its true number instead of a flattering one;
* the **frame-time field (`16.7 ms`) is rewritten on every single frame**, so the
  block is visibly live between rate samples;
* the sparkline keeps **40 real samples**, auto-ranged to the machine's own
  best, so 30 fps does not look like 60 fps;
* the readout starts on an **em dash**, not a placeholder `60` — it shows nothing
  until the machine has actually drawn something.


---

## Accessibility & restraint

* `prefers-reduced-motion` shortens the loader, slows the clock, softens bloom and stills
  the camera drift. There is also a manual **REDUCED MOTION · LANTERN** switch in the manifesto.
* **PAUSE THE SKY** halts rendering and audio. Master volume lives only in the manifesto — the
  HUD sound control is a bare mute/unmute icon.
* `Esc` skips the threshold and closes any overlay; `Space` opens the manifesto (there is no
  button for it — a one-time notification points at the key); `1/2/3` move the camera rail;
  `M` mutes.
* Camera automation pauses for 6 s after any manual input, and there is no camera shake.
* All HUD controls are real buttons with `aria-pressed` / `aria-expanded`.

---

## Performance notes

Measured in the frame loop: **JS work is ~0.3–1.4 ms per frame**; the rest is GPU. Three
things were done to keep it that way:

1. **There is no floor to shade.** The salt flat, its baked crust, its light
   pools and its mirror twin are all gone; the void costs one clear colour and
   nothing else. (~120 noise evaluations per pixel used to be spent on ground
   nobody asked for; that budget is now in the shells.)
2. **The HUD, drawer and modal use `visibility`, not just `opacity`**, so their
   `backdrop-filter` layers are never rasterised while closed.
3. **Graceful degradation thins each shell**, never the scene: if FPS drops, each burst draws
   fewer stars. The bloom and every archetype stay exactly as specified.

Add `?tier=low|mid|high` to the URL to force a tier for testing.

---

## Attribution

Dispatches from Wikipedia, licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/);
data and code released under [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
Reused text is attributed to its authors; no endorsement is implied.
Music: “Adrift Among Infinite Stars” by Scott Buckley, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
(<https://www.scottbuckley.com.au/library/adrift-among-infinite-stars/>); the silent opening of the recording has been trimmed.
Three.js r170 (MIT). Built for the open web.

Set your own name and LinkedIn URL in `CREATOR` at the top of `js/tokens.js`.
