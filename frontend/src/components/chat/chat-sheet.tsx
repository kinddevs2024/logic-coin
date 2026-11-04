import { MotionEntrance } from "@/components/motion-entrance";
import {
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
  type ComponentProps,
} from "react";
import { useReducedMotion } from "react-native-reanimated";
import { MotionPressable } from "@/components/motion-pressable";
import {
  Animated,
  Platform,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { AppText } from "@/components/app-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useChatCopy } from "@/lib/chat-copy";
export function ChatSheet({
  title,
  onClose,
  children,
}: PropsWithChildren<{ title: string; onClose: () => void }>) {
  const theme = useAppTheme(),
    c = useChatCopy();
  const reduced = useReducedMotion();
  const closing = useRef(false);
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => () => opacity.stopAnimation(), [opacity]);
  const close = () => {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(opacity, {
      toValue: 0,
      duration: reduced ? 0 : 150,
      useNativeDriver: Platform.OS !== "web",
    }).start(({ finished }) => {
      if (finished) onClose();
    });
  };
  return (
    <Modal transparent visible animationType="fade" onRequestClose={close}>
      <Animated.View style={[styles.backdrop, { opacity }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={c.cancel}
          onPress={close}
          style={StyleSheet.absoluteFill}
        />
        <MotionEntrance
          accessibilityViewIsModal
          style={[
            styles.card,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View style={styles.header}>
            <AppText variant="heading" style={{ flex: 1 }}>
              {title}
            </AppText>
            <MotionPressable
              accessibilityRole="button"
              accessibilityLabel={c.close}
              onPress={close}
              style={styles.close}
            >
              <Ionicons name="close" size={23} color={String(theme.text)} />
            </MotionPressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 10, paddingBottom: 10 }}
          >
            {children}
          </ScrollView>
        </MotionEntrance>
      </Animated.View>
    </Modal>
  );
}
export function ChatAction({
  title,
  onPress,
  icon,
  danger,
  disabled,
}: {
  title: string;
  onPress: () => void;
  icon?: ComponentProps<typeof Ionicons>["name"];
  danger?: boolean;
  disabled?: boolean;
}) {
  const theme = useAppTheme();
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: 48,
          padding: 12,
          borderRadius: 16,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          backgroundColor: pressed ? theme.primarySoft : "transparent",
          opacity: disabled ? 0.45 : 1,
        },
      ]}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={22}
          color={danger ? theme.danger : theme.primary}
        />
      ) : null}
      <AppText style={{ color: danger ? theme.danger : theme.text }}>
        {title}
      </AppText>
    </MotionPressable>
  );
}
const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 500,
    maxHeight: "85%",
    borderRadius: 28,
    borderWidth: 1,
    padding: 18,
  },
  header: { flexDirection: "row", alignItems: "center", paddingBottom: 12 },
  close: {
    backgroundColor: "rgba(127,127,127,0.10)",
    borderRadius: 22,
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
