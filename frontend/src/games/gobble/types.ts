export type VortexPoint = { x: number; y: number };
export type VortexEntityKind = "crate" | "ball" | "plant" | "cone" | "fruit" | "human";

export type VortexEntity = {
  id: string;
  kind: VortexEntityKind;
  position: VortexPoint;
  radius: number;
  mass: number;
  edible: boolean;
  required: boolean;
  patrol?: [VortexPoint, VortexPoint];
};

export type VortexLevel = {
  id: number;
  title: string;
  stage: number;
  attempts: number;
  theme: "garden" | "warehouse" | "plaza";
  holeStart: VortexPoint;
  hole: { radius: number; grow: boolean; maxRadius: number; growthPerMass: number };
  entities: VortexEntity[];
};
