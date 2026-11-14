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
  const theme = useAppTheme();
  const dark = theme.mode === "dark";
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
          backgroundColor: lens ? theme.primarySoft : theme.tabBar,
        },
      ]}
    >
      {/* One blur capture for the whole bar; the sliding lens is a light overlay. */}
      {!lens ? <NativeGlassLayer intensity={42} dark={dark} /> : null}
      <LinearGradient
        colors={[String(theme.glassHighlight), "transparent", "transparent"]}
        locations={[0, 0.45, 1]}
        start={{ x: 0.08, y: 0 }}
        end={{ x: 0.92, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[
        StyleSheet.absoluteFill,
        styles.rim,
        { borderColor: theme.glassBorder },
      ]} />
    </View>
  );
}

const styles = StyleSheet.create({
  surface: { borderRadius: 38, overflow: "hidden" },
  rim: { borderRadius: 38, borderWidth: 1 },
});
