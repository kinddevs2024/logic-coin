import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { AppFrame } from "@/components/app-frame";
import { AppText } from "@/components/app-text";
import { CountryFlagBadge } from "@/components/country-flag";
import { GlassSurface } from "@/components/glass-surface";
import { LogicCoinLogo } from "@/components/logo";
import { radii } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
import { useAppStore } from "@/store/app-store";
import type { Language } from "@/types";

const choices: {
  id: Language;
  country: "RU" | "UZ" | "US";
  nativeName: string;
  helper: string;
}[] = [
  { id: "ru", country: "RU", nativeName: "Русский", helper: "Русский язык" },
  { id: "uz", country: "UZ", nativeName: "O‘zbekcha", helper: "O‘zbek tili" },
  { id: "en", country: "US", nativeName: "English", helper: "English language" },
];

export default function LanguageScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const setLanguage = useAppStore((state) => state.setLanguage);
  const updateUser = useAppStore((state) => state.updateUser);
  const router = useRouter();

  const select = (language: Language, countryCode: "RU" | "UZ" | "US") => {
    setLanguage(language);
    updateUser({ countryCode });
    router.replace("/onboarding");
  };

  return (
    <AppFrame
      scroll={false}
      contentStyle={{ flex: 1, justifyContent: "center", paddingBottom: 36 }}
    >
      <View style={styles.wrap}>
        <View style={styles.logo}>
          <LogicCoinLogo />
        </View>
        <GlassSurface intensity={80} variant="strong" style={styles.card}>
          <View style={styles.heading}>
            <AppText variant="title" style={{ textAlign: "center" }}>
              {t("language.title")}
            </AppText>
            <AppText muted style={{ textAlign: "center" }}>
              {t("language.subtitle")}
            </AppText>
          </View>
          <View style={styles.list}>
            {choices.map((choice) => (
              <Pressable
                key={choice.id}
                accessibilityRole="button"
                accessibilityLabel={`${choice.nativeName}. ${choice.helper}`}
                onPress={() => select(choice.id, choice.country)}
                style={({ pressed }) => [
                  styles.choice,
                  {
                    backgroundColor: theme.glassFillStrong,
                    borderColor: theme.glassBorder,
                    opacity: pressed ? 0.75 : 1,
                    transform: [{ scale: pressed ? 0.985 : 1 }],
                  },
                ]}
              >
                <CountryFlagBadge countryCode={choice.country} size={36} />
                <View style={{ flex: 1 }}>
                  <AppText variant="heading">{choice.nativeName}</AppText>
                  <AppText variant="caption" muted>
                    {choice.helper}
                  </AppText>
                </View>
                <View
                  style={[
                    styles.arrow,
                    { backgroundColor: theme.primarySoft },
                  ]}
                >
                  <Ionicons
                    name="arrow-forward"
                    color={String(theme.primary)}
                    size={18}
                  />
                </View>
              </Pressable>
            ))}
          </View>
        </GlassSurface>
      </View>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    maxWidth: 540,
    alignSelf: "center",
  },
  logo: {
    alignItems: "center",
    marginBottom: 34,
  },
  card: {
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: 22,
    gap: 24,
  },
  heading: {
    gap: 7,
  },
  list: {
    gap: 11,
  },
  choice: {
    minHeight: 76,
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  arrow: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
