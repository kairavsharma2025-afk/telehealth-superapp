import { z } from "zod";

export const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export const createUploadSchema = z.object({
  filename: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[^\\/:*?"<>|\r\n]+$/, "filename contains forbidden characters"),
  contentType: z.enum(ALLOWED_CONTENT_TYPES),
  sizeBytes: z.number().int().positive(),
});
export type CreateUploadInput = z.infer<typeof createUploadSchema>;
