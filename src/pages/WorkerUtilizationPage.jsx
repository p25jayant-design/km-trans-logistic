import React, { useEffect, useMemo, useState } from 'react';
import { Users, User, Download } from 'lucide-react';
import Card from '../components/ui/Card.jsx';
import ChartBox from '../components/charts/ChartBox.jsx';
import Badge from '../components/ui/Badge.jsx';
import StatTile from '../components/ui/StatTile.jsx';
import { BASE_LINE_OPTIONS, styledDataset, chartTrend } from '../lib/chartTheme.js';
import { countLE, snapshotAt } from '../engine/frameSelectors.js';
import { DEPT_KEYS, DEPT_NAMES } from '../engine/desEngine.js';
import { utilTone } from '../lib/styleMaps.js';
import { CHART_LINE_COLORS } from '../lib/theme.js';
import { exportWorkerUtilizationXlsx } from '../lib/exportXlsx.js';

export default function WorkerUtilizationPage({ result, frame }) {
  const [selected, setSelected] = useState('mech');

  useEffect(() => {
    if (result && !DEPT_KEYS.includes(selected)) setSelected(DEPT_KEYS[0]);
  }, [result, selected]);

  if (!result || !frame) {
    return (
      <Card title="Worker Utilization" icon={Users}>
        <p className="text-[12.5px] text-ink-faint">Run the simulation to explore utilization for an individual department.</p>
      </Card>
    );
  }

  const sampleTimes = result.util.sampleTimes;
  const idx = Math.max(0, Math.min(sampleTimes.length - 1, countLE(sampleTimes, frame.t)));
  const labels = sampleTimes.map((t) => (t / 1440).toFixed(1));
  const series = result.util.deptSeries[selected] || [];
  const cumulativeUtilNow = series.length ? series[idx] : 0;

  const snap = snapshotAt(result, frame.t);
  const busyNow = snap.dept[selected] || 0;
  const totalNow = result.deptAvail[selected] || 0;
  const availableNow = Math.max(0, totalNow - busyNow);
  const instantUtil = totalNow > 0 ? busyNow / totalNow : 0;

  const chartData = {
    labels,
    datasets: [
      styledDataset({
        series,
        idx,
        color: CHART_LINE_COLORS.departmentUtilization,
        label: `${DEPT_NAMES[selected]} — running utilization %`,
      }),
    ],
  };

  return (
    <div className="flex flex-col gap-4">
      <Card
        title="Worker Utilization — Single Department Detail"
        icon={Users}
        right={
          <div className="flex items-center gap-2">
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="rounded-md border border-line bg-white px-2.5 py-1.5 text-[12.5px] text-ink focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            >
              {DEPT_KEYS.map((k) => (
                <option key={k} value={k}>{DEPT_NAMES[k]}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => exportWorkerUtilizationXlsx(result)}
              title="Download every department's utilization data (summary, job assignments, and running utilization over time) as .xlsx"
              className="flex items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1.5 text-[12.5px] font-medium text-ink-soft transition-colors hover:bg-surface-soft hover:shadow-sm"
            >
              <Download size={14} /> Download Excel
            </button>
          </div>
        }
      >
        <div className="mb-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <StatTile value={`${(cumulativeUtilNow || 0).toFixed(1)}%`} label="Running Utilization" valueClassName="text-[19px] font-extrabold tabular-nums text-violet-600" />
          <StatTile valueNode={<Badge tone={utilTone(instantUtil)}>{(instantUtil * 100).toFixed(0)}%</Badge>} label="Instantaneous" />
          <StatTile
            valueNode={<div className="flex items-center justify-center gap-1 text-[15px] font-bold text-emerald-600"><User size={14} /> {availableNow}</div>}
            label="Available Now"
          />
          <StatTile
            valueNode={<div className="flex items-center justify-center gap-1 text-[15px] font-bold text-orange-600"><User size={14} /> {busyNow}</div>}
            label="Busy Now"
          />
        </div>

        <ChartBox
          title={`${DEPT_NAMES[selected]} — Running Utilization Over Time`}
          subtitle="Cumulative busy worker-minutes / available worker-minutes, revealed live"
          trend={chartTrend(series, idx)}
          height={320}
          data={chartData}
          options={{ ...BASE_LINE_OPTIONS, scales: { ...BASE_LINE_OPTIONS.scales, y: { ...BASE_LINE_OPTIONS.scales.y, max: 100 } } }}
        />
      </Card>
    </div>
  );
}
