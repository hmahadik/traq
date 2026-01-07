import { useState, useEffect } from 'react';
import { GetAllApps, SaveAppCategory } from '../../../wailsjs/go/main/App';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search } from 'lucide-react';

interface AppWithCategory {
  appName: string;
  category: string;
}

export function CategoriesTab() {
  const [apps, setApps] = useState<AppWithCategory[]>([]);
  const [filteredApps, setFilteredApps] = useState<AppWithCategory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const loadApps = async () => {
    try {
      setLoading(true);
      const result = await GetAllApps();
      setApps(result || []);
      setFilteredApps(result || []);
    } catch (error) {
      console.error('Failed to load apps:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApps();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      setFilteredApps(
        apps.filter((app) =>
          app.appName.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    } else {
      setFilteredApps(apps);
    }
  }, [searchQuery, apps]);

  const handleCategoryChange = async (appName: string, category: string) => {
    try {
      await SaveAppCategory(appName, category);
      // Update local state
      setApps((prev) =>
        prev.map((app) =>
          app.appName === appName ? { ...app, category } : app
        )
      );
    } catch (error) {
      console.error('Failed to save app category:', error);
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'productive':
        return 'bg-green-500/10 text-green-500 hover:bg-green-500/20';
      case 'distracting':
        return 'bg-red-500/10 text-red-500 hover:bg-red-500/20';
      case 'neutral':
        return 'bg-gray-500/10 text-gray-500 hover:bg-gray-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getCategoryLabel = (category: string) => {
    if (!category) return 'Uncategorized';
    return category.charAt(0).toUpperCase() + category.slice(1);
  };

  const stats = {
    productive: apps.filter((a) => a.category === 'productive').length,
    neutral: apps.filter((a) => a.category === 'neutral').length,
    distracting: apps.filter((a) => a.category === 'distracting').length,
    uncategorized: apps.filter((a) => !a.category).length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-sm text-muted-foreground">Loading apps...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium mb-2">App Productivity Categories</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Categorize apps to calculate accurate productivity scores in analytics.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        <div className="rounded-lg border p-3 text-center">
          <div className="text-2xl font-bold text-green-500">{stats.productive}</div>
          <div className="text-xs text-muted-foreground">Productive</div>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <div className="text-2xl font-bold text-gray-500">{stats.neutral}</div>
          <div className="text-xs text-muted-foreground">Neutral</div>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <div className="text-2xl font-bold text-red-500">{stats.distracting}</div>
          <div className="text-xs text-muted-foreground">Distracting</div>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <div className="text-2xl font-bold">{stats.uncategorized}</div>
          <div className="text-xs text-muted-foreground">Uncategorized</div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search apps..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* App List */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {filteredApps.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No apps found
          </p>
        ) : (
          filteredApps.map((app) => (
            <div
              key={app.appName}
              className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="text-sm font-medium truncate">{app.appName}</span>
                <Badge
                  variant="outline"
                  className={getCategoryColor(app.category)}
                >
                  {getCategoryLabel(app.category)}
                </Badge>
              </div>
              <Select
                value={app.category || 'uncategorized'}
                onValueChange={(value) => {
                  if (value !== 'uncategorized') {
                    handleCategoryChange(app.appName, value);
                  }
                }}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="productive">Productive</SelectItem>
                  <SelectItem value="neutral">Neutral</SelectItem>
                  <SelectItem value="distracting">Distracting</SelectItem>
                  <SelectItem value="uncategorized">Uncategorized</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
