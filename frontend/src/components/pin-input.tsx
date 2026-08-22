import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useAppTheme } from "@/hooks/use-app-theme";

export function PinInput({
  value,
  onChangeValue,
  length = 6,
}: {
  value: string;
  onChangeValue: (value: string) => void;
  length?: number;
}) {
  const theme = useAppTheme();
  const input = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const activeIndex = Math.min(value.length, length - 1);

  const updateCode = (text: string) => {
    onChangeValue(text.replace(/\D/g, "").slice(0, length));
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Код подтверждения"
      onPress={() => input.current?.focus()}
      style={styles.container}
    >
      <TextInput
        ref={input}
        value={value}
        onChangeText={updateCode}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={length}
        caretHidden
        style={styles.hiddenInput}
      />
      {Array.from({ length }, (_, index) => (
        <View
          key={index}
          style={[
            styles.slotWrapper,
            index === Math.floor(length / 2) - 1 && length > 3
              ? styles.beforeSeparator
              : null,
          ]}
        >
          <View
            style={[
              styles.slot,
              {
                backgroundColor: String(theme.surface),
                borderColor:
                  focused && activeIndex === index
                    ? String(theme.primary)
                    : String(theme.border),
                borderWidth: focused && activeIndex === index ? 2 : 1,
              },
            ]}
          >
            <Text style={[styles.digit, { color: String(theme.text) }]}>
              {value[index] ?? ""}
            </Text>
          </View>
          {index === Math.floor(length / 2) - 1 && length > 3 ? (
            <View
              style={[
                styles.separator,
                { backgroundColor: String(theme.border) },
              ]}
            />
          ) : null}
        </View>
      ))}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginVertical: 20,
    alignItems: "center",
  },
  hiddenInput: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
  },
  slotWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  beforeSeparator: {
    marginRight: 4,
  },
  slot: {
    width: 50,
    height: 60,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  digit: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
  },
  separator: {
    width: 8,
    height: 2,
    borderRadius: 1,
  },
});
