import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConfidenceBadge } from './ConfidenceBadge'

describe('ConfidenceBadge', () => {
  it('renders null when confidence is null', () => {
    const { container } = render(<ConfidenceBadge confidence={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders high confidence badge', () => {
    render(<ConfidenceBadge confidence="high" />)
    expect(screen.getByText('High Confidence')).toBeInTheDocument()
  })

  it('renders medium confidence badge', () => {
    render(<ConfidenceBadge confidence="medium" />)
    expect(screen.getByText('Medium Confidence')).toBeInTheDocument()
  })

  it('renders low confidence badge', () => {
    render(<ConfidenceBadge confidence="low" />)
    expect(screen.getByText('Low Confidence')).toBeInTheDocument()
  })

  it('shows icon by default', () => {
    const { container } = render(<ConfidenceBadge confidence="high" />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('hides icon when showIcon is false', () => {
    const { container } = render(<ConfidenceBadge confidence="high" showIcon={false} />)
    expect(container.querySelector('svg')).not.toBeInTheDocument()
  })

  it('applies correct color classes for each confidence level', () => {
    const { container: highContainer } = render(<ConfidenceBadge confidence="high" />)
    expect(highContainer.querySelector('.text-green-600')).toBeInTheDocument()

    const { container: medContainer } = render(<ConfidenceBadge confidence="medium" />)
    expect(medContainer.querySelector('.text-yellow-600')).toBeInTheDocument()

    const { container: lowContainer } = render(<ConfidenceBadge confidence="low" />)
    expect(lowContainer.querySelector('.text-red-600')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<ConfidenceBadge confidence="high" className="custom-class" />)
    expect(container.querySelector('.custom-class')).toBeInTheDocument()
  })
})
