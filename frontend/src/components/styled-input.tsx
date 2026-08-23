import React, { type ComponentProps } from "react";
import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { AppText } from "@/components/app-text";
import { useAppTheme } from "@/hooks/use-app-theme";

export interface StyledInputProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  icon?: ComponentProps<typeof Ionicons>["name"];
  error?: string;
  hint?: string;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoComplete?: TextInputProps["autoComplete"];
  keyboardType?: TextInputProps["keyboardType"];
  secureTextEntry?: boolean;
  disabled?: boolean;
  required?: boolean;
}

export function StyledInput({
  label,
  placeholder,
  value,
  onChangeText,
  icon,
  error,
  hint,
  autoCapitalize = "none",
  autoComplete,
  keyboardType = "default",
  secureTextEntry = false,
  disabled = false,
  required = false,
}: StyledInputProps) {
  const theme = useAppTheme();
  const [isFocused, setIsFocused] = React.useState(false);

  return (
    <View style={styles.container}>
      {label && (
        <View style={styles.labelRow}>
          <AppText variant="label" style={styles.label}>
            {label}
          </AppText>
          {required && (
            <AppText style={{ color: String(theme.danger) }}>*</AppText>
          )}
        </View>
      )}
      <View
        style={[
          styles.inputWrapper,
          {
            borderColor: error
              ? String(theme.danger)
              : isFocused
                ? String(theme.primary)
                : String(theme.border),
            backgroundColor: disabled ? String(theme.surfaceMuted) : String(theme.surface),
          },
        ]}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={20}
            color={String(isFocused ? theme.primary : theme.textMuted)}
            style={styles.icon}
          />
        )}
        <TextInput
          style={[
            styles.input,
            { color: String(theme.text) },
          ]}
          placeholder={placeholder}
          placeholderTextColor={String(theme.textMuted)}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          editable={!disabled}
        />
      </View>
      {error && (
        <AppText variant="caption" color={String(theme.danger)} style={styles.error}>
          {error}
        </AppText>
      )}
      {hint && !error && (
        <AppText variant="caption" muted style={styles.hint}>
          {hint}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  labelRow: {
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 4,
  },
  label: {
    fontWeight: "600",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    gap: 10,
  },
  icon: {
    width: 20,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: "100%",
  },
  error: {
    paddingHorizontal: 4,
  },
  hint: {
    paddingHorizontal: 4,
  },
});
