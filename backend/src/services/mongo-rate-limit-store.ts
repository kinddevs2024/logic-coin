import { createHash } from "node:crypto";
import type { ClientRateLimitInfo, Store } from "express-rate-limit";
import { connectToDatabase } from "../config/database.js";
import { RateLimitCounter } from "../models/RateLimitCounter.js";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Fixed-window rate-limit storage shared by all serverless instances.
 * Raw client identifiers (including IP addresses) are never persisted.
 */
export class MongoRateLimitStore implements Store {
  readonly localKeys = false;
  readonly prefix: string;

  constructor(
    private readonly namespace: string,
    private readonly windowMs: number
  ) {
    this.prefix = `${namespace}:`;
  }

  private currentKey(key: string, now = Date.now()) {
    const clientHash = sha256(key);
    const bucket = Math.floor(now / this.windowMs);
    return {
      id: sha256(`${this.namespace}:${bucket}:${clientHash}`),
      clientHash,
      resetAt: new Date((bucket + 1) * this.windowMs)
    };
  }

  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    await connectToDatabase();
    const current = this.currentKey(key);
    const counter = await RateLimitCounter.findById(current.id).lean();
    if (!counter) return undefined;
    return { totalHits: counter.totalHits, resetTime: counter.resetAt };
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    await connectToDatabase();
    const current = this.currentKey(key);
    const counter = await RateLimitCounter.findOneAndUpdate(
      { _id: current.id },
      {
        $inc: { totalHits: 1 },
        $setOnInsert: {
          namespace: this.namespace,
          clientHash: current.clientHash,
          resetAt: current.resetAt
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    if (!counter) {
      throw new Error("Rate-limit counter could not be updated");
    }
    return { totalHits: counter.totalHits, resetTime: counter.resetAt };
  }

  async decrement(key: string): Promise<void> {
    await connectToDatabase();
    const current = this.currentKey(key);
    await RateLimitCounter.updateOne(
      { _id: current.id },
      [{ $set: { totalHits: { $max: [0, { $subtract: ["$totalHits", 1] }] } } }]
    );
  }

  async resetKey(key: string): Promise<void> {
    await connectToDatabase();
    await RateLimitCounter.deleteMany({
      namespace: this.namespace,
      clientHash: sha256(key)
    });
  }

  async resetAll(): Promise<void> {
    await connectToDatabase();
    await RateLimitCounter.deleteMany({ namespace: this.namespace });
  }
}
