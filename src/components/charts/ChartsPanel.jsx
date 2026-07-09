import React, { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import { LineChart } from 'lucide-react';
import Card from '../ui/Card.jsx';
import ChartBox from './ChartBox.jsx';
import { BASE_LINE_OPTIONS, styledDataset, chartTrend } from '../../lib/chartTheme.js';
import { computeWaitSeries, countLE } from '../../engine/frameSelectors.js';
import { CHART_LINE_COLORS } from '../../lib/theme.js';

/** Compact "overview" charts shown on the Live Simulation page. The detailed,
 *  single-resource utilization charts (with a bay/department picker) live on
 *  their own dedicated pages — see src/pages/. */
export default function ChartsPanel({ result, frame }) {
  const data = useMemo(() => {
    if (!result || !frame) return null;
    const sampleTimes = result.util.sampleTimes;
    const idx = Math.max(0, Math.min(sampleTimes.length - 1, countLE(sampleTimes, frame.t)));
    const labels = sampleTimes.map(t => (t / 1440).toFixed(1));

    const queueSeries = sampleTimes.map((t) => {
      const times = result.snapTimes;
      let lo = 0, hi = times.length - 1, ans = 0;
      while (lo <= hi) { const mid = (lo + hi) >> 1; if (times[mid] <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
      return result.snapshots.length ? result.snapshots[ans].queueLen : 0;
    });

    const throughputSeries = sampleTimes.map(t => countLE(result.departuresSorted, t));
    const waitSeries = computeWaitSeries(result, sampleTimes);

    return { labels, idx, queueSeries, throughputSeries, waitSeries };
  }, [result, frame && Math.floor(frame.t / (result?.totalDuration / 150 || 1))]);

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

  return (
    <Card title="Live Charts" icon={LineChart}>
      <div className="flex flex-col gap-3">
        <ChartBox title="Queue Length vs Time" trend={chartTrend(data.queueSeries, data.idx)}>
          <Line data={mkChart(data.queueSeries, CHART_LINE_COLORS.queueLength, 'Queue length')} options={BASE_LINE_OPTIONS} />
        </ChartBox>
        <ChartBox title="Throughput vs Time (cumulative completions)" trend={chartTrend(data.throughputSeries, data.idx)}>
          <Line data={mkChart(data.throughputSeries, CHART_LINE_COLORS.throughput, 'Completed trucks')} options={BASE_LINE_OPTIONS} />
        </ChartBox>
        <ChartBox title="Average Waiting Time vs Time (min)" trend={chartTrend(data.waitSeries, data.idx)}>
          <Line data={mkChart(data.waitSeries, CHART_LINE_COLORS.waitTime, 'Avg wait (min)')} options={BASE_LINE_OPTIONS} />
        </ChartBox>
      </div>
      <p className="mt-2 text-[11px] text-ink-faint">
        Detailed per-bay and per-department utilization charts are on the "Bay Utilization" and "Worker Utilization" pages above.
      </p>
    </Card>
  );
}
