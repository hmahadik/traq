import { Grid3x3, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type DisplayMode = 'grid' | 'drops';

interface DisplayModeToggleProps {
  displayMode: DisplayMode;
  onDisplayModeChange: (mode: DisplayMode) => void;
}

export function DisplayModeToggle({ displayMode, onDisplayModeChange }: DisplayModeToggleProps) {
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
          displayMode === 'drops'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
        onClick={() => onDisplayModeChange('drops')}
      >
        <Circle className="h-3.5 w-3.5" />
        Drops
      </button>
    </div>
  );
}

// Keep old name for backwards compatibility during migration
export const ListModeToggle = DisplayModeToggle;
