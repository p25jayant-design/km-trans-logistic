import React from 'react';

/** Base panel used throughout the dashboard: white surface, hairline border,
 *  soft shadow, consistent padding + heading row. */
export default function Card({ title, icon: Icon, right, className = '', bodyClassName = '', children }) {
  return (
    <div className={`bg-surface rounded-xl border border-line shadow-card ${className}`}>
      {(title || right) && (
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            {Icon && <Icon size={16} className="text-ink-soft" strokeWidth={2} />}
            {title && (
              <h2 className="text-[13px] font-bold uppercase tracking-wide text-ink-soft">{title}</h2>
            )}
          </div>
          {right}
        </div>
      )}
      <div className={`px-4 pb-4 ${bodyClassName}`}>{children}</div>
    </div>
  );
}
