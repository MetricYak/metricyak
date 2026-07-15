import { Outlet } from 'react-router-dom';
import { AppLayout } from '@/components/shell/AppLayout';
import { Toaster } from '@/components/ui/sonner';

export function App(): React.JSX.Element {
  return (
    <AppLayout>
      <Outlet />
      <Toaster />
    </AppLayout>
  );
}
