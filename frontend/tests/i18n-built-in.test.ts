import { describe, expect, it } from "vitest";
import { localizeBuiltIn } from "../src/lib/localize-built-in";
import catalog from "../src/constants/built-in-copy.json";
import serverCatalog from "../../backend/src/lib/built-in-copy.json";

describe("three-language built-in UI copy", () => {
  it("keeps every shipped entry complete and preserves interpolation parameters", () => {
    expect(serverCatalog).toEqual(catalog);
    for (const [source, values] of Object.entries(catalog)) {
      for (const language of ["ru", "en", "uz"] as const) {
        expect(values[language].trim(), `${source}: ${language}`).not.toBe("");
        expect((values[language].match(/\{(?:[A-Za-z_]\w*|\d+)\}/g) ?? []).sort(), source).toEqual((source.match(/\{(?:[A-Za-z_]\w*|\d+)\}/g) ?? []).sort());
      }
    }
  });
  it("switches the same screen copy between all three languages immediately", () => {
    expect(localizeBuiltIn("ИГРАТЬ", "ru")).toBe("ИГРАТЬ");
    expect(localizeBuiltIn("ИГРАТЬ", "en")).toBe("PLAY");
    expect(localizeBuiltIn("ИГРАТЬ", "uz")).toBe("O‘YNASH");
    expect(localizeBuiltIn("НАЧАТЬ", "uz")).toBe("BOSHLASH");
    expect(localizeBuiltIn("ВРЕМЯ", "uz")).toBe("VAQT");
    expect(localizeBuiltIn("ИГРАТЬ", "ru")).toBe("ИГРАТЬ");
  });
  it("preserves dynamic names without interpreting their contents", () => {
    const name = "Ali  Vali {1} <hello>";
    const source = `${name} приглашает тебя в Logic Coin`;
    const translated = localizeBuiltIn(source, "en");
    expect(translated).not.toBe(source);
    expect(translated).toContain(name);
    expect(localizeBuiltIn("Alice_123@example.invalid", "uz")).toBe("Alice_123@example.invalid");
  });
  it("keeps layout spacing and numeric strings intact", () => {
    expect(localizeBuiltIn("  ИГРАТЬ ", "en")).toBe("  PLAY ");
    expect(localizeBuiltIn("123 456.78", "uz")).toBe("123 456.78");
    expect(localizeBuiltIn("", "en")).toBe("");
    expect(localizeBuiltIn("120мс", "en")).toBe("120ms");
    expect(localizeBuiltIn("1.5с", "uz")).toBe("1.5s");
    expect(localizeBuiltIn("120мс", "ru")).toBe("120мс");
  });
  it("translates geography content without reordering the answer indices", () => {
    const answers = ["Лион", "Париж", "Марсель", "Ницца"];
    const correctIndex = 1;
    const translated = answers.map(answer => localizeBuiltIn(answer, "en"));
    expect(localizeBuiltIn("Столица Франции?", "en")).not.toContain("Столица");
    expect(translated[correctIndex]).toBe("Paris");
    expect(new Set(translated).size).toBe(4);
    expect(answers[correctIndex]).toBe("Париж");
  });
  it("does not ship Russian fallback text into English or Uzbek entries", () => {
    for (const [source, values] of Object.entries(catalog)) {
      expect(values.en, source).not.toMatch(/[А-Яа-яЁё]/);
      expect(values.uz, source).not.toMatch(/[А-Яа-яЁё]/);
    }
  });
});
