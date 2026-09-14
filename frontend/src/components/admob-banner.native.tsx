import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads";

import { admob } from "@/lib/admob";

export function AdmobBannerSlot() {
  const [unitId] = useState(() => admob.bannerUnitId());
  const [failed, setFailed] = useState(false);

  if (!unitId || failed) return null;

  return (
    <View accessibilityLabel="Реклама" style={styles.slot}>
      <BannerAd
        unitId={unitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        onAdFailedToLoad={() => setFailed(true)}
      />
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
});
