import React, { useEffect, useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { Warehouse, Wrench, Clock3 } from 'lucide-react';
import Card from '../components/ui/Card.jsx';
import ChartBox from '../components/charts/ChartBox.jsx';
import Badge from '../components/ui/Badge.jsx';
import StatTile from '../components/ui/StatTile.jsx';
import { BASE_LINE_OPTIONS, styledDataset, chartTrend } from '../lib/chartTheme.js';
import { countLE, activeIntervalAt } from '../engine/frameSelectors.js';
import { BAY_TYPE_LABEL, CATEGORY_LABEL } from '../lib/styleMaps.js';
import { CHART_LINE_COLORS } from '../lib/theme.js';

const TYPE_ORDER = ['Bu', 'Be', 'Bi'];

export default function BayUtilizationPage({ result, frame }) {
  const bayIds = useMemo(() => {
    if (!result) return [];
    return TYPE_ORDER.flatMap((type) => result.baySlots[type].map((s) => s.id));
  }, [result]);

  const [selected, setSelected] = useState(null);
  useEffect(() => {
    if (bayIds.length && (!selected || !bayIds.includes(selected))) setSelected(bayIds[0]);
  }, [bayIds, selected]);

  if (!result || !frame) {
    return (
      <Card title="Bay Utilization" icon={Warehouse}>
        <p className="text-[12.5px] text-ink-faint">Run the simulation to explore utilization for an individual bay.</p>
      </Card>
    );
  }

  const bayType = selected ? selected.replace(/\d+$/, '') : 'Bu';
  const slot = result.baySlots[bayType]?.find((s) => s.id === selected);
  const seriesInfo = selected ? result.util.baySlotSeries[selected] : null;
  const sampleTimes = result.util.sampleTimes;
  const idx = Math.max(0, Math.min(sampleTimes.length - 1, countLE(sampleTimes, frame.t)));
  const labels = sampleTimes.map((t) => (t / 1440).toFixed(1));

  const activeJob = slot ? activeIntervalAt(slot.intervals, frame.t) : null;
  const cumulativeUtilNow = seriesInfo ? seriesInfo.series[idx] : 0;

  // Plain computation (not a hook) — this runs after the early return above,
  // so it must not call useMemo/useState here (Rules of Hooks).
  const emptySeries = sampleTimes.map(() => 0);
  const chartData = {
    labels,
    datasets: [
      styledDataset({
        series: seriesInfo ? seriesInfo.series : emptySeries,
        idx,
        color: CHART_LINE_COLORS.bayUtilization,
        label: `${selected || ''} — running utilization %`,
      }),
    ],
  };

  return (
    <div className="flex flex-col gap-4">
      <Card
        title="Bay Utilization — Single Bay Detail"
        icon={Warehouse}
        right={
          <select
            value={selected || ''}
            onChange={(e) => setSelected(e.target.value)}
            className="rounded-md border border-line bg-white px-2.5 py-1.5 text-[12.5px] text-ink focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          >
            {TYPE_ORDER.map((type) => (
              result.baySlots[type].length > 0 && (
                <optgroup key={type} label={`${BAY_TYPE_LABEL[type]} Bays`}>
                  {result.baySlots[type].map((s) => (
                    <option key={s.id} value={s.id}>Bay {s.id}</option>
                  ))}
                </optgroup>
              )
            ))}
          </select>
        }
      >
        <div className="mb-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <StatTile value={`${(cumulativeUtilNow || 0).toFixed(1)}%`} label="Running Utilization" />
          <StatTile valueNode={<Badge tone={activeJob ? 'green' : 'gray'}>{activeJob ? 'Busy' : 'Idle'}</Badge>} label="Current Status" />
          <StatTile value={activeJob ? `#${activeJob.truckId}` : '—'} label="Current Truck" valueClassName="truncate text-[13px] font-semibold text-ink" />
          <StatTile value={activeJob ? CATEGORY_LABEL[activeJob.category] : '—'} label="Job Category" valueClassName="truncate text-[13px] font-semibold text-ink" />
        </div>

        {activeJob && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[12px] text-blue-900">
            <Wrench size={14} /> {activeJob.jobName} ({activeJob.vehicleType})
            <Clock3 size={13} className="ml-2" /> {Math.max(0, activeJob.end - frame.t).toFixed(0)} min remaining
          </div>
        )}

        <ChartBox
          title={`Bay ${selected || ''} — Running Utilization Over Time`}
          subtitle="Cumulative busy-time / elapsed-time, revealed live"
          trend={chartTrend(seriesInfo ? seriesInfo.series : emptySeries, idx)}
          height={320}
        >
          <Line data={chartData} options={{ ...BASE_LINE_OPTIONS, scales: { ...BASE_LINE_OPTIONS.scales, y: { ...BASE_LINE_OPTIONS.scales.y, max: 100 } } }} />
        </ChartBox>
      </Card>
    </div>
  );
}
