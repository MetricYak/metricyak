import type { SignalProvider } from '@/contract/signal-provider.js';
import { githubProvider } from '@/providers/github/index.js';

export const signalProviders: readonly SignalProvider[] = [githubProvider];

export function findSignalProvider(id: string): SignalProvider | null {
  return signalProviders.find((provider) => provider.provider === id) ?? null;
}
