import path from 'node:path';
import type { UserConfig } from 'vitest/config';
import { defineConfig } from 'vitest/config';

// `@/` resolves to the current package's own `src/`. vitest runs with the
// package directory as cwd (via turbo / `pnpm --filter`), so this alias is
// package-local without any per-package configuration.
const aliasToSrc = { find: /^@\//, replacement: `${path.resolve(process.cwd(), 'src')}/` };

export function defineBaseConfig(overrides?: UserConfig) {
  return defineConfig({
    ...overrides,
    resolve: {
      ...overrides?.resolve,
      alias: [aliasToSrc],
    },
    test: {
      environment: 'node',
      include: ['src/**/__tests__/**/*.test.ts'],
      ...overrides?.test,
    },
  });
}
