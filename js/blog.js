/* ==========================================================================
   BLOG — an Obsidian-style reading view over NK.posts (built from blog/*.md).
   File tree · search · tags · properties · wikilinks · backlinks · outline.
   ========================================================================== */
window.NK = window.NK || {};

NK.blog = (function () {
  "use strict";
  const posts = NK.posts || [];
  const root = document.getElementById("vault");
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const bySlug = Object.fromEntries(posts.map((p) => [p.slug, p]));
  const ctx = { exists: (s) => !!bySlug[s] };
  const fmtDate = (d) => { const t = new Date(d + "T00:00:00"); return isNaN(t) ? d : t.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); };
  let built = false, opener = null, onClose = null, onRoute = null, current = null;

  function build() {
    const folders = {};
    posts.forEach((p) => (folders[p.folder || "notes"] = folders[p.folder || "notes"] || []).push(p));
    const tags = {};
    posts.forEach((p) => p.tags.forEach((t) => (tags[t] = (tags[t] || 0) + 1)));
    root.innerHTML = `
      <div class="v-app">
        <aside class="v-side" id="v-side" aria-label="Notes">
          <div class="v-side-h">
            <span class="v-vault"><span class="v-vault-dot" aria-hidden="true"></span>nikhil / notes</span>
            <button type="button" class="v-icon v-only-m" data-act="side" aria-label="Close file list">✕</button>
          </div>
          <label class="v-search"><span class="sr">Search notes</span><input type="search" id="v-q" placeholder="Search notes…" autocomplete="off"></label>
          <nav class="v-tree" aria-label="Files">
            <a class="v-file v-home" href="#/blog" data-home>All notes <span class="dim">${posts.length}</span></a>
            ${Object.keys(folders).sort().map((f) => `<details open><summary>${esc(f)}</summary>${folders[f].map((p) => `<a class="v-file" href="#/blog/${p.slug}" data-post="${p.slug}">${esc(p.title)}</a>`).join("")}</details>`).join("")}
          </nav>
          <div class="v-tags" aria-label="Tags">${Object.entries(tags).sort((a, b) => b[1] - a[1]).map(([t, n]) => `<a class="tag" href="#/blog/tag/${esc(t)}" data-tag="${esc(t)}">#${esc(t)} <span>${n}</span></a>`).join("")}</div>
          <p class="v-sync"><span aria-hidden="true">⟳</span> Written in Obsidian, synced via GitHub</p>
        </aside>
        <div class="v-main">
          <header class="v-bar">
            <button type="button" class="v-icon v-only-m" data-act="side" aria-label="Show file list">☰</button>
            <p class="v-crumb" id="v-crumb"></p>
            <button type="button" class="pill ghost v-back" data-act="close"><span class="kbd">esc</span> Universe</button>
          </header>
          <div class="v-scroll" id="v-scroll"><article class="v-doc" id="v-doc"></article></div>
        </div>
        <aside class="v-outline" id="v-outline" aria-label="On this page"></aside>
      </div>`;
    root.addEventListener("click", onClick);
    root.querySelector("#v-q").addEventListener("input", (e) => search(e.target.value));
    built = true;
  }

  function onClick(e) {
    const a = e.target.closest("[data-post],[data-tag],[data-home],[data-act],[data-jump]");
    if (!a) return;
    if (a.dataset.act === "close") { e.preventDefault(); close(); return; }
    if (a.dataset.act === "side") { e.preventDefault(); root.classList.toggle("side-open"); return; }
    if (a.dataset.jump) { e.preventDefault(); const h = root.querySelector("#" + a.dataset.jump); if (h) h.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    e.preventDefault();
    root.classList.remove("side-open");
    if (a.dataset.post) show(a.dataset.post);
    else if (a.dataset.tag) show({ tag: a.dataset.tag });
    else show(null);
  }

  function card(p) {
    return `<li><a class="v-card" href="#/blog/${p.slug}" data-post="${p.slug}"><span class="v-card-t">${esc(p.title)}</span><span class="v-card-m">${fmtDate(p.date)}${p.placeholder ? ' · <span class="am">placeholder</span>' : ""}</span><span class="v-card-s">${esc(p.summary)}</span><span class="v-card-g">${p.tags.map((t) => "#" + esc(t)).join("  ")}</span></a></li>`;
  }

  function show(target) {
    const doc = root.querySelector("#v-doc"), crumb = root.querySelector("#v-crumb"), outline = root.querySelector("#v-outline");
    root.querySelectorAll(".v-file").forEach((f) => f.removeAttribute("aria-current"));
    outline.innerHTML = "";
    let route = "blog";
    if (target && typeof target === "object" && target.tag) {
      const list = posts.filter((p) => p.tags.includes(target.tag));
      crumb.innerHTML = `notes <span class="dim">/</span> <span class="w">#${esc(target.tag)}</span>`;
      doc.innerHTML = `<h1 class="v-title">#${esc(target.tag)}</h1><p class="v-lede">${list.length} note${list.length === 1 ? "" : "s"} tagged #${esc(target.tag)}</p><ul class="v-cards">${list.map(card).join("")}</ul>`;
      route = "blog/tag/" + target.tag; current = null;
    } else if (target) {
      const p = bySlug[target];
      if (!p) {
        crumb.innerHTML = `notes <span class="dim">/</span> ${esc(target)}`;
        doc.innerHTML = `<h1 class="v-title">${esc(target)}</h1><div class="callout" data-type="info"><p class="callout-t">Not written yet</p><p>This note is linked from somewhere but doesn't exist yet. Check back soon.</p></div><p><a href="#/blog" data-home>← All notes</a></p>`;
      } else {
        const r = NK.md.render(p.body, ctx);
        const back = posts.filter((q) => q.links.includes(p.slug) && q.slug !== p.slug);
        const i = posts.indexOf(p), newer = posts[i - 1], older = posts[i + 1];
        crumb.innerHTML = `${esc(p.folder || "notes")} <span class="dim">/</span> <span class="w">${esc(p.slug)}</span>`;
        doc.innerHTML = `
          <h1 class="v-title">${esc(p.title)}</h1>
          <dl class="v-props">
            <div><dt>date</dt><dd>${fmtDate(p.date)}</dd></div>
            ${p.tags.length ? `<div><dt>tags</dt><dd>${p.tags.map((t) => `<a class="tag" href="#/blog/tag/${esc(t)}" data-tag="${esc(t)}">#${esc(t)}</a>`).join(" ")}</dd></div>` : ""}
            ${p.placeholder ? `<div><dt>status</dt><dd class="am">placeholder</dd></div>` : ""}
          </dl>
          <div class="v-body">${r.html}</div>
          <section class="v-backlinks" aria-label="Linked mentions">
            <h2>Linked mentions <span class="dim">${back.length}</span></h2>
            ${back.length ? `<ul>${back.map((q) => `<li><a href="#/blog/${q.slug}" data-post="${q.slug}">${esc(q.title)}</a><span class="dim"> — ${esc(q.summary)}</span></li>`).join("")}</ul>` : `<p class="dim">No other notes link here yet.</p>`}
          </section>
          <nav class="v-pager" aria-label="More notes">
            ${older ? `<a href="#/blog/${older.slug}" data-post="${older.slug}"><span class="dim">← older</span>${esc(older.title)}</a>` : "<span></span>"}
            ${newer ? `<a class="r" href="#/blog/${newer.slug}" data-post="${newer.slug}"><span class="dim">newer →</span>${esc(newer.title)}</a>` : ""}
          </nav>`;
        const f = root.querySelector(`.v-file[data-post="${p.slug}"]`); if (f) f.setAttribute("aria-current", "page");
        if (r.heads.length > 1) outline.innerHTML = `<p class="v-outline-h">On this page</p>${r.heads.map((h) => `<a href="#" data-jump="h-${h.id}" style="padding-left:${(h.n - 1) * 12}px">${NK.md.inline(h.text)}</a>`).join("")}`;
      }
      route = "blog/" + target; current = target;
    } else {
      crumb.innerHTML = `<span class="w">All notes</span>`;
      doc.innerHTML = `<h1 class="v-title">Notes</h1><p class="v-lede">Build logs and things I've learned — written in Obsidian, published here. Start with <a class="wl" href="#/blog/${posts[posts.length - 1] ? posts[posts.length - 1].slug : ""}" data-post="${posts[posts.length - 1] ? posts[posts.length - 1].slug : ""}">the first note</a>, or pick a tag.</p><ul class="v-cards">${posts.map(card).join("")}</ul>`;
      root.querySelector(".v-home").setAttribute("aria-current", "page");
      current = null;
    }
    root.querySelector("#v-scroll").scrollTop = 0;
    if (onRoute) onRoute(route);
  }

  function search(q) {
    q = q.trim().toLowerCase();
    root.querySelectorAll(".v-file[data-post]").forEach((a) => {
      const p = bySlug[a.dataset.post];
      a.hidden = !!q && !(p.title + " " + p.summary + " " + p.tags.join(" ") + " " + p.body).toLowerCase().includes(q);
    });
  }

  function open(target) {
    if (!built) build();
    if (root.hidden) { opener = document.activeElement; root.hidden = false; document.body.style.overflow = "hidden"; }
    show(target || null);
    root.querySelector(".v-doc").focus ? root.focus({ preventScroll: true }) : 0;
  }
  function close() {
    if (root.hidden) return;
    root.hidden = true; root.classList.remove("side-open"); document.body.style.overflow = "";
    if (onClose) onClose();
    if (opener && opener.focus) opener.focus({ preventScroll: true });
  }

  return {
    open, close, isOpen: () => !root.hidden, posts, get: (s) => bySlug[s],
    onClose: (f) => (onClose = f), onRoute: (f) => (onRoute = f)
  };
})();
