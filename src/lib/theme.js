/* Central palette for anything that can't be expressed as a Tailwind class
 * (Chart.js datasets, inline SVG sparklines, framer-motion box-shadow
 * keyframes). Pure presentation constants — no simulation logic here.
 * Keeping these in one place means every KPI card / chart that represents
 * the same kind of metric (wait time, queue, throughput, utilization)
 * always uses the same color, instead of each component picking its own hex. */

export const KPI_COLORS = {
  wait: '#2563eb',
  queue: '#d97706',
  throughput: '#059669',
  busyBays: '#ea580c',
  idleBays: '#64748b',
  workerUtil: '#7c3aed',
  completed: '#059669',
  timeInSystem: '#2563eb',
  // Accident Repair vs. Standard arrival-mix feature — red for Accident
  // (matches the app's existing red-for-danger/bottleneck convention),
  // green for Standard (matches the existing green-for-routine/available
  // convention). Shared by the two new Live KPI cards and, via
  // CHART_LINE_COLORS below, the split Throughput/Waiting-Time charts.
  accidentArrivals: '#dc2626',
  standardArrivals: '#16a34a',
};

export const CHART_LINE_COLORS = {
  queueLength: '#2563eb',
  throughput: '#059669',
  waitTime: '#d97706',
  bayUtilization: '#2563eb',
  departmentUtilization: '#7c3aed',
  flowTime: '#2563eb',
  accident: '#dc2626',
  standard: '#16a34a',
};

/** Formats a duration given in simulated minutes as a short, human-scale
 *  string — "42 min" for anything under an hour, "3h 15m" under a full
 *  working day, and "2d 4h" beyond that. Job flow times in this model span
 *  an enormous range (a 5-minute Air Filter Change up to a multi-day
 *  Accident Repair), so a single "X min" figure stops being readable well
 *  before the top of that range — this is purely a display formatter,
 *  never used for any calculation.
 *
 *  `dayMinutes` (pass `result.dayMinutes`) is what one working "day" of
 *  shop time actually is — hoursPerDay + overtime, NOT a 24-hour calendar
 *  day. The shop's simulated clock never has an idle overnight gap (see
 *  desEngine.js), so a duration is genuinely "N working days" of continuous
 *  shop time, and breaking it into days using a hardcoded 1440 would
 *  silently assume 16 idle hours per day that don't exist in this model —
 *  understating how many working days something actually took. Defaults to
 *  1440 only for legacy callers that haven't been threaded a real
 *  dayMinutes yet. */
export function fmtDuration(minutes, dayMinutes = 1440) {
  if (minutes == null || Number.isNaN(minutes)) return '—';
  const dm = dayMinutes > 0 ? dayMinutes : 1440;
  const m = Math.round(minutes);
  if (m < 60) return `${m} min`;
  if (m < dm) {
    const h = Math.floor(m / 60), mm = m % 60;
    return mm > 0 ? `${h}h ${mm}m` : `${h}h`;
  }
  const d = Math.floor(m / dm), h = Math.floor((m % dm) / 60);
  return h > 0 ? `${d}d ${h}h` : `${d}d`;
}

/** Compares the current (last) value in an already-computed series against
 *  a value a few points back to derive a display-only trend direction —
 *  purely descriptive labeling of numbers that were already calculated
 *  elsewhere (buildTrends, utilization series, etc.), never a new metric.
 *  Shared by KPI card trend arrows and chart trend badges. */
export function trendDirection(series, lookback = 5) {
  if (!series || series.length < 2) return { dir: 'flat', delta: 0 };
  const curr = series[series.length - 1];
  const startIdx = Math.max(0, series.length - 1 - lookback);
  const prev = series[startIdx];
  if (curr == null || prev == null) return { dir: 'flat', delta: 0 };
  const delta = curr - prev;
  if (Math.abs(delta) < 1e-9) return { dir: 'flat', delta: 0 };
  return { dir: delta > 0 ? 'up' : 'down', delta };
}
