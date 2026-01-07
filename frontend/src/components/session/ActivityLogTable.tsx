import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { formatDuration, formatTimestamp } from '@/lib/utils';
import { Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FocusEvent {
  id: number;
  timestamp: number;
  appName: string;
  windowTitle: string;
  durationSeconds: number;
}

interface ActivityLogTableProps {
  focusEvents: FocusEvent[];
}

type SortField = 'timestamp' | 'appName' | 'windowTitle' | 'durationSeconds';
type SortDirection = 'asc' | 'desc';

export function ActivityLogTable({ focusEvents }: ActivityLogTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('timestamp');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Handle column header click for sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if clicking same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to ascending
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Sort and filter focus events
  const sortedAndFilteredEvents = useMemo(() => {
    let filtered = focusEvents;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = focusEvents.filter(
        (event) =>
          event.appName.toLowerCase().includes(query) ||
          event.windowTitle.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortField) {
        case 'timestamp':
          aValue = a.timestamp;
          bValue = b.timestamp;
          break;
        case 'appName':
          aValue = a.appName.toLowerCase();
          bValue = b.appName.toLowerCase();
          break;
        case 'windowTitle':
          aValue = a.windowTitle.toLowerCase();
          bValue = b.windowTitle.toLowerCase();
          break;
        case 'durationSeconds':
          aValue = a.durationSeconds;
          bValue = b.durationSeconds;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [focusEvents, searchQuery, sortField, sortDirection]);

  // Get max duration for relative bar sizing
  const maxDuration = useMemo(
    () => Math.max(...focusEvents.map((e) => e.durationSeconds), 1),
    [focusEvents]
  );

  // Render sort icon for column headers
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="ml-2 h-4 w-4" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4" />
    );
  };

  return (
    <div className="space-y-4">
      {/* Search Filter */}
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by app or window title..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8"
        />
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('timestamp')}
                  className="h-8 px-2"
                >
                  Time
                  <SortIcon field="timestamp" />
                </Button>
              </th>
              <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('appName')}
                  className="h-8 px-2"
                >
                  App
                  <SortIcon field="appName" />
                </Button>
              </th>
              <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('windowTitle')}
                  className="h-8 px-2"
                >
                  Window
                  <SortIcon field="windowTitle" />
                </Button>
              </th>
              <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('durationSeconds')}
                  className="h-8 px-2"
                >
                  Duration
                  <SortIcon field="durationSeconds" />
                </Button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedAndFilteredEvents.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-4 text-center text-muted-foreground">
                  {searchQuery ? 'No matching events found' : 'No focus events recorded'}
                </td>
              </tr>
            ) : (
              sortedAndFilteredEvents.map((event) => {
                const barWidth = (event.durationSeconds / maxDuration) * 100;
                return (
                  <tr key={event.id} className="border-b">
                    <td className="p-4 align-middle font-mono text-sm">
                      {formatTimestamp(event.timestamp)}
                    </td>
                    <td className="p-4 align-middle font-medium">{event.appName}</td>
                    <td className="p-4 align-middle max-w-md truncate" title={event.windowTitle}>
                      {event.windowTitle}
                    </td>
                    <td className="p-4 align-middle">
                      <div className="flex items-center gap-2">
                        <span className="text-sm w-16">{formatDuration(event.durationSeconds)}</span>
                        <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden min-w-[100px]">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        Showing {sortedAndFilteredEvents.length} of {focusEvents.length} events
      </p>
    </div>
  );
}
