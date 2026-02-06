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
// Debounced to prevent refetch storms on rapid alt-tab cycles
focusManager.setEventListener((handleFocus) => {
  let focusTimeout: ReturnType<typeof setTimeout>;

  const debouncedFocus = () => {
    clearTimeout(focusTimeout);
    focusTimeout = setTimeout(() => handleFocus(true), 1000);
  };
  const onBlur = () => {
    clearTimeout(focusTimeout);
    handleFocus(false);
  };
  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      debouncedFocus();
    } else {
      onBlur();
    }
  };

  window.addEventListener('focus', debouncedFocus, false);
  window.addEventListener('blur', onBlur, false);
  document.addEventListener('visibilitychange', onVisibilityChange, false);

  return () => {
    clearTimeout(focusTimeout);
    window.removeEventListener('focus', debouncedFocus);
    window.removeEventListener('blur', onBlur);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // 60 seconds
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
