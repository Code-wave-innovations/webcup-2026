// Throw these from any handler: Express 5 forwards thrown/rejected errors to
// the error middleware (src/middleware/error.ts), which formats the response.
export class HttpError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new HttpError(400, "BAD_REQUEST", message, details);
export const unauthorized = (message = "Authentication required") =>
  new HttpError(401, "UNAUTHORIZED", message);
export const forbidden = (message = "You are not allowed to perform this action") =>
  new HttpError(403, "FORBIDDEN", message);
export const notFound = (message = "Resource not found") => new HttpError(404, "NOT_FOUND", message);
export const conflict = (message: string) => new HttpError(409, "CONFLICT", message);
export const serviceUnavailable = (message: string) =>
  new HttpError(503, "SERVICE_UNAVAILABLE", message);
