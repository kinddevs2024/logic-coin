import type { CopyLanguage } from "./localize-built-in.js";
import { escapeMarkup } from "./share-preview.js";

// Include the artwork version in dynamic image URLs: social crawlers cache images.
export const SHARE_ARTWORK_VERSION = "minimal-3-current-logo-20261024";
const ink = "#153B2B";
const muted = "#526C5C";

function canvas(content: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#F6F8F0"/><g font-family="DejaVu Sans, Arial, sans-serif" fill="${ink}">${content}</g></svg>`;
}

function header(logoDataUrl: string) {
  return `<image href="${logoDataUrl}" x="64" y="40" width="52" height="52"/><text x="132" y="77" font-size="30" font-weight="bold">Logic Coin</text><text x="1136" y="75" text-anchor="end" font-size="22" fill="${muted}">logic-coin.online</text>`;
}

export function platformArtwork(logoDataUrl: string, language: CopyLanguage = "ru") {
  const copy = {
    ru: { steps: [["Создай", "профиль"], ["Играй", "в челленджи"], ["Получай", "призы"]], first: "Три шага к первым", second: "денежным призам.", footer: "Награды зависят от результата и правил челленджа." },
    en: { steps: [["Create a", "profile"], ["Play", "challenges"], ["Receive", "prizes"]], first: "Three steps to your", second: "first cash prizes.", footer: "Rewards depend on results and challenge rules." },
    uz: { steps: [["Profil", "yarating"], ["Sinovlarda", "o‘ynang"], ["Sovrinlar", "oling"]], first: "Ilk pul mukofotlariga", second: "uch qadam.", footer: "Mukofotlar natija va sinov qoidalariga bog‘liq." },
  }[language];
  const steps = copy.steps;
  const cards = steps.map((lines, index) => {
    const x = 64 + index * 364;
    const last = index === 2;
    const color = last ? "#FFFFFF" : ink;
    return `<rect x="${x}" y="337" width="344" height="198" rx="28" fill="${last ? ink : "#FFFFFF"}"/><circle cx="${x + 43}" cy="380" r="19" fill="${last ? "#D8F2E3" : "#E1EFE3"}"/><text x="${x + 43}" y="388" text-anchor="middle" font-size="21" font-weight="bold" fill="${ink}">${index + 1}</text><text x="${x + 24}" y="448" font-size="32" font-weight="bold" fill="${color}">${lines[0]}</text><text x="${x + 24}" y="490" font-size="32" font-weight="bold" fill="${color}">${lines[1]}</text>`;
  }).join("");
  return canvas(`${header(logoDataUrl)}<text x="64" y="193" font-size="60" font-weight="bold" letter-spacing="-2">${escapeMarkup(copy.first)}</text><text x="64" y="266" font-size="60" font-weight="bold" letter-spacing="-2">${escapeMarkup(copy.second)}</text>${cards}<text x="64" y="589" font-size="20" fill="${muted}">${escapeMarkup(copy.footer)}</text>`);
}

export type PublicProfileArtwork = {
  name?: string;
  countryCode?: string | null;
  wallet?: { availableUnits?: number };
  coins?: { balance?: number };
};

function finitePositive(value: number | undefined) {
  return Number.isFinite(value) ? Math.max(0, value!) : 0;
}

export function profileArtwork(user: PublicProfileArtwork, completed: number, logoDataUrl: string, language: CopyLanguage = "ru") {
  const copy = {
    ru: { player: "Игрок", balance: "Баланс", coins: "Монеты", games: "Игр в челленджах", profile: "Профиль игрока", footer: "Смотри результаты. Присоединяйся к игре." },
    en: { player: "Player", balance: "Balance", coins: "Coins", games: "Challenge games", profile: "Player profile", footer: "View results. Join the game." },
    uz: { player: "O‘yinchi", balance: "Balans", coins: "Koinlar", games: "Sinovlardagi o‘yinlar", profile: "O‘yinchi profili", footer: "Natijalarni ko‘ring. O‘yinga qo‘shiling." },
  }[language];
  const rawName = Array.from((user.name || copy.player).replace(/[\u0000-\u001f\u007f]/g, " ").trim() || copy.player);
  const name = escapeMarkup(rawName.length > 26 ? rawName.slice(0, 25).join("") + "…" : rawName.join(""));
  const country = /^[A-Z]{2}$/.test(user.countryCode || "") ? ` · ${user.countryCode}` : "";
  const money = new Intl.NumberFormat(language, { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(finitePositive(user.wallet?.availableUnits) / 100);
  const integer = (value: number) => new Intl.NumberFormat(language, { maximumFractionDigits: 0 }).format(finitePositive(value));
  const stats = [[copy.balance, money], [copy.coins, integer(user.coins?.balance || 0)], [copy.games, integer(completed)]];
  const cards = stats.map(([label, value], index) => {
    const x = 64 + index * 364;
    const size = value!.length > 12 ? 28 : value!.length > 9 ? 36 : 46;
    return `<rect x="${x}" y="320" width="344" height="170" rx="28" fill="${index === 1 ? "#D8F2E3" : "#FFFFFF"}"/><text x="${x + 26}" y="367" font-size="23" fill="${muted}">${label}</text><text x="${x + 26}" y="440" font-size="${size}" font-weight="bold">${escapeMarkup(value!)}</text>`;
  }).join("");
  return canvas(`${header(logoDataUrl)}<circle cx="136" cy="212" r="76" fill="#D8F2E3"/><text x="240" y="198" font-size="${rawName.length > 20 ? 34 : 44}" font-weight="bold">${name}</text><text x="240" y="246" font-size="24" fill="${muted}">${escapeMarkup(copy.profile)}${country}</text>${cards}<text x="64" y="571" font-size="25" font-weight="bold">${escapeMarkup(copy.footer)}</text><path d="M1080 577l32-32m-28 0h28v28" fill="none" stroke="${ink}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`);
}
