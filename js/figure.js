/* ==========================================================================
   FIGURE — a project photo as a small labelled diagram (dev mode for now).
   A dot-matrix photo, dotted leader lines to the parts that matter, an inset
   of what's on the screen, and a one-line caption. Wide: labels in a column to
   the right. Narrow: numbered markers with a legend underneath.
   Data: project.figure in js/data.js; dot grids in js/photos.js (tools/dotpic.py).
   ========================================================================== */
window.NK = window.NK || {};

NK.figure = (function () {
  "use strict";
  const FONT = '"JetBrains Mono", ui-monospace, monospace';
  const C = { text: "#C3D3D8", dim: "#6F8F97", line: "rgba(95,243,255,.55)", cyan: "#5FF3FF" };
  const accent = () => getComputedStyle(document.documentElement).getPropertyValue("--spice").trim() || "#FF3D8B";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function dotsOf(key) {
    const d = NK.photos && NK.photos[key];
    if (!d) return null;
    const px = atob(d.px), list = [];
    for (let i = 0; i < d.w * d.h; i++) {
      const r = px.charCodeAt(3 * i), g = px.charCodeAt(3 * i + 1), b = px.charCodeAt(3 * i + 2);
      if (r | g | b) list.push(i % d.w, (i / d.w) | 0, `rgb(${r},${g},${b})`, Math.random());
    }
    return { w: d.w, h: d.h, list };
  }
  function drawDots(g, D, x, y, w, rev) {
    const p = w / D.w, s = Math.max(1, p * 0.74), L = D.list;
    for (let q = 0; q < L.length; q += 4) { if (L[q + 3] > rev) continue; g.fillStyle = L[q + 2]; g.fillRect(x + L[q] * p, y + L[q + 1] * p, s, s); }
  }
  function dotted(g, pts) {
    g.strokeStyle = C.line; g.lineWidth = 1; g.setLineDash([1.5, 3.5]);
    g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.stroke();
    g.setLineDash([]);
  }
  function pin(g, x, y, n) {
    const a = accent();
    g.fillStyle = "rgba(4,6,10,.85)"; g.beginPath(); g.arc(x, y, n ? 8 : 4.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = a; g.beginPath(); g.arc(x, y, n ? 6.5 : 2.6, 0, Math.PI * 2); g.fill();
    if (n) { g.fillStyle = "#04060A"; g.font = `700 9px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(String(n), x, y + 0.5); g.textAlign = "left"; }
  }
  function wrap(g, text, maxW) {
    const words = text.split(" "), lines = []; let cur = "";
    for (const w of words) { const t = cur ? cur + " " + w : w; if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
    if (cur) lines.push(cur);
    return lines;
  }

  // Lay everything out at 1×; returns the size and a paint(g, rev) function.
  function plan(fig, maxW, g) {
    const P = dotsOf(fig.photo), I = fig.inset ? dotsOf(fig.inset.photo) : null;
    if (!P) return null;
    const wide = maxW >= 520, labels = fig.labels || [], LH = 15;
    g.font = `11px ${FONT}`;
    if (wide) {
      const W = Math.min(maxW, 640), col = 190, pw = W - col - 18, ph = pw * P.h / P.w, x0 = pw + 18;
      // labels, top-down in the right column, each at the height of its anchor (nudged apart)
      const items = labels.map(([t, u, v]) => ({ t, ax: u * pw, ay: v * ph, lines: wrap(g, t, col) })).sort((a, b) => a.ay - b.ay);
      let y = 6;
      for (const it of items) { it.y = Math.max(y, it.ay - (it.lines.length * LH) / 2 + 4); y = it.y + it.lines.length * LH + 12; }
      let iy = Math.max(y + 6, ph * 0.52), iw = col - 12, ih = I ? iw * I.h / I.w : 0;
      const H = Math.max(ph, I ? iy + 18 + ih : y) + 34;
      return {
        W, H,
        paint(g, rev) {
          drawDots(g, P, 0, 0, pw, rev);
          if (I) drawDots(g, I, x0, iy + 18, iw, rev);
          if (rev < 1) return;
          g.font = `11px ${FONT}`; g.textBaseline = "alphabetic";
          for (const it of items) {
            const ly = it.y + 10;
            dotted(g, [it.ax, it.ay, x0 - 10, ly - 4, x0 - 4, ly - 4]);
            pin(g, it.ax, it.ay);
            g.fillStyle = C.text; it.lines.forEach((l, k) => g.fillText(l, x0, ly + k * LH));
          }
          if (I) { g.fillStyle = C.dim; g.fillText(fig.inset.label, x0, iy + 10); g.strokeStyle = "rgba(143,169,176,.25)"; g.strokeRect(x0 - 4.5, iy + 13.5, iw + 9, ih + 9); }
          g.fillStyle = C.dim; g.fillText(fig.caption || "", 0, H - 8);
        }
      };
    }
    // narrow: numbered pins on the photo, legend below, inset under that
    const W = maxW, pw = W, ph = pw * P.h / P.w;
    const items = labels.map(([t, u, v], k) => ({ t, n: k + 1, ax: u * pw, ay: v * ph, lines: wrap(g, t, W - 24) }));
    let y = ph + 16;
    for (const it of items) { it.y = y; y += it.lines.length * LH + 6; }
    const iw = I ? Math.min(W, 300) : 0, ih = I ? iw * I.h / I.w : 0, iy = y + 8;
    const capLines = wrap(g, fig.caption || "", W);
    const H = (I ? iy + 18 + ih + 14 : y) + capLines.length * LH + 10;
    return {
      W, H,
      paint(g, rev) {
        drawDots(g, P, 0, 0, pw, rev);
        if (I) drawDots(g, I, 0, iy + 18, iw, rev);
        if (rev < 1) return;
        g.font = `11px ${FONT}`; g.textBaseline = "alphabetic";
        for (const it of items) {
          pin(g, it.ax, it.ay, it.n); pin(g, 8, it.y + 6, it.n);
          g.fillStyle = C.text; it.lines.forEach((l, k) => g.fillText(l, 24, it.y + 10 + k * LH));
        }
        if (I) { g.fillStyle = C.dim; g.fillText(fig.inset.label, 0, iy + 10); g.strokeStyle = "rgba(143,169,176,.25)"; g.strokeRect(-0.5, iy + 13.5, iw + 1, ih + 9); }
        g.fillStyle = C.dim; capLines.forEach((l, k) => g.fillText(l, 0, H - 8 - (capLines.length - 1 - k) * LH));
      }
    };
  }

  function render(cv, fig, maxW) {
    const g = cv.getContext("2d"), L = plan(fig, Math.floor(maxW), g);
    if (!L) return false;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.ceil(L.W * dpr); cv.height = Math.ceil(L.H * dpr);
    cv.style.width = L.W + "px"; cv.style.height = L.H + "px";
    cv.setAttribute("aria-label", [fig.caption, ...(fig.labels || []).map((l) => l[0]), fig.inset && fig.inset.label].filter(Boolean).join(". "));
    const t0 = performance.now();
    (function frame(now) {
      const rev = reduced ? 1 : Math.min(1, (now - t0) / 600);   // the dots light up in random order, then the labels appear
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, L.W, L.H);
      L.paint(g, rev);
      if (rev < 1) requestAnimationFrame(frame);
    })(t0);
    return true;
  }

  return { render };
})();
