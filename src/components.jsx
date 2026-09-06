/* global React, CATEGORIES, META_FIELDS, ENTRIES, monthKey, monthLabel, fmtDate, fmtDateShort, getCat, isQuote, isPoem */
// (Hooks accessed via React.useState etc. to avoid name collisions across Babel scripts.)

/* ─────────────────────────────────────────────────────────────
   Common bits
   ─────────────────────────────────────────────────────────── */

function Folio({ n }) {
  return <span className="folio">№&nbsp;{String(n).padStart(3, '0')}</span>;
}

// Quiet per-category accent: each category's mark + label take a tonal hue.
// Hues reuse the existing palette tokens; dark-mode variants live in styles.css.
const CAT_ACCENT = {
  book: 'rubric', theatre: 'rubric', quote: 'rubric',
  music: 'indigo', film: 'indigo',
  visualart: 'gold', ballet: 'gold', event: 'gold', poem: 'gold',
  exhibition: 'moss', idea: 'moss', place: 'moss',
  // `other` (and any unmapped id) falls back to neutral ink.
};

function CategoryMark({ cat }) {
  const accent = CAT_ACCENT[cat.id] || 'neutral';
  return (
    <span className={'eyebrow cat-accent cat-accent--' + accent} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 14, lineHeight: 1 }}>{cat.mark}</span>
      {cat.label}
    </span>
  );
}

function RunningHead({ left, right }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '0 20px 10px', borderBottom: '0.5px solid var(--line)',
      marginBottom: 14,
    }}>
      <span className="eyebrow">{left}</span>
      <span className="folio">{right}</span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Entry card — standard (Ledger view)
   ─────────────────────────────────────────────────────────── */
/* Resolves an entry's image to a src: http(s) URLs pass straight through,
   Supabase storage paths get a cached signed URL. Renders nothing while
   unresolved and hides itself if the image cannot load. */
function EntryImage({ entry, style, alt }) {
  const [src, setSrc] = React.useState(() =>
    /^https?:/.test(entry.image || '') ? entry.image : null);
  const [dead, setDead] = React.useState(false);
  React.useEffect(() => {
    let stale = false;
    setDead(false);
    if (!entry.image) { setSrc(null); return; }
    if (/^https?:/.test(entry.image)) { setSrc(entry.image); return; }
    db.imageUrl(entry.image)
      .then(u => { if (!stale) setSrc(u); })
      .catch(() => { if (!stale) setDead(true); });
    return () => { stale = true; };
  }, [entry.image]);
  if (!entry.image || dead || !src) return null;
  return (
    <img src={src} alt={alt || entry.title} loading="lazy"
      onError={() => setDead(true)}
      style={{ display: 'block', ...style }} />
  );
}

function EntryCard({ entry, onOpen, dense = false }) {
  const cat = getCat(entry.category);
  const author = entry.metadata?.author || entry.metadata?.source;
  const venue = entry.metadata?.album || entry.metadata?.venue || entry.metadata?.location;
  return (
    <button
      onClick={() => onOpen(entry)}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: dense ? '10px 0' : '16px 0',
        borderBottom: '0.5px solid var(--line-soft)',
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <CategoryMark cat={cat} tone="rubric" />
        <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
          {entry.favourite && <span style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', color: 'var(--rubric)', fontSize: 13 }}>☞</span>}
          <Folio n={entry.n} />
        </span>
      </div>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 className="serif-display" style={{
            fontSize: 21, fontWeight: 500, letterSpacing: '-0.01em',
            lineHeight: 1.1, color: 'var(--ink)', marginBottom: 4,
            textWrap: 'balance',
          }}>
            {entry.title}
          </h3>
          {(author || venue) && (
            <div className="serif-ital" style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 6 }}>
              {author}{author && venue ? ' · ' : ''}{venue}
            </div>
          )}
          {!dense && entry.note && (
            <p style={{
              fontSize: 13.5, lineHeight: 1.55, color: 'var(--ink-soft)',
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              overflow: 'hidden', fontFamily: 'var(--serif)',
            }}>
              {entry.note}
            </p>
          )}
        </div>
        {!dense && entry.image && (
          <EntryImage entry={entry} style={{
            width: 38, height: 56, objectFit: 'cover',
            border: '0.5px solid var(--line)', flexShrink: 0,
          }} />
        )}
      </div>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
   Quote card — special, big italic
   ─────────────────────────────────────────────────────────── */
function QuoteCard({ entry, onOpen, variant = 'block' }) {
  const cat = getCat(entry.category);
  const author = entry.metadata?.author || entry.metadata?.source;
  const work = entry.metadata?.work;
  const big = entry.title.length < 50;

  if (variant === 'postcard') {
    return (
      <button
        onClick={() => onOpen(entry)}
        style={{
          display: 'block', width: '100%', textAlign: 'left',
          background: 'var(--card)',
          border: '0.5px solid var(--line)',
          borderRadius: 2,
          padding: '28px 22px 22px',
          position: 'relative',
          boxShadow: '0 1px 0 rgba(26,22,18,0.04)',
        }}
      >
        <div style={{
          position: 'absolute', top: 12, left: 14,
          fontFamily: 'var(--serif)', fontStyle: 'italic',
          fontSize: 52, lineHeight: 0.8, color: 'var(--rubric)', opacity: 0.35,
        }}>“</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
          <CategoryMark cat={cat} tone="rubric" />
          <Folio n={entry.n} />
        </div>
        <p className="serif-ital" style={{
          fontSize: big ? 22 : 17, lineHeight: 1.25,
          color: 'var(--ink)', marginBottom: 14,
          textWrap: 'pretty', whiteSpace: 'pre-line',
        }}>
          {entry.title}
        </p>
        {entry.note && (
          <p style={{
            fontFamily: 'var(--serif)', fontSize: 13, lineHeight: 1.55,
            color: 'var(--ink-soft)', marginBottom: 14,
            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {entry.note}
          </p>
        )}
        {(author || work) && (
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: 8,
            borderTop: '0.5px solid var(--line-soft)', paddingTop: 10,
          }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-faint)' }}>—</span>
            <div>
              {author && <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink)' }}>{author}</div>}
              {work && <div className="serif-ital" style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{work}</div>}
            </div>
          </div>
        )}
      </button>
    );
  }

  // inline pull-quote variant
  return (
    <button
      onClick={() => onOpen(entry)}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '18px 0 18px 18px',
        borderLeft: '2px solid var(--rubric)',
        marginBottom: 4,
      }}
    >
      <p className="serif-ital" style={{
        fontSize: big ? 19 : 16, lineHeight: 1.3, color: 'var(--ink)',
        marginBottom: 8, textWrap: 'pretty', whiteSpace: 'pre-line',
      }}>
        {entry.title}
      </p>
      {(author || work) && (
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.08em', color: 'var(--ink-soft)', textTransform: 'uppercase' }}>
          {author}{author && work ? ' · ' : ''}{work && <span style={{ textTransform: 'none', fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 11 }}>{work}</span>}
        </div>
      )}
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
   Verse card — poems, with line breaks preserved (ragged, left-aligned)
   ─────────────────────────────────────────────────────────── */
function VerseCard({ entry, onOpen, variant = 'block' }) {
  const cat = getCat(entry.category);
  const author = entry.metadata?.author || entry.metadata?.source;
  const work = entry.metadata?.work;
  const heading = entry.title && (
    <h3 className="serif-display" style={{
      fontSize: 18, fontWeight: 500, lineHeight: 1.15,
      letterSpacing: '-0.01em', marginBottom: 8,
    }}>
      {entry.title}
    </h3>
  );
  const verse = entry.verse && (
    <p style={{
      fontFamily: 'var(--serif)', fontSize: 16, lineHeight: 1.55,
      color: 'var(--ink)', whiteSpace: 'pre-wrap', marginBottom: 10,
    }}>
      {entry.verse}
    </p>
  );
  const byline = (author || work) && (
    <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.08em', color: 'var(--ink-soft)', textTransform: 'uppercase' }}>
      {author}{author && work ? ' · ' : ''}{work && <span style={{ textTransform: 'none', fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 11 }}>{work}</span>}
    </div>
  );

  if (variant === 'postcard') {
    return (
      <button onClick={() => onOpen(entry)} style={{
        display: 'block', width: '100%', textAlign: 'left',
        background: 'var(--card)', border: '0.5px solid var(--line)', borderRadius: 2,
        padding: '24px 22px 20px', position: 'relative',
        boxShadow: '0 1px 0 rgba(26,22,18,0.04)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <CategoryMark cat={cat} />
          <Folio n={entry.n} />
        </div>
        {heading}
        {verse}
        {byline}
      </button>
    );
  }

  // inline (Ledger) — gold rule echoes the poem accent, distinct from the rubric pull-quote
  return (
    <button onClick={() => onOpen(entry)} style={{
      display: 'block', width: '100%', textAlign: 'left',
      padding: '16px 0 16px 18px', borderLeft: '2px solid var(--gold)',
      marginBottom: 4,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <CategoryMark cat={cat} />
        <Folio n={entry.n} />
      </div>
      {heading}
      {verse}
      {byline}
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
   Month divider — rubricated running head
   ─────────────────────────────────────────────────────────── */
function MonthDivider({ label, count }) {
  return (
    <div style={{ margin: '26px 0 10px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
      <div>
        <div className="serif-display rubric" style={{ fontSize: 28, fontWeight: 400, letterSpacing: '-0.015em' }}>
          <span className="serif-ital">{label.split(' ')[0]}</span>{' '}
          <span style={{ fontFamily: 'var(--mono)', fontSize: 15, color: 'var(--ink-soft)' }}>
            {label.split(' ')[1]}
          </span>
        </div>
      </div>
      <span className="eyebrow">{count} {count === 1 ? 'entry' : 'entries'}</span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Chip row for category filter
   ─────────────────────────────────────────────────────────── */
function ChipRow({ filter, onFilter, counts }) {
  const cats = CATEGORIES.filter(c => counts[c.id]);
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', paddingBottom: 4, marginBottom: 2 }}>
      <Chip active={!filter} onClick={() => onFilter(null)} label="All" count={Object.values(counts).reduce((a,b)=>a+b,0)} />
      {cats.map(c => (
        <Chip key={c.id} active={filter === c.id} onClick={() => onFilter(c.id)} label={c.label} count={counts[c.id]} mark={c.mark} />
      ))}
    </div>
  );
}
function Chip({ active, onClick, label, count, mark }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '5px 10px', borderRadius: 100,
      border: `0.5px solid ${active ? 'var(--ink)' : 'var(--line)'}`,
      background: active ? 'var(--ink)' : 'transparent',
      color: active ? 'var(--paper)' : 'var(--ink-soft)',
      fontSize: 11, whiteSpace: 'nowrap', flexShrink: 0,
      fontFamily: 'var(--sans)',
      transition: 'all .15s',
    }}>
      {mark && <span style={{ fontFamily: 'var(--serif)', fontStyle: 'italic' }}>{mark}</span>}
      {label}
      <span style={{ opacity: 0.6, fontFamily: 'var(--mono)', fontSize: 10 }}>{count}</span>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
   Header / masthead
   ─────────────────────────────────────────────────────────── */
function Masthead({ date, count, onOpenTitle }) {
  return (
    <header style={{ padding: '8px 20px 18px', textAlign: 'center', position: 'relative' }}>
      <h1 className="serif-display" onClick={onOpenTitle} style={{ fontSize: 42, fontWeight: 400, cursor: onOpenTitle ? 'pointer' : 'default' }}>
        <span className="serif-ital">The <span className="rubric">I</span>nterior</span>
      </h1>
      <div className="serif-ital" style={{ color: 'var(--ink-soft)', fontSize: 13, marginTop: 6 }}>
        Things that moved me, awed me, changed me
      </div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginTop: 16, padding: '6px 0',
        borderTop: '0.5px solid var(--line)', borderBottom: '0.5px solid var(--line)',
      }}>
        <span className="folio">{date}</span>
        <span className="folio">· · ·</span>
        <span className="folio">{count} entries</span>
      </div>
    </header>
  );
}

/* ─────────────────────────────────────────────────────────────
   Bottom tab bar
   ─────────────────────────────────────────────────────────── */
function TabBar({ tab, onTab, dark }) {
  const tabs = [
    { id: 'archive',     label: 'Archive',     mark: '§' },
    { id: 'insights',    label: 'Insights',    mark: '✶' },
    { id: 'discover',    label: 'Discover',    mark: '◉' },
    { id: 'antechamber', label: 'Antechamber', mark: '❧' },
  ];
  const bg = dark ? 'var(--d-paper)' : 'var(--paper)';
  const line = dark ? 'var(--d-line)' : 'var(--line)';
  return (
    <nav className="tab-bar" style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 60,
      background: bg,
      borderTop: `1px solid ${line}`,
      boxShadow: dark
        ? '0 -1px 0 rgba(0,0,0,0.3), 0 -10px 20px -8px rgba(0,0,0,0.4)'
        : '0 -1px 0 var(--line-soft), 0 -10px 20px -10px rgba(26,22,18,0.10)',
      display: 'flex', justifyContent: 'space-around',
      padding: '10px 8px calc(14px + env(safe-area-inset-bottom))',
    }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onTab(t.id)} style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          padding: '4px 4px', flex: 1, minWidth: 0,
          color: tab === t.id ? 'var(--rubric)' : 'var(--ink-faint)',
          transition: 'color .15s',
        }}>
          <span style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 20, lineHeight: 1 }}>
            {t.mark}
          </span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            {t.label}
          </span>
        </button>
      ))}
    </nav>
  );
}

/* ─────────────────────────────────────────────────────────────
   FAB — add new (as a pressed wax seal)
   ─────────────────────────────────────────────────────────── */
function Seal({ onClick }) {
  return (
    <button onClick={onClick} className="no-print" style={{
      position: 'fixed', bottom: 'calc(96px + env(safe-area-inset-bottom))', right: 20,
      width: 56, height: 56, borderRadius: '50%',
      background: 'radial-gradient(circle at 35% 30%, #c94a38, var(--rubric) 60%, #8f2415)',
      color: '#fbf5e8',
      boxShadow: '0 4px 12px rgba(184, 58, 40, 0.4), inset 0 2px 4px rgba(255,255,255,0.2), inset 0 -2px 4px rgba(0,0,0,0.3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 24, fontFamily: 'var(--serif)', fontStyle: 'italic',
      zIndex: 10,
    }}>
      +
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
   Re-encounter — one old entry quietly resurfaced each day
   (deliberate return, not algorithmic noise). Prefers an "on this day"
   anniversary; otherwise a deterministic daily pick of an older entry.
   ─────────────────────────────────────────────────────────── */
function ReEncounter({ entries, onOpen }) {
  const pick = React.useMemo(() => {
    const dated = entries.filter(e => e.date);
    if (!dated.length) return null;
    const now = new Date();
    const todayMMDD = now.toISOString().slice(5, 10);
    const year = String(now.getFullYear());
    const anniv = dated.filter(e => e.date.slice(5, 10) === todayMMDD && e.date.slice(0, 4) !== year);
    if (anniv.length) return { entry: anniv[0], label: 'On this day' };
    const seed = Math.floor(Date.now() / 86400000);
    const oldest = [...dated].sort((a, b) => a.date.localeCompare(b.date));
    return { entry: oldest[seed % oldest.length], label: 'Return to' };
  }, [entries]);
  if (!pick) return null;
  const e = pick.entry;
  const by = e.metadata?.author || e.metadata?.source || '';
  return (
    <button onClick={() => onOpen(e)} style={{
      display: 'block', width: '100%', textAlign: 'left',
      background: 'var(--card-2)', border: '0.5px solid var(--line)',
      borderLeft: '2px solid var(--gold)', borderRadius: 2,
      padding: '14px 16px', marginBottom: 16,
    }}>
      <div className="eyebrow" style={{ color: 'var(--gold)', marginBottom: 6 }}>❧ {pick.label}</div>
      <div className="serif-display" style={{ fontSize: 18, lineHeight: 1.15, fontWeight: 500, color: 'var(--ink)', marginBottom: 3 }}>{e.title}</div>
      <div className="serif-ital" style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>
        {by}{by && e.date ? ' · ' : ''}{e.date ? fmtDate(e.date) : ''}
      </div>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
   Archive view switcher — Ledger / Postcards / Spread / Map
   ─────────────────────────────────────────────────────────── */
function ViewSwitcher({ view, onView }) {
  const views = [
    { id: 'ledger',    label: 'Ledger' },
    { id: 'map',       label: 'Map' },
  ];
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 4, padding: '0 0 12px' }}>
      {views.map((v, i) => (
        <React.Fragment key={v.id}>
          {i > 0 && <span className="folio" style={{ alignSelf: 'center', opacity: 0.6 }}>·</span>}
          <button onClick={() => onView(v.id)} className="eyebrow" style={{
            padding: '2px 6px',
            color: view === v.id ? 'var(--rubric)' : 'var(--ink-faint)',
          }}>
            {v.label}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Title page — a returnable "edition" identity (tap the masthead)
   ─────────────────────────────────────────────────────────── */
function TitlePage({ count, onClose }) {
  const now = new Date();
  const seasons = ['Winter','Winter','Spring','Spring','Spring','Summer','Summer','Summer','Autumn','Autumn','Autumn','Winter'];
  const edition = 'No. ' + count + ' · ' + seasons[now.getMonth()] + ' ' + now.getFullYear() + ' · London';
  return (
    <div onClick={onClose} style={{
      minHeight: '78vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', textAlign: 'center',
      padding: '40px 28px', cursor: 'pointer',
    }}>
      <div className="eyebrow" style={{ color: 'var(--ink-faint)', marginBottom: 38 }}>A Commonplace Book</div>
      <h1 className="serif-display" style={{ fontSize: 50, fontWeight: 400, lineHeight: 1, marginBottom: 18 }}>
        <span className="serif-ital">The <span className="rubric">I</span>nterior</span>
      </h1>
      <p className="serif-ital" style={{ fontSize: 15, color: 'var(--ink-soft)', maxWidth: '18rem', lineHeight: 1.45, marginBottom: 40 }}>
        Things that have moved me — kept, and returned to.
      </p>
      <div style={{ width: 24, borderTop: '0.5px solid var(--line)', marginBottom: 26 }} />
      <p className="serif-ital" style={{ fontSize: 16, color: 'var(--ink)', maxWidth: '22rem', lineHeight: 1.5, marginBottom: 12 }}>
        “We should not be ashamed to acknowledge truth from whatever source it comes.”
      </p>
      <div className="eyebrow" style={{ color: 'var(--ink-faint)', marginBottom: 54 }}>Al-Kindī</div>
      <div className="folio" style={{ marginBottom: 6 }}>❧ {edition}</div>
      <div className="eyebrow" style={{ color: 'var(--ink-faint)', fontSize: 8 }}>Tap to enter</div>
    </div>
  );
}

Object.assign(window, {
  Folio, CategoryMark, RunningHead, EntryImage,
  EntryCard, QuoteCard, VerseCard, MonthDivider,
  ChipRow, Chip, Masthead, TabBar, Seal, TitlePage, ReEncounter, ViewSwitcher,
});
