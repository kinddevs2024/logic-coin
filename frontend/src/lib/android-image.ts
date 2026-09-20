import { Platform, type ImageProps } from "react-native";

// RN's Android `auto` resize method excludes bundled resource and data URIs.
// Decode near the measured view size, with 2x headroom for sharp edges and
// transforms, instead of retaining a full-size bitmap for every small image.
// Android view dimensions already include the device's pixel density.
// RN 0.86 forwards resizeMultiplier to Fresco, but omits it from ImageProps.d.ts.
export const androidImageProps: Pick<ImageProps, "resizeMethod"> & { resizeMultiplier?: number } =
  Platform.OS === "android"
    ? { resizeMethod: "resize", resizeMultiplier: 2 }
    : {};
