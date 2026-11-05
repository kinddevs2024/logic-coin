import { useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { MotionPressable } from "@/components/motion-pressable";
import { AppText } from "@/components/app-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { chatMediaUrl, type ChatRoom } from "@/lib/chat-api";
import { useChatCopy } from "@/lib/chat-copy";
import { ChatThemeProvider } from "./chat-theme";

export function ChatThemePreview({ appearance, label, selected, disabled, onPress }: {
  appearance: NonNullable<ChatRoom["chatTheme"]>;
  label: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  const [hovered, setHovered] = useState(false);
  return <MotionPressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{selected, disabled}}
    disabled={disabled} onPress={onPress} onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)}
    containerStyle={{flexBasis: "46%", flexGrow: 1, minWidth: 130}}
    style={{width: "100%", borderRadius: 16, overflow: "hidden", borderWidth: 2,
      borderColor: selected || hovered ? theme.primary : theme.border, backgroundColor: theme.surfaceRaised, opacity: disabled ? 0.55 : 1}}>
    <ChatThemeProvider appearance={appearance}><MiniChat wallpaper={appearance.preset === "custom" ? appearance.wallpaperUrl : null} /></ChatThemeProvider>
    <View pointerEvents="none" style={{position: "absolute", top: 6, right: 6, padding: 2, borderRadius: 14, backgroundColor: theme.surfaceRaised}}>
      <Ionicons name={selected ? "checkmark-circle" : "ellipse-outline"} size={20} color={String(selected ? theme.primary : theme.textMuted)} />
    </View>
  </MotionPressable>;
}

function MiniChat({wallpaper}: {wallpaper?: string | null}) {
  const theme = useAppTheme(), c = useChatCopy();
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{height: 137, backgroundColor: theme.background, padding: 9, gap: 7, overflow: "hidden"}}>
    {wallpaper ? <Image source={{uri: chatMediaUrl(wallpaper)}} resizeMode="cover" style={[StyleSheet.absoluteFill, {opacity: 0.3}]} /> : null}
    <View style={{alignSelf: "flex-start", maxWidth: "90%", paddingVertical: 6, paddingHorizontal: 8, borderRadius: 10, borderBottomLeftRadius: 3, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border}}>
      <AppText style={{fontSize: 11, lineHeight: 15}}>{c.themePreviewHello}</AppText>
    </View>
    <View style={{alignSelf: "flex-end", maxWidth: "95%", paddingVertical: 6, paddingHorizontal: 8, borderRadius: 10, borderBottomRightRadius: 3, backgroundColor: theme.primarySoft}}>
      <AppText style={{fontSize: 11, lineHeight: 15}}>{c.themePreviewReply}</AppText>
      <View style={{flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 3}}>
        <AppText style={{fontSize: 8, lineHeight: 10, color: theme.textMuted}}>12:30 PM</AppText>
        <Ionicons name="checkmark-done" size={11} color={String(theme.primary)} />
      </View>
    </View>
    <View style={{alignSelf: "flex-end", width: "85%", flexDirection: "row", alignItems: "center", gap: 6, padding: 7, borderRadius: 10, borderBottomRightRadius: 3, backgroundColor: theme.primarySoft}}>
      <View style={{width: 22, height: 22, borderRadius: 11, backgroundColor: theme.primary, alignItems: "center", justifyContent: "center"}}><Ionicons name="play" size={13} color={String(theme.onPrimary)} /></View>
      <View style={{flex: 1, flexDirection: "row", alignItems: "center", gap: 2, height: 19}}>
        {[5, 9, 15, 11, 7, 13, 18, 12, 6, 10, 14, 8].map((height,index) => <View key={index} style={{flex: 1, height, borderRadius: 2, backgroundColor: theme.primary, opacity: index < 5 ? 1 : 0.4}} />)}
      </View>
    </View>
  </View>;
}
