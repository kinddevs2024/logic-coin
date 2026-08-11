import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState, type PropsWithChildren, type ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppText } from "@/components/app-text";
import { IconButton } from "@/components/buttons";
import { GlassSurface } from "@/components/glass-surface";
import { GameEconomyHud, GameEconomyModal } from "@/components/game-economy";
import type { GameId } from "@/games/progress-store";
import { useAppTheme } from "@/hooks/use-app-theme";

export type GameShellVariant = "app" | "longcat" | "gobble" | "loops" | "brain";

const GAME_BACKGROUNDS: Record<Exclude<GameShellVariant, "app">, string> = {
  longcat: "#F4C5A9",
  gobble: "#FDB78D",
  loops: "#E7CFCF",
  brain: "#F5EBD8",
};

export function GameShell({
  title,
  meta,
  children,
  variant = "app",
  backgroundColor,
  gameId,
}: PropsWithChildren<{
  title: string;
  meta?: ReactNode;
  variant?: GameShellVariant;
  backgroundColor?: string;
  gameId?: GameId;
}>) {
  const router = useRouter();
  const theme = useAppTheme();
  const scrollRef = useRef<ScrollView>(null);
  const [economyOpen, setEconomyOpen] = useState(false);
  const background = backgroundColor ?? (variant === "app" ? String(theme.background) : GAME_BACKGROUNDS[variant]);

  useFocusEffect(
    useCallback(() => {
      const scrollToTop = () => scrollRef.current?.scrollTo({ y: 0, animated: false });
      scrollToTop();
      const timer = setTimeout(scrollToTop, 50);
      return () => clearTimeout(timer);
    }, []),
  );

  const header = (
    <View style={styles.headerContent}>
      <IconButton name="chevron-back" label="Назад" onPress={() => router.back()} />
      <AppText style={[styles.title, { color: variant === "app" ? theme.text : "#25212A" }]}>{title}</AppText>
      <View style={[styles.meta, variant !== "app" && styles.metaGame]}>
        {meta}
        {gameId ? <GameEconomyHud gameId={gameId} onOpen={() => setEconomyOpen(true)} /> : null}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: background }]} edges={["top", "left", "right"]}>
      <View pointerEvents="none" style={[styles.ambient, variant === "app" ? { backgroundColor: String(theme.orbOne) } : styles.ambientGame]} />
      <ScrollView ref={scrollRef} role="main" style={styles.scroll} contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        {variant === "app" ? <GlassSurface intensity={58} style={styles.headerGlass}>{header}</GlassSurface> : <View style={styles.headerPlain}>{header}</View>}
        {children}
      </ScrollView>
      {gameId ? <GameEconomyModal gameId={gameId} visible={economyOpen} onClose={() => setEconomyOpen(false)} /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1 },
  page: { width: "100%", maxWidth: 920, alignSelf: "center", paddingHorizontal: 16, paddingTop: 10, paddingBottom: 48 },
  ambient: { position: "absolute", width: 360, height: 360, borderRadius: 180, opacity: 0.16, top: -150, right: -120 },
  ambientGame: { backgroundColor: "#FFFFFF", opacity: 0.13 },
  headerGlass: { borderRadius: 28, marginBottom: 18 },
  headerPlain: { marginBottom: 10 },
  headerContent: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 10, paddingVertical: 7 },
  title: { flex: 1, fontSize: 20, lineHeight: 25, fontWeight: "900", textAlign: "center" },
  meta: { minWidth: 48, minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  metaGame: { borderRadius: 999, paddingHorizontal: 10, backgroundColor: "rgba(255,255,255,0.38)" },
});
