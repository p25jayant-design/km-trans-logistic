import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { DEPT_KEYS } from '../engine/desEngine.js';

/** Brief, staged "engine initializing" sequence shown while the (already
 *  fast) DES engine runs — purely presentational, no simulation logic here. */
export default function BootOverlay({ open, config, onDone }) {
  const [lines, setLines] = useState([]);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!open) { setLines([]); doneRef.current = false; return; }
    const totalWorkers = DEPT_KEYS.reduce((s, k) => s + config.departments[k].total, 0);
    const script = [
      'KM-TRANS-DES ENGINE v1.0 — initializing...',
      `Resource pools: ${config.bays.Bu} standard, ${config.bays.Be} dedicated, ${config.bays.Bi} inspection bay(s)`,
      `Workforce pools: ${totalWorkers} workers across 6 departments`,
      'Loading job master data — 21 categories (Exhibit 5 schema)...',
      `Seeding PRNG — Mulberry32${config.fixedSeed ? ` (seed ${config.seed})` : ' (non-deterministic seed)'}`,
      `Scheduling policy: ${config.policy.toUpperCase()}`,
      'Running discrete-event loop (Future Event List, min-heap)...',
    ];
    let i = 0;
    let cancelled = false;
    const step = () => {
      if (cancelled) return;
      if (i < script.length) {
        setLines(prev => [...prev, script[i]]);
        i++;
        setTimeout(step, 130);
      } else if (!doneRef.current) {
        doneRef.current = true;
        setTimeout(onDone, 350);
      }
    };
    step();
    return () => { cancelled = true; };
  }, [open, config, onDone]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="w-[min(560px,90vw)] rounded-xl border border-slate-700 bg-slate-950 p-5 font-mono text-[12.5px] text-emerald-400 shadow-2xl"
          >
            <div className="mb-2 flex items-center gap-2 text-slate-300">
              <Loader2 size={14} className="animate-spin" />
              <span className="text-[11px] uppercase tracking-wide">Simulation Engine</span>
            </div>
            {lines.map((line, i) => (
              <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="leading-relaxed">
                &gt; {line}
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
