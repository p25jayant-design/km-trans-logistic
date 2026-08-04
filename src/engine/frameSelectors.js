/* Pure helper functions that turn a completed simulation `result` (from
   simulate()) plus a point in simulated time `t` into the small, per-tick
   view models the UI components need. None of this touches simulation
   logic — it only *reads* the already-computed result. */

import { DEPT_KEYS, DEPT_NAMES, fmtTime } from './desEngine.js';

/** Classifies a truck's already-assigned `job` (unchanged — this never
 *  influences which job a truck gets, it only reads the result) into the
 *  Accident Repair / Standard arrival-mix category used by the new
 *  Accident-vs-Standard reporting features (Live KPI cards, Flow Time
 *  Analysis category dropdown, split Throughput/Waiting-Time charts,
 *  Simulation Summary, CSV/XLSX export). Every truck whose job is the
 *  single 'accident' job type, or whose job.category is 'standard', is
 *  covered — see the comment above ACCIDENT_STANDARD_POOL_RATE in
 *  desEngine.js for exactly why these two groups (and only these two) form
 *  the pool this feature controls. Every other job type (Medium, Denting,
 *  Cabin Setting, Engine Overhaul, Inspection) returns null — they're
 *  outside this feature's scope entirely, not silently folded into
 *  "Standard". */
export function deriveArrivalCategory(job) {
  if (!job) return null;
  if (job.id === 'accident') return 'accident';
  if (job.category === 'standard') return 'standard';
  return null;
}

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
  // Before the very first recorded snapshot (e.g. t=0, before any truck has
  // arrived), there is genuinely nothing happening yet — the binary search
  // below would otherwise fall through with its `ans = 0` default and
  // silently return the *first* snapshot's data (which describes some
  // future moment, once the first job actually starts), making the initial
  // frame falsely report busy departments/queue/bottleneck. Return the same
  // "nothing recorded" empty shape used when there are no snapshots at all.
  if (t < times[0]) return { queueLen: 0, dept: {}, bay: {} };
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
        // Purely read-only lookup of the occupying truck's already-computed
        // job.req (department -> worker-count map) — used to show worker
        // icons inside occupied bays. This does not add any new simulation
        // state: `truck.job.req` already exists on every truck the engine
        // produced, this just surfaces it in the per-tick bay view model.
        const truck = result.trucks.find(tr => tr.id === iv.truckId);
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
          req: truck ? truck.job.req : {},
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

  // `kind`/`key` identify *what* the bottleneck is (a bay type or a worker
  // department) so the UI can look up the right color from the color-coded
  // bottleneck system (see lib/styleMaps.js's DEPT_BOTTLENECK_COLOR /
  // bottleneckColorFor) without fragile string-matching on `label`.
  let bottleneck = null, bnUtil = -1;
  ['Bu', 'Be', 'Bi'].forEach(type => {
    const total = result.cfg.bays[type];
    if (total > 0) {
      const u = (snap.bay[type] || 0) / total;
      if (u > bnUtil) { bnUtil = u; bottleneck = { kind: 'bay', key: type, label: BAY_LABELS[type] + 's', utilization: u }; }
    }
  });
  departments.forEach(d => {
    if (d.total > 0 && d.utilization > bnUtil) {
      bnUtil = d.utilization;
      bottleneck = { kind: 'dept', key: d.key, label: d.name + ' Dept', utilization: d.utilization };
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
  if (!result.snapshots.length) return { queueLen: [], bayBusyTotal: [], deptUtilAvg: [], times: [] };
  const idx = Math.min(result.snapTimes.length - 1, countLE(result.snapTimes, t));
  const start = Math.max(0, idx - windowCount + 1);
  const slice = result.snapshots.slice(start, idx + 1);
  const totalBays = result.cfg.bays.Bu + result.cfg.bays.Be + result.cfg.bays.Bi;
  const deptTotal = DEPT_KEYS.reduce((s, k) => s + (result.deptAvail[k] || 0), 0);

  return {
    queueLen: slice.map(s => s.queueLen),
    bayBusyTotal: slice.map(s => (totalBays > 0 ? ((s.bay.Bu || 0) + (s.bay.Be || 0) + (s.bay.Bi || 0)) / totalBays : 0) * 100),
    deptUtilAvg: slice.map(s => (deptTotal > 0 ? DEPT_KEYS.reduce((sum, k) => sum + (s.dept[k] || 0), 0) / deptTotal : 0) * 100),
    times: slice.map(s => s.t),
  };
}

/** "So-far" KPIs as of live playback time t — deliberately distinct from
 *  the full-horizon final summary shown elsewhere. Average Waiting Time is
 *  counted over every truck that has STARTED service by t (a wait time is
 *  a settled, known quantity the moment service starts — it doesn't
 *  depend on how long that truck's service or exit travel takes), while
 *  Average Time in System and throughput/completedCount require a truck
 *  to have fully DEPARTED by t, since "time in system" and "completed"
 *  are only meaningful once departure has actually happened. Mirrors the
 *  same avgWait-vs-avgSystem distinction the final-run KPIs in
 *  desEngine.js's `simulate()` make.
 *
 *  Optional `category` ('accident' | 'standard') restricts every count/sum
 *  below to trucks whose deriveArrivalCategory(tr.job) matches — used by
 *  the "Accident Repair Arrivals" / "Standard Job Arrivals" Live KPI cards.
 *  Omitting it (the default, `null`) reproduces the exact original
 *  all-trucks behavior this function has always had; the one new field,
 *  `arrivalsCount`, is purely additive and doesn't change any of the other
 *  returned values for existing callers. */
export function liveKpis(result, t, category = null) {
  let waitSum = 0, waitN = 0, sysSum = 0, completedN = 0, arrivalsCount = 0;
  for (const tr of result.trucks) {
    if (tr.arrivalTime > t) break;
    if (category && deriveArrivalCategory(tr.job) !== category) continue;
    arrivalsCount++;
    if (tr.serviceStart != null && tr.serviceStart <= t) {
      waitSum += tr.serviceStart - tr.arrivalTime;
      waitN++;
    }
    if (tr.departureTime != null && tr.departureTime <= t) {
      sysSum += tr.departureTime - tr.arrivalTime;
      completedN++;
    }
  }
  const n = completedN;
  const days = t / 1440;
  return {
    avgWait: waitN ? waitSum / waitN : 0,
    avgSystem: n ? sysSum / n : 0,
    throughputPerDay: days > 0 ? n / days : 0,
    completedCount: n,
    arrivalsCount,
  };
}

/** Population standard deviation of a plain numeric array — the values
 *  passed in (a job type's completed-so-far flow times) are treated as the
 *  entire currently-observed population, not a sample drawn from a larger
 *  one, so this divides by n rather than n-1. Shared by liveFlowStats
 *  below; kept standalone since it's generic and has no simulation-specific
 *  assumptions baked in. */
function stdDev(values, avg) {
  if (values.length === 0) return 0;
  const variance = values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/** Live "so-far" flow-time statistics for one job type as of playback time
 *  t — the Flow Time Analysis page's stat tiles. "Flow time" is
 *  time-in-system (departureTime - arrivalTime), so — exactly like
 *  liveKpis' avgSystem above — only trucks that have actually DEPARTED by
 *  t are included; a truck still queued or in service has a right-censored
 *  flow time that isn't known yet. Computed fresh from `result.trucks`
 *  every call (an O(arrived-so-far) scan, same cost class as liveKpis)
 *  rather than read from a coarse precomputed sample grid, so every number
 *  here is exact as of the current instant, not interpolated between
 *  sample points — median/min/max/stdDev have no meaningful "cumulative
 *  running" analog the way an average does, so there's no lighter-weight
 *  precomputed series they could be drawn from anyway. The chart on that
 *  page instead uses the precomputed, sampled `computeFlowTimeSeries`
 *  running-average series (see desEngine.js) for smooth, cheap-to-render
 *  trend drawing — this function is only for the exact-as-of-now tiles. */
/** Shared tail end of liveFlowStats/liveFlowStatsFiltered: turns a plain
 *  array of flow-time values into n/avg/median/min/max/stdDev. Extracted so
 *  both functions compute these identically — no risk of the per-job-type
 *  view and the new per-category view ever disagreeing on how a stat is
 *  defined. */
function computeStatsFromValues(values) {
  const n = values.length;
  if (n === 0) return { n: 0, avg: 0, median: 0, min: 0, max: 0, stdDev: 0 };
  values.sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  const avg = sum / n;
  const median = n % 2 === 1 ? values[(n - 1) / 2] : (values[n / 2 - 1] + values[n / 2]) / 2;
  return { n, avg, median, min: values[0], max: values[n - 1], stdDev: stdDev(values, avg) };
}

/** Generalized version of liveFlowStats: same exact-as-of-now flow-time
 *  statistics, but over any predicate on the truck record instead of a
 *  fixed jobId — used by the Flow Time Analysis page's new "All Jobs" /
 *  "Accident Repair" / "Standard" category views (liveFlowStats itself
 *  below is now a thin wrapper over this, so the original per-job-type view
 *  computes exactly as it always did). */
export function liveFlowStatsFiltered(result, t, predicate) {
  const values = [];
  for (const tr of result.trucks) {
    if (tr.arrivalTime > t) break; // trucks are created in arrival-time order
    if (!predicate(tr)) continue;
    if (tr.departureTime != null && tr.departureTime <= t) {
      values.push(tr.departureTime - tr.arrivalTime);
    }
  }
  return computeStatsFromValues(values);
}

export function liveFlowStats(result, t, jobId) {
  return liveFlowStatsFiltered(result, t, (tr) => tr.job.id === jobId);
}

/** Summary statistics for one completed simulated day — dayIndex 0 covers
 *  minutes [0, 1440), dayIndex 1 covers [1440, 2880), and so on. Powers the
 *  day-completion overlay (useSimulation.js pauses playback right at each
 *  day boundary and DayCompleteOverlay.jsx renders this for the day that
 *  just ended). Every figure is derived directly from the engine's own
 *  recorded interval/truck data, clipped to the day's window with the same
 *  clip-and-sum technique desEngine.js's own final bayUtil/deptUtil
 *  calculation uses over the whole horizon (see simulate()'s comments) —
 *  just re-windowed to a single day instead of [0, horizonMinutes]. */
export function computeDaySummary(result, dayIndex) {
  const dayStart = dayIndex * 1440;
  const dayEnd = Math.min((dayIndex + 1) * 1440, result.totalDuration);
  const dayLen = Math.max(0, dayEnd - dayStart);
  const clip = (s, e) => Math.max(0, Math.min(e, dayEnd) - Math.max(s, dayStart));

  // Trucks processed: departed within this day's window. "Processed" means
  // fully finished and gone — a truck that started service today but
  // departs tomorrow is counted on the day it actually leaves, matching how
  // "completed" is defined everywhere else in this app (liveKpis,
  // liveFlowStats). Waiting time is counted on the day service actually
  // began, since a wait is a settled quantity the moment service starts
  // (same reasoning as liveKpis' avgWait).
  let trucksProcessed = 0;
  let waitSum = 0, waitN = 0;
  for (const tr of result.trucks) {
    if (tr.arrivalTime >= dayEnd) break; // trucks are created in arrival-time order
    if (tr.departureTime != null && tr.departureTime >= dayStart && tr.departureTime < dayEnd) trucksProcessed++;
    if (tr.serviceStart != null && tr.serviceStart >= dayStart && tr.serviceStart < dayEnd) {
      waitSum += tr.serviceStart - tr.arrivalTime;
      waitN++;
    }
  }
  const avgWaitingTime = waitN ? waitSum / waitN : 0;

  // Bay utilization for the day: recorded busy intervals per bay type,
  // clipped to the day window, divided by that type's total bay-minutes
  // available in the day.
  let bayBusyMin = 0, bayCapMin = 0;
  ['Bu', 'Be', 'Bi'].forEach((type) => {
    const count = result.cfg.bays[type];
    if (count <= 0) return;
    bayCapMin += count * dayLen;
    result.baySlots[type].forEach((slot) => {
      slot.intervals.forEach((iv) => { bayBusyMin += clip(iv.start, iv.end); });
    });
  });
  const bayUtilization = bayCapMin > 0 ? bayBusyMin / bayCapMin : 0;

  // Worker/department utilization for the day, same clip-and-sum technique
  // applied to deptIntervals (each interval also carries a worker `count`,
  // since a single job can occupy more than one worker of a department).
  let deptBusyMin = 0, deptCapMin = 0;
  const perDept = DEPT_KEYS.map((k) => {
    const cap = result.deptAvail[k] || 0;
    let busy = 0;
    result.deptIntervals[k].forEach((iv) => { busy += clip(iv.start, iv.end) * (iv.count || 1); });
    deptCapMin += cap * dayLen;
    deptBusyMin += busy;
    return { key: k, name: DEPT_NAMES[k], utilization: cap > 0 && dayLen > 0 ? busy / (cap * dayLen) : 0 };
  });
  const workerUtilization = deptCapMin > 0 ? deptBusyMin / deptCapMin : 0;

  // Bottleneck of the day: whichever single bay type or department ran the
  // hottest (highest utilization) *during this specific day* — the same
  // "highest utilization wins" rule buildFrame() uses for the live
  // instantaneous bottleneck, applied to a day-long average instead of one
  // instant. `kind`/`key` match buildFrame()'s bottleneck shape so the UI
  // can reuse the same bottleneckColorFor() color lookup.
  let bottleneck = null, bnUtil = -1;
  ['Bu', 'Be', 'Bi'].forEach((type) => {
    const count = result.cfg.bays[type];
    if (count <= 0) return;
    let busy = 0;
    result.baySlots[type].forEach((slot) => slot.intervals.forEach((iv) => { busy += clip(iv.start, iv.end); }));
    const u = dayLen > 0 ? busy / (count * dayLen) : 0;
    if (u > bnUtil) { bnUtil = u; bottleneck = { kind: 'bay', key: type, label: BAY_LABELS[type] + 's', utilization: u }; }
  });
  perDept.forEach((d) => {
    if (d.utilization > bnUtil) { bnUtil = d.utilization; bottleneck = { kind: 'dept', key: d.key, label: d.name + ' Dept', utilization: d.utilization }; }
  });

  // Throughput: cumulative average trucks/day across the whole run so far
  // (elapsed days through the end of this day) — the exact same
  // completedCount/elapsedDays figure the live Throughput/day KPI reports.
  // Deliberately distinct from `trucksProcessed` above (this one day's own
  // count): showing both lets a user see "how today went" alongside "how
  // the whole run is trending".
  const completedThroughDayEnd = result.trucks.filter((tr) => tr.departureTime != null && tr.departureTime <= dayEnd).length;
  const elapsedDays = dayEnd / 1440;
  const throughputPerDay = elapsedDays > 0 ? completedThroughDayEnd / elapsedDays : 0;

  return {
    dayIndex,
    dayNumber: dayIndex + 1,
    dayStart,
    dayEnd,
    trucksProcessed,
    avgWaitingTime,
    throughputPerDay,
    bayUtilization,
    workerUtilization,
    bottleneck,
  };
}

/** Full-horizon, coarse (day-scale) version of the KPI-card metrics —
 *  computed once per run, sampled at `numPoints` evenly-spaced times from
 *  day 0 through the current run's full duration. This is the "zoomed all
 *  the way out" counterpart to `buildTrends`' short recent-snapshot window:
 *  the expanded KPI chart starts zoomed into that fine recent window, and
 *  pinch-zooming out swaps to this coarser full-run series instead, so the
 *  same chart can show both "what just happened" and "the whole run so
 *  far" without ever re-deriving anything beyond what `simulate()` already
 *  produced. Every value here is computed from the same read-only
 *  `snapshotAt`/`liveKpis` selectors already used elsewhere — no new
 *  simulation logic, just resampled at a coarser, fixed grid. */
export function buildFullKpiSeries(result, numPoints = 120) {
  const total = result.totalDuration || 1;
  const sampleTimes = [];
  for (let i = 0; i <= numPoints; i++) sampleTimes.push((total * i) / numPoints);

  const totalBays = result.cfg.bays.Bu + result.cfg.bays.Be + result.cfg.bays.Bi;
  const deptTotal = DEPT_KEYS.reduce((s, k) => s + (result.deptAvail[k] || 0), 0);

  const queueLen = [], bayBusyPct = [], deptUtilPct = [], busyBays = [], idleBays = [];
  const avgWait = [], avgSystem = [], throughputPerDay = [], completedCount = [];

  sampleTimes.forEach((t) => {
    const snap = result.snapshots.length ? snapshotAt(result, t) : { queueLen: 0, dept: {}, bay: {} };
    const busyTotal = (snap.bay.Bu || 0) + (snap.bay.Be || 0) + (snap.bay.Bi || 0);
    queueLen.push(snap.queueLen || 0);
    bayBusyPct.push(totalBays > 0 ? (busyTotal / totalBays) * 100 : 0);
    busyBays.push(busyTotal);
    idleBays.push(Math.max(0, totalBays - busyTotal));
    const deptBusyTotal = DEPT_KEYS.reduce((s, k) => s + (snap.dept[k] || 0), 0);
    deptUtilPct.push(deptTotal > 0 ? (deptBusyTotal / deptTotal) * 100 : 0);

    const live = liveKpis(result, t);
    avgWait.push(live.avgWait);
    avgSystem.push(live.avgSystem);
    throughputPerDay.push(live.throughputPerDay);
    completedCount.push(live.completedCount);
  });

  return { sampleTimes, queueLen, bayBusyPct, deptUtilPct, busyBays, idleBays, avgWait, avgSystem, throughputPerDay, completedCount };
}

/** Rolling "average waiting time observed so far, as of each sample time"
 *  series — used by the Average Waiting Time chart. Purely derived from the
 *  already-simulated truck records, sampled on the same time grid as
 *  computeUtilSeries so all historical charts share one x-axis.
 *
 *  Optional `category` ('accident' | 'standard') restricts the series to
 *  trucks whose deriveArrivalCategory(tr.job) matches — used to split the
 *  Waiting Time chart into two series. Omitting it (default `null`)
 *  reproduces the exact original combined-series behavior. */
export function computeWaitSeries(result, sampleTimes, category = null) {
  const started = result.trucks
    .filter(tr => tr.serviceStart != null && (!category || deriveArrivalCategory(tr.job) === category))
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

/** Arrival-category counterpart to desEngine.js's computeFlowTimeSeries —
 *  same precompute-once, sample-and-binary-search shape, same "flow time =
 *  time in system" definition, same sampleTimes grid formula (so passing
 *  the same numPoints as computeFlowTimeSeries produces an identical
 *  sampleTimes array), but grouped by 'all' / 'accident' / 'standard'
 *  instead of by individual job id — powers the Flow Time Analysis page's
 *  new category dropdown options and their charts. Lives here rather than
 *  in desEngine.js so that file's diff stays limited to the one arrival-mix
 *  change this feature actually requires. */
export function computeCategoryFlowTimeSeries(result, numPoints) {
  const total = result.totalDuration || 1;
  const sampleTimes = [];
  for (let i = 0; i <= numPoints; i++) sampleTimes.push(total * i / numPoints);

  const GROUPS = {
    all: () => true,
    accident: (tr) => deriveArrivalCategory(tr.job) === 'accident',
    standard: (tr) => deriveArrivalCategory(tr.job) === 'standard',
  };

  const byCategory = {};
  Object.entries(GROUPS).forEach(([key, predicate]) => {
    const departed = result.trucks
      .filter((tr) => predicate(tr) && tr.departureTime != null)
      .map((tr) => ({ t: tr.departureTime, flow: tr.departureTime - tr.arrivalTime }))
      .sort((a, b) => a.t - b.t);
    const n = departed.length;
    const prefix = new Array(n + 1).fill(0);
    for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + departed[i].flow;

    const series = sampleTimes.map((t2) => {
      if (n === 0 || t2 <= 0) return null;
      let lo = 0, hi = n - 1, ans = -1;
      while (lo <= hi) { const mid = (lo + hi) >> 1; if (departed[mid].t <= t2) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
      if (ans < 0) return null;
      const count = ans + 1;
      return prefix[count] / count;
    });
    byCategory[key] = { series, totalCompleted: n };
  });

  return { sampleTimes, byCategory };
}

/** Full-run (not "so far") totals comparing Accident Repair vs. Standard —
 *  powers the Simulation Summary panel. Computed once over the entire
 *  precomputed result (using result.totalDuration as the cutoff — every
 *  arrival/departure that will ever happen in this run has already
 *  happened by then), not tied to live playback position, since "at the
 *  end of the simulation" describes the whole run's outcome, not a moment
 *  the user has to scrub to. `observedAccidentRatio` is arrivals-based
 *  (accident arrivals ÷ total pool arrivals) to directly compare against
 *  `result.cfg.accidentPct`, the configured split of that same arrival
 *  pool. */
export function computeCategorySummary(result) {
  const t = result.totalDuration;
  const accidentLive = liveKpis(result, t, 'accident');
  const standardLive = liveKpis(result, t, 'standard');
  const accidentFlow = liveFlowStatsFiltered(result, t, (tr) => deriveArrivalCategory(tr.job) === 'accident');
  const standardFlow = liveFlowStatsFiltered(result, t, (tr) => deriveArrivalCategory(tr.job) === 'standard');
  const poolArrivals = accidentLive.arrivalsCount + standardLive.arrivalsCount;

  return {
    configuredAccidentRatio: Math.min(1, Math.max(0, result.cfg.accidentPct ?? 0.4)),
    observedAccidentRatio: poolArrivals > 0 ? accidentLive.arrivalsCount / poolArrivals : 0,
    accidentArrivals: accidentLive.arrivalsCount,
    standardArrivals: standardLive.arrivalsCount,
    accidentCompletions: accidentLive.completedCount,
    standardCompletions: standardLive.completedCount,
    accidentAvgFlowTime: accidentFlow.avg,
    standardAvgFlowTime: standardFlow.avg,
  };
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
