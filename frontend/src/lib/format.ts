export function formatMoney(units: number) {
  return `$${(Math.max(0, units) / 100).toFixed(2)}`;
}

export function formatCompactUnits(units: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(units);
}

export function initials(name?: string) {
  const value = name?.trim() || "LC";
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
