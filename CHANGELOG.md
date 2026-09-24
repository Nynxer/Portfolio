# Changelog

## v1.2 (24 Sep 2026)
- New logo: "Ni" in Doto (square dot-matrix, weight 900), with a glowing orange "i" that is also the lamp for the torch beam
- Pause/play and replay buttons moved next to the logo; GitHub, LinkedIn and email icons in the header
- Seamless terminal: the prompt is the same `nikhil@universe:~$` session as the hero, with no pill or window chrome. Opening it scrolls the hero away and the output takes its place
- Mobile: header fits at 360px ("simple view" becomes a chip), `~$` short prompt, solid bottom sheet, planets shrink instead of sliding under the prompt, compact layout for phones held sideways
- Content: Mercor (Dec 2025 –) as current work, Motorola end date, "open to" line, better title and link-preview tags, 404 page

## v1.1 — checkpoint (24 Sep 2026)
Static, zero-dependency rebuild of the portfolio (replaces the old Next.js/Three.js app).

- Dot-matrix universe, ported from mockup 2a: 10-step cyan→ember fire, bob flame, diffused bat-signal beam from the logo lamp, rim-weighted planets
- Intro: typed headline → flint sparks while "swing…" types → colon ignites (shockwave + embers) → pendulum loops birth 5 worlds (dotted ring → wander → settle)
- Bio lines (pin + location/study, ex-Motorola) open like doors between the name and "my curiosity swings between :"
- Terminal-first UI: ls/cd/cat/open/whoami/contact/resume/blog…, tab completion, history, clickable output; GUI clicks type the real command on a clean screen
- Reading panel grows up from the prompt on the hero's left edge; worlds stay visible and clickable; bottom sheet on phones
- Clicking a world bursts it into embers; Esc rebuilds it
- Easter eggs: `sudo rm -rf /` (stage mode), Orbit Sling game (shake/yank the pendulum, or `sling`)
- Obsidian-style blog (blog/*.md → tools/build-blog.mjs → js/posts.js)
- Simple view for recruiters, keyboard-first, reduced-motion aware, JetBrains Mono inlined, dot-matrix cursor
