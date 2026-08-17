import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Clock3, ListOrdered, TrendingUp, Wrench, CircleSlash, Users, CheckCircle, Timer, BarChart3, AlertTriangle, ClipboardCheck } from 'lucide-react';
import Card from '../ui/Card.jsx';
import KpiCard from './KpiCard.jsx';
import KpiExplanations from './KpiExplanations.jsx';
import { buildTrends, liveKpis } from '../../engine/frameSelectors.js';
import { KPI_COLORS } from '../../lib/theme.js';

export default function KPIGrid({ result, frame }) {
  const bucket = frame ? Math.floor(frame.t / 5) : null;
  const trends = useMemo(() => (result && frame ? buildTrends(result, frame.t) : null), [result, bucket]);
  const live = useMemo(() => (result && frame ? liveKpis(result, frame.t) : null), [result, bucket]);
  // Live, so-far arrival counts for the Accident Repair / Standard split —
  // same liveKpis selector as `live` above, just restricted to each
  // arrival category via its optional `category` argument (see
  // frameSelectors.js). `arrivalsCount` is the field these two cards use.
  const accidentLive = useMemo(() => (result && frame ? liveKpis(result, frame.t, 'accident') : null), [result, bucket]);
  const standardLive = useMemo(() => (result && frame ? liveKpis(result, frame.t, 'standard') : null), [result, bucket]);

  // "What do these KPIs mean?" panel state, lifted up here so every KpiCard's
  // info-icon click (onInfoClick below) can open the panel and jump straight
  // to its own entry — itemRefs holds a DOM node per KPI id, registered by
  // KpiExplanations as it renders each accordion entry.
  const [explainOpen, setExplainOpen] = useState(false);
  const [openDefId, setOpenDefId] = useState(null);
  const itemRefs = useRef({});
  const registerRef = (id, el) => { itemRefs.current[id] = el; };

  useEffect(() => {
    if (explainOpen && openDefId) {
      itemRefs.current[openDefId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [explainOpen, openDefId]);

  const revealDefinition = (id) => {
    setExplainOpen(true);
    setOpenDefId(id);
  };

  if (!result || !frame || !live) {
    return (
      <Card title="Live KPIs" icon={BarChart3}>
        <p className="text-[12.5px] text-ink-faint">Run the simulation to populate live metrics.</p>
      </Card>
    );
  }

  const busyBays = frame.bays.Bu.filter(b => b.status === 'busy').length + frame.bays.Be.filter(b => b.status === 'busy').length + frame.bays.Bi.filter(b => b.status === 'busy').length;
  const totalBays = result.cfg.bays.Bu + result.cfg.bays.Be + result.cfg.bays.Bi;
  const idleBays = totalBays - busyBays;
  const avgWorkerUtil = frame.departments.length
    ? frame.departments.reduce((s, d) => s + d.utilization, 0) / frame.departments.length
    : 0;

  const ks = result.kpiSeries;
  const fullTimes = ks ? ks.sampleTimes : [];
  const fullIdleBays = ks ? ks.busyBays.map((b, i) => Math.max(0, (result.cfg.bays.Bu + result.cfg.bays.Be + result.cfg.bays.Bi) - b)) : [];

  // Percentages are relative to each other (Accident + Standard = 100%),
  // not to the full truck population — every other job type (Medium,
  // Denting, Cabin Setting, Engine Overhaul, Inspection) is outside this
  // pool entirely, per deriveArrivalCategory's own doc comment.
  const poolArrivals = accidentLive.arrivalsCount + standardLive.arrivalsCount;
  const accidentArrivalPct = poolArrivals ? (accidentLive.arrivalsCount / poolArrivals) * 100 : 0;
  const standardArrivalPct = poolArrivals ? (standardLive.arrivalsCount / poolArrivals) * 100 : 0;

  return (
    <Card title="Live KPIs" icon={BarChart3}>
      <div className="mb-3 grid grid-cols-2 gap-2.5">
        <KpiCard id="avgWait" icon={Clock3} label="Avg Waiting Time" value={live.avgWait} decimals={0} suffix=" min" trend={trends.avgWait} times={trends.times} fullSeries={ks?.avgWait} fullTimes={fullTimes} color={KPI_COLORS.wait} yAxisLabel="Minutes" onInfoClick={revealDefinition} dayMinutes={result.dayMinutes} />
        <KpiCard id="queueLen" icon={ListOrdered} label="Queue Length" value={frame.queueLen} trend={trends.queueLen} times={trends.times} fullSeries={ks?.queueLen} fullTimes={fullTimes} color={KPI_COLORS.queue} yAxisLabel="Trucks in Queue" onInfoClick={revealDefinition} dayMinutes={result.dayMinutes} />
        <KpiCard id="throughput" icon={TrendingUp} label="Throughput /day" value={live.throughputPerDay} decimals={1} trend={trends.throughputPerDay} times={trends.times} fullSeries={ks?.throughputPerDay} fullTimes={fullTimes} color={KPI_COLORS.throughput} yAxisLabel="Trucks / Day" onInfoClick={revealDefinition} dayMinutes={result.dayMinutes} />
        <KpiCard id="busyBays" icon={Wrench} label="Busy Bays" value={busyBays} trend={trends.busyBaysCount} times={trends.times} fullSeries={ks?.busyBays} fullTimes={fullTimes} color={KPI_COLORS.busyBays} yAxisLabel="Bays Busy" onInfoClick={revealDefinition} dayMinutes={result.dayMinutes} />
        <KpiCard id="idleBays" icon={CircleSlash} label="Idle Bays" value={idleBays} trend={trends.idleBaysCount} times={trends.times} fullSeries={fullIdleBays} fullTimes={fullTimes} color={KPI_COLORS.idleBays} yAxisLabel="Bays Idle" onInfoClick={revealDefinition} dayMinutes={result.dayMinutes} />
        <KpiCard id="workerUtil" icon={Users} label="Worker Utilization" value={avgWorkerUtil * 100} decimals={0} suffix="%" trend={trends.deptUtilAvg} times={trends.times} fullSeries={ks?.deptUtilPct} fullTimes={fullTimes} color={KPI_COLORS.workerUtil} yAxisLabel="% Utilized" onInfoClick={revealDefinition} dayMinutes={result.dayMinutes} />
        <KpiCard id="completed" icon={CheckCircle} label="Completed Trucks" value={live.completedCount} trend={trends.completedCount} times={trends.times} fullSeries={ks?.completedCount} fullTimes={fullTimes} color={KPI_COLORS.completed} yAxisLabel="Trucks Completed" onInfoClick={revealDefinition} dayMinutes={result.dayMinutes} />
        <KpiCard id="avgSystem" icon={Timer} label="Avg Flow Time" value={live.avgSystem} suffix=" min" trend={trends.avgSystem} times={trends.times} fullSeries={ks?.avgSystem} fullTimes={fullTimes} color={KPI_COLORS.timeInSystem} yAxisLabel="Minutes" onInfoClick={revealDefinition} dayMinutes={result.dayMinutes} />
        <KpiCard id="accidentArrivals" icon={AlertTriangle} label="Accident Repair Arrivals" value={accidentLive.arrivalsCount} suffix={` (${accidentArrivalPct.toFixed(0)}%)`} color={KPI_COLORS.accidentArrivals} yAxisLabel="Trucks" onInfoClick={revealDefinition} dayMinutes={result.dayMinutes} />
        <KpiCard id="standardArrivals" icon={ClipboardCheck} label="Standard Job Arrivals" value={standardLive.arrivalsCount} suffix={` (${standardArrivalPct.toFixed(0)}%)`} color={KPI_COLORS.standardArrivals} yAxisLabel="Trucks" onInfoClick={revealDefinition} dayMinutes={result.dayMinutes} />
      </div>

      <KpiExplanations
        open={explainOpen}
        onToggleOpen={() => setExplainOpen((v) => !v)}
        openId={openDefId}
        setOpenId={setOpenDefId}
        registerRef={registerRef}
      />
    </Card>
  );
}
