// frontend/src/components/timeline/useListViewData.ts
import { useMemo } from 'react';
import {
  TimelineGridData,
  TimelineListItem,
  ListViewSort,
  ListViewFilter,
} from '@/types/timeline';

export function useListViewData(
  data: TimelineGridData | undefined,
  sort: ListViewSort,
  filter: ListViewFilter
): TimelineListItem[] {
  return useMemo(() => {
    if (!data) return [];

    const items: TimelineListItem[] = [];

    // Convert activities from hourlyGrid
    Object.entries(data.hourlyGrid).forEach(([_hour, apps]) => {
      Object.entries(apps).forEach(([_appName, blocks]) => {
        blocks.forEach((block) => {
          items.push({
            id: `activity-${block.id}`,
            type: 'activity',
            timestamp: block.startTime,
            endTime: block.endTime,
            duration: block.durationSeconds,
            appName: block.appName,
            title: block.windowTitle || block.appName,
            subtitle: block.windowTitle ? block.appName : undefined,
            project: block.projectId ? {
              id: block.projectId,
              name: '', // Would need project name lookup
              color: block.projectColor || '',
            } : undefined,
            category: block.category as any,
          });
        });
      });
    });

    // Convert git events
    Object.values(data.gitEvents).flat().forEach((evt) => {
      items.push({
        id: `git-${evt.id}`,
        type: 'git',
        timestamp: evt.timestamp,
        title: evt.messageSubject,
        subtitle: `${evt.repository} @ ${evt.branch}`,
        appName: 'Git',
      });
    });

    // Convert shell events
    Object.values(data.shellEvents).flat().forEach((evt) => {
      items.push({
        id: `shell-${evt.id}`,
        type: 'shell',
        timestamp: evt.timestamp,
        duration: evt.durationSeconds,
        title: evt.command,
        subtitle: evt.workingDirectory,
        appName: 'Terminal',
      });
    });

    // Convert file events
    Object.values(data.fileEvents).flat().forEach((evt) => {
      items.push({
        id: `file-${evt.id}`,
        type: 'file',
        timestamp: evt.timestamp,
        title: evt.fileName,
        subtitle: `${evt.eventType} in ${evt.directory}`,
        appName: 'Files',
      });
    });

    // Convert browser events
    Object.values(data.browserEvents).flat().forEach((evt) => {
      items.push({
        id: `browser-${evt.id}`,
        type: 'browser',
        timestamp: evt.timestamp,
        duration: evt.visitDurationSeconds,
        title: evt.title,
        subtitle: evt.domain,
        appName: evt.browser,
      });
    });

    // Apply filters
    let filtered = items;

    if (filter.search) {
      const search = filter.search.toLowerCase();
      filtered = filtered.filter(item =>
        item.title.toLowerCase().includes(search) ||
        item.subtitle?.toLowerCase().includes(search)
      );
    }

    if (filter.apps?.length) {
      filtered = filtered.filter(item =>
        item.appName && filter.apps!.includes(item.appName)
      );
    }

    if (filter.types?.length) {
      filtered = filtered.filter(item => filter.types!.includes(item.type));
    }

    if (filter.projects?.length) {
      filtered = filtered.filter(item =>
        item.project && filter.projects!.includes(item.project.id)
      );
    }

    // Apply sort
    filtered.sort((a, b) => {
      let cmp = 0;
      switch (sort.column) {
        case 'time':
          cmp = a.timestamp - b.timestamp;
          break;
        case 'duration':
          cmp = (a.duration || 0) - (b.duration || 0);
          break;
        case 'app':
          cmp = (a.appName || '').localeCompare(b.appName || '');
          break;
        case 'title':
          cmp = a.title.localeCompare(b.title);
          break;
        case 'project':
          cmp = (a.project?.name || '').localeCompare(b.project?.name || '');
          break;
      }
      return sort.direction === 'asc' ? cmp : -cmp;
    });

    return filtered;
  }, [data, sort, filter]);
}
