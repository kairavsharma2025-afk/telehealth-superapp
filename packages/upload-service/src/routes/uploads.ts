import { Router } from "express";
import { ServiceError } from "@telehealth/shared";
import { audit } from "../audit.js";
import { config } from "../config.js";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, parseBody } from "../lib/http.js";
import { createUploadSchema } from "../lib/validation.js";
import { deleteObject, headObject, presignGet, presignPut } from "../lib/s3.js";

export const uploadsRouter: Router = Router();
uploadsRouter.use(requireAuth);

type UploadStatus = "pending" | "uploaded" | "deleted";

interface UploadRow {
  id: string;
  owner_user_id: string;
  object_key: string;
  filename: string;
  content_type: string;
  size_bytes: string;
  status: UploadStatus;
  category: string | null;
  created_at: Date;
  updated_at: Date;
}

function toApi(row: UploadRow) {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    objectKey: row.object_key,
    filename: row.filename,
    contentType: row.content_type,
    sizeBytes: Number(row.size_bytes),
    status: row.status,
    category: row.category,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

const SELECT_COLUMNS =
  "id, owner_user_id, object_key, filename, content_type, size_bytes, status, category, created_at, updated_at";

uploadsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.auth) throw new ServiceError("UNAUTHORIZED", "Auth context missing");
    const input = parseBody(createUploadSchema, req.body);

    if (input.sizeBytes > config.maxUploadBytes) {
      throw new ServiceError(
        "VALIDATION_FAILED",
        `sizeBytes exceeds limit of ${config.maxUploadBytes}`,
      );
    }

    const inserted = await pool.query<UploadRow>(
      `WITH new_id AS (SELECT gen_random_uuid() AS id)
       INSERT INTO uploads (id, owner_user_id, object_key, filename, content_type, size_bytes, category)
       SELECT
         new_id.id,
         $1::uuid,
         'uploads/' || $1::text || '/' || new_id.id::text,
         $2,
         $3,
         $4,
         $5
       FROM new_id
       RETURNING ${SELECT_COLUMNS}`,
      [
        req.auth.userId,
        input.filename,
        input.contentType,
        input.sizeBytes,
        input.category ?? null,
      ],
    );
    const row = inserted.rows[0];
    if (!row) throw new ServiceError("INTERNAL", "Insert returned no row");

    const uploadUrl = await presignPut(row.object_key, input.contentType);
    res.status(201).json({
      ...toApi(row),
      uploadUrl,
      expiresIn: config.presignPutSeconds,
    });
  }),
);

uploadsRouter.post(
  "/:id/complete",
  asyncHandler(async (req, res) => {
    if (!req.auth) throw new ServiceError("UNAUTHORIZED", "Auth context missing");
    const id = req.params["id"];
    if (!id || !isUuid(id)) throw new ServiceError("BAD_REQUEST", "Invalid id");

    const owned = await fetchOwned(id, req.auth.userId, req.auth.role);
    if (owned.status === "uploaded") {
      res.json(toApi(owned));
      return;
    }
    if (owned.status === "deleted") {
      throw new ServiceError("CONFLICT", "Upload was deleted");
    }

    const head = await headObject(owned.object_key);
    if (!head.exists) {
      throw new ServiceError("BAD_REQUEST", "Object not yet uploaded to storage");
    }
    if (head.size !== Number(owned.size_bytes)) {
      throw new ServiceError(
        "VALIDATION_FAILED",
        `Object size mismatch: expected ${owned.size_bytes}, got ${head.size}`,
      );
    }

    const updated = await pool.query<UploadRow>(
      `UPDATE uploads SET status = 'uploaded' WHERE id = $1 RETURNING ${SELECT_COLUMNS}`,
      [id],
    );
    const row = updated.rows[0];
    if (!row) throw new ServiceError("INTERNAL", "Update returned no row");
    res.json(toApi(row));
  }),
);

uploadsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.auth) throw new ServiceError("UNAUTHORIZED", "Auth context missing");
    // Admins see every (non-deleted) upload; everyone else sees only their own.
    const sql =
      req.auth.role === "admin"
        ? `SELECT ${SELECT_COLUMNS} FROM uploads
            WHERE status <> 'deleted'
            ORDER BY created_at DESC LIMIT 100`
        : `SELECT ${SELECT_COLUMNS} FROM uploads
            WHERE owner_user_id = $1 AND status <> 'deleted'
            ORDER BY created_at DESC LIMIT 100`;
    const params = req.auth.role === "admin" ? [] : [req.auth.userId];
    const result = await pool.query<UploadRow>(sql, params);
    res.json({ items: result.rows.map(toApi) });
  }),
);

uploadsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!req.auth) throw new ServiceError("UNAUTHORIZED", "Auth context missing");
    const id = req.params["id"];
    if (!id || !isUuid(id)) throw new ServiceError("BAD_REQUEST", "Invalid id");

    const row = await fetchOwned(id, req.auth.userId, req.auth.role);
    if (row.status === "deleted") throw new ServiceError("NOT_FOUND", "Upload not found");
    if (row.status !== "uploaded") {
      res.json({ ...toApi(row), downloadUrl: null });
      return;
    }
    const downloadUrl = await presignGet(row.object_key);
    res.json({
      ...toApi(row),
      downloadUrl,
      expiresIn: config.presignGetSeconds,
    });
  }),
);

uploadsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!req.auth) throw new ServiceError("UNAUTHORIZED", "Auth context missing");
    const id = req.params["id"];
    if (!id || !isUuid(id)) throw new ServiceError("BAD_REQUEST", "Invalid id");

    const row = await fetchOwned(id, req.auth.userId, req.auth.role);
    const isAdminOverride =
      req.auth.role === "admin" && row.owner_user_id !== req.auth.userId;
    if (row.status !== "deleted") {
      try {
        await deleteObject(row.object_key);
      } catch (err) {
        req.log.warn({ err }, "s3 delete failed; continuing to soft-delete row");
      }
      await pool.query(`UPDATE uploads SET status = 'deleted' WHERE id = $1`, [id]);

      // Audit only when an admin deletes someone else's upload — owners
      // deleting their own files is normal user-driven behaviour and is
      // already implicit in the uploads table's status column.
      if (isAdminOverride) {
        void audit.record({
          service: "upload-service",
          action: "upload.admin-delete",
          actor: { userId: req.auth.userId, role: req.auth.role },
          target: { type: "upload", id: row.id },
          details: {
            ownerUserId: row.owner_user_id,
            filename: row.filename,
            objectKey: row.object_key,
            sizeBytes: Number(row.size_bytes),
          },
          requestId: typeof req.id === "string" ? req.id : undefined,
        });
      }
    }
    res.status(204).end();
  }),
);

async function fetchOwned(
  id: string,
  userId: string,
  role: "patient" | "doctor" | "admin",
): Promise<UploadRow> {
  const result = await pool.query<UploadRow>(
    `SELECT ${SELECT_COLUMNS} FROM uploads WHERE id = $1`,
    [id],
  );
  const row = result.rows[0];
  if (!row) throw new ServiceError("NOT_FOUND", "Upload not found");
  if (role !== "admin" && row.owner_user_id !== userId) {
    throw new ServiceError("FORBIDDEN", "Not your upload");
  }
  return row;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
