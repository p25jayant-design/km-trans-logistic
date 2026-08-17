import React from 'react';
import { motion } from 'framer-motion';
import {
  Truck, Settings, Clock3, Activity, AlertTriangle, ListChecks, Download,
} from 'lucide-react';
import Badge from './ui/Badge.jsx';
import SimulationControls from './SimulationControls.jsx';
import VisitorCounter from './ui/VisitorCounter.jsx';
import iimaLogo from '../assets/iima-logo.png';
import { bottleneckColorFor, hexToRgba } from '../lib/styleMaps.js';

export default function Navbar({
  onOpenConfig, clock, status, playing, onPlayPause, onJumpEnd, onReset, onRun, onAbort,
  speed, onSpeedChange, eventCount, bottleneck, onDownload, canDownload,
}) {
  const statusTone = status === 'running' ? 'blue' : status === 'complete' ? 'green' : status === 'ready' ? 'amber' : 'neutral';
  const statusLabel = { idle: 'Idle', ready: 'Ready', running: 'Running', complete: 'Complete' }[status] || 'Idle';
  // Bay-type bottlenecks keep the plain red/amber utilization-threshold
  // badge exactly as before. A worker-department bottleneck instead gets
  // that department's own color from the color-coded bottleneck system, so
  // "Bottleneck: Mechanical Dept" always renders in the same indigo used
  // for Mechanical everywhere else (floor plan, worker card, legend).
  const bnColor = bottleneck?.kind === 'dept' ? bottleneckColorFor(bottleneck) : null;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur px-5 py-3 shadow-sm">
      {/* Masthead row: brand on the left, IIMA logo + site visitor counter
          pinned to the true top-right corner of the page — kept on their
          own row, separate from the busy playback-controls row below, so
          neither cluster fights the other for space. */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-white shadow-card">
            <Truck size={20} strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="text-[17px] font-bold leading-tight text-ink">KM Trans Logistics — Workshop Control Center</h1>
            <p className="text-[12px] text-ink-faint leading-tight">Discrete-Event Simulation · Jaipur Workshop Operations</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <VisitorCounter />
          <img src={iimaLogo} alt="IIM Ahmedabad" className="h-10 w-auto" />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            onClick={onOpenConfig}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-[12.5px] font-medium text-ink-soft transition-colors hover:bg-surface-soft hover:shadow-sm"
          >
            <Settings size={15} /> Configure
          </motion.button>

          <motion.button
            whileHover={canDownload ? { scale: 1.03 } : {}}
            whileTap={canDownload ? { scale: 0.96 } : {}}
            onClick={onDownload}
            disabled={!canDownload}
            title={canDownload ? 'Download raw per-truck simulation data as .xlsx' : 'Run the simulation first'}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
              canDownload
                ? 'border-line bg-white text-ink-soft hover:bg-surface-soft hover:shadow-sm'
                : 'cursor-not-allowed border-line bg-surface-soft text-ink-faint/50'
            }`}
          >
            <Download size={15} /> Download Data
          </motion.button>

          <div className="flex items-center gap-1.5 rounded-lg border border-line bg-surface-soft px-3 py-1.5 font-mono text-[13px] tabular-nums text-ink">
            <Clock3 size={14} className="text-brand-600" />
            {clock || '—'}
          </div>

          <Badge tone={statusTone} icon={Activity} pulse={status === 'running'}>{statusLabel}</Badge>

          {bottleneck && (
            <Badge
              tone={bnColor ? 'neutral' : bottleneck.utilization > 0.85 ? 'red' : 'amber'}
              icon={AlertTriangle}
              style={bnColor ? { background: hexToRgba(bnColor.hex, 0.1), color: bnColor.hex, borderColor: hexToRgba(bnColor.hex, 0.4) } : undefined}
            >
              Bottleneck: {bottleneck.label} {(bottleneck.utilization * 100).toFixed(0)}%
            </Badge>
          )}

          <Badge tone="neutral" icon={ListChecks}>{eventCount.toLocaleString()} events</Badge>

          <SimulationControls
            playing={playing}
            onPlayPause={onPlayPause}
            onJumpEnd={onJumpEnd}
            onReset={onReset}
            onRun={onRun}
            onAbort={onAbort}
            speed={speed}
            onSpeedChange={onSpeedChange}
          />
      </div>
    </header>
  );
}
