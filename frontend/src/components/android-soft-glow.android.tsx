import { memo, useId, useMemo } from "react";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import type { AndroidSoftGlowProps } from "./android-soft-glow";
import { createSoftGlow } from "@/lib/soft-glow";

/** Soft alpha edges instead of an unblurred solid circle on Android. */
export const AndroidSoftGlow = memo(function AndroidSoftGlow({
  color,
  diameter,
  blurRadius,
}: AndroidSoftGlowProps) {
  const id = useId().replace(/:/g, "");
  const { padding, size, stops } = useMemo(
    () => createSoftGlow(diameter, blurRadius),
    [diameter, blurRadius],
  );

  return (
    <Svg
      pointerEvents="none"
      accessible={false}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ position: "absolute", left: -padding, top: -padding }}
    >
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" rx="50%" ry="50%">
          {stops.map(({ offset, opacity }) => (
            <Stop key={offset} offset={offset} stopColor={color} stopOpacity={opacity} />
          ))}
        </RadialGradient>
      </Defs>
      <Rect width="100" height="100" fill={`url(#${id})`} />
    </Svg>
  );
});
