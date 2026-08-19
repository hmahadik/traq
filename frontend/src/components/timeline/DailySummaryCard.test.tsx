import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DailySummaryCard } from './DailySummaryCard';
import { DayStats } from '@/types/timeline';

// 9:00 AM local on a fixed date
const START = new Date(2026, 7, 17, 9, 0, 0).getTime() / 1000;

const makeStats = (overrides: Partial<DayStats> = {}): DayStats => ({
  totalSeconds: 5 * 3600, // 5h active
  totalHours: 5,
  workedSeconds: 6.5 * 3600, // 6h 30m incl. breaks + AFK
  workedHours: 6.5,
  breakCount: 2,
  breakDuration: 30 * 60,
  longestFocus: 2 * 3600,
  longestFocusStart: START,
  longestFocusEnd: START + 2 * 3600,
  timeSinceLastBreak: 20 * 60,
  daySpan: {
    startTime: START,
    endTime: START + 6.5 * 3600, // 3:30 PM
    spanHours: 6.5,
  },
  breakdown: { focus: 5 * 3600 },
  breakdownPercent: { focus: 100 },
  ...overrides,
});

describe('DailySummaryCard', () => {
  it('shows hours worked including breaks and AFK (workedSeconds)', () => {
    render(<DailySummaryCard stats={makeStats()} />);
    // 6.5h span, not the 5h active time
    expect(screen.getByText('6h 30m')).toBeInTheDocument();
    // 6.5/8 = 81%
    expect(screen.getByText('(81%)')).toBeInTheDocument();
  });

  it('falls back to totalSeconds when workedSeconds is missing (stale backend)', () => {
    const stats = makeStats();
    // Simulate old backend payload without the new field
    delete (stats as Record<string, unknown>).workedSeconds;
    render(<DailySummaryCard stats={stats} />);
    expect(screen.getByText('5h 0m')).toBeInTheDocument();
  });

  it('shows actual end time for past days', () => {
    render(<DailySummaryCard stats={makeStats()} isToday={false} />);
    expect(screen.getByText('End Time')).toBeInTheDocument();
    expect(screen.getByText('3:30 PM')).toBeInTheDocument();
    expect(screen.queryByText(/est\./)).not.toBeInTheDocument();
  });

  it('shows estimated end time (start + 8h) for today, styled as estimate', () => {
    render(<DailySummaryCard stats={makeStats()} isToday={true} />);
    // 9:00 AM + 8h = 5:00 PM, replacing actual 3:30 PM
    expect(screen.getByText('Est. End Time')).toBeInTheDocument();
    const est = screen.getByText('~5:00 PM');
    expect(est).toBeInTheDocument();
    // Visually de-emphasized (light gray)
    expect(est.className).toContain('text-muted-foreground');
    expect(screen.queryByText('3:30 PM')).not.toBeInTheDocument();
  });

  it('renders empty state when stats are null', () => {
    render(<DailySummaryCard stats={null} />);
    expect(screen.getByText('No activity today')).toBeInTheDocument();
  });
});
