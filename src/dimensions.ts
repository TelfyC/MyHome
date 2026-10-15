// Metres. Read handwritten dimensions from docs/newStructure.jpg only;
// its original partitions, bathroom locations and window symbols are not a design input.
export const MEASUREMENTS = {
  masterWidth: 3.25,
  masterSleepingDepth: 3.35,
  dressingWidth: 2.12,
  dressingDepth: 1.94,
  dressingPassage: .93,
  guestWidth: 3.05,
  studyWidth: 2.75,
  studyDepth: 3.40,
  bathroomWidth: 1.65,
  bathroomDepth: 3.70,
  diningWidth: 2.50,
  diningAndUpperBalconyDepth: 3.45, // Includes balcony, confirmed by the user.
  kitchenWidth: 2.62,
  kitchenDepth: 2.44,
  publicPassage: 1.03,
  livingWidth: 3.30,
  livingMainDepth: 4.60, // From below kitchen through the open public area.
  lowerAlcoveWidth: 1.95,
  lowerAlcoveDepth: 1.80,
  entranceWidth: 1.65,
  entranceDepth: 2.05,
} as const;

// Existing wall thickness and unmeasured offsets stay conceptual. A 120 mm
// former divider is counted in the master/dressing depth but is not rebuilt.
export const WALL_THICKNESS = .22;
const t = WALL_THICKNESS;
const m = MEASUREMENTS;
const masterWest = -.11;
const studyWest = masterWest + m.masterWidth + t;
const studyEast = studyWest + m.studyWidth + t;
const livingEast = studyEast + m.livingWidth + t;
const diningWest = livingEast - m.diningWidth - t;
const bathroomWest = diningWest - m.bathroomWidth - t;
const guestWest = bathroomWest - m.guestWidth - t;
const upperSouth = m.bathroomDepth + t;
const studyNorth = upperSouth + m.publicPassage + t;
const studySouth = studyNorth + m.studyDepth + t;
const kitchenSouth = m.kitchenDepth + t;
const livingStep = kitchenSouth + m.livingMainDepth + t;
const livingSouth = livingStep + m.lowerAlcoveDepth + t;
const masterSouth = upperSouth + m.dressingDepth + .12 + m.masterSleepingDepth + t;
const upperBalconyNorth = kitchenSouth - m.diningAndUpperBalconyDepth - t;

export const X = {
  masterWest, studyWest, studyEast, livingEast, diningWest, bathroomWest, guestWest,
  kitchenEast: livingEast + m.kitchenWidth + t,
  entranceEast: livingEast + m.entranceWidth + t,
  lowerAlcoveEast: studyEast + m.lowerAlcoveWidth + t,
} as const;
export const Z = {
  north: 0, upperSouth, studyNorth, studySouth, kitchenSouth,
  livingStep, livingSouth, masterSouth, upperBalconyNorth,
  // The upper balcony's own depth has no separate dimension; retain an open,
  // conceptual subdivision inside the confirmed 3.45 m combined span.
  diningNorth: .25,
  entranceSouth: kitchenSouth + m.entranceDepth + t,
  masterSleepingNorth: upperSouth + t / 2 + m.dressingDepth + .12,
} as const;

// Furniture remains true to its product dimensions. Move whole pieces, rather
// than stretching beds, screens and cabinet depths with the architectural plan.
// Input coordinates refer to the original concept model, retained in model.ts.
export function relocateFurniture(x: number, z: number): [number, number] {
  if (x >= 9.85) {
    if (z >= 3.01) return [x + X.entranceEast - 11.46, z + Z.entranceSouth - 6.31];
    if (z < .75) return [x + (X.kitchenEast - 12.22) / 2, z];
    if (x > 11.35) return [x + X.kitchenEast - 12.22, z + (Z.kitchenSouth - 3.01) / 2];
    return [x, z + Z.kitchenSouth - 3.01];
  }
  if (z < 4.31 && x >= 1.7 && x < 5.3) {
    const dx = (X.guestWest + X.bathroomWest - 1.88 - 5.3) / 2;
    return [x + dx, z + (z > 3.2 ? Z.upperSouth - 4.31 : (Z.upperSouth - 4.31) / 2)];
  }
  if (z < 4.31 && x >= 5.3 && x < 7.13) {
    const dz = z < 1.6 ? 0 : z < 2.8 ? (Z.upperSouth - 4.31) / 2 : Z.upperSouth - 4.31;
    return [x + (X.bathroomWest - 5.3) / 2, z + dz];
  }
  if (x >= 7.13 && z < 4.31) {
    return [x, z < 1.1 ? z : z - 1.18];
  }
  if (x < 3.25 && z >= 4.0) {
    const dz = z > 7.0 ? Z.masterSouth - 10.76 : z >= 6.15 ? -.70 : Z.upperSouth - 4.31;
    return [x, z + dz];
  }
  if (x >= 3.25 && x < 6.33 && z > 5.5) {
    const dz = z < 6.5 ? Z.studyNorth - 5.65
      : z >= 8.3 ? Z.studySouth - 9.77
      : (Z.studyNorth + Z.studySouth - 5.65 - 9.77) / 2;
    return [x, z + dz];
  }
  if (x >= 6.33 && z >= 4.5) {
    return [x, z + (z > 8.9 ? Z.livingSouth - 10.76 : -1.03)];
  }
  return [x, z];
}
