import { Grid3x3, List, Columns2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type DisplayMode = 'grid' | 'list' | 'split';

interface ListModeToggleProps {
  displayMode: DisplayMode;
  onDisplayModeChange: (mode: DisplayMode) => void;
}

export function ListModeToggle({ displayMode, onDisplayModeChange }: ListModeToggleProps) {
  return (
    <div className="inline-flex rounded-lg bg-muted p-0.5">
      <button
        className={cn(
          'px-3 py-1 text-sm font-medium rounded-md transition-colors inline-flex items-center gap-1.5',
          displayMode === 'grid'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
        onClick={() => onDisplayModeChange('grid')}
      >
        <Grid3x3 className="h-3.5 w-3.5" />
        Grid
      </button>
      <button
        className={cn(
          'px-3 py-1 text-sm font-medium rounded-md transition-colors inline-flex items-center gap-1.5',
          displayMode === 'split'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
        onClick={() => onDisplayModeChange('split')}
      >
        <Columns2 className="h-3.5 w-3.5" />
        Split
      </button>
      <button
        className={cn(
          'px-3 py-1 text-sm font-medium rounded-md transition-colors inline-flex items-center gap-1.5',
          displayMode === 'list'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
        onClick={() => onDisplayModeChange('list')}
      >
        <List className="h-3.5 w-3.5" />
        List
      </button>
    </div>
  );
}
