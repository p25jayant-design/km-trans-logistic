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
