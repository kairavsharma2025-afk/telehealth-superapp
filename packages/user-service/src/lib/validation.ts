import { z } from "zod";

export const upsertProfileSchema = z.object({
  fullName: z.string().min(1).max(200).optional(),
  phone: z
    .string()
    .min(5)
    .max(32)
    .regex(/^[+\d][\d\s\-()]+$/, "phone must contain digits, spaces, dashes, parens, or leading +")
    .optional(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "dateOfBirth must be YYYY-MM-DD")
    .optional(),
});
export type UpsertProfileInput = z.infer<typeof upsertProfileSchema>;
