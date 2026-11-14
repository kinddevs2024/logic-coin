import { useUiCopy } from "@/components/localized-native";

import { Linking, Platform, View } from "react-native";
import { AppText } from "@/components/app-text";
import { AppButton } from "@/components/buttons";
import { GlassSurface } from "@/components/glass-surface";
import { useTranslation } from "@/hooks/use-translation";

export function ChallengeAppRequired() {
  const { copyContent } = useUiCopy();
  const { language } = useTranslation();
  const copy = {
    ru: ["Челленджи — в приложении Logic Coin", "Чтобы играть, откройте приложение Logic Coin на телефоне.", "Открыть приложение"],
    en: ["Play challenges in the Logic Coin app", "Open the Logic Coin app on your phone to play.", "Open app"],
    uz: ["Sinovlar Logic Coin ilovasida", "O‘ynash uchun telefonda Logic Coin ilovasini oching.", "Ilovani ochish"],
  }[language];
  return <GlassSurface variant="strong" style={{ padding: 24, borderRadius: 24, gap: 14 }}>
    <AppText variant="heading">{copyContent(copy[0])}</AppText>
    <AppText muted>{copyContent(copy[1])}</AppText>
    <View><AppButton onPress={() => {
      if (Platform.OS === "web") window.location.assign(/Android/i.test(navigator.userAgent) ? "https://play.google.com/store/apps/details?id=com.kinddevs.logiccoin" : "/api/v1/auth/app/open");
      else void Linking.openURL("logiccoin://challenges");
    }}>{copyContent(copy[2])}</AppButton></View>
  </GlassSurface>;
}
