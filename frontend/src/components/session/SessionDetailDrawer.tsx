import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useSessionContext, useScreenshotsForSession, useRegenerateSummary, useDeleteSummary, useDeleteSession, useDeleteScreenshot } from '@/api/hooks';
import { formatTimeRange, formatDuration, formatTimestamp, getNullableInt, getNullableString, isNullableValid } from '@/lib/utils';
import { Terminal, GitCommit, FileText, Globe, RefreshCw, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Screenshot } from '@/components/common/Screenshot';
import { ActivityLogTable } from '@/components/session/ActivityLogTable';
import { CollapsibleSection } from '@/components/session/CollapsibleSection';
import { toast } from 'sonner';

interface SessionDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: number | null;
}

export function SessionDetailDrawer({ open, onOpenChange, sessionId }: SessionDetailDrawerProps) {
  const { data: context, isLoading, refetch } = useSessionContext(sessionId || 0);
  const regenerateMutation = useRegenerateSummary();
  const deleteSummaryMutation = useDeleteSummary();
  const deleteMutation = useDeleteSession();
  const deleteScreenshotMutation = useDeleteScreenshot();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingScreenshotId, setDeletingScreenshotId] = useState<number | null>(null);

  // Pagination state for screenshots
  const [screenshotPage, setScreenshotPage] = useState(1);
  const [screenshotsPerPage, setScreenshotsPerPage] = useState(20);
  const { data: screenshotData, isLoading: screenshotsLoading, refetch: refetchScreenshots } = useScreenshotsForSession(
    sessionId || 0,
    screenshotPage,
    screenshotsPerPage
  );

  const handleRegenerateSummary = async () => {
    if (!sessionId) return;
    try {
      await regenerateMutation.mutateAsync(sessionId);
      toast.success('Summary regenerated successfully');
      refetch();
    } catch (error) {
      toast.error('Failed to regenerate summary');
      console.error('Regenerate summary error:', error);
    }
  };

  const handleDeleteSummary = async () => {
    if (!context?.summary?.id) return;

    if (confirm('Delete this AI summary? You can regenerate it later.')) {
      try {
        await deleteSummaryMutation.mutateAsync(context.summary.id);
        refetch();
      } catch (error) {
        console.error('Delete summary error:', error);
      }
    }
  };

  const handleDeleteSession = async () => {
    if (!sessionId) return;
    try {
      await deleteMutation.mutateAsync(sessionId);
      toast.success('Session deleted successfully');
      setDeleteDialogOpen(false);
      onOpenChange(false); // Close drawer instead of navigate
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
      refetch();
      refetchScreenshots();
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
    setScreenshotPage(1);
  };

  if (!sessionId) return null;

  const session = context?.session;
  const summary = context?.summary;
  const safeScreenshots = context?.screenshots || [];
  const safeFocusEvents = context?.focusEvents || [];
  const safeShellCommands = context?.shellCommands || [];
  const safeGitCommits = context?.gitCommits || [];
  const safeFileEvents = context?.fileEvents || [];
  const safeBrowserVisits = context?.browserVisits || [];

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-4xl p-0 flex flex-col">
          <SheetHeader className="px-6 py-4 border-b">
            <SheetTitle>Session {sessionId}</SheetTitle>
            {session && (
              <SheetDescription>
                {(() => {
                  const isOngoing = session.endTime === null;
                  const duration = isOngoing
                    ? Math.floor(Date.now() / 1000) - session.startTime
                    : getNullableInt(session.durationSeconds, 0);
                  const endTime = getNullableInt(session.endTime, session.startTime);

                  return (
                    <>
                      {formatTimeRange(session.startTime, endTime)} ({formatDuration(duration)})
                      {isOngoing && <span className="ml-2 text-xs text-yellow-500">• Ongoing</span>}
                    </>
                  );
                })()}
              </SheetDescription>
            )}
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {isLoading ? (
              <div className="space-y-6">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-[400px] w-full" />
              </div>
            ) : !context ? (
              <div className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">Session not found</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Summary */}
                {summary && (
                  <>
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle>Summary</CardTitle>
                          <div className="flex gap-2 items-center">
                            {isNullableValid(summary?.confidence) && (
                              <Badge variant={getNullableString(summary?.confidence) === 'high' ? 'default' : 'secondary'}>
                                {getNullableString(summary?.confidence)} confidence
                              </Badge>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleRegenerateSummary}
                              disabled={regenerateMutation.isPending}
                            >
                              <RefreshCw className={`h-4 w-4 ${regenerateMutation.isPending ? 'animate-spin' : ''}`} />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleDeleteSummary}
                              disabled={deleteSummaryMutation.isPending}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <p className="text-sm leading-relaxed">{summary.summary}</p>
                        <div className="flex gap-2 flex-wrap">
                          {summary.tags.map((tag) => (
                            <Badge key={tag} variant="outline">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Project Breakdown */}
                    {summary.projects && summary.projects.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle>Project Breakdown</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {summary.projects.map((project, idx) => {
                            const hours = Math.floor(project.timeMinutes / 60);
                            const mins = project.timeMinutes % 60;
                            const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

                            return (
                              <div key={idx} className="border rounded-lg p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                  <h4 className="font-semibold text-sm">{project.name}</h4>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="font-mono text-xs">{timeStr}</Badge>
                                    {project.confidence && (
                                      <Badge variant={project.confidence === 'high' ? 'default' : 'secondary'}>
                                        {project.confidence}
                                      </Badge>
                                    )}
                                  </div>
                                </div>

                                {project.activities && project.activities.length > 0 && (
                                  <div>
                                    <h5 className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                                      Activities
                                    </h5>
                                    <ul className="space-y-1.5">
                                      {project.activities.map((activity, actIdx) => (
                                        <li key={actIdx} className="text-sm flex items-start gap-2">
                                          <span className="text-muted-foreground mt-1">•</span>
                                          <span className="flex-1">{activity}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </CardContent>
                      </Card>
                    )}

                    {/* Collapsible Sections */}
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

                    <CollapsibleSection title="API Request Context" defaultOpen={false}>
                      <div className="space-y-3">
                        <p className="text-xs text-muted-foreground">
                          This shows the actual session context data sent to the AI model for analysis.
                        </p>
                        {isNullableValid(summary.contextJson) && getNullableString(summary.contextJson) ? (
                          <div className="space-y-3">
                            {(() => {
                              try {
                                const ctx = JSON.parse(getNullableString(summary.contextJson));
                                return (
                                  <div className="space-y-3">
                                    {/* Session Stats */}
                                    <div className="grid grid-cols-3 gap-3 p-3 bg-muted/30 rounded-md text-xs">
                                      <div>
                                        <span className="text-muted-foreground">Duration:</span>
                                        <span className="ml-1 font-mono">{Math.floor(ctx.DurationSeconds / 60)}m</span>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Screenshots:</span>
                                        <span className="ml-1 font-mono">{ctx.ScreenshotCount}</span>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Top Apps:</span>
                                        <span className="ml-1 font-mono">{ctx.TopApps?.length || 0}</span>
                                      </div>
                                    </div>

                                    {/* Activity Counts */}
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                      {ctx.FocusEvents?.length > 0 && (
                                        <div className="p-2 bg-muted/20 rounded">
                                          <span className="text-muted-foreground">Focus Events:</span>
                                          <span className="ml-1 font-semibold">{ctx.FocusEvents.length}</span>
                                        </div>
                                      )}
                                      {ctx.ShellCommands?.length > 0 && (
                                        <div className="p-2 bg-muted/20 rounded">
                                          <span className="text-muted-foreground">Shell Commands:</span>
                                          <span className="ml-1 font-semibold">{ctx.ShellCommands.length}</span>
                                        </div>
                                      )}
                                      {ctx.GitCommits?.length > 0 && (
                                        <div className="p-2 bg-muted/20 rounded">
                                          <span className="text-muted-foreground">Git Commits:</span>
                                          <span className="ml-1 font-semibold">{ctx.GitCommits.length}</span>
                                        </div>
                                      )}
                                      {ctx.FileEvents?.length > 0 && (
                                        <div className="p-2 bg-muted/20 rounded">
                                          <span className="text-muted-foreground">File Events:</span>
                                          <span className="ml-1 font-semibold">{ctx.FileEvents.length}</span>
                                        </div>
                                      )}
                                      {ctx.BrowserVisits?.length > 0 && (
                                        <div className="p-2 bg-muted/20 rounded">
                                          <span className="text-muted-foreground">Browser Visits:</span>
                                          <span className="ml-1 font-semibold">{ctx.BrowserVisits.length}</span>
                                        </div>
                                      )}
                                    </div>

                                    {/* Raw JSON (collapsed) */}
                                    <details className="text-xs">
                                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                        View Raw JSON
                                      </summary>
                                      <pre className="mt-2 p-3 bg-muted/30 rounded-md overflow-x-auto text-xs font-mono max-h-60">
                                        {JSON.stringify(ctx, null, 2)}
                                      </pre>
                                    </details>
                                  </div>
                                );
                              } catch (e) {
                                return (
                                  <p className="text-xs text-muted-foreground">Failed to parse context JSON</p>
                                );
                              }
                            })()}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            No context data available (summary may have been generated with an older version)
                          </p>
                        )}
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
                            </SelectContent>
                          </Select>
                        </div>
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
                            <span className="text-sm text-muted-foreground">
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
                      <div className="grid grid-cols-4 gap-2">
                        {Array.from({ length: screenshotsPerPage }).map((_, i) => (
                          <Skeleton key={i} className="aspect-video rounded-md" />
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 gap-2">
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
                        <div className="max-h-96 overflow-y-auto">
                          <ActivityLogTable focusEvents={safeFocusEvents} />
                        </div>
                      </TabsContent>

                      <TabsContent value="shell" className="mt-4">
                        <div className="max-h-96 overflow-y-auto space-y-2">
                          {safeShellCommands.slice(0, 50).map((cmd) => (
                            <div key={cmd.id} className="flex items-center gap-3 p-2 rounded-lg border text-sm">
                              <Terminal className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <code className="text-xs truncate block">{cmd.command}</code>
                              </div>
                              <p className="text-xs text-muted-foreground flex-shrink-0">
                                {new Date(cmd.timestamp * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                              </p>
                            </div>
                          ))}
                          {safeShellCommands.length > 50 && (
                            <p className="text-xs text-muted-foreground text-center py-2">
                              Showing 50 of {safeShellCommands.length} commands
                            </p>
                          )}
                        </div>
                      </TabsContent>

                      <TabsContent value="git" className="mt-4">
                        <div className="max-h-96 overflow-y-auto space-y-2">
                          {safeGitCommits.slice(0, 30).map((commit) => (
                            <div key={commit.id} className="flex items-center gap-2 p-2 rounded-lg border text-sm">
                              <GitCommit className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-xs truncate">{commit.messageSubject}</p>
                              </div>
                              <div className="text-xs flex-shrink-0">
                                <span className="text-green-500">+{getNullableInt(commit.insertions, 0)}</span>{' '}
                                <span className="text-red-500">-{getNullableInt(commit.deletions, 0)}</span>
                              </div>
                            </div>
                          ))}
                          {safeGitCommits.length > 30 && (
                            <p className="text-xs text-muted-foreground text-center py-2">
                              Showing 30 of {safeGitCommits.length} commits
                            </p>
                          )}
                        </div>
                      </TabsContent>

                      <TabsContent value="files" className="mt-4">
                        <div className="max-h-96 overflow-y-auto space-y-2">
                          {safeFileEvents.slice(0, 50).map((event) => (
                            <div key={event.id} className="flex items-center gap-2 p-2 rounded-lg border text-sm">
                              <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-xs truncate">{event.fileName}</p>
                              </div>
                              <Badge variant="outline" className="text-xs flex-shrink-0">
                                {event.eventType}
                              </Badge>
                            </div>
                          ))}
                          {safeFileEvents.length > 50 && (
                            <p className="text-xs text-muted-foreground text-center py-2">
                              Showing 50 of {safeFileEvents.length} file events
                            </p>
                          )}
                        </div>
                      </TabsContent>

                      <TabsContent value="browser" className="mt-4">
                        <div className="max-h-96 overflow-y-auto space-y-2">
                          {safeBrowserVisits.slice(0, 50).map((visit) => (
                            <div key={visit.id} className="flex items-center gap-2 p-2 rounded-lg border text-sm">
                              <Globe className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-xs truncate">{getNullableString(visit.title, visit.url)}</p>
                                <p className="text-xs text-muted-foreground truncate">{visit.domain}</p>
                              </div>
                              <p className="text-xs text-muted-foreground flex-shrink-0">
                                {new Date(visit.timestamp * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                              </p>
                            </div>
                          ))}
                          {safeBrowserVisits.length > 50 && (
                            <p className="text-xs text-muted-foreground text-center py-2">
                              Showing 50 of {safeBrowserVisits.length} visits
                            </p>
                          )}
                        </div>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>

                {/* Delete Session - Danger Zone */}
                <Card className="border-destructive/50">
                  <CardHeader>
                    <CardTitle className="text-sm text-destructive">Danger Zone</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Delete this session</p>
                        <p className="text-xs text-muted-foreground">Permanently delete this session, all screenshots, and summaries</p>
                      </div>
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
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Session Confirmation Dialog */}
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
    </>
  );
}
