import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { queryKeys, useDailyStats, useConfig, useReportHistory } from './hooks'

// Mock the api client
vi.mock('./client', () => ({
  api: {
    analytics: {
      getDailyStats: vi.fn().mockResolvedValue({
        date: '2024-01-15',
        totalTime: 28800,
        screenshotCount: 50,
        sessionCount: 3,
        topApps: [
          { name: 'VS Code', duration: 14400, color: '#007ACC' },
          { name: 'Chrome', duration: 10800, color: '#4285F4' },
        ],
      }),
    },
    config: {
      getConfig: vi.fn().mockResolvedValue({
        captureInterval: 30,
        quality: 'balanced',
        afkTimeout: 300,
        inferenceEnabled: true,
        inferenceModel: 'local',
        dataRetentionDays: 30,
      }),
    },
    reports: {
      getReportHistory: vi.fn().mockResolvedValue([
        { id: 1, title: 'Daily Report', createdAt: '2024-01-15T10:00:00Z', format: 'markdown' },
      ]),
    },
  },
}))

describe('Query Keys', () => {
  it('generates correct analytics daily key', () => {
    const key = queryKeys.analytics.daily('2024-01-15')
    expect(key).toEqual(['analytics', 'daily', '2024-01-15'])
  })

  it('generates correct timeline sessions key', () => {
    const key = queryKeys.timeline.sessions('2024-01-15')
    expect(key).toEqual(['timeline', 'sessions', '2024-01-15'])
  })

  it('generates correct config key', () => {
    const key = queryKeys.config.all()
    expect(key).toEqual(['config'])
  })

  it('generates correct screenshots key with parameters', () => {
    const key = queryKeys.timeline.screenshots(1, 1, 20)
    expect(key).toEqual(['timeline', 'screenshots', 1, 1, 20])
  })
})

// Create a wrapper with QueryClientProvider
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useDailyStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches daily stats successfully', async () => {
    const { result } = renderHook(() => useDailyStats('2024-01-15'), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual({
      date: '2024-01-15',
      totalTime: 28800,
      screenshotCount: 50,
      sessionCount: 3,
      topApps: expect.any(Array),
    })
  })
})

describe('useConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches config successfully', async () => {
    const { result } = renderHook(() => useConfig(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual({
      captureInterval: 30,
      quality: 'balanced',
      afkTimeout: 300,
      inferenceEnabled: true,
      inferenceModel: 'local',
      dataRetentionDays: 30,
    })
  })
})

describe('useReportHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches report history successfully', async () => {
    const { result } = renderHook(() => useReportHistory(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0]).toMatchObject({
      id: 1,
      title: 'Daily Report',
    })
  })
})
