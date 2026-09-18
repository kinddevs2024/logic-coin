import type { ColorValue } from "react-native";

export type AndroidSoftGlowProps = {
  color: ColorValue;
  diameter: number;
  blurRadius: number;
};

// Other platforms keep their existing background and CSS/native rendering.
export function AndroidSoftGlow(_props: AndroidSoftGlowProps) {
  return null;
}
