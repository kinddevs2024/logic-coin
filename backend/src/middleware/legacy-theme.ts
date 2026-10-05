import type { RequestHandler } from "express";

type JsonObject = Record<string, unknown>;
function object(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Old APKs index themes[preference] without supporting the newer `auto` value.
 * Adapt only the response: never overwrite the account's saved preference.
 */
export function legacyThemePayload(body: unknown): unknown {
  if (!object(body) || !object(body.data)) return body;
  const data = { ...body.data };
  const compatible = (preferences: unknown) => {
    if (!object(preferences)) return preferences;
    if (["light", "sky", "dark"].includes(String(preferences.theme))) return preferences;
    // /me/preferences returns a Mongoose subdocument, not always a POJO.
    const plain: unknown = typeof preferences.toJSON === "function"
      ? preferences.toJSON()
      : preferences;
    return { ...(object(plain) ? plain : {}), theme: "sky" };
  };
  if (object(data.user) && object(data.user.preferences)) {
    data.user = { ...data.user, preferences: compatible(data.user.preferences) };
  }
  if (object(data.preferences)) data.preferences = compatible(data.preferences);
  return { ...body, data };
}

export const legacyThemeCompatibility: RequestHandler = (request, response, next) => {
  // Native fetch has no browser Origin/Fetch Metadata. Unknown clients receive
  // the conservative legacy representation; modern web keeps automatic themes.
  // This is presentation negotiation only, never an authentication decision.
  const native = /okhttp|CFNetwork|Dalvik/i.test(request.get("user-agent") ?? "");
  const browser = !native && Boolean(request.get("origin") || request.get("sec-fetch-mode"));
  response.vary("Origin");
  response.vary("Sec-Fetch-Mode");
  response.vary("User-Agent");
  if (!browser) {
    const json = response.json.bind(response);
    response.json = (body: unknown) => json(legacyThemePayload(body));
  }
  next();
};
