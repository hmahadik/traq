import { useState, useEffect } from 'react';
import { FileType, Plus, Trash2, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { fileWatch } from '@/api/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function FileExtensionFilterSection() {
  const [extensions, setExtensions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [newExt, setNewExt] = useState('');
  const [adding, setAdding] = useState(false);

  const loadExtensions = async () => {
    try {
      setLoading(true);
      const result = await fileWatch.getAllowedExtensions();
      setExtensions(result);
    } catch (error) {
      console.error('Failed to load allowed extensions:', error);
      toast.error('Failed to load allowed extensions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExtensions();
  }, []);

  const normalizeExtension = (ext: string): string => {
    let normalized = ext.trim().toLowerCase();
    if (!normalized.startsWith('.')) {
      normalized = '.' + normalized;
    }
    return normalized;
  };

  const handleAddExtension = async () => {
    if (!newExt.trim()) {
      toast.error('Please enter a file extension');
      return;
    }

    const normalized = normalizeExtension(newExt);

    // Validate extension format
    if (!/^\.[a-zA-Z0-9]+$/.test(normalized)) {
      toast.error('Invalid extension format (e.g., .ts, .go, .py)');
      return;
    }

    // Check if already exists
    if (extensions.includes(normalized)) {
      toast.error('Extension is already in the list');
      return;
    }

    try {
      setAdding(true);
      const newExtensions = [...extensions, normalized];
      await fileWatch.setAllowedExtensions(newExtensions);
      setExtensions(newExtensions);
      setNewExt('');
      toast.success(`Now tracking ${normalized} files`);
    } catch (error) {
      console.error('Failed to add extension:', error);
      toast.error('Failed to add extension');
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveExtension = async (ext: string) => {
    try {
      const newExtensions = extensions.filter((e) => e !== ext);
      await fileWatch.setAllowedExtensions(newExtensions);
      setExtensions(newExtensions);
      toast.success(`Removed ${ext} from filter`);
    } catch (error) {
      console.error('Failed to remove extension:', error);
      toast.error('Failed to remove extension');
    }
  };

  const handleClearAll = async () => {
    try {
      await fileWatch.setAllowedExtensions([]);
      setExtensions([]);
      toast.success('Cleared extension filter - now tracking all files');
    } catch (error) {
      console.error('Failed to clear extensions:', error);
      toast.error('Failed to clear extensions');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <p className="text-sm text-muted-foreground">Loading extensions...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileType className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-medium">File Extension Filter</h4>
        </div>
        {extensions.length > 0 && (
          <Button variant="ghost" size="sm" onClick={handleClearAll}>
            Clear All
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {extensions.length === 0
          ? 'Tracking all file types. Add extensions below to filter which files are tracked.'
          : `Only tracking ${extensions.length} file type${extensions.length !== 1 ? 's' : ''}. Files with other extensions are ignored.`}
      </p>

      {/* Add new extension */}
      <div className="flex gap-2">
        <Input
          placeholder=".ts, .go, .py"
          value={newExt}
          onChange={(e) => setNewExt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !adding) {
              handleAddExtension();
            }
          }}
          className="flex-1"
        />
        <Button
          onClick={handleAddExtension}
          disabled={adding || !newExt.trim()}
          size="sm"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      {/* Extension list */}
      <div className="flex flex-wrap gap-2">
        {extensions.length === 0 ? (
          <div className="text-center w-full py-4 text-sm text-muted-foreground">
            <Filter className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No extension filter active</p>
            <p className="text-xs">All file types are being tracked</p>
          </div>
        ) : (
          extensions.map((ext) => (
            <Badge
              key={ext}
              variant="secondary"
              className="flex items-center gap-1 px-3 py-1 cursor-pointer hover:bg-destructive/20 group"
              onClick={() => handleRemoveExtension(ext)}
            >
              <FileType className="h-3 w-3" />
              {ext}
              <Trash2 className="h-3 w-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-destructive" />
            </Badge>
          ))
        )}
      </div>

      {/* Quick add suggestions */}
      {extensions.length === 0 && (
        <div className="pt-2">
          <p className="text-xs text-muted-foreground mb-2">Quick add common extensions:</p>
          <div className="flex flex-wrap gap-1">
            {['.ts', '.tsx', '.js', '.jsx', '.go', '.py', '.rs', '.md', '.json'].map((ext) => (
              <Button
                key={ext}
                variant="outline"
                size="sm"
                className="h-6 text-xs"
                onClick={async () => {
                  const newExtensions = [...extensions, ext];
                  await fileWatch.setAllowedExtensions(newExtensions);
                  setExtensions(newExtensions);
                  toast.success(`Now tracking ${ext} files`);
                }}
              >
                {ext}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
