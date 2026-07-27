import type { BreakdownRow, DimensionValue, MetricKind } from './explore-model';
import { isAdditive } from './metric-shape';

export interface BreakdownRequest {
  readonly kind: MetricKind;
  readonly current: readonly DimensionValue[];
  readonly prior: readonly DimensionValue[];
}

const MINIMUM_NET_SHARE_OF_GROSS_MOVEMENT = 0.1;

function valuesByDimension(entries: readonly DimensionValue[]): Map<string, number | null> {
  return new Map(entries.map((entry) => [entry.dimValue, entry.value] as const));
}

function changeOf(current: number | null, prior: number | null): number | null {
  return current === null || prior === null ? null : current - prior;
}

function changeRatioOf(change: number | null, prior: number | null): number | null {
  return change === null || prior === null || prior === 0 ? null : change / Math.abs(prior);
}

function netChangeOf(rows: readonly BreakdownRow[]): number {
  return rows.reduce((total, row) => total + (row.change ?? 0), 0);
}

function grossMovementOf(rows: readonly BreakdownRow[]): number {
  return rows.reduce((total, row) => total + Math.abs(row.change ?? 0), 0);
}

function everyRowIsComparable(rows: readonly BreakdownRow[]): boolean {
  return rows.every((row) => row.change !== null);
}

function netChangeCarriesTheMovement(rows: readonly BreakdownRow[]): boolean {
  const grossMovement = grossMovementOf(rows);
  if (grossMovement === 0) return false;
  return Math.abs(netChangeOf(rows)) >= MINIMUM_NET_SHARE_OF_GROSS_MOVEMENT * grossMovement;
}

function sharesAreMeaningful(kind: MetricKind, rows: readonly BreakdownRow[]): boolean {
  return isAdditive(kind) && everyRowIsComparable(rows) && netChangeCarriesTheMovement(rows);
}

function levelOf(row: BreakdownRow): number {
  return Math.abs(row.current ?? row.prior ?? 0);
}

function movementOf(row: BreakdownRow): number {
  return row.change === null ? levelOf(row) : Math.abs(row.change);
}

function comparabilityOf(row: BreakdownRow): number {
  return row.change === null ? 1 : 0;
}

function byMovement(left: BreakdownRow, right: BreakdownRow): number {
  const byComparability = comparabilityOf(left) - comparabilityOf(right);
  if (byComparability !== 0) return byComparability;
  const bySize = movementOf(right) - movementOf(left);
  if (bySize !== 0) return bySize;
  return left.value.localeCompare(right.value);
}

function withSharesOfNetChange(rows: readonly BreakdownRow[]): BreakdownRow[] {
  const netChange = netChangeOf(rows);
  return rows.map((row) => ({
    ...row,
    shareOfChange: row.change === null ? null : row.change / netChange,
  }));
}

export function breakdownRows({ kind, current, prior }: BreakdownRequest): BreakdownRow[] {
  const currentByValue = valuesByDimension(current);
  const priorByValue = valuesByDimension(prior);
  const dimensionValues = [...new Set([...currentByValue.keys(), ...priorByValue.keys()])];

  const rows = dimensionValues.map((value) => {
    const currentValue = currentByValue.get(value) ?? null;
    const priorValue = priorByValue.get(value) ?? null;
    const change = changeOf(currentValue, priorValue);
    return {
      value,
      current: currentValue,
      prior: priorValue,
      change,
      changeRatio: changeRatioOf(change, priorValue),
      shareOfChange: null,
    };
  });

  const attributed = sharesAreMeaningful(kind, rows) ? withSharesOfNetChange(rows) : rows;
  return attributed.sort(byMovement);
}

export function largestChange(rows: readonly BreakdownRow[]): number {
  return rows.reduce((widest, row) => Math.max(widest, Math.abs(row.change ?? 0)), 0);
}
