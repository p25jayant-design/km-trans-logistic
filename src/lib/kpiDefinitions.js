/* Single source of truth for what each Live KPI card actually means. Every
 * field here describes numbers this app already computes elsewhere
 * (frameSelectors.js's liveKpis/buildFrame, or the small local calculations
 * in KPIGrid.jsx) — nothing here changes or recomputes anything, it's pure
 * documentation shared by two UI surfaces: the hover tooltip on each KPI
 * card, and the "What do these KPIs mean?" expandable panel below the grid.
 * Keeping this in one place means the tooltip and the full explanation can
 * never drift apart, and both can never drift from what the code actually
 * does — every `formula` string below is a plain-English mirror of the real
 * expression in the code, checked against it directly. */

export const KPI_DEFINITIONS = [
  {
    id: 'avgWait',
    label: 'Avg Waiting Time',
    short: 'Average time a truck waits in the queue before its service begins.',
    formula: 'mean( serviceStart − arrivalTime ), over every truck whose service has started so far',
    units: 'minutes',
    interpretation:
      'A low, steady value means trucks are getting into a bay soon after they arrive. A value that keeps climbing means arrivals are outpacing how fast bays and workers can free up — the queue is building even if it isn’t visible yet in the Queue Length count.',
    importance:
      'This is usually the first number to move when the shop starts falling behind — it rises before bay or worker utilization even peaks, because a truck can be waiting on either resource. Watching it live is an early warning for a bottleneck forming, not just a report of one that already happened.',
  },
  {
    id: 'queueLen',
    label: 'Queue Length',
    short: 'Number of trucks currently waiting for a bay, right now.',
    formula: 'count of trucks with arrivalTime ≤ now, whose service has not yet started',
    units: 'trucks (count)',
    interpretation:
      'A queue hovering near zero means demand is being absorbed as fast as it arrives. A queue that keeps growing — rather than oscillating around some small number — means the shop is falling behind on a sustained basis, not just seeing a temporary burst.',
    importance:
      'This is the literal waiting line for the workshop. Because it’s a snapshot (not an average), it’s the number that most directly answers "is anyone waiting right now" — the figure an operator glancing at the floor would count by hand.',
  },
  {
    id: 'throughput',
    label: 'Throughput / day',
    short: 'Average number of completed jobs per simulated day, so far.',
    formula: 'completedCount ÷ (elapsed simulated minutes ÷ 1440)',
    units: 'trucks per day',
    interpretation:
      'This is the workshop’s realized output rate. Compare it against the combined arrival rate of every configured job type — if throughput is holding below the arrival rate for a sustained stretch, the queue and waiting time will keep growing no matter how the numbers look at any single instant.',
    importance:
      'Utilization and queue length describe how busy or backed-up the shop looks; throughput describes how much work is actually getting delivered. It’s the number that ties every other KPI back to the business outcome that matters — jobs finished.',
  },
  {
    id: 'busyBays',
    label: 'Busy Bays',
    short: 'Number of service bays currently occupied by a truck.',
    formula: 'count of bays (Standard + Dedicated + Inspection) with status = busy, right now',
    units: 'bays (count)',
    interpretation:
      'Compare against the total number of configured bays. Sitting near the maximum for a sustained stretch — not just a brief peak — is the direct sign that physical bay capacity, specifically, is the limiting resource.',
    importance:
      'This is the most literal read on whether the shop floor itself is the constraint, as opposed to the workforce. Pairing it with Idle Bays and Worker Utilization is how you tell "we need more bays" apart from "we need more workers."',
  },
  {
    id: 'idleBays',
    label: 'Idle Bays',
    short: 'Number of service bays currently sitting empty.',
    formula: '(total configured bays) − (busy bays), right now',
    units: 'bays (count)',
    interpretation:
      'The mirror image of Busy Bays. The interesting case is idle bays sitting alongside a nonzero queue: a bay can be physically free while a queued truck still can’t start, because that truck’s job also needs workers from a department that’s currently fully occupied — the bay isn’t the constraint in that moment, the workforce is.',
    importance:
      'This is the other half of the "bays vs. workers" diagnosis. Idle bays with an empty queue means genuine slack capacity; idle bays with trucks still waiting is a strong signal to check the per-department Worker Utilization cards for the real bottleneck.',
  },
  {
    id: 'workerUtil',
    label: 'Worker Utilization',
    short: 'Average share of workers currently occupied, across all departments.',
    formula: 'mean, across departments, of (busy workers ÷ that department’s effective available headcount) — headcount is already adjusted for configured absenteeism',
    units: 'percent',
    interpretation:
      'This is a workshop-wide average across every skill (Mechanical, Denting, Balancer, Electrician, Welder, Tire). A single department pinned near 100% can already be bottlenecking the whole shop even while this blended average still looks comfortable — always cross-check the individual department cards above before concluding "the workforce is fine."',
    importance:
      'Workers are usually the more expensive and less flexible resource to add than bay space. Sustained high utilization here — especially in one department — is the leading indicator for where hiring, cross-training, or shift changes would actually help.',
  },
  {
    id: 'completed',
    label: 'Completed Trucks',
    short: 'Total number of trucks that have fully departed so far.',
    formula: 'count of trucks with a recorded departure by now',
    units: 'trucks (count)',
    interpretation:
      'A running total — it only ever goes up over the course of a run. Its rate of increase over time is exactly what Throughput / day reports as a rate; this is the same information as a cumulative count instead of a per-day average.',
    importance:
      'The plainest possible measure of realized output to date. It’s the number to check against a target job count for the run, and the one every other flow-related KPI (throughput, avg time in system) is ultimately built from.',
  },
  {
    id: 'avgSystem',
    label: 'Avg Flow Time',
    short: 'Average total time from a truck’s arrival to its departure, for completed trucks.',
    formula: 'mean( departureTime − arrivalTime ), over every truck that has departed so far',
    units: 'minutes',
    interpretation:
      'This covers the truck’s entire visit — queueing plus service plus a small fixed in/out travel allowance — so it’s always at least as large as Avg Waiting Time. The two only stay close together when service itself is quick; a growing gap between them means service time (not queueing) is what’s dominating the visit.',
    importance:
      'This is the number a customer actually experiences: total time at the shop, start to finish. It’s the right figure to hold against any turnaround-time target, rather than waiting time alone, since a truck that skips the queue but sits through a very long repair still had a long visit.',
  },
  {
    id: 'accidentArrivals',
    label: 'Accident Repair Arrivals',
    short: 'Number of arrived trucks classified as Accident Repair, out of the combined Accident + Standard arrival pool.',
    formula: 'count of arrived trucks with arrival category = Accident Repair, ÷ (Accident + Standard arrivals) for the % shown',
    units: 'trucks (count), plus a % of the Accident+Standard pool',
    interpretation:
      'Each arriving truck in this pool is independently classified Accident Repair or Standard using the configured Accident Repair Arrival Percentage. Over enough arrivals, this share converges toward that configured percentage — the Simulation Summary panel shows both side by side as Configured vs. Observed ratio.',
    importance:
      'Accident Repair jobs are far heavier than routine Standard jobs (multiple departments, much longer service time), so this count is the leading indicator of how much of that heavy workload the shop is actually absorbing right now — a rising share here, more than any other single number, predicts rising queue length and waiting time shortly after.',
  },
  {
    id: 'standardArrivals',
    label: 'Standard Job Arrivals',
    short: 'Number of arrived trucks classified as Standard, out of the combined Accident + Standard arrival pool.',
    formula: 'count of arrived trucks with arrival category = Standard, ÷ (Accident + Standard arrivals) for the % shown',
    units: 'trucks (count), plus a % of the Accident+Standard pool',
    interpretation:
      'The complement of Accident Repair Arrivals within the same pool — the two percentages always sum to 100%. A Standard job is quick, routine maintenance (oil change, tires, wiring, and similar), so a high Standard share generally means the shop is processing a lighter, faster-moving mix of work.',
    importance:
      'Comparing this against Accident Repair Arrivals is the quickest read on today’s workload mix — the same total number of arriving trucks can mean a calm day or an overloaded one, entirely depending on this split, since Accident Repair jobs consume vastly more bay-time and worker-time per truck.',
  },
];

export const KPI_DEFINITIONS_BY_ID = Object.fromEntries(KPI_DEFINITIONS.map((d) => [d.id, d]));
