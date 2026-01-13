import { useState, useCallback, useEffect, useRef } from 'react';
import { Search, X, GitBranch, Terminal, FolderOpen, Globe, Camera, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SearchAllDataSources } from '../../../wailsjs/go/main/App';
import { cn } from '@/lib/utils';

export interface SearchResult {
  type: string;
  id: number;
  timestamp: number;
  date: string;
  time: string;
  summary: string;
  details: string;
  appName?: string;
}

interface GlobalSearchProps {
  onNavigateToDate?: (date: string) => void;
}

export function GlobalSearch({ onNavigateToDate }: GlobalSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery('');
      setResults([]);
    }
  }, [open]);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery || searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setIsSearching(true);
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
    const timeoutId = setTimeout(() => performSearch(value), 300);
    return () => clearTimeout(timeoutId);
  }, [performSearch]);

  const handleResultClick = useCallback((result: SearchResult) => {
    if (onNavigateToDate) {
      onNavigateToDate(result.date);
    }
    setOpen(false);
  }, [onNavigateToDate]);

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'git': return <GitBranch className="h-4 w-4 text-muted-foreground" />;
      case 'shell': return <Terminal className="h-4 w-4 text-muted-foreground" />;
      case 'file': return <FolderOpen className="h-4 w-4 text-muted-foreground" />;
      case 'browser': return <Globe className="h-4 w-4 text-muted-foreground" />;
      case 'screenshot': return <Camera className="h-4 w-4 text-muted-foreground" />;
      default: return <Search className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Search className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 p-0" align="end">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              ref={inputRef}
              type="text"
              placeholder="Search commits, files, commands..."
              value={query}
              onChange={handleInputChange}
              className="pl-8 pr-8 h-9"
            />
            {query && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { setQuery(''); setResults([]); }}
                className="absolute right-0.5 top-1/2 -translate-y-1/2 h-7 w-7"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto">
          {isSearching ? (
            <div className="p-4 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Searching...
            </div>
          ) : query.length < 2 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Type at least 2 characters
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No results found
            </div>
          ) : (
            <div className="py-1">
              {results.slice(0, 10).map((result, index) => (
                <button
                  key={`${result.type}-${result.id}-${index}`}
                  onClick={() => handleResultClick(result)}
                  className={cn(
                    'w-full px-3 py-2 text-left hover:bg-accent transition-colors',
                    'focus:bg-accent focus:outline-none'
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5">{getResultIcon(result.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{result.summary}</div>
                      <div className="text-xs text-muted-foreground">{result.date} {result.time}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
