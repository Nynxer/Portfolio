/* Tiny Obsidian-flavoured Markdown → HTML. No dependencies.
   Supports: headings, paragraphs, lists (nested, tasks), code fences, inline code,
   **bold**, *italic*, ==highlight==, ~~strike~~, [links](url), ![images](src),
   [[wikilinks|label]], #tags, > quotes, > [!callout] Title, --- rules, tables. */
(function (root) {
  "use strict";
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const slugify = (s) => String(s).toLowerCase().trim().replace(/\.md$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  function inline(s, ctx) {
    const codes = [];
    s = s.replace(/`([^`]+)`/g, (_, c) => { codes.push(`<code>${esc(c)}</code>`); return `\u0000${codes.length - 1}\u0000`; });
    s = esc(s);
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, a, u) => `<img src="${u}" alt="${a}" loading="lazy">`);
    s = s.replace(/\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g, (_, t, h, l) => {
      const slug = slugify(t), ok = !ctx || !ctx.exists || ctx.exists(slug);
      return `<a class="wl${ok ? "" : " unresolved"}" href="#/blog/${slug}" data-post="${slug}">${l || t}</a>`;
    });
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => `<a href="${u}"${/^https?:/.test(u) ? ' target="_blank" rel="noopener"' : ""}>${t}</a>`);
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
    s = s.replace(/==([^=]+)==/g, "<mark>$1</mark>").replace(/~~([^~]+)~~/g, "<del>$1</del>");
    s = s.replace(/(^|\s)#([a-zA-Z][\w/-]*)/g, (_, pre, t) => `${pre}<a class="tag" href="#/blog/tag/${t}" data-tag="${t}">#${t}</a>`);
    return s.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[+i]);
  }

  function render(md, ctx) {
    const lines = String(md).replace(/\r\n?/g, "\n").split("\n");
    const out = [], heads = [];
    let i = 0;
    const para = [];
    const flush = () => { if (para.length) { out.push(`<p>${inline(para.join(" "), ctx)}</p>`); para.length = 0; } };
    while (i < lines.length) {
      const L = lines[i];
      let m;
      if (/^```/.test(L)) {
        flush(); const lang = L.slice(3).trim(), buf = []; i++;
        while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
        i++; out.push(`<pre><code${lang ? ` data-lang="${esc(lang)}"` : ""}>${esc(buf.join("\n"))}</code></pre>`); continue;
      }
      if ((m = L.match(/^(#{1,4})\s+(.*)$/))) {
        flush(); const n = m[1].length, id = slugify(m[2]);
        heads.push({ n, text: m[2], id });
        out.push(`<h${n + 1} id="h-${id}">${inline(m[2], ctx)}</h${n + 1}>`); i++; continue;
      }
      if (/^\s*(---|\*\*\*)\s*$/.test(L)) { flush(); out.push("<hr>"); i++; continue; }
      if (/^>/.test(L)) {
        flush(); const buf = [];
        while (i < lines.length && /^>/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ""));
        const c = buf[0].match(/^\[!(\w+)\][+-]?\s*(.*)$/);
        if (c) {
          const type = c[1].toLowerCase();
          out.push(`<div class="callout" data-type="${esc(type)}"><p class="callout-t">${inline(c[2] || type[0].toUpperCase() + type.slice(1), ctx)}</p>${render(buf.slice(1).join("\n"), ctx).html}</div>`);
        } else out.push(`<blockquote>${render(buf.join("\n"), ctx).html}</blockquote>`);
        continue;
      }
      if (/^\|.*\|\s*$/.test(L) && lines[i + 1] && /^\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
        flush(); const row = (r) => r.trim().replace(/^\||\|$/g, "").split("|").map((c) => inline(c.trim(), ctx));
        const h = row(L); i += 2; const body = [];
        while (i < lines.length && /^\|/.test(lines[i])) body.push(row(lines[i++]));
        out.push(`<table><thead><tr>${h.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
        continue;
      }
      if (/^\s*([-*+]|\d+\.)\s+/.test(L)) {
        flush(); const buf = [];
        while (i < lines.length && (/^\s*([-*+]|\d+\.)\s+/.test(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && buf.length))) buf.push(lines[i++]);
        out.push(list(buf, ctx)); continue;
      }
      if (!L.trim()) { flush(); i++; continue; }
      para.push(L.trim()); i++;
    }
    flush();
    return { html: out.join("\n"), heads };
  }

  function list(buf, ctx) {
    const ordered = /^\s*\d+\./.test(buf[0]);
    const base = buf[0].match(/^\s*/)[0].length;
    const items = [];
    for (const l of buf) {
      const ind = l.match(/^\s*/)[0].length;
      if (ind <= base && /^\s*([-*+]|\d+\.)\s+/.test(l)) items.push({ text: l.replace(/^\s*([-*+]|\d+\.)\s+/, ""), sub: [] });
      else if (items.length) items[items.length - 1].sub.push(l);
    }
    const tag = ordered ? "ol" : "ul";
    return `<${tag}>${items.map((it) => {
      let t = it.text, cls = "";
      const task = t.match(/^\[( |x|X)\]\s+(.*)$/);
      if (task) { cls = ` class="task${task[1] !== " " ? " done" : ""}"`; t = `<span class="box" aria-hidden="true"></span>${inline(task[2], ctx)}`; } else t = inline(t, ctx);
      return `<li${cls}>${t}${it.sub.length ? list(it.sub, ctx) : ""}</li>`;
    }).join("")}</${tag}>`;
  }

  const api = { render, inline, slugify };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else { root.NK = root.NK || {}; root.NK.md = api; }
})(typeof window !== "undefined" ? window : globalThis);
