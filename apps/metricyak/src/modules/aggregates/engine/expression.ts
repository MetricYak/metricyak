import { type Expression, Parser } from 'expr-eval-fork';

const arithmeticParser = new Parser({
  operators: {
    add: true,
    subtract: true,
    multiply: true,
    divide: true,
    concatenate: false,
    conditional: false,
    factorial: false,
    logical: false,
    comparison: false,
    power: false,
    remainder: false,
    in: false,
    assignment: false,
    fndef: false,
    sin: false,
    cos: false,
    tan: false,
    asin: false,
    acos: false,
    atan: false,
    sinh: false,
    cosh: false,
    tanh: false,
    asinh: false,
    acosh: false,
    atanh: false,
    sqrt: false,
    log: false,
    ln: false,
    lg: false,
    log10: false,
    abs: false,
    ceil: false,
    floor: false,
    round: false,
    trunc: false,
    exp: false,
    length: false,
    random: false,
    min: false,
    max: false,
    cbrt: false,
    expm1: false,
    log1p: false,
    sign: false,
    log2: false,
  },
});

export type ParsedExpression = Expression;

export class ExpressionError extends Error {}

export function parseExpression(source: string): ParsedExpression {
  try {
    return arithmeticParser.parse(source);
  } catch (error) {
    throw new ExpressionError(error instanceof Error ? error.message : String(error));
  }
}

export function expressionVariables(expression: ParsedExpression): string[] {
  return expression.variables();
}

export function expressionSymbols(expression: ParsedExpression): string[] {
  return expression.symbols();
}

export function evaluateExpression(
  expression: ParsedExpression,
  resolve: (identifier: string) => number | null,
): number | null {
  const scope: Record<string, number> = {};
  for (const name of expression.variables()) {
    const resolved = resolve(name);
    if (resolved === null) return null;
    scope[name] = resolved;
  }

  const result: unknown = expression.evaluate(scope);
  return typeof result === 'number' && Number.isFinite(result) ? result : null;
}
