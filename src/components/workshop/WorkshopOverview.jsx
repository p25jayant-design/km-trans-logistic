import React from 'react';
import { Warehouse, ListOrdered, Users, TrendingUp, AlertTriangle } from 'lucide-react';

function Chip({ icon: Icon, value, label, tone = 'text-ink-soft' }) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1.5">
      <Icon size={13} className={tone} />
      <span className="tabular-nums text-[12px] font-bold text-ink">{value}</span>
      <span className="text-[10.5px] text-ink-faint">{label}</span>
    </div>
  );
}

/** A compact "at a glance" ribbon — bays busy, queue length, workforce
 *  utilization, trucks serviced, and the current bottleneck (if any) — the
 *  kind of always-visible mini overview commercial DES tools (AnyLogic,
 *  FlexSim, Plant Simulation) show above the detailed floor view. Purely
 *  derived from the already-computed frame/result; no new calculations. */
export default function WorkshopOverview({ result, frame }) {
  if (!result || !frame) return null;

  const totalBays = result.cfg.bays.Bu + result.cfg.bays.Be + result.cfg.bays.Bi;
  const busyBays = ['Bu', 'Be', 'Bi'].reduce(
    (s, type) => s + frame.bays[type].filter((b) => b.status === 'busy').length,
    0,
  );
  const avgWorkerUtil = frame.departments.length
    ? frame.departments.reduce((s, d) => s + d.utilization, 0) / frame.departments.length
    : 0;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <Chip icon={Warehouse} value={`${busyBays}/${totalBays}`} label="bays busy" />
      <Chip
        icon={ListOrdered}
        value={frame.queueLen}
        label="in queue"
        tone={frame.queueLen >= 8 ? 'text-red-500' : 'text-ink-soft'}
      />
      <Chip icon={Users} value={`${(avgWorkerUtil * 100).toFixed(0)}%`} label="workforce busy" />
      <Chip icon={TrendingUp} value={frame.completedSoFar.toLocaleString()} label="serviced" />
      {frame.bottleneck && (
        <div className="flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5">
          <AlertTriangle size={13} className="text-red-500" />
          <span className="text-[11.5px] font-bold text-red-700">{frame.bottleneck.label}</span>
          <span className="tabular-nums text-[10.5px] text-red-600">
            {(frame.bottleneck.utilization * 100).toFixed(0)}% bottleneck
          </span>
        </div>
      )}
    </div>
  );
}
