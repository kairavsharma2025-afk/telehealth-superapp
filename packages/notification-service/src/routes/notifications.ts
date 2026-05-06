import { Router } from "express";
import { ServiceError } from "@telehealth/shared";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, parseBody } from "../lib/http.js";
import { sendNotificationSchema, type Channel } from "../lib/validation.js";
import { dispatch, type Recipient } from "../lib/senders.js";

export const notificationsRouter: Router = Router();
notificationsRouter.use(requireAuth);

type NotificationStatus = "pending" | "sent" | "failed";

interface NotificationRow {
  id: string;
  recipient_user_id: string;
  created_by_user_id: string;
  channel: Channel;
  template: string;
  payload: Record<string, unknown>;
  status: NotificationStatus;
  error_message: string | null;
  sent_at: Date | null;
  retries: number;
  created_at: Date;
  updated_at: Date;
}

function toApi(row: NotificationRow) {
  return {
    id: row.id,
    recipientUserId: row.recipient_user_id,
    createdByUserId: row.created_by_user_id,
    channel: row.channel,
    template: row.template,
    payload: row.payload,
    status: row.status,
    errorMessage: row.error_message,
    sentAt: row.sent_at ? row.sent_at.toISOString() : null,
    retries: row.retries,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

const SELECT_COLUMNS = `
  id, recipient_user_id, created_by_user_id, channel, template, payload,
  status, error_message, sent_at, retries, created_at, updated_at
`;

notificationsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.auth) throw new ServiceError("UNAUTHORIZED", "Auth context missing");
    const input = parseBody(sendNotificationSchema, req.body);
    const recipientUserId = input.recipientUserId ?? req.auth.userId;

    if (recipientUserId !== req.auth.userId && req.auth.role !== "admin") {
      throw new ServiceError(
        "FORBIDDEN",
        "Only admins can send notifications to other users",
      );
    }

    const recipient = await fetchRecipient(recipientUserId);

    const inserted = await pool.query<NotificationRow>(
      `INSERT INTO notifications
         (recipient_user_id, created_by_user_id, channel, template, payload)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       RETURNING ${SELECT_COLUMNS}`,
      [
        recipientUserId,
        req.auth.userId,
        input.channel,
        input.template,
        JSON.stringify(input.payload),
      ],
    );
    const row = inserted.rows[0];
    if (!row) throw new ServiceError("INTERNAL", "Insert returned no row");

    const final = await tryDispatchAndPersist(row, recipient);
    res.status(201).json(toApi(final));
  }),
);

notificationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.auth) throw new ServiceError("UNAUTHORIZED", "Auth context missing");
    const result = await pool.query<NotificationRow>(
      `SELECT ${SELECT_COLUMNS} FROM notifications
        WHERE recipient_user_id = $1
        ORDER BY created_at DESC
        LIMIT 100`,
      [req.auth.userId],
    );
    res.json({ items: result.rows.map(toApi) });
  }),
);

notificationsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!req.auth) throw new ServiceError("UNAUTHORIZED", "Auth context missing");
    const id = req.params["id"];
    if (!id || !isUuid(id)) throw new ServiceError("BAD_REQUEST", "Invalid id");
    const row = await fetchVisible(id, req.auth.userId, req.auth.role);
    res.json(toApi(row));
  }),
);

notificationsRouter.post(
  "/:id/retry",
  asyncHandler(async (req, res) => {
    if (!req.auth) throw new ServiceError("UNAUTHORIZED", "Auth context missing");
    const id = req.params["id"];
    if (!id || !isUuid(id)) throw new ServiceError("BAD_REQUEST", "Invalid id");

    const row = await fetchVisible(id, req.auth.userId, req.auth.role);
    if (row.status !== "failed") {
      throw new ServiceError(
        "CONFLICT",
        `Cannot retry notification with status '${row.status}'`,
      );
    }

    const recipient = await fetchRecipient(row.recipient_user_id);
    const final = await tryDispatchAndPersist(row, recipient);
    res.json(toApi(final));
  }),
);

async function tryDispatchAndPersist(
  row: NotificationRow,
  recipient: Recipient,
): Promise<NotificationRow> {
  try {
    await dispatch(row.channel, recipient, row.template, row.payload);
    const updated = await pool.query<NotificationRow>(
      `UPDATE notifications
          SET status = 'sent',
              error_message = NULL,
              sent_at = NOW(),
              retries = CASE WHEN status = 'failed' THEN retries + 1 ELSE retries END
        WHERE id = $1
        RETURNING ${SELECT_COLUMNS}`,
      [row.id],
    );
    const updatedRow = updated.rows[0];
    if (!updatedRow) throw new ServiceError("INTERNAL", "Update returned no row");
    return updatedRow;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "send failed";
    const updated = await pool.query<NotificationRow>(
      `UPDATE notifications
          SET status = 'failed',
              error_message = $2,
              retries = CASE WHEN status = 'failed' THEN retries + 1 ELSE retries END
        WHERE id = $1
        RETURNING ${SELECT_COLUMNS}`,
      [row.id, message],
    );
    const updatedRow = updated.rows[0];
    if (!updatedRow) throw new ServiceError("INTERNAL", "Update returned no row");
    return updatedRow;
  }
}

async function fetchRecipient(userId: string): Promise<Recipient> {
  const result = await pool.query<{ id: string; email: string; phone: string | null }>(
    `SELECT u.id, u.email, p.phone
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
      WHERE u.id = $1 AND u.is_active = TRUE`,
    [userId],
  );
  const row = result.rows[0];
  if (!row) throw new ServiceError("BAD_REQUEST", "Recipient does not exist or is inactive");
  return { userId: row.id, email: row.email, phone: row.phone };
}

async function fetchVisible(
  id: string,
  userId: string,
  role: "patient" | "doctor" | "admin",
): Promise<NotificationRow> {
  const result = await pool.query<NotificationRow>(
    `SELECT ${SELECT_COLUMNS} FROM notifications WHERE id = $1`,
    [id],
  );
  const row = result.rows[0];
  if (!row) throw new ServiceError("NOT_FOUND", "Notification not found");
  if (
    role !== "admin" &&
    row.recipient_user_id !== userId &&
    row.created_by_user_id !== userId
  ) {
    throw new ServiceError("FORBIDDEN", "Not your notification");
  }
  return row;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
