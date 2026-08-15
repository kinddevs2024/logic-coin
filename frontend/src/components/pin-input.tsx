import { useRef, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";

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
  const inputs = useRef<Array<TextInput | null>>([]);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const handleChange = (index: number, text: string) => {
    // Only allow digits
    const digits = text.replace(/\D/g, "");
    
    if (digits.length === 1) {
      // Single digit input
      const newValue = value.split("");
      newValue[index] = digits;
      const result = newValue.slice(0, length).join("");
      onChangeValue(result);

      // Auto-move to next field
      if (digits && index < length - 1) {
        inputs.current[index + 1]?.focus();
      }
    } else if (digits.length > 1) {
      // Multi-digit paste - use as complete code
      const newValue = digits.slice(0, length);
      onChangeValue(newValue);
      
      // Focus the last filled field
      const lastIndex = Math.min(newValue.length - 1, length - 1);
      setTimeout(() => inputs.current[lastIndex]?.focus(), 50);
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    // Handle backspace
    if (key === "Backspace") {
      if (!value[index] && index > 0) {
        const newValue = value.slice(0, index - 1) + value.slice(index);
        onChangeValue(newValue);
        inputs.current[index - 1]?.focus();
      } else if (value[index]) {
        const newValue = value.slice(0, index) + value.slice(index + 1);
        onChangeValue(newValue);
      }
    }
  };

  const slots = Array.from({ length }).map((_, i) => (
    <View
      key={i}
      style={[
        styles.slotWrapper,
        i === Math.floor(length / 2) - 1 && length > 3 && styles.beforeSeparator,
      ]}
    >
      <View
        style={[
          styles.slot,
          {
            backgroundColor: String(theme.surface),
            borderColor:
              focusedIndex === i
                ? String(theme.primary)
                : String(theme.border),
            borderWidth: focusedIndex === i ? 2 : 1,
          },
        ]}
      >
        <TextInput
          ref={(ref) => {
            inputs.current[i] = ref;
          }}
          style={[
            styles.input,
            { color: String(theme.text) },
          ]}
          value={value[i] ?? ""}
          onChangeText={(text) => handleChange(i, text)}
          onKeyPress={({ nativeEvent }) => handleKeyPress(i, nativeEvent.key)}
          onFocus={() => setFocusedIndex(i)}
          onBlur={() => setFocusedIndex(-1)}
          keyboardType="number-pad"
          selectTextOnFocus
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
        />
      </View>
      {i === Math.floor(length / 2) - 1 && length > 3 && (
        <View style={[styles.separator, { backgroundColor: String(theme.border) }]} />
      )}
    </View>
  ));

  return <View style={styles.container}>{slots}</View>;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginVertical: 20,
    alignItems: "center",
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
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    fontSize: 24,
    fontWeight: "600",
    textAlign: "center",
    width: "100%",
    height: "100%",
  },
  separator: {
    width: 8,
    height: 2,
    borderRadius: 1,
  },
});
