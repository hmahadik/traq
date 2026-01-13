import { cn } from '@/lib/utils';

export type ViewMode = 'day' | 'week';

interface ViewModeSelectorProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export function ViewModeSelector({ viewMode, onViewModeChange }: ViewModeSelectorProps) {
  return (
    <div className="inline-flex rounded-lg bg-muted p-0.5">
      <button
        className={cn(
          'px-3 py-1 text-sm font-medium rounded-md transition-colors',
          viewMode === 'day'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
        onClick={() => onViewModeChange('day')}
      >
        Day
      </button>
      <button
        className={cn(
          'px-3 py-1 text-sm font-medium rounded-md transition-colors',
          viewMode === 'week'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
        onClick={() => onViewModeChange('week')}
      >
        Week
      </button>
    </div>
  );
}
