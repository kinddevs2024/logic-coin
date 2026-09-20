import { describe, expect, it } from "vitest";
import { contestNeighborhood } from "../src/lib/contest-neighbors.js";
const rows = Array.from({ length: 12 }, (_, i) => ({ userId: String(i), totalCoins: 120 - i, completedGamesCount: 3, finishedAt: null }));
describe("contest neighborhood", () => {
  it("centers the player with two neighbors on each side", () => {
    const result = contestNeighborhood(rows, "6", 10, 100);
    expect(result.neighbors.map(row => row.rank)).toEqual([5, 6, 7, 8, 9]);
    expect(result.neighbors[2]?.userId).toBe("6");
  });
  it("keeps the first two players at the top and uses settlement cash rules", () => {
    expect(contestNeighborhood(rows, "0", 10, 100).neighbors[0]?.rank).toBe(1);
    expect(contestNeighborhood(rows, "1", 10, 100).neighbors[1]?.rank).toBe(2);
    expect(contestNeighborhood(rows, "0", 10, 100).projectedCashUnits).toBe(100);
    expect(contestNeighborhood(rows, "6", 10, 100).projectedCashUnits).toBe(0);
  });
  it("handles the last player, absent player and empty contest", () => {
    expect(contestNeighborhood(rows, "11", 10, 100).neighbors.map(row => row.rank)).toEqual([10, 11, 12]);
    expect(contestNeighborhood(rows, "absent", 10, 100).self).toBeNull();
    expect(contestNeighborhood([], "0", 10, 100).neighbors).toEqual([]);
  });
  it("moves the player when their score increases", () => {
    const updated = rows.map(row => row.userId === "6" ? { ...row, totalCoins: 999 } : row);
    expect(contestNeighborhood(updated, "6", 10, 100).self?.rank).toBe(1);
  });
});
