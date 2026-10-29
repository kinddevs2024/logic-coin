import catalog from "./built-in-copy.json";
export type CopyLanguage = "ru" | "en" | "uz";
const entries: Record<string, Record<CopyLanguage, string>> = catalog;
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const templates = Object.entries(entries).filter(([source]) => /\{\d+\}/.test(source) && source.replace(/\{\d+\}/g, "").trim().length >= 4).map(([source, values]) => {
  const ids: number[] = [];
  const parts = source.split(/(\{\d+\})/g);
  const pattern = parts.map(part => /^\{\d+\}$/.test(part) ? (ids.push(Number(part.slice(1, -1))), "([\\s\\S]*?)") : escape(part)).join("");
  return { source, prefix: parts[0] ?? "", ids, values, expression: new RegExp(`^${pattern}$`, "u") };
}).sort((a, b) => b.prefix.length - a.prefix.length);
export function localizeBuiltIn(text: string, language: CopyLanguage): string {
  if (!text || text.length > 4000) return text;
  if (language !== "ru") {
    const time = /^([+-]?\d+(?:[.,]\d+)?)\s*(мс|с|сек\.?|мин\.?)$/.exec(text);
    if (time) return `${time[1]}${time[2] === "мс" ? "ms" : time[2]?.startsWith("мин") ? " min" : "s"}`;
  }
  const source = text.replace(/\s+/g, " ").trim();
  const direct = entries[source];
  let translated = direct?.[language];
  if (translated === undefined) {
    for (const template of templates) {
      if (template.prefix && !source.startsWith(template.prefix)) continue;
      const match = template.expression.exec(text.trim());
      if (!match) continue;
      const values = new Map(template.ids.map((id, index) => [id, match[index + 1]]));
      if (template.source === "{0} уже ждёт вас в Logic Coin.") {
        const gameTitle = values.get(0);
        if (gameTitle && entries[gameTitle]) values.set(0, entries[gameTitle][language]);
      }
      translated = template.values[language].replace(/\{(\d+)\}/g, (token, id: string) => values.get(Number(id)) ?? token);
      break;
    }
  }
  if (translated === undefined) return text;
  const leading = /^\s*/.exec(text)?.[0] ?? "";
  const trailing = /\s*$/.exec(text)?.[0] ?? "";
  return `${leading}${translated}${trailing}`;
}

export function formatBuiltIn(source: string, language: CopyLanguage, parameters: readonly unknown[]): string {
  return localizeBuiltIn(source, language).replace(/\{(\d+)\}/g, (token, index: string) => Number(index) < parameters.length ? String(parameters[Number(index)]) : token);
}
