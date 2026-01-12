import React from 'react';
import { Button } from '@/components/ui/button';
import { GitBranch, Terminal, FolderOpen, Globe, Camera } from 'lucide-react';

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

export const FilterControls: React.FC<FilterControlsProps> = ({ filters, onFiltersChange }) => {
  const toggleFilter = (key: keyof TimelineFilters) => {
    onFiltersChange({ ...filters, [key]: !filters[key] });
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm text-muted-foreground mr-2">Show:</span>

      <Button
        variant={filters.showGit ? 'default' : 'outline'}
        size="sm"
        onClick={() => toggleFilter('showGit')}
        className={filters.showGit ? 'bg-purple-600 hover:bg-purple-700' : ''}
      >
        <GitBranch className="h-4 w-4 mr-1" />
        Git
      </Button>

      <Button
        variant={filters.showShell ? 'default' : 'outline'}
        size="sm"
        onClick={() => toggleFilter('showShell')}
        className={filters.showShell ? 'bg-slate-600 hover:bg-slate-700' : ''}
      >
        <Terminal className="h-4 w-4 mr-1" />
        Shell
      </Button>

      <Button
        variant={filters.showFiles ? 'default' : 'outline'}
        size="sm"
        onClick={() => toggleFilter('showFiles')}
        className={filters.showFiles ? 'bg-indigo-600 hover:bg-indigo-700' : ''}
      >
        <FolderOpen className="h-4 w-4 mr-1" />
        Files
      </Button>

      <Button
        variant={filters.showBrowser ? 'default' : 'outline'}
        size="sm"
        onClick={() => toggleFilter('showBrowser')}
        className={filters.showBrowser ? 'bg-cyan-600 hover:bg-cyan-700' : ''}
      >
        <Globe className="h-4 w-4 mr-1" />
        Browser
      </Button>

      <Button
        variant={filters.showScreenshots ? 'default' : 'outline'}
        size="sm"
        onClick={() => toggleFilter('showScreenshots')}
        className={filters.showScreenshots ? 'bg-blue-600 hover:bg-blue-700' : ''}
      >
        <Camera className="h-4 w-4 mr-1" />
        Screenshots
      </Button>

      {/* Reset button if any filter is off */}
      {(!filters.showGit || !filters.showShell || !filters.showFiles || !filters.showBrowser || !filters.showScreenshots) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onFiltersChange({
            showGit: true,
            showShell: true,
            showFiles: true,
            showBrowser: true,
            showScreenshots: true,
          })}
        >
          Reset
        </Button>
      )}
    </div>
  );
};
