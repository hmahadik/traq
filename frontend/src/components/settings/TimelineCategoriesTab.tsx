import { useState, useEffect } from 'react';
import { GetCategorizationRules, SetAppTimelineCategory, DeleteTimelineCategoryRule } from '../../../wailsjs/go/main/App';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Trash2, Lock } from 'lucide-react';
import { toast } from 'sonner';

interface CategorizationRule {
  id: number;
  appName: string;
  category: string;
  isSystemDefault: boolean;
  createdAt: number;
}

const CATEGORIES = [
  { value: 'focus', label: 'Focus', color: 'bg-green-500/10 text-green-500 hover:bg-green-500/20' },
  { value: 'meetings', label: 'Meetings', color: 'bg-red-500/10 text-red-500 hover:bg-red-500/20' },
  { value: 'comms', label: 'Communication', color: 'bg-purple-500/10 text-purple-500 hover:bg-purple-500/20' },
  { value: 'other', label: 'Other', color: 'bg-gray-500/10 text-gray-500 hover:bg-gray-500/20' },
];

export function TimelineCategoriesTab() {
  const [rules, setRules] = useState<CategorizationRule[]>([]);
  const [filteredRules, setFilteredRules] = useState<CategorizationRule[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [newAppName, setNewAppName] = useState('');
  const [newCategory, setNewCategory] = useState('other');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRule, setEditingRule] = useState<number | null>(null);

  const loadRules = async () => {
    try {
      setLoading(true);
      const result = await GetCategorizationRules();
      setRules(result || []);
      setFilteredRules(result || []);
    } catch (error) {
      console.error('Failed to load categorization rules:', error);
      toast.error('Failed to load categorization rules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      setFilteredRules(
        rules.filter((rule) =>
          rule.appName.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    } else {
      setFilteredRules(rules);
    }
  }, [searchQuery, rules]);

  const handleAddRule = async () => {
    if (!newAppName.trim()) {
      toast.error('App name cannot be empty');
      return;
    }

    try {
      await SetAppTimelineCategory(newAppName.trim(), newCategory);
      toast.success(`Added categorization rule for ${newAppName}`);
      await loadRules();
      setNewAppName('');
      setNewCategory('other');
      setShowAddForm(false);
    } catch (error) {
      console.error('Failed to add rule:', error);
      toast.error('Failed to add rule');
    }
  };

  const handleUpdateRule = async (appName: string, category: string) => {
    try {
      await SetAppTimelineCategory(appName, category);
      toast.success(`Updated category for ${appName}`);
      await loadRules();
      setEditingRule(null);
    } catch (error) {
      console.error('Failed to update rule:', error);
      toast.error('Failed to update rule');
    }
  };

  const handleDeleteRule = async (appName: string, isSystemDefault: boolean) => {
    if (isSystemDefault) {
      toast.error('Cannot delete system default rules');
      return;
    }

    try {
      await DeleteTimelineCategoryRule(appName);
      toast.success(`Deleted rule for ${appName}`);
      await loadRules();
    } catch (error) {
      console.error('Failed to delete rule:', error);
      toast.error('Failed to delete rule');
    }
  };

  const getCategoryColor = (category: string) => {
    return CATEGORIES.find((c) => c.value === category)?.color || 'bg-muted text-muted-foreground';
  };

  const getCategoryLabel = (category: string) => {
    return CATEGORIES.find((c) => c.value === category)?.label || category;
  };

  const stats = {
    focus: rules.filter((r) => r.category === 'focus').length,
    meetings: rules.filter((r) => r.category === 'meetings').length,
    comms: rules.filter((r) => r.category === 'comms').length,
    other: rules.filter((r) => r.category === 'other').length,
    systemDefaults: rules.filter((r) => r.isSystemDefault).length,
    custom: rules.filter((r) => !r.isSystemDefault).length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-sm text-muted-foreground">Loading categorization rules...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium mb-2">Timeline Categorization Rules</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Categorize apps to organize your timeline view by activity type. Categories determine the color coding in your timeline grid.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="rounded-lg border p-3 text-center">
          <div className="text-2xl font-bold text-green-500">{stats.focus}</div>
          <div className="text-xs text-muted-foreground">Focus</div>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <div className="text-2xl font-bold text-red-500">{stats.meetings}</div>
          <div className="text-xs text-muted-foreground">Meetings</div>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <div className="text-2xl font-bold text-purple-500">{stats.comms}</div>
          <div className="text-xs text-muted-foreground">Communication</div>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <div className="text-2xl font-bold text-gray-500">{stats.other}</div>
          <div className="text-xs text-muted-foreground">Other</div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Lock className="h-3 w-3" />
        <span>{stats.systemDefaults} system defaults, {stats.custom} custom rules</span>
      </div>

      {/* Search and Add */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search apps..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          onClick={() => setShowAddForm(!showAddForm)}
          variant={showAddForm ? 'secondary' : 'default'}
          size="sm"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Rule
        </Button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="rounded-lg border p-4 space-y-3 bg-muted/50">
          <h4 className="text-sm font-medium">Add New Rule</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">App Name</label>
              <Input
                placeholder="e.g., Firefox, Slack..."
                value={newAppName}
                onChange={(e) => setNewAppName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddRule();
                  }
                }}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Category</label>
              <Select value={newCategory} onValueChange={setNewCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowAddForm(false);
                setNewAppName('');
                setNewCategory('other');
              }}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleAddRule}>
              Add Rule
            </Button>
          </div>
        </div>
      )}

      {/* Rules List */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {filteredRules.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {searchQuery ? 'No matching rules found' : 'No categorization rules yet'}
          </p>
        ) : (
          filteredRules.map((rule) => (
            <div
              key={rule.id}
              className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent group"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="text-sm font-medium truncate">{rule.appName}</span>
                {rule.isSystemDefault && (
                  <Lock className="h-3 w-3 text-muted-foreground flex-shrink-0" title="System default" />
                )}
                <Badge
                  variant="outline"
                  className={getCategoryColor(rule.category)}
                >
                  {getCategoryLabel(rule.category)}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={rule.category}
                  onValueChange={(value) => handleUpdateRule(rule.appName, value)}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!rule.isSystemDefault && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDeleteRule(rule.appName, rule.isSystemDefault)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
        <p><strong>Focus</strong> (green): Development tools, editors, terminals</p>
        <p><strong>Meetings</strong> (red): Video conferencing, calendar apps</p>
        <p><strong>Communication</strong> (purple): Messaging, email, chat apps</p>
        <p><strong>Other</strong> (gray): Everything else</p>
      </div>
    </div>
  );
}
