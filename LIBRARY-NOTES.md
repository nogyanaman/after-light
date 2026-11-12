# What changed inside `fireworks.js`

`fireworks.js` is the supplied 46-shell library, upgraded so it can run directly inside the host page's 3D `Stage` scene and frame loop (zero duplicate `WebGLRenderer` or `EffectComposer` overhead) with distinct, frame-synchronized audio for every shell type.

## 1. Shared Stage Scene & Single-Loop Rendering — `init({ scene, camera, externalLoop })` & `step(dt)`
When given `{ scene, camera, externalLoop: true }`, `NewsFireworks` mounts its `THREE.Group` directly inside the host's `THREE.Scene` and advances via `NewsFireworks.step(dt)` inside the host's `requestAnimationFrame` loop. If called without `opts.scene`, it falls back to creating its own standalone overlay `<canvas>`.

## 2. Break reports & lifetime accuracy — `onBurst(fn)` / `opts.onBreak` / `burning()`
- `blast(type, opts)` accepts a per-shell `opts.onBreak(info)` callback (and fires global `onBurst(fn)` hooks) **once per primary break**, at the exact frame of the break, with `{ id, key, label, giant, inches, origin: [x, y, z], life, spread, colors }`.
- Sub-breaks (double breaks, shell-of-shells, crossette 4-way splits, Roman candle shots 2–6, and `warm()`) carry `_reported: true` and `_sub: true` so they never fire `onBurst` twice or steal queued dispatches.
- `burning()` returns active primary bursts (`{ id, x, y, z, age, life }`) with `life` matched to each shell's true star burnout duration.

## 3. Distinct, Synchronized Per-Shell Audio (`SHELL_VOICE` + Master Compressor + Stereo Panning)
- Every shell type in `SHELLS` has a dedicated acoustic profile in `SHELL_VOICE` combining calibrated display recordings (`fw1–fw8.ogg` and `boom.ogg` with pre-roll offsets trimmed so the transient hits at `t = 0`), sub-bass chest thump, casing snap, gas-sphere body, and effect-specific tails (weeping willow rain hiss, palm frond whooshes, Tourbillion/Go-Getter/Fish Doppler whistles, strobe crystalline ticks at `+0.35s`, ghost phase sweeps, synchronized crossette 4-way split snaps at `+0.95s`, and shell-of-shells secondary pops).
- All sounds route through a stereo panner (`StereoPannerNode` derived from the shell's 3D projection), open-air convolution reverb, and a master `DynamicsCompressorNode` limiter so salvos never clip.
- `setSound(on)`, `setVolume(v)`, and `setPaused(p)` keep the firework audio locked to the host's HUD mute button and Manifesto controls.
