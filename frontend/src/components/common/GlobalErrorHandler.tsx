import { useEffect, useState, useCallback, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '@/api/client';
import { ReportIssueDialog } from './ReportIssueDialog';

interface GlobalErrorHandlerProps {
  children: ReactNode;
}

interface CapturedError {
  message: string;
  stack?: string;
}

/**
 * Global error handler that catches unhandled errors and promise rejections.
 * Automatically reports crashes and shows a dialog for user to add context.
 */
export function GlobalErrorHandler({ children }: GlobalErrorHandlerProps) {
  const location = useLocation();
  const [capturedError, setCapturedError] = useState<CapturedError | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleError = useCallback(
    async (error: Error | string, source?: string) => {
      const errorMessage = typeof error === 'string' ? error : error.message;
      const errorStack = typeof error === 'string' ? undefined : error.stack;

      console.error('[GlobalErrorHandler] Caught error:', errorMessage);

      // Auto-report crash to backend (silent, non-blocking)
      try {
        await api.issues.report(
          'crash',
          errorMessage,
          errorStack || '',
          `Auto-captured from ${source || 'unknown'}`,
          location.pathname
        );
      } catch (reportError) {
        console.error('[GlobalErrorHandler] Failed to auto-report:', reportError);
      }

      // Show dialog so user can add context
      setCapturedError({
        message: errorMessage,
        stack: errorStack,
      });
      setDialogOpen(true);
    },
    [location.pathname]
  );

  useEffect(() => {
    // Handle uncaught errors
    const handleWindowError = (event: ErrorEvent) => {
      event.preventDefault();
      handleError(event.error || event.message, 'window.onerror');
    };

    // Handle unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      event.preventDefault();
      const error =
        event.reason instanceof Error
          ? event.reason
          : new Error(String(event.reason));
      handleError(error, 'unhandledrejection');
    };

    window.addEventListener('error', handleWindowError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [handleError]);

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setCapturedError(null);
    }
  };

  return (
    <>
      {children}
      <ReportIssueDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        prefillError={capturedError || undefined}
      />
    </>
  );
}
