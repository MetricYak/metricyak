import path from 'node:path';
import type { UserConfig } from 'vitest/config';
import { defineConfig } from 'vitest/config';

// `@/` resolves to the package's own `src/`. The caller passes its config
// directory (`import.meta.dirname`), so resolution is independent of the
// directory Vitest happens to be launched from.
export function defineBaseConfig(packageDir: string, overrides?: UserConfig) {
  return defineConfig({
    ...overrides,
    resolve: {
      ...overrides?.resolve,
      alias: [{ find: /^@\//, replacement: `${path.resolve(packageDir, 'src')}/` }],
    },
    test: {
      environment: 'node',
      include: ['src/**/__tests__/**/*.test.ts'],
      ...overrides?.test,
    },
  });
}
