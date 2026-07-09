import React from 'react';
import Panel from './Panel.jsx';

/** Small centered "value over label" tile — the 4-up stat row pattern used
 *  by the Bay Utilization and Worker Utilization detail pages. Accepts
 *  either a plain value node or a fully custom `valueNode` (e.g. a Badge). */
export default function StatTile({ value, valueNode, label, valueClassName = 'text-[19px] font-extrabold tabular-nums text-brand-600' }) {
  return (
    <Panel className="text-center transition-shadow hover:shadow-card">
      {valueNode ? valueNode : <div className={valueClassName}>{value}</div>}
      <div className="mt-1 text-[10.5px] font-medium text-ink-faint">{label}</div>
    </Panel>
  );
}
