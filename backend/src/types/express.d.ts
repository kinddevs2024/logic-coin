import type { Types } from "mongoose";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: Types.ObjectId;
        sessionId?: string;
      };
      adminAuth?: {
        subject: "password-admin";
        tokenId?: string;
      };
      requestId: string;
    }
  }
}

export {};
