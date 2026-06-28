import type { ReactNode } from 'react';

interface MainContentProps {
  children?: ReactNode;
}

export function MainContent({ children }: MainContentProps): React.JSX.Element {
  return <main className="flex-1 overflow-auto bg-background">{children}</main>;
}
