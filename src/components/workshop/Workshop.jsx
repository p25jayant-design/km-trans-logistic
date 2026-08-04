import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutGroup, AnimatePresence } from 'framer-motion';
import { DoorOpen, LogOut, ArrowDown, Search, Wrench, ShieldAlert, AlertTriangle } from 'lucide-react';
import Queue from './Queue.jsx';
import BayCard from './BayCard.jsx';
import TruckCard from './TruckCard.jsx';
import WorkshopOverview from './WorkshopOverview.jsx';
import WorkshopFloorPlan from './WorkshopFloorPlan.jsx';
import Card from '../ui/Card.jsx';
import { getTruckDetails } from '../../engine/frameSelectors.js';

/** A short vertical dashed "floor marking" with a directional arrow —
 *  connects one stage of the workshop flow to the next. */
function StageArrow({ label }) {
  return (
    <div className="flex flex-col items-center">
      <div className="floor-lane-vertical h-5 w-px" />
      <ArrowDown size={15} className="-my-0.5 text-ink-faint/60" strokeWidth={2.25} />
      <div className="floor-lane-vertical h-5 w-px" />
      {label && (
        <span className="my-0.5 rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
          {label}
        </span>
      )}
    </div>
  );
}

function GateBadge({ icon: Icon, label, sub, tone }) {
  return (
    <div className={`flex items-center gap-2.5 self-center rounded-lg border px-4 py-2 ${tone}`}>
      <Icon size={17} />
      <div className="leading-tight">
        <div className="text-[11px] font-bold uppercase tracking-wide">{label}</div>
        {sub && <div className="text-[10px] opacity-80">{sub}</div>}
      </div>
    </div>
  );
}

function BaySection({ title, icon: Icon, bays, emptyHint, onInspect, bottleneck }) {
  const isBottleneck = bottleneck?.label === title;

  if (!bays.length) {
    return (
      <div className="rounded-lg border border-dashed border-line p-3 text-center text-[11.5px] text-ink-faint">
        {emptyHint}
      </div>
    );
  }
  return (
    <div className={isBottleneck ? 'rounded-lg ring-2 ring-red-300/70 ring-offset-2 ring-offset-surface' : ''}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-ink-soft">
          <Icon size={14} /> {title}{' '}
          <span className="font-normal text-ink-faint">
            ({bays.filter((b) => b.status === 'busy').length}/{bays.length} busy)
          </span>
        </div>
        {isBottleneck && (
          <span className="flex shrink-0 animate-pulse items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700">
            <AlertTriangle size={11} /> Bottleneck · {(bottleneck.utilization * 100).toFixed(0)}%
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {bays.map((bay) => <BayCard key={bay.id} bay={bay} onInspect={onInspect} bottleneck={bottleneck} />)}
      </div>
    </div>
  );
}

/** The centerpiece of the dashboard: a top-to-bottom factory-floor flow —
 *  Entry → Queue → Inspection → Standard → Dedicated → Exit — connected by
 *  directional arrows and dashed floor markings. Trucks are given a stable
 *  `layoutId` wherever they appear (queue lane, bay slot, exit lane), so
 *  Framer Motion's shared-layout ("FLIP") animation physically slides each
 *  truck from one stage to the next instead of teleporting or popping in.
 *  Purely presentational — reads `frame`/`result` (already derived from the
 *  DES engine's result) and never touches simulation logic. */
export default function Workshop({ result, frame }) {
  const [exiting, setExiting] = useState([]);
  const [floorShape, setFloorShape] = useState('L');
  const prevBaysRef = useRef(null);

  // Detect bay busy -> idle transitions between consecutive rendered frames
  // and hand the departing truck off to the exit lane for a moment before
  // it disappears — this is what makes completions "depart" instead of
  // instantly vanishing from their bay.
  useEffect(() => {
    if (!frame) { prevBaysRef.current = null; return; }
    const prev = prevBaysRef.current;
    if (prev) {
      const justDeparted = [];
      ['Bu', 'Be', 'Bi'].forEach((type) => {
        frame.bays[type].forEach((bay) => {
          const prevBay = prev[type]?.find((b) => b.id === bay.id);
          if (prevBay && prevBay.status === 'busy' && bay.status === 'idle') {
            justDeparted.push({
              truckId: prevBay.truckId,
              jobName: prevBay.jobName,
              vehicleType: prevBay.vehicleType,
              category: prevBay.category,
            });
          }
        });
      });
      if (justDeparted.length) {
        setExiting((cur) => {
          const seen = new Set(cur.map((c) => c.truckId));
          const fresh = justDeparted.filter((d) => !seen.has(d.truckId));
          return fresh.length ? [...cur, ...fresh] : cur;
        });
        justDeparted.forEach((d) => {
          setTimeout(() => {
            setExiting((cur) => cur.filter((c) => c.truckId !== d.truckId));
          }, 900);
        });
      }
    }
    prevBaysRef.current = frame.bays;
  }, [frame]);

  // Read-only lookup handed to every TruckCard for its hover tooltip — only
  // reads already-simulated truck records, never mutates anything.
  const inspectTruck = useCallback(
    (truckId) => (result && frame ? getTruckDetails(result, truckId, frame.t) : null),
    [result, frame],
  );

  if (!frame) {
    return (
      <Card title="Workshop Floor" className="flex min-h-[70vh] items-center justify-center">
        <p className="text-[13px] text-ink-faint">Run the simulation to bring the workshop floor to life.</p>
      </Card>
    );
  }

  return (
    <Card className="min-h-[70vh]" bodyClassName="pt-1">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
        <h2 className="text-[13px] font-bold uppercase tracking-wide text-ink-soft">Workshop Floor — Live State</h2>
        <span className="text-[11px] text-ink-faint">Entry → Queue → Inspection → Standard → Dedicated → Exit</span>
      </div>

      <WorkshopOverview result={result} frame={frame} />

      <div className="mb-3">
        <WorkshopFloorPlan result={result} frame={frame} shape={floorShape} setShape={setFloorShape} />
      </div>

      <LayoutGroup id="workshop-trucks">
        <div className="flex flex-col items-stretch gap-2.5">
          <GateBadge
            icon={DoorOpen}
            label="Entry Gate"
            sub={`${frame.arrivedSoFar.toLocaleString()} arrived`}
            tone="border-blue-200 bg-blue-50 text-blue-600"
          />
          <StageArrow />

          <Queue queue={frame.queue} onInspect={inspectTruck} />
          <StageArrow label="Allocated to bay" />

          <BaySection
            title="Inspection Bays"
            icon={Search}
            bays={frame.bays.Bi}
            emptyHint="No inspection bays configured."
            onInspect={inspectTruck}
            bottleneck={frame.bottleneck}
          />
          <StageArrow />

          <BaySection
            title="Standard Bays"
            icon={Wrench}
            bays={frame.bays.Bu}
            emptyHint="No standard bays configured."
            onInspect={inspectTruck}
            bottleneck={frame.bottleneck}
          />
          <StageArrow />

          <BaySection
            title="Dedicated Bays"
            icon={ShieldAlert}
            bays={frame.bays.Be}
            emptyHint="No dedicated bays configured — long-duration jobs are routed to Standard Bays."
            onInspect={inspectTruck}
            bottleneck={frame.bottleneck}
          />
          <StageArrow label="Job complete" />

          <div className="min-h-[64px] rounded-lg border border-dashed border-line bg-surface-soft/60 p-2">
            {exiting.length === 0 ? (
              <div className="flex h-[48px] items-center justify-center text-[11px] text-ink-faint">
                Completed trucks depart here
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <AnimatePresence>
                  {exiting.map((tr) => (
                    <TruckCard
                      key={tr.truckId}
                      truck={{ id: tr.truckId, jobName: tr.jobName, vehicleType: tr.vehicleType, category: tr.category }}
                      state="completed"
                      variant="exit"
                      layoutId={`truck-${tr.truckId}`}
                      onInspect={inspectTruck}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
          <StageArrow />

          <GateBadge
            icon={LogOut}
            label="Exit Gate"
            sub={`${frame.completedSoFar.toLocaleString()} completed`}
            tone="border-gray-200 bg-gray-50 text-gray-500"
          />
        </div>
      </LayoutGroup>
    </Card>
  );
}
