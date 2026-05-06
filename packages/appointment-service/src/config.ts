import { envInt, optionalEnv, requireEnv } from "@telehealth/shared";

export const config = {
  nodeEnv: optionalEnv("NODE_ENV", "development"),
  port: envInt("APPOINTMENT_PORT", 4003),
  databaseUrl: requireEnv("DATABASE_URL"),
  jwtAccessSecret: requireEnv("JWT_ACCESS_SECRET"),
} as const;

export type Config = typeof config;
