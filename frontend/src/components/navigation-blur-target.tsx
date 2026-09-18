import { BlurTargetView } from "expo-blur";
import { useIsFocused } from "expo-router";
import { createContext, useContext, useEffect, useRef, useState, type Dispatch, type PropsWithChildren, type RefObject, type SetStateAction } from "react";
import { Platform, StyleSheet, type View } from "react-native";

import { GlassBlurTargetContext } from "@/components/glass-blur-target";

type BlurTarget = RefObject<View | null> | null;
const RegisterNavigationBlurTarget = createContext<Dispatch<SetStateAction<BlurTarget>> | null>(null);

export function NavigationBlurProvider({ children }: PropsWithChildren) {
  const [target, setTarget] = useState<BlurTarget>(null);
  return (
    <RegisterNavigationBlurTarget.Provider value={setTarget}>
      <GlassBlurTargetContext.Provider value={target}>
        {children}
      </GlassBlurTargetContext.Provider>
    </RegisterNavigationBlurTarget.Provider>
  );
}

/** Capture the active screen only, excluding the navigation bar itself. */
export function NavigationBlurScene({ children }: PropsWithChildren) {
  const target = useRef<View | null>(null);
  const focused = useIsFocused();
  const register = useContext(RegisterNavigationBlurTarget);

  useEffect(() => {
    if (Platform.OS !== "android" || !focused || !register) return;
    register(target);
    return () => register((current) => current === target ? null : current);
  }, [focused, register]);

  if (Platform.OS !== "android") return children;
  return <BlurTargetView ref={target} style={styles.scene}>{children}</BlurTargetView>;
}

const styles = StyleSheet.create({ scene: { flex: 1 } });
