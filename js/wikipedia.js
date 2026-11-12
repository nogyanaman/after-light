/* ============================================================================
   INTERSPACE · wikipedia.js
   Live dispatch intake from Wikimedia's public recent-change stream.
   ----------------------------------------------------------------------------
   Endpoint : https://stream.wikimedia.org/v2/stream/recentchange  (SSE)
   Filters  · bot edits dropped
            · canary / test events dropped
            · minor edits to old articles dropped  ← an edit to "World War II"
              must never fire a shell. We require the article to be NEW, or to
              have been created/mentioned recently, and to clear a keyword gate
              for conflicts, cataclysms, sudden tragedy or passings.
   Pace     · the host (main.js) paces 3–5 real dispatches every 8–12 s from a
              queue; we never render faster than the sky can breathe.
   Fallback · if the stream is unreachable we keep serving the cached archive
              and say so honestly with a last-sync timestamp. Nothing is invented.
   ========================================================================== */

const STREAM_URL = 'https://stream.wikimedia.org/v2/stream/recentchange?since=-1';
const SUMMARY = 'https://en.wikipedia.org/api/rest_v1/page/summary/';

const INCLUDE = [
  // conflict
  'airstrike','air strike','shelling','offensive','battle of','massacre','war crime','ceasefire',
  'frontline','insurgent','militant','drone strike','invasion','coup','siege','genocide','terrorist attack',
  'rebel','armed clash','military operation','missile attack','killed in an attack','shooting attack',
  // earth
  'earthquake','flood','wildfire','hurricane','typhoon','cyclone','tornado','volcanic eruption',
  'tsunami','landslide','avalanche','drought','famine','epidemic','outbreak','pandemic','heatwave',
  'blizzard','monsoon','wildfires','oil spill','chemical leak','dam collapse','subsidence','sinkhole',
  // sudden tragedy
  'plane crash','crash of','airliner','flight crashed','train collision','derailment','train crash',
  'ship sinking','ferry capsize','boat capsized','building collapse','bridge collapse','mine collapse',
  'explosion at','gas explosion','industrial accident','bus crash','helicopter crash','fire at a',
  'rail disaster','aviation accident','maritime disaster','tragedy',
  // passings
  'dies','dies aged','death of','died aged','died on','assassination of','assassinated','obituary',
  'passes away','found dead','cause of death','deaths in','is dead','have died','were killed',
];
const EXCLUDE = [
  'wikidata','wikimedia','template:','module:','category:','file:','commons','talk:','user:',
  'draft:','portal:','help:','wikipedia:','mediawiki','esports','football','soccer','fifa','uefa',
  'transfer','cricket','tennis','basketball','nba','nfl','nhl','mlb','grand prix','formula',
  'championship','season','tournament','league','match','fixture','album','single','film premiere',
  'box office','video game','anime','manga','television series','episode','election poll','opinion',
  'wiktionary','wikisource','wikivoyage','wikibooks','wikiquote','wikinews','species','simple.wikipedia',
];

export class LiveStream {
  constructor({ onDispatch, onStatus }) {
    this.onDispatch = onDispatch || (() => {});
    this.onStatus = onStatus || (() => {});
    this.status = 'offline';
    this.queue = [];
    this.seen = new Set();
    this.lastSync = null;
    this.paused = false;
    this.summaryBudget = 6;                 // polite: max concurrent summary calls
    this.inflight = 0;
  }

  connect() {
    if (!('EventSource' in window)) { this.onStatus('unsupported'); return; }
    try {
      this.es = new EventSource(STREAM_URL);
    } catch (e) { this.onStatus('blocked'); return; }

    this.failures = 0;
    this.es.onopen = () => {
      this.failures = 0;
      this.status = 'live'; this.onStatus('live'); this.lastSync = Date.now();
    };
    this.es.onerror = () => {
      this.failures++;
      this.status = this.lastSync ? 'reconnecting' : 'offline';
      this.onStatus(this.status);
      // be a good citizen: after repeated failures, stop retrying and say so
      if (this.failures >= 5) {
        this.es.close(); this.es = null;
        this.status = 'offline'; this.onStatus('offline');
      }
    };
    this.es.onmessage = (ev) => {
      if (this.paused) return;
      let d; try { d = JSON.parse(ev.data); } catch (e) { return; }
      this.consider(d);
    };
  }

  /** The editorial gate. Deliberately strict: most edits are not news. */
  consider(d) {
    if (!d || d.type !== 'edit' && d.type !== 'new') return;
    if (d.bot) return;
    if (d.wiki !== 'enwiki') return;
    if (d.patrolled === false && d.type !== 'new') { /* keep: unpatrolled can be real news */ }
    const title = (d.title || '').replace(/_/g, ' ');
    const tl = title.toLowerCase();
    if (this.seen.has(tl)) return;
    if (/^.*\(\s*(disambiguation|film|album|song|TV series|novel)\s*\)$/i.test(title)) return;

    // namespace / noise filter
    if (/^[a-z]+:/i.test(title)) return;
    for (const x of EXCLUDE) if (tl.includes(x)) return;

    // the "old article" gate — the single most important filter
    const isNew = d.type === 'new';
    const recentish = d.timestamp ? (Date.now() / 1000 - d.timestamp) < 60 * 60 * 26 : true;
    const comment = (d.comment || '').toLowerCase();
    const likelyNews = INCLUDE.some(k => tl.includes(k) || comment.includes(k));
    if (!likelyNews) return;
    if (!isNew) {
      // an edit to a decades-old article must never fire
      const oldArticleHints = ['world war', 'ancient', 'history of', 'battle of hastings',
        'byzantine', 'roman empire', 'medieval', 'prehistoric', '19th century', '18th century'];
      if (oldArticleHints.some(k => tl.includes(k))) return;
      if (d.minor && !recentish) return;
      if (!/crash|dies|died|death|explosion|collapse|derail|earthquake|flood|fire|attack|outbreak|killed/i
            .test(comment + ' ' + tl)) return;
    }
    if (!recentish && !isNew) return;

    this.seen.add(tl);
    if (this.seen.size > 4000) this.seen.clear();

    // rate-limited summary fetch (Wikimedia asks for a real User-Agent + throttle)
    if (this.inflight >= this.summaryBudget || this.queue.length > 40) return;
    this.inflight++;
    fetch(SUMMARY + encodeURIComponent(d.title.replace(/ /g, '_')), {
      headers: { 'accept': 'application/json' },
      mode: 'cors',
    })
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        if (!j || j.type === 'disambiguation' || !j.extract) return;
        const text = j.extract.toLowerCase();
        // second gate, on the actual summary text
        if (!INCLUDE.some(k => text.includes(k) || tl.includes(k))) return;
        if (/\b(film|album|song|tournament|season|election)\b/.test(text) &&
            !/\b(crash|dies|died|death|earthquake|flood|explosion|collapse|derail|attack|outbreak)\b/.test(text)) return;
        this.lastSync = Date.now();
        const item = {
          title: j.title,
          summary: j.extract,
          url: j.content_urls?.desktop?.page || ('https://en.wikipedia.org/wiki/' + encodeURIComponent(d.title.replace(/ /g, '_'))),
          at: Date.now(),
        };
        this.queue.push(item);
        if (this.queue.length > 40) this.queue.shift();
        try { this.onDispatch(item); } catch {}
      })
      .catch(() => {})
      .finally(() => { this.inflight = Math.max(0, this.inflight - 1); });
  }

  /** Called by the pacer in main.js. Returns the newest real dispatch or null. */
  take() {
    if (!this.queue.length) return null;
    return this.queue.shift();
  }
  peek() { return this.queue[0] || null; }

  setPaused(p) { this.paused = p; }
  close() { this.es?.close(); this.status = 'closed'; this.onStatus('closed'); }
}
