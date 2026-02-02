import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import { ChevronDown, ChevronRight, Eye, Camera } from 'lucide-react';
import type { TimelineGridData } from '@/types/timeline';
import type { Screenshot as ScreenshotType } from '@/types/screenshot';
import type { TimelineFilters } from '../FilterControls';
import { useTimelineData } from './useTimelineData';
import { useMultiDayTimelineData } from './useMultiDayTimelineData';
import { TimelineTooltip } from './TimelineTooltip';
import type { EventDot } from './timelineTypes';
import type { DayData } from '@/hooks/useMultiDayTimeline';
import type { EventKey } from '@/utils/eventKeys';
import { Screenshot } from '@/components/common/Screenshot';
import { ImageGallery } from '@/components/common/ImageGallery';
import { api } from '@/api/client';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

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

interface TimelineProps {
  // New multi-day props
  loadedDays?: Map<string, DayData>;
  multiDayTimeRange?: { start: Date; end: Date };
  onPlayheadChange?: (timestamp: Date, visibleRange?: { start: Date; end: Date }, zoomLevel?: number) => void;
  loadingDays?: Set<string>; // Dates that are currently loading (for loading indicators)

  // Navigation props
  targetPlayheadDate?: Date | null; // When set, timeline will pan to this date
  onTargetReached?: () => void; // Called after panning to target completes

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
  onViewSession?: (event: EventDot) => void;
}

// Layout constants
const MARGIN = { top: 50, right: 30, bottom: 30, left: 160 };
const ROW_HEIGHT = 32; // Fixed height for each swim lane
const DOT_RADIUS = 5;
const DOT_HOVER_RADIUS = 8;
const BAR_MIN_DURATION = 10; // Minimum duration (seconds) to render as bar
const BAR_MIN_PIXELS = 6; // Minimum pixel width to render as bar
const BAR_WIDTH = 1; // Width of thin bars for instant/brief events (event-dot)


export function Timeline({
  // Multi-day props
  loadedDays,
  multiDayTimeRange,
  onPlayheadChange,
  loadingDays,
  // Navigation props
  targetPlayheadDate,
  onTargetReached,
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
  onViewSession,
}: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });
  const [hoveredEvent, setHoveredEvent] = useState<EventDot | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const tooltipHideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMouseOverTooltipRef = useRef(false);
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

  // === NOW REF: Store consistent "now" time for both NOW line and bar capping ===
  // This prevents visual mismatch when bars are capped at a different time than the NOW line
  const nowTimeRef = useRef<number>(Date.now());

  // === CHART CENTER REF: Store chartCenterX so handlers always use current value ===
  const chartCenterXRef = useRef(0);

  // === ZOOM REF: Store zoom behavior to persist across data updates ===
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const chartInitializedRef = useRef(false);

  // === TRACKING REFS: Detect when to recreate zoom ===
  const prevDimensionsRef = useRef({ width: 0, height: 0 });
  const prevTimeRangeRef = useRef<{ start: number; end: number } | null>(null);

  // Flag to skip callbacks during internal state restoration (prevents feedback loops)
  const isRestoringStateRef = useRef(false);

  // === CALLBACK REFS: Store callbacks in refs to avoid dependency array issues ===
  const onPlayheadChangeRef = useRef(onPlayheadChange);
  const onEventClickRef = useRef(onEventClick);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const selectedEventKeysRef = useRef(selectedEventKeys);
  const onTargetReachedRef = useRef(onTargetReached);
  const showTooltipRef = useRef<(event: EventDot, clientX: number, clientY: number) => void>(() => {});
  const hideTooltipWithDelayRef = useRef<() => void>(() => {});

  // Gallery state for fullscreen screenshot viewer
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [filmstripHeight, setFilmstripHeight] = useState(() => {
    try {
      const stored = localStorage.getItem('timeline-filmstrip-height');
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
  const [resizingTarget, setResizingTarget] = useState<'filmstrip' | null>(null);
  const resizeStartRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const [collapseActivityRows, setCollapseActivityRows] = useState(() => {
    try {
      const stored = localStorage.getItem('timeline-collapse-activity');
      return stored === 'true';
    } catch {
      return true; // Default to collapsed
    }
  });

  // Hidden lanes - which special lanes to hide
  const [hiddenLanes, setHiddenLanes] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('timeline-hidden-lanes');
      if (stored) {
        return new Set(JSON.parse(stored));
      }
    } catch {
      // Ignore
    }
    return new Set(); // All visible by default
  });
  const [filmstripCollapsed, setFilmstripCollapsed] = useState(() => {
    try {
      const stored = localStorage.getItem('timeline-filmstrip-collapsed');
      return stored === 'true';
    } catch {
      return false;
    }
  });

  // Persist filmstrip height to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('timeline-filmstrip-height', filmstripHeight.toString());
    } catch (e) {
      // Ignore localStorage errors
    }
  }, [filmstripHeight]);

  // Persist filmstrip collapsed state
  useEffect(() => {
    try {
      localStorage.setItem('timeline-filmstrip-collapsed', filmstripCollapsed.toString());
    } catch (e) {
      // Ignore localStorage errors
    }
  }, [filmstripCollapsed]);

  // Persist collapse state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('timeline-collapse-activity', collapseActivityRows.toString());
    } catch {
      // Ignore localStorage errors
    }
  }, [collapseActivityRows]);

  // Persist hidden lanes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('timeline-hidden-lanes', JSON.stringify(Array.from(hiddenLanes)));
    } catch {
      // Ignore localStorage errors
    }
  }, [hiddenLanes]);

  // Toggle lane visibility
  const toggleLaneVisibility = useCallback((laneName: string) => {
    setHiddenLanes(prev => {
      const next = new Set(prev);
      if (next.has(laneName)) {
        next.delete(laneName);
      } else {
        next.add(laneName);
      }
      return next;
    });
  }, []);

  // Cleanup timeouts and refs on unmount
  useEffect(() => {
    return () => {
      if (zoomSyncTimeoutRef.current) {
        clearTimeout(zoomSyncTimeoutRef.current);
      }
      if (dragSafetyTimeoutRef.current) {
        clearTimeout(dragSafetyTimeoutRef.current);
      }
      // Reset chart refs on unmount so fresh mount creates structure anew
      chartInitializedRef.current = false;
      zoomRef.current = null;
    };
  }, []);

  // Cleanup tooltip hide timeout on unmount
  useEffect(() => {
    return () => {
      if (tooltipHideTimeoutRef.current) {
        clearTimeout(tooltipHideTimeoutRef.current);
      }
    };
  }, []);

  // Handler to show tooltip on hover
  const showTooltip = useCallback((event: EventDot, clientX: number, clientY: number) => {
    // Cancel any pending hide
    if (tooltipHideTimeoutRef.current) {
      clearTimeout(tooltipHideTimeoutRef.current);
      tooltipHideTimeoutRef.current = null;
    }
    setHoveredEvent(event);
    setTooltipPosition({ x: clientX, y: clientY });
  }, []);

  // Handler to hide tooltip with delay (allows moving mouse to tooltip)
  const hideTooltipWithDelay = useCallback(() => {
    // Don't hide if mouse moved to tooltip
    if (isMouseOverTooltipRef.current) return;

    tooltipHideTimeoutRef.current = setTimeout(() => {
      if (!isMouseOverTooltipRef.current) {
        setHoveredEvent(null);
        setTooltipPosition(null);
      }
    }, 150); // 150ms delay to allow moving to tooltip
  }, []);

  // Handlers for tooltip hover state
  const handleTooltipMouseEnter = useCallback(() => {
    isMouseOverTooltipRef.current = true;
    if (tooltipHideTimeoutRef.current) {
      clearTimeout(tooltipHideTimeoutRef.current);
      tooltipHideTimeoutRef.current = null;
    }
  }, []);

  const handleTooltipMouseLeave = useCallback(() => {
    isMouseOverTooltipRef.current = false;
    setHoveredEvent(null);
    setTooltipPosition(null);
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

  useEffect(() => {
    onTargetReachedRef.current = onTargetReached;
  }, [onTargetReached]);

  useEffect(() => {
    showTooltipRef.current = showTooltip;
  }, [showTooltip]);

  useEffect(() => {
    hideTooltipWithDelayRef.current = hideTooltipWithDelay;
  }, [hideTooltipWithDelay]);

  // Track targetPlayheadDate in a ref so D3 effect can check for pending navigation
  const targetPlayheadDateRef = useRef(targetPlayheadDate);
  useEffect(() => {
    targetPlayheadDateRef.current = targetPlayheadDate;
  }, [targetPlayheadDate]);

  // Transform data to Timeline format
  // Always call both hooks to satisfy React rules of hooks, then choose which data to use
  const singleDayData = useTimelineData({ data, filters, screenshots, entries, collapseActivityRows, hiddenLanes });
  const multiDayData = useMultiDayTimelineData({
    loadedDays: loadedDays ?? new Map(),
    timeRange: multiDayTimeRange ?? { start: new Date(), end: new Date() },
    filters,
    collapseActivityRows,
    hiddenLanes,
  });

  // Use multi-day data if provided, fall back to single-day
  const timelineData = loadedDays && multiDayTimeRange ? multiDayData : singleDayData;

  // Handle resize drag for filmstrip panel
  useEffect(() => {
    let rafId: number | null = null;
    let pendingHeight: number | null = null;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !resizeStartRef.current || !resizingTarget) return;

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
    };

    const handleMouseUp = () => {
      // Apply final height immediately
      if (pendingHeight !== null) {
        setFilmstripHeight(pendingHeight);
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
        const numRows = timelineData?.rows.length || 1;
        const calculatedHeight = MARGIN.top + MARGIN.bottom + numRows * rowHeight;
        setDimensions({ width, height: calculatedHeight });
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [timelineData?.rows.length, rowHeight]);

  // D3 rendering with zoom - uses enter/update/exit pattern to preserve zoom state
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    if (!svg.node() || !timelineData) return;

    const { width, height } = dimensions;
    const { rows, timeRange } = timelineData;

    // Get actual colors
    const foregroundColor = getComputedColor('--foreground', '#e5e5e5');
    const mutedForeground = getComputedColor('--muted-foreground', '#a3a3a3');
    const borderColor = getComputedColor('--border', '#404040');
    const mutedColor = getComputedColor('--muted', '#262626');
    const backgroundColor = getComputedColor('--background', '#171717');

    // === SETUP: Only create structure once ===
    // Check both the ref AND if the chart structure actually exists in the DOM
    // This handles the case where empty state was rendered (no SVG content)
    const chartStructureExists = !svg.select('.chart-group').empty();
    const isFirstRender = !chartInitializedRef.current || !chartStructureExists;

    if (isFirstRender) {
      // Clear any existing content on first render only
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
    } else {
      // Update clip path dimensions if needed
      svg.select('#chart-clip rect')
        .attr('width', width - MARGIN.left - MARGIN.right)
        .attr('height', height);
    }

    // Create/update scales - store in ref so zoom handlers always get latest
    const xScale = d3
      .scaleTime()
      .domain([timeRange.start, timeRange.end])
      .range([MARGIN.left, width - MARGIN.right]);

    // Store scale in ref - zoom handlers will use this ref to get latest scale
    xScaleRef.current = xScale;

    // Use fixed row height instead of scaleBand
    const yScale = (rowName: string): number => {
      const index = rows.findIndex((r) => r.name === rowName);
      return MARGIN.top + index * rowHeight;
    };
    yScale.bandwidth = () => rowHeight;

    // Calculate the center X position for the playhead
    const chartCenterX = MARGIN.left + (width - MARGIN.left - MARGIN.right) / 2;
    chartCenterXRef.current = chartCenterX;

    // === DETECT WHEN TO RECREATE ZOOM ===
    // Only recreate zoom on first render or significant dimension changes
    // Do NOT recreate on timeRange changes - this causes oscillation feedback loops
    // when zooming out triggers more data loading which changes timeRange
    const dimensionsChanged = Math.abs(prevDimensionsRef.current.width - width) > 10;
    const shouldRecreateZoom = isFirstRender || !zoomRef.current || dimensionsChanged;

    // Update tracking refs
    prevDimensionsRef.current = { width, height };
    prevTimeRangeRef.current = { start: timeRange.start.getTime(), end: timeRange.end.getTime() };

    // Create/recreate zoom behavior when needed - use refs in handlers to avoid stale closures
    let zoom = zoomRef.current;
    if (shouldRecreateZoom) {
      zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.5, 1440])
        .extent([[MARGIN.left, 0], [width - MARGIN.right, height]])
        // Constrain panning: playhead can't go before data start or past "now"
        .constrain((transform, _extent, _translateExtent) => {
          const now = new Date();
          const currentScale = xScaleRef.current;
          if (!currentScale) return transform;

          // Validate transform
          if (!isFinite(transform.x) || !isFinite(transform.k) || transform.k <= 0) {
            return transform;
          }

          // Use ref for chartCenterX to avoid stale closure
          const centerX = chartCenterXRef.current;
          if (!isFinite(centerX)) return transform;

          // Get the current data boundaries from the scale's domain
          const [domainStart] = currentScale.domain();

          // Calculate what the center timestamp would be with this transform
          const testScale = transform.rescaleX(currentScale);
          const centerTimestamp = testScale.invert(centerX);

          // Validate calculations
          if (!centerTimestamp || !isFinite(centerTimestamp.getTime())) {
            return transform;
          }

          let newTransform = transform;

          // If center would be before data start, clamp it
          if (centerTimestamp < domainStart) {
            const startX = testScale(domainStart);
            if (isFinite(startX)) {
              const shiftNeeded = centerX - startX;
              newTransform = d3.zoomIdentity
                .translate(newTransform.x + shiftNeeded, newTransform.y)
                .scale(newTransform.k);
            }
          }

          // Recalculate center with potentially adjusted transform
          const adjustedScale = newTransform.rescaleX(currentScale);
          const adjustedCenter = adjustedScale.invert(centerX);

          // If center would be in the future, clamp it
          if (adjustedCenter && adjustedCenter > now) {
            const nowX = adjustedScale(now);
            if (isFinite(nowX)) {
              const shiftNeeded = centerX - nowX;
              newTransform = d3.zoomIdentity
                .translate(newTransform.x + shiftNeeded, newTransform.y)
                .scale(newTransform.k);
            }
          }

          return newTransform;
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
            if (playheadTimestampRef.current && visibleTimeRangeRef.current) {
              onPlayheadChangeRef.current?.(playheadTimestampRef.current, visibleTimeRangeRef.current, zoomTransformRef.current.k);
            }
          }
        }, 5000);
      })
      .on('zoom', (event) => {
        const transform = event.transform;
        const currentScale = xScaleRef.current;
        if (!currentScale) return;

        // Use ref for chartCenterX to avoid stale closure
        const centerX = chartCenterXRef.current;

        // Create new scale based on zoom (already constrained by .constrain())
        const newXScale = transform.rescaleX(currentScale);

        // Calculate center timestamp (playhead position)
        const centerTimestamp = newXScale.invert(centerX);

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
          // Only notify parent if this is a real user interaction, not state restoration
          if (playheadTimestampRef.current && visibleTimeRangeRef.current && !isRestoringStateRef.current) {
            onPlayheadChangeRef.current?.(playheadTimestampRef.current, visibleTimeRangeRef.current, zoomTransformRef.current.k);
          }
        }, 150); // 150ms debounce - syncs state after zoom gesture settles

        // Update x-axis with multi-scale formatting (marmelab style)
        const xAxisGroup = svg.select<SVGGElement>('.x-axis');
        // Use fixed tick count based on width - D3 auto-picks optimal positions
        // This ensures legibility at all zoom levels
        const chartWidth = width - MARGIN.left - MARGIN.right;
        const numTicks = Math.max(3, Math.floor(chartWidth / 100));
        xAxisGroup.call(
          d3.axisTop(newXScale)
            .ticks(numTicks)
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

        // Update dots (rendered as thin rect elements, not circles)
        svg.selectAll<SVGRectElement, EventDot>('.event-dot')
          .attr('x', (d) => newXScale(d.timestamp) - BAR_WIDTH / 2);

        // Update bars - use consistent nowTimeRef to match NOW line position
        svg.selectAll<SVGRectElement, EventDot>('.event-bar')
          .attr('x', (d) => newXScale(d.timestamp))
          .attr('width', (d) => {
            const startTime = d.timestamp.getTime();
            const rawEndTime = startTime + ((d.duration || 0) * 1000);
            // Cap end time at "now" to prevent bars extending into the future
            // Use nowTimeRef for consistency with NOW line position
            const endTime = Math.min(rawEndTime, nowTimeRef.current);
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
        // Only notify parent if this is a real user interaction, not state restoration
        if (playheadTimestampRef.current && visibleTimeRangeRef.current && !isRestoringStateRef.current) {
          onPlayheadChangeRef.current?.(playheadTimestampRef.current, visibleTimeRangeRef.current, zoomTransformRef.current.k);
        }
      });

      // Store zoom reference
      zoomRef.current = zoom;

      // Apply zoom to SVG (only on first render)
      svg.call(zoom);

      // Override wheel behavior to zoom centered on playhead instead of mouse position
      svg.on('wheel.zoom', function(event: WheelEvent) {
        event.preventDefault();
        // Larger zoom steps: 0.75x zoom out, 1.33x zoom in (was 0.9/1.1)
        const direction = event.deltaY > 0 ? 0.75 : 1.33;
        const svgNode = svg.node();
        if (svgNode && zoomRef.current) {
          // Use ref for chartCenterX to avoid stale closure after resize
          svg.transition().duration(100).call(
            zoomRef.current.scaleBy as any,
            direction,
            [chartCenterXRef.current, height / 2]
          );
        }
      });
    }
    // End of first-render zoom setup

    // Get or create chart group
    let chartGroup = svg.select<SVGGElement>('.chart-group');
    if (chartGroup.empty()) {
      chartGroup = svg.append('g').attr('class', 'chart-group');
    }

    // Background rect to capture zoom events (create once or update)
    let zoomRect = chartGroup.select<SVGRectElement>('.zoom-rect');
    if (zoomRect.empty()) {
      zoomRect = chartGroup.append('rect').attr('class', 'zoom-rect');
    }
    zoomRect
      .attr('x', MARGIN.left)
      .attr('y', MARGIN.top)
      .attr('width', width - MARGIN.left - MARGIN.right)
      .attr('height', height - MARGIN.top - MARGIN.bottom)
      .attr('fill', 'transparent');

    // Add background for rows (alternating) - uses data join for enter/update/exit
    chartGroup.selectAll<SVGRectElement, typeof rows[0]>('.row-bg')
      .data(rows, d => d.name)
      .join(
        enter => enter.append('rect')
          .attr('class', 'row-bg')
          .attr('opacity', 0.4),
        update => update,
        exit => exit.remove()
      )
      .attr('x', MARGIN.left)
      .attr('y', d => yScale(d.name) || 0)
      .attr('width', width - MARGIN.left - MARGIN.right)
      .attr('height', yScale.bandwidth())
      .attr('fill', (_, i) => (i % 2 === 0 ? mutedColor : 'transparent'));

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

    // Create or update X-axis (time)
    let xAxisGroup = chartGroup.select<SVGGElement>('.x-axis');
    if (xAxisGroup.empty()) {
      xAxisGroup = chartGroup.append('g').attr('class', 'x-axis');
    }
    // Calculate number of ticks based on available width (marmelab style)
    // Aim for ~100px per tick to ensure readability
    const chartWidth = width - MARGIN.left - MARGIN.right;
    const numTicks = Math.max(3, Math.floor(chartWidth / 100));

    xAxisGroup
      .attr('transform', `translate(0,${MARGIN.top})`)
      .call(
        d3.axisTop(xScale)
          .ticks(numTicks)
          .tickFormat((d) => multiScaleFormat(d as Date)) as any
      )
      .call((g) => {
        g.select('.domain').attr('stroke', borderColor);
        g.selectAll('.tick line').attr('stroke', borderColor);
        g.selectAll('.tick text').attr('fill', mutedForeground).attr('font-size', '11px');
      });

    // Add grid lines for hours - uses data join
    let gridLinesGroup = chartGroup.select<SVGGElement>('.grid-lines');
    if (gridLinesGroup.empty()) {
      gridLinesGroup = chartGroup.append('g').attr('class', 'grid-lines');
    }
    const gridLineData = d3.timeHour.range(timeRange.start, timeRange.end);
    gridLinesGroup.selectAll<SVGLineElement, Date>('line')
      .data(gridLineData, d => d.getTime().toString())
      .join(
        enter => enter.append('line')
          .attr('stroke', borderColor)
          .attr('stroke-opacity', 0.3)
          .attr('stroke-dasharray', '2,2'),
        update => update,
        exit => exit.remove()
      )
      .attr('x1', d => xScale(d))
      .attr('x2', d => xScale(d))
      .attr('y1', MARGIN.top)
      .attr('y2', height - MARGIN.bottom);

    // Add day boundary markers at midnight - uses data join
    let dayBoundariesGroup = chartGroup.select<SVGGElement>('.day-boundaries');
    if (dayBoundariesGroup.empty()) {
      dayBoundariesGroup = chartGroup.append('g').attr('class', 'day-boundaries');
    }
    const dayBoundaryData = d3.timeDay.range(timeRange.start, timeRange.end).slice(1); // Skip first day's start

    const dayBoundaryGroups = dayBoundariesGroup.selectAll<SVGGElement, Date>('.day-boundary')
      .data(dayBoundaryData, d => d.getTime().toString())
      .join(
        enter => {
          const g = enter.append('g').attr('class', 'day-boundary');
          g.append('line')
            .attr('stroke', '#3b82f6')
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', '4,4')
            .attr('opacity', 0.6);
          g.append('rect')
            .attr('y', MARGIN.top - 35)
            .attr('width', 90)
            .attr('height', 18)
            .attr('rx', 4)
            .attr('fill', '#3b82f6')
            .attr('opacity', 0.9);
          g.append('text')
            .attr('y', MARGIN.top - 23)
            .attr('text-anchor', 'middle')
            .attr('fill', '#ffffff')
            .attr('font-size', '11px')
            .attr('font-weight', '600');
          return g;
        },
        update => update,
        exit => exit.remove()
      );

    // Update positions for all day boundaries (enter + update)
    dayBoundaryGroups.each(function(d) {
      const g = d3.select(this);
      const x = xScale(d);
      const dateLabel = d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });

      g.select('line')
        .attr('x1', x)
        .attr('x2', x)
        .attr('y1', MARGIN.top - 20)
        .attr('y2', height - MARGIN.bottom);
      g.select('rect')
        .attr('x', x - 45);
      g.select('text')
        .attr('x', x)
        .text(dateLabel);
    });

    // Add loading indicators at edges where data is still loading - uses data join
    // Helper to convert Date to YYYY-MM-DD string
    const getDateStr = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    // Create shimmer gradient once (in defs)
    const defs = svg.select('defs');
    if (defs.select('#loading-shimmer').empty()) {
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
    }

    // Get or create loading group
    let loadingGroup = chartGroup.select<SVGGElement>('.loading-indicators');
    if (loadingGroup.empty()) {
      loadingGroup = chartGroup.append('g')
        .attr('class', 'loading-indicators')
        .attr('clip-path', 'url(#chart-clip)');
    }

    // Build array of loading day dates
    const loadingDayDates: Date[] = [];
    if (loadingDays && loadingDays.size > 0) {
      const allDays = d3.timeDay.range(timeRange.start, new Date(timeRange.end.getTime() + 86400000));
      allDays.forEach((dayStart) => {
        const dayStr = getDateStr(dayStart);
        if (loadingDays.has(dayStr)) {
          loadingDayDates.push(dayStart);
        }
      });
    }

    // Data join for loading shimmer rects
    loadingGroup.selectAll<SVGRectElement, Date>('.loading-shimmer-bg')
      .data(loadingDayDates, d => d.getTime().toString())
      .join(
        enter => enter.append('rect')
          .attr('class', 'loading-shimmer-bg')
          .attr('fill', 'url(#loading-shimmer)')
          .attr('pointer-events', 'none'),
        update => update,
        exit => exit.remove()
      )
      .attr('data-day-start', d => d.getTime().toString())
      .attr('x', d => xScale(d))
      .attr('y', MARGIN.top)
      .attr('width', d => {
        const dayEnd = new Date(d);
        dayEnd.setDate(dayEnd.getDate() + 1);
        return Math.abs(xScale(dayEnd) - xScale(d));
      })
      .attr('height', height - MARGIN.top - MARGIN.bottom);

    // Data join for loading pulse lines
    loadingGroup.selectAll<SVGLineElement, Date>('.loading-pulse-line')
      .data(loadingDayDates, d => d.getTime().toString())
      .join(
        enter => enter.append('line')
          .attr('class', 'loading-pulse-line')
          .attr('stroke', '#3b82f6')
          .attr('stroke-width', 3)
          .attr('opacity', 0.6),
        update => update,
        exit => exit.remove()
      )
      .attr('data-day-start', d => d.getTime().toString())
      .attr('x1', d => xScale(d))
      .attr('x2', d => xScale(d))
      .attr('y1', MARGIN.top)
      .attr('y2', height - MARGIN.bottom);

    // Get or create clipped group for dots
    let dotsGroup = chartGroup.select<SVGGElement>('.dots-group');
    if (dotsGroup.empty()) {
      dotsGroup = chartGroup.append('g')
        .attr('class', 'dots-group')
        .attr('clip-path', 'url(#chart-clip)');
    }

    // Flatten all events for rendering
    const allEvents = rows.flatMap((row) => row.data);

    // === COMPUTE EFFECTIVE SCALE FOR BAR/DOT CATEGORIZATION ===
    // We need to use the scale that will actually be visible after initial zoom,
    // not the base scale. Otherwise, events with duration get incorrectly rendered
    // as dots because they're too small in the unzoomed base scale.
    //
    // If we have a saved zoom transform, use that. Otherwise, compute what the
    // initial ~3h zoom would be.
    let effectiveScale = xScale;
    if (zoomTransformRef.current && zoomTransformRef.current.k !== 1) {
      // Use existing zoom transform
      effectiveScale = zoomTransformRef.current.rescaleX(xScale);
    } else if (!chartInitializedRef.current) {
      // First render: compute initial zoom level (~3h visible)
      const desiredVisibleMs = 3 * 60 * 60 * 1000; // 3 hours
      const totalDomainMs = timeRange.end.getTime() - timeRange.start.getTime();
      const initialK = Math.max(1, totalDomainMs / desiredVisibleMs);

      // Simulate the transform to get the effective scale
      const now = new Date();
      const initialCenterTime = new Date(Math.min(now.getTime(), timeRange.end.getTime()));
      const targetX = xScale(initialCenterTime);
      const initialTx = chartCenterX - targetX * initialK;
      const simulatedTransform = d3.zoomIdentity.translate(initialTx, 0).scale(initialK);
      effectiveScale = simulatedTransform.rescaleX(xScale);
    }

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

    // Update nowTimeRef at the start of each render cycle for consistency
    nowTimeRef.current = Date.now();

    // Filter out events that start after "now" (defensive - shouldn't happen but prevents future rendering)
    const eventsBeforeNow = allEvents.filter((e) => e.timestamp.getTime() <= nowTimeRef.current);

    // Split events into dots and bars based on duration - use effective (zoomed) scale
    const dotEvents = eventsBeforeNow.filter((e) => !shouldRenderAsBar(e, effectiveScale));
    const barEvents = eventsBeforeNow.filter((e) => shouldRenderAsBar(e, effectiveScale));

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

    // Create thin bars for brief/instant events (instead of circles)
    dotsGroup.selectAll('.event-dot')
      .data(dotEvents, (d) => (d as EventDot).id)
      .join('rect')
      .attr('class', 'event-dot')
      .attr('x', (d) => xScale(d.timestamp) - BAR_WIDTH / 2)
      .attr('y', (d) => (yScale(d.row) || 0) + yScale.bandwidth() / 2 - DOT_RADIUS)
      .attr('width', BAR_WIDTH)
      .attr('height', DOT_RADIUS * 2)
      .attr('fill', (d) => d.color)
      .attr('stroke', (d) => isSelected(d) ? '#fff' : getDarkerColor(d.color))
      .attr('stroke-width', (d) => isSelected(d) ? 2.5 : 1)
      .style('cursor', 'pointer')
      .on('mouseenter', function (event, d) {
        // Use transformed scale from current zoom to avoid position jumping
        const currentScale = zoomTransformRef.current.rescaleX(xScaleRef.current!);
        d3.select(this)
          .transition()
          .duration(100)
          .attr('width', BAR_WIDTH + 2)
          .attr('x', () => currentScale(d.timestamp) - (BAR_WIDTH + 2) / 2);
        // Show tooltip on hover
        showTooltipRef.current(d, event.clientX, event.clientY);
      })
      .on('mouseleave', function (_event, d) {
        // Use transformed scale from current zoom to avoid position jumping
        const currentScale = zoomTransformRef.current.rescaleX(xScaleRef.current!);
        d3.select(this)
          .transition()
          .duration(100)
          .attr('width', BAR_WIDTH)
          .attr('x', () => currentScale(d.timestamp) - BAR_WIDTH / 2);
        // Hide tooltip with delay
        hideTooltipWithDelayRef.current();
      })
      .on('click', function (event, d) {
        event.stopPropagation();
        // Handle selection (use refs to avoid stale closures)
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

    // Create rectangles for duration events - sharp corners (no rx/ry)
    dotsGroup.selectAll('.event-bar')
      .data(barEvents, (d) => (d as EventDot).id)
      .join('rect')
      .attr('class', 'event-bar')
      .attr('x', (d) => xScale(d.timestamp))
      .attr('y', (d) => (yScale(d.row) || 0) + yScale.bandwidth() / 2 - DOT_RADIUS)
      .attr('width', (d) => {
        const startTime = d.timestamp.getTime();
        const rawEndTime = startTime + ((d.duration || 0) * 1000);
        // Cap end time at "now" to prevent bars extending into the future
        // Use nowTimeRef for consistency with NOW line position
        const endTime = Math.min(rawEndTime, nowTimeRef.current);
        return Math.max(BAR_MIN_PIXELS, xScale(new Date(endTime)) - xScale(d.timestamp));
      })
      .attr('height', DOT_RADIUS * 2)
      // No rx/ry - sharp corners for rectangles
      .attr('fill', (d) => d.color)
      .attr('fill-opacity', 0.7)
      .attr('stroke', (d) => isSelected(d) ? '#fff' : getDarkerColor(d.color))
      .attr('stroke-width', (d) => isSelected(d) ? 2.5 : 1.5)
      .style('cursor', 'pointer')
      .on('mouseenter', function (event, d) {
        d3.select(this)
          .transition()
          .duration(100)
          .attr('fill-opacity', 0.9);
        // Show tooltip on hover
        showTooltipRef.current(d, event.clientX, event.clientY);
      })
      .on('mouseleave', function () {
        d3.select(this)
          .transition()
          .duration(100)
          .attr('fill-opacity', 0.7);
        // Hide tooltip with delay
        hideTooltipWithDelayRef.current();
      })
      .on('click', function (event, d) {
        event.stopPropagation();
        // Handle selection (use refs to avoid stale closures)
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

    // Fixed label group (doesn't zoom) - select-or-create
    let labelGroup = svg.select<SVGGElement>('.label-group');
    if (labelGroup.empty()) {
      labelGroup = svg.append('g').attr('class', 'label-group');
    }

    // Background for labels - select-or-create
    let labelBg = labelGroup.select<SVGRectElement>('.label-bg');
    if (labelBg.empty()) {
      labelBg = labelGroup.append('rect').attr('class', 'label-bg');
    }
    labelBg
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', MARGIN.left)
      .attr('height', height)
      .attr('fill', backgroundColor);

    // Create Y-axis (row labels) - uses data join for proper enter/update/exit
    const rowLabels = labelGroup.selectAll<SVGGElement, typeof rows[0]>('.row-label')
      .data(rows, d => d.name)
      .join(
        enter => {
          const g = enter.append('g').attr('class', 'row-label');
          // Row color indicator
          g.append('rect')
            .attr('class', 'row-color')
            .attr('x', -MARGIN.left + 12)
            .attr('y', -10)
            .attr('width', 4)
            .attr('height', 20)
            .attr('rx', 2);
          // Row name
          g.append('text')
            .attr('class', 'row-name')
            .attr('x', -MARGIN.left + 24)
            .attr('y', 0)
            .attr('dy', '0.35em')
            .attr('font-size', '13px')
            .attr('font-weight', '500')
            .attr('font-family', 'Inter, system-ui, sans-serif');
          // Event count badge
          g.append('text')
            .attr('class', 'row-count')
            .attr('x', -12)
            .attr('y', 0)
            .attr('dy', '0.35em')
            .attr('text-anchor', 'end')
            .attr('font-size', '11px')
            .attr('font-family', 'Inter, system-ui, sans-serif');
          return g;
        },
        update => update,
        exit => exit.remove()
      )
      .attr('transform', (d) => `translate(${MARGIN.left - 8},${(yScale(d.name) || 0) + yScale.bandwidth() / 2})`);

    // Update row label contents (for both enter and update)
    rowLabels.select('.row-color').attr('fill', d => d.color);
    rowLabels.select('.row-name')
      .attr('fill', foregroundColor)
      .text(d => d.name.length > 12 ? d.name.slice(0, 12) + '…' : d.name);
    rowLabels.select('.row-count')
      .attr('fill', mutedForeground)
      .text(d => `${d.dotCount}`);

    // Add "now" indicator if "now" is within the time range (works for multi-day views)
    // Uses data join so it properly appears/disappears based on time range
    // Use nowTimeRef for consistency with bar capping
    // Buffer handles staleness: timeRange.end is capped at "now" when useMemo runs,
    // but time passes before this effect runs. Use 15 minute buffer to handle this.
    const nowDate = new Date(nowTimeRef.current);
    const bufferMs = 15 * 60 * 1000; // 15 minute buffer to handle timeRange staleness
    const nowData = (nowDate >= timeRange.start && nowDate.getTime() <= timeRange.end.getTime() + bufferMs) ? [nowDate] : [];

    // Now line - uses data join for proper enter/update/exit
    chartGroup.selectAll<SVGLineElement, Date>('.now-line')
      .data(nowData, d => 'now')
      .join(
        enter => enter.append('line')
          .attr('class', 'now-line')
          .attr('stroke', '#ef4444')
          .attr('stroke-width', 2),
        update => update,
        exit => exit.remove()
      )
      .attr('x1', d => xScale(d))
      .attr('x2', d => xScale(d))
      .attr('y1', MARGIN.top)
      .attr('y2', height - MARGIN.bottom);

    // Now text label - uses data join
    chartGroup.selectAll<SVGTextElement, Date>('.now-text')
      .data(nowData, d => 'now')
      .join(
        enter => enter.append('text')
          .attr('class', 'now-text')
          .attr('text-anchor', 'middle')
          .attr('fill', '#ef4444')
          .attr('font-size', '10px')
          .attr('font-weight', '600')
          .text('NOW'),
        update => update,
        exit => exit.remove()
      )
      .attr('x', d => xScale(d))
      .attr('y', MARGIN.top - 8);

    // Add fixed playhead line (stays at center regardless of zoom/pan) - select-or-create
    let playheadGroup = svg.select<SVGGElement>('.playhead-group');
    if (playheadGroup.empty()) {
      playheadGroup = svg.append('g').attr('class', 'playhead-group');
    }

    // Playhead line - select-or-create
    let playheadLine = playheadGroup.select<SVGLineElement>('.playhead-line');
    if (playheadLine.empty()) {
      playheadLine = playheadGroup.append('line')
        .attr('class', 'playhead-line')
        .attr('stroke', '#3b82f6')
        .attr('stroke-width', 2)
        .attr('pointer-events', 'none');
    }
    playheadLine
      .attr('x1', chartCenterX)
      .attr('x2', chartCenterX)
      .attr('y1', MARGIN.top)
      .attr('y2', height - MARGIN.bottom);

    // Playhead triangle marker at top - select-or-create
    let playheadMarker = playheadGroup.select<SVGPolygonElement>('.playhead-marker');
    if (playheadMarker.empty()) {
      playheadMarker = playheadGroup.append('polygon')
        .attr('class', 'playhead-marker')
        .attr('fill', '#3b82f6')
        .attr('pointer-events', 'none');
    }
    playheadMarker.attr('points', `${chartCenterX - 6},${MARGIN.top - 2} ${chartCenterX + 6},${MARGIN.top - 2} ${chartCenterX},${MARGIN.top + 6}`);

    // Store current time range for comparison
    previousTimeRangeRef.current = {
      start: timeRange.start.getTime(),
      end: timeRange.end.getTime(),
    };

    // Bottom date labels (marmelab style) - fixed position labels - select-or-create
    let dateLabelsGroup = svg.select<SVGGElement>('.date-labels-group');
    if (dateLabelsGroup.empty()) {
      dateLabelsGroup = svg.append('g').attr('class', 'date-labels-group');
    }

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

    // Left date label (range start) - select-or-create
    let dateLabelLeft = dateLabelsGroup.select<SVGTextElement>('.date-label-left');
    if (dateLabelLeft.empty()) {
      dateLabelLeft = dateLabelsGroup.append('text')
        .attr('class', 'date-label-left')
        .attr('text-anchor', 'start')
        .attr('font-size', '12px')
        .attr('font-weight', '500');
    }
    dateLabelLeft
      .attr('x', MARGIN.left + 10)
      .attr('y', height - 8)
      .attr('fill', mutedForeground)
      .text(formatDateLabel(timeRange.start));

    // Right date label (range end) - select-or-create
    let dateLabelRight = dateLabelsGroup.select<SVGTextElement>('.date-label-right');
    if (dateLabelRight.empty()) {
      dateLabelRight = dateLabelsGroup.append('text')
        .attr('class', 'date-label-right')
        .attr('text-anchor', 'end')
        .attr('font-size', '12px')
        .attr('font-weight', '500');
    }
    dateLabelRight
      .attr('x', width - MARGIN.right - 10)
      .attr('y', height - 8)
      .attr('fill', mutedForeground)
      .text(formatDateLabel(timeRange.end));

    // Center date/time label (playhead position) - select-or-create, updated by zoom handler
    const defaultCenterTime = playheadTimestampRef.current || xScale.invert(chartCenterX);
    let dateLabelCenter = dateLabelsGroup.select<SVGTextElement>('.date-label-center');
    if (dateLabelCenter.empty()) {
      dateLabelCenter = dateLabelsGroup.append('text')
        .attr('class', 'date-label-center')
        .attr('text-anchor', 'middle')
        .attr('fill', '#3b82f6')
        .attr('font-size', '12px')
        .attr('font-weight', '600');
    }
    dateLabelCenter
      .attr('x', chartCenterX)
      .attr('y', height - 8)
      .text(formatCenterLabel(defaultCenterTime));

    // Zoom instructions (smaller, positioned differently) - select-or-create
    let zoomInstructions = svg.select<SVGTextElement>('.zoom-instructions');
    if (zoomInstructions.empty()) {
      zoomInstructions = svg.append('text')
        .attr('class', 'zoom-instructions')
        .attr('text-anchor', 'end')
        .attr('font-size', '9px')
        .attr('opacity', 0.5)
        .text('Scroll to zoom • Drag to pan');
    }
    zoomInstructions
      .attr('x', width - 10)
      .attr('y', 12)
      .attr('fill', mutedForeground);

    // === RESTORE ZOOM STATE ===
    // Now that all elements exist, restore the previous zoom if we have one
    // This preserves zoom level AND position when data reloads (e.g., new days fetched)
    // BUT: Skip if there's a pending navigation target - navigation logic below will handle it
    const hasExistingPlayhead = playheadTimestampRef.current !== null;
    const isDataReload = !isFirstRender && hasExistingPlayhead;
    const hasPendingNavigation = targetPlayheadDate !== null;

    if (isDataReload && !hasPendingNavigation && zoom) {
      const savedTimestamp = playheadTimestampRef.current!;
      const savedZoomLevel = zoomTransformRef.current.k || 1;

      // Check if saved timestamp is within the new time range
      // If not, we need to clamp it to avoid positioning outside visible area
      const clampedTimestamp = new Date(
        Math.max(timeRange.start.getTime(),
          Math.min(timeRange.end.getTime(), savedTimestamp.getTime()))
      );

      // Calculate where the saved timestamp would be in the new scale
      const savedTimestampX = xScale(clampedTimestamp);

      // Validate the calculation - skip restore if values are invalid
      if (isFinite(savedTimestampX) && isFinite(savedZoomLevel) && savedZoomLevel > 0) {
        // Calculate translation needed to put that timestamp at chart center
        // Formula: transformedX = baseX * k + tx, we want transformedX = chartCenterX
        // So: tx = chartCenterX - baseX * k
        const translateX = chartCenterX - savedTimestampX * savedZoomLevel;

        if (isFinite(translateX)) {
          // Create and apply the restored transform
          const restoredTransform = d3.zoomIdentity
            .translate(translateX, 0)
            .scale(savedZoomLevel);

          // Set flag to prevent zoom handler from triggering feedback loop
          isRestoringStateRef.current = true;

          // Apply without transition for instant restore
          svg.call(zoom.transform as any, restoredTransform);

          // Clear flag after a short delay (let zoom handler complete)
          setTimeout(() => {
            isRestoringStateRef.current = false;
          }, 200);
        }
      }

      // If timestamp was clamped, update the refs (but don't notify parent - it's just clamping)
      if (clampedTimestamp.getTime() !== savedTimestamp.getTime()) {
        playheadTimestampRef.current = clampedTimestamp;
        setPlayheadTimestamp(clampedTimestamp);
      }
    } else if (!isDataReload) {
      // First load - initialize to ~3h visible, centered on "now"
      const now = new Date();
      // Clamp "now" to be within the time range (can't show future)
      const initialCenterTime = new Date(Math.min(now.getTime(), timeRange.end.getTime()));

      // Calculate zoom level for ~3h visible dynamically based on domain size
      const desiredVisibleMs = 3 * 60 * 60 * 1000; // 3 hours
      const totalDomainMs = timeRange.end.getTime() - timeRange.start.getTime();
      const initialK = Math.max(1, totalDomainMs / desiredVisibleMs);

      // Calculate transform to put initialCenterTime at chart center
      const targetX = xScale(initialCenterTime);
      const initialTx = chartCenterX - targetX * initialK;
      const initialTransform = d3.zoomIdentity.translate(initialTx, 0).scale(initialK);

      // Apply initial transform
      if (zoom) {
        svg.call(zoom.transform as any, initialTransform);
      }

      // Calculate visible range at this zoom level
      const transformedScale = initialTransform.rescaleX(xScale);
      const visibleStart = transformedScale.invert(MARGIN.left);
      const visibleEnd = transformedScale.invert(width - MARGIN.right);
      const initialVisibleRange = { start: visibleStart, end: visibleEnd };

      setPlayheadTimestamp(initialCenterTime);
      playheadTimestampRef.current = initialCenterTime;
      setVisibleTimeRange(initialVisibleRange);
      visibleTimeRangeRef.current = initialVisibleRange;
      zoomTransformRef.current = initialTransform;

      // Notify parent of initial state
      onPlayheadChangeRef.current?.(initialCenterTime, initialVisibleRange, initialK);
    }

    // === HANDLE PENDING NAVIGATION ===
    // This runs AFTER scale is created, using the fresh local `xScale` variable
    // which eliminates the race condition that plagued the separate useEffect approach
    // NOTE: Read directly from prop (targetPlayheadDate), not from ref, because
    // the ref sync effect might not have run yet when this effect runs.
    const pendingTarget = targetPlayheadDate;
    if (pendingTarget && zoomRef.current) {
      const targetTime = pendingTarget.getTime();

      // Only navigate if target is within the current loaded time range
      if (targetTime >= timeRange.start.getTime() && targetTime <= timeRange.end.getTime()) {
        // Use the FRESH xScale (local variable, not stale ref!)
        const targetX = xScale(pendingTarget);
        // Calculate zoom level for ~3h visible dynamically based on domain size
        const desiredVisibleMs = 3 * 60 * 60 * 1000; // 3 hours
        const totalDomainMs = timeRange.end.getTime() - timeRange.start.getTime();
        const targetK = Math.max(1, totalDomainMs / desiredVisibleMs);
        const newTx = chartCenterX - targetX * targetK;
        const navigationTransform = d3.zoomIdentity.translate(newTx, 0).scale(targetK);

        // Use shorter duration for first render, normal for subsequent navigations
        const duration = chartInitializedRef.current ? 500 : 0;

        if (duration > 0) {
          svg.transition()
            .duration(duration)
            .ease(d3.easeCubicInOut)
            .call(zoomRef.current.transform as any, navigationTransform)
            .on('end', () => {
              onTargetReachedRef.current?.();
            });
        } else {
          // Instant navigation on first render
          svg.call(zoomRef.current.transform as any, navigationTransform);
          onTargetReachedRef.current?.();
        }
      }
    }

    // Mark chart as initialized - subsequent renders will use enter/update/exit pattern
    chartInitializedRef.current = true;

  // NOTE: Callbacks (onEventClick, onSelectionChange, onPlayheadChange) are stored in refs
  // to prevent this effect from re-running when parent re-renders with new callback refs.
  // selectedEventKeys is also stored in a ref for the same reason.
  // targetPlayheadDate is included to trigger navigation when user clicks Today/Yesterday/etc.
  }, [timelineData, dimensions, getComputedColor, loadingDays, targetPlayheadDate]);

  // Reset zoom handler - pans to center of time range at default zoom level
  const handleResetZoom = useCallback(() => {
    const svg = d3.select(svgRef.current);
    const zoom = zoomRef.current;

    if (!svg.node() || !zoom || !timelineData) return;

    // Calculate center of time range
    const centerTime = new Date(
      (timelineData.timeRange.start.getTime() + timelineData.timeRange.end.getTime()) / 2
    );

    const currentScale = xScaleRef.current;
    if (!currentScale) return;

    const { width } = dimensions;
    const chartCenterX = MARGIN.left + (width - MARGIN.left - MARGIN.right) / 2;

    // Calculate zoom level for ~3h visible dynamically based on domain size
    const desiredVisibleMs = 3 * 60 * 60 * 1000; // 3 hours
    const totalDomainMs = timelineData.timeRange.end.getTime() - timelineData.timeRange.start.getTime();
    const targetK = Math.max(1, totalDomainMs / desiredVisibleMs);
    const centerX = currentScale(centerTime);
    const newTx = chartCenterX - centerX * targetK;

    const newTransform = d3.zoomIdentity.translate(newTx, 0).scale(targetK);

    svg.transition()
      .duration(300)
      .ease(d3.easeCubicOut)
      .call(zoom.transform as any, newTransform);

    // Update state (reset zoom to ~3h visible)
    const resetVisibleRange = timelineData.timeRange;
    setVisibleTimeRange(resetVisibleRange);
    visibleTimeRangeRef.current = resetVisibleRange;
    setPlayheadTimestamp(centerTime);
    playheadTimestampRef.current = centerTime;
    onPlayheadChangeRef.current?.(centerTime, resetVisibleRange, targetK);
  }, [timelineData, dimensions]);

  // Format time for filmstrip display
  const formatEventTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Empty state
  if (!timelineData || timelineData.rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>No events to display</p>
      </div>
    );
  }

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
    const range = visibleTimeRange || timelineData?.timeRange;
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
  }, [visibleTimeRange, timelineData]);

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
                className="h-1.5 cursor-ns-resize flex items-center justify-center group hover:bg-muted/50 transition-colors"
                onMouseDown={(e) => {
                  resizeStartRef.current = { startY: e.clientY, startHeight: filmstripHeight };
                  setResizingTarget('filmstrip');
                  setIsResizing(true);
                }}
              >
                <div className="w-8 h-0.5 bg-muted-foreground/20 group-hover:bg-muted-foreground/40 rounded-full transition-colors" />
              </div>
            </>
          )}
        </div>
      )}

      {/* Timeline visualization */}
      <div className="relative flex-1 min-h-[200px]">
        {/* Controls */}
        <div className="absolute top-2 right-2 z-10 flex gap-1">
          {/* Lane visibility dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs bg-muted hover:bg-muted/80">
                <Eye className="h-3 w-3 mr-1" />
                Lanes
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 max-h-[70vh] overflow-y-auto">
              <DropdownMenuLabel className="text-xs flex justify-between items-center">
                <span>Visible Lanes</span>
                <div className="flex gap-1">
                  <button
                    className="text-[10px] px-1 py-0.5 rounded bg-muted hover:bg-muted/80"
                    onClick={(e) => {
                      e.preventDefault();
                      setHiddenLanes(new Set());
                    }}
                  >
                    All
                  </button>
                  <button
                    className="text-[10px] px-1 py-0.5 rounded bg-muted hover:bg-muted/80"
                    onClick={(e) => {
                      e.preventDefault();
                      const allLanes = timelineData?.availableLanes || [];
                      setHiddenLanes(new Set(allLanes));
                    }}
                  >
                    None
                  </button>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />

              {/* Activity Display Mode */}
              <DropdownMenuCheckboxItem
                checked={collapseActivityRows}
                onCheckedChange={(checked) => setCollapseActivityRows(checked)}
              >
                Collapse Apps to "In Focus"
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />

              {/* Dynamically render all available lanes */}
              {(() => {
                const allLanes = timelineData?.availableLanes || [];
                const specialLanes = ['In Focus', 'Activity', 'Screenshots', 'Projects', 'Sessions'];
                const eventTypeLanes = ['Git', 'Shell', 'Browser', 'Files'];

                // Separate lanes into categories
                const special = allLanes.filter(l => specialLanes.includes(l));
                const eventTypes = allLanes.filter(l => eventTypeLanes.includes(l));
                const appLanes = allLanes.filter(l => !specialLanes.includes(l) && !eventTypeLanes.includes(l));

                return (
                  <>
                    {/* Special lanes */}
                    {special.length > 0 && (
                      <>
                        <DropdownMenuLabel className="text-[10px] text-muted-foreground py-1">Special</DropdownMenuLabel>
                        {special.map(lane => (
                          <DropdownMenuCheckboxItem
                            key={lane}
                            checked={!hiddenLanes.has(lane)}
                            onCheckedChange={() => toggleLaneVisibility(lane)}
                          >
                            {lane}
                          </DropdownMenuCheckboxItem>
                        ))}
                      </>
                    )}

                    {/* App lanes */}
                    {appLanes.length > 0 && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-[10px] text-muted-foreground py-1">
                          Apps ({appLanes.length})
                        </DropdownMenuLabel>
                        {appLanes.map(lane => (
                          <DropdownMenuCheckboxItem
                            key={lane}
                            checked={!hiddenLanes.has(lane)}
                            onCheckedChange={() => toggleLaneVisibility(lane)}
                          >
                            {lane}
                          </DropdownMenuCheckboxItem>
                        ))}
                      </>
                    )}

                    {/* Event type lanes */}
                    {eventTypes.length > 0 && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-[10px] text-muted-foreground py-1">Events</DropdownMenuLabel>
                        {eventTypes.map(lane => (
                          <DropdownMenuCheckboxItem
                            key={lane}
                            checked={!hiddenLanes.has(lane)}
                            onCheckedChange={() => toggleLaneVisibility(lane)}
                          >
                            {lane}
                          </DropdownMenuCheckboxItem>
                        ))}
                      </>
                    )}
                  </>
                );
              })()}
            </DropdownMenuContent>
          </DropdownMenu>
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

      <div
        onMouseEnter={handleTooltipMouseEnter}
        onMouseLeave={handleTooltipMouseLeave}
      >
        <TimelineTooltip
          ref={tooltipRef}
          event={hoveredEvent}
          position={tooltipPosition}
          onDelete={onEventDelete}
          onEdit={onEventEdit}
          onViewScreenshot={onViewScreenshot}
          onViewSession={onViewSession}
          onClose={() => {
            setHoveredEvent(null);
            setTooltipPosition(null);
          }}
        />
      </div>

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
