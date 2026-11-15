import { Redirect } from "expo-router";

/** Administration is available on the website; native users return to the app. */
export default function NativeAdminUnavailable() {
  return <Redirect href="/(tabs)" />;
}
