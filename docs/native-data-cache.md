# Native data cache (v1)

The Android/iOS client restores bounded React Query snapshots before mounting the authenticated screens. It then revalidates reads in the background. This is **resource-level revalidation**, not field-by-field deltas: an unchanged endpoint returns HTTP 304 without a body; a changed endpoint returns its current complete JSON response. Route handlers and authentication still run on the server.

- `NativeDataCacheBoundary` owns restoration, account/language changes, token rotation, and flushing when the app goes into the background. Web keeps its existing behavior.
- `IncrementalCache` stores one versioned AsyncStorage record scoped to API origin, account ID and language. Tokens are replaced with a placeholder in query keys and never persisted in this cache. Auth and administrator results, mutations and withdrawal details are excluded.
- HTTP responses and query snapshots each have a 175,000-character budget; an individual item over 60,000 characters is skipped. Core screens take priority. Entries expire after seven days. Storage failure falls back to normal requests.
- Restored queries are invalidated even when their normal `staleTime` is infinite. Daily challenges are restored only before their server-provided `endsAt`. Failed background refreshes preserve the last successful snapshot.
- Reads use `X-Data-Cache-Version: 1` and `If-None-Match`. The server's opt-in middleware runs **after authentication**, produces account/language-specific ETags, and never caches errors or writes. A changing top-level `data.serverNow` does not change the content validator; `X-Server-Time` keeps that field current on a 304.
- A 401 still refreshes or expires the session. Cached data never substitutes for a failed financial mutation, an authorization failure or an API error. Existing server validation remains authoritative.
- The first launch after installing this update populates the cache. Subsequent launches reuse it. New accounts, changed language, expired/oversized entries and excluded endpoints still require full responses.

Validation covers conditional 200/304 responses, changed balances, revoked access, account/language isolation, cold starts, token rotation, corrupted/full storage, logout races, old-day exclusion, offline snapshot preservation and unchanged mutation behavior. A browser harness exercises the real cache boundary with native platform/storage adapters; it verifies cached rendering before the pending request completes and account-switch isolation. This does not substitute for installed-device validation.
