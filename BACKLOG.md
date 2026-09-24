# Portfolio backlog

Recruiter score, 24 Sep 2026: **22/30** (hireability 6 · look & UX 7 · creativity 9).
The target is 27+, and most of the missing points are in the first 10 seconds.

_Done 24 Sep: items marked [x], plus Zen mode (terminal centred; universe dims, blurs and pauses while it's open) and a shorter intro whose header and terminal unlock at the colon._

## v1.1: next pass (calm, closer to mockup 2a)

### Say who I am in 10 seconds
- [x] Replace the `# developer & maker…` comment with 2 plain lines under the headline, e.g.
      "MSc AI & Engineering Systems student at TU/e, Eindhoven. I build Go backends, robots and 3D-printed things."
- [ ] Show the real content straight away on a first visit. Right now the intro holds the screen for about 9 s. Put the text, planets and résumé on screen at once, and let the pendulum act as decoration on top (or cut the intro to about 3 s).
- [x] Add a one-click **Résumé ↗** back in the header (top-right, next to Simple view).
- [ ] Optional "open to" status line: e.g. "Looking for: thesis / internship in Brainport".

### Calm it down (zen)
- [ ] One moving thing at a time. When idle, keep only the pendulum's flame and a very faint grid shimmer. Stop the twinkles, the planet dot flicker and the float, or cut them to about a third.
- [x] Lower the grid shimmer amplitude and remove the random twinkle dots.
- [ ] Make the planets quieter at rest: fewer dots, and let the tag and name carry them. Only light them up fully on hover or focus.
- [ ] Keep the header down to logo · Work · About · Blog · Contact · Résumé · Simple view.

### Pendulum fire (match 2a)
- [x] After the intro, the bob keeps burning: every frame (at 30 Hz) seed `heat = 1` in the 3×2 cells under the bob.
- [x] Use the 2a flame rule: each cell takes the heat of the cell below, shifted randomly −1/0/+1 columns sideways, minus `random × 0.075`. That gives the flicker.
- [x] One colour ramp for the fire: dim cyan → ice → ember → orange (the blue-orange pixel flame), in 10 buckets as in 2a.
- [x] Ignition: start the flint sparks while the last line ("…swings between") is still typing, not after it.

### Torch / bat-signal (match 2a)
- [x] A static light map from the logo lamp: `light = 0.3 + 1.5·exp(−dist/460)`, multiplied into the grid. Add a soft radial glow at the lamp (radius about 340px).
- [x] Replace the hard-edged cone with a Gaussian beam: brightness falls off with distance from the lamp→planet line, and the beam widens with distance (`width = 10 + R·1.5·along/d`). Ease it in and out (about 110 ms).
- [ ] While it's lit, the planet becomes the bright disc with its glyph cut out (this part already exists).

### Worlds animation (match 2a)
- [ ] During each pendulum loop, draw the arc the bob is tracing as trailing dots.
- [ ] At the end of each loop, send 22 sparks out from the bob. The world then flies on a curve that arcs up about 140px, while its radius and opacity ease in.
- [ ] On click, burst the world's dots upward, turning them from cyan to orange over 1.8 s, and fade the terminal in. On close, rebuild it over 0.9 s.

### Terminal
- [x] Move it to the bottom centre as a slim, borderless prompt that sits on the grid, with the caption line centred above it.
- [x] Open it upward into the centred window. Keep the scrim very light.
- [ ] Put Pause and Replay back as small icons in a corner, so the terminal is the only thing at the bottom centre.

### Content
- [ ] Real project copy: role, dates, one number per project, a repo or demo link, and one image each.
- [ ] Pluto: confirm the Best Paper details (venue, year) and link the paper.
- [ ] Write the three blog posts (they're placeholders now).

### Ship it
- [ ] GitHub repo, then GitHub Pages or Cloudflare Pages, plus a custom domain.
- [ ] Move `tools/github-workflow-blog.yml` to `.github/workflows/blog.yml`.
- [ ] Social preview image (og:image), a sitemap, and an RSS feed for the blog.
- [ ] Put the Simple view's content in the static HTML so search engines and link previews see real text.
- [ ] Privacy-friendly analytics (GoatCounter or Plausible) to see whether recruiters open the résumé.
- [ ] Lighthouse and axe pass; screen-reader check with NVDA and VoiceOver.

## v2: AI layer (idea stage)

### Auto-generated worlds
- Run it at **build time**, not on every visit: when notes sync, an LLM pass reads the published notes and proposes worlds (name, 2-line summary, linked projects and posts). It writes them to a `worlds.json` that I review in the PR before it goes live.
- Keep it deterministic and cached, so visitors get instant loads and no API cost.
- If this becomes a template other people can use, each person's notes produce their own worlds.

### "Am I the right fit?" in the CLI
- Use retrieval (RAG) over published notes, résumé and project data rather than fine-tuning. It's cheaper, always up to date, and it can cite its sources.
- CLI command: `fit` then paste a job description, and get back strong matches, gaps and questions to ask me, each linked to evidence (a project, post or résumé line).
- Needs a small serverless proxy (Cloudflare Worker) with a rate limit and a spending cap; the rest of the site stays static.
- Guardrails: only notes marked `public: true` go in, and every answer carries an "AI summary, may be wrong" label.
- Always offer a "talk to the real me → email" exit.

## Decisions (25 Sep)
- **Seeing effects while the terminal is open**: on desktop the reading panel docks on the left, over the hero, and the worlds stay lit and clickable on the right. So a world's burst plays in full view, and clicking another world switches the panel. On phones the world bursts first (about 0.7 s) and then a bottom sheet slides up.
- **Big effects** (the `rm` eggs, the game): "stage mode". The terminal steps aside to its prompt, each line is echoed in the caption above it, and the panel reopens with the full log when the show ends. Every future egg should use this.
- **Terminal position**: one left edge (the hero's) for the caption, the prompt and the reading panel. The panel grows upward out of the prompt, so it never jumps. On phones it's a bottom sheet from the same spot.
- **Hero copy**: the two lines open like doors (name up, swing line down, lines unfold from the middle; transform, clip-path and opacity only, so it's cheap on phones) between "I'm Nikhil" and the swing line after the intro, and the swing line moves down with the pendulum. "and" was dropped: "my curiosity swings between :".

## Easter eggs: `rm` the universe (brainstorm)

What's there now: `sudo rm -rf /` burns each planet into embers, prints a "kernel panic", then "just kidding… git stash pop" and everything regrows. Plain `rm` just says "permission denied".

The idea: make deleting things feel **physical**. Each escalation gets a bigger, funnier response, and everything always comes back.

### Tiered responses (recommended)
| Command | What happens |
|---|---|
| `rm <project>` / `rm tasky.md` | "rm: tasky.md is load-bearing. Removing it would collapse Developer." The planet wobbles once. |
| `rm -rf ~/universe/<world>` | That one world bursts into embers. The terminal prints `removed '<world>/'`. 3 s later it prints "a world can't be un-thought 🙂" and the world is reborn from a dotted ring. |
| `rm -rf ~/universe` | All five worlds implode into the pendulum weight one by one. The flame flares, then goes out. The grid goes dark except for the lamp. "Universe deleted. Nothing to see here. (Try: `undo`.)" `undo` or any key: a big-bang replay rebuilds everything. |
| `sudo rm -rf /` (keep, polish) | Headline letters fall one by one as dots and pile up at the bottom as embers. Then "kernel panic", a slow reboot with typed BIOS-style lines (`POST… memory OK… curiosity: 100%`) and the intro replays. |
| `rm -rf --no-preserve-root /` | "Okay, you really mean it." The whole grid is sucked into the colon like a black hole, holds 1 s of pure black, then a new big bang. The replay stays calm, with no strobing. |

### Other ideas worth considering
- **Recycle bin**: deleted worlds go to `~/.trash`. `ls ~/.trash` lists them and `restore <world>` brings each back with a pop. That's a small puzzle for curious people.
- **Guardian pendulum**: after a delete, the pendulum swings over and "sweeps" the embers back into a planet, which ties the egg to the site's main mechanic.
- **Confirmation roast**: `rm -i` asks "remove Nikhil's curiosity? [y/N]". Answering `y` prints "error: curiosity is read-only".
- **Achievement toasts**: "root of all evil" (sudo rm), "Thanos snap" (half the worlds gone via `rm -rf` with a glob), "undo king" (restored everything). Counts are kept in localStorage and viewed with `achievements`.
- **The Thanos glob**: `rm -rf ~/universe/*` removes a *random half* of the worlds and each one fades to dust. "Perfectly balanced."
- **Fork bomb** `:(){ :|:& };:`: the pendulum splits into 2, 4, 8 bobs, then "ulimit reached, nice try" and they merge back.
- **`shutdown now` / `reboot`**: a CRT-style collapse to a single dot, then a reboot with the typed intro.

### Guardrails
- Always reversible within ~3 s, or on any key or Esc. Never leave the visitor on a broken page.
- No flashing or strobing, with brightness changes kept below 1 Hz. With reduced motion on, skip straight to the text version.
- Screen reader: announce the joke in the terminal log ("Universe deleted (just kidding) — restored.").
- Keep `help` clean: don't list the eggs. After the first sudo, drop one hint in the terminal log: "psst: the pendulum is also a toy".
