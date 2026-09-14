import { AppodealBanner } from "react-native-appodeal";
import { StyleSheet, View } from "react-native";

export function AppodealBannerSlot({ placement }: { placement: string }) {
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
