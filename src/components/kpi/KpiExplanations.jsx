import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { KPI_DEFINITIONS } from '../../lib/kpiDefinitions.js';

/** The expandable "What do these KPIs mean?" reference section rendered
 *  below the Live KPI grid. A single outer disclosure (collapsed by
 *  default, so it doesn't eat vertical space in the narrow right column
 *  until someone actually wants it) containing one accordion entry per
 *  KPI — each entry expands to the full explanation: a plain-English
 *  summary, the exact expression the app computes, units, how to read the
 *  number, and why it matters for running the workshop.
 *
 *  Every KPI card's info-icon tooltip (see InfoTooltip.jsx / KpiCard.jsx)
 *  opens this same section and scrolls straight to its matching entry via
 *  `openId` + `registerRef` (owned by the parent, KPIGrid.jsx). Both the
 *  tooltip's short blurb and this panel's full entry are read from the
 *  same KPI_DEFINITIONS list in lib/kpiDefinitions.js, so the two surfaces
 *  can never say something different about the same KPI. */
export default function KpiExplanations({ open, onToggleOpen, openId, setOpenId, registerRef }) {
  return (
    <div className="rounded-lg border border-line bg-surface-soft">
      <button
        type="button"
        onClick={onToggleOpen}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
      >
        <span className="flex items-center gap-1.5 text-[12px] font-semibold text-ink">
          <HelpCircle size={14} className="text-ink-faint" />
          What do these KPIs mean?
        </span>
        <ChevronDown size={14} className={`text-ink-faint transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-1.5 border-t border-line px-2.5 pb-2.5 pt-2">
              {KPI_DEFINITIONS.map((d) => {
                const isOpen = openId === d.id;
                return (
                  <div
                    key={d.id}
                    ref={(el) => registerRef(d.id, el)}
                    className={`rounded-md border transition-colors duration-150 ${isOpen ? 'border-brand-300 bg-white' : 'border-line bg-white/60'}`}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenId(isOpen ? null : d.id)}
                      className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left"
                    >
                      <span className="text-[11.5px] font-semibold text-ink">{d.label}</span>
                      <ChevronDown size={12} className={`shrink-0 text-ink-faint transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                    </button>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.18, ease: 'easeInOut' }}
                          className="overflow-hidden"
                        >
                          <div className="flex flex-col gap-1.5 px-2.5 pb-2.5 text-[11px] leading-relaxed text-ink-soft">
                            <p>{d.short}</p>
                            <div className="rounded bg-surface-soft px-2 py-1.5 font-mono text-[10px] text-ink-faint">{d.formula}</div>
                            <p><span className="font-semibold text-ink">Units:</span> {d.units}</p>
                            <p><span className="font-semibold text-ink">Reading it:</span> {d.interpretation}</p>
                            <p><span className="font-semibold text-ink">Why it matters:</span> {d.importance}</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
