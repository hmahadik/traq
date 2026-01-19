import { useState, useCallback } from 'react';

export interface SelectableActivity {
    eventType: string;
    eventId: number;
    projectId?: number;
}

export function useActivitySelection() {
    const [selectedActivities, setSelectedActivities] = useState<Map<string, SelectableActivity>>(new Map());

    const getKey = (activity: SelectableActivity) => `${activity.eventType}-${activity.eventId}`;

    const toggleSelection = useCallback((activity: SelectableActivity) => {
        setSelectedActivities(prev => {
            const next = new Map(prev);
            const key = getKey(activity);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.set(key, activity);
            }
            return next;
        });
    }, []);

    const selectRange = useCallback((activities: SelectableActivity[]) => {
        setSelectedActivities(prev => {
            const next = new Map(prev);
            activities.forEach(a => next.set(getKey(a), a));
            return next;
        });
    }, []);

    const clearSelection = useCallback(() => {
        setSelectedActivities(new Map());
    }, []);

    const isSelected = useCallback((activity: SelectableActivity) => {
        return selectedActivities.has(getKey(activity));
    }, [selectedActivities]);

    return {
        selectedActivities: Array.from(selectedActivities.values()),
        selectedCount: selectedActivities.size,
        toggleSelection,
        selectRange,
        clearSelection,
        isSelected,
    };
}
