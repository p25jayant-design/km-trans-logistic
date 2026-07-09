import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ListOrdered, Moon, Warehouse, Users, Trophy, Sunrise, X } from 'lucide-react';

const KIND_META = {
  queue: { icon: ListOrdered, cls: 'border-amber-300 bg-amber-50 text-amber-800', iconCls: 'bg-amber-100 text-amber-600' },
  idle: { icon: Moon, cls: 'border-blue-300 bg-blue-50 text-blue-800', iconCls: 'bg-blue-100 text-blue-600' },
  dedicated: { icon: Warehouse, cls: 'border-orange-300 bg-orange-50 text-orange-800', iconCls: 'bg-orange-100 text-orange-600' },
  shortage: { icon: Users, cls: 'border-red-300 bg-red-50 text-red-800', iconCls: 'bg-red-100 text-red-600' },
  milestone: { icon: Trophy, cls: 'border-emerald-300 bg-emerald-50 text-emerald-800', iconCls: 'bg-emerald-100 text-emerald-600' },
  day: { icon: Sunrise, cls: 'border-slate-300 bg-slate-50 text-slate-700', iconCls: 'bg-slate-200 text-slate-600' },
};

/** Subtle, dismissible operational toasts — queue buildup, idle resources,
 *  saturated dedicated bays, worker shortages, and milestones. Stacked
 *  bottom-right so they never sit over the workshop, auto-expire, and slide
 *  in/out. Purely presentational: it renders whatever `useNotifications`
 *  already decided happened. */
export default function NotificationCenter({ notifications, onDismiss }) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[90] flex w-[300px] flex-col gap-2">
      <AnimatePresence>
        {notifications.map((n) => {
          const meta = KIND_META[n.kind] || KIND_META.day;
          const Icon = meta.icon;
          return (
            <motion.div
              key={n.id}
              layout
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95, transition: { duration: 0.2 } }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className={`pointer-events-auto flex items-start gap-2.5 rounded-lg border p-3 shadow-cardHover ${meta.cls}`}
            >
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${meta.iconCls}`}>
                <Icon size={14} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-bold leading-tight">{n.title}</div>
                <div className="mt-0.5 text-[11px] leading-snug opacity-90">{n.message}</div>
              </div>
              <button
                onClick={() => onDismiss(n.id)}
                className="shrink-0 rounded p-0.5 opacity-60 transition hover:opacity-100"
                aria-label="Dismiss notification"
              >
                <X size={13} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
