import { spawn } from "node:child_process";
import sharp from "sharp";
import { ApiError } from "../lib/api-error.js";
import { validPayoutCard } from "../lib/payout-card.js";

// OCR output is transient: never store the image, recognized text or card number.
function cardNumberCandidates(text: string): string[] {
  const numbers = new Set<string>();
  const normalized = text.replace(/[OoqQ]/g, "0").replace(/[Il|!]/g, "1")
    .replace(/[Ss]/g, "5").replace(/[Bb]/g, "8").replace(/[Zz]/g, "2");
  for (const line of [...normalized.split(/[\r\n]+/), normalized.replace(/\s+/g, " ")]) {
    for (const match of line.matchAll(/(?<!\d)(?:\d[ \t.-]*){15}\d(?![ \t.-]*\d)/g)) {
      const number = match[0].replace(/\D/g, "");
      if (!/^(\d)\1{15}$/.test(number)) numbers.add(number);
    }
  }
  return [...numbers];
}

export function cardNumbersFromText(text: string): string[] {
  return cardNumberCandidates(text).filter(validPayoutCard);
}

let running = 0;
function ocr(image: Buffer, psm: number, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const process = spawn("tesseract", ["stdin", "stdout", "-l", "eng", "--psm", String(psm)], {
      stdio: ["pipe", "pipe", "ignore"], env: { ...globalThis.process.env, OMP_THREAD_LIMIT: "1" },
    });
    let output = "", finished = false;
    const finish = (error?: Error) => {
      if (finished) return;
      finished = true; clearTimeout(timer); signal?.removeEventListener("abort", abort);
      if (error) { process.kill("SIGKILL"); reject(error); } else resolve(output);
    };
    const abort = () => finish(new ApiError(499, "scan_cancelled", "Сканирование отменено."));
    const timer = setTimeout(() => finish(new ApiError(422, "scan_timeout", "Не удалось прочитать карту. Попробуйте ещё раз без бликов.")), 6500);
    process.once("error", () => finish(new ApiError(503, "scanner_unavailable", "Сканер временно недоступен. Введите номер вручную.")));
    process.stdout.on("data", chunk => { output += chunk.toString(); if (output.length > 16000) finish(new ApiError(422, "card_not_found", "Поместите в кадр только одну карту.")); });
    process.stdin.on("error", () => {}); // The child may close input when cancelled.
    process.once("close", code => finish(code === 0 ? undefined : new ApiError(422, "card_not_found", "Не удалось прочитать номер карты. Попробуйте ещё раз.")));
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort(); else process.stdin.end(image);
  });
}

export async function scanCardPhoto(base64: string, signal?: AbortSignal) {
  if (running >= 2) throw new ApiError(429, "scanner_busy", "Сканер занят. Повторите через несколько секунд.");
  running += 1;
  try {
    const input = Buffer.from(base64, "base64");
    if (!input.length || input.length > 1500000) throw new ApiError(400, "invalid_card_photo", "Выберите небольшое фото карты.");
    let image: Buffer;
    try {
      const decoded = sharp(input, { limitInputPixels: 16000000, animated: false });
      const meta = await decoded.metadata();
      if (!["jpeg", "png", "webp"].includes(meta.format ?? "") || (meta.pages ?? 1) > 1) throw new Error("Unsupported photo");
      image = await decoded.rotate().resize({ width: 1600, height: 1600, fit: "inside" }).flatten({ background: "white" }).grayscale().sharpen().png().toBuffer();
      // Percentile normalization can erase text on a mostly flat card surface.
      const stats = await sharp(image).stats();
      if ((stats.channels[0]?.mean ?? 255) < 128) image = await sharp(image).negate().png().toBuffer();
    } catch { throw new ApiError(400, "invalid_card_photo", "Не удалось открыть фото. Используйте JPG, PNG или WebP."); }
    const found = new Set<string>();
    for (const psm of [11, 6]) {
      if (signal?.aborted) throw new ApiError(499, "scan_cancelled", "Сканирование отменено.");
      const candidates = cardNumberCandidates(await ocr(image, psm, signal));
      if (candidates.length > 1) throw new ApiError(422, "multiple_cards", "Поместите в кадр только одну карту.");
      for (const number of candidates) if (validPayoutCard(number)) found.add(number);
      if (found.size > 1) throw new ApiError(422, "multiple_cards", "Не удалось однозначно прочитать номер. Повторите снимок.");
    }
    const number = [...found][0];
    if (number && validPayoutCard(number)) return { number };
    throw new ApiError(422, "card_not_found", "Не удалось прочитать номер карты. Снимите карту ровно, без бликов, или введите номер вручную.");
  } finally { running -= 1; }
}
