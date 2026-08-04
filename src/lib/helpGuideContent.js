import {
  Settings, ListOrdered, PlayCircle, Warehouse, BarChart3, LineChart,
  Download, AlertTriangle, Compass,
} from 'lucide-react';

/* Static copy for the top-of-app Help & User Guide (components/HelpGuide.jsx).
 * Every claim here was checked directly against the component/engine code
 * it describes (ConfigPanel.jsx, desEngine.js's sortQueue, SimulationControls.jsx,
 * WorkshopFloorPlan.jsx, KpiCard.jsx/KpiExplanations.jsx, ChartsPanel.jsx,
 * exportXlsx.js, the bottleneck-color system) rather than written from
 * general assumptions about what a dashboard like this "probably" has —
 * nothing below describes a control or number that isn't actually in the app.
 *
 * Each section supports: `summary` (one-line teaser, always shown when the
 * section is open), `paragraphs` (free-form prose), and `items` (either a
 * definition list of {label, text}, or — when `ordered` is true — numbered
 * steps in the same shape, used for the first-time-user workflow). */
export const HELP_SECTIONS = [
  {
    id: 'configuration',
    icon: Settings,
    title: 'Configuration Controls',
    summary: 'Everything under the "Configure" button in the top bar — horizon, arrivals, bays, and workforce.',
    paragraphs: [
      'Click Configure in the top bar to open or close the configuration column. It stays open while you adjust settings, so you can tweak several things before running.',
    ],
    items: [
      { label: 'Simulation Horizon', text: 'How many days the run simulates. Flatbed % and Car Carrier % set the mix of arriving vehicle types and always auto-normalize to sum to 100 — editing one adjusts the other for you.' },
      { label: 'Scheduling policy', text: 'Chooses which waiting truck starts next whenever a bay and its required workers are both free. See "Scheduling Policies" below for what each option does.' },
      { label: 'Fixed random seed', text: 'When checked, arrivals and service-time variation are generated from the given Seed number, so re-running the same configuration reproduces an identical simulation — the fair way to compare two configurations. Unchecked, each run is freshly randomized.' },
      { label: 'Bay Configuration', text: 'Standard, Dedicated, and Inspection bay counts, plus two quick presets — Baseline (8 / 0 / 1) and +4 Dedicated (8 / 4 / 1) — for testing whether adding dedicated bays relieves a bottleneck.' },
      { label: 'Workforce', text: 'Per department (Mechanical, Denting, Balancer, Electrician, Welder, Tire): worker counts by skill level — High / Medium / Low, scored 9 / 6 / 3 and used to scale how fast that worker completes a job — plus an Absent % that reduces effective headcount for the run. "Add" appends one new worker at a chosen skill level directly to a department.' },
    ],
  },
  {
    id: 'scheduling',
    icon: ListOrdered,
    title: 'Scheduling Policies',
    summary: 'The four rules the workshop can use to decide which waiting truck gets the next free bay.',
    paragraphs: [
      'A policy only decides the order among trucks that are already able to start — it never changes how many trucks the shop can process at once, only which one goes first when more than one could.',
    ],
    items: [
      { label: 'First Come First Serve', text: 'Serves waiting trucks strictly in arrival order. The simplest, most predictable policy — though a fast job can end up waiting behind a much longer one that arrived first.' },
      { label: 'Shortest Job First', text: 'Always serves whichever waiting truck has the shortest expected service time next. This minimizes average waiting time across all trucks, but a long job can in principle keep getting pushed back if shorter jobs keep arriving.' },
      { label: 'Priority (Vehicle Type only)', text: 'Always serves any waiting Car Carrier before any Flatbed, breaking ties by arrival order within each group — models a business rule where car carriers get priority regardless of job length.' },
      { label: 'Hybrid (Vehicle Priority + SJF)', text: 'The default. Combines both rules: Car Carriers are served before Flatbeds, and within each group the shortest job goes first.' },
    ],
  },
  {
    id: 'simulation-controls',
    icon: PlayCircle,
    title: 'Simulation Controls',
    summary: 'The playback transport in the top bar — Run, Play/Pause, speed, skip, reset, and the scrub bar.',
    items: [
      { label: 'Run Simulation', text: 'Computes a complete new result from the current configuration (with a short boot sequence), then starts playback paused at time zero. The whole run is computed up front — playback just reveals it over time.' },
      { label: 'Play / Pause', text: 'Advances playback in real time at the currently selected speed.' },
      { label: 'Speed slider', text: '13 discrete levels, from 30 simulated minutes per real second up to 30 simulated days per real second — slow it down to watch individual trucks, or speed it up to sweep through a multi-day run.' },
      { label: 'Skip to end', text: 'Jumps playback straight to the end of the run.' },
      { label: 'Reset', text: 'Rewinds playback to Day 1 while keeping the same computed result and configuration (asks for confirmation first).' },
      { label: 'Scrub bar', text: 'On the Live Simulation page, drag to jump playback to any point in the run instantly.' },
      { label: 'Clock, status badge, event counter', text: 'In the top bar, these always reflect the current playback instant — not the end of the run — so they update as you play, scrub, or reset.' },
    ],
  },
  {
    id: 'workshop-map',
    icon: Warehouse,
    title: 'Workshop Map',
    summary: 'The vertical process flow and the spatial floor plan digital twin, both on the Live Simulation page.',
    paragraphs: [
      'The vertical flow (Entry → Queue → Inspection → Standard Bays → Dedicated Bays → Exit) shows every truck as a card moving through the process. Below it, the Spatial Floor Plan renders the same workshop to scale, with trucks animated as they travel between zones.',
    ],
    items: [
      { label: 'Hovering a truck', text: 'Shows its ID, job, arrival time, waiting time, assigned workers, bay, and expected completion time.' },
      { label: 'Shape toggle (L / U)', text: 'Switches between an L-shaped and U-shaped physical layout using the same bay counts — this only changes the geometry shown, never the simulation result.' },
      { label: 'Zoom controls', text: 'Use the +/− buttons, the reset button, Ctrl/⌘ + scroll, or a trackpad pinch to zoom the floor plan. Truck ID labels only appear once you’re zoomed in far enough for them to stay readable.' },
      { label: 'Status legend', text: 'Icons under the map identify Waiting, Moving, In Service, Inspection, Completed, and Bottleneck states.' },
      { label: 'Bottleneck colors legend', text: 'Lists every color the map can highlight a bay or truck with — see "Bottleneck Visualization" below for what each one means.' },
    ],
  },
  {
    id: 'kpi-definitions',
    icon: BarChart3,
    title: 'KPI Definitions',
    summary: 'The 8 Live KPI cards, their info tooltips, and the full "What do these KPIs mean?" reference.',
    paragraphs: [
      'The Live KPIs card shows 8 live-updating numbers: Avg Waiting Time, Queue Length, Throughput/day, Busy Bays, Idle Bays, Worker Utilization, Completed Trucks, and Avg Time in System.',
    ],
    items: [
      { label: 'Info icon (hover)', text: 'Every KPI card has a small info icon — hover it for a short reminder of what the number means.' },
      { label: 'Info icon (click)', text: 'Click it to jump straight to that KPI’s full entry — exact formula, units, how to interpret it, and why it matters — in the "What do these KPIs mean?" panel directly below the grid. That panel is its own accordion, collapsed by default.' },
      { label: 'Clicking the card itself', text: 'Opens a larger chart of that KPI’s recent trend, with a Recent / Full Run toggle (or Ctrl/⌘ + scroll) to see the whole simulation history back to day 0.' },
      { label: 'Elsewhere in the app', text: 'The same underlying definitions apply to the equivalent figures shown on the Bay Utilization, Worker Utilization, and Flow Time Analysis pages.' },
    ],
  },
  {
    id: 'charts',
    icon: LineChart,
    title: 'Charts',
    summary: 'The Live Charts panel plus the dedicated chart on each analysis page.',
    items: [
      { label: 'Live Charts panel', text: 'Below the KPI grid on the Live Simulation page: Queue Length vs. Time, Throughput vs. Time (cumulative completions), and Average Waiting Time vs. Time.' },
      { label: 'Bay / Worker Utilization pages', text: 'Each has a dropdown to pick a specific bay or department, and a chart of that resource’s utilization over time.' },
      { label: 'Flow Time Analysis page', text: 'A dropdown to pick a job type, and a chart of that job type’s running average flow time (arrival to departure) over the course of the run.' },
      { label: 'Expanding a chart', text: 'Click any chart to open a larger view; hover a point on any chart for its exact value at that moment.' },
    ],
  },
  {
    id: 'downloads',
    icon: Download,
    title: 'Downloads',
    summary: 'Excel (.xlsx) exports available from the top bar and from each analysis page.',
    items: [
      { label: 'Download Data (top bar)', text: 'Exports the complete run as a workbook: every truck’s full record — arrival, waiting time, service, departure, assigned bay, assigned workers — plus a Read Me sheet explaining every column.' },
      { label: 'Download Excel (Bay Utilization page)', text: 'Exports a bay-focused workbook: a formula-driven Bay Summary sheet, the full Bay Job History, and a Utilization Over Time sheet.' },
      { label: 'Download Excel (Worker Utilization page)', text: 'Exports a department-focused workbook: a formula-driven Department Summary sheet, the full Job Assignments history, and a Utilization Over Time sheet.' },
      { label: 'Formulas, not just values', text: 'Summary figures in every export are live spreadsheet formulas referencing the raw data sheet in the same workbook, so they recalculate correctly if you filter or edit the underlying rows in Excel, Google Sheets, or LibreOffice.' },
      { label: 'Availability', text: 'All downloads are disabled until a simulation has actually been run.' },
    ],
  },
  {
    id: 'bottleneck',
    icon: AlertTriangle,
    title: 'Bottleneck Visualization',
    summary: 'How the app shows what’s constraining the workshop right now, and why the highlight color changes.',
    paragraphs: [
      'The app continuously identifies whichever bay type or worker department is most constraining throughput at the current playback instant, shown as a "Bottleneck: ..." badge in the top bar.',
    ],
    items: [
      { label: 'Bay-capacity shortage', text: 'When Standard, Dedicated, or Inspection bays are all occupied, the bottleneck shows in the same red used everywhere: the top-bar badge, the floor plan’s zone highlight, and the legend.' },
      { label: 'Worker-department shortage', text: 'When a bay is physically free but the job waiting for it needs workers from a department that’s fully occupied, the bottleneck instead shows in that department’s own unique color — Mechanical, Denting, Balancer, Electrician, Welder, and Tire each have a distinct color, used consistently across the affected bay’s border, that department’s worker card, and the floor-plan legend.' },
      { label: 'Reading it at a glance', text: 'Because the cause always gets its own consistent color, you can tell "we’re out of bays" apart from "we’re out of a specific skill" without reading any text — the floor plan’s "Bottleneck colors" legend beneath the map lists every color in use.' },
    ],
  },
  {
    id: 'workflow',
    icon: Compass,
    title: 'Recommended Workflow for First-Time Users',
    summary: 'A suggested first pass through the app, from default configuration to a saved report.',
    ordered: true,
    items: [
      { label: 'Review the defaults', text: 'Open Configure and check the default bay counts, workforce, and scheduling policy. Adjust anything you want to test, or leave the defaults for a first look.' },
      { label: 'Run the simulation', text: 'Click Run Simulation. The engine computes the entire run up front, so every number you’ll see during playback is already final — playback just reveals it over time.' },
      { label: 'Play and explore', text: 'Press Play and watch the floor plan and KPIs update. Use the speed slider to move faster through a multi-day run, or the scrub bar to jump straight to a point in time.' },
      { label: 'Understand the numbers', text: 'Watch the top bar’s Bottleneck badge and the floor plan’s color-coded highlighting to see what’s constraining the shop. Hover any KPI’s info icon, or open "What do these KPIs mean?", for exactly what each number is telling you.' },
      { label: 'Go deeper on one resource', text: 'Switch to the Bay Utilization, Worker Utilization, or Flow Time Analysis tabs for a resource- or job-type-specific view, each with its own chart and Excel export.' },
      { label: 'Compare a change', text: 'Change one thing in Configure — add bays, add workers, change the scheduling policy — and click Run Simulation again. Keep Fixed random seed on with the same seed if you want an apples-to-apples comparison between runs.' },
      { label: 'Save your results', text: 'Use Download Data, or the per-page Download Excel buttons, to save the full run for offline analysis or reporting.' },
    ],
  },
];
