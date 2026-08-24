import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WeeklyAnalytics } from './WeeklyAnalytics';
import { WeeklyStats, DailyStats } from '@/types/analytics';

// Recharts' ResponsiveContainer renders nothing at jsdom's 0x0 size; stub it
// so BarChart mounts with a fixed size and we can assert on the chart data.
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactElement }) => (
      <div style={{ width: 800, height: 300 }}>{actual.cloneChildren ? children : children}</div>
    ),
  };
});

const makeDay = (date: string, overrides: Partial<DailyStats> = {}): DailyStats => ({
  date,
  totalScreenshots: 10,
  totalSessions: 2,
  activeMinutes: 300, // 5h active
  workedMinutes: 480, // 8h worked (incl. breaks and AFK)
  topApps: [],
  shellCommands: 0,
  gitCommits: 0,
  filesModified: 0,
  sitesVisited: 0,
  ...overrides,
});

const makeWeek = (): WeeklyStats => ({
  startDate: '2026-08-17',
  endDate: '2026-08-23',
  dailyStats: [
    makeDay('2026-08-17'),
    makeDay('2026-08-18', { activeMinutes: 0, workedMinutes: 0 }),
  ],
  totalActive: 300,
  totalWorked: 480,
  averages: null,
});

describe('WeeklyAnalytics', () => {
  it('shows the daily hours (worked) chart, not active time', () => {
    render(<WeeklyAnalytics data={makeWeek()} />);
    expect(screen.getByText('Daily Hours')).toBeInTheDocument();
    expect(
      screen.getByText('Hours worked each day this week (incl. breaks and AFK)')
    ).toBeInTheDocument();
  });

  it('shows total hours worked with active time as secondary', () => {
    render(<WeeklyAnalytics data={makeWeek()} />);
    expect(screen.getByText('Total Hours Worked')).toBeInTheDocument();
    // Hero = 8h worked (also appears as Avg Daily Hours for 1 active day);
    // sub-line mentions 5h active
    expect(screen.getAllByText('8h').length).toBeGreaterThan(0);
    expect(screen.getByText(/5h active across 1 day/)).toBeInTheDocument();
  });
});
