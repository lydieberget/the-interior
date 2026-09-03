# Architecture

*Deliberately unusual, deliberately small.*

## The browser is the compiler

There is no build step. `index.html` loads React, Babel and supabase-js from `vendor/` (pinned, self-hosted), and every `.jsx` file is transpiled **in the browser** at load time. No bundler, no `node_modules`, no framework churn: the repository *is* the application, and deploying is copying files.

Consequences:

- Source files share nothing through `import`/`export`. Each file defines globals and publishes them with `Object.assign(window, {...})`.
- Script order in `index.html` is the dependency graph: styles → data → postcard → clusters → components → antechamber → views → discover-insights → the root app.
- Hooks are `React.useState` and friends, aliased per file, so separate Babel blocks never collide.

## One function

`api/claude.js` is the only server code: a Vercel serverless function that forwards a request to the Anthropic Messages API, adding the key from an environment variable (and the web-search beta header when a search tool is present). The browser never sees the key. Every model call in the app goes through a single gateway, `window.claude.complete()`, defined in `index.html`.

## One table

`supabase/schema.sql` is the whole backend: an `entries` table with row-level security scoped to its single owner, an `updated_at` trigger, and a private storage bucket for photographs. The publishable key can live in the client because the database refuses to return rows to anyone but their owner.

## Offline first

`localStorage` is the instant-render cache; Supabase is the source of truth once signed in. Writes go to both; writes that cannot reach the cloud queue in `enth-pending-v1` and flush on reconnect. A service worker precaches the shell, so the installed app opens without a network — and never caches an error response (a lesson learned the hard way).

## The model calls

| Feature | Model | Notes |
|---|---|---|
| Insights essay | Fable | reads the whole archive |
| Discover letter | Sonnet + web search | trimmed taste profile, JSON out, parsed into cards |
| Companion sheet | Sonnet + web search | spoiler-free, grounded in the archive |
| Cluster scores | Sonnet | batches of 15 entries, cached until redrawn |
| Descriptions | Sonnet + web search | per entry, on demand |

Language rule: English by default; French only when the work itself is French.

## Data model

```js
{ id, n, title, category, date /* yyyy-mm-dd */, note,
  image /* cover URL or storage path */, verse /* poems */,
  metadata: { author?, venue?, album?, work?, year?, rating?, ... } }
```

`n` is the folio number. `category` is one of the ids in `src/data.js`.
