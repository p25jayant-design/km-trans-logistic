import { useCallback, useEffect, useRef, useState } from 'react';
import { simulate, computeUtilSeries, computeFlowTimeSeries, DEFAULT_DEPTS } from '../engine/desEngine.js';
import { buildFrame, buildFullKpiSeries, computeDaySummary, computeCategoryFlowTimeSeries } from '../engine/frameSelectors.js';

export const DEFAULT_CONFIG = {
  horizonDays: 30,
  carCarrierPct: 0.4,
  bays: { Bu: 8, Be: 0, Bi: 1 },
  departments: JSON.parse(JSON.stringify(DEFAULT_DEPTS)),
  policy: 'hybrid',
  fixedSeed: true,
  seed: 42,
  // Fraction (0-1) of the combined Accident Repair + Standard-job arrival
  // pool that arrives as Accident Repair — see the comment above
  // ACCIDENT_STANDARD_POOL_RATE in desEngine.js for exactly what this does
  // and doesn't affect. Default = 40%, per spec.
  accidentPct: 0.4,
};

/** Discrete playback-speed levels, in simulated minutes advanced per real
 *  second. Slider-driven: index 0 is the slowest (30 min/sec), the last
 *  entry is the fastest (30 days/sec). */
export const SPEED_LEVELS = [
  { value: 30, label: '30 min / sec' },
  { value: 60, label: '1 hr / sec' },
  { value: 120, label: '2 hr / sec' },
  { value: 240, label: '4 hr / sec' },
  { value: 480, label: '8 hr / sec' },
  { value: 720, label: '12 hr / sec' },
  { value: 1440, label: '1 day / sec' },
  { value: 2880, label: '2 days / sec' },
  { value: 5760, label: '4 days / sec' },
  { value: 10080, label: '7 days / sec' },
  { value: 14400, label: '10 days / sec' },
  { value: 28800, label: '20 days / sec' },
  { value: 43200, label: '30 days / sec' },
];

/** Drives the whole dashboard: holds config, runs the (unmodified) DES engine,
 *  and plays back the precomputed result over simulated time. */
export function useSimulation() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [result, setResult] = useState(null);
  const [frame, setFrame] = useState(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1440);
  const [status, setStatus] = useState('idle'); // idle | ready | running | complete

  // Day-completion overlay: `dayComplete` holds { dayIndex, summary } for
  // the day the playback loop below just paused at, or null when no
  // overlay should show. `shownDayBoundariesRef` remembers which day
  // boundaries (1-based boundary index, i.e. 1 = t=1440, 2 = t=2880, ...)
  // have already triggered their overlay for the *current* result, so
  // playing forward through the same point twice (e.g. after scrubbing
  // back) doesn't re-pop it — only a fresh Run Simulation or an explicit
  // Reset-to-day-1 clears it, since those are the two actions that mean
  // "start the playthrough over".
  const [dayComplete, setDayComplete] = useState(null);
  const shownDayBoundariesRef = useRef(new Set());

  const rafRef = useRef(null);
  const lastTsRef = useRef(null);
  const tRef = useRef(0);
  const statusRef = useRef(status);
  statusRef.current = status;

  const applyTime = useCallback((newT) => {
    if (!result) return;
    const clamped = Math.max(0, Math.min(result.totalDuration, newT));
    tRef.current = clamped;
    setT(clamped);
    setFrame(buildFrame(result, clamped));
    // Any manual time jump (scrub, jump-to-end, or reset-to-day-1) dismisses
    // whatever day-complete overlay might currently be showing — it
    // described a moment in time the user just navigated away from.
    setDayComplete(null);
  }, [result]);

  const runSimulation = useCallback((cfgOverride) => {
    const cfg = cfgOverride || config;
    const r = simulate(cfg);
    r.util = computeUtilSeries(r, 150);
    r.kpiSeries = buildFullKpiSeries(r, 120);
    r.flow = computeFlowTimeSeries(r, 150);
    // Same sampleTimes grid (numPoints=150) as r.flow above, grouped by
    // Accident Repair / Standard / All Jobs instead of by individual job
    // type — powers the Flow Time Analysis page's new category dropdown.
    r.flowByCategory = computeCategoryFlowTimeSeries(r, 150);
    setResult(r);
    tRef.current = 0;
    setT(0);
    setFrame(buildFrame(r, 0));
    setPlaying(false);
    setStatus('ready');
    shownDayBoundariesRef.current = new Set();
    setDayComplete(null);
    return r;
  }, [config]);

  const play = useCallback(() => { if (result) setPlaying(true); }, [result]);
  const pause = useCallback(() => setPlaying(false), []);
  const reset = useCallback(() => {
    setPlaying(false);
    applyTime(0);
    setStatus('ready');
    // Rewinding to day 1 is the "start the playthrough over" action, so
    // every day's overlay is allowed to fire again on the next play-through
    // — unlike scrubTo/jumpToEnd below, which only dismiss whatever overlay
    // is showing right now without resetting which days have been seen.
    shownDayBoundariesRef.current = new Set();
  }, [applyTime]);
  const jumpToEnd = useCallback(() => {
    if (!result) return;
    setPlaying(false);
    applyTime(result.totalDuration);
    setStatus('complete');
  }, [result, applyTime]);
  const scrubTo = useCallback((fraction) => {
    if (!result) return;
    setPlaying(false);
    applyTime(fraction * result.totalDuration);
  }, [result, applyTime]);

  // Dismisses the day-complete overlay and resumes playback — the "Continue"
  // path out of the overlay, whether triggered automatically (a countdown
  // timer inside the overlay component itself) or by the user clicking a
  // button. Playback resumes at exactly the day boundary it paused at,
  // continuing on to look for the *next* unshown boundary.
  const continueAfterDayComplete = useCallback(() => {
    setDayComplete(null);
    if (result) setPlaying(true);
  }, [result]);

  useEffect(() => {
    if (!playing || !result) return;
    lastTsRef.current = null;
    const horizonMinutes = result.horizonMinutes ?? result.totalDuration;
    function loop(ts) {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dtMs = ts - lastTsRef.current;
      lastTsRef.current = ts;
      const prevT = tRef.current;
      let next = prevT + (dtMs / 1000) * speed;

      // Day-completion pause: find the first day boundary (a multiple of
      // 1440, within the configured horizon) strictly after `prevT` that
      // hasn't triggered its overlay yet. If this frame's advance would
      // carry playback past it, stop exactly there instead — mirrors how
      // the totalDuration clamp below stops exactly at the end of the run
      // rather than overshooting past it. Only ever the *first* unshown
      // boundary is considered, so even a large dtMs (a lagged frame, a
      // backgrounded tab) can't skip an overlay by jumping past more than
      // one day boundary in a single step.
      const boundaryIdx = Math.floor(prevT / 1440) + 1;
      const boundaryT = boundaryIdx * 1440;
      const dayBoundaryHit = boundaryT <= horizonMinutes && boundaryT <= next && !shownDayBoundariesRef.current.has(boundaryIdx);

      if (dayBoundaryHit) {
        next = boundaryT;
      } else if (next >= result.totalDuration) {
        next = result.totalDuration;
        setPlaying(false);
        setStatus('complete');
      } else if (statusRef.current !== 'running') {
        setStatus('running');
      }

      tRef.current = next;
      setT(next);
      setFrame(buildFrame(result, next));

      if (dayBoundaryHit) {
        shownDayBoundariesRef.current.add(boundaryIdx);
        setPlaying(false);
        setDayComplete({ dayIndex: boundaryIdx - 1, summary: computeDaySummary(result, boundaryIdx - 1) });
        return; // paused for the overlay — continueAfterDayComplete() resumes the loop
      }

      if (next < result.totalDuration) {
        rafRef.current = requestAnimationFrame(loop);
      }
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing, result, speed]);

  return {
    config, setConfig,
    result, frame, t,
    playing, speed, setSpeed, status,
    runSimulation, play, pause, reset, jumpToEnd, scrubTo,
    dayComplete, continueAfterDayComplete,
  };
}
