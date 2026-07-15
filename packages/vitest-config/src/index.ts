import tsconfigPaths from 'vite-tsconfig-paths';
import type { UserConfig } from 'vitest/config';
import { defineConfig } from 'vitest/config';

export function defineBaseConfig(overrides?: UserConfig) {
  return defineConfig({
    ...overrides,
    plugins: [tsconfigPaths(), ...(overrides?.plugins ?? [])],
    test: {
      environment: 'node',
      include: ['src/**/__tests__/**/*.test.ts'],
      ...overrides?.test,
    },
  });
}
