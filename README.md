# Nikhil — portfolio (static, zero dependencies)

Open `index.html` directly, or serve the folder with anything (`python -m http.server`).
No build step, no framework, no network requests. ~230 KB total, 57 KB of it the font.

## Edit content
- **Everything about you / projects:** `js/data.js`
- **Blog:** write notes in `blog/` (it's an Obsidian vault folder), then run
  `node tools/build-blog.mjs` → regenerates `js/posts.js`.
  - Frontmatter: `title`, `date`, `tags`, `summary`, `placeholder: true`, `draft: true` (hidden)
  - Obsidian syntax works: `[[wikilinks]]`, `#tags`, `> [!note] callouts`, `==highlights==`, tasks, tables
  - `blog/templates/post.md` is a starter template (never published)

## GitHub auto-sync (later)
1. Push this folder to a GitHub repo (GitHub Pages / Netlify / Cloudflare Pages all work).
2. In Obsidian, install the **Obsidian Git** plugin and sync your notes into `blog/`.
3. Move `tools/github-workflow-blog.yml` to `.github/workflows/blog.yml` — it rebuilds `js/posts.js` on every push to `blog/**`.

## Files
| file | what |
|---|---|
| `js/sky.js` | dot-matrix canvas: grid, fire, planets, pendulum, intro |
| `js/terminal.js` | the CLI: commands, completion, history, `sudo rm -rf /` easter egg |
| `js/game.js` + `js/sling-core.js` | Orbit Sling (shake / yank the pendulum, or type `sling`) |
| `js/blog.js` + `js/markdown.js` | Obsidian-style blog reader |
| `js/main.js` | wiring, keyboard, simple view, URL hashes |
| `tests/sling.test.js` | `node tests/sling.test.js` checks every game level is solvable |

## Deep links
`#/developer` · `#/developer/tasky` · `#/blog` · `#/blog/pluto` · `#/blog/tag/go` · `#/simple` · `#/sling`

## Keyboard
`/` focus terminal · type anywhere to start · `tab` complete · `↑` history · `esc` back ·
arrows move between planets · on the pendulum, ← → swings it (shake it for a surprise)
