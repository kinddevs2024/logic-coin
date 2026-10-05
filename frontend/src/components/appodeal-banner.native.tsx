import { isExpoGo } from "@/lib/native-runtime";
const AppodealBanner = isExpoGo ? null : require("react-native-appodeal").AppodealBanner;
import { StyleSheet, View } from "react-native";

export function AppodealBannerSlot({ placement }: { placement: string }) {
  if (!AppodealBanner) return null;
  return (
    <View accessibilityLabel="Реклама" style={styles.slot}>
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
