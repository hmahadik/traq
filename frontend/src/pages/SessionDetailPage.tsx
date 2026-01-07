import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useSessionContext } from '@/api/hooks';
import { formatTimeRange, formatDuration, formatTimestamp } from '@/lib/utils';
import { Terminal, GitCommit, FileText, Globe, ArrowLeft } from 'lucide-react';
import { Screenshot } from '@/components/common/Screenshot';

export function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const sessionId = parseInt(id || '0', 10);
  const { data: context, isLoading } = useSessionContext(sessionId);

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
          <div className="flex gap-2">
            {summary?.confidence && (
              <Badge variant={summary.confidence === 'high' ? 'default' : 'secondary'}>
                {summary.confidence} confidence
              </Badge>
            )}
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
          <CardTitle>Screenshots ({screenshots.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-2">
            {screenshots.slice(0, 10).map((screenshot) => (
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
              <TabsTrigger value="focus">Focus ({focusEvents.length})</TabsTrigger>
              <TabsTrigger value="shell">Shell ({shellCommands.length})</TabsTrigger>
              <TabsTrigger value="git">Git ({gitCommits.length})</TabsTrigger>
              <TabsTrigger value="files">Files ({fileEvents.length})</TabsTrigger>
              <TabsTrigger value="browser">Browser ({browserVisits.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="focus" className="mt-4 space-y-2">
              {focusEvents.map((event) => (
                <div key={event.id} className="flex items-center gap-3 p-2 rounded-lg border">
                  <div className="flex-1">
                    <p className="font-medium">{event.appName}</p>
                    <p className="text-sm text-muted-foreground truncate">{event.windowTitle}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatDuration(event.durationSeconds)}
                  </p>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="shell" className="mt-4 space-y-2">
              {shellCommands.map((cmd) => (
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
              {gitCommits.map((commit) => (
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
              {fileEvents.map((event) => (
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
              {browserVisits.map((visit) => (
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
    </div>
  );
}
