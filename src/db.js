/* ── db.js — the cloud ledger (Supabase, #8) ─────────────────────
   Once signed in, Supabase is the archive's source of truth.
   localStorage stays as the instant-render offline cache; every
   write goes to both. A write that cannot reach the cloud (offline,
   signed out) is queued in `enth-pending-v1` and flushed on the
   next sign-in / reconnect. Plain script — no JSX, no imports;
   exposes a single `window.db`. */
(function () {
  const SB_URL = 'https://YOUR-PROJECT.supabase.co'; // ← your Supabase project URL (see README, Run your own)
  const SB_KEY = 'sb_publishable_...'; // ← your publishable (anon) key — safe to commit; RLS guards the data
  const PENDING = 'enth-pending-v1';

  const lib = window.supabase; // UMD global from the CDN script; absent offline-first-load
  const configured = !SB_URL.includes('YOUR-PROJECT');
  const client = (lib && configured) ? lib.createClient(SB_URL, SB_KEY) : null;

  /* Columns that exist in the entries table. Anything else on the
     entry object travels in `extra` so no field is lost round-trip. */
  const COLS = ['id', 'n', 'title', 'category', 'date', 'note', 'image', 'favourite', 'metadata'];

  function toRow(e) {
    const row = { metadata: {}, extra: {} };
    Object.entries(e || {}).forEach(([k, v]) => {
      if (COLS.includes(k)) row[k] = v;
      else if (v !== undefined) row.extra[k] = v;
    });
    row.favourite = !!row.favourite;
    row.metadata = row.metadata || {};
    return row;
  }
  function fromRow(r) {
    const { extra, owner, created_at, updated_at, ...rest } = r;
    Object.keys(rest).forEach(k => { if (rest[k] === null) delete rest[k]; });
    return { ...(extra || {}), ...rest };
  }

  function loadPending() {
    try {
      const p = JSON.parse(localStorage.getItem(PENDING) || '{}');
      return { upserts: p.upserts || {}, deletes: p.deletes || {} };
    } catch { return { upserts: {}, deletes: {} }; }
  }
  function savePending(p) { localStorage.setItem(PENDING, JSON.stringify(p)); }

  const IMGK = 'enth-imgurls-v1'; // signed-URL cache for stored photographs
  function loadImgUrls() {
    try { return JSON.parse(localStorage.getItem(IMGK) || '{}') || {}; }
    catch { return {}; }
  }
  function saveImgUrls(c) { localStorage.setItem(IMGK, JSON.stringify(c)); }

  function queueUpsert(e) {
    const p = loadPending();
    p.upserts[e.id] = e;
    delete p.deletes[e.id];
    savePending(p);
  }
  function queueDelete(id) {
    const p = loadPending();
    p.deletes[id] = true;
    delete p.upserts[id];
    savePending(p);
  }

  window.db = {
    available: !!client,

    /* ── auth ── */
    async session() {
      if (!client) return null;
      const { data } = await client.auth.getSession();
      return data.session || null;
    },
    onAuth(cb) {
      if (!client) return () => {};
      const { data } = client.auth.onAuthStateChange((_ev, s) => cb(s || null));
      return () => data.subscription.unsubscribe();
    },
    async sendCode(email) {
      if (!client) throw new Error('Supabase is not configured — fill in SB_URL and SB_KEY in src/db.js (see README). The app still works in device-only mode.');
      const { error } = await client.auth.signInWithOtp({ email });
      if (error) throw new Error(error.message);
    },
    async verifyCode(email, token) {
      const { error } = await client.auth.verifyOtp({ email, token, type: 'email' });
      if (error) throw new Error(error.message);
    },
    async signOut() { if (client) await client.auth.signOut(); },

    /* ── entries ── */
    async fetchEntries() {
      const { data, error } = await client.from('entries').select('*')
        .order('date', { ascending: false, nullsFirst: false })
        .order('n', { ascending: false });
      if (error) throw new Error(error.message);
      return (data || []).map(fromRow);
    },

    queueUpsert,
    queueDelete,
    pendingCount() {
      const p = loadPending();
      return Object.keys(p.upserts).length + Object.keys(p.deletes).length;
    },

    /* Push now; on failure keep the write in the pending queue. */
    async pushEntry(e) {
      try {
        const { error } = await client.from('entries').upsert(toRow(e));
        if (error) throw new Error(error.message);
      } catch (err) { queueUpsert(e); throw err; }
    },
    async removeEntry(id) {
      try {
        const { error } = await client.from('entries').delete().eq('id', id);
        if (error) throw new Error(error.message);
      } catch (err) { queueDelete(id); throw err; }
    },

    /* Import semantics: the file replaces the archive — upsert every
       imported entry, delete cloud rows absent from the import. */
    async replaceAll(entries) {
      const { data, error } = await client.from('entries').select('id');
      if (error) throw new Error(error.message);
      const keep = new Set(entries.map(e => e.id));
      const gone = (data || []).map(r => r.id).filter(id => !keep.has(id));
      for (let i = 0; i < entries.length; i += 100) {
        const { error: e2 } = await client.from('entries')
          .upsert(entries.slice(i, i + 100).map(toRow));
        if (e2) throw new Error(e2.message);
      }
      if (gone.length) {
        const { error: e3 } = await client.from('entries').delete().in('id', gone);
        if (e3) throw new Error(e3.message);
      }
    },

    /* ── photographs (private `images` bucket, #37) ── */
    async uploadImage(entryId, blob) {
      const path = 'entries/' + entryId + '.jpg';
      const { error } = await client.storage.from('images')
        .upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
      if (error) throw new Error(error.message);
      // a replaced photograph needs a fresh signed URL to bust the browser cache
      const c = loadImgUrls(); delete c[path]; saveImgUrls(c);
      return path;
    },
    async removeImage(path) {
      try { await client.storage.from('images').remove([path]); } catch {}
      const c = loadImgUrls(); delete c[path]; saveImgUrls(c);
    },
    /* Signed URL for a storage path, cached ~10 months per device. */
    async imageUrl(path) {
      const c = loadImgUrls();
      const hit = c[path];
      if (hit && hit.exp > Date.now()) return hit.url;
      const { data, error } = await client.storage.from('images')
        .createSignedUrl(path, 60 * 60 * 24 * 330);
      if (error) throw new Error(error.message);
      c[path] = { url: data.signedUrl, exp: Date.now() + 60 * 60 * 24 * 300 * 1000 };
      saveImgUrls(c);
      return data.signedUrl;
    },

    async flushPending() {
      const p = loadPending();
      const ups = Object.values(p.upserts), dels = Object.keys(p.deletes);
      if (!ups.length && !dels.length) return 0;
      for (const e of ups) {
        const { error } = await client.from('entries').upsert(toRow(e));
        if (error) throw new Error(error.message);
        const q = loadPending();
        delete q.upserts[e.id];
        savePending(q);
      }
      if (dels.length) {
        const { error } = await client.from('entries').delete().in('id', dels);
        if (error) throw new Error(error.message);
        const q = loadPending();
        q.deletes = {};
        savePending(q);
      }
      return ups.length + dels.length;
    },
  };
})();
