import { useSyncExternalStore } from "react";
import { Platform, useWindowDimensions } from "react-native";

export const tabletBreakpoint = 768;
export const desktopBreakpoint = 1024;

const subscribeToHydration = () => () => undefined;

export function useResponsiveLayout() {
  const { height, width } = useWindowDimensions();
  const isWeb = Platform.OS === "web";
  const clientReady = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const responsiveWidth = isWeb && !clientReady ? 0 : width;

  return {
    height,
    width: responsiveWidth,
    isWeb,
    isTablet: responsiveWidth >= tabletBreakpoint,
    isDesktop: responsiveWidth >= desktopBreakpoint,
  };
}
