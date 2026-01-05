import { describe, it, expect } from 'vitest'
import {
  cn,
  formatDuration,
  formatBytes,
  formatPercent,
  groupBy,
  toDateString,
  clamp,
  isSameDay,
  addDays,
  getRelativeTime,
} from './utils'

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('text-sm', 'font-bold')).toBe('text-sm font-bold')
  })

  it('handles conditional classes', () => {
    expect(cn('base', { 'active': true, 'disabled': false })).toBe('base active')
  })

  it('merges Tailwind classes correctly', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4') // p-4 should override p-2
  })
})

describe('formatDuration', () => {
  it('formats seconds', () => {
    expect(formatDuration(30)).toBe('30s')
    expect(formatDuration(0)).toBe('0s')
  })

  it('formats minutes', () => {
    expect(formatDuration(60)).toBe('1m')
    expect(formatDuration(90)).toBe('1m 30s')
    expect(formatDuration(120)).toBe('2m')
  })

  it('formats hours', () => {
    expect(formatDuration(3600)).toBe('1h')
    expect(formatDuration(3660)).toBe('1h 1m')
    expect(formatDuration(7200)).toBe('2h')
    expect(formatDuration(5400)).toBe('1h 30m')
  })
})

describe('formatBytes', () => {
  it('formats bytes', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(100)).toBe('100 B')
  })

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
  })

  it('formats megabytes', () => {
    expect(formatBytes(1048576)).toBe('1 MB')
    expect(formatBytes(1572864)).toBe('1.5 MB')
  })

  it('formats gigabytes', () => {
    expect(formatBytes(1073741824)).toBe('1 GB')
  })

  it('respects decimals parameter', () => {
    // Note: parseFloat strips trailing zeros, so 1.50 becomes 1.5
    expect(formatBytes(1536, 2)).toBe('1.5 KB')
  })
})

describe('formatPercent', () => {
  it('formats percentage with no decimals by default', () => {
    expect(formatPercent(50)).toBe('50%')
    expect(formatPercent(33.33)).toBe('33%')
  })

  it('formats percentage with decimals', () => {
    expect(formatPercent(33.333, 1)).toBe('33.3%')
    expect(formatPercent(33.333, 2)).toBe('33.33%')
  })
})

describe('groupBy', () => {
  it('groups array by key function', () => {
    const items = [
      { category: 'a', value: 1 },
      { category: 'b', value: 2 },
      { category: 'a', value: 3 },
    ]

    const result = groupBy(items, (item) => item.category)

    expect(result).toEqual({
      a: [
        { category: 'a', value: 1 },
        { category: 'a', value: 3 },
      ],
      b: [
        { category: 'b', value: 2 },
      ],
    })
  })

  it('handles empty array', () => {
    const result = groupBy([], (item: { key: string }) => item.key)
    expect(result).toEqual({})
  })
})

describe('toDateString', () => {
  it('formats date to YYYY-MM-DD', () => {
    const date = new Date('2024-01-15T12:00:00Z')
    expect(toDateString(date)).toBe('2024-01-15')
  })
})

describe('clamp', () => {
  it('clamps value to range', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-5, 0, 10)).toBe(0)
    expect(clamp(15, 0, 10)).toBe(10)
  })

  it('handles edge cases', () => {
    expect(clamp(0, 0, 10)).toBe(0)
    expect(clamp(10, 0, 10)).toBe(10)
  })
})

describe('isSameDay', () => {
  it('returns true for same day', () => {
    const date1 = new Date('2024-01-15T10:00:00Z')
    const date2 = new Date('2024-01-15T15:00:00Z')
    expect(isSameDay(date1, date2)).toBe(true)
  })

  it('returns false for different days', () => {
    const date1 = new Date('2024-01-15T10:00:00Z')
    const date2 = new Date('2024-01-16T10:00:00Z')
    expect(isSameDay(date1, date2)).toBe(false)
  })
})

describe('addDays', () => {
  it('adds positive days', () => {
    // Use explicit local time to avoid timezone issues
    const date = new Date(2024, 0, 15) // Jan 15, 2024 local time
    const result = addDays(date, 5)
    expect(result.getDate()).toBe(20)
  })

  it('adds negative days (subtracts)', () => {
    const date = new Date(2024, 0, 15) // Jan 15, 2024 local time
    const result = addDays(date, -5)
    expect(result.getDate()).toBe(10)
  })

  it('handles month boundaries', () => {
    const date = new Date(2024, 0, 30) // Jan 30, 2024 local time
    const result = addDays(date, 5)
    expect(result.getMonth()).toBe(1) // February
    expect(result.getDate()).toBe(4)
  })
})

describe('getRelativeTime', () => {
  it('returns "just now" for recent timestamps', () => {
    const now = Math.floor(Date.now() / 1000)
    expect(getRelativeTime(now)).toBe('just now')
    expect(getRelativeTime(now - 30)).toBe('just now')
  })

  it('returns minutes ago', () => {
    const now = Math.floor(Date.now() / 1000)
    expect(getRelativeTime(now - 120)).toBe('2m ago')
    expect(getRelativeTime(now - 300)).toBe('5m ago')
  })

  it('returns hours ago', () => {
    const now = Math.floor(Date.now() / 1000)
    expect(getRelativeTime(now - 7200)).toBe('2h ago')
    expect(getRelativeTime(now - 10800)).toBe('3h ago')
  })

  it('returns days ago', () => {
    const now = Math.floor(Date.now() / 1000)
    expect(getRelativeTime(now - 172800)).toBe('2d ago')
    expect(getRelativeTime(now - 259200)).toBe('3d ago')
  })
})
