import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSessionContext, useScreenshotsForSession, useRegenerateSummary, useDeleteSession, useDeleteScreenshot } from '@/api/hooks';
import { formatTimeRange, formatDuration, formatTimestamp, getNullableInt, getNullableString, isNullableValid } from '@/lib/utils';
import { Terminal, GitCommit, FileText, Globe, ArrowLeft, RefreshCw, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Screenshot } from '@/components/common/Screenshot';
import { ActivityLogTable } from '@/components/session/ActivityLogTable';
import { CollapsibleSection } from '@/components/session/CollapsibleSection';
import { toast } from 'sonner';

export function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const sessionId = parseInt(id || '0', 10);
  const { data: context, isLoading, refetch } = useSessionContext(sessionId);
  const regenerateMutation = useRegenerateSummary();
  const deleteMutation = useDeleteSession();
  const deleteScreenshotMutation = useDeleteScreenshot();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingScreenshotId, setDeletingScreenshotId] = useState<number | null>(null);

  // Pagination state for screenshots
  const [screenshotPage, setScreenshotPage] = useState(1);
  const [screenshotsPerPage, setScreenshotsPerPage] = useState(20);
  const { data: screenshotData, isLoading: screenshotsLoading, refetch: refetchScreenshots } = useScreenshotsForSession(
    sessionId,
    screenshotPage,
    screenshotsPerPage
  );

  const handleRegenerateSummary = async () => {
    try {
      await regenerateMutation.mutateAsync(sessionId);
      toast.success('Summary regenerated successfully');
      refetch(); // Refetch the session context to get the new summary
    } catch (error) {
      toast.error('Failed to regenerate summary');
      console.error('Regenerate summary error:', error);
    }
  };

  const handleDeleteSession = async () => {
    try {
      await deleteMutation.mutateAsync(sessionId);
      toast.success('Session deleted successfully');
      setDeleteDialogOpen(false);
      navigate('/timeline'); // Navigate back to timeline
    } catch (error) {
      toast.error('Failed to delete session');
      console.error('Delete session error:', error);
    }
  };

  const handleDeleteScreenshot = async (screenshotId: number) => {
    try {
      setDeletingScreenshotId(screenshotId);
      await deleteScreenshotMutation.mutateAsync(screenshotId);
      toast.success('Screenshot deleted successfully');
      refetch(); // Refetch the session context
      refetchScreenshots(); // Refetch the paginated screenshots
    } catch (error) {
      toast.error('Failed to delete screenshot');
      console.error('Delete screenshot error:', error);
    } finally {
      setDeletingScreenshotId(null);
    }
  };

  // Pagination handlers
  const handlePreviousPage = () => {
    if (screenshotPage > 1) {
      setScreenshotPage(screenshotPage - 1);
    }
  };

  const handleNextPage = () => {
    if (screenshotData && screenshotData.hasMore) {
      setScreenshotPage(screenshotPage + 1);
    }
  };

  const handlePerPageChange = (value: string) => {
    const newPerPage = parseInt(value, 10);
    setScreenshotsPerPage(newPerPage);
    setScreenshotPage(1); // Reset to first page when changing items per page
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!context) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Session not found</p>
      </div>
    );
  }

  const { session, summary, screenshots, focusEvents, shellCommands, gitCommits, fileEvents, browserVisits } = context;

  // Defensive null checks - provide empty arrays if data is missing
  const safeScreenshots = screenshots || [];
  const safeFocusEvents = focusEvents || [];
  const safeShellCommands = shellCommands || [];
  const safeGitCommits = gitCommits || [];
  const safeFileEvents = fileEvents || [];
  const safeBrowserVisits = browserVisits || [];

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link to="/timeline" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Timeline
          </Link>
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Session {session.id}
            </h1>
            <p className="text-muted-foreground">
              {formatTimeRange(session.startTime, getNullableInt(session.endTime, session.startTime))} ({formatDuration(getNullableInt(session.durationSeconds, 0))})
            </p>
          </div>
          <div className="flex gap-2 items-center">
            {isNullableValid(summary?.confidence) && (
              <Badge variant={getNullableString(summary?.confidence) === 'high' ? 'default' : 'secondary'}>
                {getNullableString(summary?.confidence)} confidence
              </Badge>
            )}
            {summary && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRegenerateSummary}
                disabled={regenerateMutation.isPending}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${regenerateMutation.isPending ? 'animate-spin' : ''}`} />
                {regenerateMutation.isPending ? 'Regenerating...' : 'Regenerate Summary'}
              </Button>
            )}
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteDialogOpen(true)}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Session
            </Button>
          </div>
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-base leading-relaxed">{summary.summary}</p>
              <div className="flex gap-2 flex-wrap">
                {summary.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Model Explanation Section - Test #22 */}
          {isNullableValid(summary.explanation) && (
            <CollapsibleSection title="Model Explanation" defaultOpen={false}>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  This section shows how the AI model analyzed the session and arrived at the summary above.
                </p>
                <div className="p-4 bg-muted/30 rounded-md">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{getNullableString(summary.explanation)}</p>
                </div>
              </div>
            </CollapsibleSection>
          )}

          {/* Generation Details Section - Test #24 */}
          <CollapsibleSection title="Generation Details" defaultOpen={false}>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Model Name</p>
                <p className="font-mono">{summary.modelUsed || 'N/A'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Inference Time</p>
                <p className="font-mono">{isNullableValid(summary.inferenceTimeMs) ? `${getNullableInt(summary.inferenceTimeMs)}ms` : 'N/A'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Generated At</p>
                <p className="font-mono">{formatTimestamp(summary.createdAt)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Summary ID</p>
                <p className="font-mono">#{summary.id}</p>
              </div>
            </div>
          </CollapsibleSection>

          {/* API Request Details Section - Test #23 */}
          <CollapsibleSection title="API Request Details" defaultOpen={false}>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  This section shows the data sent to the AI model for analysis.
                </p>
              </div>

              {/* Screenshot IDs used */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Screenshots Used</h4>
                {summary.screenshotIds && summary.screenshotIds.length > 0 ? (
                  <div className="flex gap-2 flex-wrap">
                    {summary.screenshotIds.map((id) => (
                      <Badge key={id} variant="secondary" className="font-mono">
                        #{id}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No screenshot IDs recorded</p>
                )}
              </div>

              {/* Context JSON */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Request Context</h4>
                <pre className="p-4 bg-muted/30 rounded-md overflow-x-auto text-xs font-mono">
                  {isNullableValid(summary.contextJson) && getNullableString(summary.contextJson)
                    ? JSON.stringify(JSON.parse(getNullableString(summary.contextJson)), null, 2)
                    : '{}'}
                </pre>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Model Configuration</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between p-2 bg-muted/20 rounded">
                    <span className="text-muted-foreground">Model:</span>
                    <span className="font-mono">{summary.modelUsed}</span>
                  </div>
                  <div className="flex justify-between p-2 bg-muted/20 rounded">
                    <span className="text-muted-foreground">Session ID:</span>
                    <span className="font-mono">{isNullableValid(summary.sessionId) ? getNullableInt(summary.sessionId) : 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>
          </CollapsibleSection>

          {/* Config Snapshot Section - Test #25 */}
          <CollapsibleSection title="Config Snapshot" defaultOpen={false}>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Configuration settings at the time this summary was generated.
              </p>
              <div className="p-4 bg-muted/30 rounded-md">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Generated At:</span>
                    <span className="font-mono">{formatTimestamp(summary.createdAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Model:</span>
                    <span className="font-mono">{summary.modelUsed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Inference Time:</span>
                    <span className="font-mono">{isNullableValid(summary.inferenceTimeMs) ? `${getNullableInt(summary.inferenceTimeMs)}ms` : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Session:</span>
                    <span className="font-mono">#{isNullableValid(summary.sessionId) ? getNullableInt(summary.sessionId) : 'N/A'}</span>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-border/50">
                  <p className="text-xs text-muted-foreground italic">
                    Note: Full application config snapshot would be stored here in a production implementation.
                    This includes capture settings, sampling parameters, and AI model configuration.
                  </p>
                </div>
              </div>
            </div>
          </CollapsibleSection>
        </>
      )}

      {/* Screenshots with Pagination */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Screenshots ({screenshotData?.total ?? safeScreenshots.length})</CardTitle>
            <div className="flex items-center gap-4">
              {/* Per page selector */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Per page:</span>
                <Select value={screenshotsPerPage.toString()} onValueChange={handlePerPageChange}>
                  <SelectTrigger className="w-[70px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* Pagination controls */}
              {screenshotData && screenshotData.total > screenshotsPerPage && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePreviousPage}
                    disabled={screenshotPage === 1 || screenshotsLoading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground min-w-[80px] text-center">
                    Page {screenshotPage} of {Math.ceil(screenshotData.total / screenshotsPerPage)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNextPage}
                    disabled={!screenshotData.hasMore || screenshotsLoading}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {screenshotsLoading ? (
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: screenshotsPerPage }).map((_, i) => (
                <Skeleton key={i} className="aspect-video rounded-md" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-2">
              {(screenshotData?.screenshots ?? safeScreenshots).map((screenshot) => (
                <Screenshot
                  key={screenshot.id}
                  screenshot={screenshot}
                  size="thumbnail"
                  showOverlay={true}
                  onDelete={handleDeleteScreenshot}
                  isDeleting={deletingScreenshotId === screenshot.id}
                />
              ))}
            </div>
          )}
          {/* Bottom pagination info */}
          {screenshotData && screenshotData.total > 0 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t text-sm text-muted-foreground">
              <span>
                Showing {((screenshotPage - 1) * screenshotsPerPage) + 1}-{Math.min(screenshotPage * screenshotsPerPage, screenshotData.total)} of {screenshotData.total} screenshots
              </span>
              {screenshotData.total > screenshotsPerPage && (
                <span>
                  {Math.ceil(screenshotData.total / screenshotsPerPage)} pages total
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="focus">
            <TabsList>
              <TabsTrigger value="focus">Focus ({safeFocusEvents.length})</TabsTrigger>
              <TabsTrigger value="shell">Shell ({safeShellCommands.length})</TabsTrigger>
              <TabsTrigger value="git">Git ({safeGitCommits.length})</TabsTrigger>
              <TabsTrigger value="files">Files ({safeFileEvents.length})</TabsTrigger>
              <TabsTrigger value="browser">Browser ({safeBrowserVisits.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="focus" className="mt-4">
              <ActivityLogTable focusEvents={safeFocusEvents} />
            </TabsContent>

            <TabsContent value="shell" className="mt-4 space-y-2">
              {safeShellCommands.map((cmd) => (
                <div key={cmd.id} className="flex items-center gap-3 p-2 rounded-lg border">
                  <Terminal className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <code className="text-sm">{cmd.command}</code>
                    <p className="text-xs text-muted-foreground">{getNullableString(cmd.workingDirectory)}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatTimestamp(cmd.timestamp)}
                  </p>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="git" className="mt-4 space-y-2">
              {safeGitCommits.map((commit) => (
                <div key={commit.id} className="flex items-center gap-3 p-2 rounded-lg border">
                  <GitCommit className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{commit.messageSubject}</p>
                    <p className="text-xs text-muted-foreground">
                      {commit.repositoryId} ({commit.shortHash})
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground text-right">
                    <span className="text-green-500">+{getNullableInt(commit.insertions, 0)}</span>{' '}
                    <span className="text-red-500">-{getNullableInt(commit.deletions, 0)}</span>
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="files" className="mt-4 space-y-2">
              {safeFileEvents.map((event) => (
                <div key={event.id} className="flex items-center gap-3 p-2 rounded-lg border">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{event.fileName}</p>
                    <p className="text-xs text-muted-foreground">{event.directory}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {event.eventType}
                  </Badge>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="browser" className="mt-4 space-y-2">
              {safeBrowserVisits.map((visit) => (
                <div key={visit.id} className="flex items-center gap-3 p-2 rounded-lg border">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="font-medium text-sm truncate">{getNullableString(visit.title, visit.url)}</p>
                    <p className="text-xs text-muted-foreground">{visit.domain}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatTimestamp(visit.timestamp)}
                  </p>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Session</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this session? This action cannot be undone.
              All screenshots, summaries, and related data will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteSession}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Session'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
