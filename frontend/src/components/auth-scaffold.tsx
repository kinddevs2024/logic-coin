import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import type { PropsWithChildren } from "react";
import { Platform, StyleSheet, View } from "react-native";

import { AppFrame } from "@/components/app-frame";
import { AppText } from "@/components/app-text";
import { LogicCoinLogo } from "@/components/logo";
import { radii } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";

export function AuthScaffold({
  title,
  subtitle,
  children,
}: PropsWithChildren<{ title: string; subtitle?: string }>) {
  const theme = useAppTheme();
  return (
    <AppFrame
      contentStyle={styles.page}
      scrollProps={{ contentContainerStyle: undefined }}
    >
      <View style={styles.brand}>
        <LogicCoinLogo />
      </View>
      <BlurView
        intensity={Platform.OS === "web" ? 18 : 44}
        tint={theme.mode === "dark" ? "dark" : "light"}
        style={[
          styles.card,
          {
            backgroundColor:
              theme.mode === "dark"
                ? "rgba(16,29,52,0.92)"
                : "rgba(255,255,255,0.9)",
            borderColor: theme.border,
            shadowColor: theme.shadow,
          },
        ]}
      >
        <LinearGradient
          colors={["rgba(60,165,255,0.16)", "rgba(122,90,248,0.02)"]}
          style={styles.glow}
          pointerEvents="none"
        />
        <View style={styles.heading}>
          <AppText variant="title">{title}</AppText>
          {subtitle ? (
            <AppText muted style={{ textAlign: "center" }}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {children}
      </BlurView>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  page: {
    minHeight: "100%",
    justifyContent: "center",
    paddingBottom: 40,
  },
  brand: {
    alignItems: "center",
    marginBottom: 28,
  },
  card: {
    width: "100%",
    maxWidth: 500,
    alignSelf: "center",
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: 24,
    gap: 18,
    overflow: "hidden",
    shadowOpacity: Platform.OS === "web" ? 0.09 : 0.14,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  glow: {
    position: "absolute",
    width: 230,
    height: 230,
    borderRadius: 115,
    top: -125,
    right: -70,
  },
  heading: {
    alignItems: "center",
    gap: 7,
    marginBottom: 2,
  },
});
