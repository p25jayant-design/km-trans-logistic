import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Line } from 'react-chartjs-2';
import { TrendingUp, TrendingDown, Minus, Maximize2, X, ZoomIn, ZoomOut } from 'lucide-react';
import AnimatedNumber from '../ui/AnimatedNumber.jsx';
import Sparkline from '../ui/Sparkline.jsx';
import InfoTooltip from '../ui/InfoTooltip.jsx';
import { trendDirection } from '../../lib/theme.js';
import { BASE_LINE_OPTIONS, makeGradientFill } from '../../lib/chartTheme.js';
import { KPI_DEFINITIONS_BY_ID } from '../../lib/kpiDefinitions.js';

const TREND_STYLE = {
  up: { icon: TrendingUp, cls: 'text-emerald-600 bg-emerald-50' },
  down: { icon: TrendingDown, cls: 'text-red-600 bg-red-50' },
  flat: { icon: Minus, cls: 'text-ink-faint bg-slate-100' },
};

/** Compact "HH:MM" clock label — used for the fine, recent-activity view. */
function clockLabel(t) {
  const mm = Math.floor(t % 1440);
  const hh = Math.floor(mm / 60);
  const min = Math.floor(mm % 60);
  return `${String(hh).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** "Day N.n" label — used for the zoomed-out, full-run view, matching the
 *  day-scale x-axis convention every other full-horizon chart in the app
 *  already uses (ChartsPanel, Bay/Worker Utilization pages). */
function dayLabel(t) {
  return `${(t / 1440).toFixed(1)}d`;
}

function buildChartData({ series, labels, color, label }) {
  return {
    labels,
    datasets: [{
      label,
      data: series,
      borderColor: color,
      backgroundColor: makeGradientFill(color),
      fill: true,
      tension: 0.35,
      borderWidth: 2,
      pointRadius: (ctx) => (ctx.dataIndex === series.length - 1 ? 4 : 0),
      pointHoverRadius: 5,
      pointBackgroundColor: color,
      pointBorderColor: '#ffffff',
      pointBorderWidth: 2,
    }],
  };
}

/** Live KPI card. When `fullSeries`/`fullTimes` are supplied (the coarse,
 *  day-scale history for this metric across the entire run), the expanded
 *  pop-up becomes a two-level zoom: it opens on the fine, recent-activity
 *  window (same data as the mini sparkline), and pinching on a trackpad —
 *  or Ctrl/Cmd + scroll for a mouse — zooms out to the full simulation
 *  history back to day 0, with a matching zoom-in gesture to return.
 *  Manual pill buttons do the same thing for anyone not on a trackpad.
 *  Both views come from data the engine already produced (buildTrends /
 *  buildFullKpiSeries) — this only changes which precomputed series is
 *  currently on screen. */
export default function KpiCard({ id, icon: Icon, label, value, decimals = 0, suffix = '', trend = [], times = [], fullSeries = [], fullTimes = [], color = '#2563eb', onInfoClick }) {
  const [expanded, setExpanded] = useState(false);
  const [view, setView] = useState('recent'); // 'recent' | 'full'
  const chartAreaRef = useRef(null);
  const lastToggleRef = useRef(0);

  // `id` looks up this card's entry in the shared KPI_DEFINITIONS list — the
  // same entry the "What do these KPIs mean?" panel renders in full below
  // the grid, so the tooltip's short blurb here and that panel's long-form
  // explanation can never say something different about the same number.
  const def = id ? KPI_DEFINITIONS_BY_ID[id] : null;

  const t = trend.length > 1 ? trendDirection(trend) : null;
  const trendStyle = t ? TREND_STYLE[t.dir] : null;
  const TrendIcon = trendStyle?.icon;
  const canExpand = trend.length > 1;
  const canZoomOut = fullSeries.length > 1 && fullTimes.length === fullSeries.length;

  useEffect(() => {
    if (!expanded) {
      setView('recent');
      return;
    }
    const onKey = (e) => { if (e.key === 'Escape') setExpanded(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  // Native (non-passive) wheel listener so we can actually preventDefault —
  // React's synthetic onWheel is passive by default and can't stop the
  // browser's own pinch-to-zoom-the-page behavior, which we need to swap
  // out for "zoom the chart" instead while the pop-up is open.
  useEffect(() => {
    if (!expanded || !canZoomOut) return;
    const el = chartAreaRef.current;
    if (!el) return;
    const handler = (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const now = Date.now();
      if (now - lastToggleRef.current < 400) return;
      lastToggleRef.current = now;
      setView(e.deltaY > 0 ? 'full' : 'recent');
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [expanded, canZoomOut]);

  const showingFull = view === 'full' && canZoomOut;
  const chartData = canExpand ? (
    showingFull
      ? buildChartData({ series: fullSeries, labels: fullTimes.map(dayLabel), color, label })
      : buildChartData({ series: trend, labels: times.length === trend.length ? times.map(clockLabel) : trend.map((_, i) => i), color, label })
  ) : null;

  // Explicit axis titles for the expanded chart — the X-axis always plots
  // simulation time (never wall-clock time), just at two different
  // granularities depending on `view`: the fine "Recent" window labels each
  // point HH:MM within the current simulated day (see clockLabel above),
  // while "Full Run" labels each point by simulated day number (dayLabel
  // above) across the whole horizon. The Y-axis title is whatever unit this
  // specific KPI actually is (`yAxisLabel`, passed in from KPIGrid.jsx —
  // e.g. "Minutes" for a duration, "%" for a utilization, "Trucks" for a
  // count) — labeling it explicitly instead of leaving Chart.js's bare
  // numeric ticks to (mis)imply their own units.
  const xAxisTitle = showingFull ? 'Simulation Day' : 'Simulation Time (HH:MM, current day)';

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
      x: {
        ...BASE_LINE_OPTIONS.scales.x,
        ticks: { ...BASE_LINE_OPTIONS.scales.x.ticks, maxTicksLimit: showingFull ? 10 : 8, font: { size: 11 } },
        title: { display: true, text: xAxisTitle, color: '#64748b', font: { size: 11, weight: '600' }, padding: { top: 8 } },
      },
      y: {
        ...BASE_LINE_OPTIONS.scales.y,
        ticks: { ...BASE_LINE_OPTIONS.scales.y.ticks, font: { size: 11 } },
        title: { display: !!yAxisLabel, text: yAxisLabel, color: '#64748b', font: { size: 11, weight: '600' }, padding: { bottom: 8 } },
      },
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
            {def && (
              <InfoTooltip
                text={def.short}
                label={label}
                onOpen={() => onInfoClick?.(id)}
              />
            )}
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

                  <div className="flex shrink-0 items-center gap-2">
                    {canZoomOut && (
                      <div className="flex items-center rounded-full border border-line bg-surface-soft p-0.5">
                        <button
                          type="button"
                          onClick={() => setView('recent')}
                          className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-semibold transition-all duration-150 ${
                            !showingFull ? 'bg-white text-ink shadow-sm' : 'text-ink-faint hover:text-ink'
                          }`}
                        >
                          <ZoomIn size={11} /> Recent
                        </button>
                        <button
                          type="button"
                          onClick={() => setView('full')}
                          className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-semibold transition-all duration-150 ${
                            showingFull ? 'bg-white text-ink shadow-sm' : 'text-ink-faint hover:text-ink'
                          }`}
                        >
                          <ZoomOut size={11} /> Full Run
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setExpanded(false)}
                      aria-label="Close"
                      className="flex shrink-0 items-center justify-center rounded-full border border-line bg-white p-1.5 text-ink-faint transition-all duration-150 hover:border-red-300 hover:text-red-600 active:scale-90"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                <div ref={chartAreaRef} className="min-h-0 flex-1" style={{ height: 420 }}>
                  {chartData && <Line data={chartData} options={expandedOptions} />}
                </div>

                <p className="mt-3 text-[11px] text-ink-faint">
                  {showingFull
                    ? 'Full simulation history — day 0 through now.'
                    : 'Recent activity, updating live.'}
                  {canZoomOut && ' Pinch on a trackpad (or Ctrl/⌘ + scroll) to zoom out to the full run, pinch back in to return.'}
                  {' '}The simulation keeps running in the background — close this to return to the dashboard.
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
