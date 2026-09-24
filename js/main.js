/* ==========================================================================
   MAIN — wires sky, terminal, game, simple view, keyboard and URL hash.
   Deep links: #/developer  #/developer/tasky  #/whoami  #simple  #sling
   ========================================================================== */
(function () {
  "use strict";
  const D = NK.data, sky = NK.sky, term = NK.term, game = NK.game;
  const $ = (s) => document.querySelector(s);
  const body = document.body;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const note = $("#bio");
  const PIN = '<svg class="pin" viewBox="0 0 10 14" width="10" height="14" aria-label="Location" role="img">' +
    [[3,1],[5,1],[7,1],[1,3],[3,3],[7,3],[9,3],[1,5],[3,5],[7,5],[9,5],[3,7],[5,7],[7,7],[3,9],[5,9],[7,9],[5,11],[5,13]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".95"/>`).join("") + "</svg>";
  const bioLines = (arr, cls) => arr.map((l, i) => `<span class="bio-l ${cls}${i ? " ind" : ""}">${i === 0 ? PIN : ""}<span>${esc(l).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")}</span></span>`).join("");
  // the "doors" close exactly the space the two lines occupy
  const setGap = () => { const cs = getComputedStyle(note); document.documentElement.style.setProperty("--gap", (note.offsetHeight + parseFloat(cs.marginTop)) + "px"); };
  window.addEventListener("resize", setGap);
  requestAnimationFrame(setGap);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(setGap);
  note.innerHTML = `<span class="bio-in">${bioLines(D.person.about, "bio-long") + bioLines(D.person.aboutShort || D.person.about, "bio-short")}</span>`;
  $("#nav-resume").href = D.links.resume.url;
  $("#hello-sr").textContent = `${D.person.intro.join(" ")}, ${D.person.sparkLine}:`;
  document.getElementById("hello").setAttribute("aria-label", $("#hello-sr").textContent);

  // ---------- motion ----------
  const btnMotion = $("#btn-motion");
  function setMotion(on) {
    sky.setMotion(on);
    btnMotion.setAttribute("aria-pressed", String(!on));
    btnMotion.classList.toggle("paused", !on);
    btnMotion.querySelector(".lbl").textContent = on ? "Pause motion" : "Play motion";
    btnMotion.title = on ? "Pause motion" : "Resume motion";
    store.set("nk.motion", on ? "1" : "0");
  }
  btnMotion.addEventListener("click", () => setMotion(!sky.motion));
  const savedMotion = store.get("nk.motion");
  setMotion(savedMotion ? savedMotion === "1" : !reduced);

  // ---------- simple view ----------
  const simple = $("#simple");
  let simpleOpener = null;
  function renderSimple() {
    const P = D.person, L = D.links;
    simple.innerHTML = `<div class="simple-in">
      <div class="simple-top"><button type="button" class="pill ghost" id="simple-back">← <span>Back to universe</span></button><button type="button" class="pill ghost" onclick="print()">Print</button></div>
      <h1>${esc(P.name)}</h1>
      <p class="lead">${esc(P.role)} · ${esc(P.location)}</p>
      ${P.openTo ? `<p class="lead"><b>${esc(P.openTo)}</b></p>` : ""}
      <ul class="o-hl" style="margin:24px 0 28px">${P.highlights.map(([a, b]) => `<li><b>${esc(a)}</b> — ${esc(b)}</li>`).join("")}</ul>
      ${P.bio.map((b) => `<p>${esc(b)}</p>`).join("")}
      <div class="links">${["email", "github", "linkedin", "resume"].map((k) => `<a href="${esc(L[k].url)}"${k === "email" ? "" : ' target="_blank" rel="noopener"'}>${esc(k === "resume" ? "Résumé ↗" : L[k].label)}</a>`).join("")}</div>
      <h2>Projects</h2>
      ${D.worlds.map((w) => `<section aria-labelledby="sw-${w.id}"><div class="world-h"><h3 id="sw-${w.id}">${esc(w.name)}</h3><span>${esc(w.tagline)}</span></div>
        <ul>${w.projects.map((p) => `<li class="p"><h3>${esc(p.title)}${p.repo ? ` <a href="${esc(p.repo)}" target="_blank" rel="noopener">repo ↗</a>` : ""}</h3><p>${esc(p.summary)}</p><p class="g">${p.tags.map(esc).join(" · ")}</p></li>`).join("")}</ul></section>`).join("")}
      <h2>Experience</h2>
      <ul>${D.experience.map((e) => `<li class="p"><h3>${esc(e.role)} · ${esc(e.org)}</h3><p class="dim">${esc(e.when)} · ${esc(e.where)}</p><p>${esc(e.what)}</p></li>`).join("")}</ul>
      <h2>Education</h2>
      <ul>${D.education.map((e) => `<li class="p"><h3>${esc(e.what)}</h3><p>${esc(e.org)} · ${esc(e.when)}</p></li>`).join("")}</ul>
      <h2>Skills</h2>
      <p>${D.skills.map(esc).join(" · ")}</p>
      <h2>Writing</h2>
      <ul>${(NK.posts || []).map((p) => `<li class="p"><h3><a href="#/blog/${p.slug}">${esc(p.title)}</a></h3><p>${esc(p.summary)}</p></li>`).join("")}</ul>
      <p class="dim" style="margin-top:56px;font-size:12px">Prefer typing? Press <span class="kbd">esc</span> and use the terminal.</p>
    </div>`;
    $("#simple-back").addEventListener("click", () => showSimple(false));
  }
  function showSimple(on) {
    if (on) {
      if (!simple.innerHTML) renderSimple();
      simpleOpener = document.activeElement;
      simple.hidden = false; body.style.overflow = "hidden";
      sky.setMotion(false);
      simple.scrollTop = 0; simple.focus();
      setHash("simple");
    } else {
      if (simple.hidden) return;
      simple.hidden = true; body.style.overflow = "";
      sky.setMotion(store.get("nk.motion") !== "0" && !(reduced && !store.get("nk.motion")));
      setHash("");
      (simpleOpener && simpleOpener.focus ? simpleOpener : $("#btn-simple")).focus({ preventScroll: true });
    }
  }
  $("#btn-simple").addEventListener("click", () => showSimple(true));

  // ---------- nav + planets route through the terminal ----------
  document.querySelectorAll("[data-cmd]").forEach((b) => b.addEventListener("click", () => { term.type(b.dataset.cmd); term.focus(); }));
  let planetOpener = null;
  // Click a world: it bursts into embers first, then the terminal opens on a clean screen.
  sky.on("open", (w) => {
    planetOpener = document.activeElement;
    sky.burst(D.worlds.indexOf(w));
    // desktop: the panel opens beside the worlds, so the burst stays in view; phones: let it play first
    const wait = matchMedia("(max-width:760px)").matches ? 700 : 260;
    setTimeout(() => { term.type(`cd ~/universe/${w.id} && ls`); term.focus(); }, wait);
  });
  sky.on("hover", (w) => {
    term.setStatus(w ? `<b>${esc(w.name)}</b>${esc(w.tagline)} <span class="dim"> · </span><span class="k">cd ${esc(w.id)}</span>` : "");
    const i = term.input;
    i.placeholder = w ? `cd ${w.id}` : defaultPH();
  });
  const defaultPH = () => (matchMedia("(pointer:coarse)").matches ? "tap below, or type" : "type a command…  try ls");
  term.input.placeholder = defaultPH();

  // pendulum feedback + the hidden game
  sky.on("grab", (on) => term.setStatus(on ? "the pendulum · give it a shake…" : ""));
  sky.on("charge", (c) => term.setStatus(`<b>${"▮".repeat(Math.round(c * 6))}${"▯".repeat(6 - Math.round(c * 6))}</b> keep shaking…`));
  sky.on("snap", () => { term.setStatus(""); term.close(); game.start("pendulum"); setHash("sling"); });
  game.onExit((why, s) => {
    setHash("");
    if (why === "won") { term.run(`echo "orbit sling: all beacons lit in ${s.shots} shots"`, { history: false }); }
    term.setStatus(why === "won" ? "" : "<b>tip</b> — next time just type sling");
    setTimeout(() => term.setStatus(""), 5000);
    $("#bob").focus({ preventScroll: true });
  });

  term.on("simple", showSimple);
  // Zen mode: while the terminal is open the universe dims and holds still
  const storedMotion = () => (store.get("nk.motion") ? store.get("nk.motion") === "1" : !reduced);
  term.on("zen", (on) => { sky.stow(on); sky.setMotion(on ? false : storedMotion()); });
  term.on("motion", setMotion);
  term.on("replay", () => { setHash(""); note.classList.remove("on"); sky.startIntro(); });
  // blog (Obsidian-style vault)
  const blog = NK.blog;
  term.on("blog", (slug) => { term.close(); blog.open(slug); sky.setMotion(false); });
  blog.onRoute((r) => setHash(r));
  blog.onClose(() => { setHash(""); sky.setMotion(store.get("nk.motion") !== "0" && !(reduced && !store.get("nk.motion"))); });
  term.on("game", (how) => { game.start(how); setHash("sling"); });
  term.on("cwd", (cwd, w) => setHash(w ? w.id : ""));
  term.on("close", () => { if (planetOpener && document.body.contains(planetOpener) && planetOpener.classList.contains("planet")) { planetOpener.focus({ preventScroll: true }); } planetOpener = null; });
  $("#btn-replay").addEventListener("click", () => { term.close(); note.classList.remove("on"); sky.startIntro(); });

  // ---------- keyboard: keyboard-first, mouse optional ----------
  const typingTarget = (el) => el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
  document.addEventListener("keydown", (e) => {
    const a = document.activeElement;
    if (sky.mode === "intro") {
      if (["Shift", "Control", "Alt", "Meta", "Tab"].includes(e.key)) return;
      e.preventDefault(); sky.skipIntro(); return;
    }
    if (game.active()) { if (game.onKey(e)) e.preventDefault(); return; }
    if (!simple.hidden) { if (e.key === "Escape") { e.preventDefault(); showSimple(false); } return; }
    if (blog.isOpen()) { if (e.key === "Escape" && !typingTarget(a)) { e.preventDefault(); blog.close(); } else if (e.key === "Escape") a.blur(); return; }

    if (e.key === "Escape") {
      if (typingTarget(a) && a.value) { a.value = ""; a.dispatchEvent(new Event("input")); return; }
      if (term.isOpen()) { e.preventDefault(); term.close(); if (a === term.input && !planetOpener) a.blur(); return; }
      if (a === term.input) a.blur();
      return;
    }
    if (typingTarget(a) || e.ctrlKey || e.metaKey || e.altKey) return;

    // planets: arrow keys move between worlds
    if (a && a.classList.contains("planet") && e.key.startsWith("Arrow")) {
      const ps = [...document.querySelectorAll(".planet")], i = ps.indexOf(a);
      const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
      ps[(i + d + ps.length) % ps.length].focus(); e.preventDefault(); return;
    }
    if (e.key === "/" || e.key === "`" || e.key === ":") { e.preventDefault(); term.focus(); return; }
    // type-to-start: any printable key goes to the terminal
    if (e.key.length === 1 && e.key !== " " && !(a && a.id === "bob")) {
      term.focus();          // the keypress lands in the input naturally
    }
  });

  // intro skip by pointer too
  document.addEventListener("pointerdown", () => { if (sky.mode === "intro") sky.skipIntro(); }, true);
  // click on empty space collapses an open terminal
  $("#universe").addEventListener("click", (e) => { if (e.target.id === "sky" && term.isOpen() && !game.active()) term.close(); });

  // ---------- URL hash (deep links; works from file:// too) ----------
  let hashLock = false;
  function setHash(h) {
    hashLock = true;
    const url = h ? "#/" + h : location.pathname + location.search;
    try { history.replaceState(null, "", url); } catch (_) {}
    setTimeout(() => (hashLock = false), 0);
  }
  function route() {
    if (hashLock) return false;
    const h = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
    if (!h) return false;
    if (h === "simple") { showSimple(true); return true; }
    if (h === "sling") { game.start("terminal"); return true; }
    if (h === "blog" || h.startsWith("blog/")) {
      const rest = h.slice(5);
      blog.open(rest.startsWith("tag/") ? { tag: rest.slice(4) } : rest || null); sky.setMotion(false);
      return true;
    }
    const parts = h.split("/");
    if (parts.length === 2) { term.run(`cd ~/universe/${parts[0]} && cat ${parts[1]}`); return true; }
    if (term.resolveLoose(parts[0])) { term.run(`cd ${parts[0]} && ls`); return true; }
    term.run(parts[0]);
    return true;
  }
  window.addEventListener("hashchange", route);

  // ---------- boot ----------
  sky.init();
  sky.on("ready", () => {
    note.classList.add("on");
    if (!term.isOpen()) term.motd();
    if (!route() && matchMedia("(pointer:fine)").matches && !document.activeElement.matches("button,a")) term.focus();
  });
  const seen = store.get("nk.seen");
  if (reduced || seen || location.hash) { sky.startIntro(); sky.skipIntro(); }
  else sky.startIntro();
})();
