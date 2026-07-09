/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#ffffff',
          soft: '#f6f8fb',
          muted: '#eef2f6',
        },
        ink: {
          DEFAULT: '#1e293b',
          soft: '#475569',
          faint: '#94a3b8',
        },
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#2563eb',
          600: '#1d4ed8',
          700: '#1e40af',
        },
        line: '#dde3ea',
        state: {
          waiting: '#2563eb',
          allocated: '#d97706',
          service: '#059669',
          completed: '#94a3b8',
          alarm: '#dc2626',
        },
      },
      fontFamily: {
        sans: ['"Inter"', '"Segoe UI"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Consolas"', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,0.06), 0 1px 3px rgba(15,23,42,0.08)',
        cardHover: '0 8px 24px rgba(15,23,42,0.10)',
        glowService: '0 0 0 3px rgba(5,150,105,0.25)',
        glowAlloc: '0 0 0 3px rgba(217,119,6,0.25)',
      },
      keyframes: {
        breathe: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(5,150,105,0.35)' },
          '50%': { boxShadow: '0 0 0 6px rgba(5,150,105,0)' },
        },
        flashGreen: {
          '0%': { backgroundColor: 'rgba(5,150,105,0.25)' },
          '100%': { backgroundColor: 'transparent' },
        },
      },
      animation: {
        breathe: 'breathe 2.2s ease-in-out infinite',
        flashGreen: 'flashGreen 1s ease-out',
      },
    },
  },
  plugins: [],
};
