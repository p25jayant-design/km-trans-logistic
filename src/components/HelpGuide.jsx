import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LifeBuoy, ChevronDown } from 'lucide-react';
import { HELP_SECTIONS } from '../lib/helpGuideContent.js';

/** One topic within the guide — its own independent accordion, following
 *  the exact open/closed visual language already established by
 *  KpiExplanations.jsx (rotating chevron, brand-tinted border + white fill
 *  while open) so the two "click a header to expand" panels in this app
 *  feel like the same control. */
function HelpSection({ section, open, onToggle }) {
  const Icon = section.icon;
  return (
    <div className={`rounded-md border transition-colors duration-150 ${open ? 'border-brand-300 bg-white' : 'border-line bg-white/60'}`}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
      >
        <span className="flex items-center gap-2 text-[12.5px] font-semibold text-ink">
          <Icon size={14} className="shrink-0 text-brand-600" />
          {section.title}
        </span>
        <ChevronDown size={14} className={`shrink-0 text-ink-faint transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
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
            <div className="flex flex-col gap-2.5 border-t border-line px-3 pb-3 pt-2.5 text-[12px] leading-relaxed text-ink-soft">
              {section.summary && <p className="font-medium text-ink-soft">{section.summary}</p>}
              {section.paragraphs?.map((p, i) => <p key={i}>{p}</p>)}

              {section.items && (
                section.ordered ? (
                  <ol className="flex flex-col gap-2">
                    {section.items.map((it, i) => (
                      <li key={i} className="flex gap-2.5">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10.5px] font-bold text-brand-700">
                          {i + 1}
                        </span>
                        <span><span className="font-semibold text-ink">{it.label}.</span> {it.text}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {section.items.map((it, i) => (
                      <li key={i}>
                        <span className="font-semibold text-ink">{it.label}:</span> {it.text}
                      </li>
                    ))}
                  </ul>
                )
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Collapsible Help & User Guide, pinned at the very top of the app above
 *  the page nav. Collapsed to a single header bar by default — per the
 *  request, it must not occupy screen space until someone actually wants
 *  it — and expands into one independently-collapsible accordion per
 *  topic (configuration, scheduling policies, simulation controls, the
 *  workshop map, KPI definitions, charts, downloads, bottleneck
 *  visualization, and a recommended first-run workflow).
 *
 *  Purely static documentation: it takes no props and reads nothing from
 *  `result`/`frame`, so it renders identically whether or not a
 *  simulation has been run, and never re-renders when playback advances.
 *  All copy lives in lib/helpGuideContent.js, checked directly against the
 *  components/engine logic it describes. */
export default function HelpGuide() {
  const [open, setOpen] = useState(false);
  const [openSectionId, setOpenSectionId] = useState(null);

  return (
    <div className="rounded-xl border border-line bg-surface shadow-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-600 text-white shadow-sm">
            <LifeBuoy size={14} />
          </span>
          <span className="text-[13px] font-bold text-ink">Help &amp; User Guide</span>
          {!open && (
            <span className="hidden text-[11.5px] font-normal text-ink-faint sm:inline">
              — configuration, scheduling, controls, the workshop map, KPIs, charts, downloads, bottlenecks, and a first-run walkthrough
            </span>
          )}
        </span>
        <ChevronDown size={16} className={`shrink-0 text-ink-faint transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-1.5 border-t border-line px-3 pb-3.5 pt-3">
              {HELP_SECTIONS.map((section) => (
                <HelpSection
                  key={section.id}
                  section={section}
                  open={openSectionId === section.id}
                  onToggle={() => setOpenSectionId((id) => (id === section.id ? null : section.id))}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
