import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes with clsx
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format duration in seconds to human-readable string
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

/**
 * Format Unix timestamp to time string (HH:MM)
 */
export function formatTimestamp(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format Unix timestamp to date string
 */
export function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format Unix timestamp to full date with time
 */
export function formatDateTime(ts: number): string {
  return new Date(ts * 1000).toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format time range
 */
export function formatTimeRange(start: number, end: number): string {
  return `${formatTimestamp(start)} - ${formatTimestamp(end)}`;
}

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

/**
 * Format percentage
 */
export function formatPercent(value: number, decimals: number = 0): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Group array by key
 */
export function groupBy<T>(
  array: T[],
  keyFn: (item: T) => string
): Record<string, T[]> {
  return array.reduce((groups, item) => {
    const key = keyFn(item);
    (groups[key] ||= []).push(item);
    return groups;
  }, {} as Record<string, T[]>);
}

/**
 * Get date string in YYYY-MM-DD format
 */
export function toDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Get start of day timestamp
 */
export function startOfDay(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

/**
 * Get end of day timestamp
 */
export function endOfDay(date: Date): number {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return Math.floor(d.getTime() / 1000);
}

/**
 * Add days to date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Check if two dates are the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Get relative time description
 */
export function getRelativeTime(ts: number): string {
  const now = Date.now() / 1000;
  const diff = now - ts;

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return formatDate(ts);
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Clamp number between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Generate a random ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parse a natural language time range
 * Returns [start, end] as Unix timestamps
 */
export function parseTimeRange(input: string): [number, number] {
  const now = new Date();
  const lowered = input.toLowerCase().trim();

  switch (lowered) {
    case 'today': {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return [Math.floor(start.getTime() / 1000), Math.floor(now.getTime() / 1000)];
    }
    case 'yesterday': {
      const start = addDays(now, -1);
      start.setHours(0, 0, 0, 0);
      const end = addDays(now, -1);
      end.setHours(23, 59, 59, 999);
      return [Math.floor(start.getTime() / 1000), Math.floor(end.getTime() / 1000)];
    }
    case 'this week': {
      const start = new Date(now);
      start.setDate(start.getDate() - start.getDay());
      start.setHours(0, 0, 0, 0);
      return [Math.floor(start.getTime() / 1000), Math.floor(now.getTime() / 1000)];
    }
    case 'last week':
    case 'past week': {
      const start = addDays(now, -7);
      start.setHours(0, 0, 0, 0);
      return [Math.floor(start.getTime() / 1000), Math.floor(now.getTime() / 1000)];
    }
    default: {
      // Try to parse "past X days" or "last X days"
      const daysMatch = lowered.match(/(?:past|last)\s+(\d+)\s+days?/);
      if (daysMatch) {
        const days = parseInt(daysMatch[1], 10);
        const start = addDays(now, -days);
        start.setHours(0, 0, 0, 0);
        return [Math.floor(start.getTime() / 1000), Math.floor(now.getTime() / 1000)];
      }

      // Default to today
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return [Math.floor(start.getTime() / 1000), Math.floor(now.getTime() / 1000)];
    }
  }
}
