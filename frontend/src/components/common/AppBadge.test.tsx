import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppBadge } from './AppBadge'

describe('AppBadge', () => {
  it('renders app name and icon', () => {
    render(<AppBadge appName="VS Code" />)
    expect(screen.getByText('VS Code')).toBeInTheDocument()
    expect(screen.getByText('V')).toBeInTheDocument() // First letter
  })

  it('renders Unknown for null app name', () => {
    render(<AppBadge appName={null} />)
    expect(screen.getByText('Unknown')).toBeInTheDocument()
    expect(screen.getByText('U')).toBeInTheDocument()
  })

  it('hides name when showName is false', () => {
    render(<AppBadge appName="Chrome" showName={false} />)
    expect(screen.queryByText('Chrome')).not.toBeInTheDocument()
    expect(screen.getByText('C')).toBeInTheDocument()
  })

  it('applies size classes', () => {
    const { container, rerender } = render(<AppBadge appName="Firefox" size="sm" />)
    expect(container.querySelector('.text-xs')).toBeInTheDocument()

    rerender(<AppBadge appName="Firefox" size="lg" />)
    expect(container.querySelector('.text-base')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<AppBadge appName="Test" className="custom-class" />)
    expect(container.querySelector('.custom-class')).toBeInTheDocument()
  })

  it('uses known app colors for known apps', () => {
    const { container } = render(<AppBadge appName="VS Code" />)
    expect(container.querySelector('.bg-blue-500')).toBeInTheDocument()
  })

  it('uses default color for unknown apps', () => {
    const { container } = render(<AppBadge appName="RandomApp" />)
    expect(container.querySelector('.bg-muted')).toBeInTheDocument()
  })
})
