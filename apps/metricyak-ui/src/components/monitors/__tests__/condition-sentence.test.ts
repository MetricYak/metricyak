import { describe, expect, it } from 'vitest';
import {
  conditionSentence,
  defaultMonitorName,
  operatorPhrase,
  previewSentence,
  windowLabel,
} from '@/components/monitors/condition-sentence';

describe('operatorPhrase', () => {
  it('maps each operator to a plain adjective phrase', () => {
    expect(operatorPhrase('lt')).toBe('below');
    expect(operatorPhrase('lte')).toBe('at or below');
    expect(operatorPhrase('gt')).toBe('above');
    expect(operatorPhrase('gte')).toBe('at or above');
    expect(operatorPhrase('eq')).toBe('equal to');
    expect(operatorPhrase('neq')).toBe('not');
  });
});

describe('windowLabel', () => {
  it('expands durations to words', () => {
    expect(windowLabel('5m')).toBe('5 minutes');
    expect(windowLabel('1h')).toBe('1 hour');
    expect(windowLabel('1d')).toBe('1 day');
    expect(windowLabel('7d')).toBe('7 days');
  });
});

describe('conditionSentence', () => {
  it('builds the long preview sentence', () => {
    expect(
      conditionSentence({
        metricName: 'Signups',
        operator: 'lt',
        value: 5000,
        window: '1d',
        long: true,
      }),
    ).toBe('Alert me when Signups is below 5,000 over the last 1 day.');
  });

  it('appends the hold-for clause when non-zero', () => {
    expect(
      conditionSentence({
        metricName: 'Signups',
        operator: 'lt',
        value: 5000,
        window: '1d',
        holdFor: '5m',
        long: true,
      }),
    ).toBe('Alert me when Signups is below 5,000 over the last 1 day — sustained for 5 minutes.');
  });

  it('builds the compact list form', () => {
    expect(
      conditionSentence({
        metricName: 'Signups',
        operator: 'gte',
        value: 100,
        window: '1h',
        long: false,
      }),
    ).toBe('Signups at or above 100 · last 1 hour');
  });
});

describe('previewSentence', () => {
  it('asks for a metric before one is chosen', () => {
    expect(previewSentence({ metricName: null, operator: 'lt', value: null, window: '1h' })).toBe(
      'Pick a metric to watch.',
    );
  });

  it('describes the monitor once a metric is chosen, before a threshold is typed', () => {
    expect(
      previewSentence({
        metricName: 'Checkout conversion rate',
        operator: 'lt',
        value: null,
        window: '1h',
      }),
    ).toBe('Alert me when Checkout conversion rate is below … over the last 1 hour.');
  });

  it('fills the threshold in once it is known', () => {
    expect(
      previewSentence({
        metricName: 'Checkout conversion rate',
        operator: 'lt',
        value: 70,
        window: '1h',
        holdFor: '0m',
      }),
    ).toBe('Alert me when Checkout conversion rate is below 70 over the last 1 hour.');
  });
});

describe('defaultMonitorName', () => {
  it('names a monitor from metric, operator and value', () => {
    expect(defaultMonitorName({ metricName: 'Signups', operator: 'lt', value: 5000 })).toBe(
      'Signups below 5,000',
    );
  });
});
