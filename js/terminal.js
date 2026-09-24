/* ==========================================================================
   TERMINAL — the primary interface. Familiar commands (ls, cd, cat, open,
   help, clear…), tab completion, history, clickable output. Every GUI
   action is routed through here so visitors see the command it ran.
   ========================================================================== */
window.NK = window.NK || {};

NK.term = (function () {
  "use strict";
  const D = NK.data;
  const $ = (s) => document.querySelector(s);
  const term = $("#term"), out = $("#term-out"), form = $("#term-form"), input = $("#term-input");
  const ghost = $("#term-ghost"), psCwd = $("#ps-cwd"), title = $("#term-title"), status = $("#term-status");
  const toggle = $("#term-toggle"), toggleLbl = $("#term-toggle-lbl"), chipsEl = $("#chips");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const hooks = {};

  // ---------- filesystem built from data ----------
  const worlds = D.worlds;
  const posts = () => NK.posts || [];
  const postBy = (q) => { q = String(q || "").toLowerCase().replace(/\.md$/, ""); return posts().find((p) => p.slug === q || p.title.toLowerCase() === q); };
  const FILES = {
    "about.txt": "whoami", "contact.txt": "contact", "experience.txt": "experience",
    "skills.txt": "skills", "resume.pdf": "resume"
  };
  let cwd = [];                                   // [] = ~, ["universe"], ["universe", worldId]
  const pathStr = (p) => "~" + (p.length ? "/" + p.join("/") : "");
  const worldBy = (q) => {
    q = String(q || "").toLowerCase().replace(/\/$/, "");
    return worlds.find((w) => w.id === q || w.name.toLowerCase() === q || (w.aliases || []).includes(q));
  };
  const projBy = (q, w) => {
    q = String(q || "").toLowerCase().replace(/\.md$/, "");
    const pool = w ? w.projects.map((p) => [p, w]) : worlds.flatMap((W) => W.projects.map((p) => [p, W]));
    return pool.find(([p]) => p.id === q || p.title.toLowerCase() === q || p.title.toLowerCase().split(" —")[0] === q) || null;
  };

  // resolve a path → {kind:'home'|'universe'|'world'|'project'|'file', path, world?, project?, cmd?}
  function resolve(arg) {
    if (arg == null || arg === "" || arg === "~" || arg === "/" || arg === "~/") return { kind: "home", path: [] };
    let parts = arg.startsWith("~") || arg.startsWith("/") ? [] : cwd.slice();
    for (const seg of arg.replace(/^~\/?|^\//, "").split("/")) {
      if (!seg || seg === ".") continue;
      if (seg === "..") { parts.pop(); continue; }
      parts.push(seg);
    }
    const [a, b, c] = parts;
    if (parts.length === 0) return { kind: "home", path: [] };
    if (a === "blog") {
      if (!b) return { kind: "blog", path: ["blog"] };
      const po = postBy(b); if (!po || parts.length > 2) return null;
      return { kind: "post", path: ["blog", po.slug + ".md"], post: po };
    }
    if (a === "universe") {
      if (!b) return { kind: "universe", path: ["universe"] };
      const w = worldBy(b); if (!w) return null;
      if (!c) return { kind: "world", path: ["universe", w.id], world: w };
      const pr = projBy(c, w); if (!pr || parts.length > 3) return null;
      return { kind: "project", path: ["universe", w.id, pr[0].id + ".md"], world: w, project: pr[0] };
    }
    if (parts.length === 1 && FILES[a]) return { kind: "file", path: [a], cmd: FILES[a] };
    if (parts.length === 1 && FILES[a + ".txt"]) return { kind: "file", path: [a + ".txt"], cmd: FILES[a + ".txt"] };
    return null;
  }
  // friendly fallback: `cd developer` or `cat tasky` from anywhere
  function resolveLoose(arg) {
    const r = resolve(arg); if (r) return r;
    const name = String(arg || "").replace(/^.*\//, "");
    const w = worldBy(name); if (w) return { kind: "world", path: ["universe", w.id], world: w };
    const pr = projBy(name); if (pr) return { kind: "project", path: ["universe", pr[1].id, pr[0].id + ".md"], world: pr[1], project: pr[0] };
    const po = postBy(name); if (po) return { kind: "post", path: ["blog", po.slug + ".md"], post: po };
    if (/^blogs?$|^posts?$|^notes$/.test(name)) return { kind: "blog", path: ["blog"] };
    return null;
  }
  function childrenOf(path) {
    if (!path.length) return [{ n: "universe/", dir: true }, { n: "blog/", dir: true }, ...Object.keys(FILES).map((n) => ({ n }))];
    if (path.length === 1 && path[0] === "blog") return posts().map((p) => ({ n: p.slug + ".md" }));
    if (path.length === 1 && path[0] === "universe") return worlds.map((w) => ({ n: w.id + "/", dir: true }));
    if (path.length === 2) { const w = worldBy(path[1]); return w ? w.projects.map((p) => ({ n: p.id + ".md" })) : []; }
    return [];
  }

  // ---------- output helpers ----------
  const R = (cmd, label, cls) => `<button type="button" class="run${cls ? " " + cls : ""}" data-run="${esc(cmd)}">${esc(label == null ? cmd : label)}</button>`;
  const F = (fill, label) => `<button type="button" class="run" data-fill="${esc(fill)}">${esc(label)}</button>`;
  const A = (url, label) => `<a href="${esc(url)}" target="${url.startsWith("mailto:") ? "_self" : "_blank"}" rel="noopener">${esc(label)}</a>`;
  function print(html, cls) {
    const p = document.createElement(/<(ul|div|dl|h\d)/.test(html) ? "div" : "p");
    p.className = "ln" + (cls ? " " + cls : "");
    p.innerHTML = html;
    out.appendChild(p);
    follow();
    return p;
  }
  // keep the latest command line in view, showing as much of its output as fits
  let lastCmd = null;
  function follow() {
    requestAnimationFrame(() => {
      const top = lastCmd && lastCmd.isConnected ? lastCmd.offsetTop - out.offsetTop - 6 : out.scrollHeight;
      out.scrollTop = Math.min(top, out.scrollHeight);
    });
  }
  const text = (s, cls) => print(esc(s), cls);

  // ---------- commands ----------
  const C = {};
  const def = (names, desc, run, opts) => { names.split(" ").forEach((n, i) => (C[n] = { name: names.split(" ")[0], desc, run, alias: i > 0, ...(opts || {}) })); };

  def("help ? man", "list commands (help <cmd> for one)", (a) => {
    if (a[0] && C[a[0]]) { const c = C[a[0]]; text(`${c.name} — ${c.desc}${c.usage ? "\nusage: " + c.usage : ""}`); return; }
    const main = [["ls universe", "see my projects"], ["cd <world>", "step into a world"], ["cat <project>", "read one project"], ["whoami", "about me + highlights"], ["blog", "notes & build logs"], ["contact", "email, GitHub, LinkedIn"], ["resume", "open my résumé"]];
    print(`<div class="help-grid">${main.map(([c, d]) => `<span>${c.includes("<") ? F(c.split(" ")[0] + " ", c) : R(c)}</span><span class="d">${esc(d)}</span>`).join("")}</div>`);
    print(`<span class="dim">also:</span> ${["tree", "experience", "skills", "simple", "motion", "history", "clear"].map((c) => R(c)).join("  ")}`);
    print(`<span class="dim">everything here is clickable ·</span> <span class="kbd">tab</span> <span class="dim">completes ·</span> <span class="kbd">esc</span> <span class="dim">goes back</span>`);
  });

  def("ls dir ll", "list worlds, projects and files", (a) => {
    const arg = a.filter((x) => !x.startsWith("-"))[0];
    const r = arg ? resolveLoose(arg) : { kind: cwd.length === 0 ? "home" : cwd[0] === "blog" ? "blog" : cwd.length === 1 ? "universe" : "world", path: cwd, world: worldBy(cwd[1]) };
    if (!r) return text(`ls: cannot access '${arg}': No such file or directory`, "err");
    if (r.kind === "home") {
      print(childrenOf([]).map((c) => (c.dir ? R("ls " + c.n.slice(0, -1), c.n) : R("cat " + c.n, c.n))).join("    "));
    } else if (r.kind === "universe") {
      print(`<ul class="o-list">${worlds.map((w, i) => `<li><div class="t"><span class="n">${String(i + 1).padStart(2, "0")}</span>${R("cd " + w.id + " && ls", w.name)}</div><p class="s">${esc(w.tagline)} <span class="dim">${w.projects.length} project${w.projects.length === 1 ? "" : "s"}</span></p></li>`).join("")}</ul>`);
    } else if (r.kind === "world") {
      listWorld(r.world);
    } else if (r.kind === "blog") {
      listBlog();
    } else if (r.kind === "post") {
      print(R("cat blog/" + r.post.slug, r.post.slug + ".md"));
    } else if (r.kind === "project") {
      print(R("cat " + r.path.slice(-1)[0], r.path.slice(-1)[0]));
    } else text(r.path[0]);
  }, { usage: "ls [path]", complete: "path" });

  function listBlog() {
    const ps = posts();
    print(`<p class="o-kicker">blog · written in obsidian</p><h2 class="o-title">Notes & build logs</h2>`);
    print(`<ul class="o-list">${ps.map((p, i) => `<li><div class="t"><span class="n">${String(i + 1).padStart(2, "0")}</span>${R("cat blog/" + p.slug, p.title)}</div><p class="s">${esc(p.summary)}</p><p class="g">${esc(p.date)} · ${p.tags.map((t) => "#" + esc(t)).join(" ")}${p.placeholder ? ' · <span class="am">placeholder</span>' : ""}</p></li>`).join("")}</ul>`);
    print(`<div class="o-actions">${R("blog", "open the blog →")}</div>`);
  }

  function listWorld(w) {
    const n = w.projects.length;
    print(`<p class="o-kicker hl">${String(n).padStart(2, "0")} project${n === 1 ? "" : "s"}</p><h2 class="o-display">${esc(w.name)}</h2><p class="o-body">${esc(w.tagline)} ${esc(w.desc)}</p>`);
    print(`<ul class="o-rows">${w.projects.map((p, i) => `<li><span class="n">${String(i + 1).padStart(2, "0")}</span><div>${R("cat " + p.id, p.title)}<p>${esc(p.summary)}</p></div><span class="g">${p.tags.map(esc).join(" · ")}</span></li>`).join("")}</ul>`);
    const next = worlds[(worlds.indexOf(w) + 1) % worlds.length];
    print(`<div class="o-actions">${R("cd ..", "← all worlds")}${R("cd ../" + next.id + " && ls", "next: " + next.name + " →")}</div>`);
  }

  def("cd", "move into a world (cd developer, cd .., cd ~)", (a) => {
    const arg = a[0];
    const r = arg == null ? { kind: "home", path: [] } : resolveLoose(arg);
    if (!r) return text(`cd: no such world or directory: ${arg}  — try ${"ls ~/universe"}`, "err");
    if (r.kind === "project" || r.kind === "file" || r.kind === "post") return text(`cd: not a directory: ${arg} (use cat)`, "err");
    setCwd(r.path);
  }, { usage: "cd <world>", complete: "dir" });

  def("pwd", "print working directory", () => text("/home/nikhil" + pathStr(cwd).slice(1)));

  def("cat less more", "read a project or file", (a) => {
    if (!a[0]) return text("cat: which file? try " + "ls", "err");
    const r = resolveLoose(a[0]);
    if (!r) return text(`cat: ${a[0]}: No such file`, "err");
    if (r.kind === "file") return run(r.cmd, { echo: false });
    if (r.kind === "post") { text(`opening ${r.post.title} …`, "dim"); hooks.blog && hooks.blog(r.post.slug); return; }
    if (r.kind !== "project") return text(`cat: ${a[0]}: Is a directory — try cd ${a[0]}`, "err");
    const { project: p, world: w } = r;
    print(`<p class="o-kicker">${esc(w.name)} / ${esc(p.id)}.md</p><h2 class="o-title">${esc(p.title)}</h2><p class="o-body">${esc(p.summary)}</p><p class="o-list g" style="margin:8px 0 0">${p.tags.map(esc).join(" · ")}</p>`);
    const links = [];
    if (p.repo) links.push(A(p.repo, "source ↗")); else links.push(A(D.links.github.url, "more on github ↗"));
    if (p.demo) links.push(A(p.demo, "demo ↗"));
    print(`<div class="o-actions">${links.join("")}${R("cd ~/universe/" + w.id + " && ls", "← " + w.name)}</div>`);
  }, { usage: "cat <file>", complete: "file" });

  def("open xdg-open start", "open a link: resume, github, linkedin, email", (a) => {
    const k = String(a[0] || "").toLowerCase().replace(/\.(pdf|txt|md)$/, "");
    const map = { resume: "resume", cv: "resume", github: "github", gh: "github", linkedin: "linkedin", email: "email", mail: "email" };
    if (map[k]) { const l = D.links[map[k]]; text(`opening ${l.label} …`, "dim"); window.open(l.url, map[k] === "email" ? "_self" : "_blank", "noopener"); return; }
    if (!a[0]) return text("open: what? try open resume", "err");
    const r = resolveLoose(a[0]);
    if (r && r.kind === "project") return run("cat " + r.project.id, { echo: false });
    if (r && r.kind === "world") return run("cd " + r.world.id + " && ls", { echo: false });
    text(`open: can't find '${a[0]}'`, "err");
  }, { usage: "open <thing>", complete: "open" });

  def("blog notes posts read", "read my notes (Obsidian-style)", (a) => {
    const po = a[0] ? postBy(a[0].replace(/^blog\//, "")) : null;
    if (a[0] && !po) return text(`blog: no note called '${a[0]}' — try ls blog`, "err");
    text(po ? `opening ${po.title} …` : "opening the blog — esc to come back", "dim");
    hooks.blog && hooks.blog(po ? po.slug : null);
  }, { usage: "blog [note]", complete: "post" });

  def("tree", "everything at once", () => {
    const lines = ["~", "├── universe/"];
    worlds.forEach((w, i) => {
      const last = i === worlds.length - 1;
      lines.push(`│   ${last ? "└──" : "├──"} ${R("cd " + w.id, w.id + "/")}`);
      w.projects.forEach((p, j) => lines.push(`│   ${last ? "    " : "│   "}${j === w.projects.length - 1 ? "└──" : "├──"} ${R("cat " + p.id, p.id + ".md")}`));
    });
    const fs = Object.keys(FILES);
    fs.forEach((f, i) => lines.push(`${i === fs.length - 1 ? "└──" : "├──"} ${R("cat " + f, f)}`));
    print(lines.join("\n"));
  });

  def("whoami about", "who is Nikhil?", () => {
    const P = D.person;
    print(`<h2 class="o-title">${esc(P.name)}</h2><p class="o-kicker" style="margin-top:4px">${esc(P.role)} · ${esc(P.location)}</p><p class="o-body">${esc(P.bio[0])} ${esc(P.bio[1])}</p>`);
    print(`<ul class="o-hl">${P.highlights.map(([a, b]) => `<li><b>${esc(a)}</b> — ${esc(b)}</li>`).join("")}</ul>`);
    print(`<div class="o-actions">${R("ls universe", "projects")}${R("experience")}${R("contact")}${A(D.links.resume.url, "résumé ↗")}</div>`);
  });

  def("experience exp work", "where I've worked and studied", () => {
    print(`<ul class="o-list">${D.experience.map((e) => `<li><div class="t"><span class="w">${esc(e.role)}</span><span class="dim">${esc(e.org)} · ${esc(e.when)}</span></div><p class="s" style="margin-left:0">${esc(e.what)}</p></li>`).join("")}</ul>`);
    print(`<p class="o-kicker" style="margin-top:14px">education</p>` + D.education.map((e) => `<p class="ln"><span class="w">${esc(e.what)}</span> <span class="dim">— ${esc(e.org)} · ${esc(e.when)}</span></p>`).join(""));
  });

  def("skills stack", "tools I actually use", () => print(`<span class="w">${D.skills.map(esc).join(" · ")}</span>\n<span class="dim">see them in use →</span> ${R("tree")}`));

  def("contact", "how to reach me", () => {
    const L = D.links;
    print(`<dl class="kv"><dt>email</dt><dd>${A(L.email.url, L.email.label)}</dd><dt>github</dt><dd>${A(L.github.url, L.github.label)}</dd><dt>linkedin</dt><dd>${A(L.linkedin.url, L.linkedin.label)}</dd><dt>resume</dt><dd>${A(L.resume.url, L.resume.label)}</dd></dl>`);
  });
  def("resume cv", "open my résumé (PDF)", () => run("open resume", { echo: false }));
  def("github gh", "open GitHub", () => run("open github", { echo: false }));
  def("linkedin", "open LinkedIn", () => run("open linkedin", { echo: false }));
  def("email mail", "write me an email", () => run("open email", { echo: false }));

  def("clear cls", "clear the screen (ctrl+l)", () => { out.innerHTML = ""; });
  def("history", "commands you've run", () => text(hist.map((h, i) => `${String(i + 1).padStart(4)}  ${h}`).join("\n") || "(empty)"));
  def("echo", "print text", (a) => text(a.join(" ")));
  def("date", "print the date", () => text(new Date().toString()));
  def("simple gui plain", "plain, scrollable page (no motion)", () => { text("opening simple view — esc to come back", "dim"); hooks.simple && hooks.simple(true); });
  def("motion pause", "motion on|off — pause the animation", (a) => {
    const want = a[0] === "on" ? true : a[0] === "off" ? false : !NK.sky.motion;
    hooks.motion && hooks.motion(want); text(`motion ${want ? "on" : "off"}`, "dim");
  }, { usage: "motion [on|off]" });
  def("replay", "replay the intro", () => { close(); hooks.replay && hooks.replay(); });
  def("exit close quit q", "close the terminal", () => { close(); });

  // hidden
  def("sling play game", "", () => {
    close();
    if (NK.sky.mode !== "idle") return;
    hooks.game && hooks.game("terminal");
  }, { hidden: true });
  def("hello hi hey", "", () => print(`hey, I'm Nikhil. Type ${R("help")} or click a planet.`), { hidden: true });
  def("rm rmdir mv", "", () => text("rm: permission denied — the universe is read-only.", "err"), { hidden: true });
  def("vim vi nano emacs", "", () => text("read-only universe. (and yes, :q works here too)", "dim"), { hidden: true });
  def(":q :wq", "", () => close(), { hidden: true });
  def("sudo", "", (a) => {
    const line = a.join(" ");
    if (/^rm\s+-(rf|fr|r\s*-f)\s+(\/|~|\/\*|~\/universe|universe)\/?\*?\s*$/.test(line) || /^rm\s+-rf\s+--no-preserve-root/.test(line)) return egg();
    text(`[sudo] password for visitor: ········\nnikhil is not in the sudoers file. This incident will be reported.`, "err");
  }, { hidden: true });

  // ---------- EASTER EGG: sudo rm -rf / ----------
  let eggRunning = false;
  // Stage mode: the terminal steps aside (collapses to its prompt) so the effect is
  // visible; each line is echoed in the caption above the prompt, then it reopens.
  function egg() {
    if (eggRunning) return; eggRunning = true;
    const sky = NK.sky, hero = document.querySelector(".hero");
    const say = (msg, cls) => { text(msg, cls); setStatus(`<span class="${cls === "ok" ? "k" : "hot-t"}">${esc(msg)}</span>`); };
    text("[sudo] password for visitor: ········", "dim");
    setTimeout(() => {
      close(); document.body.classList.add("staged"); input.disabled = true;
      say("well… you asked for it.", "err");
      let i = 0;
      const iv = setInterval(() => {
        if (i < worlds.length) { say(`removed '~/universe/${worlds[i].id}/'`, "err"); sky.burst(i); i++; return; }
        clearInterval(iv);
        hero.style.transition = "opacity .8s"; hero.style.opacity = ".08";
        setTimeout(() => say("kernel panic — not syncing: universe not found", "err"), 600);
        setTimeout(() => {
          say("…just kidding. restoring from backup: git stash pop ✓", "ok");
          sky.regrow(); hero.style.opacity = "";
        }, 2400);
        setTimeout(() => {
          document.body.classList.remove("staged"); input.disabled = false; eggRunning = false;
          setStatus("");
          text("achievement unlocked: root of all evil. (psst — the pendulum is also a toy.)", "dim");
          open(); input.focus({ preventScroll: true });
        }, 4200);
      }, 420);
    }, 500);
  }

  // ---------- state + chrome ----------
  function setCwd(p) {
    const prevW = cwd[1] ? worlds.findIndex((w) => w.id === cwd[1]) : -1;
    cwd = p.slice();
    const w = cwd[1] ? worldBy(cwd[1]) : null, wi = w ? worlds.indexOf(w) : -1;
    if (prevW >= 0 && prevW !== wi) NK.sky.regrow(prevW);
    if (wi >= 0 && wi !== prevW) NK.sky.burst(wi);
    psCwd.textContent = pathStr(cwd);
    title.textContent = pathStr(cwd);
    renderChips();
    hooks.cwd && hooks.cwd(cwd, w);
  }
  function renderChips() {
    let list;
    if (cwd[0] === "blog") {
      list = [["cd ..", "← back"], ...posts().slice(0, 2).map((p) => ["cat " + p.slug, p.slug]), ["blog", "open blog", 1]];
    } else if (cwd.length === 2) {
      const w = worldBy(cwd[1]), next = worlds[(worlds.indexOf(w) + 1) % worlds.length];
      list = [["cd ..", "← back"], ...w.projects.slice(0, 2).map((p) => ["cat " + p.id, "cat " + p.id]), ["cd ../" + next.id + " && ls", "next world →"]];
    } else {
      list = [["ls universe", "projects", 1], ["whoami", "about"], ["blog", "blog"], ["contact", "contact"]];
    }
    chipsEl.innerHTML = list.map(([c, l, h]) => `<button type="button" class="chip${h ? " hl" : ""}" data-type="${esc(c)}" title="runs: ${esc(c)}">${esc(l)}</button>`).join("");
  }

  const scrim = document.createElement("div");
  scrim.className = "term-open-scrim"; scrim.setAttribute("aria-hidden", "true");
  term.parentNode.insertBefore(scrim, term);
  scrim.addEventListener("click", () => close());
  function open() {
    if (term.classList.contains("open")) return;
    term.classList.add("open"); document.body.classList.add("t-open");
    hooks.zen && hooks.zen(true); toggle.setAttribute("aria-expanded", "true"); toggleLbl.textContent = "close";
  }
  function close() {
    const was = term.classList.contains("open");
    term.classList.remove("open"); document.body.classList.remove("t-open");
    if (was && hooks.zen) hooks.zen(false); toggle.setAttribute("aria-expanded", "false"); toggleLbl.textContent = "close";
    if (cwd.length === 2) setCwd([]);
    hooks.close && hooks.close();
  }
  const isOpen = () => term.classList.contains("open");

  // ---------- run ----------
  const hist = (() => { try { return JSON.parse(localStorage.getItem("nk.hist") || "[]"); } catch (_) { return []; } })();
  let hi = hist.length;
  function tokenize(s) { return (s.match(/"[^"]*"|'[^']*'|\S+/g) || []).map((t) => t.replace(/^["']|["']$/g, "")); }

  function run(line, opts) {
    opts = opts || {};
    line = String(line).trim();
    if (!line) return;
    if (opts.echo !== false) {
      const p = print(`<span class="c-path">${esc(pathStr(cwd))}</span><span class="c-arrow">❯</span>${esc(line)}`, "cmd");
      open();
      if (opts.history !== false) { if (hist[hist.length - 1] !== line) hist.push(line); if (hist.length > 60) hist.shift(); hi = hist.length; try { localStorage.setItem("nk.hist", JSON.stringify(hist)); } catch (_) {} }
      lastCmd = p; follow();
    }
    for (const part of line.split(/\s*&&\s*|\s*;\s*/)) {
      const [cmd, ...args] = tokenize(part);
      if (!cmd) continue;
      const c = C[cmd.toLowerCase()];
      if (c) { c.run(args); continue; }
      // natural-language-ish fallbacks for non-technical visitors
      const low = part.toLowerCase();
      const r = resolveLoose(low) || resolveLoose(cmd);
      if (r && r.kind === "world") { run(`cd ${r.world.id} && ls`, { echo: false }); continue; }
      if (r && r.kind === "project") { run(`cat ${r.project.id}`, { echo: false }); continue; }
      if (/project|work|portfolio/.test(low)) { run("ls universe", { echo: false }); continue; }
      if (/about|who/.test(low)) { run("whoami", { echo: false }); continue; }
      if (/contact|hire|reach/.test(low)) { run("contact", { echo: false }); continue; }
      const sug = suggest(cmd);
      print(`<span class="err">command not found: ${esc(cmd)}</span>${sug ? ` — did you mean ${R(sug)}?` : ""} <span class="dim">type</span> ${R("help")}`);
    }
    updateGhost();
  }

  function lev(a, b) {
    const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
    for (let j = 1; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[m][n];
  }
  function suggest(cmd) {
    let best = null, bd = 3;
    Object.keys(C).filter((k) => !C[k].hidden).forEach((k) => { const d = lev(cmd.toLowerCase(), k); if (d < bd) { bd = d; best = k; } });
    return best;
  }

  // GUI → CLI: a clean screen, the command types itself, then its output fades in.
  // One thing at a time, so the reader isn't wading through old output.
  let typing = null;
  function type(cmd) {
    if (typing) { clearTimeout(typing); typing = null; }
    out.innerHTML = ""; input.value = ""; updateGhost();
    const line = print(`<span class="c-path">${esc(pathStr(cwd))}</span><span class="c-arrow">❯</span><span class="typed"></span><span class="tcur" aria-hidden="true"></span>`, "cmd");
    lastCmd = line; open();
    if (hist[hist.length - 1] !== cmd) { hist.push(cmd); if (hist.length > 60) hist.shift(); }
    hi = hist.length; try { localStorage.setItem("nk.hist", JSON.stringify(hist)); } catch (_) {}
    const span = line.querySelector(".typed");
    const done = () => {
      typing = null; span.textContent = cmd;
      const c = line.querySelector(".tcur"); if (c) c.remove();
      const from = out.children.length;
      run(cmd, { echo: false });
      [...out.children].slice(from).forEach((el) => el.classList.add("fadein"));
    };
    if (reduced) return done();
    let i = 0;
    const tick = () => { span.textContent = cmd.slice(0, ++i); if (i < cmd.length) typing = setTimeout(tick, 14); else typing = setTimeout(done, 110); };
    typing = setTimeout(tick, 60);
  }

  // ---------- completion ----------
  function candidates(val) {
    const toks = val.split(/\s+/);
    if (toks.length <= 1) return Object.keys(C).filter((k) => !C[k].hidden && !C[k].alias && k.startsWith(toks[0].toLowerCase())).map((k) => k + " ");
    const cmd = C[toks[0].toLowerCase()];
    const cur = toks[toks.length - 1], head = toks.slice(0, -1).join(" ") + " ";
    let pool = [];
    const dirPart = cur.includes("/") ? cur.slice(0, cur.lastIndexOf("/") + 1) : "";
    const base = dirPart ? resolve(dirPart) : { path: cwd };
    if (base) pool = childrenOf(base.path).map((c) => dirPart + c.n);
    if (!dirPart && cwd.length === 0) pool = pool.concat(worlds.map((w) => w.id + "/"));       // cd developer from ~
    if (cmd && cmd.complete === "open") pool = ["resume", "github", "linkedin", "email"];
    if (cmd && cmd.complete === "post") pool = posts().map((p) => p.slug);
    if (cmd && cmd.complete === "dir") pool = pool.filter((p) => p.endsWith("/")).concat(["..", "~"]);
    if (cmd && cmd.name === "motion") pool = ["on", "off"];
    if (cmd && cmd.name === "help") pool = Object.keys(C).filter((k) => !C[k].hidden && !C[k].alias);
    return [...new Set(pool)].filter((p) => p.toLowerCase().startsWith(cur.toLowerCase())).map((p) => head + p);
  }
  function updateGhost() {
    const v = input.value;
    if (!v || document.activeElement !== input) { ghost.innerHTML = ""; return; }
    const c = candidates(v)[0];
    ghost.innerHTML = c && c.toLowerCase().startsWith(v.toLowerCase()) && c !== v ? `<span class="typed">${esc(v)}</span>${esc(c.slice(v.length))}` : "";
  }
  function complete() {
    const v = input.value, c = candidates(v);
    if (!c.length) return;
    if (c.length === 1) { input.value = c[0]; updateGhost(); return; }
    // common prefix, then show options
    let pre = c[0];
    for (const s of c) while (!s.toLowerCase().startsWith(pre.toLowerCase())) pre = pre.slice(0, -1);
    if (pre.length > v.length) { input.value = pre; updateGhost(); return; }
    lastCmd = print(`<span class="dim">${c.map((s) => esc(s.split(/\s+/).filter(Boolean).pop())).join("   ")}</span>`); open(); follow();
  }

  // ---------- events ----------
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = input.value; input.value = ""; ghost.innerHTML = "";
    if (!v.trim()) { if (!isOpen()) run("help"); return; }
    run(v);
  });
  input.addEventListener("input", updateGhost);
  input.addEventListener("focus", updateGhost);
  input.addEventListener("blur", () => (ghost.innerHTML = ""));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Tab" && input.value) { e.preventDefault(); complete(); }
    else if (e.key === "ArrowRight" && ghost.textContent && input.selectionStart === input.value.length) { e.preventDefault(); complete(); }
    else if (e.key === "ArrowUp") { if (hist.length) { e.preventDefault(); hi = Math.max(0, hi - 1); input.value = hist[hi] || ""; updateGhost(); } }
    else if (e.key === "ArrowDown") { e.preventDefault(); hi = Math.min(hist.length, hi + 1); input.value = hist[hi] || ""; updateGhost(); }
    else if (e.key === "l" && e.ctrlKey) { e.preventDefault(); out.innerHTML = ""; }
    else if (e.key === "c" && e.ctrlKey && !window.getSelection().toString()) { e.preventDefault(); print(`<span class="c-path">${esc(pathStr(cwd))}</span><span class="c-arrow">❯</span>${esc(input.value)}^C`, "cmd"); input.value = ""; updateGhost(); }
  });
  out.addEventListener("click", (e) => {
    const f = e.target.closest("[data-fill]");
    if (f) { input.value = f.dataset.fill; input.focus({ preventScroll: true }); updateGhost(); return; }
    const b = e.target.closest("[data-run]"); if (!b) return;
    type(b.dataset.run);
    input.focus({ preventScroll: true });
  });
  chipsEl.addEventListener("click", (e) => { const b = e.target.closest("[data-type]"); if (b) type(b.dataset.type); });
  toggle.addEventListener("click", () => {
    if (isOpen()) close();
    else { if (!out.children.length) run("help"); open(); input.focus({ preventScroll: true }); }
  });

  function motd() {
    print(`<span class="w">Hi, I'm Nikhil.</span> This portfolio is a terminal — type, or just click.`);
    print(`<span class="dim">start with</span> ${R("ls universe")} <span class="dim">or</span> ${R("whoami")}<span class="dim">. Stuck? </span>${R("help")}`);
  }

  const DEFAULT_STATUS = `<b>Pick a world</b>hover to preview · or type <span class="k">help</span>`;
  function setStatus(html) { status.innerHTML = html || DEFAULT_STATUS; }
  setStatus("");

  renderChips();
  return {
    run, type, open, close, isOpen, focus: () => input.focus({ preventScroll: true }), input, motd, setStatus,
    get cwd() { return cwd.slice(); }, on: (k, f) => (hooks[k] = f), resolveLoose
  };
})();
