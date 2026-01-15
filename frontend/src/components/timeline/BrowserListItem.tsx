import { Globe } from 'lucide-react';
import type { BrowserEventDisplay } from '@/types/timeline';
import { TimelineListItem } from './TimelineListItem';
import { formatDecimalHours } from '@/utils/timelineHelpers';

interface BrowserListItemProps {
  browserEvent: BrowserEventDisplay;
  isSelected?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

function getBrowserColor(browser: string) {
  switch (browser.toLowerCase()) {
    case 'chrome':
    case 'chromium':
      return 'bg-emerald-500';
    case 'firefox':
      return 'bg-orange-500';
    case 'safari':
      return 'bg-sky-500';
    case 'edge':
      return 'bg-blue-500';
    case 'brave':
      return 'bg-orange-600';
    case 'arc':
      return 'bg-violet-500';
    default:
      return 'bg-gray-500';
  }
}

export function BrowserListItem({ browserEvent, isSelected, onClick }: BrowserListItemProps) {
  const browserColor = getBrowserColor(browserEvent.browser);

  const icon = (
    <div className={`w-5 h-5 rounded ${browserColor} flex items-center justify-center text-white`}>
      <Globe className="w-3 h-3" />
    </div>
  );

  const duration = browserEvent.visitDurationSeconds > 0
    ? formatDecimalHours(browserEvent.visitDurationSeconds / 3600)
    : undefined;

  // Truncate URL if too long
  const url = browserEvent.url.length > 60
    ? browserEvent.url.slice(0, 60) + '...'
    : browserEvent.url;

  const details = `${browserEvent.domain} • ${url}`;

  const metadata = (
    <span className="text-xs text-muted-foreground capitalize">{browserEvent.browser}</span>
  );

  return (
    <TimelineListItem
      icon={icon}
      title={browserEvent.title || browserEvent.domain}
      details={details}
      duration={duration}
      timestamp={browserEvent.timestamp}
      metadata={metadata}
      isSelected={isSelected}
      onClick={onClick}
      selectable={Boolean(onClick)}
      reserveCheckboxSpace
    />
  );
}
