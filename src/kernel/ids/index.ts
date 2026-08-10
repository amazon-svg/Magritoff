import { appError, type AppError } from '../errors';
import { err, ok, type Result } from '../result';

declare const idBrand: unique symbol;

export type Id<Name extends string> = string & {
  readonly [idBrand]: Name;
};

export type UserId = Id<'UserId'>;
export type TenantId = Id<'TenantId'>;
export type RequestId = Id<'RequestId'>;

export type InvalidIdError = AppError & Readonly<{
  code: 'kernel.id.invalid';
}>;

export function parseId<Name extends string>(value: string): Result<Id<Name>, InvalidIdError> {
  const normalized = value.trim();
  if (normalized.length === 0) {
    return err(
      appError('kernel.id.invalid', 'An identifier cannot be empty.') as InvalidIdError,
    );
  }

  return ok(normalized as Id<Name>);
}
