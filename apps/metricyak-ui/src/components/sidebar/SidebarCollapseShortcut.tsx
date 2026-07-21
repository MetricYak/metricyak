import { useEffect } from 'react';

interface SidebarCollapseShortcutProps {
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  );
}

export function SidebarCollapseShortcut({
  collapsed,
  setCollapsed,
}: SidebarCollapseShortcutProps): null {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key.toLowerCase() !== 'b' || !(event.metaKey || event.ctrlKey)) return;
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      setCollapsed(!collapsed);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [collapsed, setCollapsed]);

  return null;
}
