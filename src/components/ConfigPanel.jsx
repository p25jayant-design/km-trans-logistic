import React, { useEffect, useMemo, useState } from 'react';
import {
  Settings, Warehouse, Users, Timer, Dices, LayoutList, Truck, AlertTriangle,
  IndianRupee, ChevronDown, ChevronUp, Gauge, RotateCcw,
} from 'lucide-react';
import Card from './ui/Card.jsx';
import Panel from './ui/Panel.jsx';
import { DEPT_KEYS, DEPT_NAMES, NATURAL_ACCIDENT_PCT, JOB_TYPES } from '../engine/desEngine.js';
import { DEFAULT_COST_CONFIG, hoursPerDayBreakdown } from '../lib/workforceCost.js';
import { estimateDemandCapacity, validateOverrideEdit } from '../lib/demandCapacity.js';

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11.5px] font-medium text-ink-faint">{label}</span>
      {children}
    </label>
  );
}

const inputCls = 'w-full rounded-md border border-line bg-surface-soft px-2.5 py-1.5 text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500';
const inputClsSm = 'w-full rounded-md border border-line bg-white px-1.5 py-1 text-[11.5px] text-ink focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500';

/** Click-to-expand accordion section — only one section open at a time, so
 *  the panel reads as a set of tabs rather than one long continuous list of
 *  every input at once (per explicit request). Collapsed by default; an
 *  optional `badge` renders next to the chevron (used by the Demand section
 *  to show an always-visible capacity hint even while collapsed). */
function ConfigSection({ id, icon: Icon, title, openId, setOpenId, badge, children }) {
  const open = openId === id;
  return (
    <section className="mb-2 overflow-hidden rounded-lg border border-line">
      <button
        type="button"
        onClick={() => setOpenId((cur) => (cur === id ? null : id))}
        className="flex w-full items-center justify-between gap-2 bg-surface-soft px-3 py-2.5 text-left transition-colors hover:bg-blue-50"
      >
        <span className="flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-wide text-ink-faint">
          <Icon size={13} /> {title}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {badge}
          {open ? <ChevronUp size={14} className="text-ink-faint" /> : <ChevronDown size={14} className="text-ink-faint" />}
        </span>
      </button>
      {open && <div className="p-3">{children}</div>}
    </section>
  );
}

const CATEGORY_GROUPS = [
  { key: 'standard', label: 'Standard Jobs', jobs: JOB_TYPES.filter((j) => j.category === 'standard') },
  { key: 'medium', label: 'Medium Jobs', jobs: JOB_TYPES.filter((j) => j.category === 'medium') },
  { key: 'long', label: 'Long-Duration Jobs', jobs: JOB_TYPES.filter((j) => j.category === 'long' && j.id !== 'accident') },
  { key: 'accident', label: 'Accident Repair (pooled with Standard — see note)', jobs: JOB_TYPES.filter((j) => j.id === 'accident') },
  { key: 'inspection', label: 'Inspection', jobs: JOB_TYPES.filter((j) => j.category === 'inspection') },
];

/** Persistent left-hand configuration column — always visible, per the
 *  control-room layout (not a hidden drawer): operators should be able to
 *  glance at and tweak parameters without losing sight of the floor. */
export default function ConfigPanel({ config, setConfig }) {
  const [openId, setOpenId] = useState(null);

  const update = (patch) => setConfig((c) => ({ ...c, ...patch }));
  const updateBay = (key, val) => setConfig((c) => ({ ...c, bays: { ...c.bays, [key]: Number(val) || 0 } }));
  const updateDept = (key, field, val) =>
    setConfig((c) => ({
      ...c,
      departments: {
        ...c.departments,
        [key]: { ...c.departments[key], [field]: field === 'absent' ? Math.min(1, Math.max(0, Number(val) / 100 || 0)) : Number(val) || 0 },
      },
    }));
  const costConfig = config.costConfig || DEFAULT_COST_CONFIG;
  const hoursInfo = hoursPerDayBreakdown(costConfig);
  const updateCost = (field, val) => {
    const n = Number(val);
    setConfig((c) => ({
      ...c,
      costConfig: { ...(c.costConfig || DEFAULT_COST_CONFIG), [field]: Number.isFinite(n) && n >= 0 ? n : 0 },
    }));
  };
  // Overtime % is a 0-100 range (see hoursPerDayBreakdown in workforceCost.js)
  // — clamped explicitly rather than reusing updateCost's plain >=0 clamp.
  const setOvertimePct = (val) => {
    const n = Number(val);
    setConfig((c) => ({
      ...c,
      costConfig: { ...(c.costConfig || DEFAULT_COST_CONFIG), overtimePct: Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0 },
    }));
  };

  // Horizon (days) needs its own local "what's literally typed" state,
  // separate from config.horizonDays itself: the old version wrote
  // `Number(e.target.value) || 30` straight into config on every keystroke,
  // so the instant the field was fully cleared (value === ''), Number('')
  // is 0, `0 || 30` fell back to 30 and snapped the field's displayed value
  // right back to "30" — making it impossible to ever clear the field out
  // to type a fresh number; only the spinner arrows (which never pass
  // through an empty string) could actually change it. Typing now updates
  // this local text freely, including transiently empty, and only pushes a
  // real number into config once there is one; blur is what settles on a
  // final, clamped [1, 365] value (and restores the last valid number if
  // the field was left empty or invalid).
  const [horizonInput, setHorizonInput] = useState(String(config.horizonDays));
  useEffect(() => { setHorizonInput(String(config.horizonDays)); }, [config.horizonDays]);
  const handleHorizonChange = (e) => {
    const raw = e.target.value;
    setHorizonInput(raw);
    if (raw === '') return;
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) update({ horizonDays: n });
  };
  const handleHorizonBlur = () => {
    const n = Number(horizonInput);
    if (horizonInput === '' || !Number.isFinite(n) || n <= 0) {
      setHorizonInput(String(config.horizonDays));
      return;
    }
    const clamped = Math.max(1, Math.min(365, Math.round(n)));
    setHorizonInput(String(clamped));
    update({ horizonDays: clamped });
  };

  const applyPreset = (preset) => {
    const bays = preset === 'expansion' ? { Bu: 8, Be: 4, Bi: 1 } : { Bu: 8, Be: 0, Bi: 1 };
    setConfig((c) => ({ ...c, bays }));
  };

  const carrierPct = Math.round(config.carCarrierPct * 100);
  const flatbedPct = 100 - carrierPct;
  const setCarrierPct = (val) => update({ carCarrierPct: Math.min(1, Math.max(0, Number(val) / 100 || 0)) });
  const setFlatbedPct = (val) => {
    const fb = Math.min(100, Math.max(0, Number(val) || 0));
    update({ carCarrierPct: (100 - fb) / 100 });
  };

  // Accident Repair Arrival Percentage — the remaining share automatically
  // becomes Standard, exactly like the Flatbed/Car Carrier pair above. See
  // the comment above ACCIDENT_STANDARD_POOL_RATE in desEngine.js for what
  // this does and doesn't change about the simulation. Default is
  // NATURAL_ACCIDENT_PCT (~0.7%), so the readout needs one decimal place of
  // precision — a plain Math.round would collapse a sub-1% value to "1%".
  // The slider itself steps in 0.1% increments for the same reason.
  const accidentPctValue = (config.accidentPct ?? NATURAL_ACCIDENT_PCT) * 100;
  const accidentPctDisplay = accidentPctValue.toFixed(1);
  const standardPctDisplay = (100 - accidentPctValue).toFixed(1);
  const setAccidentPct = (val) => update({ accidentPct: Math.min(1, Math.max(0, Number(val) / 100 || 0)) });

  // ---- Demand & Service Times (per-job overrides) -------------------------
  // Case-default values live in JOB_TYPES itself (desEngine.js) — editing a
  // job here writes an override into config.jobOverrides[jobId], which the
  // engine's effectiveJob() resolves in place of the catalog default (falls
  // straight back to the catalog default whenever no override is present).
  // Each field keeps its own "currently typed" text (keyed by `${jobId}:${field}`)
  // so free typing isn't interrupted mid-keystroke by validation — the value
  // is only checked, and either committed or reverted, on blur (same pattern
  // as the Horizon field above).
  const [rowText, setRowText] = useState({});
  const [overrideWarning, setOverrideWarning] = useState(null);

  const capacity = useMemo(() => estimateDemandCapacity(config), [config]);

  const rowKey = (jobId, field) => `${jobId}:${field}`;
  const effectiveValue = (job, field) => {
    const ov = config.jobOverrides?.[job.id];
    const v = ov?.[field];
    return Number.isFinite(v) && (field === 'arrivalPerDay' ? v >= 0 : v > 0) ? v : job[field];
  };
  const getRowValue = (job, field) => {
    const key = rowKey(job.id, field);
    return rowText[key] !== undefined ? rowText[key] : String(effectiveValue(job, field));
  };
  const handleRowChange = (job, field, raw) => {
    setRowText((s) => ({ ...s, [rowKey(job.id, field)]: raw }));
  };
  const handleRowBlur = (job, field) => {
    const key = rowKey(job.id, field);
    const raw = rowText[key];
    if (raw === undefined) return;
    const n = Number(raw);
    const invalid = raw === '' || !Number.isFinite(n) || n < 0 || (field === 'baseService' && n <= 0);
    if (invalid) {
      setOverrideWarning({ jobId: job.id, message: 'Enter a valid positive number.' });
      setRowText((s) => { const s2 = { ...s }; delete s2[key]; return s2; });
      return;
    }
    const check = validateOverrideEdit(config, job.id, field, n);
    if (!check.ok) {
      setOverrideWarning({ jobId: job.id, message: check.message, dept: check.dept });
      setRowText((s) => { const s2 = { ...s }; delete s2[key]; return s2; });
      return;
    }
    setOverrideWarning(null);
    setConfig((c) => ({
      ...c,
      jobOverrides: { ...c.jobOverrides, [job.id]: { ...c.jobOverrides?.[job.id], [field]: n } },
    }));
    setRowText((s) => { const s2 = { ...s }; delete s2[key]; return s2; });
  };
  const resetJobOverride = (jobId) => {
    setConfig((c) => {
      if (!c.jobOverrides?.[jobId]) return c;
      const next = { ...c.jobOverrides };
      delete next[jobId];
      return { ...c, jobOverrides: next };
    });
    setRowText((s) => {
      const s2 = { ...s };
      delete s2[rowKey(jobId, 'arrivalPerDay')];
      delete s2[rowKey(jobId, 'baseService')];
      return s2;
    });
    setOverrideWarning(null);
  };

  const capacityBadge = (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
        capacity.block ? 'bg-red-100 text-red-700' : capacity.warn ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
      }`}
    >
      {Number.isFinite(capacity.worstUtilization) ? `${(capacity.worstUtilization * 100).toFixed(0)}%` : '∞'}
    </span>
  );

  return (
    <Card title="Configuration" icon={Settings} className="h-fit" bodyClassName="max-h-[calc(100vh-110px)] overflow-y-auto pr-1">
      <ConfigSection id="horizon" icon={Timer} title="Simulation Horizon" openId={openId} setOpenId={setOpenId}>
        <div className="space-y-2.5">
          <div>
            <Field label="Horizon (days)">
              <input type="number" min={1} max={365} className={inputCls}
                value={horizonInput}
                onChange={handleHorizonChange}
                onBlur={handleHorizonBlur} />
            </Field>
            <p className="mt-1 text-[10px] text-ink-faint">
              Tip: for stable, representative results use roughly <strong>14–60 days</strong>. Very short horizons (under ~7 days) may not include enough arrivals of the rarer, long-duration jobs (e.g. Accident Repair, Engine Overhaul) to be meaningful.
            </p>
          </div>

          <div>
            <div className="mb-1 flex items-center gap-1.5 text-[11.5px] font-medium text-ink-faint">
              <Truck size={12} /> Carrier-Type Probability
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Flatbed %">
                <input type="number" min={0} max={100} className={inputCls}
                  value={flatbedPct}
                  onChange={(e) => setFlatbedPct(e.target.value)} />
              </Field>
              <Field label="Car Carrier %">
                <input type="number" min={0} max={100} className={inputCls}
                  value={carrierPct}
                  onChange={(e) => setCarrierPct(e.target.value)} />
              </Field>
            </div>
            <p className="mt-1 text-[10px] text-ink-faint">Auto-normalized — the two always sum to 100%.</p>
          </div>

          <div>
            <div className="mb-1 flex items-center gap-1.5 text-[11.5px] font-medium text-ink-faint">
              <AlertTriangle size={12} /> Accident Repair Arrival Percentage
            </div>
            <input
              type="range" min={0} max={100} step={0.1}
              value={accidentPctValue}
              onChange={(e) => setAccidentPct(e.target.value)}
              className="w-full accent-brand-600"
            />
            <div className="mt-1 flex items-center justify-between text-[11.5px] font-semibold">
              <span className="text-red-600">Accident Repair: {accidentPctDisplay}%</span>
              <span className="text-emerald-600">Standard: {standardPctDisplay}%</span>
            </div>
            <p className="mt-1 text-[10px] text-ink-faint">
              Splits only the combined Accident Repair + Standard-job arrival pool — every other job type (Medium, Denting, Cabin Setting, Engine Overhaul, Inspection) keeps its own unchanged rate. Defaults to ~0.7%, the case's own natural share, so out of the box nothing about baseline behavior changes — drag the slider to model a heavier or lighter accident load.
            </p>
          </div>

          <Field label="Scheduling policy">
            <select className={inputCls} value={config.policy} onChange={(e) => update({ policy: e.target.value })}>
              <option value="hybrid">Hybrid (Vehicle Priority + SJF)</option>
              <option value="priority">Priority (Vehicle Type only)</option>
              <option value="sjf">Shortest Job First</option>
              <option value="fcfs">First Come First Serve</option>
            </select>
          </Field>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="fixedSeed" checked={config.fixedSeed}
              onChange={(e) => update({ fixedSeed: e.target.checked })} />
            <label htmlFor="fixedSeed" className="flex items-center gap-1 text-[12.5px] text-ink-soft">
              <Dices size={13} /> Fixed random seed
            </label>
          </div>
          {config.fixedSeed && (
            <Field label="Seed">
              <input type="number" className={inputCls} value={config.seed}
                onChange={(e) => update({ seed: Number(e.target.value) || 42 })} />
            </Field>
          )}
        </div>
      </ConfigSection>

      <ConfigSection id="demand" icon={Gauge} title="Demand & Service Times" openId={openId} setOpenId={setOpenId} badge={capacityBadge}>
        <div
          className={`mb-3 rounded-lg border p-2.5 text-[11px] ${
            capacity.block ? 'border-red-300 bg-red-50 text-red-800' : capacity.warn ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          <div className="flex items-center gap-1.5 font-bold">
            <Gauge size={13} />
            Long-run load — {capacity.worstDept ? `${DEPT_NAMES[capacity.worstDept]}: ${(capacity.worstUtilization * 100).toFixed(0)}%` : 'no demand configured'}
          </div>
          <p className="mt-1 leading-relaxed">
            {capacity.block
              ? 'At current headcount and shop hours, this department would need more worker-time per day than is available on average — if the shop ran this way indefinitely, its queue would grow without bound. A specific 14–60 day run may still look fine (rare, long jobs like Accident Repair take many days to clear), but demand edits that push this further past 100% are rejected below.'
              : capacity.warn
                ? 'Close to this department\'s long-run available capacity — a bit more demand here could tip it into an unbounded queue.'
                : 'Comfortably within this department\'s long-run available capacity.'}
          </p>
        </div>

        <p className="mb-2.5 text-[10px] leading-relaxed text-ink-faint">
          Arrivals/day and Service time (minutes) default to the case's own figures and can be edited per job. The banner above is a long-run (steady-state) estimate, not a prediction of any one run — check the Worker Utilization page after running the simulation for what a specific horizon actually showed. A demand/service-time increase that would newly push a department past 100% of its long-run capacity is rejected — you'll see why below the field. Lowering a value is always accepted.
        </p>

        {CATEGORY_GROUPS.map((group) => (
          <div key={group.key} className="mb-3 last:mb-0">
            <div className="mb-1 text-[10.5px] font-bold uppercase tracking-wide text-ink-faint">{group.label}</div>
            {group.key === 'accident' && (
              <p className="mb-1.5 text-[10px] leading-relaxed text-ink-faint">
                Accident Repair shares one combined arrival pool with the 10 Standard jobs above. Editing its rate here changes the pool's total size, but which share of the pool becomes Accident vs. Standard is still governed by the Accident Repair Arrival Percentage slider (in Simulation Horizon), not by this field alone.
              </p>
            )}
            <table className="w-full border-separate border-spacing-y-1 text-[11px]">
              <thead>
                <tr className="text-left text-[10px] font-medium text-ink-faint">
                  <th className="w-[38%] pb-0.5 font-medium">Job</th>
                  <th className="pb-0.5 font-medium">Arrivals/day</th>
                  <th className="pb-0.5 font-medium">Service (min)</th>
                  <th className="w-4"></th>
                </tr>
              </thead>
              <tbody>
                {group.jobs.map((job) => {
                  const overridden = !!config.jobOverrides?.[job.id];
                  return (
                    <tr key={job.id}>
                      <td className="pr-1.5 align-middle text-[11px] text-ink-soft">{job.name}</td>
                      <td className="pr-1 align-middle">
                        <input
                          type="number" min={0} step={0.1} className={inputClsSm}
                          value={getRowValue(job, 'arrivalPerDay')}
                          onChange={(e) => handleRowChange(job, 'arrivalPerDay', e.target.value)}
                          onBlur={() => handleRowBlur(job, 'arrivalPerDay')}
                        />
                      </td>
                      <td className="pr-1 align-middle">
                        <input
                          type="number" min={1} step={1} className={inputClsSm}
                          value={getRowValue(job, 'baseService')}
                          onChange={(e) => handleRowChange(job, 'baseService', e.target.value)}
                          onBlur={() => handleRowBlur(job, 'baseService')}
                        />
                      </td>
                      <td className="align-middle">
                        {overridden && (
                          <button type="button" onClick={() => resetJobOverride(job.id)} title="Reset to case default" className="text-ink-faint hover:text-brand-600">
                            <RotateCcw size={12} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {overrideWarning && group.jobs.some((j) => j.id === overrideWarning.jobId) && (
              <p className="mt-1 rounded-md border border-red-200 bg-red-50 p-1.5 text-[10px] leading-relaxed text-red-700">
                {overrideWarning.message}
              </p>
            )}
          </div>
        ))}
      </ConfigSection>

      <ConfigSection id="bays" icon={Warehouse} title="Bay Configuration" openId={openId} setOpenId={setOpenId}>
        <div className="mb-2 flex gap-2">
          <button onClick={() => applyPreset('baseline')} className="flex-1 rounded-md border border-line bg-surface-soft px-2 py-1.5 text-[11px] font-medium text-ink-soft hover:bg-blue-50">Baseline</button>
          <button onClick={() => applyPreset('expansion')} className="flex-1 rounded-md border border-line bg-surface-soft px-2 py-1.5 text-[11px] font-medium text-ink-soft hover:bg-blue-50">+4 Dedicated</button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Standard"><input type="number" min={0} className={inputCls} value={config.bays.Bu} onChange={(e) => updateBay('Bu', e.target.value)} /></Field>
          <Field label="Dedicated"><input type="number" min={0} className={inputCls} value={config.bays.Be} onChange={(e) => updateBay('Be', e.target.value)} /></Field>
          <Field label="Inspection"><input type="number" min={0} className={inputCls} value={config.bays.Bi} onChange={(e) => updateBay('Bi', e.target.value)} /></Field>
        </div>
      </ConfigSection>

      <ConfigSection id="workforce" icon={Users} title="Workforce" openId={openId} setOpenId={setOpenId}>
        <div className="space-y-2.5">
          {DEPT_KEYS.map((k) => {
            const d = config.departments[k];
            return (
              <Panel key={k} className="p-2.5">
                <div className="mb-1.5 text-[12px] font-semibold text-brand-700">{DEPT_NAMES[k]}</div>
                <div className="grid grid-cols-3 gap-1.5">
                  <Field label="Total"><input type="number" min={0} className={inputCls} value={d.total} onChange={(e) => updateDept(k, 'total', e.target.value)} /></Field>
                  <Field label="High"><input type="number" min={0} className={inputCls} value={d.high} onChange={(e) => updateDept(k, 'high', e.target.value)} /></Field>
                  <Field label="Med"><input type="number" min={0} className={inputCls} value={d.med} onChange={(e) => updateDept(k, 'med', e.target.value)} /></Field>
                </div>
                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                  <Field label="Low"><input type="number" min={0} className={inputCls} value={d.low} onChange={(e) => updateDept(k, 'low', e.target.value)} /></Field>
                  <Field label="Absent %"><input type="number" min={0} max={100} className={inputCls} value={Math.round(d.absent * 100)} onChange={(e) => updateDept(k, 'absent', e.target.value)} /></Field>
                </div>
              </Panel>
            );
          })}
        </div>
      </ConfigSection>

      <ConfigSection id="cost" icon={IndianRupee} title="Cost Assumptions" openId={openId} setOpenId={setOpenId}>
        <p className="mb-2 text-[10px] text-ink-faint">
          Rs/hour per skill tier, and the assumed cost of one truck-minute spent waiting — priced by the Workforce Cost &amp; Optimizer panel, no effect on the simulation itself. Standard hrs/day and Overtime % below are the exception: they also set how many hours the shop is actually open each simulated day.
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          <Field label="High Rs/hr"><input type="number" min={0} className={inputCls} value={costConfig.wageHigh} onChange={(e) => updateCost('wageHigh', e.target.value)} /></Field>
          <Field label="Med Rs/hr"><input type="number" min={0} className={inputCls} value={costConfig.wageMed} onChange={(e) => updateCost('wageMed', e.target.value)} /></Field>
          <Field label="Low Rs/hr"><input type="number" min={0} className={inputCls} value={costConfig.wageLow} onChange={(e) => updateCost('wageLow', e.target.value)} /></Field>
        </div>
        <div className="mt-2 rounded-lg border border-line bg-surface-soft p-2.5">
          <div className="grid grid-cols-2 gap-1.5">
            <Field label="Standard hrs/day"><input type="number" min={1} max={24} className={inputCls} value={costConfig.hoursPerDay ?? 8} onChange={(e) => updateCost('hoursPerDay', e.target.value)} /></Field>
            <Field label="Overtime %">
              <input
                type="range" min={0} max={100} step={1}
                value={hoursInfo.overtimePct}
                onChange={(e) => setOvertimePct(e.target.value)}
                className="mt-1.5 w-full accent-brand-600"
              />
            </Field>
          </div>
          <p className="mt-1.5 text-[11px] font-semibold text-ink-soft">
            {hoursInfo.overtimePct}% overtime → <span className="text-amber-600">{hoursInfo.overtimeHours.toFixed(1)} hrs</span> extra/day · <span className="text-ink">{hoursInfo.totalHoursPerDay.toFixed(1)} hrs/day</span> worked total
          </p>
          <p className="mt-1 text-[10px] text-ink-faint">
            The shop only takes in trucks during these hours each simulated day, and the horizon stops after the configured number of days — labor cost is priced off standard hours at the normal wage plus overtime hours at {hoursInfo.otWageMultiplier}x ("time and a half"). Default 0% overtime = {costConfig.hoursPerDay ?? 8} hrs/day only.
          </p>
        </div>
        <div className="mt-1.5">
          <Field label="Wait cost (Rs/truck-minute)"><input type="number" min={0} step={0.5} className={inputCls} value={costConfig.waitCostPerMin} onChange={(e) => updateCost('waitCostPerMin', e.target.value)} /></Field>
        </div>
        <p className="mt-2 text-[10px] text-ink-faint">
          Waiting cost escalates the longer a truck waits — Rs/min above steps up <strong>x2</strong> past the first threshold and <strong>x4</strong> past the second (long waits are usually a sign of too few bays/workers, not routine queueing).
        </p>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          <Field label="x2 after (hrs)"><input type="number" min={0} step={0.5} className={inputCls} value={costConfig.waitTier2Hours} onChange={(e) => updateCost('waitTier2Hours', e.target.value)} /></Field>
          <Field label="x4 after (hrs)"><input type="number" min={0} step={0.5} className={inputCls} value={costConfig.waitTier3Hours} onChange={(e) => updateCost('waitTier3Hours', e.target.value)} /></Field>
        </div>
        <div className="mt-1.5">
          <Field label="Warn when waiting cost reaches (% of total cost)"><input type="number" min={0} max={100} className={inputCls} value={costConfig.waitCostWarnPct} onChange={(e) => updateCost('waitCostWarnPct', e.target.value)} /></Field>
        </div>
      </ConfigSection>

      <div className="mt-3 flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 p-3 text-[11px] leading-relaxed text-blue-900">
        <LayoutList size={13} className="mt-0.5 shrink-0" />
        <p>Skill scores: High=9 / Medium=6 / Low=3. If Dedicated Bays = 0, long-duration jobs route to Standard Bays automatically.</p>
      </div>
    </Card>
  );
}
