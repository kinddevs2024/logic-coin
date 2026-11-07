import { Platform } from "react-native";
import { isExpoGo } from "@/lib/native-runtime";

export function AppliedUpdateNotice() {
  if (Platform.OS !== "android" || isExpoGo) return null;
  const { NativeUpdateMessages } = require("./native-update-messages");
  return <NativeUpdateMessages />;
}
