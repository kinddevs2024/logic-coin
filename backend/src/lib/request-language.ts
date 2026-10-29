import type { Request } from "express";
import { localizeBuiltIn, type CopyLanguage } from "./localize-built-in.js";
import { escapeMarkup } from "./share-preview.js";
export function requestLanguage(request: Request): CopyLanguage {
  const value = typeof request.query.lang === "string" ? request.query.lang : request.header("accept-language") ?? "ru";
  return value.startsWith("uz") ? "uz" : value.startsWith("en") ? "en" : "ru";
}
// For the static app-return document only. Never run this over user-authored HTML.
export function localizeAppReturnHtml(html: string, language: CopyLanguage) {
  return html.replace('lang="ru"', `lang="${language}"`).replace(/>([^<>]+)</g, (match: string, text: string) => {
    const value = localizeBuiltIn(text, language);
    return value === text ? match : `>${escapeMarkup(value)}<`;
  }).replace(/aria-label="([^"]+)"/g, (_match: string, label: string) => `aria-label="${escapeMarkup(localizeBuiltIn(label, language))}"`);
}
