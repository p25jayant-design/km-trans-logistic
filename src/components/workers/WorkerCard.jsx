import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wrench, Hammer, Gauge, Zap, Flame, Disc, User, Users,
  ChevronDown, Moon, Flame as OverloadIcon, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import { utilTone, DEPT_BOTTLENECK_COLOR, BAY_BOTTLENECK_COLOR, hexToRgba } from '../../lib/styleMaps.js';
import Badge from '../ui/Badge.jsx';
import AnimatedNumber from '../ui/AnimatedNumber.jsx';

const DEPT_ICON = { mech: Wrench, dent: Hammer, bal: Gauge, elec: Zap, weld: Flame, tire: Disc };
const BAR_COLOR = { green: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-500' };

/** Classifies a department purely from its already-computed busy/total/
 *  utilization numbers — no new calculations, just labeling the existing
 *  values. The engine never lets deptBusy exceed deptAvail, so "overloaded"
 *  here means sustained heavy load (>=85% busy) rather than literal
 *  over-capacity — the same 85% threshold already used elsewhere
 *  (utilTone / bottleneck detection) for consistency. */
function classify(dept) {
  if (dept.total === 0) return 'empty';
  if (dept.busy === 0) return 'idle';
  if (dept.busy === dept.total) return 'full';
  if (dept.utilization >= 0.85) return 'overloaded';
  return 'normal';
}

// Fixed (non-bottleneck) card states keep their original blue/amber/red
// tailwind-matched hexes (blue-300 / amber-400 / red-400) — only the
// *bottleneck* state's color is dynamic (per department), so every state
// is expressed the same way (a hex, applied via inline style) rather than
// mixing static Tailwind color classes with dynamic inline colors on the
// same element.
const STATE_STYLE = {
  idle: { hex: '#93c5fd', tag: 'blue', label: 'Idle', icon: Moon },
  full: { hex: '#fbbf24', tag: 'amber', label: 'Fully Occupied', icon: CheckCircle2 },
  overloaded: { hex: '#f87171', tag: 'red', label: 'Overloaded', icon: OverloadIcon },
  normal: { hex: null, tag: null, label: null, icon: null },
  empty: { hex: null, tag: null, label: null, icon: null },
};

/** An interactive department card: icon, busy/available/total headcounts,
 *  utilization badge + smoothly animated bar, small worker avatars, and a
 *  highlighted state (idle / fully occupied / overloaded / the system's
 *  current bottleneck). Click to expand the roster's skill composition
 *  (High/Med/Low/Absent — read directly from the run's config, display-
 *  only). All numbers are read as-is from `dept`/`roster`; nothing here
 *  recomputes anything.
 *
 *  When this department IS the current bottleneck, the card's left stripe,
 *  background tint and ring switch to that department's own unique color
 *  from the color-coded bottleneck system (see lib/styleMaps.js) instead of
 *  a generic red — so "which department is slowing things down" is
 *  identifiable at a glance and matches the same color used for it on the
 *  floor plan and in the legend. */
export default function WorkerCard({ dept, roster, isBottleneck }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = DEPT_ICON[dept.key] || User;
  const tone = utilTone(dept.utilization);
  const dots = Math.min(dept.total, 12);
  const state = classify(dept);
  const bnColor = DEPT_BOTTLENECK_COLOR[dept.key] || BAY_BOTTLENECK_COLOR;
  const baseStyle = STATE_STYLE[state];
  const activeHex = isBottleneck ? bnColor.hex : baseStyle.hex;
  const activeLabel = isBottleneck ? `Bottleneck · ${dept.name}` : baseStyle.label;
  const StateIcon = isBottleneck ? AlertTriangle : baseStyle.icon;

  return (
    <motion.div
      layout
      whileHover={{ y: -2 }}
      onClick={() => setExpanded((v) => !v)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpanded((v) => !v); }}
      style={{
        borderLeftColor: activeHex || undefined,
        backgroundColor: activeHex ? hexToRgba(activeHex, isBottleneck ? 0.07 : 0.05) : undefined,
        boxShadow: isBottleneck ? `0 0 0 2px #ffffff, 0 0 0 4px ${hexToRgba(activeHex, 0.55)}` : undefined,
      }}
      className={`cursor-pointer select-none rounded-lg border border-l-4 border-line p-3 shadow-sm transition-shadow hover:shadow-cardHover ${
        activeHex ? '' : 'bg-surface-soft'
      } ${isBottleneck ? 'ring-offset-2 ring-offset-surface' : ''}`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
          <Icon size={14} className="text-brand-600" /> {dept.name}
        </div>
        <div className="flex items-center gap-1.5">
          {activeLabel && (
            isBottleneck ? (
              <Badge
                tone="neutral"
                icon={StateIcon}
                pulse
                style={{ background: hexToRgba(bnColor.hex, 0.12), color: bnColor.hex, borderColor: hexToRgba(bnColor.hex, 0.45) }}
              >
                {activeLabel}
              </Badge>
            ) : (
              <Badge tone={baseStyle.tag} icon={StateIcon}>{activeLabel}</Badge>
            )
          )}
          <Badge tone={tone}>
            <AnimatedNumber value={dept.utilization * 100} decimals={0} suffix="%" />
          </Badge>
        </div>
      </div>

      <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <motion.div
          className={`h-full rounded-full ${BAR_COLOR[tone]}`}
          animate={{ width: `${dept.utilization * 100}%` }}
          transition={{ ease: 'easeOut', duration: 0.4 }}
        />
      </div>

      <div className="grid grid-cols-3 gap-1.5 text-center text-[10.5px]">
        <div className="rounded-md bg-white/70 py-1">
          <div className="font-bold text-orange-600">{dept.busy}</div>
          <div className="text-ink-faint">Busy</div>
        </div>
        <div className="rounded-md bg-white/70 py-1">
          <div className="font-bold text-emerald-600">{dept.available}</div>
          <div className="text-ink-faint">Available</div>
        </div>
        <div className="rounded-md bg-white/70 py-1">
          <div className="flex items-center justify-center gap-0.5 font-bold text-ink">
            <Users size={10} /> {dept.total}
          </div>
          <div className="text-ink-faint">Total</div>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1">
        {Array.from({ length: dots }).map((_, i) => (
          <User key={i} size={11} className={i < dept.busy ? 'text-orange-500' : 'text-emerald-500'} />
        ))}
        {dept.total > 12 && <span className="text-[10px] text-ink-faint">+{dept.total - 12}</span>}
        <ChevronDown
          size={13}
          className={`ml-auto text-ink-faint transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </div>

      <AnimatePresence initial={false}>
        {expanded && roster && (
          <motion.div
            initial={{ height: 0, opacity: 0, marginTop: 0 }}
            animate={{ height: 'auto', opacity: 1, marginTop: 8 }}
            exit={{ height: 0, opacity: 0, marginTop: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="rounded-md border border-line bg-white/80 p-2 text-[10.5px]">
              <div className="mb-1 font-bold uppercase tracking-wide text-ink-faint">Roster composition</div>
              <div className="grid grid-cols-3 gap-1.5 text-center">
                <div><div className="font-bold text-ink">{roster.high}</div><div className="text-ink-faint">High skill</div></div>
                <div><div className="font-bold text-ink">{roster.med}</div><div className="text-ink-faint">Med skill</div></div>
                <div><div className="font-bold text-ink">{roster.low}</div><div className="text-ink-faint">Low skill</div></div>
              </div>
              <div className="mt-1.5 text-center text-ink-faint">
                {roster.total} on roster · {Math.round(roster.absent * 100)}% typical absenteeism
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
