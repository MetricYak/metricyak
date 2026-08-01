import { createBrowserRouter, Navigate } from 'react-router-dom';
import { App } from './App';
import { LegacyMetricRedirect } from './components/metrics/LegacyMetricRedirect';
import { NotFoundPage } from './components/shell/NotFoundPage';
import { ProjectRouteGuard } from './components/shell/ProjectRouteGuard';
import { RootRedirect } from './components/shell/RootRedirect';

export const router = createBrowserRouter([
  { path: '/', element: <RootRedirect /> },
  {
    path: '/projects/:projectId',
    element: <App />,
    children: [
      {
        element: <ProjectRouteGuard />,
        children: [
          { index: true, element: <Navigate to="metrics/explore" replace /> },
          {
            path: 'activity',
            lazy: async () => ({
              Component: (await import('./components/activity/ActivityPage')).ActivityPage,
            }),
            children: [
              { index: true, element: <Navigate to="live" replace /> },
              {
                path: 'live',
                lazy: async () => ({
                  Component: (await import('./components/activity/ActivityPage')).ActivityLiveView,
                }),
              },
              {
                path: 'explore',
                lazy: async () => ({
                  Component: (await import('./components/activity/ActivityPage'))
                    .ActivityExploreView,
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
                  { index: true, element: <Navigate to="explore" replace /> },
                  {
                    path: 'catalogue',
                    lazy: async () => ({
                      Component: (
                        await import('./components/metrics/definitions/MetricDefinitionsPage')
                      ).MetricDefinitionsPage,
                    }),
                  },
                  { path: 'definitions', element: <Navigate to="../catalogue" replace /> },
                  { path: 'explorer', element: <Navigate to="../explore" replace /> },
                  {
                    path: 'explore',
                    lazy: async () => ({
                      Component: (await import('./components/metrics/explore/MetricExplorePage'))
                        .MetricExplorePage,
                    }),
                  },
                ],
              },
              {
                path: 'catalogue/new',
                lazy: async () => ({
                  Component: (await import('./components/metrics/create/CreateMetricPage'))
                    .CreateMetricPage,
                }),
              },
              {
                path: 'catalogue/:metricId',
                lazy: async () => ({
                  Component: (
                    await import('./components/metrics/definitions/MetricDefinitionDetailPage')
                  ).MetricDefinitionDetailPage,
                }),
              },
              { path: 'definitions/new', element: <Navigate to="../catalogue/new" replace /> },
              { path: 'definitions/:metricId', element: <LegacyMetricRedirect /> },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
          {
            path: 'monitors',
            children: [
              {
                index: true,
                lazy: async () => ({
                  Component: (await import('./components/monitors/MonitorsPage')).MonitorsPage,
                }),
              },
              {
                path: 'new',
                lazy: async () => ({
                  Component: (await import('./components/monitors/create/CreateMonitorPage'))
                    .CreateMonitorPage,
                }),
              },
              {
                path: ':monitorId',
                lazy: async () => ({
                  Component: (await import('./components/monitors/MonitorDetailPage'))
                    .MonitorDetailPage,
                }),
              },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
          {
            path: 'data',
            children: [
              { index: true, element: <Navigate to="deployments" replace /> },
              {
                path: 'deployments',
                lazy: async () => ({
                  Component: (await import('./components/data/DeploymentsPage')).DeploymentsPage,
                }),
              },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
          {
            path: 'settings',
            lazy: async () => ({
              Component: (await import('./components/settings/SettingsPage')).SettingsPage,
            }),
            children: [
              { index: true, element: <Navigate to="project/general" replace /> },
              {
                path: 'project',
                children: [
                  { index: true, element: <Navigate to="general" replace /> },
                  {
                    path: 'general',
                    lazy: async () => ({
                      Component: (await import('./components/settings/pages/ProjectGeneralPage'))
                        .ProjectGeneralPage,
                    }),
                  },
                  {
                    path: 'key',
                    lazy: async () => ({
                      Component: (await import('./components/settings/pages/ProjectKeyPage'))
                        .ProjectKeyPage,
                    }),
                  },
                  { path: 'keys', element: <Navigate to="../key" replace /> },
                ],
              },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
