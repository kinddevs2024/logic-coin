import type { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";

import { AppFrame } from "@/components/app-frame";
import { AppText } from "@/components/app-text";
import { GlassSurface } from "@/components/glass-surface";
import { LogicCoinLogo } from "@/components/logo";

export function AuthScaffold({
  title,
  subtitle,
  children,
}: PropsWithChildren<{ title?: string; subtitle?: string }>) {
  return (
    <AppFrame
      contentStyle={styles.page}
      scrollProps={{ contentContainerStyle: undefined }}
    >
      <View style={styles.brand}>
        <LogicCoinLogo compact />
      </View>
      <GlassSurface intensity={64} variant="strong" style={styles.card}>
        {title || subtitle ? (
          <View style={styles.heading}>
            {title ? <AppText variant="heading">{title}</AppText> : null}
            {subtitle ? (
              <AppText variant="caption" muted style={{ textAlign: "center" }}>
                {subtitle}
              </AppText>
            ) : null}
          </View>
        ) : null}
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
    marginBottom: 18,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    borderWidth: 1,
    borderRadius: 30,
    padding: 20,
    gap: 14,
  },
  heading: {
    alignItems: "center",
    gap: 7,
    marginBottom: 4,
  },
});
