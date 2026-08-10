export type Quantity<Unit extends string> = Readonly<{
  value: string;
  unit: Unit;
}>;

export function quantity<Unit extends string>(value: string, unit: Unit): Quantity<Unit> {
  return Object.freeze({ value, unit });
}
