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
    ru: ["Челленджи — в приложении и Telegram", "Чтобы играть, откройте приложение Logic Coin или Telegram-бота.", "Открыть приложение", "Открыть Telegram-бота"],
    en: ["Play challenges in the app or Telegram", "Open the Logic Coin app or Telegram bot to play.", "Open app", "Open Telegram bot"],
    uz: ["Sinovlar ilova va Telegramda", "O‘ynash uchun Logic Coin ilovasi yoki Telegram botini oching.", "Ilovani ochish", "Telegram botini ochish"],
  }[language];
  return <GlassSurface variant="strong" style={{ padding: 24, borderRadius: 24, gap: 14 }}>
    <AppText variant="heading">{copyContent(copy[0])}</AppText>
    <AppText muted>{copyContent(copy[1])}</AppText>
    <View><AppButton onPress={() => {
      if (Platform.OS === "web") window.location.assign(/Android/i.test(navigator.userAgent) ? "https://play.google.com/store/apps/details?id=com.kinddevs.logiccoin" : "/api/v1/auth/app/open");
      else void Linking.openURL("logiccoin://challenges");
    }}>{copyContent(copy[2])}</AppButton></View>
    <View><AppButton onPress={() => { void Linking.openURL("https://t.me/Logic_coinn_bot"); }}>{copyContent(copy[3])}</AppButton></View>
  </GlassSurface>;
}
