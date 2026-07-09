import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Users, Wrench } from 'lucide-react';
import TruckCard from './TruckCard.jsx';
import Badge from '../ui/Badge.jsx';
import { CATEGORY_COLOR } from '../../lib/styleMaps.js';
import { DEPT_NAMES } from '../../engine/desEngine.js';

/** A single service bay, styled like a real workstation: a dark equipment
 *  "nameplate" (Bay Name + Bay Type + status LED), a Status Badge, the
 *  current truck (as a full operational TruckCard, which carries Remaining
 *  Time), the departments/workers currently assigned to the job, and an
 *  animated progress bar. Empty bays show a large, unmistakable "Available"
 *  state instead of a small pill. Busy bays glow softly; the instant a job
 *  completes the whole card flashes green. A freshly-assigned truck is
 *  briefly shown "allocated" (orange) before settling into "service"
 *  (green) — a purely presentational cue timed to the truck's slide-in,
 *  since the DES engine itself allocates and starts service in one instant.
 *  Reads only already-derived frame/result data — no simulation logic. */
export default function BayCard({ bay, onInspect }) {
  const [justFinished, setJustFinished] = useState(false);
  const wasBusy = useRef(false);

  const [truckState, setTruckState] = useState('service');
  const prevTruckId = useRef(null);

  useEffect(() => {
    if (wasBusy.current && bay.status === 'idle') {
      setJustFinished(true);
      const timer = setTimeout(() => setJustFinished(false), 1000);
      return () => clearTimeout(timer);
    }
    wasBusy.current = bay.status === 'busy';
  }, [bay.status]);

  useEffect(() => {
    if (bay.status === 'busy' && prevTruckId.current !== bay.truckId) {
      prevTruckId.current = bay.truckId;
      setTruckState('allocated');
      const timer = setTimeout(() => setTruckState('service'), 550);
      return () => clearTimeout(timer);
    }
    if (bay.status !== 'busy') prevTruckId.current = null;
  }, [bay.status, bay.truckId]);

  const cat = bay.status === 'busy' ? CATEGORY_COLOR[bay.category] : null;

  // Same read-only lookup the hover tooltip uses — reused here to surface
  // "Assigned Workers" directly on the bay card, not just on hover.
  const assignedWorkers = useMemo(() => {
    if (bay.status !== 'busy' || !onInspect) return [];
    const details = onInspect(bay.truckId);
    return details?.assignedWorkers || [];
  }, [bay.status, bay.truckId, onInspect]);

  const workersLabel = assignedWorkers.length
    ? assignedWorkers.map((w) => `${w.count}× ${DEPT_NAMES[w.dept]}`).join(', ')
    : null;

  return (
    <motion.div
      layout
      className={`relative overflow-hidden rounded-lg border shadow-sm transition-colors duration-300 ${
        bay.status === 'busy' ? `${cat.border} bg-white` : 'border-line bg-surface-soft'
      } ${justFinished ? 'animate-flashGreen' : ''}`}
    >
      {/* equipment nameplate */}
      <div className="flex items-center justify-between bg-slate-800 px-2.5 py-1.5">
        <span className="flex items-center gap-1.5 font-mono text-[11px] font-bold tracking-wide text-white">
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              bay.status === 'busy' ? 'animate-pulse bg-emerald-400 shadow-[0_0_6px_2px_rgba(52,211,153,0.65)]' : 'bg-slate-500'
            }`}
          />
          BAY {bay.id}
        </span>
        <span className="text-[9.5px] font-semibold uppercase tracking-wide text-slate-300">{bay.typeLabel}</span>
      </div>

      <div className="p-2.5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <Badge tone={bay.status === 'busy' ? 'green' : 'neutral'} icon={bay.status === 'busy' ? Wrench : undefined}>
            {bay.status === 'busy' ? 'Busy' : 'Available'}
          </Badge>
          {workersLabel && (
            <span className="flex min-w-0 items-center gap-1 truncate text-[10px] text-ink-faint" title={workersLabel}>
              <Users size={11} className="shrink-0" /> <span className="truncate">{workersLabel}</span>
            </span>
          )}
        </div>

        {bay.status === 'busy' ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1, boxShadow: ['0 0 0 0 rgba(5,150,105,0.25)', '0 0 0 4px rgba(5,150,105,0)'] }}
            transition={{ boxShadow: { duration: 2.2, repeat: Infinity } }}
            className="rounded-md"
          >
            <TruckCard
              truck={{
                id: bay.truckId,
                jobName: bay.jobName,
                vehicleType: bay.vehicleType,
                category: bay.category,
                remainingMin: bay.remainingMin,
              }}
              state={truckState}
              variant="bay"
              layoutId={`truck-${bay.truckId}`}
              onInspect={onInspect}
            />
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <motion.div
                className={`h-full rounded-full ${cat.bg}`}
                animate={{ width: `${bay.progress * 100}%` }}
                transition={{ ease: 'linear', duration: 0.3 }}
              />
            </div>
          </motion.div>
        ) : (
          <div className="bay-idle-texture flex h-[104px] flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-line">
            <CheckCircle2 size={26} className="text-emerald-400" strokeWidth={1.75} />
            <span className="text-[12.5px] font-bold uppercase tracking-wide text-emerald-600">Available</span>
            <span className="text-[10px] text-ink-faint">Ready for next truck</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
