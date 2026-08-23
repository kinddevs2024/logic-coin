import "dotenv/config";

import bcrypt from "bcryptjs";
import mongoose from "mongoose";

import { normalizeEmail } from "../src/lib/crypto.js";
import { User } from "../src/models/User.js";
import { createUser } from "../src/services/user.service.js";

const email = normalizeEmail(process.env.ADMIN_ACCOUNT_EMAIL ?? "");
const password = process.env.ADMIN_ACCOUNT_PASSWORD ?? "";
const mongoUri = process.env.MONGODB_URI ?? process.env.MONGODB_SYNC_TARGET_URI;

if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
  throw new Error("ADMIN_ACCOUNT_EMAIL must be a valid email address");
}
if (password.length < 8 || password.length > 72) {
  throw new Error("ADMIN_ACCOUNT_PASSWORD must contain 8 to 72 characters");
}
if (!mongoUri) {
  throw new Error("MONGODB_URI or MONGODB_SYNC_TARGET_URI is required");
}

async function main() {
  await mongoose.connect(mongoUri!);
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const existing = await User.findOne({ email });
    if (existing) {
      await User.updateOne(
        { _id: existing._id },
        {
          $set: {
            passwordHash,
            role: "admin",
            emailVerifiedAt: existing.emailVerifiedAt ?? new Date()
          },
          $unset: { registrationTokenHash: 1, registrationTokenExpiresAt: 1 }
        }
      );
    } else {
      const user = await createUser({
        email,
        name: "Logic Coin Admin",
        passwordHash,
        emailVerifiedAt: new Date()
      });
      await User.updateOne({ _id: user._id }, { $set: { role: "admin" } });
    }
    console.log("Administrator account provisioned");
  } finally {
    await mongoose.disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Administrator provisioning failed");
  process.exitCode = 1;
});
