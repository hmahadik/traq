import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock window.go for Wails bindings
vi.mock('@/wailsjs/go/main/App', () => ({
  GetScreenshots: vi.fn().mockResolvedValue([]),
  GetSessions: vi.fn().mockResolvedValue([]),
  GetConfig: vi.fn().mockResolvedValue({}),
  SetConfig: vi.fn().mockResolvedValue(undefined),
  GetAnalytics: vi.fn().mockResolvedValue({}),
  GetReports: vi.fn().mockResolvedValue([]),
  GenerateReport: vi.fn().mockResolvedValue({}),
}))

// Mock Wails runtime
vi.mock('@/wailsjs/runtime/runtime', () => ({
  EventsOn: vi.fn(),
  EventsOff: vi.fn(),
  EventsEmit: vi.fn(),
}))
