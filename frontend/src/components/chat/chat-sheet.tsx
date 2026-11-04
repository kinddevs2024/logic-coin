import type { PropsWithChildren, ComponentProps } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
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
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={c.cancel}
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View
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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={c.cancel}
              onPress={onClose}
              style={styles.close}
            >
              <Ionicons name="close" size={23} color={String(theme.text)} />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 10, paddingBottom: 10 }}
          >
            {children}
          </ScrollView>
        </View>
      </View>
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
    <Pressable
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
    </Pressable>
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
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
