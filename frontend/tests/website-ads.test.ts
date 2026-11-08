import { afterEach, expect, it, vi } from "vitest";
import { loadWebsiteAds } from "../src/lib/website-ads";

afterEach(() => vi.unstubAllGlobals());
it("does not load in-page ads and loads the retained result-page zone once", () => {
  const tags: { dataset: Record<string, string>; src: string }[] = [];
  vi.stubGlobal("window", { location: { hash: "", search: "" } });
  vi.stubGlobal("document", {
    querySelector: (query: string) => tags.find(tag => query.includes(`"${tag.dataset.zone}"`)),
    createElement: () => ({ dataset: {}, src: "", addEventListener: vi.fn() }),
    body: { appendChild: (tag: typeof tags[number]) => tags.push(tag) },
  });
  loadWebsiteAds(true);
  loadWebsiteAds();
  expect(tags).toHaveLength(0);
  loadWebsiteAds(true);
  expect(tags.map(tag => [tag.dataset.zone, tag.src])).toEqual([
    ["12151182", "https://n6wxm.com/vignette.min.js"],
  ]);
});
it("never adds ordinary website formats inside Telegram", () => {
  const createElement = vi.fn();
  vi.stubGlobal("window", { location: { hash: "#tgWebAppPlatform=android", search: "" } });
  vi.stubGlobal("document", { createElement });
  loadWebsiteAds(true);
  expect(createElement).not.toHaveBeenCalled();
});
