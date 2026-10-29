import { Router, type Request, type Response } from "express";
import { User } from "../models/User.js";
import { UserAvatar } from "../models/UserAvatar.js";
import { isInlineAvatar, isStoredAvatarReference, listAvatarRevision, renderListAvatar } from "../lib/list-avatar.js";

const router = Router();
type Image = { bytes: Buffer; type: string };
const cache = new Map<string, Image & { expires: number }>();
const pending = new Map<string, Promise<Image | null>>();
const TTL = 5 * 60_000;

async function loadAvatar(userId: string, revision: string, original: boolean): Promise<Image | null> {
  const user = await User.findById(userId).select("avatarUrl").lean();
  const avatar = user?.avatarUrl;
  if (isStoredAvatarReference(avatar, userId, revision)) {
    const stored = await UserAvatar.findOne({ userId, revision })
      .select(original ? "original contentType" : "thumbnail").lean();
    if (!stored) return null;
    const value = original ? stored.original : stored.thumbnail;
    if (!value) return null;
    return { bytes: Buffer.isBuffer(value) ? value : Buffer.from(value.value()), type: original ? stored.contentType : "image/webp" };
  }
  if (!avatar || !isInlineAvatar(avatar) || listAvatarRevision(avatar) !== revision) return null;
  try {
    return original
      ? { bytes: Buffer.from(avatar.slice(avatar.indexOf(",") + 1), "base64"), type: avatar.slice(5, avatar.indexOf(";")) }
      : { bytes: await renderListAvatar(avatar), type: "image/webp" };
  } catch { return null; }
}

// Only avatars already exposed in public rankings/friends. This endpoint never
// fetches remote URLs or accepts filesystem paths or image contents from a URL.
function imageHandler(original: boolean) { return async (request: Request, response: Response) => {
  const userId = String(request.params.userId ?? "");
  const revision = String(request.params.revision ?? "");
  if (!/^[a-f0-9]{24}$/i.test(userId) || !/^[a-f0-9]{24}$/.test(revision)) {
    response.status(404).end(); return;
  }
  const key = `${userId}/${revision}/${original ? "original" : "thumbnail"}`;
  const cached = original ? undefined : cache.get(key);
  let image: Image | null = cached && cached.expires > Date.now() ? cached : null;
  if (!image) {
    let task = pending.get(key);
    if (!task) {
      task = loadAvatar(userId, revision, original);
      pending.set(key, task);
    }
    try { image = await task; } finally { if (pending.get(key) === task) pending.delete(key); }
    if (!image) { response.set("Cache-Control", "no-store").status(404).end(); return; }
    if (!original) {
      if (cache.size >= 200) cache.delete(cache.keys().next().value!);
      cache.set(key, { ...image, expires: Date.now() + TTL });
    }
  }
  const etag = `"${revision}${original ? "-original" : ""}"`;
  response.set({ "Cache-Control": "public, max-age=86400, immutable", ETag: etag, "X-Content-Type-Options": "nosniff" });
  if (request.headers["if-none-match"] === etag) { response.status(304).end(); return; }
  response.type(image.type).send(image.bytes);
}; }
router.get("/:userId/:revision.webp", imageHandler(false));
router.get("/:userId/:revision/original", imageHandler(true));

export default router;
