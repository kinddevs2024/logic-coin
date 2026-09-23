import { describe, expect, it } from "vitest";
import { escapeMarkup, injectPreview, SHARE_IMAGE } from "../src/lib/share-preview.js";

describe("server-rendered social previews", () => {
  it("escapes untrusted profile names in HTML attributes and text", () => {
    expect(escapeMarkup('<script>"&')).toBe("&lt;script&gt;&quot;&amp;");
    const html = injectPreview('<html><head><title>Old</title></head><body><script src="/app.js"></script></body></html>', {
      title: '<img src=x onerror="alert(1)">', description: "Profile", url: "https://www.logic-coin.online/profile/LC1234", image: SHARE_IMAGE, profile: true,
    });
    expect(html).not.toContain("<img");
    expect(html).toContain('property="og:type" content="profile"');
    expect(html).toContain('<script src="/app.js"></script>');
  });
  it("replaces generic tags instead of returning competing profile and site images", () => {
    const html = injectPreview('<head><meta property="og:image" content="old"><meta name="description" content="old"><meta name="twitter:image" content="old"><title>Old</title></head>', {
      title: "Player", description: "Stats", url: "https://www.logic-coin.online/profile/LC1234", image: "https://www.logic-coin.online/api/v1/share/profile/LC1234.jpg",
    });
    expect(html).not.toContain("old");
    expect(html.match(/property="og:image"/g)).toHaveLength(1);
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).toContain('content="1200"');
    expect(html).not.toContain("/invite/");
  });
});
