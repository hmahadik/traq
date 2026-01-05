import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DurationDisplay } from './DurationDisplay'

describe('DurationDisplay', () => {
  it('formats seconds correctly', () => {
    render(<DurationDisplay seconds={45} />)
    expect(screen.getByText('45s')).toBeInTheDocument()
  })

  it('formats minutes correctly', () => {
    render(<DurationDisplay seconds={90} />)
    expect(screen.getByText('1m 30s')).toBeInTheDocument()
  })

  it('formats hours correctly', () => {
    render(<DurationDisplay seconds={3660} />)
    expect(screen.getByText('1h 1m')).toBeInTheDocument()
  })

  it('shows icon when showIcon is true', () => {
    const { container } = render(<DurationDisplay seconds={60} showIcon={true} />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('hides icon when showIcon is false', () => {
    const { container } = render(<DurationDisplay seconds={60} showIcon={false} />)
    expect(container.querySelector('svg')).not.toBeInTheDocument()
  })

  it('applies size classes', () => {
    const { container, rerender } = render(<DurationDisplay seconds={60} size="sm" />)
    expect(container.querySelector('.text-xs')).toBeInTheDocument()

    rerender(<DurationDisplay seconds={60} size="lg" />)
    expect(container.querySelector('.text-base')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<DurationDisplay seconds={60} className="test-class" />)
    expect(container.querySelector('.test-class')).toBeInTheDocument()
  })
})
