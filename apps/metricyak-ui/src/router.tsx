import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { App } from './App';
import {
  ActivityExploreView,
  ActivityLiveView,
  ActivityPage,
} from './components/activity/ActivityPage';
import { CreateMetricPage } from './components/metrics/create/CreateMetricPage';
import { MetricDefinitionDetailPage } from './components/metrics/definitions/MetricDefinitionDetailPage';
import { MetricDefinitionsPage } from './components/metrics/definitions/MetricDefinitionsPage';
import { MetricsPage } from './components/metrics/MetricsPage';
import { ProjectGeneralPage } from './components/settings/pages/ProjectGeneralPage';
import { ProjectKeysPage } from './components/settings/pages/ProjectKeysPage';
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
        path: 'activity',
        element: <ActivityPage />,
        children: [
          { index: true, element: <Navigate to="/activity/live" replace /> },
          { path: 'live', element: <ActivityLiveView /> },
          { path: 'explore', element: <ActivityExploreView /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
      {
        path: 'metrics',
        children: [
          {
            element: <MetricsPage />,
            children: [
              { index: true, element: <Navigate to="/metrics/definitions" replace /> },
              { path: 'definitions', element: <MetricDefinitionsPage /> },
              { path: 'explorer', element: <PlaceholderPage title="Metrics · Explorer" /> },
            ],
          },
          { path: 'definitions/new', element: <CreateMetricPage /> },
          { path: 'definitions/:metricId', element: <MetricDefinitionDetailPage /> },
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
        children: [
          { index: true, element: <Navigate to="/settings/project/general" replace /> },
          {
            path: 'project',
            children: [
              { index: true, element: <Navigate to="/settings/project/general" replace /> },
              { path: 'general', element: <ProjectGeneralPage /> },
              { path: 'keys', element: <ProjectKeysPage /> },
            ],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
