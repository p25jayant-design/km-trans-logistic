import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, HardHat, Smile, FileSpreadsheet, Download, CheckCheck } from 'lucide-react';
import { fmtDuration } from '../lib/theme.js';
import { exportSimulationXlsx, exportBayUtilizationXlsx, exportWorkerUtilizationXlsx } from '../lib/exportXlsx.js';

function StatBlock({ value, label }) {
  return (
    <div className="rounded-xl border border-line bg-surface-soft px-6 py-5 text-center">
      <div className="text-[30px] font-extrabold tabular-nums text-ink">{value}</div>
      <div className="mt-1.5 text-[12.5px] font-medium text-ink-faint">{label}</div>
    </div>
  );
}

/** End-of-simulation popup — shown exactly once, the moment playback
 *  reaches the true end of the user-selected horizon (see useSimulation.js's
 *  `finalSummary`/`showFinalSummaryIfNeeded`), never on every day boundary
 *  the way DayCompleteOverlay is. Deliberately larger, plainer, and far
 *  less crowded than the daily overlay: only the 4 essential whole-run
 *  numbers (see computeFinalSummary in frameSelectors.js), each with real
 *  breathing room, and no per-day clutter like a bottleneck tile or
 *  auto-resume countdown — there is nothing left to resume. */
export default function FinalSummaryOverlay({ finalSummary, onClose, horizonDays, dayMinutes, result }) {
  // Tracks the "want the Excel reports?" yes/no prompt for the CURRENT
  // popup only — reset back to unanswered every time a new run completes
  // (a fresh `finalSummary` object), so a choice made on one run's popup
  // never silently carries over and pre-answers the next one.
  const [downloadChoice, setDownloadChoice] = useState(null);
  useEffect(() => {
    if (finalSummary) setDownloadChoice(null);
  }, [finalSummary]);

  useEffect(() => {
    if (!finalSummary) return;
    const onKey = (e) => { if (e.key === 'Escape' || e.key === 'Enter') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finalSummary, onClose]);

  // No backend/email service is wired up (see chat) — "yes" downloads the
  // same three Excel reports available elsewhere in the app (Download Data,
  // Bay Utilization, Worker Utilization) straight to the user's own
  // computer, right from this popup, instead of sending anything anywhere.
  // Staggered slightly since three `XLSX.writeFile` calls fired in the same
  // instant can trip a browser's "this site is trying to download multiple
  // files" prompt.
  const handleDownloadYes = () => {
    setDownloadChoice('yes');
    if (!result) return;
    exportSimulationXlsx(result);
    setTimeout(() => exportBayUtilizationXlsx(result), 350);
    setTimeout(() => exportWorkerUtilizationXlsx(result), 700);
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {finalSummary && (
        <motion.div
          key="final-summary-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-[2px]"
        >
          <motion.div
            key="final-summary-panel"
            initial={{ opacity: 0, scale: 0.94, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
            className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface p-8 shadow-cardHover"
          >
            {/* Happy-worker badge — a hard hat (the workshop's own workers)
                with a small smiling-face badge, in the app's success green,
                signaling every truck has been repaired. */}
            <div className="absolute right-6 top-6 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 shadow-card">
              <HardHat size={28} className="text-white" strokeWidth={2} />
              <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface bg-white">
                <Smile size={13} className="text-emerald-600" strokeWidth={2.5} />
              </span>
            </div>

            <div className="max-w-[26rem]">
              <span className="flex items-center gap-1.5 text-[12.5px] font-bold uppercase tracking-wide text-emerald-600">
                <CheckCircle2 size={15} /> Simulation Complete
              </span>
              <h2 className="mt-2 text-[24px] font-extrabold leading-tight text-ink">All trucks repaired</h2>
              <p className="mt-2 text-[13.5px] leading-relaxed text-ink-faint">
                Here's the essential summary for the full {horizonDays}-day run.
              </p>
            </div>

            <div className="mt-7 grid grid-cols-2 gap-5">
              <StatBlock value={finalSummary.trucksCompleted} label="Trucks Completed" />
              <StatBlock value={fmtDuration(finalSummary.avgWaitingTime, dayMinutes)} label="Avg Waiting Time" />
              <StatBlock value={fmtDuration(finalSummary.avgFlowTime, dayMinutes)} label="Avg Flow Time" />
              <StatBlock value={finalSummary.throughputPerDay.toFixed(1)} label="Throughput / day" />
            </div>

            <div className="mt-6 rounded-xl border border-line bg-surface-soft p-4">
              {downloadChoice === 'yes' ? (
                <div className="flex items-center gap-2 text-[12.5px] font-semibold text-emerald-700">
                  <CheckCheck size={16} /> Downloading the Simulation, Bay Utilization, and Worker Utilization reports to your computer now.
                </div>
              ) : downloadChoice === 'no' ? (
                <div className="flex items-center gap-2 text-[12.5px] text-ink-faint">
                  No problem — you can still grab any of these later from Download Data or the Bay/Worker Utilization pages.
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-[12.5px] font-medium text-ink-soft">
                    <FileSpreadsheet size={16} className="text-brand-600" /> Want the Excel reports for this run (Simulation, Bay Utilization, Worker Utilization)?
                  </span>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadYes}
                      className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-[12px] font-semibold text-white shadow-card transition-colors hover:bg-brand-700"
                    >
                      <Download size={13} /> Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setDownloadChoice('no')}
                      className="rounded-lg border border-line bg-white px-3 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:bg-surface-soft"
                    >
                      No thanks
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                type="button"
                onClick={() => onClose?.()}
                className="rounded-lg bg-brand-600 px-5 py-2.5 text-[13.5px] font-semibold text-white shadow-card transition-colors hover:bg-brand-700"
              >
                Close
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
