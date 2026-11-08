import { env } from "../config/env.js";

export function unitsToCents(units: number): number {
  const quantized = Math.round(units * 10_000);
  if (!Number.isFinite(units) || !Number.isSafeInteger(quantized) || Math.abs(quantized / 10_000 - units) > 1e-9) {
    throw new Error("Units must have supported monetary precision");
  }
  return quantized * env.UNIT_VALUE_CENTS / 10_000;
}

export function centsToUnits(cents: number): number {
  if (!Number.isSafeInteger(cents) || cents % env.UNIT_VALUE_CENTS !== 0) {
    throw new Error(`Cents must be an integer multiple of ${env.UNIT_VALUE_CENTS}`);
  }
  return cents / env.UNIT_VALUE_CENTS;
}
