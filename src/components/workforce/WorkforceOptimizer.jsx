import React, { useMemo, useState } from 'react';
import { Wallet, Sparkles, ChevronDown, ChevronUp, ArrowRight, Loader2, Info, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import Card from '../ui/Card.jsx';
import Panel from '../ui/Panel.jsx';
import StatTile from '../ui/StatTile.jsx';
import { DEPT_KEYS } from '../../engine/desEngine.js';
import { DEFAULT_COST_CONFIG, computeCostBreakdown, optimizeWorkforce, hoursPerDayBreakdown } from '../../lib/workforceCost.js';
import { BASE_LINE_OPTIONS, makeGradientFill } from '../../lib/chartTheme.js';
import { fmtDuration } from '../../lib/theme.js';

/** Rs, Indian digit grouping (2,45,000 not 245,000) — matches the Jaipur
 *  setting; purely a display formatter, never used in any calculation. */
function fmtRs(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

/** One department's headcount-vs-cost curve, built lazily (only when its
 *  row is expanded) straight from `optimizeWorkforce`'s own sweep points —
 *  no numbers are recomputed here, this only draws what the optimizer
 *  already evaluated. Current and recommended headcounts are highlighted
 *  as distinct points so the "why" behind the recommendation is visible,
 *  per the user's explicit ask to be able to see the calculation. */
function DeptCostCurve({ dept }) {
  const points = dept.points;
  const data = useMemo(() => ({
    labels: points.map((p) => String(p.total)),
    datasets: [
      {
        label: 'Total cost (Rs, averaged over 6 replications)',
        data: points.map((p) => Math.round(p.totalCost)),
        borderColor: '#2563eb',
        backgroundColor: makeGradientFill('#2563eb'),
        fill: true,
        tension: 0.3,
        borderWidth: 2,
        pointRadius: points.map((p) => (p.total === dept.recommended ? 6 : p.total === dept.current ? 5 : 2)),
        pointBackgroundColor: points.map((p) => (p.total === dept.recommended ? '#16a34a' : p.total === dept.current ? '#2563eb' : '#94a3b8')),
        pointBorderColor: '#ffffff',
        pointBorderWidth: 1.5,
      },
    ],
  }), [points, dept.recommended, dept.current]);

  const options = useMemo(() => ({
    ...BASE_LINE_OPTIONS,
    plugins: {
      ...BASE_LINE_OPTIONS.plugins,
      tooltip: {
        ...BASE_LINE_OPTIONS.plugins.tooltip,
        callbacks: {
          title: (items) => `${dept.name}: ${items[0].label} worker(s)`,
          label: (item) => {
            const p = points[item.dataIndex];
            const tag = p.total === dept.recommended ? ' (recommended)' : p.total === dept.current ? ' (current)' : '';
            return [`Total cost: ${fmtRs(p.totalCost)}${tag}`, `Avg wait: ${p.avgWait.toFixed(1)} min`, `Utilization: ${(p.util * 100).toFixed(0)}%`];
          },
        },
      },
    },
    scales: {
      x: { ...BASE_LINE_OPTIONS.scales.x, title: { display: true, text: 'Headcount', color: '#64748b', font: { size: 10.5, weight: '600' } } },
      y: { ...BASE_LINE_OPTIONS.scales.y, title: { display: true, text: 'Total Cost (Rs)', color: '#64748b', font: { size: 10.5, weight: '600' } } },
    },
  }), [points, dept.recommended, dept.current, dept.name]);

  return (
    <div className="mt-2 rounded-lg border border-line bg-white p-2.5" style={{ height: 190 }}>
      <Line data={data} options={options} />
    </div>
  );
}

function DeltaChip({ current, recommended }) {
  const delta = recommended - current;
  if (delta === 0) return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-bold text-ink-faint">No change</span>;
  const down = delta < 0;
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${down ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
      {down ? '' : '+'}{delta}
    </span>
  );
}

function DeptRow({ dept, expanded, onToggle }) {
  return (
    <Panel className="p-2.5">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-2 text-left">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold text-ink">{dept.name}</span>
          <DeltaChip current={dept.current} recommended={dept.recommended} />
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[12.5px] font-bold tabular-nums text-ink-soft">
            {dept.current} <ArrowRight size={11} className="text-ink-faint" /> <span className={dept.recommended < dept.current ? 'text-emerald-600' : dept.recommended > dept.current ? 'text-amber-600' : 'text-ink-soft'}>{dept.recommended}</span>
          </span>
          {expanded ? <ChevronUp size={14} className="text-ink-faint" /> : <ChevronDown size={14} className="text-ink-faint" />}
        </div>
      </button>
      {expanded && <DeptCostCurve dept={dept} />}
    </Panel>
  );
}

/** Worker Cost & Optimizer panel — the always-visible "current cost" strip
 *  is priced directly off the live `result` (no extra simulate() calls, so
 *  it costs nothing and updates the instant a run finishes); the
 *  optimizer sweep itself is explicit and on-demand (a real ~3-5s
 *  computation — 6 departments x ~7 candidates x 6 replications, see
 *  workforceCost.js) since it isn't something to silently re-run on every
 *  keystroke. Every number shown is either read straight off `result` or
 *  straight off `optimizeWorkforce`'s own output — nothing is
 *  re-derived independently in this component. */
export default function WorkforceOptimizer({ config, setConfig, result }) {
  const [optimizing, setOptimizing] = useState(false);
  const [opt, setOpt] = useState(null);
  const [expandedDept, setExpandedDept] = useState(null);
  const [applied, setApplied] = useState(false);

  const costConfig = config.costConfig || DEFAULT_COST_CONFIG;

  const currentCost = useMemo(() => (result ? computeCostBreakdown(result, costConfig) : null), [result, costConfig]);
  const hoursInfo = useMemo(() => hoursPerDayBreakdown(costConfig), [costConfig]);

  const runOptimization = () => {
    setOptimizing(true);
    setApplied(false);
    // Deferred so the "Optimizing…" spinner actually paints before the
    // synchronous sweep (a real ~3-5s computation) blocks the JS thread.
    setTimeout(() => {
      const r = optimizeWorkforce(config, costConfig);
      setOpt(r);
      setOptimizing(false);
    }, 30);
  };

  const applyRecommended = () => {
    if (!opt) return;
    setConfig((c) => ({ ...c, departments: opt.recommendedDepartments }));
    setApplied(true);
  };

  if (!result || !currentCost) {
    return (
      <Card title="Workforce Cost & Optimizer" icon={Wallet}>
        <p className="text-[12.5px] text-ink-faint">Run the simulation to see labor cost and get a workforce recommendation.</p>
      </Card>
    );
  }

  const savingsPositive = opt && opt.savings > 0;

  return (
    <Card title="Workforce Cost & Optimizer" icon={Wallet}>
      {/* Standard + overtime hours currently priced into every figure below
          (editable in Configuration → Cost Assumptions) — shown here too so
          the "why" behind Labor Cost is visible without leaving this panel. */}
      <div className="mb-3 flex items-center justify-between rounded-lg border border-line bg-surface-soft px-2.5 py-2 text-[11px] font-semibold text-ink-soft">
        <span>{hoursInfo.hoursPerDay.toFixed(1)} hrs/day standard{hoursInfo.overtimeHours > 0 && <> + <span className="text-amber-600">{hoursInfo.overtimeHours.toFixed(1)} hrs OT</span> (x{hoursInfo.otWageMultiplier})</>}</span>
        <span className="text-ink">{hoursInfo.totalHoursPerDay.toFixed(1)} hrs/day worked</span>
      </div>

      {/* Always-on: what the CURRENT configured workforce costs, over the
          run's own horizon — busy + idle always reconcile back to labor
          cost exactly, so nothing here is double-counted. */}
      <div className="mb-3 grid grid-cols-2 gap-2.5">
        <StatTile value={fmtRs(currentCost.laborCostTotal)} label="Labor Cost (roster)" valueClassName="text-[16px] font-extrabold tabular-nums text-ink" />
        <StatTile value={fmtRs(currentCost.waitCost)} label="Waiting Cost" valueClassName="text-[16px] font-extrabold tabular-nums text-amber-600" />
        <StatTile value={fmtRs(currentCost.idleCostTotal)} label="Idle Cost (paid, unused)" valueClassName="text-[15px] font-bold tabular-nums text-ink-faint" />
        <StatTile value={fmtRs(currentCost.totalCost)} label="Total Cost" valueClassName="text-[16px] font-extrabold tabular-nums text-brand-600" />
      </div>

      {/* Waiting cost isn't flat — it escalates the longer a truck waits
          (see workforceCost.js's "PROGRESSIVE WAITING COST"). Showing the
          3-tier split here is the "let the user see the calculation" ask:
          every rupee in the Waiting Cost tile above is accounted for in
          exactly one of these three rows. */}
      <div className="mb-3 rounded-lg border border-line bg-surface-soft p-2.5">
        <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink-faint">Waiting Cost — by wait-time tier</div>
        <div className="space-y-1">
          {currentCost.waitDetail.tiers.map((t, i) => (
            <div key={i} className="flex items-center justify-between text-[11px] text-ink-soft">
              <span>{t.label} wait <span className="text-ink-faint">(Rs {t.rate}/min{i > 0 ? ` — x${i === 1 ? 2 : 4}` : ''})</span></span>
              <span className="font-semibold tabular-nums">{fmtRs(t.cost)}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="mb-3 flex items-start gap-1.5 text-[10px] leading-relaxed text-ink-faint">
        <Info size={11} className="mt-0.5 shrink-0" />
        Over this run's {result.cfg.horizonDays}-day horizon. Labor Cost = blended wage x roster availability x hours worked (standard hours at normal rate, overtime hours at x{hoursInfo.otWageMultiplier}). Waiting Cost prices every truck-minute spent in queue (including trucks still queued when the run ended) at an escalating rate the longer a truck waits — edit hours, overtime %, rates, and tier thresholds in Configuration → Cost Assumptions.
      </p>

      {currentCost.overWaitThreshold && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-[11.5px] leading-relaxed text-red-800">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-red-600" />
          <p>
            <strong>Waiting cost is {currentCost.waitCostPctOfTotal.toFixed(0)}% of total cost</strong> (warns at {currentCost.waitCostWarnPct}%). Trucks are waiting long enough that this is very likely a sign of too few bays or workers for current demand, not routine queueing — run <strong>Find Optimal Workforce</strong> below, or add bay capacity in Configuration.
          </p>
        </div>
      )}

      {!opt && (
        <button
          type="button"
          onClick={runOptimization}
          disabled={optimizing}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-[12.5px] font-semibold text-white transition-all duration-150 hover:bg-brand-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {optimizing ? <><Loader2 size={14} className="animate-spin" /> Optimizing… (6 replications x 6 departments)</> : <><Sparkles size={14} /> Find Optimal Workforce</>}
        </button>
      )}

      {opt && (
        <div>
          <div className={`mb-3 rounded-lg border p-3 ${savingsPositive ? 'border-emerald-200 bg-emerald-50' : 'border-line bg-surface-soft'}`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Recommendation vs. current</span>
              <button type="button" onClick={runOptimization} className="text-[10.5px] font-semibold text-brand-600 hover:underline">Re-run</button>
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className={`text-[20px] font-extrabold tabular-nums ${savingsPositive ? 'text-emerald-700' : 'text-ink'}`}>
                {savingsPositive ? '−' : '+'}{fmtRs(Math.abs(opt.savings))}
              </span>
              <span className="text-[12px] font-semibold text-ink-faint">({opt.savingsPct >= 0 ? '' : '+'}{opt.savingsPct.toFixed(1)}% total cost)</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-ink-soft">
              <span>Avg wait — before: <strong className="tabular-nums">{fmtDuration(opt.before.avgWait, result.dayMinutes)}</strong></span>
              <span>Avg wait — after: <strong className="tabular-nums">{fmtDuration(opt.after.avgWait, result.dayMinutes)}</strong></span>
            </div>
            <button
              type="button"
              onClick={applyRecommended}
              disabled={applied}
              className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-md border border-brand-600 bg-white px-3 py-1.5 text-[11.5px] font-semibold text-brand-700 transition-all duration-150 hover:bg-brand-50 active:scale-[0.98] disabled:cursor-default disabled:border-emerald-300 disabled:text-emerald-700"
            >
              {applied ? <><CheckCircle2 size={13} /> Applied — click Run Simulation to see it live</> : 'Apply Recommended Workforce'}
            </button>
          </div>

          <div className="space-y-2">
            {DEPT_KEYS.map((k) => (
              <DeptRow key={k} dept={opt.perDept[k]} expanded={expandedDept === k} onToggle={() => setExpandedDept((v) => (v === k ? null : k))} />
            ))}
          </div>

          <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-relaxed text-ink-faint">
            <Info size={11} className="mt-0.5 shrink-0" />
            One-pass, department-by-department search (not a full joint optimum) evaluated at a {opt.probeHorizonDays}-day probe horizon, each candidate averaged over {opt.replications} fixed random replications (seeds {opt.seeds.join(', ')}) — this system has enough variance between random draws that a single run isn't reliable enough to base a recommendation on (verified before shipping). Every candidate is costed at the current {hoursInfo.totalHoursPerDay.toFixed(1)} hrs/day (standard + overtime) setting above. Click a department to see its full headcount-vs-cost curve.
          </p>
        </div>
      )}
    </Card>
  );
}
