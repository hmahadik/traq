import { useState, useEffect } from 'react';
import { GitBranch, Plus, Trash2, FolderGit, ExternalLink, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { git, type GitRepository } from '@/api/client';
import { useConfig, useUpdateConfig } from '@/api/hooks';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';

export function GitRepositoriesSection() {
  const { data: config } = useConfig();
  const updateConfig = useUpdateConfig();
  const [repos, setRepos] = useState<GitRepository[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPath, setNewPath] = useState('');
  const [adding, setAdding] = useState(false);
  const [discovering, setDiscovering] = useState(false);

  const loadRepos = async () => {
    try {
      setLoading(true);
      const result = await git.getTrackedRepositories();
      setRepos(result);
    } catch (error) {
      console.error('Failed to load repositories:', error);
      toast.error('Failed to load repositories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRepos();
  }, []);

  const handleAddRepo = async () => {
    if (!newPath.trim()) {
      toast.error('Please enter a repository path');
      return;
    }

    try {
      setAdding(true);
      const repo = await git.registerRepository(newPath.trim());
      setRepos((prev) => [...prev, repo]);
      setNewPath('');
      toast.success(`Added repository: ${repo.name}`);
    } catch (error) {
      console.error('Failed to add repository:', error);
      toast.error('Failed to add repository', {
        description: error instanceof Error ? error.message : 'Invalid git repository path',
      });
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveRepo = async (repo: GitRepository) => {
    try {
      await git.unregisterRepository(repo.id);
      setRepos((prev) => prev.filter((r) => r.id !== repo.id));
      toast.success(`Removed repository: ${repo.name}`);
    } catch (error) {
      console.error('Failed to remove repository:', error);
      toast.error('Failed to remove repository');
    }
  };

  const handleDiscover = async () => {
    if (!config?.dataSources.git.searchPaths?.length) {
      toast.error('No search paths configured', {
        description: 'Add at least one search path below before discovering',
      });
      return;
    }

    try {
      setDiscovering(true);
      const maxDepth = config?.dataSources.git.maxDepth || 3;
      const discovered = await git.discoverRepositories(
        config.dataSources.git.searchPaths,
        maxDepth
      );

      if (discovered.length > 0) {
        setRepos((prev) => [...prev, ...discovered]);
        toast.success(`Discovered ${discovered.length} new repositories`);
      } else {
        toast.info('No new repositories found', {
          description: 'All repositories in search paths are already tracked',
        });
      }
    } catch (error) {
      console.error('Failed to discover repositories:', error);
      toast.error('Failed to discover repositories');
    } finally {
      setDiscovering(false);
    }
  };

  const formatLastScanned = (lastScanned: GitRepository['lastScanned']) => {
    if (!lastScanned?.Valid) return 'Never';
    const date = new Date(lastScanned.Int64 * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const getRemoteUrl = (remoteUrl: GitRepository['remoteUrl']) => {
    if (!remoteUrl?.Valid) return null;
    return remoteUrl.String;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <p className="text-sm text-muted-foreground">Loading repositories...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FolderGit className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-medium">Git Repositories</h4>
      </div>

      {/* Search Paths Configuration */}
      <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
        <label className="text-sm font-medium">Search Paths</label>
        <p className="text-xs text-muted-foreground">
          Directories to search for git repositories (one per line)
        </p>
        <textarea
          className="w-full min-h-[60px] px-3 py-2 text-sm rounded-md border border-input bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 font-mono resize-none"
          value={(config?.dataSources.git.searchPaths || []).join('\n')}
          onChange={(e) => {
            const paths = e.target.value
              .split('\n')
              .map((p) => p.trim())
              .filter((p) => p.length > 0);
            updateConfig.mutate({
              dataSources: {
                ...config?.dataSources,
                git: { ...config?.dataSources.git, searchPaths: paths },
              },
            });
          }}
          placeholder="~/projects&#10;~/code&#10;~/Developer"
        />

        {/* Max Depth Slider */}
        <div className="flex items-center justify-between pt-2">
          <label className="text-sm text-muted-foreground">Search Depth</label>
          <span className="text-sm font-medium">{config?.dataSources.git.maxDepth || 3}</span>
        </div>
        <Slider
          value={[config?.dataSources.git.maxDepth || 3]}
          min={1}
          max={5}
          step={1}
          onValueChange={([value]) =>
            updateConfig.mutate({
              dataSources: {
                ...config?.dataSources,
                git: { ...config?.dataSources.git, maxDepth: value },
              },
            })
          }
        />
        <p className="text-xs text-muted-foreground">
          How many directory levels deep to search (1-5)
        </p>

        {/* Auto-discover button */}
        <Button
          onClick={handleDiscover}
          disabled={discovering || !config?.dataSources.git.searchPaths?.length}
          variant="secondary"
          className="w-full mt-2"
        >
          {discovering ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Discovering...
            </>
          ) : (
            <>
              <Search className="h-4 w-4 mr-2" />
              Auto-Discover Repositories
            </>
          )}
        </Button>
      </div>

      {/* Add new repository manually */}
      <div className="flex gap-2">
        <Input
          placeholder="/path/to/repository"
          value={newPath}
          onChange={(e) => setNewPath(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !adding) {
              handleAddRepo();
            }
          }}
          className="flex-1"
        />
        <Button
          onClick={handleAddRepo}
          disabled={adding || !newPath.trim()}
          size="sm"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      {/* Repository list */}
      <div className="space-y-2 max-h-[200px] overflow-y-auto">
        {repos.length === 0 ? (
          <div className="text-center py-4 text-sm text-muted-foreground">
            <GitBranch className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No repositories tracked</p>
            <p className="text-xs">Add search paths and click "Auto-Discover" or add manually</p>
          </div>
        ) : (
          repos.map((repo) => (
            <div
              key={repo.id}
              className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm font-medium truncate">{repo.name}</span>
                  {repo.isActive ? (
                    <Badge variant="outline" className="bg-green-500/10 text-green-500 text-xs">
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      Inactive
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs text-muted-foreground truncate" title={repo.path}>
                    {repo.path}
                  </p>
                  {getRemoteUrl(repo.remoteUrl) && (
                    <a
                      href={getRemoteUrl(repo.remoteUrl)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:text-blue-600 flex-shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Last scanned: {formatLastScanned(repo.lastScanned)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                onClick={() => handleRemoveRepo(repo)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
