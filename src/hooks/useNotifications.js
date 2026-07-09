import { useCallback, useEffect, useRef, useState } from 'react';

/* Thresholds for the operational notifications below. These only *label*
 * numbers the frame/result already contain (queueLen, department busy/
 * total/utilization, bay status, completedSoFar, day) — nothing here
 * computes a new simulation value, it only watches existing ones cross a
 * line and turns that into a toast. Hysteresis (high/low pairs, or a
 * tracked Set of "currently flagged" keys) keeps a sustained condition
 * from re-firing every tick. */
const QUEUE_HIGH = 8;
const QUEUE_LOW = 4;
const SHORTAGE_UTIL = 0.9;
const MILESTONE_STEP = 100;

/** Watches `frame`/`result` for operationally interesting, presentation-only
 *  events — queue buildup, idle departments, saturated dedicated bays,
 *  worker shortages, and milestones (completions + new day) — and turns
 *  them into short-lived toast notifications. Pure UI observer: it never
 *  mutates simulation state and never changes what buttons/controls do. */
export function useNotifications(result, frame) {
  const [items, setItems] = useState([]);
  const idRef = useRef(0);

  const queueHighRef = useRef(false);
  const dedicatedFullRef = useRef(false);
  const idleDeptsRef = useRef(new Set());
  const shortageDeptsRef = useRef(new Set());
  const milestoneRef = useRef(0);
  const lastDayRef = useRef(0);

  const push = useCallback((notif) => {
    const id = ++idRef.current;
    setItems((cur) => [...cur, { id, ...notif }]);
    setTimeout(() => setItems((cur) => cur.filter((n) => n.id !== id)), 7000);
  }, []);

  const dismiss = useCallback((id) => {
    setItems((cur) => cur.filter((n) => n.id !== id));
  }, []);

  useEffect(() => {
    if (!result || !frame) {
      queueHighRef.current = false;
      dedicatedFullRef.current = false;
      idleDeptsRef.current.clear();
      shortageDeptsRef.current.clear();
      milestoneRef.current = 0;
      lastDayRef.current = 0;
      return;
    }

    // Queue buildup — fires once per rise above QUEUE_HIGH, re-arms once it
    // falls back to QUEUE_LOW (hysteresis avoids flapping right at the line).
    if (!queueHighRef.current && frame.queueLen >= QUEUE_HIGH) {
      queueHighRef.current = true;
      push({ kind: 'queue', title: 'Queue building up', message: `${frame.queueLen} trucks waiting — consider adding capacity.` });
    } else if (queueHighRef.current && frame.queueLen <= QUEUE_LOW) {
      queueHighRef.current = false;
    }

    // Idle resources — a department with zero busy workers while trucks wait.
    frame.departments.forEach((d) => {
      const isIdle = d.total > 0 && d.busy === 0 && frame.queueLen > 0;
      const wasFlagged = idleDeptsRef.current.has(d.key);
      if (isIdle && !wasFlagged) {
        idleDeptsRef.current.add(d.key);
        push({ kind: 'idle', title: 'Idle resource', message: `${d.name} team is idle while ${frame.queueLen} truck(s) wait.` });
      } else if (!isIdle && wasFlagged) {
        idleDeptsRef.current.delete(d.key);
      }
    });

    // Busy dedicated bays — every configured Be bay occupied at once.
    const totalBe = result.cfg.bays.Be;
    const busyBe = frame.bays.Be.filter((b) => b.status === 'busy').length;
    const dedicatedFull = totalBe > 0 && busyBe === totalBe;
    if (dedicatedFull && !dedicatedFullRef.current) {
      dedicatedFullRef.current = true;
      push({ kind: 'dedicated', title: 'Dedicated bays saturated', message: `All ${totalBe} dedicated bay(s) are occupied with long-duration jobs.` });
    } else if (!dedicatedFull) {
      dedicatedFullRef.current = false;
    }

    // Worker shortages — a department running near full capacity.
    frame.departments.forEach((d) => {
      const shortage = d.total > 0 && d.utilization >= SHORTAGE_UTIL;
      const wasFlagged = shortageDeptsRef.current.has(d.key);
      if (shortage && !wasFlagged) {
        shortageDeptsRef.current.add(d.key);
        push({ kind: 'shortage', title: 'Worker shortage', message: `${d.name} team at ${(d.utilization * 100).toFixed(0)}% capacity.` });
      } else if (!shortage && wasFlagged) {
        shortageDeptsRef.current.delete(d.key);
      }
    });

    // Milestones — completion count crossing round numbers.
    while (frame.completedSoFar >= milestoneRef.current + MILESTONE_STEP) {
      milestoneRef.current += MILESTONE_STEP;
      push({ kind: 'milestone', title: 'Milestone reached', message: `${milestoneRef.current.toLocaleString()} trucks serviced.` });
    }

    // Milestones — a new simulated day begins (skip the very first day).
    if (frame.day > lastDayRef.current) {
      const isFirstDay = lastDayRef.current === 0;
      lastDayRef.current = frame.day;
      if (!isFirstDay) {
        push({ kind: 'day', title: `Day ${frame.day} begins`, message: `${frame.arrivedSoFar.toLocaleString()} trucks served so far.` });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, frame && Math.floor(frame.t), push]);

  return { notifications: items, dismiss };
}
