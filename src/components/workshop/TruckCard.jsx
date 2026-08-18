import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Hash, Truck, Car, Wrench, Timer, ListOrdered, CheckCircle2 } from 'lucide-react';
import { CATEGORY_LABEL, TRUCK_STATE_COLOR, TRUCK_STATE_LABEL } from '../../lib/styleMaps.js';
import { fmtMinutesShort } from '../../engine/frameSelectors.js';
import TruckTooltip from './TruckTooltip.jsx';

const VEHICLE_ICON = { 'Car Carrier': Car, 'Flatbed Carrier': Truck };

const VARIANT_WIDTH = {
  queue: 'w-[178px] shrink-0',
  exit: 'w-[190px] shrink-0',
  bay: 'w-full',
};

/* Per-context motion presets: each place a truck can appear animates its
 * entrance/exit slightly differently, but every truck always carries a
 * `layoutId` (assigned by the caller) so Framer Motion runs a shared-layout
 * FLIP transition when it unmounts here and mounts somewhere else on the
 * same render — i.e. it slides between stages, it never teleports. */
const MOTION_PRESETS = {
  queue: {
    initial: { opacity: 0, y: -18, x: 10, scale: 0.9 },
    animate: { opacity: 1, x: 0, y: 0, scale: 1 },
    exit: { opacity: 0, x: -24, scale: 0.9 },
  },
  bay: {
    initial: { opacity: 0, scale: 0.92 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.92 },
  },
  exit: {
    initial: { opacity: 1, y: -6 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 18, transition: { duration: 0.45, ease: 'easeIn' } },
  },
};

/** A professional "operational card" for a single truck — used identically
 *  in the queue lane, inside a bay slot, and in the exit lane, so a truck
 *  looks and feels like the same moving entity throughout its journey.
 *  `state` drives the color per spec: blue = waiting, orange = allocated,
 *  green = under service, gray = completed. Hovering reveals a floating
 *  detail panel (arrival time, waiting time, assigned workers, bay,
 *  expected completion) fed by the read-only `onInspect(truckId)` lookup. */
export default function TruckCard({ truck, state = 'waiting', variant = 'queue', layoutId, onInspect, dayMinutes }) {
  const palette = TRUCK_STATE_COLOR[state] || TRUCK_STATE_COLOR.waiting;
  const VehicleIcon = VEHICLE_ICON[truck.vehicleType] || Truck;
  const motionProps = MOTION_PRESETS[variant] || MOTION_PRESETS.queue;

  const ref = useRef(null);
  const [anchorRect, setAnchorRect] = useState(null);
  const [details, setDetails] = useState(null);

  const handleEnter = () => {
    if (ref.current) setAnchorRect(ref.current.getBoundingClientRect());
    if (onInspect) setDetails(onInspect(truck.id));
  };
  const handleLeave = () => {
    setAnchorRect(null);
    setDetails(null);
  };

  return (
    <motion.div
      ref={ref}
      layoutId={layoutId}
      layout
      {...motionProps}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      className={`relative flex flex-col gap-1.5 rounded-lg border ${palette.border} ${palette.soft} p-2.5 shadow-sm ${VARIANT_WIDTH[variant]}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`flex items-center gap-1 text-[11.5px] font-bold ${palette.text}`}>
          <Hash size={12} /> {truck.id}
        </span>
        <span className={`whitespace-nowrap rounded-full bg-white/70 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide ${palette.text}`}>
          {TRUCK_STATE_LABEL[state]}
        </span>
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-ink-soft">
        <VehicleIcon size={12} className="shrink-0 text-ink-faint" />
        <span className="truncate">{truck.vehicleType}</span>
      </div>

      <div className="flex items-center gap-1.5 text-[12px] font-medium text-ink" title={truck.jobName}>
        <Wrench size={12} className="shrink-0 text-ink-faint" />
        <span className="truncate">{truck.jobName}</span>
      </div>

      <div className="flex items-center justify-between gap-2 text-[10.5px] text-ink-faint">
        {state === 'waiting' && truck.position != null && (
          <span className="flex items-center gap-1"><ListOrdered size={11} /> Position {truck.position}</span>
        )}
        {(state === 'allocated' || state === 'service') && truck.remainingMin != null && (
          <span className="flex items-center gap-1"><Timer size={11} /> {fmtMinutesShort(truck.remainingMin, dayMinutes)} left</span>
        )}
        {state === 'completed' && (
          <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 size={11} /> Departed</span>
        )}
        <span className="truncate">{CATEGORY_LABEL[truck.category]}</span>
      </div>

      <TruckTooltip anchorRect={anchorRect} details={details} />
    </motion.div>
  );
}
