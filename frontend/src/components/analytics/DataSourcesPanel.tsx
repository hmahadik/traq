import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Terminal, GitCommit, FileText, Globe } from 'lucide-react';
import type { DataSourceStats } from '@/types';

interface DataSourcesPanelProps {
  data: DataSourceStats | undefined;
  isLoading: boolean;
}

export function DataSourcesPanel({ data, isLoading }: DataSourcesPanelProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Data Sources</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data Sources</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="shell">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="shell" className="gap-1">
              <Terminal className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Shell</span>
            </TabsTrigger>
            <TabsTrigger value="git" className="gap-1">
              <GitCommit className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Git</span>
            </TabsTrigger>
            <TabsTrigger value="files" className="gap-1">
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Files</span>
            </TabsTrigger>
            <TabsTrigger value="browser" className="gap-1">
              <Globe className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Browser</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="shell" className="mt-4">
            {data?.shell ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Commands</span>
                  <Badge variant="secondary">{data.shell.totalCommands}</Badge>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Top Commands</h4>
                  {data.shell.topCommands?.map((cmd) => (
                    <div
                      key={cmd.command}
                      className="flex items-center justify-between p-2 rounded-lg border"
                    >
                      <code className="text-sm font-mono">{cmd.command}</code>
                      <span className="text-sm text-muted-foreground">{cmd.count}x</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No shell data available
              </p>
            )}
          </TabsContent>

          <TabsContent value="git" className="mt-4">
            {data?.git ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Commits</span>
                  <Badge variant="secondary">{data.git.totalCommits}</Badge>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Repositories</h4>
                  {data.git.topRepos?.map((repo) => (
                    <div
                      key={repo.repoName}
                      className="flex items-center justify-between p-2 rounded-lg border"
                    >
                      <div>
                        <p className="text-sm font-medium">{repo.repoName}</p>
                        <p className="text-xs text-muted-foreground">
                          +{repo.insertions} / -{repo.deletions} lines
                        </p>
                      </div>
                      <Badge variant="outline">{repo.commitCount} commits</Badge>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No git data available
              </p>
            )}
          </TabsContent>

          <TabsContent value="files" className="mt-4">
            {data?.files ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Events</span>
                  <Badge variant="secondary">{data.files.totalEvents}</Badge>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">By Event Type</h4>
                  {data.files.eventsByType && Object.entries(data.files.eventsByType).map(([type, count]) => (
                    <div
                      key={type}
                      className="flex items-center justify-between p-2 rounded-lg border"
                    >
                      <span className="text-sm capitalize">{type}</span>
                      <Badge variant="outline">{count} events</Badge>
                    </div>
                  ))}
                </div>
                {data.files.topExtensions && Object.keys(data.files.topExtensions).length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Top Extensions</h4>
                    {Object.entries(data.files.topExtensions).slice(0, 5).map(([ext, count]) => (
                      <div
                        key={ext}
                        className="flex items-center justify-between p-2 rounded-lg border"
                      >
                        <code className="text-sm font-mono">{ext || '(no ext)'}</code>
                        <Badge variant="outline">{count} files</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No file data available
              </p>
            )}
          </TabsContent>

          <TabsContent value="browser" className="mt-4">
            {data?.browser ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Visits</span>
                  <Badge variant="secondary">{data.browser.totalVisits}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Unique Domains</span>
                  <Badge variant="secondary">{data.browser.uniqueDomains}</Badge>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Top Domains</h4>
                  {data.browser.topDomains?.map((domain) => (
                    <div
                      key={domain.domain}
                      className="flex items-center justify-between p-2 rounded-lg border"
                    >
                      <span className="text-sm">{domain.domain}</span>
                      <Badge variant="outline">{domain.visitCount} visits</Badge>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No browser data available
              </p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
