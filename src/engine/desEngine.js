/* =========================================================================
   KM TRANS LOGISTICS — WORKSHOP DES ENGINE
   Ported unchanged from the original prototype. No simulation logic,
   distributions, scheduling rules, or formulas were altered — only the
   module boundary (plain exports instead of a <script> global) changed.
   ========================================================================= */

export const DEPT_KEYS = ['mech', 'dent', 'bal', 'elec', 'weld', 'tire'];
export const DEPT_NAMES = { mech: 'Mechanical', dent: 'Denting', bal: 'Balancer', elec: 'Electrician', weld: 'Welder', tire: 'Tire' };
export const DEFAULT_DEPTS = {
  mech: { total: 14, high: 3, med: 8, low: 3, absent: 0 },
  dent: { total: 5, high: 3, med: 1, low: 1, absent: 0 },
  bal: { total: 3, high: 3, med: 0, low: 0, absent: 0 },
  elec: { total: 3, high: 3, med: 0, low: 0, absent: 0 },
  weld: { total: 6, high: 1, med: 4, low: 1, absent: 0 },
  tire: { total: 5, high: 5, med: 0, low: 0, absent: 0 },
};

export const JOB_TYPES = [
  { id: 'airfilter', name: 'Air Filter Change', category: 'standard', arrivalPerDay: 4.5, baseService: 5, bayType: 'Bu', req: { mech: 1 } },
  { id: 'engoil', name: 'Engine Oil Change', category: 'standard', arrivalPerDay: 3.8, baseService: 30, bayType: 'Bu', req: { mech: 1 } },
  { id: 'oiltop', name: 'Engine Oil Top-Up', category: 'standard', arrivalPerDay: 2.5, baseService: 15, bayType: 'Bu', req: { mech: 1 } },
  { id: 'battery', name: 'Battery Check/Change', category: 'standard', arrivalPerDay: 2.0, baseService: 20, bayType: 'Bu', req: { elec: 1 } },
  { id: 'brakeoil', name: 'Brake Oil', category: 'standard', arrivalPerDay: 2.2, baseService: 20, bayType: 'Bu', req: { mech: 1 } },
  { id: 'coolant', name: 'Coolant Change', category: 'standard', arrivalPerDay: 1.8, baseService: 20, bayType: 'Bu', req: { mech: 1 } },
  { id: 'pressure', name: 'Pressure Leakage', category: 'standard', arrivalPerDay: 2.78, baseService: 35, bayType: 'Bu', req: { mech: 1 } },
  { id: 'tirerepair', name: 'Tire Repair', category: 'standard', arrivalPerDay: 2.11, baseService: 30, bayType: 'Bu', req: { tire: 2 } },
  { id: 'wiring', name: 'Wiring', category: 'standard', arrivalPerDay: 6.18, baseService: 45, bayType: 'Bu', req: { elec: 1 } },
  { id: 'brakelining', name: 'Brake Lining Change', category: 'standard', arrivalPerDay: 1.5, baseService: 90, bayType: 'Bu', req: { mech: 1, tire: 1 } },
  { id: 'clutch', name: 'Clutch Overhaul', category: 'medium', arrivalPerDay: 0.9, baseService: 240, bayType: 'Bu', req: { mech: 2 } },
  { id: 'fuelinj', name: 'Fuel Injection Pump Repair', category: 'medium', arrivalPerDay: 0.6, baseService: 180, bayType: 'Bu', req: { mech: 2 } },
  { id: 'gear', name: 'Gear Overhaul', category: 'medium', arrivalPerDay: 0.5, baseService: 300, bayType: 'Bu', req: { mech: 2 } },
  { id: 'relay', name: 'Relay Valve Repair', category: 'medium', arrivalPerDay: 0.7, baseService: 120, bayType: 'Bu', req: { mech: 1 } },
  { id: 'selfalt', name: 'Self-Alternator Service', category: 'medium', arrivalPerDay: 0.5, baseService: 150, bayType: 'Bu', req: { elec: 1, mech: 1 } },
  { id: 'turbo', name: 'Turbo Check Change', category: 'medium', arrivalPerDay: 0.4, baseService: 200, bayType: 'Bu', req: { mech: 2 } },
  { id: 'denting', name: 'Denting', category: 'long', arrivalPerDay: 0.35, baseService: 240, bayType: 'Be', req: { dent: 2 } },
  { id: 'cabin', name: 'Cabin Setting', category: 'long', arrivalPerDay: 0.15, baseService: 480, bayType: 'Be', req: { dent: 2, weld: 1 } },
  { id: 'engoverhaul', name: 'Engine Overhaul', category: 'long', arrivalPerDay: 0.12, baseService: 900, bayType: 'Be', req: { mech: 3, elec: 1 } },
  { id: 'accident', name: 'Accident Repair', category: 'long', arrivalPerDay: 0.22, baseService: 6300, bayType: 'Be', req: { mech: 2, dent: 2, bal: 1, elec: 1, weld: 2, tire: 1 } },
  { id: 'inspection', name: 'Vehicle Inspection', category: 'inspection', arrivalPerDay: 3.0, baseService: 20, bayType: 'Bi', req: { mech: 1 } },
];

export function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

class MinHeap {
  constructor() { this.a = []; }
  push(item) { this.a.push(item); this._up(this.a.length - 1); }
  pop() {
    const top = this.a[0]; const last = this.a.pop();
    if (this.a.length) { this.a[0] = last; this._down(0); }
    return top;
  }
  get size() { return this.a.length; }
  _up(i) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.a[p].time <= this.a[i].time) break;
      [this.a[p], this.a[i]] = [this.a[i], this.a[p]]; i = p;
    }
  }
  _down(i) {
    const n = this.a.length;
    while (true) {
      let l = 2 * i + 1, r = 2 * i + 2, s = i;
      if (l < n && this.a[l].time < this.a[s].time) s = l;
      if (r < n && this.a[r].time < this.a[s].time) s = r;
      if (s === i) break;
      [this.a[s], this.a[i]] = [this.a[i], this.a[s]]; i = s;
    }
  }
}

export function fmtTime(minutes) {
  const day = Math.floor(minutes / 1440) + 1;
  const hh = Math.floor((minutes % 1440) / 60);
  const mm = Math.floor(minutes % 60);
  const pad = n => String(n).padStart(2, '0');
  return `Day ${day} · ${pad(hh)}:${pad(mm)}`;
}

function mean(arr) { if (!arr.length) return 0; return arr.reduce((a, b) => a + b, 0) / arr.length; }

export function simulate(cfg) {
  const rand = cfg.fixedSeed ? mulberry32(cfg.seed >>> 0) : mulberry32((Date.now() & 0xffffffff) >>> 0);
  const uniform = () => { let u = rand(); return u <= 0 ? 1e-9 : u; };
  const exponential = rate => -Math.log(uniform()) / rate;
  const triangular = (a, b, c) => {
    const u = uniform(); const fc = (b - a) / (c - a);
    if (u < fc) return a + Math.sqrt(u * (c - a) * (b - a));
    return c - Math.sqrt((1 - u) * (c - a) * (c - b));
  };

  const deptAvail = {}, deptSkillMult = {};
  DEPT_KEYS.forEach(k => {
    const d = cfg.departments[k];
    const avgSkill = d.total > 0 ? (d.high * 9 + d.med * 6 + d.low * 3) / d.total : 10;
    deptSkillMult[k] = 10 / Math.max(avgSkill, 1);
    deptAvail[k] = Math.max(0, Math.round(d.total * (1 - d.absent)));
  });

  const baySlots = {};
  ['Bu', 'Be', 'Bi'].forEach(t => {
    baySlots[t] = [];
    for (let i = 0; i < cfg.bays[t]; i++) baySlots[t].push({ id: t + (i + 1), intervals: [], busyUntil: 0 });
  });

  const deptBusy = {}; DEPT_KEYS.forEach(k => deptBusy[k] = 0);
  const bayBusyCount = { Bu: 0, Be: 0, Bi: 0 };

  const horizonMinutes = cfg.horizonDays * 1440;
  const trucks = [];
  const queue = [];
  const FEL = new MinHeap();
  const snapshots = [];
  const eventsLog = [];
  let truckIdCounter = 1;

  function recordSnapshot(t) {
    snapshots.push({ t, queueLen: queue.length, bay: { ...bayBusyCount }, dept: { ...deptBusy } });
  }
  function bayTypeForJob(job) {
    if (job.bayType === 'Be' && cfg.bays.Be === 0) return 'Bu';
    return job.bayType;
  }
  function canAllocate(job, bt) {
    if (bayBusyCount[bt] >= cfg.bays[bt]) return false;
    for (const dk in job.req) { if (deptBusy[dk] + job.req[dk] > deptAvail[dk]) return false; }
    return true;
  }
  function allocate(truck, bt, t) {
    const slot = baySlots[bt].find(s => s.busyUntil <= t);
    bayBusyCount[bt]++;
    for (const dk in truck.job.req) deptBusy[dk] += truck.job.req[dk];
    truck.serviceStart = t;
    truck.bay = slot.id;
    truck.serviceEnd = t + truck.serviceTime;
    slot.busyUntil = truck.serviceEnd;
    slot.intervals.push({ start: t, end: truck.serviceEnd, truckId: truck.id, jobName: truck.job.name, category: truck.job.category, vehicleType: truck.vehicleType });
    FEL.push({ time: truck.serviceEnd, type: 'completion', payload: { truckId: truck.id, bt } });
    eventsLog.push({
      t, type: 'start', category: truck.job.category, truckId: truck.id, bay: slot.id, vehicleType: truck.vehicleType,
      text: `#${truck.id} ${truck.job.name} (${truck.vehicleType}) starts at Bay ${slot.id} — est. ${Math.round(truck.serviceTime)} min`
    });
  }
  function sortQueue(policy) {
    const arr = queue.slice();
    const vp = t => t.vehicleType === 'Car Carrier' ? 0 : 1;
    if (policy === 'fcfs') arr.sort((a, b) => a.arrivalTime - b.arrivalTime);
    else if (policy === 'sjf') arr.sort((a, b) => a.serviceTime - b.serviceTime);
    else if (policy === 'priority') arr.sort((a, b) => vp(a) - vp(b) || a.arrivalTime - b.arrivalTime);
    else arr.sort((a, b) => vp(a) - vp(b) || a.serviceTime - b.serviceTime);
    return arr;
  }
  function tryStartQueued(t) {
    let progressed = true;
    while (progressed) {
      progressed = false;
      const sorted = sortQueue(cfg.policy);
      for (const truck of sorted) {
        const bt = bayTypeForJob(truck.job);
        if (canAllocate(truck.job, bt)) {
          const idx = queue.indexOf(truck);
          queue.splice(idx, 1);
          allocate(truck, bt, t);
          progressed = true;
          break;
        }
      }
    }
  }

  JOB_TYPES.forEach(job => {
    const rate = job.arrivalPerDay / 1440;
    if (rate > 0) FEL.push({ time: exponential(rate), type: 'arrival', payload: { jobId: job.id } });
  });

  const SAFETY_LIMIT = 400000;
  let guard = 0;
  while (FEL.size && guard < SAFETY_LIMIT) {
    guard++;
    const ev = FEL.pop();
    const t = ev.time;
    if (ev.type === 'arrival') {
      const job = JOB_TYPES.find(j => j.id === ev.payload.jobId);
      const rate = job.arrivalPerDay / 1440;
      if (t <= horizonMinutes) {
        const vehicleType = uniform() < cfg.carCarrierPct ? 'Car Carrier' : 'Flatbed Carrier';
        let base;
        if (job.category === 'long') base = triangular(job.baseService * 0.5, job.baseService, job.baseService * 2);
        else base = triangular(job.baseService * 0.7, job.baseService, job.baseService * 1.5);
        const reqDepts = Object.keys(job.req);
        const mult = reqDepts.length ? reqDepts.reduce((s, k) => s + deptSkillMult[k], 0) / reqDepts.length : 1;
        const serviceTime = base * mult;
        const truck = {
          id: truckIdCounter++, job, vehicleType, arrivalTime: t, serviceTime,
          queueEntryTime: null, serviceStart: null, serviceEnd: null, departureTime: null, bay: null
        };
        trucks.push(truck);
        eventsLog.push({ t, type: 'arrival', category: job.category, text: `#${truck.id} ${job.name} arrives (${vehicleType})` });
        const bt = bayTypeForJob(job);
        if (canAllocate(job, bt)) allocate(truck, bt, t);
        else {
          truck.queueEntryTime = t;
          queue.push(truck);
          eventsLog.push({ t, type: 'queue', category: job.category, text: `#${truck.id} ${job.name} added to waiting queue` });
        }
        recordSnapshot(t);
      }
      if (t <= horizonMinutes) FEL.push({ time: t + exponential(rate), type: 'arrival', payload: { jobId: job.id } });
    } else if (ev.type === 'completion') {
      const truck = trucks.find(x => x.id === ev.payload.truckId);
      const bt = ev.payload.bt;
      bayBusyCount[bt]--;
      for (const dk in truck.job.req) deptBusy[dk] -= truck.job.req[dk];
      truck.departureTime = t;
      eventsLog.push({ t, type: 'complete', category: truck.job.category, truckId: truck.id, bay: truck.bay, text: `#${truck.id} ${truck.job.name} completed — Bay ${truck.bay} released` });
      tryStartQueued(t);
      recordSnapshot(t);
    }
  }

  const completed = trucks.filter(x => x.departureTime != null);
  const waits = completed.map(x => x.serviceStart - x.arrivalTime);
  const sysTimes = completed.map(x => x.departureTime - x.arrivalTime);
  const avgWait = mean(waits);
  const avgSystem = mean(sysTimes);
  const delayProb = completed.length ? waits.filter(w => w > 0.01).length / completed.length : 0;
  const throughputPerDay = cfg.horizonDays > 0 ? completed.length / cfg.horizonDays : 0;

  const bayUtil = {};
  const bayUtilBySlot = [];
  ['Bu', 'Be', 'Bi'].forEach(t => {
    const cap = cfg.bays[t] * horizonMinutes;
    let busy = 0;
    baySlots[t].forEach(s => {
      let slotBusy = 0;
      s.intervals.forEach(iv => {
        const d = Math.max(0, Math.min(iv.end, horizonMinutes) - Math.min(iv.start, horizonMinutes));
        slotBusy += d; busy += d;
      });
      bayUtilBySlot.push({ id: s.id, type: t, util: horizonMinutes > 0 ? slotBusy / horizonMinutes : 0 });
    });
    bayUtil[t] = cap > 0 ? busy / cap : 0;
  });
  const deptUtil = {};
  DEPT_KEYS.forEach(k => {
    let busyMin = 0;
    completed.forEach(x => { if (x.job.req[k]) busyMin += x.job.req[k] * Math.max(0, Math.min(x.serviceEnd, horizonMinutes) - Math.min(x.serviceStart, horizonMinutes)); });
    const cap = deptAvail[k] * horizonMinutes;
    deptUtil[k] = cap > 0 ? busyMin / cap : 0;
  });

  let maxQueue = 0; snapshots.forEach(s => { if (s.queueLen > maxQueue) maxQueue = s.queueLen; });
  let avgQueue = 0;
  for (let i = 1; i < snapshots.length; i++) {
    avgQueue += snapshots[i - 1].queueLen * (snapshots[i].t - snapshots[i - 1].t);
  }
  const totalT = snapshots.length ? snapshots[snapshots.length - 1].t : 1;
  avgQueue = totalT > 0 ? avgQueue / totalT : 0;

  const arrivalsSorted = trucks.map(x => x.arrivalTime).sort((a, b) => a - b);
  const departuresSorted = completed.map(x => x.departureTime).sort((a, b) => a - b);
  const snapTimes = snapshots.map(s => s.t);
  const startEvents = eventsLog.filter(e => e.type === 'start');
  const startTimes = startEvents.map(e => e.t);

  return {
    cfg, trucks, baySlots, snapshots, eventsLog, deptAvail,
    arrivalsSorted, departuresSorted, snapTimes, startEvents, startTimes,
    horizonMinutes,
    totalDuration: totalT,
    kpis: { avgWait, avgSystem, delayProb, throughputPerDay, maxQueue, avgQueue, completedCount: completed.length, arrivedCount: trucks.length, bayUtil, bayUtilBySlot, deptUtil }
  };
}

/* Precomputes cumulative ("running") utilization series for every bay slot and
   every department, sampled at `numPoints` evenly-spaced times across the run.
   Used to draw the live-updating historical utilization charts. */
export function computeUtilSeries(result, numPoints) {
  const total = result.totalDuration || 1;
  const sampleTimes = [];
  for (let i = 0; i <= numPoints; i++) sampleTimes.push(total * i / numPoints);

  const baySlotSeries = {};
  ['Bu', 'Be', 'Bi'].forEach(t => {
    result.baySlots[t].forEach(slot => {
      const n = slot.intervals.length;
      const prefix = new Array(n + 1).fill(0);
      for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + (slot.intervals[i].end - slot.intervals[i].start);
      const series = sampleTimes.map(t2 => {
        if (n === 0 || t2 <= 0) return 0;
        let lo = 0, hi = n - 1, ans = -1;
        while (lo <= hi) { const mid = (lo + hi) >> 1; if (slot.intervals[mid].start <= t2) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
        if (ans < 0) return 0;
        const iv = slot.intervals[ans];
        const busy = prefix[ans] + Math.max(0, Math.min(t2, iv.end) - iv.start);
        return (busy / t2) * 100;
      });
      baySlotSeries[slot.id] = { type: t, series };
    });
  });

  const deptSeries = {};
  DEPT_KEYS.forEach(k => {
    const snaps = result.snapshots;
    const n = snaps.length;
    const prefix = new Array(Math.max(n, 1)).fill(0);
    for (let i = 1; i < n; i++) prefix[i] = prefix[i - 1] + snaps[i - 1].dept[k] * (snaps[i].t - snaps[i - 1].t);
    const cap = result.deptAvail[k];
    const series = sampleTimes.map(t2 => {
      if (n === 0 || t2 <= 0 || cap <= 0) return 0;
      let lo = 0, hi = n - 1, ans = -1;
      while (lo <= hi) { const mid = (lo + hi) >> 1; if (snaps[mid].t <= t2) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
      if (ans < 0) return 0;
      const busy = prefix[ans] + (snaps[ans].dept[k] || 0) * (t2 - snaps[ans].t);
      return (busy / (cap * t2)) * 100;
    });
    deptSeries[k] = series;
  });

  return { sampleTimes, baySlotSeries, deptSeries };
}
