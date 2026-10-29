import { forwardRef, useMemo, type ReactNode } from "react";
import { Alert as NativeAlert, Share as NativeShare, TextInput as NativeTextInput, type TextInputProps } from "react-native";
import { useAppStore } from "@/store/app-store";
import { localizeBuiltIn, formatBuiltIn } from "@/lib/localize-built-in";

export function useCopyLanguage() { return useAppStore(state => state.language) ?? "ru"; }
export function copyText<T extends string | undefined>(text: T): T { return (typeof text === "string" ? localizeBuiltIn(text, useAppStore.getState().language ?? "ru") : text) as T; }
export function formatCopy(source: string, parameters: readonly unknown[]) { return formatBuiltIn(source, useAppStore.getState().language ?? "ru", parameters); }
export function useUiCopy() {
  const language = useCopyLanguage();
  return useMemo(() => ({
    language,
    copyText: <T extends string | undefined>(text: T): T => (typeof text === "string" ? localizeBuiltIn(text, language) : text) as T,
    copyContent: (children: ReactNode): ReactNode => childrenCopy(children, language),
    formatCopy: (source: string, parameters: readonly unknown[]) => formatBuiltIn(source, language, parameters),
  }), [language]);
}
export function copyContent(children: ReactNode): ReactNode { return childrenCopy(children, useAppStore.getState().language ?? "ru"); }
function childrenCopy(children: ReactNode, language: "ru" | "en" | "uz"): ReactNode {
  if (typeof children === "string") return localizeBuiltIn(children, language);
  if (Array.isArray(children)) return children.map(child => childrenCopy(child, language));
  return children;
}
export const CopyTextInput = forwardRef<NativeTextInput, TextInputProps>(function CopyTextInput({ placeholder, accessibilityLabel, ...props }, ref) {
  const language = useCopyLanguage();
  return <NativeTextInput {...props} ref={ref} placeholder={placeholder && localizeBuiltIn(placeholder, language)} accessibilityLabel={accessibilityLabel && localizeBuiltIn(accessibilityLabel, language)} />;
});
export const Alert: typeof NativeAlert = {
  ...NativeAlert,
  prompt(title, message, callbackOrButtons, ...rest) {
    NativeAlert.prompt(copyText(title), message && copyText(message), typeof callbackOrButtons === "function" ? callbackOrButtons : callbackOrButtons?.map(button => ({ ...button, text: button.text && copyText(button.text) })), ...rest);
  },
  alert(title, message, buttons, options) {
    NativeAlert.alert(copyText(title), message && copyText(message), buttons?.map(button => ({ ...button, text: button.text && copyText(button.text) })), options);
  },
};
export const Share: typeof NativeShare = {
  ...NativeShare,
  share(content, options) {
    const translated = { ...content, ...(content.title ? { title: copyText(content.title) } : {}), ...("message" in content ? { message: copyText(content.message) } : {}) };
    return NativeShare.share(translated, options);
  },
};
