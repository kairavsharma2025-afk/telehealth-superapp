import { z } from "zod";

export const CHANNELS = ["email", "sms", "push"] as const;
export type Channel = (typeof CHANNELS)[number];

export const sendNotificationSchema = z.object({
  channel: z.enum(CHANNELS),
  template: z.string().min(1).max(100),
  payload: z.record(z.unknown()).default({}),
  recipientUserId: z.string().uuid().optional(),
});
export type SendNotificationInput = z.infer<typeof sendNotificationSchema>;
