<div align="center">

# The Interior

*A commonplace book that reads you back.*

</div>

- **What it is** — a private archive of everything that has moved you: books, concerts, paintings, plays, poems, ideas, quotes.
- **What it refuses** — no feed, no likes, no infinite scroll. The only algorithm is your own taste.
- **Who it's for** — one person at a time. Yours runs on your own database, under your own key.

## See it

<table align="center"><tr><td>
<video src="https://github.com/user-attachments/assets/295d1d85-d267-4ab9-9d0e-17ca5e493ead" controls></video>
</td></tr></table>

<p align="center"><sub><i>The guided tour — 3½ minutes, narrated · <a href="https://lydieberget.github.io/the-interior/docs/demo.mp4">full quality</a></i></sub></p>

<p align="center"><b><a href="https://lydieberget.github.io/the-interior/">Try the live demo →</a></b><br/><sub>A sample archive, already furnished. Nothing to install; nothing you do there is kept.</sub></p>

## Six rooms

<table>
<tr>
<td align="center"><img src="docs/shots/1-ledger.png" width="260" alt="The Ledger"/><br/><sub><b>The Ledger</b> — every entry, newest first, folio-numbered.</sub></td>
<td align="center"><img src="docs/shots/2-map.png" width="260" alt="The Map"/><br/><sub><b>The Map</b> — your taste drawn as provinces of an interior world.</sub></td>
<td align="center"><img src="docs/shots/3-insights.png" width="260" alt="Insights"/><br/><sub><b>Insights</b> — an essay about your own taste, written from the archive.</sub></td>
</tr>
<tr>
<td align="center"><img src="docs/shots/4-discover.png" width="260" alt="Discover"/><br/><sub><b>Discover</b> — real events, chosen from your archive. Every pick says why.</sub></td>
<td align="center"><img src="docs/shots/5-antechamber.png" width="260" alt="The Antechamber"/><br/><sub><b>The Antechamber</b> — the room for things not yet lived, with a companion for each.</sub></td>
<td align="center"><img src="docs/shots/6-postcard.png" width="260" alt="Postcards"/><br/><sub><b>Postcards</b> — send an entry, or an invitation, to a friend as a picture.</sub></td>
</tr>
</table>

## The life of one event

<p align="center"><b>◉ Discovered → ❧ Saved → ✶ In hand → ☞ Lived → ¶ Inscribed</b></p>

<p align="center"><i>What the archive found for you becomes the archive.</i></p>

## Why it's built this way

- **No build step** — the browser is the compiler; the repo *is* the app.
- **One serverless function** — the only server code, so the API key never reaches the client.
- **Your data, your database** — a single Supabase table with row-level security for one owner.
- **Offline first** — installs as an app, opens without a network, syncs when it can.

## Run your own

1. **Supabase** (free): create a project, run `supabase/schema.sql` in the SQL editor, put your project URL and publishable key in `src/db.js`.
2. **Vercel** (free): import the repo — framework *Other*, no build command, no output directory — and add `ANTHROPIC_API_KEY`.
3. Open the app: sign in with your email (a code arrives by return), or *keep to this device*.
4. Optional: import `docs/demo-entries.json` to see it furnished, then begin your own.

AI features bill per use to your Anthropic key — an essay or a letter costs a few cents.

## Design

Warm paper, a vermilion rubric, a variable serif, hairline borders. Nothing louder than the words.

<p align="center"><sub>
<a href="docs/PHILOSOPHY.md">Why it's built this way (the long version)</a> · <a href="docs/ARCHITECTURE.md">Architecture</a> · <a href="LICENSE">MIT</a><br/>
Video music: Chopin, Nocturne No. 20 — Frank Lévy for Musopen, public domain.
</sub></p>
