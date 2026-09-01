/* ─────────────────────────────────────────────────────────────
   Cluster scoring engine (#39, #40) — derives each entry's
   13-axis signature { home_cluster, scores } via /api/claude,
   cached in localStorage. Incremental: only unscored entries are
   sent; "redraw" forces a full re-run. Manual home re-filings
   live in `overrides`, separate from derived scores, so they
   survive any redraw.

   All cache access goes through loadClusterCache/saveClusterCache —
   the single seam to rewire when storage moves to Supabase (0.1).
   ─────────────────────────────────────────────────────────── */

const CSK = 'enth-clusters-v1';
// Batches are kept small and the wire format compact (scores as a bare array,
// not 13 "key": value pairs) so each call streams in ~10s, not ~55s — long
// streamed responses were getting dropped by mobile networks mid-draw.
const CLUSTER_BATCH = 15;
const CLUSTER_MODEL = 'claude-sonnet-4-6';
const CLUSTER_MAX_TOKENS = 2000;

function emptyClusterCache() {
  return { themes: CLUSTERS.map(c => c.id), byId: {}, overrides: {}, updatedAt: null };
}

function loadClusterCache() {
  try {
    const c = JSON.parse(localStorage.getItem(CSK) || 'null');
    if (c && c.byId) {
      // Theme set changed → derived scores are meaningless; keep the
      // hand-made overrides, drop the rest.
      if (JSON.stringify(c.themes) !== JSON.stringify(CLUSTERS.map(x => x.id))) {
        return { ...emptyClusterCache(), overrides: c.overrides || {} };
      }
      return { themes: c.themes, byId: c.byId, overrides: c.overrides || {}, updatedAt: c.updatedAt || null };
    }
  } catch {}
  return emptyClusterCache();
}

function saveClusterCache(cache) {
  localStorage.setItem(CSK, JSON.stringify(cache));
}

/* An entry's effective home: manual re-filing wins over the derivation. */
function clusterHome(cache, entryId) {
  return cache.overrides[entryId]
    || (cache.byId[entryId] && cache.byId[entryId].home_cluster)
    || null;
}

/* Re-file an entry by hand (#40). Pass null to restore the derived home. */
function setClusterOverride(cache, entryId, clusterId) {
  const overrides = { ...cache.overrides };
  if (clusterId) overrides[entryId] = clusterId;
  else delete overrides[entryId];
  const next = { ...cache, overrides };
  saveClusterCache(next);
  return next;
}

/* One compact line per entry — id first so the model echoes it back. */
function clusterLine(e) {
  const md = e.metadata || {};
  const by = md.author || md.source || '';
  const note = (e.note || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  return e.id + ' | ' + getCat(e.category).label + ' | "' + e.title + '"'
    + (by ? ' — ' + by : '') + (note ? ' | ' + note : '');
}

function clusterSystemPrompt() {
  return 'You are reading entries from one person\'s private archive of cultural enthusiasms — '
    + 'works and moments that moved her. Score each entry\'s affinity to thirteen themes of her '
    + 'inner landscape. Judge by sensibility and subject, never by medium (a film and a poem can '
    + 'share a theme).\n\nThe themes, in order:\n'
    + CLUSTERS.map((c, i) => (i + 1) + '. ' + c.id + ' — ' + c.label + ': ' + c.gloss).join('\n')
    + '\n\nFor every entry given, return one object: "id" (echoed exactly), "home" (the single '
    + 'best theme id), and "s" (an array of exactly 13 scores from 0 to 1, two decimals, one per '
    + 'theme IN THE NUMBERED ORDER above). Most scores should be low — reserve 0.6+ for a real '
    + 'affinity.\n\nReply with ONLY a JSON array, no prose, no code fence:\n'
    + '[{"id":"...","home":"<theme id>","s":[0.10,0.05,0.72,…13 numbers…]}]';
}

/* Tolerant parse: clean array, fenced block, or the first balanced [...]
   in surrounding prose (string-aware, same spirit as parseDiscoverJSON). */
function parseClusterJSON(text) {
  if (!text) return null;
  const tryParse = (s) => {
    try { const d = JSON.parse(s); return Array.isArray(d) ? d : null; } catch { return null; }
  };
  let d = tryParse(text.trim());
  if (d) return d;
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) { d = tryParse(fence[1].trim()); if (d) return d; }
  const start = text.indexOf('[');
  if (start !== -1) {
    let depth = 0, inStr = false, esc = false;
    for (let j = start; j < text.length; j++) {
      const c = text[j];
      if (inStr) {
        if (esc) esc = false;
        else if (c === '\\') esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') inStr = true;
      else if (c === '[') depth++;
      else if (c === ']') {
        depth--;
        if (depth === 0) return tryParse(text.slice(start, j + 1));
      }
    }
  }
  return null;
}

/* Expand a wire row ({id, home, s:[13]} — or the verbose legacy shape) into
   the stored schema {home_cluster, scores:{id:0..1}}. Clamps to [0,1]; if the
   home is missing or unknown, falls back to the highest-scoring theme. */
function normaliseClusterRow(row) {
  if (!row || typeof row !== 'object' || !row.id) return null;
  const ids = CLUSTERS.map(c => c.id);
  const clamp = v => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
  const scores = {};
  if (Array.isArray(row.s)) {
    ids.forEach((t, i) => { scores[t] = clamp(Number(row.s[i])); });
  } else {
    ids.forEach(t => { scores[t] = clamp(Number(row.scores && row.scores[t])); });
  }
  const homeRaw = row.home || row.home_cluster;
  const home = ids.includes(homeRaw)
    ? homeRaw
    : ids.reduce((a, b) => (scores[b] > scores[a] ? b : a));
  return { home_cluster: home, scores };
}

/* Requests die instantly while the app is backgrounded (switching apps,
   screen off) — retrying then just burns the attempts. Wait until the page
   is visible again before retrying. No-op outside a browser. */
function whenVisible() {
  if (typeof document === 'undefined' || !document.hidden) return Promise.resolve();
  return new Promise(resolve => {
    const on = () => {
      if (!document.hidden) { document.removeEventListener('visibilitychange', on); resolve(); }
    };
    document.addEventListener('visibilitychange', on);
  });
}

/* Mobile networks drop long requests now and then — retry transient failures
   (patiently: visibility-gated, growing backoff) before giving up on the batch. */
async function completeWithRetry(req) {
  for (let attempt = 1; ; attempt++) {
    try {
      await whenVisible();
      return await window.claude.complete(req);
    } catch (e) {
      const transient = /network|connection|dropped|timed out|failed to fetch|load failed|overloaded|rate limit|529|empty response/i
        .test(e.message || '');
      if (!transient || attempt >= 5) throw e;
      await new Promise(r => setTimeout(r, 3000 * attempt));
    }
  }
}

/* Score whatever isn't cached yet, in sequential batches. Saves after each
   batch, so partial progress survives an error and the next run resumes.
   opts: { force?: boolean, onProgress?: ({done, total}) => void } */
async function deriveClusters(entries, opts = {}) {
  const force = !!opts.force;
  const onProgress = opts.onProgress || (() => {});
  const cache = force
    ? { ...emptyClusterCache(), overrides: loadClusterCache().overrides }
    : loadClusterCache();

  // Forget scores for entries that no longer exist.
  const live = new Set(entries.map(e => e.id));
  Object.keys(cache.byId).forEach(id => { if (!live.has(id)) delete cache.byId[id]; });

  const todo = entries.filter(e => !cache.byId[e.id]);
  const total = todo.length;
  let done = 0;
  onProgress({ done, total });

  for (let i = 0; i < todo.length; i += CLUSTER_BATCH) {
    const batch = todo.slice(i, i + CLUSTER_BATCH);
    let text;
    try {
      text = await completeWithRetry({
        model: CLUSTER_MODEL,
        max_tokens: CLUSTER_MAX_TOKENS,
        temperature: 0,
        system: clusterSystemPrompt(),
        messages: [{ role: 'user', content: batch.map(clusterLine).join('\n') }],
      });
    } catch (e) {
      throw new Error('Scoring stopped — ' + done + ' of ' + total + ' placed so far are kept; '
        + 'draw again to continue from there. (' + e.message + ')');
    }
    const rows = parseClusterJSON(text);
    if (!rows) throw new Error('Could not read the scoring response as JSON. Draw again to retry — already-scored entries are kept.');
    const wanted = new Set(batch.map(e => e.id));
    rows.forEach(r => {
      if (!wanted.has(r && r.id)) return;
      const n = normaliseClusterRow(r);
      if (n) cache.byId[r.id] = n;
    });
    const scored = batch.filter(e => cache.byId[e.id]).length;
    if (scored === 0) throw new Error('The scoring response matched none of the entries sent. Draw again to retry.');
    done += scored;
    cache.updatedAt = Date.now();
    saveClusterCache(cache);
    onProgress({ done, total });
  }
  return cache;
}

Object.assign(window, {
  CLUSTER_MODEL,
  loadClusterCache, saveClusterCache,
  clusterHome, setClusterOverride,
  deriveClusters,
});
