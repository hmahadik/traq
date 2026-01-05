import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import {
  ScreenshotSkeleton,
  SessionCardSkeleton,
  StatCardSkeleton,
  ListSkeleton,
  ChartSkeleton,
  TableSkeleton,
  PageSkeleton,
} from './LoadingStates'

describe('ScreenshotSkeleton', () => {
  it('renders with aspect-video class', () => {
    const { container } = render(<ScreenshotSkeleton />)
    expect(container.querySelector('.aspect-video')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<ScreenshotSkeleton className="custom-class" />)
    expect(container.querySelector('.custom-class')).toBeInTheDocument()
  })
})

describe('SessionCardSkeleton', () => {
  it('renders card structure', () => {
    const { container } = render(<SessionCardSkeleton />)
    expect(container.querySelector('[class*="border"]')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<SessionCardSkeleton className="custom-class" />)
    expect(container.querySelector('.custom-class')).toBeInTheDocument()
  })
})

describe('StatCardSkeleton', () => {
  it('renders skeleton elements', () => {
    const { container } = render(<StatCardSkeleton />)
    expect(container.querySelectorAll('[class*="animate-pulse"]').length).toBeGreaterThan(0)
  })

  it('applies custom className', () => {
    const { container } = render(<StatCardSkeleton className="custom-class" />)
    expect(container.querySelector('.custom-class')).toBeInTheDocument()
  })
})

describe('ListSkeleton', () => {
  it('renders default 5 items', () => {
    const { container } = render(<ListSkeleton />)
    const items = container.querySelectorAll('.flex.items-center.gap-3')
    expect(items.length).toBe(5)
  })

  it('renders specified count of items', () => {
    const { container } = render(<ListSkeleton count={3} />)
    const items = container.querySelectorAll('.flex.items-center.gap-3')
    expect(items.length).toBe(3)
  })

  it('applies custom className', () => {
    const { container } = render(<ListSkeleton className="custom-class" />)
    expect(container.querySelector('.custom-class')).toBeInTheDocument()
  })
})

describe('ChartSkeleton', () => {
  it('renders with height class', () => {
    const { container } = render(<ChartSkeleton />)
    expect(container.querySelector('[class*="h-"]')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<ChartSkeleton className="custom-class" />)
    expect(container.querySelector('.custom-class')).toBeInTheDocument()
  })
})

describe('TableSkeleton', () => {
  it('renders default 5 rows', () => {
    const { container } = render(<TableSkeleton />)
    // Header + 5 rows
    const rows = container.querySelectorAll('.flex.gap-4')
    expect(rows.length).toBe(6) // 1 header + 5 data rows
  })

  it('renders specified number of rows', () => {
    const { container } = render(<TableSkeleton rows={3} />)
    const rows = container.querySelectorAll('.flex.gap-4')
    expect(rows.length).toBe(4) // 1 header + 3 data rows
  })

  it('applies custom className', () => {
    const { container } = render(<TableSkeleton className="custom-class" />)
    expect(container.querySelector('.custom-class')).toBeInTheDocument()
  })
})

describe('PageSkeleton', () => {
  it('renders page structure with stat cards', () => {
    const { container } = render(<PageSkeleton />)
    // Should have 4 stat card skeletons
    const grid = container.querySelector('.grid')
    expect(grid).toBeInTheDocument()
  })

  it('renders chart skeleton', () => {
    const { container } = render(<PageSkeleton />)
    expect(container.querySelector('[class*="h-\\[300px\\]"]')).toBeInTheDocument()
  })
})
