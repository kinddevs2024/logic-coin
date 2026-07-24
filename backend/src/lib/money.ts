import { env } from "../config/env.js";

export function unitsToCents(units: number): number {
  if (!Number.isSafeInteger(units)) {
    throw new Error("Units must be a safe integer");
  }
  return units * env.UNIT_VALUE_CENTS;
}

export function centsToUnits(cents: number): number {
  if (!Number.isSafeInteger(cents) || cents % env.UNIT_VALUE_CENTS !== 0) {
    throw new Error(`Cents must be an integer multiple of ${env.UNIT_VALUE_CENTS}`);
  }
  return cents / env.UNIT_VALUE_CENTS;
}
