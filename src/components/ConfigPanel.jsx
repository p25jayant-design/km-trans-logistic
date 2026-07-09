import React from 'react';
import { Settings, Warehouse, Users, Timer, Dices, LayoutList } from 'lucide-react';
import Card from './ui/Card.jsx';
import Panel from './ui/Panel.jsx';
import { DEPT_KEYS, DEPT_NAMES } from '../engine/desEngine.js';

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11.5px] font-medium text-ink-faint">{label}</span>
      {children}
    </label>
  );
}

const inputCls = 'w-full rounded-md border border-line bg-surface-soft px-2.5 py-1.5 text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500';

/** Persistent left-hand configuration column — always visible, per the
 *  control-room layout (not a hidden drawer): operators should be able to
 *  glance at and tweak parameters without losing sight of the floor. */
export default function ConfigPanel({ config, setConfig }) {
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

  const applyPreset = (preset) => {
    const bays = preset === 'expansion' ? { Bu: 8, Be: 4, Bi: 1 } : { Bu: 8, Be: 0, Bi: 1 };
    setConfig((c) => ({ ...c, bays }));
  };

  return (
    <Card title="Configuration" icon={Settings} className="h-fit" bodyClassName="max-h-[calc(100vh-110px)] overflow-y-auto pr-1">
      <section className="mb-5">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-faint">
          <Timer size={13} /> Simulation Horizon
        </div>
        <div className="space-y-2.5">
          <Field label="Horizon (days)">
            <input type="number" min={1} max={365} className={inputCls}
              value={config.horizonDays}
              onChange={(e) => update({ horizonDays: Math.max(1, Number(e.target.value) || 30) })} />
          </Field>
          <Field label="% Car Carrier arrivals">
            <input type="number" min={0} max={100} className={inputCls}
              value={Math.round(config.carCarrierPct * 100)}
              onChange={(e) => update({ carCarrierPct: Math.min(1, Math.max(0, Number(e.target.value) / 100 || 0)) })} />
          </Field>
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
      </section>

      <section className="mb-5">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-faint">
          <Warehouse size={13} /> Bay Configuration
        </div>
        <div className="mb-2 flex gap-2">
          <button onClick={() => applyPreset('baseline')} className="flex-1 rounded-md border border-line bg-surface-soft px-2 py-1.5 text-[11px] font-medium text-ink-soft hover:bg-blue-50">Baseline</button>
          <button onClick={() => applyPreset('expansion')} className="flex-1 rounded-md border border-line bg-surface-soft px-2 py-1.5 text-[11px] font-medium text-ink-soft hover:bg-blue-50">+4 Dedicated</button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Standard"><input type="number" min={0} className={inputCls} value={config.bays.Bu} onChange={(e) => updateBay('Bu', e.target.value)} /></Field>
          <Field label="Dedicated"><input type="number" min={0} className={inputCls} value={config.bays.Be} onChange={(e) => updateBay('Be', e.target.value)} /></Field>
          <Field label="Inspection"><input type="number" min={0} className={inputCls} value={config.bays.Bi} onChange={(e) => updateBay('Bi', e.target.value)} /></Field>
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-faint">
          <Users size={13} /> Workforce
        </div>
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
      </section>

      <div className="mt-5 flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 p-3 text-[11px] leading-relaxed text-blue-900">
        <LayoutList size={13} className="mt-0.5 shrink-0" />
        <p>Skill scores: High=9 / Medium=6 / Low=3. If Dedicated Bays = 0, long-duration jobs route to Standard Bays automatically.</p>
      </div>
    </Card>
  );
}
