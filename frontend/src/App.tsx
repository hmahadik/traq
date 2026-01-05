import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  TimelinePage,
  AnalyticsPage,
  ReportsPage,
  DayPage,
  SettingsPage,
  SessionDetailPage,
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

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <TimelinePage /> },
      { path: 'analytics', element: <AnalyticsPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'day/:date', element: <DayPage /> },
      { path: 'settings', element: <SettingsPage /> },
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
