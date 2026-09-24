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
  const tall = () => W <= 760 || H > W * 1.1;
  const low = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.connection && navigator.connection.saveData);

  const pivot = { x: 200, y: 400 }, lamp = { x: 90, y: 50 };
  const pend = { L: 110, x: 0, y: 0, vx: 0, vy: 0, visible: false, scripted: true, grabbed: false, gx: 0, gy: 0, charge: 0, snapped: false };
  let planets = [];
  let hover = -1;                  // planet index under pointer/focus (drives cone + bat signal)
  let pinned = -1;                 // planet "cd"-ed into from terminal
  const rings = [], sparks = [], twinkles = [];
  const listeners = {};
  const emit = (e, d) => (listeners[e] || []).forEach((f) => f(d));

  // ---------- layout ----------
  const SLOTS_WIDE = [[0.22, 0.30, 1.0], [0.82, 0.10, 0.70], [0.86, 0.64, 0.78], [0.30, 0.92, 0.80], [0.56, 0.60, 0.56]];
  // tall screens: a tidy 2-2-1 grid, equal sizes (alignment beats variety on a phone)
  const SLOTS_TALL = [[0.25, 0.1, 1], [0.75, 0.1, 1], [0.25, 0.53, 1], [0.75, 0.53, 1], [0.5, 0.96, 1]];

  function measure() {
    const u = uni.getBoundingClientRect();
    const r = pivotEl.getBoundingClientRect();
    if (r.width) { pivot.x = r.left - u.left + r.width / 2; pivot.y = r.top - u.top + r.height / 2; }
    const li = document.querySelector(".logo-i");
    if (li) { const lr = li.getBoundingClientRect(); lamp.x = lr.left - u.left + lr.width / 2; lamp.y = lr.top - u.top + lr.height * 0.28; }   // the dot of the i is the lamp
    pend.L = mobile() ? clamp(H * 0.055, 36, 46) : clamp(H * 0.12, 70, 120);
    return u;
  }

  function slotFor(i) {
    const hero = $(".hero").getBoundingClientRect(), u = uni.getBoundingClientRect();
    let x0, x1, y0, y1, S;
    if (!tall()) {
      x0 = Math.max(W * 0.54, hero.right - u.left + 40); x1 = W - Math.max(40, W * 0.045);
      y0 = 100; y1 = H - 185;
      if (H < 560) { y0 = 64; y1 = H - 20; }      // short landscape: the prompt sits under the hero, not under the worlds
      S = SLOTS_WIDE[i];
    } else {
      x0 = mobile() ? 20 : W * 0.12; x1 = W - x0;
      y0 = Math.max(pivot.y + pend.L + 34, hero.bottom - u.top + 28); y1 = H - (mobile() ? 178 : 190);
      if (y1 - y0 < 240) y1 = y0 + 240;          // small phones: planets shrink rather than slide under the prompt
      S = SLOTS_TALL[i];
    }
    const rw = x1 - x0, rh = y1 - y0;
    const base = tall() ? Math.min(rw * 0.17, rh * 0.16, mobile() ? 58 : 100) : Math.min(rw * 0.19, rh * 0.2, 118);
    const R = Math.max(mobile() ? 38 : 46, base * S[2]);
    return { x: clamp(x0 + S[0] * rw, x0 + R, x1 - R), y: clamp(y0 + S[1] * rh, y0 + R * (tall() ? 1 : 0.6), y1 - R), R };
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
      b.innerHTML = `<span class="ring" aria-hidden="true"></span><span class="lbl" aria-hidden="true"><span class="cnt">${String(n).padStart(2, "0")} ${n === 1 ? "project" : "projects"}</span><span class="name">${w.name.replace(" & ", " &amp; ")}</span></span>`;
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
    const r = uni.getBoundingClientRect();
    W = Math.round(r.width); H = Math.round(r.height);
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
    caret.style.height = h + "px";
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

  function startIntro() {
    mode = "intro";
    document.body.classList.add("intro"); document.body.classList.remove("bio-on");
    const s = script();
    intro = { t0: performance.now(), i: 0, ...s, colonAt: s.typedEnd + 80, bangAt: s.typedEnd + 520 };
    intro.dropAt = intro.bangAt + 80; intro.loopAt = intro.dropAt + 380; intro.loopDur = 720; intro.spin = 620;
    intro.endAt = intro.loopAt + intro.loopDur * planets.length + FORM * 1000;
    typedEls().forEach((e) => (e.textContent = ""));
    colonEl.classList.remove("on", "swinging");
    planets.forEach((p) => { p.born = false; p.scale = 0; p.fly = null; p.gone = false; p.el.classList.remove("born", "gone"); });
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
      intro.banged = true; caret.classList.remove("on");
      document.body.classList.remove("intro");            // chrome becomes usable while the worlds are born
      ring(pivot.x, pivot.y, 900, 12, 0.9, 1.4, true);
      ring(pivot.x - 0, pivot.y, 900, 16, 0.4, 1.4, false, 70);
      spark(pivot.x, pivot.y, 16, 180, RGB.ember, true);
      colonEl.classList.add("swinging");
      pend.visible = true; pend.x = pivot.x; pend.y = pivot.y + pend.L * 0.3;
    }
    if (e >= intro.dropAt && e < intro.loopAt) {
      const k = easeOut((e - intro.dropAt) / (intro.loopAt - intro.dropAt));
      pend.x = pivot.x; pend.y = pivot.y + lerp(pend.L * 0.3, pend.L, k);
    }
    if (e >= intro.loopAt) {
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
      if (skipped) { p.fly = null; p.x = p.sx; p.y = p.sy; p.scale = 1; p.form = 1; }
    });
    pend.spinning = false;
    if (pend.scripted || skipped) { pend.scripted = false; pend.x = pivot.x + (skipped ? pend.L * 0.2 : 0); pend.y = pivot.y + pend.L; pend.vx = 0; pend.vy = 0; }
    pend.visible = true; bobEl.classList.add("on");
    intro = null; mode = "idle";
    document.body.classList.remove("intro");
    if (!document.body.classList.contains("bio-on")) { document.body.classList.add("bio-on"); follow = performance.now() + 950; }
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
    const bp = beam.i >= 0 && planets[beam.i] && beam.v > 0.01 && mode !== "game" ? planets[beam.i] : null;
    let ux = 0, uy = 0, bd = 0, bR = 0;
    if (bp) { ux = bp.x - lamp.x; uy = bp.y + (bp.dy || 0) - lamp.y; bd = Math.hypot(ux, uy) || 1; ux /= bd; uy /= bd; bR = bp.R * bp.scale; }
    const tt = motion ? t : 0;
    const liveRings = rings.filter((r) => t - r.t0 < r.life);
    for (let j = 0; j < rows; j++) {
      const y = gy0 + j * cell;
      for (let i = 0; i < cols; i++) {
        const x = gx0 + i * cell, k = j * cols + i;
        let I = 0;
        let v = heat[k];
        if (bp) {
          const ax = x - lamp.x, ay = y - lamp.y, al = ax * ux + ay * uy;
          if (al > 0 && al < bd + bR) {
            const pp = ax * uy - ay * ux, wd = 16 + bR * 2.2 * al / bd;       // wide + soft = diffused
            v += beam.v * 0.2 * Math.exp(-(pp * pp) / (wd * wd)) * (0.35 + 0.65 * al / bd);
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

  const planetPaths = [[], [], [], [], []];
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
    const form = p.form == null ? 1 : p.form;
    ctx.globalAlpha = form;
    const R = p.R * sc, col = p.w.color === "orange" ? RGB.orange : RGB.cyan;
    const bob = motion && mode !== "game" && !p.fly ? Math.sin(t * 0.45 + p.phase) * 4 : 0;
    const X = p.x, Y = p.y + bob, lit = p.lit;
    p.dy = bob;
    ctx.fillStyle = p.w.color === "orange" ? "#0a0604" : "#04080C";
    ctx.beginPath(); ctx.arc(X, Y, R, 0, TAU); ctx.fill();
    // rim-weighted dots, very slow shimmer
    const d = p.dots, z = 1.9 * sc * (p.R / p.dotR), fade = 1 - lit;
    for (const a of planetPaths) a.length = 0;
    if (fade > 0.02) for (let q = 0; q < d.length; q += 4) {
      const a = d[q + 2] * (0.75 + (motion && mode !== "game" ? 0.25 * Math.sin(t * 1.4 + d[q + 3]) : 0.25)) * fade;
      if (a < 0.06) continue;
      planetPaths[Math.min(4, (a * 5) | 0)].push(X + d[q] * R, Y + d[q + 1] * R);
    }
    for (let b = 0; b < 5; b++) {
      const arr = planetPaths[b]; if (!arr.length) continue;
      ctx.fillStyle = rgba(col, 0.12 + b * 0.2);
      for (let q = 0; q < arr.length; q += 2) ctx.fillRect(arr[q] - z / 2, arr[q + 1] - z / 2, z, z);
    }
    ctx.strokeStyle = rgba(col, 0.55); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(X, Y, R, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
    if (form < 1) {                               // the ring it was born as, fading out
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
    dottedLine(pivot.x, pivot.y, pend.x, pend.y, 9, RGB.orange, 0.55, 2);
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
      (!pend.scripted && Math.hypot(pend.vx, pend.vy) > 3);
  }
  const target = (p) => (mode === "game" ? 0 : hover === p.i || pinned === p.i ? 1 : 0);

  let inFrame = false, follow = 0;
  // recompute world slots (e.g. after the bio slid in) and glide settled worlds there
  function reslot() {
    planets.forEach((p, i) => {
      const s = slotFor(i); p.sx = s.x; p.sy = s.y; p.sR = s.R;
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
    const hot = busy();
    if (!motion && !hot) { draw(0); running = false; return; }   // paused & settled → stop
    // idle ambient: 30fps is plenty
    if (!hot && now - lastDraw < 31) { raf = requestAnimationFrame(frame); return; }
    const fdt = Math.min(0.05, (now - (lastDraw || now)) / 1000); lastDraw = now;
    if (motion || hot) t += fdt;
    if (mode === "intro" && intro) introTick(now);
    if (follow) { measure(); if (now > follow) { follow = 0; reslot(); } }   // track the sliding swing line
    update(fdt);
    draw(fdt);
    raf = requestAnimationFrame(frame);
  }

  function update(dt) {
    pendStep(dt);
    stepHeat(dt);
    const want = hover >= 0 ? hover : pinned;
    if (want >= 0) beam.i = want;
    beam.v += ((want >= 0 ? 1 : 0) - beam.v) * Math.min(1, dt * 9);
    for (let k = rings.length - 1; k >= 0; k--) if (t - rings[k].t0 > rings[k].life) rings.splice(k, 1);
    planets.forEach((p) => {
      p.lit += (target(p) - p.lit) * Math.min(1, dt * 9);
      p.el.classList.toggle("lit", p.lit > 0.5);
      p.el.classList.toggle("forming", !!p.fly);
      if (p.fly) {
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
      if (!p.fly) {
        if (p.gone) { p.scale = Math.max(0, p.scale - dt * 3.2); if (p.burst && t - p.burst.t0 > 0.9) p.burst = null; }
        else if ((p.born || mode === "game") && p.scale < 1) p.scale = Math.min(1, p.scale + dt * 2);   // regrow ≈0.5 s
      }
    });
  }

  function draw(dt) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawGrid();
    if (mode !== "game" && !tall()) drawConstellation();
    planets.forEach(drawPlanet);
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
    burst, regrow, spark, ring, addHeat,
    get planets() { return planets; }, get pivot() { return pivot; }, get pend() { return pend; },
    get size() { return { W, H }; }, measure,
    resetPendulum() { pend.snapped = false; pend.visible = true; pend.x = pivot.x; pend.y = pivot.y + pend.L; pend.vx = pend.L * 1.2; pend.vy = 0; bobEl.classList.add("on"); kick(); },
    hidePendulum() { bobEl.classList.remove("on"); },
    uni,
    _dbg: () => ({ sparks: sparks.length, heat: heat.reduce((a, b) => a + b, 0), rings: rings.length, mode, t })
  };
})();
