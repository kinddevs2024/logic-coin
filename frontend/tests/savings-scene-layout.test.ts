import { expect, it } from "vitest";
import { getSavingsSceneLayout } from "../src/lib/savings-scene-layout";
it.each([[279,640],[427,854],[728,1024]])("keeps mobile artwork 30px below rankings and controls flush with scene at %s", (width,height) => {
  const layout = getSavingsSceneLayout(width,height,false);
  const visibleTop = layout.stageTop + 185 - 185 * layout.scale + (340 * 150 / 1024 - 20) * layout.scale;
  expect(visibleTop + 4).toBeCloseTo(30);
  expect(layout.height - layout.actionsTop).toBeCloseTo(64);
});
