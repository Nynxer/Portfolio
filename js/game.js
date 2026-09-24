/* ==========================================================================
   ORBIT SLING — the hidden game. Found by shaking / yanking the pendulum
   (or arrow-key shaking it, or `sling` in the terminal). The bob snaps off
   and becomes a comet; your worlds become gravity wells; light the beacon.
   Physics lives in sling-core.js (tested headless).
   ========================================================================== */
window.NK = window.NK || {};

NK.game = (function () {
  "use strict";
  const S = NK.sling, sky = NK.sky;
  const $ = (s) => document.querySelector(s);
  const TAU = Math.PI * 2;
  const hud = $("#hud"), hudTop = $("#hud-top"), hudMsg = $("#hud-msg"), hudHelp = $("#hud-help");
  const ORANGE = "255,138,61", EMBER = "255,178,122", CYAN = "95,243,255", ICE = "233,251,255";

  let on = false, st = "off", lvlI = 0, shots = 0, total = 0;
  let angle = -0.1, power = 0.55, comet = null, trail = [], enterT = 0, from = null, msgT = 0;
  let map = { s: 1, ox: 0, oy: 0, rot: false };
  let drag = null, onExit = null;

  const lvl = () => S.LEVELS[lvlI];
  const portrait = () => { const { W, H } = sky.size; return H > W * 1.05; };

  // virtual → screen
  function fit() {
    const { W, H } = sky.size, rot = portrait();
    const vw = rot ? S.VH : S.VW, vh = rot ? S.VW : S.VH;
    const padT = rot ? 110 : 90, padB = rot ? 70 : 60, padX = 16;
    const s = Math.min((W - padX * 2) / vw, (H - padT - padB) / vh);
    map = { s, rot, ox: (W - vw * s) / 2, oy: padT + (H - padT - padB - vh * s) / 2 };
  }
  function toScreen(x, y) {
    if (map.rot) { const X = S.VH - y, Y = x; return [map.ox + X * map.s, map.oy + Y * map.s]; }
    return [map.ox + x * map.s, map.oy + y * map.s];
  }
  function toVirtualVec(dx, dy) { // screen delta → virtual delta
    if (map.rot) return [dy / map.s, -dx / map.s];
    return [dx / map.s, dy / map.s];
  }

  function placePlanets() {
    const L = lvl(), used = new Set();
    L.planets.forEach((lp) => {
      const p = sky.planets[lp.w]; used.add(lp.w);
      const [x, y] = toScreen(lp.x, lp.y);
      p.tx = x; p.ty = y; p.tR = lp.R * map.s; p.release = false; p.el.classList.remove("off");
      if (p.gone) sky.regrow(lp.w);
    });
    // worlds not in this level drift to the edge, tiny and inert
    sky.planets.forEach((p, i) => {
      if (used.has(i)) return;
      p.tx = p.sx; p.ty = p.sy; p.tR = 0.01; p.release = false; p.el.classList.add("off");
    });
  }

  function setHud() {
    hudTop.innerHTML = `Orbit sling · level <b>${lvlI + 1}</b>/${S.LEVELS.length} · ${lvl().name} · shots <b>${shots}</b>`;
    const touch = matchMedia("(pointer:coarse)").matches;
    hudHelp.textContent = touch
      ? "drag anywhere and pull back to aim · let go to launch · tap ✕ top-right to quit"
      : "drag & pull back to aim — or ← → aim · ↑ ↓ power · space launch · r restart · esc quit";
  }
  function say(html, ms) { hudMsg.innerHTML = html; msgT = ms ? performance.now() + ms : 0; }

  function start(how) {
    if (on) return;
    on = true; st = "enter"; lvlI = 0; shots = 0; total = 0; comet = null; trail = []; angle = -0.1; power = 0.55;
    from = { x: sky.pend.x, y: sky.pend.y };
    enterT = performance.now();
    document.body.classList.add("gaming");
    hud.hidden = false;
    sky.mode = "game"; sky.hidePendulum(); sky.setHover(-1);
    fit(); placePlanets(); setHud();
    say(how === "terminal" ? "The pendulum lets go. Sling the comet into the beacon." : "You snapped the pendulum. Now sling that comet into the beacon.", 3200);
    addQuit();
    window.addEventListener("pointerdown", pDown, true);
    window.addEventListener("pointermove", pMove, true);
    window.addEventListener("pointerup", pUp, true);
    sky.kick();
  }

  let quitBtn = null;
  function addQuit() {
    if (quitBtn) return;
    quitBtn = document.createElement("button");
    quitBtn.type = "button"; quitBtn.className = "pill ghost";
    quitBtn.style.cssText = "position:fixed;z-index:26;right:16px;top:calc(env(safe-area-inset-top) + 16px);pointer-events:auto";
    quitBtn.innerHTML = '<span class="kbd">esc</span> quit';
    quitBtn.addEventListener("click", () => stop("quit"));
    document.body.appendChild(quitBtn);
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }

  function stop(why) {
    if (!on) return;
    on = false; st = "off"; comet = null; drag = null;
    document.body.classList.remove("gaming", "aiming");
    hud.hidden = true; hudMsg.textContent = "";
    if (quitBtn) { quitBtn.remove(); quitBtn = null; }
    window.removeEventListener("pointerdown", pDown, true);
    window.removeEventListener("pointermove", pMove, true);
    window.removeEventListener("pointerup", pUp, true);
    sky.planets.forEach((p) => { p.tx = p.sx; p.ty = p.sy; p.tR = p.sR; p.release = true; p.el.classList.remove("off"); });
    sky.mode = "idle";
    sky.resetPendulum();
    if (onExit) onExit(why, { level: lvlI + 1, shots: total + shots });
  }

  function nextLevel() {
    total += shots; shots = 0;
    if (lvlI >= S.LEVELS.length - 1) { win(); return; }
    lvlI++; st = "enter"; enterT = performance.now(); comet = null; trail = []; angle = -0.1; power = 0.55;
    from = null; placePlanets(); setHud();
    say(`Level ${lvlI + 1}: ${lvl().name}`, 1800);
  }

  function win() {
    st = "won";
    let best = null;
    try { best = +localStorage.getItem("nk.sling.best") || null; if (!best || total < best) localStorage.setItem("nk.sling.best", String(total)); } catch (_) {}
    const [bx, by] = toScreen(lvl().beacon.x, lvl().beacon.y);
    sky.ring(bx, by, 700, 20, 0.6, 2); sky.spark(bx, by, 60, 260, [255, 138, 61]);
    say(`All ${S.LEVELS.length} beacons lit in <b>${total}</b> shots${best && best < total ? ` (best ${best})` : best && total < best ? " — new best!" : ""}.<br>` +
      `<button type="button" class="run" data-g="again">play again</button> · <button type="button" class="run" data-g="quit">back to universe</button>`);
    hudMsg.querySelectorAll("[data-g]").forEach((b) => b.addEventListener("click", () => (b.dataset.g === "again" ? (stop("again"), start("terminal")) : stop("won"))));
    const again = hudMsg.querySelector("[data-g=again]"); if (again) again.focus();
  }

  function launch() {
    if (st !== "aim") return;
    shots++; setHud();
    comet = S.launch(angle, power); trail = []; st = "fly";
    const [x, y] = toScreen(comet.x, comet.y);
    sky.spark(x, y, 10, 120, [255, 138, 61]);
  }

  // ---------- input ----------
  function pDown(e) {
    if (!on || e.target.closest("button")) return;
    if (st !== "aim") return;
    e.preventDefault();
    drag = { x: e.clientX, y: e.clientY, a0: angle, p0: power, moved: false };
    document.body.classList.add("aiming");
  }
  function pMove(e) {
    if (!drag) return;
    const dx = drag.x - e.clientX, dy = drag.y - e.clientY; // pull back → shoot forward
    if (Math.hypot(dx, dy) < 8) return;
    drag.moved = true;
    const [vx, vy] = toVirtualVec(dx, dy);
    angle = Math.atan2(vy, vx);
    power = Math.max(0.05, Math.min(1, Math.hypot(dx, dy) / Math.max(120, Math.min(sky.size.W, sky.size.H) * 0.32)));
    sky.kick();
  }
  function pUp() {
    if (!drag) return;
    document.body.classList.remove("aiming");
    const moved = drag.moved; drag = null;
    if (moved) launch();
  }

  function onKey(e) {
    if (!on) return false;
    const k = e.key;
    if (k === "Escape") { stop("quit"); return true; }
    if (st === "won") return false;
    if (k === "r" || k === "R") { st = "aim"; comet = null; say("Reset. Take your time.", 1200); return true; }
    if (st !== "aim") return ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(k);
    const fine = e.shiftKey ? 0.25 : 1;
    const rotSign = map.rot ? -1 : 1;
    if (k === "ArrowLeft") angle -= 0.035 * fine * rotSign;
    else if (k === "ArrowRight") angle += 0.035 * fine * rotSign;
    else if (k === "ArrowUp") power = Math.min(1, power + 0.04 * fine);
    else if (k === "ArrowDown") power = Math.max(0.05, power - 0.04 * fine);
    else if (k === " " || k === "Enter") launch();
    else return false;
    sky.kick();
    return true;
  }

  // ---------- per-frame (called from sky's loop) ----------
  function draw(ctx, dt) {
    if (!on) return;
    const now = performance.now();
    if (msgT && now > msgT) { hudMsg.textContent = ""; msgT = 0; }
    const L = lvl();
    const [lx, ly] = toScreen(S.LAUNCH.x, S.LAUNCH.y);

    // beacon: slow-turning dotted ring (no flashing)
    const [bx, by] = toScreen(L.beacon.x, L.beacon.y), br = S.BEACON_R * map.s;
    const rot = now / 2400;
    ctx.fillStyle = `rgba(${ORANGE},.9)`;
    ctx.beginPath();
    for (let k = 0; k < 16; k++) { const a = rot + (k / 16) * TAU; ctx.rect(bx + Math.cos(a) * br - 1.4, by + Math.sin(a) * br - 1.4, 2.8, 2.8); }
    ctx.fill();
    ctx.fillStyle = `rgba(${EMBER},.95)`; ctx.beginPath(); ctx.arc(bx, by, 3.2, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(${ORANGE},.12)`; ctx.beginPath(); ctx.arc(bx, by, br * 1.7, 0, TAU); ctx.fill();

    if (st === "enter") {
      const q = Math.min(1, (now - enterT) / 900);
      const e = 1 - Math.pow(1 - q, 3);
      const sx = from ? from.x : lx, sy = from ? from.y : ly;
      const x = sx + (lx - sx) * e, y = sy + (ly - sy) * e;
      comet_dot(ctx, x, y, 1);
      if (from) sky.addHeat(x, y, 0.2, 0);
      if (q >= 1) st = "aim";
      return;
    }

    if (st === "aim") {
      // launch pad + aim preview
      const pts = S.preview(L, angle, power, 0.6, 5);
      ctx.fillStyle = `rgba(${CYAN},.75)`;
      ctx.beginPath();
      for (let k = 0; k < pts.length; k += 2) {
        const [x, y] = toScreen(pts[k], pts[k + 1]);
        const s = 2.4 * (1 - k / pts.length) + 0.8;
        ctx.rect(x - s / 2, y - s / 2, s, s);
      }
      ctx.fill();
      // power meter: dotted arc around the comet
      const segs = 20, lit = Math.round(power * segs);
      for (let k = 0; k < segs; k++) {
        const a = -Math.PI / 2 + (k / segs) * TAU, r = 18;
        ctx.fillStyle = k < lit ? `rgba(${EMBER},.9)` : `rgba(${CYAN},.18)`;
        ctx.fillRect(lx + Math.cos(a) * r - 1.2, ly + Math.sin(a) * r - 1.2, 2.4, 2.4);
      }
      comet_dot(ctx, lx, ly, 1);
      return;
    }

    if (st === "fly" && comet) {
      const n = Math.max(1, Math.round((dt || 1 / 60) / S.H));
      let res = null;
      for (let i = 0; i < n && !res; i++) res = S.step(comet, L);
      const [cx, cy] = toScreen(comet.x, comet.y);
      trail.push(cx, cy); if (trail.length > 60) trail.splice(0, 2);
      sky.addHeat(cx, cy, 0.28, 0);
      ctx.fillStyle = `rgba(${EMBER},.5)`;
      ctx.beginPath();
      for (let k = 0; k < trail.length; k += 4) ctx.rect(trail[k] - 1, trail[k + 1] - 1, 2, 2);
      ctx.fill();
      comet_dot(ctx, cx, cy, 1);
      if (res) {
        if (res.r === "hit") {
          sky.ring(bx, by, 520, 14, 0.55, 1.2); sky.spark(bx, by, 36, 200, [255, 138, 61]);
          say(`Beacon lit${shots === 1 ? " first try" : ""}.`, 1400);
          st = "between"; setTimeout(() => on && nextLevel(), 1100);
        } else if (res.r === "crash") {
          const w = NK.data.worlds[res.planet.w];
          sky.spark(cx, cy, 24, 160, [255, 178, 122]);
          for (let k = 0; k < 12; k++) sky.addHeat(cx + (Math.random() - 0.5) * 30, cy + (Math.random() - 0.5) * 30, 0.5, 0);
          say(`Crashed into ${w.name}. Gravity wins this one — try again.`, 2000);
          st = "aim"; comet = null;
        } else {
          say("Lost in space. Try a different angle.", 1800);
          st = "aim"; comet = null;
        }
      }
    }
  }

  function comet_dot(ctx, x, y, a) {
    ctx.fillStyle = `rgba(${ORANGE},${0.18 * a})`; ctx.beginPath(); ctx.arc(x, y, 12, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(${EMBER},${a})`; ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(${ICE},${a})`; ctx.beginPath(); ctx.arc(x - 1.2, y - 1.2, 1.6, 0, TAU); ctx.fill();
  }

  function resize() { if (!on) return; fit(); placePlanets(); }

  return { start, stop, draw, onKey, resize, active: () => on, onExit: (f) => (onExit = f) };
})();
