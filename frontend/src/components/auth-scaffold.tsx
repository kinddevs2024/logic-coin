import { LinearGradient } from "expo-linear-gradient";
import type { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";

import { AppFrame } from "@/components/app-frame";
import { AppText } from "@/components/app-text";
import { GlassSurface } from "@/components/glass-surface";
import { LogicCoinLogo } from "@/components/logo";
import { radii } from "@/constants/theme";

export function AuthScaffold({
  title,
  subtitle,
  children,
}: PropsWithChildren<{ title: string; subtitle?: string }>) {
  return (
    <AppFrame
      contentStyle={styles.page}
      scrollProps={{ contentContainerStyle: undefined }}
    >
      <View style={styles.brand}>
        <LogicCoinLogo />
      </View>
      <GlassSurface intensity={78} variant="strong" style={styles.card}>
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
      </GlassSurface>
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
