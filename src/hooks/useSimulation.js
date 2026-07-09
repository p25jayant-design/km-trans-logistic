import { useCallback, useEffect, useRef, useState } from 'react';
import { simulate, computeUtilSeries, DEFAULT_DEPTS } from '../engine/desEngine.js';
import { buildFrame } from '../engine/frameSelectors.js';

export const DEFAULT_CONFIG = {
  horizonDays: 30,
  carCarrierPct: 0.4,
  bays: { Bu: 8, Be: 0, Bi: 1 },
  departments: JSON.parse(JSON.stringify(DEFAULT_DEPTS)),
  policy: 'hybrid',
  fixedSeed: true,
  seed: 42,
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

  const rafRef = useRef(null);
  const lastTsRef = useRef(null);
  const tRef = useRef(0);

  const applyTime = useCallback((newT) => {
    if (!result) return;
    const clamped = Math.max(0, Math.min(result.totalDuration, newT));
    tRef.current = clamped;
    setT(clamped);
    setFrame(buildFrame(result, clamped));
  }, [result]);

  const runSimulation = useCallback((cfgOverride) => {
    const cfg = cfgOverride || config;
    const r = simulate(cfg);
    r.util = computeUtilSeries(r, 150);
    setResult(r);
    tRef.current = 0;
    setT(0);
    setFrame(buildFrame(r, 0));
    setPlaying(false);
    setStatus('ready');
    return r;
  }, [config]);

  const play = useCallback(() => { if (result) setPlaying(true); }, [result]);
  const pause = useCallback(() => setPlaying(false), []);
  const reset = useCallback(() => { setPlaying(false); applyTime(0); setStatus('ready'); }, [applyTime]);
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

  useEffect(() => {
    if (!playing || !result) return;
    lastTsRef.current = null;
    function loop(ts) {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dtMs = ts - lastTsRef.current;
      lastTsRef.current = ts;
      let next = tRef.current + (dtMs / 1000) * speed;
      if (next >= result.totalDuration) {
        next = result.totalDuration;
        setPlaying(false);
        setStatus('complete');
      } else {
        setStatus('running');
      }
      tRef.current = next;
      setT(next);
      setFrame(buildFrame(result, next));
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
  };
}
