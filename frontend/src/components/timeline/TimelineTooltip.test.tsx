import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TimelineTooltip } from './TimelineTooltip';
import type { EventDot } from './timelineTypes';

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

describe('TimelineTooltip', () => {
  describe('rendering', () => {
    it('returns null when event is null', () => {
      const { container } = render(
        <TimelineTooltip event={null} position={{ x: 100, y: 100 }} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('returns null when position is null', () => {
      const { container } = render(
        <TimelineTooltip event={createMockEvent()} position={null} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders tooltip when event and position are provided', () => {
      render(
        <TimelineTooltip
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
        <TimelineTooltip
          event={createMockEvent({ type: 'activity' })}
          position={{ x: 100, y: 100 }}
        />
      );
      expect(screen.getByText('Activity')).toBeInTheDocument();
    });

    it('displays Git Commit type label', () => {
      render(
        <TimelineTooltip
          event={createMockEvent({ type: 'git', label: 'feat: add feature' })}
          position={{ x: 100, y: 100 }}
        />
      );
      expect(screen.getByText('Git Commit')).toBeInTheDocument();
    });

    it('displays Shell Command type label', () => {
      render(
        <TimelineTooltip
          event={createMockEvent({ type: 'shell', label: 'npm test' })}
          position={{ x: 100, y: 100 }}
        />
      );
      expect(screen.getByText('Shell Command')).toBeInTheDocument();
    });

    it('displays Browser Visit type label', () => {
      render(
        <TimelineTooltip
          event={createMockEvent({ type: 'browser', label: 'Example.com' })}
          position={{ x: 100, y: 100 }}
        />
      );
      expect(screen.getByText('Browser Visit')).toBeInTheDocument();
    });

    it('displays Break type label for afk events', () => {
      render(
        <TimelineTooltip
          event={createMockEvent({ type: 'afk', label: 'Break (15m)' })}
          position={{ x: 100, y: 100 }}
        />
      );
      expect(screen.getByText('Break')).toBeInTheDocument();
    });

    it('displays Screenshot type label', () => {
      render(
        <TimelineTooltip
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
        <TimelineTooltip
          event={createMockEvent({ duration: 45 })}
          position={{ x: 100, y: 100 }}
        />
      );
      expect(screen.getByText('Duration: 45s')).toBeInTheDocument();
    });

    it('displays duration in minutes when >= 60 and < 3600', () => {
      render(
        <TimelineTooltip
          event={createMockEvent({ duration: 300 })}
          position={{ x: 100, y: 100 }}
        />
      );
      expect(screen.getByText('Duration: 5m')).toBeInTheDocument();
    });

    it('displays duration in hours and minutes when >= 3600', () => {
      render(
        <TimelineTooltip
          event={createMockEvent({ duration: 5400 })}
          position={{ x: 100, y: 100 }}
        />
      );
      expect(screen.getByText('Duration: 1h 30m')).toBeInTheDocument();
    });

    it('does not display duration when undefined', () => {
      render(
        <TimelineTooltip
          event={createMockEvent({ duration: undefined })}
          position={{ x: 100, y: 100 }}
        />
      );
      expect(screen.queryByText(/Duration:/)).not.toBeInTheDocument();
    });

    it('does not display duration when 0', () => {
      render(
        <TimelineTooltip
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
      render(<TimelineTooltip event={event} position={{ x: 100, y: 100 }} />);
      // Time should be displayed (format depends on locale)
      expect(screen.getByText(/2:30 PM/i)).toBeInTheDocument();
    });
  });

  describe('action buttons', () => {
    it('shows edit button only for activity type', () => {
      const onEdit = vi.fn();
      render(
        <TimelineTooltip
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
        <TimelineTooltip
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
        <TimelineTooltip
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
        <TimelineTooltip
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
        <TimelineTooltip
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
        <TimelineTooltip
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
        <TimelineTooltip
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
        <TimelineTooltip
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
        <TimelineTooltip
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
        <TimelineTooltip
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
        <TimelineTooltip
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
        <TimelineTooltip
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
        <TimelineTooltip
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
        <TimelineTooltip
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

  describe('close behavior', () => {
    it('calls onClose when close button is clicked', () => {
      const onClose = vi.fn();
      render(
        <TimelineTooltip
          event={createMockEvent()}
          position={{ x: 100, y: 100 }}
          onClose={onClose}
        />
      );
      fireEvent.click(screen.getByTitle('Close'));
      expect(onClose).toHaveBeenCalled();
    });

    it('renders close button when onClose is provided', () => {
      const onClose = vi.fn();
      render(
        <TimelineTooltip
          event={createMockEvent()}
          position={{ x: 100, y: 100 }}
          onClose={onClose}
        />
      );
      expect(screen.getByTitle('Close')).toBeInTheDocument();
    });
  });
});
