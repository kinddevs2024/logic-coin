import { useAppStore } from "@/store/app-store";
export function formatMoney(units: number) {
  return `$${(Math.max(0, units) / 100).toFixed(2)}`;
}

export function formatCompactUnits(units: number) {
  return new Intl.NumberFormat(useAppStore.getState().language ?? "uz", {
    maximumFractionDigits: 0,
  }).format(units);
}

export function initials(name?: string) {
  const value = name?.trim() || "LC";
  const Segmenter = (Intl as unknown as {Segmenter?: new (locale?: string, options?: {granularity: string}) => {segment: (text:string) => Iterable<{segment:string}>}}).Segmenter;
  const first = Segmenter ? Array.from(new Segmenter(undefined,{granularity:"grapheme"}).segment(value))[0]?.segment : Array.from(value)[0];
  return (first || "?").toUpperCase();
}
