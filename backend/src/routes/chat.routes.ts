import { Router } from "express";
import { z } from "zod";
import { rateLimit } from "express-rate-limit";
import { validateBody } from "../middleware/validate.js";
import { ApiError } from "../lib/api-error.js";
import { User } from "../models/User.js";
import { ChatBlock } from "../models/Chat.js";
import * as chat from "../services/chat.service.js";
const id = z.string().regex(/^[a-f\d]{24}$/i);
const parseId = (value: unknown) => {
  const parsed = id.safeParse(value);
  if (!parsed.success) throw new ApiError(400, "invalid_id", "Invalid ID");
  return parsed.data;
};
export const chatMediaRoutes = Router();
chatMediaRoutes.get("/media/:id", async (req, res) => {
  const attachmentId = parseId(req.params.id),
    userId = parseId(req.query.u);
  const session = parseId(req.query.s),
    signature = z.string().max(100).parse(req.query.t);
  const value = await chat.readChatAttachment(
    attachmentId,
    userId,
    session,
    Number(req.query.e),
    signature,
  );
  res.set({
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Content-Disposition": `${value.mime.startsWith("image/") || value.mime.startsWith("audio/") ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(value.name)}`,
  });
  res.type(value.mime).send(value.bytes);
});
const router = Router();
const writeLimiter = rateLimit({
  windowMs: 60_000,
  limit: 45,
  keyGenerator: (req) => String(req.auth!.userId),
  standardHeaders: true,
  legacyHeaders: false,
});
const uploadLimiter = rateLimit({
  windowMs: 3600_000,
  limit: 40,
  keyGenerator: (req) => String(req.auth!.userId),
  standardHeaders: true,
  legacyHeaders: false,
});
router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
router.get("/", async (req, res) =>
  res.json({
    data: {
      chats: await chat.listChats(req.auth!.userId, req.auth!.sessionId!),
    },
  }),
);
router.get("/search", async (req, res) =>
  res.json({
    data: await chat.searchChats(
      req.auth!.userId,
      z
        .string()
        .max(80)
        .parse(req.query.q ?? ""),
    ),
  }),
);
router.get("/directory", async(req,res)=>res.json({data:await chat.listFriendDirectory(req.auth!.userId,z.string().max(80).parse(req.query.q??""),req.query.cursor?parseId(req.query.cursor):undefined)}));
router.get("/friends", async(req,res)=>res.json({data:await chat.listFriends(req.auth!.userId,z.string().max(100).parse(req.query.q ?? ""))}));
router.get("/friend-requests", async (req,res)=>res.json({data:await chat.listFriendRequests(req.auth!.userId)}));
router.post("/users/:id/friend-request", writeLimiter, async(req,res)=>res.json({data:await chat.requestFriend(req.auth!.userId,parseId(req.params.id))}));
router.post("/users/:id/friend-answer", writeLimiter, validateBody(z.object({accept:z.boolean()}).strict()), async(req,res)=>res.json({data:await chat.answerFriend(req.auth!.userId,parseId(req.params.id),req.body.accept)}));
router.get("/users/:id", async (req, res) => {
  const userId = parseId(req.params.id),
    user = await User.findById(userId)
      .select("name username avatarUrl referralCode coins wallet countryCode")
      .lean();
  if (!user) throw new ApiError(404, "user_not_found", "User not found");
  res.json({
    data: {
      ...chat.chatProfile(user),
      friendship: await chat.friendshipStatus(req.auth!.userId, userId),
      countryCode: user.countryCode,
      coinBalance: user.coins.balance,
      balanceUnits: user.wallet.availableUnits,
      blocked: Boolean(
        await ChatBlock.exists({ userId: req.auth!.userId, blockedId: userId }),
      ),
    },
  });
});
router.put(
  "/username",
  writeLimiter,
  validateBody(z.object({ username: z.string().max(30) }).strict()),
  async (req, res) =>
    res.json({
      data: await chat.updateUsername(req.auth!.userId, req.body.username),
    }),
);
router.post(
  "/direct",
  writeLimiter,
  validateBody(z.object({ userId: id }).strict()),
  async (req, res) =>
    res.json({
      data: await chat.createDirect(req.auth!.userId, req.body.userId),
    }),
);
router.post(
  "/rooms",
  writeLimiter,
  validateBody(
    z
      .object({
        kind: z.enum(["group", "channel"]),
        title: z.string().trim().min(1).max(100),
        description: z.string().max(1000).default(""),
        visibility: z.enum(["public", "invite"]).default("invite"),
        username: z.string().trim().max(25).optional(),
      })
      .strict(),
  ),
  async (req, res) =>
    res.json({ data: await chat.createRoom(req.auth!.userId, req.body) }),
);
router.post(
  "/join",
  writeLimiter,
  validateBody(
    z.object({ code: z.string().regex(/^[A-Za-z0-9_-]{24}$/) }).strict(),
  ),
  async (req, res) =>
    res.json({ data: await chat.joinRoom(req.auth!.userId, req.body.code) }),
);
router.post(
  "/attachments",
  uploadLimiter,
  validateBody(
    z
      .object({
        name: z.string().min(1).max(180),
        mime: z.string().max(100),
        kind: z.enum(["photo", "file", "voice"]),
        base64: z.string().max(11_184_812),
      })
      .strict(),
  ),
  async (req, res) =>
    res.json({
      data: await chat.uploadChatAttachment(req.auth!.userId, req.body),
    }),
);
router.post("/messages/:id/listen", writeLimiter, async (req, res) => {
  res.json({ data: await chat.markVoiceListened(req.auth!.userId, parseId(req.params.id)) });
});
router.get("/:id/messages", async (req, res) => {
  const before =
      req.query.before === undefined
        ? undefined
        : z.coerce.number().int().positive().parse(req.query.before),
    q =
      req.query.q === undefined
        ? undefined
        : z.string().trim().min(1).max(100).parse(req.query.q);
  res.json({
    data: await chat.listMessages(
      req.auth!.userId,
      req.auth!.sessionId!,
      parseId(req.params.id),
      before,
      q,
    ),
  });
});
router.patch("/:id/theme", writeLimiter, validateBody(z.object({
  preset: z.enum(["system", "green", "blue", "pink", "graphite", "custom"]),
  wallpaperAttachmentId: id.optional(),
}).strict()), async (req, res) => {
  res.json({ data: await chat.setChatTheme(req.auth!.userId, parseId(req.params.id), req.body) });
});
router.patch(
  "/:id",
  writeLimiter,
  validateBody(
    z
      .object({
        title: z.string().trim().min(1).max(100),
        description: z.string().max(1000),
        avatarAttachmentId: id.optional(),
        username: z.string().trim().max(25).optional(),
        visibility: z.enum(["public", "invite"]).optional(),
      })
      .strict(),
  ),
  async (req, res) =>
    res.json({
      data: await chat.updateChatRoom(
        req.auth!.userId,
        parseId(req.params.id),
        req.body,
      ),
    }),
);
router.post(
  "/:id/members",
  writeLimiter,
  validateBody(z.object({ userId: id }).strict()),
  async (req, res) =>
    res.json({
      data: await chat.addChatMember(
        req.auth!.userId,
        parseId(req.params.id),
        req.body.userId,
      ),
    }),
);
router.get("/:id/members", async (req, res) =>
  res.json({
    data: await chat.chatMembers(req.auth!.userId, parseId(req.params.id)),
  }),
);
router.post(
  "/:id/messages",
  writeLimiter,
  validateBody(
    z
      .object({
        clientId: z.string().min(8).max(100),
        text: z.string().max(4000).default(""),
        attachmentIds: z.array(id).max(4).default([]),
        replyTo: id.optional(),
        forwardId: id.optional(),
      })
      .strict(),
  ),
  async (req, res) =>
    res.json({
      data: await chat.sendChatMessage(
        req.auth!.userId,
        parseId(req.params.id),
        req.body,
      ),
    }),
);
router.patch(
  "/messages/:id",
  writeLimiter,
  validateBody(
    z
      .object({
        text: z.string().trim().min(1).max(4000).optional(),
        remove: z.enum(["self", "all"]).optional(),
        emoji: z.enum(["", "👍", "❤️", "😂", "🔥", "🎉", "😢"]).optional(),
        pinned: z.boolean().optional(),
        report: z.string().trim().min(1).max(500).optional(),
      })
      .strict()
      .refine((body) => Object.keys(body).length === 1),
  ),
  async (req, res) =>
    res.json({
      data: await chat.changeMessage(
        req.auth!.userId,
        parseId(req.params.id),
        req.body,
      ),
    }),
);
router.patch(
  "/:id/member",
  writeLimiter,
  validateBody(
    z
      .object({
        muted: z.boolean().optional(),
        pinned: z.boolean().optional(),
        readSeq: z.number().int().nonnegative().optional(),
        leave: z.boolean().optional(),
        targetId: id.optional(),
        role: z.enum(["admin", "member"]).optional(),
        canEditInfo: z.boolean().optional(),
        remove: z.boolean().optional(),
      })
      .strict()
      .refine(
        (body) =>
          body.targetId
            ? [body.role, body.remove, body.canEditInfo].filter(
                (v) => v !== undefined,
              ).length === 1 &&
              [body.muted, body.pinned, body.readSeq, body.leave].every(
                (v) => v === undefined,
              )
            : [body.role, body.remove, body.canEditInfo].every(
                (v) => v === undefined,
              ),
        "Invalid membership action",
      ),
  ),
  async (req, res) =>
    res.json({
      data: await chat.updateChatMember(
        req.auth!.userId,
        parseId(req.params.id),
        req.body,
      ),
    }),
);
router.put(
  "/users/:id/block",
  writeLimiter,
  validateBody(z.object({ blocked: z.boolean() }).strict()),
  async (req, res) =>
    res.json({
      data: await chat.blockChatUser(
        req.auth!.userId,
        parseId(req.params.id),
        req.body.blocked,
      ),
    }),
);
export default router;
