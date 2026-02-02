import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import GridLayout, { Layout } from 'react-grid-layout';
import { Button } from '@/components/ui/button';
import { GripVertical, Lock, Unlock, RotateCcw } from 'lucide-react';
import 'react-grid-layout/css/styles.css';

export interface DashboardWidget {
  id: string;
  title: string;
  component: React.ReactNode;
  defaultLayout: {
    w: number;
    h: number;
    minW?: number;
    minH?: number;
    maxW?: number;
    maxH?: number;
  };
}

interface DashboardGridProps {
  widgets: DashboardWidget[];
  storageKey: string;
  cols?: number;
  rowHeight?: number;
}

const GRID_COLS = 12;
const ROW_HEIGHT = 80;

function getDefaultLayout(widgets: DashboardWidget[]): Layout[] {
  let currentY = 0;
  let currentX = 0;
  const layout: Layout[] = [];

  widgets.forEach((widget) => {
    const { w, h, minW, minH, maxW, maxH } = widget.defaultLayout;

    // If widget doesn't fit on current row, move to next row
    if (currentX + w > GRID_COLS) {
      currentX = 0;
      currentY += 2; // Move down by 2 rows
    }

    layout.push({
      i: widget.id,
      x: currentX,
      y: currentY,
      w,
      h,
      minW: minW ?? 3,
      minH: minH ?? 2,
      maxW: maxW ?? GRID_COLS,
      maxH: maxH ?? 12,
    });

    currentX += w;
    if (currentX >= GRID_COLS) {
      currentX = 0;
      currentY += h;
    }
  });

  return layout;
}

function loadLayout(storageKey: string, widgets: DashboardWidget[]): Layout[] {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved) as Layout[];
      // Validate that all widget IDs exist
      const widgetIds = new Set(widgets.map((w) => w.id));
      const savedIds = new Set(parsed.map((l) => l.i));

      // If widgets changed, reset to default
      if (widgetIds.size !== savedIds.size ||
          [...widgetIds].some((id) => !savedIds.has(id))) {
        return getDefaultLayout(widgets);
      }
      return parsed;
    }
  } catch (e) {
    console.error('Failed to load layout:', e);
  }
  return getDefaultLayout(widgets);
}

function saveLayout(storageKey: string, layout: Layout[]) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(layout));
  } catch (e) {
    console.error('Failed to save layout:', e);
  }
}

export function DashboardGrid({
  widgets,
  storageKey,
  cols = GRID_COLS,
  rowHeight = ROW_HEIGHT,
}: DashboardGridProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [layout, setLayout] = useState<Layout[]>(() => loadLayout(storageKey, widgets));
  const [containerWidth, setContainerWidth] = useState(1200);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const handleLayoutChange = useCallback(
    (newLayout: Layout[]) => {
      setLayout(newLayout);
      saveLayout(storageKey, newLayout);
    },
    [storageKey]
  );

  const handleReset = useCallback(() => {
    const defaultLayout = getDefaultLayout(widgets);
    setLayout(defaultLayout);
    saveLayout(storageKey, defaultLayout);
  }, [widgets, storageKey]);

  const widgetMap = useMemo(
    () => new Map(widgets.map((w) => [w.id, w])),
    [widgets]
  );

  return (
    <div ref={containerRef} className="relative">
      {/* Edit mode controls */}
      <div className="absolute -top-12 right-0 flex items-center gap-2 z-10">
        {isEditing && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
        )}
        <Button
          variant={isEditing ? 'default' : 'outline'}
          size="sm"
          onClick={() => setIsEditing(!isEditing)}
          className="gap-1.5"
        >
          {isEditing ? (
            <>
              <Lock className="h-3.5 w-3.5" />
              Lock
            </>
          ) : (
            <>
              <Unlock className="h-3.5 w-3.5" />
              Edit Layout
            </>
          )}
        </Button>
      </div>

      <GridLayout
        className="layout"
        layout={layout}
        cols={cols}
        rowHeight={rowHeight}
        width={containerWidth}
        onLayoutChange={handleLayoutChange}
        isDraggable={isEditing}
        isResizable={isEditing}
        draggableHandle=".drag-handle"
        resizeHandles={['se', 's', 'e']}
        margin={[16, 16]}
        containerPadding={[0, 0]}
        useCSSTransforms={true}
      >
        {layout.map((item) => {
          const widget = widgetMap.get(item.i);
          if (!widget) return null;

          return (
            <div
              key={item.i}
              className={`relative ${isEditing ? 'ring-2 ring-primary/20 ring-offset-2 rounded-lg' : ''}`}
            >
              {isEditing && (
                <div className="drag-handle absolute -top-0 left-1/2 -translate-x-1/2 z-10 cursor-move bg-primary/10 hover:bg-primary/20 rounded-b-md px-3 py-0.5 transition-colors">
                  <GripVertical className="h-4 w-4 text-primary/60" />
                </div>
              )}
              <div className="dashboard-widget-content h-full w-full overflow-hidden">
                {widget.component}
              </div>
            </div>
          );
        })}
      </GridLayout>
    </div>
  );
}
