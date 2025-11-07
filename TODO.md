# Portfolio Project TODO

A comprehensive roadmap for building a modern 2.5D interactive portfolio with Three.js, React, and physics-based interactions.

---

## Phase 1: Project Setup & Foundation

- [ ] 1. Initialize Vite + React + TypeScript project
- [ ] 2. Install core dependencies (Three.js, R3F, Rapier, Tailwind, Framer Motion)
- [ ] 3. Configure Tailwind with custom minimalist color palette
- [ ] 4. Set up project structure (components, pages, utils folders)
- [ ] 5. Create basic routing (React Router for Blog, Resume, Home pages)

---

## Phase 2: Core Navigation & Layout

- [ ] 6. Build Header component with nav links (Home, Blog, Resume, Tech Stack)
- [ ] 7. Add Social Icons component (GitHub, LinkedIn, X, Email)
- [ ] 8. Create Footer with socials and copyright
- [ ] 9. Implement Skip Animation button with fade-out logic
- [ ] 10. Add Basic Website toggle (3D ↔ Grid view switcher)

---

## Phase 3: 3D Sphere Portfolio (Home Page)

- [ ] 11. Set up R3F Canvas and basic Three.js scene
- [ ] 12. Create PassionSphere component (Developer, Hackathon, 3D Printing, AI Dev circles)
- [ ] 13. Integrate Rapier physics for sphere bouncing/collisions
- [ ] 14. Add hover interactions (glow, shadow cast - e.g., Go gopher)
- [ ] 15. Implement click → explode animation (GSAP timeline)
- [ ] 16. Build ProjectExploder component to display project cards

---

## Phase 4: Blog System

- [ ] 17. Set up MDX parsing with Contentlayer/gray-matter
- [ ] 18. Create BlogIndex page with card grid layout
- [ ] 19. Build BlogCard component (image, title, date, read time)
- [ ] 20. Implement BlogPost page with MDX rendering
- [ ] 21. Add syntax highlighting (Shiki), Table of Contents, Reading Progress bar
- [ ] 22. Create tag filtering and search functionality

---

## Phase 5: Resume Page

- [ ] 23. Design interactive timeline component with GSAP ScrollTrigger
- [ ] 24. Create resume data structure (JSON file)
- [ ] 25. Build DownloadButton for PDF resume
- [ ] 26. Add Skills tag cloud with hover interactions
- [ ] 27. Implement scroll-reveal animations for timeline items

---

## Phase 6: Easter Egg Game Mode

- [ ] 28. Implement shake detection (mobile: Device Motion, desktop: mouse shake)
- [ ] 29. Create GameMode component with atom spawning logic
- [ ] 30. Build timed frenzy mechanics (60s timer, scoring system)
- [ ] 31. Add atom combination reactions with particle effects
- [ ] 32. Implement U-238 nuclear chain reaction animation (shockwave, explosion)
- [ ] 33. Create power-ups (Time Crystal, Multiplier, Catalyst)
- [ ] 34. Add leaderboard (localStorage) and badges

---

## Phase 7: UX Polish & Accessibility

- [ ] 35. Add keyboard navigation (Tab, Enter for spheres)
- [ ] 36. Implement screen reader announcements
- [ ] 37. Create reduced motion toggle
- [ ] 38. Add focus indicators and high contrast mode
- [ ] 39. Build onboarding tutorial overlay (first visit)
- [ ] 40. Implement haptic feedback (mobile) and sound effects

---

## Phase 8: Performance Optimization

- [ ] 41. Add adaptive quality system (FPS detection)
- [ ] 42. Implement lazy loading for project images
- [ ] 43. Optimize sphere count (mobile: 8, desktop: 12-15)
- [ ] 44. Add loading screen with progress indicator

---

## Phase 9: Final Touches & Deployment

- [ ] 45. Comprehensive testing (mobile, desktop, accessibility)
- [ ] 46. SEO optimization (meta tags, Open Graph, sitemap)
- [ ] 47. Deploy to Vercel
- [ ] 48. Create README with project documentation

---

## Learning Focus

Since you're a beginner, we'll implement incrementally with explanations at each step, focusing on understanding:
- React component architecture and state management
- Three.js 3D graphics fundamentals
- Physics simulation concepts with Rapier
- Performance optimization techniques
- Accessibility best practices

---

## Progress Tracking

- **Total Steps**: 48
- **Completed**: 0
- **In Progress**: 0
- **Remaining**: 48

---

## Notes

- Each phase builds on previous work
- Test thoroughly after each major feature
- Commit changes regularly with clear messages
- Document complex logic and decisions
- Ask questions when concepts are unclear
