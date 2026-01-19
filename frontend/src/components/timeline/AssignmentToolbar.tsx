import { useState } from 'react';
import { Check, X, FolderKanban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useProjects, useBulkAssignProject } from '@/api/hooks';
import type { SelectableActivity } from './useActivitySelection';

interface AssignmentToolbarProps {
    selectedActivities: SelectableActivity[];
    onClearSelection: () => void;
    onAssignmentComplete?: () => void;
}

export function AssignmentToolbar({
    selectedActivities,
    onClearSelection,
    onAssignmentComplete,
}: AssignmentToolbarProps) {
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    const { data: projects } = useProjects();
    const bulkAssign = useBulkAssignProject();

    if (selectedActivities.length === 0) {
        return null;
    }

    const handleAssign = async () => {
        if (!selectedProjectId) return;

        const assignments = selectedActivities.map(a => ({
            eventType: a.eventType,
            eventId: a.eventId,
            projectId: parseInt(selectedProjectId, 10),
        }));

        await bulkAssign.mutateAsync(assignments);
        onClearSelection();
        onAssignmentComplete?.();
    };

    return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-card border border-border rounded-lg shadow-lg p-3 flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
                <FolderKanban className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{selectedActivities.length} selected</span>
            </div>

            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select project..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="0">
                        <span className="text-muted-foreground">Unassigned</span>
                    </SelectItem>
                    {projects?.map(project => (
                        <SelectItem key={project.id} value={String(project.id)}>
                            <div className="flex items-center gap-2">
                                <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: project.color }}
                                />
                                {project.name}
                            </div>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Button
                size="sm"
                onClick={handleAssign}
                disabled={!selectedProjectId || bulkAssign.isPending}
            >
                <Check className="w-4 h-4 mr-1" />
                Assign
            </Button>

            <Button
                size="sm"
                variant="ghost"
                onClick={onClearSelection}
            >
                <X className="w-4 h-4" />
            </Button>
        </div>
    );
}
