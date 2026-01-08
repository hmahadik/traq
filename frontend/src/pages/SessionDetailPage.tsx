import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSessionContext, useRegenerateSummary, useDeleteSession } from '@/api/hooks';
import { formatTimeRange, formatDuration, formatTimestamp } from '@/lib/utils';
import { Terminal, GitCommit, FileText, Globe, ArrowLeft, RefreshCw, Trash2 } from 'lucide-react';
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

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
              {formatTimeRange(session.startTime, session.endTime?.Int64 ?? session.startTime)} ({formatDuration(session.durationSeconds?.Int64 ?? 0)})
            </p>
          </div>
          <div className="flex gap-2 items-center">
            {summary?.confidence?.Valid && (
              <Badge variant={summary.confidence.String === 'high' ? 'default' : 'secondary'}>
                {summary.confidence.String} confidence
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
          {summary.explanation?.Valid && (
            <CollapsibleSection title="Model Explanation" defaultOpen={false}>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  This section shows how the AI model analyzed the session and arrived at the summary above.
                </p>
                <div className="p-4 bg-muted/30 rounded-md">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{summary.explanation.String}</p>
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
                <p className="font-mono">{summary.inferenceTimeMs?.Valid ? `${summary.inferenceTimeMs.Int64}ms` : 'N/A'}</p>
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
                  {summary.contextJson?.Valid && summary.contextJson.String
                    ? JSON.stringify(JSON.parse(summary.contextJson.String), null, 2)
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
                    <span className="font-mono">{summary.sessionId?.Int64 ?? 'N/A'}</span>
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
                    <span className="font-mono">{summary.inferenceTimeMs?.Valid ? `${summary.inferenceTimeMs.Int64}ms` : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Session:</span>
                    <span className="font-mono">#{summary.sessionId?.Int64 ?? 'N/A'}</span>
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

      {/* Screenshots */}
      <Card>
        <CardHeader>
          <CardTitle>Screenshots ({safeScreenshots.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-2">
            {safeScreenshots.map((screenshot) => (
              <Screenshot
                key={screenshot.id}
                screenshot={screenshot}
                size="thumbnail"
                showOverlay={true}
              />
            ))}
          </div>
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
                    <p className="text-xs text-muted-foreground">{cmd.workingDirectory?.String || ''}</p>
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
                    <span className="text-green-500">+{commit.insertions?.Int64 ?? 0}</span>{' '}
                    <span className="text-red-500">-{commit.deletions?.Int64 ?? 0}</span>
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
                    <p className="font-medium text-sm truncate">{visit.title?.String || visit.url}</p>
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
