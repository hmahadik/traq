import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createHashRouter, Navigate, RouterProvider } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { RouteErrorBoundary } from '@/components/common';
import {
  AnalyticsPage,
  ReportsPage,
  DayPage,
  SettingsPage,
  SessionDetailPage,
} from '@/pages';
import { TimelineLayout, TimelineEmptyState } from '@/pages/TimelineLayout';

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
      { index: true, element: <Navigate to="/timeline" replace /> },
      {
        path: 'timeline',
        element: <TimelineLayout />,
        children: [
          { index: true, element: <TimelineEmptyState /> },
          { path: 'session/:id', element: <SessionDetailPage /> },
        ],
      },
      { path: 'analytics', element: <AnalyticsPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'day/:date', element: <DayPage /> },
      { path: 'settings', element: <SettingsPage /> },
      // Legacy route for direct session access
      { path: 'session/:id', element: <SessionDetailPage /> },
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
