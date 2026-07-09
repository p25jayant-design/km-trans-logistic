import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import AnimatedNumber from '../ui/AnimatedNumber.jsx';
import Sparkline from '../ui/Sparkline.jsx';
import { trendDirection } from '../../lib/theme.js';

const TREND_STYLE = {
  up: { icon: TrendingUp, cls: 'text-emerald-600 bg-emerald-50' },
  down: { icon: TrendingDown, cls: 'text-red-600 bg-red-50' },
  flat: { icon: Minus, cls: 'text-ink-faint bg-slate-100' },
};

export default function KpiCard({ icon: Icon, label, value, decimals = 0, suffix = '', trend = [], color = '#2563eb' }) {
  const t = trend.length > 1 ? trendDirection(trend) : null;
  const trendStyle = t ? TREND_STYLE[t.dir] : null;
  const TrendIcon = trendStyle?.icon;

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="rounded-lg border border-line bg-surface-soft p-3 transition-shadow hover:shadow-cardHover"
    >
      <div className="mb-1.5 flex items-center justify-between">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-md text-white shadow-sm"
          style={{ background: `linear-gradient(135deg, ${color}, ${color}bb)` }}
        >
          <Icon size={15} />
        </span>
        {trend.length > 1 && <Sparkline data={trend} color={color} />}
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
  );
}
