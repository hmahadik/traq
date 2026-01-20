// frontend/src/components/timeline/TimelineListView.tsx
import { useState, useCallback, useRef } from 'react';
import {
  TimelineGridData,
  TimelineListItem,
  ListViewSort,
  ListViewFilter,
} from '@/types/timeline';
import { useListViewData } from './useListViewData';
import { Input } from '@/components/ui/input';
import { cn, formatDuration } from '@/lib/utils';
import { ChevronUp, ChevronDown, Search } from 'lucide-react';

interface TimelineListViewProps {
  data?: TimelineGridData;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onItemClick?: (item: TimelineListItem) => void;
  onItemDoubleClick?: (item: TimelineListItem) => void;
}

export function TimelineListView({
  data,
  selectedIds,
  onSelectionChange,
  onItemClick,
  onItemDoubleClick,
}: TimelineListViewProps) {
  const [sort, setSort] = useState<ListViewSort>({ column: 'time', direction: 'asc' });
  const [filter, setFilter] = useState<ListViewFilter>({});
  const lastSelectedIndex = useRef<number | null>(null);

  const items = useListViewData(data, sort, filter);

  const toggleSort = (column: ListViewSort['column']) => {
    setSort(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const toggleSelection = useCallback((id: string, index: number, shiftKey: boolean) => {
    const newSelection = new Set(selectedIds);

    if (shiftKey && lastSelectedIndex.current !== null) {
      // Range selection
      const start = Math.min(lastSelectedIndex.current, index);
      const end = Math.max(lastSelectedIndex.current, index);
      for (let i = start; i <= end; i++) {
        newSelection.add(items[i].id);
      }
    } else {
      // Toggle single selection
      if (newSelection.has(id)) {
        newSelection.delete(id);
      } else {
        newSelection.add(id);
      }
      lastSelectedIndex.current = index;
    }

    onSelectionChange(newSelection);
  }, [selectedIds, onSelectionChange, items]);

  const selectAll = () => {
    onSelectionChange(new Set(items.map(i => i.id)));
  };

  const selectNone = () => {
    onSelectionChange(new Set());
    lastSelectedIndex.current = null;
  };

  const SortIcon = ({ column }: { column: ListViewSort['column'] }) => {
    if (sort.column !== column) return null;
    return sort.direction === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={filter.search || ''}
            onChange={(e) => setFilter(prev => ({ ...prev, search: e.target.value }))}
            className="pl-8 h-8"
          />
        </div>
        <button onClick={selectAll} className="text-xs text-muted-foreground hover:text-foreground">
          Select all
        </button>
        <button onClick={selectNone} className="text-xs text-muted-foreground hover:text-foreground">
          Clear
        </button>
        <span className="text-xs text-muted-foreground">
          {selectedIds.size} selected / {items.length} items
        </span>
      </div>

      {/* Header */}
      <div className="flex items-center border-b bg-muted/50 text-xs font-medium">
        <div className="w-10 p-2" />
        <button onClick={() => toggleSort('time')} className="flex items-center gap-1 w-20 p-2 hover:bg-muted">
          Time <SortIcon column="time" />
        </button>
        <button onClick={() => toggleSort('duration')} className="flex items-center gap-1 w-16 p-2 hover:bg-muted">
          Duration <SortIcon column="duration" />
        </button>
        <button onClick={() => toggleSort('app')} className="flex items-center gap-1 w-24 p-2 hover:bg-muted">
          App <SortIcon column="app" />
        </button>
        <button onClick={() => toggleSort('title')} className="flex items-center gap-1 flex-1 p-2 hover:bg-muted">
          Title <SortIcon column="title" />
        </button>
        <button onClick={() => toggleSort('project')} className="flex items-center gap-1 w-32 p-2 hover:bg-muted">
          Project <SortIcon column="project" />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto">
        {items.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            {filter.search ? 'No items match your search' : 'No activity data'}
          </div>
        ) : (
          items.map((item, index) => (
            <div
              key={item.id}
              onClick={(e) => {
                toggleSelection(item.id, index, e.shiftKey);
                onItemClick?.(item);
              }}
              onDoubleClick={() => onItemDoubleClick?.(item)}
              className={cn(
                'flex items-center border-b text-sm cursor-pointer',
                selectedIds.has(item.id)
                  ? 'bg-primary/10 ring-1 ring-inset ring-primary/30'
                  : 'hover:bg-muted/50'
              )}
            >
              <div className="w-10 p-2 flex items-center justify-center">
                <input
                  type="checkbox"
                  checked={selectedIds.has(item.id)}
                  onChange={() => toggleSelection(item.id, index, false)}
                  onClick={(e) => e.stopPropagation()}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                />
              </div>
              <div className="w-20 p-2 text-muted-foreground">
                {new Date(item.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="w-16 p-2 text-muted-foreground">
                {item.duration ? formatDuration(item.duration) : '-'}
              </div>
              <div className="w-24 p-2 truncate">{item.appName || '-'}</div>
              <div className="flex-1 p-2 truncate">
                <span>{item.title}</span>
                {item.subtitle && (
                  <span className="ml-2 text-muted-foreground text-xs">{item.subtitle}</span>
                )}
              </div>
              <div className="w-32 p-2">
                {item.project && item.project.color && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs"
                    style={{ backgroundColor: item.project.color + '20', color: item.project.color }}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.project.color }} />
                    {item.project.name}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
