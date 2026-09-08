import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { AdmobBannerSlot } from "@/components/admob-banner";
import { AppFrame } from "@/components/app-frame";
import { AppText } from "@/components/app-text";
import { AppButton } from "@/components/buttons";
import { LogoMark } from "@/components/logo";
import { useTranslation } from "@/hooks/use-translation";
import { admob } from "@/lib/admob";
import { markLaunchAdShown } from "@/lib/launch-ad";

export default function AdsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    // Warm the SDK up while the user is still looking at the screen so the
    // first tap does not pay for consent + initialization.
    void admob.initialize().catch(() => false);
    return () => {
      mounted.current = false;
    };
  }, []);

  const continueToApp = useCallback(() => {
    markLaunchAdShown();
    router.replace("/");
  }, [router]);

  const openAd = useCallback(async () => {
    if (busy) return;
    if (failed) {
      continueToApp();
      return;
    }
    setBusy(true);
    const result = await admob.showInterstitial();
    if (!mounted.current) return;
    setBusy(false);
    if (result.shown) {
      continueToApp();
      return;
    }
    // No ad could be presented (no fill, no network, unsupported platform).
    // The launch flow must never dead-end, so the button turns into a plain
    // "continue" instead of retrying forever.
    setFailed(true);
  }, [busy, continueToApp, failed]);

  return (
    <AppFrame scroll={false} contentStyle={styles.content}>
      <View style={styles.wrap}>
        <LogoMark size={78} />
        <AppButton
          icon={failed ? "arrow-forward" : "play"}
          loading={busy}
          onPress={() => void openAd()}
          glow
          style={styles.button}
        >
          {failed ? t("common.next") : "Ads"}
        </AppButton>
        {failed ? (
          <AppText variant="caption" muted style={styles.hint}>
            {t("ads.unavailable")}
          </AppText>
        ) : null}
      </View>
      <View style={styles.banner}>
        <AdmobBannerSlot />
      </View>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: "center" },
  wrap: { alignItems: "center", gap: 20 },
  button: { minWidth: 220 },
  hint: { textAlign: "center", maxWidth: 280 },
  banner: { position: "absolute", left: 0, right: 0, bottom: 12 },
});
