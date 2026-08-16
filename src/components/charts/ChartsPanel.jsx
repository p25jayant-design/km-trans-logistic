import React, { useMemo } from 'react';
import { LineChart } from 'lucide-react';
import Card from '../ui/Card.jsx';
import ChartBox from './ChartBox.jsx';
import { BASE_LINE_OPTIONS, styledDataset, chartTrend, revealUpTo } from '../../lib/chartTheme.js';
import { computeWaitSeries, countLE, deriveArrivalCategory } from '../../engine/frameSelectors.js';
import { CHART_LINE_COLORS } from '../../lib/theme.js';

// Compact top legend, layered onto BASE_LINE_OPTIONS — used only by the two
// two-series (Accident vs. Standard) charts below, so their lines are
// distinguishable even before expanding. The single-series Queue Length
// chart keeps plain BASE_LINE_OPTIONS (no legend needed for one line).
const DUAL_LINE_OPTIONS = {
  ...BASE_LINE_OPTIONS,
  plugins: {
    ...BASE_LINE_OPTIONS.plugins,
    legend: {
      display: true,
      position: 'top',
      align: 'end',
      labels: { color: '#64748b', font: { size: 9.5, weight: '600' }, boxWidth: 8, padding: 6 },
    },
  },
};

/** Builds one dataset for a dual-series chart, same visual recipe as
 *  styledDataset (gradient fill, current-point highlight) but without the
 *  filled area stacking oddly when two datasets overlap — fill is turned
 *  off here so both lines stay individually legible on the same axes. */
function dualDataset({ series, idx, color, label }) {
  const data = revealUpTo(series, idx);
  return {
    label,
    data,
    borderColor: color,
    backgroundColor: color,
    fill: false,
    tension: 0.35,
    borderWidth: 2,
    pointRadius: (ctx) => (ctx.dataIndex === idx ? 4 : 0),
    pointHoverRadius: 5,
    pointBackgroundColor: color,
    pointBorderColor: '#ffffff',
    pointBorderWidth: 2,
  };
}

/** Compact "overview" charts shown on the Live Simulation page. The detailed,
 *  single-resource utilization charts (with a bay/department picker) live on
 *  their own dedicated pages — see src/pages/. */
export default function ChartsPanel({ result, frame }) {
  // Sorted departure times per arrival category, computed once per result
  // (not re-filtered on every frame tick) — same countLE-over-a-sorted-array
  // technique the original combined throughput line already used against
  // result.departuresSorted, just split into two locally-derived arrays
  // instead of reading the engine's own combined one. result.departuresSorted
  // itself is untouched and still used elsewhere (e.g. buildFrame).
  const categoryDepartures = useMemo(() => {
    if (!result) return null;
    const accident = [], standard = [];
    for (const tr of result.trucks) {
      if (tr.departureTime == null) continue;
      const cat = deriveArrivalCategory(tr.job);
      if (cat === 'accident') accident.push(tr.departureTime);
      else if (cat === 'standard') standard.push(tr.departureTime);
    }
    accident.sort((a, b) => a - b);
    standard.sort((a, b) => a - b);
    return { accident, standard };
  }, [result]);

  const data = useMemo(() => {
    if (!result || !frame || !categoryDepartures) return null;
    const sampleTimes = result.util.sampleTimes;
    const idx = Math.max(0, Math.min(sampleTimes.length - 1, countLE(sampleTimes, frame.t)));
    const labels = sampleTimes.map(t => (t / (result.dayMinutes || 1440)).toFixed(1));

    const queueSeries = sampleTimes.map((t) => {
      const times = result.snapTimes;
      let lo = 0, hi = times.length - 1, ans = 0;
      while (lo <= hi) { const mid = (lo + hi) >> 1; if (times[mid] <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
      return result.snapshots.length ? result.snapshots[ans].queueLen : 0;
    });

    const throughputAccidentSeries = sampleTimes.map(t => countLE(categoryDepartures.accident, t));
    const throughputStandardSeries = sampleTimes.map(t => countLE(categoryDepartures.standard, t));
    const waitAccidentSeries = computeWaitSeries(result, sampleTimes, 'accident');
    const waitStandardSeries = computeWaitSeries(result, sampleTimes, 'standard');

    return { labels, idx, queueSeries, throughputAccidentSeries, throughputStandardSeries, waitAccidentSeries, waitStandardSeries };
  }, [result, categoryDepartures, frame && Math.floor(frame.t / (result?.totalDuration / 150 || 1))]);

  if (!result || !frame || !data) {
    return (
      <Card title="Live Charts" icon={LineChart}>
        <p className="text-[12.5px] text-ink-faint">Run the simulation to populate live charts.</p>
      </Card>
    );
  }

  const mkChart = (series, color, label) => ({
    labels: data.labels,
    datasets: [styledDataset({ series, idx: data.idx, color, label })],
  });

  const mkDualChart = (seriesA, colorA, labelA, seriesB, colorB, labelB) => ({
    labels: data.labels,
    datasets: [
      dualDataset({ series: seriesA, idx: data.idx, color: colorA, label: labelA }),
      dualDataset({ series: seriesB, idx: data.idx, color: colorB, label: labelB }),
    ],
  });

  return (
    <Card title="Live Charts" icon={LineChart}>
      <div className="flex flex-col gap-3">
        <ChartBox
          title="Queue Length vs Time"
          trend={chartTrend(data.queueSeries, data.idx)}
          data={mkChart(data.queueSeries, CHART_LINE_COLORS.queueLength, 'Queue length')}
          options={BASE_LINE_OPTIONS}
        />
        <ChartBox
          title="Throughput vs Time (cumulative completions) — Accident vs Standard"
          data={mkDualChart(
            data.throughputAccidentSeries, CHART_LINE_COLORS.accident, 'Accident Repair',
            data.throughputStandardSeries, CHART_LINE_COLORS.standard, 'Standard',
          )}
          options={DUAL_LINE_OPTIONS}
        />
        <ChartBox
          title="Average Waiting Time vs Time (min) — Accident vs Standard"
          data={mkDualChart(
            data.waitAccidentSeries, CHART_LINE_COLORS.accident, 'Accident Repair',
            data.waitStandardSeries, CHART_LINE_COLORS.standard, 'Standard',
          )}
          options={DUAL_LINE_OPTIONS}
        />
      </div>
      <p className="mt-2 text-[11px] text-ink-faint">
        Detailed per-bay and per-department utilization charts are on the "Bay Utilization" and "Worker Utilization" pages above.
      </p>
    </Card>
  );
}
