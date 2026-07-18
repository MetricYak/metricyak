import { describe, expect, it } from 'vitest';
import { fieldPath } from '@/modules/aggregates/engine/ingest.js';

describe('fieldPath', () => {
  it('strips the $properties prefix and splits nested paths', () => {
    expect(fieldPath('$properties.amount_usd')).toEqual(['amount_usd']);
    expect(fieldPath('$properties.checkout.total')).toEqual(['checkout', 'total']);
    expect(fieldPath('amount')).toEqual(['amount']);
  });
});
