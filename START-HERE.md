# AFTER LIGHT — the site, in one folder

Static files only. No build step, no npm, no CDN, no API keys, no backend.

## Run it

```bash
cd path/to/this/folder
python3 -m http.server 8080 --bind 0.0.0.0
# open http://localhost:8080
```

Any static host works (GitHub Pages, Netlify, Cloudflare Pages, S3). Upload the
folder as-is. The only requirement is that it is served over **http://** or
**https://** — opening `index.html` from the file system will not work, because
ES modules and the import map need an origin.

## What is in here

| Path | What it is | Do you need to touch it? |
|---|---|---|
| `index.html` | The single page: stage canvases, HUD, drawer, manifesto, import map | Only for `<title>`, meta, and `<link rel="canonical">` (currently `example.com`) |
| `styles.css` | All styling: loader, descent, sky HUD, news callouts | Rarely |
| `js/main.js` | The application: boot, descent, sky, cadence, input | For pacing/behaviour |
| `js/news-fx.js` | The bridge: fires a shell per dispatch, pins the headline card to its break, hands the library the camera | For shell families / card copy |
| `fireworks.js` | The supplied firework library (46 Shells + real recordings) — see `LIBRARY-NOTES.md` | Keep its `audio/` next to it |
| `audio/` | `fw1–fw8.ogg` + `boom.ogg`, the library's real display recordings | Must stay beside `fireworks.js` |
| `js/wikipedia.js` | Live intake: Wikimedia `recentchange` SSE + REST summary, editorial gate | For the filter rules |
| `js/stage.js` | The void, the star field, the camera rig (WIDE / DRONE / AUTO), drag + dolly | For camera tuning |
| `js/fireworks.js` | The site's own particle engine, used for the descent staging | — |
| `js/archetypes.js` | The 62 shell archetypes used below the sky | — |
| `js/patterns.js` | The vertex field on the first page (retired when the descent begins) | — |
| `js/scenes.js` | The four descent pages: the environment drawn behind each message, and the type set over it | For the descent's look |
| `js/callouts.js` | The burst callout cards used during the descent | — |
| `js/audio.js` | The piano score (streamed from `assets/`, starts on the first click) + UI sound | — |
| `js/loader.js` | Boot sequence and the first page (the threshold) | — |
| `js/tokens.js` | Design tokens + `CREATOR` (your name, your LinkedIn URL) | Yes — set your own |
| `data/dispatches.seed.json` | The verified archive used when the live feed is quiet | Optional |
| `assets/` | The piano score, `adrift-among-infinite-stars-trimmed.mp3` (the recording's silent opening is cut) | — |
| `vendor/` | Three.js r170 + postprocessing addons, vendored — no CDN calls | — |
| `README.md` | The design document: why each part is the way it is | — |

## Things to change before you publish

1. `js/tokens.js` → `CREATOR` (name + LinkedIn URL).
2. `index.html` → `<title>`, `<meta name="description">`, `<link rel="canonical">`.
3. Optional: `js/main.js` → `scheduleCadence()` for how often a story fires
   (currently one every 5–7 s, live feed first).
4. Optional: `js/wikipedia.js` → `INCLUDE` / `EXCLUDE` for what counts as news.

## How it behaves, in one paragraph

The sky is a void with a star field and a movable camera. It opens after a
four-chapter descent. On arrival, 2–4 real, recent Wikipedia dispatches leave
their mortars together, so the scene is alive immediately. Each dispatch is a
firework: one of the library's 46 shells, chosen by the story's kind (conflict,
cataclysm, sudden tragedy, a passing), climbing from the floor to break at its
own random point in a large volume of sky. When it breaks, that story's headline
and a one-sentence summary appear on a smoked-glass card pinned to the break,
tinted with the shell's own colour, tethered by a hairline, and it leaves 0.3 s
before the last particle does. Clicking opens the exact Wikipedia article.
After the opening volley, a shell is earned by a genuinely new story from the
live feed; if nothing new has been published for 12 s, a verified recent
dispatch from the archive stands in — clearly labelled, never invented.

## Credits and licences

Dispatches are from Wikipedia, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
Firework recordings: public-domain display audio supplied with the library.
Music: “Adrift Among Infinite Stars” by Scott Buckley, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
(<https://www.scottbuckley.com.au/library/adrift-among-infinite-stars/>); the silent opening of the recording has been trimmed.
Code: CC0. Three.js r170 (MIT).
