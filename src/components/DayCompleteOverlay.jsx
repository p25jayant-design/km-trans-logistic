import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarCheck2, PartyPopper, SkipForward, PauseCircle, AlertTriangle } from 'lucide-react';
import StatTile from './ui/StatTile.jsx';
import { fmtDuration } from '../lib/theme.js';
import { bottleneckColorFor } from '../lib/styleMaps.js';
import { bottleneckColorFor, hexToRgba } from '../lib/styleMaps.js';

const AUTO_RESUME_SECONDS = 6;
const CONFETTI_COLORS = ['#2563eb', '#059669', '#ea580c', '#7c3aed', '#d97706', '#db2777'];

/** A small, fixed set of confetti pieces flung outward from center on
 *  mount, purely decorative — deterministic per render (seeded off
 *  `dayIndex` rather than freshly randomized every re-render) so the burst
 *  doesn't jitter if the overlay re-renders for an unrelated reason (e.g.
 *  the countdown ticking) while still looking different from one day's
 *  celebration to the next. Kept intentionally sparse and quick ("subtle"
 *  per the request) rather than a dense, lingering confetti shower. */
function useConfettiPieces(seed) {
  return useMemo(() => {
    let s = seed * 9301 + 49297;
    const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    return Array.from({ length: 14 }, (_, i) => {
      const angle = (i / 14) * Math.PI * 2 + rand() * 0.4;
      const dist = 70 + rand() * 60;
      return {
        id: i,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist - 20,
        rotate: rand() * 360,
        delay: rand() * 0.08,
      };
    });
  }, [seed]);
}

/** Modal shown the instant playback reaches the end of a simulated day
 *  (see useSimulation.js's RAF loop, which pauses exactly at each day
 *  boundary and computes `dayComplete.summary` via computeDaySummary).
 *  Summarizes that day — trucks processed, average waiting time,
 *  throughput, bay/worker utilization, and that day's own bottleneck — with
 *  a brief confetti burst, then either auto-resumes playback after a short
 *  countdown or waits for the user to continue manually, whichever the
 *  user prefers (the countdown itself can be paused). */
export default function DayCompleteOverlay({ dayComplete, onContinue }) {
  const [secondsLeft, setSecondsLeft] = useState(AUTO_RESUME_SECONDS);
  const [autoResume, setAutoResume] = useState(true);
  const intervalRef = useRef(null);

  const dayIndex = dayComplete?.dayIndex ?? null;
  const summary = dayComplete?.summary ?? null;
  const confetti = useConfettiPieces(dayIndex ?? 0);
  const bnColor = summary ? bottleneckColorFor(summary.bottleneck) : null;

  // Fresh countdown (and auto-resume re-armed) every time a *new* day's
  // overlay appears — a previous day's "paused auto-resume" choice
  // shouldn't silently carry over and suppress the next day's countdown.
  useEffect(() => {
    if (dayIndex == null) return;
    setSecondsLeft(AUTO_RESUME_SECONDS);
    setAutoResume(true);
  }, [dayIndex]);

  useEffect(() => {
    if (dayIndex == null || !autoResume) return;
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(intervalRef.current);
          onContinue?.();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [dayIndex, autoResume, onContinue]);

  useEffect(() => {
    if (dayIndex == null) return;
    const onKey = (e) => { if (e.key === 'Escape' || e.key === 'Enter') onContinue?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dayIndex, onContinue]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {summary && (
        <motion.div
          key="day-complete-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-[2px]"
        >
          <motion.div
            key={`day-complete-panel-${dayIndex}`}
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-line bg-surface p-5 shadow-cardHover"
          >
            {/* Celebratory confetti burst, anchored above the headline icon */}
            <div className="pointer-events-none absolute left-1/2 top-[52px] h-0 w-0">
              {confetti.map((p) => (
                <motion.span
                  key={p.id}
                  initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
                  animate={{ x: p.x, y: p.y, opacity: 0, rotate: p.rotate, scale: 0.6 }}
                  transition={{ duration: 0.9, delay: p.delay, ease: 'easeOut' }}
                  style={{ background: p.color, width: 6, height: 6, position: 'absolute', borderRadius: 2 }}
                />
              ))}
            </div>

            <div className="flex flex-col items-center text-center">
              <motion.span
                initial={{ scale: 0.4, rotate: -8, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 340, damping: 16, delay: 0.05 }}
                className="mb-2.5 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-card"
              >
                <PartyPopper size={26} />
              </motion.span>
              <h2 className="flex items-center gap-1.5 text-[17px] font-extrabold text-ink">
                <CalendarCheck2 size={16} className="text-brand-600" /> Day {summary.dayNumber} Complete
              </h2>
              <p className="mt-0.5 text-[11.5px] text-ink-faint">Here’s how the workshop performed today.</p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <StatTile value={summary.trucksProcessed} label="Trucks Processed" />
              <StatTile value={fmtDuration(summary.avgWaitingTime)} label="Avg Waiting Time" />
              <StatTile value={summary.throughputPerDay.toFixed(1)} label="Throughput /day (avg)" />
              <StatTile value={`${(summary.bayUtilization * 100).toFixed(0)}%`} label="Bay Utilization" />
              <StatTile value={`${(summary.workerUtilization * 100).toFixed(0)}%`} label="Worker Utilization" />
              <div className="flex flex-col items-center justify-center rounded-lg border border-line bg-surface-soft px-2 py-2 text-center">
                {summary.bottleneck ? (
                  <span
                    className="flex items-center gap-1 rounded-full px-2 py-1 text-[10.5px] font-bold"
                    style={{ background: hexToRgba(bnColor.hex, 0.12), color: bnColor.hex }}
                  >
                    <AlertTriangle size={11} /> {(summary.bottleneck.utilization * 100).toFixed(0)}%
                  </span>
                ) : (
                  <span className="text-[10.5px] font-semibold text-ink-faint">—</span>
                )}
                <div className="mt-1 truncate text-[10.5px] font-medium text-ink-faint">
                  Bottleneck: {summary.bottleneck ? summary.bottleneck.label : 'None'}
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3.5">
              {autoResume ? (
                <button
                  type="button"
                  onClick={() => setAutoResume(false)}
                  className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5 text-[11px] font-medium text-ink-faint transition-colors hover:bg-surface-soft hover:text-ink"
                >
                  <PauseCircle size={13} /> Pause auto-resume ({secondsLeft}s)
                </button>
              ) : (
                <span className="text-[11px] font-medium text-ink-faint">Auto-resume paused</span>
              )}

              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                type="button"
                onClick={() => onContinue?.()}
                className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-1.5 text-[12.5px] font-semibold text-white shadow-card transition-colors hover:bg-brand-700"
              >
                Continue <SkipForward size={14} />
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
