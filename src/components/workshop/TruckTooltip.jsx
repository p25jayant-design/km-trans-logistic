import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarClock, Hourglass, Users, Warehouse, FlagTriangleRight } from 'lucide-react';
import { fmtTime, DEPT_NAMES } from '../../engine/desEngine.js';
import { fmtMinutesShort } from '../../engine/frameSelectors.js';

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 py-0.5">
      <span className="flex items-center gap-1.5 text-[10.5px] text-ink-faint">
        <Icon size={12} /> {label}
      </span>
      <span className="text-[10.5px] font-semibold text-ink">{value}</span>
    </div>
  );
}

/** Floating detail panel shown on truck hover. Portaled to `document.body`
 *  so it always renders above scrollable lanes and animated (transformed)
 *  ancestors instead of being clipped or mis-positioned by them. Purely
 *  presentational — `details` comes from the read-only `getTruckDetails`
 *  selector, which only reads already-simulated truck records. */
export default function TruckTooltip({ anchorRect, details }) {
  if (typeof document === 'undefined') return null;

  const visible = !!(anchorRect && details);
  const left = anchorRect ? Math.min(Math.max(8, anchorRect.left), window.innerWidth - 236) : 0;
  const top = anchorRect ? anchorRect.bottom + 8 : 0;

  return createPortal(
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.14 }}
          style={{ position: 'fixed', left, top, zIndex: 300, width: 224 }}
          className="pointer-events-none rounded-lg border border-line bg-surface p-3 shadow-cardHover"
        >
          <div className="mb-1.5 truncate text-[11.5px] font-bold text-ink">
            #{details.truckId} · {details.jobName}
          </div>
          <Row icon={CalendarClock} label="Arrival Time" value={fmtTime(details.arrivalTime)} />
          <Row icon={Hourglass} label="Waiting Time" value={fmtMinutesShort(details.waitTime)} />
          <Row
            icon={Users}
            label="Assigned Workers"
            value={
              details.assignedWorkers.length
                ? details.assignedWorkers.map((w) => `${w.count}× ${DEPT_NAMES[w.dept]}`).join(', ')
                : 'Not yet assigned'
            }
          />
          <Row icon={Warehouse} label="Bay" value={details.bay || 'Awaiting allocation'} />
          <Row
            icon={FlagTriangleRight}
            label="Expected Completion"
            value={details.expectedCompletion != null ? fmtTime(details.expectedCompletion) : 'Pending allocation'}
          />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
