import { useRouteError, isRouteErrorResponse, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

export function RouteErrorBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();

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

  const handleRetry = () => {
    window.location.reload();
  };

  const handleGoHome = () => {
    navigate('/', { replace: true });
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

        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={handleGoHome}>
            <Home className="mr-2 h-4 w-4" />
            Go Home
          </Button>
          <Button onClick={handleRetry}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </div>
      </div>
    </div>
  );
}
