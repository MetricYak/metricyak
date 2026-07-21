import { Outlet } from 'react-router-dom';
import { CommandPalette } from '@/components/command/CommandPalette';
import { AppLayout } from '@/components/shell/AppLayout';
import { Toaster } from '@/components/ui/sonner';

export function App(): React.JSX.Element {
  return (
    <AppLayout>
      <Outlet />
      <CommandPalette />
      <Toaster />
    </AppLayout>
  );
}
