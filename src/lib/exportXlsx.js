import * as XLSX from 'xlsx';
import { fmtTime, DEPT_NAMES, DEPT_KEYS } from '../engine/desEngine.js';
import { BAY_TYPE_LABEL } from './styleMaps.js';

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

/** Exports one row per truck/job — raw simulation records only. Deliberately
 *  excludes wait-time, time-in-system, throughput, or any other
 *  computed/aggregate figure; those live in the on-screen KPI cards and
 *  charts, not in this raw data dump. */
export function exportSimulationXlsx(result) {
  if (!result || !result.trucks?.length) return;

  const rows = result.trucks.map((tr) => ({
    'Truck ID': tr.id,
    'Carrier Type': tr.vehicleType,
    'Job Type': tr.job.name,
    'Job Category': tr.job.category,
    'Bay Assigned': tr.bay || 'Not yet allocated',
    'Workers Assigned': formatWorkers(tr.job.req),
    'Arrival Time': fmtTime(tr.arrivalTime),
    'Service Start': tr.serviceStart != null ? fmtTime(tr.serviceStart) : '—',
    'Service End': tr.serviceEnd != null ? fmtTime(tr.serviceEnd) : '—',
    'Departure Time': tr.departureTime != null ? fmtTime(tr.departureTime) : '—',
    'Status': statusOf(tr),
  }));

  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet['!cols'] = [
    { wch: 9 },  // Truck ID
    { wch: 16 }, // Carrier Type
    { wch: 28 }, // Job Type
    { wch: 13 }, // Job Category
    { wch: 13 }, // Bay Assigned
    { wch: 30 }, // Workers Assigned
    { wch: 16 }, // Arrival Time
    { wch: 16 }, // Service Start
    { wch: 16 }, // Service End
    { wch: 16 }, // Departure Time
    { wch: 12 }, // Status
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Truck Records');

  const stamp = fmtTime(result.totalDuration).replace(/[^0-9A-Za-z]+/g, '-');
  XLSX.writeFile(workbook, `km-trans-simulation-data-${stamp}.xlsx`);
}

function autoFitCols(sheet, rows) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  sheet['!cols'] = keys.map((k) => {
    const longest = rows.reduce((m, r) => Math.max(m, String(r[k] ?? '').length), k.length);
    return { wch: Math.min(42, Math.max(10, longest + 2)) };
  });
}

/** Exports everything the dashboard already computed about bay utilization —
 *  not just the on-screen single-bay chart, but every bay, across three
 *  sheets: a per-bay summary (config + final utilization + job counts), the
 *  full raw job history for every bay slot (every interval the engine ever
 *  recorded), and the same running-utilization-over-time series the live
 *  chart is built from, laid out as one column per bay so it's directly
 *  chartable in Excel. Purely reads already-computed `result`/`util` fields
 *  (`bayUtilBySlot`, `baySlots[].intervals`, `computeUtilSeries`'s
 *  `baySlotSeries`) — no new calculation, no simulation logic. */
export function exportBayUtilizationXlsx(result) {
  const util = result?.util;
  if (!result || !util) return;

  const TYPE_ORDER = ['Bu', 'Be', 'Bi'];

  // Sheet 1 — per-bay summary
  const summaryRows = [];
  TYPE_ORDER.forEach((type) => {
    result.baySlots[type].forEach((slot) => {
      const kpi = result.kpis.bayUtilBySlot.find((b) => b.id === slot.id);
      const busyMin = slot.intervals.reduce((s, iv) => s + (iv.end - iv.start), 0);
      summaryRows.push({
        'Bay ID': slot.id,
        'Bay Type': BAY_TYPE_LABEL[type],
        'Configured Count (this type)': result.cfg.bays[type],
        'Overall Utilization %': kpi ? +(kpi.util * 100).toFixed(2) : 0,
        'Total Jobs Served': slot.intervals.length,
        'Total Busy Minutes': +busyMin.toFixed(1),
        'Avg Job Duration (min)': slot.intervals.length ? +(busyMin / slot.intervals.length).toFixed(1) : 0,
        'Horizon (min)': +result.horizonMinutes.toFixed(1),
      });
    });
  });
  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
  autoFitCols(summarySheet, summaryRows);

  // Sheet 2 — full raw job history for every bay slot
  const historyRows = [];
  TYPE_ORDER.forEach((type) => {
    result.baySlots[type].forEach((slot) => {
      slot.intervals.forEach((iv) => {
        historyRows.push({
          'Bay ID': slot.id,
          'Bay Type': BAY_TYPE_LABEL[type],
          'Truck ID': iv.truckId,
          'Job Name': iv.jobName,
          'Job Category': iv.category,
          'Carrier Type': iv.vehicleType,
          'Start Time': fmtTime(iv.start),
          'End Time': fmtTime(iv.end),
          'Duration (min)': +(iv.end - iv.start).toFixed(1),
        });
      });
    });
  });
  historyRows.sort((a, b) => a['Bay ID'].localeCompare(b['Bay ID']) || a['Truck ID'] - b['Truck ID']);
  const historySheet = XLSX.utils.json_to_sheet(historyRows);
  autoFitCols(historySheet, historyRows);

  // Sheet 3 — running utilization %, one column per bay, sampled on the same
  // time grid the live chart uses (result.util.sampleTimes).
  const allBayIds = TYPE_ORDER.flatMap((type) => result.baySlots[type].map((s) => s.id));
  const seriesRows = util.sampleTimes.map((t, i) => {
    const row = { 'Day': +(t / 1440).toFixed(3), 'Sim Time': fmtTime(t) };
    allBayIds.forEach((id) => {
      const s = util.baySlotSeries[id];
      row[`${id} Util %`] = s ? +s.series[i].toFixed(2) : 0;
    });
    return row;
  });
  const seriesSheet = XLSX.utils.json_to_sheet(seriesRows);
  autoFitCols(seriesSheet, seriesRows);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Bay Summary');
  XLSX.utils.book_append_sheet(workbook, historySheet, 'Bay Job History');
  XLSX.utils.book_append_sheet(workbook, seriesSheet, 'Utilization Over Time');

  const stamp = fmtTime(result.totalDuration).replace(/[^0-9A-Za-z]+/g, '-');
  XLSX.writeFile(workbook, `km-trans-bay-utilization-${stamp}.xlsx`);
}

/** Exports everything the dashboard already computed about worker/department
 *  utilization — a per-department summary (workforce config + final
 *  utilization), every job-to-department assignment the engine recorded
 *  (since there's no per-individual-worker identity in this model, only
 *  pooled department capacity — matching how the rest of the dashboard
 *  already represents workers), and the running-utilization-over-time
 *  series the live chart is built from, one column per department. Purely
 *  reads already-computed `result`/`util` fields — no new calculation. */
export function exportWorkerUtilizationXlsx(result) {
  const util = result?.util;
  if (!result || !util) return;

  // Sheet 1 — per-department summary
  const summaryRows = DEPT_KEYS.map((k) => {
    const d = result.cfg.departments[k];
    return {
      'Department': DEPT_NAMES[k],
      'Total Workers (configured)': d.total,
      'High Skill': d.high,
      'Medium Skill': d.med,
      'Low Skill': d.low,
      'Absent %': +(d.absent * 100).toFixed(1),
      'Effective Available Workers': result.deptAvail[k],
      'Overall Utilization %': +((result.kpis.deptUtil[k] || 0) * 100).toFixed(2),
    };
  });
  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
  autoFitCols(summarySheet, summaryRows);

  // Sheet 2 — every job-to-department assignment the engine recorded (one
  // row per truck per department its job required workers from).
  const assignmentRows = [];
  result.trucks.forEach((tr) => {
    if (tr.serviceStart == null) return; // never got allocated (still queued at run's end)
    Object.entries(tr.job.req).forEach(([dept, count]) => {
      if (!count) return;
      assignmentRows.push({
        'Truck ID': tr.id,
        'Department': DEPT_NAMES[dept],
        'Workers Required': count,
        'Job Name': tr.job.name,
        'Job Category': tr.job.category,
        'Carrier Type': tr.vehicleType,
        'Bay': tr.bay || '—',
        'Service Start': fmtTime(tr.serviceStart),
        'Service End': tr.serviceEnd != null ? fmtTime(tr.serviceEnd) : '—',
      });
    });
  });
  const assignmentSheet = XLSX.utils.json_to_sheet(assignmentRows);
  autoFitCols(assignmentSheet, assignmentRows);

  // Sheet 3 — running utilization %, one column per department, sampled on
  // the same time grid the live chart uses (result.util.sampleTimes).
  const seriesRows = util.sampleTimes.map((t, i) => {
    const row = { 'Day': +(t / 1440).toFixed(3), 'Sim Time': fmtTime(t) };
    DEPT_KEYS.forEach((k) => {
      const s = util.deptSeries[k];
      row[`${DEPT_NAMES[k]} Util %`] = s ? +s[i].toFixed(2) : 0;
    });
    return row;
  });
  const seriesSheet = XLSX.utils.json_to_sheet(seriesRows);
  autoFitCols(seriesSheet, seriesRows);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Department Summary');
  XLSX.utils.book_append_sheet(workbook, assignmentSheet, 'Job Assignments');
  XLSX.utils.book_append_sheet(workbook, seriesSheet, 'Utilization Over Time');

  const stamp = fmtTime(result.totalDuration).replace(/[^0-9A-Za-z]+/g, '-');
  XLSX.writeFile(workbook, `km-trans-worker-utilization-${stamp}.xlsx`);
}
