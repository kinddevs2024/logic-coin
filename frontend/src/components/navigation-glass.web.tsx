import LiquidGlass from "liquid-glass-react";
import { memo, useState } from "react";

import type { NavigationGlassProps } from "./navigation-glass";
import { useAppTheme } from "@/hooks/use-app-theme";

// Navigation animates on its own. Avoid the library's mousemove state updates
// and cursor-following transforms so labels and hit areas stay perfectly aligned.
const stationaryPointer = { x: 0, y: 0 };

export const NavigationGlass = memo(function NavigationGlass({
  width,
  height,
  variant = "bar",
}: NavigationGlassProps) {
  const dark = useAppTheme().mode === "dark";
  const [refraction] = useState(() => {
    if (typeof navigator === "undefined") return false;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    return /Chrome|Chromium|Edg\//.test(navigator.userAgent) && !connection?.saveData;
  });
  const lens = variant === "lens";

  return (
    <div
      aria-hidden="true"
      className="logic-nav-glass"
      data-variant={variant}
      data-theme={dark ? "dark" : "light"}
      data-refraction={refraction ? "true" : "false"}
    >
      {width > 0 && height > 0 ? (
        <LiquidGlass
          // The library measures on mount/window resize; also remeasure when
          // React Native changes the bar's geometry or its orientation.
          key={`${Math.round(width)}:${Math.round(height)}`}
          className="logic-nav-refraction"
          mode="standard"
          displacementScale={lens ? 24 : 44}
          blurAmount={lens ? 0.015 : 0.2}
          saturation={145}
          aberrationIntensity={lens ? 1.2 : 1.5}
          elasticity={0}
          cornerRadius={38}
          padding="0"
          globalMousePos={stationaryPointer}
          mouseOffset={stationaryPointer}
          style={{ position: "absolute", top: "50%", left: "50%", width, height }}
        >
          <div style={{ width, height }} />
        </LiquidGlass>
      ) : null}
      <div className="logic-nav-glass-rim" />
    </div>
  );
});
