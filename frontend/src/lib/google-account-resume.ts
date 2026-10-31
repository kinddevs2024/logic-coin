// The installed SDK uses Google's original account picker, not Credential Manager.
// Opening login offers a choice once; never silently undo an explicit app logout.
export async function resumeGoogleAccount<T>(sdk: {
  hasPlayServices(options: { showPlayServicesUpdateDialog: boolean }): Promise<unknown>;
  signOut(): Promise<unknown>;
  signIn(): Promise<T>;
}): Promise<T> {
  await sdk.hasPlayServices({ showPlayServicesUpdateDialog: false });
  await sdk.signOut();
  return sdk.signIn();
}
