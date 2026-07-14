const MILLIS_PER_UNIT: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
};

export function parseDuration(value: string): number {
  const match = /^(\d+)([smhdw])$/.exec(value);
  const amount = match?.[1];
  const unit = match?.[2];
  const millisPerUnit = unit === undefined ? undefined : MILLIS_PER_UNIT[unit];
  if (amount === undefined || millisPerUnit === undefined) {
    throw new Error(`Invalid duration: "${value}". Expected a value such as "0m", "1h", or "1d".`);
  }
  return Number(amount) * millisPerUnit;
}
