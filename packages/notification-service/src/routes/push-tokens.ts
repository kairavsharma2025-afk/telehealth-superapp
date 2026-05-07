import { Router } from "express";
import { z } from "zod";
import { ServiceError } from "@telehealth/shared";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, parseBody } from "../lib/http.js";

// /notifications/push-tokens — per-device delivery endpoints.
// The mobile app calls this on every cold start (cheap because of UPSERT),
// so the same row stays current as last_seen_at advances. Token uniqueness
// is global; on conflict we re-bind to whichever user is currently signed
// in on that device.

export const pushTokensRouter: Router = Router();
pushTokensRouter.use(requireAuth);

const registerSchema = z.object({
  token: z.string().min(8).max(2048),
  platform: z.enum(["ios", "android", "web"]),
});

const deleteSchema = z.object({
  token: z.string().min(8).max(2048),
});

interface PushTokenRow {
  id: string;
  user_id: string;
  token: string;
  platform: "ios" | "android" | "web";
  last_seen_at: Date;
  created_at: Date;
}

function toApi(row: PushTokenRow) {
  return {
    id: row.id,
    userId: row.user_id,
    token: row.token,
    platform: row.platform,
    lastSeenAt: row.last_seen_at.toISOString(),
    createdAt: row.created_at.toISOString(),
  };
}

pushTokensRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.auth) throw new ServiceError("UNAUTHORIZED", "Auth context missing");
    const input = parseBody(registerSchema, req.body);

    const result = await pool.query<PushTokenRow>(
      `INSERT INTO push_tokens (user_id, token, platform)
       VALUES ($1, $2, $3)
       ON CONFLICT (token) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         platform = EXCLUDED.platform,
         last_seen_at = NOW()
       RETURNING id, user_id, token, platform, last_seen_at, created_at`,
      [req.auth.userId, input.token, input.platform],
    );
    const row = result.rows[0];
    if (!row) throw new ServiceError("INTERNAL", "Upsert returned no row");
    res.status(201).json(toApi(row));
  }),
);

pushTokensRouter.delete(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.auth) throw new ServiceError("UNAUTHORIZED", "Auth context missing");
    const input = parseBody(deleteSchema, req.body);

    // Only delete if the token belongs to the calling user — prevents one
    // signed-in user from invalidating another's token by guessing.
    await pool.query(
      `DELETE FROM push_tokens WHERE token = $1 AND user_id = $2`,
      [input.token, req.auth.userId],
    );
    res.status(204).end();
  }),
);
