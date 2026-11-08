import { expect, it } from "vitest";
import { adNavigationKey, createNavigationAdCounter, shouldShowNavigationAd, reportProfileAdNavigation, subscribeProfileAdNavigation } from "../src/lib/ad-navigation";
it("runs only between different content screens", () => {
  expect(shouldShowNavigationAd("/", "/challenges")).toBe(true);
  expect(shouldShowNavigationAd("/challenges", "/games")).toBe(true);
  for (const previous of [null, "/login", "/play/one-second", "/admin", "/raffle"]) {
    expect(shouldShowNavigationAd(previous, "/messages")).toBe(false);
  }
  expect(shouldShowNavigationAd("/messages", "/messages")).toBe(false);
  expect(shouldShowNavigationAd("/challenges", "/play/one-second")).toBe(false);
});

it("counts chat changes and public profiles but not repeated renders", () => {
  const list = adNavigationKey("/messages", "");
  const chat = adNavigationKey("/messages", "chat-a");
  expect(shouldShowNavigationAd(list, chat)).toBe(true);
  expect(shouldShowNavigationAd(chat, adNavigationKey("/messages", ["chat-b"]))).toBe(true);
  expect(shouldShowNavigationAd(chat, adNavigationKey("/messages", "chat-a"))).toBe(false);
  expect(shouldShowNavigationAd(chat, "/profile/player-a")).toBe(true);
  expect(shouldShowNavigationAd("/profile/player-a", chat)).toBe(true);
});
it("waits for ten transitions, and unavailable ads stay due at the next boundary", () => {
  const counter = createNavigationAdCounter();
  for (let i = 1; i < 10; i++) expect(counter.advance()).toBe(false);
  expect(counter.advance()).toBe(true);
  expect(counter.advance()).toBe(true);
  counter.shown();
  for (let i = 0; i < 8; i++) expect(counter.advance()).toBe(false);
  expect(counter.advance()).toBe(true);
  counter.reset();
  expect(counter.advance()).toBe(false);
});
it("shares profile events without retaining unmounted subscribers", () => {
  let visits = 0;
  const stop = subscribeProfileAdNavigation(() => { visits++; });
  reportProfileAdNavigation(); stop(); reportProfileAdNavigation();
  expect(visits).toBe(1);
});
