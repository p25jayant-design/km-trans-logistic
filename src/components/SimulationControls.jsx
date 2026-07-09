import React from 'react';
import { motion } from 'framer-motion';
import { PlayCircle, PauseCircle, SkipForward, RotateCcw, Gauge } from 'lucide-react';
import { SPEED_LEVELS } from '../hooks/useSimulation.js';

/** Playback transport: speed slider + play/pause + jump-to-end + reset +
 *  run button. Pulled out of Navbar so the transport can be reused or
 *  relaid-out independently of the top bar's branding/status area. */
export default function SimulationControls({
  playing, onPlayPause, onJumpEnd, onReset, onRun, speed, onSpeedChange,
}) {
  const speedIndex = SPEED_LEVELS.findIndex((s) => s.value === speed);
  const currentIndex = speedIndex >= 0 ? speedIndex : Math.round(SPEED_LEVELS.length / 2);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-1.5">
        <Gauge size={14} className="shrink-0 text-ink-faint" />
        <input
          type="range"
          min={0}
          max={SPEED_LEVELS.length - 1}
          step={1}
          value={currentIndex}
          onChange={(e) => onSpeedChange(SPEED_LEVELS[Number(e.target.value)].value)}
          className="w-24 accent-brand-600"
        />
        <span className="w-[68px] whitespace-nowrap text-[11.5px] font-medium text-ink-soft">
          {SPEED_LEVELS[currentIndex].label}
        </span>
      </div>

      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.94 }}
        onClick={onPlayPause}
        className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-[12.5px] font-semibold text-white shadow-card transition-colors hover:bg-brand-700"
      >
        {playing ? <PauseCircle size={16} /> : <PlayCircle size={16} />}
        {playing ? 'Pause' : 'Play'}
      </motion.button>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.92 }}
        onClick={onJumpEnd}
        className="flex items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-1.5 text-[12.5px] text-ink-soft transition-colors hover:bg-surface-soft hover:shadow-sm"
      >
        <SkipForward size={15} />
      </motion.button>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.92 }}
        onClick={onReset}
        className="flex items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-1.5 text-[12.5px] text-ink-soft transition-colors hover:bg-surface-soft hover:shadow-sm"
      >
        <RotateCcw size={15} />
      </motion.button>

      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.96 }}
        onClick={onRun}
        className="flex items-center gap-1.5 rounded-lg border border-brand-600 bg-brand-50 px-3 py-1.5 text-[12.5px] font-semibold text-brand-700 transition-colors hover:bg-brand-100"
      >
        Run Simulation
      </motion.button>
    </div>
  );
}
