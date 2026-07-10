import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, Maximize2, X } from 'lucide-react';
import { Line } from 'react-chartjs-2';

const TREND_STYLE = {
  up: { icon: TrendingUp, cls: 'text-emerald-600 bg-emerald-50' },
  down: { icon: TrendingDown, cls: 'text-red-600 bg-red-50' },
  flat: { icon: Minus, cls: 'text-ink-faint bg-slate-100' },
};

/** Re-derives the compact chart's Chart.js options into a fuller, more
 *  legible set for the expanded pop-up view: a visible legend, larger tick
 *  labels, and a few more x-axis ticks — everything else (colors, gradient
 *  fills, current-point highlight, tooltip behavior) stays identical since
 *  it comes from the same `options`/`data` the compact chart already uses. */
function expandOptions(options) {
  const base = options || {};
  return {
    ...base,
    plugins: {
      ...base.plugins,
      legend: {
        display: true,
        position: 'top',
        align: 'end',
        labels: { color: '#475569', font: { size: 12, weight: '600' }, boxWidth: 14, padding: 16 },
      },
    },
    scales: {
      ...base.scales,
      x: {
        ...base.scales?.x,
        ticks: { ...base.scales?.x?.ticks, maxTicksLimit: 12, font: { size: 11 } },
      },
      y: {
        ...base.scales?.y,
        ticks: { ...base.scales?.y?.ticks, maxTicksLimit: 8, font: { size: 11 } },
      },
    },
  };
}

/** Shared frame for a single chart: soft card, small heading, optional
 *  trend-arrow badge, fixed-height plotting area. Reused by the compact
 *  live-charts grid and the dedicated bay/worker utilization pages.
 *
 *  Pass `data`/`options` (the same Chart.js props you'd hand to <Line>) and
 *  the chart becomes click-to-expand: a maximize button (and clicking the
 *  chart itself) opens the same live data in a larger pop-up with a full
 *  legend, portaled to <body> so it floats above everything. The simulation
 *  keeps running underneath — the pop-up just re-renders with whatever
 *  `data`/`options` the parent is already passing on every tick, exactly
 *  like the inline chart does. Closing it returns to the dashboard as-is. */
export default function ChartBox({ title, subtitle, trend, height = 180, data, options, children }) {
  const [expanded, setExpanded] = useState(false);
  const t = trend && TREND_STYLE[trend.dir];
  const TrendIcon = t?.icon;
  const canExpand = !!data;

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e) => { if (e.key === 'Escape') setExpanded(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  return (
    <>
      <div className="rounded-lg border border-line bg-surface-soft p-3">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <div className="text-[11.5px] font-semibold text-ink-soft">{title}</div>
            {subtitle && <div className="text-[10.5px] text-ink-faint">{subtitle}</div>}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {t && (
              <span className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${t.cls}`}>
                <TrendIcon size={11} /> {trend.label}
              </span>
            )}
            {canExpand && (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                title="Expand chart"
                aria-label="Expand chart"
                className="flex items-center justify-center rounded-md border border-line bg-white p-1 text-ink-faint transition-all duration-150 hover:border-brand-300 hover:text-brand-600 active:scale-90"
              >
                <Maximize2 size={12} />
              </button>
            )}
          </div>
        </div>
        <div
          style={{ height }}
          className={canExpand ? 'cursor-zoom-in' : ''}
          onClick={canExpand ? () => setExpanded(true) : undefined}
        >
          {children || (data && <Line data={data} options={options} />)}
        </div>
      </div>

      {canExpand && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {expanded && (
            <motion.div
              key="chart-modal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px] sm:p-8"
              onClick={() => setExpanded(false)}
            >
              <motion.div
                key="chart-modal-panel"
                initial={{ opacity: 0, scale: 0.96, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 8 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                onClick={(e) => e.stopPropagation()}
                className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-line bg-surface p-5 shadow-cardHover"
              >
                <div className="mb-3 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-bold text-ink">{title}</div>
                    {subtitle && <div className="mt-0.5 text-[12px] text-ink-faint">{subtitle}</div>}
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpanded(false)}
                    aria-label="Close"
                    className="flex shrink-0 items-center justify-center rounded-full border border-line bg-white p-1.5 text-ink-faint transition-all duration-150 hover:border-red-300 hover:text-red-600 active:scale-90"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="min-h-0 flex-1" style={{ height: 480 }}>
                  <Line data={data} options={expandOptions(options)} />
                </div>
                <p className="mt-3 text-[11px] text-ink-faint">
                  The simulation keeps running in the background — close this to return to the dashboard.
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
