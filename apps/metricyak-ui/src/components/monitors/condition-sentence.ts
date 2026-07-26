import type { ConditionOperator } from '@/api/monitors';

const OPERATOR_PHRASE: Record<ConditionOperator, string> = {
  lt: 'below',
  lte: 'at or below',
  gt: 'above',
  gte: 'at or above',
  eq: 'equal to',
  neq: 'not',
};

const UNIT_WORD: Record<string, string> = {
  s: 'second',
  m: 'minute',
  h: 'hour',
  d: 'day',
  w: 'week',
};

export function operatorPhrase(operator: ConditionOperator): string {
  return OPERATOR_PHRASE[operator];
}

export function formatThreshold(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export function windowLabel(duration: string): string {
  const match = /^(\d+)(s|m|h|d|w)$/.exec(duration);
  if (!match) return duration;
  const amount = Number(match[1]);
  const unit = UNIT_WORD[match[2] ?? ''] ?? match[2] ?? '';
  return `${amount} ${unit}${amount === 1 ? '' : 's'}`;
}

const AWAITING_THRESHOLD = '…';

type PreviewArgs = {
  metricName: string | null;
  operator: ConditionOperator;
  value: number | null;
  window: string;
  holdFor?: string;
};

export function previewSentence(args: PreviewArgs): string {
  if (!args.metricName) return 'Pick a metric to watch.';
  const amount = args.value == null ? AWAITING_THRESHOLD : formatThreshold(args.value);
  const held = args.holdFor && !/^0/.test(args.holdFor);
  const holdClause = held ? ` — sustained for ${windowLabel(args.holdFor ?? '')}` : '';
  return `Alert me when ${args.metricName} is ${operatorPhrase(args.operator)} ${amount} over the last ${windowLabel(args.window)}${holdClause}.`;
}

type SentenceArgs = {
  metricName: string;
  operator: ConditionOperator;
  value: number;
  window: string;
  holdFor?: string;
  long: boolean;
};

export function conditionSentence(args: SentenceArgs): string {
  if (!args.long) {
    return `${args.metricName} ${operatorPhrase(args.operator)} ${formatThreshold(args.value)} · last ${windowLabel(args.window)}`;
  }
  return previewSentence(args);
}

export function defaultMonitorName(args: {
  metricName: string;
  operator: ConditionOperator;
  value: number;
}): string {
  return `${args.metricName} ${operatorPhrase(args.operator)} ${formatThreshold(args.value)}`;
}
