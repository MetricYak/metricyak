import {
  Activity,
  AlertTriangle,
  BarChart3,
  BellRing,
  Database,
  Flag,
  type LucideIcon,
  Plug,
  Rocket,
  Send,
  Settings,
  Table2,
  Webhook,
} from 'lucide-react';
import type { FlyoutMenuData } from '@/components/flyout/flyout-menu';

export interface NavItemData {
  id: string;
  label: string;
  icon: LucideIcon;
  iconColor?: string;
  pathSuffix?: string;
  menu?: FlyoutMenuData;
}

const integrationsMenu: FlyoutMenuData = {
  title: '',
  searchPlaceholder: 'Search integrations',
  emptyText: 'Nothing matches that. Try “deploy” or “flags”.',
  groups: [
    {
      id: 'signals',
      label: 'Signals',
      items: [
        {
          id: 'deployments',
          label: 'Deployments',
          pathSuffix: '/data/deployments',
          icon: Rocket,
          meta: '1 tool',
        },
        {
          id: 'flags',
          label: 'Feature flags',
          pathSuffix: '/data/flags',
          icon: Flag,
          meta: 'Soon',
        },
        {
          id: 'incidents',
          label: 'Incidents',
          pathSuffix: '/data/incidents',
          icon: AlertTriangle,
          meta: 'Soon',
        },
      ],
    },
    {
      id: 'data-sources',
      label: 'Data sources',
      items: [
        {
          id: 'warehouse',
          label: 'Warehouse',
          pathSuffix: '/data/warehouse',
          icon: Table2,
          meta: 'Soon',
        },
        {
          id: 'product-events',
          label: 'Product events',
          pathSuffix: '/data/events',
          icon: Database,
          meta: 'Soon',
        },
      ],
    },
    {
      id: 'delivery',
      label: 'Delivery',
      items: [
        { id: 'slack', label: 'Slack', pathSuffix: '/data/slack', icon: Send, meta: 'Soon' },
        {
          id: 'outbound',
          label: 'Outbound webhooks',
          pathSuffix: '/data/outbound',
          icon: Webhook,
          meta: 'Soon',
        },
      ],
    },
  ],
};

export const navItems: readonly NavItemData[] = [
  {
    id: 'activity',
    label: 'Activity',
    icon: Activity,
    iconColor: 'text-emerald-600',
    pathSuffix: '/activity',
  },
  {
    id: 'metrics',
    label: 'Metrics',
    icon: BarChart3,
    iconColor: 'text-blue-600',
    pathSuffix: '/metrics',
  },
  {
    id: 'monitors',
    label: 'Monitors',
    icon: BellRing,
    iconColor: 'text-amber-600',
    pathSuffix: '/monitors',
  },
  {
    id: 'integrations',
    label: 'Integrations',
    icon: Plug,
    iconColor: 'text-violet-600',
    menu: integrationsMenu,
  },
] satisfies readonly NavItemData[];

export const bottomNavItems: readonly NavItemData[] = [
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    iconColor: 'text-slate-500',
    pathSuffix: '/settings',
  },
] satisfies readonly NavItemData[];
