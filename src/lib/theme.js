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
};

export const CHART_LINE_COLORS = {
  queueLength: '#2563eb',
  throughput: '#059669',
  waitTime: '#d97706',
  bayUtilization: '#2563eb',
  departmentUtilization: '#7c3aed',
};

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
