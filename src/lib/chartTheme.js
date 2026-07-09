import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler } from 'chart.js';
import { trendDirection } from './theme.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

/* Presentation-only chart config. Every option here is about how the
 * already-computed numbers are drawn (grid density, tooltip styling,
 * animation smoothness, gradients, current-point highlighting) — nothing
 * touches what the numbers are. */
export const BASE_LINE_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 400, easing: 'easeOutQuart' },
  transitions: { active: { animation: { duration: 200 } } },
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#0f172a',
      padding: 10,
      cornerRadius: 8,
      displayColors: false,
      titleFont: { size: 11, weight: '600' },
      bodyFont: { size: 11.5 },
      titleColor: '#e2e8f0',
      bodyColor: '#ffffff',
    },
  },
  scales: {
    x: {
      ticks: { color: '#94a3b8', maxTicksLimit: 6, font: { size: 9.5 } },
      grid: { display: false },
      border: { display: false },
    },
    y: {
      ticks: { color: '#94a3b8', maxTicksLimit: 4, font: { size: 9.5 } },
      grid: { color: '#f1f5f9' },
      border: { display: false },
      beginAtZero: true,
    },
  },
};

/** Nulls-out everything after `idx` so a line only "draws" up to the current
 *  simulated time — used by every historical chart in the app. */
export function revealUpTo(series, idx) {
  return series.map((v, i) => (i <= idx ? v : null));
}

/** Lazily builds (and Chart.js will re-derive on resize) a top-to-bottom
 *  fade from the line color into transparency, so every historical chart
 *  reads as a soft gradient-filled area instead of a flat tint. */
export function makeGradientFill(colorHex) {
  return (context) => {
    const { chart } = context;
    const { ctx, chartArea } = chart;
    if (!chartArea) return colorHex + '1a';
    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
    gradient.addColorStop(0, `${colorHex}4d`);
    gradient.addColorStop(1, `${colorHex}03`);
    return gradient;
  };
}

/** One shared recipe for every line-chart dataset in the app: gradient
 *  fill, smooth curve, and the current (most recently revealed) point
 *  highlighted with a filled, white-ringed dot — everything else stays
 *  invisible so the line itself stays the focus. */
export function styledDataset({ series, idx, color, label }) {
  const data = revealUpTo(series, idx);
  return {
    label,
    data,
    borderColor: color,
    backgroundColor: makeGradientFill(color),
    fill: true,
    tension: 0.35,
    borderWidth: 2,
    pointRadius: (ctx) => (ctx.dataIndex === idx ? 4 : 0),
    pointHoverRadius: 5,
    pointBackgroundColor: color,
    pointBorderColor: '#ffffff',
    pointBorderWidth: 2,
  };
}

/** Convenience wrapper: derives a trend badge {dir, label} straight from a
 *  raw series + the current reveal index, for the ChartBox header. */
export function chartTrend(series, idx) {
  const t = trendDirection(series.slice(0, idx + 1));
  const label = t.dir === 'flat' ? '±0' : `${t.delta > 0 ? '+' : ''}${t.delta.toFixed(1)}`;
  return { dir: t.dir, label };
}
