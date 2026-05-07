import { createAuditLogger } from "@telehealth/shared";
import { logger } from "./logger.js";

export const audit = createAuditLogger({
  url: process.env["MONGO_URL"],
  logger,
});
