import Ionicons from "@/components/auth-icon";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { CopyTextInput as TextInput, useUiCopy } from "@/components/localized-native";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
import { authEntryCopy } from "@/constants/auth-entry-copy";

export function LoginEmailEntry({ value, onChange, onSubmit, valid, busy }: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  valid: boolean;
  busy: boolean;
}) {
  const theme = useAppTheme();
  const { language } = useTranslation();
  const { copyText } = useUiCopy();
  const [focused, setFocused] = useState(false);
  const submit = () => { if (valid && !busy) onSubmit(); };
  return <View style={[styles.field, { borderColor: focused ? theme.primary : theme.border, backgroundColor: theme.surface }]}>
    <View pointerEvents="none" style={styles.placeholderIcon}>
      <Ionicons name="mail-outline" size={21} color={String(theme.textMuted)} />
    </View>
    <TextInput
      accessibilityLabel={authEntryCopy[language].email}
      value={value}
      onChangeText={onChange}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      autoCapitalize="none"
      autoCorrect={false}
      autoComplete="username"
      keyboardType="default"
      returnKeyType="go"
      onSubmitEditing={submit}
      editable={!busy}
      placeholder={copyText(({ ru: "Почта / @никнейм", uz: "Email / @nikneym", en: "Email / @username" })[language])}
      placeholderTextColor={String(theme.textMuted)}
      style={[styles.input, { color: theme.text, paddingLeft: 48 }]}
    />
    <Pressable accessibilityRole="button" accessibilityLabel={authEntryCopy[language].emailNext}
      accessibilityState={{ disabled: !valid || busy, busy }}
      disabled={!valid || busy} onPress={submit} hitSlop={2}
      style={({ pressed }) => [styles.submit, { backgroundColor: theme.primary }, (!valid || busy) && styles.disabled, pressed && styles.pressed]}>
      {busy ? <ActivityIndicator size="small" color={String(theme.onPrimary)} /> : <Ionicons name="arrow-forward" size={22} color={String(theme.onPrimary)} />}
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  field: { height: 54, width: "100%", borderRadius: 999, borderWidth: 1, flexDirection: "row", alignItems: "center", paddingRight: 5 },
  input: { flex: 1, minWidth: 0, height: "100%", fontSize: 16, paddingRight: 8, paddingVertical: 0 },
  placeholderIcon: { position: "absolute", left: 18, opacity: 0.6, zIndex: 1 },
  submit: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.8 },
});
