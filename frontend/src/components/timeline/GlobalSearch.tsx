import { useState, useCallback, useEffect, useRef } from 'react';
import { Search, X, GitBranch, Terminal, FolderOpen, Globe, Camera, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SearchAllDataSources } from '../../../wailsjs/go/main/App';
import { cn } from '@/lib/utils';

export interface SearchResult {
  type: string;  // "git", "shell", "file", "browser", "screenshot"
  id: number;
  timestamp: number;
  date: string;  // YYYY-MM-DD
  time: string;  // HH:MM:SS
  summary: string;
  details: string;
  appName?: string;
}

interface GlobalSearchProps {
  onNavigateToDate?: (date: string) => void;
}

export function GlobalSearch({ onNavigateToDate }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close results when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery || searchQuery.length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    setShowResults(true);

    try {
      const searchResults = await SearchAllDataSources(searchQuery, 50);
      setResults(searchResults || []);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    // Debounce search
    const timeoutId = setTimeout(() => {
      performSearch(value);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [performSearch]);

  const handleClear = useCallback(() => {
    setQuery('');
    setResults([]);
    setShowResults(false);
  }, []);

  const handleResultClick = useCallback((result: SearchResult) => {
    if (onNavigateToDate) {
      onNavigateToDate(result.date);
    }
    setShowResults(false);
  }, [onNavigateToDate]);

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'git':
        return <GitBranch className="h-4 w-4 text-purple-500" />;
      case 'shell':
        return <Terminal className="h-4 w-4 text-slate-500" />;
      case 'file':
        return <FolderOpen className="h-4 w-4 text-indigo-500" />;
      case 'browser':
        return <Globe className="h-4 w-4 text-cyan-500" />;
      case 'screenshot':
        return <Camera className="h-4 w-4 text-blue-500" />;
      default:
        return <Search className="h-4 w-4" />;
    }
  };

  const getResultTypeLabel = (type: string) => {
    switch (type) {
      case 'git':
        return 'Git Commit';
      case 'shell':
        return 'Shell Command';
      case 'file':
        return 'File Event';
      case 'browser':
        return 'Browser Visit';
      case 'screenshot':
        return 'Screenshot';
      default:
        return type;
    }
  };

  return (
    <div ref={searchRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          type="text"
          placeholder="Search commits, files, commands..."
          value={query}
          onChange={handleInputChange}
          onFocus={() => {
            if (results.length > 0) {
              setShowResults(true);
            }
          }}
          className="pl-9 pr-9 w-full"
        />
        {query && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClear}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Results Dropdown */}
      {showResults && (
        <div className="absolute top-full mt-2 w-full max-h-96 overflow-y-auto bg-background border rounded-lg shadow-lg z-50">
          {isSearching ? (
            <div className="p-4 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Searching...
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              {query.length < 2 ? 'Type at least 2 characters to search' : 'No results found'}
            </div>
          ) : (
            <div className="py-2">
              {results.map((result, index) => (
                <button
                  key={`${result.type}-${result.id}-${index}`}
                  onClick={() => handleResultClick(result)}
                  className={cn(
                    'w-full px-4 py-3 text-left hover:bg-accent transition-colors',
                    'border-b last:border-b-0 border-border',
                    'focus:bg-accent focus:outline-none'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{getResultIcon(result.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-muted-foreground">
                          {getResultTypeLabel(result.type)}
                        </span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground">
                          {result.date} {result.time}
                        </span>
                      </div>
                      <div className="text-sm font-medium truncate mb-1">
                        {result.summary}
                      </div>
                      {result.details && (
                        <div className="text-xs text-muted-foreground truncate">
                          {result.details}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
