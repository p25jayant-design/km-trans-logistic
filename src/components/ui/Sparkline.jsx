import React, { useId, useMemo } from 'react';

/** Tiny inline SVG trend line — no chart library needed for something this
 *  small. Draws a soft gradient fill under the line and highlights the
 *  current (last) value with a small filled dot, matching the same
 *  "gradient + highlighted current point" treatment used by the full
 *  Chart.js charts. */
export default function Sparkline({ data = [], width = 96, height = 28, color = '#2563eb' }) {
  const rawId = useId();
  const gradId = `spark-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;

  const { linePath, areaPath, lastPoint } = useMemo(() => {
    if (!data.length) return { linePath: '', areaPath: '', lastPoint: null };
    const max = Math.max(...data, 1e-6);
    const min = Math.min(...data, 0);
    const range = Math.max(max - min, 1e-6);
    const stepX = width / Math.max(data.length - 1, 1);
    const points = data.map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return [x, y];
    });
    const linePath = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const last = points[points.length - 1];
    const areaPath = `${linePath} L${last[0].toFixed(1)},${height} L0,${height} Z`;
    return { linePath, areaPath, lastPoint: last };
  }, [data, width, height]);

  if (!data.length) return <div style={{ width, height }} />;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
      {lastPoint && (
        <circle cx={lastPoint[0]} cy={lastPoint[1]} r={2.4} fill={color} stroke="#ffffff" strokeWidth={1} />
      )}
    </svg>
  );
}
