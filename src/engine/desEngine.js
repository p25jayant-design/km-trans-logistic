/* =========================================================================
   KM TRANS LOGISTICS — WORKSHOP DES ENGINE
   Ported unchanged from the original prototype. No simulation logic,
   distributions, scheduling rules, or formulas were altered — only the
   module boundary (plain exports instead of a <script> global) changed.
   ========================================================================= */

/** In-workshop travel time (minutes, one-way) a truck spends physically
 *  moving between the entry gate and its assigned bay, and between its bay
 *  and the exit gate — i.e., the walking/driving overhead the spatial
 *  floor-plan view animates. This is a PLACEHOLDER assumption: the case
 *  materials available define arrival rates and service times (Exhibit 5)
 *  but no bay-to-bay transit distance/time figure, so these are reasonable
 *  estimates (a truck maneuvering into or out of a bay), not a value
 *  sourced from the case. Swap in the real figure here once available —
 *  this is the only place it's used. It only extends each truck's own
 *  recorded `departureTime` (and therefore avgSystem / time-in-system);
 *  it deliberately does NOT change bay/worker busy windows, so every
 *  previously-audited utilization, wait-time, and throughput invariant is
 *  unaffected. */
export const TRAVEL_TIME_MIN = { in: 3, out: 2 };

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

/** Accident Repair vs. Standard arrival-mix configuration (cfg.accidentPct).
 *
 *  What this changes: today, Accident Repair (`id === 'accident'`) and each
 *  of the 10 Standard-category jobs are seeded as 11 fully independent
 *  Poisson arrival streams, each at its own fixed `arrivalPerDay`. This
 *  feature replaces *only those 11 streams* with one combined stream of the
 *  exact same total rate (STANDARD_POOL_RATE + ACCIDENT_BASE_RATE — the sum
 *  never changes), which is then split, per arrival, into Accident vs.
 *  Standard by an independent coin flip against `cfg.accidentPct`, and — if
 *  Standard — further split among the 10 standard jobs using their existing
 *  relative `arrivalPerDay` weights. This is mathematically exact, not an
 *  approximation: splitting ("thinning") a Poisson process of rate R by a
 *  fixed probability p reproduces two independent Poisson processes at
 *  rates p·R and (1−p)·R — so setting `accidentPct` to today's *natural*
 *  ratio (ACCIDENT_BASE_RATE / ACCIDENT_STANDARD_POOL_RATE) reproduces
 *  today's exact behavior in distribution. See verify-accident-pool.mjs
 *  (run during development, not shipped) for the numerical confirmation of
 *  this.
 *
 *  What this does NOT change: every other job type (medium, Denting/Cabin
 *  Setting/Engine Overhaul, Inspection) keeps its own untouched independent
 *  stream at its own untouched rate. Once a truck's `job` is chosen —
 *  whether from this combined pool or from an untouched independent stream
 *  — every single line that follows (vehicle-type draw, service-time
 *  formula, bay/department routing, queueing, allocation, event logging) is
 *  the exact same code, completely unaware this feature exists. */
const STANDARD_JOBS = JOB_TYPES.filter((j) => j.category === 'standard');
const ACCIDENT_JOB = JOB_TYPES.find((j) => j.id === 'accident');
const STANDARD_POOL_RATE = STANDARD_JOBS.reduce((s, j) => s + j.arrivalPerDay, 0); // 29.37/day, fixed catalog constant
const ACCIDENT_BASE_RATE = ACCIDENT_JOB.arrivalPerDay; // 0.22/day, fixed catalog constant
const ACCIDENT_STANDARD_POOL_RATE = STANDARD_POOL_RATE + ACCIDENT_BASE_RATE; // 29.59/day — total volume for this pool, invariant under cfg.accidentPct

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
  // Recorded exactly like `slot.intervals` (pushed at allocate() time, one
  // entry per truck's actual worker occupancy window) — this is what
  // deptUtil is computed from below, the same way bayUtil is computed from
  // `slot.intervals`, instead of re-deriving department busy-time from
  // whichever trucks happen to be in a `completed` filter at report time.
  const deptIntervals = {}; DEPT_KEYS.forEach(k => deptIntervals[k] = []);

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
    for (const dk in truck.job.req) {
      deptIntervals[dk].push({ start: t, end: truck.serviceEnd, truckId: truck.id, count: truck.job.req[dk] });
    }
    truck.events.push({ type: 'serviceStart', t, bay: slot.id });
    if (truck.job.category === 'inspection') truck.events.push({ type: 'inspectionStart', t, bay: slot.id });
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

  // Accident Repair / Standard arrival mix — see the comment above
  // ACCIDENT_STANDARD_POOL_RATE for the full explanation. `accidentPct` is
  // read here (once) and clamped defensively; `pickStandardJob()` draws a
  // fresh, independent uniform() to weighted-pick among the 10 standard
  // jobs by their existing relative arrivalPerDay — a second, separate draw
  // from the accident-vs-standard coin flip below, so the two decisions
  // don't share (and don't bias) the same random number.
  const accidentPct = Math.min(1, Math.max(0, cfg.accidentPct ?? 0.4));
  let standardCumWeight = 0;
  const standardCumWeights = STANDARD_JOBS.map((j) => (standardCumWeight += j.arrivalPerDay));
  function pickStandardJob() {
    const u = uniform() * STANDARD_POOL_RATE;
    for (let i = 0; i < STANDARD_JOBS.length; i++) {
      if (u <= standardCumWeights[i]) return STANDARD_JOBS[i];
    }
    return STANDARD_JOBS[STANDARD_JOBS.length - 1];
  }

  JOB_TYPES.forEach(job => {
    // Accident Repair and every Standard-category job are seeded from the
    // single combined pool event below instead of their own individual
    // stream — everything else keeps its own untouched independent stream.
    if (job.id === 'accident' || job.category === 'standard') return;
    const rate = job.arrivalPerDay / 1440;
    if (rate > 0) FEL.push({ time: exponential(rate), type: 'arrival', payload: { jobId: job.id } });
  });
  const poolRatePerMin = ACCIDENT_STANDARD_POOL_RATE / 1440;
  if (poolRatePerMin > 0) FEL.push({ time: exponential(poolRatePerMin), type: 'arrival', payload: { pool: true } });

  const SAFETY_LIMIT = 400000;
  let guard = 0;
  while (FEL.size && guard < SAFETY_LIMIT) {
    guard++;
    const ev = FEL.pop();
    const t = ev.time;
    if (ev.type === 'arrival') {
      // Every arrival from the combined pool is classified Accident Repair
      // vs. Standard right here — the ONLY place this feature touches
      // arrival generation. Once `job` is resolved (whichever branch), every
      // line below is byte-for-byte the same code any other arrival has
      // always used: same vehicle-type draw, same triangular service-time
      // formula keyed off job.category, same routing/allocation/queueing.
      let job, rate;
      if (ev.payload.pool) {
        job = uniform() < accidentPct ? ACCIDENT_JOB : pickStandardJob();
        rate = poolRatePerMin;
      } else {
        job = JOB_TYPES.find(j => j.id === ev.payload.jobId);
        rate = job.arrivalPerDay / 1440;
      }
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
          queueEntryTime: null, serviceStart: null, serviceEnd: null, departureTime: null, bay: null,
          // Full lifecycle event history — every timestamp this truck's KPIs
          // are ever derived from gets recorded here as it actually happens,
          // so avgWait/avgSystem/etc. (and validateSimulation, below) can be
          // recomputed independently from raw events rather than trusting
          // any single ad-hoc field. `category === 'inspection'` jobs also
          // get an aliased 'inspectionStart'/'inspectionEnd' pair at the
          // exact same instants as 'serviceStart'/'serviceEnd', since in
          // this model Inspection is a job category served in its own bay
          // type (Bi), not a separate stage every truck passes through
          // first — so "the inspection event" for an inspection job *is*
          // its service window.
          events: [],
        };
        truck.events.push({ type: 'arrival', t });
        trucks.push(truck);
        eventsLog.push({ t, type: 'arrival', category: job.category, text: `#${truck.id} ${job.name} arrives (${vehicleType})` });
        const bt = bayTypeForJob(job);
        if (canAllocate(job, bt)) allocate(truck, bt, t);
        else {
          truck.queueEntryTime = t;
          truck.events.push({ type: 'queued', t });
          queue.push(truck);
          eventsLog.push({ t, type: 'queue', category: job.category, text: `#${truck.id} ${job.name} added to waiting queue` });
        }
        recordSnapshot(t);
      }
      if (t <= horizonMinutes) {
        FEL.push({ time: t + exponential(rate), type: 'arrival', payload: ev.payload.pool ? { pool: true } : { jobId: job.id } });
      }
    } else if (ev.type === 'completion') {
      const truck = trucks.find(x => x.id === ev.payload.truckId);
      const bt = ev.payload.bt;
      bayBusyCount[bt]--;
      for (const dk in truck.job.req) deptBusy[dk] -= truck.job.req[dk];
      // Bay/worker release happens exactly on schedule (above) — only the
      // truck's own recorded departure is pushed out by the round-trip
      // travel overhead (see TRAVEL_TIME_MIN), since walking/driving out
      // doesn't keep the bay or its workers occupied.
      truck.events.push({ type: 'serviceEnd', t, bay: truck.bay });
      if (truck.job.category === 'inspection') truck.events.push({ type: 'inspectionEnd', t, bay: truck.bay });
      truck.departureTime = t + TRAVEL_TIME_MIN.in + TRAVEL_TIME_MIN.out;
      truck.events.push({ type: 'departure', t: truck.departureTime });
      eventsLog.push({ t, type: 'complete', category: truck.job.category, truckId: truck.id, bay: truck.bay, text: `#${truck.id} ${truck.job.name} completed — Bay ${truck.bay} released` });
      tryStartQueued(t);
      recordSnapshot(t);
    }
  }

  // --- KPI computation ------------------------------------------------
  // Every metric below is derived directly from recorded timestamps
  // (truck.arrivalTime / serviceStart / serviceEnd / departureTime, or the
  // `events` array those fields are populated from) or from the recorded
  // interval lists (`slot.intervals`, `deptIntervals`) — never from a
  // separately-maintained counter that could drift out of sync. See
  // `validateSimulation()` below, which independently re-derives queue
  // length / bay busy count / department busy count from these same raw
  // truck records and cross-checks them against the incrementally-tracked
  // `snapshots`, to catch exactly that kind of drift if it ever occurs.

  // Average Waiting Time / delay probability: defined over every truck
  // that has STARTED service (its wait is a completed, realized quantity
  // the moment service starts) — deliberately NOT scoped to trucks that
  // have additionally finished service and departed, since a truck's wait
  // time has nothing to do with how long its service or exit travel takes.
  // Using `completed` (departureTime != null) here would happen to produce
  // the same number in ordinary runs (this engine always drains every
  // started service to completion before returning — see the FEL loop's
  // unconditional handling of 'completion' events), but tying the
  // *meaning* of "wait time" to "and also has left the building" is the
  // wrong dependency, and would silently under-report if that draining
  // guarantee were ever violated (e.g. the SAFETY_LIMIT guard tripping).
  const started = trucks.filter(x => x.serviceStart != null);
  const waits = started.map(x => x.serviceStart - x.arrivalTime);
  const avgWait = mean(waits);
  const delayProb = started.length ? waits.filter(w => w > 0.01).length / started.length : 0;

  // Average Time in System: genuinely requires a completed departure — a
  // truck still queued or still in service has a right-censored (unknown,
  // not-yet-realized) system time, which is correctly excluded rather than
  // guessed at.
  const completed = trucks.filter(x => x.departureTime != null);
  const sysTimes = completed.map(x => x.departureTime - x.arrivalTime);
  const avgSystem = mean(sysTimes);
  const throughputPerDay = cfg.horizonDays > 0 ? completed.length / cfg.horizonDays : 0;

  // Bay Utilization: sum of each slot's recorded busy intervals, clipped to
  // the configured horizon (a job that's still running when the horizon
  // ends only counts for the portion of its duration that falls within the
  // horizon — the engine keeps simulating past the horizon just to drain
  // in-progress jobs to a real completion instead of truncating them, but
  // that drain tail isn't part of the reported operating period).
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

  // Worker (department) Utilization: computed the exact same way as Bay
  // Utilization — sum of recorded busy intervals (`deptIntervals`, pushed
  // in `allocate()` alongside `slot.intervals`), clipped to the horizon —
  // rather than re-deriving busy-minutes by filtering `trucks` down to
  // whichever ones happen to be in `completed` at report time. Those two
  // approaches agree in every normal run (every started job does
  // eventually complete before `simulate()` returns), but computing
  // straight from the recorded intervals is the more direct, more robust
  // reading of "what actually happened", and keeps this metric's
  // methodology symmetric with Bay Utilization's.
  const deptUtil = {};
  DEPT_KEYS.forEach(k => {
    let busy = 0;
    deptIntervals[k].forEach(iv => {
      const d = Math.max(0, Math.min(iv.end, horizonMinutes) - Math.min(iv.start, horizonMinutes));
      busy += d * iv.count;
    });
    const cap = deptAvail[k] * horizonMinutes;
    deptUtil[k] = cap > 0 ? busy / cap : 0;
  });

  // Queue-length statistics: `snapshots` records the queue length at every
  // arrival and completion instant, including the "drain tail" after the
  // horizon (completions keep firing, and keep calling recordSnapshot,
  // until every in-progress job actually finishes — see the FEL loop).
  // maxQueue is unaffected by that tail (queue length can only ever
  // decrease once arrivals stop, since nothing after the horizon can add
  // to it), but a time-*average* must not include it, or a single
  // long-running job still active at the horizon boundary (this case's
  // "Accident Repair" jobs run up to 12,600 minutes) silently drags the
  // averaging window out past the reported operating period and dilutes
  // the result. avgQueue therefore integrates the queue-length step
  // function over exactly [0, horizonMinutes], not over the full extended
  // snapshot range.
  let maxQueue = 0; snapshots.forEach(s => { if (s.queueLen > maxQueue) maxQueue = s.queueLen; });
  let avgQueue = 0;
  {
    let prevT = 0, prevLen = 0;
    for (const s of snapshots) {
      const segEnd = Math.min(s.t, horizonMinutes);
      if (segEnd > prevT) avgQueue += prevLen * (segEnd - prevT);
      prevT = segEnd;
      prevLen = s.queueLen;
      if (s.t >= horizonMinutes) break;
    }
    if (prevT < horizonMinutes) avgQueue += prevLen * (horizonMinutes - prevT);
  }
  avgQueue = horizonMinutes > 0 ? avgQueue / horizonMinutes : 0;

  // Full extended timeline (including the post-horizon drain tail) — used
  // as the x-axis range for the historical/running-utilization charts,
  // which deliberately DO show that tail (e.g. "queue drains to zero as
  // the last few jobs wrap up" is accurate, useful information for a time
  // series, unlike a single averaged KPI number where the same tail would
  // just dilute the result — see avgQueue above). Not used by any KPI.
  const totalT = snapshots.length ? snapshots[snapshots.length - 1].t : 1;

  const arrivalsSorted = trucks.map(x => x.arrivalTime).sort((a, b) => a - b);
  const departuresSorted = completed.map(x => x.departureTime).sort((a, b) => a - b);
  const snapTimes = snapshots.map(s => s.t);
  const startEvents = eventsLog.filter(e => e.type === 'start');
  const startTimes = startEvents.map(e => e.t);

  const result = {
    cfg, trucks, baySlots, deptIntervals, snapshots, eventsLog, deptAvail,
    arrivalsSorted, departuresSorted, snapTimes, startEvents, startTimes,
    horizonMinutes,
    totalDuration: totalT,
    kpis: { avgWait, avgSystem, delayProb, throughputPerDay, maxQueue, avgQueue, completedCount: completed.length, arrivedCount: trucks.length, bayUtil, bayUtilBySlot, deptUtil }
  };
  result.validation = validateSimulation(result);
  if (!result.validation.ok && typeof console !== 'undefined') {
    // Never silently wrong: any invariant violation is surfaced loudly in
    // the console (and available to any caller via result.validation) even
    // though the UI doesn't hard-fail the run on it.
    console.error('[DES engine] validateSimulation found issues:', result.validation.issues);
  }
  return result;
}

/** Independent, read-only cross-check that everything the UI displays as
 *  "the simulation state" actually matches what the recorded truck/interval
 *  data implies — not a second copy of the simulation logic, but a
 *  from-scratch recomputation of queue length, bay busy count, and
 *  department busy count from the raw truck timestamps and bay/department
 *  intervals, compared against the incrementally-tracked `snapshots` the
 *  engine already produced. If the two ever disagree, it means the
 *  incremental bookkeeping (bayBusyCount/deptBusy/queue.length, updated
 *  step-by-step as events are processed) has drifted from what the
 *  recorded history actually says happened — exactly the class of bug this
 *  audit was asked to guard against. Also sanity-checks a handful of
 *  structural and range invariants (no bay double-booked, capacity never
 *  exceeded, utilizations in [0,1], counts non-negative, etc.). Returns
 *  `{ ok, issues }` — `issues` is a flat list of human-readable strings;
 *  never throws, so a validation failure is visible (console.error above,
 *  and inspectable via `result.validation`) without ever crashing a user's
 *  simulation run. */
export function validateSimulation(result) {
  const issues = [];
  const EPS = 1e-6;
  const { cfg, trucks, baySlots, deptIntervals, snapshots, deptAvail, horizonMinutes, kpis } = result;

  // 1. No bay slot ever double-booked: within a single slot, no two
  //    recorded intervals may overlap.
  ['Bu', 'Be', 'Bi'].forEach((type) => {
    baySlots[type].forEach((slot) => {
      const sorted = slot.intervals.slice().sort((a, b) => a.start - b.start);
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].start < sorted[i - 1].end - EPS) {
          issues.push(`Bay ${slot.id}: interval [${sorted[i - 1].start},${sorted[i - 1].end}] overlaps [${sorted[i].start},${sorted[i].end}]`);
        }
      }
    });
  });

  // 2. Every truck's recorded interval duration matches its computed
  //    service time exactly, and its departure equals serviceEnd plus the
  //    fixed travel overhead — catches any drift between the fields used
  //    to report KPIs and the fields used to schedule the simulation.
  trucks.forEach((tr) => {
    if (tr.serviceStart != null && tr.serviceEnd != null) {
      if (Math.abs((tr.serviceEnd - tr.serviceStart) - tr.serviceTime) > EPS) {
        issues.push(`Truck #${tr.id}: serviceEnd-serviceStart (${tr.serviceEnd - tr.serviceStart}) != serviceTime (${tr.serviceTime})`);
      }
    }
    if (tr.departureTime != null && tr.serviceEnd != null) {
      const expected = tr.serviceEnd + TRAVEL_TIME_MIN.in + TRAVEL_TIME_MIN.out;
      if (Math.abs(tr.departureTime - expected) > EPS) {
        issues.push(`Truck #${tr.id}: departureTime (${tr.departureTime}) != serviceEnd + travel overhead (${expected})`);
      }
    }
    if (tr.serviceStart != null && tr.serviceStart < tr.arrivalTime - EPS) {
      issues.push(`Truck #${tr.id}: serviceStart (${tr.serviceStart}) before arrivalTime (${tr.arrivalTime})`);
    }
  });

  // 3. At every recorded snapshot instant, independently recompute queue
  //    length, bay busy count (per type), and department busy count (per
  //    dept) directly from the truck records / intervals, and compare
  //    against what the snapshot says. This is the core "displayed state
  //    always matches simulation state" check.
  //
  //    Implemented as a sort + sweep (O(n log n)) rather than, for every
  //    snapshot, filtering the full truck/interval list (O(snapshots *
  //    trucks)) — with horizons up to 365 days producing 10,000+ trucks and
  //    a comparable number of snapshots, the naive approach is O(n^2) and
  //    slow enough to noticeably stall the UI on every run. `activeCountAt`
  //    below turns each entity into a start/end timestamp pair, sorts each
  //    list once, and answers "how many were active at time t" with two
  //    binary searches — the same cumulative-count technique already used
  //    elsewhere in this codebase (see frameSelectors.js's `countLE`).
  function countLE(sortedArr, t) {
    let lo = 0, hi = sortedArr.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sortedArr[mid] <= t + EPS) lo = mid + 1; else hi = mid;
    }
    return lo;
  }
  /** Builds a fast "count (or, if spans carry a `weight`, total weight) of
   *  intervals active at time t" function from a list of {start, end,
   *  weight?} spans — weight defaults to 1 per span, or is the worker
   *  count for department intervals. Sorts start/end timestamps once
   *  (O(n log n)) and builds prefix-sum arrays, so each call to the
   *  returned function is just two binary searches (O(log n)) instead of
   *  re-scanning every span. "Active at t" matches the same start<=t<end
   *  condition used everywhere else in this file. */
  function activeCounter(spans) {
    const startPairs = spans.map((s) => ({ t: s.start, w: s.weight ?? 1 })).sort((a, b) => a.t - b.t);
    const endPairs = spans.map((s) => ({ t: s.end, w: s.weight ?? 1 })).sort((a, b) => a.t - b.t);
    const startTimes = startPairs.map((p) => p.t);
    const endTimes = endPairs.map((p) => p.t);
    const startPrefix = new Array(startPairs.length + 1).fill(0);
    for (let i = 0; i < startPairs.length; i++) startPrefix[i + 1] = startPrefix[i] + startPairs[i].w;
    const endPrefix = new Array(endPairs.length + 1).fill(0);
    for (let i = 0; i < endPairs.length; i++) endPrefix[i + 1] = endPrefix[i] + endPairs[i].w;
    return (t) => startPrefix[countLE(startTimes, t)] - endPrefix[countLE(endTimes, t)];
  }

  // Queue length: a truck is "in queue" from queueEntryTime (if it was ever
  // queued) until serviceStart (if it ever got one) — open-ended (still
  // queued at run's end) spans use horizonMinutes + a large pad as "end" so
  // they read as still-active at every real snapshot time.
  const stillQueuedEnd = horizonMinutes + 1e9;
  const queueSpans = trucks
    .filter((tr) => tr.queueEntryTime != null)
    .map((tr) => ({ start: tr.queueEntryTime, end: tr.serviceStart != null ? tr.serviceStart : stillQueuedEnd }));
  const trueQueueLenAt = activeCounter(queueSpans);

  const trueBayBusyAt = {};
  ['Bu', 'Be', 'Bi'].forEach((type) => {
    const spans = [];
    baySlots[type].forEach((slot) => slot.intervals.forEach((iv) => spans.push({ start: iv.start, end: iv.end })));
    trueBayBusyAt[type] = activeCounter(spans);
  });

  const trueDeptBusyAt = {};
  DEPT_KEYS.forEach((k) => {
    trueDeptBusyAt[k] = activeCounter(deptIntervals[k].map((iv) => ({ start: iv.start, end: iv.end, weight: iv.count })));
  });

  let mismatches = 0;
  const MAX_REPORTED_MISMATCHES = 5;
  snapshots.forEach((snap) => {
    const t = snap.t;

    const trueQueueLen = trueQueueLenAt(t);
    if (trueQueueLen !== snap.queueLen) {
      mismatches++;
      if (mismatches <= MAX_REPORTED_MISMATCHES) {
        issues.push(`t=${t}: snapshot queueLen=${snap.queueLen} but truck-derived queue length=${trueQueueLen}`);
      }
    }

    ['Bu', 'Be', 'Bi'].forEach((type) => {
      const trueBusy = Math.round(trueBayBusyAt[type](t));
      if (trueBusy !== (snap.bay[type] || 0)) {
        mismatches++;
        if (mismatches <= MAX_REPORTED_MISMATCHES) {
          issues.push(`t=${t}: snapshot bay.${type}=${snap.bay[type]} but interval-derived busy count=${trueBusy}`);
        }
      }
      if (trueBusy > cfg.bays[type] + EPS) {
        issues.push(`t=${t}: bay type ${type} over capacity — ${trueBusy} busy > ${cfg.bays[type]} configured`);
      }
    });

    DEPT_KEYS.forEach((k) => {
      const trueBusy = Math.round(trueDeptBusyAt[k](t));
      if (trueBusy !== (snap.dept[k] || 0)) {
        mismatches++;
        if (mismatches <= MAX_REPORTED_MISMATCHES) {
          issues.push(`t=${t}: snapshot dept.${k}=${snap.dept[k]} but interval-derived busy count=${trueBusy}`);
        }
      }
      if (trueBusy > deptAvail[k] + EPS) {
        issues.push(`t=${t}: department ${k} over capacity — ${trueBusy} busy > ${deptAvail[k]} available`);
      }
    });
  });
  if (mismatches > MAX_REPORTED_MISMATCHES) {
    issues.push(`...and ${mismatches - MAX_REPORTED_MISMATCHES} more snapshot mismatch(es) not shown`);
  }

  // 4. KPI range/consistency sanity checks.
  if (kpis.avgQueue < -EPS || kpis.avgQueue > kpis.maxQueue + EPS) {
    issues.push(`avgQueue (${kpis.avgQueue}) out of expected range [0, maxQueue=${kpis.maxQueue}]`);
  }
  ['Bu', 'Be', 'Bi'].forEach((type) => {
    if (kpis.bayUtil[type] < -EPS || kpis.bayUtil[type] > 1 + EPS) {
      issues.push(`bayUtil.${type} (${kpis.bayUtil[type]}) out of [0,1]`);
    }
  });
  DEPT_KEYS.forEach((k) => {
    if (kpis.deptUtil[k] < -EPS || kpis.deptUtil[k] > 1 + EPS) {
      issues.push(`deptUtil.${k} (${kpis.deptUtil[k]}) out of [0,1]`);
    }
  });
  if (kpis.avgWait < -EPS) issues.push(`avgWait (${kpis.avgWait}) is negative`);
  if (kpis.avgSystem < -EPS) issues.push(`avgSystem (${kpis.avgSystem}) is negative`);
  if (kpis.completedCount > kpis.arrivedCount) {
    issues.push(`completedCount (${kpis.completedCount}) exceeds arrivedCount (${kpis.arrivedCount})`);
  }

  return { ok: issues.length === 0, issues };
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

/* Precomputes, for every job type, a "running average flow time" series
   sampled at `numPoints` evenly-spaced times across the run — the same
   precompute-once-then-index-by-sample-time shape as computeUtilSeries
   above, so the Flow Time Analysis page's chart can be drawn from a plain
   array lookup on every animation frame instead of re-scanning every truck
   each tick. "Flow time" here is time-in-system (departureTime -
   arrivalTime), matching the engine's own avgSystem KPI and the "Time in
   System" column in the Excel exports — just broken out per job type
   instead of averaged across the whole workshop.

   Each sample point's value is the average flow time of every truck of
   that job type which has *departed* by that sample time (a truck still
   queued or in service has a right-censored, not-yet-known flow time,
   exactly like avgSystem excludes them) — computed via a sort + prefix-sum
   over that job type's departed trucks, so each sample is one binary
   search instead of a full re-scan (the same technique used throughout
   this file and frameSelectors.js, e.g. countLE). A sample point before
   that job type's first-ever completion is `null` (no data yet), which
   Chart.js renders as a gap rather than a misleading zero. */
export function computeFlowTimeSeries(result, numPoints) {
  const total = result.totalDuration || 1;
  const sampleTimes = [];
  for (let i = 0; i <= numPoints; i++) sampleTimes.push(total * i / numPoints);

  const byJob = {};
  JOB_TYPES.forEach(job => {
    const departed = result.trucks
      .filter(tr => tr.job.id === job.id && tr.departureTime != null)
      .map(tr => ({ t: tr.departureTime, flow: tr.departureTime - tr.arrivalTime }))
      .sort((a, b) => a.t - b.t);
    const n = departed.length;
    const prefix = new Array(n + 1).fill(0);
    for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + departed[i].flow;

    const series = sampleTimes.map(t2 => {
      if (n === 0 || t2 <= 0) return null;
      let lo = 0, hi = n - 1, ans = -1;
      while (lo <= hi) { const mid = (lo + hi) >> 1; if (departed[mid].t <= t2) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
      if (ans < 0) return null;
      const count = ans + 1;
      return prefix[count] / count;
    });
    byJob[job.id] = { series, totalCompleted: n };
  });

  return { sampleTimes, byJob };
}
