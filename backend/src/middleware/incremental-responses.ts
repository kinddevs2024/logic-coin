import { createHash } from "node:crypto";
import type { RequestHandler } from "express";

const READ = /^\/(bootstrap|home|games|challenges\/(today|rules)|wallet|activity|leaderboard|notifications|chat|tasks|bonuses|referrals|me)(?:\/|\?|$)/;

/** Opt-in private revalidation, always after authentication and the route handler. */
export const incrementalResponses: RequestHandler = (req, res, next) => {
  if (req.method !== "GET" || req.get("X-Data-Cache-Version") !== "1" || !READ.test(req.url)) return next();
  const send = res.json.bind(res);
  res.json = (body: unknown) => {
    if (res.statusCode !== 200 || !req.auth) return send(body);
    const value = body as { data?: Record<string, unknown> } | null;
    const stable = value?.data && typeof value.data.serverNow === "string"
      ? { ...value, data: { ...value.data, serverNow: undefined } } : body;
    const digest = createHash("sha256").update(JSON.stringify(["v1", req.auth.userId, req.get("Accept-Language"), req.get("X-Appearance-Version"), stable])).digest("base64url");
    const etag = `W/"data-v1-${digest}"`;
    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "private, no-cache");
    res.setHeader("X-Data-Cache-Version", "1");
    res.setHeader("X-Server-Time", new Date().toISOString());
    res.vary("X-Data-Cache-Version");
    res.vary("Accept-Language");
    // Some fetch implementations add Cache-Control: no-cache to conditional
    // requests. We have already revalidated by running the authenticated handler.
    const validators = (req.get("If-None-Match") ?? "").split(",").map(tag => tag.trim().replace(/^W\//, ""));
    if (validators.includes(etag.replace(/^W\//, ""))) return res.status(304).end();
    return send(body);
  };
  next();
};
