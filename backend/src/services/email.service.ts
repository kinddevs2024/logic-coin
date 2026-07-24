import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config/env.js";
import { ApiError } from "../lib/api-error.js";

let transporter: Transporter | null = null;

function emailTransporter(): Transporter {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS || !env.EMAIL_FROM) {
    throw new ApiError(503, "email_not_configured", "Email delivery is not configured");
  }
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS
    }
  });
  return transporter;
}

export async function sendVerificationCode(email: string, code: string): Promise<"sent" | "disabled"> {
  if (!env.EMAIL_ENABLED) {
    return "disabled";
  }

  try {
    await emailTransporter().sendMail({
      from: env.EMAIL_FROM,
      to: email,
      subject: "Logic Coin — email verification code",
      text: `Your Logic Coin verification code is ${code}. It expires in ${env.OTP_TTL_MINUTES} minutes.`,
      html: `<p>Your Logic Coin verification code:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>It expires in ${env.OTP_TTL_MINUTES} minutes.</p>`
    });
    return "sent";
  } catch {
    throw new ApiError(502, "email_delivery_failed", "Could not send the verification email");
  }
}
