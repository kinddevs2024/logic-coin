import { createContext, useContext, type RefObject } from "react";
import { Platform, type View } from "react-native";

export const GlassBlurTargetContext =
  createContext<RefObject<View | null> | null>(null);

// Modal backdrops must capture the whole screen. Ordinary cards intentionally
// target only AppFrame's ambient background so they cannot blur themselves.
export const ScreenBlurTargetContext =
  createContext<RefObject<View | null> | null>(null);

export function useGlassBlurTarget() {
  return useContext(GlassBlurTargetContext);
}

export function useModalBlurTarget() {
  const screen = useContext(ScreenBlurTargetContext);
  const background = useContext(GlassBlurTargetContext);
  // Never substitute the ambient-only capture for a full-screen Android modal:
  // its opaque blurred snapshot would paint over all of the screen's content.
  return Platform.OS === "android" ? screen : background;
}
