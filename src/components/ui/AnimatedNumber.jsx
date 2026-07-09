import React, { useEffect, useRef, useState } from 'react';
import { motion, animate } from 'framer-motion';

/** Smoothly tweens the displayed number whenever `value` changes, instead of
 *  snapping — this is what gives the KPI cards their "alive" feel. */
export default function AnimatedNumber({ value, decimals = 0, suffix = '', prefix = '' }) {
  const [display, setDisplay] = useState(value || 0);
  const prevRef = useRef(value || 0);

  useEffect(() => {
    const controls = animate(prevRef.current, value || 0, {
      duration: 0.5,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(v),
    });
    prevRef.current = value || 0;
    return () => controls.stop();
  }, [value]);

  return (
    <motion.span className="tabular-nums">
      {prefix}
      {display.toFixed(decimals)}
      {suffix}
    </motion.span>
  );
}
