import { Activity, BarChart3, BellRing, type LucideIcon, Settings } from 'lucide-react';

export interface SubNavItem {
  id: string;
  label: string;
  path: string;
}

export interface NavItemData {
  id: string;
  label: string;
  icon: LucideIcon;
  iconColor?: string;
  path?: string;
  items?: readonly SubNavItem[];
}

export const navItems: readonly NavItemData[] = [
  {
    id: 'activity',
    label: 'Activity',
    icon: Activity,
    iconColor: 'text-emerald-600',
    path: '/activity',
  },
  {
    id: 'metrics',
    label: 'Metrics',
    icon: BarChart3,
    iconColor: 'text-blue-600',
    path: '/metrics',
  },
  {
    id: 'monitors',
    label: 'Monitors',
    icon: BellRing,
    iconColor: 'text-amber-600',
    path: '/monitors',
  },
] satisfies readonly NavItemData[];

export const bottomNavItems: readonly NavItemData[] = [
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    iconColor: 'text-slate-500',
    path: '/settings',
  },
] satisfies readonly NavItemData[];
