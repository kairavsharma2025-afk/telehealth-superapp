import { pino, type Logger as PinoLogger, type LoggerOptions } from "pino";

export type Logger = PinoLogger;

export interface CreateLoggerOptions {
  service: string;
  level?: string;
}

// JSON to stdout in prod, pretty-printed to stdout in dev.
// pino-pretty is a devDep — services don't have to install it themselves.
export function createLogger(opts: CreateLoggerOptions): Logger {
  const isDev = process.env["NODE_ENV"] !== "production";
  const level = opts.level ?? process.env["LOG_LEVEL"] ?? (isDev ? "debug" : "info");

  const config: LoggerOptions = {
    name: opts.service,
    level,
    base: { service: opts.service },
    formatters: {
      level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        'password',
        'password_hash',
        'accessToken',
        'refreshToken',
      ],
      censor: "[REDACTED]",
    },
  };

  if (isDev) {
    return pino({
      ...config,
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          singleLine: true,
          ignore: "pid,hostname,service",
          messageFormat: "[{service}] {msg}",
        },
      },
    });
  }
  return pino(config);
}
