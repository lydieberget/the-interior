/* ─────────────────────────────────────────────────────────────
   Per-book internet descriptions — one web-search-grounded
   description (~15 lines) per book, cached in localStorage keyed
   by entry id. Auto-fetched the first time a book is opened; a
   bulk backfill fills the existing archive, resumable like the
   cluster engine. Kept in a separate cache, not embedded in the
   entries (so it stays out of the export — regenerable content).

   All cache access goes through loadDescriptions/saveDescriptions —
   the single seam to rewire if storage ever moves.
   ─────────────────────────────────────────────────────────── */

const DESCK = 'enth-descriptions-v1';
const DESC_MODEL = 'claude-sonnet-4-6';

function loadDescriptions() {
  try { return JSON.parse(localStorage.getItem(DESCK) || '{}') || {}; }
  catch { return {}; }
}

function saveDescriptions(map) {
  localStorage.setItem(DESCK, JSON.stringify(map));
}

/* The cached row for an entry, or null. Shape: { text, at }. */
function descriptionFor(id) {
  return loadDescriptions()[id] || null;
}

/* Which entries can carry a description? Everything except the forms
   whose text IS the entry (quotes, poems) and her own ideas. */
function describable(e) {
  return !['quote', 'poem', 'idea'].includes(e.category);
}

/* Which entries fetch their description unasked, on first open — and
   which the bulk backfill covers. Books only; everything else waits
   for its "Draw the description" button, so no call happens unasked. */
function autoDescribe(e) {
  return e.category === 'book';
}

function descSystemPrompt() {
  return 'You are a learned, warm companion writing for one person\'s private archive of things that have '
    + 'moved her. Given a single work or experience — a book, film, concert or piece of music, artwork, '
    + 'exhibition, stage production, event, or place — write a description of about fifteen lines '
    + '(roughly 220–300 words).\n\n'
    + 'Use web search (up to 2 searches) to confirm what it actually is — the right work by its title and '
    + 'maker, or the right event, production or exhibition by its name, venue and date. If a fact cannot be '
    + 'verified, leave it out rather than invent it.\n\n'
    + 'In flowing prose, cover: what it is and its form; its central themes and preoccupations; where it sits '
    + 'in its maker\'s work and its moment; and why it has mattered. The keeper of this archive has already '
    + 'read, seen, heard or visited it, so you may discuss the substance freely.\n\n'
    + 'Plain text only — NO markdown, no headings, no lists, no title line. Begin directly with the description. '
    + 'Warm and precise, never blurb-gush.';
}

function descUserMessage(e) {
  const md = e.metadata || {};
  const cat = typeof getCat === 'function' ? getCat(e.category) : null;
  const label = cat && cat.id !== 'other' ? cat.label.toLowerCase() : 'work';
  const bits = ['"' + e.title + '"'];
  const who = md.author || md.artist || md.composer || md.director || md.choreographer || md.company;
  if (who)         bits.push('by ' + who);
  if (md.work)     bits.push('— ' + md.work);
  if (md.album)    bits.push('— ' + md.album);
  if (md.venue)    bits.push('at ' + md.venue);
  if (md.location) bits.push('in ' + md.location);
  if (md.year)     bits.push('(' + md.year + ')');
  // The date pins down time-bound things (a concert, an exhibition run).
  const dated = ['music', 'theatre', 'ballet', 'exhibition', 'event'].includes(e.category) && e.date;
  return 'The ' + label + ': ' + bits.join(' ') + (dated ? ' — experienced on ' + e.date : '');
}

/* Requests die instantly while the app is backgrounded; wait for the page to
   be visible again before retrying (mirrors the cluster engine). */
function descWhenVisible() {
  if (typeof document === 'undefined' || !document.hidden) return Promise.resolve();
  return new Promise(resolve => {
    const on = () => {
      if (!document.hidden) { document.removeEventListener('visibilitychange', on); resolve(); }
    };
    document.addEventListener('visibilitychange', on);
  });
}

async function descCompleteWithRetry(req) {
  for (let attempt = 1; ; attempt++) {
    try {
      await descWhenVisible();
      return await window.claude.complete(req);
    } catch (e) {
      const transient = /network|connection|dropped|timed out|failed to fetch|load failed|overloaded|rate limit|529|empty response/i
        .test(e.message || '');
      if (!transient || attempt >= 4) throw e;
      await new Promise(r => setTimeout(r, 3000 * attempt));
    }
  }
}

/* Generate one description and cache it. Returns the cached row, or throws. */
async function generateDescription(book) {
  const text = await descCompleteWithRetry({
    model: DESC_MODEL,
    max_tokens: 900,
    system: descSystemPrompt(),
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 2 }],
    messages: [{ role: 'user', content: descUserMessage(book) }],
  });
  const clean = (text || '').trim();
  if (!clean) throw new Error('The description came back empty. Try again.');
  const map = loadDescriptions();
  const row = { text: clean, at: Date.now() };
  map[book.id] = row;
  saveDescriptions(map);
  return row;
}

/* Bulk backfill: describe every auto-describable entry (books) that has none yet.
   Sequential (web search wants one book at a time), saves after each, so
   partial progress survives an error and the next run resumes from there.
   opts: { force?: boolean, onProgress?: ({done, total}) => void } */
async function backfillDescriptions(entries, opts = {}) {
  const force = !!opts.force;
  const onProgress = opts.onProgress || (() => {});
  let map = loadDescriptions();
  const todo = entries.filter(e => autoDescribe(e) && (force || !map[e.id]));
  const total = todo.length;
  let done = 0;
  onProgress({ done, total });

  for (const book of todo) {
    try {
      await generateDescription(book);
    } catch (e) {
      throw new Error('Stopped after ' + done + ' of ' + total + ' — those are kept; '
        + 'run again to continue from there. (' + e.message + ')');
    }
    done++;
    onProgress({ done, total });
  }
  return loadDescriptions();
}

Object.assign(window, {
  loadDescriptions, descriptionFor, describable, autoDescribe,
  generateDescription, backfillDescriptions,
});
