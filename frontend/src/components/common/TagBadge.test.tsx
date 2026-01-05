import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TagBadge, TagList } from './TagBadge'

describe('TagBadge', () => {
  it('renders tag text', () => {
    render(<TagBadge tag="coding" />)
    expect(screen.getByText('coding')).toBeInTheDocument()
  })

  it('applies known tag colors', () => {
    const { container } = render(<TagBadge tag="coding" />)
    expect(container.querySelector('.text-blue-600')).toBeInTheDocument()
  })

  it('handles case-insensitive tag matching', () => {
    const { container } = render(<TagBadge tag="CODING" />)
    expect(container.querySelector('.text-blue-600')).toBeInTheDocument()
  })

  it('uses default color for unknown tags', () => {
    const { container } = render(<TagBadge tag="unknown-tag" />)
    expect(container.querySelector('.text-muted-foreground')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<TagBadge tag="test" className="custom-class" />)
    expect(container.querySelector('.custom-class')).toBeInTheDocument()
  })
})

describe('TagList', () => {
  it('renders all tags when within max', () => {
    render(<TagList tags={['coding', 'testing']} />)
    expect(screen.getByText('coding')).toBeInTheDocument()
    expect(screen.getByText('testing')).toBeInTheDocument()
  })

  it('limits tags to max and shows remaining count', () => {
    render(<TagList tags={['coding', 'testing', 'design', 'review']} max={2} />)
    expect(screen.getByText('coding')).toBeInTheDocument()
    expect(screen.getByText('testing')).toBeInTheDocument()
    expect(screen.queryByText('design')).not.toBeInTheDocument()
    expect(screen.getByText('+2')).toBeInTheDocument()
  })

  it('handles empty tags array', () => {
    const { container } = render(<TagList tags={[]} />)
    expect(container.querySelector('.flex')).toBeInTheDocument()
  })

  it('respects default max of 5', () => {
    const tags = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
    render(<TagList tags={tags} />)
    expect(screen.getByText('a')).toBeInTheDocument()
    expect(screen.getByText('e')).toBeInTheDocument()
    expect(screen.queryByText('f')).not.toBeInTheDocument()
    expect(screen.getByText('+2')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<TagList tags={['test']} className="custom-class" />)
    expect(container.querySelector('.custom-class')).toBeInTheDocument()
  })
})
