import {
  Activity,
  BarChart3,
  BellRing,
  type LucideIcon,
  Plug,
  Rocket,
  Settings,
} from 'lucide-react';
import type { FlyoutMenuData } from '@/components/flyout/flyout-menu';

export interface NavItemData {
  id: string;
  label: string;
  icon: LucideIcon;
  iconColor?: string;
  pathSuffix?: string;
  routePrefix?: string;
  menu?: FlyoutMenuData;
}

export function navItemOwnsRoute(item: NavItemData, pathname: string): boolean {
  const owned = item.routePrefix ?? item.pathSuffix;
  if (owned === undefined) return false;
  return pathname.includes(`${owned}/`) || pathname.endsWith(owned);
}

const integrationsMenu: FlyoutMenuData = {
  searchPlaceholder: 'Search integrations',
  emptyText: 'Nothing matches that. Try “deploy”.',
  groups: [
    {
      id: 'signals',
      label: 'Signals',
      items: [
        {
          kind: 'link',
          id: 'deployments',
          label: 'Deployments',
          pathSuffix: '/data/deployments',
          icon: Rocket,
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
    routePrefix: '/data',
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
