import mongoose from "mongoose";
import { env } from "./env.js";

let connectionPromise: Promise<typeof mongoose> | null = null;
let seedPromise: Promise<void> | null = null;

mongoose.set("strictQuery", true);

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (!env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured");
  }

  connectionPromise ??= mongoose
    .connect(env.MONGODB_URI, {
      maxPoolSize: 10,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 5_000,
      socketTimeoutMS: 20_000,
      autoIndex: env.MONGODB_AUTO_INDEX
    })
    .catch((error: unknown) => {
      connectionPromise = null;
      throw error;
    });

  const connection = await connectionPromise;
  seedPromise ??= import("../services/task-seed.service.js")
    .then(({ seedDefaultTasks }) => seedDefaultTasks())
    .catch((error: unknown) => {
      seedPromise = null;
      throw error;
    });
  await seedPromise;

  return connection;
}

export function databaseState(): string {
  switch (mongoose.connection.readyState) {
    case 0:
      return "disconnected";
    case 1:
      return "connected";
    case 2:
      return "connecting";
    case 3:
      return "disconnecting";
    default:
      return "unknown";
  }
}
