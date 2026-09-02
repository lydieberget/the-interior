/* global React, ENTRIES, CATEGORIES, CLUSTERS, META_FIELDS, monthKey, monthLabel, fmtDate, fmtDateShort, getCat, isQuote, isPoem, EntryCard, QuoteCard, VerseCard, MonthDivider, ChipRow, Masthead, TabBar, Seal, Folio, CategoryMark, RunningHead, EntryImage, loadClusterCache, deriveClusters, clusterHome, setClusterOverride, describable, autoDescribe, descriptionFor, generateDescription, loadDescriptions, backfillDescriptions, findCover, backfillCovers, resizeImage, db */
const useS = React.useState;
const useM = React.useMemo;
const Fragment = React.Fragment;

/* ─────────────────────────────────────────────────────────────
   View 1 — LEDGER (default archive)
   Vertical list grouped by month; quotes inline as pull-quotes
   ─────────────────────────────────────────────────────────── */
function LedgerView({ entries, onOpen, quoteStyle }) {
  const groups = useM(() => {
    const dated = entries.filter(e => e.date);
    const undated = entries.filter(e => !e.date);
    const byMonth = {};
    dated.forEach(e => {
      const k = monthKey(e.date);
      (byMonth[k] = byMonth[k] || []).push(e);
    });
    const keys = Object.keys(byMonth).sort().reverse();
    const ordered = keys.map(k => ({ key: k, label: monthLabel(k), entries: byMonth[k].sort((a,b) => b.date.localeCompare(a.date)) }));
    if (undated.length) ordered.push({ key: 'undated', label: 'Marginalia', entries: undated });
    return ordered;
  }, [entries]);

  return (
    <div style={{ padding: '0 20px 100px' }}>
      {groups.map(g => (
        <section key={g.key}>
          <MonthDivider label={g.label} count={g.entries.length} />
          {g.entries.map(e => (
            isPoem(e)
              ? <VerseCard key={e.id} entry={e} onOpen={onOpen} />
              : isQuote(e)
              ? <QuoteCard key={e.id} entry={e} onOpen={onOpen} variant={quoteStyle === 'postcard' ? 'postcard' : 'block'} />
              : <EntryCard key={e.id} entry={e} onOpen={onOpen} />
          ))}
        </section>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   View 2 — POSTCARDS (vertical stack of quote-postcards, mixed media)
   Full-bleed cards that feel like a pile of postcards
   ─────────────────────────────────────────────────────────── */
function PostcardsView({ entries, onOpen }) {
  return (
    <div style={{ padding: '0 20px 100px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {entries.map((e, i) => {
        const rot = (i % 3 === 0) ? '-0.4deg' : (i % 3 === 1 ? '0.3deg' : '0deg');
        return (
          <div key={e.id} style={{ transform: `rotate(${rot})`, transformOrigin: 'center' }}>
            {isPoem(e)
              ? <VerseCard entry={e} onOpen={onOpen} variant="postcard" />
              : isQuote(e)
              ? <QuoteCard entry={e} onOpen={onOpen} variant="postcard" />
              : <MediaPostcard entry={e} onOpen={onOpen} />
            }
          </div>
        );
      })}
    </div>
  );
}

function MediaPostcard({ entry, onOpen }) {
  const cat = getCat(entry.category);
  const author = entry.metadata?.author;
  const venue = entry.metadata?.album || entry.metadata?.venue;
  return (
    <button onClick={() => onOpen(entry)} style={{
      display: 'block', width: '100%', textAlign: 'left',
      background: 'var(--card)',
      border: '0.5px solid var(--line)',
      padding: '22px 22px 20px',
      boxShadow: '0 1px 0 rgba(26,22,18,0.05), 2px 3px 12px rgba(26,22,18,0.06)',
      position: 'relative',
    }}>
      {/* stamp-like folio */}
      <div style={{
        position: 'absolute', top: 14, right: 14,
        border: '0.5px solid var(--line)', padding: '4px 8px',
        transform: 'rotate(3deg)',
      }}>
        <div className="folio" style={{ fontSize: 8, color: 'var(--ink-soft)' }}>{fmtDateShort(entry.date)}</div>
        <div className="folio rubric" style={{ fontSize: 7 }}>№{String(entry.n).padStart(3, '0')}</div>
      </div>
      <CategoryMark cat={cat} tone="rubric" />
      {entry.image && (
        <EntryImage entry={entry} style={{
          width: '100%', maxHeight: 240, objectFit: 'cover',
          border: '0.5px solid var(--line)', margin: '12px 0 2px',
        }} />
      )}
      <h3 className="serif-display" style={{
        fontSize: 24, lineHeight: 1.05, fontWeight: 500,
        marginTop: 10, marginBottom: 6, maxWidth: '78%',
        textWrap: 'balance',
      }}>{entry.title}</h3>
      {(author || venue) && (
        <div className="serif-ital" style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 10 }}>
          {author}{author && venue ? ', ' : ''}{venue}
        </div>
      )}
      {entry.note && (
        <p style={{ fontFamily: 'var(--serif)', fontSize: 13.5, lineHeight: 1.55, color: 'var(--ink-soft)' }}>
          {entry.note.length > 140 ? entry.note.slice(0, 140) + '…' : entry.note}
        </p>
      )}
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
   View 3 — SPREAD (notebook-style two-column on phone)
   Folio numbers, running heads, ruled
   ─────────────────────────────────────────────────────────── */
function SpreadView({ entries, onOpen }) {
  const groups = useM(() => {
    const dated = entries.filter(e => e.date).sort((a,b) => b.date.localeCompare(a.date));
    const byMonth = {};
    dated.forEach(e => {
      const k = monthKey(e.date);
      (byMonth[k] = byMonth[k] || []).push(e);
    });
    return Object.keys(byMonth).sort().reverse().map(k => ({ key: k, label: monthLabel(k), entries: byMonth[k] }));
  }, [entries]);

  return (
    <div style={{ padding: '0 16px 100px' }}>
      {groups.map((g, gi) => (
        <article key={g.key} style={{
          background: 'var(--card)',
          border: '0.5px solid var(--line)',
          boxShadow: '0 1px 0 rgba(26,22,18,0.04)',
          marginBottom: 18, padding: '20px 18px 16px',
          position: 'relative',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            paddingBottom: 8, marginBottom: 12,
            borderBottom: '0.5px solid var(--line)',
          }}>
            <span className="eyebrow rubric">{g.label}</span>
            <span className="folio">Folio {gi + 1}</span>
          </div>

          {g.entries.map((e, i) => (
            <button key={e.id} onClick={() => onOpen(e)} style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '10px 0', borderBottom: i < g.entries.length - 1 ? '0.5px dotted var(--line)' : 'none',
            }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-faint)', minWidth: 24, fontVariantNumeric: 'tabular-nums' }}>
                  {new Date(e.date + 'T00:00:00').getDate()}
                </span>
                <span style={{ color: 'var(--rubric)', fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 14, minWidth: 14 }}>
                  {getCat(e.category).mark}
                </span>
                <div style={{ flex: 1 }}>
                  <div className="serif-display" style={{ fontSize: 17, lineHeight: 1.15, fontWeight: 500, letterSpacing: '-0.005em' }}>
                    {e.title}
                  </div>
                  {e.metadata?.author && (
                    <div className="serif-ital" style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 1 }}>
                      {e.metadata.author}
                    </div>
                  )}
                </div>
                <span className="folio" style={{ fontSize: 8 }}>{String(e.n).padStart(3, '0')}</span>
              </div>
            </button>
          ))}

          {/* page number */}
          <div style={{ textAlign: 'center', marginTop: 10, paddingTop: 6, borderTop: '0.5px solid var(--line-soft)' }}>
            <span className="folio">— {(gi + 1) * 2 - 1} · {(gi + 1) * 2} —</span>
          </div>
        </article>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   View 4 — ATLAS (map view)
   Stylized hand-drawn map with pins for locations
   ─────────────────────────────────────────────────────────── */
function AtlasView({ entries, onOpen }) {
  const byLocation = useM(() => {
    const m = {};
    entries.forEach(e => {
      const loc = e.metadata?.location;
      if (loc) (m[loc] = m[loc] || []).push(e);
    });
    return m;
  }, [entries]);

  // hand-placed fake coordinates for a stylized map of Europe
  const coords = {
    'London':   { x: 32, y: 38 },
    'Paris':    { x: 41, y: 45 },
    'Florence': { x: 55, y: 65 },
    'Berlin':   { x: 55, y: 34 },
    'Amsterdam':{ x: 44, y: 36 },
  };

  const [sel, setSel] = useS(null);
  const cities = Object.keys(byLocation);
  const active = sel || cities[0];

  return (
    <div style={{ padding: '0 0 100px' }}>
      {/* Map */}
      <div style={{
        margin: '0 16px 16px', position: 'relative',
        background: 'var(--card)',
        border: '0.5px solid var(--line)',
        padding: '18px 0 12px',
        aspectRatio: '1 / 0.9',
        overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 16px', marginBottom: 8 }}>
          <span className="eyebrow rubric">Mappa Enthousiasmarum</span>
          <span className="folio">{cities.length} cities</span>
        </div>

        {/* stylized abstract map — layered rectangles approximating continents */}
        <svg viewBox="0 0 100 85" style={{ width: '100%', height: 'calc(100% - 32px)' }}>
          {/* sea */}
          <rect width="100" height="85" fill="transparent" />
          {/* lat/lon grid */}
          {[15,30,45,60,75].map(y => (
            <line key={y} x1="4" y1={y} x2="96" y2={y} stroke="var(--line)" strokeWidth="0.15" strokeDasharray="0.5 1" opacity="0.7"/>
          ))}
          {[20,35,50,65,80].map(x => (
            <line key={x} x1={x} y1="4" y2="80" x2={x} stroke="var(--line)" strokeWidth="0.15" strokeDasharray="0.5 1" opacity="0.7"/>
          ))}
          {/* landmass silhouettes */}
          <path d="M 18 20 Q 28 18, 38 22 L 50 20 Q 62 22, 70 28 L 72 40 Q 68 48, 60 50 L 55 68 Q 48 76, 42 74 L 36 70 Q 30 68, 28 60 L 22 52 Q 16 44, 20 34 Z"
                fill="var(--paper-2)" stroke="var(--ink-faint)" strokeWidth="0.2" opacity="0.6"/>
          <path d="M 74 30 Q 82 32, 88 40 L 90 55 Q 86 62, 80 60 L 76 48 Z"
                fill="var(--paper-2)" stroke="var(--ink-faint)" strokeWidth="0.2" opacity="0.6"/>
          {/* pins */}
          {cities.map(city => {
            const c = coords[city] || { x: 50, y: 50 };
            const isSel = active === city;
            const count = byLocation[city].length;
            return (
              <g key={city} onClick={() => setSel(city)} style={{ cursor: 'pointer' }}>
                <circle cx={c.x} cy={c.y} r={isSel ? 2.6 : 1.6} fill="var(--rubric)" opacity={isSel ? 1 : 0.75}/>
                {isSel && <circle cx={c.x} cy={c.y} r="4" fill="none" stroke="var(--rubric)" strokeWidth="0.2" opacity="0.5"/>}
                <text x={c.x + 3.5} y={c.y + 1.2} fontSize={isSel ? '3' : '2.4'} fontFamily="Fraunces, serif" fontStyle="italic" fill="var(--ink)">
                  {city}
                </text>
                <text x={c.x + 3.5} y={c.y + 4.5} fontSize="1.8" fontFamily="JetBrains Mono" fill="var(--ink-faint)">
                  {count} {count === 1 ? 'entry' : 'entries'}
                </text>
              </g>
            );
          })}
          {/* compass rose */}
          <g transform="translate(92,76)">
            <circle r="3" fill="none" stroke="var(--ink-faint)" strokeWidth="0.2"/>
            <path d="M 0 -3 L 0.7 0 L 0 3 L -0.7 0 Z" fill="var(--rubric)"/>
            <text y="-4" textAnchor="middle" fontSize="2" fontFamily="JetBrains Mono" fill="var(--ink-soft)">N</text>
          </g>
        </svg>
      </div>

      {/* list for active city */}
      <div style={{ padding: '0 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <div className="serif-display rubric" style={{ fontSize: 26 }}>
            <span className="serif-ital">{active}</span>
          </div>
          <span className="eyebrow">{byLocation[active]?.length || 0} entries</span>
        </div>
        <div style={{ borderTop: '0.5px solid var(--line)', marginBottom: 4 }} />
        {(byLocation[active] || []).map(e => (
          <EntryCard key={e.id} entry={e} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Book description — an internet-grounded ~15-line description,
   cached. Auto-fetched the first time a book is opened; a quiet
   "Refresh" re-runs it. (src/descriptions.js holds the engine.)
   ─────────────────────────────────────────────────────────── */
function BookDescription({ entry }) {
  const [row, setRow] = useS(() => descriptionFor(entry.id));
  const [busy, setBusy] = useS(false);
  const [err, setErr] = useS(null);

  const fetchDesc = (force) => {
    setBusy(true); setErr(null);
    generateDescription(entry)
      .then(r => setRow(r))
      .catch(e => setErr(e.message))
      .finally(() => setBusy(false));
  };

  // On open: show any cached description; books fetch theirs unasked,
  // every other category waits for its button.
  React.useEffect(() => {
    const existing = descriptionFor(entry.id);
    setRow(existing); setErr(null);
    if (!existing && autoDescribe(entry)) fetchDesc(false);
  }, [entry.id]);

  const heading = {
    book: 'On the book', film: 'On the film', music: 'On the music',
    visualart: 'On the work', exhibition: 'On the exhibition',
    theatre: 'On the production', ballet: 'On the production',
    event: 'On the event', place: 'On the place',
  }[entry.category] || 'On the work';

  return (
    <div style={{ marginBottom: 22 }}>
      <div className="eyebrow rubric" style={{ marginBottom: 8 }}>{heading}</div>
      {busy && !row ? (
        <p className="serif-ital" style={{ fontSize: 13.5, color: 'var(--ink-soft)' }}>Reading around the web…</p>
      ) : err && !row ? (
        <>
          <p className="serif-ital" style={{ fontSize: 13, color: 'var(--rubric)', marginBottom: 8 }}>{err}</p>
          <button onClick={() => fetchDesc(false)} className="eyebrow" style={{ color: 'var(--rubric)' }}>Try again</button>
        </>
      ) : !row ? (
        <button onClick={() => fetchDesc(false)} className="eyebrow" style={{
          border: '0.5px solid var(--line)', background: 'var(--card)',
          color: 'var(--rubric)', padding: '7px 16px', borderRadius: 2,
        }}>
          Draw the description
        </button>
      ) : row ? (
        <>
          <p style={{
            fontFamily: 'var(--serif)', fontSize: 14.5, lineHeight: 1.7, color: 'var(--ink)',
            whiteSpace: 'pre-wrap', textWrap: 'pretty',
          }}>{row.text}</p>
          <button onClick={() => fetchDesc(true)} disabled={busy} className="eyebrow"
            style={{ color: 'var(--ink-faint)', marginTop: 10 }}>
            {busy ? 'Refreshing…' : 'Refresh'}
          </button>
          {err && <span className="serif-ital" style={{ fontSize: 12, color: 'var(--rubric)', marginLeft: 10 }}>{err}</span>}
        </>
      ) : null}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Detail view — a single entry as a full page
   ─────────────────────────────────────────────────────────── */
function DetailView({ entry, onBack, onEdit, onFav }) {
  const cat = getCat(entry.category);
  const fields = META_FIELDS[entry.category] || [];
  const big = entry.title.length < 60;
  const isQ = isQuote(entry);
  const isP = isPoem(entry);
  // For quotes & poems, author/work appear as a styled attribution — not in the meta table.
  const metaFields = (isQ || isP) ? fields.filter(f => f.key !== 'author' && f.key !== 'work') : fields;
  const hasMeta = metaFields.some(f => entry.metadata?.[f.key]) || entry.metadata?.location || entry.metadata?.link;

  return (
    <div style={{ padding: '12px 20px 100px' }}>
      <button onClick={onBack} style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 0',
        fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em',
        textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: 14,
      }}>
        ← Archive
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <CategoryMark cat={cat} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={onFav} aria-label="Favourite" title={entry.favourite ? 'Remove favourite' : 'Mark as favourite'} style={{
            fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 20, lineHeight: 1,
            color: entry.favourite ? 'var(--rubric)' : 'var(--ink-faint)',
          }}>☞</button>
          <Folio n={entry.n} />
        </div>
      </div>

      {entry.image && (
        <div style={{ margin: '4px 0 16px', border: '0.5px solid var(--line)', overflow: 'hidden' }}>
          <img src={entry.image} alt="" style={{ width: '100%', maxHeight: 260, objectFit: 'cover', display: 'block' }}/>
        </div>
      )}

      {isP ? (
        <>
          {entry.title && (
            <h1 className="serif-display" style={{
              fontSize: big ? 30 : 24, fontWeight: 500, lineHeight: 1.08,
              marginTop: 6, marginBottom: 16, textWrap: 'balance',
            }}>
              {entry.title}
            </h1>
          )}
          {entry.verse && (
            <p style={{
              fontFamily: 'var(--serif)', fontSize: 17, lineHeight: 1.62,
              color: 'var(--ink)', whiteSpace: 'pre-wrap', marginTop: 6, marginBottom: 20,
            }}>
              {entry.verse}
            </p>
          )}
          {entry.note && (
            <p className="serif-ital" style={{
              fontSize: 14, lineHeight: 1.6, color: 'var(--ink-soft)', marginBottom: 18,
            }}>
              {entry.note}
            </p>
          )}
          {(entry.metadata?.author || entry.metadata?.work) && (
            <div style={{ marginBottom: 22 }}>
              <div style={{ width: 28, borderTop: '1px solid var(--gold)', marginBottom: 12 }} />
              {entry.metadata?.author && (
                <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: 5 }}>
                  {entry.metadata.author}
                </div>
              )}
              {entry.metadata?.work && (
                <div className="serif-ital" style={{ fontSize: 15, color: 'var(--ink-soft)' }}>
                  {entry.metadata.work}
                </div>
              )}
            </div>
          )}
        </>
      ) : isQuote(entry) ? (
        <>
          <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 72, lineHeight: 0.7, color: 'var(--rubric)', opacity: 0.4, marginLeft: -6, marginBottom: 2 }}>“</div>
          <h1 className="serif-ital" style={{
            fontSize: big ? 30 : 23, lineHeight: 1.28, fontWeight: 400,
            marginBottom: 18, textWrap: 'pretty',
          }}>
            {entry.title}
          </h1>
          {entry.note && (
            <p style={{
              fontFamily: 'var(--serif)', fontSize: 15, lineHeight: 1.6,
              color: 'var(--ink)', marginBottom: 20,
              whiteSpace: entry.category === 'idea' ? 'pre-line' : undefined,
            }}>
              {entry.note}
            </p>
          )}
          {(entry.metadata?.author || entry.metadata?.source || entry.metadata?.work) && (
            <div style={{ marginBottom: 22 }}>
              <div style={{ width: 28, borderTop: '1px solid var(--rubric)', marginBottom: 12 }} />
              {(entry.metadata?.author || entry.metadata?.source) && (
                <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: 5 }}>
                  {entry.metadata.author || entry.metadata.source}
                </div>
              )}
              {entry.metadata?.work && (
                <div className="serif-ital" style={{ fontSize: 15, color: 'var(--ink-soft)' }}>
                  {entry.metadata.work}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <h1 className="serif-display" style={{
            fontSize: big ? 34 : 26, fontWeight: 500, lineHeight: 1.05,
            marginBottom: 10, marginTop: 6, textWrap: 'balance',
          }}>
            {entry.title}
          </h1>
          {entry.date && (
            <div className="serif-ital" style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 16 }}>
              {fmtDate(entry.date)}
            </div>
          )}
          {entry.note && (
            <p className="dropcap" style={{
              fontFamily: 'var(--serif)', fontSize: 16, lineHeight: 1.78,
              color: 'var(--ink)', marginTop: 4, marginBottom: 24, textWrap: 'pretty',
              maxWidth: '34rem',
            }}>
              {entry.note}
            </p>
          )}
        </>
      )}

      {entry.image && (
        <EntryImage entry={entry} style={{
          maxWidth: '100%', maxHeight: 380, objectFit: 'contain',
          border: '0.5px solid var(--line)', marginBottom: 22,
        }} />
      )}

      {describable(entry) && <BookDescription entry={entry} />}

      <button onClick={onEdit} style={{
        padding: '10px 18px', border: '0.5px solid var(--ink)',
        fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em',
        textTransform: 'uppercase', color: 'var(--ink)',
      }}>
        Edit entry
      </button>
      <div style={{ marginTop: 12 }}>
        <button onClick={() => sharePostcard('entry', entry)} className="folio" style={{
          fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--rubric)',
          background: 'none', border: 'none', cursor: 'pointer',
        }}>
          ❧ Send as postcard
        </button>
      </div>

      {/* colophon — production details at the foot, like a fine-press page */}
      {hasMeta && (
        <div style={{ marginTop: 30, paddingTop: 16, borderTop: '0.5px solid var(--line)', textAlign: 'center' }}>
          <div className="eyebrow" style={{ color: 'var(--ink-faint)', marginBottom: 12 }}>Colophon</div>
          <dl style={{ display: 'inline-grid', gridTemplateColumns: 'auto auto', gap: '7px 16px', textAlign: 'left' }}>
            {metaFields.map(f => entry.metadata?.[f.key] && (
              <Fragment key={f.key}>
                <dt className="eyebrow" style={{ alignSelf: 'baseline' }}>{f.label}</dt>
                <dd className="serif-ital" style={{ fontSize: 14, color: 'var(--ink)' }}>{entry.metadata[f.key]}</dd>
              </Fragment>
            ))}
            {entry.metadata?.location && (
              <Fragment>
                <dt className="eyebrow" style={{ alignSelf: 'baseline' }}>Seen in</dt>
                <dd className="serif-ital" style={{ fontSize: 14, color: 'var(--ink)' }}>{entry.metadata.location}</dd>
              </Fragment>
            )}
            {entry.metadata?.link && (
              <Fragment>
                <dt className="eyebrow" style={{ alignSelf: 'baseline' }}>Source</dt>
                <dd><a href={entry.metadata.link} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--rubric)', wordBreak: 'break-all' }}>↗ {entry.metadata.link.replace(/^https?:\/\//, '').slice(0, 40)}{entry.metadata.link.length > 47 ? '…' : ''}</a></dd>
              </Fragment>
            )}
          </dl>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Add/Edit modal
   ─────────────────────────────────────────────────────────── */
function EditModal({ entry, onClose, onSave, onDelete, canUpload = false }) {
  const [form, setForm] = useS(entry || {
    title: '', category: 'book', date: new Date().toISOString().slice(0,10),
    note: '', metadata: {},
  });
  const isNew = !entry?.id;
  const cat = getCat(form.category);
  // Choose a photograph → shrink it now (#9), upload on save (#37).
  const onPhoto = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const { blob, dataUrl } = await resizeImage(file);
      setForm(f => ({ ...f, _imageBlob: blob, _imageData: dataUrl }));
    } catch (err) { alert(err.message); }
    e.target.value = '';
  };
  // #32 — a gentle, rotating one-line prompt at capture; the answer (the note)
  // is what makes future Insights rich.
  const whyPrompt = useM(() => {
    const ps = [
      'What did it awaken in you?',
      'Why do you want to remember this?',
      'What did it change, even a little?',
      'What were you feeling when it landed?',
      'What will you carry from it?',
      'What did it make you notice?',
    ];
    return ps[Math.floor(Math.random() * ps.length)];
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(26, 22, 18, 0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-end',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--paper)',
        width: '100%', maxHeight: '85%', overflowY: 'auto',
        padding: '20px 20px 40px',
        borderTop: '2px solid var(--rubric)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <div className="eyebrow rubric">{isNew ? 'New enthusiasm' : 'Edit'}</div>
          <button onClick={onClose} className="folio" style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Close ×</button>
        </div>

        <label className="eyebrow" style={{ display: 'block', marginBottom: 6 }}>Category</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 18 }}>
          {CATEGORIES.map(c => (
            <button key={c.id} onClick={() => setForm(f => ({ ...f, category: c.id }))} style={{
              padding: '5px 10px', border: `0.5px solid ${form.category === c.id ? 'var(--ink)' : 'var(--line)'}`,
              background: form.category === c.id ? 'var(--ink)' : 'transparent',
              color: form.category === c.id ? 'var(--paper)' : 'var(--ink-soft)',
              fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 5,
              borderRadius: 100,
            }}>
              <span style={{ fontFamily: 'var(--serif)', fontStyle: 'italic' }}>{c.mark}</span>
              {c.label}
            </button>
          ))}
        </div>

        <label className="eyebrow" style={{ display: 'block', marginBottom: 6 }}>Title</label>
        <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder={cat.id === 'poem' ? 'The title of the poem…' : 'Anna Karenina, Clair de Lune…'}
          style={{ width: '100%', padding: '10px 0', marginBottom: 14, border: 'none', borderBottom: '0.5px solid var(--line)', background: 'transparent', fontFamily: 'var(--serif)', fontSize: 18, outline: 'none' }}/>

        {cat.id === 'poem' && (
          <>
            <label className="eyebrow" style={{ display: 'block', marginBottom: 6 }}>Verse</label>
            <textarea value={form.verse || ''} onChange={e => setForm(f => ({ ...f, verse: e.target.value }))}
              placeholder="Paste the poem — line breaks are kept"
              rows={7}
              style={{ width: '100%', padding: '10px 12px', marginBottom: 14, border: '0.5px solid var(--line)', background: 'var(--card)', fontFamily: 'var(--serif)', fontSize: 16, lineHeight: 1.55, outline: 'none', resize: 'vertical', whiteSpace: 'pre-wrap' }}/>
          </>
        )}

        <label className="eyebrow" style={{ display: 'block', marginBottom: 6 }}>Date</label>
        <input type="date" value={form.date || ''} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
          style={{ padding: '8px 0', marginBottom: 14, border: 'none', borderBottom: '0.5px solid var(--line)', background: 'transparent', fontFamily: 'var(--mono)', fontSize: 13, outline: 'none' }}/>

        {(META_FIELDS[form.category] || []).map(f => (
          <div key={f.key} style={{ marginBottom: 14 }}>
            <label className="eyebrow" style={{ display: 'block', marginBottom: 6 }}>{f.label}</label>
            <input value={form.metadata?.[f.key] || ''}
              onChange={e => setForm(ff => ({ ...ff, metadata: { ...ff.metadata, [f.key]: e.target.value } }))}
              style={{ width: '100%', padding: '8px 0', border: 'none', borderBottom: '0.5px solid var(--line)', background: 'transparent', fontFamily: 'var(--serif)', fontSize: 15, outline: 'none' }}/>
          </div>
        ))}

        <label className="eyebrow" style={{ display: 'block', marginBottom: 6 }}>Link (optional)</label>
        <input value={form.metadata?.link || ''}
          onChange={e => setForm(ff => ({ ...ff, metadata: { ...ff.metadata, link: e.target.value } }))}
          placeholder="https://…"
          style={{ width: '100%', padding: '8px 0', marginBottom: 14, border: 'none', borderBottom: '0.5px solid var(--line)', background: 'transparent', fontFamily: 'var(--mono)', fontSize: 12, outline: 'none' }}/>

        <label className="eyebrow" style={{ display: 'block', marginBottom: 6 }}>Image</label>
        {(form._imageData || form.image) && (
          <div style={{ marginBottom: 10 }}>
            {form._imageData ? (
              <img src={form._imageData} alt="" style={{ maxWidth: 120, maxHeight: 160, border: '0.5px solid var(--line)', display: 'block' }} />
            ) : /^https?:/.test(form.image) ? (
              <img src={form.image} alt="" style={{ maxWidth: 120, maxHeight: 160, border: '0.5px solid var(--line)', display: 'block' }} />
            ) : (
              <div className="folio" style={{ opacity: 0.7 }}>a photograph is kept with this entry</div>
            )}
          </div>
        )}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
          {canUpload ? (
            <label className="eyebrow" style={{
              border: '0.5px solid var(--line)', background: 'var(--card)', color: 'var(--rubric)',
              padding: '7px 14px', borderRadius: 2, cursor: 'pointer',
            }}>
              {(form.image || form._imageData) ? 'Replace the photograph' : 'Add a photograph'}
              <input type="file" accept="image/*" onChange={onPhoto} style={{ display: 'none' }} />
            </label>
          ) : (
            <span className="serif-ital" style={{ fontSize: 12, color: 'var(--ink-faint)' }}>Sign in to add photographs.</span>
          )}
          {(form.image || form._imageData) && (
            <button onClick={() => setForm(f => ({ ...f, image: null, _imageBlob: null, _imageData: null }))}
              className="eyebrow" style={{ color: 'var(--ink-faint)' }}>
              Remove
            </button>
          )}
        </div>
        {!form._imageData && (!form.image || /^https?:/.test(form.image)) && (
          <input value={form.image || ''}
            onChange={e => setForm(ff => ({ ...ff, image: e.target.value }))}
            placeholder="…or paste an image URL"
            style={{ width: '100%', padding: '8px 0', marginBottom: 14, border: 'none', borderBottom: '0.5px solid var(--line)', background: 'transparent', fontFamily: 'var(--mono)', fontSize: 12, outline: 'none' }}/>
        )}

        <label className="eyebrow" style={{ display: 'block', marginBottom: 2, marginTop: 6 }}>Why it moved me</label>
        <div className="serif-ital" style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginBottom: 8 }}>{whyPrompt}</div>
        <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
          placeholder="One line is plenty…"
          rows={5}
          style={{ width: '100%', padding: '10px 12px', marginBottom: 18, border: '0.5px solid var(--line)', background: 'var(--card)', fontFamily: 'var(--serif)', fontSize: 14, lineHeight: 1.6, outline: 'none', resize: 'vertical' }}/>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
          {!isNew && (
            <button onClick={onDelete} style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--rubric)' }}>
              Delete
            </button>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ padding: '10px 18px', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>
              Cancel
            </button>
            <button onClick={() => onSave(form)} style={{ padding: '10px 20px', background: 'var(--rubric)', color: 'var(--paper)', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
              {isNew ? 'Inscribe' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   View 4 — MAP (#41)
   The inner world drawn from the 13-cluster signatures (#39).
   Three renderings of the same scored archive:
     · Territory — the provinces as packed lands, sized by holdings
     · Sky       — every entry a star, gathered into its constellation
     · Mandala   — the whole signature as a rose, petals by affinity
   All read from the cluster cache; tapping selects a province (or,
   in Sky, opens the entry directly). ─────────────────────────── */

/* The display name without its article, for tight in-figure labels. */
function clusterShort(label) {
  return label.replace(/^(The|A|An)\s+/i, '');
}

const polarPt = (cx, cy, r, deg) => [
  cx + r * Math.cos(deg * Math.PI / 180),
  cy + r * Math.sin(deg * Math.PI / 180),
];

/* Deterministic per-id hash → positions that survive redraws. */
const mapHash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const hashFrac = (str, salt) => (mapHash(str + salt) % 1000) / 1000;

/* Affinity threads (#25) — from the picked work to the centres of the other
   clusters it scores on: top three at ≥ 0.35, its home excluded. */
function threadLines(cache, pickId, from, centers) {
  const sc = cache.byId[pickId];
  if (!sc || !from) return null;
  const home = clusterHome(cache, pickId);
  return Object.entries(sc.scores)
    .filter(([id, s]) => id !== home && s >= 0.35 && centers[id])
    .sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([id]) => (
      <line key={id} x1={from[0]} y1={from[1]} x2={centers[id][0]} y2={centers[id][1]}
        stroke="var(--rubric)" strokeWidth="0.25" strokeDasharray="1 1.2" strokeOpacity="0.55" />
    ));
}

/* MANDALA — the rose window: thirteen sectors around the Self, every scored
   work a point in its home sector, the strongest drawn nearest the centre.
   The rim numbers key the census below. */
function MandalaRose({ stats, cache, entries, selected, onSelect, pick, onPick }) {
  const cx = 50, cy = 50, n = stats.length;
  const R0 = 11, R1 = 42;
  const max = Math.max(1, ...stats.map(s => s.weight));
  const sectorAng = {};
  stats.forEach((s, i) => { sectorAng[s.id] = -90 + i * (360 / n); });
  const centers = {};
  stats.forEach(s => { centers[s.id] = polarPt(cx, cy, (R0 + R1) / 2, sectorAng[s.id]); });

  const placed = useM(() => entries.map(e => {
    const sc = cache.byId[e.id];
    const home = clusterHome(cache, e.id);
    if (!sc || !home || sectorAng[home] === undefined) return null;
    const score = sc.scores[home] || 0.3;
    const half = (360 / n) / 2 * 0.8;
    const a = sectorAng[home] + (hashFrac(e.id, 'a') * 2 - 1) * half;
    const r = R0 + 2 + (1 - score) * (R1 - R0 - 5) + hashFrac(e.id, 'r') * 2;
    const [x, y] = polarPt(cx, cy, r, a);
    return { e, score, x, y };
  }).filter(Boolean), [entries, cache, n]);

  const wedge = (i) => {
    const a0 = -90 + (i - 0.5) * (360 / n), a1 = -90 + (i + 0.5) * (360 / n);
    const [x0, y0] = polarPt(cx, cy, R0, a0), [x1, y1] = polarPt(cx, cy, R1, a0);
    const [x2, y2] = polarPt(cx, cy, R1, a1), [x3, y3] = polarPt(cx, cy, R0, a1);
    return `M ${x0.toFixed(1)} ${y0.toFixed(1)} L ${x1.toFixed(1)} ${y1.toFixed(1)} `
      + `A ${R1} ${R1} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)} L ${x3.toFixed(1)} ${y3.toFixed(1)} `
      + `A ${R0} ${R0} 0 0 0 ${x0.toFixed(1)} ${y0.toFixed(1)} Z`;
  };

  const pickPos = pick && placed.find(p => p.e.id === pick);

  return (
    <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
      {[18, 26, 34, 42].map(r => (
        <circle key={r} cx={cx} cy={cy} r={r} fill="none" stroke="var(--line-soft)" strokeWidth="0.15" />
      ))}
      {stats.map((s, i) => {
        const isSel = selected === s.id;
        const [lx, ly] = polarPt(cx, cy, 46, sectorAng[s.id]);
        return (
          <g key={s.id} onClick={() => { onPick(null); onSelect(isSel ? null : s.id); }} style={{ cursor: 'pointer' }}>
            <path d={wedge(i)} fill="var(--rubric)"
              fillOpacity={(isSel ? 0.1 : 0.02) + (s.weight / max) * 0.08}
              stroke="var(--line-soft)" strokeWidth="0.15" />
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="central"
              fontSize="2.4" fontFamily="JetBrains Mono"
              fill={isSel ? 'var(--rubric)' : 'var(--ink-faint)'}>{i + 1}</text>
          </g>
        );
      })}
      {placed.map(p => (
        <circle key={p.e.id} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r={0.55 + p.score * 0.85}
          fill="var(--ink)" fillOpacity={0.4 + p.score * 0.5} data-e={p.e.id}
          onClick={(ev) => { ev.stopPropagation(); onPick(p.e.id === pick ? null : p.e.id); }}
          style={{ cursor: 'pointer' }} />
      ))}
      {pickPos && (
        <g pointerEvents="none">
          {threadLines(cache, pick, [pickPos.x, pickPos.y], centers)}
          <circle cx={pickPos.x.toFixed(1)} cy={pickPos.y.toFixed(1)} r="2.2"
            fill="none" stroke="var(--rubric)" strokeWidth="0.4" />
        </g>
      )}
      <circle cx={cx} cy={cy} r={R0 - 2.5} fill="var(--card)" stroke="var(--line)"
        strokeWidth="0.2" strokeDasharray="0.8 0.8" />
      <text x={cx} y={cy - 0.8} textAnchor="middle" dominantBaseline="central"
        fontFamily="Fraunces, serif" fontStyle="italic" fontSize="4" fill="var(--ink)">Soi</text>
      <text x={cx} y={cy + 3.2} textAnchor="middle" dominantBaseline="central"
        fontFamily="JetBrains Mono" fontSize="1.7" letterSpacing="0.3" fill="var(--ink-faint)">THE SELF</text>
    </svg>
  );
}

/* A gently irregular coastline around a province's centre — a smooth
   closed curve through hash-jittered radii, stable across redraws. */
function blobPath(cx0, cy0, R, id) {
  const K = 12;
  const pts = [];
  for (let k = 0; k < K; k++) {
    const rr = R * (0.86 + 0.24 * hashFrac(id, 'b' + k));
    pts.push(polarPt(cx0, cy0, rr, (k / K) * 360));
  }
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m0 = mid(pts[K - 1], pts[0]);
  let d = `M ${m0[0].toFixed(1)} ${m0[1].toFixed(1)} `;
  for (let k = 0; k < K; k++) {
    const m1 = mid(pts[k], pts[(k + 1) % K]);
    d += `Q ${pts[k][0].toFixed(1)} ${pts[k][1].toFixed(1)} ${m1[0].toFixed(1)} ${m1[1].toFixed(1)} `;
  }
  return d + 'Z';
}

/* TERRITORY — circle-packed provinces drawn as islands, every scored work
   a point on its island. Compass rose and terra incognita at the margins. */
function TerritoryMap({ stats, cache, entries, selected, onSelect, pick, onPick }) {
  const placed = useM(() => {
    const items = stats.filter(s => s.count > 0)
      .map(s => ({ ...s, r: Math.sqrt(s.count) }))
      .sort((a, b) => b.r - a.r);
    const out = [];
    items.forEach((it, idx) => {
      if (idx === 0) { out.push({ ...it, x: 0, y: 0 }); return; }
      let best = null;
      for (let a = 0; a < 2000 && !best; a += 11) {
        const [x, y] = [Math.cos(a * Math.PI / 180), Math.sin(a * Math.PI / 180)]
          .map(u => u * (0.5 + a / 55));
        if (out.every(o => Math.hypot(o.x - x, o.y - y) >= o.r + it.r + 0.4)) best = { x, y };
      }
      out.push({ ...it, ...(best || { x: 0, y: 0 }) });
    });
    return out;
  }, [stats]);

  if (!placed.length) return null;
  const pad = 7;
  const minX = Math.min(...placed.map(o => o.x - o.r)), maxX = Math.max(...placed.map(o => o.x + o.r));
  const minY = Math.min(...placed.map(o => o.y - o.r)), maxY = Math.max(...placed.map(o => o.y + o.r));
  const w = maxX - minX, h = maxY - minY;
  const scale = (100 - 2 * pad) / Math.max(w, h, 1);
  const ox = pad + (100 - 2 * pad - w * scale) / 2 - minX * scale;
  const oy = pad + (100 - 2 * pad - h * scale) / 2 - minY * scale;
  const max = Math.max(1, ...placed.map(o => o.count));

  const isles = placed.map(o => ({ ...o, X: ox + o.x * scale, Y: oy + o.y * scale, R: o.r * scale }));
  const centers = {};
  isles.forEach(o => { centers[o.id] = [o.X, o.Y]; });

  // Every scored work: a point on its home island, position hashed from
  // its id so the coast doesn't reshuffle between visits.
  const dots = useM(() => entries.map(e => {
    const sc = cache.byId[e.id];
    const home = clusterHome(cache, e.id);
    const isle = home && isles.find(o => o.id === home);
    if (!sc || !isle) return null;
    const score = sc.scores[home] || 0.3;
    const rr = isle.R * (0.28 + 0.52 * Math.sqrt(hashFrac(e.id, 'r')));
    const [x, y] = polarPt(isle.X, isle.Y, rr, hashFrac(e.id, 'a') * 360);
    return { e, score, x, y };
  }).filter(Boolean), [entries, cache, isles.length, scale]);

  const pickPos = pick && dots.find(p => p.e.id === pick);

  return (
    <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
      {/* compass rose */}
      <g opacity="0.8">
        <circle cx="8.5" cy="8.5" r="3.2" fill="none" stroke="var(--line)" strokeWidth="0.2" />
        <path d="M 8.5 5 L 9.3 8.5 L 8.5 12 L 7.7 8.5 Z" fill="var(--rubric)" fillOpacity="0.65" />
      </g>
      <text x="94" y="6" textAnchor="end" fontFamily="Fraunces, serif" fontStyle="italic"
        fontSize="2.6" fill="var(--ink-faint)" opacity="0.75">terra incognita</text>

      {isles.map(o => {
        const isSel = selected === o.id;
        return (
          <g key={o.id} onClick={() => { onPick(null); onSelect(isSel ? null : o.id); }} style={{ cursor: 'pointer' }}>
            <path d={blobPath(o.X, o.Y, o.R, o.id)} fill="var(--rubric)"
              fillOpacity={0.05 + (o.count / max) * 0.13}
              stroke="var(--rubric)" strokeWidth={isSel ? 0.5 : 0.25}
              strokeOpacity={isSel ? 0.9 : 0.4} />
            {o.R > 6 && (
              <text x={o.X.toFixed(1)} y={(o.Y - o.R * 0.55).toFixed(1)} textAnchor="middle" dominantBaseline="central"
                fontSize={Math.min(3.2, o.R / 2.6)} fontFamily="Fraunces, serif" fontStyle="italic"
                fill="var(--ink)">{clusterShort(o.label)}</text>
            )}
            <text x={o.X.toFixed(1)} y={(o.Y + o.R * 0.8).toFixed(1)} textAnchor="middle" dominantBaseline="central"
              fontSize="2.2" fontFamily="JetBrains Mono" fill="var(--ink-faint)">{o.count}</text>
          </g>
        );
      })}
      {dots.map(p => (
        <circle key={p.e.id} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r={0.6 + p.score * 0.7}
          fill="var(--ink)" fillOpacity={0.4 + p.score * 0.45} data-e={p.e.id}
          onClick={(ev) => { ev.stopPropagation(); onPick(p.e.id === pick ? null : p.e.id); }}
          style={{ cursor: 'pointer' }} />
      ))}
      {pickPos && (
        <g pointerEvents="none">
          {threadLines(cache, pick, [pickPos.x, pickPos.y], centers)}
          <circle cx={pickPos.x.toFixed(1)} cy={pickPos.y.toFixed(1)} r="2.2"
            fill="none" stroke="var(--rubric)" strokeWidth="0.4" />
        </g>
      )}
    </svg>
  );
}

/* SKY — every scored entry a star, scattered around its home constellation;
   brighter and larger the stronger its belonging. Tapping a star picks it. */
function SkyChart({ stats, cache, entries, pick, onPick }) {
  const n = stats.length;
  const centers = {};
  stats.forEach((s, i) => {
    centers[s.id] = polarPt(50, 50, 30, -90 + i * (360 / n));
  });

  const placed = useM(() => entries.map(e => {
    const sc = cache.byId[e.id];
    const home = clusterHome(cache, e.id);
    if (!sc || !home || !centers[home]) return null;
    const [hx, hy] = centers[home];
    const v = mapHash(e.id);
    const score = sc.scores[home] || 0.3;
    const rr = ((v >>> 9) % 1000) / 1000 * (11 - score * 6);
    const a = (v % 360) * Math.PI / 180;
    return { e, home, score, x: hx + Math.cos(a) * rr, y: hy + Math.sin(a) * rr };
  }).filter(Boolean), [entries, cache]);

  const byHome = {};
  placed.forEach(p => (byHome[p.home] = byHome[p.home] || []).push(p));
  const pickPos = pick && placed.find(p => p.e.id === pick);

  return (
    <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
      {Object.values(byHome).map((group, gi) => (
        group.length > 1 && (
          <path key={gi} fill="none" stroke="var(--ink-faint)" strokeWidth="0.15" strokeOpacity="0.45"
            d={'M ' + group.map(p => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L ')} />
        )
      ))}
      {stats.map((s, i) => {
        const [lx, ly] = polarPt(50, 50, 41, -90 + i * (360 / n));
        return (s.count > 0) && (
          <text key={s.id} x={lx} y={ly} textAnchor="middle" dominantBaseline="central"
            fontSize="2.1" fontFamily="JetBrains Mono" fill="var(--ink-faint)" opacity="0.7">
            {clusterShort(s.label)}
          </text>
        );
      })}
      {placed.map(p => (
        <circle key={p.e.id} cx={p.x} cy={p.y} r={0.5 + p.score * 1.3}
          fill="var(--ink)" fillOpacity={0.45 + p.score * 0.5} data-e={p.e.id}
          onClick={() => onPick(p.e.id === pick ? null : p.e.id)} style={{ cursor: 'pointer' }} />
      ))}
      {pickPos && (
        <g pointerEvents="none">
          {threadLines(cache, pick, [pickPos.x, pickPos.y], centers)}
          <circle cx={pickPos.x.toFixed(1)} cy={pickPos.y.toFixed(1)} r="2.2"
            fill="none" stroke="var(--rubric)" strokeWidth="0.4" />
        </g>
      )}
    </svg>
  );
}

function MapView({ entries, onOpen }) {
  const [form, setForm] = useS('territory');
  const [cache, setCache] = useS(() => loadClusterCache());
  const [busy, setBusy] = useS(false);
  const [progress, setProgress] = useS(null);
  const [error, setError] = useS(null);
  const [selected, setSelected] = useS(null);
  const [pick, setPick] = useS(null); // a tapped work (#25)

  const scored = useM(() => entries.filter(e => cache.byId[e.id]).length, [entries, cache]);
  const unscored = entries.length - scored;

  // Keep the screen awake during the draw — a locked phone kills the
  // in-flight call. Best-effort, and the OS revokes it whenever the app is
  // backgrounded, so re-acquire on return while a draw is running.
  const wakeRef = React.useRef(null);
  const acquireWake = async () => {
    try { wakeRef.current = await navigator.wakeLock.request('screen'); } catch {}
  };
  React.useEffect(() => {
    if (!busy) return;
    const onVis = () => { if (!document.hidden) acquireWake(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [busy]);

  const draw = async (force) => {
    setBusy(true); setError(null); setPick(null);
    await acquireWake();
    try {
      const next = await deriveClusters(entries, { force, onProgress: setProgress });
      setCache({ ...next });
    } catch (err) {
      setError(err.message);
      setCache(loadClusterCache()); // pick up whatever batches completed
    } finally {
      try { if (wakeRef.current) wakeRef.current.release(); } catch {}
      wakeRef.current = null;
      setBusy(false); setProgress(null);
    }
  };

  // Per-theme holdings (home entries) and total affinity (summed scores) —
  // the shared substrate for all three renderings and the census.
  const stats = useM(() => {
    const byCluster = {}, weight = {};
    CLUSTERS.forEach(c => { weight[c.id] = 0; });
    entries.forEach(e => {
      const sc = cache.byId[e.id];
      if (sc) CLUSTERS.forEach(c => { weight[c.id] += sc.scores[c.id] || 0; });
      const home = clusterHome(cache, e.id);
      if (home) (byCluster[home] = byCluster[home] || []).push(e);
    });
    return CLUSTERS.map(c => {
      const es = byCluster[c.id] || [];
      return { ...c, entries: es, count: es.length, weight: weight[c.id] };
    });
  }, [entries, cache]);

  const selStat = selected && stats.find(s => s.id === selected);

  const forms = [
    { id: 'territory', label: 'Territory' },
    { id: 'sky',       label: 'Sky' },
    { id: 'mandala',   label: 'Mandala' },
  ];

  const drawButton = (label, force) => (
    <button onClick={() => draw(force)} className="eyebrow" style={{
      border: '0.5px solid var(--line)', background: 'var(--card)',
      color: 'var(--rubric)', padding: '8px 18px', borderRadius: 2,
    }}>
      {label}
    </button>
  );

  return (
    <div style={{ padding: '0 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 4, padding: '0 0 14px' }}>
        {forms.map((f, i) => (
          <Fragment key={f.id}>
            {i > 0 && <span className="folio" style={{ alignSelf: 'center', opacity: 0.6 }}>·</span>}
            <button onClick={() => { setPick(null); setForm(f.id); }} className="eyebrow" style={{
              padding: '2px 6px',
              color: form === f.id ? 'var(--rubric)' : 'var(--ink-faint)',
            }}>
              {f.label}
            </button>
          </Fragment>
        ))}
      </div>

      {busy ? (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <div className="serif-ital" style={{ fontSize: 15, color: 'var(--ink-soft)' }}>
            Surveying the interior…
          </div>
          {progress && progress.total > 0 && (
            <div className="folio" style={{ marginTop: 10 }}>
              {progress.done} of {progress.total} entries placed
            </div>
          )}
          <div className="serif-ital" style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 14 }}>
            Keep the app open — if interrupted, what's placed is kept.
          </div>
        </div>
      ) : scored === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div className="serif-ital" style={{ fontSize: 15, color: 'var(--ink-soft)', marginBottom: 18 }}>
            The territory is not yet drawn — {entries.length} entries await their place.
          </div>
          {error && (
            <div className="serif-ital" style={{ fontSize: 13, color: 'var(--rubric)', margin: '0 0 14px' }}>{error}</div>
          )}
          {drawButton('Draw the map', false)}
          <div className="folio" style={{ marginTop: 12 }}>a few minutes · scores are kept until redrawn</div>
        </div>
      ) : (
        <>
          {error && (
            <div className="serif-ital" style={{ fontSize: 13, color: 'var(--rubric)', textAlign: 'center', margin: '0 0 14px' }}>{error}</div>
          )}
          {unscored > 0 && (
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div className="serif-ital" style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 10 }}>
                {unscored} new {unscored === 1 ? 'entry awaits its place' : 'entries await their place'}.
              </div>
              {drawButton('Place them', false)}
            </div>
          )}

          {/* The figure */}
          <div style={{
            position: 'relative', margin: '0 auto 6px', maxWidth: 360,
            aspectRatio: '1 / 1', background: 'var(--card)',
            border: '0.5px solid var(--line)', padding: 10,
          }}>
            <span className="eyebrow rubric" style={{ position: 'absolute', top: 10, left: 12 }}>
              {form === 'territory' ? 'The Provinces' : form === 'sky' ? 'The Firmament' : 'The Rose'}
            </span>
            {form === 'territory'
              ? <TerritoryMap stats={stats} cache={cache} entries={entries} selected={selected} onSelect={setSelected} pick={pick} onPick={setPick} />
              : form === 'sky'
              ? <SkyChart stats={stats} cache={cache} entries={entries} pick={pick} onPick={setPick} />
              : <MandalaRose stats={stats} cache={cache} entries={entries} selected={selected} onSelect={setSelected} pick={pick} onPick={setPick} />}
          </div>
          <div className="serif-ital" style={{ fontSize: 11.5, color: 'var(--ink-faint)', textAlign: 'center', marginBottom: 18 }}>
            {form === 'sky'
              ? 'Each star an entry — tap it for its card. Brighter, the deeper it belongs.'
              : 'Tap a work for its card; tap a province to read what it holds.'}
          </div>

          {(() => {
            const pickEntry = pick && entries.find(e => e.id === pick);
            if (!pickEntry) return null;
            const sc = cache.byId[pick];
            const home = clusterHome(cache, pick);
            const homeCluster = CLUSTERS.find(c => c.id === home);
            const overridden = !!cache.overrides[pick];
            const affinities = sc ? Object.entries(sc.scores)
              .filter(([id, s]) => id !== home && s >= 0.35)
              .sort((a, b) => b[1] - a[1]).slice(0, 3)
              .map(([id]) => { const c = CLUSTERS.find(k => k.id === id); return c ? clusterShort(c.label) : null; })
              .filter(Boolean) : [];
            // Re-file (#40): choosing the derived home clears the override.
            const refile = (clusterId) => {
              const derived = sc && sc.home_cluster;
              setCache({ ...setClusterOverride(cache, pick, clusterId === derived ? null : clusterId) });
            };
            return (
              <div style={{
                margin: '0 auto 18px', maxWidth: 360, padding: '12px 14px', position: 'relative',
                background: 'var(--card)', border: '0.5px solid var(--line)', borderLeft: '2px solid var(--rubric)',
              }}>
                <button onClick={() => setPick(null)} className="folio"
                  style={{ position: 'absolute', top: 10, right: 12, fontSize: 10, color: 'var(--ink-soft)' }}>
                  × close
                </button>
                <div className="serif-ital" style={{ fontSize: 18, marginBottom: 4, paddingRight: 44 }}>{pickEntry.title}</div>
                <div className="eyebrow rubric" style={{ marginBottom: 8 }}>
                  {getCat(pickEntry.category).label} · {homeCluster ? clusterShort(homeCluster.label) : '—'}
                  {overridden ? ' · re-filed' : ''}
                </div>
                {affinities.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <span className="eyebrow" style={{ color: 'var(--ink-faint)' }}>also drawn toward — </span>
                    <span className="serif-ital" style={{ fontSize: 13, color: 'var(--ink)' }}>{affinities.join(' · ')}</span>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button onClick={() => onOpen(pickEntry)} className="eyebrow" style={{ color: 'var(--rubric)' }}>
                    Open the entry →
                  </button>
                  <label className="eyebrow" style={{ color: 'var(--ink-faint)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    re-file
                    <select value={home || ''} onChange={e => refile(e.target.value)} style={{
                      border: '0.5px solid var(--line)', background: 'var(--card)', color: 'var(--ink)',
                      fontFamily: 'var(--mono)', fontSize: 10, padding: '3px 4px', borderRadius: 2,
                    }}>
                      {CLUSTERS.map(c => <option key={c.id} value={c.id}>{clusterShort(c.label)}</option>)}
                    </select>
                  </label>
                  {overridden && (
                    <button onClick={() => setCache({ ...setClusterOverride(cache, pick, null) })}
                      className="eyebrow" style={{ color: 'var(--ink-faint)' }}>
                      restore derived
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

          {selStat ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <div className="serif-display rubric" style={{ fontSize: 24 }}>
                  <span className="serif-ital">{selStat.label}</span>
                </div>
                <button onClick={() => setSelected(null)} className="eyebrow" style={{ color: 'var(--ink-faint)' }}>← all</button>
              </div>
              <div className="serif-ital" style={{ fontSize: 12, color: 'var(--ink-faint)', marginBottom: 8 }}>{selStat.gloss}</div>
              <div style={{ borderTop: '0.5px solid var(--line)', marginBottom: 4 }} />
              {selStat.entries.length
                ? selStat.entries.map(e => <EntryCard key={e.id} entry={e} onOpen={onOpen} />)
                : <div className="serif-ital" style={{ fontSize: 13, color: 'var(--ink-faint)', padding: '14px 0' }}>No entries have settled here yet.</div>}
            </>
          ) : (
            <>
              <div className="flourish">the provinces</div>
              {stats.map((c, i) => (
                <div key={c.id} onClick={() => setSelected(c.id)} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                  padding: '9px 2px', borderBottom: '0.5px solid var(--line-soft)', cursor: 'pointer',
                }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                    <span className="folio" style={{ color: 'var(--ink-faint)', minWidth: 16 }}>{i + 1}</span>
                    <div>
                      <div className="serif-display" style={{ fontSize: 16, fontWeight: 500 }}>{c.label}</div>
                      <div className="serif-ital" style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 1 }}>{c.gloss}</div>
                    </div>
                  </div>
                  <span className="folio" style={{ flexShrink: 0, marginLeft: 14 }}>{c.count}</span>
                </div>
              ))}
            </>
          )}

          <div style={{ textAlign: 'center', padding: '22px 0 6px' }}>
            {drawButton('Redraw from scratch', true)}
          </div>
        </>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Descriptions backfill — fill the existing archive's books with
   internet descriptions in one resumable pass (mirrors the map
   draw: progress, partial-save, screen wake-lock).
   ─────────────────────────────────────────────────────────── */
function DescriptionsBackfill({ entries }) {
  const [busy, setBusy] = useS(false);
  const [prog, setProg] = useS(null);
  const [err, setErr] = useS(null);
  const [, setTick] = useS(0); // re-read the cache after a run

  const map = loadDescriptions();
  const books = entries.filter(autoDescribe);
  const missing = books.filter(b => !map[b.id]).length;

  const wakeRef = React.useRef(null);
  const run = async () => {
    setBusy(true); setErr(null);
    try { wakeRef.current = await navigator.wakeLock.request('screen'); } catch {}
    try {
      await backfillDescriptions(entries, { onProgress: setProg });
    } catch (e) {
      setErr(e.message);
    } finally {
      try { if (wakeRef.current) wakeRef.current.release(); } catch {}
      wakeRef.current = null;
      setBusy(false); setProg(null); setTick(t => t + 1);
    }
  };
  // Keep the screen awake across backgrounding while a run is in flight.
  React.useEffect(() => {
    if (!busy) return;
    const onVis = () => { if (!document.hidden) navigator.wakeLock?.request('screen').then(l => (wakeRef.current = l)).catch(() => {}); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [busy]);

  if (books.length === 0) return null;

  return (
    <div style={{ textAlign: 'center', padding: '10px 0 2px' }}>
      {busy ? (
        <div className="serif-ital" style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>
          Reading around the web…{prog && prog.total > 0 ? ' ' + prog.done + ' of ' + prog.total : ''}
        </div>
      ) : missing === 0 ? (
        <div className="folio" style={{ opacity: 0.7 }}>all {books.length} books described</div>
      ) : (
        <>
          {err && <div className="serif-ital" style={{ fontSize: 12, color: 'var(--rubric)', marginBottom: 8 }}>{err}</div>}
          <button onClick={run} className="eyebrow" style={{
            border: '0.5px solid var(--line)', background: 'var(--card)', color: 'var(--rubric)',
            padding: '7px 16px', borderRadius: 2,
          }}>
            Describe {missing} {missing === 1 ? 'book' : 'books'}
          </button>
          <div className="folio" style={{ marginTop: 8, opacity: 0.7 }}>a few minutes · kept until cleared</div>
        </>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Covers backfill (#11) — sweep the cover-less books through Open
   Library; each found cover is saved onto its entry at once (so it
   syncs and survives interruption). Sits by the descriptions pass.
   ─────────────────────────────────────────────────────────── */
function CoversBackfill({ entries, onCover }) {
  const [busy, setBusy] = useS(false);
  const [prog, setProg] = useS(null);
  const [err, setErr] = useS(null);
  const missing = entries.filter(e => e.category === 'book' && !e.image).length;
  if (missing === 0 && !busy) return null;

  const run = async () => {
    setBusy(true); setErr(null);
    try {
      await backfillCovers(entries, { onProgress: setProg, onFound: onCover });
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); setProg(null); }
  };

  return (
    <div style={{ textAlign: 'center', padding: '10px 0 2px' }}>
      {busy ? (
        <div className="serif-ital" style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>
          Searching the stacks…{prog && prog.total > 0 ? ' ' + prog.done + ' of ' + prog.total + (prog.found ? ' · ' + prog.found + ' found' : '') : ''}
        </div>
      ) : (
        <>
          {err && <div className="serif-ital" style={{ fontSize: 12, color: 'var(--rubric)', marginBottom: 8 }}>{err}</div>}
          <button onClick={run} className="eyebrow" style={{
            border: '0.5px solid var(--line)', background: 'var(--card)', color: 'var(--rubric)',
            padding: '7px 16px', borderRadius: 2,
          }}>
            Find {missing} book {missing === 1 ? 'cover' : 'covers'}
          </button>
        </>
      )}
    </div>
  );
}

Object.assign(window, { LedgerView, PostcardsView, SpreadView, AtlasView, MapView, DetailView, EditModal, DescriptionsBackfill, CoversBackfill });
