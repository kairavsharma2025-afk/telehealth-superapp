import { envInt, optionalEnv, requireEnv } from "@telehealth/shared";

export const config = {
  nodeEnv: optionalEnv("NODE_ENV", "development"),
  port: envInt("PORT", envInt("NOTIFICATION_PORT", 4005)),
  databaseUrl: requireEnv("DATABASE_URL"),
  jwtAccessSecret: requireEnv("JWT_ACCESS_SECRET"),
  providers: {
    sesFromEmail: optionalEnv("SES_FROM_EMAIL", ""),
    twilioAccountSid: optionalEnv("TWILIO_ACCOUNT_SID", ""),
    twilioAuthToken: optionalEnv("TWILIO_AUTH_TOKEN", ""),
    fcmServerKey: optionalEnv("FCM_SERVER_KEY", ""),
  },
  // Test hook: when present, providers reject sends matching this template.
  // Lets the smoke test exercise the failed -> retry path without yanking
  // the network or polluting the API.
  forceFailTemplate: optionalEnv("NOTIFICATION_FORCE_FAIL_TEMPLATE", ""),
} as const;

export type Config = typeof config;
