/* Shared color/label lookup tables so every component agrees on what a
 * "standard job" or "waiting truck" looks like. Pure presentation — no
 * simulation logic lives here. */

export const CATEGORY_COLOR = {
  standard: { text: 'text-blue-600', bg: 'bg-blue-500', soft: 'bg-blue-50', border: 'border-blue-200', hex: '#2563eb' },
  medium: { text: 'text-violet-600', bg: 'bg-violet-500', soft: 'bg-violet-50', border: 'border-violet-200', hex: '#7c3aed' },
  long: { text: 'text-orange-600', bg: 'bg-orange-500', soft: 'bg-orange-50', border: 'border-orange-200', hex: '#ea580c' },
  inspection: { text: 'text-emerald-600', bg: 'bg-emerald-500', soft: 'bg-emerald-50', border: 'border-emerald-200', hex: '#059669' },
};

export const CATEGORY_LABEL = {
  standard: 'Standard',
  medium: 'Medium-duration',
  long: 'Long-duration',
  inspection: 'Inspection',
};

/* Truck lifecycle-state palette, per the requested spec:
   blue = waiting, orange = allocated, green = under service, gray = completed */
export const TRUCK_STATE_COLOR = {
  waiting: { bg: 'bg-blue-500', text: 'text-blue-700', soft: 'bg-blue-50', border: 'border-blue-200', hex: '#2563eb' },
  allocated: { bg: 'bg-orange-500', text: 'text-orange-700', soft: 'bg-orange-50', border: 'border-orange-200', hex: '#ea580c' },
  service: { bg: 'bg-emerald-500', text: 'text-emerald-700', soft: 'bg-emerald-50', border: 'border-emerald-200', hex: '#059669' },
  completed: { bg: 'bg-gray-400', text: 'text-gray-500', soft: 'bg-gray-100', border: 'border-gray-200', hex: '#9ca3af' },
};

export const BAY_TYPE_LABEL = { Bu: 'Standard', Be: 'Dedicated', Bi: 'Inspection' };

export const TRUCK_STATE_LABEL = { waiting: 'Waiting', allocated: 'Allocated', service: 'In Service', completed: 'Completed' };

/* Bay-status palette for the industrial floor-plan visualization:
   Green = Available, Blue = Reserved, Orange = Busy, Red = Waiting for
   Workers. `available` and `busy` are direct, truthful renderings of the
   engine's own `bay.status` ('idle'/'busy'). `reserved` is also truthful —
   the DES allocates a bay the instant a truck's service event fires, which
   is the exact same instant the floor plan starts that truck's drive-in
   animation, so a bay is genuinely already allocated-but-not-yet-visually-
   occupied for the ~1s the truck is animating toward it; that transit
   window is shown as "reserved" before flipping to "busy" on arrival.
   `waitingForWorkers` is defined here for completeness but the current
   engine allocates a bay and its required workers atomically in one step
   (see desEngine.js's canAllocate/allocate) — a bay can never actually be
   reserved without its workers also being available, so this state is not
   currently triggered by the simulation. It's kept in the palette rather
   than silently dropped so the legend and code stay honest about why. */
export const BAY_STATUS_COLOR = {
  available: { hex: '#16a34a', fill: '#dcfce7', stroke: '#86efac', text: 'text-emerald-700', label: 'Available' },
  reserved: { hex: '#2563eb', fill: '#dbeafe', stroke: '#93c5fd', text: 'text-blue-700', label: 'Reserved' },
  busy: { hex: '#ea580c', fill: '#ffedd5', stroke: '#fdba74', text: 'text-orange-700', label: 'Busy' },
  waitingForWorkers: { hex: '#dc2626', fill: '#fee2e2', stroke: '#fca5a5', text: 'text-red-700', label: 'Waiting for Workers' },
};

export function utilTone(pct) {
  if (pct >= 0.85) return 'red';
  if (pct >= 0.6) return 'amber';
  return 'green';
}

/** Converts a `#rrggbb` (or shorthand `#rgb`) hex color into an `rgba()`
 *  string at the given alpha — used to derive soft tints/rings from a
 *  department's bottleneck color without needing a second hand-picked
 *  color per department. */
export function hexToRgba(hex, alpha = 1) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* Color-coded bottleneck system. `frame.bottleneck` (see frameSelectors.js)
   is either a bay-type shortage (kind: 'bay') or a worker-department
   shortage (kind: 'dept'). Bay-type bottlenecks keep using the single
   existing red already used everywhere in the app for "this needs
   attention" (unchanged from before this system existed — kept here as a
   named constant, `BAY_BOTTLENECK_COLOR`, purely so every consumer can
   share one definition instead of re-typing the same hex). Department
   bottlenecks each get their own unique, easily-told-apart hue — none of
   which collide with red (bay bottleneck), orange (busy/allocated), blue
   (waiting/reserved), green (available/service) or gray (completed), so a
   bottleneck's *cause* is visually unambiguous at a glance. Every entry
   carries a solid `hex` (border/icon/text), a very light `fill` (card
   background tint) and a mid-tone `stroke` (badge border) — the same
   three-tier shape as `BAY_STATUS_COLOR` above, so components can treat
   both palettes identically. */
export const DEPT_BOTTLENECK_COLOR = {
  mech: { hex: '#6366f1', fill: '#eef2ff', stroke: '#a5b4fc', text: 'text-indigo-700' }, // indigo — Mechanical
  dent: { hex: '#db2777', fill: '#fdf2f8', stroke: '#f9a8d4', text: 'text-pink-700' },   // pink — Denting
  bal: { hex: '#9333ea', fill: '#faf5ff', stroke: '#d8b4fe', text: 'text-purple-700' },  // purple — Balancer
  elec: { hex: '#ca8a04', fill: '#fefce8', stroke: '#fde047', text: 'text-yellow-700' }, // yellow — Electrician
  weld: { hex: '#92400e', fill: '#fff7ed', stroke: '#fdba74', text: 'text-amber-800' },  // amber/brown — Welder
  tire: { hex: '#0f766e', fill: '#f0fdfa', stroke: '#5eead4', text: 'text-teal-700' },   // teal — Tire
};

export const BAY_BOTTLENECK_COLOR = { hex: '#dc2626', fill: '#fee2e2', stroke: '#f87171', text: 'text-red-700' };

/** Looks up the right color object for whichever kind of bottleneck is
 *  currently active — the one place every component asks "what color is
 *  this bottleneck", so the bay-vs-department color choice never has to be
 *  duplicated (or drift) across Navbar, WorkshopOverview, WorkerCard,
 *  BayCard and the floor plan. */
export function bottleneckColorFor(bottleneck) {
  if (!bottleneck) return null;
  if (bottleneck.kind === 'dept') return DEPT_BOTTLENECK_COLOR[bottleneck.key] || BAY_BOTTLENECK_COLOR;
  return BAY_BOTTLENECK_COLOR;
}
