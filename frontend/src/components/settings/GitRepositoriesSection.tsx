import { useState, useEffect } from 'react';
import { GitBranch, Plus, Trash2, FolderGit, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { git, type GitRepository } from '@/api/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function GitRepositoriesSection() {
  const [repos, setRepos] = useState<GitRepository[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPath, setNewPath] = useState('');
  const [adding, setAdding] = useState(false);

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

      {/* Add new repository */}
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
            <p className="text-xs">Add a repository path above to start tracking commits</p>
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
