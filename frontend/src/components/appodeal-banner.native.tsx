import { useUiCopy } from "@/components/localized-native";

import { isExpoGo } from "@/lib/native-runtime";
import { StyleSheet, View } from "react-native";
const AppodealBanner = isExpoGo ? null : require("react-native-appodeal").AppodealBanner;

export function AppodealBannerSlot({ placement }: { placement: string }) {
  const { copyText } = useUiCopy();
  if (!AppodealBanner) return null;
  return (
    <View accessibilityLabel={copyText("Реклама")} style={styles.slot}>
      <AppodealBanner adSize="phone" placement={placement} style={styles.banner} />
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    width: "100%",
    minHeight: 58,
    alignItems: "center",
    justifyContent: "center",
  },
  banner: {
    width: 320,
    height: 50,
  },
});
