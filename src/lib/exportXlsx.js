import * as XLSX from 'xlsx';
import { fmtTime, DEPT_NAMES } from '../engine/desEngine.js';

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
