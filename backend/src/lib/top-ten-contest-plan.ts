import { createHash, createHmac, randomBytes } from "node:crypto";
import { rankContestStandings, type ContestStandingInput } from "./contest.js";
import { MICROS_PER_CENT } from "./percent-contest-plan.js";

export const TOP_TEN_CONTEST_POLICY = "all-six-percent-v3";
export const TOP_TEN_CASH_MICROS = [2_500_000,1_000_000,500_000,450_000,400_000,350_000,300_000,250_000,200_000,150_000] as const;
const POOL_MICROS = 8_250_000;
const AFTER_TOP_TEN_CAP = 2_150_000;

export function newContestPayoutSeed() { return randomBytes(32).toString("hex"); }

function seededInteger(seed: string, sortedIds: readonly string[]) {
  const cohort = createHash("sha256").update(JSON.stringify(sortedIds)).digest();
  const key = Buffer.from(seed, "hex");
  let block = Buffer.alloc(0), cursor = 0, counter = 0;
  return (bound: number) => {
    if (!Number.isSafeInteger(bound) || bound < 1 || bound > 0x1_0000_0000) throw new Error("Invalid draw bound");
    const limit = 0x1_0000_0000 - (0x1_0000_0000 % bound);
    for (;;) {
      if (cursor >= block.length) {
        block = createHmac("sha256", key).update("daily-cash-v3\0").update(cohort).update(String(counter++)).digest();
        cursor = 0;
      }
      const value = block.readUInt32BE(cursor); cursor += 4;
      if (value < limit) return value % bound;
    }
  };
}

function shuffle<T>(items: T[], random: (bound: number) => number) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [items[i],items[j]] = [items[j]!,items[i]!];
  }
  return items;
}

function positiveParts(total: number, count: number, random: (bound: number) => number) {
  // Floyd sampling chooses distinct cut points in bounded time, even when
  // only one microdollar per part remains.
  const positions = new Set<number>();
  for (let j = total - count; j < total - 1; j++) {
    const pick = random(j + 1);
    positions.add(positions.has(pick) ? j : pick);
  }
  const cuts = [0, ...[...positions].map(value => value + 1).sort((a,b)=>a-b), total];
  return cuts.slice(1).map((value,i)=>value-cuts[i]!);
}

function tailCash(ids: readonly string[], seed: string) {
  const sortedIds = [...ids].sort();
  const random = seededInteger(seed, sortedIds);
  const shuffled = shuffle(sortedIds, random);
  const result = new Map<string,number>();
  for (let offset = 0; offset < shuffled.length; offset += 6) {
    const count = Math.min(6, shuffled.length-offset);
    const major = count === 6 ? 1 + random(595) : 0;
    const bonuses = count === 6
      ? [major, ...positiveParts(600-major,5,random)]
      : positiveParts(count*100,count,random);
    shuffle(bonuses,random);
    bonuses.forEach((bonus,i)=>result.set(shuffled[offset+i]!,1000+bonus));
  }
  return result;
}

function capAfterTopTen(weights: readonly number[], userIds: readonly string[]) {
  const total = weights.reduce((sum,value)=>sum+value,0);
  if (total <= AFTER_TOP_TEN_CAP) return [...weights];
  if (weights.length > AFTER_TOP_TEN_CAP) throw new Error("Participant count exceeds supported monetary precision");
  // Reserve a positive microdollar for everyone before scaling the remainder.
  const budget = BigInt(AFTER_TOP_TEN_CAP-weights.length);
  const denominator = BigInt(total-weights.length);
  const products = weights.map(value=>BigInt(value-1)*budget);
  const amounts = products.map(value=>1+Number(value/denominator));
  let remaining = AFTER_TOP_TEN_CAP-amounts.reduce((sum,value)=>sum+value,0);
  const order = products.map((value,index)=>({index,remainder:value%denominator}))
    .sort((a,b)=>a.remainder===b.remainder?userIds[a.index]!.localeCompare(userIds[b.index]!):a.remainder>b.remainder?-1:1);
  for (const row of order) { if (!remaining) break; amounts[row.index]!++; remaining--; }
  return amounts;
}

export function topTenContestPlan(standings: readonly ContestStandingInput[], seed?: string | null) {
  if (!seed || !/^[a-f0-9]{64}$/i.test(seed)) throw new Error("A persisted payout seed is required for v3 contests");
  const eligible = standings.filter(row=>row.completedGamesCount===6);
  const n = eligible.length;
  if (n > AFTER_TOP_TEN_CAP + 10) throw new Error("Participant count exceeds supported monetary precision");
  if (new Set(eligible.map(row=>row.userId)).size !== n) throw new Error("Duplicate contest participant");
  const bands = {participantCount:n,cashWinners:n,caseWinners:0,randomWinners:0,coinWinners:0};
  const ranked = rankContestStandings(eligible,bands);
  const micros: number[] = TOP_TEN_CASH_MICROS.slice(0,n);
  let start = Math.min(10,n);
  for (const [boundary,amount] of [[30,10_000],[60,3_500],[100,2_000],[150,1_600]] as const) {
    const end = Math.min(n,Math.max(start,Math.ceil(n*boundary/1000)));
    for (let i=start;i<end;i++) micros.push(amount);
    start = end;
  }
  const randomCash = tailCash(ranked.slice(start).map(row=>row.userId),seed);
  for (let i=start;i<n;i++) micros.push(randomCash.get(ranked[i]!.userId)!);
  const capped = capAfterTopTen(micros.slice(10),ranked.slice(10).map(row=>row.userId));
  capped.forEach((amount,i)=>{micros[i+10]=amount;});
  const total = micros.reduce((sum,value)=>sum+value,0);
  const ladder = micros.map(value=>value/MICROS_PER_CENT);
  return {bands,ladder,ranked:ranked.map((row,i)=>({...row,cashUnits:ladder[i]!,cashMicros:micros[i]!})),
    distributedUnits:total/MICROS_PER_CENT,unallocatedUnits:(POOL_MICROS-total)/MICROS_PER_CENT};
}
