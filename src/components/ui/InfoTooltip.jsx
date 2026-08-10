import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, ArrowRight } from 'lucide-react';

/** Small hover-to-preview / click-to-open info affordance. Hovering shows a
 *  short, non-interactive blurb (portaled to `document.body`, following the
 *  same pattern as TruckTooltip.jsx, so it's never clipped by whatever
 *  narrow column it lives in); clicking calls `onOpen` to jump to the full
 *  explanation elsewhere on the page. Hover handles the quick reminder,
 *  click handles "tell me more" — the two interactions never have to do
 *  double duty for each other, so the tooltip itself can stay simple and
 *  non-interactive (no hover-into-the-tooltip-to-click-a-link gymnastics). */
export default function InfoTooltip({ text, onOpen, label }) {
  const [hover, setHover] = useState(false);
  const btnRef = useRef(null);
  const [rect, setRect] = useState(null);

  const updateRect = () => {
    if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onMouseEnter={() => { updateRect(); setHover(true); }}
        onMouseLeave={() => setHover(false)}
        onClick={(e) => { e.stopPropagation(); setHover(false); onOpen?.(); }}
        title={`What is ${label}?`}
        aria-label={`What is ${label}?`}
        className="flex items-center justify-center rounded-md border border-line bg-white p-1 text-ink-faint transition-all duration-150 hover:border-brand-300 hover:text-brand-600 active:scale-90"
      >
        <Info size={11} />
      </button>

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {hover && rect && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
              style={{
                position: 'fixed',
                left: Math.min(Math.max(8, rect.left - 90), window.innerWidth - 236),
                top: rect.bottom + 6,
                zIndex: 350,
                width: 220,
              }}
              className="pointer-events-none rounded-lg border border-line bg-surface p-2.5 shadow-cardHover"
            >
              <p className="text-[10.5px] leading-snug text-ink-soft">{text}</p>
              <span className="mt-1 flex items-center gap-1 text-[9.5px] font-semibold text-brand-600">
                Click for full explanation <ArrowRight size={9} />
              </span>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
