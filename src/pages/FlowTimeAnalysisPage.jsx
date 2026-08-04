import React, { useEffect, useMemo, useState } from 'react';
import { Timer, Hash } from 'lucide-react';
import Card from '../components/ui/Card.jsx';
import ChartBox from '../components/charts/ChartBox.jsx';
import StatTile from '../components/ui/StatTile.jsx';
import { BASE_LINE_OPTIONS, styledDataset, chartTrend } from '../lib/chartTheme.js';
import { countLE, liveFlowStats } from '../engine/frameSelectors.js';
import { JOB_TYPES } from '../engine/desEngine.js';
import { CATEGORY_LABEL } from '../lib/styleMaps.js';
import { CHART_LINE_COLORS, fmtDuration } from '../lib/theme.js';

const CATEGORY_ORDER = ['standard', 'medium', 'long', 'inspection'];

/** "Flow time" is time-in-system — arrival to departure — for a completed
 *  job, exactly the same quantity the engine's own avgSystem KPI and the
 *  Excel exports' "Time in System" column already report, just broken out
 *  per job type here instead of averaged across the whole workshop. This
 *  page mirrors the Bay/Worker Utilization pages' shape (a Card, a
 *  dropdown selecting which slice of the run to look at, a stat-tile row,
 *  one ChartBox) applied to a different underlying question: not "how busy
 *  is this resource", but "how long does this particular kind of job take
 *  a truck to get through, start to finish". */
export default function FlowTimeAnalysisPage({ result, frame }) {
  const [selected, setSelected] = useState(JOB_TYPES[0].id);

  useEffect(() => {
    if (result && !JOB_TYPES.some((j) => j.id === selected)) setSelected(JOB_TYPES[0].id);
  }, [result, selected]);

  if (!result || !frame) {
    return (
      <Card title="Flow Time Analysis" icon={Timer}>
        <p className="text-[12.5px] text-ink-faint">Run the simulation to explore flow time for an individual job type.</p>
      </Card>
    );
  }

  const job = JOB_TYPES.find((j) => j.id === selected) || JOB_TYPES[0];

  // Exact, live-recomputed stats as of the current playback instant — see
  // liveFlowStats' own comment for why these aren't read from a coarse
  // precomputed sample grid the way the chart series below is.
  const stats = liveFlowStats(result, frame.t, job.id);

  // The chart, on the other hand, uses the precomputed-once-per-run
  // running-average series (computeFlowTimeSeries, called from
  // useSimulation.js alongside computeUtilSeries) — same sample-grid +
  // countLE-index pattern the Bay/Worker Utilization pages' charts use, so
  // redrawing it on every animation-frame tick is just an array lookup.
  const sampleTimes = result.flow.sampleTimes;
  const idx = Math.max(0, Math.min(sampleTimes.length - 1, countLE(sampleTimes, frame.t)));
  const labels = sampleTimes.map((t) => (t / 1440).toFixed(1));
  const seriesInfo = result.flow.byJob[job.id];
  const series = seriesInfo ? seriesInfo.series : sampleTimes.map(() => null);

  const chartData = {
    labels,
    datasets: [
      styledDataset({
        series,
        idx,
        color: CHART_LINE_COLORS.flowTime,
        label: `${job.name} — running average flow time (min)`,
      }),
    ],
  };

  return (
    <div className="flex flex-col gap-4">
      <Card
        title="Flow Time Analysis — By Job Type"
        icon={Timer}
        right={
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="rounded-md border border-line bg-white px-2.5 py-1.5 text-[12.5px] text-ink focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          >
            {CATEGORY_ORDER.map((cat) => {
              const jobsInCat = JOB_TYPES.filter((j) => j.category === cat);
              if (!jobsInCat.length) return null;
              return (
                <optgroup key={cat} label={CATEGORY_LABEL[cat]}>
                  {jobsInCat.map((j) => (
                    <option key={j.id} value={j.id}>{j.name}</option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        }
      >
        <div className="mb-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile value={fmtDuration(stats.avg)} label="Average Flow Time" />
          <StatTile value={fmtDuration(stats.median)} label="Median Flow Time" />
          <StatTile value={fmtDuration(stats.min)} label="Minimum" valueClassName="text-[19px] font-extrabold tabular-nums text-emerald-600" />
          <StatTile value={fmtDuration(stats.max)} label="Maximum" valueClassName="text-[19px] font-extrabold tabular-nums text-red-500" />
          <StatTile value={fmtDuration(stats.stdDev)} label="Std. Deviation" valueClassName="text-[19px] font-extrabold tabular-nums text-violet-600" />
          <StatTile
            valueNode={<div className="flex items-center justify-center gap-1 text-[19px] font-extrabold tabular-nums text-ink"><Hash size={14} className="text-ink-faint" />{stats.n}</div>}
            label="Completed So Far"
          />
        </div>

        <p className="mb-3 text-[11px] text-ink-faint">
          Flow time = time in system (arrival to departure) for completed <span className="font-semibold text-ink-soft">{job.name}</span> jobs only —
          statistics above cover every one of those jobs that has fully departed as of the current simulated time; a job still queued or in service
          doesn't have a known flow time yet, so it isn't counted until it does.
        </p>

        <ChartBox
          title={`${job.name} — Running Average Flow Time Over Time`}
          subtitle="Cumulative average of every completed job of this type so far, revealed live"
          trend={chartTrend(series, idx)}
          height={320}
          data={chartData}
          options={{
            ...BASE_LINE_OPTIONS,
            plugins: {
              ...BASE_LINE_OPTIONS.plugins,
              tooltip: {
                ...BASE_LINE_OPTIONS.plugins.tooltip,
                callbacks: { label: (ctx) => `${fmtDuration(ctx.parsed.y)} avg flow time` },
              },
            },
          }}
        />
      </Card>
    </div>
  );
}
