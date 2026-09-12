import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { AppFrame } from "@/components/app-frame";
import { AppText } from "@/components/app-text";
import { GlassSurface } from "@/components/glass-surface";
import { LogicCoinLogo } from "@/components/logo";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";

export default function NotFoundScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { t } = useTranslation();

  return (
    <AppFrame scroll={false} contentStyle={styles.frame}>
      <GlassSurface intensity={72} variant="strong" style={styles.card}>
        <LogicCoinLogo compact />
        <View style={[styles.icon, { backgroundColor: theme.primarySoft }]}>
          <Ionicons name="help-outline" size={42} color={String(theme.primary)} />
        </View>
        <AppText variant="title" style={styles.center}>{t("notFound.title")}</AppText>
        <AppText muted style={styles.center}>{t("notFound.body")}</AppText>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace("/")}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: theme.primary, opacity: pressed ? 0.78 : 1 },
          ]}
        >
          <Ionicons name="home-outline" size={20} color="#FFFFFF" />
          <AppText variant="label" color="#FFFFFF">{t("notFound.home")}</AppText>
        </Pressable>
      </GlassSurface>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 32,
    padding: 28,
    alignItems: "center",
    gap: 18,
  },
  icon: {
    width: 92,
    height: 92,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  center: { textAlign: "center" },
  button: {
    width: "100%",
    minHeight: 54,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 18,
  },
});
