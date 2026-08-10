import React from 'react';
import { Warehouse, ListOrdered, Users, TrendingUp, AlertTriangle } from 'lucide-react';
import { bottleneckColorFor, hexToRgba } from '../../lib/styleMaps.js';

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
      {frame.bottleneck && (() => {
        // Bay-type bottlenecks keep the plain red chip exactly as before.
        // A worker-department bottleneck gets that department's own color
        // from the color-coded bottleneck system instead.
        const c = bottleneckColorFor(frame.bottleneck);
        const isDept = frame.bottleneck.kind === 'dept';
        return (
          <div
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 ${isDept ? '' : 'border-red-200 bg-red-50'}`}
            style={isDept ? { borderColor: c.stroke, background: c.fill } : undefined}
          >
            <AlertTriangle size={13} style={isDept ? { color: c.hex } : undefined} className={isDept ? '' : 'text-red-500'} />
            <span className={`text-[11.5px] font-bold ${isDept ? '' : 'text-red-700'}`} style={isDept ? { color: c.hex } : undefined}>
              {frame.bottleneck.label}
            </span>
            <span className={`tabular-nums text-[10.5px] ${isDept ? '' : 'text-red-600'}`} style={isDept ? { color: c.hex } : undefined}>
              {(frame.bottleneck.utilization * 100).toFixed(0)}% bottleneck
            </span>
          </div>
        );
      })()}
    </div>
  );
}
