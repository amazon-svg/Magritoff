import type { AppError } from '../errors/index.ts';

export type Result<T, E extends AppError = AppError> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; error: E }>;

export function ok<T>(value: T): Result<T, never> {
  return Object.freeze({ ok: true as const, value });
}

export function err<E extends AppError>(error: E): Result<never, E> {
  return Object.freeze({ ok: false as const, error });
}
