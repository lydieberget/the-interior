// Categories, per-category metadata fields, and date helpers. Loaded as globals.
// ENTRIES stays empty in the repo — your archive lives in your browser and your Supabase.

const CATEGORIES = [
  { id: 'book',       label: 'Book',        mark: '¶', plural: 'books' },
  { id: 'music',      label: 'Music',       mark: '♪', plural: 'concerts' },
  { id: 'visualart',  label: 'Visual Art',  mark: '◆', plural: 'works' },
  { id: 'film',       label: 'Film',        mark: '▸', plural: 'films' },
  { id: 'theatre',    label: 'Theatre',     mark: '§', plural: 'performances' },
  { id: 'ballet',     label: 'Ballet',      mark: '※', plural: 'performances' },
  { id: 'exhibition', label: 'Exhibition',  mark: '◇', plural: 'exhibitions' },
  { id: 'event',      label: 'Event',       mark: '★', plural: 'events' },
  { id: 'idea',       label: 'Idea',        mark: '∴', plural: 'ideas' },
  { id: 'place',      label: 'Place',       mark: '◉', plural: 'places' },
  { id: 'quote',      label: 'Quote',       mark: '“', plural: 'quotes' },
  { id: 'poem',       label: 'Poem',        mark: '⁂', plural: 'poems' },
  { id: 'other',      label: 'Other',       mark: '·', plural: 'other' },
];

/* The thirteen provinces of the interior (#38). `category` (book/music/…) stays a
   separate axis — the maps show both. Each entry gets a derived signature
   { id, home_cluster, scores: { <cluster id>: 0..1 } } — see src/clusters.js.
   The glosses anchor the model's scoring; tune them, and the cached scores
   re-derive (the cache invalidates when the id list changes). */
const CLUSTERS = [
  { id: 'examined-self',     label: 'The Examined Self',      gloss: 'introspection, autofiction, journals, psychoanalysis — the inner life observed and written down' },
  { id: 'love-disorders',    label: 'Love & Its Disorders',   gloss: 'desire, passion, jealousy, the couple, eros and its wreckage' },
  { id: 'russian-century',   label: 'The Russian Century',    gloss: 'Russian literature, music and history; the Soviet world, its dissidents and its ghosts' },
  { id: 'japanese-interiors',label: 'Japanese Interiors',     gloss: 'Japanese aesthetics and letters — restraint, mono no aware, craft, stillness' },
  { id: 'gold-ground',       label: 'The Gold Ground',        gloss: 'icons, illumination, Byzantium, sacred and gilded surfaces, the luminous in art' },
  { id: 'devotions-nocturnes', label: 'Devotions & Nocturnes', gloss: 'prayer, liturgy, sacred music, night pieces, candlelit interiority' },
  { id: 'exiles',            label: 'The Exiles',             gloss: 'displacement, emigration, statelessness, the memory of a lost homeland' },
  { id: 'verses',            label: 'The Verses',             gloss: 'poetry itself — the lyric line, compression, what only verse can say' },
  { id: 'absurd-sacred',     label: 'The Absurd & the Sacred', gloss: 'where comedy meets metaphysics; faith and meaninglessness staring at each other' },
  { id: 'body-freedoms',     label: 'The Body & Its Freedoms', gloss: 'dance, sensuality, athleticism, embodiment, the liberation of the flesh' },
  { id: 'mortality-repair',  label: 'Mortality & Repair',     gloss: 'death, grief, illness — and what mends: elegy, consolation, kintsugi' },
  { id: 'tended-life',       label: 'The Tended Life',        gloss: 'gardens, domesticity, the craft of living, slow attention, care' },
  { id: 'vanished-world',    label: 'The Vanished World',     gloss: 'lost epochs and civilisations — Mitteleuropa, the ancien régime, what war and time erased' },
];

const META_FIELDS = {
  book:       [{ key: 'author', label: 'Author' }, { key: 'pages', label: 'Pages' }],
  music:      [{ key: 'author', label: 'Performer' }, { key: 'album', label: 'Venue' }],
  visualart:  [{ key: 'author', label: 'Artist' }, { key: 'period', label: 'Period' }],
  film:       [{ key: 'author', label: 'Director' }, { key: 'year', label: 'Year' }],
  theatre:    [{ key: 'author', label: 'Director' }, { key: 'venue', label: 'Venue' }],
  ballet:     [{ key: 'author', label: 'Choreographer' }, { key: 'venue', label: 'Venue' }],
  exhibition: [{ key: 'author', label: 'Artist' }, { key: 'venue', label: 'Venue' }],
  event:      [{ key: 'source', label: 'Context' }],
  idea:       [{ key: 'source', label: 'Source' }],
  place:      [{ key: 'location', label: 'Location' }, { key: 'country', label: 'Country' }],
  quote:      [{ key: 'author', label: 'Author' }, { key: 'work', label: 'Work' }],
  poem:       [{ key: 'author', label: 'Poet' }, { key: 'work', label: 'Collection' }, { key: 'year', label: 'Year' }],
  other:      [{ key: 'source', label: 'Source' }],
};

// The real archive lives in Supabase (and each device's localStorage cache).
// The repo stays free of personal data — this stays empty. (#8)
const ENTRIES = [];

function monthKey(d) { return d ? d.slice(0, 7) : 'undated'; }
function monthLabel(k) {
  if (k === 'undated') return 'Undated';
  const [y, m] = k.split('-');
  return new Date(+y, +m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}
function fmtDate(d) {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}
function fmtDateShort(d) {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}
function getCat(id) { return CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1]; }
function isQuote(e) { return e.category === 'quote' || e.category === 'idea'; }
function isPoem(e) { return e.category === 'poem'; }

Object.assign(window, {
  CATEGORIES, CLUSTERS, META_FIELDS, ENTRIES,
  monthKey, monthLabel, fmtDate, fmtDateShort, getCat, isQuote, isPoem,
});
