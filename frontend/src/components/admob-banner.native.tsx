import { useUiCopy } from "@/components/localized-native";

import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { isExpoGo } from "@/lib/native-runtime";

import { admob } from "@/lib/admob";
const sdk = isExpoGo ? null : require("react-native-google-mobile-ads");
const BannerAd = sdk?.BannerAd;
const BannerAdSize = sdk?.BannerAdSize;

export function AdmobBannerSlot() {
  const { copyText } = useUiCopy();
  const [unitId] = useState(() => admob.bannerUnitId());
  const [failed, setFailed] = useState(false);

  if (!BannerAd || !unitId || failed) return null;

  return (
    <View accessibilityLabel={copyText("Реклама")} style={styles.slot}>
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
