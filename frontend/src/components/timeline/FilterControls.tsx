import React from 'react';
import { Button } from '@/components/ui/button';
import { GitBranch, Terminal, FolderOpen, Globe, Camera, RotateCcw } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export interface TimelineFilters {
  showGit: boolean;
  showShell: boolean;
  showFiles: boolean;
  showBrowser: boolean;
  showScreenshots: boolean;
}

interface FilterControlsProps {
  filters: TimelineFilters;
  onFiltersChange: (filters: TimelineFilters) => void;
}

const FILTER_CONFIG = [
  { key: 'showGit' as const, icon: GitBranch, label: 'Git' },
  { key: 'showShell' as const, icon: Terminal, label: 'Shell' },
  { key: 'showFiles' as const, icon: FolderOpen, label: 'Files' },
  { key: 'showBrowser' as const, icon: Globe, label: 'Browser' },
  { key: 'showScreenshots' as const, icon: Camera, label: 'Screenshots' },
];

export const FilterControls: React.FC<FilterControlsProps> = ({ filters, onFiltersChange }) => {
  const toggleFilter = (key: keyof TimelineFilters) => {
    onFiltersChange({ ...filters, [key]: !filters[key] });
  };

  const allEnabled = Object.values(filters).every(Boolean);

  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex items-center gap-0.5 bg-muted/50 rounded-lg p-0.5">
        {!allEnabled && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 mr-0.5"
                onClick={() => onFiltersChange({
                  showGit: true,
                  showShell: true,
                  showFiles: true,
                  showBrowser: true,
                  showScreenshots: true,
                })}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Reset filters</TooltipContent>
          </Tooltip>
        )}

        {FILTER_CONFIG.map(({ key, icon: Icon, label }) => (
          <Tooltip key={key}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={`h-7 w-7 ${filters[key] ? 'bg-background shadow-sm' : 'opacity-50'}`}
                onClick={() => toggleFilter(key)}
              >
                <Icon className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
};
