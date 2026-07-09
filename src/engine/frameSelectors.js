/* Pure helper functions that turn a completed simulation `result` (from
   simulate()) plus a point in simulated time `t` into the small, per-tick
   view models the UI components need. None of this touches simulation
   logic — it only *reads* the already-computed result. */

import { DEPT_KEYS, DEPT_NAMES, fmtTime } from './desEngine.js';

export function countLE(sortedArr, t) {
  let lo = 0, hi = sortedArr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sortedArr[mid] <= t) lo = mid + 1; else hi = mid;
  }
  return lo;
}

export function snapshotAt(result, t) {
  if (!result.snapshots.length) return { queueLen: 0, dept: {}, bay: {} };
  const times = result.snapTimes;
  let lo = 0, hi = times.length - 1, ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return result.snapshots[ans];
}

export function activeIntervalAt(intervals, t) {
  let lo = 0, hi = intervals.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (intervals[mid].start <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  if (ans < 0) return null;
  const iv = intervals[ans];
  return t < iv.end ? iv : null;
}

export function sortForDisplay(list, policy) {
  const arr = list.slice();
  const vp = tr => (tr.vehicleType === 'Car Carrier' ? 0 : 1);
  if (policy === 'fcfs') arr.sort((a, b) => a.arrivalTime - b.arrivalTime);
  else if (policy === 'sjf') arr.sort((a, b) => a.serviceTime - b.serviceTime);
  else if (policy === 'priority') arr.sort((a, b) => vp(a) - vp(b) || a.arrivalTime - b.arrivalTime);
  else arr.sort((a, b) => vp(a) - vp(b) || a.serviceTime - b.serviceTime);
  return arr;
}

const BAY_LABELS = { Bu: 'Standard Bay', Be: 'Dedicated Bay', Bi: 'Inspection Bay' };

/** Builds the full per-tick view model consumed by the dashboard. */
export function buildFrame(result, t) {
  const snap = snapshotAt(result, t);

  const bays = { Bu: [], Be: [], Bi: [] };
  ['Bu', 'Be', 'Bi'].forEach(type => {
    result.baySlots[type].forEach(slot => {
      const iv = activeIntervalAt(slot.intervals, t);
      if (iv) {
        const total = iv.end - iv.start;
        bays[type].push({
          id: slot.id,
          type,
          typeLabel: BAY_LABELS[type],
          status: 'busy',
          truckId: iv.truckId,
          jobName: iv.jobName,
          category: iv.category,
          vehicleType: iv.vehicleType,
          remainingMin: Math.max(0, iv.end - t),
          progress: total > 0 ? Math.min(1, (t - iv.start) / total) : 1,
          justCompleted: iv.end - t <= 0.001 && iv.end - t > -1,
        });
      } else {
        bays[type].push({ id: slot.id, type, typeLabel: BAY_LABELS[type], status: 'idle' });
      }
    });
  });

  const queue = [];
  for (const tr of result.trucks) {
    if (tr.arrivalTime > t) break; // trucks are created in arrival-time order
    if (tr.serviceStart === null || tr.serviceStart > t) queue.push(tr);
  }
  const queueForDisplay = sortForDisplay(queue, result.cfg.policy).map((tr, idx) => ({
    id: tr.id,
    jobName: tr.job.name,
    category: tr.job.category,
    vehicleType: tr.vehicleType,
    arrivalTime: tr.arrivalTime,
    waitSoFar: t - tr.arrivalTime,
    estServiceTime: tr.serviceTime,
    position: idx + 1,
  }));

  const departments = DEPT_KEYS.map(k => {
    const busy = snap.dept[k] || 0;
    const total = result.deptAvail[k] || 0;
    return {
      key: k,
      name: DEPT_NAMES[k],
      busy,
      available: Math.max(0, total - busy),
      total,
      utilization: total > 0 ? busy / total : 0,
    };
  });

  const arrivedSoFar = countLE(result.arrivalsSorted, t);
  const completedSoFar = countLE(result.departuresSorted, t);

  let bottleneck = null, bnUtil = -1;
  ['Bu', 'Be', 'Bi'].forEach(type => {
    const total = result.cfg.bays[type];
    if (total > 0) {
      const u = (snap.bay[type] || 0) / total;
      if (u > bnUtil) { bnUtil = u; bottleneck = { label: BAY_LABELS[type] + 's', utilization: u }; }
    }
  });
  departments.forEach(d => {
    if (d.total > 0 && d.utilization > bnUtil) {
      bnUtil = d.utilization;
      bottleneck = { label: d.name + ' Dept', utilization: d.utilization };
    }
  });

  return {
    t,
    clock: fmtTime(t),
    day: Math.floor(t / 1440) + 1,
    bays,
    queue: queueForDisplay,
    departments,
    arrivedSoFar,
    completedSoFar,
    inSystem: Math.max(0, arrivedSoFar - completedSoFar),
    queueLen: snap.queueLen || 0,
    bottleneck,
  };
}

/** Returns short trend arrays (for KPI sparklines) covering the snapshots
 *  immediately before the current time `t` — a rolling "recent history"
 *  window rather than the full run. */
export function buildTrends(result, t, windowCount = 24) {
  if (!result.snapshots.length) return { queueLen: [], bayBusyTotal: [], deptUtilAvg: [] };
  const idx = Math.min(result.snapTimes.length - 1, countLE(result.snapTimes, t));
  const start = Math.max(0, idx - windowCount + 1);
  const slice = result.snapshots.slice(start, idx + 1);
  const totalBays = result.cfg.bays.Bu + result.cfg.bays.Be + result.cfg.bays.Bi;
  const deptTotal = DEPT_KEYS.reduce((s, k) => s + (result.deptAvail[k] || 0), 0);

  return {
    queueLen: slice.map(s => s.queueLen),
    bayBusyTotal: slice.map(s => (totalBays > 0 ? ((s.bay.Bu || 0) + (s.bay.Be || 0) + (s.bay.Bi || 0)) / totalBays : 0) * 100),
    deptUtilAvg: slice.map(s => (deptTotal > 0 ? DEPT_KEYS.reduce((sum, k) => sum + (s.dept[k] || 0), 0) / deptTotal : 0) * 100),
  };
}

/** "So-far" KPIs computed only from trucks completed up to time t — used by
 *  the live KPI cards, which are deliberately distinct from the full-horizon
 *  final summary shown elsewhere. */
export function liveKpis(result, t) {
  let waitSum = 0, sysSum = 0, n = 0;
  for (const tr of result.trucks) {
    if (tr.arrivalTime > t) break;
    if (tr.departureTime != null && tr.departureTime <= t) {
      waitSum += tr.serviceStart - tr.arrivalTime;
      sysSum += tr.departureTime - tr.arrivalTime;
      n++;
    }
  }
  const days = t / 1440;
  return {
    avgWait: n ? waitSum / n : 0,
    avgSystem: n ? sysSum / n : 0,
    throughputPerDay: days > 0 ? n / days : 0,
    completedCount: n,
  };
}

/** Rolling "average waiting time observed so far, as of each sample time"
 *  series — used by the Average Waiting Time chart. Purely derived from the
 *  already-simulated truck records, sampled on the same time grid as
 *  computeUtilSeries so all historical charts share one x-axis. */
export function computeWaitSeries(result, sampleTimes) {
  const started = result.trucks
    .filter(tr => tr.serviceStart != null)
    .map(tr => ({ t: tr.serviceStart, wait: tr.serviceStart - tr.arrivalTime }))
    .sort((a, b) => a.t - b.t);
  const n = started.length;
  const times = started.map(s => s.t);
  const prefix = new Array(n + 1).fill(0);
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + started[i].wait;

  return sampleTimes.map(t2 => {
    const cnt = countLE(times, t2);
    return cnt > 0 ? prefix[cnt] / cnt : 0;
  });
}

/** Read-only detail lookup for a single truck, by id, as of time `t` — feeds
 *  the truck hover tooltip (arrival time, waiting time, assigned workers,
 *  bay, expected completion). Only reads fields the engine already computed
 *  in `simulate()`; no simulation logic lives here. */
export function getTruckDetails(result, truckId, t) {
  const truck = result.trucks.find((tr) => tr.id === truckId);
  if (!truck) return null;

  const isWaiting = truck.serviceStart == null || truck.serviceStart > t;
  const isCompleted = truck.departureTime != null && truck.departureTime <= t;
  const waitTime = isWaiting
    ? Math.max(0, t - truck.arrivalTime)
    : Math.max(0, truck.serviceStart - truck.arrivalTime);
  const assignedWorkers = Object.entries(truck.job.req).map(([dept, count]) => ({ dept, count }));

  return {
    truckId: truck.id,
    jobName: truck.job.name,
    vehicleType: truck.vehicleType,
    category: truck.job.category,
    arrivalTime: truck.arrivalTime,
    waitTime,
    isWaiting,
    isCompleted,
    bay: truck.bay,
    assignedWorkers,
    expectedCompletion: truck.serviceEnd,
  };
}

/* Splits each raw engine event into the richer set of operational-timeline
 * entries the UI wants (Truck Arrived, Entered Queue, Assigned Bay, Workers
 * Allocated, Service Started, Service Completed, Truck Departed). The
 * engine allocates a bay + workers + starts service in a single atomic
 * instant, and releases a bay + departs a truck in another — these makers
 * describe those same already-logged instants as their constituent facets;
 * they never invent a new time, truck, or fact. */
const TIMELINE_EXPANSION = {
  arrival: () => [{ kind: 'arrival', description: 'Truck Arrived' }],
  queue: () => [{ kind: 'queued', description: 'Entered Queue' }],
  start: (e) => [
    { kind: 'bayAssigned', description: `Assigned Bay ${e.bay}` },
    { kind: 'workersAllocated', description: 'Workers Allocated' },
    { kind: 'serviceStarted', description: 'Service Started' },
  ],
  complete: (e) => [
    { kind: 'serviceCompleted', description: 'Service Completed' },
    { kind: 'departed', description: 'Truck Departed' },
  ],
};

/** 'start' and 'complete' events already carry a structured `truckId`
 *  field; 'arrival' and 'queue' events don't, but every eventsLog text for
 *  them consistently begins with `#<id>` — so the id is read straight out
 *  of the already-generated text rather than recomputed. */
function extractTruckId(e) {
  if (e.truckId != null) return e.truckId;
  const m = /^#(\d+)/.exec(e.text || '');
  return m ? Number(m[1]) : null;
}

/** Pure display expansion of `result.eventsLog` into operational-timeline
 *  rows. No simulation logic — only reads/relabels what already happened. */
export function expandTimelineEvents(eventsLog) {
  const out = [];
  eventsLog.forEach((e, i) => {
    const maker = TIMELINE_EXPANSION[e.type];
    if (!maker) return;
    const truckId = extractTruckId(e);
    maker(e).forEach((sub, j) => {
      out.push({
        key: `${i}-${j}`,
        t: e.t,
        truckId,
        category: e.category,
        bay: e.bay ?? null,
        kind: sub.kind,
        description: sub.description,
      });
    });
  });
  return out;
}

export function fmtMinutesShort(m) {
  if (m < 60) return `${m.toFixed(0)} min`;
  if (m < 1440) return `${(m / 60).toFixed(1)} hr`;
  return `${(m / 1440).toFixed(1)} day`;
}
