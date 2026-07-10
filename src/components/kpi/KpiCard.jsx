import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Line } from 'react-chartjs-2';
import { TrendingUp, TrendingDown, Minus, Maximize2, X } from 'lucide-react';
import AnimatedNumber from '../ui/AnimatedNumber.jsx';
import Sparkline from '../ui/Sparkline.jsx';
import { trendDirection } from '../../lib/theme.js';
import { BASE_LINE_OPTIONS, makeGradientFill } from '../../lib/chartTheme.js';

const TREND_STYLE = {
  up: { icon: TrendingUp, cls: 'text-emerald-600 bg-emerald-50' },
  down: { icon: TrendingDown, cls: 'text-red-600 bg-red-50' },
  flat: { icon: Minus, cls: 'text-ink-faint bg-slate-100' },
};

/** Compact "HH:MM" clock label for a simulated-minutes timestamp — enough
 *  detail for the short recent-history window these cards chart, without
 *  the "Day N ·" prefix `fmtTime` uses elsewhere (unnecessary at this
 *  zoomed-in a scale, and it would crowd the expanded chart's x-axis). */
function clockLabel(t) {
  const mm = Math.floor(t % 1440);
  const hh = Math.floor(mm / 60);
  const min = Math.floor(mm % 60);
  return `${String(hh).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export default function KpiCard({ icon: Icon, label, value, decimals = 0, suffix = '', trend = [], times = [], color = '#2563eb' }) {
  const [expanded, setExpanded] = useState(false);
  const t = trend.length > 1 ? trendDirection(trend) : null;
  const trendStyle = t ? TREND_STYLE[t.dir] : null;
  const TrendIcon = trendStyle?.icon;
  const canExpand = trend.length > 1;

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e) => { if (e.key === 'Escape') setExpanded(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  const chartData = canExpand ? {
    labels: times.length === trend.length ? times.map(clockLabel) : trend.map((_, i) => i),
    datasets: [{
      label,
      data: trend,
      borderColor: color,
      backgroundColor: makeGradientFill(color),
      fill: true,
      tension: 0.35,
      borderWidth: 2,
      pointRadius: (ctx) => (ctx.dataIndex === trend.length - 1 ? 4 : 0),
      pointHoverRadius: 5,
      pointBackgroundColor: color,
      pointBorderColor: '#ffffff',
      pointBorderWidth: 2,
    }],
  } : null;

  const expandedOptions = {
    ...BASE_LINE_OPTIONS,
    plugins: {
      ...BASE_LINE_OPTIONS.plugins,
      legend: {
        display: true,
        position: 'top',
        align: 'end',
        labels: { color: '#475569', font: { size: 12, weight: '600' }, boxWidth: 14, padding: 16 },
      },
    },
    scales: {
      ...BASE_LINE_OPTIONS.scales,
      x: { ...BASE_LINE_OPTIONS.scales.x, ticks: { ...BASE_LINE_OPTIONS.scales.x.ticks, maxTicksLimit: 10, font: { size: 11 } } },
      y: { ...BASE_LINE_OPTIONS.scales.y, ticks: { ...BASE_LINE_OPTIONS.scales.y.ticks, font: { size: 11 } } },
    },
  };

  return (
    <>
      <motion.div
        whileHover={{ y: -2 }}
        onClick={canExpand ? () => setExpanded(true) : undefined}
        className={`rounded-lg border border-line bg-surface-soft p-3 transition-shadow hover:shadow-cardHover ${canExpand ? 'cursor-zoom-in' : ''}`}
      >
        <div className="mb-1.5 flex items-center justify-between">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-md text-white shadow-sm"
            style={{ background: `linear-gradient(135deg, ${color}, ${color}bb)` }}
          >
            <Icon size={15} />
          </span>
          <div className="flex items-center gap-1">
            {trend.length > 1 && <Sparkline data={trend} color={color} />}
            {canExpand && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
                title="Expand"
                aria-label="Expand"
                className="flex items-center justify-center rounded-md border border-line bg-white p-1 text-ink-faint transition-all duration-150 hover:border-brand-300 hover:text-brand-600 active:scale-90"
              >
                <Maximize2 size={11} />
              </button>
            )}
          </div>
        </div>
        <div className="flex items-end gap-1.5">
          <div className="text-[20px] font-extrabold leading-tight text-ink">
            <AnimatedNumber value={value} decimals={decimals} suffix={suffix} />
          </div>
          {trendStyle && (
            <span className={`mb-1 flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9.5px] font-bold ${trendStyle.cls}`}>
              <TrendIcon size={10} />
            </span>
          )}
        </div>
        <div className="text-[11px] font-medium text-ink-faint">{label}</div>
      </motion.div>

      {canExpand && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {expanded && (
            <motion.div
              key="kpi-modal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px] sm:p-8"
              onClick={() => setExpanded(false)}
            >
              <motion.div
                key="kpi-modal-panel"
                initial={{ opacity: 0, scale: 0.96, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 8 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                onClick={(e) => e.stopPropagation()}
                className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-line bg-surface p-5 shadow-cardHover"
              >
                <div className="mb-3 flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white shadow-sm"
                      style={{ background: `linear-gradient(135deg, ${color}, ${color}bb)` }}
                    >
                      <Icon size={18} />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-[15px] font-bold text-ink">{label}</div>
                      <div className="text-[20px] font-extrabold leading-tight text-ink">
                        <AnimatedNumber value={value} decimals={decimals} suffix={suffix} />
                      </div>
                    </div>
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
                <div className="min-h-0 flex-1" style={{ height: 420 }}>
                  {chartData && <Line data={chartData} options={expandedOptions} />}
                </div>
                <p className="mt-3 text-[11px] text-ink-faint">
                  Recent trend window, updating live · the simulation keeps running in the background — close this to return to the dashboard.
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
