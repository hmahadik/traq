import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createHashRouter, Navigate, RouterProvider } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { RouteErrorBoundary } from '@/components/common';
import {
  TimelinePage,
  AnalyticsPage,
  ReportsPage,
  ScreenshotsPage,
  DayPage,
  SettingsPage,
  SessionDetailPage,
  ProjectsPage,
} from '@/pages';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30 seconds
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const router = createHashRouter([
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <TimelinePage /> },
      { path: 'timeline', element: <TimelinePage /> },
      { path: 'analytics', element: <AnalyticsPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'screenshots', element: <ScreenshotsPage /> },
      { path: 'day/:date', element: <DayPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'session/:id', element: <SessionDetailPage /> },
      { path: 'projects', element: <ProjectsPage /> },
    ],
  },
]);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

export default App;
