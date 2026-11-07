import type { Types } from "mongoose";
import { UserAvatar } from "../models/UserAvatar.js";
import { isAppAvatarOrigin, isInlineAvatar, listAvatarRevision, originalAvatarUrl, renderListAvatar } from "../lib/list-avatar.js";

export async function storedAvatarThumbnail(value?: string | null): Promise<Buffer | null> {
  if (!value) return null;
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  if (!isAppAvatarOrigin(url.origin)) return null;
  const match = url.pathname.match(/^\/api\/v1\/avatars\/([a-f0-9]{24})\/([a-f0-9]{24})(?:\/original|\.webp)$/);
  if (!match) return null;
  const stored = await UserAvatar.findOne({ userId: match[1], revision: match[2] }).select("thumbnail").lean();
  if (!stored?.thumbnail) return null;
  return Buffer.isBuffer(stored.thumbnail) ? stored.thumbnail : Buffer.from(stored.thumbnail.value());
}

export async function storeAvatar(userId: Types.ObjectId, value: string) {
  if (!isInlineAvatar(value)) throw new Error("Invalid avatar");
  const revision = listAvatarRevision(value);
  const contentType = value.slice(5, value.indexOf(";"));
  const original = Buffer.from(value.slice(value.indexOf(",") + 1), "base64");
  const thumbnail = await renderListAvatar(value);
  try {
    await UserAvatar.updateOne({ userId, revision }, {
      $setOnInsert: { userId, revision, contentType, original, thumbnail },
    }, { upsert: true });
  } catch (error) {
    // Two identical uploads can race to insert the same immutable revision.
    if ((error as { code?: number }).code !== 11000) throw error;
  }
  return originalAvatarUrl(userId, revision);
}
