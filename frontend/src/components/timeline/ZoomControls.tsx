import React from 'react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export const ZOOM_LEVELS = [60, 80, 100, 120, 150] as const;
export type ZoomLevel = typeof ZOOM_LEVELS[number];

export const ZOOM_LABELS: Record<ZoomLevel, string> = {
  60: 'Compact',
  80: 'Small',
  100: 'Normal',
  120: 'Large',
  150: 'Detailed',
};

export const DEFAULT_ZOOM: ZoomLevel = 100;

interface ZoomControlsProps {
  zoom: ZoomLevel;
  onZoomChange: (zoom: ZoomLevel) => void;
}

export const ZoomControls: React.FC<ZoomControlsProps> = ({ zoom, onZoomChange }) => {
  const currentIndex = ZOOM_LEVELS.indexOf(zoom);
  const canZoomOut = currentIndex > 0;
  const canZoomIn = currentIndex < ZOOM_LEVELS.length - 1;

  const handleZoomIn = () => {
    if (canZoomIn) {
      onZoomChange(ZOOM_LEVELS[currentIndex + 1]);
    }
  };

  const handleZoomOut = () => {
    if (canZoomOut) {
      onZoomChange(ZOOM_LEVELS[currentIndex - 1]);
    }
  };

  const handleReset = () => {
    onZoomChange(DEFAULT_ZOOM);
  };

  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex items-center gap-1 bg-muted/50 rounded-lg px-1 py-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleZoomOut}
              disabled={!canZoomOut}
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Zoom out</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="text-xs font-medium text-muted-foreground hover:text-foreground px-2 py-1 rounded transition-colors min-w-[60px] text-center"
              onClick={handleReset}
            >
              {ZOOM_LABELS[zoom]}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Reset to {ZOOM_LABELS[DEFAULT_ZOOM]} ({DEFAULT_ZOOM}px/hour)
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleZoomIn}
              disabled={!canZoomIn}
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Zoom in</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
};
