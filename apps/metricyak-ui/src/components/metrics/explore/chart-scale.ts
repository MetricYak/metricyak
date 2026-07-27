const NICE_STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

export function niceCeiling(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = NICE_STEPS.find((candidate) => normalized <= candidate) ?? 10;
  return step * magnitude;
}

export function axisTop(maxValue: number | null, headroom = 1.08): number {
  if (maxValue === null || !Number.isFinite(maxValue) || maxValue <= 0) return 1;
  return niceCeiling(maxValue * headroom);
}

export function axisTicks(top: number, divisions: number): number[] {
  return Array.from({ length: divisions + 1 }, (_, index) => (top * index) / divisions);
}

export function barHeightPercent(value: number | null, top: number): number {
  if (value === null || top <= 0) return 0;
  return Math.min(100, Math.max(0, (value / top) * 100));
}
