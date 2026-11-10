/* ==========================================================================
   SKY — the dot-matrix universe: grid, fire, planets, pendulum, intro.
   One canvas, one rAF loop, throttled to 30fps when idle, stopped when
   paused/hidden. Everything is drawn as dots (batched rect paths).
   ========================================================================== */
window.NK = window.NK || {};

NK.sky = (function () {
  "use strict";
  const D = NK.data;
  const $ = (s) => document.querySelector(s);
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  const uni = $("#universe"), cv = $("#sky"), ctx = cv.getContext("2d", { alpha: false });
  const bobEl = $("#bob"), colonEl = $("#colon"), pivotEl = $("#pivot");

  const RGB = { cyan: [95, 243, 255], deep: [44, 138, 154], ice: [233, 251, 255], orange: [255, 138, 61], ember: [255, 178, 122] };
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  // The third colour ("spice") is for the interface only (cursor, hover, bullets, selection); the fire and the worlds stay orange and cyan.
  // Set NK.data.accent to "magenta", "lime" or "violet"; the CSS reads the choice from <html data-accent>.
  const ACCENTS = { magenta: [255, 61, 139], lime: [200, 255, 61], violet: [157, 107, 255] };
  document.documentElement.dataset.accent = ACCENTS[D.accent] ? D.accent : "magenta";
  RGB.spice = ACCENTS[document.documentElement.dataset.accent];

  // ---------- state ----------
  let W = 0, H = 0, dpr = 1, cell = 10, cols = 0, rows = 0, gx0 = 0, gy0 = 0;
  let heat = new Float32Array(0), heat2 = new Float32Array(0);
  let baseCache = null;
  let t = 0, last = 0, lastDraw = 0, raf = 0, running = false;
  let motion = true;               // user "Pause" toggles this
  let hidden = false;
  let mode = "boot";              // boot | intro | idle | game
  let fire = 0.7;                  // heat intensity of trails/bursts (spec "fire" tweak)
  const mobile = () => W <= 760;
  const tall = () => W <= 760 || vh > W * 1.1;
  const low = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.connection && navigator.connection.saveData);

  const pivot = { x: 200, y: 400 }, lamp = { x: 90, y: 50 };
  const pend = { L: 110, x: 0, y: 0, vx: 0, vy: 0, visible: false, scripted: true, grabbed: false, gx: 0, gy: 0, charge: 0, snapped: false };
  let planets = [];
  let hover = -1;                  // planet index under pointer/focus (drives cone + bat signal)
  let pinned = -1;                 // planet "cd"-ed into from terminal
  const rings = [], sparks = [], twinkles = [];
  // Intro styles. "carve" (default): the bob cuts each world out of the dot grid, the disc falls, and a thread from
  // the colon slings it to its slot. "classic": the earlier birth (a ring at the bob that wanders out), kept as a backup.
  // Chosen by NK.data.intro, or per replay with `replay classic` / `replay carve`.
  let introStyle = "carve";
  const cuts = [];                 // cut lines the bob leaves: { x, y, R, a0, a1, closed }
  const holes = [];                // where a disc was cut out of the grid: { x, y, R, t0, dur }
  const web = { pulse: -9 };       // one pulse runs out along the threads when the last world settles
  const fuse = { q: 0, a: 0 };     // the thread from the colon to the hub: q = how much is paid out (0–1), a = its visibility
  const ptr = { x: -999, y: -999, v: 0, on: false, last: 0 };   // mouse position: the grid glows under it
  const listeners = {};
  const emit = (e, d) => (listeners[e] || []).forEach((f) => f(d));

  // ---------- layout ----------
  // The colon in the text is the anchor (where the spark starts). The pendulum hangs from the hub: the centre of the
  // worlds' area on wide screens, the centre line under the hero on tall ones. `pivot` is the hub.
  const anchor = { x: 200, y: 400 };
  let vh = 800;                                 // viewport height (the universe can be taller than it on short phones)
  // wide: worlds in a ring round the hub — [angle from straight up (deg, clockwise), distance (0–1 of the room), size]
  // the sector below the hub stays free for the pendulum
  const RING_STILL = [[-58, 0.92, 1.0], [65, 0.9, 0.76], [128, 0.9, 0.8], [-125, 0.9, 0.8], [5, 0.94, 0.62]];   // short windows: no orbit, sector below the hub kept free
  // The orbit: uneven spacing (never a neat pentagon), each world on its own distance.
  const RING = [[-52, 0.96, 1.0], [28, 0.86, 0.72], [95, 0.98, 0.8], [161, 0.88, 0.76], [228, 0.97, 0.62]];
  const orbit = { a: 0, v: 0 };                 // a = how far the system has turned (deg); v = 0–1, eases to 0 when it should hold still
  const orbiting = () => !tall() && H >= 560;
  let stageC = null;                            // the stage, cached by measure() so the frame loop never reads layout
  // Where world i is right now: its place on the orbit, a little wander of its own, slightly bigger and brighter at the front.
  function orbitPos(i, s) {
    const g = RING[i % RING.length], hw = (s.x1 - s.x0) / 2, hh = (s.y1 - s.y0) / 2;
    const R0 = Math.max(44, Math.min(hw * 0.27, hh * 0.3, 104) * g[2]), ph = i * 2.4;
    const a = (g[0] - orbit.a) * Math.PI / 180 + 0.085 * Math.sin(t * 0.21 + ph);          // ± 5° ahead and behind
    const d = g[1] * (1 + 0.03 * Math.sin(t * 0.33 + ph * 1.7));                            // a little in and out
    const z = -Math.cos(a);                                                                 // +1 at the front (bottom), −1 at the back (top)
    let x = s.hx + Math.sin(a) * d * (hw - R0 * 1.06 - 6), y = s.hy - Math.cos(a) * d * (hh - R0 * 1.06 - 6);
    if (ptr.v > 0.01) { const k = (0.6 + 0.4 * z) * ptr.v; x += clamp((s.hx - ptr.x) * 0.012, -5, 5) * k; y += clamp((s.hy - ptr.y) * 0.012, -5, 5) * k; }   // parallax against the mouse
    return { x, y, R: R0 * (1 + 0.06 * z), z };
  }
  function stage() {
    const hero = $(".hero").getBoundingClientRect(), u = uni.getBoundingClientRect();
    if (!tall()) {
      const x0 = Math.max(W * 0.54, hero.right - u.left + 40), x1 = W - Math.max(40, W * 0.045);
      let y0 = 96, y1 = H - 64;
      if (H < 560) { y0 = 60; y1 = H - 14; }
      return { x0, x1, y0, y1, hx: (x0 + x1) / 2, hy: y0 + (y1 - y0) * (H < 560 ? 0.44 : 0.5) };
    }
    const x0 = mobile() ? 16 : W * 0.12, y0 = hero.bottom - u.top + (mobile() ? 26 : 44);
    return { x0, x1: W - x0, y0, y1: H, hx: W / 2, hy: y0 };
  }
  function measure() {
    const u = uni.getBoundingClientRect();
    const r = pivotEl.getBoundingClientRect();
    if (r.width) { anchor.x = r.left - u.left + r.width / 2; anchor.y = r.top - u.top + r.height / 2; }
    const li = document.querySelector(".logo-lamp") || document.querySelector(".logo-i");   // the dot of the i is the lamp
    if (li) { const lr = li.getBoundingClientRect(); lamp.x = lr.left - u.left + lr.width / 2; lamp.y = lr.top - u.top + lr.height / 2; }
    pend.L = mobile() ? clamp(vh * 0.05, 32, 42) : tall() ? 60 : clamp(H * 0.1, 56, 90);
    const s = stageC = stage(); pivot.x = s.hx; pivot.y = s.hy;
    return u;
  }

  const CAP = 40;                               // tall layouts: room under each circle for its name
  function slotFor(i) {
    const s = stage();
    if (orbiting()) return orbitPos(i, s);
    if (!tall()) {
      const hw = (s.x1 - s.x0) / 2, up = s.hy - s.y0, dn = s.y1 - s.hy;
      const base = Math.min(hw * 0.3, (s.y1 - s.y0) * 0.17, 112), g = RING_STILL[i % RING_STILL.length];
      const R = Math.max(H < 560 ? 36 : 46, base * g[2]), a = g[0] * Math.PI / 180, cx = Math.sin(a), cy = -Math.cos(a);
      return { x: s.hx + cx * g[1] * (hw - R), y: s.hy + cy * g[1] * ((cy < 0 ? up : dn) - R), R };
    }
    // tall: a honeycomb under the pendulum (3 + 2 for five worlds), symmetric about the centre line
    const n = planets.length || D.worlds.length, top = Math.ceil(n / 2), gap = mobile() ? 14 : 30;
    const R = Math.min((s.x1 - s.x0 - (top - 1) * gap) / (2 * top), mobile() ? 46 : 78);
    const row = i < top ? 0 : 1, cnt = row ? n - top : top, k = row ? i - top : i;
    return { x: s.hx + (k - (cnt - 1) / 2) * (2 * R + gap), y: s.hy + pend.L + 30 + R + row * (2 * R + CAP + 6), R };
  }

  // Precompute dot positions of a planet disc (relative, unit radius) + glyph cut-out mask.
  function planetDots(p) {
    const R = p.R, st = R > 70 ? 7 : 6, out = [], sig = [];
    const m = document.createElement("canvas"), n = Math.ceil(R * 2);
    m.width = m.height = n;
    const mc = m.getContext("2d");
    mc.fillStyle = "#fff"; mc.textAlign = "center"; mc.textBaseline = "middle";
    const g = p.w.glyph, fs = R * (g.length > 2 ? 0.62 : g.length > 1 ? 0.8 : 1.05);
    mc.font = `800 ${fs}px "JetBrains Mono", ui-monospace, Menlo, monospace`;
    mc.fillText(g, R, R * 1.04);
    const md = mc.getImageData(0, 0, n, n).data;
    const inGlyph = (x, y) => { const px = clamp(Math.round(x + R), 0, n - 1), py = clamp(Math.round(y + R), 0, n - 1); return md[(py * n + px) * 4 + 3] > 90; };
    for (let y = -R; y <= R; y += st) for (let x = -R; x <= R; x += st) {
      const d = Math.hypot(x, y) / R; if (d > 1) continue;
      const rim = clamp((d - 0.45) / 0.5, 0, 1);
      const hl = Math.max(0, 1 - Math.hypot(x + 0.35 * R, y + 0.4 * R) / (0.34 * R)) * 0.8;
      const wt = Math.min(1, rim * rim + hl);
      if (wt > 0.05) out.push(x / R, y / R, wt, Math.random() * 6.28);
    }
    // bat-signal disc: finer grid, glyph cut out dark
    for (let y = -R * 0.9; y <= R * 0.9; y += 5) for (let x = -R * 0.9; x <= R * 0.9; x += 5) {
      const d = Math.hypot(x, y) / R; if (d > 0.9) continue;
      if (!inGlyph(x, y)) sig.push(x / R, y / R, d);
    }
    p.dots = out; p.sig = sig; p.dotR = R;
  }

  function buildPlanets() {
    const ul = $("#worlds");
    ul.innerHTML = "";
    planets = D.worlds.map((w, i) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.className = "planet" + (w.color === "orange" ? " hot" : "");
      const n = w.projects.length;
      b.setAttribute("aria-label", `${w.name} — ${n} project${n === 1 ? "" : "s"}. ${w.tagline}`);
      b.innerHTML = `<span class="ring" aria-hidden="true"></span><span class="gl" aria-hidden="true">${w.glyph.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</span><span class="lbl" aria-hidden="true"><span class="cnt">${String(n).padStart(2, "0")} ${n === 1 ? "project" : "projects"}</span><span class="name">${w.name.replace(" & ", " &amp; ")}</span></span>`;
      li.appendChild(b); ul.appendChild(li);
      const p = { w, i, el: b, x: 0, y: 0, R: 60, sx: 0, sy: 0, sR: 60, tx: null, ty: null, tR: null, scale: 0, born: false, lit: 0, gone: false, fly: null, dots: [], phase: i * 1.7 };
      b.addEventListener("pointerenter", () => setHover(i));
      b.addEventListener("pointerleave", () => setHover(-1));
      b.addEventListener("focus", () => setHover(i));
      b.addEventListener("blur", () => setHover(-1));
      b.addEventListener("click", () => emit("open", w));
      return p;
    });
  }

  function layout() {
    vh = window.innerHeight;
    let r = uni.getBoundingClientRect();
    W = Math.round(r.width); H = Math.round(r.height);
    fitUniverse();
    r = uni.getBoundingClientRect(); H = Math.round(r.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cell = mobile() ? 11 : low ? 12 : 10;
    cols = Math.ceil(W / cell) + 1; rows = Math.ceil(H / cell) + 1;
    gx0 = ((W % cell) / 2) | 0; gy0 = ((H % cell) / 2) | 0;
    heat = new Float32Array(cols * rows); heat2 = new Float32Array(cols * rows);
    measure();
    light = new Float32Array(cols * rows);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) light[j * cols + i] = 0.3 + 1.5 * Math.exp(-Math.hypot(gx0 + i * cell - lamp.x, gy0 + j * cell - lamp.y) / 460);
    planets.forEach((p, i) => {
      const s = slotFor(i);
      p.sx = s.x; p.sy = s.y; p.sR = s.R;
      if (!p.fly) { p.x = s.x; p.y = s.y; }
      p.R = s.R; planetDots(p);
      p.el.style.width = p.el.style.height = s.R * 2 + "px";
    });
    if (!pend.grabbed && !pend.scripted) { pend.x = pivot.x; pend.y = pivot.y + pend.L; }
    buildBase();
    kick();
  }

  // Tall screens: the first "screen" is as tall as the hero plus the worlds, so nothing ever sits on top of a world;
  // short phones scroll instead of squeezing. Also tells the log where to start (just under the lowest world).
  const screenEl = document.querySelector(".screen");
  function fitUniverse() {
    if (!tall() || document.documentElement.classList.contains("gaming")) { uni.style.height = ""; if (screenEl) screenEl.style.minHeight = ""; return; }
    measure();
    let bottom = 0;
    for (let i = 0; i < planets.length; i++) { const s = slotFor(i); bottom = Math.max(bottom, s.y + s.R + CAP); }
    bottom = Math.ceil(bottom + 14);
    uni.style.height = bottom > vh ? bottom + "px" : "";
    if (screenEl) { const u = uni.getBoundingClientRect(), sr = screenEl.getBoundingClientRect(); screenEl.style.minHeight = Math.max(0, bottom - (sr.top - u.top)) + "px"; }
  }

  // Static dim grid drawn once → cheap per-frame blit.
  function buildBase() {
    baseCache = document.createElement("canvas");
    baseCache.width = cv.width; baseCache.height = cv.height;
    const b = baseCache.getContext("2d");
    b.setTransform(dpr, 0, 0, dpr, 0, 0);
    b.fillStyle = "#04060A"; b.fillRect(0, 0, W, H);
    b.fillStyle = rgba(RGB.deep, 0.09);
    b.beginPath();
    const s = 1.15;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) b.rect(gx0 + i * cell - s / 2, gy0 + j * cell - s / 2, s, s);
    b.fill();
  }

  // ---------- hover / cone ----------
  function setHover(i) {
    if (mode === "game") return;
    hover = i;
    emit("hover", i >= 0 ? planets[i].w : null);
    kick();
  }

  // ---------- effects ----------
  function addHeat(x, y, amt, rad) {
    const ci = Math.round((x - gx0) / cell), cj = Math.round((y - gy0) / cell), r = rad || 1;
    for (let j = cj - r; j <= cj + r; j++) for (let i = ci - r; i <= ci + r; i++) {
      if (i < 1 || j < 1 || i >= cols - 1 || j >= rows - 1) continue;
      const k = j * cols + i;
      heat[k] = Math.min(1.2, heat[k] + amt * (1 - (Math.abs(i - ci) + Math.abs(j - cj)) / (2 * r + 1)));
    }
    heatAny = true;
  }
  function ring(x, y, speed, width, amp, life, ignite, lag) { rings.push({ x, y, t0: t, speed, width, amp, life, ignite: !!ignite, lag: lag || 0 }); kick(); }
  function spark(x, y, n, spd, col, flint) {
    for (let k = 0; k < n; k++) {
      const a = flint ? -Math.PI / 2 + (Math.random() - 0.5) * 2.6 : Math.random() * TAU, v = spd * (0.4 + Math.random() * 0.9);
      sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: flint ? 0.3 + Math.random() * 0.3 : 0.8, flint: !!flint, col: col || RGB.ember });
    }
    if (sparks.length > 400) sparks.splice(0, sparks.length - 400);
    kick();
  }
  function burst(i) {
    const p = planets[i];
    if (!p || p.gone) return;
    p.gone = true; p.el.classList.add("gone");
    p.burst = { t0: t, x: p.x, y: p.y + (p.dy || 0), R: p.R * p.scale };
    kick();
  }
  // Clicking a world: an ember runs from the flame to it, then it bursts. Quick, so navigation never waits on it.
  const darts = [];
  function ignite(i) {
    const p = planets[i];
    if (!p || p.gone) return;
    if (!pend.visible || mode !== "idle" || matchMedia("(prefers-reduced-motion: reduce)").matches) return burst(i);
    darts.push({ i, t0: t, dur: 0.2 }); kick();
  }
  function drawDarts() {
    for (const d of darts) {
      const p = planets[d.i], q = clamp((t - d.t0) / d.dur, 0, 1), e = q * q;
      const tx = p.x, ty = p.y + (p.dy || 0);
      for (let k = 0; k < 6; k++) {
        const u = Math.max(0, e - k * 0.045), x = lerp(pend.x, tx, u), y = lerp(pend.y, ty, u), s = 4.2 - k * 0.5;
        ctx.fillStyle = k === 0 ? rgba(RGB.ember, 1) : rgba(RGB.orange, 0.8 - k * 0.12);
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
        if (k === 0) addHeat(x, y, 0.5 * Math.max(fire, 0.5), 0);
      }
    }
  }
  function burstPt(p, q, u) {
    const b = p.burst, d = p.dots, eo = 1 - Math.pow(1 - u, 3), ph = d[q + 3];
    const sp = 1 + 2.4 * eo * (0.6 + 0.4 * Math.sin(ph * 3));
    return [b.x + d[q] * b.R * sp + Math.sin(ph + u * 4) * 10 * u, b.y + d[q + 1] * b.R * sp - 80 * u * u];
  }
  function regrow(i) {
    const list = i == null ? planets : [planets[i]];
    list.forEach((p) => { if (p && p.gone) { p.gone = false; p.burst = null; p.el.classList.remove("gone"); p.scale = 0.4; } });
    kick();
  }

  // ---------- pendulum (2-D point on an elastic string: swings, loops, snaps) ----------
  function pendStep(dt) {
    if (pend.scripted || pend.grabbed) return;
    const g = pend.L * 8.2;                       // ≈2.2 s period
    const n = 4, h = dt / n;
    for (let s = 0; s < n; s++) {
      let dx = pend.x - pivot.x, dy = pend.y - pivot.y;
      let d = Math.hypot(dx, dy) || 1;
      let ax = 0, ay = g;
      if (d > pend.L) { const k = 520, f = k * (d - pend.L); ax -= (dx / d) * f; ay -= (dy / d) * f; }
      // radial damping (kills bounce) + gentle tangential drive/damp toward a calm idle amplitude
      const ux = dx / d, uy = dy / d;
      const vr = pend.vx * ux + pend.vy * uy;
      ax -= ux * vr * 6; ay -= uy * vr * 6;
      const vt = -pend.vx * uy + pend.vy * ux;
      const th = Math.atan2(dx, dy);
      const E = 0.5 * (vt / pend.L) ** 2 + 8.2 * (1 - Math.cos(th));
      const E0 = motion && mode !== "game" ? 8.2 * (1 - Math.cos(0.2)) : 0;
      const c = clamp(0.9 * (E - E0) / Math.max(E0, 0.02), -0.25, 1.4);
      ax -= -uy * vt * c; ay -= ux * vt * c;
      pend.vx += ax * h; pend.vy += ay * h;
      pend.x += pend.vx * h; pend.y += pend.vy * h;
    }
    const sp = Math.hypot(pend.vx, pend.vy);
    if (sp > 520 && fire > 0) addHeat(pend.x, pend.y, Math.min(0.35, sp / 5000) * fire, 0);
  }

  // Shake / yank detection (pointer and keyboard). The pendulum is how the game is found.
  const shake = { lastSign: 0, acc: 0, rev: [] };
  function feedShake(dx) {
    const now = performance.now();
    shake.acc += dx;
    if (Math.abs(shake.acc) > 14) {
      const sgn = Math.sign(shake.acc);
      if (shake.lastSign && sgn !== shake.lastSign) shake.rev.push(now);
      shake.lastSign = sgn; shake.acc = 0;
    }
    shake.rev = shake.rev.filter((x) => now - x < 1500);
    const n = shake.rev.length;
    pend.charge = clamp(n / 6, 0, 1);
    if (n >= 3) emit("charge", pend.charge);
    if (n >= 6) { shake.rev = []; snap("shake"); }
  }
  function snap(how) {
    if (mode !== "idle") return;
    pend.charge = 0; pend.grabbed = false; pend.snapped = true;
    uni.classList.remove("grabbing");
    spark(pend.x, pend.y, 30, 220, RGB.orange);
    ring(pend.x, pend.y, 420, 16, 0.5, 0.9);
    emit("snap", how);
  }

  function bindBob() {
    let lastX = 0, lastY = 0, lastT = 0;
    bobEl.addEventListener("pointerdown", (e) => {
      if (mode !== "idle") return;
      e.preventDefault();
      bobEl.setPointerCapture(e.pointerId);
      pend.grabbed = true; uni.classList.add("grabbing");
      shake.rev = []; shake.acc = 0; shake.lastSign = 0;
      lastX = e.clientX; lastY = e.clientY; lastT = performance.now();
      emit("grab", true); kick();
    });
    bobEl.addEventListener("pointermove", (e) => {
      if (!pend.grabbed) return;
      const u = uni.getBoundingClientRect();
      const now = performance.now(), dtm = Math.max(8, now - lastT);
      let x = e.clientX - u.left, y = e.clientY - u.top;
      const dx = x - pivot.x, dy = y - pivot.y, d = Math.hypot(dx, dy);
      if (d > pend.L * 3.4) { snap("yank"); return; }  // pulled too far → the string snaps
      pend.vx = ((e.clientX - lastX) / dtm) * 1000; pend.vy = ((e.clientY - lastY) / dtm) * 1000;
      feedShake(e.clientX - lastX);
      pend.x = x; pend.y = y;
      lastX = e.clientX; lastY = e.clientY; lastT = now;
      const sp = Math.hypot(pend.vx, pend.vy);
      if (sp > 700) addHeat(x, y, Math.min(0.4, sp / 4000) * Math.max(fire, 0.4), 0);
      kick();
    });
    const up = () => { if (!pend.grabbed) return; pend.grabbed = false; uni.classList.remove("grabbing"); pend.charge = 0; emit("grab", false); kick(); };
    bobEl.addEventListener("pointerup", up);
    bobEl.addEventListener("pointercancel", up);
    bobEl.addEventListener("lostpointercapture", up);
    bobEl.addEventListener("keydown", (e) => {
      if (mode !== "idle") return;
      const dir = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
      if (dir) {
        e.preventDefault();
        pend.vx += dir * pend.L * 2.6;
        feedShake(dir * 40);
        kick();
      }
    });
  }

  // ---------- intro ----------
  const typedEls = () => [$("#ty-cmd"), $("#ty-0"), $("#ty-1"), $("#ty-2")];
  const caret = $("#caret");
  let intro = null;

  function placeCaret(el) {
    const u = caret.parentElement.getBoundingClientRect();
    let x, y, h;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    const tn = el.firstChild;
    if (tn && tn.length) {
      const r = document.createRange(); r.setStart(tn, tn.length); r.setEnd(tn, tn.length);
      const rr = r.getClientRects(); const b = rr[rr.length - 1] || r.getBoundingClientRect();
      x = b.right; y = b.top + b.height / 2;
    } else { const b = el.getBoundingClientRect(); x = b.left; y = b.top + b.height / 2; }
    h = fs * 0.82;
    caret.style.height = h + "px"; const cp = Math.max(4.5, fs * 0.058), cd = Math.max(3, cp * 0.62);   // a thin column of dots at the dot-matrix pitch (two columns beside the big headline)
    caret.style.setProperty("--cp", cp.toFixed(2) + "px"); caret.style.setProperty("--cd", cd.toFixed(2) + "px");
    caret.style.width = (fs > 28 ? cp + cd : cd).toFixed(2) + "px";
    caret.style.transform = `translate(${x - u.left + 3}px, ${y - u.top - h / 2}px)`;
  }

  function script() {
    const P = D.person, els = typedEls();
    const segs = [[els[0], "./hello", 34, 52], [els[1], P.intro[0], 42, 68], [els[2], P.intro[1], 42, 68], [els[3], P.sparkLine, 26, 42]];
    const steps = []; let at = 300, igniteAt = 0;
    const cue = Math.max(1, P.sparkLine.indexOf("swing"));      // sparks start as "swing…" is typed
    segs.forEach(([el, txt, a, b], si) => {
      for (let k = 1; k <= txt.length; k++) {
        const ch = txt[k - 1];
        at += a + Math.random() * (b - a) + (ch === "," ? 180 : ch === " " ? 14 : 0);
        steps.push([at, el, txt.slice(0, k)]);
        if (si === 3 && k === cue) igniteAt = at;
      }
      at += si === 0 ? 300 : 220;
    });
    return { steps, typedEnd: at, igniteAt };
  }

  function startIntro(style) {
    introStyle = style === "classic" || style === "carve" ? style : D.intro === "classic" ? "classic" : "carve";
    mode = "intro";
    document.body.classList.add("intro"); document.body.classList.remove("bio-on");
    if (slide) { slide.up.concat(slide.down).forEach((el) => el && (el.style.transform = "")); slide = null; }
    const s = script();
    intro = { t0: performance.now(), i: 0, ...s, colonAt: s.typedEnd + 80, bangAt: s.typedEnd + 520 };
    intro.leapAt = intro.bangAt + 80; intro.leapDur = 560;      // the spark swings from the colon over to the hub
    intro.dropAt = intro.leapAt + intro.leapDur; intro.loopAt = intro.dropAt + 380; intro.loopDur = 720; intro.spin = 620;
    intro.endAt = intro.loopAt + intro.loopDur * planets.length + FORM * 1000;
    if (introStyle === "carve") planCarve();
    cuts.length = 0; holes.length = 0; web.pulse = -9; pend.spinning = false; pend.leaping = false; fuse.q = 0;
    typedEls().forEach((e) => (e.textContent = ""));
    colonEl.classList.remove("on", "swinging");
    planets.forEach((p) => { p.born = false; p.scale = 0; p.fly = null; p.gone = false; p.thr = 0; p.hot = 0; p.form = 1; p.el.classList.remove("born", "gone"); });
    pend.visible = false; pend.scripted = true; bobEl.classList.remove("on");
    caret.classList.add("on"); caret.classList.remove("idle");
    heat.fill(0); rings.length = 0; sparks.length = 0;
    placeCaret(typedEls()[0]);
    kick();
  }

  function introTick(now) {
    const e = now - intro.t0;
    let changed = null;
    while (intro.i < intro.steps.length && intro.steps[intro.i][0] <= e) {
      const [, el, txt] = intro.steps[intro.i++]; el.textContent = txt; changed = el;
    }
    if (changed) placeCaret(changed);
    if (e >= intro.colonAt && !colonEl.classList.contains("on")) {
      colonEl.classList.add("on"); measure();
      caret.classList.add("idle");
    }
    if (e >= intro.igniteAt && e < intro.bangAt) {
      // flint sparks fly off the typing caret, more and more often, until the colon ignites
      const k = (e - intro.igniteAt) / (intro.bangAt - intro.igniteAt);
      intro.flint = (intro.flint || 0) - 16;
      if (intro.flint <= 0) {
        intro.flint = 320 - 200 * k + Math.random() * 120;
        const u = uni.getBoundingClientRect(), c = caret.getBoundingClientRect();
        spark(c.left - u.left + 2, c.top - u.top + c.height * 0.4, 2 + ((Math.random() * (2 + k * 4)) | 0), 50 + k * 110, RGB.ember, true);
      }
    }
    if (e >= intro.bangAt && !intro.banged) {
      intro.banged = true; caret.classList.remove("on", "idle");   // "idle" too: its blink kept the caret showing over the colon
      document.body.classList.remove("intro");            // chrome becomes usable while the worlds are born
      ring(anchor.x, anchor.y, 900, 12, 0.9, 1.4, true);
      ring(anchor.x, anchor.y, 900, 16, 0.4, 1.4, false, 70);
      spark(anchor.x, anchor.y, 16, 180, RGB.ember, true);
      colonEl.classList.add("swinging");
      pend.visible = true; pend.leaping = true; pend.x = anchor.x; pend.y = anchor.y;
    }
    if (e >= intro.leapAt && e < intro.dropAt) {            // the colon's lower dot swings across, paying out a thread
      fuse.q = easeIO((e - intro.leapAt) / intro.leapDur);
      const [x, y] = fusePt(fuse.q);
      pend.x = x; pend.y = y;
    }
    if (e >= intro.dropAt && !intro.landed) {               // it lands at the hub
      intro.landed = true; pend.leaping = false; fuse.q = 1;
      ring(pivot.x, pivot.y, 700, 12, 0.55, 1.1, true);
      spark(pivot.x, pivot.y, 14, 160, RGB.ember);
    }
    if (e >= intro.dropAt && e < intro.loopAt) {
      const k = easeOut((e - intro.dropAt) / (intro.loopAt - intro.dropAt));
      pend.x = pivot.x; pend.y = pivot.y + lerp(0, pend.L, k);
    }
    if (e >= intro.loopAt && introStyle === "carve") carveTick(e);
    else if (e >= intro.loopAt) {                         // classic: five equal loops, a ring born at the bob after each
      const le = e - intro.loopAt, li = Math.floor(le / intro.loopDur), u = le - li * intro.loopDur;
      if (li < planets.length) {
        const th = u < intro.spin ? TAU * easeIO(u / intro.spin) : 0.1 * Math.exp(-(u - intro.spin) / 200) * Math.sin((u - intro.spin) / 100);
        pend.th = u < intro.spin ? th : 0; pend.spinning = u < intro.spin;
        pend.x = pivot.x + Math.sin(th) * pend.L; pend.y = pivot.y + Math.cos(th) * pend.L;
        const p = planets[li];
        if (!p.born && u >= intro.spin) birth(p);
      } else if (pend.scripted) {
        pend.spinning = false;
        pend.scripted = false; pend.x = pivot.x; pend.y = pivot.y + pend.L; pend.vx = pend.L * 1.4; pend.vy = 0;
      }
    }
    if (e >= intro.endAt) finishIntro(false);
  }

  // The thread from the colon to the hub hangs in a shallow curve; the spark travels along it.
  function fusePt(q) {
    const dx = pivot.x - anchor.x, dy = pivot.y - anchor.y, sag = Math.min(90, Math.hypot(dx, dy) * 0.14);
    const cx = anchor.x + dx / 2, cy = anchor.y + dy / 2 + sag * 2, k = 1 - q;
    return [k * k * anchor.x + 2 * k * q * cx + q * q * pivot.x, k * k * anchor.y + 2 * k * q * cy + q * q * pivot.y];
  }
  function drawFuse() {
    if (fuse.a < 0.02 || fuse.q < 0.01) return;
    const n = Math.max(2, (Math.hypot(pivot.x - anchor.x, pivot.y - anchor.y) / 9) | 0), live = pend.leaping;
    for (let k = 1; k <= n; k++) {
      const q = k / n; if (q > fuse.q) break;
      const [x, y] = fusePt(q), head = live ? Math.max(0, 1 - (fuse.q - q) / 0.12) : 0;
      ctx.fillStyle = head > 0.05 ? rgba(RGB.ember, fuse.a * (0.5 + 0.5 * head)) : rgba(live ? RGB.cyan : RGB.deep, fuse.a * (live ? 0.55 : 0.34));
      const s = 1.4 + head * 1.4; ctx.fillRect(x - s / 2, y - s / 2, s, s);
    }
  }

  // ----- carve intro -----
  // One segment per world: reel the string to that loop's radius (the wind-up), then one full loop around the colon.
  // A shorter string spins faster, so the loops quicken as they shrink ("down"), or slow as they grow ("up").
  function planCarve() {
    const n = planets.length;
    let order = planets.map((p, i) => i), radii;
    if (!tall()) order.sort((a, b) => RING[b % RING.length][2] - RING[a % RING.length][2]);     // biggest world first
    const PAT = [1, 0.82, 0.66, 0.52, 0.4];                   // clearly different sizes, so the cut rings read as concentric circles
    radii = order.map((i, k) => PAT[Math.min(k, PAT.length - 1)]);
    if (D.introOrder === "up") { radii.reverse(); if (!tall()) order.reverse(); }
    let at = intro.loopAt;
    intro.segs = order.map((pi, k) => {
      const wind = k ? 90 : 180, spin = (k ? 1 : 1.25) * 520 * (0.5 + 0.5 * radii[k]);
      const s = { pi, k: radii[k], t0: at, wind, spin };
      at += wind + spin + 40;
      return s;
    });
    intro.carveEnd = at;
    intro.beatAt = at + 1500;                  // last disc has fallen, been caught and settled; one beat of stillness
    intro.endAt = intro.beatAt + 520;
  }
  function carveTick(e) {
    const segs = intro.segs, A = 0.34;
    if (e < intro.carveEnd) {
      let k = segs.length - 1;
      while (k > 0 && e < segs[k].t0) k--;
      for (let j = 0; j < k; j++) if (!segs[j].done) closeCut(segs[j]);          // a dropped frame never loses a world
      const s = segs[k], u = e - s.t0, R = s.k * pend.L, prevR = k ? segs[k - 1].k * pend.L : pend.L;
      let th, len = R;
      if (u < s.wind) {                                    // anticipation: pull back, reel the string, flare the flame
        const q = easeOut(u / s.wind); th = -A * q; len = lerp(prevR, R, q);
        if (!s.flared) { s.flared = true; addHeat(pend.x, pend.y, 0.9 * Math.max(fire, 0.6), 1); }
      } else if (u < s.wind + s.spin) {                    // the cut
        th = -A + (TAU + A) * easeIO((u - s.wind) / s.spin);
        if (!s.cut) { s.cut = { x: pivot.x, y: pivot.y, R, a0: -A, a1: -A, closed: 0 }; cuts.push(s.cut); }
        s.cut.a1 = th; s.cut.x = pivot.x; s.cut.y = pivot.y; s.cut.R = R;
      } else {                                             // tiny settle at the bottom
        const v = u - s.wind - s.spin; th = 0.08 * Math.exp(-v / 160) * Math.sin(v / 90);
        if (!s.done) closeCut(s);
      }
      pend.x = pivot.x + Math.sin(th) * len; pend.y = pivot.y + Math.cos(th) * len;
    } else {
      for (const s of segs) if (!s.done) closeCut(s);
      if (pend.scripted) { pend.scripted = false; pend.vx = pend.L * 1.4; pend.vy = 0; }   // let go: the string pays back out
    }
    if (e >= intro.beatAt && !intro.pulsed) { intro.pulsed = true; web.pulse = t; ring(pivot.x, pivot.y, 620, 14, 0.2, 1.0); }
  }
  function closeCut(s) {
    s.done = true;
    const R = s.k * pend.L;
    if (s.cut) { s.cut.a1 = s.cut.a0 + TAU; s.cut.closed = t; }
    birthCarve(planets[s.pi], R);
  }
  // The disc inside the loop comes loose: it is the grid's own dots (the "slab"), and it leaves a hole behind.
  function birthCarve(p, R) {
    const slab = [];
    const i0 = Math.floor((pivot.x - R - gx0) / cell), i1 = Math.ceil((pivot.x + R - gx0) / cell);
    const j0 = Math.floor((pivot.y - R - gy0) / cell), j1 = Math.ceil((pivot.y + R - gy0) / cell);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const dx = gx0 + i * cell - pivot.x, dy = gy0 + j * cell - pivot.y, d = Math.hypot(dx, dy);
      if (d < R) slab.push(dx / R, dy / R, cutGlow(d / R));
    }
    p.born = true; p.el.classList.add("born", "forming");
    p.x = pivot.x; p.y = pivot.y; p.scale = R / p.R; p.form = 0; p.hot = 0; p.thr = 0;
    p.fly = { carve: true, phase: orbiting() ? "spiral" : "fall", t0: t, t1: 0, vx: 0, vy: 0, R0: R, slab };
    if (orbiting()) p.hot = 1;
    holes.push({ x: pivot.x, y: pivot.y, R, t0: t, dur: 0.6 });
    ring(pivot.x, pivot.y, 520, 10, 0.24, 0.7);
    spark(pivot.x, pivot.y + R, 12, 130, RGB.ember);
  }
  const cutGlow = (q) => 0.28 + 0.34 * q * q;     // brightness of grid dots inside the loop (rim-weighted, like a planet)
  // Fall under gravity, then one spring pulls the disc to its slot: it keeps the speed of the fall, overshoots once, settles.
  function flyCarve(p, dt) {
    const f = p.fly;
    let R = f.R0;
    if (f.phase === "spiral") {
      // Wide screens: the disc keeps the spin of the cut. It winds outward round the hub the way the bob was turning,
      // overshoots its orbit once and settles into it, already moving. No falling.
      const el = t - f.t0, w = 5.0, zt = 0.5, wd = w * Math.sqrt(1 - zt * zt);
      const k = 1 - Math.exp(-zt * w * el) * (Math.cos(wd * el) + (zt * w / wd) * Math.sin(wd * el));
      const lag = 2.6 * Math.exp(-el / 0.42), c = Math.cos(lag), sn = Math.sin(lag), dx = p.sx - pivot.x, dy = p.sy - pivot.y;
      p.x = pivot.x + (dx * c - dy * sn) * k; p.y = pivot.y + (dx * sn + dy * c) * k;
      p.form = easeOut(clamp(el / 0.5, 0, 1));
      R = lerp(f.R0, p.sR, easeOut(clamp(el / 0.95, 0, 1)));
      if (el > 1.9) { p.fly = null; p.x = p.sx; p.y = p.sy; p.R = p.sR; p.scale = 1; p.form = 1; return; }
    } else if (f.phase === "fall") {
      f.vy += 2300 * dt; p.y += f.vy * dt;
      if (t - f.t0 >= 0.24) { f.phase = "sling"; f.t1 = t; p.hot = 1; spark(pivot.x, pivot.y, 5, 90, RGB.ember, true); }   // the thread goes taut
    } else {
      const w = 5.6, z = 0.62, n = 3, h = dt / n;
      for (let s = 0; s < n; s++) {
        f.vx += (w * w * (p.sx - p.x) - 2 * z * w * f.vx) * h; f.vy += (w * w * (p.sy - p.y) - 2 * z * w * f.vy) * h;
        p.x += f.vx * h; p.y += f.vy * h;
      }
      const el = t - f.t1;
      p.form = easeOut(clamp(el / 0.5, 0, 1));                       // grid dots cross-fade into the planet's own
      R = lerp(f.R0, p.R, easeOut(clamp(el / 0.95, 0, 1)));
      if ((Math.hypot(p.sx - p.x, p.sy - p.y) < 0.7 && Math.hypot(f.vx, f.vy) < 10) || el > 2.4) { p.fly = null; p.x = p.sx; p.y = p.sy; p.scale = 1; p.form = 1; return; }
    }
    p.scale = R / p.R;
  }

  // ----- classic intro (backup) -----
  // A world is born as a dotted ring at the bob, wanders out and settles into its slot.
  const FORM = 2.1;
  function birth(p) {
    p.born = true; p.el.classList.add("born");
    p.fly = { x0: pend.x, y0: pend.y, t0: t, dur: FORM };
    p.trail = [];
    p.x = pend.x; p.y = pend.y; p.scale = 1; p.form = 0;
    spark(pend.x, pend.y, 18, 140, RGB.ember);
  }

  function finishIntro(skipped) {
    const P = D.person, els = typedEls();
    els[0].textContent = "./hello"; els[1].textContent = P.intro[0]; els[2].textContent = P.intro[1]; els[3].textContent = P.sparkLine;
    colonEl.classList.add("on", "swinging");
    caret.classList.remove("on", "idle");
    measure();
    planets.forEach((p) => {
      if (!p.born) { p.born = true; p.el.classList.add("born"); }
      if (skipped) { p.fly = null; p.x = p.sx; p.y = p.sy; p.scale = 1; p.form = 1; p.hot = 0; }
    });
    if (skipped) { cuts.length = 0; holes.length = 0; web.pulse = -9; }
    pend.spinning = false; pend.leaping = false; fuse.q = 1;
    // always leave the bob moving: with motion paused (or reduced motion) the loop sleeps as soon as the bob is
    // still, which froze it mid-air; a push lets it swing and settle naturally (motion off damps it to rest)
    if (pend.scripted || skipped) { pend.scripted = false; pend.x = pivot.x; pend.y = pivot.y + pend.L; pend.vx = pend.L * (motion ? 1.2 : 1.6); pend.vy = 0; }
    pend.visible = true; bobEl.classList.add("on");
    intro = null; mode = "idle";
    document.body.classList.remove("intro");
    if (!document.body.classList.contains("bio-on")) startSlide();
    try { localStorage.setItem("nk.seen", "1"); } catch (_) {}
    emit("ready", skipped);
    kick();
  }

  // ---------- drawing ----------
  const BUCKETS = [
    [[95, 243, 255], 0.06, 1.3], [[95, 243, 255], 0.12, 1.5], [[95, 243, 255], 0.2, 1.8], [[44, 138, 154], 0.6, 2],
    [[95, 243, 255], 0.5, 2.2], [[95, 243, 255], 0.75, 2.5], [[95, 243, 255], 1, 2.7], [[200, 251, 255], 1, 2.9],
    [[255, 178, 122], 1, 3.1], [[255, 138, 61], 1, 3.3]
  ];
  const paths = BUCKETS.map(() => []);

  function drawGrid() {
    ctx.drawImage(baseCache, 0, 0, W, H);
    for (const p of paths) p.length = 0;
    // holes: the inside refills from the edge inward; a dark disc hides the dim base dots meanwhile
    for (let k = holes.length - 1; k >= 0; k--) {
      const h = holes[k], q = (t - h.t0) / h.dur;
      if (q >= 1) { holes.splice(k, 1); continue; }
      h.front = h.R * (1 - q * q); h.glow = 1 - q;
      ctx.fillStyle = "#04060A"; ctx.beginPath(); ctx.arc(h.x, h.y, h.front, 0, TAU); ctx.fill();
    }
    const oc = cuts.length && !cuts[cuts.length - 1].closed ? cuts[cuts.length - 1] : null;   // the loop being cut right now
    const pv = mode !== "game" ? ptr.v : 0;
    const bp = beam.i >= 0 && planets[beam.i] && beam.v > 0.01 && mode !== "game" ? planets[beam.i] : null;
    let ux = 0, uy = 0, bd = 0, bR = 0;
    const src = pend.visible ? pend : lamp;        // the beam comes from the pendulum's flame (the logo's lamp only glows along)
    if (bp) { ux = bp.x - src.x; uy = bp.y + (bp.dy || 0) - src.y; bd = Math.hypot(ux, uy) || 1; ux /= bd; uy /= bd; bR = bp.R * bp.scale; }
    const tt = motion ? t : 0;
    const liveRings = rings.filter((r) => t - r.t0 < r.life);
    for (let j = 0; j < rows; j++) {
      const y = gy0 + j * cell;
      for (let i = 0; i < cols; i++) {
        const x = gx0 + i * cell, k = j * cols + i;
        let I = 0;
        let v = heat[k];
        if (bp) {
          const ax = x - src.x, ay = y - src.y, al = ax * ux + ay * uy;
          if (al > 0 && al < bd + bR) {
            const pp = ax * uy - ay * ux, wd = 16 + bR * 2.2 * al / bd;       // wide + soft = diffused
            v += beam.v * 0.26 * Math.exp(-(pp * pp) / (wd * wd)) * (0.35 + 0.65 * al / bd);
          }
        }
        v += (0.07 + (motion ? 0.035 * Math.sin(i * 0.21 + tt * 1.1) * Math.sin(j * 0.17 - tt * 0.7) : 0)) * light[k];
        for (const r of liveRings) {
          const age = t - r.t0, rr = age * r.speed - r.lag, d = Math.hypot(x - r.x, y - r.y), z = (d - rr) / r.width;
          if (z > -3 && z < 3) {
            const bb = r.amp * Math.exp(-z * z) * (1 - age / r.life);
            v += bb;
            if (r.ignite && age < 1.1 && z > -1 && z < 1 && Math.random() < 0.22) heat[k] = Math.max(heat[k], 0.75 * (1 - age / 1.1) * Math.max(fire, 0.6));
          }
        }
        if (pv > 0.01) { const dx = x - ptr.x, dy = y - ptr.y, d2 = dx * dx + dy * dy; if (d2 < 22500) v += pv * 0.24 * Math.exp(-d2 / 2600); }
        if (oc) {                                          // dots the bob has already swept light up: this is the disc that will come loose
          const dx = x - oc.x, dy = y - oc.y, d = Math.hypot(dx, dy);
          if (d < oc.R) { let da = (Math.atan2(dx, dy) - oc.a0) % TAU; if (da < 0) da += TAU; if (da <= oc.a1 - oc.a0) v += cutGlow(d / oc.R); }
        }
        for (const h of holes) {
          const d = Math.hypot(x - h.x, y - h.y);
          if (d < h.R + 10) { if (d < h.front) v = 0; const z = (d - h.front) / 7; if (z > -1.5 && z < 1.5) v += 0.5 * h.glow * Math.exp(-z * z); }
        }
        if (v >= 0.05) paths[Math.min(9, (v * 10) | 0)].push(x, y);
      }
    }
    flush();
    // soft lamp glow (the dot of the i is the light source)
    const g = ctx.createRadialGradient(lamp.x, lamp.y, 0, lamp.x, lamp.y, 340);
    g.addColorStop(0, `rgba(200,251,255,${0.08 + 0.08 * beam.v})`); g.addColorStop(1, "rgba(95,243,255,0)");
    ctx.fillStyle = g; ctx.fillRect(Math.max(0, lamp.x - 340), Math.max(0, lamp.y - 340), 680, 680);
  }
  function flush() {
    for (let b = 0; b < BUCKETS.length; b++) {
      const arr = paths[b];
      if (!arr.length) continue;
      const [c, a, s] = BUCKETS[b], hs = s / 2;
      ctx.fillStyle = rgba(c, a);
      for (let q = 0; q < arr.length; q += 2) ctx.fillRect(arr[q] - hs, arr[q + 1] - hs, s, s);
      arr.length = 0;
    }
  }

  // Flame rule (from mockup 2a): each cell takes the heat of the cell below,
  // nudged −1/0/+1 columns and cooled by a random amount → flickering pixel fire.
  function stepHeat(dt) {
    fireAcc += dt;
    if (fireAcc < 1 / 30) return;
    fireAcc = 0;
    const burning = pend.visible && mode !== "game" && motion && fire > 0;
    if (burning) {
      const ci = Math.round((pend.x - gx0) / cell), cj = Math.round((pend.y - gy0) / cell);
      for (let dx = -1; dx <= 1; dx++) for (let dy = 0; dy <= 1; dy++) {
        const i = ci + dx, j = cj + dy;
        if (i >= 0 && j >= 0 && i < cols && j < rows) heat[j * cols + i] = Math.max(heat[j * cols + i], dx === 0 ? 1 : 0.8);
      }
      heatAny = true;
    }
    for (const p of planets) if (p.burst) {
      const u = (t - p.burst.t0) / 0.9; if (u >= 1) continue;
      for (let q = 0; q < p.dots.length; q += 28) { const [x, y] = burstPt(p, q, u); addHeat(x, y, 0.6 * Math.max(fire, 0.6) * (1 - u), 0); }
    }
    if (!heatAny) return;
    let any = 0;
    const cool = mobile() ? 0.22 : 0.13;           // flame height: stays below the text
    for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols; i++) {
      const r = Math.random(), h = heat[(j + 1) * cols + i];
      const x = clamp(i - ((r * 3) | 0) + 1, 0, cols - 1);
      const v = Math.max(0, h - r * cool);
      heat[j * cols + x] = v; any += v;
    }
    for (let i = 0; i < cols; i++) heat[(rows - 1) * cols + i] *= 0.5;
    heatAny = any > 0.01;
  }
  let heatAny = false, fireAcc = 0;
  const beam = { i: -1, v: 0 };
  let light = new Float32Array(0);

  const PB = 12, planetPaths = Array.from({ length: PB }, () => []);   // brightness steps for planet dots (5 made the shimmer pop)
  function drawPlanet(p) {
    if (!p.born && mode !== "game") return;
    const col0 = p.w.color === "orange" ? RGB.orange : RGB.cyan;
    if (p.burst) {                               // dots fly apart, rise and turn orange
      const u = (t - p.burst.t0) / 0.9;
      if (u < 1) {
        const f = Math.min(1, u * 1.6), c = [col0[0] + (255 - col0[0]) * f | 0, col0[1] + (138 - col0[1]) * f | 0, col0[2] + (61 - col0[2]) * f | 0];
        ctx.fillStyle = rgba(c, 1);
        for (let q = 0; q < p.dots.length; q += 4) { const [x, y] = burstPt(p, q, u); ctx.globalAlpha = p.dots[q + 2] * (1 - u) * 0.9; ctx.fillRect(x - 1.2, y - 1.2, 2.4, 2.4); }
        ctx.globalAlpha = 1;
      }
      return;
    }
    if (p.fly && p.trail && p.trail.length > 4) {  // fading trail while it wanders
      ctx.fillStyle = rgba(col0, 1);
      for (let j = 0; j < p.trail.length - 2; j += 4) { ctx.globalAlpha = (j / p.trail.length) * 0.45 * (1 - (p.flyQ || 0)); ctx.fillRect(p.trail[j] - 1.5, p.trail[j + 1] - 1.5, 3, 3); }
      ctx.globalAlpha = 1;
    }
    const sc = p.scale; if (sc < 0.02) return;
    const form = p.form == null ? 1 : p.form, carve = !!(p.fly && p.fly.carve);
    ctx.globalAlpha = carve ? 1 : form;      // a carved disc is a solid piece of the screen from the start
    const R = p.R * sc, col = p.w.color === "orange" ? RGB.orange : RGB.cyan;
    const bob = motion && mode !== "game" && !p.fly ? Math.sin(t * 0.45 + p.phase) * 4 : 0;
    const X = p.x, Y = p.y + bob, lit = p.lit;
    p.dy = bob;
    ctx.fillStyle = p.w.color === "orange" ? "#0a0604" : "#04080C";
    ctx.beginPath(); ctx.arc(X, Y, R, 0, TAU); ctx.fill();
    // rim-weighted dots, very slow shimmer
    const d = p.dots, z = 1.9 * sc * (p.R / p.dotR), fade = (1 - lit) * (carve ? form : 1) * (orbiting() && p.z != null ? 0.86 + 0.14 * p.z : 1);
    for (const a of planetPaths) a.length = 0;
    if (fade > 0.02) for (let q = 0; q < d.length; q += 4) {
      const a = d[q + 2] * (0.75 + (motion && mode !== "game" ? 0.25 * Math.sin(t * 1.4 + d[q + 3]) : 0.25)) * fade;
      if (a < 0.06) continue;
      planetPaths[Math.min(PB - 1, (a * PB) | 0)].push(X + d[q] * R, Y + d[q + 1] * R);
    }
    for (let b = 0; b < PB; b++) {
      const arr = planetPaths[b]; if (!arr.length) continue;
      ctx.fillStyle = rgba(col, 0.1 + ((b + 0.5) / PB) * 0.86);
      for (let q = 0; q < arr.length; q += 2) ctx.fillRect(arr[q] - z / 2, arr[q + 1] - z / 2, z, z);
    }
    if (carve && form < 1) {                     // the grid dots it was cut from, fading as the planet's own dots take over
      const sl = p.fly.slab, k = 1 - form;
      for (let q = 0; q < sl.length; q += 3) {
        const [c, al, s] = BUCKETS[Math.min(9, (sl[q + 2] * 10) | 0)];
        ctx.fillStyle = rgba(c, al * k); ctx.fillRect(X + sl[q] * R - s / 2, Y + sl[q + 1] * R - s / 2, s, s);
      }
    }
    ctx.strokeStyle = rgba(col, 0.55); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(X, Y, R, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
    if (form < 1 && !carve) {                     // classic: the ring it was born as, fading out
      const n = Math.floor(TAU * R / 9); ctx.fillStyle = rgba(col, 1 - form);
      for (let j = 0; j < n; j++) { const a = j / n * TAU; ctx.fillRect(X + R * Math.sin(a) - 1.5, Y + R * Math.cos(a) - 1.5, 3, 3); }
    }
    // bat signal: soft lit disc, glyph cut out, dashed halo
    if (lit > 0.01) {
      ctx.fillStyle = `rgba(95,243,255,${0.12 * lit})`;
      ctx.beginPath(); ctx.arc(X, Y, R * 0.92, 0, TAU); ctx.fill();
      const sg = p.sig, zz = 3 * sc * (p.R / p.dotR);
      ctx.fillStyle = "#eafcff";
      for (let q = 0; q < sg.length; q += 3) {
        ctx.globalAlpha = lit * (1 - 0.6 * sg[q + 2] * sg[q + 2]) * 0.7;
        ctx.fillRect(X + sg[q] * R - zz / 2, Y + sg[q + 1] * R - zz / 2, zz, zz);
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = `rgba(200,251,255,${0.45 * lit})`; ctx.setLineDash([2, 5]);
      ctx.beginPath(); ctx.arc(X, Y, R + 8, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  function dottedLine(x0, y0, x1, y1, gap, col, a, s) {
    const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, (L / gap) | 0);
    ctx.fillStyle = rgba(col, a);
    for (let k = 0; k <= n; k++) { const q = k / n; ctx.fillRect(lerp(x0, x1, q) - s / 2, lerp(y0, y1, q) - s / 2, s, s); }
  }

  // Cut lines: the arc the bob has burned so far; once closed, the ring lingers and fades (concentric with the next ones).
  function drawCuts() {
    for (let k = cuts.length - 1; k >= 0; k--) {
      const c = cuts[k], age = c.closed ? t - c.closed : 0, life = 2.4;
      if (age > life) { cuts.splice(k, 1); continue; }
      const span = Math.min(TAU, c.a1 - c.a0), n = Math.max(2, Math.floor(span * c.R / 6));
      const all = c.closed ? 1 - age / life : 1, flash = c.closed ? Math.max(0, 1 - age / 0.3) : 0;
      for (let j = 0; j <= n; j++) {
        const q = j / n, a = c.a1 - span * (1 - q), x = c.x + c.R * Math.sin(a), y = c.y + c.R * Math.cos(a);
        const head = c.closed ? flash : Math.max(0, (q - 0.82) / 0.18);          // white-hot at the bob, and all round as it closes
        ctx.fillStyle = head > 0.05 ? `rgba(${95 + 138 * head | 0},${243 + 8 * head | 0},255,${all * (c.closed ? 0.8 : 0.3 + 0.7 * q)})` : rgba(RGB.cyan, all * (c.closed ? 0.8 : 0.3 + 0.7 * q));
        const s = 2.6 + head * 1.2; ctx.fillRect(x - s / 2, y - s / 2, s, s);
      }
    }
  }
  // The web: a dotted thread from the colon to each world. Bright while it slings a world out, faint at rest.
  function drawWeb() {
    const pu = t - web.pulse, qp = pu >= 0 && pu < 0.6 ? pu / 0.6 : -1;
    for (const p of planets) {
      const a0 = p.thr || 0;
      if (a0 < 0.02 || p.scale < 0.05 || p.gone) continue;
      const px = p.x, py = p.y + (p.fly ? 0 : p.dy || 0), dx = px - pivot.x, dy = py - pivot.y, L = Math.hypot(dx, dy) || 1;
      const len = L - p.R * p.scale - 16;
      if (len < 10) continue;
      const ux = dx / L, uy = dy / L, n = Math.max(1, (len / 9) | 0), lit = p.lit, hot = p.hot || 0, flying = !!p.fly;
      for (let k = 0; k <= n; k++) {
        const q = k / n, x = pivot.x + ux * (8 + len * q), y = pivot.y + uy * (8 + len * q);
        const soft = flying ? 1 : Math.min(1, 0.45 + q / 0.3);                  // at rest the thread emerges softly from the hub
        const wt = Math.max(hot, qp >= 0 ? Math.exp(-(((q - qp) / 0.09) ** 2)) : 0);
        const a = a0 * soft * (flying ? 0.7 : 0.4 + 0.45 * lit);
        ctx.fillStyle = wt > 0.05 ? rgba(RGB.ice, Math.min(1, a + wt * 0.8 * a0)) : rgba(lit > 0.3 || flying ? RGB.cyan : RGB.deep, a);
        const s = 1.4 + wt * 1.2; ctx.fillRect(x - s / 2, y - s / 2, s, s);
      }
    }
  }

  // Classic backup: a dotted chain from world to world.
  function drawConstellation() {
    const ps = planets.filter((p) => p.born && !p.fly && !p.gone && p.scale > 0.9);
    for (let k = 0; k < ps.length - 1; k++) {
      const a = ps[k], b = ps[k + 1];
      const dx = b.x - a.x, dy = (b.y + (b.dy || 0)) - (a.y + (a.dy || 0)), L = Math.hypot(dx, dy) || 1;
      const ux = dx / L, uy = dy / L;
      dottedLine(a.x + ux * (a.R + 8), a.y + (a.dy || 0) + uy * (a.R + 8), b.x - ux * (b.R + 8), b.y + (b.dy || 0) - uy * (b.R + 8), 9, RGB.deep, 0.35, 1.4);
    }
  }

  function drawPendulum() {
    if (!pend.visible || mode === "game") return;
    if (pend.spinning && pend.th > 0) {
      const n = Math.max(2, Math.floor(pend.th * pend.L / 9));
      ctx.fillStyle = rgba(RGB.cyan, 1);
      for (let j = 0; j <= n; j++) { const a = pend.th * j / n; ctx.globalAlpha = 0.3 + 0.7 * j / n; ctx.fillRect(pivot.x + pend.L * Math.sin(a) - 1.5, pivot.y + pend.L * Math.cos(a) - 1.5, 3, 3); }
      ctx.globalAlpha = 1;
    }
    if (!pend.leaping) {
      dottedLine(pivot.x, pivot.y, pend.x, pend.y, 9, RGB.orange, 0.55, 2);
      ctx.fillStyle = "#ff8a3d"; ctx.beginPath(); ctx.arc(pivot.x, pivot.y, 2.6, 0, TAU); ctx.fill();   // the hub pin
    }
    const ch = pend.charge, r = 4.2 + ch * 3;
    // bob: a small dot cluster + faint halo
    ctx.fillStyle = rgba(RGB.orange, 0.14 + ch * 0.2);
    ctx.beginPath(); ctx.arc(pend.x, pend.y, r + 7 + ch * 8, 0, TAU); ctx.fill();
    ctx.fillStyle = "#ff8a3d"; ctx.shadowColor = "#ff8a3d"; ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.arc(pend.x, pend.y, r + 0.8, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
  }

  function drawSparks(dt) {
    if (!sparks.length) return;
    for (let k = sparks.length - 1; k >= 0; k--) {
      const s = sparks[k];
      s.x += s.vx * dt; s.y += s.vy * dt; s.vy += (s.flint ? 520 : 120) * dt; s.life -= dt * (s.flint ? 1.6 : 1.4);
      if (s.life <= 0) { sparks.splice(k, 1); continue; }
      const l = s.life;
      if (s.flint) {
        ctx.strokeStyle = `rgba(255,${200 + 55 * l | 0},${140 + 100 * l | 0},${Math.min(1, l * 2)})`; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * 0.025, s.y - s.vy * 0.025); ctx.stroke();
      } else { ctx.fillStyle = `rgba(255,${150 + 80 * l | 0},90,${l})`; ctx.fillRect(s.x - 1.5, s.y - 1.5, 3, 3); }
    }
  }

  // ---------- main loop ----------
  function busy() {
    return mode === "intro" || mode === "game" || Math.abs(beam.v - (hover >= 0 || pinned >= 0 ? 1 : 0)) > 0.01 || pend.grabbed || sparks.length || heatAny || rings.some((r) => t - r.t0 < r.life) ||
      planets.some((p) => p.fly || p.burst || Math.abs(p.lit - target(p)) > 0.01 || (p.born && !p.gone && p.scale < 0.999) || (p.gone && p.scale > 0.01) || p.tx != null) ||
      (!pend.scripted && Math.hypot(pend.vx, pend.vy) > 3) ||
      cuts.length > 0 || holes.length > 0 || darts.length > 0 || Math.abs(orbit.v - (orbiting() && motion && mode === "idle" && hover < 0 && pinned < 0 ? 1 : 0)) > 0.02 || Math.abs(fuse.a - (fuse.t || 0)) > 0.01 || t - web.pulse < 0.7 || planets.some((p) => p.hot > 0.01 || Math.abs((p.thr || 0) - (p.thrT || 0)) > 0.01) ||
      Math.abs(ptr.v - (ptr.on ? 1 : 0)) > 0.01 || (ptr.on && performance.now() - ptr.last < 400);   // full frame rate while the mouse moves
  }
  const target = (p) => (mode === "game" ? 0 : hover === p.i || pinned === p.i ? 1 : 0);

  let inFrame = false, follow = 0;
  // Bio "doors": the name moves up and the swing line moves down to make room for the two bio lines.
  // Driven here, in the same frame that draws the canvas, so the pendulum is always exactly under the colon
  // (CSS transitions run on another thread, and the bob visibly lagged them).
  let slide = null;
  const easeOutCubic = (k) => 1 - Math.pow(1 - k, 3);
  function startSlide() {
    const g = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--gap")) || 0) / 2;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    slide = { t0: performance.now(), dur: reduce ? 480 : 820, g, up: [$(".hero .prompt"), $(".hero .headline")], down: $(".hero .spark") };
    applySlide(slide.t0);                  // closed position first, then the class (no jump)
    document.body.classList.add("bio-on");
    follow = performance.now() + slide.dur + 60;
    kick();
  }
  function applySlide(now) {
    if (!slide) return;
    const k = slide.dur ? clamp((now - slide.t0) / slide.dur, 0, 1) : 1, off = slide.g * (1 - easeOutCubic(k));
    const a = `translate3d(0,${off.toFixed(2)}px,0)`, b = `translate3d(0,${(-off).toFixed(2)}px,0)`;
    slide.up.forEach((el) => el && (el.style.transform = a));
    if (slide.down) slide.down.style.transform = b;
    if (k >= 1) { slide.up.concat(slide.down).forEach((el) => el && (el.style.transform = "")); slide = null; }
  }
  let lampLit = false;
  const logoEl = document.querySelector(".logo");
  // recompute world slots (e.g. after the bio slid in) and glide settled worlds there
  function reslot() {
    planets.forEach((p, i) => {
      const s = slotFor(i); p.sx = s.x; p.sy = s.y; p.sR = s.R;
      if (orbiting()) return;                     // the frame loop keeps orbiting worlds on their slots
      if (!p.fly && mode !== "game" && (Math.abs(p.x - s.x) + Math.abs(p.y - s.y) + Math.abs(p.R - s.R) > 1)) { p.tx = s.x; p.ty = s.y; p.tR = s.R; p.release = true; }
    });
    kick();
  }
  function frame(now) {
    inFrame = true;
    try { frameBody(now); } finally { inFrame = false; }
  }
  function frameBody(now) {
    raf = 0;
    if (hidden) { running = false; return; }
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    const hot = busy() || follow > 0;          // full 60fps while the swing line slides, so the bob never lags the text
    if (!motion && !hot) { draw(0); running = false; return; }   // paused & settled → stop
    // idle ambient: 30fps is plenty
    if (!hot && now - lastDraw < 31) { raf = requestAnimationFrame(frame); return; }
    const fdt = Math.min(0.05, (now - (lastDraw || now)) / 1000); lastDraw = now;
    if (motion || hot) t += fdt;
    if (mode === "intro" && intro) introTick(now);
    if (follow) { applySlide(now); measure(); if (now > follow) { follow = 0; reslot(); } }   // track the sliding swing line
    update(fdt);
    draw(fdt);
    raf = requestAnimationFrame(frame);
  }

  function update(dt) {
    pendStep(dt);
    stepHeat(dt);
    const want = hover >= 0 ? hover : pinned;
    if (want >= 0) beam.i = want;
    const lit = want >= 0 && mode !== "game";              // the i's dot lights up only while a world is lit
    if (lit !== lampLit && logoEl) { lampLit = lit; logoEl.classList.toggle("lit", lit); }
    beam.v += ((want >= 0 ? 1 : 0) - beam.v) * Math.min(1, dt * 9);
    ptr.v += ((ptr.on ? 1 : 0) - ptr.v) * Math.min(1, dt * (ptr.on ? 12 : 5));
    // the orbit holds still while you aim at a world, while one is open, during the game and when motion is paused
    const live = orbiting() && !!stageC;
    const go = live && motion && (mode === "idle" || mode === "intro") && hover < 0 && pinned < 0 && !pend.grabbed ? 1 : 0;
    orbit.v += (go - orbit.v) * Math.min(1, dt * 6);
    if (live) {
      orbit.a = (orbit.a + orbit.v * 1.5 * dt) % 360;                 // one turn in about four minutes
      for (const p of planets) { const o = orbitPos(p.i, stageC); p.sx = o.x; p.sy = o.y; p.sR = o.R; p.z = o.z; }
    }
    for (let k = darts.length - 1; k >= 0; k--) if (t - darts[k].t0 >= darts[k].dur) { burst(darts[k].i); darts.splice(k, 1); }
    fuse.t = mode !== "game" && pend.visible && anchor.y > 70 && anchor.y < H ? 1 : 0;      // hidden once the colon has scrolled away
    fuse.a += (fuse.t - fuse.a) * Math.min(1, dt * 6);
    for (let k = rings.length - 1; k >= 0; k--) if (t - rings[k].t0 > rings[k].life) rings.splice(k, 1);
    planets.forEach((p) => {
      p.lit += (target(p) - p.lit) * Math.min(1, dt * 9);
      p.el.classList.toggle("lit", p.lit > 0.5);
      p.el.classList.toggle("forming", !!p.fly);
      // thread: on while it slings the world out; at rest a faint web on wide screens only (phones stay calm)
      const flying = p.fly && p.fly.carve;
      const thrT = flying ? (p.fly.phase !== "fall" ? 1 : 0) : introStyle === "carve" && !tall() && pend.visible && mode !== "game" && p.born && !p.gone ? 1 : 0;
      p.thrT = thrT; p.thr = (p.thr || 0) + (thrT - (p.thr || 0)) * Math.min(1, dt * (thrT ? 14 : 2.5));
      if (p.hot) p.hot = Math.max(0, p.hot - dt * 2.4);
      if (flying) flyCarve(p, dt);
      else if (p.fly) {                              // classic wander
        const el = t - p.fly.t0, q = clamp(el / p.fly.dur, 0, 1), e = easeIO(q), mo = easeIO(Math.min(1, el / 0.7));
        const A = Math.min(230, W * 0.16), ph = p.i * 1.9 + el * 1.15, amp = A * Math.sin(Math.PI * q) * (1 - 0.35 * q);
        p.x = p.fly.x0 + (p.sx - p.fly.x0) * e + (0.5 + 0.5 * Math.cos(ph)) * amp * 1.1;
        p.y = p.fly.y0 + (p.sy - p.fly.y0) * e + Math.sin(ph * 1.3 + p.i) * amp * 0.75;
        const ringR = Math.min(pend.L, 110);
        p.scale = (ringR + (p.R - ringR) * mo) / p.R; p.form = mo; p.flyQ = q;
        p.trail.push(p.x, p.y); if (p.trail.length > 56) p.trail.splice(0, 2);
        if (q >= 1) { p.fly = null; p.scale = 1; p.form = 1; p.trail = []; }
      } else if (p.tx != null) {
        const k = Math.min(1, dt * 5);
        p.x = lerp(p.x, p.tx, k); p.y = lerp(p.y, p.ty, k); p.R = lerp(p.R, p.tR, k);
        if (Math.abs(p.x - p.tx) + Math.abs(p.y - p.ty) + Math.abs(p.R - p.tR) < 0.5) { p.x = p.tx; p.y = p.ty; p.R = p.tR; if (p.release) { p.tx = p.ty = p.tR = null; p.release = false; } }
      }
      if (live && !p.fly && mode !== "game") {
        if (p.tx == null) { p.x = p.sx; p.y = p.sy; p.R = p.sR; }
        else if (p.release) { p.tx = p.sx; p.ty = p.sy; p.tR = p.sR; }           // gliding home (after the game): aim at where the slot is now
      }
      if (!p.fly) {
        if (p.gone) { p.scale = Math.max(0, p.scale - dt * 3.2); if (p.burst && t - p.burst.t0 > 0.9) p.burst = null; }
        else if ((p.born || mode === "game") && p.scale < 1) p.scale = Math.min(1, p.scale + (1 - p.scale) * Math.min(1, dt * 6) + dt * 0.3);   // regrow ≈0.5 s, easing out
      }
    });
  }

  function draw(dt) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawGrid();
    if (mode !== "game") { drawFuse(); if (introStyle === "classic") { if (!tall()) drawConstellation(); } else { drawCuts(); drawWeb(); } }
    planets.forEach(drawPlanet);
    drawDarts();
    drawPendulum();
    if (mode === "game" && NK.game) NK.game.draw(ctx, dt);
    drawSparks(dt);
    // sync DOM hit-targets
    planets.forEach((p) => {
      const tr = `translate(${(p.x - p.R).toFixed(1)}px,${(p.y + (p.dy || 0) - p.R).toFixed(1)}px) scale(${p.scale.toFixed(3)})`;
      if (p._tr !== tr) { p.el.style.transform = tr; p._tr = tr; }
      const sz = (p.R * 2).toFixed(1) + "px";
      if (p._sz !== sz) { p.el.style.width = p.el.style.height = sz; p._sz = sz; }
    });
    if (pend.visible) bobEl.style.transform = `translate(${pend.x.toFixed(1)}px,${pend.y.toFixed(1)}px)`;
  }

  function kick() {
    if (!raf && !inFrame && !hidden) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
  }

  // ---------- public ----------
  function init() {
    buildPlanets();
    bindBob();
    layout();
    let rt = 0;
    window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { layout(); if (NK.game && NK.game.active()) NK.game.resize(); }, 120); });
    document.addEventListener("visibilitychange", () => { hidden = document.hidden; if (!hidden) kick(); });
    // The visitor keeps their own mouse pointer; the grid glows softly under it, and a fast move leaves a brief trail.
    if (matchMedia("(pointer:fine)").matches && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      window.addEventListener("pointermove", (e) => {
        if (e.pointerType && e.pointerType !== "mouse") return;
        const u = uni.getBoundingClientRect(), x = e.clientX - u.left, y = e.clientY - u.top, now = performance.now();
        const sp = ptr.on ? Math.hypot(x - ptr.x, y - ptr.y) / Math.max(8, now - ptr.last) * 1000 : 0;
        ptr.x = x; ptr.y = y; ptr.last = now; ptr.on = true;
        if (sp > 900 && motion && mode !== "game") addHeat(x, y, Math.min(0.22, sp / 9000), 0);
        kick();
      }, { passive: true });
      document.documentElement.addEventListener("pointerleave", () => { ptr.on = false; kick(); });
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measure(); layout(); });
  }

  return {
    init, layout, kick, on: (e, f) => ((listeners[e] = listeners[e] || []).push(f)),
    startIntro, skipIntro: () => { if (mode === "intro") finishIntro(true); },
    get mode() { return mode; }, set mode(m) { mode = m; kick(); },
    get motion() { return motion; },
    setMotion(on) { motion = !!on; kick(); },
    setFire(f) { fire = f; },
    setHover, pin(i) { pinned = i; kick(); },
    burst, ignite, regrow, spark, ring, addHeat,
    get planets() { return planets; }, get pivot() { return pivot; }, get pend() { return pend; },
    get size() { return { W, H }; }, measure,
    resetPendulum() { pend.snapped = false; pend.visible = true; pend.x = pivot.x; pend.y = pivot.y + pend.L; pend.vx = pend.L * 1.2; pend.vy = 0; bobEl.classList.add("on"); kick(); },
    hidePendulum() { bobEl.classList.remove("on"); },
    // stow: while the terminal log is on screen the pendulum is put away (no bob, no flame); unstow re-hangs it at rest
    stow(on) {
      if (mode === "intro" || mode === "game") return;
      if (on) { pend.visible = false; pend.grabbed = false; bobEl.classList.remove("on"); heat.fill(0); sparks.length = 0; }
      else if (!pend.visible) { measure(); pend.visible = true; pend.snapped = false; pend.x = pivot.x; pend.y = pivot.y + pend.L; pend.vx = pend.L * 0.5; pend.vy = 0; bobEl.classList.add("on"); }
      kick();
    },
    uni,
    _dbg: () => ({ orbit: orbit.a, orbitV: orbit.v, setOrbit(a) { orbit.a = a; }, cuts: cuts.length, holes: holes.length, style: introStyle, sparks: sparks.length, heat: heat.reduce((a, b) => a + b, 0), rings: rings.length, mode, t })
  };
})();
