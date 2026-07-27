import { Activity, BarChart3, BellRing, type LucideIcon, Settings } from 'lucide-react';

export interface SubNavItem {
  id: string;
  label: string;
  pathSuffix: string;
}

export interface NavItemData {
  id: string;
  label: string;
  icon: LucideIcon;
  iconColor?: string;
  pathSuffix?: string;
  items?: readonly SubNavItem[];
}

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
