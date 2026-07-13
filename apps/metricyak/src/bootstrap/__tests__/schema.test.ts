import { describe, expect, it } from 'vitest';
import { assertSchemaReady } from '../schema.js';

describe('assertSchemaReady', () => {
  it('resolves when the query succeeds', async () => {
    const db = { execute: async () => ({ rows: [] }) };
    await expect(assertSchemaReady(db)).resolves.toBeUndefined();
  });

  it('throws a migrate hint when the pg code is directly on the error (42P01)', async () => {
    const db = {
      execute: async () => {
        throw Object.assign(new Error('relation "organizations" does not exist'), {
          code: '42P01',
        });
      },
    };
    await expect(assertSchemaReady(db)).rejects.toThrow(/db:migrate/);
  });

  it('throws a migrate hint when 42P01 is wrapped in a DrizzleQueryError cause', async () => {
    const db = {
      execute: async () => {
        const pgError = Object.assign(new Error('relation "organizations" does not exist'), {
          code: '42P01',
        });
        // Real drizzle-orm/node-postgres shape: DrizzleQueryError with the pg error on .cause
        throw Object.assign(new Error('Failed query: select 1 from "organizations" limit 1'), {
          cause: pgError,
        });
      },
    };
    await expect(assertSchemaReady(db)).rejects.toThrow(/db:migrate/);
  });

  it('rethrows unexpected errors unchanged', async () => {
    const db = {
      execute: async () => {
        throw new Error('connection refused');
      },
    };
    await expect(assertSchemaReady(db)).rejects.toThrow(/connection refused/);
  });
});
