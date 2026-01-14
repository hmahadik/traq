import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { formatDuration, formatTimestamp } from '@/lib/utils';
import { Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FocusEvent {
  id: number;
  startTime: number;
  appName: string;
  windowTitle: string;
  durationSeconds: number;
}

interface ActivityLogTableProps {
  focusEvents: FocusEvent[];
}

type SortField = 'startTime' | 'appName' | 'windowTitle' | 'durationSeconds';
type SortDirection = 'asc' | 'desc';

export function ActivityLogTable({ focusEvents }: ActivityLogTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('startTime');
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
        case 'startTime':
          aValue = a.startTime;
          bValue = b.startTime;
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
      return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="ml-1 h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3" />
    );
  };

  return (
    <div className="space-y-3">
      {/* Search Filter */}
      <div className="relative">
        <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search by app or window title..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-7 h-8 text-xs"
        />
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="h-8 px-2 text-left align-middle font-medium text-muted-foreground text-xs">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('startTime')}
                  className="h-6 px-1 text-xs"
                >
                  Time
                  <SortIcon field="startTime" />
                </Button>
              </th>
              <th className="h-8 px-2 text-left align-middle font-medium text-muted-foreground text-xs">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('appName')}
                  className="h-6 px-1 text-xs"
                >
                  App
                  <SortIcon field="appName" />
                </Button>
              </th>
              <th className="h-8 px-2 text-left align-middle font-medium text-muted-foreground text-xs">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('windowTitle')}
                  className="h-6 px-1 text-xs"
                >
                  Window
                  <SortIcon field="windowTitle" />
                </Button>
              </th>
              <th className="h-8 px-2 text-left align-middle font-medium text-muted-foreground text-xs">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('durationSeconds')}
                  className="h-6 px-1 text-xs"
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
                <td colSpan={4} className="p-3 text-center text-muted-foreground text-xs">
                  {searchQuery ? 'No matching events found' : 'No focus events recorded'}
                </td>
              </tr>
            ) : (
              sortedAndFilteredEvents.map((event) => {
                const barWidth = (event.durationSeconds / maxDuration) * 100;
                return (
                  <tr key={event.id} className="border-b hover:bg-muted/30">
                    <td className="p-2 align-middle font-mono text-xs">
                      {formatTimestamp(event.startTime)}
                    </td>
                    <td className="p-2 align-middle font-medium text-xs">{event.appName}</td>
                    <td className="p-2 align-middle max-w-md truncate text-xs" title={event.windowTitle}>
                      {event.windowTitle}
                    </td>
                    <td className="p-2 align-middle">
                      <div className="flex items-center gap-2">
                        <span className="text-xs w-12">{formatDuration(event.durationSeconds)}</span>
                        <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden min-w-[60px]">
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
      <p className="text-xs text-muted-foreground text-center">
        Showing {sortedAndFilteredEvents.length} of {focusEvents.length} events
      </p>
    </div>
  );
}
