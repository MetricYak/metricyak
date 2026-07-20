import { apiFetch } from '@/lib/api';

export type ActivityKind = 'event';

export type Severity = 'info' | 'warning' | 'error';

export type EventSource = 'web' | 'ios' | 'android' | 'server' | 'api';

export type PropertyValue = string | number | boolean;

export interface ActivityEvent {
  id: string;
  kind: 'event';
  name: string;
  source: EventSource;
  severity: Severity;
  receivedAt: string;
  properties: Record<string, PropertyValue>;
}

export type PlatformActivity = ActivityEvent;

export type ActivityListener = (activity: PlatformActivity) => void;
export type Unsubscribe = () => void;

interface EventTemplate {
  name: string;
  sources: EventSource[];
  severity: Severity;
  weight: number;
  properties: () => Record<string, PropertyValue>;
}

const COUNTRIES = ['US', 'GB', 'DE', 'FR', 'CA', 'AU', 'JP', 'BR', 'IN', 'NL'];
const PLANS = ['free', 'starter', 'growth', 'scale', 'enterprise'];
const PATHS = ['/', '/pricing', '/docs', '/dashboard', '/settings', '/blog/launch', '/signup'];
const METHODS = ['password', 'google', 'github', 'magic-link', 'saml'];
const ENDPOINTS = ['/v1/metrics', '/v1/events', '/v1/monitors', '/v1/projects', '/v1/keys'];
const GATEWAYS = ['stripe', 'adyen', 'braintree'];
const SERVICES = ['ingest', 'aggregator', 'notifier', 'scheduler', 'api-gateway'];
const FLAGS = ['new-onboarding', 'streaming-charts', 'ai-summaries', 'slack-v2'];

const pick = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)] as T;
const int = (min: number, max: number): number => Math.floor(min + Math.random() * (max - min + 1));
const money = (min: number, max: number): number =>
  Math.round((min + Math.random() * (max - min)) * 100) / 100;

const TEMPLATES: EventTemplate[] = [
  {
    name: 'page.viewed',
    sources: ['web'],
    severity: 'info',
    weight: 20,
    properties: () => ({
      path: pick(PATHS),
      referrer: pick(['direct', 'google', 'twitter', 'email']),
    }),
  },
  {
    name: 'session.started',
    sources: ['web', 'ios', 'android'],
    severity: 'info',
    weight: 12,
    properties: () => ({ country: pick(COUNTRIES), device: pick(['desktop', 'mobile', 'tablet']) }),
  },
  {
    name: 'checkout.started',
    sources: ['web', 'ios'],
    severity: 'info',
    weight: 8,
    properties: () => ({ plan: pick(PLANS), value: money(9, 499), currency: 'USD' }),
  },
  {
    name: 'checkout.completed',
    sources: ['web', 'ios'],
    severity: 'info',
    weight: 7,
    properties: () => ({
      plan: pick(PLANS),
      amount: money(9, 499),
      currency: 'USD',
      items: int(1, 4),
    }),
  },
  {
    name: 'cart.updated',
    sources: ['web'],
    severity: 'info',
    weight: 9,
    properties: () => ({ items: int(1, 8), value: money(5, 320), currency: 'USD' }),
  },
  {
    name: 'signup.started',
    sources: ['web'],
    severity: 'info',
    weight: 6,
    properties: () => ({ plan: pick(PLANS), referrer: pick(['direct', 'google', 'partner']) }),
  },
  {
    name: 'signup.completed',
    sources: ['web'],
    severity: 'info',
    weight: 5,
    properties: () => ({ plan: pick(PLANS), method: pick(METHODS) }),
  },
  {
    name: 'login.succeeded',
    sources: ['web', 'ios', 'android'],
    severity: 'info',
    weight: 10,
    properties: () => ({ method: pick(METHODS) }),
  },
  {
    name: 'login.failed',
    sources: ['web', 'ios', 'android'],
    severity: 'warning',
    weight: 4,
    properties: () => ({
      method: pick(METHODS),
      reason: pick(['bad-password', 'unknown-user', 'locked']),
    }),
  },
  {
    name: 'subscription.renewed',
    sources: ['server'],
    severity: 'info',
    weight: 4,
    properties: () => ({ plan: pick(PLANS), amount: money(9, 499), currency: 'USD' }),
  },
  {
    name: 'subscription.canceled',
    sources: ['server'],
    severity: 'warning',
    weight: 2,
    properties: () => ({
      plan: pick(PLANS),
      reason: pick(['too-expensive', 'missing-feature', 'churned']),
    }),
  },
  {
    name: 'payment.failed',
    sources: ['server'],
    severity: 'error',
    weight: 3,
    properties: () => ({
      amount: money(9, 499),
      currency: 'USD',
      gateway: pick(GATEWAYS),
      reason: pick(['card_declined', 'insufficient_funds', 'expired_card']),
    }),
  },
  {
    name: 'api.request',
    sources: ['api'],
    severity: 'info',
    weight: 14,
    properties: () => ({ endpoint: pick(ENDPOINTS), status: 200, latencyMs: int(12, 240) }),
  },
  {
    name: 'api.error',
    sources: ['api'],
    severity: 'error',
    weight: 3,
    properties: () => ({
      endpoint: pick(ENDPOINTS),
      status: pick([429, 500, 502, 503]),
      latencyMs: int(80, 1400),
    }),
  },
  {
    name: 'feature.flag.evaluated',
    sources: ['server', 'web'],
    severity: 'info',
    weight: 6,
    properties: () => ({ flag: pick(FLAGS), value: pick([true, false]) }),
  },
  {
    name: 'error.logged',
    sources: ['server'],
    severity: 'error',
    weight: 3,
    properties: () => ({
      service: pick(SERVICES),
      level: pick(['error', 'fatal']),
      message: pick(['timeout waiting for lock', 'null pointer in reducer', 'connection reset']),
    }),
  },
  {
    name: 'email.sent',
    sources: ['server'],
    severity: 'info',
    weight: 5,
    properties: () => ({
      template: pick(['welcome', 'receipt', 'digest', 'reset']),
      domain: pick(['gmail.com', 'outlook.com', 'proton.me', 'company.io']),
    }),
  },
  {
    name: 'webhook.delivered',
    sources: ['server'],
    severity: 'info',
    weight: 4,
    properties: () => ({ endpoint: 'hooks.acme.io', status: 200, attempts: int(1, 2) }),
  },
];

const TOTAL_WEIGHT = TEMPLATES.reduce((sum, t) => sum + t.weight, 0);

function pickTemplate(): EventTemplate {
  let roll = Math.random() * TOTAL_WEIGHT;
  for (const t of TEMPLATES) {
    roll -= t.weight;
    if (roll <= 0) return t;
  }
  return TEMPLATES[0] as EventTemplate;
}

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  const rand = Math.random().toString(36).slice(2, 8);
  return `evt_${Date.now().toString(36)}${rand}${idCounter}`;
}

function makeEvent(receivedAt: string): ActivityEvent {
  const template = pickTemplate();
  return {
    id: nextId(),
    kind: 'event',
    name: template.name,
    source: pick(template.sources),
    severity: template.severity,
    receivedAt,
    properties: template.properties(),
  };
}

const STORE_MAX = 5_000;
const SEED_COUNT = 900;
const SEED_SPAN_MS = 45 * 24 * 60 * 60 * 1000;

let store: ActivityEvent[] | null = null;

function ensureStore(): ActivityEvent[] {
  if (store) return store;
  const now = Date.now();
  const seeded: ActivityEvent[] = [];
  for (let i = 0; i < SEED_COUNT; i += 1) {
    const age = Math.random() ** 2.4 * SEED_SPAN_MS;
    seeded.push(makeEvent(new Date(now - age).toISOString()));
  }
  seeded.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  store = seeded;
  return store;
}

function pushToStore(event: ActivityEvent): void {
  const current = ensureStore();
  current.unshift(event);
  if (current.length > STORE_MAX) current.length = STORE_MAX;
}

export async function listRecentEvents(
  _projectId: string,
  limit = 40,
): Promise<PlatformActivity[]> {
  await new Promise((resolve) => setTimeout(resolve, 320));
  return ensureStore().slice(0, limit);
}

export type EventSort = 'time-desc' | 'time-asc';

export type TimeRange =
  | '15m'
  | '1h'
  | '3h'
  | '6h'
  | '12h'
  | '24h'
  | '3d'
  | '7d'
  | '14d'
  | '30d'
  | 'month'
  | 'all';

export interface TimeRangeOption {
  id: TimeRange;
  label: string;
}

export const TIME_RANGES: TimeRangeOption[] = [
  { id: '15m', label: 'Last 15 minutes' },
  { id: '1h', label: 'Last hour' },
  { id: '3h', label: 'Last 3 hours' },
  { id: '6h', label: 'Last 6 hours' },
  { id: '12h', label: 'Last 12 hours' },
  { id: '24h', label: 'Last 24 hours' },
  { id: '3d', label: 'Last 3 days' },
  { id: '7d', label: 'Last 7 days' },
  { id: '14d', label: 'Last 14 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: 'month', label: 'This month' },
  { id: 'all', label: 'All time' },
];

const RANGE_DURATIONS: Partial<Record<TimeRange, number>> = {
  '15m': 15 * 60_000,
  '1h': 60 * 60_000,
  '3h': 3 * 60 * 60_000,
  '6h': 6 * 60 * 60_000,
  '12h': 12 * 60 * 60_000,
  '24h': 24 * 60 * 60_000,
  '3d': 3 * 24 * 60 * 60_000,
  '7d': 7 * 24 * 60 * 60_000,
  '14d': 14 * 24 * 60 * 60_000,
  '30d': 30 * 24 * 60 * 60_000,
};

export function rangeCutoff(range: TimeRange, nowMs: number): number | null {
  if (range === 'all') return null;
  if (range === 'month') {
    const d = new Date(nowMs);
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  }
  const duration = RANGE_DURATIONS[range];
  return duration ? nowMs - duration : null;
}

export function timeRangeLabel(range: TimeRange): string {
  return TIME_RANGES.find((r) => r.id === range)?.label ?? 'All time';
}

export interface RealEvent {
  id: string;
  name: string;
  timestamp: string;
  properties: Record<string, unknown>;
}

export interface ListEventsResult {
  events: RealEvent[];
  hasMore: boolean;
}

export interface ListEventsInput {
  from?: string;
  to?: string;
  sort?: EventSort;
  page?: number;
  pageSize?: number;
}

export function listEvents(
  projectId: string,
  input: ListEventsInput = {},
): Promise<ListEventsResult> {
  const searchParams = new URLSearchParams();
  if (input.from) searchParams.set('from', input.from);
  if (input.to) searchParams.set('to', input.to);
  if (input.sort) searchParams.set('sort', input.sort === 'time-asc' ? 'asc' : 'desc');
  if (input.page != null) searchParams.set('page', String(input.page));
  if (input.pageSize != null) searchParams.set('pageSize', String(input.pageSize));

  const qs = searchParams.toString();
  return apiFetch<ListEventsResult>(`/v1/projects/${projectId}/events${qs ? `?${qs}` : ''}`);
}

export function subscribeToEvents(_projectId: string, listener: ActivityListener): Unsubscribe {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const deliver = (): void => {
    const event = makeEvent(new Date().toISOString());
    pushToStore(event);
    listener(event);
  };

  const emit = (): void => {
    if (stopped) return;
    deliver();
    if (Math.random() < 0.25) {
      const extra = int(1, 2);
      for (let i = 0; i < extra; i += 1) {
        setTimeout(
          () => {
            if (!stopped) deliver();
          },
          int(60, 260),
        );
      }
    }
    timer = setTimeout(emit, int(350, 1700));
  };

  timer = setTimeout(emit, int(300, 900));

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
