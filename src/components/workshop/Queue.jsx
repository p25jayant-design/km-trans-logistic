import React from 'react';
import { AnimatePresence } from 'framer-motion';
import { ListOrdered } from 'lucide-react';
import TruckCard from './TruckCard.jsx';
import Badge from '../ui/Badge.jsx';

/** The most important visual in the dashboard: an always-active horizontal
 *  lane of waiting trucks. When the front truck leaves, the rest slide
 *  forward automatically (AnimatePresence + layout animations) — nothing
 *  ever teleports. Long queues collapse into a scrollable strip with
 *  fading edges rather than growing the page. */
export default function Queue({ queue, onInspect }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-surface-soft p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-ink-soft">
          <ListOrdered size={14} /> Waiting Queue
        </div>
        <Badge tone={queue.length > 10 ? 'red' : queue.length > 0 ? 'amber' : 'green'}>
          {queue.length} truck{queue.length === 1 ? '' : 's'}
        </Badge>
      </div>

      {queue.length === 0 ? (
        <div className="flex h-[92px] items-center justify-center rounded-lg border border-dashed border-line text-[12px] text-ink-faint">
          Queue is empty — all arriving trucks are being served immediately.
        </div>
      ) : (
        <div className="fade-edges overflow-x-auto">
          <div className="flex gap-2.5 pb-1">
            <AnimatePresence initial={false}>
              {queue.slice(0, 60).map((truck) => (
                <TruckCard
                  key={truck.id}
                  truck={truck}
                  state="waiting"
                  variant="queue"
                  layoutId={`truck-${truck.id}`}
                  onInspect={onInspect}
                />
              ))}
            </AnimatePresence>
            {queue.length > 60 && (
              <div className="flex w-[100px] shrink-0 items-center justify-center rounded-lg border border-line bg-white text-[11.5px] text-ink-faint">
                +{queue.length - 60} more
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
