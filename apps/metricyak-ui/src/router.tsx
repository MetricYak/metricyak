import { createBrowserRouter, Navigate } from 'react-router-dom';
import { App } from './App';
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
                  { index: true, element: <Navigate to="definitions" replace /> },
                  {
                    path: 'definitions',
                    lazy: async () => ({
                      Component: (
                        await import('./components/metrics/definitions/MetricDefinitionsPage')
                      ).MetricDefinitionsPage,
                    }),
                  },
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
