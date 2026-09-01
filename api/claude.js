// Vercel serverless function — proxies Anthropic Messages API.
// Hobby (free) tier allows up to 300s with Fluid Compute. We use the full 300s:
// wide time windows (Next 6 months, Rest of the year) surface far more candidate
// events, so those runs need the headroom — at 180s they were hitting the cap
// and dropping the connection mid-request.
export const config = {
  maxDuration: 300,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set in Vercel env vars' });
  }

  // Detect web_search tool usage to attach the required beta header.
  let usesWebSearch = false;
  let wantsStream = false;
  try {
    const tools = req.body?.tools;
    usesWebSearch = Array.isArray(tools)
      && tools.some(t => (t.type || '').startsWith('web_search'));
    wantsStream = req.body?.stream === true;
  } catch {}

  try {
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    };
    if (usesWebSearch) headers['anthropic-beta'] = 'web-search-2025-03-05';

    const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    // Retry transient upstream errors (overload / 5xx) that arrive before any
    // stream starts. These come back fast (no web search ran yet), so a couple
    // of short retries cost little wall-clock time but rescue the "Internal
    // Server Error" blips that otherwise kill the whole Discover run.
    let r;
    for (let attempt = 1; attempt <= 3; attempt++) {
      r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers,
        body,
      });
      if (r.ok || (r.status !== 429 && r.status < 500)) break;
      if (attempt === 3) break;
      await new Promise(done => setTimeout(done, 600 * attempt));
    }

    // Streaming path: pipe Anthropic SSE through. Keeps the connection alive
    // with continuous events so mobile networks don't drop the request mid-flight.
    if (wantsStream) {
      const upstreamCT = r.headers.get('Content-Type') || '';

      // If Anthropic returned a non-stream (usually an error before streaming starts),
      // pass it through as plain JSON so the client falls back to the JSON parser.
      if (!upstreamCT.includes('text/event-stream')) {
        const text = await r.text();
        res.status(r.status);
        res.setHeader('Content-Type', upstreamCT || 'application/json');
        return res.send(text);
      }

      res.status(r.status);
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      // Vercel buffers Node responses by default; this disables it for streaming.
      res.setHeader('X-Accel-Buffering', 'no');
      if (typeof res.flushHeaders === 'function') res.flushHeaders();

      // Safety-net keepalive: if Anthropic goes quiet (e.g. during a web_search
      // tool call), emit a SSE comment every 5s so mobile NATs don't drop the
      // connection. SSE comments are ignored by the client parser.
      let lastWriteAt = Date.now();
      const keepalive = setInterval(() => {
        if (Date.now() - lastWriteAt > 4000) {
          try {
            res.write(': keepalive\n\n');
            lastWriteAt = Date.now();
          } catch {}
        }
      }, 5000);

      try {
        const reader = r.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
          lastWriteAt = Date.now();
        }
      } catch (streamErr) {
        try {
          res.write(`event: error\ndata: ${JSON.stringify({ message: String(streamErr) })}\n\n`);
        } catch {}
      } finally {
        clearInterval(keepalive);
      }
      return res.end();
    }

    // Non-streaming path (back-compat for cached old clients that don't request streaming).
    const text = await r.text();
    res.status(r.status);
    res.setHeader('Content-Type', 'application/json');
    return res.send(text);
  } catch (err) {
    if (!res.headersSent) {
      return res.status(500).json({ error: String(err) });
    }
    return res.end();
  }
}
