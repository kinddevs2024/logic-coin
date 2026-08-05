import { useRouter } from "expo-router";
import type { PropsWithChildren, ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { AppFrame } from "@/components/app-frame";
import { AppText } from "@/components/app-text";
import { IconButton } from "@/components/buttons";

export function GameShell({
  title,
  meta,
  children,
}: PropsWithChildren<{ title: string; meta?: ReactNode }>) {
  const router = useRouter();
  return (
    <AppFrame wide contentStyle={styles.page}>
      <View style={styles.header}>
        <IconButton name="chevron-back" label="Назад" onPress={() => router.back()} />
        <AppText variant="heading" style={styles.title}>{title}</AppText>
        <View style={styles.meta}>{meta}</View>
      </View>
      {children}
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  page: { maxWidth: 760 },
  header: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  },
  title: { flex: 1 },
  meta: { minWidth: 48, alignItems: "flex-end" },
});
