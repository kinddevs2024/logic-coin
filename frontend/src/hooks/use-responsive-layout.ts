import { Platform, useWindowDimensions } from "react-native";

export const tabletBreakpoint = 768;
export const desktopBreakpoint = 1024;

export function useResponsiveLayout() {
  const { height, width } = useWindowDimensions();
  const isWeb = Platform.OS === "web";

  return {
    height,
    width,
    isWeb,
    isTablet: isWeb && width >= tabletBreakpoint,
    isDesktop: isWeb && width >= desktopBreakpoint,
  };
}
