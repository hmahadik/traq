import { cn } from '@/lib/utils';

interface DraftBadgeProps {
  className?: string;
  onClick?: () => void;
}

export function DraftBadge({ className, onClick }: DraftBadgeProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]',
        'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
        'border border-dashed border-amber-400',
        'hover:bg-amber-200 dark:hover:bg-amber-800',
        className
      )}
    >
      Draft
    </button>
  );
}
