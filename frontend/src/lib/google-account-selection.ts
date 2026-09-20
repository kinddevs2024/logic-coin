export async function selectGoogleAccount<T>(sdk: {
  hasPlayServices(options: { showPlayServicesUpdateDialog: boolean }): Promise<unknown>;
  signOut(): Promise<unknown>;
  signIn(): Promise<T>;
}): Promise<T> {
  await sdk.hasPlayServices({ showPlayServicesUpdateDialog: true });
  // Reset this app's saved choice, not Google accounts or granted permissions.
  await sdk.signOut();
  return sdk.signIn();
}
