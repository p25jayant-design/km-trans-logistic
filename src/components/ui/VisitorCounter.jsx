import React, { useState } from 'react';
import { Eye } from 'lucide-react';

/** Stable per-project namespace for the free, keyless visitor-badge.laobi.icu
 *  counter service — no signup/API key, a GET request increments and returns
 *  an SVG badge with the live count baked in. Kept specific to this app so
 *  it never collides with anyone else's page_id on the shared service. */
const PAGE_ID = 'km-trans-logistics-iima.workshop-dashboard';

/** Site-visit counter, top-right of the header. Backed by a third-party
 *  service (this app has no backend of its own — see PROJECT_CONTEXT.md) so
 *  the count is real and shared across every visitor, not just this
 *  browser. If that service is ever unreachable, the badge image simply
 *  fails to load — `onError` catches that and hides this component
 *  entirely rather than showing a broken-image icon. */
export default function VisitorCounter() {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-line bg-surface-soft px-2.5 py-1.5">
      <Eye size={13} className="shrink-0 text-ink-faint" />
      <img
        src={`https://visitor-badge.laobi.icu/badge?page_id=${PAGE_ID}`}
        alt="Site visitor count"
        height={15}
        style={{ height: 15 }}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
