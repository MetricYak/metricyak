import { Activity, BarChart3, type LucideIcon, Settings } from 'lucide-react';

export interface SubNavItem {
  id: string;
  label: string;
  path: string;
}

export interface NavItemData {
  id: string;
  label: string;
  icon: LucideIcon;
  path?: string;
  items?: readonly SubNavItem[];
}

export const navItems: readonly NavItemData[] = [
  {
    id: 'activity',
    label: 'Activity',
    icon: Activity,
    path: '/activity',
  },
  {
    id: 'metrics',
    label: 'Metrics',
    icon: BarChart3,
    path: '/metrics',
  },
] satisfies readonly NavItemData[];

export const bottomNavItems: readonly NavItemData[] = [
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    path: '/settings',
  },
] satisfies readonly NavItemData[];
