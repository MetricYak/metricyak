import { createBrowserRouter, Outlet } from 'react-router-dom';
import { App } from './App';
import { SettingsPage } from './components/settings/SettingsPage';
import { NotFoundPage } from './components/shell/NotFoundPage';
import { PlaceholderPage } from './components/shell/PlaceholderPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <PlaceholderPage title="Dashboard" /> },
      {
        path: 'metrics',
        element: <Outlet />,
        children: [
          { index: true, element: <PlaceholderPage title="Metrics · Overview" /> },
          { path: 'definitions', element: <PlaceholderPage title="Metrics · Definitions" /> },
          { path: 'explorer', element: <PlaceholderPage title="Metrics · Explorer" /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
      {
        path: 'monitors',
        element: <Outlet />,
        children: [
          { index: true, element: <PlaceholderPage title="Monitors · Active" /> },
          { path: 'history', element: <PlaceholderPage title="Monitors · History" /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
      {
        path: 'settings',
        element: <SettingsPage />,
        children: [{ path: '*', element: <NotFoundPage /> }],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
