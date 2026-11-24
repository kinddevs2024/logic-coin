export async function selectGoogleAccount<T>(sdk: {
  hasPlayServices(options: { showPlayServicesUpdateDialog: boolean }): Promise<unknown>;
  signOut(): Promise<unknown>;
  signIn(): Promise<T>;
}): Promise<T> {
  await sdk.hasPlayServices({ showPlayServicesUpdateDialog: true });
  // Reset this app's saved choice, not Google accounts or granted permissions.
  // A stale or unavailable previous session must not prevent sign-in.
  try { await sdk.signOut(); } catch { /* Continue to Google account selection. */ }
  return sdk.signIn();
}
