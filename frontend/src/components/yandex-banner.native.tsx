import { useIsFocused } from "expo-router";
import { useState } from "react";
import { Platform, requireNativeComponent, StyleSheet, UIManager, View, type ViewProps } from "react-native";
import { useAppActive } from "@/hooks/use-app-active";

const NativeBanner = Platform.OS === "android" && UIManager.getViewManagerConfig("LogicYandexBanner")
  ? requireNativeComponent<ViewProps & { adUnitId: string; adWidth: number }>("LogicYandexBanner")
  : null;
const unit = __DEV__ ? "demo-banner-yandex" : (process.env.EXPO_PUBLIC_YANDEX_BANNER_ID || "R-M-19993046-2");

export function YandexBannerSlot({ placement }: { placement: string }) {
  const focused = useIsFocused();
  const active = useAppActive();
  const [width, setWidth] = useState(0);
  if (!NativeBanner || !focused || !active) return null;
  return (
    <View accessibilityLabel="Реклама" nativeID={`ad-${placement}`} style={styles.slot}
      onLayout={(event) => setWidth(Math.floor(event.nativeEvent.layout.width))}>
      {width >= 240 ? <NativeBanner adUnitId={unit} adWidth={Math.min(width, 728)} style={{ width: Math.min(width, 728), height: 60 }} /> : null}
    </View>
  );
}
const styles = StyleSheet.create({ slot: { width: "100%", minHeight: 68, marginVertical: 12, alignItems: "center", justifyContent: "center" } });
