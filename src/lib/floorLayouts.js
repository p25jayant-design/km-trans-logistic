/* Pure geometry for the two selectable spatial workshop floor plans
 * (L-Shaped / U-Shaped) — per the case's Exhibit 3 bay-grouping reference:
 * Standard bays and Dedicated (long-duration) bays occupy separate arms of
 * the shop floor, with the Inspection bay sitting at the transition between
 * them. Everything here is just coordinates and waypoint lists in a fixed
 * 1000x560 canvas — no simulation logic, no React. `WorkshopFloorPlan.jsx`
 * is the only consumer.
 *
 * Each zone (Bu/Bi/Be) defines a corridor "rail" the bays sit off of, plus
 * the corner waypoints a truck must pass through to get from the shared
 * entry gate to that rail, and separately from that rail to the shared exit
 * gate. Because the L and U shapes route those corners completely
 * differently (L: one turn, right-then-down; U: two turns, down-across-up),
 * a truck's animated path visibly differs between the two layouts even
 * though the underlying bay data is identical. */

const CANVAS = { width: 1000, height: 560 };

function lerp(a, b, frac) { return a + (b - a) * frac; }

/** Given a zone's rail definition and an ordered list of bay ids, returns
 *  each bay's docked (x, y) position, evenly spaced along the rail. */
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
 *  leave. */
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
    entry: { x: 34, y: 70 },
    exit: { x: 860, y: 545 },
    queueHold: { x: 110, y: 108 },
    drawPath: 'M 34 70 L 860 70 L 860 545',
    // Flow order: Standard (horizontal arm) -> corner -> Dedicated (upper
    // vertical arm) -> Inspection (lower vertical arm, right before exit).
    zones: {
      Bu: {
        axis: 'x', corridor: 70, dock: 78, range: [170, 780],
        entryCorners: [], exitCorners: [{ x: 860, y: 70 }],
      },
      Be: {
        axis: 'y', corridor: 860, dock: -78, range: [150, 300],
        entryCorners: [{ x: 860, y: 70 }], exitCorners: [],
      },
      Bi: {
        axis: 'y', corridor: 860, dock: -78, range: [430, 430],
        entryCorners: [{ x: 860, y: 70 }], exitCorners: [],
      },
    },
  },
  U: {
    id: 'U',
    label: 'U-Shaped',
    description: 'Standard bays down one arm, dedicated bays along the base, inspection on the arm leading to exit.',
    canvas: CANVAS,
    entry: { x: 66, y: 34 },
    exit: { x: 934, y: 34 },
    queueHold: { x: 100, y: 96 },
    drawPath: 'M 66 34 L 100 34 L 100 500 L 900 500 L 900 34 L 934 34',
    // Flow order: Standard (left arm) -> Dedicated (base) -> Inspection
    // (right arm, leading up to exit).
    zones: {
      Bu: {
        axis: 'y', corridor: 100, dock: 78, range: [108, 462],
        entryCorners: [{ x: 100, y: 34 }],
        exitCorners: [{ x: 100, y: 500 }, { x: 900, y: 500 }, { x: 900, y: 34 }],
      },
      Be: {
        axis: 'x', corridor: 500, dock: -80, range: [230, 770],
        entryCorners: [{ x: 100, y: 34 }, { x: 100, y: 500 }],
        exitCorners: [{ x: 900, y: 500 }, { x: 900, y: 34 }],
      },
      Bi: {
        axis: 'y', corridor: 900, dock: -78, range: [108, 462],
        entryCorners: [{ x: 100, y: 34 }, { x: 100, y: 500 }, { x: 900, y: 500 }],
        exitCorners: [{ x: 900, y: 34 }],
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
