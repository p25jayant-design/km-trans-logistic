import React from 'react';
import { motion } from 'framer-motion';
import {
  Factory, Settings, Clock3, Activity, AlertTriangle, ListChecks,
} from 'lucide-react';
import Badge from './ui/Badge.jsx';
import SimulationControls from './SimulationControls.jsx';

export default function Navbar({
  onOpenConfig, clock, status, playing, onPlayPause, onJumpEnd, onReset, onRun,
  speed, onSpeedChange, eventCount, bottleneck,
}) {
  const statusTone = status === 'running' ? 'blue' : status === 'complete' ? 'green' : status === 'ready' ? 'amber' : 'neutral';
  const statusLabel = { idle: 'Idle', ready: 'Ready', running: 'Running', complete: 'Complete' }[status] || 'Idle';

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur px-5 py-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white shadow-card">
            <Factory size={18} strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="text-[15px] font-bold leading-tight text-ink">KM Trans Logistics — Workshop Control Center</h1>
            <p className="text-[11.5px] text-ink-faint leading-tight">Discrete-Event Simulation · Jaipur Workshop Operations</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            onClick={onOpenConfig}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-[12.5px] font-medium text-ink-soft transition-colors hover:bg-surface-soft hover:shadow-sm"
          >
            <Settings size={15} /> Configure
          </motion.button>

          <div className="flex items-center gap-1.5 rounded-lg border border-line bg-surface-soft px-3 py-1.5 font-mono text-[13px] tabular-nums text-ink">
            <Clock3 size={14} className="text-brand-600" />
            {clock || 'Day 1 · 00:00'}
          </div>

          <Badge tone={statusTone} icon={Activity} pulse={status === 'running'}>{statusLabel}</Badge>

          {bottleneck && (
            <Badge tone={bottleneck.utilization > 0.85 ? 'red' : 'amber'} icon={AlertTriangle}>
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
            speed={speed}
            onSpeedChange={onSpeedChange}
          />
        </div>
      </div>
    </header>
  );
}
