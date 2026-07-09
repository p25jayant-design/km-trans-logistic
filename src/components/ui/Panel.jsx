import React from 'react';

/** The "soft tile" pattern reused everywhere inside a Card: worker rows,
 *  KPI tiles, config sections, empty-state boxes. Centralizing it means a
 *  single place controls the standard inset padding, radius and border
 *  instead of every component repeating the same Tailwind string. */
export default function Panel({ as: As = 'div', dashed = false, hoverable = false, className = '', children, ...rest }) {
  return (
    <As
      className={`rounded-lg border ${dashed ? 'border-dashed' : ''} border-line bg-surface-soft p-3 ${
        hoverable ? 'transition-shadow hover:shadow-card' : ''
      } ${className}`}
      {...rest}
    >
      {children}
    </As>
  );
}
