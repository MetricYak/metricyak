import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { App } from './App';
import { NotFoundPage } from './components/shell/NotFoundPage';
import { PlaceholderPage } from './components/shell/PlaceholderPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <PlaceholderPage title="Dashboard" /> },
      {
        path: 'activity',
        lazy: async () => ({
          Component: (await import('./components/activity/ActivityPage')).ActivityPage,
        }),
        children: [
          { index: true, element: <Navigate to="/activity/live" replace /> },
          {
            path: 'live',
            lazy: async () => ({
              Component: (await import('./components/activity/ActivityPage')).ActivityLiveView,
            }),
          },
          {
            path: 'explore',
            lazy: async () => ({
              Component: (await import('./components/activity/ActivityPage')).ActivityExploreView,
            }),
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
      {
        path: 'metrics',
        children: [
          {
            lazy: async () => ({
              Component: (await import('./components/metrics/MetricsPage')).MetricsPage,
            }),
            children: [
              { index: true, element: <Navigate to="/metrics/definitions" replace /> },
              {
                path: 'definitions',
                lazy: async () => ({
                  Component: (
                    await import('./components/metrics/definitions/MetricDefinitionsPage')
                  ).MetricDefinitionsPage,
                }),
              },
              { path: 'explorer', element: <PlaceholderPage title="Metrics · Explorer" /> },
            ],
          },
          {
            path: 'definitions/new',
            lazy: async () => ({
              Component: (await import('./components/metrics/create/CreateMetricPage'))
                .CreateMetricPage,
            }),
          },
          {
            path: 'definitions/:metricId',
            lazy: async () => ({
              Component: (
                await import('./components/metrics/definitions/MetricDefinitionDetailPage')
              ).MetricDefinitionDetailPage,
            }),
          },
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
        lazy: async () => ({
          Component: (await import('./components/settings/SettingsPage')).SettingsPage,
        }),
        children: [
          { index: true, element: <Navigate to="/settings/project/general" replace /> },
          {
            path: 'project',
            children: [
              { index: true, element: <Navigate to="/settings/project/general" replace /> },
              {
                path: 'general',
                lazy: async () => ({
                  Component: (await import('./components/settings/pages/ProjectGeneralPage'))
                    .ProjectGeneralPage,
                }),
              },
              {
                path: 'keys',
                lazy: async () => ({
                  Component: (await import('./components/settings/pages/ProjectKeysPage'))
                    .ProjectKeysPage,
                }),
              },
            ],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
