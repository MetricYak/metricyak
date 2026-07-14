import type {
  MonitorComparisonOperator,
  MonitorMissingData,
  MonitorThresholdCondition,
} from '@metricyak/storage';

export type MonitorStatus = 'ok' | 'pending' | 'firing';

export type MonitorEvalState = {
  status: MonitorStatus;
  breachedSince: Date | null;
};

export type MonitorEvalInput = {
  condition: MonitorThresholdCondition;
  holdForMs: number;
  missingData: MonitorMissingData;
};

export type MonitorFired = {
  value: number;
  threshold: MonitorThresholdCondition;
  occurredAt: Date;
};

export type MonitorEvalResult = {
  nextState: MonitorEvalState;
  fired: MonitorFired | null;
};

const RECOVERED: MonitorEvalState = { status: 'ok', breachedSince: null };

type BreachAssessment =
  | { kind: 'stateUnchanged' }
  | { kind: 'assessed'; breached: boolean; value: number };

function compare(operator: MonitorComparisonOperator, value: number, threshold: number): boolean {
  switch (operator) {
    case 'lt':
      return value < threshold;
    case 'lte':
      return value <= threshold;
    case 'gt':
      return value > threshold;
    case 'gte':
      return value >= threshold;
    case 'eq':
      return value === threshold;
    case 'neq':
      return value !== threshold;
    default: {
      const unhandled: never = operator;
      throw new Error(`Unhandled operator: ${JSON.stringify(unhandled)}`);
    }
  }
}

function assessBreach(input: MonitorEvalInput, value: number | null): BreachAssessment {
  if (value !== null) {
    return {
      kind: 'assessed',
      breached: compare(input.condition.operator, value, input.condition.value),
      value,
    };
  }
  switch (input.missingData) {
    case 'skip':
      return { kind: 'stateUnchanged' };
    case 'zero':
      return {
        kind: 'assessed',
        breached: compare(input.condition.operator, 0, input.condition.value),
        value: 0,
      };
    case 'fire':
      return { kind: 'assessed', breached: true, value: 0 };
    default: {
      const unhandled: never = input.missingData;
      throw new Error(`Unhandled missingData: ${JSON.stringify(unhandled)}`);
    }
  }
}

export function evaluateMonitor(
  input: MonitorEvalInput,
  state: MonitorEvalState,
  value: number | null,
  now: Date,
): MonitorEvalResult {
  const assessment = assessBreach(input, value);

  if (assessment.kind === 'stateUnchanged') {
    return { nextState: state, fired: null };
  }

  if (!assessment.breached) {
    return { nextState: RECOVERED, fired: null };
  }

  if (state.status === 'firing') {
    return { nextState: state, fired: null };
  }

  const breachedSince =
    state.status === 'pending' && state.breachedSince ? state.breachedSince : now;

  if (now.getTime() - breachedSince.getTime() >= input.holdForMs) {
    return {
      nextState: { status: 'firing', breachedSince },
      fired: { value: assessment.value, threshold: input.condition, occurredAt: now },
    };
  }

  return { nextState: { status: 'pending', breachedSince }, fired: null };
}
