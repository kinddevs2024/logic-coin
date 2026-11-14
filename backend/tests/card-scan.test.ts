import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { cardNumbersFromText, scanCardPhoto } from "../src/services/card-scan.service.js";

function testPan(prefix: string) {
  const base = prefix.padEnd(15, "0");
  for (let n = 0; n < 10; n += 1) if (cardNumbersFromText(base + n).length) return base + n;
  throw new Error("Test card check digit not found");
}
async function photo(numbers: string[], dark = false) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="880"><rect width="1400" height="880" fill="${dark ? "#123b2d" : "#eeeeee"}"/><text x="100" y="130" font-family="DejaVu Sans" font-size="50" fill="${dark ? "#ffffff" : "#111111"}">TEST CARD</text>${numbers.map((n, i) => `<text x="100" y="${380 + i * 220}" font-family="DejaVu Sans Mono" font-size="62" fill="${dark ? "#ffffff" : "#111111"}">${n.replace(/(.{4})/g, "$1 ")}</text>`).join("")}</svg>`;
  return (await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer()).toString("base64");
}
describe("payment card OCR", () => {
  it("extracts complete valid numbers and corrects common OCR letter substitutions", () => {
    expect(cardNumbersFromText("VISA\n4242 4242 4242 4242\n12/30")).toEqual(["4242424242424242"]);
    const number = testPan("8600");
    expect(cardNumbersFromText(number.replaceAll("0", "O"))).toEqual([number]);
    expect(cardNumbersFromText("4242\n4242\n4242\n4242")).toEqual(["4242424242424242"]);
  });
  it("does not accept invalid, masked, partial, repeated or longer numbers", () => {
    for (const value of ["4242424242424241", "**** **** **** 4242", "424242424242", "0000000000000000", "14242424242424242", "42424242424242424242"]) expect(cardNumbersFromText(value)).toEqual([]);
  });
  it("deduplicates OCR results but retains ambiguity between two different cards", () => {
    expect(cardNumbersFromText("4242 4242 4242 4242\n4242 4242 4242 4242")).toEqual(["4242424242424242"]);
    expect(cardNumbersFromText("4242 4242 4242 4242\n5555 5555 5555 4444")).toHaveLength(2);
  });
  it("rejects invalid images before OCR", async () => {
    await expect(scanCardPhoto(Buffer.from("not a photo").toString("base64"))).rejects.toMatchObject({ code: "invalid_card_photo", statusCode: 400 });
  });
  it("reads Visa, Mastercard, Uzcard and Humo from image pixels using real OCR", async () => {
    for (const number of ["4242424242424242", "5555555555554444", testPan("8600"), testPan("9860")]) {
      const result = await scanCardPhoto(await photo([number]));
      expect(result).toEqual({ number });
      expect(Object.keys(result)).toEqual(["number"]);
    }
  }, 30000);
  it("reads light text on a dark card", async () => {
    await expect(scanCardPhoto(await photo(["4242424242424242"], true))).resolves.toEqual({ number: "4242424242424242" });
  }, 15000);
  it("rejects an ambiguous photo instead of filling another card", async () => {
    await expect(scanCardPhoto(await photo(["4242424242424242", "5555555555554444"]))).rejects.toMatchObject({ code: "multiple_cards" });
  }, 15000);
  it("cancels without leaving the scanner occupied", async () => {
    const controller = new AbortController(); controller.abort();
    await expect(scanCardPhoto(await photo(["4242424242424242"]), controller.signal)).rejects.toMatchObject({ code: "scan_cancelled" });
    await expect(scanCardPhoto(await photo(["4242424242424242"]))).resolves.toEqual({ number: "4242424242424242" });
  }, 15000);
});
