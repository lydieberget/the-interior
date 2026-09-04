/* ─────────────────────────────────────────────────────────────
   THE ANTECHAMBER — the room before the Interior.
   Works waiting to be let in: events to attend, books to read,
   exhibitions before they close. A want is a proto-entry;
   "Lived it" opens the EditModal prefilled and, on save, the
   want leaves the antechamber and enters the archive.

   Store: localStorage `enth-antechamber-v1`. On first load it
   absorbs the old Discover shortlist (`enth-shortlist-v2`);
   Discover's "Save to shortlist" now writes wants here with
   source:'discover', so its drawer and this view share one list.
   ─────────────────────────────────────────────────────────── */
const useW = React.useState;

const ACK = 'enth-antechamber-v1';
const LEGACY_SLK = 'enth-shortlist-v2';
// Companion data per want: { [wantId]: { sheet, sheetAt, chat: [{q,a,ts}], position } }
const CMK = 'enth-companion-v1';

function loadWants() {
  try {
    const raw = localStorage.getItem(ACK);
    if (raw) return JSON.parse(raw);
  } catch {}
  // One-time migration: absorb the old Discover shortlist.
  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_SLK) || '[]');
    if (legacy.length) {
      const wants = legacy.map(it => ({ source: 'discover', ...it, addedAt: it.addedAt || Date.now() }));
      localStorage.setItem(ACK, JSON.stringify(wants));
      localStorage.removeItem(LEGACY_SLK);
      return wants;
    }
  } catch {}
  return [];
}
function saveWants(list) {
  localStorage.setItem(ACK, JSON.stringify(list));
}

function loadCompanions() {
  try { return JSON.parse(localStorage.getItem(CMK) || '{}'); } catch { return {}; }
}
function saveCompanions(map) {
  localStorage.setItem(CMK, JSON.stringify(map));
}

/* Discover items carry free-text dates ("14 June 2026"); manual wants an
   ISO date. Parseable → a real Date for sorting/urgency; otherwise the
   string is shown but the want stays in the unhurried section. */
function wantDate(w) {
  const d = w.dateISO || w.date;
  if (!d) return null;
  const dt = new Date(d);
  return isNaN(dt) ? null : dt;
}

/* Discover sections use prose categories ("Classical Music"); map them
   onto the archive's CATEGORIES ids for marks and for conversion. */
function wantCatId(w) {
  if (CATEGORIES.some(c => c.id === w.category)) return w.category;
  const s = (w.category || '').toLowerCase();
  if (/music|concert|opera|recital|jazz/.test(s)) return 'music';
  if (/theatre|theater|play|drama/.test(s)) return 'theatre';
  if (/ballet|dance/.test(s)) return 'ballet';
  if (/exhibition|galler|museum|art/.test(s)) return 'exhibition';
  if (/film|cinema/.test(s)) return 'film';
  if (/book|litera|poetry|reading/.test(s)) return 'book';
  return 'event';
}

function daysUntil(dt) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dt); d.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 864e5);
}

function WantRow({ w, onLived, onRemove, missed, onBegin, onSetDown, onCompanion }) {
  const cat = getCat(wantCatId(w));
  const dt = wantDate(w);
  const byline = [
    w.artist || (w.metadata && (w.metadata.author || w.metadata.artist)),
    w.venue || (w.metadata && w.metadata.venue),
  ].filter(Boolean).join(' · ');
  const days = dt ? daysUntil(dt) : null;
  const urgency = days === null ? null
    : days === 0 ? 'today'
    : days === 1 ? 'tomorrow'
    : (days > 1 && days <= 14) ? 'in ' + days + ' days'
    : null;
  const dateLabel = dt
    ? dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : (w.date || null);
  return (
    <div style={{
      display: 'flex', gap: 10, padding: '12px 0', alignItems: 'baseline',
      borderBottom: '0.5px solid var(--line-soft)',
      opacity: missed ? 0.45 : 1,
    }}>
      <span style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 14, color: 'var(--rubric)', width: 16, textAlign: 'center', flexShrink: 0 }}>
        {cat.mark}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 15.5, lineHeight: 1.35 }}>{w.title}</div>
        {byline && (
          <div className="folio" style={{ fontSize: 10, color: 'var(--ink-soft)', marginTop: 2 }}>{byline}</div>
        )}
        {(dateLabel || urgency) && (
          <div className="folio" style={{ fontSize: 10, marginTop: 2, color: 'var(--ink-faint)' }}>
            {dateLabel}
            {urgency && <span className="rubric" style={{ marginLeft: 8 }}>{missed ? '' : urgency}</span>}
          </div>
        )}
        {w.why && (
          <div className="serif-ital" style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 3 }}>{w.why}</div>
        )}
        {w.begunAt && (
          <div className="folio" style={{ fontSize: 9.5, color: 'var(--ink-faint)', marginTop: 3 }}>
            in hand since {new Date(w.begunAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </div>
        )}
        <div style={{ display: 'flex', gap: 16, marginTop: 7, flexWrap: 'wrap' }}>
          {w.begunAt ? (
            <>
              <button onClick={() => onCompanion(w)} className="folio" style={{ fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--rubric)' }}>
                ✶ Companion
              </button>
              <button onClick={() => onLived(w)} className="folio" style={{ fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>
                ☞ Lived it
              </button>
              <button onClick={() => sharePostcard('want', w, cat)} className="folio" style={{ fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>
                ❧ Invite
              </button>
              <button onClick={() => onSetDown(w)} className="folio" style={{ fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
                Set down
              </button>
            </>
          ) : (
            <>
              <button onClick={() => onLived(w)} className="folio" style={{ fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--rubric)' }}>
                ☞ Lived it
              </button>
              <button onClick={() => onBegin(w)} className="folio" style={{ fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>
                Begin
              </button>
              <button onClick={() => sharePostcard('want', w, cat)} className="folio" style={{ fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>
                ❧ Invite
              </button>
              <button onClick={() => onRemove(w)} className="folio" style={{ fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
                Remove
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AddWantForm({ onSave, onCancel }) {
  const [form, setForm] = useW({ title: '', category: 'book', date: '', why: '' });
  const save = () => {
    const t = form.title.trim();
    if (!t) return;
    onSave({
      id: 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      title: t, category: form.category,
      date: form.date || undefined,
      why: form.why.trim() || undefined,
      source: 'manual', addedAt: Date.now(),
    });
  };
  return (
    <div style={{ border: '0.5px solid var(--line)', background: 'var(--card)', padding: '16px 16px 14px', marginBottom: 18 }}>
      <div className="eyebrow rubric" style={{ marginBottom: 12 }}>A new desire</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 14 }}>
        {CATEGORIES.map(c => (
          <button key={c.id} onClick={() => setForm(f => ({ ...f, category: c.id }))} style={{
            padding: '4px 9px', border: `0.5px solid ${form.category === c.id ? 'var(--ink)' : 'var(--line)'}`,
            background: form.category === c.id ? 'var(--ink)' : 'transparent',
            color: form.category === c.id ? 'var(--paper)' : 'var(--ink-soft)',
            fontSize: 10.5, display: 'inline-flex', alignItems: 'center', gap: 4,
            borderRadius: 100,
          }}>
            <span style={{ fontFamily: 'var(--serif)', fontStyle: 'italic' }}>{c.mark}</span>
            {c.label}
          </button>
        ))}
      </div>
      <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
        placeholder="What calls to you?"
        style={{ width: '100%', padding: '8px 0', marginBottom: 12, border: 'none', borderBottom: '0.5px solid var(--line)', background: 'transparent', fontFamily: 'var(--serif)', fontSize: 17, outline: 'none', color: 'var(--ink)' }}/>
      <label className="eyebrow" style={{ display: 'block', marginBottom: 4 }}>Date, if it has one</label>
      <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
        style={{ padding: '6px 0', marginBottom: 12, border: 'none', borderBottom: '0.5px solid var(--line)', background: 'transparent', fontFamily: 'var(--mono)', fontSize: 12, outline: 'none', color: 'var(--ink)' }}/>
      <input value={form.why} onChange={e => setForm(f => ({ ...f, why: e.target.value }))}
        placeholder="Why it calls to you — one line is plenty…"
        style={{ width: '100%', padding: '8px 0', marginBottom: 16, border: 'none', borderBottom: '0.5px solid var(--line)', background: 'transparent', fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 13.5, outline: 'none', color: 'var(--ink)' }}/>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button onClick={onCancel} style={{ padding: '8px 14px', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>
          Cancel
        </button>
        <button onClick={save} style={{ padding: '8px 16px', background: 'var(--rubric)', color: 'var(--paper)', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
          Let it wait
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   The Companion — context while a work is in hand. A one-shot
   spoiler-free sheet (web-search grounded) plus a conversation
   that knows where the reader is and never goes past it.
   ─────────────────────────────────────────────────────────── */
function workLabel(w) {
  const cat = getCat(wantCatId(w));
  const author = w.artist || (w.metadata && (w.metadata.author || w.metadata.artist));
  return '"' + w.title + '"' + (author ? ' by ' + author : '') + ' (' + cat.label.toLowerCase() + ')';
}

/* Split a sheet into its capital-headed sections — one leaf each. */
function sheetSections(text) {
  const isHead = (t) => /^[A-Z][A-Z &'’-]{2,42}$/.test(t);
  const secs = [];
  let cur = null;
  text.split(/\n+/).forEach(ln => {
    const t = ln.trim();
    if (!t) return;
    if (isHead(t)) { cur = { head: t, body: [] }; secs.push(cur); }
    else if (cur) cur.body.push(t);
    else { cur = { head: null, body: [t] }; secs.push(cur); }
  });
  return secs.length ? secs : [{ head: null, body: [text] }];
}

function CompanionView({ want, entries, onBack, onLived }) {
  const [comp, setComp] = useW(() => loadCompanions()[want.id] || { sheet: null, sheetAt: null, chat: [], position: '' });
  const [busy, setBusy] = useW(null); // 'sheet' | 'ask'
  const [q, setQ] = useW('');
  const [err, setErr] = useW(null);
  const [leaf, setLeaf] = useW(0);
  const touchX = React.useRef(null);

  const persist = (next) => {
    setComp(next);
    const all = loadCompanions();
    all[want.id] = next;
    saveCompanions(all);
  };

  const tasteContext = () => {
    try { return window.tpCompact ? window.tpCompact(entries) : ''; } catch { return ''; }
  };

  const drawSheet = async () => {
    setBusy('sheet'); setErr(null);
    try {
      const sys =
        'You are a learned, warm cultural companion. Write a spoiler-free companion sheet for someone who has just begun ' + workLabel(want) + '.\n\n' +
        'Use web search (up to 3 searches) to verify facts about the maker and the context. If something cannot be verified, leave it out rather than invent it.\n\n' +
        'Format: plain text, NO markdown. Four sections, each opened by a heading line in capitals on its own line:\n' +
        'THE AUTHOR — who made it and where this work sits in their life (adapt the heading word: THE COMPOSER, THE ARTIST, THE DIRECTOR… as fits the medium).\n' +
        'THE MOMENT — the historical and cultural circumstances around the work.\n' +
        'WHAT TO NOTICE — themes, form, craft to watch for. Strictly nothing of the plot beyond its opening.\n' +
        'IN YOUR INTERIOR — how this work sits among the works in the reader’s own archive, provided below. Name only works actually present in it.\n\n' +
        '450–650 words. Warm and precise, no gush. Begin directly with the first heading line — no preamble, no closing remark.\n\n' +
        'Write in English, unless the work itself is French-language — then write in French. Keep titles in their own language.';
      const taste = tasteContext();
      const text = await window.claude.complete({
        model: 'claude-sonnet-4-6',
        max_tokens: 2500,
        system: sys,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
        messages: [{ role: 'user', content: 'The work: ' + workLabel(want)
          + (want.why ? '\nWhy I wanted it: ' + want.why : '')
          + (taste ? '\n\nMy archive:\n' + taste : '') }],
      });
      persist({ ...comp, sheet: text, sheetAt: Date.now() });
      setLeaf(0);
    } catch (e) {
      setErr(e.message);
    }
    setBusy(null);
  };

  const ask = async () => {
    const t = q.trim();
    if (!t || busy) return;
    setQ(''); setBusy('ask'); setErr(null);
    try {
      const h = comp.chat.map(p => 'Q: ' + p.q + '\n\nA: ' + p.a).join('\n\n');
      const prompt =
        'You are a reading companion for ' + workLabel(want) + '.\n' +
        'The reader is currently at: ' + (comp.position || 'not stated — assume they have only just begun') + '.\n' +
        'STRICT SPOILER RULE: never reveal, foreshadow, or allude to anything in the work beyond that point. If an honest answer would require it, say you would be getting ahead of them, and stop there.\n' +
        'Warm, specific, concise — 120–250 words. Plain prose. Answer in English unless the reader asks in another language, or the work itself is French-language.\n\n' +
        (comp.sheet ? 'Companion sheet you wrote earlier:\n' + comp.sheet + '\n\n' : '') +
        (h ? 'Earlier exchanges:\n' + h + '\n\n' : '') +
        'The reader asks: ' + t;
      const text = await window.claude.complete({
        model: 'claude-sonnet-4-6',
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }],
      });
      persist({ ...comp, chat: [...comp.chat, { q: t, a: text, ts: Date.now() }] });
    } catch (e) {
      setErr(e.message);
      setQ(t);
    }
    setBusy(null);
  };

  const cat = getCat(wantCatId(want));
  const byline = [
    want.artist || (want.metadata && (want.metadata.author || want.metadata.artist)),
    want.venue || (want.metadata && want.metadata.venue),
  ].filter(Boolean).join(' · ');

  const renderLeaves = (text) => {
    const secs = sheetSections(text);
    const idx = Math.min(leaf, secs.length - 1);
    const sec = secs[idx];
    const go = (n) => setLeaf(Math.max(0, Math.min(secs.length - 1, n)));
    return (
      <div style={{ marginTop: 18 }}>
        <article key={idx}
          onTouchStart={e => { touchX.current = e.touches[0].clientX; }}
          onTouchEnd={e => {
            if (touchX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            touchX.current = null;
            if (dx < -40) go(idx + 1);
            else if (dx > 40) go(idx - 1);
          }}
          style={{
            background: 'var(--card)', border: '0.5px solid var(--line)',
            padding: '22px 20px 18px', minHeight: 180,
          }}>
          {sec.head && (
            <div className="eyebrow rubric" style={{ textAlign: 'center', marginBottom: 14 }}>{sec.head}</div>
          )}
          {sec.body.map((p, i) => (
            <p key={i} style={{ fontFamily: 'var(--serif)', fontSize: 14.5, lineHeight: 1.7, margin: '0 0 10px', textWrap: 'pretty' }}>
              {p}
            </p>
          ))}
        </article>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 2px 0' }}>
          <button onClick={() => go(idx - 1)} disabled={idx === 0} aria-label="Previous leaf"
            style={{ fontFamily: 'var(--serif)', fontSize: 18, color: idx === 0 ? 'var(--line)' : 'var(--ink-soft)', padding: '0 8px' }}>
            ‹
          </button>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {secs.map((_, i) => (
              <button key={i} onClick={() => go(i)} aria-label={'Leaf ' + (i + 1)} style={{
                fontFamily: 'var(--serif)', fontSize: i === idx ? 13 : 15, lineHeight: 1, padding: 2,
                color: i === idx ? 'var(--rubric)' : 'var(--ink-faint)',
              }}>
                {i === idx ? '●' : '·'}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="folio" style={{ fontSize: 9, color: 'var(--ink-faint)' }}>{(idx + 1) + ' / ' + secs.length}</span>
            <button onClick={() => go(idx + 1)} disabled={idx === secs.length - 1} aria-label="Next leaf"
              style={{ fontFamily: 'var(--serif)', fontSize: 18, color: idx === secs.length - 1 ? 'var(--line)' : 'var(--ink-soft)', padding: '0 8px' }}>
              ›
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '14px 20px calc(120px + env(safe-area-inset-bottom))' }}>
      <button onClick={onBack} className="folio" style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: 14 }}>
        ← The Antechamber
      </button>
      <div className="eyebrow rubric" style={{ marginBottom: 8 }}>Companion</div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
        <span style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 16, color: 'var(--rubric)' }}>{cat.mark}</span>
        <div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 22, lineHeight: 1.25 }}>{want.title}</div>
          {byline && <div className="folio" style={{ fontSize: 10, color: 'var(--ink-soft)', marginTop: 3 }}>{byline}</div>}
          {want.begunAt && (
            <div className="folio" style={{ fontSize: 9.5, color: 'var(--ink-faint)', marginTop: 2 }}>
              in hand since {new Date(want.begunAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <label className="eyebrow" style={{ display: 'block', marginBottom: 4 }}>Where you are</label>
        <input value={comp.position}
          onChange={e => persist({ ...comp, position: e.target.value })}
          placeholder="page, chapter, act — the companion won’t go past it"
          style={{ width: '100%', padding: '8px 0', border: 'none', borderBottom: '0.5px solid var(--line)', background: 'transparent', fontFamily: 'var(--mono)', fontSize: 12, outline: 'none', color: 'var(--ink)' }}/>
      </div>

      {comp.sheet ? (
        <>
          {renderLeaves(comp.sheet)}
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <button onClick={drawSheet} disabled={!!busy} className="folio" style={{ fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
              {busy === 'sheet' ? '◌ Redrawing…' : '↻ Redraw the sheet'}
            </button>
          </div>
        </>
      ) : (
        <button onClick={drawSheet} disabled={!!busy} style={{
          width: '100%', padding: '14px 16px', marginTop: 18,
          border: '0.5px solid var(--line)', background: 'var(--card-2)',
          fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
          color: busy === 'sheet' ? 'var(--ink-faint)' : 'var(--rubric)',
        }}>
          {busy === 'sheet' ? '◌ Consulting…' : '✶ Draw the companion sheet'}
        </button>
      )}
      {busy === 'sheet' && (
        <div className="serif-ital" style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 8, textAlign: 'center' }}>
          Reading around the work — half a minute or so.
        </div>
      )}
      {err && (
        <div className="serif-ital" style={{ fontSize: 12.5, color: 'var(--rubric)', marginTop: 10 }}>{err}</div>
      )}

      <div style={{ marginTop: 24, paddingTop: 16, borderTop: '0.5px solid var(--line)' }}>
        <div className="eyebrow rubric" style={{ marginBottom: 12 }}>Ask while you read</div>
        {comp.chat.map((p, i) => (
          <div key={i} style={{ padding: '10px 0', borderBottom: '0.5px solid var(--line-soft)' }}>
            <div className="serif-ital" style={{ fontSize: 14, color: 'var(--rubric)', marginBottom: 6 }}>{p.q}</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 13.5, lineHeight: 1.65, whiteSpace: 'pre-wrap', textWrap: 'pretty' }}>{p.a}</div>
          </div>
        ))}
        {busy === 'ask' && (
          <div className="serif-ital" style={{ fontSize: 12, color: 'var(--ink-faint)', padding: '12px 0', textAlign: 'center' }}>◌ Thinking…</div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <input value={q} onChange={e => setQ(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') ask(); }}
            placeholder="What am I missing about…"
            style={{ flex: 1, padding: '10px 0', border: 'none', borderBottom: '0.5px solid var(--line)', background: 'transparent', fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 14, outline: 'none', color: 'var(--ink)' }}/>
          <button onClick={ask} disabled={!!busy} style={{
            padding: '8px 14px', background: 'var(--rubric)', color: 'var(--paper)',
            fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
          }}>
            Ask
          </button>
        </div>
      </div>

      <button onClick={() => onLived(want)} className="folio" style={{
        fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
        color: 'var(--rubric)', marginTop: 26,
      }}>
        ☞ Lived it — inscribe it in the archive
      </button>
    </div>
  );
}

/* ── Read a cover — photograph a book (or pick a photo) and let it in ──
   The picture is shrunk client-side, read once by the model (title,
   author, year), shown back for correction, then becomes a want. The
   photograph itself is never stored. */
function ReadCover({ onSave }) {
  const [state, setState] = useW({ phase: 'idle' }); // idle | reading | read
  const inputRef = React.useRef(null);

  const onFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setState({ phase: 'reading' });
    try {
      const { dataUrl } = await resizeImage(file, 1200, 0.8);
      const data = dataUrl.split(',')[1];
      const text = await window.claude.complete({
        model: 'claude-sonnet-4-6',
        max_tokens: 300,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } },
          { type: 'text', text: 'This is a photograph of a book — its cover, spine or title page. Read it and reply with ONLY a JSON object: {"title": "...", "author": "...", "year": "..."}. Keep the title in its own language, exactly as printed (drop series banners and blurbs). Author as printed, full name; leave "" when unsure. Year only if printed.' },
        ] }],
      });
      const m = String(text).match(/\{[\s\S]*\}/);
      const r = m ? JSON.parse(m[0]) : {};
      setState({ phase: 'read', title: r.title || '', author: r.author || '', year: r.year || '' });
    } catch (err) {
      setState({ phase: 'idle' });
      alert('Could not read the cover: ' + err.message);
    }
  };

  const letIn = async () => {
    const title = (state.title || '').trim();
    if (!title) return;
    const author = (state.author || '').trim();
    const want = {
      id: 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      title, category: 'book', artist: author || undefined,
      metadata: { author: author || undefined, year: (state.year || '').trim() || undefined },
      source: 'photo', addedAt: Date.now(),
    };
    setState({ phase: 'idle' });
    onSave(want);
    // the cover, if Open Library has it — attached quietly afterwards
    try {
      const url = await findCover({ title, metadata: { author } });
      if (url) { const all = loadWants(); const i = all.findIndex(w => w.id === want.id); if (i >= 0) { all[i].image = url; saveWants(all); } }
    } catch {}
  };

  const field = (key, placeholder, italic) => (
    <input value={state[key] || ''} onChange={e => setState(s => ({ ...s, [key]: e.target.value }))} placeholder={placeholder}
      style={{ width: '100%', padding: '7px 0', marginBottom: 10, border: 'none', borderBottom: '0.5px solid var(--line)', background: 'transparent',
        fontFamily: 'var(--serif)', fontStyle: italic ? 'italic' : 'normal', fontSize: italic ? 13.5 : 17, outline: 'none', color: 'var(--ink)' }}/>
  );

  return (
    <div style={{ marginBottom: 14 }}>
      <input ref={inputRef} type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }}/>
      {state.phase === 'idle' && (
        <button onClick={() => inputRef.current && inputRef.current.click()} className="folio"
          style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--rubric)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          ❧ Read a book's cover
        </button>
      )}
      {state.phase === 'reading' && (
        <div className="folio" style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>◌ Reading the cover…</div>
      )}
      {state.phase === 'read' && (
        <div style={{ border: '0.5px solid var(--line)', background: 'var(--card)', padding: '14px 16px 12px', marginTop: 8 }}>
          <div className="eyebrow rubric" style={{ marginBottom: 10 }}>I read</div>
          {field('title', 'Title')}
          {field('author', 'Author', true)}
          {field('year', 'Year, if printed', true)}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button onClick={() => setState({ phase: 'idle' })} style={{ padding: '8px 14px', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>Not this</button>
            <button onClick={letIn} style={{ padding: '8px 16px', background: 'var(--rubric)', color: 'var(--paper)', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase' }}>Let it in</button>
          </div>
        </div>
      )}
    </div>
  );
}

function AntechamberView({ wants, entries, onChange, onLived, adding, onAdding }) {
  const [companionFor, setCompanionFor] = useW(null);

  // The Seal stays visible inside a companion; pressing it means "add a
  // desire" — come back to the list so the form is actually seen.
  React.useEffect(() => { if (adding) setCompanionFor(null); }, [adding]);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dated = wants.filter(w => !w.begunAt).map(w => ({ w, dt: wantDate(w) }));
  const inHand = wants.filter(w => w.begunAt).map(w => ({ w, dt: null }))
    .sort((a, b) => (b.w.begunAt || 0) - (a.w.begunAt || 0));
  const awaited = dated.filter(x => x.dt && x.dt >= today).sort((a, b) => a.dt - b.dt);
  const missed = dated.filter(x => x.dt && x.dt < today).sort((a, b) => b.dt - a.dt);
  const unhurried = dated.filter(x => !x.dt).sort((a, b) => (b.w.addedAt || 0) - (a.w.addedAt || 0));

  const remove = (w) => onChange(wants.filter(x => x.id !== w.id));
  const addWant = (w) => { onChange([w, ...wants]); onAdding(false); };
  const begin = (w) => onChange(wants.map(x => x.id === w.id ? { ...x, begunAt: Date.now() } : x));
  const setDown = (w) => onChange(wants.map(x => x.id === w.id ? { ...x, begunAt: undefined } : x));

  // Companion data of removed/lived wants has no want to belong to — prune.
  React.useEffect(() => {
    const all = loadCompanions();
    const ids = new Set(wants.map(w => w.id));
    let changed = false;
    Object.keys(all).forEach(k => { if (!ids.has(k)) { delete all[k]; changed = true; } });
    if (changed) saveCompanions(all);
  }, [wants]);

  const companionWant = companionFor && wants.find(w => w.id === companionFor);
  if (companionWant) {
    return (
      <CompanionView want={companionWant} entries={entries || []}
        onBack={() => setCompanionFor(null)} onLived={onLived} />
    );
  }

  const Section = ({ title, items, missedFlag }) => items.length === 0 ? null : (
    <div style={{ marginTop: 22 }}>
      <div className="eyebrow" style={{ borderBottom: '0.5px solid var(--line)', paddingBottom: 6 }}>
        {title} — {items.length}
      </div>
      {items.map(x => (
        <WantRow key={x.w.id} w={x.w} onLived={onLived} onRemove={remove} missed={missedFlag}
          onBegin={begin} onSetDown={setDown} onCompanion={w => setCompanionFor(w.id)} />
      ))}
    </div>
  );

  return (
    <div style={{ padding: '14px 20px calc(120px + env(safe-area-inset-bottom))' }}>
      <div className="eyebrow rubric" style={{ marginBottom: 8 }}>The Antechamber</div>
      <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 22, lineHeight: 1.2, marginBottom: 6 }}>
        Waiting to be let in
      </div>
      <div className="serif-ital" style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 18 }}>
        {wants.length === 0
          ? 'Nothing waits at the door.'
          : wants.length + (wants.length === 1 ? ' work waits' : ' works wait') + ' at the door of the Interior.'}
      </div>

      <ReadCover onSave={w => onChange([w, ...wants])} />

      {adding && <AddWantForm onSave={addWant} onCancel={() => onAdding(false)} />}

      {wants.length === 0 && !adding && (
        <div style={{ border: '0.5px solid var(--line)', background: 'var(--card)', padding: '22px 18px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 15, color: 'var(--ink-soft)', marginBottom: 8 }}>
            Add a desire with the seal below —
          </div>
          <div className="folio" style={{ fontSize: 10, color: 'var(--ink-faint)' }}>
            finds saved in Discover arrive here too.
          </div>
        </div>
      )}

      <Section title="In hand" items={inHand} />
      <Section title="Awaited" items={awaited} />
      <Section title="Unhurried" items={unhurried} />
      <Section title="Missed" items={missed} missedFlag />
    </div>
  );
}

Object.assign(window, { loadWants, saveWants, wantCatId, AntechamberView });
