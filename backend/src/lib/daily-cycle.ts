// Publication must continue even when a previous contest cannot settle.
export async function runDailyCycleSteps(steps: {
  publish: () => Promise<unknown>;
  settle: () => Promise<unknown>;
  onError: (step: "publication" | "settlement", error: unknown) => void;
}): Promise<void> {
  try { await steps.publish(); }
  catch (error) { steps.onError("publication", error); }
  try { await steps.settle(); }
  catch (error) { steps.onError("settlement", error); }
}
