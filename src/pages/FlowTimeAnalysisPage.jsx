import React, { useEffect, useMemo, useState } from 'react';
import { Timer, Hash } from 'lucide-react';
import Card from '../components/ui/Card.jsx';
import ChartBox from '../components/charts/ChartBox.jsx';
import StatTile from '../components/ui/StatTile.jsx';
import { BASE_LINE_OPTIONS, styledDataset, chartTrend } from '../lib/chartTheme.js';
import { countLE, liveFlowStats, liveFlowStatsFiltered, deriveArrivalCategory } from '../engine/frameSelectors.js';
import { JOB_TYPES } from '../engine/desEngine.js';
import { CATEGORY_LABEL } from '../lib/styleMaps.js';
import { CHART_LINE_COLORS, fmtDuration } from '../lib/theme.js';

const CATEGORY_ORDER = ['standard', 'medium', 'long', 'inspection'];

// "Arrival Category" dropdown options — sentinel values (prefixed `cat:` so
// they can never collide with a real JOB_TYPES id) selecting an aggregate
// view across the Accident/Standard classification instead of one specific
// job type. `predicate` filters `result.trucks`; `seriesKey` looks up the
// matching precomputed running-average series in `result.flowByCategory`
// (see computeCategoryFlowTimeSeries in frameSelectors.js).
const CATEGORY_VIEWS = {
  'cat:all': { label: 'All Jobs', seriesKey: 'all', predicate: () => true, color: CHART_LINE_COLORS.flowTime },
  'cat:accident': { label: 'Accident Repair', seriesKey: 'accident', predicate: (tr) => deriveArrivalCategory(tr.job) === 'accident', color: CHART_LINE_COLORS.accident },
  'cat:standard': { label: 'Standard', seriesKey: 'standard', predicate: (tr) => deriveArrivalCategory(tr.job) === 'standard', color: CHART_LINE_COLORS.standard },
};

/** "Flow time" is time-in-system — arrival to departure — for a completed
 *  job, exactly the same quantity the engine's own avgSystem KPI and the
 *  Excel exports' "Time in System" column already report. This page mirrors
 *  the Bay/Worker Utilization pages' shape (a Card, a dropdown selecting
 *  which slice of the run to look at, a stat-tile row, one ChartBox)
 *  applied to a different underlying question: not "how busy is this
 *  resource", but "how long does this particular slice of jobs take a
 *  truck to get through, start to finish".
 *
 *  The dropdown offers two kinds of slice: the original per-job-type view
 *  (unchanged — one specific job like "Air Filter Change"), and a newer
 *  "Arrival Category" view (All Jobs / Accident Repair / Standard) that
 *  aggregates across the Accident-vs-Standard classification instead. Both
 *  read from the exact same underlying truck records; only which trucks
 *  get included differs. */
export default function FlowTimeAnalysisPage({ result, frame }) {
  const [selected, setSelected] = useState('cat:all');

  useEffect(() => {
    if (!result) return;
    const valid = CATEGORY_VIEWS[selected] || JOB_TYPES.some((j) => j.id === selected);
    if (!valid) setSelected('cat:all');
  }, [result, selected]);

  if (!result || !frame) {
    return (
      <Card title="Flow Time Analysis" icon={Timer}>
        <p className="text-[12.5px] text-ink-faint">Run the simulation to explore flow time for an individual job type or arrival category.</p>
      </Card>
    );
  }

  const categoryView = CATEGORY_VIEWS[selected] || null;
  const job = categoryView ? null : (JOB_TYPES.find((j) => j.id === selected) || JOB_TYPES[0]);
  const displayName = categoryView ? categoryView.label : job.name;

  // Exact, live-recomputed stats as of the current playback instant — see
  // liveFlowStats'/liveFlowStatsFiltered's own comments for why these
  // aren't read from a coarse precomputed sample grid the way the chart
  // series below is.
  const stats = categoryView
    ? liveFlowStatsFiltered(result, frame.t, categoryView.predicate)
    : liveFlowStats(result, frame.t, job.id);

  // The chart, on the other hand, uses the precomputed-once-per-run
  // running-average series — computeFlowTimeSeries (per job type) or
  // computeCategoryFlowTimeSeries (per arrival category), both called from
  // useSimulation.js on the same sample-time grid, so this is just an array
  // lookup on every animation-frame tick either way.
  const sampleTimes = result.flow.sampleTimes;
  const idx = Math.max(0, Math.min(sampleTimes.length - 1, countLE(sampleTimes, frame.t)));
  const labels = sampleTimes.map((t) => (t / (result.dayMinutes || 1440)).toFixed(1));
  const seriesInfo = categoryView
    ? result.flowByCategory.byCategory[categoryView.seriesKey]
    : result.flow.byJob[job.id];
  const series = seriesInfo ? seriesInfo.series : sampleTimes.map(() => null);
  const lineColor = categoryView ? categoryView.color : CHART_LINE_COLORS.flowTime;

  const chartData = {
    labels,
    datasets: [
      styledDataset({
        series,
        idx,
        color: lineColor,
        label: `${displayName} — running average flow time (min)`,
      }),
    ],
  };

  return (
    <div className="flex flex-col gap-4">
      <Card
        title="Flow Time Analysis"
        icon={Timer}
        right={
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="rounded-md border border-line bg-white px-2.5 py-1.5 text-[12.5px] text-ink focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          >
            <optgroup label="Arrival Category">
              {Object.entries(CATEGORY_VIEWS).map(([value, v]) => (
                <option key={value} value={value}>{v.label}</option>
              ))}
            </optgroup>
            <optgroup label="By Job Type">
              {CATEGORY_ORDER.map((cat) => {
                const jobsInCat = JOB_TYPES.filter((j) => j.category === cat);
                if (!jobsInCat.length) return null;
                return jobsInCat.map((j) => (
                  <option key={j.id} value={j.id}>{`${CATEGORY_LABEL[cat]} — ${j.name}`}</option>
                ));
              })}
            </optgroup>
          </select>
        }
      >
        <div className="mb-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile value={fmtDuration(stats.avg, result.dayMinutes)} label="Average Flow Time" />
          <StatTile value={fmtDuration(stats.median, result.dayMinutes)} label="Median Flow Time" />
          <StatTile value={fmtDuration(stats.min, result.dayMinutes)} label="Minimum" valueClassName="text-[19px] font-extrabold tabular-nums text-emerald-600" />
          <StatTile value={fmtDuration(stats.max, result.dayMinutes)} label="Maximum" valueClassName="text-[19px] font-extrabold tabular-nums text-red-500" />
          <StatTile value={fmtDuration(stats.stdDev, result.dayMinutes)} label="Std. Deviation" valueClassName="text-[19px] font-extrabold tabular-nums text-violet-600" />
          <StatTile
            valueNode={<div className="flex items-center justify-center gap-1 text-[19px] font-extrabold tabular-nums text-ink"><Hash size={14} className="text-ink-faint" />{stats.n}</div>}
            label="Completed So Far"
          />
        </div>

        <p className="mb-3 text-[11px] text-ink-faint">
          Flow time = time in system (arrival to departure) for completed <span className="font-semibold text-ink-soft">{displayName}</span> {categoryView ? '' : 'jobs '}only —
          statistics above cover every one of those jobs that has fully departed as of the current simulated time; a job still queued or in service
          doesn't have a known flow time yet, so it isn't counted until it does.
          {categoryView && categoryView !== CATEGORY_VIEWS['cat:all'] && ' "Accident Repair" and "Standard" here match the same arrival-category classification used by the Live KPI cards and Simulation Summary.'}
        </p>

        <ChartBox
          title={`${displayName} — Running Average Flow Time Over Time`}
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
                callbacks: { label: (ctx) => `${fmtDuration(ctx.parsed.y, result.dayMinutes)} avg flow time` },
              },
            },
          }}
        />
      </Card>
    </div>
  );
}
