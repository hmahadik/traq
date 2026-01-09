import { useState, useEffect } from 'react';
import { FolderOpen, Plus, Trash2, Folder } from 'lucide-react';
import { toast } from 'sonner';
import { fileWatch } from '@/api/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function FileWatchDirectoriesSection() {
  const [directories, setDirectories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPath, setNewPath] = useState('');
  const [adding, setAdding] = useState(false);

  const loadDirectories = async () => {
    try {
      setLoading(true);
      const result = await fileWatch.getWatchedDirectories();
      setDirectories(result);
    } catch (error) {
      console.error('Failed to load watched directories:', error);
      toast.error('Failed to load watched directories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDirectories();
  }, []);

  const handleAddDirectory = async () => {
    if (!newPath.trim()) {
      toast.error('Please enter a directory path');
      return;
    }

    // Check if already watching
    if (directories.includes(newPath.trim())) {
      toast.error('Directory is already being watched');
      return;
    }

    try {
      setAdding(true);
      await fileWatch.watchDirectory(newPath.trim());
      setDirectories((prev) => [...prev, newPath.trim()]);
      setNewPath('');
      toast.success(`Now watching: ${newPath.trim()}`);
    } catch (error) {
      console.error('Failed to add directory:', error);
      toast.error('Failed to add directory', {
        description: error instanceof Error ? error.message : 'Invalid directory path',
      });
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveDirectory = async (path: string) => {
    try {
      await fileWatch.unwatchDirectory(path);
      setDirectories((prev) => prev.filter((d) => d !== path));
      toast.success(`Stopped watching: ${path}`);
    } catch (error) {
      console.error('Failed to remove directory:', error);
      toast.error('Failed to remove directory');
    }
  };

  const getDirectoryName = (path: string): string => {
    const parts = path.split('/');
    return parts[parts.length - 1] || path;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <p className="text-sm text-muted-foreground">Loading directories...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FolderOpen className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-medium">Watched Directories</h4>
      </div>

      {/* Add new directory */}
      <div className="flex gap-2">
        <Input
          placeholder="/path/to/directory"
          value={newPath}
          onChange={(e) => setNewPath(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !adding) {
              handleAddDirectory();
            }
          }}
          className="flex-1"
        />
        <Button
          onClick={handleAddDirectory}
          disabled={adding || !newPath.trim()}
          size="sm"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      {/* Directory list */}
      <div className="space-y-2 max-h-[200px] overflow-y-auto">
        {directories.length === 0 ? (
          <div className="text-center py-4 text-sm text-muted-foreground">
            <Folder className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No directories being watched</p>
            <p className="text-xs">Add a directory path above to start tracking file changes</p>
          </div>
        ) : (
          directories.map((dir) => (
            <div
              key={dir}
              className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Folder className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm font-medium truncate">{getDirectoryName(dir)}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-1" title={dir}>
                  {dir}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                onClick={() => handleRemoveDirectory(dir)}
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
