import { randomBytes } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { Types } from "mongoose";
import { env } from "../config/env.js";
import { ApiError } from "../lib/api-error.js";
import { ChatAttachment } from "../models/Chat.js";
import { uploadChatAttachmentBuffer } from "./chat.service.js";

export const CHAT_FILE_LIMIT = 200 * 1024 * 1024;
let active = 0;
export async function uploadChatStream(userId: Types.ObjectId, input: { name: string; mime: string; kind: "photo" | "file" | "voice" }, stream: Readable, declaredSize: number) {
  if (!Number.isSafeInteger(declaredSize) || declaredSize < 1 || declaredSize > CHAT_FILE_LIMIT)
    throw new ApiError(413, "attachment_too_large", "Maximum file size is 200 MB");
  if (active >= 4) throw new ApiError(429, "uploads_busy", "Please retry the upload shortly");
  active++;
  const root = path.resolve(process.env.CHAT_MEDIA_DIR || (env.NODE_ENV === "production" ? "/srv/apps/logic-coin/shared/chat-media" : ".chat-media"));
  const storageKey = randomBytes(24).toString("hex"), file = path.join(root, storageKey);
  let keep = false, size = 0, prefix = Buffer.alloc(0), binaryText = false;
  try {
    const usage = await ChatAttachment.aggregate<{ bytes: number }>([
      { $match: { ownerId: userId, createdAt: { $gte: new Date(Date.now() - 86400_000) } } },
      { $group: { _id: null, bytes: { $sum: "$size" } } },
    ]);
    if ((usage[0]?.bytes ?? 0) + declaredSize > 1024 * 1024 * 1024)
      throw new ApiError(429, "upload_quota", "Daily upload limit reached. Please try tomorrow");
    await mkdir(root, { recursive: true, mode: 0o700 });
    await pipeline(stream, new Transform({ transform(chunk: Buffer, _encoding, done) {
      size += chunk.length;
      if (size > CHAT_FILE_LIMIT) { done(new ApiError(413, "attachment_too_large", "Maximum file size is 200 MB")); return; }
      if (prefix.length < 8) prefix = Buffer.concat([prefix, chunk.subarray(0, 8-prefix.length)]);
      if (input.mime === "text/plain" && chunk.includes(0)) binaryText = true;
      done(null, chunk);
    } }), createWriteStream(file, { flags: "wx", mode: 0o600 }));
    if (size !== declaredSize) throw new ApiError(400, "invalid_attachment", "Incomplete file upload");
    if (input.kind !== "file") return await uploadChatAttachmentBuffer(userId, input, await readFile(file));
    const mime = ["application/pdf", "text/plain"].includes(input.mime) ? input.mime : "application/octet-stream";
    if ((mime === "application/pdf" && prefix.subarray(0,5).toString() !== "%PDF-") || (mime === "text/plain" && binaryText))
      throw new ApiError(400, "invalid_attachment", "Invalid file content");
    const name = input.name.replace(/[\\/\r\n\x00-\x1f]/g, "_").slice(0,180);
    const item = await ChatAttachment.create({ ownerId: userId, name, mime, kind: "file", size, storageKey });
    keep = true;
    return { id: String(item._id), name, kind: "file", size };
  } finally {
    active--;
    if (!keep) await unlink(file).catch(() => {});
  }
}
