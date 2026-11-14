export type SelfDock = "top" | "bottom" | null;

// Recomputed in both scroll directions. A reached row is not permanently undocked.
export function getSelfDock(row: { y: number; height: number } | null, offset: number, viewport: number): SelfDock {
  if (!row || viewport <= 0) return "bottom";
  if (row.y < offset - 1) return "top";
  if (row.y + row.height > offset + viewport + 1) return "bottom";
  return null;
}
