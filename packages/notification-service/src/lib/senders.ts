import { ServiceError } from "@telehealth/shared";
import { config } from "../config.js";
import { logger } from "../logger.js";
import type { Channel } from "./validation.js";

export interface Recipient {
  userId: string;
  email: string | null;
  phone: string | null;
}

// Each sender either logs (dev stub when provider env unset) or — once Phase 7
// wires real SES/Twilio/FCM — calls the provider. Throws on failure so the
// caller can record `failed` + error_message.
export async function dispatch(
  channel: Channel,
  recipient: Recipient,
  template: string,
  payload: Record<string, unknown>,
): Promise<void> {
  if (config.forceFailTemplate && template === config.forceFailTemplate) {
    throw new Error(`forced failure for template '${template}' (test hook)`);
  }

  if (channel === "email") return sendEmail(recipient, template, payload);
  if (channel === "sms") return sendSms(recipient, template, payload);
  if (channel === "push") return sendPush(recipient, template, payload);
  throw new Error(`Unknown channel: ${channel as string}`);
}

async function sendEmail(
  to: Recipient,
  template: string,
  payload: Record<string, unknown>,
): Promise<void> {
  if (!to.email) throw new ServiceError("BAD_REQUEST", "Recipient has no email on file");
  if (!config.providers.sesFromEmail) {
    logger.info({ channel: "email", to: to.email, template, payload }, "stub send");
    return;
  }
  // Phase 7 will wire @aws-sdk/client-sesv2 here.
  throw new Error("SES provider not yet implemented");
}

async function sendSms(
  to: Recipient,
  template: string,
  payload: Record<string, unknown>,
): Promise<void> {
  if (!to.phone) throw new ServiceError("BAD_REQUEST", "Recipient has no phone on file");
  if (!config.providers.twilioAccountSid) {
    logger.info({ channel: "sms", to: to.phone, template, payload }, "stub send");
    return;
  }
  throw new Error("Twilio provider not yet implemented");
}

async function sendPush(
  to: Recipient,
  template: string,
  payload: Record<string, unknown>,
): Promise<void> {
  if (!config.providers.fcmServerKey) {
    logger.info({ channel: "push", to: to.userId, template, payload }, "stub send");
    return;
  }
  throw new Error("FCM provider not yet implemented");
}
