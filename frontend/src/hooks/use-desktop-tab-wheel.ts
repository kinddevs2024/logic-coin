import { useRef } from "react";
import type { View } from "react-native";

// Desktop wheel navigation has no native listeners; touch swipes stay unchanged.
export function useDesktopTabWheel(_options: { disabled?: boolean } = {}) {
  return useRef<View | null>(null);
}
