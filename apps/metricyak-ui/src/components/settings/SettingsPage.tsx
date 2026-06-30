import { Outlet } from 'react-router-dom';
import { SettingsNav } from './SettingsNav';

export function SettingsPage(): React.JSX.Element {
  return (
    <div className="flex h-full">
      <SettingsNav />
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
