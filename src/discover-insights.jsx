/* ─────────────────────────────────────────────────────────────
   InsightsView — real Claude analysis + follow-up chat
   DiscoverView — real Claude + web-grounded recommendations
   ─────────────────────────────────────────────────────────── */

const useM2 = React.useMemo;
const useS2 = React.useState;
const useE2 = React.useEffect;

const IK = 'enth-insights-v2';
const ICK = 'enth-ins-chat-v2';
const DK = 'enth-discover-v2';
const DSK = 'enth-disc-settings-v2';
// (the old SLK shortlist store was absorbed into the Antechamber —
// see src/antechamber.jsx)

function fTS(t) {
  if (!t) return '';
  return new Date(t).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
function tp(entries) {
  return entries.map(e => {
    const m = Object.entries(e.metadata || {})
      .filter(([k, v]) => v && k !== 'link')
      .map(([k, v]) => k + ':' + v).join(', ');
    return '- [' + getCat(e.category).label + '] "' + e.title + '"'
      + (m ? ' (' + m + ')' : '')
      + (e.note ? ' — ' + e.note : '');
  }).join('\n');
}
// Trimmed profile for Discover: title + author/source + rating only — drops the
// long note text so the per-call input stays small (faster, fewer dropped runs).
function tpCompact(entries) {
  return entries.map(e => {
    const md = e.metadata || {};
    const bits = [md.author || md.source, md.rating ? '★' + md.rating : null]
      .filter(Boolean).join(', ');
    return '- [' + getCat(e.category).label + '] "' + e.title + '"' + (bits ? ' (' + bits + ')' : '');
  }).join('\n');
}

/* ─────────────────────────────────────────────────────────────
   Parse Claude's JSON discovery output. Returns null on failure.
   Expected shape:
   {
     "summary": "optional one-line",
     "sections": [
       { "category": "Classical Music", "items": [
           { "title": "...", "artist": "...", "venue": "...",
             "date": "...", "bookingStatus": "open|opens|soldout|unknown",
             "bookingOpens": "... (if status=opens)", "url": "...",
             "why": "..." }
       ]}
     ]
   }
   ─────────────────────────────────────────────────────────── */
function parseDiscoverJSON(text) {
  if (!text) return null;
  const tryParse = (s) => {
    try { const d = JSON.parse(s); if (d && Array.isArray(d.sections)) return d; } catch {}
    return null;
  };
  // 1. Clean JSON, or fenced ```json … ``` block.
  let d = tryParse(text.trim());
  if (d) return d;
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) { d = tryParse(fence[1].trim()); if (d) return d; }
  // 2. JSON embedded in prose: scan for the first balanced {…} object that
  //    actually carries `sections` (string-aware brace matching, so braces
  //    inside quoted values don't throw off the depth count).
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '{') continue;
    let depth = 0, inStr = false, esc = false;
    for (let j = i; j < text.length; j++) {
      const c = text[j];
      if (inStr) {
        if (esc) esc = false;
        else if (c === '\\') esc = true;
        else if (c === '"') inStr = false;
      } else if (c === '"') inStr = true;
      else if (c === '{') depth++;
      else if (c === '}') {
        if (--depth === 0) { d = tryParse(text.slice(i, j + 1)); if (d) return d; break; }
      }
    }
  }
  return null;
}

/* Generate ICS calendar feed for shortlist */
function shortlistToICS(items) {
  const pad = n => String(n).padStart(2, '0');
  const fmt = (d) => {
    if (!d) return '';
    const dt = new Date(d);
    if (isNaN(dt)) return '';
    return dt.getUTCFullYear() + pad(dt.getUTCMonth() + 1) + pad(dt.getUTCDate())
         + 'T' + pad(dt.getUTCHours()) + pad(dt.getUTCMinutes()) + '00Z';
  };
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Enthousiasmes//EN'];
  items.forEach(it => {
    const start = fmt(it.dateISO || it.date);
    if (!start) return;
    const end = fmt(new Date(new Date(it.dateISO || it.date).getTime() + 2 * 60 * 60 * 1000));
    lines.push('BEGIN:VEVENT');
    lines.push('UID:' + it.id + '@enthousiasmes');
    lines.push('DTSTAMP:' + fmt(new Date()));
    lines.push('DTSTART:' + start);
    lines.push('DTEND:' + end);
    lines.push('SUMMARY:' + (it.title || '').replace(/[\n,;]/g, ' '));
    lines.push('LOCATION:' + (it.venue || '').replace(/[\n,;]/g, ' '));
    const desc = [it.artist, it.why, it.url].filter(Boolean).join(' — ').replace(/\n/g, ' ');
    lines.push('DESCRIPTION:' + desc);
    if (it.url) lines.push('URL:' + it.url);
    lines.push('END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/* ═══════════════════════════════════════════════════════════
   INSIGHTS
   ═══════════════════════════════════════════════════════════ */
function InsightsView({ entries, onOpen }) {
  const [insights, setInsights] = useS2(() => {
    try { return JSON.parse(localStorage.getItem(IK) || 'null'); } catch { return null; }
  });
  const [chat, setChat] = useS2(() => {
    try { return JSON.parse(localStorage.getItem(ICK) || '[]'); } catch { return []; }
  });
  const [q, setQ] = useS2('');
  const [loading, setLoading] = useS2(null);

  const runAnalysis = async () => {
    setLoading('insights');
    try {
      const sys = "You are a thoughtful cultural critic and personal archivist. Analyse someone's collection of cultural enthusiasms. Be perceptive, draw unexpected connections, write with warmth. Flowing prose, not bullets. 250–400 words. Write in English (the archive may be multilingual; quote titles in their own language).";
      const usr = 'Here are my ' + entries.length + ' enthusiasms:\n\n' + tp(entries) + '\n\nWhat patterns? What connections? What does this reveal about what moves me?';
      const text = await window.claude.complete({
        model: 'claude-fable-5',
        max_tokens: 2000,
        messages: [{ role: 'user', content: sys + '\n\n' + usr }],
      });
      const next = { text, timestamp: Date.now() };
      setInsights(next);
      localStorage.setItem(IK, JSON.stringify(next));
      setChat([]);
      localStorage.setItem(ICK, '[]');
    } catch (e) {
      alert('Could not run analysis: ' + e.message);
    }
    setLoading(null);
  };

  // chat is now an array of { q, a, ts } pairs
  const [expanded, setExpanded] = useS2(null); // index of expanded older entry
  const removeChatItem = (idx) => {
    const next = chat.filter((_, i) => i !== idx);
    setChat(next);
    localStorage.setItem(ICK, JSON.stringify(next));
    setExpanded(null);
  };
  const ask = async () => {
    const t = q.trim();
    if (!t || loading) return;
    setQ(''); setLoading('ask');
    try {
      const h = chat.map(p => 'Q: ' + p.q + '\n\nA: ' + p.a).join('\n\n');
      const prompt =
        "You are a thoughtful cultural critic. Answer follow-up questions about this person's collection. Warm, perceptive. 150–300 words. Answer in English unless the question is asked in another language.\n\n"
        + 'My ' + entries.length + ' enthusiasms:\n\n' + tp(entries)
        + '\n\nPrevious analysis:\n' + (insights?.text || '(none)')
        + (h ? '\n\nEarlier exchanges:\n' + h : '')
        + '\n\nMy latest question: ' + t + '\n\nAnswer it.';
      const text = await window.claude.complete({
        model: 'claude-fable-5',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      });
      const pair = { q: t, a: text, ts: Date.now() };
      const final = [...chat, pair];
      setChat(final);
      localStorage.setItem(ICK, JSON.stringify(final));
      setExpanded(null);
    } catch (e) {
      const pair = { q: t, a: 'Error: ' + e.message, ts: Date.now() };
      setChat([...chat, pair]);
    }
    setLoading(null);
  };

  return (
    <div style={{ padding: '0 20px 100px' }}>
      <div style={{ padding: '8px 0 14px', textAlign: 'center' }}>
        <div className="eyebrow rubric" style={{ marginBottom: 6 }}>On reflection</div>
        <h1 className="serif-display" style={{ fontSize: 32, fontWeight: 400, lineHeight: 1 }}>
          <span className="serif-ital">Insights</span>
        </h1>
        <p className="serif-ital" style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.4, marginTop: 6 }}>
          Patterns, connections, and reflections from your {entries.length} enthusiasms
        </p>
      </div>

      {insights && (
        <>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.1em', color: 'var(--ink-faint)', marginBottom: 8, textAlign: 'center' }}>
            ◷ {fTS(insights.timestamp)}
          </div>
          <article style={{
            background: 'var(--card)', border: '0.5px solid var(--line)',
            padding: '22px 22px 20px', marginBottom: 16,
          }}>
            <p className="dropcap" style={{
              fontFamily: 'var(--serif)', fontSize: 14.5, lineHeight: 1.7,
              color: 'var(--ink)', whiteSpace: 'pre-wrap', textWrap: 'pretty',
            }}>
              {insights.text}
            </p>
          </article>
        </>
      )}

      <button onClick={runAnalysis} disabled={!!loading} style={{
        width: '100%', padding: '14px 16px',
        border: '0.5px solid var(--line)', background: 'var(--card-2)',
        fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: loading === 'insights' ? 'var(--ink-faint)' : 'var(--rubric)',
        cursor: loading ? 'default' : 'pointer',
      }}>
        {loading === 'insights' ? '◌ Analysing…' : insights ? '↻ Re-run analysis' : '✶ Run analysis'}
      </button>

      {insights && (
        <div style={{ marginTop: 22, paddingTop: 16, borderTop: '0.5px solid var(--line)' }}>
          <div className="eyebrow rubric" style={{ marginBottom: 14 }}>Ask the Muse</div>

          {chat.length > 1 && chat.slice(0, -1).map((p, i) => {
            const isOpen = expanded === i;
            return (
              <div key={i} style={{
                borderTop: i === 0 ? '0.5px solid var(--line)' : 'none',
                borderBottom: '0.5px solid var(--line)',
                padding: '12px 2px',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <button
                    onClick={() => setExpanded(isOpen ? null : i)}
                    style={{
                      flex: 1, background: 'transparent', border: 'none',
                      padding: 0, textAlign: 'left', cursor: 'pointer',
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                    }}>
                    <span style={{
                      fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-faint)',
                      marginTop: 3, flexShrink: 0,
                    }}>{isOpen ? '▾' : '▸'}</span>
                    <span style={{ flex: 1 }}>
                      <div style={{
                        fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.1em',
                        color: 'var(--ink-faint)', marginBottom: 4,
                      }}>◷ {fTS(p.ts)}</div>
                      <div className="serif-ital" style={{
                        fontSize: 14, lineHeight: 1.45, color: 'var(--ink)',
                      }}>{p.q}</div>
                    </span>
                  </button>
                  <button
                    onClick={() => removeChatItem(i)}
                    aria-label="Remove question"
                    style={{
                      background: 'transparent', border: 'none', padding: '0 4px',
                      fontFamily: 'var(--serif)', fontSize: 16, lineHeight: 1,
                      color: 'var(--ink-faint)', cursor: 'pointer', flexShrink: 0,
                    }}>×</button>
                </div>
                {isOpen && (
                  <div style={{
                    marginTop: 10, paddingTop: 10, paddingLeft: 20,
                    borderTop: '0.5px dotted var(--line)',
                    fontFamily: 'var(--serif)', fontSize: 13.5, lineHeight: 1.65,
                    color: 'var(--ink)', whiteSpace: 'pre-wrap', textWrap: 'pretty',
                  }}>{p.a}</div>
                )}
              </div>
            );
          })}

          {chat.length > 0 && (() => {
            const p = chat[chat.length - 1];
            const lastIdx = chat.length - 1;
            return (
              <article style={{
                background: 'var(--card)', border: '0.5px solid var(--line)',
                padding: '18px 18px 16px', margin: '14px 0 16px',
                position: 'relative',
              }}>
                <button
                  onClick={() => removeChatItem(lastIdx)}
                  aria-label="Remove question"
                  style={{
                    position: 'absolute', top: 8, right: 8,
                    background: 'transparent', border: 'none', padding: '2px 6px',
                    fontFamily: 'var(--serif)', fontSize: 18, lineHeight: 1,
                    color: 'var(--ink-faint)', cursor: 'pointer',
                  }}>×</button>
                <div style={{
                  fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.1em',
                  color: 'var(--ink-faint)', marginBottom: 6,
                }}>◷ {fTS(p.ts)}</div>
                <div className="serif-ital" style={{
                  fontSize: 15, lineHeight: 1.4, color: 'var(--rubric)',
                  marginBottom: 12, paddingBottom: 10, paddingRight: 22,
                  borderBottom: '0.5px solid var(--line)',
                }}>{p.q}</div>
                <div style={{
                  fontFamily: 'var(--serif)', fontSize: 14, lineHeight: 1.7,
                  color: 'var(--ink)', whiteSpace: 'pre-wrap', textWrap: 'pretty',
                }}>{p.a}</div>
              </article>
            );
          })()}

          {loading === 'ask' && (
            <div className="serif-ital" style={{
              fontSize: 12, color: 'var(--ink-faint)',
              padding: '14px 0', textAlign: 'center',
            }}>
              ◌ Thinking…
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 14, alignItems: 'flex-end' }}>
            <textarea value={q} onChange={e => setQ(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); } }}
              placeholder={chat.length ? 'Ask another…' : 'What connects these enthusiasms?'}
              rows={1}
              style={{
                flex: 1, padding: '10px 12px', border: '0.5px solid var(--line)',
                background: 'var(--card-2)', fontFamily: 'var(--serif)', fontStyle: 'italic',
                fontSize: 14, outline: 'none', resize: 'none', minHeight: 40,
              }}/>
            <button onClick={ask} disabled={!q.trim() || !!loading} style={{
              width: 42, height: 42,
              background: q.trim() ? 'var(--ink)' : 'var(--card-2)',
              color: q.trim() ? 'var(--paper)' : 'var(--ink-faint)',
              border: '0.5px solid var(--line)',
              fontSize: 16,
            }}>
              →
            </button>
          </div>
        </div>
      )}

      {!insights && !loading && (
        <div style={{
          textAlign: 'center', padding: '40px 20px', marginTop: 14,
          fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 14, color: 'var(--ink-faint)',
        }}>
          Tap above to discover what your collection reveals about you.
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DISCOVER
   ═══════════════════════════════════════════════════════════ */
function DiscoverView({ entries, wants, onWants }) {
  const defaults = (() => {
    try {
      const s = JSON.parse(localStorage.getItem(DSK) || '{}');
      return {
        cities: s.cities || 'London, Paris',
        directions: s.directions || '',
        period: s.period || 'next-3-months',
        fromDate: s.fromDate || '',
        toDate: s.toDate || '',
        focus: s.focus || 'all',
      };
    } catch {
      return { cities: 'London, Paris', directions: '', period: 'next-3-months', fromDate: '', toDate: '', focus: 'all' };
    }
  })();
  const [cities, setCities] = useS2(defaults.cities);
  const [dir, setDir] = useS2(defaults.directions);
  const [period, setPeriod] = useS2(defaults.period);
  const [fromDate, setFromDate] = useS2(defaults.fromDate);
  const [toDate, setToDate] = useS2(defaults.toDate);
  const [focus, setFocus] = useS2(defaults.focus);
  const [discover, setDiscover] = useS2(() => {
    try { return JSON.parse(localStorage.getItem(DK) || 'null'); } catch { return null; }
  });
  const [loading, setLoading] = useS2(false);
  // The shortlist now lives in the Antechamber store (wants with
  // source:'discover'); this drawer is a window onto it.
  const shortlist = (wants || []).filter(w => w.source === 'discover');

  const itemId = (item, sectionCat) => {
    // Stable id from category + title + venue + date
    return [sectionCat, item.title, item.venue, item.date].filter(Boolean).join('::');
  };
  const isShortlisted = (id) => shortlist.some(s => s.id === id);
  const toggleShortlist = (item, sectionCat) => {
    const id = itemId(item, sectionCat);
    if (isShortlisted(id)) {
      onWants(ws => ws.filter(w => w.id !== id));
    } else {
      onWants(ws => [...ws, { ...item, id, category: sectionCat, source: 'discover', addedAt: Date.now() }]);
    }
  };

  // Compute the actual date window in plain English from the chosen period
  const computeWindow = () => {
    const now = new Date();
    const fmt = d => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const fmtMonth = d => d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    const addMonths = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };

    if (period === 'custom' && fromDate && toDate) {
      return { label: fmt(new Date(fromDate)) + ' to ' + fmt(new Date(toDate)),
               from: fmt(new Date(fromDate)), to: fmt(new Date(toDate)) };
    }
    if (period === 'next-week') {
      const end = new Date(now); end.setDate(now.getDate() + 7);
      return { label: 'the next 7 days', from: fmt(now), to: fmt(end) };
    }
    if (period === 'next-weekend') {
      // Friday–Sunday of the upcoming weekend. On Fri/Sat, use the weekend in
      // progress; on Sun (mostly over) and Mon–Thu, jump to the next Friday.
      const day = now.getDay(); // 0 Sun … 6 Sat
      const fri = new Date(now);
      if (day === 5) { /* today is Friday */ }
      else if (day === 6) { fri.setDate(now.getDate() - 1); }
      else { fri.setDate(now.getDate() + ((5 - day + 7) % 7)); }
      const sun = new Date(fri); sun.setDate(fri.getDate() + 2);
      const shortDay = d => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
      return { label: 'the weekend of ' + shortDay(fri), from: fmt(fri), to: fmt(sun) };
    }
    if (period === 'this-month') {
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { label: fmtMonth(now), from: fmt(now), to: fmt(end) };
    }
    if (period === 'next-month') {
      const start = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      return { label: fmtMonth(start), from: fmt(start), to: fmt(end) };
    }
    if (period === 'next-6-months') {
      return { label: 'the next 6 months', from: fmt(now), to: fmt(addMonths(now, 6)) };
    }
    if (period === 'this-year') {
      const end = new Date(now.getFullYear(), 11, 31);
      return { label: 'the rest of ' + now.getFullYear(), from: fmt(now), to: fmt(end) };
    }
    // default: next 3 months
    return { label: 'the next 3 months', from: fmt(now), to: fmt(addMonths(now, 3)) };
  };

  const run = async () => {
    setLoading(true);
    localStorage.setItem(DSK, JSON.stringify({ cities, directions: dir, period, fromDate, toDate, focus }));
    try {
      const win = computeWindow();
      const cc = cities.trim() || 'London, Paris';
      const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      const userDir = dir.trim();

      // Focus determines scope: a single category gets fewer searches and a single section.
      const FOCUS_LABELS = {
        all: 'All categories',
        music: 'Classical Music & Concerts',
        exhibitions: 'Art Exhibitions',
        theatre: 'Theatre & Dance',
        cinema: 'Cinema',
        books: 'Books',
      };
      const focusLabel = FOCUS_LABELS[focus] || 'All categories';
      const isAll = focus === 'all';

      // Restructured prompt: explicit task framing, directions FIRST after the request,
      // strict instructions about dates and verification, web_search tool enabled.
      const sys =
        "You are a meticulous cultural concierge. Recommend SPECIFIC, REAL events and works tailored to this person — never invented, never repeated.\n\n" +
        "RULES:\n" +
        "0. Write every prose field (summary, why, dates, bookingOpens) in ENGLISH, whatever languages the archive or the events are in. Keep titles and venue names in their own language.\n" +
        "1. Use web search to verify every event recommendation. If you cannot verify it is real and happening within the requested date window, do not include it.\n" +
        "2. Every event must have: exact date, venue, and a one-line reason this specific person would love it (referencing their archive).\n" +
        "3. For films and books: include both recent and older works the person hasn't logged yet — depth and timelessness matter more than novelty.\n" +
        "4. NEVER recommend events that have already happened.\n" +
        "5. If the user has given additional directions, those take priority.\n" +
        "6. Every recommendation must include a direct URL — for events, the venue's booking page or ticketing platform. For books, a publisher or retailer page. For films, a UK cinema listing or streaming service.\n\n" +
        "RESPONSE FORMAT:\n" +
        "Return ONE valid JSON object and nothing else (no preamble, no markdown fences). Schema:\n" +
        "{\n" +
        '  "summary": "one-line opening (optional)",\n' +
        '  "sections": [\n' +
        '    {\n' +
        '      "category": "Classical Music & Concerts" | "Art Exhibitions" | "Theatre & Dance" | "Cinema" | "Books" | "Other",\n' +
        '      "items": [\n' +
        '        {\n' +
        '          "title": "Event or work title",\n' +
        '          "artist": "Performer / artist / director / author",\n' +
        '          "venue": "Venue name and city, OR cinema/streaming platform, OR publisher",\n' +
        '          "date": "Human-readable date, e.g. Wed 23 April 2026, 19:30",\n' +
        '          "dateISO": "ISO start datetime, e.g. 2026-04-23T19:30 (events only; omit for books/films without a fixed date)",\n' +
        '          "bookingStatus": "open" | "opens" | "soldout" | "unknown" | "n/a",\n' +
        '          "bookingOpens": "If status=opens, when. e.g. Opens 14 March",\n' +
        '          "url": "Direct booking or info URL",\n' +
        '          "why": "One sentence on why this fits the person, referencing a specific entry from their archive."\n' +
        '        }\n' +
        '      ]\n' +
        '    }\n' +
        '  ]\n' +
        "}\n\n" +
        (isAll
          ? "Aim for 2–4 items per section, 3–5 sections total. Skip a section if you have nothing solid for it."
          : "FOCUS: Return ONE section only — '" + focusLabel + "' — with 5–8 well-chosen items. Do not include other categories.") +
        "\n\nCRITICAL: Do your thinking through the web searches only. Do NOT write any prose, reasoning, running commentary, or a list of findings — not before the JSON and not after it. Your entire reply must be the single JSON object, starting with '{' and ending with '}'.";

      const userTaste =
        "Here is the person's archive of " + entries.length + " enthusiasms (what has moved them):\n\n" + tpCompact(entries);

      const userTask =
        "TODAY'S DATE: " + today + "\n" +
        "CITIES: " + cc + "\n" +
        "DATE WINDOW: " + win.from + " — " + win.to + " (" + win.label + ")\n" +
        "FOCUS: " + focusLabel + "\n" +
        (userDir ? "\n*** USER'S SPECIFIC REQUEST FOR THIS RUN ***\n" + userDir + "\n*** END USER REQUEST ***\n\n" +
                   "Treat the request above as the primary brief. Tailor everything to it.\n"
                  : "\n") +
        (isAll
          ? "Find specific events in " + cc + " between " + win.from + " and " + win.to +
            ", plus films and books that fit this person's sensibility.\n"
          : "Find " + focusLabel.toLowerCase() + " in " + cc +
            (focus === 'books' || focus === 'cinema'
              ? " (or anywhere — books and films aren't location-bound) "
              : " between " + win.from + " and " + win.to + " ") +
            "for this person.\n") +
        "Use web search to verify every event has the right date and venue. Use the JSON schema specified in the system prompt. Return JSON only.";

      // The Vercel function now allows 300s (was 60s, then 180s), so we can
      // afford the search budget the feature was originally designed around:
      // ~5 searches for "Everything", ~3 for a focused category. The extra
      // headroom matters for wide windows (6 months / rest of the year), which
      // surface far more candidate events. The streaming keepalive holds the
      // connection open across the longer run. Token budgets are generous so
      // the JSON never truncates mid-section.
      const maxSearches = isAll ? 5 : 3;
      const maxTokens = isAll ? 4000 : 3000;

      const text = await window.claude.complete({
        max_tokens: maxTokens,
        system: sys,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: maxSearches }],
        messages: [{ role: 'user', content: userTaste + '\n\n' + userTask }],
      });
      const parsed = parseDiscoverJSON(text);
      const next = { text, parsed, timestamp: Date.now(), cities: cc, window: win.label, directions: userDir, focus, focusLabel };
      setDiscover(next);
      localStorage.setItem(DK, JSON.stringify(next));
    } catch (e) {
      alert('Could not run discovery.\n\n' + e.message);
    }
    setLoading(false);
  };

  const mailDiscovery = () => {
    if (!discover) return;
    const lines = [];
    lines.push('Recommendations from ' + fTS(discover.timestamp));
    if (discover.cities) lines.push('Cities: ' + discover.cities);
    if (discover.window) lines.push('Window: ' + discover.window);
    lines.push('');
    lines.push('---');
    lines.push('');
    if (discover.parsed?.sections) {
      discover.parsed.sections.forEach(sec => {
        lines.push(sec.category.toUpperCase());
        lines.push('');
        sec.items.forEach(it => {
          lines.push('• ' + it.title);
          if (it.artist) lines.push('  ' + it.artist);
          if (it.venue) lines.push('  ' + it.venue);
          if (it.date) lines.push('  ' + it.date);
          if (it.why) lines.push('  Why: ' + it.why);
          if (it.url) lines.push('  ' + it.url);
          lines.push('');
        });
      });
    } else {
      lines.push(discover.text);
    }
    const s = encodeURIComponent('Enthousiasmes — Discover (' + (discover.cities || '') + ')');
    const b = encodeURIComponent(lines.join('\n'));
    window.open('mailto:?subject=' + s + '&body=' + b, '_self');
  };

  const mailShortlist = () => {
    if (!shortlist.length) return;
    const lines = ['Your shortlist (' + shortlist.length + ' to book)', ''];
    shortlist.forEach(it => {
      lines.push('• ' + it.title + (it.artist ? ' — ' + it.artist : ''));
      if (it.venue) lines.push('  ' + it.venue);
      if (it.date) lines.push('  ' + it.date);
      if (it.bookingStatus === 'opens' && it.bookingOpens) lines.push('  Booking opens: ' + it.bookingOpens);
      if (it.url) lines.push('  Book: ' + it.url);
      lines.push('');
    });
    const s = encodeURIComponent('Enthousiasmes — Shortlist');
    const b = encodeURIComponent(lines.join('\n'));
    window.open('mailto:?subject=' + s + '&body=' + b, '_self');
  };

  const calendarShortlist = () => {
    if (!shortlist.length) return;
    const ics = shortlistToICS(shortlist);
    const blob = new Blob([ics], { type: 'text/calendar' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'enthousiasmes-shortlist.ics';
    a.click();
  };

  const clearShortlist = () => {
    if (!shortlist.length) return;
    if (!confirm('Clear all ' + shortlist.length + ' items from your shortlist?')) return;
    onWants(ws => ws.filter(w => w.source !== 'discover'));
  };

  return (
    <div style={{ padding: '0 20px 100px' }}>
      <div style={{ padding: '8px 0 14px', textAlign: 'center' }}>
        <div className="eyebrow rubric" style={{ marginBottom: 6 }}>What next</div>
        <h1 className="serif-display" style={{ fontSize: 32, fontWeight: 400, lineHeight: 1 }}>
          <span className="serif-ital">Discover</span>
        </h1>
        <p className="serif-ital" style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.4, marginTop: 6 }}>
          Concerts, exhibitions, theatre, cinema, and books — chosen for your sensibility
        </p>
      </div>

      <label className="eyebrow" style={{ display: 'block', marginBottom: 6, marginTop: 10 }}>Cities</label>
      <input value={cities} onChange={e => setCities(e.target.value)}
        placeholder="London, Paris, Florence…"
        style={{ width: '100%', padding: '10px 0', marginBottom: 14, border: 'none', borderBottom: '0.5px solid var(--line)', background: 'transparent', fontFamily: 'var(--serif)', fontSize: 15, outline: 'none' }}/>

      <label className="eyebrow" style={{ display: 'block', marginBottom: 8 }}>Time window</label>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: period === 'custom' ? 10 : 16 }}>
        {[
          { id: 'next-week', label: 'Next week' },
          { id: 'next-weekend', label: 'Next weekend' },
          { id: 'this-month', label: 'This month' },
          { id: 'next-month', label: 'Next month' },
          { id: 'next-3-months', label: 'Next 3 months' },
          { id: 'next-6-months', label: 'Next 6 months' },
          { id: 'this-year', label: 'Rest of the year' },
          { id: 'custom', label: 'Custom…' },
        ].map(opt => (
          <button key={opt.id} onClick={() => setPeriod(opt.id)} style={{
            padding: '5px 10px', borderRadius: 100,
            border: '0.5px solid ' + (period === opt.id ? 'var(--ink)' : 'var(--line)'),
            background: period === opt.id ? 'var(--ink)' : 'transparent',
            color: period === opt.id ? 'var(--paper)' : 'var(--ink-soft)',
            fontFamily: 'var(--sans)', fontSize: 11, whiteSpace: 'nowrap',
            transition: 'all .15s', cursor: 'pointer',
          }}>
            {opt.label}
          </button>
        ))}
      </div>
      {period === 'custom' && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'baseline' }}>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            style={{ flex: 1, padding: '8px 10px', border: '0.5px solid var(--line)', background: 'var(--card)', fontFamily: 'var(--serif)', fontSize: 13, outline: 'none', colorScheme: 'light' }}/>
          <span className="serif-ital" style={{ color: 'var(--ink-soft)', fontSize: 12 }}>to</span>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            style={{ flex: 1, padding: '8px 10px', border: '0.5px solid var(--line)', background: 'var(--card)', fontFamily: 'var(--serif)', fontSize: 13, outline: 'none', colorScheme: 'light' }}/>
        </div>
      )}

      <label className="eyebrow" style={{ display: 'block', marginBottom: 8 }}>Focus</label>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 16 }}>
        {[
          { id: 'all',         label: 'Everything',      mark: '◉' },
          { id: 'music',       label: 'Music',           mark: '♪' },
          { id: 'exhibitions', label: 'Exhibitions',     mark: '◇' },
          { id: 'theatre',     label: 'Theatre & Dance', mark: '§' },
          { id: 'cinema',      label: 'Cinema',          mark: '▸' },
          { id: 'books',       label: 'Books',           mark: '¶' },
        ].map(opt => (
          <button key={opt.id} onClick={() => setFocus(opt.id)} style={{
            padding: '5px 10px', borderRadius: 100,
            border: '0.5px solid ' + (focus === opt.id ? 'var(--ink)' : 'var(--line)'),
            background: focus === opt.id ? 'var(--ink)' : 'transparent',
            color: focus === opt.id ? 'var(--paper)' : 'var(--ink-soft)',
            fontFamily: 'var(--sans)', fontSize: 11, whiteSpace: 'nowrap',
            display: 'inline-flex', alignItems: 'center', gap: 5,
            transition: 'all .15s', cursor: 'pointer',
          }}>
            <span style={{ fontFamily: 'var(--serif)', fontStyle: 'italic' }}>{opt.mark}</span>
            {opt.label}
          </button>
        ))}
      </div>

      <label className="eyebrow" style={{ display: 'block', marginBottom: 6 }}>Additional directions</label>
      <textarea value={dir} onChange={e => setDir(e.target.value)}
        placeholder="e.g. I'm especially interested in piano recitals…"
        rows={2}
        style={{ width: '100%', padding: '10px 12px', marginBottom: 18, border: '0.5px solid var(--line)', background: 'var(--card)', fontFamily: 'var(--serif)', fontSize: 13.5, lineHeight: 1.5, outline: 'none', resize: 'vertical' }}/>

      <button onClick={run} disabled={loading} style={{
        width: '100%', padding: '14px 16px',
        border: '0.5px solid var(--line)', background: 'var(--card-2)',
        fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: loading ? 'var(--ink-faint)' : 'var(--rubric)',
        cursor: loading ? 'default' : 'pointer',
      }}>
        {loading ? '◌ Researching…' : discover ? '↻ Re-run discovery' : '◉ Run discovery'}
      </button>

      {discover && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.1em', color: 'var(--ink-faint)', marginBottom: 14, textAlign: 'center' }}>
            ◷ {fTS(discover.timestamp)}{discover.cities ? ' — ' + discover.cities : ''}{discover.window ? ' — ' + discover.window : ''}{discover.focus && discover.focus !== 'all' ? ' — ' + (discover.focusLabel || discover.focus) : ''}
          </div>

          {discover.parsed?.summary && (
            <p className="serif-ital" style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 18, textAlign: 'center', lineHeight: 1.5 }}>
              {discover.parsed.summary}
            </p>
          )}

          {discover.parsed?.sections ? (
            discover.parsed.sections.map((sec, si) => (
              <section key={si} style={{ marginBottom: 22 }}>
                <div className="eyebrow rubric" style={{ marginBottom: 10, paddingBottom: 6, borderBottom: '0.5px solid var(--line-soft)' }}>
                  {sec.category}
                </div>
                {sec.items.map((it, ii) => {
                  const id = itemId(it, sec.category);
                  const saved = isShortlisted(id);
                  const status = it.bookingStatus;
                  return (
                    <article key={ii} style={{
                      background: 'var(--card)', border: '0.5px solid var(--line)',
                      padding: '14px 16px', marginBottom: 8,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', marginBottom: 6 }}>
                        <h3 className="serif-display" style={{ fontSize: 17, fontWeight: 500, lineHeight: 1.2, flex: 1, color: 'var(--ink)' }}>
                          {it.title}
                        </h3>
                        {status === 'open' && (
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--moss)', whiteSpace: 'nowrap' }}>● Open</span>
                        )}
                        {status === 'opens' && (
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gold)', whiteSpace: 'nowrap' }}>◌ {it.bookingOpens || 'Opens later'}</span>
                        )}
                        {status === 'soldout' && (
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)', whiteSpace: 'nowrap' }}>× Sold out</span>
                        )}
                      </div>
                      {(it.artist || it.venue) && (
                        <div className="serif-ital" style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 4 }}>
                          {it.artist}{it.artist && it.venue ? ' · ' : ''}{it.venue}
                        </div>
                      )}
                      {it.date && (
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.06em', color: 'var(--rubric)', marginBottom: 8 }}>
                          {it.date}
                        </div>
                      )}
                      {it.why && (
                        <p style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 13, lineHeight: 1.5, color: 'var(--ink-soft)', marginBottom: 10 }}>
                          {it.why}
                        </p>
                      )}
                      <div style={{ display: 'flex', gap: 6, paddingTop: 8, borderTop: '0.5px solid var(--line-soft)' }}>
                        <button onClick={() => toggleShortlist(it, sec.category)} style={{
                          flex: 1, padding: '7px 10px',
                          border: '0.5px solid ' + (saved ? 'var(--rubric)' : 'var(--line)'),
                          background: saved ? 'var(--rubric-soft)' : 'transparent',
                          color: saved ? 'var(--rubric)' : 'var(--ink-soft)',
                          fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
                        }}>
                          {saved ? '★ Saved' : '☆ Save to shortlist'}
                        </button>
                        {it.url && (
                          <a href={it.url} target="_blank" rel="noopener" style={{
                            padding: '7px 12px', border: '0.5px solid var(--line)', background: 'transparent',
                            fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
                            color: 'var(--ink-soft)', textDecoration: 'none', whiteSpace: 'nowrap',
                          }}>
                            Book ↗
                          </a>
                        )}
                      </div>
                    </article>
                  );
                })}
              </section>
            ))
          ) : (
            // Fallback if JSON parse failed — show raw text
            <article style={{
              background: 'var(--card)', border: '0.5px solid var(--line)',
              padding: '22px 22px 20px', marginBottom: 14, maxWidth: '100%',
            }}>
              <p style={{ fontFamily: 'var(--serif)', fontSize: 14, lineHeight: 1.7, color: 'var(--ink)', whiteSpace: 'pre-wrap', textWrap: 'pretty', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                {discover.text}
              </p>
            </article>
          )}

          <button onClick={mailDiscovery} style={{
            padding: '10px 14px', border: '0.5px solid var(--line)', background: 'transparent',
            fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
            color: 'var(--ink-soft)', marginTop: 8,
          }}>
            ✉ Email these recommendations
          </button>
        </div>
      )}

      {/* Shortlist drawer — always visible if non-empty */}
      {shortlist.length > 0 && (
        <div style={{
          marginTop: 28,
          background: 'var(--card-2)',
          border: '0.5px solid var(--line)',
          padding: '16px 18px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <div>
              <div className="eyebrow rubric" style={{ marginBottom: 4 }}>Your shortlist</div>
              <span className="serif-ital" style={{ fontSize: 14, color: 'var(--ink-soft)' }}>
                {shortlist.length} {shortlist.length === 1 ? 'item' : 'items'} to book · kept in the Antechamber
              </span>
            </div>
            <button onClick={clearShortlist} style={{
              fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: 'var(--ink-faint)', padding: 4,
            }}>
              clear
            </button>
          </div>
          <div style={{ marginBottom: 12 }}>
            {shortlist.map((it, i) => (
              <div key={it.id} style={{
                padding: '8px 0',
                borderTop: i === 0 ? 'none' : '0.5px solid var(--line-soft)',
                display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="serif-display" style={{ fontSize: 14, lineHeight: 1.2, marginBottom: 2 }}>
                    {it.title}
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.05em', color: 'var(--ink-faint)' }}>
                    {[it.venue, it.date].filter(Boolean).join(' · ')}
                  </div>
                </div>
                {it.url && (
                  <a href={it.url} target="_blank" rel="noopener" style={{
                    fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--rubric)', textDecoration: 'none', whiteSpace: 'nowrap',
                  }}>↗</a>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={mailShortlist} style={{
              flex: 1, padding: '9px 12px', border: '0.5px solid var(--rubric)',
              background: 'var(--rubric)', color: 'var(--paper)',
              fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
              minWidth: 130,
            }}>
              ✉ Email shortlist
            </button>
            <button onClick={calendarShortlist} style={{
              padding: '9px 12px', border: '0.5px solid var(--line)', background: 'transparent',
              fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
              color: 'var(--ink-soft)',
            }}>
              ⌘ Calendar (.ics)
            </button>
          </div>
        </div>
      )}

      {!discover && !loading && (
        <div style={{
          textAlign: 'center', padding: '30px 20px', marginTop: 14,
          fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 13.5, color: 'var(--ink-faint)',
        }}>
          Set your cities and tap Run to find what's coming up for you.
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Import / Export utilities
   ═══════════════════════════════════════════════════════════ */
function ExportImport({ entries, onImport }) {
  const exportData = () => {
    const b = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = 'enthousiasmes-backup.json';
    a.click();
  };
  const importData = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
      try {
        const d = JSON.parse(ev.target.result);
        if (Array.isArray(d)) onImport(d);
        else alert('Invalid file: expected an array of entries.');
      } catch {
        alert('Invalid JSON file');
      }
    };
    r.readAsText(f);
  };

  /* Parse a Goodreads-format CSV. Handles quoted fields and embedded commas. */
  const parseCSV = (text) => {
    const rows = [];
    let row = [], field = '', inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (c === '"') { inQuotes = false; }
        else { field += c; }
      } else {
        if (c === '"') { inQuotes = true; }
        else if (c === ',') { row.push(field); field = ''; }
        else if (c === '\n' || c === '\r') {
          if (c === '\r' && text[i + 1] === '\n') i++;
          row.push(field); rows.push(row);
          row = []; field = '';
        } else { field += c; }
      }
    }
    if (field || row.length) { row.push(field); rows.push(row); }
    return rows.filter(r => r.some(f => f.trim()));
  };

  const importGoodreads = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
      try {
        const rows = parseCSV(ev.target.result);
        if (rows.length < 2) { alert('CSV looks empty.'); return; }
        const headers = rows[0].map(h => h.trim());
        const idx = (name) => headers.findIndex(h => h.toLowerCase() === name.toLowerCase());
        const iTitle = idx('Title');
        const iAuthor = idx('Author');
        const iRating = idx('My Rating');
        const iPages = idx('Number of Pages');
        const iDateRead = idx('Date Read');
        const iDateAdded = idx('Date Added');
        const iReview = idx('My Review');
        const iShelf = idx('Exclusive Shelf');
        const iYear = idx('Original Publication Year');
        if (iTitle < 0 || iAuthor < 0) {
          alert('This does not look like a Goodreads export — missing Title or Author column.');
          return;
        }
        // Only import books that have actually been read (not "to-read" or "currently-reading")
        // unless the row has a rating or review.
        const newEntries = [];
        let skipped = 0;
        for (let r = 1; r < rows.length; r++) {
          const cols = rows[r];
          const title = (cols[iTitle] || '').trim();
          if (!title) continue;
          const shelf = iShelf >= 0 ? (cols[iShelf] || '').trim().toLowerCase() : '';
          const rating = iRating >= 0 ? parseInt(cols[iRating]) || 0 : 0;
          const review = iReview >= 0 ? (cols[iReview] || '').trim() : '';
          // Skip "to-read" with no rating or review — those aren't enthusiasms yet
          if (shelf === 'to-read' && !rating && !review) { skipped++; continue; }
          const author = (cols[iAuthor] || '').trim();
          const pages = iPages >= 0 ? parseInt(cols[iPages]) || '' : '';
          const dateRead = iDateRead >= 0 ? cols[iDateRead] : '';
          const dateAdded = iDateAdded >= 0 ? cols[iDateAdded] : '';
          const year = iYear >= 0 ? cols[iYear] : '';
          // Goodreads dates: "YYYY/MM/DD" → "YYYY-MM-DD"
          const isoDate = (d) => {
            const m = (d || '').match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
            return m ? m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0') : '';
          };
          const date = isoDate(dateRead) || isoDate(dateAdded) || '';
          // Build the note: rating + review
          const stars = rating ? '★'.repeat(rating) + '☆'.repeat(5 - rating) : '';
          const noteParts = [];
          if (stars) noteParts.push(stars);
          if (review) noteParts.push(review);
          const note = noteParts.join('\n\n');
          newEntries.push({
            id: 'gr-' + Date.now().toString(36) + '-' + r,
            title,
            category: 'book',
            date,
            note,
            image: '',
            metadata: {
              author,
              ...(pages ? { pages } : {}),
              ...(year ? { year } : {}),
              ...(rating ? { rating } : {}),
            },
          });
        }
        if (!newEntries.length) {
          alert('No readable books found in the CSV.');
          return;
        }
        const msg = 'Found ' + newEntries.length + ' book' + (newEntries.length === 1 ? '' : 's')
          + (skipped ? ' (skipped ' + skipped + ' to-read)' : '')
          + '.\n\nAdd them to your archive? This will merge with your existing entries.';
        if (!confirm(msg)) return;
        // Merge: keep existing entries, add new books, skip exact-title duplicates
        const existingTitles = new Set(entries.filter(e => e.category === 'book').map(e => e.title.toLowerCase()));
        const toAdd = newEntries.filter(e => !existingTitles.has(e.title.toLowerCase()));
        const merged = [...entries, ...toAdd]
          .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
          .map((e, i) => ({ ...e, n: i + 1 }));
        onImport(merged);
        const dupCount = newEntries.length - toAdd.length;
        alert('Added ' + toAdd.length + ' new book' + (toAdd.length === 1 ? '' : 's')
          + (dupCount ? ' (' + dupCount + ' already in your archive).' : '.'));
      } catch (err) {
        alert('Could not read CSV: ' + err.message);
      }
    };
    r.readAsText(f);
  };

  return (
    <div style={{
      display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap',
      marginTop: 20, padding: '14px 0',
      borderTop: '0.5px solid var(--line)',
    }}>
      <button onClick={exportData} style={{
        padding: '6px 12px', border: '0.5px solid var(--line)', background: 'transparent',
        fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase',
        color: 'var(--ink-soft)', cursor: 'pointer',
      }}>
        ↓ Export JSON
      </button>
      <label style={{
        padding: '6px 12px', border: '0.5px solid var(--line)', background: 'transparent',
        fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase',
        color: 'var(--ink-soft)', cursor: 'pointer',
      }}>
        ↑ Import JSON
        <input type="file" accept=".json" onChange={importData} style={{ display: 'none' }}/>
      </label>
      <label style={{
        padding: '6px 12px', border: '0.5px solid var(--rubric)', background: 'transparent',
        fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase',
        color: 'var(--rubric)', cursor: 'pointer',
      }}>
        ⌥ Goodreads CSV
        <input type="file" accept=".csv" onChange={importGoodreads} style={{ display: 'none' }}/>
      </label>
    </div>
  );
}

Object.assign(window, { InsightsView, DiscoverView, ExportImport, tpCompact });
