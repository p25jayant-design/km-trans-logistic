import React, { useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Truck, Clock3, Warehouse, Users, Wrench, CheckCircle2, LogOut,
  History, Radio, Settings2,
} from 'lucide-react';
import Card from '../ui/Card.jsx';
import { expandTimelineEvents } from '../../engine/frameSelectors.js';
import { fmtTime } from '../../engine/desEngine.js';

const KIND_META = {
  arrival: { icon: Truck, tone: 'text-blue-600', bg: 'bg-blue-50', stripe: 'border-l-blue-400' },
  queued: { icon: Clock3, tone: 'text-amber-600', bg: 'bg-amber-50', stripe: 'border-l-amber-400' },
  bayAssigned: { icon: Warehouse, tone: 'text-orange-600', bg: 'bg-orange-50', stripe: 'border-l-orange-400' },
  workersAllocated: { icon: Users, tone: 'text-violet-600', bg: 'bg-violet-50', stripe: 'border-l-violet-400' },
  serviceStarted: { icon: Wrench, tone: 'text-emerald-600', bg: 'bg-emerald-50', stripe: 'border-l-emerald-400' },
  serviceCompleted: { icon: CheckCircle2, tone: 'text-emerald-700', bg: 'bg-emerald-100', stripe: 'border-l-emerald-500' },
  departed: { icon: LogOut, tone: 'text-gray-500', bg: 'bg-gray-100', stripe: 'border-l-gray-400' },
};
const FALLBACK_META = { icon: Settings2, tone: 'text-slate-500', bg: 'bg-slate-100', stripe: 'border-l-slate-300' };

function EventRow({ event, isNewest }) {
  const meta = KIND_META[event.kind] || FALLBACK_META;
  const Icon = meta.icon;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -14 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 340, damping: 32 }}
      className={`flex items-center gap-2.5 border-b border-l-4 border-line/60 px-2.5 py-1.5 ${meta.stripe} ${
        isNewest ? 'bg-brand-50/70 shadow-[inset_0_0_0_1px_rgba(29,78,216,0.15)]' : 'bg-white'
      }`}
    >
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${meta.bg} ${meta.tone}`}>
        <Icon size={13} />
      </span>
      <span className="w-[108px] shrink-0 whitespace-nowrap font-mono text-[10.5px] tabular-nums text-ink-faint">
        {fmtTime(event.t)}
      </span>
      <span className="w-[54px] shrink-0 whitespace-nowrap rounded-full bg-slate-100 px-1.5 py-0.5 text-center font-mono text-[10px] font-bold tabular-nums text-ink-soft">
        #{event.truckId ?? '—'}
      </span>
      <span className={`min-w-0 flex-1 truncate text-[12px] font-semibold ${isNewest ? 'text-brand-800' : 'text-ink'}`}>
        {event.description}
      </span>
      {isNewest && (
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-brand-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
          <span className="h-1 w-1 animate-pulse rounded-full bg-white" /> New
        </span>
      )}
    </motion.div>
  );
}

/** A professional operational timeline styled like an industrial monitoring
 *  console's event/alarm log: fixed-height, monospace-timestamped, auto-
 *  scrolling ("tail -f") vertical list with a colored icon + accent stripe
 *  per event kind, the newest entry highlighted and tagged, and each row
 *  sliding into place instead of popping in. Built entirely from the
 *  read-only `expandTimelineEvents` selector — the underlying eventsLog
 *  (what happened and when) is untouched. */
export default function EventTimeline({ result, frame }) {
  const scrollRef = useRef(null);

  // Expand the full log once per simulation run, not once per tick.
  const expanded = useMemo(
    () => (result ? expandTimelineEvents(result.eventsLog) : []),
    [result],
  );

  const events = useMemo(() => {
    if (!frame) return [];
    return expanded.filter((e) => e.t <= frame.t).slice(-80);
  }, [expanded, frame && Math.floor(frame.t)]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [events.length]);

  return (
    <Card
      title="Live Event Timeline"
      icon={History}
      bodyClassName="!p-0"
      right={
        <div className="flex items-center gap-2 pr-1">
          {result && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-600">
              <Radio size={10} className="animate-pulse" /> Live
            </span>
          )}
          <span className="text-[11px] text-ink-faint">
            {result ? `${expanded.length.toLocaleString()} total events` : ''}
          </span>
        </div>
      }
    >
      {events.length === 0 ? (
        <div className="flex h-[80px] items-center justify-center rounded-b-xl border-t border-line text-[12px] text-ink-faint">
          Events will stream here once the simulation is running.
        </div>
      ) : (
        <div ref={scrollRef} className="h-[260px] overflow-y-auto rounded-b-xl border-t border-line bg-white font-mono">
          <AnimatePresence initial={false}>
            {events.map((event, i) => (
              <EventRow key={event.key} event={event} isNewest={i === events.length - 1} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </Card>
  );
}
