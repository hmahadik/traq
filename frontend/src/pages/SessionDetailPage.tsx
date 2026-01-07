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
              {formatTimeRange(session.startTime, session.endTime ?? session.startTime)} ({formatDuration(session.durationSeconds ?? 0)})
            </p>
          </div>
          <div className="flex gap-2 items-center">
            {summary?.confidence && (
              <Badge variant={summary.confidence === 'high' ? 'default' : 'secondary'}>
                {summary.confidence} confidence
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
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>{summary.summary}</p>
            {summary.explanation && (
              <div className="text-sm text-muted-foreground">
                <strong>Explanation:</strong> {summary.explanation}
              </div>
            )}
            <div className="flex gap-2">
              {summary.tags.map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
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
                    <p className="text-xs text-muted-foreground">{cmd.workingDirectory}</p>
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
                      {commit.repositoryName} ({commit.shortHash})
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground text-right">
                    <span className="text-green-500">+{commit.insertions}</span>{' '}
                    <span className="text-red-500">-{commit.deletions}</span>
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
                    <p className="font-medium text-sm truncate">{visit.title}</p>
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
