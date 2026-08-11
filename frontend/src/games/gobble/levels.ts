import type { VortexEntity, VortexLevel, VortexPoint } from "./types";

const OBJECT_POSITIONS: VortexPoint[] = [
  { x: 0.18, y: 0.18 }, { x: 0.42, y: 0.17 }, { x: 0.72, y: 0.2 },
  { x: 0.84, y: 0.42 }, { x: 0.68, y: 0.53 }, { x: 0.38, y: 0.43 },
  { x: 0.16, y: 0.55 }, { x: 0.28, y: 0.74 }, { x: 0.55, y: 0.76 },
  { x: 0.8, y: 0.76 }, { x: 0.55, y: 0.32 }, { x: 0.12, y: 0.34 },
];

const KINDS = ["crate", "ball", "plant", "cone", "fruit"] as const;

function createEntities(id: number, stage: number): VortexEntity[] {
  if (id <= 2) {
    const structurePositions: VortexPoint[] = id === 1
      ? [
          { x: 0.38, y: 0.32 }, { x: 0.5, y: 0.28 }, { x: 0.62, y: 0.34 },
          { x: 0.43, y: 0.46 }, { x: 0.57, y: 0.47 },
        ]
      : [
          { x: 0.34, y: 0.27 }, { x: 0.48, y: 0.24 }, { x: 0.62, y: 0.27 },
          { x: 0.39, y: 0.4 }, { x: 0.54, y: 0.4 }, { x: 0.68, y: 0.42 },
        ];
    return [
      ...structurePositions.map((position, index) => ({
        id: `structure-${id}-${index}`,
        kind: "crate" as const,
        position,
        radius: 0.044,
        mass: 1,
        edible: true,
        required: true,
      })),
      {
        id: `plant-${id}-left`, kind: "plant", position: { x: 0.2, y: 0.43 },
        radius: 0.033, mass: 1, edible: true, required: true,
      },
      {
        id: `plant-${id}-right`, kind: "plant", position: { x: 0.82, y: 0.4 },
        radius: 0.033, mass: 1, edible: true, required: true,
      },
    ];
  }
  const objectCount = Math.min(9, 3 + ((id - 1) % 4) + (stage - 1));
  const offset = (id * 3) % OBJECT_POSITIONS.length;
  const entities: VortexEntity[] = Array.from({ length: objectCount }, (_, index) => {
    const position = OBJECT_POSITIONS[(index + offset) % OBJECT_POSITIONS.length]!;
    const kind = KINDS[(index + id) % KINDS.length]!;
    const large = stage > 1 && index === objectCount - 1 && id % 3 === 0;
    return {
      id: `object-${id}-${index}`,
      kind,
      position: { ...position },
      radius: large ? 0.052 : kind === "ball" ? 0.035 : 0.03,
      mass: large ? 2 : 1,
      edible: true,
      required: true,
    };
  });

  const humanCount = id < 6 ? 0 : stage === 1 ? 1 : id < 21 ? 2 : 2;
  const humanSpots: VortexPoint[] = [
    { x: 0.5, y: 0.5 },
    { x: 0.78, y: 0.58 },
  ];
  for (let index = 0; index < humanCount; index += 1) {
    const origin = humanSpots[index]!;
    entities.push({
      id: `human-${id}-${index}`,
      kind: "human",
      position: { ...origin },
      radius: 0.038,
      mass: 2,
      edible: false,
      required: false,
      ...(stage === 3
        ? {
            patrol: [
              { x: origin.x - 0.08, y: origin.y },
              { x: origin.x + 0.08, y: origin.y },
            ] as [VortexPoint, VortexPoint],
          }
        : {}),
    });
  }
  return entities;
}

export const VORTEX_LEVELS: VortexLevel[] = Array.from({ length: 30 }, (_, index) => {
  const id = index + 1;
  const stage = Math.ceil(id / 10);
  const theme = stage === 1 ? "garden" : stage === 2 ? "warehouse" : "plaza";
  return {
    id,
    title: id <= 5 ? `Первый улов ${id}` : id <= 10 ? `Осторожно ${id}` : id <= 20 ? `Склад ${id}` : `Площадь ${id}`,
    stage,
    attempts: 3,
    theme,
    holeStart: { x: 0.5, y: 0.9 },
    hole: {
      radius: 0.074,
      grow: id >= 11 && id % 2 === 0,
      maxRadius: 0.112,
      growthPerMass: 0.004,
    },
    entities: createEntities(id, stage),
  };
});

export function getVortexLevel(id: number): VortexLevel {
  return VORTEX_LEVELS[Math.max(0, Math.min(VORTEX_LEVELS.length - 1, id - 1))]!;
}
