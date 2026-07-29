import { Ionicons } from "@expo/vector-icons";
import { useState, type ComponentProps } from "react";
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";

import { AppText } from "@/components/app-text";
import { radii } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";

export function FormField({
  label,
  icon,
  secureTextEntry,
  error,
  ...props
}: TextInputProps & {
  label: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  error?: string;
}) {
  const theme = useAppTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(Boolean(secureTextEntry));

  return (
    <View style={styles.wrapper}>
      <AppText variant="caption" muted>
        {label}
      </AppText>
      <View
        style={[
          styles.field,
          {
            backgroundColor: theme.glassFillStrong,
            borderColor: error
              ? theme.danger
              : focused
                ? theme.primary
                : theme.border,
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={20}
          color={String(focused ? theme.primary : theme.textMuted)}
        />
        <TextInput
          {...props}
          accessibilityLabel={props.accessibilityLabel ?? label}
          onFocus={(event) => {
            setFocused(true);
            props.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            props.onBlur?.(event);
          }}
          secureTextEntry={hidden}
          placeholderTextColor={String(theme.textMuted)}
          selectionColor={String(theme.primary)}
          style={[styles.input, { color: theme.text }]}
        />
        {secureTextEntry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${hidden ? "Show" : "Hide"} ${label}`}
            accessibilityState={{ expanded: !hidden }}
            onPress={() => setHidden((value) => !value)}
            hitSlop={8}
          >
            <Ionicons
              name={hidden ? "eye-outline" : "eye-off-outline"}
              size={20}
              color={String(theme.textMuted)}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <AppText variant="caption" color={String(theme.danger)}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 7,
  },
  field: {
    minHeight: 56,
    borderWidth: 1.5,
    borderRadius: radii.md,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    minWidth: 0,
  },
});
