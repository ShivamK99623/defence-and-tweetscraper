export type HttpStatus =
  | 400
  | 401
  | 403
  | 404
  | 409
  | 422
  | 429
  | 500
  | number;

const STATUS_LABELS: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
  422: "Unprocessable Entity",
  429: "Too Many Requests",
  500: "Internal Server Error",
};

export class ApiError extends Error {
  readonly status: HttpStatus;
  readonly code: string;
  readonly details: unknown;

  constructor(status: HttpStatus, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = STATUS_LABELS[status] ?? `HTTP_${status}`;
    this.details = details ?? null;
  }

  get isBadRequest(): boolean {
    return this.status === 400;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isValidationError(): boolean {
    return this.status === 422;
  }

  get isRateLimited(): boolean {
    return this.status === 429;
  }

  get isServerError(): boolean {
    return this.status >= 500;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

type ErrorBody = {
  error?: string;
  message?: string;
};

export function messageFromErrorBody(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;
  const { error, message } = body as ErrorBody;
  if (typeof error === "string" && error.trim()) return error;
  if (typeof message === "string" && message.trim()) return message;
  return fallback;
}
