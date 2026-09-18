/** Guards one mounted game only; never clears scores, coins, or other games. */
export function createGameExitSession(id: string) {
  let phase: "idle" | "playing" | "confirming" | "finished" | "discarded" = "idle";
  let pendingCompletion: (() => void) | undefined;

  const complete = (save: () => void) => {
    if (phase !== "playing" && phase !== "confirming") return;
    if (phase === "confirming") {
      pendingCompletion ??= save;
      return;
    }
    phase = "finished";
    save();
  };

  return {
    id,
    activate() {
      // React Strict Mode replays effect setup/cleanup before user interaction.
      if (phase === "discarded") phase = "idle";
    },
    start() {
      if (phase === "idle") phase = "playing";
    },
    requestExit() {
      if (phase !== "playing" && phase !== "confirming") return false;
      phase = "confirming";
      return true;
    },
    needsConfirmation: () => phase === "playing" || phase === "confirming",
    isDiscarded: () => phase === "discarded",
    complete,
    stay() {
      if (phase !== "confirming") return;
      phase = "playing";
      const pending = pendingCompletion;
      pendingCompletion = undefined;
      if (pending) complete(pending);
    },
    discard() {
      phase = "discarded";
      pendingCompletion = undefined;
    },
  };
}
