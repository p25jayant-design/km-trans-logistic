import React, { useMemo } from 'react';
import { Clock3, ListOrdered, TrendingUp, Wrench, CircleSlash, Users, CheckCircle, Timer, BarChart3 } from 'lucide-react';
import Card from '../ui/Card.jsx';
import KpiCard from './KpiCard.jsx';
import { buildTrends, liveKpis } from '../../engine/frameSelectors.js';
import { KPI_COLORS } from '../../lib/theme.js';

export default function KPIGrid({ result, frame }) {
  const bucket = frame ? Math.floor(frame.t / 5) : null;
  const trends = useMemo(() => (result && frame ? buildTrends(result, frame.t) : null), [result, bucket]);
  const live = useMemo(() => (result && frame ? liveKpis(result, frame.t) : null), [result, bucket]);

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

  return (
    <Card title="Live KPIs" icon={BarChart3}>
      <div className="grid grid-cols-2 gap-2.5">
        <KpiCard icon={Clock3} label="Avg Waiting Time" value={live.avgWait} decimals={0} suffix=" min" trend={trends.queueLen} color={KPI_COLORS.wait} />
        <KpiCard icon={ListOrdered} label="Queue Length" value={frame.queueLen} trend={trends.queueLen} color={KPI_COLORS.queue} />
        <KpiCard icon={TrendingUp} label="Throughput /day" value={live.throughputPerDay} decimals={1} trend={trends.bayBusyTotal} color={KPI_COLORS.throughput} />
        <KpiCard icon={Wrench} label="Busy Bays" value={busyBays} trend={trends.bayBusyTotal} color={KPI_COLORS.busyBays} />
        <KpiCard icon={CircleSlash} label="Idle Bays" value={idleBays} trend={trends.bayBusyTotal.map(v => 100 - v)} color={KPI_COLORS.idleBays} />
        <KpiCard icon={Users} label="Worker Utilization" value={avgWorkerUtil * 100} decimals={0} suffix="%" trend={trends.deptUtilAvg} color={KPI_COLORS.workerUtil} />
        <KpiCard icon={CheckCircle} label="Completed Trucks" value={live.completedCount} trend={trends.bayBusyTotal} color={KPI_COLORS.completed} />
        <KpiCard icon={Timer} label="Avg Time in System" value={live.avgSystem} suffix=" min" trend={trends.queueLen} color={KPI_COLORS.timeInSystem} />
      </div>
    </Card>
  );
}
