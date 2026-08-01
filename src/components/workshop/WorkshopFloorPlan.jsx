import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Wrench, ShieldAlert, Search, Navigation,
  CheckCircle2, Clock, AlertTriangle, Hammer, Gauge, Zap, Flame, Disc,
} from 'lucide-react';
import { LAYOUTS, computeZonePositions, pathIntoBay, pathOutOfBay, accessStub, BAY_W, BAY_H } from '../../lib/floorLayouts.js';
import { TRUCK_STATE_COLOR, BAY_STATUS_COLOR } from '../../lib/styleMaps.js';
import { getTruckDetails } from '../../engine/frameSelectors.js';
import { DEPT_KEYS } from '../../engine/desEngine.js';
import TruckTooltip from './TruckTooltip.jsx';

/* Section metadata — labels match the industrial-floor-plan spec's wording
 * exactly ("Standard Service Bays" / "Dedicated Long-Duration Bays" /
 * "Inspection Bay"), plus the bay-type icon shown in each workstation card's
 * header and above its section. */
const ZONE_META = {
  Bu: { title: 'Standard Service Bays', fill: '#eff6ff', stroke: '#bfdbfe', icon: Wrench },
  Be: { title: 'Dedicated Long-Duration Bays', fill: '#fff7ed', stroke: '#fed7aa', icon: ShieldAlert },
  Bi: { title: 'Inspection Bay', fill: '#ecfdf5', stroke: '#a7f3d0', icon: Search },
};
const ZONE_ORDER = ['Bu', 'Be', 'Bi'];

const DEPT_ICON = { mech: Wrench, dent: Hammer, bal: Gauge, elec: Zap, weld: Flame, tire: Disc };

const BOTTLENECK_LABEL_BY_ZONE = { Bu: 'Standard Bays', Be: 'Dedicated Bays', Bi: 'Inspection Bays' };

const ENTER_DURATION = 1.3;
const EXIT_DURATION = 1.05;
const TRUCK_W = 30, TRUCK_H = 17;

let tripCounter = 0;

/** 0 = facing east (right), 90 = south (down), 180 = west (left),
 *  -90 = north (up) — kept in a signed range (not 0..360) so consecutive
 *  headings can be "unwrapped" to whichever representation is numerically
 *  closest to the previous one, guaranteeing Framer's linear keyframe
 *  interpolation always turns the short way instead of spinning the long
 *  way around when a path alternates between e.g. north and east. */
function headingFromDelta(dx, dy) {
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 0 : 180;
  return dy >= 0 ? 90 : -90;
}

/** Builds a rotation-keyframe array parallel to a path's x/y keyframe
 *  arrays (same length), so the truck glyph's heading animates smoothly
 *  through each corner exactly in sync with its position — "truck
 *  orientation follows road direction". */
function buildRotationKeyframes(path) {
  const raw = [];
  for (let i = 0; i < path.length - 1; i++) {
    raw.push(headingFromDelta(path[i + 1].x - path[i].x, path[i + 1].y - path[i].y));
  }
  raw.push(raw.length ? raw[raw.length - 1] : 0);
  const out = [raw[0] ?? 0];
  for (let i = 1; i < raw.length; i++) {
    let cur = raw[i];
    const prev = out[i - 1];
    while (cur - prev > 180) cur -= 360;
    while (cur - prev < -180) cur += 360;
    out.push(cur);
  }
  return out;
}

/** Evenly-spaced directional flow-arrow markers along a corridor's waypoint
 *  list — purely decorative floor styling, computed fresh from the layout's
 *  own waypoints so it automatically follows whichever shape is selected. */
function computeFlowArrows(points, spacing = 130) {
  const arrows = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    const rotation = headingFromDelta(dx, dy);
    const steps = Math.max(1, Math.round(len / spacing));
    for (let s = 1; s < steps; s++) {
      const frac = s / steps;
      arrows.push({ key: `${i}-${s}`, x: a.x + dx * frac, y: a.y + dy * frac, rotation });
    }
  }
  return arrows;
}

/** Bounding band behind every bay in a zone — the tinted "service area"
 *  rectangle that makes Standard / Dedicated / Inspection read as three
 *  clearly separated, aligned areas rather than loose points. */
function zoneBand(zone, positions) {
  if (!positions.length) return null;
  const pad = 16;
  if (zone.axis === 'x') {
    const xs = positions.map((p) => p.x);
    const y = zone.corridor + zone.dock;
    return { x: Math.min(...xs) - BAY_W / 2 - pad, y: y - BAY_H / 2 - pad, w: Math.max(...xs) - Math.min(...xs) + BAY_W + pad * 2, h: BAY_H + pad * 2 };
  }
  const ys = positions.map((p) => p.y);
  const x = zone.corridor + zone.dock;
  return { x: x - BAY_W / 2 - pad, y: Math.min(...ys) - BAY_H / 2 - pad, w: BAY_W + pad * 2, h: Math.max(...ys) - Math.min(...ys) + BAY_H + pad * 2 };
}

/** The little vehicle glyph rendered inside a `foreignObject` — plain HTML,
 *  not raw SVG shapes, deliberately: `foreignObject` has native x/y/width/
 *  height attributes (same reasoning as motion.rect/motion.text elsewhere
 *  in this file), so animating its position tracks the SVG's viewBox scale
 *  exactly. Its *rotation* is a CSS transform, but a pure rotation (no
 *  translate mixed in) has no such scale ambiguity, so it's safe to pair
 *  with the native-attribute position animation on the same element. */
function TruckBody({ color, small }) {
  return (
    <div className="flex h-full w-full items-center justify-center" style={{ transformOrigin: '50% 50%' }}>
      <div className="relative" style={{ width: small ? 20 : 24, height: small ? 11 : 13 }}>
        <div className="absolute inset-0 rounded-[3px] border border-white/70" style={{ background: color }} />
        <div className="absolute rounded-[2px]" style={{ right: -2, top: 1.5, width: 7, height: small ? 8 : 10, background: color, filter: 'brightness(0.72)' }} />
        <div className="absolute rounded-full bg-slate-700" style={{ width: 4, height: 4, left: 2, bottom: -2 }} />
        <div className="absolute rounded-full bg-slate-700" style={{ width: 4, height: 4, right: 6, bottom: -2 }} />
      </div>
    </div>
  );
}

/** Spatial, to-scale rendering of the workshop floor in the selected shape
 *  (L or U — see floorLayouts.js), styled as a digital-twin industrial
 *  floor plan: each bay is a full workstation card (id, type, status badge,
 *  occupancy, worker icons), arranged in clearly separated aligned service
 *  areas, with lane arrows, parking-stall outlines and access lanes off a
 *  striped corridor. Reads the same `frame`/`result` objects the rest of
 *  the dashboard already uses — never touches simulation logic, only
 *  visualizes where things already are. */
export default function WorkshopFloorPlan({ result, frame, shape, setShape }) {
  const layout = LAYOUTS[shape] || LAYOUTS.L;
  const prevBaysRef = useRef(null);
  const restingRef = useRef(new Map()); // truckId -> { zoneKey, bay: {id,x,y} }
  const [, forceTick] = useState(0);
  const [travelers, setTravelers] = useState([]);
  const [hover, setHover] = useState(null); // { truckId, rect }

  const zonePositions = useMemo(() => {
    if (!frame) return { Bu: [], Be: [], Bi: [] };
    const out = {};
    ZONE_ORDER.forEach((z) => {
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
      ZONE_ORDER.forEach((zoneKey) => {
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
              newTravelers.push({ tripId: ++tripCounter, truckId: bay.truckId, kind: 'enter', zoneKey, bay: pos, path, rot: buildRotationKeyframes(path) });
            }
          }
          if (prevBay && prevBay.status === 'busy' && bay.status === 'idle') {
            // Just departed — animate the exit from wherever it was resting.
            const resting = restingRef.current.get(prevBay.truckId);
            const pos = resting ? resting.bay : findPos(zoneKey, prevBay.id);
            if (pos) {
              const path = pathOutOfBay(layout, zoneKey, pos);
              newTravelers.push({ tripId: ++tripCounter, truckId: prevBay.truckId, kind: 'exit', zoneKey, bay: pos, path, rot: buildRotationKeyframes(path) });
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

  const showHover = (truckId) => (e) => setHover({ truckId, rect: e.currentTarget.getBoundingClientRect() });
  const clearHover = () => setHover(null);

  // Computed unconditionally (before the `!frame` early return below) so
  // this useMemo is called on every render, in the same order, regardless
  // of whether `frame` is present yet — required by the Rules of Hooks.
  const flowArrows = useMemo(() => computeFlowArrows(layout.corridorPath), [layout]);

  if (!frame) return null;

  const { width, height } = layout.canvas;
  const queued = frame.queue.slice(0, 12);
  const overflow = frame.queue.length - queued.length;

  // Bays currently the *destination* of an in-flight "enter" trip — these
  // get the "reserved" (blue) treatment and a pulsing highlight ring, since
  // the engine has already allocated them but the truck hasn't visually
  // arrived yet.
  const approachingKeys = new Set(
    travelers.filter((t) => t.kind === 'enter').map((t) => `${t.zoneKey}:${t.bay.id}`),
  );

  const bottleneckZone = ZONE_ORDER.find((z) => frame.bottleneck?.label === BOTTLENECK_LABEL_BY_ZONE[z]);

  const hoverDetails = hover && result ? getTruckDetails(result, hover.truckId, frame.t) : null;

  return (
    <div className="rounded-lg border border-line bg-surface-soft p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[12px] font-bold uppercase tracking-wide text-ink-soft">Spatial Floor Plan — Digital Twin</div>
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
        <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" style={{ maxHeight: 620 }}>
          <defs>
            <pattern id="floorTexture" width={28} height={28} patternUnits="userSpaceOnUse">
              <rect width={28} height={28} fill="#fbfcfe" />
              <circle cx={1} cy={1} r={1} fill="#eef1f6" />
            </pattern>
          </defs>
          {/* Subtle industrial floor texture */}
          <rect x={0} y={0} width={width} height={height} fill="url(#floorTexture)" />

          {/* Zone service-area bands, drawn first (under everything else) */}
          {ZONE_ORDER.map((zoneKey) => {
            const band = zoneBand(layout.zones[zoneKey], zonePositions[zoneKey]);
            if (!band) return null;
            const meta = ZONE_META[zoneKey];
            const isBn = bottleneckZone === zoneKey;
            return (
              <motion.rect
                key={`band-${zoneKey}`}
                rx={10}
                fill={meta.fill}
                stroke={isBn ? '#f87171' : meta.stroke}
                strokeWidth={isBn ? 2 : 1.25}
                strokeDasharray={isBn ? '5 4' : undefined}
                animate={{ x: band.x, y: band.y, width: band.w, height: band.h }}
                transition={{ duration: 0.5, ease: 'easeInOut' }}
              />
            );
          })}

          {/* Corridor — road surface + dashed center line */}
          <motion.path
            key={`corridor-${shape}`}
            d={layout.drawPath}
            fill="none"
            stroke="#cbd5e1"
            strokeWidth={26}
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
            strokeDasharray="7 9"
            strokeLinecap="round"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35 }}
          />

          {/* Directional flow-arrow markers along the corridor */}
          {flowArrows.map((a) => (
            <g key={`arrow-${shape}-${a.key}`} transform={`translate(${a.x} ${a.y}) rotate(${a.rotation})`} opacity={0.75}>
              <path d="M -6 -5 L 6 0 L -6 5 Z" fill="#94a3b8" />
            </g>
          ))}

          {/* Entry / exit gates */}
          <g>
            <circle cx={layout.entry.x} cy={layout.entry.y} r={10} fill="#2563eb" />
            <circle cx={layout.entry.x} cy={layout.entry.y} r={15} fill="none" stroke="#2563eb" strokeWidth={1.5} opacity={0.35} />
            <text x={layout.entry.x} y={layout.entry.y - 21} textAnchor="middle" fontSize={12} fontWeight={700} fill="#1e40af">ENTRY</text>
          </g>
          <g>
            <circle cx={layout.exit.x} cy={layout.exit.y} r={10} fill="#64748b" />
            <circle cx={layout.exit.x} cy={layout.exit.y} r={15} fill="none" stroke="#64748b" strokeWidth={1.5} opacity={0.35} />
            <text x={layout.exit.x} y={layout.exit.y - 21} textAnchor="middle" fontSize={12} fontWeight={700} fill="#475569">EXIT</text>
          </g>

          {/* Access lanes + parking-stall outline + workstation cards */}
          {ZONE_ORDER.map((zoneKey) => {
            const zone = layout.zones[zoneKey];
            const meta = ZONE_META[zoneKey];
            const TypeIcon = meta.icon;
            return zonePositions[zoneKey].map((pos) => {
              const bay = frame.bays[zoneKey].find((b) => b.id === pos.id);
              const busy = bay?.status === 'busy';
              const approaching = approachingKeys.has(`${zoneKey}:${pos.id}`);
              const statusKey = !busy ? 'available' : approaching ? 'reserved' : 'busy';
              const sc = BAY_STATUS_COLOR[statusKey];
              const stub = accessStub(layout, zoneKey, pos);
              const rx = pos.x - BAY_W / 2, ry = pos.y - BAY_H / 2;
              const workers = busy && bay.req
                ? DEPT_KEYS.filter((k) => bay.req[k] > 0).map((k) => [k, bay.req[k]])
                : [];

              return (
                <React.Fragment key={pos.id}>
                  {/* Access lane (driveway) connecting the corridor to the bay */}
                  <motion.line
                    stroke="#cbd5e1"
                    strokeWidth={10}
                    strokeLinecap="round"
                    animate={{ x1: stub.from.x, y1: stub.from.y, x2: stub.to.x, y2: stub.to.y }}
                    transition={{ duration: 0.5, ease: 'easeInOut' }}
                  />
                  {/* Parking-stall dashed outline, slightly larger than the card */}
                  <motion.rect
                    rx={8}
                    fill="none"
                    stroke="#cbd5e1"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    animate={{ x: rx - 6, y: ry - 6, width: BAY_W + 12, height: BAY_H + 12 }}
                    transition={{ duration: 0.5, ease: 'easeInOut' }}
                  />
                  {/* Reserved / bottleneck pulse ring */}
                  {(approaching) && (
                    <motion.rect
                      rx={10}
                      fill="none"
                      stroke={BAY_STATUS_COLOR.reserved.hex}
                      strokeWidth={2.5}
                      animate={{ x: rx - 4, y: ry - 4, width: BAY_W + 8, height: BAY_H + 8, opacity: [0.85, 0.15, 0.85] }}
                      transition={{ x: { duration: 0.5 }, y: { duration: 0.5 }, width: { duration: 0.5 }, height: { duration: 0.5 }, opacity: { duration: 1.1, repeat: Infinity, ease: 'easeInOut' } }}
                    />
                  )}

                  {/* Workstation card */}
                  <motion.foreignObject
                    width={BAY_W}
                    height={BAY_H}
                    animate={{ x: rx, y: ry }}
                    transition={{ duration: 0.5, ease: 'easeInOut' }}
                    style={{ cursor: busy ? 'pointer' : 'default', overflow: 'visible' }}
                    onMouseEnter={busy ? showHover(bay.truckId) : undefined}
                    onMouseLeave={busy ? clearHover : undefined}
                  >
                    <div
                      className="flex h-full w-full flex-col overflow-hidden rounded-md border-2 shadow-sm"
                      style={{ borderColor: sc.stroke, background: sc.fill }}
                    >
                      <div className="flex shrink-0 items-center justify-between px-1.5 py-[1.5px]" style={{ background: sc.hex }}>
                        <span className="font-bold text-white" style={{ fontSize: 9.5 }}>{pos.id}</span>
                        <TypeIcon size={9} className="text-white" strokeWidth={2.25} />
                      </div>
                      <div className="flex flex-1 flex-col items-center justify-center gap-[1px] px-1 py-[1px]">
                        <span
                          className="rounded-full border px-1.5 font-bold leading-tight"
                          style={{ fontSize: 6.5, color: sc.hex, borderColor: sc.stroke, background: 'white' }}
                        >
                          {sc.label}
                        </span>
                        {busy ? (
                          <>
                            <span className="font-bold leading-tight text-ink" style={{ fontSize: 8 }}>#{bay.truckId} · {bay.vehicleType}</span>
                            <span className="leading-tight text-ink-faint" style={{ fontSize: 6.5 }}>
                              {approaching ? 'Inbound' : `${Math.round(bay.remainingMin)} min left`}
                            </span>
                            {workers.length > 0 && (
                              <div className="mt-[1px] flex flex-wrap items-center justify-center gap-x-1">
                                {workers.map(([dept, n]) => {
                                  const Icon = DEPT_ICON[dept] || Wrench;
                                  return (
                                    <span key={dept} className="flex items-center gap-[1px] text-ink-soft" style={{ fontSize: 6.5 }}>
                                      <Icon size={6.5} strokeWidth={2.5} />{n}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="leading-tight text-ink-faint" style={{ fontSize: 6.5 }}>Open stall</span>
                        )}
                      </div>
                    </div>
                  </motion.foreignObject>
                </React.Fragment>
              );
            });
          })}

          {/* Zone section labels, with bay counts */}
          {ZONE_ORDER.map((zoneKey) => {
            const band = zoneBand(layout.zones[zoneKey], zonePositions[zoneKey]);
            if (!band) return null;
            const zone = layout.zones[zoneKey];
            const meta = ZONE_META[zoneKey];
            const TypeIcon = meta.icon;
            const above = zone.dock > 0; // if bays sit "after" the corridor, label goes above the band; otherwise below
            const labelY = zone.axis === 'x'
              ? (above ? band.y - 8 : band.y + band.h + 15)
              : band.y - 8;
            const labelX = band.x + band.w / 2;
            return (
              <g key={`label-${zoneKey}`}>
                <text x={labelX} y={labelY} fontSize={11} fontWeight={800} fill="#475569" textAnchor="middle" letterSpacing={0.3}>
                  {meta.title.toUpperCase()} · {zonePositions[zoneKey].length}
                </text>
              </g>
            );
          })}

          {/* Queued trucks, clustered near entry */}
          {queued.map((tr, i) => (
            <circle
              key={`q-${tr.id}`}
              cx={layout.queueHold.x + (i % 5) * 16}
              cy={layout.queueHold.y + Math.floor(i / 5) * 16}
              r={5}
              fill={TRUCK_STATE_COLOR.waiting.hex}
              stroke="#ffffff"
              strokeWidth={1.25}
              opacity={0.9}
              className="cursor-pointer"
              onMouseEnter={showHover(tr.id)}
              onMouseLeave={clearHover}
            />
          ))}
          {overflow > 0 && (
            <text x={layout.queueHold.x + 88} y={layout.queueHold.y + 5} fontSize={10} fontWeight={700} fill="#64748b">
              +{overflow}
            </text>
          )}

          {/* Trucks actively traveling the corridor — direction-following glyph */}
          {travelers.map((trip) => (
            <motion.foreignObject
              key={`trip-${trip.tripId}`}
              width={TRUCK_W}
              height={TRUCK_H}
              initial={{ x: trip.path[0].x - TRUCK_W / 2, y: trip.path[0].y - TRUCK_H / 2, rotate: trip.rot[0] }}
              animate={{
                x: trip.path.map((p) => p.x - TRUCK_W / 2),
                y: trip.path.map((p) => p.y - TRUCK_H / 2),
                rotate: trip.rot,
              }}
              transition={{ duration: trip.kind === 'enter' ? ENTER_DURATION : EXIT_DURATION, ease: 'easeInOut' }}
              onAnimationComplete={() => handleTripComplete(trip)}
              style={{ transformOrigin: '50% 50%', cursor: 'pointer', overflow: 'visible' }}
              onMouseEnter={showHover(trip.truckId)}
              onMouseLeave={clearHover}
            >
              <TruckBody color={trip.kind === 'enter' ? TRUCK_STATE_COLOR.allocated.hex : TRUCK_STATE_COLOR.completed.hex} />
            </motion.foreignObject>
          ))}
        </svg>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3 text-[10.5px] text-ink-faint">
        <span className="flex items-center gap-1"><Clock size={11} className="text-blue-600" /> Waiting</span>
        <span className="flex items-center gap-1"><Navigation size={11} className="text-orange-600" /> Moving</span>
        <span className="flex items-center gap-1"><Wrench size={11} className="text-orange-600" /> In Service</span>
        <span className="flex items-center gap-1"><Search size={11} className="text-emerald-600" /> Inspection</span>
        <span className="flex items-center gap-1"><CheckCircle2 size={11} className="text-gray-500" /> Completed</span>
        <span className="flex items-center gap-1"><AlertTriangle size={11} className="text-red-500" /> Bottleneck</span>
        <span className="text-ink-faint/70">· Hover any truck for details</span>
      </div>

      <TruckTooltip anchorRect={hover?.rect} details={hoverDetails} />
    </div>
  );
}
