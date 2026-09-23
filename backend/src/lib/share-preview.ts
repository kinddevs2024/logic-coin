export const SHARE_ORIGIN = "https://www.logic-coin.online";
export const SHARE_TITLE = "Logic Coin — играй, соревнуйся, выигрывай";
export const SHARE_DESCRIPTION = "Играй в короткие игры, участвуй в ежедневных челленджах и соревнуйся за денежные призы. Награды зависят от результатов и правил челленджа.";
export const SHARE_IMAGE = `${SHARE_ORIGIN}/share/logic-coin-v1.jpg`;

export function escapeMarkup(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

export type SharePreview = { title: string; description: string; url: string; image: string; profile?: boolean };

export function previewTags(preview: SharePreview) {
  const tags = {
    "og:type": preview.profile ? "profile" : "website",
    "og:site_name": "Logic Coin",
    "og:title": preview.title,
    "og:description": preview.description,
    "og:url": preview.url,
    "og:image": preview.image,
    "og:image:secure_url": preview.image,
    "og:image:type": "image/jpeg",
    "og:image:width": "1200",
    "og:image:height": "630",
    "og:image:alt": preview.title,
  };
  return `<title>${escapeMarkup(preview.title)}</title><meta name="description" content="${escapeMarkup(preview.description)}">` +
    Object.entries(tags).map(([key, value]) => `<meta property="${key}" content="${escapeMarkup(value)}">`).join("") +
    `<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeMarkup(preview.title)}"><meta name="twitter:description" content="${escapeMarkup(preview.description)}"><meta name="twitter:image" content="${escapeMarkup(preview.image)}"><link rel="canonical" href="${escapeMarkup(preview.url)}">`;
}

export function injectPreview(html: string, preview: SharePreview) {
  // Replace exported generic metadata, rather than leaving competing OG tags.
  return html.replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, "")
    .replace(/<meta\b[^>]*(?:property|name)=["'](?:og:[^"']+|twitter:[^"']+|description)["'][^>]*>/gi, "")
    .replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi, "")
    .replace(/<\/head>/i, `${previewTags(preview)}</head>`);
}
