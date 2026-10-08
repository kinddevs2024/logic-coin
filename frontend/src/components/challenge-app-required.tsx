import { Linking, Platform, View } from "react-native";
import { AppText } from "@/components/app-text";
import { AppButton } from "@/components/buttons";
import { GlassSurface } from "@/components/glass-surface";
import { useTranslation } from "@/hooks/use-translation";

export function ChallengeAppRequired() {
  const { language } = useTranslation();
  const copy = {
    ru: ["Челленджи — только в приложении", "На сайте можно смотреть результаты и рейтинг. Чтобы играть в челленджи, откройте Logic Coin на телефоне.", "Открыть приложение"],
    en: ["Challenges are app-only", "View results and rankings on the website. To play challenges, open Logic Coin on your phone.", "Open app"],
    uz: ["Sinovlar faqat ilovada", "Saytda natijalar va reytingni ko‘rish mumkin. Sinovlarda o‘ynash uchun telefonda Logic Coin ilovasini oching.", "Ilovani ochish"],
  }[language];
  return <GlassSurface variant="strong" style={{ padding: 24, borderRadius: 24, gap: 14 }}>
    <AppText variant="heading">{copy[0]}</AppText>
    <AppText muted>{copy[1]}</AppText>
    <View><AppButton onPress={() => {
      if (Platform.OS === "web") window.location.assign(/Android/i.test(navigator.userAgent) ? "https://play.google.com/store/apps/details?id=com.kinddevs.logiccoin" : "/api/v1/auth/app/open");
      else void Linking.openURL("logiccoin://challenges");
    }}>{copy[2]}</AppButton></View>
  </GlassSurface>;
}
