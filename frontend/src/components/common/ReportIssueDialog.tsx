import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Bug, AlertTriangle, Send, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useReportIssue } from '@/api/hooks';

interface ReportIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fill error details for crash reports */
  prefillError?: {
    message: string;
    stack?: string;
  };
}

export function ReportIssueDialog({
  open,
  onOpenChange,
  prefillError,
}: ReportIssueDialogProps) {
  const location = useLocation();
  const [description, setDescription] = useState('');
  const reportIssue = useReportIssue();

  const isCrashReport = !!prefillError;
  const reportType = isCrashReport ? 'crash' : 'manual';

  const handleSubmit = async () => {
    await reportIssue.mutateAsync({
      reportType,
      errorMessage: prefillError?.message || '',
      stackTrace: prefillError?.stack || '',
      userDescription: description,
      pageRoute: location.pathname,
    });

    // Reset and close on success
    setDescription('');
    onOpenChange(false);
  };

  const handleClose = () => {
    setDescription('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isCrashReport ? (
              <>
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Report Crash
              </>
            ) : (
              <>
                <Bug className="h-5 w-5 text-orange-500" />
                Report Issue
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isCrashReport
              ? 'An error occurred. Help us fix it by providing additional context.'
              : 'Found a bug or have feedback? Let us know what happened.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Error details (for crash reports) */}
          {prefillError && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Error Details
              </label>
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
                <p className="text-sm font-mono text-destructive break-all">
                  {prefillError.message}
                </p>
                {prefillError.stack && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                      Stack trace
                    </summary>
                    <pre className="mt-2 max-h-32 overflow-auto text-xs text-muted-foreground whitespace-pre-wrap">
                      {prefillError.stack}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          )}

          {/* User description */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {isCrashReport ? 'What were you doing?' : 'Describe the issue'}
            </label>
            <Textarea
              placeholder={
                isCrashReport
                  ? 'I was trying to... when the error occurred'
                  : 'Describe what happened, what you expected, and steps to reproduce...'
              }
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>

          {/* Context info */}
          <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
            <p className="font-medium mb-1">Additional context included:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Current page: {location.pathname}</li>
              <li>Screenshots from the last 60 seconds</li>
              <li>Current session info</li>
              <li>App version</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={reportIssue.isPending}
          >
            {reportIssue.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Submit Report
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
