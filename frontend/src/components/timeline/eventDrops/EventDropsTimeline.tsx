import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import { GitCommit, Terminal, Globe, FileText, Coffee, Monitor, Camera, Pencil, Trash2, FolderKanban, ChevronDown, ChevronRight, Eye } from 'lucide-react';
import type { TimelineGridData } from '@/types/timeline';
import type { Screenshot as ScreenshotType } from '@/types/screenshot';
import type { TimelineFilters } from '../FilterControls';
import { useEventDropsData } from './useEventDropsData';
import { useMultiDayEventDropsData } from './useMultiDayEventDropsData';
import { EventDropsTooltip } from './EventDropsTooltip';
import type { EventDot, EventDropType } from './eventDropsTypes';
import type { DayData } from '@/hooks/useMultiDayTimeline';
import type { EventKey } from '@/utils/eventKeys';
import { Screenshot } from '@/components/common/Screenshot';
import { ImageGallery } from '@/components/common/ImageGallery';
import { api } from '@/api/client';

// Entry block data from ProjectsColumn
interface EntryBlockData {
  id: number;
  eventType: string;
  projectId: number;
  projectName: string;
  projectColor: string;
  appName: string;
  windowTitle: string;
  startTime: number;
  endTime: number;
  durationSeconds: number;
  confidence: number;
  source: string;
}

interface EventDropsTimelineProps {
  // New multi-day props
  loadedDays?: Map<string, DayData>;
  multiDayTimeRange?: { start: Date; end: Date };
  onPlayheadChange?: (timestamp: Date) => void;
  loadingDays?: Set<string>; // Dates that are currently loading (for loading indicators)

  // Single-day props (used when multi-day not provided)
  data?: TimelineGridData | null | undefined;
  filters: TimelineFilters;
  screenshots?: ScreenshotType[];
  entries?: EntryBlockData[];
  rowHeight?: number;
  hideEmbeddedList?: boolean; // Hide bottom list when used with side panel
  // Selection props
  selectedEventKeys?: Set<EventKey>;
  onSelectionChange?: (keys: Set<EventKey>) => void;
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
const BAR_MIN_DURATION = 10; // Minimum duration (seconds) to render as bar
const BAR_MIN_PIXELS = 6; // Minimum pixel width to render as bar

// Icon map for event list
const EVENT_TYPE_ICONS: Record<EventDropType, typeof GitCommit> = {
  activity: Monitor,
  git: GitCommit,
  shell: Terminal,
  browser: Globe,
  file: FileText,
  afk: Coffee,
  screenshot: Camera,
  projects: FolderKanban,
};

export function EventDropsTimeline({
  // Multi-day props
  loadedDays,
  multiDayTimeRange,
  onPlayheadChange,
  loadingDays,
  // Single-day props
  data,
  filters,
  screenshots,
  entries,
  rowHeight = ROW_HEIGHT,
  hideEmbeddedList = false,
  selectedEventKeys,
  onSelectionChange,
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
  const isTooltipHoveredRef = useRef(false);
  const hideTooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [currentZoom, setCurrentZoom] = useState<d3.ZoomTransform>(d3.zoomIdentity);
  const [visibleTimeRange, setVisibleTimeRange] = useState<{ start: Date; end: Date } | null>(null);
  const [playheadTimestamp, setPlayheadTimestamp] = useState<Date | null>(null);
  // Track previous time range to detect domain changes and preserve visible area
  const previousTimeRangeRef = useRef<{ start: number; end: number } | null>(null);

  // === ZOOM DECOUPLING: Use refs during active zoom, sync to state on zoom end ===
  // These refs hold "live" values during zoom/pan - updated synchronously without React re-renders
  const zoomTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const visibleTimeRangeRef = useRef<{ start: Date; end: Date } | null>(null);
  const playheadTimestampRef = useRef<Date | null>(null);
  const zoomSyncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dragSafetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isZoomingRef = useRef(false);

  // === SCALE REF: Store xScale for use in other effects ===
  const xScaleRef = useRef<d3.ScaleTime<number, number> | null>(null);

  // === CALLBACK REFS: Store callbacks in refs to avoid dependency array issues ===
  const onPlayheadChangeRef = useRef(onPlayheadChange);
  const onEventClickRef = useRef(onEventClick);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const selectedEventKeysRef = useRef(selectedEventKeys);

  // Gallery state for fullscreen screenshot viewer
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
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
  const [filmstripHeight, setFilmstripHeight] = useState(() => {
    try {
      const stored = localStorage.getItem('eventdrops-filmstrip-height');
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed) && parsed >= 48 && parsed <= 200) return parsed;
      }
    } catch (e) {
      // Ignore localStorage errors
    }
    return 64; // Default height for filmstrip
  });
  const [isResizing, setIsResizing] = useState(false);
  const [resizingTarget, setResizingTarget] = useState<'list' | 'filmstrip' | null>(null);
  const resizeStartRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const [collapseActivityRows, setCollapseActivityRows] = useState(() => {
    try {
      const stored = localStorage.getItem('eventdrops-collapse-activity');
      return stored === 'true';
    } catch {
      return true; // Default to collapsed
    }
  });
  const [filmstripCollapsed, setFilmstripCollapsed] = useState(() => {
    try {
      const stored = localStorage.getItem('eventdrops-filmstrip-collapsed');
      return stored === 'true';
    } catch {
      return false;
    }
  });
  const [listCollapsed, setListCollapsed] = useState(() => {
    try {
      const stored = localStorage.getItem('eventdrops-list-collapsed');
      return stored === 'true';
    } catch {
      return false;
    }
  });

  // Persist list height to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('eventdrops-list-height', listHeight.toString());
    } catch (e) {
      // Ignore localStorage errors
    }
  }, [listHeight]);

  // Persist filmstrip height to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('eventdrops-filmstrip-height', filmstripHeight.toString());
    } catch (e) {
      // Ignore localStorage errors
    }
  }, [filmstripHeight]);

  // Persist filmstrip collapsed state
  useEffect(() => {
    try {
      localStorage.setItem('eventdrops-filmstrip-collapsed', filmstripCollapsed.toString());
    } catch (e) {
      // Ignore localStorage errors
    }
  }, [filmstripCollapsed]);

  // Persist list collapsed state
  useEffect(() => {
    try {
      localStorage.setItem('eventdrops-list-collapsed', listCollapsed.toString());
    } catch (e) {
      // Ignore localStorage errors
    }
  }, [listCollapsed]);

  // Persist collapse state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('eventdrops-collapse-activity', collapseActivityRows.toString());
    } catch {
      // Ignore localStorage errors
    }
  }, [collapseActivityRows]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (zoomSyncTimeoutRef.current) {
        clearTimeout(zoomSyncTimeoutRef.current);
      }
      if (dragSafetyTimeoutRef.current) {
        clearTimeout(dragSafetyTimeoutRef.current);
      }
    };
  }, []);

  // === KEEP CALLBACK REFS IN SYNC: Update refs when props change (no re-render) ===
  useEffect(() => {
    onPlayheadChangeRef.current = onPlayheadChange;
  }, [onPlayheadChange]);

  useEffect(() => {
    onEventClickRef.current = onEventClick;
  }, [onEventClick]);

  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
  }, [onSelectionChange]);

  useEffect(() => {
    selectedEventKeysRef.current = selectedEventKeys;
  }, [selectedEventKeys]);

  // Transform data to EventDrops format
  // Always call both hooks to satisfy React rules of hooks, then choose which data to use
  const singleDayData = useEventDropsData({ data, filters, screenshots, entries, collapseActivityRows });
  const multiDayData = useMultiDayEventDropsData({
    loadedDays: loadedDays ?? new Map(),
    timeRange: multiDayTimeRange ?? { start: new Date(), end: new Date() },
    filters,
    collapseActivityRows,
  });

  // Use multi-day data if provided, fall back to single-day
  const eventDropsData = loadedDays && multiDayTimeRange ? multiDayData : singleDayData;

  // Handle resize drag for both filmstrip and list panels
  useEffect(() => {
    let rafId: number | null = null;
    let pendingHeight: number | null = null;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !resizeStartRef.current || !resizingTarget) return;

      if (resizingTarget === 'filmstrip') {
        // Filmstrip: dragging DOWN = positive delta = bigger height
        const deltaY = e.clientY - resizeStartRef.current.startY;
        const newHeight = Math.max(48, Math.min(200, resizeStartRef.current.startHeight + deltaY));
        pendingHeight = newHeight;
        if (rafId === null) {
          rafId = requestAnimationFrame(() => {
            if (pendingHeight !== null) {
              setFilmstripHeight(pendingHeight);
            }
            rafId = null;
          });
        }
      } else {
        // List: dragging UP = positive delta = bigger height
        const deltaY = resizeStartRef.current.startY - e.clientY;
        const newHeight = Math.max(100, Math.min(500, resizeStartRef.current.startHeight + deltaY));
        pendingHeight = newHeight;
        if (rafId === null) {
          rafId = requestAnimationFrame(() => {
            if (pendingHeight !== null) {
              setListHeight(pendingHeight);
            }
            rafId = null;
          });
        }
      }
    };

    const handleMouseUp = () => {
      // Apply final height immediately
      if (pendingHeight !== null) {
        if (resizingTarget === 'filmstrip') {
          setFilmstripHeight(pendingHeight);
        } else {
          setListHeight(pendingHeight);
        }
      }
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      resizeStartRef.current = null;
      setIsResizing(false);
      setResizingTarget(null);
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
  }, [isResizing, resizingTarget]);

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

    // Clear and rebuild - this is fine now that day navigation buttons are removed
    // Rebuilds only happen when data actually changes (loading more data as user pans)
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

    // Store scale in ref for use in other effects
    xScaleRef.current = xScale;

    // Use fixed row height instead of scaleBand
    const yScale = (rowName: string): number => {
      const index = rows.findIndex((r) => r.name === rowName);
      return MARGIN.top + index * rowHeight;
    };
    yScale.bandwidth = () => rowHeight;

    // Calculate the center X position for the playhead
    const chartCenterX = MARGIN.left + (width - MARGIN.left - MARGIN.right) / 2;

    // Create zoom behavior
    // Extended zoom range: 0.5x = 48 hours visible, 48x = ~30 min visible
    const currentTime = new Date();

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 48])
      .extent([[MARGIN.left, 0], [width - MARGIN.right, height]])
      // Constrain panning so playhead can't go past "now"
      .constrain((transform, extent, translateExtent) => {
        // Calculate what the center timestamp would be with this transform
        const testScale = transform.rescaleX(xScale);
        const centerTimestamp = testScale.invert(chartCenterX);

        // If center would be in the future, clamp it
        if (centerTimestamp > currentTime) {
          const nowX = testScale(currentTime);
          const shiftNeeded = chartCenterX - nowX;
          return d3.zoomIdentity
            .translate(transform.x + shiftNeeded, transform.y)
            .scale(transform.k);
        }
        return transform;
      })
      // Center zoom on the playhead (center of chart) instead of mouse position
      .wheelDelta((event) => {
        // Standard wheel delta calculation
        return -event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002);
      })
      .on('start', () => {
        // Mark that we're actively zooming - prevents unnecessary React re-renders
        isZoomingRef.current = true;
        // Safety: set a timeout to auto-release stuck drag after 5 seconds of no 'end' event
        if (dragSafetyTimeoutRef.current) {
          clearTimeout(dragSafetyTimeoutRef.current);
        }
        dragSafetyTimeoutRef.current = setTimeout(() => {
          if (isZoomingRef.current) {
            console.warn('Drag safety: auto-releasing stuck drag state');
            isZoomingRef.current = false;
            // Force sync state
            setCurrentZoom(zoomTransformRef.current);
            setVisibleTimeRange(visibleTimeRangeRef.current);
            setPlayheadTimestamp(playheadTimestampRef.current);
            if (playheadTimestampRef.current) {
              onPlayheadChangeRef.current?.(playheadTimestampRef.current);
            }
          }
        }, 5000);
      })
      .on('zoom', (event) => {
        const transform = event.transform;

        // Create new scale based on zoom (already constrained by .constrain())
        const newXScale = transform.rescaleX(xScale);

        // Calculate center timestamp (playhead position)
        const centerTimestamp = newXScale.invert(chartCenterX);

        // === PERFORMANCE: Update refs immediately (no React re-render) ===
        zoomTransformRef.current = transform;

        // Calculate visible time range and playhead - store in refs
        const visibleStart = newXScale.invert(MARGIN.left);
        const visibleEnd = newXScale.invert(width - MARGIN.right);
        visibleTimeRangeRef.current = { start: visibleStart, end: visibleEnd };

        playheadTimestampRef.current = centerTimestamp;

        // === DEBOUNCED STATE SYNC: Only update React state after zoom settles ===
        // This prevents React re-renders during active panning/zooming
        if (zoomSyncTimeoutRef.current) {
          clearTimeout(zoomSyncTimeoutRef.current);
        }
        zoomSyncTimeoutRef.current = setTimeout(() => {
          // Sync refs to React state (triggers re-render for UI elements that need it)
          setCurrentZoom(zoomTransformRef.current);
          setVisibleTimeRange(visibleTimeRangeRef.current);
          setPlayheadTimestamp(playheadTimestampRef.current);
          if (playheadTimestampRef.current) {
            onPlayheadChangeRef.current?.(playheadTimestampRef.current);
          }
        }, 150); // 150ms debounce - syncs state after zoom gesture settles

        // Update x-axis with multi-scale formatting
        const xAxisGroup = svg.select<SVGGElement>('.x-axis');
        // Dynamically adjust tick interval based on zoom level
        const tickInterval = transform.k > 8 ? d3.timeMinute.every(15)
          : transform.k > 4 ? d3.timeMinute.every(30)
          : transform.k > 2 ? d3.timeHour.every(1)
          : d3.timeHour.every(2);
        xAxisGroup.call(
          d3.axisTop(newXScale)
            .ticks(tickInterval)
            .tickFormat((d) => multiScaleFormat(d as Date)) as any
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

        // Update day boundary positions
        svg.select('.day-boundaries')
          .selectAll<SVGGElement, Date>('.day-boundary')
          .each(function(d) {
            const g = d3.select(this);
            const x = newXScale(d);
            g.select('line')
              .attr('x1', x)
              .attr('x2', x);
            g.select('rect')
              .attr('x', x - 45);
            g.select('text')
              .attr('x', x);
          });

        // Update loading indicator positions
        svg.select('.loading-indicators')
          .selectAll<SVGRectElement, unknown>('.loading-shimmer-bg')
          .each(function() {
            const rect = d3.select(this);
            const dayStart = new Date(parseFloat(rect.attr('data-day-start') || '0'));
            if (!isNaN(dayStart.getTime())) {
              const dayEnd = new Date(dayStart);
              dayEnd.setDate(dayEnd.getDate() + 1);
              const startX = newXScale(dayStart);
              const endX = newXScale(dayEnd);
              rect.attr('x', startX).attr('width', Math.abs(endX - startX));
            }
          });

        svg.select('.loading-indicators')
          .selectAll<SVGLineElement, unknown>('.loading-pulse-line')
          .each(function() {
            const line = d3.select(this);
            const dayStart = new Date(parseFloat(line.attr('data-day-start') || '0'));
            if (!isNaN(dayStart.getTime())) {
              const x = newXScale(dayStart);
              line.attr('x1', x).attr('x2', x);
            }
          });

        // Update dots
        svg.selectAll<SVGCircleElement, EventDot>('.event-dot')
          .attr('cx', (d) => newXScale(d.timestamp));

        // Update bars
        svg.selectAll<SVGRectElement, EventDot>('.event-bar')
          .attr('x', (d) => newXScale(d.timestamp))
          .attr('width', (d) => {
            const startTime = d.timestamp.getTime();
            const endTime = startTime + ((d.duration || 0) * 1000);
            return Math.max(BAR_MIN_PIXELS, newXScale(new Date(endTime)) - newXScale(d.timestamp));
          });

        // Update now line if exists
        svg.select('.now-line')
          .attr('x1', (d: any) => newXScale(d))
          .attr('x2', (d: any) => newXScale(d));

        svg.select('.now-text')
          .attr('x', (d: any) => newXScale(d));

        // Update bottom date labels
        const formatDateLabel = (date: Date): string => {
          return date.toLocaleDateString('en-US', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          });
        };

        const formatCenterLabel = (date: Date): string => {
          const dayPart = date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          });
          const timePart = date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          });
          return `${dayPart} • ${timePart}`;
        };

        svg.select('.date-label-left')
          .text(formatDateLabel(visibleStart));

        svg.select('.date-label-right')
          .text(formatDateLabel(visibleEnd));

        svg.select('.date-label-center')
          .text(formatCenterLabel(centerTimestamp));
      })
      .on('end', () => {
        // Zoom gesture ended - mark as not zooming and force final state sync
        isZoomingRef.current = false;

        // Clear any pending debounce and sync immediately
        if (zoomSyncTimeoutRef.current) {
          clearTimeout(zoomSyncTimeoutRef.current);
          zoomSyncTimeoutRef.current = null;
        }
        // Clear drag safety timeout since we properly ended
        if (dragSafetyTimeoutRef.current) {
          clearTimeout(dragSafetyTimeoutRef.current);
          dragSafetyTimeoutRef.current = null;
        }

        // Final sync to React state
        setCurrentZoom(zoomTransformRef.current);
        setVisibleTimeRange(visibleTimeRangeRef.current);
        setPlayheadTimestamp(playheadTimestampRef.current);
        if (playheadTimestampRef.current) {
          onPlayheadChangeRef.current?.(playheadTimestampRef.current);
        }
      });

    // Apply zoom to SVG
    svg.call(zoom);

    // Override wheel behavior to zoom centered on playhead instead of mouse position
    svg.on('wheel.zoom', function(event: WheelEvent) {
      event.preventDefault();
      const direction = event.deltaY > 0 ? 0.9 : 1.1; // Zoom out or in
      const svgNode = svg.node();
      if (svgNode) {
        svg.transition().duration(50).call(
          zoom.scaleBy as any,
          direction,
          [chartCenterX, height / 2] // Zoom centered on playhead
        );
      }
    });

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

    // Multi-scale time formatting (marmelab EventDrops style)
    const formatMillisecond = d3.timeFormat('.%L');
    const formatSecond = d3.timeFormat(':%S');
    const formatMinute = d3.timeFormat('%-I:%M %p');
    const formatHour = d3.timeFormat('%-I %p');
    const formatDay = d3.timeFormat('%a %d');
    const formatWeek = d3.timeFormat('%b %d');
    const formatMonth = d3.timeFormat('%B');
    const formatYear = d3.timeFormat('%Y');

    const multiScaleFormat = (date: Date): string => {
      return (d3.timeSecond(date) < date ? formatMillisecond
        : d3.timeMinute(date) < date ? formatSecond
        : d3.timeHour(date) < date ? formatMinute
        : d3.timeDay(date) < date ? formatHour
        : d3.timeMonth(date) < date ? (d3.timeWeek(date) < date ? formatDay : formatWeek)
        : d3.timeYear(date) < date ? formatMonth
        : formatYear)(date);
    };

    // Create X-axis (time)
    chartGroup.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${MARGIN.top})`)
      .call(
        d3.axisTop(xScale)
          .ticks(d3.timeHour.every(2))
          .tickFormat((d) => multiScaleFormat(d as Date)) as any
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

    // Add day boundary markers at midnight
    const dayBoundaries = d3.timeDay.range(timeRange.start, timeRange.end);
    chartGroup.append('g')
      .attr('class', 'day-boundaries')
      .selectAll('g')
      .data(dayBoundaries.slice(1)) // Skip first day's start
      .join('g')
      .attr('class', 'day-boundary')
      .each(function(d) {
        const g = d3.select(this);
        const x = xScale(d);

        // Vertical line at midnight
        g.append('line')
          .attr('x1', x)
          .attr('x2', x)
          .attr('y1', MARGIN.top - 20)
          .attr('y2', height - MARGIN.bottom)
          .attr('stroke', '#3b82f6')
          .attr('stroke-width', 2)
          .attr('stroke-dasharray', '4,4')
          .attr('opacity', 0.6);

        // Date label above
        const dateLabel = d.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        });

        g.append('rect')
          .attr('x', x - 45)
          .attr('y', MARGIN.top - 35)
          .attr('width', 90)
          .attr('height', 18)
          .attr('rx', 4)
          .attr('fill', '#3b82f6')
          .attr('opacity', 0.9);

        g.append('text')
          .attr('x', x)
          .attr('y', MARGIN.top - 23)
          .attr('text-anchor', 'middle')
          .attr('fill', '#ffffff')
          .attr('font-size', '11px')
          .attr('font-weight', '600')
          .text(dateLabel);
      });

    // Add loading indicators at edges where data is still loading
    // Helper to convert Date to YYYY-MM-DD string
    const getDateStr = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    if (loadingDays && loadingDays.size > 0) {
      // Add gradient definition for shimmer effect
      const defs = svg.select('defs');

      // Create animated gradient for shimmer
      const loadingGradient = defs.append('linearGradient')
        .attr('id', 'loading-shimmer')
        .attr('x1', '0%')
        .attr('y1', '0%')
        .attr('x2', '100%')
        .attr('y2', '0%');

      loadingGradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', '#3b82f6')
        .attr('stop-opacity', 0.1);

      loadingGradient.append('stop')
        .attr('offset', '50%')
        .attr('stop-color', '#3b82f6')
        .attr('stop-opacity', 0.4);

      loadingGradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', '#3b82f6')
        .attr('stop-opacity', 0.1);

      // Animate the gradient
      loadingGradient.append('animate')
        .attr('attributeName', 'x1')
        .attr('values', '-100%;100%')
        .attr('dur', '1.5s')
        .attr('repeatCount', 'indefinite');

      loadingGradient.append('animate')
        .attr('attributeName', 'x2')
        .attr('values', '0%;200%')
        .attr('dur', '1.5s')
        .attr('repeatCount', 'indefinite');

      const loadingGroup = chartGroup.append('g')
        .attr('class', 'loading-indicators')
        .attr('clip-path', 'url(#chart-clip)');

      // Check each day boundary for loading state
      const allDays = d3.timeDay.range(timeRange.start, new Date(timeRange.end.getTime() + 86400000)); // Include end day

      allDays.forEach((dayStart) => {
        const dayStr = getDateStr(dayStart);
        const isLoading = loadingDays.has(dayStr);

        if (isLoading) {
          const dayEnd = new Date(dayStart);
          dayEnd.setDate(dayEnd.getDate() + 1);

          const startX = xScale(dayStart);
          const endX = xScale(dayEnd);
          const loadingWidth = Math.abs(endX - startX);

          // Shimmer overlay for the entire day
          loadingGroup.append('rect')
            .attr('class', 'loading-shimmer-bg')
            .attr('data-day-start', dayStart.getTime().toString())
            .attr('x', startX)
            .attr('y', MARGIN.top)
            .attr('width', loadingWidth)
            .attr('height', height - MARGIN.top - MARGIN.bottom)
            .attr('fill', 'url(#loading-shimmer)')
            .attr('pointer-events', 'none');

          // Pulsing border at day start
          loadingGroup.append('line')
            .attr('class', 'loading-pulse-line')
            .attr('data-day-start', dayStart.getTime().toString())
            .attr('x1', startX)
            .attr('x2', startX)
            .attr('y1', MARGIN.top)
            .attr('y2', height - MARGIN.bottom)
            .attr('stroke', '#3b82f6')
            .attr('stroke-width', 3)
            .attr('opacity', 0.6);
        }
      });
    }

    // Create clipped group for dots
    const dotsGroup = chartGroup.append('g')
      .attr('class', 'dots-group')
      .attr('clip-path', 'url(#chart-clip)');

    // Flatten all events for rendering
    const allEvents = rows.flatMap((row) => row.data);

    // Helper to determine if event should render as bar vs dot
    const shouldRenderAsBar = (
      event: EventDot,
      scale: d3.ScaleTime<number, number>
    ): boolean => {
      if (!event.duration || event.duration < BAR_MIN_DURATION) return false;

      const startTime = event.timestamp.getTime();
      const endTime = startTime + (event.duration * 1000);
      const pixelWidth = scale(new Date(endTime)) - scale(event.timestamp);

      return pixelWidth >= BAR_MIN_PIXELS;
    };

    // Split events into dots and bars based on duration
    const dotEvents = allEvents.filter((e) => !shouldRenderAsBar(e, xScale));
    const barEvents = allEvents.filter((e) => shouldRenderAsBar(e, xScale));

    // Helper to check if event is selected (uses ref to avoid stale closure)
    const isSelected = (d: EventDot) => selectedEventKeysRef.current?.has(d.id) || false;

    // Helper to get darker stroke color
    const getDarkerColor = (color: string) => {
      // Simple darkening by reducing brightness
      const c = d3.color(color);
      if (c) {
        return c.darker(0.5).toString();
      }
      return color;
    };

    // Create dots for brief/instant events
    dotsGroup.selectAll('.event-dot')
      .data(dotEvents, (d) => (d as EventDot).id)
      .join('circle')
      .attr('class', 'event-dot')
      .attr('cx', (d) => xScale(d.timestamp))
      .attr('cy', (d) => (yScale(d.row) || 0) + yScale.bandwidth() / 2)
      .attr('r', DOT_RADIUS)
      .attr('fill', (d) => d.color)
      .attr('stroke', (d) => isSelected(d) ? '#fff' : getDarkerColor(d.color))
      .attr('stroke-width', (d) => isSelected(d) ? 2.5 : 1.5)
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
          if (!isTooltipHoveredRef.current) {
            setHoveredEvent(null);
            setTooltipPosition(null);
          }
        }, 150);
      })
      .on('click', function (event, d) {
        event.stopPropagation();
        // Toggle selection (use refs to avoid stale closures)
        if (onSelectionChangeRef.current) {
          const newSelection = new Set(selectedEventKeysRef.current || []);
          if (newSelection.has(d.id)) {
            newSelection.delete(d.id);
          } else {
            // If not holding shift/ctrl, clear and select just this one
            if (!event.shiftKey && !event.ctrlKey && !event.metaKey) {
              newSelection.clear();
            }
            newSelection.add(d.id);
          }
          onSelectionChangeRef.current(newSelection);
        }
        onEventClickRef.current?.(d);
      });

    // Create bars (pills) for duration events - same height as dots for consistency
    dotsGroup.selectAll('.event-bar')
      .data(barEvents, (d) => (d as EventDot).id)
      .join('rect')
      .attr('class', 'event-bar')
      .attr('x', (d) => xScale(d.timestamp))
      .attr('y', (d) => (yScale(d.row) || 0) + yScale.bandwidth() / 2 - DOT_RADIUS)
      .attr('width', (d) => {
        const startTime = d.timestamp.getTime();
        const endTime = startTime + ((d.duration || 0) * 1000);
        return Math.max(BAR_MIN_PIXELS, xScale(new Date(endTime)) - xScale(d.timestamp));
      })
      .attr('height', DOT_RADIUS * 2)
      .attr('rx', DOT_RADIUS)
      .attr('ry', DOT_RADIUS)
      .attr('fill', (d) => d.color)
      .attr('fill-opacity', 0.7)
      .attr('stroke', (d) => isSelected(d) ? '#fff' : getDarkerColor(d.color))
      .attr('stroke-width', (d) => isSelected(d) ? 2.5 : 1.5)
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
          .attr('fill-opacity', 0.9);

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
          .attr('fill-opacity', 0.7);

        // Delay hiding to allow mouse to move to tooltip
        hideTooltipTimeoutRef.current = setTimeout(() => {
          if (!isTooltipHoveredRef.current) {
            setHoveredEvent(null);
            setTooltipPosition(null);
          }
        }, 150);
      })
      .on('click', function (event, d) {
        event.stopPropagation();
        // Toggle selection (use refs to avoid stale closures)
        if (onSelectionChangeRef.current) {
          const newSelection = new Set(selectedEventKeysRef.current || []);
          if (newSelection.has(d.id)) {
            newSelection.delete(d.id);
          } else {
            // If not holding shift/ctrl, clear and select just this one
            if (!event.shiftKey && !event.ctrlKey && !event.metaKey) {
              newSelection.clear();
            }
            newSelection.add(d.id);
          }
          onSelectionChangeRef.current(newSelection);
        }
        onEventClickRef.current?.(d);
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

    // Add "now" indicator if "now" is within the time range (works for multi-day views)
    const now = new Date();
    if (now >= timeRange.start && now <= timeRange.end) {
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

    // Add fixed playhead line (stays at center regardless of zoom/pan)
    const playheadGroup = svg.append('g').attr('class', 'playhead-group');

    // Playhead line
    playheadGroup.append('line')
      .attr('class', 'playhead-line')
      .attr('x1', chartCenterX)
      .attr('x2', chartCenterX)
      .attr('y1', MARGIN.top)
      .attr('y2', height - MARGIN.bottom)
      .attr('stroke', '#3b82f6') // Blue color
      .attr('stroke-width', 2)
      .attr('pointer-events', 'none');

    // Playhead triangle marker at top
    playheadGroup.append('polygon')
      .attr('class', 'playhead-marker')
      .attr('points', `${chartCenterX - 6},${MARGIN.top - 2} ${chartCenterX + 6},${MARGIN.top - 2} ${chartCenterX},${MARGIN.top + 6}`)
      .attr('fill', '#3b82f6')
      .attr('pointer-events', 'none');

    // Store current time range for comparison
    previousTimeRangeRef.current = {
      start: timeRange.start.getTime(),
      end: timeRange.end.getTime(),
    };

    // Initialize playhead to center of visible time range
    const initialCenterTime = xScale.invert(chartCenterX);
    setPlayheadTimestamp(initialCenterTime);
    onPlayheadChangeRef.current?.(initialCenterTime);

    // Initialize visible time range to full range so filmstrip shows immediately
    setVisibleTimeRange({ start: timeRange.start, end: timeRange.end });

    // Bottom date labels (marmelab style) - fixed position labels
    const dateLabelsGroup = svg.append('g').attr('class', 'date-labels-group');

    // Format for date labels: "22 January 2026"
    const formatDateLabel = (date: Date): string => {
      return date.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    };

    // Format for center label: "Thu, Jan 22 • 11:59 AM"
    const formatCenterLabel = (date: Date): string => {
      const dayPart = date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      const timePart = date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      return `${dayPart} • ${timePart}`;
    };

    // Left date label (range start)
    dateLabelsGroup.append('text')
      .attr('class', 'date-label-left')
      .attr('x', MARGIN.left + 10)
      .attr('y', height - 8)
      .attr('text-anchor', 'start')
      .attr('fill', mutedForeground)
      .attr('font-size', '12px')
      .attr('font-weight', '500')
      .text(formatDateLabel(timeRange.start));

    // Right date label (range end)
    dateLabelsGroup.append('text')
      .attr('class', 'date-label-right')
      .attr('x', width - MARGIN.right - 10)
      .attr('y', height - 8)
      .attr('text-anchor', 'end')
      .attr('fill', mutedForeground)
      .attr('font-size', '12px')
      .attr('font-weight', '500')
      .text(formatDateLabel(timeRange.end));

    // Center date/time label (playhead position)
    dateLabelsGroup.append('text')
      .attr('class', 'date-label-center')
      .attr('x', chartCenterX)
      .attr('y', height - 8)
      .attr('text-anchor', 'middle')
      .attr('fill', '#3b82f6') // Blue to match playhead
      .attr('font-size', '12px')
      .attr('font-weight', '600')
      .text(formatCenterLabel(initialCenterTime));

    // Zoom instructions (smaller, positioned differently)
    svg.append('text')
      .attr('x', width - 10)
      .attr('y', 12)
      .attr('text-anchor', 'end')
      .attr('fill', mutedForeground)
      .attr('font-size', '9px')
      .attr('opacity', 0.5)
      .text('Scroll to zoom • Drag to pan');

  // NOTE: Callbacks (onEventClick, onSelectionChange, onPlayheadChange) are stored in refs
  // to prevent this effect from re-running when parent re-renders with new callback refs.
  // selectedEventKeys is also stored in a ref for the same reason.
  }, [eventDropsData, dimensions, getComputedColor, loadingDays]);

  // Reset zoom handler (uses ref for callback to avoid dependency)
  const handleResetZoom = useCallback(() => {
    const svg = d3.select(svgRef.current);
    svg.transition().duration(300).call(
      d3.zoom<SVGSVGElement, unknown>().transform as any,
      d3.zoomIdentity
    );
    // Reset visible time range and playhead to full day center
    if (eventDropsData) {
      setVisibleTimeRange(eventDropsData.timeRange);
      const centerTime = new Date((eventDropsData.timeRange.start.getTime() + eventDropsData.timeRange.end.getTime()) / 2);
      setPlayheadTimestamp(centerTime);
      onPlayheadChangeRef.current?.(centerTime);
    }
  }, [eventDropsData]);

  // Filter events by visible time range for the list view, sorted from playhead forward
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

    // Sort events so that the one at/after playhead comes first, then chronological from there
    const playheadTime = playheadTimestamp?.getTime() || range.start.getTime();

    // Split into events before and after playhead
    const beforePlayhead = filtered
      .filter(e => e.timestamp.getTime() < playheadTime)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()); // Reverse chronological

    const afterPlayhead = filtered
      .filter(e => e.timestamp.getTime() >= playheadTime)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()); // Chronological

    // Show events from playhead forward first, then earlier events
    return [...afterPlayhead, ...beforePlayhead];
  }, [eventDropsData, visibleTimeRange, playheadTimestamp]);

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

  // Get screenshots in visible range for filmstrip, sorted by timestamp
  const filmstripScreenshots = useMemo(() => {
    if (!screenshots || screenshots.length === 0 || !visibleTimeRange) return [];

    const startTime = visibleTimeRange.start.getTime() / 1000;
    const endTime = visibleTimeRange.end.getTime() / 1000;

    return screenshots
      .filter(ss => ss.timestamp >= startTime && ss.timestamp <= endTime)
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [screenshots, visibleTimeRange]);

  // Find index of screenshot closest to playhead in the filmstrip
  const playheadScreenshotIndex = useMemo(() => {
    if (filmstripScreenshots.length === 0 || !playheadTimestamp) return -1;

    const playheadTime = playheadTimestamp.getTime() / 1000;
    let closestIndex = 0;
    let minDiff = Math.abs(filmstripScreenshots[0].timestamp - playheadTime);

    filmstripScreenshots.forEach((ss, index) => {
      const diff = Math.abs(ss.timestamp - playheadTime);
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = index;
      }
    });

    return closestIndex;
  }, [filmstripScreenshots, playheadTimestamp]);

  // Handle filmstrip thumbnail click - open gallery at that index
  const handleFilmstripClick = useCallback((index: number) => {
    setGalleryIndex(index);
    setGalleryOpen(true);
  }, []);

  // Prefetch thumbnails for filmstrip screenshots around playhead for snappy loading
  useEffect(() => {
    if (filmstripScreenshots.length === 0 || playheadScreenshotIndex < 0) return;

    // Prefetch 5 screenshots before and after playhead
    const prefetchRange = 5;
    const startIdx = Math.max(0, playheadScreenshotIndex - prefetchRange);
    const endIdx = Math.min(filmstripScreenshots.length, playheadScreenshotIndex + prefetchRange + 1);

    for (let i = startIdx; i < endIdx; i++) {
      const ss = filmstripScreenshots[i];
      if (ss?.id) {
        // Prefetch thumbnail
        api.screenshots.getThumbnail(ss.id).then((url) => {
          const img = new Image();
          img.src = url;
        }).catch(() => {
          // Silent fail for prefetch
        });
      }
    }
  }, [filmstripScreenshots, playheadScreenshotIndex]);

  // Calculate visible duration for zoom indicator
  const visibleDurationLabel = useMemo(() => {
    const range = visibleTimeRange || eventDropsData?.timeRange;
    if (!range) return null;
    const durationMs = range.end.getTime() - range.start.getTime();
    const durationHours = durationMs / (1000 * 60 * 60);

    if (durationHours >= 24) {
      return `${Math.round(durationHours)}h`;
    } else if (durationHours >= 1) {
      const hours = Math.floor(durationHours);
      const minutes = Math.round((durationHours - hours) * 60);
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    } else {
      return `${Math.round(durationHours * 60)}m`;
    }
  }, [visibleTimeRange, eventDropsData]);

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Filmstrip - horizontal strip of screenshots centered on playhead */}
      {/* Filmstrip - show if ANY screenshots exist (not just visible range) to prevent layout shift */}
      {screenshots && screenshots.length > 0 && (
        <div className="flex-shrink-0 border-b border-border bg-muted/20">
          {/* Filmstrip header - collapsible */}
          <div
            className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-muted/30"
            onClick={() => setFilmstripCollapsed(!filmstripCollapsed)}
          >
            {filmstripCollapsed ? (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            )}
            <Camera className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Screenshots</span>
            <span className="text-xs text-muted-foreground/70">
              ({filmstripScreenshots.length > 0 ? filmstripScreenshots.length : `${screenshots.length} total`})
            </span>
          </div>

          {/* Filmstrip content - centered on playhead screenshot */}
          {!filmstripCollapsed && (
            <>
              {/* Playhead info - positioned to align with chart center */}
              <div className="relative h-10">
                {filmstripScreenshots.length > 0 && playheadScreenshotIndex >= 0 && filmstripScreenshots[playheadScreenshotIndex] && (
                  <div
                    className="absolute flex flex-col items-center"
                    style={{
                      left: MARGIN.left + (dimensions.width - MARGIN.left - MARGIN.right) / 2,
                      transform: 'translateX(-50%)',
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-blue-500 rounded-full" />
                      <span className="text-xs text-blue-400 font-medium">
                        {playheadTimestamp && formatEventTime(playheadTimestamp)}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {(() => {
                        const ss = filmstripScreenshots[playheadScreenshotIndex];
                        const appName = typeof ss.appName === 'object' ? ss.appName?.String : ss.appName;
                        return appName || 'Unknown';
                      })()}
                    </span>
                  </div>
                )}
                {/* Empty state for playhead info area */}
                {filmstripScreenshots.length === 0 && (
                  <div
                    className="absolute flex items-center justify-center"
                    style={{
                      left: MARGIN.left + (dimensions.width - MARGIN.left - MARGIN.right) / 2,
                      transform: 'translateX(-50%)',
                    }}
                  >
                    <span className="text-xs text-muted-foreground/50">
                      No screenshots in view
                    </span>
                  </div>
                )}
              </div>

              {/* Screenshot strip - centered with playhead screenshot in middle */}
              <div
                className="relative overflow-hidden"
                style={{ height: filmstripHeight }}
              >
                {filmstripScreenshots.length > 0 ? (
                  <>
                    {/*
                      Center the strip so the playhead screenshot aligns with the chart's playhead line.
                      The chart center X = MARGIN.left + (chartWidth / 2).
                      We calculate an offset to translate the strip so the playhead screenshot's center
                      lands at that X position.
                    */}
                    {(() => {
                      const thumbnailWidth = filmstripHeight * (16 / 9);
                      const gap = 4; // gap-1 = 4px
                      const itemWidth = thumbnailWidth + gap;
                      const playheadScreenshotCenter = playheadScreenshotIndex * itemWidth + thumbnailWidth / 2;

                      return (
                        <div
                          className="flex items-center gap-1 absolute"
                          style={{
                            height: filmstripHeight,
                            left: MARGIN.left,
                            transform: `translateX(calc((${dimensions.width - MARGIN.left - MARGIN.right}px / 2) - ${playheadScreenshotCenter}px))`,
                          }}
                        >
                          {filmstripScreenshots.map((ss, index) => {
                            const isAtPlayhead = index === playheadScreenshotIndex;
                            return (
                              <div
                                key={ss.id}
                                className={`flex-shrink-0 cursor-pointer transition-all h-full ${
                                  isAtPlayhead
                                    ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-background z-10'
                                    : 'opacity-60 hover:opacity-100'
                                }`}
                                onClick={() => handleFilmstripClick(index)}
                                title={`${formatEventTime(new Date(ss.timestamp * 1000))} - ${
                                  typeof ss.appName === 'object' ? ss.appName?.String : ss.appName || 'Unknown'
                                }`}
                              >
                                <Screenshot
                                  screenshot={ss}
                                  size="thumbnail"
                                  showOverlay={false}
                                  className="!w-auto h-full rounded"
                                />
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* Center indicator line aligned with playhead - at chart center */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-blue-500/50 pointer-events-none"
                      style={{ left: MARGIN.left + (dimensions.width - MARGIN.left - MARGIN.right) / 2 }}
                    />
                  </>
                ) : (
                  /* Empty state - maintain height to prevent layout shift */
                  <div className="flex items-center justify-center h-full text-muted-foreground/30">
                    <Camera className="h-8 w-8" />
                  </div>
                )}
              </div>

              {/* Filmstrip resize handle */}
              <div
                className="h-2 bg-border hover:bg-primary/50 cursor-ns-resize flex items-center justify-center group"
                onMouseDown={(e) => {
                  resizeStartRef.current = { startY: e.clientY, startHeight: filmstripHeight };
                  setResizingTarget('filmstrip');
                  setIsResizing(true);
                }}
              >
                <div className="w-12 h-1 bg-muted-foreground/30 group-hover:bg-primary/50 rounded-full" />
              </div>
            </>
          )}
        </div>
      )}

      {/* Timeline visualization */}
      <div className="relative flex-1 min-h-[200px]">
        {/* Controls */}
        <div className="absolute top-2 right-2 z-10 flex gap-1">
          {/* Toggle collapse activity lanes */}
          <button
            onClick={() => setCollapseActivityRows(!collapseActivityRows)}
            className="px-2 py-1 text-xs bg-muted hover:bg-muted/80 rounded text-muted-foreground flex items-center gap-1"
            title={collapseActivityRows ? 'Expand app lanes' : 'Collapse to In Focus'}
          >
            {collapseActivityRows ? (
              <>
                <ChevronRight className="h-3 w-3" />
                <Eye className="h-3 w-3" />
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" />
                <Eye className="h-3 w-3" />
              </>
            )}
            {collapseActivityRows ? 'Expand Apps' : 'In Focus'}
          </button>
          <button
            onClick={handleResetZoom}
            className="px-2 py-1 text-xs bg-muted hover:bg-muted/80 rounded text-muted-foreground"
          >
            Reset Zoom
          </button>
          {currentZoom.k !== 1 && visibleDurationLabel && (
            <span className="px-2 py-1 text-xs bg-muted rounded text-muted-foreground">
              {visibleDurationLabel} visible
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

      {/* Bottom half: Event list - only show when not using side panel */}
      {!hideEmbeddedList && (
      <div className="flex-shrink-0 border-t border-border bg-background/50">
        {/* List header - clickable to collapse */}
        <div
          className="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-muted/30"
          onClick={() => setListCollapsed(!listCollapsed)}
        >
          <div className="flex items-center gap-2">
            {listCollapsed ? (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            )}
            <span className="text-sm font-medium text-foreground">Events</span>
            <span className="text-xs text-muted-foreground">
              ({visibleEvents.length} in view)
            </span>
            {playheadTimestamp && (
              <span className="text-xs text-blue-400 flex items-center gap-1">
                <span className="w-2 h-2 bg-blue-500 rounded-full" />
                {formatEventTime(playheadTimestamp)}
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground">{timeRangeDisplay}</span>
        </div>

        {/* List content - only show when not collapsed */}
        {!listCollapsed && (
          <>
            {/* Resize handle */}
            <div
              ref={resizeHandleRef}
              className="h-2 bg-border hover:bg-primary/50 cursor-ns-resize flex items-center justify-center group"
              onMouseDown={(e) => {
                e.stopPropagation();
                resizeStartRef.current = { startY: e.clientY, startHeight: listHeight };
                setResizingTarget('list');
                setIsResizing(true);
              }}
            >
              <div className="w-12 h-1 bg-muted-foreground/30 group-hover:bg-primary/50 rounded-full" />
            </div>

            {/* Event list */}
            <div className="overflow-y-auto" style={{ height: listHeight }}>
          {visibleEvents.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              No events in visible range
            </div>
          ) : (
            <div className="divide-y divide-border">
              {visibleEvents.slice(0, 100).map((event, index) => {
                const Icon = EVENT_TYPE_ICONS[event.type];
                const duration = formatDuration(event.duration);
                const canEdit = event.type === 'activity';
                const canDelete = event.type !== 'screenshot';
                const isAtPlayhead = index === 0; // First item is at playhead
                return (
                  <div
                    key={event.id}
                    className={`px-4 py-2 hover:bg-muted/50 flex items-center gap-3 group ${isAtPlayhead ? 'bg-blue-500/10 border-l-2 border-l-blue-500' : ''}`}
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
          </>
        )}
      </div>
      )}

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
          isTooltipHoveredRef.current = true;
        }}
        onMouseLeave={() => {
          isTooltipHoveredRef.current = false;
          setHoveredEvent(null);
          setTooltipPosition(null);
        }}
      />

      {/* Fullscreen image gallery */}
      <ImageGallery
        screenshots={filmstripScreenshots}
        initialIndex={galleryIndex}
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
      />
    </div>
  );
}
