import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";

import { NativeGlassLayer } from "@/components/native-glass-layer";
import { useAppTheme } from "@/hooks/use-app-theme";

export type NavigationGlassProps = {
  width: number;
  height: number;
  variant?: "bar" | "lens";
};

/** Native counterpart of the DOM-only liquid-glass-react surface. */
export function NavigationGlass({ variant = "bar" }: NavigationGlassProps) {
  const dark = useAppTheme().mode === "dark";
  const lens = variant === "lens";

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        StyleSheet.absoluteFill,
        styles.surface,
        {
          backgroundColor: dark
            ? lens ? "rgba(93,158,244,0.20)" : "rgba(17,30,50,0.88)"
            : `rgba(245,251,255,${lens ? 0.18 : 0.48})`,
        },
      ]}
    >
      {/* One blur capture for the whole bar; the sliding lens is a light overlay. */}
      {!lens ? <NativeGlassLayer intensity={42} dark={dark} /> : null}
      <LinearGradient
        colors={dark
          ? ["rgba(182,210,250,0.06)", "rgba(144,190,239,0.01)", "rgba(83,134,211,0.025)"]
          : ["rgba(255,255,255,0.68)", "rgba(255,255,255,0.04)", "rgba(187,221,255,0.2)"]}
        locations={[0, 0.45, 1]}
        start={{ x: 0.08, y: 0 }}
        end={{ x: 0.92, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[
        StyleSheet.absoluteFill,
        styles.rim,
        { borderColor: dark ? lens ? "rgba(147,193,255,0.36)" : "rgba(158,188,231,0.22)" : "rgba(255,255,255,0.82)" },
      ]} />
      {lens ? <View style={[styles.glint, { backgroundColor: dark ? "rgba(188,217,255,0.18)" : "rgba(255,255,255,0.9)" }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: { borderRadius: 38, overflow: "hidden" },
  rim: { borderRadius: 38, borderWidth: 1 },
  glint: { position: "absolute", top: 2, left: "22%", right: "22%", height: 1, borderRadius: 1 },
});
