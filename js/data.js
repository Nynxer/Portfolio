/* ==========================================================================
   CONTENT — the only file you need to edit to update the portfolio.
   Terminal, universe and simple view are all generated from this.
   ========================================================================== */
window.NK = window.NK || {};

NK.data = {
  person: {
    name: "Nikhil Kamath",
    short: "Nikhil",
    handle: "nikhil",
    role: "Developer & maker",
    location: "Bengaluru → Eindhoven",
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
      ["Best Paper", "Pluto, an autonomous weed-removing robot"],
      ["Motorola Solutions", "backend automation in Go + gRPC"],
      ["Top 10 of 150+", "teams at the Pondicherry Hackathon"],
      ["TU/e", "MSc AI & Engineering Systems, Eindhoven"]
    ],
    bio: [
      "I build systems that run themselves: Go backends, automation pipelines and small engines.",
      "Currently doing an MSc in AI & Engineering Systems at TU/e, Eindhoven.",
      "Before that: Electronics & Computer Engineering at REVA University, Bengaluru.",
      "Off-keyboard I run a 3D-printing studio and tinker with e-ink, Pis and robots."
    ]
  },

  links: {
    email:    { label: "niskamath@gmail.com",       url: "mailto:niskamath@gmail.com" },
    github:   { label: "github.com/Nynxer",          url: "https://github.com/Nynxer" },
    linkedin: { label: "linkedin.com/in/niskamath",  url: "https://www.linkedin.com/in/niskamath" },
    resume:   { label: "resume.pdf (Google Drive)",   url: "https://drive.google.com/file/d/1W98bTHA28VhHaj-DHMyxhjsBbndoo_OG/view?usp=sharing" }
  },

  experience: [
    { org: "Motorola Solutions", role: "Backend Automation Intern", when: "Aug 2024 –", where: "Bengaluru",
      what: "Go + gRPC job scheduler for remote script execution; Gmail/Drive API audit automation (~80% less manual work); Jenkins-managed jobs; MongoDB metrics ingestion." },
    { org: "Bharat Electronics (BEL)", role: "Intern", when: "Jul – Aug 2024", where: "India",
      what: "Offline document summariser with NLTK + Hugging Face; multi-threading cut run time by 50%." }
  ],

  education: [
    { org: "TU/e — Eindhoven University of Technology", what: "MSc AI & Engineering Systems", when: "2026 –" },
    { org: "REVA University, Bengaluru", what: "B.Tech Electronics & Computer Engineering", when: "– 2025" }
  ],

  skills: ["Go", "Python", "gRPC", "Docker", "PostgreSQL", "MongoDB", "Jenkins", "OpenCV", "YOLO", "Linux", "CAD", "AutoCAD LISP"],

  // Worlds = the planets. `color` is "cyan" or "orange" (orange = hot).
  worlds: [
    {
      id: "developer", aliases: ["dev", "code", "go", "software"],
      name: "Developer", glyph: "</>", color: "cyan",
      tagline: "Systems that run themselves.",
      desc: "Backends, pipelines and small engines — mostly in Go. Take a manual, messy process and make it predictable, fast and observable.",
      projects: [
        { id: "tasky", title: "Tasky", summary: "Task orchestration service that schedules, retries and reports on automated jobs.", tags: ["Go", "PostgreSQL", "Docker"] },
        { id: "go-sim-engine", title: "Go-Sim-Engine", summary: "Lightweight deterministic simulation engine for stepping physics and agent models.", tags: ["Go", "Concurrency"] },
        { id: "go-imagepro", title: "Go-ImagePro", summary: "Concurrent image-processing pipeline — resize, filter and convert from the command line.", tags: ["Go", "Goroutines", "CLI"] },
        { id: "go-ascii-streamer", title: "Go-ASCII-Streamer", summary: "Streams live video into the terminal as ASCII, frame by frame.", tags: ["Go", "WebSockets"] }
      ]
    },
    {
      id: "ai-robotics", aliases: ["ai", "robotics", "robot", "ml"],
      name: "AI & Robotics", glyph: "AI", color: "cyan",
      tagline: "Machines that decide.",
      desc: "Perception and autonomy on real hardware — where models meet mud.",
      projects: [
        { id: "pluto", title: "Pluto", summary: "An autonomous weed-removing robot. Best Paper recognition.", tags: ["Robotics", "Computer vision"] }
      ]
    },
    {
      id: "3d-printing", aliases: ["3d", "printing", "print", "printsmithz"],
      name: "3D Printing", glyph: "3D", color: "orange",
      tagline: "Ideas you can hold.",
      desc: "Design for manufacture, tuned printers and a small studio shipping real parts.",
      projects: [
        { id: "printsmithz", title: "PrintSmithz", summary: "My 3D-printing studio: custom parts and prototypes, from CAD to shipped part.", tags: ["3D printing", "CAD", "Business"] }
      ]
    },
    {
      id: "curious-builder", aliases: ["diy", "builder", "curious", "hardware"],
      name: "Curious Builder", glyph: "DIY", color: "cyan",
      tagline: "Because I wanted to know how.",
      desc: "Electronics and personal infrastructure experiments.",
      projects: [
        { id: "inkiniki", title: "Inkiniki — e-ink displays", summary: "Low-power e-ink display experiments.", tags: ["E-ink", "Embedded"] },
        { id: "home-nas", title: "Home NAS", summary: "Self-hosted network storage on a Raspberry Pi.", tags: ["Raspberry Pi", "Linux"] }
      ]
    },
    {
      id: "hackathon", aliases: ["hack", "hackathons", "#"],
      name: "Hackathon Hacker", glyph: "#", color: "cyan",
      tagline: "48 hours, one idea.",
      desc: "Fast prototypes under pressure. More coming soon.",
      projects: [
        { id: "traffic-signals", title: "Intelligent Traffic Signals", summary: "Real-time signal optimisation from camera feeds; Dockerised microservices, 85% vehicle recognition. Top 10 of 150+ teams, Pondicherry Hackathon.", tags: ["Python", "YOLOv5", "Docker"] }
      ]
    }
  ]
};
