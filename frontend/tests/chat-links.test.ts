import { expect, it } from "vitest";
import { splitChatLinks } from "../src/lib/chat-links";
it("keeps punctuation outside clickable HTTP links", () => {
  expect(splitChatLinks("Look https://example.com/a, thanks!")).toEqual([{text:"Look "},{text:"https://example.com/a",url:"https://example.com/a"},{text:", thanks!"}]);
});
it("does not make script URLs clickable", () => {
  expect(splitChatLinks("javascript:alert(1)")).toEqual([{text:"javascript:alert(1)"}]);
});
