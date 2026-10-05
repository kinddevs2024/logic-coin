import { readFileSync } from "node:fs";
import { notifyManager, QueryClient, QueryObserver } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

describe("challenge offer cache subscription", () => {
  it("defers notifications until after a synchronous cache update", async () => {
    let notified = false;
    const notify = notifyManager.batchCalls(() => { notified = true; });
    notify();
    expect(notified).toBe(false);
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(notified).toBe(true);
  });
  it("does not replace the shared challenge fetch function", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const key = ["challenges", "today", "test-account"];
    let calls = 0;
    const observer = new QueryObserver(client, { queryKey: key, queryFn: async () => ({ revision: ++calls }), staleTime: Infinity });
    const stopObserver = observer.subscribe(() => undefined);
    await observer.refetch();
    const before = calls;
    let notifications = 0;
    const stopCache = client.getQueryCache().subscribe(() => { notifications++; });
    await client.invalidateQueries({ queryKey: key });
    expect(calls).toBeGreaterThan(before);
    expect(notifications).toBeGreaterThan(0);
    stopCache(); stopObserver(); client.clear();
  });
  it("the offer reads cache without registering a skipToken query", () => {
    const source = readFileSync(new URL("../src/components/challenge-ad-offer.tsx", import.meta.url), "utf8");
    expect(source).toContain("useSyncExternalStore(subscribeToday, readToday, readToday)");
    expect(source).not.toContain("skipToken");
    expect(source).toContain("notifyManager.batchCalls");
    expect(source).toContain('event.type === "updated"');
  });
});
