import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Wrench, ShieldAlert, Search, Navigation, Truck,
  CheckCircle2, Clock, AlertTriangle, Hammer, Gauge, Zap, Flame, Disc,
  ZoomIn, ZoomOut, Maximize2,
} from 'lucide-react';
import { LAYOUTS, computeZonePositions, pathIntoBay, pathOutOfBay, accessStub, BAY_W, BAY_H } from '../../lib/floorLayouts.js';
import { TRUCK_STATE_COLOR, BAY_STATUS_COLOR, DEPT_BOTTLENECK_COLOR, BAY_BOTTLENECK_COLOR, hexToRgba } from '../../lib/styleMaps.js';
import { getTruckDetails } from '../../engine/frameSelectors.js';
import { DEPT_KEYS, DEPT_NAMES } from '../../engine/desEngine.js';
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

/** A gentle "standard" ease curve (accelerate out of a stop, decelerate into
 *  the next one) used for every traveling-truck position/rotation keyframe
 *  animation — replaces the flatter default 'easeInOut' timing with a
 *  slightly more natural-feeling glide. Purely a timing-curve change: the
 *  underlying keyframe arrays (path positions + headings) that drive the
 *  animation are untouched. */
const TRAVEL_EASE = [0.4, 0, 0.2, 1];

/** Minimum floor-plan zoom level at which the traveling-truck ID label is
 *  drawn above its icon. Below this the labels are hidden so a zoomed-out
 *  view of the whole floor doesn't get cluttered with dozens of tiny,
 *  unreadable numbers — zooming back in brings them back. */
const LABEL_MIN_ZOOM = 0.85;
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.18;

/** Two colorways for the top-view truck icon — "entering" trucks (still
 *  allocated/in-transit toward a bay) get the same orange used elsewhere for
 *  "allocated", "exiting" trucks (heading back out to EXIT) get the same
 *  gray used for "completed" — matching the existing traveler color coding,
 *  just applied to a real vehicle silhouette instead of a flat rounded
 *  rectangle. */
const TRUCK_ICON_VARIANTS = [
  { id: 'truckIconEnter', body: '#ea580c', cab: '#9a3412' },
  { id: 'truckIconExit', body: '#9ca3af', cab: '#6b7280' },
];

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
function computeFlowArrows(points, spacing = 160) {
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

/** One entry in the "Bottleneck colors" legend — a small colored dot plus
 *  its label. Purely presentational; `color` is always a hex string from
 *  either `BAY_BOTTLENECK_COLOR` or `DEPT_BOTTLENECK_COLOR`. */
function BottleneckSwatch({ color, label }) {
  return (
    <span className="flex items-center gap-1">
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

/** Bounding band behind every bay in a zone — the tinted "service area"
 *  rectangle that makes Standard / Dedicated / Inspection read as three
 *  clearly separated, aligned areas rather than loose points. Sized off the
 *  zone's actual rendered bay footprint (`footprint` — full-size card,
 *  shrunk card, or node marker, from `bayRenderPlan`) rather than a
 *  hardcoded card size, so the band hugs the bays tightly whichever mode
 *  they're rendering in, instead of leaving a loose, oversized band around
 *  small shrunk cards or nodes. */
function zoneBand(zone, positions, footprint) {
  if (!positions.length) return null;
  const { w, h } = footprint;
  const pad = 16;
  if (zone.axis === 'x') {
    const xs = positions.map((p) => p.x);
    const y = zone.corridor + zone.dock;
    return { x: Math.min(...xs) - w / 2 - pad, y: y - h / 2 - pad, w: Math.max(...xs) - Math.min(...xs) + w + pad * 2, h: h + pad * 2 };
  }
  const ys = positions.map((p) => p.y);
  const x = zone.corridor + zone.dock;
  return { x: x - w / 2 - pad, y: Math.min(...ys) - h / 2 - pad, w: w + pad * 2, h: Math.max(...ys) - Math.min(...ys) + h + pad * 2 };
}

/* Note on why bays and traveling trucks are positioned the way they are
 * below: Framer Motion only recognizes a fixed list of SVG tag names as
 * "SVG components" it can write native attributes onto (rect, circle, g,
 * text, line, path, polygon, etc. — see framer-motion's own
 * `lowercaseSVGElements`). `foreignObject` is NOT in that list, so
 * `motion.foreignObject`'s animated `x`/`y` silently do nothing and the
 * element renders at its default (0,0) — every bay card and every
 * traveling truck collapsed onto the entry gate. Fixed by: (1) bay cards
 * now sit inside a *plain* (non-motion) `<g transform="translate(x y)">`
 * — a raw SVG transform ATTRIBUTE, unambiguous user-space units, with a
 * CSS `transition` on `transform` for the glide, exactly like the
 * already-working flow-arrow `<g>`s a few lines up — with a static,
 * never-animated `<foreignObject>` nested inside it for the rich HTML
 * card; (2) traveling trucks are pure `motion.rect`/`motion.text`, which
 * — like the bay rects — DO have native x/y and are proven safe for
 * Framer's keyframe-array position + rotation animation. */

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
  const [zoom, setZoom] = useState(1);
  const svgWrapRef = useRef(null);

  const clampZoom = (z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
  const zoomIn = () => setZoom((z) => clampZoom(z + ZOOM_STEP));
  const zoomOut = () => setZoom((z) => clampZoom(z - ZOOM_STEP));
  const zoomReset = () => setZoom(1);

  // Wired up as a native (non-passive) listener rather than React's onWheel
  // prop — React attaches wheel handlers passively by default (to keep page
  // scroll performant), which silently ignores preventDefault() and lets the
  // page scroll along with the zoom. A manual, explicitly non-passive
  // listener is the standard fix.
  useEffect(() => {
    const el = svgWrapRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      setZoom((z) => clampZoom(z + (e.deltaY > 0 ? -1 : 1) * (ZOOM_STEP / 2)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const zonePositions = useMemo(() => {
    if (!frame) return { Bu: [], Be: [], Bi: [] };
    const out = {};
    ZONE_ORDER.forEach((z) => {
      const ids = frame.bays[z].map((b) => b.id);
      out[z] = computeZonePositions(layout, z, ids);
    });
    return out;
  }, [frame, layout]);

  // How to render each zone's bays — full-size workstation card, a
  // proportionally shrunk card, or a compact node marker — decided purely
  // from bay count vs. available rail space (see bayRenderPlan). Recomputed
  // whenever the configured bay count or layout shape changes; every bay in
  // a zone shares the same plan since they're always evenly spaced.
  const zonePlans = useMemo(() => {
    if (!frame) return { Bu: null, Be: null, Bi: null };
    const out = {};
    ZONE_ORDER.forEach((z) => {
      out[z] = bayRenderPlan(layout.zones[z], frame.bays[z].length);
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

  // Zoom is implemented as a centered sub-rectangle of the base viewBox —
  // shrinking/growing the box the same coordinate system maps into, rather
  // than a CSS transform on the SVG itself, so every already-positioned
  // element (bays, corridor, traveling trucks) stays perfectly aligned at
  // any zoom level with no extra bookkeeping.
  const vbW = width / zoom, vbH = height / zoom;
  const viewBox = `${(width - vbW) / 2} ${(height - vbH) / 2} ${vbW} ${vbH}`;
  const showTruckLabels = zoom >= LABEL_MIN_ZOOM;

  // Bays currently the *destination* of an in-flight "enter" trip — these
  // get the "reserved" (blue) treatment and a pulsing highlight ring, since
  // the engine has already allocated them but the truck hasn't visually
  // arrived yet.
  const approachingKeys = new Set(
    travelers.filter((t) => t.kind === 'enter').map((t) => `${t.zoneKey}:${t.bay.id}`),
  );

  const bottleneckZone = ZONE_ORDER.find((z) => frame.bottleneck?.label === BOTTLENECK_LABEL_BY_ZONE[z]);

  // When the current system bottleneck is a worker department (not a bay
  // type), individual occupied bays whose job needs that department get
  // re-colored to the department's own bottleneck color below — see the
  // workstation-card rendering loop. This is separate from `bottleneckZone`
  // above (bay-type bottlenecks, which keep their existing red zone-band
  // highlight untouched) since a department shortage doesn't affect every
  // bay in a zone, only the ones whose job actually needs that department.
  const deptBnKey = frame.bottleneck?.kind === 'dept' ? frame.bottleneck.key : null;

  const hoverDetails = hover && result ? getTruckDetails(result, hover.truckId, frame.t) : null;

  return (
    <div className="rounded-lg border border-line bg-surface-soft p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[12px] font-bold uppercase tracking-wide text-ink-soft">Spatial Floor Plan — Digital Twin</div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-full border border-line bg-white p-0.5">
            <button type="button" onClick={zoomOut} title="Zoom out" className="rounded-full p-1.5 text-ink-faint transition-colors hover:bg-surface-soft hover:text-ink">
              <ZoomOut size={13} />
            </button>
            <span className="min-w-[34px] px-0.5 text-center text-[10.5px] font-semibold tabular-nums text-ink-soft">{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={zoomIn} title="Zoom in" className="rounded-full p-1.5 text-ink-faint transition-colors hover:bg-surface-soft hover:text-ink">
              <ZoomIn size={13} />
            </button>
            <button type="button" onClick={zoomReset} title="Reset zoom" className="rounded-full p-1.5 text-ink-faint transition-colors hover:bg-surface-soft hover:text-ink">
              <Maximize2 size={12} />
            </button>
          </div>
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
      </div>

      <div ref={svgWrapRef} className="w-full overflow-hidden rounded-md border border-line bg-white">
        <svg viewBox={viewBox} className="h-auto w-full" style={{ maxHeight: 620 }}>
          <defs>
            <pattern id="floorTexture" width={28} height={28} patternUnits="userSpaceOnUse">
              <rect width={28} height={28} fill="#fbfcfe" />
              <circle cx={1} cy={1} r={1} fill="#eef1f6" />
            </pattern>
            {/* Drop shadow for traveling trucks — a soft, subtle blur offset
                downward, giving the floating truck icon a sense of hovering
                just above the floor surface as it moves. */}
            <filter id="truckShadow" x="-75%" y="-75%" width="250%" height="250%">
              <feDropShadow dx="0" dy="1.3" stdDeviation="1.1" floodColor="#0f172a" floodOpacity="0.32" />
            </filter>
            {/* Top-view truck icon (cargo bed + cab + wheels + windshield),
                one colorway per travel direction. `patternUnits="objectBoundingBox"`
                ties the tile to whichever shape references it (here, the
                traveling truck's own motion.rect) at exactly 0..1 of its own
                width/height, so the icon always covers that rect's full,
                current on-screen box regardless of where the rect has been
                translated to — no manual coordinate math needed as it moves. */}
            {TRUCK_ICON_VARIANTS.map((v) => (
              <pattern key={v.id} id={v.id} patternUnits="objectBoundingBox" x={0} y={0} width={1} height={1} viewBox={`0 0 ${TRUCK_W} ${TRUCK_H}`} preserveAspectRatio="none">
                {/* cargo bed / trailer (rear) */}
                <rect x={1} y={3} width={19} height={11} rx={1.5} fill={v.body} />
                {/* car-carrier deck rail accents */}
                <line x1={6} y1={3.5} x2={6} y2={13.5} stroke="rgba(255,255,255,0.32)" strokeWidth={1} />
                <line x1={13} y1={3.5} x2={13} y2={13.5} stroke="rgba(255,255,255,0.32)" strokeWidth={1} />
                {/* cab (front — faces heading 0 / east, matching headingFromDelta's convention) */}
                <rect x={20} y={1.5} width={8.5} height={14} rx={2} fill={v.cab} />
                <rect x={21} y={2.5} width={4} height={1} rx={0.5} fill="rgba(255,255,255,0.3)" />
                {/* windshield */}
                <rect x={25.2} y={3.5} width={2.4} height={10} rx={1} fill="#dbeafe" fillOpacity={0.9} />
                {/* wheels */}
                <rect x={5} y={0.6} width={3.5} height={2} rx={0.8} fill="#1f2937" />
                <rect x={5} y={14.4} width={3.5} height={2} rx={0.8} fill="#1f2937" />
                <rect x={16} y={0.6} width={3.5} height={2} rx={0.8} fill="#1f2937" />
                <rect x={16} y={14.4} width={3.5} height={2} rx={0.8} fill="#1f2937" />
              </pattern>
            ))}
          </defs>
          {/* Subtle industrial floor texture */}
          <rect x={0} y={0} width={width} height={height} fill="url(#floorTexture)" />

          {/* Zone service-area bands, drawn first (under everything else) */}
          {ZONE_ORDER.map((zoneKey) => {
            const band = zoneBand(layout.zones[zoneKey], zonePositions[zoneKey], zonePlans[zoneKey]);
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

          {/* Corridor — a much wider, layered road: a soft outer shoulder,
              a solid asphalt surface, and a bolder dashed center line, drawn
              widest-to-narrowest so each layer peeks out from the one
              beneath it. This is purely a wider/cleaner restyle of the same
              `layout.drawPath` every zone's `dock` clearance was already
              sized generously around (see floorLayouts.js) — no coordinates
              changed, just how thick and how many layers draw the road. */}
          <motion.path
            key={`corridor-shoulder-${shape}`}
            d={layout.drawPath}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={64}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35 }}
          />
          <motion.path
            key={`corridor-${shape}`}
            d={layout.drawPath}
            fill="none"
            stroke="#b7c2cf"
            strokeWidth={50}
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
            strokeWidth={3}
            strokeDasharray="11 13"
            strokeLinecap="round"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35 }}
          />

          {/* Directional flow-arrow markers along the corridor, sized and
              spaced up to match the wider road above. */}
          {flowArrows.map((a) => (
            <g key={`arrow-${shape}-${a.key}`} transform={`translate(${a.x} ${a.y}) rotate(${a.rotation})`} opacity={0.7}>
              <path d="M -9 -7 L 10 0 L -9 7 Z" fill="#94a3b8" />
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

          {/* Access lanes + parking-stall outline + workstation cards (or,
              for zones with too many bays to fit full cards — see
              bayRenderPlan in floorLayouts.js — a shrunk card or a compact
              road-side node + connector instead). */}
          {ZONE_ORDER.map((zoneKey) => {
            const zone = layout.zones[zoneKey];
            const meta = ZONE_META[zoneKey];
            const TypeIcon = meta.icon;
            const plan = zonePlans[zoneKey] || { mode: 'card', scale: 1, w: BAY_W, h: BAY_H };
            return zonePositions[zoneKey].map((pos) => {
              const bay = frame.bays[zoneKey].find((b) => b.id === pos.id);
              const busy = bay?.status === 'busy';
              const approaching = approachingKeys.has(`${zoneKey}:${pos.id}`);
              const statusKey = !busy ? 'available' : approaching ? 'reserved' : 'busy';
              // If this bay's active job needs workers from the department
              // that's currently the system's bottleneck, its card takes on
              // that department's color instead of the normal busy/orange —
              // pinpointing exactly which occupied bays are being held up by
              // the worker shortage (not every bay of that type).
              const deptBn = busy && deptBnKey && bay.req?.[deptBnKey] > 0;
              const dc = deptBn ? DEPT_BOTTLENECK_COLOR[deptBnKey] : null;
              const sc = dc ? { hex: dc.hex, fill: dc.fill, stroke: dc.stroke, label: `${DEPT_NAMES[deptBnKey]} Shortage` } : BAY_STATUS_COLOR[statusKey];
              const stub = accessStub(layout, zoneKey, pos);
              // Effective on-screen footprint for this zone's mode (full
              // card, shrunk card, or node) — every decoration below (access
              // lane length, parking outline, pulse rings) is sized off
              // this instead of the fixed BAY_W/BAY_H, so it always hugs
              // whatever is actually being rendered.
              const rx = pos.x - plan.w / 2, ry = pos.y - plan.h / 2;
              const workers = busy && bay.req
                ? DEPT_KEYS.filter((k) => bay.req[k] > 0).map((k) => [k, bay.req[k]])
                : [];
              const isNode = plan.mode === 'node';

              return (
                <React.Fragment key={pos.id}>
                  {/* Access lane (driveway) connecting the corridor to the
                      bay — kept in every mode, including node mode, so a
                      node marker always still reads as "attached to the
                      road" rather than a floating dot. */}
                  <motion.line
                    stroke="#cbd5e1"
                    strokeWidth={isNode ? 5 : 10}
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
                  {/* Reserved pulse ring (bay allocated, truck still in transit) */}
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
                  {/* Worker-department bottleneck pulse ring, in that
                      department's own color from the color-coded bottleneck
                      system (see legend below). */}
                  {deptBn && (
                    <motion.rect
                      rx={10}
                      fill="none"
                      stroke={dc.hex}
                      strokeWidth={2.5}
                      animate={{ x: rx - 4, y: ry - 4, width: BAY_W + 8, height: BAY_H + 8, opacity: [0.9, 0.2, 0.9] }}
                      transition={{ x: { duration: 0.5 }, y: { duration: 0.5 }, width: { duration: 0.5 }, height: { duration: 0.5 }, opacity: { duration: 1.1, repeat: Infinity, ease: 'easeInOut' } }}
                    />
                  )}

                  {isNode ? (
                    <>
                      {/* Compact road-side node marker — replaces the full
                          workstation card once this zone has too many bays
                          for even a shrunk card to fit without overlapping
                          its neighbor. Same status color as the card would
                          use; hover still opens the same truck detail
                          tooltip when occupied. */}
                      {(approaching || deptBn) && (
                        <motion.circle
                          cx={pos.x}
                          cy={pos.y}
                          fill="none"
                          stroke={deptBn ? dc.hex : BAY_STATUS_COLOR.reserved.hex}
                          strokeWidth={2}
                          animate={{ r: plan.w / 2 + 4, opacity: [0.9, 0.2, 0.9] }}
                          transition={{ r: { duration: 0.5 }, opacity: { duration: 1.1, repeat: Infinity, ease: 'easeInOut' } }}
                        />
                      )}
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={plan.w / 2}
                        fill={sc.hex}
                        stroke="#ffffff"
                        strokeWidth={1.5}
                        style={{ cursor: busy ? 'pointer' : 'default' }}
                        onMouseEnter={busy ? showHover(bay.truckId) : undefined}
                        onMouseLeave={busy ? clearHover : undefined}
                      >
                        <title>{`Bay ${pos.id} — ${sc.label}${busy ? ` — #${bay.truckId}` : ''}`}</title>
                      </circle>
                      {plan.w >= 11 && (
                        <text
                          x={pos.x}
                          y={pos.y + plan.w / 2 + 8}
                          textAnchor="middle"
                          fontSize={7}
                          fontWeight={700}
                          fill="#64748b"
                          pointerEvents="none"
                        >
                          {pos.id}
                        </text>
                      )}
                    </>
                  ) : (
                    <>
                      {/* Parking-stall dashed outline, slightly larger than the card */}
                      <motion.rect
                        rx={8}
                        fill="none"
                        stroke="#cbd5e1"
                        strokeWidth={1}
                        strokeDasharray="3 3"
                        animate={{ x: rx - 6, y: ry - 6, width: plan.w + 12, height: plan.h + 12 }}
                        transition={{ duration: 0.5, ease: 'easeInOut' }}
                      />
                      {/* Reserved pulse ring (bay allocated, truck still in transit) */}
                      {(approaching) && (
                        <motion.rect
                          rx={10}
                          fill="none"
                          stroke={BAY_STATUS_COLOR.reserved.hex}
                          strokeWidth={2.5}
                          animate={{ x: rx - 4, y: ry - 4, width: plan.w + 8, height: plan.h + 8, opacity: [0.85, 0.15, 0.85] }}
                          transition={{ x: { duration: 0.5 }, y: { duration: 0.5 }, width: { duration: 0.5 }, height: { duration: 0.5 }, opacity: { duration: 1.1, repeat: Infinity, ease: 'easeInOut' } }}
                        />
                      )}
                      {/* Worker-department bottleneck pulse ring, in that
                          department's own color from the color-coded bottleneck
                          system (see legend below). */}
                      {deptBn && (
                        <motion.rect
                          rx={10}
                          fill="none"
                          stroke={dc.hex}
                          strokeWidth={2.5}
                          animate={{ x: rx - 4, y: ry - 4, width: plan.w + 8, height: plan.h + 8, opacity: [0.9, 0.2, 0.9] }}
                          transition={{ x: { duration: 0.5 }, y: { duration: 0.5 }, width: { duration: 0.5 }, height: { duration: 0.5 }, opacity: { duration: 1.1, repeat: Infinity, ease: 'easeInOut' } }}
                        />
                      )}

                      {/* Workstation card — plain SVG `transform` attribute on a
                          non-motion `<g>` (unambiguous user-space units, CSS-
                          transitioned for the glide) wrapping a static,
                          never-animated `<foreignObject>`. See the note above
                          `ZONE_ORDER.map` for why this avoids motion.foreignObject.
                          The card's own internal markup/content is always laid
                          out at its native BAY_W x BAY_H size — when this zone's
                          plan calls for a shrunk card (`plan.scale < 1`), the
                          whole group is uniformly scaled down around the bay's
                          center point instead, so nothing inside the card (text,
                          icons, layout) needs its own separate "shrunk" styling. */}
                      <g
                        transform={`translate(${pos.x} ${pos.y}) scale(${plan.scale}) translate(${-BAY_W / 2} ${-BAY_H / 2})`}
                        style={{ transition: 'transform 0.5s ease-in-out', cursor: busy ? 'pointer' : 'default' }}
                        onMouseEnter={busy ? showHover(bay.truckId) : undefined}
                        onMouseLeave={busy ? clearHover : undefined}
                      >
                      <foreignObject width={BAY_W} height={BAY_H} style={{ overflow: 'visible' }}>
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
                                <span className="flex items-center gap-[2px] font-bold leading-tight text-ink" style={{ fontSize: 8 }}>
                                  <Truck size={8} strokeWidth={2.5} /> #{bay.truckId} · {bay.vehicleType}
                                </span>
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
                      </foreignObject>
                      </g>
                    </>
                  )}
                </React.Fragment>
              );
            });
          })}

          {/* Zone section labels, with bay counts */}
          {ZONE_ORDER.map((zoneKey) => {
            const band = zoneBand(layout.zones[zoneKey], zonePositions[zoneKey], zonePlans[zoneKey]);
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

          {/* Trucks actively traveling the corridor — direction-following
              glyph. `motion.rect` (not foreignObject or `g` — see the note
              above) has native x/y, so its position keyframes track the SVG
              exactly; `rotate` is a pure CSS rotation with no translation
              mixed in, which Framer computes around the rect's own
              geometric center automatically, so heading and position stay
              in sync through every corner. This is unchanged from before —
              the only difference is the rect's `fill` now references a
              top-view truck icon pattern (see `<defs>` above) instead of a
              flat color, so the exact same proven position/rotation
              mechanism now carries a real vehicle silhouette. */}
          {travelers.map((trip) => {
            const iconId = trip.kind === 'enter' ? 'truckIconEnter' : 'truckIconExit';
            const duration = trip.kind === 'enter' ? ENTER_DURATION : EXIT_DURATION;
            return (
              <React.Fragment key={`trip-${trip.tripId}`}>
                <motion.rect
                  width={TRUCK_W}
                  height={TRUCK_H}
                  rx={3}
                  fill={`url(#${iconId})`}
                  filter="url(#truckShadow)"
                  initial={{ x: trip.path[0].x - TRUCK_W / 2, y: trip.path[0].y - TRUCK_H / 2, rotate: trip.rot[0] }}
                  animate={{
                    x: trip.path.map((p) => p.x - TRUCK_W / 2),
                    y: trip.path.map((p) => p.y - TRUCK_H / 2),
                    rotate: trip.rot,
                  }}
                  transition={{ duration, ease: TRAVEL_EASE }}
                  onAnimationComplete={() => handleTripComplete(trip)}
                  className="cursor-pointer"
                  onMouseEnter={showHover(trip.truckId)}
                  onMouseLeave={clearHover}
                />
                {showTruckLabels && (
                  <motion.text
                    textAnchor="middle"
                    fontSize={9}
                    fontWeight={700}
                    fill="#334155"
                    pointerEvents="none"
                    initial={{ x: trip.path[0].x, y: trip.path[0].y - TRUCK_H / 2 - 6 }}
                    animate={{
                      x: trip.path.map((p) => p.x),
                      y: trip.path.map((p) => p.y - TRUCK_H / 2 - 6),
                    }}
                    transition={{ duration, ease: TRAVEL_EASE }}
                  >
                    #{trip.truckId}
                  </motion.text>
                )}
              </React.Fragment>
            );
          })}
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

      {/* Color-coded bottleneck legend — a bay-type shortage (Standard/
          Dedicated/Inspection running out of physical bays) always shows in
          the same red used above; a worker-department shortage instead
          colors the affected bays and every "Bottleneck" indicator in that
          department's own unique color, so the *cause* of a slowdown is
          identifiable at a glance without reading any text. */}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-line bg-white px-2.5 py-1.5 text-[10px] text-ink-faint">
        <span className="font-bold uppercase tracking-wide text-ink-soft">Bottleneck colors</span>
        <BottleneckSwatch color={BAY_BOTTLENECK_COLOR.hex} label="Bay capacity (any type)" />
        {DEPT_KEYS.map((k) => (
          <BottleneckSwatch key={k} color={DEPT_BOTTLENECK_COLOR[k].hex} label={DEPT_NAMES[k]} />
        ))}
      </div>

      <TruckTooltip anchorRect={hover?.rect} details={hoverDetails} />
    </div>
  );
}
