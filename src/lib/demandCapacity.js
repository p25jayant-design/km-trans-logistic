/* =========================================================================
   DEMAND vs. CAPACITY CHECK
   ---------------------------------------------------------------------
   A pure, external, read-only sanity check over a `config` object — it
   never calls `simulate()` and never mutates anything. Estimates, for each
   worker department, the fraction of its available worker-minutes/day the
   CURRENTLY CONFIGURED demand (arrival rates) and processing times (service
   times) would require on average, and flags any department where that
   estimate is at or past what a stable queue can sustain (utilization >=
   100% means the queue grows without bound — the classic ρ = λ/μ < 1
   queueing-stability condition, ratio of arrival rate to service rate).

   This is deliberately an ESTIMATE, not a call into the DES engine: it uses
   each job's mean triangular service time (a well-known closed form,
   (low+mode+high)/3) rather than actually simulating anything, so it can
   run instantly on every keystroke in the Configure panel without the cost
   of a real `simulate()` call. It is consistent with — but independently
   derived from — the same formulas `simulate()` itself uses for skill
   multipliers and the Accident/Standard pooled-arrival split (see
   desEngine.js's `effectiveJob`/`EFF_*` and "ACCIDENT_STANDARD_POOL_RATE"
   comments), so the *shape* of the estimate matches what the engine would
   actually do, without duplicating or second-guessing any of its logic.

   WHY THE POOL MATTERS FOR THIS ESTIMATE
   ------------------------------------------------------------------------
   Accident Repair and the 10 Standard-category jobs don't each keep their
   own independent long-run rate once pooled: the pool's TOTAL rate is the
   sum of their (possibly overridden) individual rates, but which one of
   them a given pool arrival actually becomes is governed by
   `cfg.accidentPct` (Accident) and each Standard job's relative weight
   within the Standard share (see desEngine.js). Editing one pooled job's
   own rate changes the pool's total size, but not the accident/standard
   split, which stays pinned to `accidentPct`. This module reproduces that
   exact math (not the naive "just use each job's own rate" shortcut) so
   the capacity estimate for pooled jobs is accurate, not just directionally
   right. */

import { JOB_TYPES, DEPT_KEYS, NATURAL_ACCIDENT_PCT } from '../engine/desEngine.js';

const STANDARD_JOBS = JOB_TYPES.filter((j) => j.category === 'standard');
const ACCIDENT_JOB = JOB_TYPES.find((j) => j.id === 'accident');

// 100% is the true instability threshold (ρ >= 1 → an unbounded queue); warn
// a little before that (95%) since real demand has randomness on top of
// this mean estimate, so even a config just under 100% here can
// realistically tip over in an actual run.
const WARN_AT = 0.95;
const BLOCK_AT = 1.0;

/** Same fallback-to-catalog-default resolution as desEngine.js's
 *  effectiveJob() — kept as an independent, tiny re-implementation (not an
 *  import) because this file must stay a pure, engine-decoupled estimator;
 *  see the file header. */
function effectiveRate(job, jobOverrides) {
  const ov = jobOverrides?.[job.id];
  return ov && Number.isFinite(ov.arrivalPerDay) && ov.arrivalPerDay >= 0 ? ov.arrivalPerDay : job.arrivalPerDay;
}
function effectiveService(job, jobOverrides) {
  const ov = jobOverrides?.[job.id];
  return ov && Number.isFinite(ov.baseService) && ov.baseService > 0 ? ov.baseService : job.baseService;
}

/** Mean of the triangular service-time distribution desEngine.js draws from
 *  for this job — (low+mode+high)/3, using the exact same 0.5x/1x/2x
 *  ("long" category) or 0.7x/1x/1.5x (everything else) bounds `simulate()`
 *  itself uses. */
function meanBaseService(job, jobOverrides) {
  const b = effectiveService(job, jobOverrides);
  return job.category === 'long' ? (b * 0.5 + b + b * 2) / 3 : (b * 0.7 + b + b * 1.5) / 3;
}

/** Every job type's estimated long-run arrival rate (trucks/day) under the
 *  current config — reproducing the pool-split math described in the file
 *  header for Accident Repair / the 10 Standard jobs, and just each job's
 *  own effective rate for everything else. */
function estimateJobRates(config) {
  const jobOverrides = config.jobOverrides;
  const accidentPct = Math.min(1, Math.max(0, config.accidentPct ?? NATURAL_ACCIDENT_PCT));

  const standardEffRates = STANDARD_JOBS.map((j) => effectiveRate(j, jobOverrides));
  const standardPoolRate = standardEffRates.reduce((s, r) => s + r, 0);
  const accidentEffRate = effectiveRate(ACCIDENT_JOB, jobOverrides);
  const poolTotalRate = standardPoolRate + accidentEffRate;

  const rates = {};
  JOB_TYPES.forEach((job) => {
    if (job.id === 'accident') {
      rates[job.id] = accidentPct * poolTotalRate;
    } else if (job.category === 'standard') {
      const ownRate = effectiveRate(job, jobOverrides);
      rates[job.id] = standardPoolRate > 0 ? (1 - accidentPct) * poolTotalRate * (ownRate / standardPoolRate) : 0;
    } else {
      rates[job.id] = effectiveRate(job, jobOverrides);
    }
  });
  return rates;
}

/** Full per-department utilization estimate for the current config —
 *  required worker-minutes/day (summed across every job type that touches
 *  that department, weighted by how many of that department's workers each
 *  instance needs) divided by available worker-minutes/day (headcount x
 *  the configured standard+overtime shop hours, see workforceCost.js's
 *  hoursPerDayBreakdown / desEngine.js's dayMinutes — the exact same
 *  hours-per-day figure the engine itself now schedules against). */
export function estimateDemandCapacity(config) {
  const rates = estimateJobRates(config);
  const cc = config.costConfig || {};
  const hoursPerDay = Math.max(0.1, cc.hoursPerDay ?? 8);
  const overtimePct = Math.min(100, Math.max(0, cc.overtimePct ?? 0));
  const dayMinutes = (hoursPerDay + (overtimePct / 100) * hoursPerDay) * 60;

  const deptAvail = {};
  DEPT_KEYS.forEach((k) => {
    const d = config.departments[k];
    deptAvail[k] = Math.max(0, Math.round((d?.total || 0) * (1 - (d?.absent || 0))));
  });

  const requiredMinPerDay = {};
  DEPT_KEYS.forEach((k) => { requiredMinPerDay[k] = 0; });

  JOB_TYPES.forEach((job) => {
    const rate = rates[job.id] || 0;
    if (rate <= 0) return;
    const reqDepts = Object.keys(job.req);
    if (!reqDepts.length) return;
    // Same average-skill-multiplier formula as desEngine.js's `mult` —
    // computed per required department below using THAT department's own
    // current skill mix, matching how a truck's actual serviceTime is one
    // shared duration applied identically to every department it touches.
    const deptSkillMult = {};
    reqDepts.forEach((k) => {
      const d = config.departments[k];
      const avgSkill = d && d.total > 0 ? (d.high * 9 + d.med * 6 + d.low * 3) / d.total : 10;
      deptSkillMult[k] = 10 / Math.max(avgSkill, 1);
    });
    const mult = reqDepts.reduce((s, k) => s + deptSkillMult[k], 0) / reqDepts.length;
    const meanService = meanBaseService(job, config.jobOverrides) * mult;
    reqDepts.forEach((k) => {
      requiredMinPerDay[k] += rate * meanService * job.req[k];
    });
  });

  const perDept = {};
  let worstKey = null, worstUtil = -1;
  DEPT_KEYS.forEach((k) => {
    const availMinPerDay = deptAvail[k] * dayMinutes;
    const utilization = availMinPerDay > 0 ? requiredMinPerDay[k] / availMinPerDay : (requiredMinPerDay[k] > 0 ? Infinity : 0);
    perDept[k] = { key: k, requiredMinPerDay: requiredMinPerDay[k], availMinPerDay, utilization };
    if (utilization > worstUtil) { worstUtil = utilization; worstKey = k; }
  });

  return {
    perDept,
    worstDept: worstKey,
    worstUtilization: worstUtil,
    warn: worstUtil >= WARN_AT && worstUtil < BLOCK_AT,
    block: worstUtil >= BLOCK_AT,
    warnAt: WARN_AT,
    blockAt: BLOCK_AT,
  };
}

/** Validates ONE proposed edit to a job's demand (arrivalPerDay) or
 *  processing time (baseService) before it's committed to config —
 *  called from ConfigPanel as the user types. Only ever BLOCKS an edit that
 *  makes things WORSE: raising a demand/service-time value into (or
 *  further into) instability for a department that job actually uses.
 *  Lowering a value is always accepted, even if the department it touches
 *  is already over capacity for OTHER reasons (e.g. the shop's configured
 *  hours/day) — rejecting an attempt to reduce load would be actively
 *  unhelpful. This deliberately does NOT retroactively flag values the
 *  user never touched; `estimateDemandCapacity` above is what powers the
 *  always-visible, non-blocking utilization readout for that. */
export function validateOverrideEdit(config, jobId, field, newValue) {
  const job = JOB_TYPES.find((j) => j.id === jobId);
  if (!job) return { ok: true };
  if (!Number.isFinite(newValue) || newValue < 0) return { ok: true }; // let normal input validation handle NaN/negative

  const currentValue = field === 'arrivalPerDay'
    ? effectiveRate(job, config.jobOverrides)
    : effectiveService(job, config.jobOverrides);

  // Only an INCREASE can possibly make capacity worse — always accept a
  // decrease (or no-op) regardless of where the system currently stands.
  if (newValue <= currentValue) return { ok: true };

  const nextConfig = {
    ...config,
    jobOverrides: {
      ...config.jobOverrides,
      [jobId]: { ...config.jobOverrides?.[jobId], [field]: newValue },
    },
  };
  const before = estimateDemandCapacity(config);
  const after = estimateDemandCapacity(nextConfig);

  // Only block if a department THIS job actually draws workers from is
  // pushed to/past the instability threshold BY this specific edit (i.e.
  // it wasn't already at-or-past it before the edit) — an already-overloaded
  // department elsewhere in the config shouldn't block an unrelated job's
  // edit.
  const affectedDepts = Object.keys(job.req);
  let blockingDept = null, blockingUtil = -1;
  affectedDepts.forEach((k) => {
    const u = after.perDept[k]?.utilization ?? 0;
    const wasOk = (before.perDept[k]?.utilization ?? 0) < BLOCK_AT;
    if (u >= BLOCK_AT && wasOk && u > blockingUtil) { blockingUtil = u; blockingDept = k; }
  });

  if (blockingDept) {
    return {
      ok: false,
      dept: blockingDept,
      utilization: blockingUtil,
      message: `This would need more than 100% of the ${blockingDept} department's available capacity (~${(blockingUtil * 100).toFixed(0)}%) at the current headcount and shop hours — the queue for that department would grow without bound. Add headcount, add overtime hours, or choose a lower value.`,
    };
  }
  return { ok: true };
}
