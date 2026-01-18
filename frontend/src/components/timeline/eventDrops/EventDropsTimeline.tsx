import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import { GitCommit, Terminal, Globe, FileText, Coffee, Monitor, Camera, Pencil, Trash2 } from 'lucide-react';
import type { TimelineGridData } from '@/types/timeline';
import type { Screenshot } from '@/types/screenshot';
import type { TimelineFilters } from '../FilterControls';
import { useEventDropsData } from './useEventDropsData';
import { EventDropsTooltip } from './EventDropsTooltip';
import type { EventDot, EventDropType } from './eventDropsTypes';

interface EventDropsTimelineProps {
  data: TimelineGridData | null | undefined;
  filters: TimelineFilters;
  screenshots?: Screenshot[];
  rowHeight?: number;
  onEventClick?: (event: EventDot) => void;
  onEventDelete?: (event: EventDot) => void;
  onEventEdit?: (event: EventDot) => void;
  onViewScreenshot?: (event: EventDot) => void;
}

// Layout constants
const MARGIN = { top: 50, right: 30, bottom: 30, left: 160 };
const ROW_HEIGHT = 32; // Fixed height for each swim lane
const DOT_RADIUS = 5;
const DOT_HOVER_RADIUS = 8;

// Icon map for event list
const EVENT_TYPE_ICONS: Record<EventDropType, typeof GitCommit> = {
  activity: Monitor,
  git: GitCommit,
  shell: Terminal,
  browser: Globe,
  file: FileText,
  afk: Coffee,
  screenshot: Camera,
};

export function EventDropsTimeline({
  data,
  filters,
  screenshots,
  rowHeight = ROW_HEIGHT,
  onEventClick,
  onEventDelete,
  onEventEdit,
  onViewScreenshot,
}: EventDropsTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });
  const [hoveredEvent, setHoveredEvent] = useState<EventDot | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [isTooltipHovered, setIsTooltipHovered] = useState(false);
  const hideTooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [currentZoom, setCurrentZoom] = useState<d3.ZoomTransform>(d3.zoomIdentity);
  const [visibleTimeRange, setVisibleTimeRange] = useState<{ start: Date; end: Date } | null>(null);
  const [listHeight, setListHeight] = useState(() => {
    try {
      const stored = localStorage.getItem('eventdrops-list-height');
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed) && parsed >= 100 && parsed <= 500) return parsed;
      }
    } catch (e) {
      // Ignore localStorage errors
    }
    return 200;
  });
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartRef = useRef<{ startY: number; startHeight: number } | null>(null);

  // Persist list height to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('eventdrops-list-height', listHeight.toString());
    } catch (e) {
      // Ignore localStorage errors
    }
  }, [listHeight]);

  // Transform data to EventDrops format
  const eventDropsData = useEventDropsData({ data, filters, screenshots });

  // Handle resize drag for the list panel
  useEffect(() => {
    let rafId: number | null = null;
    let pendingHeight: number | null = null;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !resizeStartRef.current) return;

      // Calculate delta from start position (dragging UP = positive delta = bigger height)
      const deltaY = resizeStartRef.current.startY - e.clientY;
      const newHeight = Math.max(100, Math.min(500, resizeStartRef.current.startHeight + deltaY));

      // Store pending height and schedule RAF if not already scheduled
      pendingHeight = newHeight;
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          if (pendingHeight !== null) {
            setListHeight(pendingHeight);
          }
          rafId = null;
        });
      }
    };

    const handleMouseUp = () => {
      // Apply final height immediately
      if (pendingHeight !== null) {
        setListHeight(pendingHeight);
      }
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      resizeStartRef.current = null;
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  // Get computed colors from CSS - handles HSL format used by shadcn/ui
  const getComputedColor = useCallback((cssVar: string, fallback: string): string => {
    if (typeof window === 'undefined') return fallback;
    try {
      const root = document.documentElement;
      const varName = cssVar.replace('var(', '').replace(')', '').trim();
      const computed = getComputedStyle(root).getPropertyValue(varName).trim();
      if (!computed) return fallback;
      // If it's HSL values without hsl() wrapper (shadcn format like "210 40% 98%")
      if (/^\d/.test(computed) && computed.includes('%')) {
        return `hsl(${computed})`;
      }
      return computed;
    } catch {
      return fallback;
    }
  }, []);

  // Handle resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width } = entry.contentRect;
        // Calculate height based on fixed row height
        const numRows = eventDropsData?.rows.length || 1;
        const calculatedHeight = MARGIN.top + MARGIN.bottom + numRows * rowHeight;
        setDimensions({ width, height: calculatedHeight });
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [eventDropsData?.rows.length, rowHeight]);

  // D3 rendering with zoom
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    if (!svg.node() || !eventDropsData) return;

    const { width, height } = dimensions;
    const { rows, timeRange } = eventDropsData;

    // Get actual colors
    const foregroundColor = getComputedColor('--foreground', '#e5e5e5');
    const mutedForeground = getComputedColor('--muted-foreground', '#a3a3a3');
    const borderColor = getComputedColor('--border', '#404040');
    const mutedColor = getComputedColor('--muted', '#262626');
    const backgroundColor = getComputedColor('--background', '#171717');

    // Clear previous content
    svg.selectAll('*').remove();

    // Create clip path for the chart area
    svg.append('defs')
      .append('clipPath')
      .attr('id', 'chart-clip')
      .append('rect')
      .attr('x', MARGIN.left)
      .attr('y', 0)
      .attr('width', width - MARGIN.left - MARGIN.right)
      .attr('height', height);

    // Create scales
    const xScale = d3
      .scaleTime()
      .domain([timeRange.start, timeRange.end])
      .range([MARGIN.left, width - MARGIN.right]);

    // Use fixed row height instead of scaleBand
    const yScale = (rowName: string): number => {
      const index = rows.findIndex((r) => r.name === rowName);
      return MARGIN.top + index * rowHeight;
    };
    yScale.bandwidth = () => rowHeight;

    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 20])
      .translateExtent([[MARGIN.left, 0], [width - MARGIN.right, height]])
      .extent([[MARGIN.left, 0], [width - MARGIN.right, height]])
      .on('zoom', (event) => {
        const transform = event.transform;
        setCurrentZoom(transform);

        // Create new scale based on zoom
        const newXScale = transform.rescaleX(xScale);

        // Calculate visible time range from the zoom transform
        const visibleStart = newXScale.invert(MARGIN.left);
        const visibleEnd = newXScale.invert(width - MARGIN.right);
        setVisibleTimeRange({ start: visibleStart, end: visibleEnd });

        // Update x-axis
        const xAxisGroup = svg.select<SVGGElement>('.x-axis');
        xAxisGroup.call(
          d3.axisTop(newXScale)
            .ticks(d3.timeHour.every(Math.max(1, Math.floor(2 / transform.k))))
            .tickFormat((d) => {
              const date = d as Date;
              return date.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: transform.k > 4 ? '2-digit' : undefined,
                hour12: true,
              });
            }) as any
        );
        xAxisGroup.select('.domain').attr('stroke', borderColor);
        xAxisGroup.selectAll('.tick line').attr('stroke', borderColor);
        xAxisGroup.selectAll('.tick text').attr('fill', mutedForeground).attr('font-size', '11px');

        // Update grid lines
        const gridLines = d3.timeHour.range(timeRange.start, timeRange.end);
        svg.select('.grid-lines')
          .selectAll<SVGLineElement, Date>('line')
          .data(gridLines)
          .attr('x1', (d) => newXScale(d))
          .attr('x2', (d) => newXScale(d));

        // Update dots
        svg.selectAll<SVGCircleElement, EventDot>('.event-dot')
          .attr('cx', (d) => newXScale(d.timestamp));

        // Update now line if exists
        svg.select('.now-line')
          .attr('x1', (d: any) => newXScale(d))
          .attr('x2', (d: any) => newXScale(d));

        svg.select('.now-text')
          .attr('x', (d: any) => newXScale(d));
      });

    // Apply zoom to SVG
    svg.call(zoom);

    // Create main group for zoomable content
    const chartGroup = svg.append('g').attr('class', 'chart-group');

    // Background rect to capture zoom events
    chartGroup.append('rect')
      .attr('class', 'zoom-rect')
      .attr('x', MARGIN.left)
      .attr('y', MARGIN.top)
      .attr('width', width - MARGIN.left - MARGIN.right)
      .attr('height', height - MARGIN.top - MARGIN.bottom)
      .attr('fill', 'transparent');

    // Add background for rows (alternating)
    chartGroup.selectAll('.row-bg')
      .data(rows)
      .join('rect')
      .attr('class', 'row-bg')
      .attr('x', MARGIN.left)
      .attr('y', (d) => yScale(d.name) || 0)
      .attr('width', width - MARGIN.left - MARGIN.right)
      .attr('height', yScale.bandwidth())
      .attr('fill', (_, i) => (i % 2 === 0 ? mutedColor : 'transparent'))
      .attr('opacity', 0.4);

    // Create X-axis (time)
    chartGroup.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${MARGIN.top})`)
      .call(
        d3.axisTop(xScale)
          .ticks(d3.timeHour.every(2))
          .tickFormat((d) => {
            const date = d as Date;
            return date.toLocaleTimeString('en-US', {
              hour: 'numeric',
              hour12: true,
            });
          }) as any
      )
      .call((g) => {
        g.select('.domain').attr('stroke', borderColor);
        g.selectAll('.tick line').attr('stroke', borderColor);
        g.selectAll('.tick text').attr('fill', mutedForeground).attr('font-size', '11px');
      });

    // Add grid lines for hours
    chartGroup.append('g')
      .attr('class', 'grid-lines')
      .selectAll('line')
      .data(d3.timeHour.range(timeRange.start, timeRange.end))
      .join('line')
      .attr('x1', (d) => xScale(d))
      .attr('x2', (d) => xScale(d))
      .attr('y1', MARGIN.top)
      .attr('y2', height - MARGIN.bottom)
      .attr('stroke', borderColor)
      .attr('stroke-opacity', 0.3)
      .attr('stroke-dasharray', '2,2');

    // Create clipped group for dots
    const dotsGroup = chartGroup.append('g')
      .attr('class', 'dots-group')
      .attr('clip-path', 'url(#chart-clip)');

    // Flatten all events for rendering
    const allEvents = rows.flatMap((row) => row.data);

    // Create dots
    dotsGroup.selectAll('.event-dot')
      .data(allEvents, (d) => (d as EventDot).id)
      .join('circle')
      .attr('class', 'event-dot')
      .attr('cx', (d) => xScale(d.timestamp))
      .attr('cy', (d) => (yScale(d.row) || 0) + yScale.bandwidth() / 2)
      .attr('r', DOT_RADIUS)
      .attr('fill', (d) => d.color)
      .attr('stroke', (d) => d.color)
      .attr('stroke-width', 1.5)
      .style('cursor', 'pointer')
      .on('mouseenter', function (event, d) {
        // Clear any pending hide timeout
        if (hideTooltipTimeoutRef.current) {
          clearTimeout(hideTooltipTimeoutRef.current);
          hideTooltipTimeoutRef.current = null;
        }

        d3.select(this)
          .transition()
          .duration(100)
          .attr('r', DOT_HOVER_RADIUS);

        setHoveredEvent(d);
        setTooltipPosition({ x: event.clientX, y: event.clientY });
      })
      .on('mousemove', function (event) {
        setTooltipPosition({ x: event.clientX, y: event.clientY });
      })
      .on('mouseleave', function () {
        d3.select(this)
          .transition()
          .duration(100)
          .attr('r', DOT_RADIUS);

        // Delay hiding to allow mouse to move to tooltip
        hideTooltipTimeoutRef.current = setTimeout(() => {
          if (!isTooltipHovered) {
            setHoveredEvent(null);
            setTooltipPosition(null);
          }
        }, 150);
      })
      .on('click', function (_, d) {
        onEventClick?.(d);
      });

    // Fixed label group (doesn't zoom)
    const labelGroup = svg.append('g').attr('class', 'label-group');

    // Background for labels
    labelGroup.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', MARGIN.left)
      .attr('height', height)
      .attr('fill', backgroundColor);

    // Create Y-axis (row labels) - fixed position
    labelGroup.selectAll('.row-label')
      .data(rows)
      .join('g')
      .attr('class', 'row-label')
      .attr('transform', (d) => `translate(${MARGIN.left - 8},${(yScale(d.name) || 0) + yScale.bandwidth() / 2})`)
      .each(function (d) {
        const group = d3.select(this);

        // Row color indicator
        group
          .append('rect')
          .attr('x', -MARGIN.left + 12)
          .attr('y', -10)
          .attr('width', 4)
          .attr('height', 20)
          .attr('rx', 2)
          .attr('fill', d.color);

        // Row name
        group
          .append('text')
          .attr('x', -MARGIN.left + 24)
          .attr('y', 0)
          .attr('dy', '0.35em')
          .attr('fill', foregroundColor)
          .attr('font-size', '13px')
          .attr('font-weight', '500')
          .attr('font-family', 'Inter, system-ui, sans-serif')
          .text(d.name.length > 12 ? d.name.slice(0, 12) + '…' : d.name);

        // Event count badge
        group
          .append('text')
          .attr('x', -12)
          .attr('y', 0)
          .attr('dy', '0.35em')
          .attr('text-anchor', 'end')
          .attr('fill', mutedForeground)
          .attr('font-size', '11px')
          .attr('font-family', 'Inter, system-ui, sans-serif')
          .text(`${d.dotCount}`);
      });

    // Add "now" indicator if viewing today
    const now = new Date();
    const today = new Date(timeRange.start);
    if (
      now.getFullYear() === today.getFullYear() &&
      now.getMonth() === today.getMonth() &&
      now.getDate() === today.getDate() &&
      now >= timeRange.start &&
      now <= timeRange.end
    ) {
      const nowX = xScale(now);

      chartGroup.append('line')
        .attr('class', 'now-line')
        .datum(now)
        .attr('x1', nowX)
        .attr('x2', nowX)
        .attr('y1', MARGIN.top)
        .attr('y2', height - MARGIN.bottom)
        .attr('stroke', '#ef4444')
        .attr('stroke-width', 2);

      chartGroup.append('text')
        .attr('class', 'now-text')
        .datum(now)
        .attr('x', nowX)
        .attr('y', MARGIN.top - 8)
        .attr('text-anchor', 'middle')
        .attr('fill', '#ef4444')
        .attr('font-size', '10px')
        .attr('font-weight', '600')
        .text('NOW');
    }

    // Zoom instructions
    svg.append('text')
      .attr('x', width - 10)
      .attr('y', height - 8)
      .attr('text-anchor', 'end')
      .attr('fill', mutedForeground)
      .attr('font-size', '10px')
      .attr('opacity', 0.7)
      .text('Scroll to zoom • Drag to pan');

  }, [eventDropsData, dimensions, onEventClick, getComputedColor, isTooltipHovered]);

  // Reset zoom handler
  const handleResetZoom = useCallback(() => {
    const svg = d3.select(svgRef.current);
    svg.transition().duration(300).call(
      d3.zoom<SVGSVGElement, unknown>().transform as any,
      d3.zoomIdentity
    );
    // Reset visible time range to full day
    if (eventDropsData) {
      setVisibleTimeRange(eventDropsData.timeRange);
    }
  }, [eventDropsData]);

  // Filter events by visible time range for the list view
  const visibleEvents = useMemo(() => {
    if (!eventDropsData) return [];

    // Use visible time range or fall back to full day
    const range = visibleTimeRange || eventDropsData.timeRange;

    // Flatten all events and filter by time range
    const allEvents = eventDropsData.rows.flatMap(row => row.data);
    const filtered = allEvents.filter(event => {
      const time = event.timestamp.getTime();
      return time >= range.start.getTime() && time <= range.end.getTime();
    });

    // Sort by timestamp
    return filtered.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }, [eventDropsData, visibleTimeRange]);

  // Format time for list display
  const formatEventTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Format duration for list display
  const formatDuration = (seconds?: number) => {
    if (!seconds || seconds < 1) return null;
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  // Empty state
  if (!eventDropsData || eventDropsData.rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>No events to display</p>
      </div>
    );
  }

  // Calculate time range display
  const timeRangeDisplay = useMemo(() => {
    const range = visibleTimeRange || eventDropsData?.timeRange;
    if (!range) return '';
    const start = range.start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const end = range.end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${start} - ${end}`;
  }, [visibleTimeRange, eventDropsData]);

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Top half: Timeline visualization */}
      <div className="relative flex-1 min-h-[200px]">
        {/* Zoom controls */}
        <div className="absolute top-2 right-2 z-10 flex gap-1">
          <button
            onClick={handleResetZoom}
            className="px-2 py-1 text-xs bg-muted hover:bg-muted/80 rounded text-muted-foreground"
          >
            Reset Zoom
          </button>
          {currentZoom.k > 1 && (
            <span className="px-2 py-1 text-xs bg-muted rounded text-muted-foreground">
              {Math.round(currentZoom.k * 100)}%
            </span>
          )}
        </div>

        <div ref={containerRef} className="h-full overflow-hidden">
          <svg
            ref={svgRef}
            width={dimensions.width}
            height={dimensions.height}
            className="select-none"
            style={{ cursor: 'grab' }}
          />
        </div>
      </div>

      {/* Resize handle */}
      <div
        ref={resizeHandleRef}
        className="h-2 bg-border hover:bg-primary/50 cursor-ns-resize flex items-center justify-center group"
        onMouseDown={(e) => {
          resizeStartRef.current = { startY: e.clientY, startHeight: listHeight };
          setIsResizing(true);
        }}
      >
        <div className="w-12 h-1 bg-muted-foreground/30 group-hover:bg-primary/50 rounded-full" />
      </div>

      {/* Bottom half: Event list */}
      <div className="bg-background/50" style={{ height: listHeight }}>
        {/* List header */}
        <div className="px-4 py-2 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">Events</span>
            <span className="text-xs text-muted-foreground">
              ({visibleEvents.length} in view)
            </span>
          </div>
          <span className="text-xs text-muted-foreground">{timeRangeDisplay}</span>
        </div>

        {/* Event list */}
        <div className="overflow-y-auto" style={{ height: listHeight - 40 }}>
          {visibleEvents.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              No events in visible range
            </div>
          ) : (
            <div className="divide-y divide-border">
              {visibleEvents.slice(0, 100).map((event) => {
                const Icon = EVENT_TYPE_ICONS[event.type];
                const duration = formatDuration(event.duration);
                const canEdit = event.type === 'activity';
                const canDelete = event.type !== 'screenshot';
                return (
                  <div
                    key={event.id}
                    className="px-4 py-2 hover:bg-muted/50 flex items-center gap-3 group"
                  >
                    {/* Icon */}
                    <div
                      className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: event.color }}
                    >
                      <Icon className="h-3.5 w-3.5 text-white" />
                    </div>

                    {/* Time */}
                    <span className="text-xs text-muted-foreground w-16 flex-shrink-0">
                      {formatEventTime(event.timestamp)}
                    </span>

                    {/* Row/Category */}
                    <span className="text-xs text-muted-foreground w-20 truncate flex-shrink-0">
                      {event.row}
                    </span>

                    {/* Label */}
                    <span className="text-sm text-foreground truncate flex-1">
                      {event.label}
                    </span>

                    {/* Duration */}
                    {duration && (
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {duration}
                      </span>
                    )}

                    {/* Action buttons - show on hover */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      {canEdit && onEventEdit && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventEdit(event);
                          }}
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canDelete && onEventDelete && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventDelete(event);
                          }}
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {visibleEvents.length > 100 && (
                <div className="px-4 py-2 text-xs text-muted-foreground text-center">
                  Showing first 100 of {visibleEvents.length} events
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <EventDropsTooltip
        event={hoveredEvent}
        position={tooltipPosition}
        onDelete={onEventDelete}
        onEdit={onEventEdit}
        onViewScreenshot={onViewScreenshot}
        onMouseEnter={() => {
          if (hideTooltipTimeoutRef.current) {
            clearTimeout(hideTooltipTimeoutRef.current);
            hideTooltipTimeoutRef.current = null;
          }
          setIsTooltipHovered(true);
        }}
        onMouseLeave={() => {
          setIsTooltipHovered(false);
          setHoveredEvent(null);
          setTooltipPosition(null);
        }}
      />
    </div>
  );
}
