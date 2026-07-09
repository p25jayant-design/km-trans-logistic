import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const TREND_STYLE = {
  up: { icon: TrendingUp, cls: 'text-emerald-600 bg-emerald-50' },
  down: { icon: TrendingDown, cls: 'text-red-600 bg-red-50' },
  flat: { icon: Minus, cls: 'text-ink-faint bg-slate-100' },
};

/** Shared frame for a single chart: soft card, small heading, optional
 *  trend-arrow badge, fixed-height plotting area. Reused by the compact
 *  live-charts grid and the dedicated bay/worker utilization pages. */
export default function ChartBox({ title, subtitle, trend, height = 180, children }) {
  const t = trend && TREND_STYLE[trend.dir];
  const TrendIcon = t?.icon;

  return (
    <div className="rounded-lg border border-line bg-surface-soft p-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <div className="text-[11.5px] font-semibold text-ink-soft">{title}</div>
          {subtitle && <div className="text-[10.5px] text-ink-faint">{subtitle}</div>}
        </div>
        {t && (
          <span className={`flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${t.cls}`}>
            <TrendIcon size={11} /> {trend.label}
          </span>
        )}
      </div>
      <div style={{ height }}>{children}</div>
    </div>
  );
}
