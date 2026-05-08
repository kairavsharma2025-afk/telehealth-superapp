import { envInt, optionalEnv, requireEnv } from "@telehealth/shared";

export const config = {
  nodeEnv: optionalEnv("NODE_ENV", "development"),
  port: envInt("PORT", envInt("GATEWAY_PORT", 4000)),
  jwtAccessSecret: requireEnv("JWT_ACCESS_SECRET"),
  upstreams: {
    auth: optionalEnv("AUTH_URL", `http://localhost:${envInt("AUTH_PORT", 4001)}`),
    user: optionalEnv("USER_URL", `http://localhost:${envInt("USER_PORT", 4002)}`),
    appointment: optionalEnv(
      "APPOINTMENT_URL",
      `http://localhost:${envInt("APPOINTMENT_PORT", 4003)}`,
    ),
    upload: optionalEnv("UPLOAD_URL", `http://localhost:${envInt("UPLOAD_PORT", 4004)}`),
    notification: optionalEnv(
      "NOTIFICATION_URL",
      `http://localhost:${envInt("NOTIFICATION_PORT", 4005)}`,
    ),
  },
} as const;

export type Config = typeof config;
