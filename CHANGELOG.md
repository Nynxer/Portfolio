# Changelog

## v1.5 (24 Sep 2026)
- Fix: with the OS "reduce motion" setting on, the bio lines popped in and the pendulum froze after the intro. The lines now glide apart (480ms, soft fade) and the pendulum swings and settles

## v1.4 (24 Sep 2026)
- The left side is one real CLI session: `./hello` → its output → the log → the prompt. Commands append and the page scrolls down; the hero scrolls up like old output. Esc scrolls back to the top (scrollback is kept), `clear` wipes it
- The prompt follows the output and pins to the bottom once the output is taller than the screen; it fades what's under it only while pinned
- Desktop: the universe is a fixed backdrop and the worlds stay clickable while you scroll; the pendulum is put away once the hero scrolls off and re-hangs at the top. Phones and portrait tablets: the universe is the first screen and scrolls away with the page
- The i's lamp is off at rest and strikes like a neon tube (white-hot core, tight halo, brief flicker) only while a world is hovered, when the bat-signal fires from it
- Bio slide rebuilt: the name and swing line are moved by sky.js in the same frame that draws the pendulum, so the bob stays locked to the colon (measured: an even ease-out, no skipped frames)

## v1.3 (24 Sep 2026)
- Persistent terminal: commands append to one log (like a real shell, `clear` wipes it). The log opens exactly where the hero sits, so the first line lands where `./hello` was and the prompt never moves. Crossfade only, no sliding panel; the header stays lit
- The pendulum is put away while the log is on screen and re-hangs when you press Esc
- The dot of the "i" is now a real lamp (glowing square measured onto Doto's glyph) and the bat-signal beam starts from it, slightly brighter
- Smoother bio reveal: lines rise in with transform/opacity only (no clip-path), and the canvas runs at 60fps while the swing line slides, so the bob no longer lags the text
- Cache-busting `?v=` on every CSS/JS link so GitHub Pages never mixes new HTML with old scripts

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
