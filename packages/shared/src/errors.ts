export type ServiceErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION_FAILED"
  | "RATE_LIMITED"
  | "INTERNAL"
  | "UPSTREAM_UNAVAILABLE";

const STATUS_BY_CODE: Record<ServiceErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION_FAILED: 422,
  RATE_LIMITED: 429,
  INTERNAL: 500,
  UPSTREAM_UNAVAILABLE: 503,
};

export class ServiceError extends Error {
  readonly code: ServiceErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ServiceErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    if (details !== undefined) this.details = details;
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details !== undefined ? { details: this.details } : {}),
      },
    };
  }
}
