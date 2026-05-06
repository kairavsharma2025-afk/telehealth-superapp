import jwt, { type SignOptions, type JwtPayload as JwtLibPayload } from "jsonwebtoken";
import { ServiceError, type UserRole, isUserRole } from "@telehealth/shared";
import { config } from "../config.js";

export interface AccessClaims {
  sub: string;
  role: UserRole;
}

export interface RefreshClaims {
  sub: string;
}

export function signAccessToken(claims: AccessClaims): string {
  return jwt.sign(claims, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessTtl,
  } as SignOptions);
}

export function signRefreshToken(claims: RefreshClaims): string {
  return jwt.sign(claims, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshTtl,
  } as SignOptions);
}

export function verifyAccessToken(token: string): AccessClaims & JwtLibPayload {
  let decoded: unknown;
  try {
    decoded = jwt.verify(token, config.jwt.accessSecret);
  } catch {
    throw new ServiceError("UNAUTHORIZED", "Invalid or expired access token");
  }
  if (!isAccessClaims(decoded)) {
    throw new ServiceError("UNAUTHORIZED", "Malformed access token");
  }
  return decoded;
}

export function verifyRefreshToken(token: string): RefreshClaims & JwtLibPayload {
  let decoded: unknown;
  try {
    decoded = jwt.verify(token, config.jwt.refreshSecret);
  } catch {
    throw new ServiceError("UNAUTHORIZED", "Invalid or expired refresh token");
  }
  if (!isRefreshClaims(decoded)) {
    throw new ServiceError("UNAUTHORIZED", "Malformed refresh token");
  }
  return decoded;
}

function isAccessClaims(v: unknown): v is AccessClaims & JwtLibPayload {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o["sub"] === "string" && isUserRole(o["role"]);
}

function isRefreshClaims(v: unknown): v is RefreshClaims & JwtLibPayload {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o["sub"] === "string";
}
