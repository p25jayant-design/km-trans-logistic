import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { DoorOpen, LogOut, Truck } from 'lucide-react';
import { LAYOUTS, computeZonePositions, pathIntoBay, pathOutOfBay } from '../../lib/floorLayouts.js';
import { TRUCK_STATE_COLOR } from '../../lib/styleMaps.js';

const ZONE_META = {
  Bu: { title: 'Standard Bays', fill: '#dbeafe', stroke: '#93c5fd', textColor: '#1e40af' },
  Bi: { title: 'Inspection', fill: '#d1fae5', stroke: '#6ee7b7', textColor: '#065f46' },
  Be: { title: 'Dedicated (Long-Duration)', fill: '#fed7aa', stroke: '#fdba74', textColor: '#9a3412' },
};

const ENTER_DURATION = 1.1;
const EXIT_DURATION = 0.9;
const BAY_W = 46, BAY_H = 30;

let tripCounter = 0;

/** Spatial, to-scale rendering of the workshop floor in the selected shape
 *  (L or U — see floorLayouts.js), with bays actually repositioned per
 *  shape and trucks animated moving along that shape's corridor into their
 *  assigned bay and back out on completion. Reads the same `frame` object
 *  the rest of the dashboard already uses — never touches simulation
 *  logic, only visualizes where things already are. */
export default function WorkshopFloorPlan({ frame, shape, setShape }) {
  const layout = LAYOUTS[shape] || LAYOUTS.L;
  const prevBaysRef = useRef(null);
  const restingRef = useRef(new Map()); // truckId -> { zoneKey, bay: {id,x,y} }
  const [, forceTick] = useState(0);
  const [travelers, setTravelers] = useState([]);

  const zonePositions = useMemo(() => {
    if (!frame) return { Bu: [], Bi: [], Be: [] };
    const out = {};
    ['Bu', 'Bi', 'Be'].forEach((z) => {
      const ids = frame.bays[z].map((b) => b.id);
      out[z] = computeZonePositions(layout, z, ids);
    });
    return out;
  }, [frame, layout]);

  const findPos = (zoneKey, bayId) => zonePositions[zoneKey]?.find((p) => p.id === bayId);

  useEffect(() => {
    if (!frame) { prevBaysRef.current = null; return; }
    const prev = prevBaysRef.current;
    if (prev) {
      const newTravelers = [];
      ['Bu', 'Bi', 'Be'].forEach((zoneKey) => {
        frame.bays[zoneKey].forEach((bay) => {
          const prevBay = prev[zoneKey]?.find((b) => b.id === bay.id);
          const wasBusyHere = prevBay && prevBay.status === 'busy' && prevBay.truckId === bay.truckId;

          if (bay.status === 'busy' && !wasBusyHere) {
            // Newly docked this tick — animate the entrance. If the sim
            // advanced far enough in one tick that this bay's previous
            // occupant was never observed idle in between (possible at high
            // playback speeds), it wouldn't get a normal exit trip below —
            // clear any stale resting marker for this bay directly so it
            // never lingers as a ghost once the new truck docks here.
            for (const [tid, r] of restingRef.current) {
              if (r.zoneKey === zoneKey && r.bay.id === bay.id && tid !== bay.truckId) {
                restingRef.current.delete(tid);
              }
            }
            const pos = findPos(zoneKey, bay.id);
            if (pos) {
              const path = pathIntoBay(layout, zoneKey, pos);
              newTravelers.push({ tripId: ++tripCounter, truckId: bay.truckId, kind: 'enter', zoneKey, bay: pos, path });
            }
          }
          if (prevBay && prevBay.status === 'busy' && bay.status === 'idle') {
            // Just departed — animate the exit from wherever it was resting.
            const resting = restingRef.current.get(prevBay.truckId);
            const pos = resting ? resting.bay : findPos(zoneKey, prevBay.id);
            if (pos) {
              const path = pathOutOfBay(layout, zoneKey, pos);
              newTravelers.push({ tripId: ++tripCounter, truckId: prevBay.truckId, kind: 'exit', zoneKey, bay: pos, path });
            }
            restingRef.current.delete(prevBay.truckId);
          }
        });
      });
      if (newTravelers.length) setTravelers((cur) => [...cur, ...newTravelers]);
    }
    prevBaysRef.current = frame.bays;
  }, [frame, layout]);

  const handleTripComplete = (trip) => {
    setTravelers((cur) => cur.filter((t) => t.tripId !== trip.tripId));
    if (trip.kind === 'enter') {
      restingRef.current.set(trip.truckId, { zoneKey: trip.zoneKey, bay: trip.bay });
      forceTick((v) => v + 1);
    }
  };

  if (!frame) return null;

  const { width, height } = layout.canvas;
  const queued = frame.queue.slice(0, 10);
  const overflow = frame.queue.length - queued.length;

  const restingEntries = Array.from(restingRef.current.entries()).map(([truckId, r]) => {
    // Keep resting position current with the live zone layout (so a shape
    // switch smoothly glides already-docked trucks to their new spot).
    const live = findPos(r.zoneKey, r.bay.id) || r.bay;
    return { truckId, zoneKey: r.zoneKey, bay: live };
  });

  return (
    <div className="rounded-lg border border-line bg-surface-soft p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[12px] font-bold uppercase tracking-wide text-ink-soft">Spatial Floor Plan</div>
        <div className="flex items-center rounded-full border border-line bg-white p-0.5">
          {Object.values(LAYOUTS).map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setShape(l.id)}
              title={l.description}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-all duration-150 ${
                shape === l.id ? 'bg-brand-600 text-white shadow-sm' : 'text-ink-faint hover:text-ink'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full overflow-hidden rounded-md border border-line bg-white">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" style={{ maxHeight: 420 }}>
          {/* Corridor */}
          <motion.path
            key={`corridor-${shape}`}
            d={layout.drawPath}
            fill="none"
            stroke="#cbd5e1"
            strokeWidth={22}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35 }}
          />
          <motion.path
            key={`corridor-dash-${shape}`}
            d={layout.drawPath}
            fill="none"
            stroke="#f8fafc"
            strokeWidth={2}
            strokeDasharray="6 8"
            strokeLinecap="round"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35 }}
          />

          {/* Entry / exit gates */}
          <g>
            <circle cx={layout.entry.x} cy={layout.entry.y} r={9} fill="#2563eb" />
            <text x={layout.entry.x} y={layout.entry.y - 15} textAnchor="middle" fontSize={11} fontWeight={700} fill="#1e40af">ENTRY</text>
          </g>
          <g>
            <circle cx={layout.exit.x} cy={layout.exit.y} r={9} fill="#64748b" />
            <text x={layout.exit.x} y={layout.exit.y - 15} textAnchor="middle" fontSize={11} fontWeight={700} fill="#475569">EXIT</text>
          </g>

          {/* Bay markers */}
          {['Bu', 'Bi', 'Be'].map((zoneKey) => {
            const meta = ZONE_META[zoneKey];
            return zonePositions[zoneKey].map((pos) => {
              const bay = frame.bays[zoneKey].find((b) => b.id === pos.id);
              const busy = bay?.status === 'busy';
              return (
                <motion.g
                  key={pos.id}
                  animate={{ x: pos.x - BAY_W / 2, y: pos.y - BAY_H / 2 }}
                  transition={{ duration: 0.5, ease: 'easeInOut' }}
                >
                  <motion.rect
                    width={BAY_W}
                    height={BAY_H}
                    rx={6}
                    fill={busy ? meta.fill : '#f8fafc'}
                    stroke={busy ? meta.stroke : '#e2e8f0'}
                    strokeWidth={1.5}
                  />
                  <text x={BAY_W / 2} y={12} textAnchor="middle" fontSize={9} fontWeight={700} fill={meta.textColor}>{pos.id}</text>
                  <text x={BAY_W / 2} y={23} textAnchor="middle" fontSize={7.5} fill={busy ? meta.textColor : '#94a3b8'}>
                    {busy ? `#${bay.truckId}` : 'idle'}
                  </text>
                </motion.g>
              );
            });
          })}

          {/* Zone labels */}
          {['Bu', 'Bi', 'Be'].map((zoneKey) => {
            const positions = zonePositions[zoneKey];
            if (!positions.length) return null;
            const first = positions[0];
            const zone = layout.zones[zoneKey];
            const labelX = zone.axis === 'x' ? first.x : first.x + (zone.dock > 0 ? 34 : -34);
            const labelY = zone.axis === 'x' ? (zone.dock > 0 ? first.y + 46 : first.y - 40) : first.y - 22;
            return (
              <text key={`label-${zoneKey}`} x={labelX} y={labelY} fontSize={9.5} fontWeight={700} fill="#94a3b8" textAnchor="middle">
                {ZONE_META[zoneKey].title.toUpperCase()}
              </text>
            );
          })}

          {/* Queued trucks, clustered near entry */}
          {queued.map((tr, i) => (
            <circle
              key={`q-${tr.id}`}
              cx={layout.queueHold.x + (i % 5) * 14}
              cy={layout.queueHold.y + Math.floor(i / 5) * 14}
              r={4.5}
              fill={TRUCK_STATE_COLOR.waiting.hex}
              opacity={0.85}
            >
              <title>{`#${tr.id} ${tr.jobName} — waiting`}</title>
            </circle>
          ))}
          {overflow > 0 && (
            <text x={layout.queueHold.x + 76} y={layout.queueHold.y + 4} fontSize={9} fontWeight={700} fill="#64748b">
              +{overflow}
            </text>
          )}

          {/* Resting (docked, mid-service) trucks */}
          {restingEntries.map(({ truckId, bay }) => (
            <motion.circle
              key={`rest-${truckId}`}
              r={5}
              fill={TRUCK_STATE_COLOR.service.hex}
              stroke="#ffffff"
              strokeWidth={1.5}
              animate={{ cx: bay.x, cy: bay.y }}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
            >
              <title>{`#${truckId} — in service`}</title>
            </motion.circle>
          ))}

          {/* Trucks actively traveling the corridor */}
          {travelers.map((trip) => (
            <motion.circle
              key={`trip-${trip.tripId}`}
              r={5.5}
              fill={trip.kind === 'enter' ? TRUCK_STATE_COLOR.allocated.hex : TRUCK_STATE_COLOR.completed.hex}
              stroke="#ffffff"
              strokeWidth={1.5}
              initial={{ cx: trip.path[0].x, cy: trip.path[0].y }}
              animate={{ cx: trip.path.map((p) => p.x), cy: trip.path.map((p) => p.y) }}
              transition={{ duration: trip.kind === 'enter' ? ENTER_DURATION : EXIT_DURATION, ease: 'linear' }}
              onAnimationComplete={() => handleTripComplete(trip)}
            >
              <title>{`#${trip.truckId} — ${trip.kind === 'enter' ? 'moving to bay' : 'departing'}`}</title>
            </motion.circle>
          ))}
        </svg>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3 text-[10.5px] text-ink-faint">
        <span className="flex items-center gap-1"><DoorOpen size={11} className="text-blue-600" /> Entry</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: TRUCK_STATE_COLOR.waiting.hex }} /> Waiting</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: TRUCK_STATE_COLOR.allocated.hex }} /> Moving to bay</span>
        <span className="flex items-center gap-1"><Truck size={11} className="text-emerald-600" /> In service</span>
        <span className="flex items-center gap-1"><LogOut size={11} className="text-gray-500" /> Exit</span>
      </div>
    </div>
  );
}
