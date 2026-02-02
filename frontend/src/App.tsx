import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { createHashRouter, RouterProvider } from 'react-router-dom';
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

// Custom focus detection for Wails webkit views
// The default browser focus events don't fire reliably in embedded webkit
focusManager.setEventListener((handleFocus) => {
  const onFocus = () => handleFocus(true);
  const onBlur = () => handleFocus(false);
  const onVisibilityChange = () => handleFocus(document.visibilityState === 'visible');

  // Listen to multiple events to catch focus in webkit
  window.addEventListener('focus', onFocus, false);
  window.addEventListener('blur', onBlur, false);
  document.addEventListener('visibilitychange', onVisibilityChange, false);

  // Also check on mouse enter - catches webkit edge cases
  document.addEventListener('mouseenter', onFocus, false);

  return () => {
    window.removeEventListener('focus', onFocus);
    window.removeEventListener('blur', onBlur);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    document.removeEventListener('mouseenter', onFocus);
  };
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30 seconds
      refetchOnWindowFocus: true,
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
      { path: 'settings/*', element: <SettingsPage /> },
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
