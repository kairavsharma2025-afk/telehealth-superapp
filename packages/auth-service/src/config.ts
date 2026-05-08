import { envInt, optionalEnv, requireEnv } from "@telehealth/shared";

export const config = {
  nodeEnv: optionalEnv("NODE_ENV", "development"),
  port: envInt("PORT", envInt("AUTH_PORT", 4001)),
  databaseUrl: requireEnv("DATABASE_URL"),
  jwt: {
    accessSecret: requireEnv("JWT_ACCESS_SECRET"),
    refreshSecret: requireEnv("JWT_REFRESH_SECRET"),
    accessTtl: optionalEnv("JWT_ACCESS_TTL", "15m"),
    refreshTtl: optionalEnv("JWT_REFRESH_TTL", "30d"),
  },
} as const;

export type Config = typeof config;
