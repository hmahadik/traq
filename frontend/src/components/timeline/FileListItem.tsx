import { FileText, FileCode, File, FileImage, FilePlus, FileEdit, Trash2, FileX2 } from 'lucide-react';
import type { FileEventDisplay } from '@/types/timeline';
import { TimelineListItem } from './TimelineListItem';

interface FileListItemProps {
  fileEvent: FileEventDisplay;
  isSelected?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

function getFileIcon(extension: string) {
  const ext = extension.toLowerCase();
  if (['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go', '.rs', '.c', '.cpp'].includes(ext)) {
    return <FileCode className="w-3 h-3" />;
  }
  if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'].includes(ext)) {
    return <FileImage className="w-3 h-3" />;
  }
  if (['.txt', '.md', '.json', '.yaml', '.yml', '.xml'].includes(ext)) {
    return <FileText className="w-3 h-3" />;
  }
  return <File className="w-3 h-3" />;
}

function getEventTypeLabel(eventType: string) {
  switch (eventType.toLowerCase()) {
    case 'create':
      return 'Created';
    case 'modify':
      return 'Modified';
    case 'delete':
      return 'Deleted';
    case 'rename':
      return 'Renamed';
    default:
      return eventType;
  }
}

function getEventTypeColor(eventType: string) {
  switch (eventType.toLowerCase()) {
    case 'create':
      return 'text-green-600 dark:text-green-400';
    case 'modify':
      return 'text-blue-600 dark:text-blue-400';
    case 'delete':
      return 'text-red-600 dark:text-red-400';
    case 'rename':
      return 'text-purple-600 dark:text-purple-400';
    default:
      return 'text-gray-600 dark:text-gray-400';
  }
}

export function FileListItem({ fileEvent, isSelected, onClick }: FileListItemProps) {
  const icon = (
    <div className="w-5 h-5 rounded bg-amber-500 flex items-center justify-center text-white">
      {getFileIcon(fileEvent.fileExtension)}
    </div>
  );

  const eventLabel = getEventTypeLabel(fileEvent.eventType);
  const eventColor = getEventTypeColor(fileEvent.eventType);

  const fileSizeFormatted = fileEvent.fileSizeBytes > 0
    ? fileEvent.fileSizeBytes > 1024 * 1024
      ? `${(fileEvent.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB`
      : `${(fileEvent.fileSizeBytes / 1024).toFixed(1)} KB`
    : null;

  const details = [
    eventLabel,
    fileEvent.directory,
    fileSizeFormatted
  ].filter(Boolean).join(' • ');

  const metadata = (
    <span className={eventColor}>{eventLabel}</span>
  );

  return (
    <TimelineListItem
      icon={icon}
      title={fileEvent.fileName}
      details={details}
      timestamp={fileEvent.timestamp}
      metadata={metadata}
      isSelected={isSelected}
      onClick={onClick}
      selectable={Boolean(onClick)}
      reserveCheckboxSpace
    />
  );
}
