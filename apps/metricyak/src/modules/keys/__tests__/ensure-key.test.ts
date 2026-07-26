import { describe, expect, it } from 'vitest';
import { ensureKeyForProject } from '@/modules/keys/ensure-key.js';

const PROJECT_ID = 'd6ceaf26-fd71-4c38-90f1-2de20b946d00';
const NOW = new Date('2026-07-25T12:00:00.000Z');

function keyRecord(key: string, expiresAt: Date | null) {
  return {
    id: `id-${key}`,
    projectId: PROJECT_ID,
    key,
    createdAt: NOW,
    lastUsedAt: null,
    expiresAt,
  };
}

function stubRepository({
  active = null,
  grace = null,
  anyKey = false,
  keyWonByAnotherRequest = false,
}: {
  active?: ReturnType<typeof keyRecord> | null;
  grace?: ReturnType<typeof keyRecord> | null;
  anyKey?: boolean;
  keyWonByAnotherRequest?: boolean;
}) {
  const attempts: string[] = [];
  let state = { active, grace };

  return {
    attempts,
    repository: {
      getState: async () => state,
      hasAnyKey: async () => anyKey,
      generateIfNoneActive: async () => {
        attempts.push(PROJECT_ID);
        if (keyWonByAnotherRequest) {
          state = { active: keyRecord('myk_winner', null), grace: null };
          return false;
        }
        state = { active: keyRecord('myk_minted', null), grace: null };
        return true;
      },
    },
  };
}

describe('ensureKeyForProject', () => {
  it('mints a key for a project that has never had one', async () => {
    const { repository, attempts } = stubRepository({});

    const state = await ensureKeyForProject(repository, PROJECT_ID, NOW);

    expect(attempts).toHaveLength(1);
    expect(state.active?.key).toBe('myk_minted');
  });

  it('returns the key another concurrent request won the race to mint', async () => {
    const { repository } = stubRepository({ keyWonByAnotherRequest: true });

    const state = await ensureKeyForProject(repository, PROJECT_ID, NOW);

    expect(state.active?.key).toBe('myk_winner');
  });

  it('leaves an existing active key alone', async () => {
    const { repository, attempts } = stubRepository({ active: keyRecord('myk_existing', null) });

    const state = await ensureKeyForProject(repository, PROJECT_ID, NOW);

    expect(attempts).toHaveLength(0);
    expect(state.active?.key).toBe('myk_existing');
  });

  it('does not mint a replacement for a deliberately revoked project', async () => {
    const { repository, attempts } = stubRepository({ anyKey: true });

    const state = await ensureKeyForProject(repository, PROJECT_ID, NOW);

    expect(attempts).toHaveLength(0);
    expect(state.active).toBeNull();
  });
});
