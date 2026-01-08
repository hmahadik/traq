import { cn } from '@/lib/utils';

// App icon mapping - you can expand this with actual icons
const APP_COLORS: Record<string, string> = {
  'VS Code': 'bg-blue-500',
  'Visual Studio Code': 'bg-blue-500',
  Firefox: 'bg-orange-500',
  Chrome: 'bg-green-500',
  Terminal: 'bg-gray-700',
  Slack: 'bg-purple-500',
  Discord: 'bg-indigo-500',
  Spotify: 'bg-green-600',
  Notion: 'bg-gray-800',
  Figma: 'bg-pink-500',
  default: 'bg-muted',
};

interface AppBadgeProps {
  appName: string | null;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
  className?: string;
}

export function AppBadge({
  appName,
  size = 'md',
  showName = true,
  className,
}: AppBadgeProps) {
  // Handle both string and SQL nullable object formats
  const rawName = typeof appName === 'object' && appName !== null
    ? (appName as { String?: string; Valid?: boolean })?.String
    : appName;
  const name = rawName || 'Unknown';
  const color = APP_COLORS[name] || APP_COLORS.default;

  const sizeClasses = {
    sm: 'h-5 w-5 text-[10px]',
    md: 'h-6 w-6 text-xs',
    lg: 'h-8 w-8 text-sm',
  };

  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className={cn(
          'rounded flex items-center justify-center text-white font-medium',
          sizeClasses[size],
          color
        )}
      >
        {name.charAt(0).toUpperCase()}
      </div>
      {showName && (
        <span className={cn('font-medium truncate', textSizes[size])}>
          {name}
        </span>
      )}
    </div>
  );
}
