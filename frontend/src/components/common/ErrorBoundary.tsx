import { useState, useEffect } from 'react';
import { useRouteError, isRouteErrorResponse, useNavigate, useLocation } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Home, RefreshCw, Bug } from 'lucide-react';
import { api } from '@/api/client';
import { ReportIssueDialog } from './ReportIssueDialog';

export function RouteErrorBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();
  const location = useLocation();
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [hasAutoReported, setHasAutoReported] = useState(false);

  let title = 'Unexpected Application Error';
  let message = 'Something went wrong. Please try again.';
  let details: string | undefined;

  if (isRouteErrorResponse(error)) {
    title = `${error.status} ${error.statusText}`;
    message = error.data?.message || 'An error occurred while loading this page.';
  } else if (error instanceof Error) {
    message = error.message;
    details = error.stack;
  } else if (typeof error === 'string') {
    message = error;
  }

  // Auto-report crash on mount (once)
  useEffect(() => {
    if (!hasAutoReported) {
      setHasAutoReported(true);

      // Report to Sentry (primary crash reporting)
      const errorObj = error instanceof Error ? error : new Error(message);
      Sentry.captureException(errorObj, {
        tags: { source: 'route_error_boundary' },
        extra: { pageRoute: location.pathname },
      });

      // Also report to local backend (for offline access)
      api.issues
        .report('crash', message, details || '', 'Auto-captured from route error boundary', location.pathname)
        .catch((err) => console.error('[ErrorBoundary] Failed to auto-report locally:', err));
    }
  }, [hasAutoReported, error, message, details, location.pathname]);

  const handleRetry = () => {
    window.location.reload();
  };

  const handleGoHome = () => {
    navigate('/', { replace: true });
  };

  const handleReportIssue = () => {
    setReportDialogOpen(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6 text-center">
        <div className="flex justify-center">
          <div className="rounded-full bg-destructive/10 p-4">
            <AlertTriangle className="h-12 w-12 text-destructive" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground">{message}</p>
        </div>

        {details && (
          <details className="text-left">
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
              Technical details
            </summary>
            <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs">
              {details}
            </pre>
          </details>
        )}

        <div className="flex flex-wrap gap-3 justify-center">
          <Button variant="outline" onClick={handleGoHome}>
            <Home className="mr-2 h-4 w-4" />
            Go Home
          </Button>
          <Button variant="outline" onClick={handleReportIssue}>
            <Bug className="mr-2 h-4 w-4" />
            Report Issue
          </Button>
          <Button onClick={handleRetry}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          This error has been automatically reported.
        </p>
      </div>

      <ReportIssueDialog
        open={reportDialogOpen}
        onOpenChange={setReportDialogOpen}
        prefillError={{ message, stack: details }}
      />
    </div>
  );
}
