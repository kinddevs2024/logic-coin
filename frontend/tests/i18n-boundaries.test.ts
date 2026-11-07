import { createElement, forwardRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ language: "en" as "ru" | "en" | "uz" }));
const native = vi.hoisted(() => ({ alert: vi.fn(), prompt: vi.fn(), share: vi.fn() }));
vi.mock("@/store/app-store", () => {
  const useAppStore = Object.assign((selector: (value: typeof state) => unknown) => selector(state), { getState: () => state });
  return { useAppStore };
});
vi.mock("@/hooks/use-app-theme", () => ({ useAppTheme: () => ({ text: "#fff", textMuted: "#999" }) }));
vi.mock("react-native", () => ({
  TextInput: forwardRef<HTMLInputElement, object>((props, ref) => createElement("input", { ...props, ref })),
  Text: forwardRef<HTMLSpanElement, object>((props, ref) => createElement("span", { ...props, ref })),
  Alert: { alert: native.alert, prompt: native.prompt },
  Share: { share: native.share, sharedAction: "sharedAction", dismissedAction: "dismissedAction" },
}));
import { AppText } from "../src/components/app-text";
import { CopyTextInput, Alert, formatCopy } from "../src/components/localized-native";

describe("localized display boundaries", () => {
  beforeEach(() => { state.language = "en"; vi.clearAllMocks(); });
  it("translates placeholders without changing a user's entered value", () => {
    const markup = renderToStaticMarkup(createElement(CopyTextInput, { placeholder: "Играть", value: "Играть" }));
    expect(markup).toContain('placeholder="Play"');
    expect(markup).toContain('value="Играть"');
  });
  it("does not translate names and arbitrary children globally", () => {
    expect(renderToStaticMarkup(createElement(AppText, null, "Играть"))).toContain("Играть");
  });
  it("translates native dialogs while preserving their callbacks", () => {
    const onPress = vi.fn();
    Alert.alert("Ошибка", "Сохраняем результат", [{ text: "Закрыть", onPress }]);
    expect(native.alert.mock.calls[0]?.[0]).toBe("Error");
    expect(native.alert.mock.calls[0]?.[2][0]).toEqual({ text: "Close", onPress });
    expect(onPress).not.toHaveBeenCalled();
  });
  it("handles adjacent parameters and preserves their exact contents", () => {
    const name = "A  B {1}";
    expect(formatCopy("Фото {0}", [name])).toBe(`Photo ${name}`);
    expect(formatCopy("Тема {0}{1}", [3, ": 50"])).toBe("Theme 3: 50");
    state.language = "uz";
    expect(formatCopy("Фото {0}", [name])).toBe(`Surat ${name}`);
  });
});
