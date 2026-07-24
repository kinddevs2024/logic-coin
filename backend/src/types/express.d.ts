import type { Types } from "mongoose";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: Types.ObjectId;
        sessionId?: string;
      };
      requestId: string;
    }
  }
}

export {};
