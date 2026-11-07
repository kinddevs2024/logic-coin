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
  private readonly reservations = new Map<string, {
    clientHash: string; next: number; end: number; resetAt: Date; pending?: Promise<void>;
  }>();

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
    // Reserve disjoint small ranges atomically in MongoDB. Only the global
    // traffic limiter batches writes; auth/OTP/reward/withdrawal remain exact
    // single-increment stores. Reservations are never reused after reset.
    if (this.namespace === "global") return this.incrementReserved(key);
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

  private async incrementReserved(key: string): Promise<ClientRateLimitInfo> {
    const current = this.currentKey(key);
    let entry = this.reservations.get(current.id);
    if (!entry) {
      if (this.reservations.size >= 8_192) this.reservations.delete(this.reservations.keys().next().value!);
      entry = { clientHash: current.clientHash, next: 1, end: 0, resetAt: current.resetAt };
      this.reservations.set(current.id, entry);
    }
    for (;;) {
      if (entry.next <= entry.end) return { totalHits: entry.next++, resetTime: entry.resetAt };
      if (!entry.pending) {
        const reservation = entry;
        entry.pending = (async () => {
          await connectToDatabase();
          const counter = await RateLimitCounter.findOneAndUpdate({ _id: current.id }, {
            $inc: { totalHits: 5 },
            $setOnInsert: { namespace: this.namespace, clientHash: current.clientHash, resetAt: current.resetAt },
          }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
          if (!counter) throw new Error("Rate-limit reservation failed");
          reservation.next = counter.totalHits - 4;
          reservation.end = counter.totalHits;
        })().finally(() => { delete reservation.pending; });
      }
      try { await entry.pending; }
      catch (error) { if (this.reservations.get(current.id) === entry) this.reservations.delete(current.id); throw error; }
    }
  }

  async decrement(key: string): Promise<void> {
    await connectToDatabase();
    const current = this.currentKey(key);
    this.reservations.delete(current.id);
    await RateLimitCounter.updateOne(
      { _id: current.id },
      [{ $set: { totalHits: { $max: [0, { $subtract: ["$totalHits", 1] }] } } }]
    );
  }

  async resetKey(key: string): Promise<void> {
    const clientHash = sha256(key);
    for (const [id, value] of this.reservations) if (value.clientHash === clientHash) this.reservations.delete(id);
    await connectToDatabase();
    await RateLimitCounter.deleteMany({
      namespace: this.namespace,
      clientHash: sha256(key)
    });
  }

  async resetAll(): Promise<void> {
    this.reservations.clear();
    await connectToDatabase();
    await RateLimitCounter.deleteMany({ namespace: this.namespace });
  }
}
