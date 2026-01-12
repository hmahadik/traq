import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDateContext, type TimeframeType } from '@/contexts';

interface DateNavigationProps {
  className?: string;
}

const getNavigationLabel = (timeframeType: TimeframeType): { prev: string; next: string } => {
  switch (timeframeType) {
    case 'day':
      return { prev: 'Previous Day', next: 'Next Day' };
    case 'week':
      return { prev: 'Previous Week', next: 'Next Week' };
    case 'month':
      return { prev: 'Previous Month', next: 'Next Month' };
    case 'year':
      return { prev: 'Previous Year', next: 'Next Year' };
    case 'custom':
      return { prev: 'Previous Period', next: 'Next Period' };
  }
};

export function DateNavigation({ className }: DateNavigationProps) {
  const { goToPrevious, goToNext, canGoNext, timeframeType } = useDateContext();
  const labels = getNavigationLabel(timeframeType);

  return (
    <div className={`flex items-center gap-2 ${className || ''}`}>
      <Button
        variant="outline"
        size="sm"
        onClick={goToPrevious}
        className="gap-1"
        data-testid="date-nav-prev"
      >
        <ChevronLeft className="h-4 w-4" />
        <span className="hidden sm:inline">{labels.prev}</span>
        <span className="sm:hidden">Prev</span>
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={goToNext}
        disabled={!canGoNext}
        className="gap-1"
        data-testid="date-nav-next"
      >
        <span className="hidden sm:inline">{labels.next}</span>
        <span className="sm:hidden">Next</span>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
