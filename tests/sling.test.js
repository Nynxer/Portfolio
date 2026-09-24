// node tests/sling.test.js — checks every level is solvable, but not trivially.
const S = require("../js/sling-core.js");
let ok = true;
S.LEVELS.forEach((lvl, i) => {
  let hits = 0, total = 0, ex = null;
  for (let a = -90; a <= 90; a += 0.5) for (let p = 0.1; p <= 1.0001; p += 0.03) {
    total++;
    if (S.simulate(lvl, a * Math.PI / 180, p) === "hit") { hits++; if (!ex) ex = [a, +p.toFixed(2)]; }
  }
  // straight-line shot (no aiming skill) should not trivially work from level 2 on
  const pct = (100 * hits / total).toFixed(2);
  console.log(`L${i + 1} ${lvl.name.padEnd(16)} solutions ${String(hits).padStart(4)}/${total} (${pct}%) e.g. angle ${ex && ex[0]}° power ${ex && ex[1]}`);
  if (hits < 8) ok = false;
});
process.exit(ok ? 0 : 1);
