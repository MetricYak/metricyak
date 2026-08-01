import type { LucideIcon } from 'lucide-react';

type FlyoutMenuItemBase = {
  readonly id: string;
  readonly label: string;
  readonly icon?: LucideIcon;
  readonly meta?: string;
  readonly needsAttention?: boolean;
};

export type FlyoutMenuItem =
  | (FlyoutMenuItemBase & { readonly kind: 'link'; readonly pathSuffix: string })
  | (FlyoutMenuItemBase & { readonly kind: 'coming-soon' });

export interface FlyoutMenuGroup {
  id: string;
  label: string;
  items: readonly FlyoutMenuItem[];
}

export interface FlyoutMenuData {
  searchPlaceholder: string;
  emptyText: string;
  groups: readonly FlyoutMenuGroup[];
}

export function filterMenuGroups(
  groups: readonly FlyoutMenuGroup[],
  query: string,
): readonly FlyoutMenuGroup[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return groups;

  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.label.toLowerCase().includes(needle)),
    }))
    .filter((group) => group.items.length > 0);
}

export function countMenuItems(groups: readonly FlyoutMenuGroup[]): number {
  return groups.reduce((total, group) => total + group.items.length, 0);
}
