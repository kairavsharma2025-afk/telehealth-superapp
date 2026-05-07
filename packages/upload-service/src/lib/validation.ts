import { z } from "zod";

export const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

// Open-text on the database side; constrained here so the mobile UI
// and the admin console agree on a finite set of friendly labels.
export const ALLOWED_CATEGORIES = [
  "lab_report",
  "prescription",
  "imaging",
  "insurance",
  "other",
] as const;

export const createUploadSchema = z.object({
  filename: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[^\\/:*?"<>|\r\n]+$/, "filename contains forbidden characters"),
  contentType: z.enum(ALLOWED_CONTENT_TYPES),
  sizeBytes: z.number().int().positive(),
  category: z.enum(ALLOWED_CATEGORIES).optional(),
});
export type CreateUploadInput = z.infer<typeof createUploadSchema>;
