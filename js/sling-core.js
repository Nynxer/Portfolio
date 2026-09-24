/* ORBIT SLING — pure physics + levels (no DOM). Shared by game.js and tests. */
(function (root) {
  "use strict";
  const VW = 1600, VH = 1000;              // virtual board (landscape)
  const G = 2600;                          // gravity constant (virtual units)
  const H = 1 / 240;                       // fixed physics step
  const MAX_T = 9;                         // seconds before a shot counts as lost
  const COMET_R = 8, BEACON_R = 30, MARGIN = 260;
  const LAUNCH = { x: 170, y: 500 };

  // w = index into NK.data.worlds (which planet plays the part)
  const LEVELS = [
    { name: "First light", beacon: { x: 1390, y: 610 }, planets: [{ w: 0, x: 820, y: 380, R: 110 }] },
    { name: "In the way", beacon: { x: 1420, y: 500 }, planets: [{ w: 1, x: 800, y: 500, R: 120 }] },
    { name: "Around the back", beacon: { x: 1040, y: 860 }, planets: [{ w: 2, x: 900, y: 560, R: 130 }] },
    { name: "Two moons", beacon: { x: 1420, y: 250 }, planets: [{ w: 3, x: 640, y: 330, R: 95 }, { w: 0, x: 1000, y: 660, R: 115 }] },
    { name: "Grand tour", beacon: { x: 1440, y: 830 }, planets: [{ w: 0, x: 700, y: 290, R: 105 }, { w: 1, x: 1180, y: 620, R: 80 }, { w: 2, x: 560, y: 760, R: 85 }, { w: 3, x: 1250, y: 230, R: 80 }, { w: 4, x: 930, y: 500, R: 55 }] }
  ];

  const speed = (power) => 260 + power * 900;

  function launch(angle, power) {
    const v = speed(power);
    return { x: LAUNCH.x, y: LAUNCH.y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v, t: 0 };
  }

  // Advance one fixed step. Returns null while flying, or {r:'hit'|'crash'|'lost', planet}
  function step(s, lvl) {
    let ax = 0, ay = 0;
    for (const p of lvl.planets) {
      const dx = p.x - s.x, dy = p.y - s.y, d2 = dx * dx + dy * dy, d = Math.sqrt(d2);
      if (d < p.R * 0.92 + COMET_R * 0.5) return { r: "crash", planet: p };
      const a = (G * p.R * p.R) / Math.max(d2, p.R * p.R);
      ax += (a * dx) / d; ay += (a * dy) / d;
    }
    s.vx += ax * H; s.vy += ay * H;
    s.x += s.vx * H; s.y += s.vy * H; s.t += H;
    const b = lvl.beacon;
    if ((s.x - b.x) ** 2 + (s.y - b.y) ** 2 < (BEACON_R + COMET_R) ** 2) return { r: "hit" };
    if (s.x < -MARGIN || s.x > VW + MARGIN || s.y < -MARGIN || s.y > VH + MARGIN || s.t > MAX_T) return { r: "lost" };
    return null;
  }

  function simulate(lvl, angle, power, maxSteps) {
    const s = launch(angle, power), n = maxSteps || MAX_T / H + 5;
    for (let i = 0; i < n; i++) { const r = step(s, lvl); if (r) return r.r; }
    return "flying";
  }

  // Short trajectory preview (for aiming): returns [x,y,...] every `every` steps.
  function preview(lvl, angle, power, seconds, every) {
    const s = launch(angle, power), out = [];
    const n = Math.round(seconds / H);
    for (let i = 0; i < n; i++) {
      if (step(s, lvl)) break;
      if (i % every === 0) out.push(s.x, s.y);
    }
    return out;
  }

  const api = { VW, VH, H, LEVELS, LAUNCH, COMET_R, BEACON_R, launch, step, simulate, preview, speed };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else { root.NK = root.NK || {}; root.NK.sling = api; }
})(typeof window !== "undefined" ? window : globalThis);
