import type { PropsWithChildren, ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { AppFrame } from "@/components/app-frame";
import { AppText } from "@/components/app-text";
import { GlassSurface } from "@/components/glass-surface";
import { LogicCoinLogo } from "@/components/logo";

export function AuthScaffold({
  title,
  subtitle,
  headerAction,
  children,
}: PropsWithChildren<{
  title?: string;
  subtitle?: string;
  headerAction?: ReactNode;
}>) {
  return (
    <AppFrame
      contentStyle={styles.page}
      scrollProps={{ contentContainerStyle: undefined }}
    >
      <View style={styles.brand}>
        <LogicCoinLogo compact />
      </View>
      <GlassSurface intensity={64} variant="strong" style={styles.card}>
        {headerAction ? (
          <View style={styles.headerAction}>
            {headerAction}
          </View>
        ) : null}
        {title || subtitle ? (
          <View style={styles.heading}>
            {title ? <AppText variant="heading">{title}</AppText> : null}
            {subtitle ? (
              <AppText
                variant="caption"
                muted
                style={[{ textAlign: "center" }, styles.subtitle]}
              >
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
    paddingTop: 40,
  },
  brand: {
    alignItems: "center",
    marginBottom: 150,
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
  headerAction: {
    position: "absolute",
    top: 16,
    left: 16,
    zIndex: 10,
  },
  heading: {
    alignItems: "center",
    gap: 7,
    marginBottom: 0,
    marginTop: 5,
  },
  subtitle: {
    maxWidth: 280,
  },
});
