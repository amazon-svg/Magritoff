export type AppError = Readonly<{
  code: string;
  message: string;
  retryable: boolean;
  details?: Readonly<Record<string, unknown>>;
}>;

export function appError(
  code: string,
  message: string,
  retryable = false,
  details?: Readonly<Record<string, unknown>>,
): AppError {
  return Object.freeze({
    code,
    message,
    retryable,
    ...(details === undefined ? {} : { details: Object.freeze({ ...details }) }),
  });
}
