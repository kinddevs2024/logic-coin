import type { Request, Response, NextFunction } from "express";
import { performance, monitorEventLoopDelay } from "node:perf_hooks";
import { createRequire } from "node:module";
import { invalidateReadCache } from "../lib/read-cache.js";

const bounds = [5, 10, 25, 50, 100, 250, 500, 1_000, 2_500, 5_000, Infinity];
const categories = new Set(["auth", "me", "bootstrap", "home", "tasks", "wallet", "activity", "bonuses", "referrals", "withdrawals", "devices", "games", "challenges", "gifts", "leaderboard", "notifications", "admin", "avatars", "health", "share", "profile"]);
const metrics = new Map<string, { count: number; errors: number; clientErrors: number; rateLimited: number; totalMs: number; buckets: number[] }>();
const sampledTraces = new Map<string, { durationMs: number; status: number; traceId: string }>();
let tracer: { startSpan: (name: string, options: object) => { end: () => void } } | undefined;
// SDK lives outside the mobile workspace: adding backend telemetry must not
// change an installed Android application's native dependency fingerprint.
if (process.env.NODE_ENV !== "test") {
  try {
    const requireTelemetry = createRequire(process.env.OBSERVABILITY_PACKAGE ?? "/srv/apps/logic-coin/shared/observability/package.json");
    const { BasicTracerProvider, TraceIdRatioBasedSampler } = requireTelemetry("@opentelemetry/sdk-trace-base");
    const provider = new BasicTracerProvider({ sampler: new TraceIdRatioBasedSampler(0.05), spanProcessors: [{
      onStart() {},
      onEnd(span: { name: string; duration: [number, number]; attributes: Record<string, number>; spanContext: () => { traceId: string } }) {
        sampledTraces.set(span.name, { durationMs: Math.round(span.duration[0] * 1_000 + span.duration[1] / 1e6), status: span.attributes["http.response.status_code"] ?? 0, traceId: span.spanContext().traceId });
      },
      shutdown: async () => {}, forceFlush: async () => {},
    }] });
    tracer = provider.getTracer("logic-coin-api");
  } catch { console.warn("Backend telemetry SDK unavailable; bounded request metrics remain enabled"); }
  const lag = monitorEventLoopDelay({ resolution: 20 });
  lag.enable();
  setInterval(() => {
    const routes = [...metrics].map(([route, value]) => {
      const threshold = Math.ceil(value.count * 0.95); let accumulated = 0;
      const percentile = bounds.find((_, index) => { accumulated += value.buckets[index]!; return accumulated >= threshold; });
      return { route, count: value.count, errors: value.errors, clientErrors: value.clientErrors, rateLimited: value.rateLimited, averageMs: Math.round(value.totalMs / value.count), p95UpperMs: Number.isFinite(percentile) ? percentile : ">5000" };
    });
    console.log(JSON.stringify({ type: "api-performance", windowSeconds: 60, routes, sampledTraces: Object.fromEntries(sampledTraces), eventLoopP95Ms: Math.round(lag.percentile(95) / 1e6) }));
    metrics.clear(); sampledTraces.clear(); lag.reset();
  }, 60_000).unref();
}

export function recordPerformance(request: Request, response: Response, next: NextFunction) {
  const start = performance.now(); const startedAt = Date.now();
  response.once("finish", () => {
    const category = request.originalUrl.split("?")[0]?.split("/")[3] ?? "other";
    const route = categories.has(category) ? category : "other";
    const key = `${request.method} ${route}`; const elapsed = performance.now() - start;
    const metric = metrics.get(key) ?? { count: 0, errors: 0, clientErrors: 0, rateLimited: 0, totalMs: 0, buckets: bounds.map(() => 0) };
    metric.count++; metric.errors += response.statusCode >= 500 ? 1 : 0; metric.totalMs += elapsed;
    metric.clientErrors += response.statusCode >= 400 && response.statusCode < 500 ? 1 : 0;
    metric.rateLimited += response.statusCode === 429 ? 1 : 0;
    const bucket = bounds.findIndex(bound => elapsed <= bound); metric.buckets[Math.max(0, bucket)]!++;
    metrics.set(key, metric);
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method) && response.statusCode < 400) invalidateReadCache();
    tracer?.startSpan(key, { startTime: startedAt, attributes: { "http.response.status_code": response.statusCode, "http.route": route, "http.duration_ms": elapsed } }).end();
  });
  next();
}
