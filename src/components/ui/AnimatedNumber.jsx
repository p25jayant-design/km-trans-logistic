import React, { useEffect } from 'react';
import { motion, animate, useMotionValue, useTransform } from 'framer-motion';

/** Smoothly tweens the displayed number whenever `value` changes, instead of
 *  snapping — this is what gives the KPI cards their "alive" feel.
 *
 *  Deliberately uses a Framer Motion `motionValue` (via useMotionValue +
 *  useTransform) rather than React state for the animated frame-by-frame
 *  updates: `<motion.span>` subscribes to the motion value and writes the
 *  formatted text straight to the DOM node itself, without going through
 *  React's render cycle on every tick. With ~8 of these mounted at once and
 *  the simulation already re-rendering the whole tree on every animation
 *  frame while playing, doing the tween via `setState` (the previous
 *  approach) piled up enough concurrent renders to trip React's "Maximum
 *  update depth exceeded" safeguard — which in turn made the whole page feel
 *  unresponsive to clicks. Only `value` itself (a plain number, changing at
 *  the simulation's own pace) drives a React re-render now; the 0.5s tween
 *  between old and new values runs entirely outside React. */
export default function AnimatedNumber({ value, decimals = 0, suffix = '', prefix = '' }) {
  const motionValue = useMotionValue(value || 0);
  const display = useTransform(motionValue, (v) => `${prefix}${v.toFixed(decimals)}${suffix}`);

  useEffect(() => {
    const controls = animate(motionValue, value || 0, { duration: 0.5, ease: 'easeOut' });
    return () => controls.stop();
  }, [value, motionValue]);

  return <motion.span className="tabular-nums">{display}</motion.span>;
}
