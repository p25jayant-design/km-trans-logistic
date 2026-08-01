/* Pure geometry for the two selectable spatial workshop floor plans
 * (L-Shaped / U-Shaped) — per the case's Exhibit 3 bay-grouping reference:
 * Standard bays and Dedicated (long-duration) bays occupy separate arms of
 * the shop floor, with the Inspection bay sitting at the transition between
 * them (flow order: Standard -> Dedicated -> Inspection -> Exit). Everything
 * here is just coordinates and waypoint lists in a fixed canvas — no
 * simulation logic, no React. `WorkshopFloorPlan.jsx` is the only consumer.
 *
 * Each zone (Bu/Bi/Be) defines a corridor "rail" the bays sit off of, plus
 * the corner waypoints a truck must pass through to get from the shared
 * entry gate to that rail, and separately from that rail to the shared exit
 * gate. Because the L and U shapes route those corners completely
 * differently (L: one turn, right-then-down; U: two turns, down-across-up),
 * a truck's animated path visibly differs between the two layouts even
 * though the underlying bay data is identical.
 *
 * Bay footprint is intentionally roomy (BAY_W x BAY_H) — large enough for a
 * full "workstation card" (id, type, status badge, occupant, worker icons)
 * rather than a bare dot, per the industrial-floor-plan visual upgrade.
 *
 * Zone ranges below are deliberately generous, not just "big enough for the
 * baseline bay counts": every zone boundary keeps at least ~45px of clear
 * space from every OTHER zone's bay footprint, even at each zone's range
 * extreme (where a bay always ends up, regardless of how many bays are
 * actually configured — `positionsAlongRail` always places the first/last
 * bay exactly at `range[0]`/`range[1]`). Two zones only ever collide where
 * one zone's bays vary along one axis while sitting at a fixed position on
 * the other axis (its "dock" offset) — so the fix is to keep each zone's
 * fixed dock coordinate far enough from every other zone's range that their
 * bounding boxes can never overlap, independent of bay count. Verified with
 * a Node script that checks every zone pair's bounding boxes for n = 1..10
 * bays (see the floor-plan overlap fix commit). */

export const CANVAS = { width: 1700, height: 1150 };
export const BAY_W = 104;
export const BAY_H = 70;

function lerp(a, b, frac) { return a + (b - a) * frac; }

/** Given a zone's rail definition and an ordered list of bay ids, returns
 *  each bay's docked (x, y) position, evenly spaced along the rail — this is
 *  the "aligned row" every bay of that zone sits on. */
function positionsAlongRail(zone, bayIds) {
  const n = bayIds.length;
  return bayIds.map((id, i) => {
    const frac = n <= 1 ? 0.5 : i / (n - 1);
    const along = lerp(zone.range[0], zone.range[1], frac);
    if (zone.axis === 'x') {
      return { id, x: along, y: zone.corridor + zone.dock };
    }
    return { id, x: zone.corridor + zone.dock, y: along };
  });
}

/** The point on the corridor itself directly "outside" a given bay — where
 *  a truck turns off the main corridor to dock, or turns back onto it to
 *  leave. Also used to draw the short access-lane stub into each bay. */
function approachPoint(zone, bayPos) {
  if (zone.axis === 'x') return { x: bayPos.x, y: zone.corridor };
  return { x: zone.corridor, y: bayPos.y };
}

export const LAYOUTS = {
  L: {
    id: 'L',
    label: 'L-Shaped',
    description: 'Standard bays along the entry corridor, turning into the dedicated arm, with inspection just before exit.',
    canvas: CANVAS,
    entry: { x: 40, y: 110 },
    exit: { x: 1600, y: 1050 },
    queueHold: { x: 120, y: 165 },
    drawPath: 'M 40 110 L 1600 110 L 1600 1050',
    corridorPath: [{ x: 40, y: 110 }, { x: 1600, y: 110 }, { x: 1600, y: 1050 }],
    // Flow order: Standard (horizontal arm) -> corner -> Dedicated (upper
    // vertical arm) -> Inspection (lower vertical arm, right before exit).
    zones: {
      Bu: {
        axis: 'x', corridor: 110, dock: 150, range: [220, 1300],
        entryCorners: [], exitCorners: [{ x: 1600, y: 110 }],
      },
      Be: {
        axis: 'y', corridor: 1600, dock: -150, range: [210, 660],
        entryCorners: [{ x: 1600, y: 110 }], exitCorners: [],
      },
      Bi: {
        axis: 'y', corridor: 1600, dock: -150, range: [800, 980],
        entryCorners: [{ x: 1600, y: 110 }], exitCorners: [],
      },
    },
  },
  U: {
    id: 'U',
    label: 'U-Shaped',
    description: 'Standard bays down one arm, dedicated bays along the base, inspection on the arm leading to exit.',
    canvas: CANVAS,
    entry: { x: 90, y: 60 },
    exit: { x: 1610, y: 60 },
    queueHold: { x: 130, y: 130 },
    drawPath: 'M 90 60 L 170 60 L 170 1080 L 1530 1080 L 1530 60 L 1610 60',
    corridorPath: [
      { x: 90, y: 60 }, { x: 170, y: 60 }, { x: 170, y: 1080 },
      { x: 1530, y: 1080 }, { x: 1530, y: 60 }, { x: 1610, y: 60 },
    ],
    // Flow order: Standard (left arm) -> Dedicated (base) -> Inspection
    // (right arm, leading up to exit).
    zones: {
      Bu: {
        axis: 'y', corridor: 170, dock: 150, range: [180, 950],
        entryCorners: [{ x: 170, y: 60 }],
        exitCorners: [{ x: 170, y: 1080 }, { x: 1530, y: 1080 }, { x: 1530, y: 60 }],
      },
      Be: {
        axis: 'x', corridor: 1080, dock: -150, range: [450, 1050],
        entryCorners: [{ x: 170, y: 60 }, { x: 170, y: 1080 }],
        exitCorners: [{ x: 1530, y: 1080 }, { x: 1530, y: 60 }],
      },
      Bi: {
        axis: 'y', corridor: 1530, dock: -150, range: [180, 950],
        entryCorners: [{ x: 170, y: 60 }, { x: 170, y: 1080 }, { x: 1530, y: 1080 }],
        exitCorners: [{ x: 1530, y: 60 }],
      },
    },
  },
};

/** Docked position for every bay in a zone, given the bay ids in display
 *  order (matching `frame.bays[type]`'s existing order from the engine). */
export function computeZonePositions(layout, zoneKey, bayIds) {
  const zone = layout.zones[zoneKey];
  if (!zone || !bayIds.length) return [];
  return positionsAlongRail(zone, bayIds);
}

/** The short access-lane stub between a zone's main corridor and one of its
 *  docked bays — drawn as a small connecting lane so bays read as proper
 *  parking/service stalls branching off the road, not floating shapes. */
export function accessStub(layout, zoneKey, bayPos) {
  const zone = layout.zones[zoneKey];
  return { from: approachPoint(zone, bayPos), to: bayPos };
}

/** Full waypoint path a truck travels from the shared entry gate into a
 *  specific docked bay. */
export function pathIntoBay(layout, zoneKey, bayPos) {
  const zone = layout.zones[zoneKey];
  const approach = approachPoint(zone, bayPos);
  return [layout.entry, ...zone.entryCorners, approach, bayPos];
}

/** Full waypoint path a truck travels from a specific docked bay out to the
 *  shared exit gate — not simply the reverse of `pathIntoBay`, since a bay
 *  may need a different corner sequence to reach the exit than it needed to
 *  be reached from the entry. */
export function pathOutOfBay(layout, zoneKey, bayPos) {
  const zone = layout.zones[zoneKey];
  const approach = approachPoint(zone, bayPos);
  return [bayPos, approach, ...zone.exitCorners, layout.exit];
}
