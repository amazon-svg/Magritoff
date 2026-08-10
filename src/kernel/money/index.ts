import { appError, type AppError } from '../errors';
import { err, ok, type Result } from '../result';

export type Currency = string;

export type Money = Readonly<{
  minorUnits: bigint;
  currency: Currency;
}>;

export type InvalidCurrencyError = AppError & Readonly<{
  code: 'kernel.money.invalid_currency';
}>;

export type CurrencyMismatchError = AppError & Readonly<{
  code: 'kernel.money.currency_mismatch';
}>;

export function createMoney(
  minorUnits: bigint,
  currency: string,
): Result<Money, InvalidCurrencyError> {
  const normalizedCurrency = currency.trim().toUpperCase();
  if (normalizedCurrency.length === 0) {
    return err(
      appError(
        'kernel.money.invalid_currency',
        'A monetary amount requires a currency.',
      ) as InvalidCurrencyError,
    );
  }

  return ok(Object.freeze({ minorUnits, currency: normalizedCurrency }));
}

export function addMoney(
  left: Money,
  right: Money,
): Result<Money, CurrencyMismatchError> {
  const currencyCheck = requireSameCurrency(left, right);
  if (currencyCheck.ok === false) return err(currencyCheck.error);

  return ok(Object.freeze({
    minorUnits: left.minorUnits + right.minorUnits,
    currency: left.currency,
  }));
}

export function compareMoney(
  left: Money,
  right: Money,
): Result<-1 | 0 | 1, CurrencyMismatchError> {
  const currencyCheck = requireSameCurrency(left, right);
  if (currencyCheck.ok === false) return err(currencyCheck.error);

  return ok(left.minorUnits === right.minorUnits ? 0 : left.minorUnits < right.minorUnits ? -1 : 1);
}

function requireSameCurrency(
  left: Money,
  right: Money,
): Result<void, CurrencyMismatchError> {
  if (left.currency === right.currency) return ok(undefined);

  return err(
    appError(
      'kernel.money.currency_mismatch',
      'Monetary amounts use different currencies.',
      false,
      { leftCurrency: left.currency, rightCurrency: right.currency },
    ) as CurrencyMismatchError,
  );
}
