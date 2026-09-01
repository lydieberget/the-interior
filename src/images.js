/* ── images.js — covers & photographs (#11, #9, #37) ─────────────
   Book covers found on Open Library by title + author; the cover
   URL is saved on the entry's `image` column so it syncs across
   devices. resizeImage() shrinks a chosen photograph before it is
   uploaded to the Supabase `images` bucket (see db.js).
   Plain script — no JSX, no imports. */

/* Search Open Library for the entry's cover. Returns a cover URL or null. */
async function findCover(entry) {
  const md = entry.metadata || {};
  const params = new URLSearchParams({
    title: (entry.title || '').trim(),
    limit: '5',
    fields: 'cover_i,title,author_name',
  });
  if (md.author) params.set('author', md.author.trim());
  const res = await fetch('https://openlibrary.org/search.json?' + params.toString());
  if (!res.ok) throw new Error('Open Library answered ' + res.status);
  const data = await res.json();
  const doc = (data.docs || []).find(d => d.cover_i);
  return doc ? 'https://covers.openlibrary.org/b/id/' + doc.cover_i + '-L.jpg' : null;
}

/* Sweep every cover-less book. Sequential with a polite pause; each find
   is handed to onFound(book, url) immediately, so progress survives an
   interruption (the found covers are already saved on their entries). */
async function backfillCovers(entries, opts = {}) {
  const onProgress = opts.onProgress || (() => {});
  const onFound = opts.onFound || (() => {});
  const todo = entries.filter(e => e.category === 'book' && !e.image);
  let done = 0, found = 0;
  onProgress({ done, found, total: todo.length });
  for (const book of todo) {
    try {
      const url = await findCover(book);
      if (url) { found++; onFound(book, url); }
    } catch (e) {
      throw new Error('Stopped after ' + done + ' of ' + todo.length
        + ' — covers already found are kept; run again to continue. (' + e.message + ')');
    }
    done++;
    onProgress({ done, found, total: todo.length });
    await new Promise(r => setTimeout(r, 600));
  }
  return { done, found, total: todo.length };
}

/* Shrink a chosen image file (#9): longest side ≤ maxDim, JPEG. Returns
   { blob, dataUrl } — the blob to upload, a small dataUrl to preview. */
function resizeImage(file, maxDim = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => {
        if (!blob) return reject(new Error('Could not read the image.'));
        resolve({ blob, dataUrl: canvas.toDataURL('image/jpeg', 0.6) });
      }, 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read the image.')); };
    img.src = url;
  });
}

Object.assign(window, { findCover, backfillCovers, resizeImage });
