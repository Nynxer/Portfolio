/* ==========================================================================
   CONTENT — the only file you need to edit to update the portfolio.
   Terminal, universe and simple view are all generated from this.
   ========================================================================== */
window.NK = window.NK || {};

NK.data = {
  // The third colour, used sparingly and only on the interface (cursor, hover, bullets, "Open to:", selection): "magenta", "lime" or "violet".
  accent: "magenta",
  // Intro animation: "carve" (the pendulum cuts each world out of the dot grid) or "classic" (the earlier one:
  // a ring born at the bob that wanders to its place). Either can be played with `replay carve` / `replay classic`.
  intro: "carve",
  // Loop order for "carve": "down" = biggest loop first, shrinking and speeding up; "up" = smallest first, ending on the biggest.
  introOrder: "down",
  // Blog visibility: true = always shown, false = never, "dev" = only in dev mode
  // (localhost, a file opened directly, or ?dev on the URL, e.g. https://nynxer.github.io/Portfolio/?dev).
  // Flip to true once the posts are real.
  blog: "dev",
  person: {
    name: "Nikhil Kamath",
    short: "Nikhil",
    handle: "nikhil",
    role: "Developer & maker",
    location: "Bengaluru → Eindhoven",
    // What I'm looking for — shown by whoami, contact and the simple view.
    openTo: "Open to: thesis & internship roles in the Brainport region (AI, robotics, embedded)",
    // The headline. The last line ends with the colon that becomes the pendulum.
    intro: ["Hello World,", "I'm Nikhil"],
    // "swings between" is read just as the lower colon dot starts to swing.
    // Alternatives: "and my mind orbits around", "and I keep swinging between"
    sparkLine: "my curiosity swings between",
    // Shown as a shell comment next to ./hello — the 5-second summary.
    // Two lines under the headline: where I am, what I am, where I work/study. **bold** = highlight.
    about: [
      "Eindhoven, NL · MSc AI & Engineering Systems @ **TU/e**",
      "Ex-**Motorola Solutions** · Go, robotics & 3D printing"
    ],
    aboutShort: ["Eindhoven, NL · MSc AI @ **TU/e**", "Ex-**Motorola Solutions** · Go & robotics"],
    // Top highlights: shown by `whoami` and at the top of the simple view.
    highlights: [
      ["IEEE Best Paper", "Pluto, a weed-removing robot (CCube 2025)"],
      ["Motorola Solutions", "backend automation in Go + gRPC"],
      ["Top 10 of 150+", "teams at the 0x.Day Pondicherry hackathon"],
      ["TU/e", "MSc AI & Engineering Systems, Eindhoven"]
    ],
    bio: [
      "I build systems that run themselves: Go backends, automation scripts and the odd robot.",
      "Currently doing an MSc in AI & Engineering Systems at TU/e, Eindhoven.",
      "Before that: Electronics & Computer Engineering at REVA University, Bengaluru.",
      "Away from the keyboard I run a small 3D-printing business and build e-paper gadgets."
    ],
    languages: "Konkani · English (IELTS 8.0) · Hindi · Kannada"
  },

  links: {
    email:    { label: "niskamath@gmail.com",       url: "mailto:niskamath@gmail.com" },
    github:   { label: "github.com/Nynxer",          url: "https://github.com/Nynxer" },
    linkedin: { label: "linkedin.com/in/niskamath",  url: "https://www.linkedin.com/in/niskamath" },
    resume:   { label: "resume.pdf (Google Drive)",   url: "https://drive.google.com/file/d/1W98bTHA28VhHaj-DHMyxhjsBbndoo_OG/view?usp=sharing" }
  },

  experience: [
    { org: "Mercor", role: "AI coding-agent training (contract)", when: "Nov 2025 –", where: "Remote",
      what: "I review open-source pull requests, write the rubrics AI coding agents are scored on, and write the reference solutions they learn from." },
    { org: "PrintSmithz", role: "Founder", when: "2025 –", where: "Bengaluru",
      what: "My 3D-printing business: prototypes for a hardware startup and custom pieces for individual customers." },
    { org: "Dhruva Engineering Consultancy", role: "Automation engineer (contract)", when: "2025", where: "Remote",
      what: "Scripts for ARES Commander / AutoCAD that draw repetitive electrical and fire-safety details." },
    { org: "Motorola Solutions", role: "Backend Automation Intern", when: "Aug 2024 – Jul 2025", where: "Bengaluru",
      what: "Go + gRPC job scheduler for remote script execution; Gmail/Drive API audit automation (~80% less manual work); Jenkins-managed jobs; MongoDB metrics ingestion." },
    { org: "Bharat Electronics (BEL)", role: "Software Intern", when: "Jul – Aug 2024", where: "Bengaluru",
      what: "Offline PDF summariser with NLTK + Hugging Face; multi-threading cut run time by 50%." }
  ],

  education: [
    { org: "TU/e — Eindhoven University of Technology", what: "MSc AI & Engineering Systems", when: "2026 –" },
    { org: "REVA University, Bengaluru", what: "B.Tech Electronics & Computer Engineering", when: "– 2025" }
  ],

  skills: ["Go", "Python", "C++", "Shell", "SQL", "gRPC", "Docker", "MongoDB", "Jenkins", "PyTorch", "OpenCV", "YOLO", "Linux", "CAD", "AutoCAD LISP"],

  // Worlds = the planets. `color` is "cyan" or "orange" (orange = hot).
  // Project fields: repo / demo / paper (links), figure (a labelled photo, dev mode only: see js/figure.js),
  // dev: true = shown only in dev mode (localhost or ?dev), hidden on the live site.
  worlds: [
    {
      id: "automation", aliases: ["developer", "dev", "code", "go", "software", "scripts"],
      name: "Automation", glyph: "</>", color: "cyan",
      tagline: "If I do it twice, I script it.",
      desc: "Mostly Go and shell. I take the manual steps out of other people's work.",
      projects: [
        { id: "job-scheduler", title: "Remote job scheduler", summary: "Go + gRPC service at Motorola Solutions that runs scripts on remote machines. Saved about 30 minutes per deployment.", tags: ["Go", "gRPC", "Jenkins"] },
        { id: "audit-automation", title: "Audit automation", summary: "Motorola's internal audits were done by hand in Gmail and Drive. I scripted them against the Google APIs and about 80% of the manual work went away.", tags: ["Go", "Google APIs"] },
        { id: "drafting-scripts", title: "CAD drafting scripts", summary: "Scripts for ARES Commander and AutoCAD that draw the repetitive electrical and fire-safety details, written for Dhruva Engineering.", tags: ["AutoCAD LISP", "ARES Commander"] },
        { id: "tasky", dev: true, title: "Tasky", summary: "Task orchestration service that schedules, retries and reports on automated jobs.", tags: ["Go", "PostgreSQL", "Docker"] },
        { id: "go-sim-engine", dev: true, title: "Go-Sim-Engine", summary: "Lightweight deterministic simulation engine for stepping physics and agent models.", tags: ["Go", "Concurrency"] },
        { id: "go-imagepro", dev: true, title: "Go-ImagePro", summary: "Concurrent image-processing pipeline — resize, filter and convert from the command line.", tags: ["Go", "Goroutines", "CLI"] },
        { id: "go-ascii-streamer", dev: true, title: "Go-ASCII-Streamer", summary: "Streams live video into the terminal as ASCII, frame by frame.", tags: ["Go", "WebSockets"] }
      ]
    },
    {
      id: "ai-robotics", aliases: ["ai", "robotics", "robot", "ml"],
      name: "AI & Robotics", glyph: "AI", color: "cyan",
      tagline: "From eigenfaces to weed-removing robots.",
      desc: "Computer vision and ML, tested on real hardware and messy data.",
      projects: [
        { id: "pluto", title: "Pluto", summary: "A robot that spots weeds with deep learning and pulls them out. The paper won Best Paper at IEEE CCube 2025.", tags: ["Robotics", "Deep learning", "Computer vision"], paper: "https://ieeexplore.ieee.org/document/11340480" },
        { id: "attendance", title: "Image Attendance System", summary: "Face-recognition attendance in Python. I compared methods from eigenfaces up to deep networks and gained 20% accuracy.", tags: ["Python", "OpenCV", "Dlib"] },
        { id: "pdf-summariser", title: "Offline PDF summariser", summary: "Built at Bharat Electronics: summarises PDFs with no internet connection. Multi-threading made it 50% faster.", tags: ["Python", "NLTK", "Hugging Face"] }
      ]
    },
    {
      id: "3d-printing", aliases: ["3d", "printing", "print", "printsmithz"],
      name: "3D Printing", glyph: "3D", color: "orange",
      tagline: "Paid work since day one.",
      desc: "I run a small print business. Paying customers keep me honest about tolerances.",
      projects: [
        { id: "printsmithz", title: "PrintSmithz", summary: "Design, print, deliver. Prototype frames for an AR-glasses startup, and one-off pieces like e-ink keychains.", tags: ["3D printing", "CAD", "Business"] }
      ]
    },
    {
      id: "tinkering", aliases: ["curious-builder", "diy", "builder", "curious", "hardware", "tinker"],
      name: "Tinkering", glyph: "DIY", color: "cyan",
      tagline: "Small builds for people I know.",
      desc: "Things I make when nobody's paying.",
      projects: [
        { id: "inkiniki", title: "Inkiniki", summary: "A pocket e-paper reader I made for my friends before moving to the Netherlands. It holds books, photos, to-do lists and quotes, uploaded over Wi-Fi from a page the device serves itself.", tags: ["ESP32", "E-paper", "3D printing"],
          figure: {
            photo: "inkiniki-hand",
            labels: [["e-paper screen on a Heltec ESP32 board", 0.6, 0.52], ["3D-printed case", 0.8, 0.72]],
            inset: { photo: "inkiniki-menu", label: "on screen: the menu" },
            caption: "inkiniki · pocket e-paper reader · uploads over Wi-Fi"
          } },
        { id: "home-nas", dev: true, title: "Home NAS", summary: "Self-hosted network storage on a Raspberry Pi.", tags: ["Raspberry Pi", "Linux"] }
      ]
    },
    {
      id: "hackathon", aliases: ["hack", "hackathons", "#"],
      name: "Hackathons", glyph: "#", color: "cyan",
      tagline: "Top 10 of 150+ teams.",
      desc: "Short deadline, working demo.",
      projects: [
        { id: "traffic-signals", title: "Intelligent Traffic Signals", summary: "Real-time traffic analysis with YOLOv5 in Docker containers, 85% vehicle recognition. Top 10 of 150+ teams at 0x.Day Pondicherry.", tags: ["Python", "YOLOv5", "Docker"] }
      ]
    }
  ]
};

// Dev mode: running locally, opened from disk, or ?dev in the URL. Prod = the live site without ?dev.
NK.dev = location.protocol === "file:" || /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/.test(location.hostname) || /[?&]dev\b/.test(location.search);
NK.blogOn = NK.data.blog === true || (NK.data.blog === "dev" && NK.dev);
// In prod, drop anything marked dev: true (worlds or projects).
if (!NK.dev) NK.data.worlds = NK.data.worlds.filter((w) => !w.dev).map((w) => ({ ...w, projects: w.projects.filter((p) => !p.dev) }));
