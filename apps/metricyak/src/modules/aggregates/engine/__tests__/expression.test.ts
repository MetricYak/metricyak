import { describe, expect, it } from 'vitest';
import {
  ExpressionError,
  evaluateExpression,
  expressionSymbols,
  expressionVariables,
  parseExpression,
} from '@/modules/aggregates/engine/expression.js';

const resolveFrom =
  (values: Record<string, number | null>) =>
  (name: string): number | null =>
    name in values ? (values[name] ?? null) : null;

describe('parseExpression', () => {
  it('lists the identifiers it references', () => {
    expect(expressionVariables(parseExpression('refunds - chargebacks')).sort()).toEqual([
      'chargebacks',
      'refunds',
    ]);
  });

  it('rejects an empty expression', () => {
    expect(() => parseExpression('')).toThrow(ExpressionError);
  });

  it('exposes disabled builtins as plain identifiers so validation rejects them', () => {
    expect(expressionSymbols(parseExpression('sqrt(x)'))).toContain('sqrt');
    expect(expressionVariables(parseExpression('sqrt(x)'))).toContain('sqrt');
  });
});

describe('evaluateExpression', () => {
  it('evaluates arithmetic with precedence and parentheses', () => {
    expect(
      evaluateExpression(parseExpression('a + b * c'), resolveFrom({ a: 2, b: 3, c: 4 })),
    ).toBe(14);
    expect(
      evaluateExpression(parseExpression('(a + b) * c'), resolveFrom({ a: 2, b: 3, c: 4 })),
    ).toBe(20);
  });

  it('supports unary minus', () => {
    expect(evaluateExpression(parseExpression('-a + b'), resolveFrom({ a: 5, b: 2 }))).toBe(-3);
  });

  it('propagates null when any operand is null', () => {
    expect(
      evaluateExpression(
        parseExpression('subscriptions + one_time'),
        resolveFrom({ subscriptions: 10, one_time: null }),
      ),
    ).toBeNull();
  });

  it('returns null on division by zero', () => {
    expect(evaluateExpression(parseExpression('a / b'), resolveFrom({ a: 10, b: 0 }))).toBeNull();
  });
});
