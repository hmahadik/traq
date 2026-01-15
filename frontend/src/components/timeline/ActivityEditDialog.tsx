/**
 * Activity Edit Dialog
 *
 * Dialog for editing a single activity (window focus event).
 * Allows editing: app name, window title, category, and time range.
 */

import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUpdateActivity } from '@/api/hooks';
import type { ActivityBlock } from '@/types/timeline';

interface ActivityEditDialogProps {
  activity: ActivityBlock | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  knownAppNames?: string[]; // List of known app names for suggestions
}

const CATEGORIES = [
  { value: 'focus', label: 'Focus', color: 'bg-blue-500' },
  { value: 'meetings', label: 'Meetings', color: 'bg-purple-500' },
  { value: 'comms', label: 'Communication', color: 'bg-green-500' },
  { value: 'other', label: 'Other', color: 'bg-gray-500' },
] as const;

export function ActivityEditDialog({
  activity,
  open,
  onOpenChange,
  knownAppNames = [],
}: ActivityEditDialogProps) {
  const updateActivity = useUpdateActivity();

  // Form state
  const [appName, setAppName] = useState('');
  const [windowTitle, setWindowTitle] = useState('');
  const [category, setCategory] = useState('other');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  // Initialize form when activity changes
  useEffect(() => {
    if (activity) {
      setAppName(activity.appName);
      setWindowTitle(activity.windowTitle);
      setCategory(activity.category || 'other');
      // Format timestamps as HH:mm for time inputs
      setStartTime(format(new Date(activity.startTime * 1000), 'HH:mm'));
      setEndTime(format(new Date(activity.endTime * 1000), 'HH:mm'));
    }
  }, [activity]);

  // Calculate duration from times
  const duration = useMemo(() => {
    if (!activity || !startTime || !endTime) return null;

    const baseDate = new Date(activity.startTime * 1000);
    const [startHours, startMins] = startTime.split(':').map(Number);
    const [endHours, endMins] = endTime.split(':').map(Number);

    const startDate = new Date(baseDate);
    startDate.setHours(startHours, startMins, 0, 0);

    const endDate = new Date(baseDate);
    endDate.setHours(endHours, endMins, 0, 0);

    // Handle end time crossing midnight
    if (endDate < startDate) {
      endDate.setDate(endDate.getDate() + 1);
    }

    const diffMs = endDate.getTime() - startDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;

    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  }, [activity, startTime, endTime]);

  // Handle save
  const handleSave = async () => {
    if (!activity) return;

    // Convert times back to Unix timestamps
    const baseDate = new Date(activity.startTime * 1000);
    const [startHours, startMins] = startTime.split(':').map(Number);
    const [endHours, endMins] = endTime.split(':').map(Number);

    const startDate = new Date(baseDate);
    startDate.setHours(startHours, startMins, 0, 0);

    const endDate = new Date(baseDate);
    endDate.setHours(endHours, endMins, 0, 0);

    // Handle end time crossing midnight
    if (endDate < startDate) {
      endDate.setDate(endDate.getDate() + 1);
    }

    const startTimestamp = Math.floor(startDate.getTime() / 1000);
    const endTimestamp = Math.floor(endDate.getTime() / 1000);

    try {
      await updateActivity.mutateAsync({
        id: activity.id,
        windowTitle,
        appName,
        startTime: startTimestamp,
        endTime: endTimestamp,
      });
      onOpenChange(false);
    } catch (error) {
      // Error is handled by the mutation's onError
      console.error('Failed to update activity:', error);
    }
  };

  // Validation
  const isValid = appName.trim() !== '' && windowTitle.trim() !== '' && startTime && endTime;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Activity</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* App Name */}
          <div className="grid gap-2">
            <Label htmlFor="appName">App Name</Label>
            <Input
              id="appName"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              placeholder="e.g., Chrome, VS Code"
              list="app-names"
            />
            {knownAppNames.length > 0 && (
              <datalist id="app-names">
                {knownAppNames.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            )}
          </div>

          {/* Window Title */}
          <div className="grid gap-2">
            <Label htmlFor="windowTitle">Window Title</Label>
            <Textarea
              id="windowTitle"
              value={windowTitle}
              onChange={(e) => setWindowTitle(e.target.value)}
              placeholder="Window title..."
              rows={2}
            />
          </div>

          {/* Category */}
          <div className="grid gap-2">
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${cat.color}`} />
                      {cat.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Time Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="startTime">Start Time</Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="endTime">End Time</Label>
              <Input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          {/* Duration display */}
          {duration && (
            <div className="text-sm text-muted-foreground">
              Duration: <span className="font-medium">{duration}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!isValid || updateActivity.isPending}
          >
            {updateActivity.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
