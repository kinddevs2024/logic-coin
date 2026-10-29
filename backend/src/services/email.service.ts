import type { CopyLanguage } from "../lib/localize-built-in.js";
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
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS
    }
  });
  return transporter;
}

export async function sendVerificationCode(email: string, code: string, language: CopyLanguage = "ru"): Promise<"sent" | "disabled"> {
  if (!env.EMAIL_ENABLED) {
    return "disabled";
  }

  const copy = {
    ru: { subject: "Logic Coin — код подтверждения", label: "Ваш код подтверждения Logic Coin:", expires: `Срок действия: ${env.OTP_TTL_MINUTES} мин.` },
    en: { subject: "Logic Coin — email verification code", label: "Your Logic Coin verification code:", expires: `It expires in ${env.OTP_TTL_MINUTES} minutes.` },
    uz: { subject: "Logic Coin — tasdiqlash kodi", label: "Logic Coin tasdiqlash kodingiz:", expires: `Kod ${env.OTP_TTL_MINUTES} daqiqa amal qiladi.` },
  }[language];
  try {
    await emailTransporter().sendMail({
      from: env.EMAIL_FROM,
      to: email,
      subject: copy.subject,
      text: `${copy.label} ${code}. ${copy.expires}`,
      html: `<p>${copy.label}</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>${copy.expires}</p>`
    });
    return "sent";
  } catch (error) {
    const smtp = error as { code?: string; responseCode?: number; response?: string };
    // Do not log recipient addresses, credentials, verification codes or raw SMTP responses.
    console.error("email_delivery_failed", { code: smtp.code, responseCode: smtp.responseCode });
    if (/5\.4\.5|daily.*sending limit exceeded/i.test(smtp.response ?? "")) {
      throw new ApiError(503, "email_provider_limit", "Отправка писем временно недоступна: исчерпан лимит почтового сервиса. Войдите через Google или Telegram либо попробуйте позже.");
    }
    throw new ApiError(502, "email_delivery_failed", "Could not send the verification email");
  }
}
