import { createHash } from "node:crypto";
import sharp from "sharp";
import { env } from "../config/env.js";

const inlineImage = /^data:image\/(?:png|jpeg|webp);base64,/;
export function isAppAvatarOrigin(origin: string) {
  return [new URL(env.APP_PUBLIC_URL).origin, "https://logic-coin.online", "https://www.logic-coin.online"].includes(origin);
}
export function isStoredAvatarReference(value: string | null | undefined, userId: string, revision: string) {
  if (!value) return false;
  try { const url = new URL(value); return isAppAvatarOrigin(url.origin) && url.pathname === `/api/v1/avatars/${userId}/${revision}/original` && !url.search && !url.hash; }
  catch { return false; }
}
export function isInlineAvatar(value: string) { return inlineImage.test(value); }

export function listAvatarRevision(value: string) {
  return createHash("sha256").update("list-avatar-v1:").update(value).digest("hex").slice(0, 24);
}

/** Keep the existing API shape, but do not repeat entire image files in JSON.
 * Absolute HTTPS URLs work in both installed Android clients and the web app.
 */
export function listAvatarUrl(userId: { toString(): string }, value?: string | null): string | null {
  if (!value) return null;
  if (!isInlineAvatar(value)) {
    try {
      const url = new URL(value);
      const revision = url.pathname.match(/^\/api\/v1\/avatars\/[a-f0-9]{24}\/([a-f0-9]{24})\/original$/)?.[1];
      if (isAppAvatarOrigin(url.origin) && revision) {
        return new URL(`/api/v1/avatars/${userId.toString()}/${revision}.webp`, env.APP_PUBLIC_URL).href;
      }
    } catch { /* Legacy remote image URLs remain unchanged. */ }
    return value;
  }
  return new URL(`/api/v1/avatars/${userId.toString()}/${listAvatarRevision(value)}.webp`, env.APP_PUBLIC_URL).href;
}

export function originalAvatarUrl(userId: { toString(): string }, revision: string) {
  return new URL(`/api/v1/avatars/${userId.toString()}/${revision}/original`, env.APP_PUBLIC_URL).href;
}

export async function renderListAvatar(value: string): Promise<Buffer> {
  if (!isInlineAvatar(value) || value.length > 10_000_000) throw new Error("Invalid avatar");
  return sharp(Buffer.from(value.slice(value.indexOf(",") + 1), "base64"), { limitInputPixels: 20_000_000, animated: false })
    .rotate().resize(160, 160, { fit: "cover", withoutEnlargement: true }).webp({ quality: 76 }).toBuffer();
}
