import { createContext, useContext, type RefObject } from "react";
import type { View } from "react-native";

export const GlassBlurTargetContext =
  createContext<RefObject<View | null> | null>(null);

export function useGlassBlurTarget() {
  return useContext(GlassBlurTargetContext);
}
