import type { ZodType } from 'zod';
import type { ConnectorIo } from '@/contract/io.js';

export const SIGNAL_KINDS = ['deployment', 'flag_change', 'incident'] as const;
export type SignalKind = (typeof SIGNAL_KINDS)[number];

export const SIGNAL_PROVIDER_IDS = ['github'] as const;
export type SignalProviderId = (typeof SIGNAL_PROVIDER_IDS)[number];

export const SIGNAL_STATUSES_BY_KIND: Readonly<Record<SignalKind, readonly string[]>> = {
  deployment: ['pending', 'succeeded', 'failed'],
  flag_change: [],
  incident: ['triggered', 'acknowledged', 'resolved'],
};

export function isAllowedSignalStatus(kind: SignalKind, status: string | null): boolean {
  const allowed = SIGNAL_STATUSES_BY_KIND[kind];
  return status === null ? allowed.length === 0 : allowed.includes(status);
}

export type ParsedSignal = {
  readonly kind: SignalKind;
  readonly externalId: string;
  readonly occurredAt: Date;
  readonly observedAt: Date;
  readonly endedAt: Date | null;
  readonly title: string;
  readonly status: string | null;
  readonly attributes: Readonly<Record<string, unknown>>;
};

export type DeliveryVerification =
  | { readonly kind: 'ok' }
  | { readonly kind: 'bad_signature' }
  | { readonly kind: 'unsigned' };

export type BackfillInput = {
  readonly config: Readonly<Record<string, unknown>>;
  readonly credential: string;
  readonly since: Date;
};

export interface SignalProvider {
  readonly provider: SignalProviderId;
  readonly configSchema: ZodType;
  verifyDelivery(body: string, headers: Headers, secret: string): DeliveryVerification;
  parseDelivery(
    body: string,
    headers: Headers,
    config: Readonly<Record<string, unknown>>,
  ): readonly ParsedSignal[];
  backfill?(input: BackfillInput, io: ConnectorIo): Promise<readonly ParsedSignal[]>;
}
