import { randomUUID } from "node:crypto";
import { pinoHttp } from "pino-http";
import type { Logger } from "./logger.js";

// Returns express middleware that attaches a per-request child logger to
// req.log (pino-http's contract) and echoes/generates an x-request-id.
//
// Services consume this with: app.use(httpLogger(logger))
// then in handlers: req.log.info({...}, "message")  (typed by pino-http)
export function httpLogger(logger: Logger) {
  return pinoHttp({
    logger,
    genReqId: (req, res) => {
      const incoming = req.headers["x-request-id"];
      const id =
        typeof incoming === "string" && /^[\w-]{8,128}$/.test(incoming)
          ? incoming
          : randomUUID();
      res.setHeader("x-request-id", id);
      return id;
    },
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
    customSuccessMessage: (req, res) => {
      const url = (req as { originalUrl?: string; url: string }).originalUrl ?? req.url;
      return `${req.method} ${url} → ${res.statusCode}`;
    },
    customErrorMessage: (req, res, err) => {
      const url = (req as { originalUrl?: string; url: string }).originalUrl ?? req.url;
      return `${req.method} ${url} → ${res.statusCode} (${err.message})`;
    },
    serializers: {
      req: (req: { method: string; url: string; originalUrl?: string; id: string }) => ({
        method: req.method,
        url: req.originalUrl ?? req.url,
        id: req.id,
      }),
      res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
    },
  });
}
