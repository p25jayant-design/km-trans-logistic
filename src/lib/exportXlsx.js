import * as XLSX from 'xlsx';
import { fmtTime, DEPT_NAMES, DEPT_KEYS } from '../engine/desEngine.js';
import { deriveArrivalCategory } from '../engine/frameSelectors.js';
import { BAY_TYPE_LABEL } from './styleMaps.js';

const ARRIVAL_CATEGORY_LABEL = { accident: 'Accident Repair', standard: 'Standard' };

/* ==========================================================================
 * Shared helpers
 * ========================================================================== */

const POLICY_LABEL = {
  hybrid: 'Hybrid (Vehicle Priority + SJF)',
  priority: 'Priority (Vehicle Type only)',
  sjf: 'Shortest Job First',
  fcfs: 'First Come First Serve',
};

/** Human-readable "1× Mechanical, 1× Tire" style summary of a job's
 *  resource-requirement matrix — purely a formatting helper over data the
 *  engine already computed (`job.req`), not a new calculation. */
function formatWorkers(req) {
  const parts = Object.entries(req || {}).map(([dept, count]) => `${count}× ${DEPT_NAMES[dept] || dept}`);
  return parts.length ? parts.join(', ') : '—';
}

function statusOf(tr) {
  if (tr.departureTime != null) return 'Completed';
  if (tr.serviceStart != null) return 'In Service';
  return 'Waiting';
}

/** Writes an Excel formula into a cell (as opposed to a plain value) — no
 *  cached `.v`/`.t` is set, so every reader (Excel, LibreOffice, Google
 *  Sheets) recalculates it fresh from the referenced cells on open, which
 *  is the whole point: the number on screen is always freshly derived from
 *  the raw data cells the formula points at, not a value baked in at
 *  export time. */
function setFormula(sheet, addr, formula) {
  sheet[addr] = { f: formula };
}

/** Sets reasonable column widths on an AOA-built sheet from its header row
 *  plus a sample of the data. */
function setColWidthsAoa(sheet, aoa) {
  const headers = aoa[0] || [];
  sheet['!cols'] = headers.map((h, i) => {
    let maxLen = String(h ?? '').length;
    for (let r = 1; r < aoa.length; r++) {
      const v = aoa[r][i];
      if (v != null && v !== '') maxLen = Math.max(maxLen, String(v).length);
    }
    return { wch: Math.min(40, Math.max(10, maxLen + 2)) };
  });
}

/** A small "Read Me" sheet documenting exactly what every column and
 *  formula means, so the workbook is self-explanatory without needing this
 *  conversation for context — added as the first sheet in every export. */
function buildNotesSheet(extraRows = []) {
  const rows = [
    ['Column / Term', 'Definition'],
    ['Arrival Time', 'When the truck arrived at the workshop gate.'],
    ['Queue Time', "When the truck entered the waiting queue. Blank if it was allocated a bay immediately on arrival (no wait)."],
    ['Inspection Time', "When this truck's inspection began. Only applies to ‘Vehicle Inspection’ jobs — in this model, Inspection is its own job category served in the Inspection Bay, not a stage every truck passes through before its real job."],
    ['Service Start / Service End', "When work on the truck's actual job began and finished in its assigned bay."],
    ['Exit Time', "When the truck is recorded as having left the workshop — Service End plus a fixed round-trip in/out travel-time assumption (see the engine's TRAVEL_TIME_MIN constant; it is not a figure sourced from the case)."],
    ['Waiting Time', 'Service Start minus Arrival Time.'],
    ['Service Time', 'Service End minus Service Start.'],
    ['Throughput Time', 'Service End minus Arrival Time — i.e. Waiting Time + Service Time: how long it took to actually get the job done, not counting the final walk/drive to the exit gate.'],
    ['Time in System / Flow Time', "Exit Time minus Arrival Time — the full time the truck occupies the workshop, including the exit travel allowance. This is the figure the live dashboard's \"Avg Flow Time\" KPI card and the Flow Time Analysis page both show."],
    ['Arrival Category', "‘Accident Repair’ or ‘Standard’ for jobs in that arrival-mix pool (see the Accident Repair Arrival Percentage setting); blank (—) for every other job type (Medium, Denting, Cabin Setting, Engine Overhaul, Inspection), which are outside that pool entirely."],
    ['Penalised', 'TRUE if Time in System exceeds 1,440 minutes (24 simulated hours); blank if the truck has not exited yet (not yet knowable).'],
    ['"(min)" columns', 'Raw simulated minutes since the start of the run — the values every formula in this workbook operates on. The paired non-"(min)" column is the same instant formatted as "Day N · HH:MM" for readability.'],
    ['Formulas', 'Every duration/flag column, and every summary sheet in this workbook, is a live Excel formula referencing the raw data sheet(s) — not a value computed once and pasted in. Edit or filter the raw rows and the formulas recalculate.'],
    ...extraRows,
  ];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols'] = [{ wch: 26 }, { wch: 100 }];
  return sheet;
}

/* ==========================================================================
 * Truck-row schema — the same core column set (timestamps + formula-driven
 * durations) is reused, in this exact order, by every per-truck-row sheet
 * in every export (Truck Records, Bay Job History, Job Assignments), each
 * with a different set of "prefix" columns in front identifying that
 * sheet's own grouping key (a bay, a department, or nothing).
 * ========================================================================== */

const CORE_COLUMNS = [
  { key: 'truckId', label: 'Truck ID' },
  { key: 'vehicleType', label: 'Vehicle Type' },
  { key: 'jobType', label: 'Job Type' },
  { key: 'jobCategory', label: 'Job Category' },
  { key: 'arrivalCategory', label: 'Arrival Category' },
  { key: 'policy', label: 'Scheduling Policy' },
  { key: 'bay', label: 'Assigned Bay' },
  { key: 'workers', label: 'Assigned Workers' },
  { key: 'arrivalMin', label: 'Arrival Time (min)' },
  { key: 'arrivalFmt', label: 'Arrival Time' },
  { key: 'queueMin', label: 'Queue Time (min)' },
  { key: 'inspectionMin', label: 'Inspection Time (min)' },
  { key: 'serviceStartMin', label: 'Service Start (min)' },
  { key: 'serviceStartFmt', label: 'Service Start' },
  { key: 'serviceEndMin', label: 'Service End (min)' },
  { key: 'serviceEndFmt', label: 'Service End' },
  { key: 'exitMin', label: 'Exit Time (min)' },
  { key: 'exitFmt', label: 'Exit Time' },
  { key: 'waitingMin', label: 'Waiting Time (min)', formula: true },
  { key: 'serviceMin', label: 'Service Time (min)', formula: true },
  { key: 'throughputMin', label: 'Throughput Time (min)', formula: true },
  { key: 'systemMin', label: 'Time in System (min)', formula: true },
  { key: 'flowMin', label: 'Flow Time (min)', formula: true },
  { key: 'status', label: 'Status' },
  { key: 'penalised', label: 'Penalised', formula: true },
];

/** Raw + formatted timestamp values for one truck (formula-column keys are
 *  left `null` — `buildTruckRowSheet` fills those cells with formulas
 *  instead). Reads only fields the engine already computed: `arrivalTime`,
 *  `queueEntryTime`, the `inspectionStart` entry in `truck.events` (only
 *  present for category==='inspection' jobs), `serviceStart`, `serviceEnd`,
 *  `departureTime`. */
function coreRowValues(tr, cfg) {
  const inspectionEvt = tr.events?.find((e) => e.type === 'inspectionStart');
  const m = (v) => (v == null ? '' : +v.toFixed(6));
  return {
    truckId: tr.id,
    vehicleType: tr.vehicleType,
    jobType: tr.job.name,
    jobCategory: tr.job.category,
    // Accident Repair vs. Standard classification — see
    // deriveArrivalCategory's own doc comment in frameSelectors.js. Blank
    // for every other job type (Medium, Denting, Cabin Setting, Engine
    // Overhaul, Inspection), which are outside this feature's scope.
    arrivalCategory: ARRIVAL_CATEGORY_LABEL[deriveArrivalCategory(tr.job)] || '—',
    policy: POLICY_LABEL[cfg.policy] || cfg.policy,
    bay: tr.bay || 'Not yet allocated',
    workers: formatWorkers(tr.job.req),
    arrivalMin: m(tr.arrivalTime),
    arrivalFmt: fmtTime(tr.arrivalTime),
    queueMin: tr.queueEntryTime != null ? m(tr.queueEntryTime) : '',
    inspectionMin: inspectionEvt ? m(inspectionEvt.t) : '',
    serviceStartMin: m(tr.serviceStart),
    serviceStartFmt: tr.serviceStart != null ? fmtTime(tr.serviceStart) : 'Not yet allocated',
    serviceEndMin: m(tr.serviceEnd),
    serviceEndFmt: tr.serviceEnd != null ? fmtTime(tr.serviceEnd) : '—',
    exitMin: m(tr.departureTime),
    exitFmt: tr.departureTime != null ? fmtTime(tr.departureTime) : '—',
    waitingMin: null,
    serviceMin: null,
    throughputMin: null,
    systemMin: null,
    flowMin: null,
    status: statusOf(tr),
    penalised: null,
  };
}

/** Builds a truck-row sheet: `prefixColumns` (e.g. Bay ID/Bay Type) go
 *  first, then the shared CORE_COLUMNS. `rows` is an array of
 *  `{ prefix: {key: value}, core: coreRowValues(tr, cfg) }`. Returns both
 *  the built sheet and a `colLetter(key)` lookup so a summary sheet
 *  elsewhere in the same workbook can reference this sheet's columns by
 *  name without hand-counting letters. */
function buildTruckRowSheet(prefixColumns, rows) {
  const allColumns = [...prefixColumns, ...CORE_COLUMNS];
  const headers = allColumns.map((c) => c.label);
  const aoa = [headers, ...rows.map((r) => allColumns.map((c) => (c.key in r.prefix ? r.prefix[c.key] : r.core[c.key])))];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);

  const colIndex = Object.fromEntries(allColumns.map((c, i) => [c.key, i]));
  const colLetter = (key) => XLSX.utils.encode_col(colIndex[key]);
  const L = colLetter;

  for (let i = 0; i < rows.length; i++) {
    const r = i + 2; // 1-based sheet row; row 1 is the header
    setFormula(sheet, `${L('waitingMin')}${r}`,
      `IF(OR(${L('serviceStartMin')}${r}="",${L('arrivalMin')}${r}=""),"",${L('serviceStartMin')}${r}-${L('arrivalMin')}${r})`);
    setFormula(sheet, `${L('serviceMin')}${r}`,
      `IF(OR(${L('serviceEndMin')}${r}="",${L('serviceStartMin')}${r}=""),"",${L('serviceEndMin')}${r}-${L('serviceStartMin')}${r})`);
    setFormula(sheet, `${L('throughputMin')}${r}`,
      `IF(OR(${L('serviceEndMin')}${r}="",${L('arrivalMin')}${r}=""),"",${L('serviceEndMin')}${r}-${L('arrivalMin')}${r})`);
    setFormula(sheet, `${L('systemMin')}${r}`,
      `IF(OR(${L('exitMin')}${r}="",${L('arrivalMin')}${r}=""),"",${L('exitMin')}${r}-${L('arrivalMin')}${r})`);
    // Flow Time is the same quantity as Time in System (arrival to exit) —
    // the dashboard's own "flow time" terminology (Flow Time Analysis page)
    // for the identical figure, duplicated under this column name per the
    // export spec so both names are directly available without a lookup.
    setFormula(sheet, `${L('flowMin')}${r}`,
      `IF(OR(${L('exitMin')}${r}="",${L('arrivalMin')}${r}=""),"",${L('exitMin')}${r}-${L('arrivalMin')}${r})`);
    setFormula(sheet, `${L('penalised')}${r}`, `IF(${L('systemMin')}${r}="","",${L('systemMin')}${r}>1440)`);
  }
  setColWidthsAoa(sheet, aoa);
  return { sheet, colLetter, lastRow: rows.length + 1 };
}

/* ==========================================================================
 * Export 1 — raw per-truck simulation records
 * ========================================================================== */

/** Exports one row per truck/job — every lifecycle timestamp the engine
 *  recorded (arrival, queue entry, inspection, service start/end, exit),
 *  plus the same duration figures the dashboard's KPIs are built from
 *  (Waiting/Service/Throughput/Time-in-System) written as live Excel
 *  formulas over those timestamps rather than pasted-in numbers, and a
 *  Penalised flag (Time in System > 24 simulated hours). No
 *  aggregate/cross-truck figures live here — those are the two dedicated
 *  utilization exports below. */
export function exportSimulationXlsx(result) {
  if (!result || !result.trucks?.length) return;

  const rows = result.trucks
    .slice()
    .sort((a, b) => a.id - b.id)
    .map((tr) => ({ prefix: {}, core: coreRowValues(tr, result.cfg) }));

  const { sheet } = buildTruckRowSheet([], rows);

  const notes = buildNotesSheet();

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, notes, 'Read Me');
  XLSX.utils.book_append_sheet(workbook, sheet, 'Truck Records');

  const stamp = fmtTime(result.totalDuration).replace(/[^0-9A-Za-z]+/g, '-');
  XLSX.writeFile(workbook, `km-trans-simulation-data-${stamp}.xlsx`);
}

/* ==========================================================================
 * Export 2 — Bay Utilization
 * ========================================================================== */

const TYPE_ORDER = ['Bu', 'Be', 'Bi'];

/** Exports everything the dashboard already computed about bay
 *  utilization, across three sheets:
 *   - "Bay Job History": one row per truck that was ever allocated a bay,
 *     with the full timestamp/duration/Penalised column set.
 *   - "Bay Summary": one row per bay slot — Total Jobs Served, Total Busy
 *     Minutes, Avg Job Duration, and Overall Utilization % are all live
 *     COUNTIF/SUMIF/ratio formulas referencing "Bay Job History" directly,
 *     not pasted-in numbers, per the request that utilization figures stay
 *     transparently traceable to the raw data.
 *   - "Utilization Over Time": the same running-utilization series the live
 *     chart shows, one column per bay — also formula-driven (SUMPRODUCT
 *     over "Bay Job History"'s Service Start/End columns, clipped to each
 *     sample time), sampled a bit coarser than the on-screen chart (60
 *     points instead of 150) to keep ~700+ live array formulas per bay
 *     column responsive to open/recalculate in Excel. */
export function exportBayUtilizationXlsx(result) {
  const util = result?.util;
  if (!result || !util) return;

  const truckRows = result.trucks
    .filter((tr) => tr.bay != null)
    .slice()
    .sort((a, b) => (a.bay < b.bay ? -1 : a.bay > b.bay ? 1 : a.id - b.id))
    .map((tr) => ({
      prefix: { bayId: tr.bay, bayType: BAY_TYPE_LABEL[tr.bay.replace(/\d+$/, '')] || tr.bay.replace(/\d+$/, '') },
      core: coreRowValues(tr, result.cfg),
    }));

  const { sheet: historySheet, colLetter: hc, lastRow: hLastRow } = buildTruckRowSheet(
    [{ key: 'bayId', label: 'Bay ID' }, { key: 'bayType', label: 'Bay Type' }],
    truckRows,
  );

  // Bay Summary — one row per configured bay slot, formula-driven from
  // "Bay Job History" (bay IDs with zero jobs served correctly show 0%
  // utilization via SUMIF/COUNTIF matching nothing, not a division error).
  const summaryHeaders = ['Bay ID', 'Bay Type', 'Configured Count (this type)', 'Total Jobs Served', 'Total Busy Minutes', 'Avg Job Duration (min)', 'Horizon (min)', 'Overall Utilization %'];
  const summaryAoa = [summaryHeaders];
  const bayRange = (col) => `'Bay Job History'!$${hc(col)}$2:$${hc(col)}$${hLastRow}`;
  TYPE_ORDER.forEach((type) => {
    result.baySlots[type].forEach((slot) => {
      summaryAoa.push([slot.id, BAY_TYPE_LABEL[type], result.cfg.bays[type], null, null, null, +result.horizonMinutes.toFixed(6), null]);
    });
  });
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryAoa);
  for (let i = 1; i < summaryAoa.length; i++) {
    const r = i + 1;
    // Jobs/minutes are clipped to the horizon (column G) before summing, not
    // taken from the raw, unclipped Service Time column. Some jobs in "Bay
    // Job History" — especially long dedicated-bay jobs — start before the
    // horizon but finish after it (or start entirely in the post-horizon
    // "drain tail" the engine runs so in-progress jobs can complete
    // naturally). Summing their full, unclipped duration would let a single
    // bay's reported busy time exceed the horizon itself (>100% utilization),
    // which is exactly the bug this clipping avoids — it mirrors both the
    // engine's own bayUtil calculation and the Department Summary sheet.
    const clipEndH = `IF(${bayRange('serviceEndMin')}<$G${r},${bayRange('serviceEndMin')},$G${r})`;
    const clipStartH = `IF(${bayRange('serviceStartMin')}<$G${r},${bayRange('serviceStartMin')},$G${r})`;
    setFormula(summarySheet, `D${r}`, `SUMPRODUCT((${bayRange('bayId')}=A${r})*((${clipEndH})-(${clipStartH})>0))`);
    setFormula(summarySheet, `E${r}`, `SUMPRODUCT((${bayRange('bayId')}=A${r})*((${clipEndH})-(${clipStartH})))`);
    setFormula(summarySheet, `F${r}`, `IF(D${r}=0,"",E${r}/D${r})`);
    setFormula(summarySheet, `H${r}`, `IF(G${r}=0,0,E${r}/G${r}*100)`);
  }
  setColWidthsAoa(summarySheet, summaryAoa);

  // Utilization Over Time — one column per bay, one row per sample time.
  const allBayIds = TYPE_ORDER.flatMap((type) => result.baySlots[type].map((s) => s.id));
  const numPoints = 60;
  const sampleTimes = Array.from({ length: numPoints + 1 }, (_, i) => (result.totalDuration * i) / numPoints);
  const seriesHeaders = ['Sim Time (min)', 'Sim Time', ...allBayIds.map((id) => `${id} Util %`)];
  const seriesAoa = [seriesHeaders, ...sampleTimes.map((t) => [+t.toFixed(6), fmtTime(t), ...allBayIds.map(() => null)])];
  const seriesSheet = XLSX.utils.aoa_to_sheet(seriesAoa);
  allBayIds.forEach((id, bi) => {
    const col = XLSX.utils.encode_col(2 + bi);
    for (let i = 1; i < seriesAoa.length; i++) {
      const r = i + 1;
      const clipEnd = `IF(${bayRange('serviceEndMin')}<$A${r},${bayRange('serviceEndMin')},$A${r})`;
      const clipStart = `IF(${bayRange('serviceStartMin')}<$A${r},${bayRange('serviceStartMin')},$A${r})`;
      setFormula(
        seriesSheet, `${col}${r}`,
        `IFERROR(100*SUMPRODUCT((${bayRange('bayId')}="${id}")*((${clipEnd})-(${clipStart})>0)*((${clipEnd})-(${clipStart})))/$A${r},0)`,
      );
    }
  });
  setColWidthsAoa(seriesSheet, seriesAoa);

  const notes = buildNotesSheet([
    ['Bay Summary formulas', 'Total Jobs Served / Total Busy Minutes are SUMPRODUCT totals over "Bay Job History" matched on Bay ID, with each job’s Service Start/End clipped to the Horizon (min) column first — so a job that starts before the horizon but finishes after it (or falls in the post-horizon "drain tail" the engine runs so in-progress jobs can complete) only counts the portion of its duration that actually falls inside the horizon. Overall Utilization % = Total Busy Minutes / Horizon (min); this keeps the figure from ever exceeding 100%.'],
    ['Utilization Over Time formulas', 'Each cell is a SUMPRODUCT over "Bay Job History", summing each job’s busy duration clipped to that row’s sample time, divided by the sample time — the same method the live dashboard chart uses, sampled at 60 points instead of 150 to keep the workbook responsive.'],
  ]);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, notes, 'Read Me');
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Bay Summary');
  XLSX.utils.book_append_sheet(workbook, historySheet, 'Bay Job History');
  XLSX.utils.book_append_sheet(workbook, seriesSheet, 'Utilization Over Time');

  const stamp = fmtTime(result.totalDuration).replace(/[^0-9A-Za-z]+/g, '-');
  XLSX.writeFile(workbook, `km-trans-bay-utilization-${stamp}.xlsx`);
}

/* ==========================================================================
 * Export 3 — Worker (Department) Utilization
 * ========================================================================== */

/** Exports everything the dashboard already computed about worker/
 *  department utilization, across three sheets:
 *   - "Job Assignments": one row per truck per department its job required
 *     workers from (there's no per-individual-worker identity in this
 *     model, only pooled department capacity — matching how the rest of
 *     the dashboard already represents workers), with the full timestamp/
 *     duration/Penalised column set plus how many workers that assignment
 *     required.
 *   - "Department Summary": Total Busy Worker-Minutes and Overall
 *     Utilization % are live SUMPRODUCT formulas over "Job Assignments"
 *     (weighted by Workers Required, clipped to the horizon), not
 *     pasted-in numbers.
 *   - "Utilization Over Time": running utilization per department, also
 *     SUMPRODUCT-formula-driven, at 60 sample points. */
export function exportWorkerUtilizationXlsx(result) {
  const util = result?.util;
  if (!result || !util) return;

  const assignmentRows = [];
  result.trucks
    .filter((tr) => tr.serviceStart != null)
    .forEach((tr) => {
      DEPT_KEYS.forEach((dept) => {
        const count = tr.job.req[dept];
        if (!count) return;
        assignmentRows.push({
          prefix: { dept: DEPT_NAMES[dept], workersRequired: count },
          core: coreRowValues(tr, result.cfg),
          _deptKey: dept,
        });
      });
    });
  assignmentRows.sort((a, b) => (a.prefix.dept < b.prefix.dept ? -1 : a.prefix.dept > b.prefix.dept ? 1 : a.core.truckId - b.core.truckId));

  const { sheet: assignmentSheet, colLetter: ac, lastRow: aLastRow } = buildTruckRowSheet(
    [{ key: 'dept', label: 'Department' }, { key: 'workersRequired', label: 'Workers Required' }],
    assignmentRows,
  );

  const deptRange = (col) => `'Job Assignments'!$${ac(col)}$2:$${ac(col)}$${aLastRow}`;

  // Department Summary — formula-driven from "Job Assignments".
  const summaryHeaders = ['Department', 'Total Workers (configured)', 'High Skill', 'Medium Skill', 'Low Skill', 'Absent %', 'Effective Available Workers', 'Horizon (min)', 'Total Busy Worker-Minutes', 'Overall Utilization %'];
  const summaryAoa = [summaryHeaders];
  DEPT_KEYS.forEach((k) => {
    const d = result.cfg.departments[k];
    summaryAoa.push([DEPT_NAMES[k], d.total, d.high, d.med, d.low, +(d.absent * 100).toFixed(2), result.deptAvail[k], +result.horizonMinutes.toFixed(6), null, null]);
  });
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryAoa);
  for (let i = 1; i < summaryAoa.length; i++) {
    const r = i + 1;
    const clipEnd = `IF(${deptRange('serviceEndMin')}<$H${r},${deptRange('serviceEndMin')},$H${r})`;
    const clipStart = `IF(${deptRange('serviceStartMin')}<$H${r},${deptRange('serviceStartMin')},$H${r})`;
    setFormula(
      summarySheet, `I${r}`,
      `SUMPRODUCT((${deptRange('dept')}=A${r})*${deptRange('workersRequired')}*((${clipEnd})-(${clipStart})>0)*((${clipEnd})-(${clipStart})))`,
    );
    setFormula(summarySheet, `J${r}`, `IF(G${r}*H${r}=0,0,I${r}/(G${r}*H${r})*100)`);
  }
  setColWidthsAoa(summarySheet, summaryAoa);

  // Utilization Over Time — one column per department.
  const numPoints = 60;
  const sampleTimes = Array.from({ length: numPoints + 1 }, (_, i) => (result.totalDuration * i) / numPoints);
  const seriesHeaders = ['Sim Time (min)', 'Sim Time', ...DEPT_KEYS.map((k) => `${DEPT_NAMES[k]} Util %`)];
  const seriesAoa = [seriesHeaders, ...sampleTimes.map((t) => [+t.toFixed(6), fmtTime(t), ...DEPT_KEYS.map(() => null)])];
  const seriesSheet = XLSX.utils.aoa_to_sheet(seriesAoa);
  DEPT_KEYS.forEach((k, di) => {
    const col = XLSX.utils.encode_col(2 + di);
    const cap = result.deptAvail[k];
    for (let i = 1; i < seriesAoa.length; i++) {
      const r = i + 1;
      const clipEnd = `IF(${deptRange('serviceEndMin')}<$A${r},${deptRange('serviceEndMin')},$A${r})`;
      const clipStart = `IF(${deptRange('serviceStartMin')}<$A${r},${deptRange('serviceStartMin')},$A${r})`;
      setFormula(
        seriesSheet, `${col}${r}`,
        `IFERROR(100*SUMPRODUCT((${deptRange('dept')}="${DEPT_NAMES[k]}")*${deptRange('workersRequired')}*((${clipEnd})-(${clipStart})>0)*((${clipEnd})-(${clipStart})))/(${cap}*$A${r}),0)`,
      );
    }
  });
  setColWidthsAoa(seriesSheet, seriesAoa);

  const notes = buildNotesSheet([
    ['Department Summary formulas', 'Total Busy Worker-Minutes is a SUMPRODUCT over "Job Assignments", weighted by Workers Required and clipped to the horizon; Overall Utilization % = that total / (Effective Available Workers × Horizon).'],
    ['Utilization Over Time formulas', 'Each cell is a SUMPRODUCT over "Job Assignments" (weighted by Workers Required), summing busy worker-minutes clipped to that row’s sample time, divided by (available workers × sample time) — sampled at 60 points instead of 150 to keep the workbook responsive.'],
  ]);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, notes, 'Read Me');
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Department Summary');
  XLSX.utils.book_append_sheet(workbook, assignmentSheet, 'Job Assignments');
  XLSX.utils.book_append_sheet(workbook, seriesSheet, 'Utilization Over Time');

  const stamp = fmtTime(result.totalDuration).replace(/[^0-9A-Za-z]+/g, '-');
  XLSX.writeFile(workbook, `km-trans-worker-utilization-${stamp}.xlsx`);
}
