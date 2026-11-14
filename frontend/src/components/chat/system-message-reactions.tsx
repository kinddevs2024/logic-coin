import { Pressable, StyleSheet, View, type GestureResponderEvent } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { AppText } from "@/components/app-text";
import { Avatar } from "@/components/avatar";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppStore } from "@/store/app-store";
import type { ChatItem } from "@/lib/chat-api";
import type { ChatAnchor } from "./chat-popover";
export function SystemMessageReactions({ item, onActions }: { item: ChatItem; onActions: (item: ChatItem, anchor?: ChatAnchor) => void }) {
  const theme = useAppTheme();
  const accountId = useAppStore(s => s.user.id), language = useAppStore(s => s.language) ?? "uz";
  const label = { ru: "Добавить реакцию", uz: "Reaksiya qo‘shish", en: "Add reaction" }[language];
  const open = (event: GestureResponderEvent) => { event.stopPropagation(); onActions(item, { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY }); };
  return <View style={styles.row} testID="system-message-reactions">
    {[...new Set(item.reactions.map(r => r.emoji))].map(emoji => {
      const reactions = item.reactions.filter(r => r.emoji === emoji), own = reactions.some(r => r.userId === accountId);
      const people = reactions.filter(r => r.user).slice(0, 3);
      return <Pressable key={emoji} accessibilityRole="button" accessibilityLabel={`${emoji}: ${reactions.length}`} accessibilityState={{ selected: own }} onPress={open} style={({ pressed }) => [styles.chip, { backgroundColor: own ? theme.primarySoft : theme.surface, borderColor: own ? theme.primary : theme.border, opacity: pressed ? 0.65 : 1 }]}>
        <AppText style={{ fontSize: 16 }}>{emoji}</AppText>
        {people.map((r, index) => <View key={r.userId} style={{ marginLeft: index ? -6 : 0 }}><Avatar userId={r.userId} name={r.user!.name} avatarUrl={r.user!.avatarUrl} size={20} /></View>)}
        <AppText variant="caption">{reactions.length}</AppText>
      </Pressable>;
    })}
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={open} style={({ pressed }) => [styles.chip, { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.65 : 1 }]}><Ionicons name="happy-outline" size={19} color={String(theme.primary)} /><AppText variant="caption" color={String(theme.primary)}>+</AppText></Pressable>
  </View>;
}
const styles = StyleSheet.create({ row: { alignSelf: "center", maxWidth: 360, paddingHorizontal: 12, flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6, marginTop: -5, marginBottom: 12 }, chip: { minHeight: 36, borderRadius: 99, borderWidth: 1, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 5 } });
