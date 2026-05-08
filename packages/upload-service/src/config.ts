import { envInt, optionalEnv, requireEnv } from "@telehealth/shared";

const PRESIGN_PUT_SECONDS_DEFAULT = 300;
const PRESIGN_GET_SECONDS_DEFAULT = 600;
const MAX_UPLOAD_BYTES_DEFAULT = 10 * 1024 * 1024;

export const config = {
  nodeEnv: optionalEnv("NODE_ENV", "development"),
  port: envInt("PORT", envInt("UPLOAD_PORT", 4004)),
  databaseUrl: requireEnv("DATABASE_URL"),
  jwtAccessSecret: requireEnv("JWT_ACCESS_SECRET"),
  s3: {
    endpoint: requireEnv("S3_ENDPOINT"),
    publicEndpoint: optionalEnv("S3_PUBLIC_ENDPOINT", requireEnv("S3_ENDPOINT")),
    region: optionalEnv("S3_REGION", "ap-south-1"),
    bucket: requireEnv("S3_BUCKET"),
    accessKeyId: requireEnv("S3_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("S3_SECRET_ACCESS_KEY"),
    forcePathStyle: optionalEnv("S3_FORCE_PATH_STYLE", "true").toLowerCase() === "true",
  },
  presignPutSeconds: envInt("UPLOAD_PRESIGN_PUT_SECONDS", PRESIGN_PUT_SECONDS_DEFAULT),
  presignGetSeconds: envInt("UPLOAD_PRESIGN_GET_SECONDS", PRESIGN_GET_SECONDS_DEFAULT),
  maxUploadBytes: envInt("UPLOAD_MAX_BYTES", MAX_UPLOAD_BYTES_DEFAULT),
} as const;

export type Config = typeof config;
