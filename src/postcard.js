/* ── postcard.js — send an entry or a want as a postcard ─────────
   Draws a 1080×1350 card on an offscreen canvas in the house style
   (paper, rubric, Fraunces, mono folios) and hands it to the phone's
   share sheet as a real image — so it lands in WhatsApp as a picture
   in the bubble, not a link. Falls back to downloading the PNG where
   file-sharing isn't available (desktop). Plain script — no JSX;
   exposes `window.sharePostcard` (and `drawPostcard` for reuse). */
(function () {
  const W = 1080, H = 1350;
  const C = {
    paper: '#f4ede0', ink: '#1a1612', inkSoft: '#6b5f52', inkFaint: '#a79786',
    line: '#d9ccb5', rubric: '#b83a28', gold: '#a78339',
  };

  const FONTS = [
    'italic 54px Fraunces', '480 88px Fraunces', '480 72px Fraunces', '480 60px Fraunces',
    'italic 38px Fraunces', 'italic 40px Fraunces', '400 120px Fraunces',
    '400 22px "JetBrains Mono"', '400 24px "JetBrains Mono"', '400 21px "JetBrains Mono"',
  ];
  async function fontsReady() {
    try { await Promise.all(FONTS.map(f => document.fonts.load(f, 'Ag№❧“'))); } catch {}
  }

  function wrap(ctx, text, maxWidth) {
    const words = String(text || '').replace(/\s+/g, ' ').trim().split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const probe = line ? line + ' ' + w : w;
      if (ctx.measureText(probe).width <= maxWidth || !line) line = probe;
      else { lines.push(line); line = w; }
    }
    if (line) lines.push(line);
    return lines;
  }

  function letterSpaced(ctx, on) {
    try { ctx.letterSpacing = on || '0px'; } catch {} // older Safari: quietly unspaced
  }

  function drawFrame(ctx) {
    // paper with two soft light pools, then the double hairline frame
    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, W, H);
    let g = ctx.createRadialGradient(W * 0.28, H * 0.16, 60, W * 0.28, H * 0.16, 760);
    g.addColorStop(0, 'rgba(255,252,245,0.55)'); g.addColorStop(1, 'rgba(255,252,245,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    g = ctx.createRadialGradient(W * 0.78, H * 0.88, 60, W * 0.78, H * 0.88, 720);
    g.addColorStop(0, 'rgba(190,170,140,0.16)'); g.addColorStop(1, 'rgba(190,170,140,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = C.line; ctx.lineWidth = 1.5;
    ctx.strokeRect(34, 34, W - 68, H - 68);
    ctx.strokeStyle = 'rgba(217,204,181,0.55)'; ctx.lineWidth = 1;
    ctx.strokeRect(44, 44, W - 88, H - 88);
  }

  /* kind: 'entry' | 'want'. `cat` is the resolved category object. */
  async function drawPostcard(kind, item, cat) {
    await fontsReady();
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const cx = W / 2;
    const paint = (y) => {
    drawFrame(ctx);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    // category mark
    ctx.fillStyle = C.rubric;
    ctx.font = 'italic 54px Fraunces';
    ctx.fillText((cat && cat.mark) || '❧', cx, y);

    // eyebrow
    y += 76;
    ctx.font = '400 22px "JetBrains Mono"';
    letterSpaced(ctx, '9px');
    ctx.fillText(
      (((cat && cat.label) || 'Entry') + ' · ' + (kind === 'want' ? 'An invitation' : 'An enthusiasm')).toUpperCase(),
      cx + 4.5, y); // +half-spacing keeps optically centered
    letterSpaced(ctx, null);

    // title — shrink until it fits in three lines
    y += 100;
    let titleLines, size = 88;
    for (const s of [88, 72, 60]) {
      size = s;
      ctx.font = '480 ' + s + 'px Fraunces';
      titleLines = wrap(ctx, item.title || 'Untitled', 840);
      if (titleLines.length <= (s === 60 ? 4 : 3)) break;
    }
    if (titleLines.length > 4) titleLines = titleLines.slice(0, 4);
    const titleLH = Math.round(size * 1.12);
    ctx.fillStyle = C.ink;
    for (const l of titleLines) { ctx.fillText(l, cx, y); y += titleLH; }
    y -= titleLH;

    // byline
    const md = item.metadata || {};
    const byline = kind === 'want'
      ? [item.artist, item.venue].filter(Boolean).join(' · ')
      : [md.author || md.venue, md.year || md.period].filter(Boolean).join(' · ');
    if (byline) {
      y += 72;
      ctx.fillStyle = C.inkSoft;
      ctx.font = 'italic 38px Fraunces';
      const bl = wrap(ctx, byline, 840).slice(0, 2);
      for (const l of bl) { ctx.fillText(l, cx, y); y += 50; }
      y -= 50;
    }

    // invitation date line
    if (kind === 'want' && item.date) {
      y += 62;
      ctx.fillStyle = C.rubric;
      ctx.font = '400 24px "JetBrains Mono"';
      letterSpaced(ctx, '3.5px');
      const status = item.bookingStatus === 'open' ? ' — tickets open'
        : item.bookingStatus === 'opens' && item.bookingOpens ? ' — ' + item.bookingOpens
        : item.bookingStatus === 'soldout' ? ' — sold out' : '';
      ctx.fillText((String(item.date) + status).toUpperCase(), cx + 1.75, y);
      letterSpaced(ctx, null);
    }

    // gold rule
    y += 66;
    ctx.strokeStyle = C.gold; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - 32, y); ctx.lineTo(cx + 32, y); ctx.stroke();

    // the heart: her note (or verse, or the invitation line)
    const quote = kind === 'want'
      ? 'This is waiting in my antechamber — the room for things not yet lived. Come with me?'
      : (item.note || item.verse || '').trim();
    if (quote) {
      y += 96;
      ctx.fillStyle = C.rubric; ctx.globalAlpha = 0.4;
      ctx.font = '400 120px Fraunces';
      ctx.fillText('“', cx, y);
      ctx.globalAlpha = 1;
      y += 48;
      ctx.fillStyle = C.ink;
      ctx.font = 'italic 40px Fraunces';
      let qLines;
      if (!item.note && item.verse && kind !== 'want') {
        qLines = item.verse.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 6);
        if (qLines.some(l => ctx.measureText(l).width > 800)) qLines = qLines.flatMap(l => wrap(ctx, l, 800));
      } else {
        qLines = wrap(ctx, quote, 800);
      }
      const maxQ = Math.max(2, Math.floor((1160 - y) / 62));
      if (qLines.length > maxQ) { qLines = qLines.slice(0, maxQ); qLines[maxQ - 1] += ' …'; }
      for (const l of qLines) { ctx.fillText(l, cx, y); y += 62; }
    }
    return y;
    };
    // two passes: measure the flow, then repaint vertically balanced in the frame
    const endY = paint(186);
    const slack = (H - 84 - 96) - endY;
    paint(186 + Math.max(0, Math.min(Math.round(slack / 2), 150)));

    // foot
    ctx.font = '400 21px "JetBrains Mono"';
    letterSpaced(ctx, '4.5px');
    const footY = H - 84;
    ctx.fillStyle = C.inkFaint; ctx.textAlign = 'left';
    const footLeft = kind === 'want'
      ? 'Kept, not scrolled'
      : ['№ ' + String(item.n || '—').padStart(3, '0'), item.date ? fmtDate(item.date) : '']
          .filter(Boolean).join(' · ');
    ctx.fillText(footLeft.toUpperCase(), 84, footY);
    ctx.fillStyle = C.rubric; ctx.textAlign = 'right';
    ctx.fillText('❧ THE INTERIOR', W - 84, footY);
    letterSpaced(ctx, null);
    return canvas;
  }

  async function sharePostcard(kind, item, cat) {
    try {
      const resolved = cat || (typeof getCat === 'function' ? getCat(item.category) : null);
      const canvas = await drawPostcard(kind, item, resolved);
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      const name = ((item.title || 'postcard').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'postcard') + '.png';
      const file = new File([blob], name, { type: 'image/png' });
      const text = (item.title || '') + ' — a postcard from The Interior';
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], text }); return; }
        catch (e) { if (e && e.name === 'AbortError') return; /* else fall through */ }
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 30000);
    } catch (e) {
      alert('Could not make the postcard: ' + e.message);
    }
  }

  Object.assign(window, { drawPostcard, sharePostcard });
})();
