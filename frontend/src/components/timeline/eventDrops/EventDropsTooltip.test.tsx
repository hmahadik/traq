import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EventDropsTooltip } from './EventDropsTooltip';
import type { EventDot } from './eventDropsTypes';

// Helper to create mock event
const createMockEvent = (overrides: Partial<EventDot> = {}): EventDot => ({
  id: 'activity-1',
  originalId: 1,
  timestamp: new Date('2024-01-16T10:30:00'),
  type: 'activity',
  row: 'Chrome',
  label: 'Test Window Title',
  duration: 300,
  color: '#3b82f6',
  metadata: {},
  ...overrides,
});

describe('EventDropsTooltip', () => {
  describe('rendering', () => {
    it('returns null when event is null', () => {
      const { container } = render(
        <EventDropsTooltip event={null} position={{ x: 100, y: 100 }} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('returns null when position is null', () => {
      const { container } = render(
        <EventDropsTooltip event={createMockEvent()} position={null} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders tooltip when event and position are provided', () => {
      render(
        <EventDropsTooltip
          event={createMockEvent()}
          position={{ x: 100, y: 100 }}
        />
      );
      expect(screen.getByText('Test Window Title')).toBeInTheDocument();
    });
  });

  describe('event type display', () => {
    it('displays Activity type label', () => {
      render(
        <EventDropsTooltip
          event={createMockEvent({ type: 'activity' })}
          position={{ x: 100, y: 100 }}
        />
      );
      expect(screen.getByText('Activity')).toBeInTheDocument();
    });

    it('displays Git Commit type label', () => {
      render(
        <EventDropsTooltip
          event={createMockEvent({ type: 'git', label: 'feat: add feature' })}
          position={{ x: 100, y: 100 }}
        />
      );
      expect(screen.getByText('Git Commit')).toBeInTheDocument();
    });

    it('displays Shell Command type label', () => {
      render(
        <EventDropsTooltip
          event={createMockEvent({ type: 'shell', label: 'npm test' })}
          position={{ x: 100, y: 100 }}
        />
      );
      expect(screen.getByText('Shell Command')).toBeInTheDocument();
    });

    it('displays Browser Visit type label', () => {
      render(
        <EventDropsTooltip
          event={createMockEvent({ type: 'browser', label: 'Example.com' })}
          position={{ x: 100, y: 100 }}
        />
      );
      expect(screen.getByText('Browser Visit')).toBeInTheDocument();
    });

    it('displays Break type label for afk events', () => {
      render(
        <EventDropsTooltip
          event={createMockEvent({ type: 'afk', label: 'Break (15m)' })}
          position={{ x: 100, y: 100 }}
        />
      );
      expect(screen.getByText('Break')).toBeInTheDocument();
    });

    it('displays Screenshot type label', () => {
      render(
        <EventDropsTooltip
          event={createMockEvent({ type: 'screenshot', label: 'screenshot.png' })}
          position={{ x: 100, y: 100 }}
        />
      );
      expect(screen.getByText('Screenshot')).toBeInTheDocument();
    });
  });

  describe('duration display', () => {
    it('displays duration in seconds when < 60', () => {
      render(
        <EventDropsTooltip
          event={createMockEvent({ duration: 45 })}
          position={{ x: 100, y: 100 }}
        />
      );
      expect(screen.getByText('Duration: 45s')).toBeInTheDocument();
    });

    it('displays duration in minutes when >= 60 and < 3600', () => {
      render(
        <EventDropsTooltip
          event={createMockEvent({ duration: 300 })}
          position={{ x: 100, y: 100 }}
        />
      );
      expect(screen.getByText('Duration: 5m')).toBeInTheDocument();
    });

    it('displays duration in hours and minutes when >= 3600', () => {
      render(
        <EventDropsTooltip
          event={createMockEvent({ duration: 5400 })}
          position={{ x: 100, y: 100 }}
        />
      );
      expect(screen.getByText('Duration: 1h 30m')).toBeInTheDocument();
    });

    it('does not display duration when undefined', () => {
      render(
        <EventDropsTooltip
          event={createMockEvent({ duration: undefined })}
          position={{ x: 100, y: 100 }}
        />
      );
      expect(screen.queryByText(/Duration:/)).not.toBeInTheDocument();
    });

    it('does not display duration when 0', () => {
      render(
        <EventDropsTooltip
          event={createMockEvent({ duration: 0 })}
          position={{ x: 100, y: 100 }}
        />
      );
      expect(screen.queryByText(/Duration:/)).not.toBeInTheDocument();
    });
  });

  describe('time display', () => {
    it('formats time correctly', () => {
      const event = createMockEvent({
        timestamp: new Date('2024-01-16T14:30:00'),
      });
      render(<EventDropsTooltip event={event} position={{ x: 100, y: 100 }} />);
      // Time should be displayed (format depends on locale)
      expect(screen.getByText(/2:30 PM/i)).toBeInTheDocument();
    });
  });

  describe('action buttons', () => {
    it('shows edit button only for activity type', () => {
      const onEdit = vi.fn();
      render(
        <EventDropsTooltip
          event={createMockEvent({ type: 'activity' })}
          position={{ x: 100, y: 100 }}
          onEdit={onEdit}
        />
      );
      expect(screen.getByTitle('Edit activity')).toBeInTheDocument();
    });

    it('does not show edit button for non-activity types', () => {
      const onEdit = vi.fn();
      render(
        <EventDropsTooltip
          event={createMockEvent({ type: 'git' })}
          position={{ x: 100, y: 100 }}
          onEdit={onEdit}
        />
      );
      expect(screen.queryByTitle('Edit activity')).not.toBeInTheDocument();
    });

    it('shows delete button for non-screenshot types', () => {
      const onDelete = vi.fn();
      render(
        <EventDropsTooltip
          event={createMockEvent({ type: 'activity' })}
          position={{ x: 100, y: 100 }}
          onDelete={onDelete}
        />
      );
      expect(screen.getByTitle('Delete event')).toBeInTheDocument();
    });

    it('does not show delete button for screenshot type', () => {
      const onDelete = vi.fn();
      render(
        <EventDropsTooltip
          event={createMockEvent({ type: 'screenshot' })}
          position={{ x: 100, y: 100 }}
          onDelete={onDelete}
        />
      );
      expect(screen.queryByTitle('Delete event')).not.toBeInTheDocument();
    });

    it('calls onEdit when edit button is clicked', () => {
      const onEdit = vi.fn();
      const event = createMockEvent({ type: 'activity' });
      render(
        <EventDropsTooltip
          event={event}
          position={{ x: 100, y: 100 }}
          onEdit={onEdit}
        />
      );
      fireEvent.click(screen.getByTitle('Edit activity'));
      expect(onEdit).toHaveBeenCalledWith(event);
    });

    it('calls onDelete when delete button is clicked', () => {
      const onDelete = vi.fn();
      const event = createMockEvent({ type: 'activity' });
      render(
        <EventDropsTooltip
          event={event}
          position={{ x: 100, y: 100 }}
          onDelete={onDelete}
        />
      );
      fireEvent.click(screen.getByTitle('Delete event'));
      expect(onDelete).toHaveBeenCalledWith(event);
    });

    it('stops event propagation when clicking buttons', () => {
      const onEdit = vi.fn();
      const event = createMockEvent({ type: 'activity' });
      render(
        <EventDropsTooltip
          event={event}
          position={{ x: 100, y: 100 }}
          onEdit={onEdit}
        />
      );

      const editButton = screen.getByTitle('Edit activity');
      const clickEvent = new MouseEvent('click', { bubbles: true });
      const stopPropagation = vi.spyOn(clickEvent, 'stopPropagation');
      editButton.dispatchEvent(clickEvent);
      expect(stopPropagation).toHaveBeenCalled();
    });
  });

  describe('extra details', () => {
    it('shows app name for activity events', () => {
      render(
        <EventDropsTooltip
          event={createMockEvent({
            type: 'activity',
            metadata: { appName: 'Chrome' },
          })}
          position={{ x: 100, y: 100 }}
        />
      );
      expect(screen.getByText('App:')).toBeInTheDocument();
      expect(screen.getByText('Chrome')).toBeInTheDocument();
    });

    it('shows repository for git events', () => {
      render(
        <EventDropsTooltip
          event={createMockEvent({
            type: 'git',
            metadata: { repository: 'my-repo', branch: 'main' },
          })}
          position={{ x: 100, y: 100 }}
        />
      );
      expect(screen.getByText('Repo:')).toBeInTheDocument();
      expect(screen.getByText('my-repo')).toBeInTheDocument();
    });

    it('shows changes for git events', () => {
      render(
        <EventDropsTooltip
          event={createMockEvent({
            type: 'git',
            metadata: { insertions: 10, deletions: 5 },
          })}
          position={{ x: 100, y: 100 }}
        />
      );
      expect(screen.getByText('Changes:')).toBeInTheDocument();
      expect(screen.getByText('+10 -5')).toBeInTheDocument();
    });

    it('shows shell type for shell events', () => {
      render(
        <EventDropsTooltip
          event={createMockEvent({
            type: 'shell',
            metadata: { shellType: 'bash' },
          })}
          position={{ x: 100, y: 100 }}
        />
      );
      expect(screen.getByText('Shell:')).toBeInTheDocument();
      expect(screen.getByText('bash')).toBeInTheDocument();
    });

    it('shows exit code for failed shell commands', () => {
      render(
        <EventDropsTooltip
          event={createMockEvent({
            type: 'shell',
            metadata: { exitCode: 1 },
          })}
          position={{ x: 100, y: 100 }}
        />
      );
      expect(screen.getByText('Exit:')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('does not show exit code for successful shell commands', () => {
      render(
        <EventDropsTooltip
          event={createMockEvent({
            type: 'shell',
            metadata: { exitCode: 0 },
          })}
          position={{ x: 100, y: 100 }}
        />
      );
      expect(screen.queryByText('Exit:')).not.toBeInTheDocument();
    });

    it('shows domain for browser events', () => {
      render(
        <EventDropsTooltip
          event={createMockEvent({
            type: 'browser',
            metadata: { domain: 'example.com' },
          })}
          position={{ x: 100, y: 100 }}
        />
      );
      expect(screen.getByText('Domain:')).toBeInTheDocument();
      expect(screen.getByText('example.com')).toBeInTheDocument();
    });
  });

  describe('mouse events', () => {
    it('calls onMouseEnter when mouse enters tooltip', () => {
      const onMouseEnter = vi.fn();
      render(
        <EventDropsTooltip
          event={createMockEvent()}
          position={{ x: 100, y: 100 }}
          onMouseEnter={onMouseEnter}
        />
      );
      fireEvent.mouseEnter(screen.getByText('Test Window Title').closest('div')!.parentElement!);
      expect(onMouseEnter).toHaveBeenCalled();
    });

    it('calls onMouseLeave when mouse leaves tooltip', () => {
      const onMouseLeave = vi.fn();
      render(
        <EventDropsTooltip
          event={createMockEvent()}
          position={{ x: 100, y: 100 }}
          onMouseLeave={onMouseLeave}
        />
      );
      fireEvent.mouseLeave(screen.getByText('Test Window Title').closest('div')!.parentElement!);
      expect(onMouseLeave).toHaveBeenCalled();
    });
  });
});
