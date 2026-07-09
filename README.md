# KM Trans Logistics — Workshop Control Center (React)

A control-room-style redesign of the workshop DES dashboard: React 18 + Tailwind CSS + Framer Motion + Lucide React + Chart.js, built with Vite.

**The simulation engine was not touched.** `src/engine/desEngine.js` is a line-for-line port of the original `simulate()` / `computeUtilSeries()` logic (same distributions, same scheduling rules, same formulas) — only the module boundary changed, from a `<script>` global to ES exports. This was verified against the original by running both with the same seed and confirming identical outputs (avg wait, bay utilization, etc., to the decimal).

## Important — please run the build yourself

This sandbox's environment blocks outbound `npm install` (registry access is restricted here), so I could not run `npm install` / `npm run build` myself to do a final automated check. I've syntax-checked every engine/logic file with Node and manually reviewed every component for correct imports and bracket-matching, but a real build is the one check I couldn't perform. Please run:

```bash
cd km-trans-dashboard-react
npm install
npm run dev       # opens a local dev server, usually http://localhost:5173
```

If anything errors on `npm install` or in the browser console, send me the error and I'll fix it immediately — the most likely candidates would be a version mismatch on `lucide-react` or `framer-motion` (both move fast), easily solved by bumping the version in `package.json`.

## What changed vs. the previous version

- **Full visual redesign** into a light, professional "control room" aesthetic (Power BI / Stripe / Siemens-dashboard inspired) — no gaming aesthetic.
- **Layout**: sticky navbar (clock, run/pause, speed, bottleneck badge, event count) → left Configuration column → center Workshop Visualization (the focal point, ~60–70% of the row width) → right column of live KPIs + charts → full-width animated Event Timeline at the bottom.
- **Workshop floor**: entry/exit gates, an always-active horizontal **Queue Lane** of compact truck cards (position, wait time, job category — reflows smoothly via Framer Motion, never teleports), and **Bay Cards** per service bay (number, type, status badge, current truck, progress bar, remaining time, green flash on completion, "Available" badge when idle).
- **Truck color coding**: blue = waiting, orange = allocated, green = under service, gray = completed.
- **Workforce cards** per department with busy/available counts, an animated utilization bar, and small worker icons.
- **KPI cards** with icons, animated number tweening, mini sparklines, and hover elevation.
- **Live charts** (Chart.js via react-chartjs-2): Queue Length vs Time, Throughput vs Time, Average Waiting Time vs Time, Bay Utilization vs Time, Workforce Utilization vs Time — all animate their transitions instead of hard-redrawing.
- **Event timeline**: every arrival / queue-entry / service-start / completion slides in with an icon, auto-scrolls to the newest, newest entry highlighted.
- **Terminal-style boot sequence** when you click "Run Simulation", and a live bottleneck badge in the navbar.

## Project structure

```
src/
  engine/
    desEngine.js        <- unmodified simulation engine (ported, not rewritten)
    frameSelectors.js    <- pure read-only helpers: turn (result, t) into UI view-models
  hooks/
    useSimulation.js     <- config state + playback loop (requestAnimationFrame)
  components/
    Navbar.jsx
    ConfigPanel.jsx
    BootOverlay.jsx
    workshop/            <- WorkshopVisualization, QueueLane, BayCard, TruckCard
    workers/             <- WorkerPanel, WorkerCard
    kpi/                 <- KpiPanel, KpiCard
    charts/              <- ChartsPanel
    timeline/             <- EventTimeline
    ui/                  <- Card, Badge, AnimatedNumber, Sparkline (shared primitives)
  lib/
    styleMaps.js         <- shared color/label lookup tables
```

## Hosting (once you've confirmed the build works locally)

```bash
npm run build     # outputs static files to dist/
```

`dist/` is a plain static site — deploy it the same way as before:
- **Netlify**: drag the `dist` folder onto app.netlify.com/drop, or connect the repo with build command `npm run build` and publish directory `dist`.
- **Vercel**: import the repo, framework preset "Vite", build command `npm run build`, output directory `dist`.
- **GitHub Pages**: build locally, then push the contents of `dist/` to a `gh-pages` branch (or use the `gh-pages` npm package).

Netlify/Vercel's own build servers have normal npm registry access, so `npm install` will succeed there even though it couldn't run in my sandbox.
