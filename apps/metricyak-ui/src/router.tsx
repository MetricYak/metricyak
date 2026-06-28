import { createBrowserRouter } from 'react-router-dom';
import { App } from './App';
import { PlaceholderPage } from './components/shell/PlaceholderPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <PlaceholderPage title="Dashboard" /> },
      { path: 'metrics', element: <PlaceholderPage title="Metrics · Overview" /> },
      { path: 'metrics/definitions', element: <PlaceholderPage title="Metrics · Definitions" /> },
      { path: 'metrics/explorer', element: <PlaceholderPage title="Metrics · Explorer" /> },
      { path: 'monitors', element: <PlaceholderPage title="Monitors · Active" /> },
      { path: 'monitors/history', element: <PlaceholderPage title="Monitors · History" /> },
      { path: 'settings', element: <PlaceholderPage title="Settings" /> },
      { path: '*', element: <PlaceholderPage title="404 · Page not found" /> },
    ],
  },
]);
