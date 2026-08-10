export interface Clock {
  now(): Date;
}

export const systemClock: Clock = Object.freeze({
  now: () => new Date(),
});

export function fixedClock(instant: Date | string): Clock {
  const timestamp = new Date(instant).getTime();
  if (!Number.isFinite(timestamp)) {
    throw new TypeError('A fixed clock requires a valid instant.');
  }

  return Object.freeze({
    now: () => new Date(timestamp),
  });
}
