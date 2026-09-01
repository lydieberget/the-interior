# CLAUDE.md — The Interior

Guidance for AI-assisted work in this repository. Read this first, every session.

## What this is

The Interior is a personal cultural archive — a digital commonplace book. It records
what moved its owner (books, music, art, film, theatre, ideas, quotes), reflects their
taste back to them, and recommends new things drawn from that taste rather than from an
engagement algorithm. It is **personal software for one person at a time**, not a product.
Optimise for taste, restraint, and the quality of the reading experience — never for
scale, growth, or generality.

## Architecture (read carefully — it's unusual)

A **build-step-free single-page React app**. No webpack, no Vite, no npm build. React,
Babel and supabase-js load from `vendor/`, and the `.jsx` files are transpiled **in the
browser** at load time.

Consequences for every edit:
- **No `import`/`export` between source files.** Components are globals, shared via
  `Object.assign(window, {...})` at the bottom of each file.
- Hooks are accessed as `React.useState` etc. (often aliased near the top of a file).
  Never add a bare `import { useState } from 'react'`.
- **Script order in `index.html` matters.** A file can only use globals defined by a
  script loaded before it: styles → data → clusters → components → antechamber →
  views → discover-insights → the root app.
- Keep everything dependency-free. Do not introduce a bundler or a package.json build —
  it would change the whole deployment model.

## Key files

- `index.html` — shell, top-level state, the `window.claude.complete()` gateway (the
  ONLY way to call the model — never `fetch` the Anthropic API from a component).
- `src/db.js` — Supabase client (owner fills in URL + publishable key), auth, entries
  CRUD, offline write queue.
- `src/data.js` — categories, metadata field defs, helpers. `ENTRIES` stays `[]` in the
  repo: **real data lives only in the owner's browser and their Supabase.**
- `src/styles.css` — the entire design system as CSS custom properties.
- `api/claude.js` — the Vercel serverless proxy (adds the API key server-side).
- `supabase/schema.sql` — the whole backend: entries table, single-owner RLS, storage.

## Design system — treat as sacred

Editorial commonplace-book look: warm paper, vermilion rubric, variable serif
(Fraunces), monospace folios, hairline borders (0.5px), corners ≤2px.

1. **Never hard-code a hex colour in a component** — use a token from `styles.css`.
2. Mono for small labels, serif for display and body, sans only for functional chrome.
3. Respect both themes; verify colour changes in light *and* dark.
4. No emoji in the UI. No heavy borders or loud gradients. When unsure, err quieter.

## Landmines

- `EditModal` must stay `position: fixed` (with a long archive, `absolute` opens it
  off-screen).
- `mailto:` links use `window.location.href` — `window.open` is blocked in installed PWAs.
- Discover expects JSON back and parses it into cards; keep its prompt schema and the
  parser in sync.
- The service worker caches aggressively — bump the `CACHE` version in `sw.js` when
  shipping changes, and never cache an error response.
- localStorage has a ~5–10 MB ceiling: no images or large blobs in it, ever.
- **The repo must stay free of personal data.** `ENTRIES` stays `[]`; `.gitignore`
  blocks archive exports. Never commit a seed or backup file.

## Working style

- Plan first for anything non-trivial; make the smallest change that fully solves the
  problem; preserve the voice of the design; state trade-offs honestly.
