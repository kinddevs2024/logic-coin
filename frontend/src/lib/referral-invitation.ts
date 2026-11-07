import type { CopyLanguage } from "./localize-built-in";

const messages = {
  ru: "Играй со мной в Logic Coin: игры, челленджи и денежные призы.",
  uz: "Men bilan Logic Coin o‘ynang: o‘yinlar, sinovlar va pul mukofotlari.",
  en: "Play Logic Coin with me: games, challenges and cash prizes.",
};
export function referralInvitationMessage(language: CopyLanguage): string {
  return messages[language];
}
