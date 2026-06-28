import { Outlet } from 'react-router-dom';
import { AppLayout } from '@/components/shell/AppLayout';

export function App(): React.JSX.Element {
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
