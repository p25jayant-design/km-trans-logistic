import React, { useMemo } from 'react';
import { ClipboardList, Target, Crosshair, AlertTriangle, ClipboardCheck, Timer } from 'lucide-react';
import Card from './ui/Card.jsx';
import StatTile from './ui/StatTile.jsx';
import { computeCategorySummary } from '../engine/frameSelectors.js';
import { fmtDuration } from '../lib/theme.js';

function pct(x) { return `${(x * 100).toFixed(1)}%`; }

/** End-of-run Accident Repair vs. Standard summary — "at the end of the
 *  simulation", per the spec, meaning it reflects the whole precomputed
 *  run (via computeCategorySummary, keyed off result.totalDuration) rather
 *  than the current live playback position, so it reads the same whether
 *  you're scrubbed to day 1 or day 30. Memoized on `result` alone (not
 *  `frame`) so it's computed once per Run Simulation, not re-scanned on
 *  every animation-frame tick while playing. */
export default function SimulationSummary({ result }) {
  const summary = useMemo(() => (result ? computeCategorySummary(result) : null), [result]);

  if (!result || !summary) {
    return (
      <Card title="Simulation Summary" icon={ClipboardList}>
        <p className="text-[12.5px] text-ink-faint">Run the simulation to see the Accident Repair vs. Standard breakdown for the full run.</p>
      </Card>
    );
  }

  const ratioDeltaPts = (summary.observedAccidentRatio - summary.configuredAccidentRatio) * 100;

  return (
    <Card title="Simulation Summary" icon={ClipboardList}>
      <div className="mb-3">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-faint">
          <Target size={13} /> Accident Ratio — Configured vs. Observed
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <StatTile value={pct(summary.configuredAccidentRatio)} label="Configured Accident Ratio" valueClassName="text-[19px] font-extrabold tabular-nums text-red-600" />
          <StatTile value={pct(summary.observedAccidentRatio)} label="Observed Accident Ratio" valueClassName="text-[19px] font-extrabold tabular-nums text-red-600" />
        </div>
        <p className="mt-1.5 text-[10.5px] text-ink-faint">
          <Crosshair size={10} className="mr-1 inline-block align-[-1px]" />
          Observed is {Math.abs(ratioDeltaPts) < 0.05 ? 'essentially identical to' : `${ratioDeltaPts > 0 ? '+' : ''}${ratioDeltaPts.toFixed(1)} pts vs.`} configured — over enough arrivals the two converge, since each truck is classified independently against the configured percentage.
        </p>
      </div>

      <div className="mb-3">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-faint">
          <AlertTriangle size={13} /> Arrivals &amp; Completions
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <StatTile
            valueNode={<div className="text-[19px] font-extrabold tabular-nums text-red-600">{summary.accidentArrivals}</div>}
            label="Accident Arrivals"
          />
          <StatTile
            valueNode={<div className="text-[19px] font-extrabold tabular-nums text-emerald-600">{summary.standardArrivals}</div>}
            label="Standard Arrivals"
          />
          <StatTile
            valueNode={<div className="text-[19px] font-extrabold tabular-nums text-red-600">{summary.accidentCompletions}</div>}
            label="Accident Completions"
          />
          <StatTile
            valueNode={<div className="text-[19px] font-extrabold tabular-nums text-emerald-600">{summary.standardCompletions}</div>}
            label="Standard Completions"
          />
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-faint">
          <Timer size={13} /> Average Flow Time
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <StatTile value={fmtDuration(summary.accidentAvgFlowTime)} label="Accident Repair" valueClassName="text-[19px] font-extrabold tabular-nums text-red-600" />
          <StatTile value={fmtDuration(summary.standardAvgFlowTime)} label="Standard" valueClassName="text-[19px] font-extrabold tabular-nums text-emerald-600" />
        </div>
      </div>

      <p className="mt-3 text-[10.5px] text-ink-faint">
        <ClipboardCheck size={10} className="mr-1 inline-block align-[-1px]" />
        Covers the entire simulated run, start to finish — unlike the Live KPI cards above, this doesn't change as you scrub or play back.
      </p>
    </Card>
  );
}
