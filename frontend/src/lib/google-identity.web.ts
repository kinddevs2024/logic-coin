export type GoogleIdentity = {
  initialize(options: { client_id: string; callback: (response: { credential?: string }) => void }): void;
  renderButton(element: HTMLElement, options: Record<string, string | number>): void;
};
let loading: Promise<GoogleIdentity> | undefined;
export function loadGoogleIdentity(): Promise<GoogleIdentity> {
  const current = () => (window as Window & { google?: { accounts?: { id?: GoogleIdentity } } }).google?.accounts?.id;
  const identity = current();
  if (identity) return Promise.resolve(identity);
  if (loading) return loading;
  loading = new Promise<GoogleIdentity>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src^="https://accounts.google.com/gsi/client"]');
    const script = existing ?? document.createElement("script");
    const cleanup = () => { clearTimeout(timeout); script.removeEventListener("load", loaded); script.removeEventListener("error", failed); };
    const failed = () => { cleanup(); script.remove(); reject(new Error("Google could not be loaded")); };
    const loaded = () => { const sdk = current(); if (!sdk) return failed(); cleanup(); resolve(sdk); };
    const timeout = setTimeout(failed, 12_000);
    script.addEventListener("load", loaded, { once: true });
    script.addEventListener("error", failed, { once: true });
    if (!existing) { script.src = "https://accounts.google.com/gsi/client"; script.async = true; document.head.appendChild(script); }
  }).catch((error: unknown) => { loading = undefined; throw error; });
  return loading;
}
