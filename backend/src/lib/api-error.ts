export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function assertOrThrow(
  condition: unknown,
  statusCode: number,
  code: string,
  message: string
): asserts condition {
  if (!condition) {
    throw new ApiError(statusCode, code, message);
  }
}
