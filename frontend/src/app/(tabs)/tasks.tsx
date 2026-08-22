import { Redirect } from "expo-router";

/** Backward-compatible route for links from releases that used the old Tasks tab. */
export default function LegacyTasksRedirect() {
  return <Redirect href={"/challenges" as never} />;
}
